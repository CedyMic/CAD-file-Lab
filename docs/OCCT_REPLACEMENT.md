# Replacing the OCCT WebAssembly kernel

CAD File Lab loads its CAD kernel in a browser worker. A release operator or a
recipient running a local copy can replace the WebAssembly module without
modifying the proprietary application bundle.

This hook is engineering support for LGPL modification/relinking rights. It is
not, by itself, complete license clearance. The replacement must be built from
the same JavaScript bindings, and the release must still provide the applicable
license text, notices, exact corresponding source, and complete build material.

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

## Proposed reproducible source baseline

The replacement build must pin every input by immutable identifier. The
currently researched baseline is:

| Component | Immutable source identifier |
| --- | --- |
| RepliCAD binding configuration | `sgenoud/replicad` commit `19fb8212e0bb12a07a7a49f96950f8903903d469` |
| opencascade.js build system | commit `5ff2b750ba4b9a9fdfbff8842712cbb562e78ce7` |
| OCCT source used by that build system | commit `bb368e271e24f63078129283148ce83db6b9670a` |
| Emscripten SDK | `3.1.14` |

Before building, also replace every tag-only dependency and container reference
with a verified commit or content digest. Retain the source archives, hashes,
binding YAML, patches, container recipe, commands, compiler versions, and final
artifact hash together. Do not describe a release as cleared until a build from
those retained inputs is verified and the legal checklist is complete.
