import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectRange } from '../src/core/aggregate.js'
import { renderSvg } from '../src/core/svg.js'
import { sampleAggregate } from '../src/core/sample.js'

const range = (days = 30) => selectRange(sampleAggregate(), { days })

test('the same input gives the same bytes', () => {
  assert.equal(renderSvg(range()), renderSvg(range()))
})

test('one group per day, in a 1080 by 1350 picture', () => {
  const svg = renderSvg(range(60))
  assert.match(svg, /viewBox="0 0 1080 1350"/)
  assert.equal(svg.match(/class="row"/g).length, 60)
})

test('title and names are escaped, not interpreted', () => {
  const svg = renderSvg(range(), { title: '<script>alert(1)</script> & "x"', labelA: "</text><b>'", labelB: 'B' })
  assert.ok(!svg.includes('<script>'))
  assert.ok(!svg.includes('<b>'))
  assert.match(svg, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;x&quot;/)
})

test('defaults are anonymous and the language switches the text', () => {
  const zh = renderSvg(range())
  const en = renderSvg(range(), { lang: 'en' })
  assert.match(zh, />我們的織布</)
  assert.match(en, />Our weave</)
  assert.match(zh, />A<\/text>/)
  assert.match(en, />B<\/text>/)
})

test('the footer says how much of the export is shown', () => {
  assert.match(renderSvg(range(90), { lang: 'en' }), /The last 90 of 150 days in the export/)
  const all = selectRange({ ...sampleAggregate(), a: sampleAggregate().a.slice(0, 20), b: sampleAggregate().b.slice(0, 20) })
  assert.match(renderSvg(all, { lang: 'en' }), /across all 20 days in the export/)
})

test('an all zero range still draws and says so', () => {
  const zeros = Array.from({ length: 10 }, () => new Array(24).fill(0))
  const empty = selectRange({ version: 1, start: '2026-01-01', a: zeros, b: zeros })
  const svg = renderSvg(empty, { lang: 'en' })
  assert.match(svg, /No records in this period/)
  assert.ok(!svg.includes('NaN'))
  assert.ok(!svg.includes('Infinity'))
})

test('no NaN anywhere for any range length', () => {
  for (const days of [1, 2, 31, 32, 90]) assert.ok(!/NaN|undefined/.test(renderSvg(range(days))), `${days} days`)
})

test('each palette changes the colors', () => {
  const coral = renderSvg(range(), { palette: 'coral' })
  const sage = renderSvg(range(), { palette: 'sage' })
  assert.notEqual(coral, sage)
  assert.match(sage, /#1c2a25/)
})

test('characters XML cannot carry are dropped from text', () => {
  const svg = renderSvg(range(), { title: 'a\u0001b\u0008c\uD800d', labelA: 'x\uFFFEy' })
  assert.ok(!/[\u0001\u0008\uD800\uFFFE]/.test(svg))
  assert.match(svg, />abcd</)
})

test('a long title or nickname shrinks and is cut instead of running off the picture', () => {
  const long = '很長的標題'.repeat(8)
  const svg = renderSvg(range(), { title: long, labelA: '十六個字的暱稱十六個字的暱稱', labelB: 'B' })
  assert.match(svg, /class="title" style="font-size:3\dpx"/)
  assert.ok(svg.includes('\u2026'))
  assert.ok(!svg.includes(`>${long}<`))
  assert.match(renderSvg(range(), { title: 'Short' }), /class="title" style="font-size:60px">Short</)
})

test('an earlier end day does not claim to be the last days', () => {
  const earlier = selectRange(sampleAggregate(), { days: 30, end: '2026-06-30' })
  const svg = renderSvg(earlier, { lang: 'en' })
  assert.match(svg, /30 of 150 days in the export/)
  assert.ok(!svg.includes('The last'))
})
