import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('marketing routes render a single useful heading and working internal navigation', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { MarketingSite } = await server.ssrLoadModule('/src/marketing/MarketingSite.tsx')
    const pages = [
      ['/', 'Open STEP and STL files online'],
      ['/guides', 'Practical guidance'],
      ['/guides/convert-step-to-stl-online', 'How to convert STEP to STL online'],
      ['/guides/open-and-inspect-step-files', 'How to open and inspect STEP files'],
      ['/formats', 'Supported 3D file formats'],
    ]
    for (const [path, heading] of pages) {
      const markup = renderToStaticMarkup(React.createElement(MarketingSite, { path }))
      assert.equal((markup.match(/<h1(?:\s[^>]*)?>/g) ?? []).length, 1, `${path} should have one primary heading`)
      assert.ok(markup.includes(heading), `${path} is missing its intended title`)
      assert.match(markup, /href="\/workspace"/, `${path} is missing the CAD workspace link`)
    }
    const home = renderToStaticMarkup(React.createElement(MarketingSite, { path: '/' }))
    assert.match(home, /href="\/guides\/convert-step-to-stl-online"/)
  } finally {
    await server.close()
  }
})
