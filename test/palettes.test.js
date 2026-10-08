import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PALETTES, contrast, mix } from '../src/core/palettes.js'

test('threads and text read against the ground', () => {
  for (const [id, p] of Object.entries(PALETTES)) {
    assert.ok(contrast(p.a, p.ground) >= 3, `${id}: thread a`)
    assert.ok(contrast(p.b, p.ground) >= 3, `${id}: thread b`)
    assert.ok(contrast(p.ink, p.ground) >= 7, `${id}: ink`)
    assert.ok(contrast(p.soft, p.ground) >= 3, `${id}: soft text`)
    assert.ok(contrast(p.a, p.b) >= 1.5, `${id}: the two threads differ`)
  }
})

test('mix blends two colors', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(mix('#102030', '#102030', 0.7), '#102030')
})
