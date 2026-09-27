# Manual acceptance tests — 1.0.4 candidate

**Owner-reported overall result: PASS — basic desktop and real Android smoke tests before 1.0.4 release.** The owner confirms both platforms work and accepts proceeding without further specialized testing. Exact Obsidian/OS/WebView versions, build hash and individual case results were not supplied, so case rows remain *not individually evidenced* rather than falsely claiming each procedure passed (especially 1.5.0, pop-out and upgrades). A Node/JSDOM run or Chromium screenshot is not evidence for Android selection handles. Do not attach private notes, logs, tokens or a full vault to a bug report.

## Session record (copy this block for each device)

```text
Tester/date:
Plugin build/version (SHA256 of main.js):
Obsidian version (and stable/installer source):
OS and version:
Android System WebView version (Android only):
Device/keyboard (Android only):
Theme:
Other plugins and versions (especially Shiki Highlighter):
Editor mode (Source / Live Preview):
Results by case ID: pending/pass/fail — actual behavior, reproduction steps, screenshots or sanitized logs:
```

Record a case as **pass** only when its expected result was observed in the stated environment. A failed case needs actual text, steps, settings and any visible symptom; keep the other cases pending. Repeat platform-dependent cases on desktop and Android separately.

## Set up a disposable vault

1. On the build machine run `npm ci`, `npm run check`, `npm run package`, `RELEASE_TAG=1.0.4 npm run release:check` and, from `dist/`, `sha256sum -c SHA256SUMS`. Keep this test build separate from a user vault.
2. In a **new, empty test vault**, create `.obsidian/plugins/workspace-word-highlight/` and copy *only* `dist/main.js`, `dist/manifest.json`, `dist/styles.css` there. Do not use the repository name as the installation folder. Alternatively extract `dist/workspace-word-highlight-1.0.4.zip` under `.obsidian/plugins/` and inspect its single `workspace-word-highlight/` folder. For Android, transfer the three runtime files to a disposable vault on the device; record the file-transfer method and resulting hash. Do not change the owner's existing vault or settings.
3. Copy [alpha.md](fixtures/alpha.md) and [beta.md](fixtures/beta.md) into the test vault as ordinary notes. Enable Community plugins in Obsidian and enable **Workspace Word Highlight**. Put the two notes into different split Markdown panes. Use an additional disposable long note made by repeating the synthetic text and headings (no private content) for scrolling/folding cases.
4. Start with defaults: enabled, case sensitive, whole words, min length 2, Android guard on, debounce 25 ms. Record any changed setting before a case. Capture a real split-pane screen recording for the optional showcase only after checking the screen for personal information. No screenshot is currently claimed as completed.

## Desktop and common editor cases

| ID | Actions | Expected / evidence | Status |
| --- | --- | --- | --- |
| D01 | In `alpha.md` put the caret inside `orbit`; keep `beta.md` visible in another split pane. Type in alpha, then move the caret inside a different word. | Visible `orbit` matches in both notes update to the current query; the notes' text and native caret/selection remain unchanged by highlighting. | pending |
| D02 | Select `orbit`, then `Orbit` in beta; toggle Case sensitive and Whole words. Select synthetic text with punctuation and a single space; select multiple lines and >500 UTF-16 units. | Selected text is literal; cursor matching obeys settings; multiline/overlong selections clear the query. A whitespace-only single-line selection currently *does* match spaces. Record any discrepancy. | pending |
| D03 | In one source, use each command (Clear and Toggle), change min length, extra word characters, active-occurrence setting and case sensitivity **without moving the caret**. | Clear/Disable remove visible marks in all panes. Re-enable and each setting change should update its applicable highlighting; record if it instead needs a caret movement (known area to audit). Local hotkeys bound to unpublished pre-1.0.4 IDs may need rebinding. | pending |
| D04 | Repeat D01 in Source mode and Live Preview; put one pane in Reading View. | Editor panes highlight. Reading View does not gain highlight spans or changed contents. | pending |
| D05 | Switch a third Markdown pane to a hidden tab, change the source query, reopen the tab; close the source pane, open a new pane, change active file. | No stale marks or unexpected query ownership on reopening; closing the source clears its query; only the active source drives updates. Record tab/leaf behavior separately from CodeMirror viewport behavior. | pending |
| D06 | In long synthetic notes, fold/unfold headings and scroll both panes while typing, selecting, Undo/Redo, Copy/Cut/Paste and composing text with an IME. | No note edits from highlighting, no recursive update/focus theft; record any scrollbar jumps and the precise sequence. | pending |
| D07 | Cold-start Obsidian, disable/re-enable the plugin, reload Obsidian; repeat D06 with Shiki Highlighter off, on, and after restarting it. | Record timing and scroll behavior for each state. Correlation is not proof Shiki causes a race. | pending |
| D08 | Separately open a pop-out window and attempt D01 there. | Record actual support or failure; do not mark pop-out supported without observation. | pending |
| D09 | On a *separate* test installation of actual Obsidian 1.5.0, run D01/D03/D04; record version and installer. | APIs, rendering, commands and settings work before claiming the inherited minimum. If 1.5.0 cannot be tested, keep the release gate pending and follow current submission guidance when choosing a new minimum. | pending |

## Android device cases (guard on, then off)

Use a real Android device with Obsidian and a disposable vault. Perform each case once with **Protect Android text selection** on and once off; record both outcomes. Do not infer device success from desktop/JSDOM. Do not install a test plugin into a personal vault.

| ID | Actions | Expected / evidence | Status |
| --- | --- | --- | --- |
| A01 | Long-press `orbit`, drag **both** selection handles forward/backward, hold a non-empty selection while scrolling. | Native handles remain usable; source-editor marks may be deferred while the selection exists and other panes may update. Record jumping, disappearing handles or DOM redraws. | pending |
| A02 | With selection active use native Copy, Cut, Paste, replace selection by typing and Undo/Redo. | Native clipboard/selection works; Cut/replacement do not leave invalid decoration ranges. No plugin clipboard substitution. | pending |
| A03 | While selected invoke Clear, then select again and Disable; collapse selection afterwards. | Clear/Disable remove marks in all panes promptly. On collapse while enabled the newest query is applied. | pending |
| A04 | Compose text with the device IME/keyboard, change file or source pane with a selection held, reload the plugin and Obsidian. | Record keyboard, caret, focus, marks and errors; no callbacks into destroyed editors after reload. | pending |

## Upgrade compatibility

| ID | Actions | Expected / evidence | Status |
| --- | --- | --- | --- |
| U01 | In separate *disposable* vault copies, start from genuine local 1.0.1 and 1.0.3 installations with non-default settings; install candidate runtime files without replacing their `data.json`. | Preserved case sensitivity, whole-word, extra characters, limits and hotkeys; missing `androidSelectionGuard` defaults on for 1.0.1, existing 1.0.3 value is retained. Never upload `data.json`. | pending |

For future fixes, record status and environment per case where possible. The owner explicitly accepted the limited first-release smoke-test coverage. Showcase capture is optional.
