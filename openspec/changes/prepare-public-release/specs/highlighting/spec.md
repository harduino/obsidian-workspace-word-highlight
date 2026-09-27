## MODIFIED Requirements

### Requirement: Android selection protection
With the guard enabled on Android, a non-empty selection without document changes SHALL defer mark rebuilds for query changes until collapse. Explicit Clear or Disable SHALL clear decorations immediately even during selection. A document-changing transaction SHALL rebuild immediately.

#### Scenario: Clear during Android selection
- **WHEN** Clear is invoked while the Android source editor has a non-empty selection
- **THEN** the source and other panes have no highlight marks

#### Scenario: Cut during selection
- **WHEN** a cut changes the document during a non-empty Android selection
- **THEN** decorations are rebuilt against the changed document
