#!/usr/bin/env node
// nolang — the bootstrap. The CLI body is a bundle served by the NoLang server (`GET <api>/agent/client/`, a tar.gz:
// cli/ = the CLI body, reference/ = the reference docs) and changes together with the server. On every start this file
// checks the bundle against its ETag (304 → the bundle on disk; changed → fetch and unpack again) and runs the bundle's
// cli/nolang.mjs in this process. The bundle has no version number: its fingerprint = sha256 of the tar.gz = the ETag.
// Bundles live in NOLANG_CONFIG_DIR/client/<fingerprint>/ (default ~/.config/nolang). No dependencies (Node 20+).
// The API endpoint is chosen in the same order as the bundled CLI (--api → NOLANG_API_URL → production). Only URLs are
// accepted.
// A bundle (= code that will run) is fetched only from production NoLang, and it runs only after its Ed25519 signature,
// added by the server build, verifies against the public key below. Any other server (a local stack included) is used
// only when a person wrote NOLANG_CLIENT_TRUSTED_ORIGIN=<that URL> to trust that origin (an unsigned bundle runs; a
// signature, if present, is verified).
// Development: NOLANG_CLIENT_DIR=<a checkout of the CLI> runs that checkout's CLI without fetching from a server.
import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

// The bundled CLI is written for Node 20+; say so here instead of failing somewhere inside it
if (Number(process.versions.node.split(".")[0]) < 20) {
  const message = `NoLang needs Node.js 20 or later (this is ${process.version}) — install a newer Node.js (https://nodejs.org/) and run the same command again`;
  console.error(`error: ${message}`);
  process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + "\n");
  process.exit(2);
}

const BOOTSTRAP = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const CONFIG_DIR = process.env.NOLANG_CONFIG_DIR || join(homedir(), ".config", "nolang");
const CLIENT_DIR = join(CONFIG_DIR, "client");
const CURRENT_FILE = join(CLIENT_DIR, "current.json"); // API endpoint → fingerprint of the bundle last used with it
const PROD_API = "https://api.no-lang.com";
// Endpoints a bundle (code) may be fetched from. Fetching and running code from any host named in `--api` /
// NOLANG_API_URL would turn an agent's permission to run `nolang` into a door for arbitrary code, so the list is
// production only. Another origin (a local stack on localhost included — any process on the machine can serve there) is
// accepted only when a person wrote NOLANG_CLIENT_TRUSTED_ORIGIN=<URL> in the shell (permission to run `nolang …` does
// not let an agent set an environment variable, and the value is one origin, so it does not widen to other hosts). A
// bundle from that origin runs even when unsigned (for servers that do not sign). To run the CLI outside these rules use
// NOLANG_CLIENT_DIR (a local checkout, no fetch).
const TRUSTED_ORIGIN = (process.env.NOLANG_CLIENT_TRUSTED_ORIGIN || "").replace(/\/+$/, "");
const unsignedOk = (api) => api === TRUSTED_ORIGIN; // any other source (production) must sign its bundle
// Public keys for the bundle signature (Ed25519, raw 32 bytes, hex) — the same value the NoLang server build signs with.
// To rotate: ship a bootstrap with the new key added here first, switch the build's private key, then remove the old key.
const BUNDLE_PUBLIC_KEYS = ["2cb56de2d1adb85a6ec5ad2ba44b1c1d56f323c7cd923a727d041dc72ba120a7"];
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
// How long to wait for the check when a bundle is on disk (until the headers arrive — past that, run the bundle on disk;
// never delay the start), and how long to wait for the bundle body
const CHECK_TIMEOUT_MS = 1500;
const FETCH_TIMEOUT_MS = 60_000;
// With no bundle on disk (a first run): wait FIRST_TIMEOUT_MS for the headers per attempt, and on failure retry after
// each of FIRST_RETRY_WAITS_MS (rides out the tens of seconds of a server rollout). About 70 s at worst when the server
// does not answer, which is inside an agent shell's default 120 s timeout (a transfer that stalls midway takes longer)
const FIRST_TIMEOUT_MS = 20_000;
const FIRST_RETRY_WAITS_MS = [3_000, 6_000];
const KEEP = 2; // bundles to keep (newest first; the current bundle of each endpoint is always kept)
const STALE_TMP_MS = 3_600_000; // a tmp dir of an install older than this was left by a killed process
const EXIT = { USAGE: 2, NETWORK: 4 }; // same values as EXIT in the bundled CLI

const log = (...args) => console.error(...args);

class BootstrapError extends Error {
  constructor(message, exit) {
    super(message);
    this.exit = exit;
  }
}

// The API endpoint (where the bundle comes from). Same order as pickApi in the bundled CLI; URLs only. `--api` may appear
// once: with two, this file would check the first while the bundled CLI's parser takes the last, so the CLI (and the
// login) would talk to a server that was never checked here. The endpoint chosen here is handed to the CLI (run's `api`)
function apiOf(argv) {
  const isApiFlag = (arg) => arg === "--api" || arg.startsWith("--api=");
  if (argv.filter(isApiFlag).length > 1) throw new BootstrapError("--api is given more than once — give one API endpoint", EXIT.USAGE);
  const i = argv.findIndex(isApiFlag);
  const flag = i < 0 ? undefined : argv[i].includes("=") ? argv[i].slice("--api=".length) : argv[i + 1];
  const raw = flag || process.env.NOLANG_API_URL || PROD_API;
  if (!/^https?:\/\/[^/\s]+/.test(raw)) throw new BootstrapError(`The API endpoint must be an http(s):// URL: ${raw}`, EXIT.USAGE);
  return raw.replace(/\/+$/, "");
}

// Verify the bundle signature (base64) against any of the public keys
function signedByNoLang(bytes, signature) {
  const sig = Buffer.from(signature, "base64");
  return BUNDLE_PUBLIC_KEYS.some((hex) => {
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(hex, "hex")]), format: "der", type: "spki" });
    return verify(null, bytes, key, sig);
  });
}

// Return the files of a tar (ustar / pax) as [path, bytes]. The bundle is a plain archive written by the server
// (regular files only, no directory entries)
function untar(buffer) {
  const out = [];
  let paxPath = null;
  for (let offset = 0; offset + 512 <= buffer.length; ) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start, len) => header.subarray(start, start + len).toString("utf8").replace(/\0.*$/s, "");
    const size = parseInt(field(124, 12).trim() || "0", 8);
    const type = field(156, 1) || "0";
    const prefix = field(345, 155);
    const body = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      paxPath = body.toString("utf8").match(/^\d+ path=(.*)$/m)?.[1] ?? null;
      continue;
    }
    if (type === "g") continue;
    const path = paxPath ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100));
    paxPath = null;
    if (type !== "0") throw new Error(`Unsupported entry in the bundle: ${path} (type ${type})`);
    out.push([path, Buffer.from(body)]);
  }
  return out;
}

async function currentMap() {
  try {
    return JSON.parse(await readFile(CURRENT_FILE, "utf8"));
  } catch {
    return {};
  }
}

const installed = (hash) => existsSync(join(CLIENT_DIR, hash, "cli", "nolang.mjs"));

// Read the response body within timeoutMs. The reader is cancelled by a timer: aborting the fetch signal after the
// headers arrived does not always end `arrayBuffer()`, which then waits minutes for the HTTP client's own body timeout
async function readBody(res, timeoutMs) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    reader.cancel().catch(() => {});
  }, timeoutMs);
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
  }
  if (timedOut) throw new Error(`the transfer stalled (no complete body within ${timeoutMs / 1000} s)`);
  return Buffer.concat(chunks);
}

// Fetch the bundle (with `If-None-Match`): 304 → null, 200 → { hash, bytes }. Unreachable, refused, or a bad signature
// throws. `probe` only asks whether the bundle changed (200 → true, the body is not read)
async function fetchBundle(api, known, timeoutMs, { probe = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${api}/agent/client/`, {
      headers: { accept: "application/gzip", ...(known ? { "if-none-match": `"${known}"` } : {}) },
      redirect: "error", // the bundle must come from the endpoint itself (a redirect elsewhere is refused)
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 304) return null;
  if (!res.ok) throw Object.assign(new Error(`GET ${api}/agent/client/ → ${res.status}`), { status: res.status });
  if (probe) {
    await res.body.cancel().catch(() => {});
    return true;
  }
  const bytes = await readBody(res, FETCH_TIMEOUT_MS); // the headers arrived — allow longer for the body
  const hash = createHash("sha256").update(bytes).digest("hex");
  const etag = (res.headers.get("etag") || "").replace(/"/g, "");
  if (etag && etag !== hash) throw new Error(`The bundle fingerprint differs from the ETag (${hash.slice(0, 12)} ≠ ${etag.slice(0, 12)}) — the content changed mid-transfer`);
  const signature = res.headers.get("x-nolang-bundle-signature");
  if (signature) {
    if (!signedByNoLang(bytes, signature)) throw new BootstrapError(`The signature of the client bundle from ${api} does not match the NoLang key (${hash.slice(0, 12)}) — refusing to run it`, EXIT.NETWORK);
  } else if (!unsignedOk(api)) {
    throw new BootstrapError(`The client bundle from ${api} is not signed (${hash.slice(0, 12)}) — the server image did not sign it. An unsigned bundle runs only from the NOLANG_CLIENT_TRUSTED_ORIGIN origin`, EXIT.NETWORK);
  }
  return { hash, bytes };
}

// Put the bundle in NOLANG_CONFIG_DIR/client/<fingerprint>/. It is unpacked into a tmp dir and then renamed, so a
// concurrent nolang or a failure midway never leaves a half-written dir
async function install(hash, bytes) {
  const dest = join(CLIENT_DIR, hash);
  if (installed(hash)) return dest;
  const tmp = join(CLIENT_DIR, `.${hash}.${process.pid}.tmp`);
  await rm(tmp, { recursive: true, force: true });
  try {
    const paths = [];
    for (const [path, data] of untar(gunzipSync(bytes))) {
      if (isAbsolute(path) || normalize(path).split("/").includes("..")) throw new Error(`Unsupported path in the bundle: ${path}`);
      await mkdir(dirname(join(tmp, path)), { recursive: true });
      await writeFile(join(tmp, path), data);
      paths.push(path);
    }
    if (!existsSync(join(tmp, "cli", "nolang.mjs"))) throw new Error("The bundle has no cli/nolang.mjs");
    try {
      await rename(tmp, dest);
    } catch {
      // dest is already there. A concurrent nolang put it there first (same fingerprint = same content): done. Otherwise
      // it is a damaged leftover (no cli/nolang.mjs): fill it in file by file, cli/nolang.mjs last. dest is never removed
      // here — a concurrent nolang may be running from it
      if (!installed(hash)) {
        for (const path of [...paths.filter((path) => path !== "cli/nolang.mjs"), "cli/nolang.mjs"]) {
          await mkdir(dirname(join(dest, path)), { recursive: true });
          await rename(join(tmp, path), join(dest, path));
        }
      }
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  return dest;
}

// Remove old bundles (keep the newest KEEP and the current bundle of each endpoint) and tmp dirs left by a killed
// install. Best effort: a concurrent nolang may be removing the same dirs, and a failure here must not fail the run
async function prune(current) {
  try {
    const keep = new Set(Object.values(current));
    const dirs = [];
    for (const entry of await readdir(CLIENT_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mtimeMs = (await stat(join(CLIENT_DIR, entry.name)).catch(() => null))?.mtimeMs;
      if (mtimeMs === undefined) continue;
      if (!entry.name.startsWith(".")) dirs.push([entry.name, mtimeMs]);
      else if (entry.name.endsWith(".tmp") && Date.now() - mtimeMs > STALE_TMP_MS) await rm(join(CLIENT_DIR, entry.name), { recursive: true, force: true });
    }
    dirs.sort((a, b) => b[1] - a[1]);
    for (const [name] of dirs.slice(KEEP)) if (!keep.has(name)) await rm(join(CLIENT_DIR, name), { recursive: true, force: true });
  } catch {
    // best effort
  }
}

const reasonOf = (error) => error.cause?.code || error.cause?.message || error.message;

// Fetch when no bundle is on disk. Unreachable, 5xx and a cut transfer are treated as transient and retried
// (a refused 4xx and a signature mismatch are not)
async function fetchFirstBundle(api) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchBundle(api, null, FIRST_TIMEOUT_MS);
    } catch (error) {
      const wait = FIRST_RETRY_WAITS_MS[attempt];
      const refused = error instanceof BootstrapError || (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429);
      if (refused || wait === undefined) throw error;
      log(`Could not fetch the NoLang client from ${api} (${reasonOf(error)}) — retrying in ${wait / 1000} s (attempt ${attempt + 2}/${FIRST_RETRY_WAITS_MS.length + 1})`);
      await sleep(wait);
    }
  }
}

// The bundle to run this time → { dir, hash }. With a bundle on disk the check waits up to CHECK_TIMEOUT_MS (on failure
// the bundle on disk runs). With none, wait with retries (fetchFirstBundle)
async function ensureBundle(api) {
  if (process.env.NOLANG_CLIENT_DIR) return { dir: process.env.NOLANG_CLIENT_DIR, hash: "dev" };
  if (api !== PROD_API && !unsignedOk(api)) {
    throw new BootstrapError(
      `The NoLang client is not fetched from ${api} (only from ${PROD_API}). Another NoLang server (a local stack included) is used only when a person sets NOLANG_CLIENT_TRUSTED_ORIGIN=<that URL> in the shell. To run a local checkout of the CLI, set NOLANG_CLIENT_DIR=<its directory>`,
      EXIT.USAGE,
    );
  }
  const current = await currentMap();
  const cached = current[api] && installed(current[api]) ? current[api] : null;
  let got;
  try {
    got = cached ? await fetchBundle(api, cached, CHECK_TIMEOUT_MS) : await fetchFirstBundle(api);
  } catch (error) {
    const why = reasonOf(error);
    if (cached) {
      log(`Note: could not reach ${api} for the NoLang client (${why}) — running the client on disk`);
      return { dir: join(CLIENT_DIR, cached), hash: cached };
    }
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError(`Could not fetch the NoLang client from ${api} (${why}) — check the API endpoint (NOLANG_API_URL) and the network`, EXIT.NETWORK);
  }
  if (!got) {
    if (!cached) throw new BootstrapError(`${api} answered "not modified" although no NoLang client is on disk — check the network (a proxy may be answering for the server)`, EXIT.NETWORK);
    return { dir: join(CLIENT_DIR, cached), hash: cached };
  }
  let dir;
  try {
    dir = await install(got.hash, got.bytes);
    current[api] = got.hash;
    const tmp = `${CURRENT_FILE}.${process.pid}.tmp`; // written whole, then renamed — a concurrent nolang never reads half a file
    await writeFile(tmp, JSON.stringify(current, null, 2) + "\n");
    await rename(tmp, CURRENT_FILE);
  } catch (error) {
    if (!cached) throw new BootstrapError(`Could not unpack the NoLang client into ${CLIENT_DIR} (${error.message})`, EXIT.NETWORK);
    log(`Note: could not install the new NoLang client (${error.message}) — running the client on disk`);
    return { dir: join(CLIENT_DIR, cached), hash: cached };
  }
  await prune(current);
  return { dir, hash: got.hash };
}

const argv = process.argv.slice(2);
let api;
let bundle;
try {
  api = apiOf(argv);
  bundle = await ensureBundle(api);
} catch (error) {
  log(`error: ${error.message}`);
  process.stdout.write(JSON.stringify({ ok: false, error: error.message }, null, 2) + "\n");
  process.exit(error.exit ?? EXIT.NETWORK);
}
process.env.NOLANG_CLIENT_BUNDLE = bundle.hash; // the bundled CLI sends this in X-NoLang-Client
let run;
try {
  ({ run } = await import(pathToFileURL(join(bundle.dir, "cli", "nolang.mjs")).href));
  if (typeof run !== "function") throw new Error("cli/nolang.mjs has no run()");
} catch (error) {
  if (bundle.hash === "dev") throw error;
  // The copy on disk does not load (a file is missing or cut). Remove it so that the next start fetches it again
  await rm(bundle.dir, { recursive: true, force: true });
  const message = `The NoLang client on disk could not be loaded (${error.message}) and was removed — run the same command again to fetch it`;
  log(`error: ${message}`);
  process.stdout.write(JSON.stringify({ ok: false, error: message }, null, 2) + "\n");
  process.exit(EXIT.NETWORK);
}
await run(argv, { bootstrap: BOOTSTRAP, api });
// Only after a failure: if the server was updated in the meantime, say in one line that a rerun will fix it
// (the bundle is checked once, at start)
if (process.exitCode && bundle.hash !== "dev") {
  try {
    if (await fetchBundle(api, bundle.hash, CHECK_TIMEOUT_MS, { probe: true })) log("Note: the NoLang server was updated in the meantime — run the same command again to use the new client");
  } catch {
    // best effort
  }
}
