# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

`ai-mo-draw` is a **shared visual whiteboard** — a local Excalidraw canvas
whose document is a plain JSON file, so a human draws in the browser while you
read and write the same board from the filesystem.

It is a tool for thinking together, not a renderer. If the user only wants a
picture to look at, offer a Mermaid diagram or inline SVG instead — those are
lighter and need no server.

## Getting started (do this first)

```bash
npm install     # fresh clone only
```

Then start the server with the **`ai-mo-draw` entry in `.claude/launch.json`**
via the preview tool. That starts Vite *and* opens the browser tab at
`http://localhost:5200` in one step.

Do not run `npm run dev` as a foreground shell command — it never exits and
will hang the turn. If no preview tool is available, run it in the background
and tell the user to open `http://localhost:5200` themselves.

Verify it is alive before drawing: the page shows a `space.excalidraw · synced`
indicator in the bottom-left.

## Skills

Three skills in `.claude/skills/` cover the workflow. They load automatically:

| Skill | Use it for |
|---|---|
| `mo-draw` | Starting a session and running the collaboration loop |
| `mo-draw-author` | Generating board content from a script, and layout conventions |
| `mo-draw-inspect` | Rendering the board to look at it, and reading the user's own edits |

Read `mo-draw-author` before generating anything — hand-written Excalidraw JSON
will not validate.

## The shape of a session

1. Start the server (opens the tab).
2. Generate a board with a script in `tools/`, never by hand.
3. **Render it to a PNG and actually look at it** before saying it reads well.
4. The user draws, annotates, pastes screenshots.
5. Re-read `space.excalidraw` and respond to what they actually drew.

Steps 4–5 are the point. Give the user something to react to early instead of
presenting one finished board at the end.

## Architecture

- `src/App.jsx` — Excalidraw plus the file-sync client.
- `vite.config.js` — dev-server middleware adding three endpoints:
  - `GET/PUT /api/doc` — read and write the document
  - `GET /api/watch` — SSE ping when the file changes on disk
  - `POST /api/export` — accept a rendered PNG into `exports/`
- `tools/space.mjs` — authoring helper; emits Excalidraw *skeleton* elements.
- `tools/build-boards.mjs` — runner; writes `public/skeleton.json`.
- `tools/board-demo.mjs` — worked example, and the template for new boards.
- `space.excalidraw` — the document. Gitignored: it is the user's, not the
  project's.

## Rules

- **Never wipe the canvas without asking.** `space.clear()` and re-running a
  build script destroy the user's own drawing.
- **Do not write while the user is drawing.** Last-writer-wins; a save from
  your side can clobber a stroke in flight. Take turns.
- **Keep generated content in a script**, so it survives an accident or a
  change of mind. Hand-placed elements do not.

## Gotchas

- **Generation is two steps.** `node tools/build-boards.mjs` only writes
  `public/skeleton.json`. Text sizing needs browser font metrics, so you must
  then call `window.buildFromSkeleton()` on the page to expand and save.
  Skipping it is the most common mistake: the script reports success and
  nothing appears on the canvas.
- **A change notification can outrun the client's own save response.** Each
  client sends `x-client-id` and the server echoes the last writer so a client
  ignores its own echo. Without that, edits vanish silently — the client
  reloads stale content over the write it just made. Preserve this if you touch
  the sync code.
- **Webfonts must be loaded before text is measured.** Excalifont loads
  asynchronously; converting a skeleton before it lands measures text with
  fallback metrics, storing every text element ~13% too narrow. It then renders
  wider than its own bounds and exports clipped. `buildFromSkeleton()` awaits
  `document.fonts.ready` for this reason — keep that.
- **Standalone text does not re-flow to a width.** `tools/space.mjs` hard-wraps
  it; labels bound inside a shape wrap on their own.
- **`cacheDir` points outside the project on purpose.** Cloud-synced folders
  (Dropbox, OneDrive, iCloud) lock files while indexing, which makes Vite's
  dependency optimizer fail its atomic rename with `EBUSY`.
- **`window.excalidraw`** is the live API and **`window.excalidrawLib`** the
  library — both available from the page for scripted checks.
- `npm audit` reports transitive advisories via `nanoid` /
  `mermaid-to-excalidraw`. They are DoS-class, need attacker-controlled size
  arguments, and are not reachable here; the automated fix downgrades
  Excalidraw to a breaking version.

## Scope

Single document, single page, no auth, loopback only. It is a local tool for
one person and an agent, not a deployment. For real concurrent editing use
[`excalidraw-room`](https://github.com/excalidraw/excalidraw-room) rather than
extending this file sync.

## No test suite

There are no tests and no linter. Verification is: run it, generate a board,
render the PNG, and look at it.
