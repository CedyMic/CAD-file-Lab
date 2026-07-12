import { readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'))
const outputPath = path.join(root, 'public', 'THIRD_PARTY_NOTICES.txt')
const licensePattern = /^(licen[cs]e|copying)([.-].*)?$/i
const noticePattern = /^notice(\..*)?$/i

const mitFallbackHolders = new Map([
  ['@react-three/fiber', 'Paul Henschel and contributors'],
  ['maath', 'pmndrs contributors'],
  ['stats-gl', 'Renaud Rohlinger'],
])

const mitText = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

const apacheText = (
  await readFile(path.join(root, 'node_modules', '@dimforge', 'rapier3d-compat', 'LICENSE'), 'utf8')
).trim()

const packages = []
const missingLicenseTexts = []

for (const [lockPath, metadata] of Object.entries(lock.packages ?? {})) {
  if (!lockPath.startsWith('node_modules/') || metadata.dev) continue

  const packagePath = path.join(root, ...lockPath.split('/'))
  const manifestPath = path.join(packagePath, 'package.json')
  if (!existsSync(manifestPath)) continue

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const files = await readdir(packagePath, { withFileTypes: true })
  const licenseFiles = files
    .filter((file) => file.isFile() && licensePattern.test(file.name))
    .map((file) => file.name)
    .sort()
  const noticeFiles = files
    .filter((file) => file.isFile() && noticePattern.test(file.name))
    .map((file) => file.name)
    .sort()

  const declaredLicense = manifest.license ?? metadata.license ?? 'UNSPECIFIED'
  let fallbackText = null
  let licenseTextSource = 'installed package archive'

  if (licenseFiles.length === 0 && declaredLicense === 'Apache-2.0') {
    fallbackText = apacheText
    licenseTextSource = 'canonical Apache-2.0 text (archive omitted a license file)'
  } else if (licenseFiles.length === 0 && declaredLicense === 'MIT' && mitFallbackHolders.has(manifest.name)) {
    fallbackText = mitText(mitFallbackHolders.get(manifest.name))
    licenseTextSource = 'declared MIT terms with the upstream author or project holder (archive omitted a license file)'
  } else if (licenseFiles.length === 0) {
    missingLicenseTexts.push(`${manifest.name}@${manifest.version} (${declaredLicense})`)
    continue
  }

  const repository =
    typeof manifest.repository === 'string'
      ? manifest.repository
      : manifest.repository?.url
  const source = manifest.homepage ?? repository ?? `https://www.npmjs.com/package/${manifest.name}`

  packages.push({
    name: manifest.name,
    version: manifest.version,
    license: declaredLicense,
    licenseTextSource,
    source: source.replace(/^git\+/, '').replace(/\.git$/, ''),
    licenseTexts: fallbackText
      ? [{ file: 'declared-license-fallback', text: fallbackText }]
      : await Promise.all(
          licenseFiles.map(async (file) => ({
            file,
            text: (await readFile(path.join(packagePath, file), 'utf8')).trim(),
          })),
        ),
    noticeTexts: await Promise.all(
      noticeFiles.map(async (file) => ({
        file,
        text: (await readFile(path.join(packagePath, file), 'utf8')).trim(),
      })),
    ),
  })
}

if (missingLicenseTexts.length > 0) {
  throw new Error(`Installed packages without license texts:\n${missingLicenseTexts.join('\n')}`)
}

const uniquePackages = [...new Map(
  packages.map((dependency) => [`${dependency.name}@${dependency.version}`, dependency]),
).values()]

uniquePackages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))

const textGroups = new Map()
for (const dependency of uniquePackages) {
  for (const entry of [...dependency.licenseTexts, ...dependency.noticeTexts]) {
    const key = entry.text.replace(/\r\n/g, '\n')
    const group = textGroups.get(key) ?? []
    group.push(`${dependency.name}@${dependency.version} (${entry.file})`)
    textGroups.set(key, group)
  }
}

const lines = [
  'CAD FILE LAB - THIRD-PARTY SOFTWARE NOTICES',
  '',
  'IMPORTANT DISTRIBUTION STATUS',
  '=============================',
  '',
  'This inventory does not clear the application for distribution. RepliCAD 0.23.1 has',
  'version-specific MIT evidence recorded in LEGAL_DISTRIBUTION.md, but the Open CASCADE',
  'WebAssembly payload still lacks sufficient source/build provenance in its npm archive.',
  'Resolve the blockers recorded in LEGAL_DISTRIBUTION.md before publishing any build.',
  '',
  'This file is generated from the production packages installed by package-lock.json.',
  'It includes license and NOTICE texts for the installed browser application dependencies.',
  'A small allowlist supplies standard declared terms when an npm archive omits its license file;',
  'generation fails for any other missing text so omissions cannot pass silently.',
  'Development-only tooling is not part of this notice.',
  '',
  'PACKAGE INDEX',
  '=============',
  '',
]

for (const dependency of uniquePackages) {
  lines.push(
    `${dependency.name}@${dependency.version}`,
    `Declared license: ${dependency.license}`,
    `License text source: ${dependency.licenseTextSource}`,
    `Source: ${dependency.source}`,
    '',
  )
}

lines.push('LICENSE AND NOTICE TEXTS', '========================', '')

let groupNumber = 0
for (const [text, usedBy] of textGroups) {
  groupNumber += 1
  lines.push(
    `Text ${groupNumber}`,
    '-'.repeat(`Text ${groupNumber}`.length),
    `Applies to: ${usedBy.join(', ')}`,
    '',
    text,
    '',
  )
}

await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${path.relative(root, outputPath)} for ${uniquePackages.length} unique installed production packages.`)
