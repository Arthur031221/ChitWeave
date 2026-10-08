import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { sampleAggregate } from '../src/core/sample.js'
import { parseLine } from '../src/core/parse.js'

const fixture = (name) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')
const hours = (entries) => Object.assign(new Array(24).fill(0), entries)

// Counted by hand from the lines below: two days, one silent day between them.
const EXCERPT = [
  '[LINE] 與Mika的聊天記錄',
  '儲存日期： 2026/10/05 08:10',
  '',
  '2026/10/01（四）',
  '上午12:05\tMika\t還沒睡',
  '上午12:06\tRen\t[貼圖]',
  '上午12:07\tRen\t"第一行',
  '第二行',
  '',
  '第四行"',
  '上午12:30\t\tRen 已收回訊息',
  '下午12:10\tMika\t午餐',
  '下午11:59\tRen\t晚安',
  '',
  '2026/10/02（五）',
  '2026/10/03（六）',
  '16:46\tMika\t[照片]',
  '',
].join('\n')

test('counts timestamped records per day, hour and person', () => {
  const r = parseLine(EXCERPT)
  assert.equal(r.ok, true)
  assert.deepEqual(r.senders, [{ name: 'Mika', records: 3 }, { name: 'Ren', records: 3 }])
  assert.equal(r.records, 6)
  assert.equal(r.systemLines, 1)
  assert.equal(r.start, '2026-10-01')
  assert.equal(r.end, '2026-10-03')
  assert.equal(r.days, 3)
  assert.deepEqual(r.a[0], hours({ 0: 1, 12: 1 }))
  assert.deepEqual(r.b[0], hours({ 0: 2, 23: 1 }))
  assert.deepEqual(r.a[1], hours({}))
  assert.deepEqual(r.b[1], hours({}))
  assert.deepEqual(r.a[2], hours({ 16: 1 }))
  assert.deepEqual(r.b[2], hours({}))
  assert.deepEqual(r.issues, [])
})

test('midnight and noon on a 12 hour clock', () => {
  const r = parseLine('2026/10/01（四）\n上午12:00\tA\tx\n下午12:00\tB\ty\n上午11:59\tA\tz\n下午11:59\tB\tw\n')
  assert.equal(r.a[0][0], 1)
  assert.equal(r.b[0][12], 1)
  assert.equal(r.a[0][11], 1)
  assert.equal(r.b[0][23], 1)
})

test('survives a byte order mark and Windows line endings', () => {
  const r = parseLine(`﻿${EXCERPT.replaceAll('\n', '\r\n')}`)
  assert.equal(r.ok, true)
  assert.equal(r.records, 6)
  assert.deepEqual(r.a[0], hours({ 0: 1, 12: 1 }))
})

test('reads dotted dates with an English weekday and the AM PM clock', () => {
  const r = parseLine('2026.10.01 Thursday\n11:59 PM\tA\tx\n12:05 AM\tB\ty\n')
  assert.equal(r.ok, true)
  assert.equal(r.a[0][23], 1)
  assert.equal(r.b[0][0], 1)
})

test('flags what it cannot trust, with line numbers, and counts nothing for it', () => {
  const text = [
    '上午09:00\tA\t在日期之前',
    '2026/10/01（五）',
    '上午09:00\tA\t星期錯了所以這天略過',
    '2026/10/02（五）',
    '25:00\tA\t時間不存在',
    '上午09:00\t',
    '上午09:01\tA\t好',
    '上午09:02\tB\t好',
    '2026/02/30（一）',
    '上午09:03\tA\t日期不存在所以略過',
    '',
  ].join('\n')
  const r = parseLine(text)
  assert.deepEqual(r.issues.map((i) => [i.line, i.code]), [
    [1, 'no_date_line'],
    [2, 'weekday_mismatch'],
    [3, 'no_date_line'],
    [5, 'bad_time'],
    [6, 'bad_record'],
    [9, 'bad_date'],
    [10, 'no_date_line'],
  ])
  assert.equal(r.records, 2)
  assert.equal(r.a[0][9], 1)
  assert.equal(r.b[0][9], 1)
})

test('rejects a group chat, a single sender and text that is not an export', () => {
  const group = '2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n09:02\tC\tz\n'
  assert.deepEqual(parseLine(group), { ok: false, error: 'too_many_senders', senders: 3, issues: [] })
  assert.equal(parseLine('2026/10/01（四）\n09:00\tA\tx\n').error, 'one_sender')
  assert.equal(parseLine('hello\nworld\n').error, 'not_line_export')
  assert.equal(parseLine('').error, 'not_line_export')
})

test('a line typed inside a message is not mistaken for a record', () => {
  const r = parseLine('2026/10/01（四）\n09:00\tA\t"開會\n10:30 再討論\n2026/10/01"\n09:05\tB\t好\n')
  assert.equal(r.records, 2)
  assert.deepEqual(r.issues, [])
})

test('the 12 hour fixture counts exactly the numbers it was made from', () => {
  const r = parseLine(fixture('sample-zh-hant-12h.chat'))
  const sample = sampleAggregate()
  assert.equal(r.ok, true)
  assert.equal(r.start, sample.start)
  assert.deepEqual(r.a, sample.a)
  assert.deepEqual(r.b, sample.b)
  assert.equal(r.issueCount, 0)
  assert.ok(r.systemLines > 0)
})

test('the 24 hour and dotted fixtures match the first 14 days', () => {
  const sample = sampleAggregate()
  for (const name of ['sample-24h-short.chat', 'sample-dotted-short.chat']) {
    const r = parseLine(fixture(name))
    assert.equal(r.issueCount, 0, name)
    // The first sender in the file is thread A, whoever that is.
    const [mine, theirs] = r.senders[0].name === 'Mika' ? [sample.a, sample.b] : [sample.b, sample.a]
    assert.deepEqual(r.a, mine.slice(0, r.days), name)
    assert.deepEqual(r.b, theirs.slice(0, r.days), name)
  }
})

test('a message in quotes is one record even when its lines look like records or dates', () => {
  const text = [
    '2026/10/01（四）',
    '09:00\tA\t"轉貼的對話',
    '10:30\tZ\t這行長得像紀錄',
    '2026/10/05（二）',
    '結束"',
    '09:05\tB\t好',
    '',
  ].join('\n')
  const r = parseLine(text)
  assert.equal(r.ok, true)
  assert.equal(r.records, 2)
  assert.equal(r.days, 1)
  assert.equal(r.senders.length, 2)
  assert.deepEqual(r.issues, [])
})

test('a quote that never closes ends at the next real date line and is reported', () => {
  const text = ['2026/10/01（四）', '09:00\tA\t"開頭', '09:01\tB\t被吃掉', '2026/10/02（五）', '09:05\tA\t好', '09:06\tB\t好', ''].join('\n')
  const r = parseLine(text)
  assert.equal(r.records, 3)
  assert.deepEqual(r.issues, [{ line: 2, code: 'unclosed_quote' }])
})

test('a quote in the middle of a line, or a closed one, opens nothing', () => {
  const r = parseLine('2026/10/01（四）\n09:00\tA\t他說"好\n09:01\tB\t"好"\n09:02\tA\t"a ""b"" c"\n09:03\tB\tok\n')
  assert.equal(r.records, 4)
  assert.deepEqual(r.issues, [])
})

test('a date line in a layout it does not read stops counting instead of reusing the day before', () => {
  for (const header of ['2026/10/02', '2026-10-02（五）', '2026/10/02 (banana)', '2026.10.02 Fryday']) {
    const r = parseLine(`2026/10/01（四）\n09:00\tA\t一\n09:01\tB\t一\n${header}\n09:02\tB\t二\n09:03\tA\t三\n`)
    assert.equal(r.records, 2, header)
    assert.equal(r.issues[0].code, 'unsupported_date', header)
    assert.equal(r.issues[0].line, 4, header)
  }
})

test('years outside 2000 to 2100 are not dates, so a tiny file cannot ask for a huge table', () => {
  const r = parseLine('0100/01/01（五）\n09:00\tA\tx\n9999/01/01（五）\n09:00\tB\ty\n')
  assert.deepEqual(r.issues.map((i) => i.code), ['bad_date', 'no_date_line', 'bad_date', 'no_date_line'])
  assert.equal(r.error, 'not_line_export')
})

test('clock values that cannot be read are reported, not dropped or guessed', () => {
  const text = ['2026/10/01（四）', '00:00 AM\tA\tx', '上午01:00 PM\tA\tx', '9:1\tA\tx', '13:00 PM\tA\tx', '下午12:30\tA\tok', '09:00\tB\tok', ''].join('\n')
  const r = parseLine(text)
  assert.deepEqual(r.issues.map((i) => [i.line, i.code]), [[2, 'bad_time'], [3, 'bad_time'], [4, 'bad_time'], [5, 'bad_time']])
  assert.equal(r.records, 2)
})

test('notices with or without a sender field are skipped, calls with a sender count', () => {
  const text = ['2026/10/01（四）', '09:00\tA\t好', '09:02\t您已收回訊息', '09:03\t\tB 已收回訊息', '09:04\tB\t☎ 通話時間 1:05', '09:05\tB\t☎ 未接來電', ''].join('\n')
  const r = parseLine(text)
  assert.equal(r.records, 3)
  assert.equal(r.systemLines, 2)
  assert.deepEqual(r.issues, [])
})

test('group chats are refused by their header, even when only two people wrote', () => {
  assert.equal(parseLine('[LINE] 週末爬山團的聊天記錄\n\n2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n').error, 'group_chat')
  assert.equal(parseLine('[LINE] Chat history in Hiking\n\n2026.10.01 Thursday\n09:00\tA\tx\n09:01\tB\ty\n').error, 'group_chat')
  assert.equal(parseLine('[LINE] 與小明的聊天記錄\n\n2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n').ok, true)
})

test('a cell with more than 100,000 records is refused, not thrown', () => {
  const lines = ['2026/10/01（四）']
  for (let i = 0; i < 100_001; i += 1) lines.push('09:00\tA\tx')
  lines.push('09:00\tB\ty')
  assert.equal(parseLine(lines.join('\n')).error, 'too_dense')
})

test('weekday names are exact, so an invented one is not a date', () => {
  const r = parseLine('2026/10/01 Thursday\n09:00\tA\tx\n09:01\tB\ty\n2026/10/02 Fridayish\n09:02\tA\tz\n')
  assert.equal(r.records, 2)
  assert.equal(r.issues[0].code, 'unsupported_date')
})

test('a day first or month first numeric date is reported, not read as the day before', () => {
  for (const header of ['02/10/2026 Fri', '10/02/2026 (Fri)', '02.10.2026']) {
    const r = parseLine(`2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n${header}\n09:02\tA\tz\n`)
    assert.equal(r.records, 2, header)
    assert.equal(r.issues[0].code, 'unsupported_date', header)
  }
})

test('a narrow no-break space before PM is read, and an absurd clock is reported', () => {
  const r = parseLine('2026.10.01 Thursday\n9:02\u202fPM\tA\tx\n9:03\u00a0PM\tB\ty\n100:00\tA\tz\n')
  assert.equal(r.records, 2)
  assert.equal(r.a[0][21], 1)
  assert.deepEqual(r.issues, [{ line: 4, code: 'bad_time' }])
})

test('the quote state follows a message that is skipped for lack of a trusted date', () => {
  const text = ['2026/10/01（四）', '09:00\tA\tx', '09:01\tB\ty', '2026-10-02（五）', '09:02\tA\t"pasted', '10:00\tB\tinside the quote', 'end"', '2026/10/03（六）', '09:04\tB\tactual', ''].join('\n')
  const r = parseLine(text)
  assert.equal(r.records, 3)
  assert.equal(r.b[2][9], 1)
})

test('a title with a line separator inside it is still a group header', () => {
  assert.equal(parseLine('[LINE] Team\u2028chat的聊天記錄\n2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n').error, 'group_chat')
})

test('a line made of millions of tabs does not blow up', () => {
  const r = parseLine(`2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n09:02\tA\t${'\t'.repeat(3_000_000)}\n`)
  assert.equal(r.records, 3)
})
