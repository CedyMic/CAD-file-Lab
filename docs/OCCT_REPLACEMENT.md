# Replacing the OCCT WebAssembly kernel

CAD File Lab loads its CAD kernel in a browser worker. A release operator or a
recipient running a local copy can replace the WebAssembly module without
modifying the proprietary application bundle.

This hook supports LGPL modification and relinking rights. The deployed release
also publishes `/occt-provenance.json` and `/OCCT_SOURCE_OFFER.txt`, which name
the exact distributed artifact, immutable build image, corresponding OCCT
source, applicable terms, and complete binding/build configuration.

## Runtime configuration

The deployed application includes `/occt-kernel.json`:

```json
{
  "wasmUrl": null
}
```

`null` selects the bundled kernel. To use a compatible replacement, host the
WASM on the same origin and set a relative URL:

```json
{
  "wasmUrl": "./cad-kernel/replicad_single.wasm"
}
```

The worker rejects cross-origin kernel URLs. CAD model data remains inside the
browser worker and is not sent to the kernel host.

## Verified source baseline

The replacement build must pin every input by immutable identifier. The
currently researched baseline is:

| Component | Immutable source identifier |
| --- | --- |
| Distributed WASM SHA-256 | `2e07c45b83267b38d3102ec411fad11e7ce2ed71854084e461c5ab5fee94aaff` |
| RepliCAD binding configuration | `sgenoud/replicad` commit `19fb8212e0bb12a07a7a49f96950f8903903d469` |
| Artifact-introducing commit | `bcc344da9a02066702ba7452b7b652112886cb94` |
| Immutable build image | `donalffons/opencascade.js@sha256:3069f4c2e3ab62bb82d81843bad2c0f8552ee92373208f8f655ef9bf71c0524d` |
| opencascade.js build system | commit `b5ff9847200016dce0d92fe747fc38a945771dc5` |
| OCCT source used by that build system | commit `bb368e271e24f63078129283148ce83db6b9670a` |
| Emscripten SDK | `3.1.14` |

Always use the image digest rather than its former floating `latest` tag. Run
`npm run provenance` before a release; it rejects a changed package commit,
version, or WASM hash. Source archive links and relinking steps are published in
`public/OCCT_SOURCE_OFFER.txt`.
