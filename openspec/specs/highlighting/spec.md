# Editor highlighting specification

## Purpose
Define the published 1.0.4 editor highlighting behavior, based on the local 1.0.3 ViewPlugin architecture, without asserting untested host or device behavior.

## Requirements

### Requirement: Cursor and literal selection matching
The plugin SHALL use Unicode letters, digits and underscore plus configured extra characters to find a cursor word. A non-empty single-line selection of at most 500 UTF-16 code units SHALL be matched literally, without whole-word boundaries. Empty or multiline selections SHALL not produce a query.

#### Scenario: Cursor inside a Cyrillic word
- **WHEN** the caret is inside a Cyrillic word of at least the configured minimum length
- **THEN** occurrences in CodeMirror visible ranges are decorated subject to case and whole-word options

#### Scenario: Selection with regex punctuation
- **WHEN** text containing regex metacharacters is selected on one line
- **THEN** its literal occurrences are decorated without interpreting those characters as a regex

### Requirement: One global source query
The focused editor's document, selection or focus update SHALL determine the global query. A debounced refresh SHALL dispatch only to other registered editor views, and SHALL not write to Markdown notes.

#### Scenario: Other pane refreshed
- **WHEN** a source editor changes its query and another editor is registered
- **THEN** the other editor receives a visual refresh without becoming query source

### Requirement: Editor lifecycle and scroll stability
Decorations SHALL scan CodeMirror visible ranges and cap accepted matches per editor. Unloading SHALL cancel pending refresh and discard registered views. Destroying the source editor SHALL clear its query.

#### Scenario: Source destroyed
- **WHEN** the source editor is destroyed
- **THEN** its query is cleared and the remaining views are scheduled for refresh

### Requirement: Android selection protection
With the guard enabled on Android, a non-empty selection without document changes SHALL defer mark rebuilds for query changes until collapse. Explicit Clear or Disable SHALL clear decorations immediately even during selection. A document-changing transaction SHALL rebuild immediately.

#### Scenario: Clear during Android selection
- **WHEN** Clear is invoked while the Android source editor has a non-empty selection
- **THEN** the source and other panes have no highlight marks

#### Scenario: Cut during selection
- **WHEN** a cut changes the document during a non-empty Android selection
- **THEN** decorations are rebuilt against the changed document

### Requirement: Settings compatibility
The plugin SHALL load previous data by merging saved settings with defaults, including `androidSelectionGuard`, and retain existing settings keys and CSS classes. For the first public release it SHALL register plugin-agnostic command IDs `toggle-highlighting` and `clear-highlighting` without migration aliases for unpublished local IDs.

#### Scenario: Older saved data
- **WHEN** saved data lacks the Android guard key
- **THEN** the default enabled value is used

#### Scenario: First public command registration
- **WHEN** the plugin loads
- **THEN** it registers only `toggle-highlighting` and `clear-highlighting`, and the callbacks still toggle the enabled state and clear marks

## Verification boundaries
CodeMirror visible ranges do not establish Obsidian leaf visibility. Native Android selection, IME and scroll behavior require manual device testing; this specification does not claim those tests have passed.
