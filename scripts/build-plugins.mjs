#!/usr/bin/env node
// Build the plugin package (plugins/nolang) from the sources of truth (packages/cli, skills/, hooks/) and set the
// manifests' version to the CLI's (the bootstrap's).
// The CLI body (including the reference docs) is not in the package — the NoLang server serves it at `agent/client/` and
// the bootstrap fetches it on every start.
// There is one package, pointing at production NoLang (other servers are selected with NOLANG_API_URL in the shell). The
// package has no MCP connection (clients without a shell connect to the hosted MCP as a connector).
// Codex copies only the plugin directory into its cache, so the CLI (bootstrap) and the skills are real files inside the
// package (no symlinks).
// hooks/ is read by Claude Code only (the Codex manifest does not list it).
// LICENSE at the repo root is copied into everything that is distributed on its own (the plugin package, the npm package,
// the PyPI packages).
// `--check` writes nothing and only verifies that the package and the LICENSE copies match the sources, and that the
// package holds nothing else (for CI; exits 1 on drift).
import { cp, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PLUGIN = "nolang";
const CLI_FILES = ["nolang.mjs", "package.json"]; // package.json carries the version the bootstrap reports
const MANIFESTS = [".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]; // written by hand; the build sets only `version`
const LICENSE_COPIES = ["packages/cli", "packages/pypi-nolang", "packages/pypi-nolang-mcp-stdio"]; // besides the plugin package
// Not copied into the package
const IGNORED = new Set([".DS_Store", "__pycache__", "test", "tests"]);
const keep = (src) => !IGNORED.has(src.split("/").pop());

async function buildInto(pluginDir) {
  const version = JSON.parse(await readFile(join(ROOT, "packages/cli/package.json"), "utf8")).version;
  await rm(join(pluginDir, "cli"), { recursive: true, force: true });
  for (const name of CLI_FILES) await cp(join(ROOT, "packages/cli", name), join(pluginDir, "cli", name), { recursive: true, filter: keep });
  // The Claude Code hook (shows tell_user as a notification). A plugin's hooks/hooks.json is read when the plugin is enabled
  await rm(join(pluginDir, "hooks"), { recursive: true, force: true });
  await cp(join(ROOT, "hooks"), join(pluginDir, "hooks"), { recursive: true, filter: keep });
  await rm(join(pluginDir, "skills"), { recursive: true, force: true });
  await cp(join(ROOT, "skills"), join(pluginDir, "skills"), { recursive: true, filter: keep });
  await cp(join(ROOT, "LICENSE"), join(pluginDir, "LICENSE"));
  for (const manifest of MANIFESTS) {
    const path = join(pluginDir, manifest);
    const json = JSON.parse(await readFile(path, "utf8"));
    json.version = version;
    await writeFile(path, JSON.stringify(json, null, 2) + "\n");
  }
}

async function listFiles(dir, prefix = "") {
  const found = new Map();
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const rel = prefix + entry.name;
    if (entry.isDirectory()) for (const [k, v] of await listFiles(join(dir, entry.name), rel + "/")) found.set(k, v);
    else found.set(rel, await readFile(join(dir, entry.name)));
  }
  return found;
}

async function check() {
  const real = join(ROOT, "plugins", PLUGIN);
  const tmp = await mkdtemp(join(tmpdir(), "nolang-build-"));
  try {
    // Build into an empty dir that holds only the hand-written manifests, so a file that the build does not make
    // (an MCP setting, a leftover) shows up as extra
    const expected = join(tmp, PLUGIN);
    for (const manifest of MANIFESTS) await cp(join(real, manifest), join(expected, manifest));
    await buildInto(expected);
    const [have, want] = await Promise.all([listFiles(real), listFiles(expected)]);
    const drift = [];
    for (const [path, body] of want) if (!have.has(path) || !have.get(path).equals(body)) drift.push(`${have.has(path) ? "changed" : "missing"} ${path}`);
    for (const path of have.keys()) if (!want.has(path)) drift.push(`extra ${path}`);
    for (const manifest of MANIFESTS) if ("mcpServers" in JSON.parse(have.get(manifest) ?? "{}")) drift.push(`mcpServers in ${manifest} (the package has no MCP connection)`);
    const license = await readFile(join(ROOT, "LICENSE"));
    for (const dir of LICENSE_COPIES) {
      const copy = await readFile(join(ROOT, dir, "LICENSE")).catch(() => null);
      if (!copy?.equals(license)) drift.push(`${copy ? "changed" : "missing"} ../../${dir}/LICENSE`);
    }
    return drift;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

if (process.argv.includes("--check")) {
  const drift = await check();
  if (drift.length) {
    console.error(`plugins/${PLUGIN} differs from the sources (run npm run build):\n  ${drift.slice(0, 20).join("\n  ")}${drift.length > 20 ? `\n  …and ${drift.length - 20} more` : ""}`);
    process.exit(1);
  }
  console.error(`plugins/${PLUGIN}: matches the sources`);
  process.exit(0);
}
await buildInto(join(ROOT, "plugins", PLUGIN));
for (const dir of LICENSE_COPIES) await cp(join(ROOT, "LICENSE"), join(ROOT, dir, "LICENSE"));
console.error(`built plugins/${PLUGIN}`);
