// The poster on screen: mounts the SVG, keeps the highlighted day and the
// shuttle in step, and lets a finger, a mouse or the keyboard move them.

import { POSTER, rowAt, rowBox } from '../core/layout.js'

const ROW_STAGGER_MS = 11
const ROW_IN_MS = 550

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function createStage({ frame, poster, dim, band, shuttle, onSelect }) {
  let layout = null
  let selected = 0
  let dragging = false
  let sweepToken = 0
  // Where inside the shuttle the finger took hold, so grabbing it off centre does not jump a row.
  let grab = [0, 0]

  const toPoster = (event) => {
    const box = frame.getBoundingClientRect()
    return [((event.clientX - box.left) / box.width) * POSTER.width, ((event.clientY - box.top) / box.height) * POSTER.height]
  }

  function paint() {
    if (!layout) return
    const box = rowBox(layout, selected)
    const cut = layout.panels.map((p) => `M${p.x} ${layout.grid.y}h${p.w}v${layout.grid.h}h${-p.w}Z`).join('')
    dim.setAttribute('d', `${cut}M${box.x} ${box.y}h${box.w}v${box.h}h${-box.w}Z`)
    for (const [name, value] of Object.entries({ x: box.x, y: box.y, width: box.w, height: box.h })) band.setAttribute(name, value)
    shuttle.style.left = `${((box.x - 23) / POSTER.width) * 100}%`
    shuttle.style.top = `${((box.y + box.h / 2) / POSTER.height) * 100}%`
    shuttle.setAttribute('aria-valuenow', selected)
    frame.dataset.selected = selected
  }

  function select(index, { silent = false } = {}) {
    if (!layout) return
    selected = Math.min(layout.rows.length - 1, Math.max(0, index))
    paint()
    if (!silent) onSelect(selected)
  }

  function cancelSweep() {
    sweepToken += 1
    poster.classList.remove('weaving')
    if (!dragging) frame.classList.remove('dragging')
  }

  // Rows weave in one after another while the shuttle runs down beside them.
  function sweep(token) {
    const rows = layout.rows.length
    const total = rows * ROW_STAGGER_MS + ROW_IN_MS
    const t0 = performance.now()
    frame.classList.add('dragging')
    const tick = (now) => {
      if (token !== sweepToken) return
      const t = now - t0
      if (t >= total) {
        frame.classList.remove('dragging')
        poster.classList.remove('weaving')
        select(rows - 1)
        return
      }
      select(Math.min(rows - 1, Math.floor(t / ROW_STAGGER_MS)), { silent: true })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // `weave` plays the intro, `keep` leaves the chosen day where it is.
  function mount(svg, nextLayout, { weave = false, keep = false } = {}) {
    cancelSweep()
    layout = nextLayout
    poster.innerHTML = svg
    poster.classList.remove('swap')
    void poster.offsetWidth
    poster.classList.add('swap')
    if (weave && !reducedMotion()) {
      selected = 0
      paint()
      poster.classList.add('weaving')
      sweep(sweepToken)
    } else {
      select(keep ? selected : layout.rows.length - 1)
    }
  }

  function drag(event) {
    const [x, y] = toPoster(event)
    select(rowAt(layout, x - grab[0], y - grab[1]))
  }

  function begin(event, target) {
    cancelSweep()
    dragging = true
    frame.classList.add('scrub', 'dragging')
    target.setPointerCapture(event.pointerId)
    if (target === shuttle) {
      const box = layout && rowBox(layout, selected)
      const [x, y] = toPoster(event)
      grab = [x - (box.x - 23), y - (box.y + box.h / 2)]
    } else {
      grab = [0, 0]
    }
    drag(event)
  }

  function end() {
    dragging = false
    frame.classList.remove('scrub', 'dragging')
  }

  shuttle.addEventListener('pointerdown', (event) => begin(event, shuttle))
  poster.addEventListener('pointerdown', (event) => event.pointerType === 'mouse' && begin(event, poster))
  for (const target of [shuttle, poster]) {
    target.addEventListener('pointermove', (event) => dragging && drag(event))
    target.addEventListener('pointerup', end)
    target.addEventListener('pointercancel', end)
  }
  // A tap on the cloth picks that day. A drag on touch screens belongs to the page scroll.
  poster.addEventListener('click', (event) => {
    cancelSweep()
    grab = [0, 0]
    drag(event)
  })

  const KEYS = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, PageUp: -7, PageDown: 7 }
  shuttle.addEventListener('keydown', (event) => {
    if (!layout) return
    let next = null
    if (event.key in KEYS) next = selected + KEYS[event.key]
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = layout.rows.length - 1
    if (next === null) return
    event.preventDefault()
    cancelSweep()
    select(next)
  })

  return {
    mount,
    select: (index) => {
      cancelSweep()
      select(index)
    },
    get selected() {
      return selected
    },
  }
}
