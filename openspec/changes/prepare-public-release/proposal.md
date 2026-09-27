# Prepare public release

## Why
The local 1.0.3 source has no reproducible dependency lock, release packaging gate, CI, or verified public metadata. The remote is currently private and has no public release.

## What Changes
- Characterize existing matching, settings, cross-pane and Android guard semantics before narrow fixes.
- Pin dev tooling, add lint/typecheck/tests/OpenSpec validation, readable build and verified release packaging.
- Prepare MIT identity, version 1.0.4, English community documentation and a draft-only release workflow.

## Non-goals
No CodeMirror layer replacement, new highlight features, hidden-plugin management, published tag/release, Obsidian submission, or claim of Android device verification.

## Manual gates
Real Obsidian desktop/Android tests, public repository visibility, public assets and owner submission remain pending.
