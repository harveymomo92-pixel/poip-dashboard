import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const packageFiles = [];
const ignored = new Set(["node_modules", ".git", ".turbo", "dist", ".next"]);

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (entry.name === "package.json") packageFiles.push(fullPath);
  }
}

await walk(root);

const bad = [];
for (const file of packageFiles) {
  const json = JSON.parse(await readFile(file, "utf8"));
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = json[field] ?? {};
    for (const [name, version] of Object.entries(deps)) {
      if (version === "latest") bad.push(`${file}: ${field}.${name}`);
    }
  }
}

if (bad.length > 0) {
  console.error(`Dependency version "latest" is not allowed:\n${bad.join("\n")}`);
  process.exit(1);
}

console.log(`Checked ${packageFiles.length} package.json files: no dependency uses "latest".`);
