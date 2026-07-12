import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const provenance = JSON.parse(
  await readFile(path.join(root, 'public', 'occt-provenance.json'), 'utf8'),
)
const packageManifest = JSON.parse(
  await readFile(
    path.join(root, 'node_modules', 'replicad-opencascadejs', 'package.json'),
    'utf8',
  ),
)
const wasm = await readFile(
  path.join(
    root,
    'node_modules',
    'replicad-opencascadejs',
    'src',
    'replicad_single.wasm',
  ),
)
const releaseDocuments = await Promise.all([
  'OCCT_SOURCE_OFFER.txt',
  'licenses/OCCT-LGPL-2.1.txt',
  'licenses/OCCT-LGPL-EXCEPTION-1.0.txt',
  'PRIVACY_NOTICE.txt',
  'TERMS_OF_USE.txt',
].map((file) => readFile(path.join(root, 'public', file), 'utf8')))
const actualSha256 = createHash('sha256').update(wasm).digest('hex')

const failures = []

if (packageManifest.version !== '0.23.0') {
  failures.push(`expected replicad-opencascadejs 0.23.0, got ${packageManifest.version}`)
}

if (packageManifest.gitHead !== provenance.replicad.releaseCommit) {
  failures.push(
    `package gitHead ${packageManifest.gitHead ?? '(missing)'} does not match ${provenance.replicad.releaseCommit}`,
  )
}

if (actualSha256 !== provenance.artifact.sha256) {
  failures.push(
    `kernel SHA-256 ${actualSha256} does not match ${provenance.artifact.sha256}`,
  )
}

if (!releaseDocuments[0].includes('/licenses/OCCT-LGPL-2.1.txt')) {
  failures.push('source offer does not link the bundled LGPL text')
}

if (!releaseDocuments[1].includes('GNU LESSER GENERAL PUBLIC LICENSE')) {
  failures.push('bundled LGPL text is invalid')
}

if (!releaseDocuments[2].includes('Open CASCADE exception (version 1.0)')) {
  failures.push('bundled OCCT exception text is invalid')
}

if (failures.length > 0) {
  throw new Error(`OCCT provenance verification failed:\n${failures.join('\n')}`)
}

console.log(
  `Verified replicad-opencascadejs@${packageManifest.version} kernel ${actualSha256}.`,
)
