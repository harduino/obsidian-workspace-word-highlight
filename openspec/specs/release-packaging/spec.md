# Release packaging specification

## Purpose
Define the reproducible, readable assets and metadata checks required to publish an Obsidian plugin release without bundling host libraries or replacing published artifacts.

## Requirements

### Requirement: Reproducible release assets
The release tooling SHALL produce a readable unminified `main.js`, `manifest.json`, `styles.css`, a ZIP with exactly one `workspace-word-highlight/` folder containing those runtime files, and SHA256SUMS from the same build.

#### Scenario: Prepare assets
- **WHEN** the package command completes
- **THEN** separate runtime files and the ZIP contain byte-identical manifest data

### Requirement: Metadata and version gate
The strict release gate SHALL reject mismatched versions, missing assets, invalid author or placeholder metadata, desktop-only runtime imports, invalid ZIP layout and tags other than the exact `x.y.z` version.

#### Scenario: Incorrect tag
- **WHEN** the tag differs from package and manifest versions
- **THEN** release validation fails before any release is created
