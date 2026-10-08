// The aggregate format (docs/AGGREGATE_FORMAT.md): per day and per hour message
// counts for two people. It is all the renderer ever sees.

import { addDays, daysBetween, isValidIso } from './dates.js'

export const MAX_DAYS = 90
export const MAX_COUNT = 100_000

export class AggregateError extends Error {}

function checkMatrix(name, rows, length) {
  if (!Array.isArray(rows) || rows.length !== length) throw new AggregateError(`"${name}" must have one row per day`)
  for (const row of rows) {
    const ok = Array.isArray(row) && row.length === 24 && row.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_COUNT)
    if (!ok) throw new AggregateError(`every row of "${name}" must be 24 whole numbers from 0 to ${MAX_COUNT}`)
  }
}

/** Returns the same object when it is a valid aggregate, otherwise throws AggregateError. */
export function checkAggregate(data) {
  if (data === null || typeof data !== 'object') throw new AggregateError('aggregate must be an object')
  if (data.version !== 1) throw new AggregateError('unsupported "version", expected 1')
  if (!isValidIso(data.start)) throw new AggregateError('"start" must be a date like 2026-07-12')
  if (!Array.isArray(data.a) || data.a.length === 0) throw new AggregateError('"a" must list at least one day')
  checkMatrix('a', data.a, data.a.length)
  checkMatrix('b', data.b, data.a.length)
  return data
}

export function makeAggregate({ start, a, b }) {
  return checkAggregate({ version: 1, start, a, b })
}

export const lastDay = (data) => addDays(data.start, data.a.length - 1)

const sum = (rows) => rows.reduce((total, row) => total + row.reduce((x, y) => x + y, 0), 0)

/**
 * The window the weave shows: `days` calendar days ending on `end` (default the
 * last day in the data), clipped to the days the data has.
 */
export function selectRange(data, { days = MAX_DAYS, end = lastDay(data) } = {}) {
  const wanted = Math.min(Math.max(Math.trunc(days), 1), MAX_DAYS)
  const finalDay = lastDay(data)
  const last = end > finalDay ? finalDay : end < data.start ? data.start : end
  const stop = daysBetween(data.start, last) + 1
  const first = Math.max(0, stop - wanted)
  const a = data.a.slice(first, stop)
  const b = data.b.slice(first, stop)
  const cells = [...a, ...b].flat()
  return {
    start: addDays(data.start, first),
    end: last,
    days: stop - first,
    totalDays: data.a.length,
    // False when the user picked an earlier end day, so captions do not say "last".
    latest: last === finalDay,
    a,
    b,
    max: Math.max(0, ...cells),
    records: sum(a) + sum(b),
    recordsA: sum(a),
    recordsB: sum(b),
  }
}

/** Swaps who is A and who is B. */
export const swapPeople = (data) => ({ ...data, a: data.b, b: data.a })

/** Thread thickness between 0 and 1: log scaled against the busiest cell of either person. */
export function thickness(count, max) {
  if (count <= 0 || max <= 0) return 0
  return Math.log1p(count) / Math.log1p(max)
}
