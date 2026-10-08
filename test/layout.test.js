import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectRange } from '../src/core/aggregate.js'
import { POSTER, buildLayout, rowAt, rowBox } from '../src/core/layout.js'
import { sampleAggregate } from '../src/core/sample.js'

const layoutFor = (days) => buildLayout(selectRange(sampleAggregate(), { days }))
const inside = (box, area) => box.x >= area.x - 1e-6 && box.y >= area.y - 1e-6 && box.x + box.w <= area.x + area.w + 1e-6 && box.y + box.h <= area.y + area.h + 1e-6

test('a month is one panel, longer ranges fold into two', () => {
  assert.equal(layoutFor(30).panels.length, 1)
  assert.equal(layoutFor(31).panels.length, 1)
  assert.equal(layoutFor(32).panels.length, 2)
  assert.equal(layoutFor(90).panels.length, 2)
})

test('every thread stays inside its own row and inside the picture', () => {
  for (const days of [7, 30, 60, 90]) {
    const layout = layoutFor(days)
    for (const row of layout.rows) {
      const area = rowBox(layout, row.index)
      for (const cell of row.cells) {
        for (const box of [cell.a, cell.b]) if (box) assert.ok(inside(box, area), `${days} days, row ${row.index}, hour ${cell.hour}`)
      }
    }
    const last = rowBox(layout, layout.rows.length - 1)
    assert.ok(last.y + last.h <= POSTER.gridBottom + 1e-6)
    assert.ok(Math.max(...layout.panels.map((p) => p.x + p.w)) <= POSTER.width - POSTER.margin + 1e-6)
  }
})

test('a zero count draws no thread and a bigger count draws a thicker one', () => {
  const layout = layoutFor(30)
  const range = selectRange(sampleAggregate(), { days: 30 })
  const cells = layout.rows.flatMap((row) => row.cells.map((cell) => ({ cell, count: range.a[row.index][cell.hour] })))
  for (const { cell, count } of cells) assert.equal(cell.a === null, count === 0)
  const ones = cells.find((c) => c.count === 1).cell.a.h
  const big = cells.reduce((best, c) => (c.count > best.count ? c : best)).cell.a.h
  assert.ok(big > ones)
})

test('neighbouring crossings alternate which thread lies on top', () => {
  const [row0, row1] = layoutFor(30).rows
  assert.notEqual(row0.cells[0].aOver, row0.cells[1].aOver)
  assert.notEqual(row0.cells[0].aOver, row1.cells[0].aOver)
  assert.equal(row0.cells[0].aOver, row1.cells[1].aOver)
})

test('rowAt finds the row under a point in either panel and clamps at the edges', () => {
  const layout = layoutFor(90)
  const { perPanel } = layout.grid
  for (const index of [0, 10, perPanel - 1, perPanel, 89]) {
    const box = rowBox(layout, index)
    assert.equal(rowAt(layout, box.x + box.w / 2, box.y + box.h / 2), index)
  }
  assert.equal(rowAt(layout, 0, -500), 0)
  assert.equal(rowAt(layout, POSTER.width, 5000), 89)
})

test('date labels fall on Mondays and never crowd each other', () => {
  const layout = layoutFor(90)
  for (const panel of layout.panels) {
    const ys = layout.rowLabels.filter((l) => l.panel === panel.index).map((l) => l.y)
    assert.ok(ys.length >= 5)
    for (let i = 1; i < ys.length; i += 1) assert.ok(ys[i] - ys[i - 1] >= 22)
  }
})

test('a finger a little off the centre of the right hand shuttle stays in that panel', () => {
  const layout = layoutFor(90)
  const last = layout.rows.length - 1
  const box = rowBox(layout, last)
  const shuttleX = box.x - 23
  for (const offset of [-30, -20, -10, 0, 10, 20]) assert.equal(rowAt(layout, shuttleX + offset, box.y + box.h / 2), last, `offset ${offset}`)
  const left = rowBox(layout, 0)
  assert.equal(rowAt(layout, left.x - 23 - 20, left.y + left.h / 2), 0)
})
