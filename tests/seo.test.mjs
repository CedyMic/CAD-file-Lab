import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const landing = readFileSync(new URL('../src/marketing/LandingPage.tsx', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/marketing/MarketingSite.tsx', import.meta.url), 'utf8')
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')

test('homepage describes the working STEP and STL viewer in searchable text', () => {
  assert.match(html, /<title>Online STEP &amp; STL Viewer|<title>Online STEP & STL Viewer/)
  assert.match(html, /name="description"[\s\S]*?convert STEP to STL/)
  assert.match(landing, /<h1>Open STEP and STL files online/)
  assert.match(landing, /href="\/guides\/convert-step-to-stl-online"/)
})

test('STEP to STL guide is linked and included in the XML sitemap', () => {
  assert.match(guides, /slug: 'convert-step-to-stl-online'/)
  assert.match(sitemap, /https:\/\/www\.cadfilelab\.com\/guides\/convert-step-to-stl-online/)
})

test('software structured data is valid JSON without fabricated ratings', () => {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  assert.ok(match)
  const data = JSON.parse(match[1])
  assert.equal(data['@type'], 'WebApplication')
  assert.equal(data.url, 'https://www.cadfilelab.com/')
  assert.equal(data.aggregateRating, undefined)
})
