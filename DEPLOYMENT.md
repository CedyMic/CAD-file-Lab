# STEPscope CAD Editor — deployment

STEPscope is a static browser application. No backend, database, build process, or visitor-side installation is required.

## Main functions

- Exact STEP/STP import, B-Rep modification, and STEP export through OpenCascade WebAssembly
- Move, rotate, scale, duplicate, and delete bodies
- Create boxes, cylinders, spheres, rectangular extrusions, and circular extrusions
- Union, subtract, and intersect bodies
- Cut-extrusion, cylindrical holes, all-edge fillet, and all-edge chamfer
- Undo and redo
- Point-to-point distance, three-point angle, and three-point radius/diameter measurements
- Body surface area, volume, total edge length, and bounding-box dimensions
- Section view / Schnittansicht with X, Y, or Z clipping planes
- Browser-local STEP snapshots through IndexedDB
- Viewer support for IGES, BREP, STL, OBJ, PLY, GLB/glTF, FBX, 3MF, DAE, 3DS, and VRML

STEP and STP are editable. Other formats are viewable, measurable, and sectionable.

## Update the existing Cloudflare deployment

1. Open the existing Worker or Pages project.
2. Select **New deployment**.
3. Upload the complete deployment ZIP.
4. Confirm the deployment.
5. Keep `index.html`, `cad-worker.js`, the `vendor` folder, and the `samples` folder at the deployment root.

Cloudflare normally serves `.wasm` files with the correct MIME type. The included `_headers` file explicitly declares `application/wasm` for compatible hosting platforms.

## Netlify

Extract the ZIP and drag the complete extracted folder into Netlify Drop. The included `netlify.toml` configures WebAssembly headers.

## Important technical notes

- CAD files are processed locally in each visitor's browser. The application does not upload them to a conversion server.
- **Save STEP** downloads a new STEP file to the user's device.
- **Save local** stores the latest STEP snapshot in that browser's IndexedDB storage. Browser data cleanup can delete this copy, so it should not replace normal file backups.
- The exact CAD kernel is loaded only when STEP editing is used. The first editable STEP load can therefore take several seconds.
- Native proprietary files such as SLDPRT, CATPart, IPT, and PRT must be exported to STEP before exact editing.

## Current first-version limitations

- Imported STEP assembly names, hierarchy, constraints, sketches, and parametric feature history are not reconstructed. The imported model is handled as exact B-Rep geometry.
- Fillet and chamfer currently apply to all edges of the selected body. OpenCascade can reject operations where the requested value is incompatible with one or more edges.
- Sketch extrusion currently uses rectangles or circles on global XY, XZ, or YZ planes.
- The section view uses one movable clipping plane and does not generate a permanently cut solid unless the user performs an actual Boolean cut.
- Measurements use points selected on the rendered surface. They do not yet include dedicated edge, vertex, concentricity, or GD&T snapping.
