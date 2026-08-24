import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DOC = path.join(ROOT, 'space.excalidraw')

function readDoc() {
  try {
    return { mtime: fs.statSync(DOC).mtimeMs, document: JSON.parse(fs.readFileSync(DOC, 'utf8')) }
  } catch {
    return { mtime: 0, document: null }
  }
}

function json(res, code, body) {
  res.statusCode = code
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

// Serves the canvas document from a single JSON file on disk, and pushes an
// SSE ping whenever that file changes underneath us (i.e. someone edited it
// outside the browser).
function docApi() {
  return {
    name: 'ai-mo-draw-doc-api',
    configureServer(server) {
      const clients = new Set()
      let debounce = null
      // Which client's write produced the newest file state. Broadcast with
      // each change so a client can recognise (and ignore) its own echo even
      // if the notification outruns its PUT response.
      let lastWriter = ''

      fs.watch(ROOT, (_event, filename) => {
        if (filename !== path.basename(DOC)) return
        clearTimeout(debounce)
        debounce = setTimeout(() => {
          const { mtime } = readDoc()
          for (const res of clients) res.write(`data: ${mtime}\n\n`)
        }, 150)
      })

      server.middlewares.use('/api/doc', (req, res) => {
        if (req.method === 'GET') return json(res, 200, readDoc())
        if (req.method === 'PUT') {
          let body = ''
          req.on('data', (c) => (body += c))
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body)
              lastWriter = String(req.headers['x-client-id'] || '')
              fs.writeFileSync(DOC, JSON.stringify(parsed, null, 2))
              json(res, 200, { mtime: fs.statSync(DOC).mtimeMs })
            } catch (err) {
              json(res, 400, { error: String(err) })
            }
          })
          return
        }
        json(res, 405, { error: 'method not allowed' })
      })

      // Lets Claude actually look at the canvas: the browser posts a rendered
      // PNG here and it lands in exports/ as a readable image file.
      server.middlewares.use('/api/export', (req, res) => {
        if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' })
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { name = 'canvas', dataUrl } = JSON.parse(body)
            const base64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, '')
            const safe = String(name).replace(/[^a-z0-9_-]/gi, '') || 'canvas'
            const dir = path.join(ROOT, 'exports')
            fs.mkdirSync(dir, { recursive: true })
            const file = path.join(dir, `${safe}.png`)
            fs.writeFileSync(file, Buffer.from(base64, 'base64'))
            json(res, 200, { file, bytes: fs.statSync(file).size })
          } catch (err) {
            json(res, 400, { error: String(err) })
          }
        })
      })

      server.middlewares.use('/api/watch', (req, res) => {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        })
        res.write(`data: ${readDoc().mtime}\n\n`)
        clients.add(res)
        req.on('close', () => clients.delete(res))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), docApi()],
  // Keep the high-churn dependency cache out of the project tree. Cloud-synced
  // folders (Dropbox, OneDrive, iCloud) lock files while indexing them, which
  // makes Vite's dependency optimizer fail its atomic rename with EBUSY.
  cacheDir: path.join(os.tmpdir(), 'ai-mo-draw-vite'),
  define: { 'process.env.IS_PREACT': JSON.stringify('false') },
  server: {
    port: 5200,
    // The doc file is synced over our own API; letting Vite watch it would
    // hard-reload the page on every stroke.
    watch: { ignored: ['**/space.excalidraw'] },
  },
})
