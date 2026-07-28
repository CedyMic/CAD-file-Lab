import './LandingPage.css'

const availableFormats = ['STEP', 'STP', 'STL', 'OBJ', 'PLY', 'GLB', 'glTF', '3MF']

export function LandingPage() {
  return <div className="landing-page">
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="CAD File Lab home"><span>C</span><strong>CAD File Lab</strong></a>
      <nav aria-label="Main navigation"><a href="/guides">Guides</a><a href="/formats">Formats</a><a href="#privacy">Privacy</a><a href="/about">About</a></nav>
      <a className="landing-workspace-link" href="/workspace">Open workspace</a>
    </header>

    <main>
      <section className="landing-hero">
        <div className="hero-copy"><span className="landing-eyebrow">Private browser-based 3D workspace</span><h1>Work with 3D files without sending them to a server.</h1><p>Open, inspect, measure, section, simplify and convert supported 3D files in a local-first workspace designed for practical engineering checks.</p><div className="hero-actions"><a className="landing-primary-action" href="/workspace">Open CAD workspace</a><a className="landing-secondary-action" href="/guides">Read the guides</a></div><div className="hero-trust"><span>Files stay on your device</span><span>No account required</span><span>Automatic local recovery</span></div></div>
        <div className="hero-product" aria-label="CAD File Lab workspace preview"><div className="preview-ribbon"><i /><i /><i /><i /></div><div className="preview-shell"><aside><span /><span /><span /><span /></aside><div className="preview-viewport"><div className="preview-model"><b /><b /><b /></div></div><aside><span /><span /><span /></aside></div><div className="preview-status">Local processing · Private recovery enabled</div></div>
      </section>

      <section className="landing-section capability-section" id="capabilities"><header><span className="landing-eyebrow">Available workflows</span><h2>From opening a file to preparing the next version.</h2></header><div className="capability-grid">
        <article className="capability-ready"><span>Available now</span><h3>View and organize</h3><p>Open models locally, inspect multiple bodies, orbit, pan, zoom and control their visual presentation.</p><a href="/workspace">View a model</a></article>
        <article className="capability-ready"><span>Available now</span><h3>Measure geometry</h3><p>Measure supported points, edges and faces, including XYZ deltas, minimum distance, angle, radius and diameter.</p><a href="/guides/measure-3d-models">Measurement guide</a></article>
        <article className="capability-ready"><span>Available now</span><h3>Section and inspect</h3><p>Create non-destructive X, Y or Z cutaway previews without changing the model geometry.</p><a href="/workspace">Open workspace</a></article>
        <article className="capability-ready"><span>Available now</span><h3>Convert and export</h3><p>Export supported models to mesh formats, or preserve exact STEP/BREP geometry when the source remains editable.</p><a href="/guides/convert-3d-file-formats">Conversion guide</a></article>
        <article className="capability-ready"><span>Available now</span><h3>Reduce mesh size</h3><p>Retain a chosen percentage of mesh detail with clear quality-risk guidance and a non-destructive result.</p><a href="/guides/reduce-mesh-file-size">Simplification guide</a></article>
      </div></section>

      <section className="landing-section formats-section" id="formats"><div><span className="landing-eyebrow">Format support</span><h2>CAD and mesh formats, clearly distinguished.</h2><p>Exact CAD geometry and triangle meshes have different capabilities. CAD File Lab labels those differences instead of hiding them.</p></div><div className="format-columns"><article><h3>Available now</h3><div>{availableFormats.map((format) => <span key={format}>{format}</span>)}</div><p>STEP and STP retain exact editable geometry. Mesh and scene formats support viewing, measurement, simplification and mesh export; glTF must embed its dependencies.</p></article><article><h3>Choose by geometry type</h3><p>STEP is mathematical CAD geometry. STL, OBJ and PLY are triangle meshes. GLB and glTF are scene-oriented formats, while 3MF targets manufacturing workflows. Conversion cannot recreate missing sketches or feature history.</p><a href="/formats">Read the complete format reference</a></article></div></section>

      <section className="landing-section privacy-section" id="privacy"><div className="privacy-mark">Local</div><div><span className="landing-eyebrow">Privacy by architecture</span><h2>Your model does not need to leave your computer.</h2><p>Importing, meshing, viewing and local recovery run in your browser. CAD File Lab does not upload model files for server-side processing.</p></div><ul><li>Browser-local processing</li><li>Private local recovery every five minutes</li><li>Original files remain unchanged</li><li>Recovery data can be erased</li></ul></section>

      <section className="landing-section guide-preview-section"><header><span className="landing-eyebrow">Learn the workflow</span><h2>Practical 3D file guides</h2><p>Use the format and inspection guides to choose the right operation and understand what the result preserves.</p></header><div className="guide-preview-grid"><a href="/guides/open-and-inspect-step-files"><strong>Inspect STEP files</strong><span>Model navigation, bodies and local project recovery</span></a><a href="/guides/convert-3d-file-formats"><strong>Choose a conversion format</strong><span>Exact CAD versus mesh outputs and unit checks</span></a><a href="/guides/troubleshoot-3d-file-imports"><strong>Troubleshoot imports</strong><span>File limits, dependencies and invalid geometry</span></a></div></section>

      <section className="landing-cta"><div><span className="landing-eyebrow">Start locally</span><h2>Open a 3D file in your browser.</h2><p>No account and no model upload required.</p></div><a href="/workspace">Open CAD workspace</a></section>
    </main>

    <footer className="landing-footer" id="resources"><div className="footer-brand"><div><span>C</span><strong>CAD File Lab</strong></div><p>Private, browser-based tools for inspecting and preparing 3D files.</p><small>© 2026 Cedric Takem</small></div><div><strong>Product</strong><a href="/workspace">3D workspace</a><a href="/formats">Supported formats</a><a href="/guides/convert-3d-file-formats">Conversion guide</a></div><div><strong>Resources</strong><a href="/guides">Guides</a><a href="/guides/troubleshoot-3d-file-imports">Troubleshooting</a><a href="/support">Support</a><a href="/OCCT_SOURCE_OFFER.txt">OCCT source offer</a></div><div><strong>Company</strong><a href="/about">About</a><a href="/IMPRINT.txt">Impressum</a><a href="mailto:admin@cadfilelab.com">Contact</a></div><div><strong>Legal</strong><a href="/PRIVACY_NOTICE.txt">Privacy</a><a href="/TERMS_OF_USE.txt">Terms</a><a href="/THIRD_PARTY_NOTICES.txt">Open-source notices</a></div></footer>
  </div>
}
