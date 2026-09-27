# Project instructions

- Follow `openspec/config.yaml`, `openspec/specs/` and the active change before modifying behavior; see `docs/RELEASING.md` for release gates.
- Baseline is local 1.0.3: 1.0.1 ViewPlugin/mark architecture plus Android selection guard. Do not reintroduce the rejected 1.0.2 layer design.
- Preserve plugin ID, settings keys and CSS classes. Existing local command IDs may change only under the owner-approved `align-command-ids-for-first-release` change. Add regression scenarios before behavior fixes. Manual Android testing cannot be replaced by JSDOM.
- Use `npm ci`, `npm run check`, `npm run package`, `npm run release:check`. Never minify release JavaScript or bundle host CodeMirror.
- Do not publish, tag, push or submit to Obsidian without owner authorization.
