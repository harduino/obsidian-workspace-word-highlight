import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const dir = "dist";
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir);
const files = ["main.js", "manifest.json", "styles.css"];
const entries = {};
for (const name of files) {
  const data = readFileSync(name);
  copyFileSync(name, join(dir, name));
  entries[`${manifest.id}/${name}`] = new Uint8Array(data);
}
const archive = `${manifest.id}-${manifest.version}.zip`;
writeFileSync(join(dir, archive), zipSync(entries, { level: 0 }));
const names = [...files, archive];
const sums = names.map(name => `${createHash("sha256").update(readFileSync(join(dir, name))).digest("hex")}  ${name}`).join("\n");
writeFileSync(join(dir, "SHA256SUMS"), `${sums}\n`);
process.stdout.write(`Prepared ${dir}/${archive} and separate runtime files\n`);
