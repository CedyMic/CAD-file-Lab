import { useEffect } from 'react'

import { LandingPage } from './LandingPage'
import './ContentPage.css'

const ADSENSE_CLIENT = 'ca-pub-5451618329846801'

interface GuideSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

interface GuideArticle {
  slug: string
  title: string
  description: string
  category: string
  readingTime: string
  sections: GuideSection[]
}

const guideArticles: GuideArticle[] = [
  {
    slug: 'convert-step-to-stl-online',
    title: 'How to convert STEP to STL online without uploading your CAD file',
    description: 'Convert STEP or STP to STL in your browser with CAD File Lab. Follow the local export workflow and learn what happens to geometry, units and precision.',
    category: 'Conversion', readingTime: '5 min read',
    sections: [
      { heading: 'Why convert a STEP file to STL?', paragraphs: ['STEP and STP files store mathematical CAD surfaces and solid topology. STL describes the surface as triangles, which makes it useful for many 3D printing slicers and mesh viewers. A STEP-to-STL conversion produces a mesh representation; it does not preserve editable CAD faces, feature history or sketch dimensions.', 'Use the original STEP model as your engineering source. Treat the STL as an export for a particular downstream task.'] },
      { heading: 'Convert STEP to STL in CAD File Lab', paragraphs: ['Open the CAD File Lab workspace and choose a .step or .stp file from your device. Wait for the 3D viewer to finish loading, then orbit and inspect the model. CAD File Lab processes the file in your browser rather than uploading it to a conversion server.', 'Open Convert / Export, select STL as the output format, choose visible or selected bodies as the scope, and download the new mesh file. Your original STEP file is not overwritten.'], bullets: ['Open the STEP/STP model in the online CAD viewer.', 'Inspect the bodies and check which ones are visible.', 'Choose STL in Convert / Export and download the converted mesh.', 'Open the STL in the receiving application and verify scale and geometry.'] },
      { heading: 'Check dimensions, units and surface quality', paragraphs: ['STL files do not have a standard unit declaration. Confirm a known dimension in your slicer or receiving program instead of assuming millimetres are interpreted automatically. Curved surfaces become triangles, so visually inspect cylinders, fillets, thin walls and holes after conversion.', 'If your next tool accepts exact CAD and you need to retain mathematical surfaces, export STEP rather than STL. CAD File Lab can preserve exact STEP/BREP geometry for supported editable CAD sources.'] },
      { heading: 'Can you convert STL back to STEP?', paragraphs: ['A mesh-to-STEP export does not recover the original sketches, constraints or CAD design intent. Recognizing analytic surfaces from a triangle mesh is a different reverse-engineering task. CAD File Lab does not present mesh reconstruction as an automatic feature.'] },
    ],
  },
  {
    slug: 'open-and-inspect-step-files',
    title: 'How to open and inspect STEP files privately in your browser',
    description: 'A practical workflow for opening STEP and STP models, navigating assemblies and inspecting individual bodies without uploading the file.',
    category: 'Viewing', readingTime: '6 min read',
    sections: [
      { heading: 'What happens when you open a STEP file', paragraphs: ['CAD File Lab reads STEP and STP files inside a browser worker. The original file remains on your device. The CAD kernel converts exact boundary-representation faces into a display mesh for the viewport while retaining the exact model for supported editing and export operations.', 'Large CAD files can require substantial browser memory. Files above 256 MiB are rejected before parsing. For complex models, close unrelated browser tabs and allow the first import to finish before starting another operation.'] },
      { heading: 'Navigate the model', paragraphs: ['Drag in the graphics area to orbit, use the wheel to zoom and right-drag to pan. Fit returns the complete visible model to the viewport. The orientation widget shows the current X, Y and Z directions, while perspective and orthographic projection are available in Visual settings.'], bullets: ['Use Fit after hiding or showing several bodies.', 'Choose orthographic projection when comparing aligned faces.', 'Use shaded-with-edges when small holes or body boundaries are difficult to see.'] },
      { heading: 'Work with multiple bodies', paragraphs: ['Each imported body appears in the Model tree. Clicking a body in either the tree or graphics area selects it. Modifier-clicking adds or removes a body from the selection. Select all is available for multi-body models.', 'Visibility, color and transparency are stored per body. Hiding a body does not delete it or alter the original STEP file. These visual changes can be preserved in a CAD File Lab project file.'] },
      { heading: 'Save work without changing the source file', paragraphs: ['Editable projects can be saved to private browser recovery storage or downloaded as a portable .cadlab project. Recovery is designed for crashes and interrupted sessions; the portable project is the better choice when moving work between browsers or computers.', 'Exact STEP export creates a separate download. CAD File Lab never overwrites the file you opened.'] },
    ],
  },
  {
    slug: 'measure-3d-models',
    title: 'Measuring points, edges and faces in a 3D model',
    description: 'Learn how point, edge and face selections produce minimum distance, axis deltas, angles, radii and mesh properties.',
    category: 'Inspection', readingTime: '7 min read',
    sections: [
      { heading: 'Choose the geometry you intend to measure', paragraphs: ['Measurement quality starts with the selection filter. Auto accepts supported geometry, while Point, Edge and Face narrow the selectable entity type. Selected geometry is highlighted so both references remain visible during a two-entity measurement.', 'A rendered curve may contain many short line segments even when it represents one circular CAD edge. Edge mode groups the available polyline before calculating its length or shortest distance.'] },
      { heading: 'Understand the reported distance', paragraphs: ['For two points, the result includes the straight-line distance and signed X, Y and Z deltas. For two compatible edges or faces, minimum distance reports the shortest separation between the selected entities rather than only comparing the click locations.', 'Parallel planar faces can also report a normal distance. Nonparallel faces report an angle instead of presenting a misleading perpendicular gap.'], bullets: ['Use XYZ deltas when checking alignment or offsets.', 'Use minimum distance for clearance questions.', 'Use normal distance only when the selected faces are parallel.'] },
      { heading: 'Circles, radii and edge length', paragraphs: ['A closed edge whose sampled points fit a circle can report radius and diameter. Open polylines report total length but are not labelled as circles. Results are derived from the displayed geometry, so very coarse meshes can limit precision.'] },
      { heading: 'Area and volume', paragraphs: ['Surface area is calculated from the displayed triangles. Enclosed volume is shown only when the mesh is closed, consistently oriented and nondegenerate. An unavailable volume usually means the file contains an open shell, inconsistent triangle winding or invalid geometry; it does not necessarily mean the visible model is empty.'] },
    ],
  },
  {
    slug: 'convert-3d-file-formats',
    title: 'Choosing a 3D conversion format without losing the wrong data',
    description: 'Compare STEP, STL, OBJ, PLY, GLB, glTF and 3MF outputs and understand which conversions preserve exact CAD geometry.',
    category: 'Conversion', readingTime: '8 min read',
    sections: [
      { heading: 'Exact CAD and triangle meshes are different', paragraphs: ['STEP describes CAD topology and mathematical surfaces. STL, OBJ, PLY, GLB, glTF and 3MF primarily carry tessellated geometry. Converting STEP to a mesh samples curved surfaces into triangles; increasing triangle density improves visual fidelity but does not preserve parametric sketches or feature history.', 'Converting a mesh back to STEP cannot automatically recover the original design intent. A faceted STEP can represent each triangle as CAD topology, while a recognized-surface conversion must detect planes, cylinders, cones and spheres and may fail on noisy geometry.'] },
      { heading: 'Select an output for the next tool', paragraphs: ['STL is widely accepted by slicers but has no standard unit declaration and carries little scene information. OBJ is simple and broadly supported. PLY is useful for mesh processing and scanned geometry. GLB packages a glTF scene into one binary file, while embedded glTF remains text-based. 3MF is designed for manufacturing data and explicitly describes units.'], bullets: ['Use STEP or BREP when exact editable geometry is required.', 'Use STL for a simple manufacturing mesh when the receiving tool expects it.', 'Use GLB for compact browser and visualization workflows.', 'Use 3MF when manufacturing metadata and explicit units matter.'] },
      { heading: 'Check units and geometry after conversion', paragraphs: ['Always verify a known dimension in the receiving application. Formats and importers do not all interpret units identically. Also inspect holes, thin walls and curved surfaces, because these areas reveal insufficient tessellation first.', 'CAD File Lab exports visible or selected bodies according to the chosen scope. Hidden bodies are excluded from visible-body exports, so review the Model tree before downloading.'] },
      { heading: 'Current exact-output boundary', paragraphs: ['Editable STEP/STP and locally created exact models can currently export exact STEP or Open CASCADE BREP. Mesh inputs can export the supported mesh formats. Faceted mesh-to-STEP and recognized-surface reconstruction are separate future operations and should not be presented as equivalent to exact CAD recovery.'] },
    ],
  },
  {
    slug: 'reduce-mesh-file-size',
    title: 'How to reduce a mesh file without hiding the quality risk',
    description: 'A percentage-based guide to triangle reduction, visual inspection and choosing a safe result for STL, OBJ, PLY, GLB, glTF or 3MF.',
    category: 'Simplification', readingTime: '6 min read',
    sections: [
      { heading: 'What mesh reduction changes', paragraphs: ['Mesh reduction removes triangles and rebuilds the index so the exported file contains fewer geometric samples. It does not simplify the original STEP features and it does not make a mesh parametric. The main benefit is a smaller file that renders and transfers more quickly.', 'Flat regions often tolerate aggressive reduction. Small fillets, embossed text, thin walls and holes are more sensitive because fewer triangles remain to describe them.'] },
      { heading: 'Use the percentage as a quality decision', paragraphs: ['A retained value near 100% makes a small change. Medium reductions are useful for web previews and large scanned models. Very low retained percentages can visibly distort geometry or remove manufacturing details. CAD File Lab flags higher-risk percentages rather than requiring users to understand raw triangle counts.'], bullets: ['Low risk: inspect the result, but major shape changes are unlikely.', 'Medium risk: check curves, holes and thin features closely.', 'High risk: use only when a lightweight preview matters more than geometric fidelity.'] },
      { heading: 'Inspect before downloading', paragraphs: ['Orbit around the model, use shaded-with-edges and compare silhouettes from several directions. Measure a known feature when dimensional fidelity matters. If the result is unacceptable, increase the retained percentage and generate a new preview.', 'Keep the original file. Reduction is intentionally non-destructive, and a simplified export should be treated as a derivative for a specific downstream use.'] },
    ],
  },
  {
    slug: 'browser-local-cad-privacy',
    title: 'What browser-local CAD processing protects—and what it does not',
    description: 'Understand local model parsing, recovery storage, downloads and the privacy boundaries of a browser-based CAD workspace.',
    category: 'Privacy', readingTime: '7 min read',
    sections: [
      { heading: 'Model processing stays on the device', paragraphs: ['CAD File Lab loads the CAD kernel in the browser and performs supported imports, meshing, measurement and export locally. The application does not send model-file contents to a CAD processing server. This reduces exposure compared with an upload-and-convert service.', 'Browser-local does not mean the website is offline. The browser still downloads application code, fonts or advertising resources used by public content pages. Model data and ordinary website network traffic are different privacy concerns.'] },
      { heading: 'Recovery uses browser storage', paragraphs: ['Editable recovery records are stored in IndexedDB on the same browser profile. Recovery helps after a crash, but browser data can be removed by the user, operating system cleanup or private-browsing rules. A downloaded .cadlab project is the safer portable backup.', 'Clearing recovery removes stored CAD File Lab recovery records and pauses autosave for the current model until the user enables it again.'] },
      { heading: 'What to check on a managed computer', paragraphs: ['Company policies, browser extensions and endpoint-security products can still observe filenames, downloads or browser activity. If a model is export-controlled or governed by a confidentiality agreement, confirm that browser use and local storage satisfy the organization’s own rules.'], bullets: ['Use a supported, updated browser.', 'Avoid shared browser profiles for confidential work.', 'Download a project backup before clearing site data.', 'Review organizational policy before handling regulated models.'] },
    ],
  },
  {
    slug: 'troubleshoot-3d-file-imports',
    title: 'Troubleshooting 3D files that do not open correctly',
    description: 'Diagnose unsupported formats, external glTF dependencies, browser memory limits, open meshes and invalid CAD data.',
    category: 'Troubleshooting', readingTime: '7 min read',
    sections: [
      { heading: 'Confirm the file type and size', paragraphs: ['The current importer accepts STEP, STP, STL, OBJ, PLY, GLB, embedded glTF and 3MF up to 256 MiB. Renaming an extension does not convert a file. If the contents do not match the extension, parsing will fail with an unsupported or invalid file message.', 'A glTF file must embed its binary and image dependencies for single-file browser import. Use GLB when you need a self-contained scene.'] },
      { heading: 'Separate a slow import from a failed import', paragraphs: ['STEP parsing and meshing can take time for models with many faces. Wait for the status message to finish before opening another file. If the browser tab becomes unresponsive, retry with other tabs closed or use a smaller exported assembly.', 'Mesh files with extremely high triangle counts can also exhaust memory even when their compressed file size is below the limit.'] },
      { heading: 'Understand missing volume or bodies', paragraphs: ['An open shell can display correctly but has no enclosed volume. Inconsistent winding and degenerate triangles also prevent reliable volume calculation. A multi-body STEP file may contain hidden, empty or non-solid entities; inspect the Model tree and use Fit after changing visibility.'] },
      { heading: 'Create a useful failure report', paragraphs: ['Record the format, approximate file size, browser name, the visible error message and whether the file opens in another CAD application. Do not email a confidential model unless you are authorized to share it. A small non-confidential reproduction is more useful than a screenshot alone.'] },
    ],
  },
]

function loadAdSense() {
  if (document.querySelector('script[data-cadfilelab-adsense]')) return
  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.dataset.cadfilelabAdsense = 'true'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  document.head.append(script)
}

function MarketingHeader() {
  return <header className="landing-header">
    <a className="landing-brand" href="/" aria-label="CAD File Lab home"><span>C</span><strong>CAD File Lab</strong></a>
    <nav aria-label="Main navigation"><a href="/guides">Guides</a><a href="/formats">Formats</a><a href="/about">About</a><a href="/support">Support</a></nav>
    <a className="landing-workspace-link" href="/workspace">Open workspace</a>
  </header>
}

function MarketingFooter() {
  return <footer className="landing-footer" id="resources">
    <div className="footer-brand"><div><span>C</span><strong>CAD File Lab</strong></div><p>Private, browser-based tools for inspecting and preparing 3D files.</p><small>© 2026 Cedric Takem</small></div>
    <div><strong>Product</strong><a href="/workspace">3D workspace</a><a href="/formats">Supported formats</a><a href="/guides/convert-3d-file-formats">Conversion guide</a></div>
    <div><strong>Resources</strong><a href="/guides">Guides</a><a href="/guides/troubleshoot-3d-file-imports">Troubleshooting</a><a href="/support">Support</a></div>
    <div><strong>Company</strong><a href="/about">About</a><a href="/IMPRINT.txt">Impressum</a><a href="mailto:admin@cadfilelab.com">Contact</a></div>
    <div><strong>Legal</strong><a href="/PRIVACY_NOTICE.txt">Privacy</a><a href="/TERMS_OF_USE.txt">Terms</a><a href="/THIRD_PARTY_NOTICES.txt">Open-source notices</a></div>
  </footer>
}

function GuideIndex() {
  return <><MarketingHeader /><main className="content-main"><header className="content-hero"><span className="landing-eyebrow">CAD File Lab guides</span><h1>Practical guidance for working with 3D files</h1><p>Original explanations of file formats, inspection, conversion, simplification and browser-local privacy—based on the operations available in CAD File Lab.</p></header><section className="guide-grid" aria-label="3D file guides">{guideArticles.map((guide) => <article key={guide.slug}><span>{guide.category} · {guide.readingTime}</span><h2><a href={`/guides/${guide.slug}`}>{guide.title}</a></h2><p>{guide.description}</p><a href={`/guides/${guide.slug}`}>Read guide</a></article>)}</section></main><MarketingFooter /></>
}

function GuidePage({ article }: { article: GuideArticle }) {
  return <><MarketingHeader /><main className="article-main"><nav className="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides">Guides</a><span>›</span><span>{article.category}</span></nav><article><header><span className="landing-eyebrow">{article.category} · {article.readingTime}</span><h1>{article.title}</h1><p>{article.description}</p></header>{article.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}<aside className="article-action"><div><strong>Try the workflow locally</strong><p>Model files are processed in your browser and are not uploaded to a CAD conversion server.</p></div><a href="/workspace">Open CAD workspace</a></aside></article><nav className="related-guides" aria-label="Related guides"><strong>Continue reading</strong>{guideArticles.filter((guide) => guide.slug !== article.slug).slice(0, 3).map((guide) => <a key={guide.slug} href={`/guides/${guide.slug}`}>{guide.title}</a>)}</nav></main><MarketingFooter /></>
}

function FormatsPage() {
  return <><MarketingHeader /><main className="article-main"><article><header><span className="landing-eyebrow">Format reference</span><h1>Supported 3D file formats and capability boundaries</h1><p>Format names alone do not describe editability. This reference separates exact CAD geometry from triangle meshes and scene formats.</p></header><section><h2>Current import support</h2><div className="format-table"><div><strong>STEP / STP</strong><span>Exact CAD import, measurement, planar Move Face and exact STEP/BREP export.</span></div><div><strong>STL / OBJ / PLY</strong><span>Mesh import, viewing, measurement, simplification and mesh-format export.</span></div><div><strong>GLB / embedded glTF</strong><span>Scene-mesh import and mesh-format export. External glTF dependencies are not fetched.</span></div><div><strong>3MF</strong><span>Manufacturing-mesh import and mesh-format export.</span></div></div></section><section><h2>What is not preserved automatically</h2><p>Mesh conversion does not recreate sketches, dimensions, mates or feature history. Materials and scene metadata are not guaranteed across every output. Always verify units, body count and a known dimension in the receiving application.</p></section><section><h2>Exact and faceted STEP</h2><p>Exact STEP uses mathematical CAD surfaces. A faceted STEP represents mesh triangles as topology and can be much larger and less editable. CAD File Lab currently enables exact STEP output only for editable exact models; mesh-to-faceted-STEP remains a separate operation under development.</p></section></article></main><MarketingFooter /></>
}

function AboutPage() {
  return <><MarketingHeader /><main className="article-main"><article><header><span className="landing-eyebrow">About CAD File Lab</span><h1>A local-first workspace for everyday 3D file tasks</h1><p>CAD File Lab is operated by Cedric Takem in Fellbach, Germany. It is being built to make common inspection and preparation tasks approachable without requiring users to upload model files to a conversion service.</p></header><section><h2>Why browser-local processing</h2><p>Engineering files can contain confidential geometry. Running the supported CAD kernel and mesh operations in the browser reduces unnecessary transfer of model contents while keeping the tool accessible from an ordinary desktop browser.</p></section><section><h2>How capabilities are released</h2><p>Exact CAD and mesh operations have different failure modes. Features are labelled according to tested behavior, and unsupported operations should remain unavailable rather than implying that a visual approximation is an exact CAD result.</p></section><section><h2>Independent product design</h2><p>The interface uses familiar desktop CAD interaction principles, but CAD File Lab is independently designed and implemented. It does not include proprietary application code, artwork or documentation.</p></section></article></main><MarketingFooter /></>
}

function SupportPage() {
  return <><MarketingHeader /><main className="article-main"><article><header><span className="landing-eyebrow">Support</span><h1>Get help with a 3D file workflow</h1><p>Start with the guides and troubleshooting checklist. If the problem remains, send a concise report without attaching confidential model data unless you are authorized to share it.</p></header><section><h2>Before contacting support</h2><ul><li>Confirm the file extension and size.</li><li>Record the exact visible error message.</li><li>Note the browser and operating system.</li><li>Check whether the file opens in another CAD application.</li><li>Try a small, non-confidential reproduction if possible.</li></ul></section><section><h2>Contact</h2><p>Email <a href="mailto:admin@cadfilelab.com">admin@cadfilelab.com</a>. Include the workflow, expected result and actual result. Do not send passwords, license keys or regulated files.</p></section><section><h2>Useful resources</h2><p><a href="/guides/troubleshoot-3d-file-imports">Import troubleshooting</a> · <a href="/formats">Format support</a> · <a href="/PRIVACY_NOTICE.txt">Privacy notice</a></p></section></article></main><MarketingFooter /></>
}

function NotFoundPage() {
  return <><MarketingHeader /><main className="content-main"><header className="content-hero"><span className="landing-eyebrow">Page not found</span><h1>This page does not exist.</h1><p>Return to the guides or open the CAD workspace.</p><p><a href="/guides">Browse guides</a> · <a href="/workspace">Open workspace</a></p></header></main><MarketingFooter /></>
}

function setPageMetadata(path: string) {
  const guide = guideArticles.find((item) => path === `/guides/${item.slug}`)
  const title = guide?.title ?? (path === '/' ? 'Online STEP & STL Viewer and 3D Converter' : path === '/guides' ? 'STEP, STL and 3D file guides' : path === '/formats' ? 'Supported STEP, STL and 3D file formats' : path === '/about' ? 'About CAD File Lab' : path === '/support' ? 'CAD File Lab support' : 'CAD File Lab')
  const description = guide?.description ?? (path === '/' ? 'Open STEP, STP and STL files in a free online 3D viewer. Measure CAD models and convert STEP to STL privately in your browser—no file upload or account.' : 'Private browser-based tools and practical guidance for inspecting, measuring, converting and simplifying 3D files.')
  document.title = `${title} | CAD File Lab`
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', `https://www.cadfilelab.com${path === '/' ? '/' : path}`)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', `https://www.cadfilelab.com${path === '/' ? '/' : path}`)
}

export function MarketingSite({ path }: { path: string }) {
  useEffect(() => { setPageMetadata(path); loadAdSense() }, [path])
  if (path === '/') return <LandingPage />
  if (path === '/guides') return <GuideIndex />
  if (path === '/formats') return <FormatsPage />
  if (path === '/about') return <AboutPage />
  if (path === '/support') return <SupportPage />
  const guide = guideArticles.find((item) => path === `/guides/${item.slug}`)
  return guide ? <GuidePage article={guide} /> : <NotFoundPage />
}
