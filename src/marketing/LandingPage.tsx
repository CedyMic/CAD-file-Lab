import './LandingPage.css'

const availableFormats = ['STEP', 'STP', 'STL']
const plannedFormats = ['OBJ', 'PLY', 'GLB', 'glTF', '3MF', 'IGES', 'BREP']

export function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="CAD File Lab home">
          <span>C</span>
          <strong>CAD File Lab</strong>
        </a>
        <nav aria-label="Main navigation">
          <a href="#capabilities">Capabilities</a>
          <a href="#formats">Formats</a>
          <a href="#privacy">Privacy</a>
          <a href="#resources">Resources</a>
        </nav>
        <a className="landing-workspace-link" href="/workspace">Open workspace</a>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-eyebrow">Private browser-based 3D workspace</span>
            <h1>Work with 3D files without sending them to a server.</h1>
            <p>
              View models today, with creation, assembly, conversion and simplification
              workflows being built into one approachable local-first CAD workspace.
            </p>
            <div className="hero-actions">
              <a className="landing-primary-action" href="/workspace">Open CAD workspace</a>
              <a className="landing-secondary-action" href="#capabilities">Explore capabilities</a>
            </div>
            <div className="hero-trust">
              <span>Files stay on your device</span>
              <span>No account required</span>
              <span>Automatic local recovery</span>
            </div>
          </div>
          <div className="hero-product" aria-label="CAD File Lab workspace preview">
            <div className="preview-ribbon"><i /><i /><i /><i /></div>
            <div className="preview-shell">
              <aside><span /><span /><span /><span /></aside>
              <div className="preview-viewport">
                <div className="preview-model"><b /><b /><b /></div>
              </div>
              <aside><span /><span /><span /></aside>
            </div>
            <div className="preview-status">Local processing · Private recovery enabled</div>
          </div>
        </section>

        <section className="landing-section capability-section" id="capabilities">
          <header>
            <span className="landing-eyebrow">One focused workspace</span>
            <h2>From opening a file to preparing the next version.</h2>
          </header>
          <div className="capability-grid">
            <article className="capability-ready">
              <span>Available now</span><h3>View 3D files</h3>
              <p>Open models locally, inspect multiple bodies, orbit, pan, zoom and control their visual presentation.</p>
              <a href="/workspace">View a model</a>
            </article>
            <article><span>In development</span><h3>Create parts</h3><p>Build parametric parts with familiar CAD operations and an approachable properties workflow.</p></article>
            <article><span>Planned</span><h3>Create assemblies</h3><p>Combine components, position them and add common mating constraints while keeping files local.</p></article>
            <article><span>In development</span><h3>Convert formats</h3><p>Choose an input and output format with clear geometry, unit and accuracy guidance.</p></article>
            <article><span>In development</span><h3>Reduce file size</h3><p>Simplify CAD features or reduce mesh triangles using controlled quality targets.</p></article>
          </div>
        </section>

        <section className="landing-section formats-section" id="formats">
          <div>
            <span className="landing-eyebrow">Format support</span>
            <h2>CAD and mesh formats, clearly distinguished.</h2>
            <p>Exact CAD geometry and triangle meshes have different capabilities. CAD File Lab labels those differences instead of hiding them.</p>
          </div>
          <div className="format-columns">
            <article><h3>Available now</h3><div>{availableFormats.map((format) => <span key={format}>{format}</span>)}</div><p>STEP and STP are editable. STL is currently view-only.</p></article>
            <article><h3>Planned import support</h3><div>{plannedFormats.map((format) => <span key={format}>{format}</span>)}</div><p>Each format will be released only after its local importer is verified.</p></article>
          </div>
        </section>

        <section className="landing-section privacy-section" id="privacy">
          <div className="privacy-mark">Local</div>
          <div>
            <span className="landing-eyebrow">Privacy by architecture</span>
            <h2>Your model does not need to leave your computer.</h2>
            <p>Importing, meshing, viewing and local recovery run in your browser. CAD File Lab does not upload model files for server-side processing.</p>
          </div>
          <ul><li>Browser-local processing</li><li>Private local recovery every five minutes</li><li>Original files remain unchanged</li><li>Recovery data can be erased</li></ul>
        </section>

        <aside className="landing-ad" aria-label="Advertisement">
          <span>Advertisement</span>
          <p>Reserved for privacy-respecting contextual sponsorship.</p>
        </aside>

        <section className="landing-cta">
          <div><span className="landing-eyebrow">Start locally</span><h2>Open a 3D file in your browser.</h2><p>No account and no model upload required.</p></div>
          <a href="/workspace">Open CAD workspace</a>
        </section>
      </main>

      <footer className="landing-footer" id="resources">
        <div className="footer-brand"><div><span>C</span><strong>CAD File Lab</strong></div><p>Private, browser-based tools for viewing and working with 3D files.</p><small>© 2026 Cedric Takem</small></div>
        <div><strong>Product</strong><a href="/workspace">3D viewer</a><a href="#capabilities">Create</a><a href="#capabilities">Convert</a><a href="#capabilities">Simplify</a><a href="#capabilities">Assemblies</a></div>
        <div><strong>Resources</strong><a href="#formats">Supported formats</a><a href="/workspace">Help &amp; guides</a><a href="mailto:admin@cadfilelab.com">Support</a><a href="/OCCT_SOURCE_OFFER.txt">OCCT source offer</a></div>
        <div><strong>Company</strong><a href="/IMPRINT.txt">Impressum</a><a href="mailto:admin@cadfilelab.com">Contact</a></div>
        <div><strong>Legal</strong><a href="/PRIVACY_NOTICE.txt">Privacy</a><a href="/TERMS_OF_USE.txt">Terms</a><a href="/THIRD_PARTY_NOTICES.txt">Open-source notices</a></div>
      </footer>
    </div>
  )
}
