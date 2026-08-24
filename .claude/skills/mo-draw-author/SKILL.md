---
name: mo-draw-author
description: Author boards on the ai-mo-draw Excalidraw canvas from a script — the space.mjs helper API, the two-step build process, and the layout conventions that make a generated board readable. Use when generating, editing, or restyling diagram content on the canvas: adding shapes, arrows, labelled boxes, bands, evidence panels, or laying out a multi-section board. Assumes a session is already running (see mo-draw). For rendering the board to look at it, see mo-draw-inspect.
---

# mo-draw-author — generating boards from a script

Always generate boards with a script under `tools/`. Never hand-write
Excalidraw element JSON: elements need `seed`, `versionNonce`, fractional
index keys, and bound labels are separate elements linked by `containerId`.
The helper handles all of it.

## The two-step build

Text sizing needs font metrics that only exist in a browser, so generation is
split:

```bash
node tools/build-boards.mjs        # writes public/skeleton.json
```

Then, on the open page, call:

```js
window.buildFromSkeleton()
```

It expands the skeleton with `convertToExcalidrawElements` and saves. The
canvas updates and `space.excalidraw` is written. Forgetting the second step is
the most common mistake — the script reports success but nothing appears.

## Helper API

```js
import { openSpace } from './space.mjs'
const space = await openSpace()
space.clear()                       // destroys existing content — ask first

space.rect({ x, y, w, h, text, color, fill, size, align, opacity })
space.ellipse({ ... })              // same options
space.diamond({ ... })
space.text({ x, y, text, color, size, width })
space.arrow({ from: {x,y}, to: {x,y}, text, color })

space.shapes()                      // everything staged so far
await space.save()                  // writes public/skeleton.json
```

- `color`: `black` `grey` `red` `green` `blue` `violet` `orange` `yellow`
  `light-blue` `light-violet` `light-green` `light-red`
- `fill`: `none` (default) or `semi` for a tint of `color`
- `size`: `s` (16px, body) `m` (20) `l` (28, section head) `xl` (36, title)
- `align`: `middle` (default), `start`, `end`
- `opacity`: 0–1

Add a new board as its own module exporting `draw(space)`, then call it from
`tools/build-boards.mjs`. That keeps each board re-runnable on its own.

## Layout conventions that work

These constants produce a board that reads well at a glance. Deviate on
purpose, not by accident.

**Overall.** Main column 1580 wide from `x = 60`. Optional side panel 620 wide
at `x = 1900`, leaving a 260px corridor for return arrows. Multiple boards
stack vertically with ~600px of clear space between them.

**Bands** (a labelled horizontal section):

```js
space.rect({ x: 60, y: top, w: 1580, h: 250, color, fill: 'semi', opacity: 0.1 })
space.text({ x: 85, y: top + 18, text: '1 · SECTION NAME — what it means', size: 's', color })
// boxes sit at y = top + 80, h = 140, leaving 30px of bottom padding
```

**Four-column grid** inside a band: `x = 120, 500, 880, 1260`, each `w = 320`.

**Vertical rhythm.** Leave 100px between bands so a connecting arrow and its
caption fit. Put the caption beside the arrow as its own `text`, not as an
arrow label — short arrows squash their labels.

**Text.** Body copy at `size: 's'` with an explicit `width` so it wraps.
Standalone text does not re-flow in Excalidraw, so the helper hard-wraps it;
labels bound inside a shape wrap on their own.

## Traps

- **Overflowing labels.** Long text in a fixed-height box silently overflows.
  Either shorten it or use `align: 'start'` with a taller box, then look at the
  render.
- **Arrows drawn over panels.** A long return arrow with a bend can sweep
  across content on the right. Check the render, and prefer a straight arrow in
  a dedicated corridor.
- **Empty box bottoms.** If body text fills half a box, the box is too tall.
  Tighten it — the whitespace reads as an unfinished layout.
- **Re-running a build wipes hand edits.** If the user has drawn on the board,
  either target a distinct region or ask before rebuilding.
