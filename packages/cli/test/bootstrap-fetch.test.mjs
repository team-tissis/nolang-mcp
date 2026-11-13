// The bootstrap's bundle fetch: with no bundle on disk (a first run) a transient failure is retried, a refusal is not,
// and with a bundle on disk the bootstrap runs it without retrying. And what the bootstrap refuses to run: a bundle from
// an origin nobody trusted, a wrongly signed one, one that would write outside its directory
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const LAUNCHER = fileURLToPath(new URL("../nolang.mjs", import.meta.url));

// A tar.gz with a single file (the ustar header the bootstrap's untar reads; no directory entries)
function bundleOf(path, text) {
  const body = Buffer.from(text);
  const header = Buffer.alloc(512);
  header.write(path, 0);
  header.write(body.length.toString(8).padStart(11, "0"), 124);
  header.write("0", 156);
  const padded = Buffer.alloc(Math.ceil(body.length / 512) * 512);
  body.copy(padded);
  return gzipSync(Buffer.concat([header, padded, Buffer.alloc(1024)]));
}

const etagOf = (bytes) => `"${createHash("sha256").update(bytes).digest("hex")}"`;
const BUNDLE = bundleOf("cli/nolang.mjs", 'export async function run(argv) { console.log("BUNDLE RAN " + argv.join(" ")); }\n');
const ETAG = etagOf(BUNDLE);

// A server that answers with `answers` in order (the last one repeats). 200 serves the bundle; an object
// `{ body, headers }` serves that body with those headers
async function serverOf(answers) {
  const seen = [];
  const server = createServer((req, res) => {
    const answer = answers[Math.min(seen.length, answers.length - 1)];
    seen.push(req.headers["if-none-match"] ?? null);
    if (typeof answer === "object") return res.writeHead(200, { "content-type": "application/gzip", ...answer.headers }).end(answer.body);
    if (answer !== 200) return res.writeHead(answer).end();
    res.writeHead(200, { "content-type": "application/gzip", etag: ETAG }).end(BUNDLE);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise((resolve) => server.close(resolve)) };
}

// Run the bootstrap against `origin`. By default a person has trusted the origin (NOLANG_CLIENT_TRUSTED_ORIGIN)
function launch(origin, configDir, { args = ["--api", origin, "hello"], trusted = origin, launcher = LAUNCHER } = {}) {
  const { NOLANG_API_URL, NOLANG_CLIENT_DIR, NOLANG_CLIENT_TRUSTED_ORIGIN, NOLANG_TOKEN, ...env } = process.env;
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [launcher, ...args],
      { env: { ...env, NOLANG_CONFIG_DIR: configDir, ...(trusted ? { NOLANG_CLIENT_TRUSTED_ORIGIN: trusted } : {}) } },
      (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr }),
    );
  });
}

async function withServer(answers, body) {
  const server = await serverOf(answers);
  const configDir = await mkdtemp(join(tmpdir(), "nolang-bootstrap-"));
  try {
    await body(server, configDir);
  } finally {
    await server.close();
    await rm(configDir, { recursive: true, force: true });
  }
}

describe("bootstrap bundle fetch", { concurrency: true }, () => {
  test("first run: retries after a 502 and then runs", async () => {
    await withServer([502, 200], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /BUNDLE RAN --api .* hello/);
      assert.equal(server.seen.length, 2);
      assert.match(result.stderr, /retrying in 3 s \(attempt 2\/3\)/);
    });
  });

  test("first run: gives up after three attempts when the server stays down", async () => {
    await withServer([503], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 4);
      assert.equal(server.seen.length, 3);
      assert.equal(JSON.parse(result.stdout).ok, false);
      assert.match(result.stderr, /Could not fetch the NoLang client from .* \(GET .* → 503\)/);
    });
  });

  test("first run: a refusal (404) is not retried", async () => {
    await withServer([404], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 4);
      assert.equal(server.seen.length, 1);
      assert.doesNotMatch(result.stderr, /retrying/);
    });
  });

  test("with a bundle on disk: runs it without retrying when the server is down", async () => {
    await withServer([200, 503], async (server, configDir) => {
      const first = await launch(server.origin, configDir);
      const second = await launch(server.origin, configDir);

      assert.equal(first.code, 0, first.stderr);
      assert.equal(second.code, 0, second.stderr);
      assert.match(second.stdout, /BUNDLE RAN/);
      assert.deepEqual(server.seen, [null, ETAG]);
      assert.match(second.stderr, /running the client on disk/);
      assert.doesNotMatch(second.stderr, /retrying/);
    });
  });
});

describe("what the bootstrap refuses to run", { concurrency: true }, () => {
  test("--api twice: refused before anything is fetched (the bundled CLI would take the last one)", async () => {
    await withServer([200], async (server, configDir) => {
      const result = await launch(server.origin, configDir, { args: ["--api", server.origin, "--api=https://elsewhere.example", "hello"] });

      assert.equal(result.code, 2);
      assert.equal(server.seen.length, 0);
      assert.match(result.stderr, /--api is given more than once/);
    });
  });

  test("an origin nobody trusted (localhost included): nothing is fetched", async () => {
    await withServer([200], async (server, configDir) => {
      const result = await launch(server.origin, configDir, { trusted: null });

      assert.equal(result.code, 2);
      assert.equal(server.seen.length, 0);
      assert.doesNotMatch(result.stdout, /BUNDLE RAN/);
    });
  });

  test("a signature that does not verify: refused without a retry, even from a trusted origin", async () => {
    const signed = { body: BUNDLE, headers: { etag: ETAG, "x-nolang-bundle-signature": Buffer.alloc(64, 1).toString("base64") } };
    await withServer([signed], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 4);
      assert.equal(server.seen.length, 1);
      assert.match(result.stderr, /signature .* does not match the NoLang key/);
      assert.doesNotMatch(result.stdout, /BUNDLE RAN/);
    });
  });

  test("a bundle whose ETag is not its fingerprint is not run", async () => {
    await withServer([{ body: BUNDLE, headers: { etag: `"${"0".repeat(64)}"` } }], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 4);
      assert.match(result.stderr, /differs from the ETag/);
      assert.doesNotMatch(result.stdout, /BUNDLE RAN/);
    });
  });

  test("a bundle with a path outside its directory is not unpacked", async () => {
    const escaping = bundleOf("../escaped.mjs", "export const x = 1;\n");
    await withServer([{ body: escaping, headers: { etag: etagOf(escaping) } }], async (server, configDir) => {
      const result = await launch(server.origin, configDir);

      assert.equal(result.code, 4);
      assert.match(result.stderr, /Unsupported path in the bundle/);
      assert.equal(existsSync(join(configDir, "client", "escaped.mjs")), false);
    });
  });
});

describe("the bundle on disk", { concurrency: true }, () => {
  test("a new bundle that cannot be unpacked: the bundle on disk runs", async () => {
    const broken = Buffer.from("not a gzip");
    await withServer([200, { body: broken, headers: { etag: etagOf(broken) } }], async (server, configDir) => {
      const first = await launch(server.origin, configDir);
      const second = await launch(server.origin, configDir);

      assert.equal(first.code, 0, first.stderr);
      assert.equal(second.code, 0, second.stderr);
      assert.match(second.stdout, /BUNDLE RAN/);
      assert.match(second.stderr, /could not install the new NoLang client/);
    });
  });

  test("a damaged bundle on disk is fetched again", async () => {
    await withServer([200], async (server, configDir) => {
      const first = await launch(server.origin, configDir);
      await rm(join(configDir, "client", ETAG.slice(1, -1), "cli", "nolang.mjs"));
      const second = await launch(server.origin, configDir);

      assert.equal(first.code, 0, first.stderr);
      assert.equal(second.code, 0, second.stderr);
      assert.match(second.stdout, /BUNDLE RAN/);
      assert.deepEqual(server.seen, [null, null]);
    });
  });

  test("several bootstraps starting at once on an update all run", async () => {
    await withServer([200], async (server, configDir) => {
      // old bundles on disk, so that every bootstrap prunes while the others install
      for (let i = 0; i < 6; i++) await cp(LAUNCHER, join(configDir, "client", `old${i}`, "cli", "nolang.mjs"));

      const results = await Promise.all(Array.from({ length: 8 }, () => launch(server.origin, configDir)));

      assert.deepEqual(results.map((result) => result.code), Array(8).fill(0), results.map((result) => result.stderr).join("\n"));
      assert.equal((await readdir(join(configDir, "client"))).filter((name) => name.startsWith("old")).length <= 2, true);
    });
  });
});
