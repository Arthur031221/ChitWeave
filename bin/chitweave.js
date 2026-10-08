#!/usr/bin/env node
// chitweave <export.txt|aggregate.json> [options]
// Weaves a two-person LINE chat export, or an aggregate JSON file, into an SVG.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { parseArgs } from 'node:util'
import { MAX_DAYS, checkAggregate, makeAggregate, selectRange, AggregateError } from '../src/core/aggregate.js'
import { isValidIso } from '../src/core/dates.js'
import { PALETTE_IDS } from '../src/core/palettes.js'
import { parseLine } from '../src/core/parse.js'
import { sampleAggregate } from '../src/core/sample.js'
import { renderSvg } from '../src/core/svg.js'
import { ui } from '../src/app/strings.js'

const HELP = `Usage: chitweave <file> [options]
       chitweave --sample [options]

  <file>            a LINE chat export (.txt) or an aggregate file (.json)
      --sample      weave the made up sample chat instead of a file

Options:
  -o, --out FILE    where to write the SVG (default: <file name>.weave.svg)
      --json        write the aggregate counts as JSON instead of a picture
      --days N      days to show, 1 to ${MAX_DAYS} (default ${MAX_DAYS})
      --end DATE    last day to show, like 2026-10-04 (default: the last day in the file)
      --palette ID  ${PALETTE_IDS.join(', ')} (default coral)
      --title TEXT  title on the picture
      --a NAME      label for the horizontal threads (default A)
      --b NAME      label for the vertical threads (default B)
      --lang LANG   zh or en, the language of the picture text (default zh)
  -h, --help        show this help

Nothing is uploaded. The text of your messages is read to count them and then dropped.`

function fail(message) {
  console.error(`chitweave: ${message}`)
  process.exit(1)
}

function load(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    fail(`cannot read ${path}: ${error.code ?? error.message}`)
  }
  if (extname(path).toLowerCase() === '.json' || text.replace(/^\uFEFF/, '').trimStart().startsWith('{')) {
    try {
      return { data: checkAggregate(JSON.parse(text.replace(/^\uFEFF/, ''))) }
    } catch (error) {
      fail(error instanceof AggregateError ? `${path}: ${error.message}` : `${path}: not valid JSON`)
    }
  }
  const parsed = parseLine(text)
  if (!parsed.ok) {
    for (const { line, code } of parsed.issues.slice(0, 5)) console.error(`  ${ui.en.line(line, ui.en.issue[code] ?? code)}`)
    const error = ui.en.error[parsed.error]
    fail(typeof error === 'function' ? error(parsed.senders) : error)
  }
  for (const { line, code } of parsed.issues.slice(0, 5)) console.error(`  ${ui.en.line(line, ui.en.issue[code] ?? code)}`)
  if (parsed.issueCount) console.error(ui.en.skipped(parsed.issueCount))
  return { data: makeAggregate(parsed), parsed }
}

function main(argv) {
  let args
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o' },
        json: { type: 'boolean' },
        sample: { type: 'boolean' },
        days: { type: 'string' },
        end: { type: 'string' },
        palette: { type: 'string' },
        title: { type: 'string' },
        a: { type: 'string' },
        b: { type: 'string' },
        lang: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (error) {
    fail(error.message)
  }
  const { values, positionals } = args
  if (values.help || (positionals.length === 0 && !values.sample)) {
    console.log(HELP)
    return
  }
  if (positionals.length > 1 || (positionals.length === 1 && values.sample)) fail('give one file, or --sample')
  const days = values.days === undefined ? MAX_DAYS : Number(values.days)
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) fail(`--days must be a whole number from 1 to ${MAX_DAYS}`)
  if (values.end !== undefined && !isValidIso(values.end)) fail('--end must be a date like 2026-10-04')
  if (values.palette !== undefined && !PALETTE_IDS.includes(values.palette)) fail(`--palette must be one of ${PALETTE_IDS.join(', ')}`)
  if (values.lang !== undefined && !['zh', 'en'].includes(values.lang)) fail('--lang must be zh or en')

  const file = positionals[0] ?? 'sample'
  const { data, parsed } = values.sample ? { data: sampleAggregate() } : load(file)
  if (parsed) {
    const [a, b] = parsed.senders
    console.error(`Read ${parsed.records.toLocaleString('en-US')} records from ${parsed.start} to ${parsed.end}: ${a.name} ${a.records}, ${b.name} ${b.records}. Names are not written to the output.`)
  }

  const stem = basename(file, extname(file)) || 'chitweave'
  if (values.json) {
    const target = values.out ?? `${stem}.weave.json`
    writeFileSync(target, `${JSON.stringify({ version: 1, start: data.start, a: data.a, b: data.b })}\n`)
    console.error(`Wrote ${target}`)
    return
  }
  const range = selectRange(data, { days, end: values.end })
  const svg = renderSvg(range, { palette: values.palette, title: values.title, labelA: values.a, labelB: values.b, lang: values.lang })
  const target = values.out ?? `${stem}.weave.svg`
  writeFileSync(target, svg)
  console.error(`Wrote ${target} (${range.days} days, ${range.records.toLocaleString('en-US')} records)`)
}

main(process.argv.slice(2))
