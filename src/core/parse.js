// Reads the text file that LINE's "Export chat" produces and keeps only counts.
// Message text and sender names are read to find the structure and then thrown
// away, apart from the two sender names, which the caller may show on screen.
//
// Layout handled (see docs/LINE_FORMATS.md):
//   [LINE] 與Name的聊天記錄            header, optional
//   儲存日期：2020/02/12 02:42         header, optional
//   2017/11/20（一）                   date line: date plus a weekday
//   下午04:46<TAB>Name<TAB>text        record: time, sender, text
//   16:46<TAB>Name<TAB>text            24 hour clock
//   04:46<TAB><TAB>text                notice with an empty sender, skipped
//   04:46<TAB>text                     notice without a sender field, skipped
// A line that starts no record belongs to the message above it (multi-line
// messages) and is not counted. A message whose text opens a double quote that
// is not closed on the same line runs until the quote closes, so the lines
// inside it are never read as dates or records.

import { addDays, daysBetween, isoOf, parseIso, weekdayOf } from './dates.js'
import { MAX_COUNT } from './aggregate.js'

const DATE_LINE = /^(\d{4})[./](\d{1,2})[./](\d{1,2})(?:\s*[（(]\s*([^\s）)]+)\s*[）)]|\s+(\S+))\s*$/
// A line that is only a date and something weekday-shaped, in a layout we do not read.
const DATE_LIKE = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})(?:\s*[（(][^）)]{1,12}[）)]|\s+\S{1,12})?\s*$/
// Newer phones put a narrow no-break space before AM and PM.
const GAP = '[ \\u00a0\\u202f]?'
const TIME_LEAD = new RegExp(`^(上午|下午|午前|午後)?${GAP}(\\d{1,2}):(\\d{2})${GAP}([AaPp][Mm])?\\t`)
const TIME_LIKE = new RegExp(`^(?:上午|下午|午前|午後)?${GAP}\\d{1,3}:\\d+${GAP}(?:[AaPp][Mm])?\\t`)
const MIN_YEAR = 2000
const MAX_YEAR = 2100
const MAX_ISSUES = 50

const WEEKDAYS = {
  日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
}

// The weekday a token names, or null when it is not one we know.
function weekdayFromToken(token) {
  const bare = token.replace(/^(星期|週|周)/, '').toLowerCase()
  return Object.hasOwn(WEEKDAYS, bare) ? WEEKDAYS[bare] : null
}

// Hour 0 to 23 from either clock, or null when the time cannot be real.
function hourOf(prefix, shown, suffix) {
  const pm = prefix === '下午' || prefix === '午後' || /^p/i.test(suffix ?? '')
  const am = prefix === '上午' || prefix === '午前' || /^a/i.test(suffix ?? '')
  if (pm && am) return null
  if (pm || am) return shown >= 1 && shown <= 12 ? (shown % 12) + (pm ? 12 : 0) : null
  return shown <= 23 ? shown : null
}

function quotes(text) {
  let n = 0
  for (let i = text.indexOf('"'); i !== -1; i = text.indexOf('"', i + 1)) n += 1
  return n
}
const emptyDay = () => [new Array(24).fill(0), new Array(24).fill(0)]

// A group chat names the group, with no "with" marker in front of the title.
function isGroupHeader(line) {
  return /^\[LINE\] (?!與).+的聊天記錄$/s.test(line) || /^(?:\[LINE\] )?Chat history in /.test(line)
}

/**
 * @param {string} text the contents of a LINE chat export
 * @returns {{ok: true, senders: {name: string, records: number}[], records: number,
 *   systemLines: number, start: string, end: string, days: number,
 *   a: number[][], b: number[][], issues: {line: number, code: string}[], issueCount: number}
 *   | {ok: false, error: string, senders?: number, issues: {line: number, code: string}[]}}
 */
export function parseLine(text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/)
  const issues = []
  let issueCount = 0
  const flag = (line, code) => {
    issueCount += 1
    if (issues.length < MAX_ISSUES) issues.push({ line, code })
  }
  const first = lines.find((line) => line.trim() !== '') ?? ''
  if (isGroupHeader(first)) return { ok: false, error: 'group_chat', issues }

  const perDay = new Map()
  const senderIndex = new Map()
  const counts = [0, 0]
  let day = null
  let systemLines = 0
  let openQuote = 0

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const lineNo = i + 1
    const dateMatch = DATE_LINE.exec(line)
    const weekday = dateMatch ? weekdayFromToken(dateMatch[4] ?? dateMatch[5]) : null
    const year = dateMatch ? Number(dateMatch[1]) : 0
    const iso = weekday === null ? null : isoOf(year, Number(dateMatch[2]), Number(dateMatch[3]))
    const real = iso !== null && parseIso(iso) !== null && year >= MIN_YEAR && year <= MAX_YEAR && weekday === weekdayOf(iso)

    if (openQuote) {
      // A real date line ends a quote that never closed, so one stray quote
      // cannot swallow the rest of the file.
      if (!real) {
        if (quotes(line) % 2 === 1) openQuote = 0
        continue
      }
      flag(openQuote, 'unclosed_quote')
      openQuote = 0
    }

    if (weekday !== null || DATE_LIKE.test(line)) {
      if (weekday === null) {
        flag(lineNo, 'unsupported_date')
      } else if (parseIso(iso) === null || year < MIN_YEAR || year > MAX_YEAR) {
        flag(lineNo, 'bad_date')
      } else if (!real) {
        // Records under a date we cannot trust are left out, not guessed.
        flag(lineNo, 'weekday_mismatch')
      }
      day = real ? iso : null
      if (real && !perDay.has(iso)) perDay.set(iso, emptyDay())
      continue
    }

    const lead = TIME_LEAD.exec(line)
    if (!lead) {
      if (TIME_LIKE.test(line)) flag(lineNo, 'bad_time')
      continue
    }
    const hour = hourOf(lead[1], Number(lead[2]), lead[4])
    if (hour === null || Number(lead[3]) > 59) {
      flag(lineNo, 'bad_time')
      continue
    }
    const rest = line.slice(lead[0].length)
    if (rest === '') {
      flag(lineNo, 'bad_record')
      continue
    }
    const cut = rest.indexOf('\t')
    const sender = cut === -1 ? '' : rest.slice(0, cut)
    if (sender === '') {
      systemLines += 1
      continue
    }
    // Quote state follows every message, counted or not, so a skipped one
    // cannot leave its quoted lines to be read as records.
    const body = rest.slice(cut + 1)
    if (body.startsWith('"') && quotes(body) % 2 === 1) openQuote = lineNo
    if (day === null) {
      flag(lineNo, 'no_date_line')
      continue
    }
    if (!senderIndex.has(sender)) {
      if (senderIndex.size === 2) return { ok: false, error: 'too_many_senders', senders: 3, issues }
      senderIndex.set(sender, senderIndex.size)
    }
    const who = senderIndex.get(sender)
    const cell = perDay.get(day)[who]
    cell[hour] += 1
    counts[who] += 1
    if (cell[hour] > MAX_COUNT) return { ok: false, error: 'too_dense', issues }
  }
  if (openQuote) flag(openQuote, 'unclosed_quote')

  if (counts[0] + counts[1] === 0) return { ok: false, error: 'not_line_export', issues }
  if (senderIndex.size < 2) return { ok: false, error: 'one_sender', issues }

  const isos = [...perDay.keys()].sort()
  const start = isos[0]
  const end = isos[isos.length - 1]
  const span = daysBetween(start, end) + 1
  const a = []
  const b = []
  for (let k = 0; k < span; k += 1) {
    const [rowA, rowB] = perDay.get(addDays(start, k)) ?? emptyDay()
    a.push(rowA)
    b.push(rowB)
  }
  return {
    ok: true,
    senders: [...senderIndex.keys()].map((name, k) => ({ name, records: counts[k] })),
    records: counts[0] + counts[1],
    systemLines,
    start,
    end,
    days: span,
    a,
    b,
    issues,
    issueCount,
  }
}
