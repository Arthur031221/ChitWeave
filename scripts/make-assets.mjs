// Renders the pictures the README uses: the gallery of keepsakes, the hero
// banner in light and dark, and the social card. Needs Playwright's Chromium.
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectRange } from '../src/core/aggregate.js'
import { sampleAggregate } from '../src/core/sample.js'
import { renderSvg } from '../src/core/svg.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = sampleAggregate()
const font = (file) => `file://${root}/node_modules/@fontsource/instrument-serif/files/${file}`
const GALLERY = [
  ['coral-90-zh', 'coral', 90, 'zh'],
  ['sage-60-en', 'sage', 60, 'en'],
  ['amber-30-zh', 'amber', 30, 'zh'],
  ['coral-30-en', 'coral', 30, 'en'],
  ['sage-90-zh', 'sage', 90, 'zh'],
  ['amber-60-en', 'amber', 60, 'en'],
]

const escapeHtml = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

// The first lines of the made up export, exactly as the file has them.
function beforeHtml() {
  const lines = readFileSync(resolve(root, 'fixtures/sample-zh-hant-12h.chat'), 'utf8').replace(/^\uFEFF/, '').split('\n')
  const shown = lines.slice(0, 14).map((l) => escapeHtml(l.replaceAll('\t', '    ')))
  return `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box} body{margin:0;width:560px;background:#1c1927;color:#e9e2d3;padding:22px 26px 20px;font:15px/1.65 'Noto Sans Mono CJK TC','Noto Sans Mono CJK JP',ui-monospace,monospace;white-space:pre}
  .dim{color:#8f8a9c} .who{color:#ff9d84}</style>
  <div>${shown.join('\n').replace(/(Mika|Ren)/g, '<span class="who">$1</span>')}\n<span class="dim">... 13,306 lines, 12,714 messages</span></div>`
}

const posterUri = (palette, days, lang) =>
  `data:image/svg+xml;base64,${Buffer.from(renderSvg(selectRange(data, { days }), { palette, lang })).toString('base64')}`

const FACE = `@font-face{font-family:IS;src:url(${font('instrument-serif-latin-400-normal.woff2')})}
@font-face{font-family:IS;font-style:italic;src:url(${font('instrument-serif-latin-400-italic.woff2')})}`

const THEMES = {
  light: { bg: '#f1eadd', ink: '#1f1c27', soft: '#6b6455', shadow: 'rgba(60,40,20,.38)' },
  dark: { bg: '#13111b', ink: '#f1ebdf', soft: '#a39d92', shadow: 'rgba(0,0,0,.65)' },
}

function heroHtml(theme) {
  const t = THEMES[theme]
  const fan = [
    ['coral', 90, 'zh', -6, 0, 70],
    ['sage', 60, 'en', 3, 165, 20],
    ['amber', 30, 'zh', 8, 330, 84],
  ]
    .map(([p, d, l, rot, x, y]) => `<img src="${posterUri(p, d, l)}" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)">`)
    .join('')
  return `<!doctype html><meta charset="utf-8"><style>${FACE}
  *{box-sizing:border-box} body{margin:0;width:1600px;height:640px;background:${t.bg};color:${t.ink};position:relative;overflow:hidden;font-family:IS,serif}
  .copy{position:absolute;left:96px;top:150px}
  .brand{display:flex;align-items:center;gap:26px;font-size:124px;line-height:1;letter-spacing:-2px}
  .brand img{width:88px;height:88px;border-radius:19px}
  .line{margin:24px 0 0 4px;font-size:46px;font-style:italic;color:${t.soft}}
  .fine{margin:20px 0 0 6px;font:500 22px system-ui,'Noto Sans TC',sans-serif;color:${t.soft};letter-spacing:.02em}
  .fan{position:absolute;left:930px;top:20px;width:670px;height:600px}
  .fan img{position:absolute;width:340px;height:425px;border-radius:4px;box-shadow:0 26px 50px -18px ${t.shadow}}</style>
  <div class="copy"><div class="brand"><img src="data:image/svg+xml;base64,${readFileSync(resolve(root, 'assets/logo.svg')).toString('base64')}"><span>ChitWeave</span></div>
  <div class="line">A LINE chat, woven into cloth.</div>
  <div class="fine">One row a day. One cell an hour. Nothing leaves your browser.</div></div>
  <div class="fan">${fan}</div>`
}

function cardHtml() {
  const t = THEMES.light
  return `<!doctype html><meta charset="utf-8"><style>${FACE}
  *{box-sizing:border-box} body{margin:0;width:1200px;height:675px;background:${t.bg};color:${t.ink};position:relative;overflow:hidden;font-family:IS,serif}
  .copy{position:absolute;left:76px;top:150px;width:560px}
  .brand{font-size:128px;line-height:1;letter-spacing:-2px}
  .line{margin-top:22px;font-size:48px;line-height:1.1;font-style:italic;color:${t.soft};text-wrap:balance}
  .fine{margin-top:34px;font:600 24px system-ui,'Noto Sans TC',sans-serif;color:${t.ink}}
  .a{position:absolute;left:700px;top:36px;width:420px;height:525px;transform:rotate(4deg);border-radius:4px;box-shadow:0 30px 60px -20px ${t.shadow}}
  .b{position:absolute;left:930px;top:200px;width:300px;height:375px;transform:rotate(-5deg);border-radius:4px;box-shadow:0 26px 50px -20px ${t.shadow}}</style>
  <div class="copy"><div class="brand">ChitWeave</div><div class="line">Weave your LINE chat into cloth.</div>
  <div class="fine">Free. In your browser. Nothing uploaded.</div></div>
  <img class="a" src="${posterUri('coral', 90, 'zh')}"><img class="b" src="${posterUri('sage', 30, 'en')}">`
}

const browser = await chromium.launch()
mkdirSync(resolve(root, 'assets/gallery'), { recursive: true })
const shoot = async (html, path, size, scale = 1) => {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: scale })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({ path: resolve(root, path) })
  await page.close()
}

for (const [name, palette, days, lang] of GALLERY) {
  const svg = renderSvg(selectRange(data, { days }), { palette, lang })
  await shoot(`<body style="margin:0">${svg}</body>`, `assets/gallery/${name}.png`, { width: 1080, height: 1350 })
}
await shoot(heroHtml('light'), 'assets/hero-light.png', { width: 1600, height: 640 })
await shoot(heroHtml('dark'), 'assets/hero-dark.png', { width: 1600, height: 640 })
const before = await browser.newPage({ viewport: { width: 560, height: 200 }, deviceScaleFactor: 2 })
await before.setContent(beforeHtml())
await before.locator('body').screenshot({ path: resolve(root, 'assets/before.png') })
await before.close()
await shoot(cardHtml(), 'assets/social-card.png', { width: 1200, height: 675 })
await browser.close()
console.log('assets written')
