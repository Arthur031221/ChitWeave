import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

// Serves the built page and records every request, so a test can show that
// nothing but the page itself is ever fetched.
export async function serve() {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url))
  const seen = []
  const server = createServer((req, res) => {
    seen.push(req.url)
    if (req.url.split('#')[0].split('?')[0] === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(html)
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  return { url: `http://127.0.0.1:${port}/`, seen, close: () => new Promise((resolve) => server.close(resolve)) }
}
