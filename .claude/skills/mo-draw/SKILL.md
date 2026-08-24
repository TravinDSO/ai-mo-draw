---
name: mo-draw
description: Start and run a shared visual whiteboard session on the local Excalidraw canvas (ai-mo-draw). Use when the user says "let's whiteboard this", "draw this out", "put it on the canvas", "work visually", "sketch this", or wants a diagram they can then edit by hand. Covers starting the server, the collaboration loop, and ending a session. For authoring board content use mo-draw-author; for looking at the board or reading the user's own edits use mo-draw-inspect. Do NOT use for static diagrams the user only wants to read (write SVG or Mermaid instead) or for image generation.
---

# mo-draw — run a shared whiteboard session

A local Excalidraw canvas whose document is a plain JSON file. The human draws
in the browser; you read and write the same file. That two-way loop is the
whole point — if the user only wants a picture to look at, a Mermaid diagram or
inline SVG is lighter and you should offer that instead.

## Start a session

```bash
npm install          # first run in a fresh clone only
npm run dev          # http://localhost:5200
```

Open the browser at `http://localhost:5200`. If a preview tool is available,
`.claude/launch.json` already defines the `ai-mo-draw` entry — use it rather
than backgrounding a shell command, because `npm run dev` never exits.

The canvas lives in `space.excalidraw` at the repo root. It is gitignored: it
is the user's document, not part of the project. If it does not exist yet, the
app creates it on first save.

## The loop

1. **You draw.** Generate a board with a script (see `mo-draw-author`), never
   by hand-writing JSON elements.
2. **Show it.** Render a PNG and actually look at it (see `mo-draw-inspect`).
   Do not tell the user a layout is good without having seen it.
3. **They edit.** They drag, annotate, sketch, paste screenshots.
4. **You read it back.** Re-read `space.excalidraw` to see what changed and
   respond to what they actually drew.

Steps 3 and 4 are what makes this worth running. Structure the work so the
user has something to react to early rather than presenting one finished board.

## Rules

- **Never wipe the canvas without asking.** `space.clear()` and re-running a
  build script destroy the user's own drawing. Ask first, every time, unless
  they just said to wipe it.
- **Do not write while the user is drawing.** Last-writer-wins: a save from
  your side can clobber a stroke in flight. Take turns.
- **Keep boards re-runnable.** Put generated content in a script under
  `tools/` so it can be regenerated after an accident or a change of mind.
  Hand-placed elements cannot be.
- **One canvas, one page.** For several boards, lay them out in separate
  regions of the infinite canvas (e.g. board 2 starts at `y = 2000`) and give
  each a heading, rather than trying to manage multiple documents.

## Ending a session

The document is already saved — there is no export step. If the user wants a
copy, `space.excalidraw` opens in any Excalidraw, including excalidraw.com.
Point that out rather than converting anything.

Stop the dev server when the session is over.
