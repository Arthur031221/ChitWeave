// A made-up two-person chat, generated from a fixed seed so it is the same on
// every machine. Person A is a night owl, person B keeps office hours. Nothing
// here comes from a real conversation.

import { addDays, weekdayOf } from './dates.js'
import { makeAggregate } from './aggregate.js'

export const SAMPLE_START = '2026-05-08'
export const SAMPLE_DAYS = 150

export function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Expected messages per hour for a weekday and a weekend day, per person.
const rhythm = {
  a: { week: [3, 1.5, .4, 0, 0, 0, 0, .2, .6, .8, 1, 1.2, 3, 2, 1, 1, 1, 1.2, 2, 2.5, 3.5, 5, 7, 6], end: [5, 3, 1, .2, 0, 0, 0, 0, .3, .8, 2, 3, 3, 3, 3.5, 3, 2.5, 2.5, 3, 3.5, 4, 5, 7, 6] },
  b: { week: [1.5, .3, 0, 0, 0, 0, .2, 1.5, 4, 2, 1.5, 1.8, 4, 3, 1.2, 1, 1.2, 1.5, 3.5, 3, 3, 3.5, 4, 3], end: [3, 1, 0, 0, 0, 0, 0, 0, .3, 1, 3, 4, 3.5, 3, 4, 4, 3, 3, 3, 3.5, 4, 4, 4, 3.5] },
}

function poisson(rand, lambda) {
  if (lambda <= 0) return 0
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k += 1
    p *= rand()
  } while (p > limit)
  return k - 1
}

export function sampleAggregate() {
  const rand = mulberry32(20261008)
  const a = []
  const b = []
  for (let d = 0; d < SAMPLE_DAYS; d += 1) {
    const iso = addDays(SAMPLE_START, d)
    const weekend = [0, 6].includes(weekdayOf(iso))
    // Two silent days, a trip with a flood of photos, and a slow weekly swell.
    const quiet = d === 37 || d === 38 || d === 101
    const trip = d >= 119 && d <= 121
    const swell = 0.85 + 0.3 * Math.sin((d / 7) * Math.PI * 0.9)
    const day = quiet ? 0 : (trip ? 3 : 1) * swell
    const row = (who) => {
      const shape = weekend ? rhythm[who].end : rhythm[who].week
      return shape.map((mean) => Math.min(60, poisson(rand, mean * day)))
    }
    a.push(row('a'))
    b.push(row('b'))
  }
  return makeAggregate({ start: SAMPLE_START, a, b })
}
