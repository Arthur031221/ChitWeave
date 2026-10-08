import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import * as playwright from 'playwright'
import { parseLine } from '../src/core/parse.js'
import { serve } from './serve.js'

const name = process.env.BROWSER ?? 'chromium'
const fixture = (file) => new URL(`../fixtures/${file}`, import.meta.url).pathname
let browser
let site

before(async () => {
  browser = await playwright[name].launch()
  site = await serve()
})
after(async () => {
  await browser?.close()
  await site?.close()
})

async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 900 }, locale: 'zh-TW', acceptDownloads: true, ...options })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  await page.goto(site.url)
  await page.waitForSelector('html[data-ready]')
  await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
  return { context, page, problems }
}

const rows = (page) => page.locator('#poster [data-row]').count()
const selected = (page) => page.getAttribute('#frame', 'data-selected').then(Number)
const text = (page, selector) => page.textContent(selector)

function pngSize(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature')
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)]
}
const pngChunks = (buffer) => {
  const names = []
  for (let i = 8; i < buffer.length; i += 12 + buffer.readUInt32BE(i)) names.push(buffer.toString('latin1', i + 4, i + 8))
  return names
}

test('opens on a finished sample weave, in Traditional Chinese', async () => {
  const { context, page, problems } = await open()
  assert.equal(await rows(page), 90)
  assert.match(await text(page, '#hero'), /LINE 對話織成一塊布/)
  assert.match(await text(page, '#readout'), /^10\/4（日）/)
  assert.equal(await selected(page), 89)
  assert.equal(await page.locator('#badge').isVisible(), true)
  assert.deepEqual(problems, [])
  await context.close()
})

test('the page makes no request of its own and the policy blocks any it tries', async () => {
  const { context, page } = await open()
  const requests = []
  page.on('request', (r) => !/^(data|blob):/.test(r.url()) && requests.push(r.url()))
  await page.setInputFiles('#file', fixture('sample-zh-hant-12h.chat'))
  await page.waitForSelector('#status:not([hidden])')
  await page.click('#save-svg')
  const blocked = await page.evaluate(() => fetch('https://example.com/').then(() => 'sent', () => 'blocked'))
  assert.equal(blocked, 'blocked')
  assert.deepEqual(requests, [])
  assert.deepEqual(site.seen.filter((u) => u !== '/'), [])
  await context.close()
})

test('imports a LINE export, reports what it read and keeps names off the picture', async () => {
  const { context, page, problems } = await open()
  await page.setInputFiles('#file', fixture('sample-zh-hant-12h.chat'))
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('12,714'))
  const status = await text(page, '#status')
  assert.match(status, /2026-05-08 至 2026-10-04，共 150 天/)
  assert.match(status, /Mika/)
  assert.equal(await page.locator('#badge').isVisible(), false)
  await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
  const svg = await page.innerHTML('#poster')
  assert.ok(!svg.includes('Mika') && !svg.includes('Ren'))
  assert.match(svg, /取自匯出檔 150 天中的最後 90 天/)
  assert.deepEqual(problems, [])
  await context.close()
})

test('a file dropped on the page is read like a chosen one', async () => {
  const { context, page } = await open()
  const dataTransfer = await page.evaluateHandle((content) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([content], 'dropped.txt', { type: 'text/plain' }))
    return transfer
  }, '2026/10/01（四）\n09:00\tA\t好\n09:05\tB\t好\n')
  await page.dispatchEvent('body', 'dragover', { dataTransfer })
  assert.equal(await page.locator('#drop.over').count(), 1)
  await page.dispatchEvent('body', 'drop', { dataTransfer })
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('2 則紀錄'))
  assert.equal(await page.locator('#drop.over').count(), 0)
  assert.equal(await rows(page), 1)
  await context.close()
})

test('explains why a group chat or a wrong file cannot be used', async () => {
  const { context, page } = await open()
  const rowsBefore = await rows(page)
  await page.setInputFiles('#file', { name: 'group.txt', mimeType: 'text/plain', buffer: Buffer.from('2026/10/01（四）\n09:00\tA\tx\n09:01\tB\ty\n09:02\tC\tz\n') })
  await page.waitForSelector('#status.error')
  assert.match(await text(page, '#status'), /3 位發話者/)
  await page.setInputFiles('#file', { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('買牛奶\n打電話\n') })
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('不是 LINE'))
  await page.setInputFiles('#file', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('2026/10/01（四）\n25:00\tA\tx\n09:00\tB\ty\n09:01\tA\tz\n') })
  await page.waitForFunction(() => document.querySelector('#status li'))
  assert.equal(await rows(page), 1)
  assert.notEqual(rowsBefore, 1)
  await context.close()
})

test('a short file selects a range it can fill', async () => {
  const { context, page } = await open()
  const chat = ['2026/10/01（四）', '09:00\tA\t好', '09:05\tB\t好', ''].join('\n')
  await page.setInputFiles('#file', { name: 'short.txt', mimeType: 'text/plain', buffer: Buffer.from(chat) })
  await page.waitForFunction(() => document.querySelectorAll('#poster [data-row]').length === 1)
  assert.equal(await page.getAttribute('#range [aria-checked="true"]', 'data-days'), '30')
  assert.equal(await page.isDisabled('#range [data-days="30"]'), false)
  await context.close()
})

test('swapping after an import swaps who the status says each thread is', async () => {
  const { context, page } = await open()
  await page.setInputFiles('#file', fixture('sample-zh-hant-12h.chat'))
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('橫線是「Mika」'))
  await page.click('#swap')
  assert.match(await text(page, '#status'), /橫線是「Ren」/)
  assert.match(await text(page, '#status'), /直線是「Mika」/)
  await context.close()
})

test('a group chat header is refused even when two people wrote', async () => {
  const { context, page } = await open()
  const chat = ['[LINE] 週末爬山團的聊天記錄', '', '2026/10/01（四）', '09:00\tA\t好', '09:05\tB\t好', ''].join('\n')
  await page.setInputFiles('#file', { name: 'group.txt', mimeType: 'text/plain', buffer: Buffer.from(chat) })
  await page.waitForSelector('#status.error')
  assert.match(await text(page, '#status'), /群組聊天/)
  await context.close()
})

test('shows line numbers for lines it could not read', async () => {
  const { context, page } = await open()
  const lines = ['2026/10/01（四）', '09:00\tA\t好', '09:01\tB\t好', '25:00\tA\t時間不存在']
  await page.setInputFiles('#file', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from(lines.join('\n')) })
  await page.waitForSelector('#status li')
  assert.match(await text(page, '#status'), /第 4 行：時間不合理/)
  await context.close()
})

test('range buttons and the end date change the picture', async () => {
  const { context, page } = await open()
  await page.click('#range [data-days="30"]')
  await page.waitForFunction(() => document.querySelectorAll('#poster [data-row]').length === 30)
  assert.equal(await page.getAttribute('#range [data-days="30"]', 'aria-checked'), 'true')
  await page.fill('#end', '2026-07-31')
  await page.waitForFunction(() => document.querySelector('#readout').textContent.startsWith('7/31'))
  assert.match(await text(page, '#poster'), /2026\.07\.02 至 2026\.07\.31/)
  await context.close()
})

test('dragging the shuttle moves the highlighted day and updates the counts', async () => {
  const { context, page } = await open()
  const box = await page.locator('#frame').boundingBox()
  const shuttle = await page.locator('#shuttle').boundingBox()
  await page.mouse.move(shuttle.x + shuttle.width / 2, shuttle.y + shuttle.height / 2)
  await page.mouse.down()
  assert.equal(await page.locator('#frame.scrub').count(), 1)
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.45, { steps: 8 })
  const during = await selected(page)
  await page.mouse.up()
  assert.ok(during < 45, `selected ${during}`)
  assert.equal(await page.locator('#frame.scrub').count(), 0)
  assert.match(await text(page, '#readout'), /A \d+ 則，B \d+ 則/)
  assert.equal(await page.getAttribute('#shuttle', 'aria-valuenow'), String(during))
  await context.close()
})

test('keyboard, step buttons and a tap on the cloth give the same control', async () => {
  const { context, page } = await open()
  await page.locator('#shuttle').focus()
  await page.keyboard.press('ArrowUp')
  assert.equal(await selected(page), 88)
  await page.keyboard.press('Home')
  assert.equal(await selected(page), 0)
  await page.keyboard.press('PageDown')
  assert.equal(await selected(page), 7)
  await page.click('#next')
  assert.equal(await selected(page), 8)
  await page.click('#prev')
  await page.click('#prev')
  assert.equal(await selected(page), 6)
  const box = await page.locator('#poster svg').boundingBox()
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * (1096 / 1350 - 0.02))
  assert.ok((await selected(page)) >= 80)
  await context.close()
})

test('the readout matches the counts in the data for the chosen day', async () => {
  const { context, page } = await open()
  await page.click('#range [data-days="30"]')
  await page.waitForFunction(() => document.querySelectorAll('#poster [data-row]').length === 30)
  await page.locator('#shuttle').focus()
  await page.keyboard.press('Home')
  const readout = await text(page, '#readout')
  const sample = JSON.parse(readFileSync(fixture('sample.weave.json'), 'utf8'))
  const index = sample.a.length - 30
  const sum = (row) => row.reduce((x, y) => x + y, 0)
  assert.ok(readout.includes(`A ${sum(sample.a[index])} 則，B ${sum(sample.b[index])} 則`), readout)
  await context.close()
})

test('a palette swap keeps the chosen day and recolors the ground', async () => {
  const { context, page } = await open()
  await page.locator('#shuttle').focus()
  await page.keyboard.press('Home')
  await page.click('#colors [data-palette="sage"]')
  assert.equal(await selected(page), 0)
  assert.match(await page.innerHTML('#poster'), /fill="#1c2a25"/)
  await context.close()
})

test('names, title and swap show up on the picture, and swapping exchanges the threads', async () => {
  const { context, page } = await open()
  await page.fill('#title', '小明和小華')
  await page.fill('#name-a', '小明')
  await page.fill('#name-b', '小華')
  const readoutBefore = await text(page, '#readout')
  assert.match(readoutBefore, /小明 \d+ 則，小華 \d+ 則/)
  const [, mine, theirs] = readoutBefore.match(/小明 (\d+) 則，小華 (\d+) 則/)
  await page.click('#swap')
  // Each person keeps their own count and trades threads, so the order flips.
  assert.match(await text(page, '#readout'), new RegExp(`小華 ${theirs} 則，小明 ${mine} 則`))
  assert.match(await page.innerHTML('#poster'), /小明和小華/)
  await context.close()
})

test('saves a 1080 by 1350 PNG with no metadata, and an SVG without any message text', async () => {
  const { context, page } = await open()
  const secret = '祕密訊息SECRET-MESSAGE'
  const chat = ['2026/10/01（四）', `09:00\tSecretAlice\t${secret}`, '09:01\tSecretBob\t好', `10:00\tSecretAlice\t"${secret}`, '第二行"', ''].join('\n')
  await page.setInputFiles('#file', { name: 'chat.txt', mimeType: 'text/plain', buffer: Buffer.from(chat) })
  await page.waitForSelector('#status:not([hidden])')
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#save-png')])
  assert.match(png.suggestedFilename(), /^chitweave-2026-10-01-2026-10-01\.png$/)
  const bytes = readFileSync(await png.path())
  assert.deepEqual(pngSize(bytes), [1080, 1350])
  assert.ok(bytes.length > 8_000, 'not a blank picture')
  assert.ok(!pngChunks(bytes).some((c) => ['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(c)), pngChunks(bytes).join())
  const [svg] = await Promise.all([page.waitForEvent('download'), page.click('#save-svg')])
  const source = readFileSync(await svg.path(), 'utf8')
  assert.ok(source.startsWith('<svg'))
  for (const word of ['SECRET', 'Secret', '祕密', '第二行']) assert.ok(!source.includes(word), word)
  await context.close()
})

test('the saved PNG shows the weave and not a blank sheet', async () => {
  const { context, page } = await open()
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#save-png')])
  const bytes = readFileSync(await png.path())
  const colors = await page.evaluate(async (b64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${b64}`
    await image.decode()
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height })
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const { data } = ctx.getImageData(0, 0, image.width, image.height)
    let coral = 0
    let indigo = 0
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - 228) < 40 && Math.abs(data[i + 1] - 87) < 40 && Math.abs(data[i + 2] - 61) < 40) coral += 1
      if (Math.abs(data[i] - 44) < 30 && Math.abs(data[i + 1] - 58) < 30 && Math.abs(data[i + 2] - 140) < 30) indigo += 1
    }
    return { coral, indigo }
  }, bytes.toString('base64'))
  assert.ok(colors.coral > 20_000 && colors.indigo > 10_000, JSON.stringify(colors))
  await context.close()
})

test('loads an aggregate JSON and refuses a broken one', async () => {
  const { context, page } = await open()
  await page.setInputFiles('#file-json', fixture('sample.weave.json'))
  await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
  assert.equal(await rows(page), 90)
  await page.setInputFiles('#file-json', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') })
  await page.waitForSelector('#status.error')
  assert.match(await text(page, '#status'), /彙整檔格式不對/)
  await context.close()
})

test('language and theme switches', async () => {
  const { context, page } = await open()
  await page.click('#lang')
  assert.match(await text(page, '#hero'), /Weave your LINE chat/)
  assert.equal(await page.getAttribute('html', 'lang'), 'en')
  assert.match(await page.innerHTML('#poster'), />Our weave</)
  await page.click('#theme')
  await page.click('#theme')
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  assert.equal(bg, 'rgb(19, 17, 27)')
  await context.close()
})

test('fits a phone screen without sideways scrolling and keeps touch targets large', async () => {
  const { context, page } = await open({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  assert.ok(overflow <= 0, `overflow ${overflow}`)
  for (const selector of ['#sample', '#import-label', '#prev', '#next', '#save-png', '#shuttle']) {
    const box = await page.locator(selector).boundingBox()
    assert.ok(box.width >= 43 && box.height >= 43, `${selector} ${box.width}x${box.height}`)
  }
  await page.locator('#poster').tap({ position: { x: 150, y: 120 } })
  assert.ok((await selected(page)) < 89)
  await context.close()
})

test('reduced motion skips the intro and still lands on the last day', async () => {
  const { context, page } = await open({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('#poster.weaving').count(), 0)
  assert.equal(await selected(page), 89)
  await context.close()
})

test('the fixture the tests use really is what the page says it read', async () => {
  const parsed = parseLine(readFileSync(fixture('sample-zh-hant-12h.chat'), 'utf8'))
  assert.equal(parsed.records, 12714)
})
