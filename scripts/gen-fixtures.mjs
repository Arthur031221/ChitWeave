// Writes the synthetic fixtures: a LINE style export and the aggregate it was
// made from. The numbers come from src/core/sample.js, so the parser tests can
// compare counting the text against the counts that produced it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addDays, weekdayOf } from '../src/core/dates.js'
import { mulberry32, sampleAggregate } from '../src/core/sample.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = (name, text) => writeFileSync(resolve(root, 'fixtures', name), text)
mkdirSync(resolve(root, 'fixtures'), { recursive: true })

const NAMES = ['Mika', 'Ren']
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WEEK_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const PHRASES = ['好喔', '等一下', '哈哈哈', '[貼圖]', '[照片]', '我到了', '晚點說', '在忙嗎', '[貼圖]', '收到', '那就這樣', '[語音訊息]']
const pad = (n) => String(n).padStart(2, '0')

const STYLES = {
  // Android, Traditional Chinese: 12 hour clock with a day part, slashes, weekday in brackets.
  twelve: {
    date: (iso) => `${iso.replaceAll('-', '/')}（${WEEK_ZH[weekdayOf(iso)]}）`,
    time: (h, m) => `${h < 12 ? '上午' : '下午'}${pad(h % 12 || 12)}:${pad(m)}`,
  },
  // 24 hour clock, same date line.
  twentyFour: {
    date: (iso) => `${iso.replaceAll('-', '/')}（${WEEK_ZH[weekdayOf(iso)]}）`,
    time: (h, m) => `${pad(h)}:${pad(m)}`,
  },
  // Dotted date with an English weekday and a 24 hour clock.
  dotted: {
    date: (iso) => `${iso.replaceAll('-', '.')} ${WEEK_EN[weekdayOf(iso)]}`,
    time: (h, m) => `${pad(h)}:${pad(m)}`,
  },
}

function exportText(data, style, from, to, seed) {
  const rand = mulberry32(seed)
  const lines = ['﻿[LINE] 與Mika的聊天記錄', '儲存日期： 2026/10/05 08:10', '']
  for (let d = from; d < to; d += 1) {
    const iso = addDays(data.start, d)
    lines.push(style.date(iso))
    const records = []
    for (let h = 0; h < 24; h += 1) {
      for (const [who, rows] of [[0, data.a], [1, data.b]]) {
        for (let k = 0; k < rows[d][h]; k += 1) records.push([h, Math.floor(rand() * 60), who])
      }
    }
    records.sort((x, y) => x[0] - y[0] || x[1] - y[1])
    for (const [h, m, who] of records) {
      const roll = rand()
      // A few messages span lines, as LINE writes them: wrapped in quotes.
      const text = roll < 0.03 ? `"${PHRASES[Math.floor(rand() * PHRASES.length)]}\n${PHRASES[Math.floor(rand() * PHRASES.length)]}"` : PHRASES[Math.floor(rand() * PHRASES.length)]
      lines.push(`${style.time(h, m)}\t${NAMES[who]}\t${text}`)
      if (roll > 0.995) lines.push(`${style.time(h, m)}\t\t${NAMES[who]} 已收回訊息`)
    }
  }
  return `${lines.join('\n')}\n`
}

const data = sampleAggregate()
out('sample.weave.json', `${JSON.stringify({ version: 1, start: data.start, a: data.a, b: data.b })}\n`)
out('sample-zh-hant-12h.chat', exportText(data, STYLES.twelve, 0, data.a.length, 11))
out('sample-24h-short.chat', exportText(data, STYLES.twentyFour, 0, 14, 12))
out('sample-dotted-short.chat', exportText(data, STYLES.dotted, 0, 14, 13))
console.log('fixtures written')
