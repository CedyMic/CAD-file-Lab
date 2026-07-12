# Legal distribution review

**Status: release blocked.** This repository and its built assets must not be
published or distributed as a legally cleared release yet. This file records
engineering evidence and is not legal advice.

## Blocking issues

### RepliCAD license trace

The installed `replicad@0.23.1` package contains an AGPL paragraph in its
README, but authoritative version-specific evidence supports MIT:

- `node_modules/replicad/package.json` declares `MIT`.
- `node_modules/replicad/LICENSE` contains the MIT license.
- npm registry metadata identifies git commit
  `45b9b8b7c594cd5dc38617edaf220ab4cd72778f`, declares MIT, and matches the
  installed lockfile integrity.
- Upstream tag `v0.23.1` points to that exact commit, where the package metadata
  and package-level `LICENSE` are MIT.
- Upstream commit `c2c63cae2177d0b978a5cfdd9fd38f27fbc9e69b` is explicitly
  named “Relicense everything to MIT” and changes this package from AGPL to
  MIT.
- The conflicting README text has been unchanged since 2021 and was not updated
  by the 2023 relicensing commit.

Engineering clearance therefore treats the exact pinned RepliCAD 0.23.1
package as MIT and preserves its MIT notice. Because the stale README remains a
literal textual inconsistency, a zero-ambiguity release policy can still require
counsel or written upstream confirmation before public distribution.

### Open CASCADE WebAssembly provenance

`replicad-opencascadejs@0.23.0` declares MIT for its wrapper, but the package
ships an Open CASCADE-derived WebAssembly binary. The installed binary and the
current production-build binary are byte-identical (SHA-256):

```text
2E07C45B83267B38D3102EC411FAD11E7CE2ED71854084E461C5AB5FEE94AAFF
```

The installed npm package does not identify the exact OCCT source revision or
include the OCCT license, exception, corresponding source, or relinking
instructions. Open CASCADE's official documentation says OCCT is licensed
under LGPL-2.1 with an additional exception and calls out notice, license,
source-availability, and user-modification requirements:

- <https://dev.opencascade.org/doc/overview/html/index.html#license>
- <https://dev.opencascade.org/doc/occt-7.7.0/overview/html/occt_public_license.html>

Additional provenance tracing found that the npm package records its own
RepliCAD repository commit (`19fb8212e0bb12a07a7a49f96950f8903903d469`),
but publishes only its generated `src` artifacts. Its build configuration and
source-selection files are excluded from the installed archive. The recorded
build command pulls the floating Docker image tag
`donalffons/opencascade.js` without an immutable digest or OCCT revision. The
WASM contains `/occt/src/...` build paths but no dependable OCCT version
identifier. These facts prevent the exact corresponding source from being
established from the distributed package alone.

Before distribution, identify the exact OCCT and opencascade.js revisions used
to create the WASM, preserve their applicable terms, make the corresponding
source and build material available, and verify that users can exercise the
required modification/relinking rights.

### Project and notices files

- The owner selected a proprietary, all-rights-reserved model. The root
  `LICENSE` permits users to use all functionality exposed through an
  intentionally hosted website and preserves their rights in their own files
  and results, while granting no right to copy, modify, redistribute, or host
  the website itself. `package.json` is marked `UNLICENSED` and remains
  `private`. A legal owner name can be added later without guessing or exposing
  an identity now.
- `public/THIRD_PARTY_NOTICES.txt` is a generated inventory of the installed
  production dependency closure and is copied into the production build. It
  is not legal clearance: unresolved OCCT provenance prevents it from being
  treated as a complete release notice.
- The application links to that inventory, but a release still needs verified
  notices and corresponding-source materials for the exact distributable.

## Audited runtime dependency scope

Exact direct runtime versions in the current lockfile are:

| Package | Version | Installed metadata |
| --- | ---: | --- |
| `@react-three/drei` | 10.7.7 | MIT |
| `@react-three/fiber` | 9.6.1 | MIT |
| `idb` | 8.0.3 | ISC |
| `react` | 19.2.7 | MIT |
| `react-dom` | 19.2.7 | MIT |
| `replicad` | 0.23.1 | MIT; stale AGPL README documented above |
| `replicad-opencascadejs` | 0.23.0 | MIT wrapper; OCCT payload unresolved |
| `three` | 0.185.1 | MIT |

The production lock closure currently contains 75 unique package/version
entries: 60 MIT, 6 ISC, 5 Apache-2.0, 1 BSD-3-Clause, plus
`webgl-constants@1.1.1`, whose metadata omits a license while its included
license file is MIT. This deliberately excludes dev-only packages unless their
binaries or `node_modules` are distributed.

## Release checklist

- [x] Trace RepliCAD 0.23.1 to its exact MIT tag, package license, registry
      record, and explicit upstream relicensing commit; preserve its MIT notice.
- [ ] Identify the exact OCCT/opencascade.js source used for the bundled WASM.
- [ ] Replace floating build inputs with immutable source revisions and image
      digests, then retain the complete build configuration and provenance.
- [x] Record the owner's proprietary/all-rights-reserved choice and prevent npm
      publication with `private: true` plus `license: UNLICENSED`.
- [x] Generate a provisional notice inventory from the installed production
      dependency closure and make it accessible from the built application.
- [ ] Verify final notices against the actual distributable, including every
      shipped component/version/source/copyright and all required license and
      NOTICE text.
- [ ] Publish or accompany the build with required corresponding source,
      build instructions, and relinking/modification materials.
- [x] Provide a same-origin runtime configuration hook that can substitute a
      compatible OCCT WASM without modifying the application bundle. See
      `docs/OCCT_REPLACEMENT.md`.
- [ ] Obtain a legal review appropriate to the intended distribution model.
- [ ] Rebuild and verify that notices are accessible from the released app.

No deployment, publication, license acceptance, or external contact was made
as part of this review.
