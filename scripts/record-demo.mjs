// Records assets/demo.gif (English) and assets/demo-zh.gif (Traditional
// Chinese) from the real page in a phone sized window: scrub through the days,
// change the colors, name the two people, save the picture and open it.
// Needs Playwright's Chromium and ffmpeg on the PATH.
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PHONE = { width: 390, height: 844 }

const COPY = {
  en: {
    locale: 'en-US',
    file: 'demo.gif',
    names: ['Mika', 'Ren'],
    caps: ['One row a day, one cell an hour', 'Drag the shuttle to read any day', 'Pick a thread color', 'Name the two of you', 'Save the picture', 'A 1080 by 1350 PNG. No chat text in it.'],
  },
  zh: {
    locale: 'zh-TW',
    file: 'demo-zh.gif',
    names: ['小明', '小華'],
    caps: ['一天一列，一小時一格', '拖動梭子，看任何一天', '換一種線色', '幫兩個人取名字', '存成圖片', '1080 × 1350 的 PNG，沒有聊天內容'],
  },
}

async function dress(page) {
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent = `
      #demo-cap { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 99; width: max-content; max-width: 90vw; padding: 9px 16px; border-radius: 999px; background: #1f1c27; color: #f6efe3; font: 600 15px/1.2 system-ui, 'Noto Sans TC', sans-serif; box-shadow: 0 6px 22px rgb(0 0 0 / .35); text-align: center; pointer-events: none; }
      #demo-dot { position: fixed; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 3px solid #e4573d; border-radius: 50%; background: rgb(228 87 61 / .2); z-index: 98; pointer-events: none; transition: scale .12s ease; }
      #demo-dot.down { scale: .7; }`
    document.head.append(style)
    const cap = Object.assign(document.createElement('div'), { id: 'demo-cap' })
    const dot = Object.assign(document.createElement('div'), { id: 'demo-dot' })
    document.body.append(cap, dot)
    addEventListener('pointermove', (e) => (dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`), true)
    addEventListener('pointerdown', () => dot.classList.add('down'), true)
    addEventListener('pointerup', () => dot.classList.remove('down'), true)
  })
}
const say = (page, text) => page.evaluate((t) => (document.getElementById('demo-cap').textContent = t), text)

async function glide(page, selector, dy = 0) {
  const box = await page.locator(selector).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dy, { steps: 14 })
}

async function record(lang) {
  const copy = COPY[lang]
  const work = resolve(root, `.tmp/demo-${lang}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: PHONE, locale: copy.locale, acceptDownloads: true,
    recordVideo: { dir: work, size: PHONE },
  })
  const opened = Date.now()
  const page = await context.newPage()
  await page.goto(`file://${root}/dist/index.html`)
  await page.waitForSelector('html[data-ready]')
  await page.waitForFunction(() => !document.querySelector('#poster.weaving'))
  await dress(page)
  await page.evaluate(() => scrollTo(0, 250))
  await page.waitForTimeout(400)
  const lead = (Date.now() - opened) / 1000
  await page.mouse.move(195, 640)

  await say(page, copy.caps[0])
  await page.waitForTimeout(1200)

  await say(page, copy.caps[1])
  const shuttle = await page.locator('#shuttle').boundingBox()
  const frame = await page.locator('#frame').boundingBox()
  await page.mouse.move(shuttle.x + shuttle.width / 2, shuttle.y + shuttle.height / 2, { steps: 10 })
  await page.mouse.down()
  await page.mouse.move(frame.x + frame.width * 0.2, frame.y + frame.height * 0.34, { steps: 46 })
  await page.waitForTimeout(1000)
  await page.mouse.move(frame.x + frame.width * 0.7, frame.y + frame.height * 0.58, { steps: 40 })
  await page.waitForTimeout(1100)
  await page.mouse.up()

  await say(page, copy.caps[2])
  await page.mouse.wheel(0, 330)
  await page.waitForTimeout(700)
  await glide(page, '#colors [data-palette="sage"]')
  await page.waitForTimeout(300)
  await page.click('#colors [data-palette="sage"]')
  await page.waitForTimeout(1100)
  await glide(page, '#colors [data-palette="amber"]')
  await page.click('#colors [data-palette="amber"]')
  await page.waitForTimeout(800)
  await glide(page, '#colors [data-palette="coral"]')
  await page.click('#colors [data-palette="coral"]')
  await page.waitForTimeout(600)

  await say(page, copy.caps[3])
  await page.mouse.wheel(0, 260)
  await page.waitForTimeout(600)
  await glide(page, '#name-a')
  await page.click('#name-a')
  await page.keyboard.type(copy.names[0], { delay: 90 })
  await glide(page, '#name-b')
  await page.click('#name-b')
  await page.keyboard.type(copy.names[1], { delay: 90 })
  await page.waitForTimeout(600)

  await say(page, copy.caps[4])
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(500)
  await glide(page, '#save-png')
  await page.waitForTimeout(400)
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#save-png')])
  const png = resolve(work, 'saved.png')
  await download.saveAs(png)
  await page.waitForTimeout(500)

  writeFileSync(resolve(work, 'saved.html'), `<!doctype html><meta charset="utf-8"><body style="margin:0;height:100vh;background:#f1eadd;display:grid;place-items:center">
    <img src="saved.png" style="max-height:88vh;max-width:92vw;border-radius:3px;box-shadow:0 20px 40px -16px rgb(60 40 20 / .5)">
    <div style="position:fixed;left:50%;bottom:14px;transform:translateX(-50%);width:max-content;max-width:90vw;padding:9px 16px;border-radius:999px;background:#1f1c27;color:#f6efe3;font:600 15px/1.2 system-ui,'Noto Sans TC',sans-serif;text-align:center">${copy.caps[5]}</div>`)
  await page.goto(`file://${work}/saved.html`)
  await page.waitForTimeout(2200)
  const video = page.video()
  await context.close()
  await browser.close()

  const webm = await video.path()
  const out = resolve(root, 'assets', copy.file)
  const filters = 'fps=10,scale=360:-1:flags=lanczos'
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-vf', `${filters},palettegen=max_colors=96:stats_mode=diff`, resolve(work, 'palette.png')])
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', lead.toFixed(2), '-i', webm, '-i', resolve(work, 'palette.png'), '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, out])
  console.log(`${copy.file} written`)
}

const langs = process.argv.slice(2)
for (const lang of langs.length ? langs : ['en', 'zh']) await record(lang)
