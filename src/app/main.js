import { MAX_DAYS, lastDay, selectRange, swapPeople } from '../core/aggregate.js'
import { addDays, weekdayOf } from '../core/dates.js'
import { pickLang, poster as posterText } from '../core/i18n.js'
import { buildLayout } from '../core/layout.js'
import { DEFAULT_PALETTE, PALETTES } from '../core/palettes.js'
import { sampleAggregate } from '../core/sample.js'
import { renderSvg } from '../core/svg.js'
import { download, svgToPng } from './export.js'
import { readChosenFile } from './importer.js'
import { createStage } from './stage.js'
import { ui, weekday } from './strings.js'

const $ = (id) => document.getElementById(id)
const RANGES = [30, 60, 90]
const THEMES = ['auto', 'light', 'dark']

const state = {
  lang: pickLang(navigator.language),
  theme: 'auto',
  data: sampleAggregate(),
  source: 'sample',
  days: MAX_DAYS,
  end: null,
  palette: DEFAULT_PALETTE,
  title: '',
  nameA: '',
  nameB: '',
  range: null,
  layout: null,
  status: null,
  line: null,
  swapped: false,
  importId: 0,
}

const stage = createStage({
  frame: $('frame'),
  poster: $('poster'),
  dim: $('dim'),
  band: $('band'),
  shuttle: $('shuttle'),
  onSelect: showDay,
})

const t = () => ui[state.lang]
const label = (side) => (side === 'a' ? state.nameA.trim() || 'A' : state.nameB.trim() || 'B')

function posterOptions() {
  return { palette: state.palette, title: state.title, labelA: state.nameA, labelB: state.nameB, lang: state.lang, layout: state.layout }
}

function showDay(index) {
  const { range } = state
  const iso = addDays(range.start, index)
  const [, month, day] = iso.split('-')
  const text = t().readout(
    `${Number(month)}/${Number(day)}`,
    weekday(state.lang, weekdayOf(iso)),
    range.a[index].reduce((x, y) => x + y, 0),
    range.b[index].reduce((x, y) => x + y, 0),
    label('a'),
    label('b'),
  )
  $('readout').textContent = text
  $('shuttle').setAttribute('aria-valuetext', text)
  $('shuttle').setAttribute('aria-label', t().scrub)
}

// Redraws the picture from the current state.
function draw({ weave = false, keep = false } = {}) {
  state.range = selectRange(state.data, { days: state.days, end: state.end ?? lastDay(state.data) })
  state.layout = buildLayout(state.range)
  const ground = PALETTES[state.palette].ground
  $('frame').style.setProperty('--cloth', ground)
  stage.mount(renderSvg(state.range, posterOptions()), state.layout, { weave, keep })
  $('shuttle').setAttribute('aria-valuemax', state.layout.rows.length - 1)
  $('badge').hidden = state.source !== 'sample'
  syncRange()
}

function syncRange() {
  const total = state.data.a.length
  const end = $('end')
  end.min = state.data.start
  end.max = lastDay(state.data)
  end.value = state.range.end
  const covering = RANGES.find((n) => n >= total)
  for (const button of $('range').children) {
    const n = Number(button.dataset.days)
    button.setAttribute('aria-checked', String(n === state.days))
    button.disabled = covering !== undefined && n > covering
  }
}

// `build` returns the current text, so the message can be written again when
// the language changes.
function showStatus(build) {
  state.status = build
  const box = $('status')
  box.replaceChildren()
  const status = build?.()
  box.hidden = !status
  if (!status) return
  box.className = `status${status.error ? ' error' : ''}`
  for (const note of [status.message, status.note]) {
    if (note) box.append(Object.assign(document.createElement('p'), { textContent: note }))
  }
  if (status.issues?.length) {
    const list = document.createElement('ul')
    for (const { line, code } of status.issues.slice(0, 5)) {
      list.append(Object.assign(document.createElement('li'), { textContent: t().line(line, t().issue[code] ?? code) }))
    }
    box.append(list)
  }
}

function describeFailure(result) {
  const { error } = t()
  if (result.code === 'too_many_senders') return error.too_many_senders(result.detail)
  if (result.code === 'aggregate') return error.aggregate(result.detail)
  return error[result.code] ?? error.not_line_export
}

async function importFile(file) {
  const id = state.importId + 1
  state.importId = id
  const result = await readChosenFile(file)
  // A slower, older file must not replace the one chosen after it.
  if (id !== state.importId) return
  if (!result.ok) {
    showStatus(() => ({ error: true, message: describeFailure(result), issues: result.issues }))
    return
  }
  state.data = result.data
  state.source = result.line ? 'file' : 'json'
  state.line = result.line ?? null
  state.swapped = false
  state.end = null
  state.nameA = ''
  state.nameB = ''
  $('name-a').value = ''
  $('name-b').value = ''
  const covering = RANGES.find((n) => n >= state.data.a.length)
  if (covering !== undefined && state.days > covering) state.days = covering
  showStatus(() => {
    const { line } = state
    if (!line) return null
    const [a, b] = state.swapped ? [line.senders[1], line.senders[0]] : line.senders
    return {
      message: t().loaded({
        records: line.records, start: line.start, end: line.end, days: line.days,
        nameA: a.name, countA: a.records, nameB: b.name, countB: b.records,
      }),
      note: line.issueCount ? t().skipped(line.issueCount) : '',
      issues: line.issues,
    }
  })
  draw({ weave: true })
}

function applyLang() {
  const s = t()
  document.documentElement.lang = s.htmlLang
  const text = {
    sub: s.sub, sample: s.sample, 'import-label': s.import, 'import-hint': s.importHint,
    how: s.howExport, json: s.json, 'range-title': s.rangeTitle, 'end-label': s.endsOn,
    'colors-title': s.colorsTitle, 'names-title': s.namesTitle, 'title-label': s.titleLabel,
    'name-a-label': s.nameA, 'name-b-label': s.nameB, swap: s.swap, 'save-png': s.savePng,
    'save-svg': s.saveSvg, privacy: s.privacy, scope: s.scope, source: s.source, lang: s.langSwitch,
    badge: s.sampleBadge,
  }
  for (const [id, value] of Object.entries(text)) $(id).textContent = value
  $('hero').innerHTML = s.hero
  $('prev').setAttribute('aria-label', s.prevDay)
  $('next').setAttribute('aria-label', s.nextDay)
  $('title').placeholder = posterText[state.lang].title
  $('theme').textContent = { auto: s.themeAuto, light: s.themeLight, dark: s.themeDark }[state.theme]
  for (const button of $('range').children) button.textContent = s.days(Number(button.dataset.days))
  showStatus(state.status)
}

function buildControls() {
  for (const n of RANGES) {
    const button = Object.assign(document.createElement('button'), { type: 'button' })
    button.dataset.days = n
    button.setAttribute('role', 'radio')
    $('range').append(button)
  }
  for (const [id, palette] of Object.entries(PALETTES)) {
    const swatch = Object.assign(document.createElement('button'), { type: 'button', className: 'swatch' })
    swatch.dataset.palette = id
    swatch.setAttribute('role', 'radio')
    swatch.setAttribute('aria-label', palette.name)
    swatch.title = palette.name
    swatch.style.cssText = `--g:${palette.ground};--a:${palette.a};--b:${palette.b}`
    $('colors').append(swatch)
  }
}

function syncColors() {
  for (const swatch of $('colors').children) swatch.setAttribute('aria-checked', String(swatch.dataset.palette === state.palette))
}

function setTheme(theme) {
  state.theme = theme
  document.documentElement.dataset.theme = theme
  applyLang()
}

function wire() {
  $('range').addEventListener('click', (event) => {
    const n = Number(event.target.dataset?.days)
    if (!n || event.target.disabled) return
    state.days = n
    draw({ weave: true })
  })
  $('end').addEventListener('change', (event) => {
    if (!event.target.value) return
    state.end = event.target.value
    draw({ weave: true })
  })
  $('colors').addEventListener('click', (event) => {
    const id = event.target.dataset?.palette
    if (!id) return
    state.palette = id
    syncColors()
    draw({ keep: true })
  })
  for (const [id, key] of [['title', 'title'], ['name-a', 'nameA'], ['name-b', 'nameB']]) {
    $(id).addEventListener('input', (event) => {
      state[key] = event.target.value
      draw({ keep: true })
    })
  }
  $('swap').addEventListener('click', () => {
    state.data = swapPeople(state.data)
    state.swapped = !state.swapped
    ;[state.nameA, state.nameB] = [state.nameB, state.nameA]
    $('name-a').value = state.nameA
    $('name-b').value = state.nameB
    showStatus(state.status)
    draw({ keep: true })
  })
  $('sample').addEventListener('click', () => {
    state.data = sampleAggregate()
    state.source = 'sample'
    state.line = null
    state.swapped = false
    state.end = null
    showStatus(null)
    draw({ weave: true })
  })
  $('prev').addEventListener('click', () => stage.select(stage.selected - 1))
  $('next').addEventListener('click', () => stage.select(stage.selected + 1))

  const pick = (event) => {
    const [file] = event.target.files
    event.target.value = ''
    if (file) importFile(file)
  }
  $('file').addEventListener('change', pick)
  $('file-json').addEventListener('change', pick)
  $('json').addEventListener('click', () => $('file-json').click())

  const drop = $('drop')
  addEventListener('dragover', (event) => {
    event.preventDefault()
    drop.classList.add('over')
  })
  addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) drop.classList.remove('over')
  })
  addEventListener('drop', (event) => {
    event.preventDefault()
    drop.classList.remove('over')
    const [file] = event.dataTransfer?.files ?? []
    if (file) importFile(file)
  })

  $('theme').addEventListener('click', () => setTheme(THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length]))
  $('lang').addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh'
    applyLang()
    draw({ keep: true })
  })

  const save = async (kind) => {
    const svg = renderSvg(state.range, posterOptions())
    const name = `chitweave-${state.range.start}-${state.range.end}`
    try {
      if (kind === 'svg') download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`)
      else download(await svgToPng(svg), `${name}.png`)
    } catch {
      showStatus(() => ({ error: true, message: t().error.save_failed }))
    }
  }
  $('save-png').addEventListener('click', () => save('png'))
  $('save-svg').addEventListener('click', () => save('svg'))
}

buildControls()
wire()
syncColors()
applyLang()
draw({ weave: true })
document.documentElement.dataset.ready = 'true'
