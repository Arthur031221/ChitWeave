import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AggregateError, MAX_DAYS, checkAggregate, lastDay, selectRange, swapPeople, thickness } from '../src/core/aggregate.js'
import { sampleAggregate } from '../src/core/sample.js'

const row = (n) => new Array(24).fill(n)
const flat = (days, n = 0) => ({ version: 1, start: '2026-01-01', a: Array.from({ length: days }, () => row(n)), b: Array.from({ length: days }, () => row(0)) })

test('accepts the sample and the documented minimum', () => {
  assert.doesNotThrow(() => checkAggregate(sampleAggregate()))
  assert.doesNotThrow(() => checkAggregate(flat(1)))
})

test('names the problem when the data is not an aggregate', () => {
  const bad = (data, pattern) => assert.throws(() => checkAggregate(data), (e) => e instanceof AggregateError && pattern.test(e.message))
  bad(null, /object/)
  bad({ ...flat(2), version: 2 }, /version/)
  bad({ ...flat(2), start: '2026-02-30' }, /start/)
  bad({ ...flat(2), a: [] }, /"a"/)
  bad({ ...flat(2), b: [row(0)] }, /"b"/)
  bad({ ...flat(2), a: [row(0), row(1.5)] }, /24 whole numbers/)
  bad({ ...flat(2), a: [row(0), row(-1)] }, /24 whole numbers/)
  bad({ ...flat(2), a: [row(0), new Array(23).fill(0)] }, /24 whole numbers/)
})

test('shows the last 90 days of a longer file, ending on the last day', () => {
  const data = sampleAggregate()
  const range = selectRange(data)
  assert.equal(range.days, MAX_DAYS)
  assert.equal(range.end, lastDay(data))
  assert.equal(range.a.length, MAX_DAYS)
  assert.equal(range.totalDays, 150)
  assert.deepEqual(range.a.at(-1), data.a.at(-1))
})

test('a short file, a short request and an early end day', () => {
  assert.equal(selectRange(flat(20)).days, 20)
  assert.equal(selectRange(sampleAggregate(), { days: 30 }).days, 30)
  assert.equal(selectRange(sampleAggregate(), { days: 500 }).days, MAX_DAYS)
  const early = selectRange(sampleAggregate(), { days: 30, end: '2026-06-30' })
  assert.equal(early.end, '2026-06-30')
  assert.equal(early.start, '2026-06-01')
  assert.equal(selectRange(sampleAggregate(), { days: 30, end: '2020-01-01' }).days, 1)
  assert.equal(selectRange(sampleAggregate(), { end: '2030-01-01' }).end, lastDay(sampleAggregate()))
})

test('knows whether the range ends on the last day of the data', () => {
  assert.equal(selectRange(sampleAggregate()).latest, true)
  assert.equal(selectRange(sampleAggregate(), { end: '2026-06-30' }).latest, false)
})

test('the shared maximum covers both people and the totals add up', () => {
  const data = flat(3)
  data.a[1][5] = 4
  data.b[2][7] = 9
  const range = selectRange(data)
  assert.equal(range.max, 9)
  assert.equal(range.recordsA, 4)
  assert.equal(range.recordsB, 9)
  assert.equal(range.records, 13)
})

test('thickness is log scaled, zero stays absent and an empty range is handled', () => {
  assert.equal(thickness(0, 10), 0)
  assert.equal(thickness(5, 0), 0)
  assert.equal(thickness(10, 10), 1)
  assert.ok(Math.abs(thickness(3, 15) - Math.log(4) / Math.log(16)) < 1e-12)
  assert.ok(thickness(1, 100) > 0 && thickness(1, 100) < thickness(2, 100))
  assert.equal(selectRange(flat(5)).max, 0)
})

test('swapping people exchanges the two series', () => {
  const data = flat(2, 1)
  const swapped = swapPeople(data)
  assert.equal(swapped.a, data.b)
  assert.equal(swapped.b, data.a)
})
