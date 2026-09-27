# Align command IDs for first public release

## Why
The existing local command IDs contain the plugin ID, which Obsidian's current plugin submission requirements forbid. The owner confirms there has been no public release or public install base and explicitly accepts replacing these local IDs before 1.0.4.

## What Changes
- Replace `toggle-workspace-word-highlight` and `clear-workspace-word-highlight` with short plugin-agnostic IDs; use concise command names.
- Add a regression test that registers the production commands and checks their IDs and behavior.
- Update release documentation to describe this first-public-release exception to local hotkey continuity.

## Non-goals
No change to plugin ID, settings keys, CSS classes, highlight engine or version history. No migration aliases for unpublished local command IDs.

## Manual gates
Owner has reported basic desktop and Android smoke tests; exact app/device versions and specialized matrix cases are unrecorded. Obsidian directory review and real minimum-version verification remain distinct.
