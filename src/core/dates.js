// Calendar math on ISO dates (YYYY-MM-DD). Everything goes through UTC so a
// daylight saving change never shifts a day.

const DAY_MS = 86_400_000

export const pad = (n) => String(n).padStart(2, '0')

export function isoOf(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

export function parseIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = Date.UTC(year, month - 1, day)
  const d = new Date(t)
  const real = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  return real ? t : null
}

export const isValidIso = (iso) => typeof iso === 'string' && parseIso(iso) !== null

export function addDays(iso, n) {
  const d = new Date(parseIso(iso) + n * DAY_MS)
  return isoOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

export const daysBetween = (fromIso, toIso) => Math.round((parseIso(toIso) - parseIso(fromIso)) / DAY_MS)

// 0 is Sunday, like Date.getUTCDay.
export const weekdayOf = (iso) => new Date(parseIso(iso)).getUTCDay()

export function monthDay(iso) {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}
