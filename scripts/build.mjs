// Bundles the app into one self contained HTML file at dist/index.html.
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const font = (file) => `data:font/woff2;base64,${readFileSync(resolve(root, `node_modules/@fontsource/instrument-serif/files/${file}`)).toString('base64')}`

const result = await build({
  entryPoints: [resolve(root, 'src/app/main.js')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  target: 'es2022',
  legalComments: 'none',
})

// Keep the inline script from ending its own element or opening an HTML comment.
const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script').replaceAll('<!--', '<\\!--')
const css = readFileSync(resolve(root, 'src/app/app.css'), 'utf8')
  .replace('__FONT_SERIF__', font('instrument-serif-latin-400-normal.woff2'))
  .replace('__FONT_SERIF_ITALIC__', font('instrument-serif-latin-400-italic.woff2'))
const hash = createHash('sha256').update(js).digest('base64')
// default-src none blocks fetch, XHR, WebSocket, beacons, frames and media.
const csp = [
  "default-src 'none'",
  `script-src 'sha256-${hash}'`,
  "style-src 'unsafe-inline'",
  'font-src data:',
  'img-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ')

let html = readFileSync(resolve(root, 'src/app/template.html'), 'utf8')
html = html.replace('__CSP__', csp).replace('__CSS__', () => css).replace('__JS__', () => js)
mkdirSync(resolve(root, 'dist'), { recursive: true })
writeFileSync(resolve(root, 'dist/index.html'), html)
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`)
