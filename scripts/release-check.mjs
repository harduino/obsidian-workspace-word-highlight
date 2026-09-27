import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";

function assert(condition, message) { if (!condition) throw new Error(message); }
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(readFileSync("versions.json", "utf8"));
const version = pkg.version;
const tag = process.env.RELEASE_TAG;
assert(/^\d+\.\d+\.\d+$/.test(version), "Version must be x.y.z");
assert(!tag || (tag === version && /^\d+\.\d+\.\d+$/.test(tag)), "Tag must equal version without v prefix");
assert(manifest.id === "workspace-word-highlight" && manifest.name === "Workspace Word Highlight", "Plugin identity mismatch");
assert(manifest.version === version && versions[version] === manifest.minAppVersion, "Version metadata mismatch");
assert(Object.keys(versions).every(key => /^\d+\.\d+\.\d+$/.test(key) && /^\d+\.\d+\.\d+$/.test(versions[key])), "Invalid version history");
assert(readFileSync("docs/RELEASE-NOTES.md", "utf8").includes(version), "Release notes must mention current version");
assert(manifest.author === "harduino" && pkg.author === manifest.author && /harduino/.test(readFileSync("LICENSE", "utf8")), "Author/copyright not confirmed");
for (const text of [JSON.stringify(manifest), JSON.stringify(pkg), readFileSync("README.md", "utf8")]) {
  assert(!/Local plugin|\bTODO\b|lorem ipsum|<TODO>|\{\{.*?\}\}/i.test(text), "Placeholder in release metadata");
}
assert(manifest.isDesktopOnly === false, "Platform scope changed");
const js = readFileSync("dist/main.js", "utf8");
assert(js.split("\n").length > 100 && !/sourceMappingURL=data:/.test(js), "Bundle must be readable, without inline sourcemap");
assert(!/\b(?:require\(["'](?:node:|electron|fs|path|child_process|https?|os)|eval\(|new Function\()/.test(js), "Desktop-only or dynamic-code runtime dependency");
const runtime = ["main.js", "manifest.json", "styles.css"];
for (const name of runtime) {
  assert(existsSync(join("dist", name)), `Missing ${name}`);
  assert(readFileSync(join("dist", name)).equals(readFileSync(name)), `Stale asset ${name}`);
}
const zipName = `workspace-word-highlight-${version}.zip`;
const zip = unzipSync(new Uint8Array(readFileSync(join("dist", zipName))));
assert(JSON.stringify(Object.keys(zip).sort()) === JSON.stringify(runtime.map(name => `workspace-word-highlight/${name}`).sort()), "Invalid ZIP layout");
for (const name of runtime) {
  assert(Buffer.from(zip[`workspace-word-highlight/${name}`]).equals(readFileSync(join("dist", name))), `ZIP mismatch ${name}`);
}
assert(strFromU8(zip["workspace-word-highlight/manifest.json"]) === readFileSync("manifest.json", "utf8"), "ZIP manifest mismatch");
const sums = readFileSync("dist/SHA256SUMS", "utf8").trim().split("\n");
assert(sums.length === 4, "Incorrect checksum count");
for (const line of sums) {
  const [, hash, name] = /^([a-f0-9]{64}) {2}([^/]+)$/.exec(line) ?? [];
  assert(name && [ ...runtime, zipName ].includes(name), "Invalid checksum entry");
  assert(createHash("sha256").update(readFileSync(join("dist", name))).digest("hex") === hash, `Checksum mismatch ${name}`);
}
process.stdout.write(`Release assets validated for ${version}${tag ? ` (tag ${tag})` : ""}\n`);
