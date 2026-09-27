## 1. Specification and tests
- [x] 1.1 Record baseline and propose release change before implementation.
- [x] 1.2 Add characterization tests of production matching, settings and cross-pane behavior.

## 2. Local release preparation
- [x] 2.1 Pin dependencies, add lint, typecheck, check and readable package scripts.
- [x] 2.2 Align author, MIT, versions and README; add runbooks and community templates.
- [x] 2.3 Add least-privilege CI and manual draft release workflow.

## 3. Verification and owner gates
- [x] 3.1 Run npm ci, check, package and strict release:check locally.
- [x] 3.2 Record owner-reported basic desktop and Android smoke tests and the owner's acceptance of incomplete specialized coverage. The detailed selection/scroll/upgrade matrix is deferred to the explicit follow-up checklist in `docs/MANUAL-TESTS.md`; it is **not** recorded as passed.
- [x] 3.3 Push the CI-tested commit, tag 1.0.4, verify assets and publish the reviewed draft.
- [x] 3.4 Owner submitted and published the Community listing after review completed without Errors; warnings/recommendations recorded in release-readiness docs.

## Scope decision (2026-09-27)
The owner explicitly approved closing this release-preparation change with only basic desktop/Android smoke tests. Obsidian 1.5.0, detailed native selection/IME, hidden tabs, pop-outs and upgrade scenarios remain unverified follow-ups in `docs/MANUAL-TESTS.md` and `docs/RELEASE-READINESS.md`. Archiving this change does not mark those scenarios as passed.
