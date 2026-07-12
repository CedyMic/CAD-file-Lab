# Legal distribution review

**Status: OCCT provenance remediated; legal review still recommended.** The
exact kernel artifact, build image, OpenCascade.js source, OCCT source, and
toolchain are now recorded and machine-verified. This file records engineering
evidence and is not legal advice or a legal clearance opinion.

## Reviewed issues

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

The installed npm archive alone omits the build configuration. The source and
registry audit reconstructed the complete chain:

- The installed WASM has Git blob
  `bfac894f53565c382c0af3b065e06835af457930`, exactly matching RepliCAD commit
  `19fb8212e0bb12a07a7a49f96950f8903903d469`. Commit
  `bcc344da9a02066702ba7452b7b652112886cb94` introduced that artifact.
- The recorded build command used `donalffons/opencascade.js:latest`. Docker
  Hub records that tag as unchanged since 2023-03-23 and resolves it to
  `sha256:3069f4c2e3ab62bb82d81843bad2c0f8552ee92373208f8f655ef9bf71c0524d`.
- Docker Hub's publication time and the upstream release workflow map that
  image to OpenCascade.js commit
  `b5ff9847200016dce0d92fe747fc38a945771dc5`.
- Its Dockerfile pins OCCT commit
  `bb368e271e24f63078129283148ce83db6b9670a` and Emscripten 3.1.14.

Open CASCADE's official documentation says OCCT is licensed under LGPL-2.1
with an additional exception and calls out notice, license,
source-availability, and user-modification requirements:

- <https://dev.opencascade.org/doc/overview/html/index.html#license>
- <https://dev.opencascade.org/doc/occt-7.7.0/overview/html/occt_public_license.html>

`public/occt-provenance.json` records this chain in machine-readable form.
`npm run provenance` rejects a package commit, version, or WASM hash change.
`public/OCCT_SOURCE_OFFER.txt` publishes corresponding-source archives,
applicable terms, the immutable image, build configuration, and relinking
instructions. The runtime replacement hook lets users select a compatible
same-origin rebuilt kernel.

The production build also includes verbatim copies of GNU LGPL 2.1 and the
OCCT additional exception under `public/licenses/`. The Help panel gives a
prominent OCCT notice and links the terms, source offer, privacy notice, and
hosted-service terms.

### Project and notices files

- The owner selected a proprietary, all-rights-reserved model. The root
  `LICENSE` permits users to use all functionality exposed through an
  intentionally hosted website and preserves their rights in their own files
  and results, while granting no right to copy, modify, redistribute, or host
  the website itself. `package.json` is marked `UNLICENSED` and remains
  `private`. A legal owner name can be added later without guessing or exposing
  an identity now.
- `public/THIRD_PARTY_NOTICES.txt` is a generated inventory of the installed
  production dependency closure and is copied into the production build.
- The application links to that inventory and the OCCT source/relinking offer.
  These engineering artifacts do not replace legal advice.

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
| `replicad-opencascadejs` | 0.23.0 | MIT wrapper; OCCT payload traced to exact LGPL-2.1-plus-exception source |
| `three` | 0.185.1 | MIT |

The production lock closure currently contains 75 unique package/version
entries: 60 MIT, 6 ISC, 5 Apache-2.0, 1 BSD-3-Clause, plus
`webgl-constants@1.1.1`, whose metadata omits a license while its included
license file is MIT. This deliberately excludes dev-only packages unless their
binaries or `node_modules` are distributed.

## Release checklist

- [x] Trace RepliCAD 0.23.1 to its exact MIT tag, package license, registry
      record, and explicit upstream relicensing commit; preserve its MIT notice.
- [x] Identify the exact OCCT/opencascade.js source used for the bundled WASM.
- [x] Replace floating build inputs with immutable source revisions and image
      digests, then retain the complete build configuration and provenance.
- [x] Record the owner's proprietary/all-rights-reserved choice and prevent npm
      publication with `private: true` plus `license: UNLICENSED`.
- [x] Generate a provisional notice inventory from the installed production
      dependency closure and make it accessible from the built application.
- [x] Verify final notices against the actual distributable, including every
      shipped component/version/source/copyright and all required license and
      NOTICE text.
- [x] Publish or accompany the build with required corresponding source,
      build instructions, and relinking/modification materials.
- [x] Provide a same-origin runtime configuration hook that can substitute a
      compatible OCCT WASM without modifying the application bundle. See
      `docs/OCCT_REPLACEMENT.md`.
- [ ] Obtain a legal review appropriate to the intended distribution model.
- [x] Rebuild and verify that notices are included in the released app.

## Operator disclosures

The operator identified himself as Cedric Takem, Hegelstrasse 27, 70734
Fellbach, Germany, with `admin@cadfilelab.com` as the contact address. The
production build includes a DDG provider notice, GDPR-oriented privacy notice,
and hosted-service terms. The service is intended to be accessible worldwide
where lawful, while preserving mandatory local consumer protections.

Update these documents before the operator, address, business form, register
status, VAT status, regulated-profession status, data flow, monetization, or
launch model changes.

No deployment or legal opinion was produced as part of this provenance fix.
