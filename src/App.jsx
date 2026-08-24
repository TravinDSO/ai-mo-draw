import { useCallback, useEffect, useRef, useState } from 'react'
import * as ExcalidrawLib from '@excalidraw/excalidraw'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

const SAVE_DEBOUNCE_MS = 500
const CLIENT_ID = Math.random().toString(36).slice(2)

// appState carries runtime junk (collaborators, cursors) that must not be
// persisted; keep only the handful of fields that describe the document.
const persistableAppState = (s = {}) => ({
  viewBackgroundColor: s.viewBackgroundColor ?? '#ffffff',
  gridSize: s.gridSize ?? null,
  gridModeEnabled: !!s.gridModeEnabled,
})

export default function App() {
  const [api, setApi] = useState(null)
  const [status, setStatus] = useState('connecting')

  const lastMtime = useRef(0)
  const applying = useRef(false)
  const saveTimer = useRef(null)

  const pull = useCallback(async (excalidrawApi) => {
    const res = await fetch('/api/doc')
    const { mtime, document: doc } = await res.json()
    lastMtime.current = mtime
    if (doc && excalidrawApi) {
      applying.current = true
      try {
        excalidrawApi.updateScene({
          elements: doc.elements ?? [],
          appState: persistableAppState(doc.appState),
        })
        if (doc.files && Object.keys(doc.files).length) {
          excalidrawApi.addFiles(Object.values(doc.files))
        }
      } finally {
        // onChange fires asynchronously after updateScene, so hold the guard
        // until the browser has drained it.
        setTimeout(() => { applying.current = false }, 0)
      }
    }
    setStatus('synced')
  }, [])

  const push = useCallback(async (elements, appState, files) => {
    setStatus('saving')
    const body = {
      type: 'excalidraw',
      version: 2,
      source: 'excalidraw-space',
      elements: elements.filter((el) => !el.isDeleted),
      appState: persistableAppState(appState),
      files: files ?? {},
    }
    const res = await fetch('/api/doc', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID },
      body: JSON.stringify(body),
    })
    const { mtime } = await res.json()
    lastMtime.current = mtime
    setStatus('synced')
  }, [])

  // Initial load + live reload when the file changes underneath us.
  useEffect(() => {
    if (!api) return
    window.excalidraw = api
    // Dev convenience: lets a console session or agent reach the library
    // helpers (convertToExcalidrawElements, exportToBlob) directly.
    window.excalidrawLib = ExcalidrawLib

    // Expands public/skeleton.json (written by tools/) into real elements.
    // Text sizing needs font metrics, which only exist in the browser.
    window.buildFromSkeleton = async () => {
      const skeleton = await fetch('/skeleton.json?t=' + Date.now()).then((r) => r.json())
      const elements = ExcalidrawLib.convertToExcalidrawElements(skeleton)
      api.updateScene({ elements })
      api.scrollToContent(elements, { fitToContent: true })
      return elements.length
    }
    pull(api).catch(() => setStatus('offline'))

    const events = new EventSource('/api/watch')
    events.onmessage = (e) => {
      const [mtime, writer] = String(e.data).split('|')
      // Our own write, even if this arrives before the PUT response does.
      if (writer === CLIENT_ID) { lastMtime.current = Number(mtime); return }
      if (Number(mtime) !== lastMtime.current) pull(api).catch(() => {})
    }
    events.onerror = () => setStatus('offline')
    return () => events.close()
  }, [api, pull])

  const onChange = useCallback((elements, appState, files) => {
    if (applying.current) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(
      () => push(elements, appState, files).catch(() => setStatus('offline')),
      SAVE_DEBOUNCE_MS
    )
  }, [push])

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Excalidraw excalidrawAPI={setApi} onChange={onChange} />
      <div
        style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 10,
          font: '11px ui-monospace, monospace',
          color: status === 'offline' ? '#c00' : '#888',
          pointerEvents: 'none',
        }}
      >
        space.excalidraw · {status}
      </div>
    </div>
  )
}
