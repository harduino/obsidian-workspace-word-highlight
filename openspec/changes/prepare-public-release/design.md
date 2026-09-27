# Design

Keep the 1.0.1 ViewPlugin/Decoration.mark architecture and the 1.0.3 Android guard. Separate release scripts from runtime code; the runtime bundle externalizes Obsidian and CodeMirror and is not minified. Build once, copy the same runtime files into `dist/` and a ZIP with one plugin-ID directory, verify every file and checksum. Run release validation before creating a draft with `GITHUB_TOKEN`. Use `workflow_dispatch` with an existing tag as input; checkout that tag explicitly, reject existing releases rather than overwriting assets. No publish occurs automatically. A version script updates package, manifest and versions together; no tag is created.

Source-focused ViewPlugin updates remain in the editor transaction; debounced effects go only to other views. Any behavior change needs a scenario and regression test. Keep unsolved Obsidian leaf visibility and Android native selection behavior in the manual gate rather than implying CodeMirror viewport is a visibility signal.
