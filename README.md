# CAD File Lab

CAD File Lab is a privacy-first, browser-local workspace for opening and
inspecting 3D files. STEP/STP is the first verified importer; more CAD and mesh
formats are planned. Parsing and meshing run in a web worker, and model files
are not uploaded by the application.

## Current status

- STEP/STP import, orbit, pan, zoom, fit, and visual settings are available.
- STEP/STP imports are limited to 256 MiB so oversized browser-local parsing
  is rejected before it can exhaust the tab's available memory.
- Portable `.cadlab` project files preserve editable geometry and display
  settings for browser-local save and reopen workflows.
- Browser-local recovery is available and can be erased in the application.
- Measure, section, modify, and CAD-format export are planned and are labelled
  unavailable.
- The bundled OCCT kernel has a machine-verified provenance chain and public
  source/relinking offer. See [LEGAL_DISTRIBUTION.md](./LEGAL_DISTRIBUTION.md).

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
npm run provenance
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

Every deployment must retain `/THIRD_PARTY_NOTICES.txt`,
`/occt-provenance.json`, and `/OCCT_SOURCE_OFFER.txt`. A legal review remains
recommended for a commercial or high-profile release.

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
