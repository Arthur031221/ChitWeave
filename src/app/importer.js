// Turns a chosen file into an aggregate. Nothing is sent anywhere.

import { parseLine } from '../core/parse.js'
import { AggregateError, checkAggregate, makeAggregate } from '../core/aggregate.js'

export const MAX_BYTES = 50 * 1024 * 1024

/**
 * @returns {Promise<{ok: true, data: object, line?: object} | {ok: false, code: string, detail?: any, issues?: object[]}>}
 */
export async function readChosenFile(file) {
  if (file.size > MAX_BYTES) return { ok: false, code: 'too_big' }
  let text
  try {
    text = await file.text()
  } catch {
    return { ok: false, code: 'unreadable' }
  }
  if (/\.json$/i.test(file.name) || text.replace(/^\uFEFF/, '').trimStart().startsWith('{')) return readAggregate(text)

  const parsed = parseLine(text)
  if (!parsed.ok) return { ok: false, code: parsed.error, detail: parsed.senders, issues: parsed.issues }
  return { ok: true, data: makeAggregate(parsed), line: parsed }
}

function readAggregate(text) {
  try {
    return { ok: true, data: checkAggregate(JSON.parse(text.replace(/^\uFEFF/, ''))) }
  } catch (error) {
    const why = error instanceof AggregateError ? error.message : 'not valid JSON'
    return { ok: false, code: 'aggregate', detail: why }
  }
}
