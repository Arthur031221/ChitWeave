// Measures the numbers the README quotes and fails when a claim stops being true.
// Run after `npm run build`. Prints one JSON object.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { parseLine } from '../src/core/parse.js'
import { serve } from '../test/serve.js'

const fixture = new URL('../fixtures/sample-zh-hant-12h.chat', import.meta.url).pathname
const text = readFileSync(fixture, 'utf8')
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

// 1. Counting speed, Node, median of 25 runs.
const runs = []
let parsed
for (let i = 0; i < 25; i += 1) {
  const t0 = performance.now()
  parsed = parseLine(text)
  runs.push(performance.now() - t0)
}
assert.equal(parsed.records, 12714)

// 2. The page: file chosen to weave drawn, requests made, picture saved.
const site = await serve()
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1180, height: 900 }, acceptDownloads: true })).newPage()
const requests = []
page.on('request', (r) => !/^(data|blob):/.test(r.url()) && requests.push(r.url()))
await page.goto(site.url)
await page.waitForSelector('html[data-ready]')
const loadRequests = requests.length
const drawn = []
for (let i = 0; i < 5; i += 1) {
  await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
  const t0 = performance.now()
  await page.setInputFiles('#file', fixture)
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('12,714') && document.querySelector('#poster.weaving'))
  drawn.push(performance.now() - t0)
}
await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save-png')])
const png = readFileSync(await download.path())
const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => 'sent', () => 'blocked'))
await browser.close()
await site.close()

assert.equal(blocked, 'blocked')
assert.deepEqual(requests.slice(loadRequests), [], 'requests after the page loaded')
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1080, 1350])

// 3. The commands the README shows.
const dir = mkdtempSync(join(tmpdir(), 'chitweave-verify-'))
const bin = new URL('../bin/chitweave.js', import.meta.url).pathname
execFileSync(process.execPath, [bin, '--sample', '-o', join(dir, 'sample.svg')], { stdio: 'pipe' })
execFileSync(process.execPath, [bin, fixture, '--palette', 'sage', '-o', join(dir, 'chat.svg')], { stdio: 'pipe' })
assert.ok(readFileSync(join(dir, 'chat.svg'), 'utf8').startsWith('<svg'))

console.log(JSON.stringify({
  records: parsed.records,
  days: parsed.days,
  parseMs: Number(median(runs).toFixed(1)),
  chooseFileToPageMs: Math.round(median(drawn)),
  requestsAfterLoad: requests.length - loadRequests,
  fetchFromPage: blocked,
  pngBytes: png.length,
  node: process.version,
  browser: 'chromium',
}, null, 2))
