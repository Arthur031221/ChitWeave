// Draws the keepsake as an SVG string. Deterministic: the same inputs give the
// same bytes, so the browser, the CLI and the tests all see one picture.

import { DEFAULT_PALETTE, PALETTES, mix } from './palettes.js'
import { poster } from './i18n.js'
import { buildLayout, POSTER, threadSize } from './layout.js'

const SANS = "'Noto Sans TC','PingFang TC','Microsoft JhengHei','Heiti TC',system-ui,-apple-system,'Segoe UI',sans-serif"

// Characters XML 1.0 cannot carry are dropped before escaping, or the file would not load as an image.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export const escapeXml = (s) =>
  String(s)
    .replace(INVALID_XML, '')
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Rough text width in px: wide characters take a full em, the rest about half.
const textWidth = (text, size) => [...text].reduce((w, c) => w + (c.codePointAt(0) >= 0x2e80 ? 1 : 0.58) * size, 0)

// Shrinks text down to `min` px, then cuts it with an ellipsis, so a long
// title or nickname stays inside its space.
function fit(text, maxWidth, size, min) {
  let px = size
  while (px > min && textWidth(text, px) > maxWidth) px -= 1
  let shown = [...text]
  while (shown.length > 1 && textWidth(shown.join(''), px) > maxWidth) shown = shown.slice(0, -1)
  const cut = shown.length < [...text].length
  const out = cut ? `${shown.slice(0, -1).join('')}\u2026` : text
  return { text: out, size: px, width: textWidth(out, px) }
}

const num = (n) => Number(n.toFixed(2))
const dotted = (iso) => iso.replaceAll('-', '.')

function rect(r, extra = '') {
  return `<rect x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}"${extra}/>`
}

function thread(box, side, aOver, ground) {
  const fill = side === 'a' ? 'url(#ga)' : 'url(#gb)'
  const lying = aOver === (side === 'a')
  if (!lying) return rect(box, ` fill="${fill}"`)
  // A thin dark edge under the thread on top shows which one is above.
  const edge = side === 'a' ? { x: box.x, y: box.y - 0.8, w: box.w, h: box.h + 1.6 } : { x: box.x - 0.8, y: box.y, w: box.w + 1.6, h: box.h }
  return `${rect(edge, ` fill="${ground}" fill-opacity=".55"`)}${rect(box, ` fill="${fill}"`)}`
}

function rowMarkup(row, ground) {
  const parts = []
  for (const cell of row.cells) {
    const first = cell.aOver ? 'b' : 'a'
    const second = cell.aOver ? 'a' : 'b'
    for (const side of [first, second]) {
      if (cell[side]) parts.push(thread(cell[side], side, cell.aOver, ground))
    }
  }
  return `<g class="row" data-row="${row.index}" style="--i:${row.index}">${parts.join('')}</g>`
}

function gradients(p) {
  const shade = (c) => `<stop offset="0" stop-color="${mix(c, '#ffffff', 0.22)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, '#000000', 0.2)}"/>`
  return `<linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">${shade(p.a)}</linearGradient>` +
    `<linearGradient id="gb" x1="0" y1="0" x2="1" y2="0">${shade(p.b)}</linearGradient>`
}

function legend(layout, range, p, t, labelA, labelB) {
  const room = 206
  const y = POSTER.gridBottom + 64
  const x0 = POSTER.margin
  const nameA = fit(labelA, room, 26, 16)
  const nameB = fit(labelB, room, 26, 16)
  const keyA = `<rect x="${x0}" y="${y - 7}" width="46" height="14" rx="2" fill="url(#ga)"/>` +
    `<text x="${x0 + 58}" y="${y + 6}" class="label" style="font-size:${nameA.size}px">${escapeXml(nameA.text)}</text>`
  const bx = x0 + 58 + Math.ceil(nameA.width) + 36
  const keyB = `<rect x="${bx}" y="${y - 20}" width="14" height="40" rx="2" fill="url(#gb)"/>` +
    `<text x="${bx + 26}" y="${y + 6}" class="label" style="font-size:${nameB.size}px">${escapeXml(nameB.text)}</text>`

  const steps = range.max > 0 ? [...new Set([1, Math.max(1, Math.round(Math.sqrt(range.max))), range.max])] : []
  const cap = Math.min(18, layout.grid.cap * 2)
  let sx = POSTER.width - POSTER.margin
  const scale = []
  for (const count of [...steps].reverse()) {
    const w = String(count).length * 13 + 40
    sx -= w
    const size = threadSize(count, range.max, cap)
    scale.push(`<rect x="${sx}" y="${y - size / 2}" width="26" height="${num(size)}" fill="url(#ga)"/><text x="${sx + 32}" y="${y + 6}" class="small">${count}</text>`)
  }
  const caption = steps.length
    ? `<text x="${sx - 14}" y="${y + 6}" text-anchor="end" class="small soft">${escapeXml(t.scale)}</text>`
    : ''
  return keyA + keyB + scale.join('') + caption
}

/**
 * @param {ReturnType<import('./aggregate.js').selectRange>} range
 * @param {{palette?: string, title?: string, labelA?: string, labelB?: string, lang?: 'zh'|'en', layout?: object}} [opts]
 * `layout` lets a caller that already built the layout skip building it again.
 */
export function renderSvg(range, opts = {}) {
  const lang = opts.lang ?? 'zh'
  const t = poster[lang]
  const p = PALETTES[opts.palette] ?? PALETTES[DEFAULT_PALETTE]
  const title = opts.title?.trim() || t.title
  const labelA = opts.labelA?.trim() || 'A'
  const labelB = opts.labelB?.trim() || 'B'
  const layout = opts.layout ?? buildLayout(range)
  const { grid } = layout

  const rows = layout.rows.map((row) => rowMarkup(row, p.ground)).join('')
  const hourLabels = layout.panels
    .flatMap((panel) => panel.hourTicks)
    .map((h) => `<text x="${num(h.x)}" y="${grid.y - 14}" text-anchor="middle" class="small soft">${escapeXml(t.hours(h.hour))}</text>`)
    .join('')
  const dayLabels = layout.rowLabels
    .map((l) => `<text x="${num(layout.panels[l.panel].x - 10)}" y="${num(l.y + 5)}" text-anchor="end" class="tiny soft">${l.text}</text>`)
    .join('')
  const empty = range.records === 0
    ? `<text x="${POSTER.width / 2}" y="${(grid.y + grid.h / 2)}" text-anchor="middle" class="label soft">${escapeXml(t.empty)}</text>`
    : ''
  let coverage = t.coverageAll(range.records, range.totalDays)
  if (range.days !== range.totalDays) {
    coverage = (range.latest ? t.coverage : t.coverageEarlier)(range.records, range.days, range.totalDays)
  }
  const heading = fit(title, POSTER.width - 2 * POSTER.margin, 60, 32)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${POSTER.width} ${POSTER.height}" width="${POSTER.width}" height="${POSTER.height}" role="img" aria-label="${escapeXml(title)}">` +
    `<style>text{font-family:${SANS};fill:${p.ink}}.title{font-size:60px;font-weight:700;letter-spacing:-.5px}.label{font-size:26px;font-weight:600}.small{font-size:20px}.tiny{font-size:15px;font-variant-numeric:tabular-nums}.soft{fill:${p.soft}}</style>` +
    `<defs>${gradients(p)}</defs>` +
    `<rect width="${POSTER.width}" height="${POSTER.height}" fill="${p.ground}"/>` +
    `<text x="${POSTER.margin}" y="140" class="title" style="font-size:${heading.size}px">${escapeXml(heading.text)}</text>` +
    `<text x="${POSTER.margin}" y="188" class="small soft">${escapeXml(t.span(dotted(range.start), dotted(range.end), range.days))}</text>` +
    `<text x="${POSTER.margin}" y="226" class="small soft">${escapeXml(t.rowsAreDays)}</text>` +
    `${hourLabels}${dayLabels}<g id="cloth">${rows}</g>${empty}` +
    legend(layout, range, p, t, labelA, labelB) +
    `<text x="${POSTER.margin}" y="${POSTER.height - 78}" class="small">${escapeXml(coverage)}</text>` +
    `<text x="${POSTER.margin}" y="${POSTER.height - 46}" class="tiny soft">${escapeXml(t.blank)}</text>` +
    `<text x="${POSTER.width - POSTER.margin}" y="${POSTER.height - 46}" text-anchor="end" class="tiny soft">ChitWeave</text>` +
    `</svg>`
}
