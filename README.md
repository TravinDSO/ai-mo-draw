# ai-mo-draw

A local [Excalidraw](https://excalidraw.com) canvas whose document is a plain
JSON file on disk — so a person can draw in the browser while a script (or a
coding agent) reads and writes the same board.

Draw, paste images, drop in text. Everything round-trips.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5200.

## How it works

The canvas lives in one file: `space.excalidraw` — standard Excalidraw JSON,
openable in any Excalidraw, pretty-printed so it diffs cleanly.

- The browser autosaves ~500ms after edits stop (`PUT /api/doc`).
- Middleware in `vite.config.js` adds three endpoints to the Vite dev server:
  - `GET/PUT /api/doc` — read and write the document
  - `GET /api/watch` — server-sent events, pinged when the file changes on disk
  - `POST /api/export` — accepts a rendered PNG, writes it to `exports/`
- Change the file from a script and the open canvas reloads within ~150ms.

Image binaries are embedded in the document's `files` map, so pasted images
travel with the file.

### Echo suppression

Each client sends an `x-client-id` header on write, and the server echoes the
last writer with every change notification. A client ignores its own echo.

This matters more than it looks: without it, the change notification can outrun
the client's own save response, so the client sees an unfamiliar timestamp and
reloads stale content over the edit it just made. Edits vanish silently.

## Using it with Claude Code

Clone it, open Claude Code in the directory, and say what you want to sketch.

`CLAUDE.md` and three skills in `.claude/skills/` ship with the repo, so the
session already knows how to start the server, generate a board, look at the
result, and read what you drew:

| Skill | Covers |
|---|---|
| `mo-draw` | Starting a session and the collaboration loop |
| `mo-draw-author` | Generating boards from a script, plus layout conventions |
| `mo-draw-inspect` | Rendering the board to view it, and reading your edits |

`.claude/launch.json` defines the dev-server entry, so the agent can start Vite
and open the browser tab in one step.

## Generating boards from a script

Text sizing needs font metrics that only exist in a browser, so generation is
two steps:

```bash
node tools/build-boards.mjs      # writes public/skeleton.json
```

Then, on the open page, call `window.buildFromSkeleton()`. It expands the
skeleton with `convertToExcalidrawElements` and saves.

`tools/space.mjs` is a small authoring helper:

```js
import { openSpace } from './tools/space.mjs'

const space = await openSpace()
space.rect({ x: 40, y: 40, w: 240, h: 120, text: 'idea', color: 'blue' })
space.ellipse({ x: 340, y: 40, w: 200, h: 120, text: 'another' })
space.arrow({ from: { x: 290, y: 100 }, to: { x: 330, y: 100 } })
space.text({ x: 40, y: 220, width: 600, text: 'wrapped body copy' })
await space.save()
```

`tools/board-demo.mjs` is a worked example — copy it as a starting point.

Colors take friendly names (`blue`, `violet`, `grey`, `red`, `green`,
`light-blue`, …) and map to Excalidraw's palette.

## Notes and limitations

- **Single document, last-writer-wins.** Fine for one person, or for a person
  and an agent taking turns. For real concurrent editing use
  [`excalidraw-room`](https://github.com/excalidraw/excalidraw-room) instead of
  this file sync.
- **`cacheDir` points outside the project** on purpose. Cloud-synced folders
  (Dropbox, OneDrive, iCloud) lock files while indexing, which makes Vite's
  dependency optimizer fail its atomic rename with `EBUSY`.
- **Standalone text does not re-flow** to a width in Excalidraw, so
  `tools/space.mjs` hard-wraps it. Text bound inside a shape wraps on its own.
- **The dev server has no authentication** and binds to loopback. It is a local
  tool, not a deployment. Serving it on a network would need auth and an origin
  check on the write endpoints.
- `window.excalidraw` is the live API and `window.excalidrawLib` the library,
  both handy from the console.
- `npm audit` reports transitive advisories via `nanoid` /
  `mermaid-to-excalidraw`. They are DoS-class and need attacker-controlled size
  arguments, so they are not reachable here; the automated fix downgrades
  Excalidraw to a breaking version.

## Why Excalidraw

MIT licensed, and `.excalidraw` is plain JSON — which is what makes the
read-write-from-a-script workflow straightforward.

## License

MIT — see [LICENSE](LICENSE).
