# CAD File Lab

CAD File Lab is a privacy-first, browser-local workspace for opening and
inspecting STEP/STP files. CAD parsing and meshing run in a web worker; model
files are not uploaded by the application.

## Current status

- STEP/STP import, orbit, pan, zoom, fit, and visual settings are available.
- STEP/STP imports are limited to 256 MiB so oversized browser-local parsing
  is rejected before it can exhaust the tab's available memory.
- Portable `.cadlab` project files preserve editable geometry and display
  settings for browser-local save and reopen workflows.
- Browser-local recovery is available and can be erased in the application.
- Measure, section, modify, and CAD-format export are planned and are labelled
  unavailable.
- Public distribution is **not legally cleared**. See
  [LEGAL_DISTRIBUTION.md](./LEGAL_DISTRIBUTION.md).

## Local development

```text
npm install
npm run dev
```

Quality gates:

```text
npm test
npm run lint
npm run licenses
npm run build
```

The production build currently reports expected large JavaScript/WASM chunk
warnings from the browser CAD kernel.

Compatible OCCT WebAssembly builds can be selected at runtime without changing
the application bundle. See
[docs/OCCT_REPLACEMENT.md](./docs/OCCT_REPLACEMENT.md).

## Privacy model

- Imported CAD data is processed in the browser.
- Project files are created and opened locally; the application does not
  upload them.
- Editable recovery data is stored in IndexedDB on the same device when local
  recovery is enabled.
- Clearing local recovery removes saved recoveries and pauses autosave for the
  open model until the user explicitly enables it again.
- Feedback is prepared for copying and is not transmitted by the application.

Do not deploy or distribute a build until the legal release blockers are
resolved and the resulting third-party notices and corresponding-source
materials have been verified.

## Proprietary rights

CAD File Lab's original code and materials are proprietary and all rights are
reserved. No permission is granted to copy, modify, redistribute, republish,
host, or create derivative works. See [LICENSE](./LICENSE).

Users of an intentionally hosted version may use every feature exposed through
the normal interface. They retain rights in their own CAD files and may save,
download, export, and use results produced from their content when those
features are available. This permission does not grant rights to copy or run
the website's source code.

This restriction does not replace or limit the separate licenses that apply to
third-party components.
