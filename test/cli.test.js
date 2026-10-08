import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { sampleAggregate } from '../src/core/sample.js'

const bin = new URL('../bin/chitweave.js', import.meta.url).pathname
const fixture = (name) => new URL(`../fixtures/${name}`, import.meta.url).pathname
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' })
const scratch = () => mkdtempSync(join(tmpdir(), 'chitweave-'))

test('weaves an export into an SVG without the sender names', () => {
  const out = join(scratch(), 'weave.svg')
  const r = run(fixture('sample-zh-hant-12h.chat'), '-o', out, '--palette', 'sage', '--title', 'Test')
  assert.equal(r.status, 0, r.stderr)
  const svg = readFileSync(out, 'utf8')
  assert.ok(svg.startsWith('<svg'))
  assert.ok(!svg.includes('Mika') && !svg.includes('Ren'))
  assert.match(r.stderr, /7,969 records/)
})

test('--json writes the aggregate, and an aggregate renders the same picture', () => {
  const dir = scratch()
  const json = join(dir, 'a.json')
  assert.equal(run(fixture('sample-zh-hant-12h.chat'), '--json', '-o', json).status, 0)
  const data = JSON.parse(readFileSync(json, 'utf8'))
  assert.equal(data.version, 1)
  assert.deepEqual(data.a, sampleAggregate().a)
  const fromText = join(dir, 'x.svg')
  const fromJson = join(dir, 'y.svg')
  run(fixture('sample-zh-hant-12h.chat'), '-o', fromText)
  run(json, '-o', fromJson)
  assert.equal(readFileSync(fromText, 'utf8'), readFileSync(fromJson, 'utf8'))
})

test('refuses what it cannot read, with a reason and a non zero exit', () => {
  const dir = scratch()
  const group = join(dir, 'group.txt')
  writeFileSync(group, '2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n09:02\tC\tz\n')
  const r = run(group)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /3 senders/)
  const junk = join(dir, 'junk.txt')
  writeFileSync(junk, 'not a chat\n')
  assert.equal(run(junk).status, 1)
  assert.equal(run(join(dir, 'missing.txt')).status, 1)
  const bad = join(dir, 'bad.json')
  writeFileSync(bad, '{"version":1}')
  assert.match(run(bad).stderr, /start/)
})

test('checks its options', () => {
  const f = fixture('sample-24h-short.chat')
  assert.equal(run(f, '--days', '0').status, 1)
  assert.equal(run(f, '--days', '91').status, 1)
  assert.equal(run(f, '--palette', 'neon').status, 1)
  assert.equal(run(f, '--end', '2026-13-01').status, 1)
  assert.equal(run(f, '--lang', 'fr').status, 1)
  assert.equal(run(f, '--nope').status, 1)
  const help = run('--help')
  assert.equal(help.status, 0)
  assert.match(help.stdout, /Usage: chitweave/)
})

test('--sample needs no input file', () => {
  const out = join(scratch(), 'sample.svg')
  const r = run('--sample', '-o', out, '--lang', 'en')
  assert.equal(r.status, 0, r.stderr)
  assert.match(readFileSync(out, 'utf8'), /Our weave/)
  assert.equal(run('--sample', fixture('sample-24h-short.chat')).status, 1)
})
