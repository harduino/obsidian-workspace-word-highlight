# Contributing

Before behavior changes, read `AGENTS.md`, `openspec/config.yaml`, the baseline under `openspec/specs/` and the active change under `openspec/changes/`. Add a scenario and a regression test of production code before the fix. Keep 1.0.1 ViewPlugin/mark architecture and 1.0.3 Android guard; propose architectural changes separately. Do not rename settings, CSS classes or published command IDs as cleanup. The owner-approved pre-public command ID change is documented in `openspec/changes/archive/2026-09-27-align-command-ids-for-first-release/`. PRs should describe affected scenarios, local check output and manual host/device observations separately.

Node 22+: `npm ci`, `npm run check`, `npm run package`, `npm run release:check`. Do not commit `main.js`, `dist/`, vault files or secrets. Typecheck uses real Obsidian and CodeMirror definitions; the test-only Obsidian boundary mock is not an Android or host compatibility test.

OpenSpec CLI is pinned in devDependencies. `npm exec -- openspec validate --all --strict --no-interactive` checks specs. Generated Codex skills live under `.agents/skills/openspec-*` (invoke `$openspec-propose` in Codex CLI/IDE or select the skill in Codex desktop). OpenCode commands live under `.opencode/commands/opsx-*.md` (invoke `/opsx-propose`), and OpenCode skills under `.opencode/skills/openspec-*/`. The installed 1.13.2 CLI generated these integrations; avoid overwriting local instructions with `--force`.

Release process and owner-only gates: [docs/RELEASING.md](docs/RELEASING.md).
