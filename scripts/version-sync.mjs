import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) throw new Error("Usage: npm run version:sync -- x.y.z");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
const compare = (a, b) => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};
if (compare(version, pkg.version) < 0) throw new Error("Refusing version downgrade");
pkg.version = lock.version = lock.packages[""].version = manifest.version = version;
versions[version] = manifest.minAppVersion;
for (const [name, data] of [["package.json", pkg], ["package-lock.json", lock], ["manifest.json", manifest], ["versions.json", versions]]) {
  writeFileSync(name, `${JSON.stringify(data, null, 2)}\n`);
}
process.stdout.write(`Synchronized ${version}; no tag or push created\n`);
