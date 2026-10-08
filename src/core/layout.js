// Geometry of the keepsake. Pure numbers: no strings, no drawing. The same
// layout feeds the on-screen preview and the saved picture.

import { monthDay, addDays, weekdayOf } from './dates.js'
import { thickness } from './aggregate.js'

export const POSTER = {
  width: 1080,
  height: 1350,
  margin: 72,
  gridTop: 300,
  gridBottom: 1096,
  panelGap: 30,
  hourTicks: [0, 6, 12, 18],
}

// A month fits one panel. More days are folded into two side by side, so the
// cells stay close to square and the threads stay big enough to read as cloth.
const ONE_PANEL_DAYS = 31

const MIN_SHARE = 0.2

/** Thread thickness in pixels for a count, never thinner than a visible line. */
export function threadSize(count, max, cap) {
  const t = thickness(count, max)
  if (t === 0) return 0
  return Math.max(1.5, cap * (MIN_SHARE + (1 - MIN_SHARE) * t))
}

/**
 * @param {ReturnType<import('./aggregate.js').selectRange>} range
 */
export function buildLayout(range) {
  const panelCount = range.days > ONE_PANEL_DAYS ? 2 : 1
  const perPanel = Math.ceil(range.days / panelCount)
  const gutter = panelCount === 1 ? 58 : 46
  const panelW = (POSTER.width - 2 * POSTER.margin - POSTER.panelGap * (panelCount - 1)) / panelCount
  const cellW = (panelW - gutter) / 24
  const rowH = Math.min((POSTER.gridBottom - POSTER.gridTop) / perPanel, cellW * 1.5)
  const cap = 0.9 * Math.min(cellW, rowH)
  const panelX = (p) => POSTER.margin + p * (panelW + POSTER.panelGap) + gutter

  const date = (r) => addDays(range.start, r)
  const rows = range.a.map((hoursA, r) => {
    const panel = Math.floor(r / perPanel)
    const y = POSTER.gridTop + (r % perPanel) * rowH
    const hoursB = range.b[r]
    const cells = []
    for (let h = 0; h < 24; h += 1) {
      const x = panelX(panel) + h * cellW
      const sizeA = threadSize(hoursA[h], range.max, cap)
      const sizeB = threadSize(hoursB[h], range.max, cap)
      cells.push({
        hour: h,
        // Thread A runs along the row, thread B down the column. They cross in
        // the middle of the cell and take turns lying on top, like a weave.
        a: sizeA ? { x, y: y + (rowH - sizeA) / 2, w: cellW, h: sizeA } : null,
        b: sizeB ? { x: x + (cellW - sizeB) / 2, y, w: sizeB, h: rowH } : null,
        aOver: (r + h) % 2 === 0,
      })
    }
    return { index: r, panel, y, cells }
  })

  const labels = rows
    .filter((row) => weekdayOf(date(row.index)) === 1 || row.index % perPanel === 0)
    .map((row) => ({ index: row.index, panel: row.panel, y: row.y + rowH / 2, text: monthDay(date(row.index)) }))

  return {
    width: POSTER.width,
    height: POSTER.height,
    grid: { y: POSTER.gridTop, h: rowH * perPanel, cellW, rowH, cap, perPanel },
    panels: Array.from({ length: panelCount }, (_, p) => ({
      index: p,
      x: panelX(p),
      w: cellW * 24,
      hourTicks: POSTER.hourTicks.map((hour) => ({ hour, x: panelX(p) + (hour + 0.5) * cellW })),
    })),
    rows,
    rowLabels: dropCrowded(labels, 22),
    dateOf: date,
  }
}

// A label closer than `gap` px to the one before it in the same panel is dropped.
function dropCrowded(labels, gap) {
  const kept = []
  for (const label of labels) {
    const before = kept[kept.length - 1]
    if (!before || before.panel !== label.panel || label.y - before.y >= gap) kept.push(label)
  }
  return kept
}

/** The box a row occupies, for the highlight that follows the finger. */
export function rowBox(layout, index) {
  const { rowH, cellW } = layout.grid
  const row = layout.rows[index]
  const panel = layout.panels[row.panel]
  return { x: panel.x, y: row.y, w: cellW * 24, h: rowH }
}

/**
 * The row under a point in picture coordinates, clamped to the rows that exist.
 * A panel owns the strip from the middle of the gap before it, so a finger on
 * the shuttle in its date gutter stays with its own panel.
 */
export function rowAt(layout, x, y) {
  const { rowH, perPanel } = layout.grid
  const owner = layout.panels.reduce((best, p, i) => {
    const before = layout.panels[i - 1]
    return before && x >= before.x + before.w + POSTER.panelGap / 2 ? p : best
  }, layout.panels[0])
  const local = Math.min(perPanel - 1, Math.max(0, Math.floor((y - POSTER.gridTop) / rowH)))
  return Math.min(layout.rows.length - 1, owner.index * perPanel + local)
}
