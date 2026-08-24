---
name: mo-draw-inspect
description: Look at the ai-mo-draw canvas and read what the user drew on it. Use when you need to verify a generated board actually looks right, when the user says "look at the board", "see what I added", "what do you think of my changes", or when responding to their annotations and sketches. Covers rendering the canvas to a PNG you can actually view, and parsing space.excalidraw to find human contributions.
---

# mo-draw-inspect — see the board, read their edits

## Look at it before you judge it

Element counts and bounding boxes tell you nothing about whether a board is
legible. Overlaps, clipped labels, and arrows crossing panels only show up
visually. Render and look before saying a layout is good.

On the open page:

```js
const api = window.excalidraw, lib = window.excalidrawLib
const blob = await lib.exportToBlob({
  elements: api.getSceneElements(),
  appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportPadding: 40 },
  files: api.getFiles(),
  mimeType: 'image/png',
})
const dataUrl = await new Promise(r => {
  const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob)
})
await fetch('/api/export', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'board', dataUrl }),
})
```

That writes `exports/board.png`. Then read that file as an image.

Let Excalidraw size the export. Passing a custom `getDimensions` can clip the
edges and make a correct board look broken.

For one region of a large canvas, filter the elements first — e.g.
`api.getSceneElements().filter(e => e.y >= 2000)` — rather than exporting
everything at a scale where nothing is readable.

## Read what the user drew

`space.excalidraw` is plain JSON: `{ type, version, source, elements, appState, files }`.

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('space.excalidraw','utf8'));
const t = {}; for (const e of d.elements) t[e.type] = (t[e.type]||0)+1;
console.log(d.elements.length, 'elements', JSON.stringify(t));
console.log('images:', Object.keys(d.files||{}).length);
"
```

Signals that an element is theirs, not generated:

- `type: 'freedraw'` — always hand-drawn.
- `type: 'image'` — something they pasted; the binary is in `files`.
- `roughness` other than `0` — the helper sets `0`, the UI defaults to `1`.
- Text that appears in no `tools/` script.
- Position off the layout grid described in `mo-draw-author`.

Read their text and placement together: a sticky note dropped beside one box is
a comment about that box. Respond to what it says, and say what you changed in
reply — they cannot see a diff of the canvas.

## Checks worth running

- Any element with `width` extending past its intended container.
- Text elements whose `x + width` crosses into a neighbouring column.
- After a build: does the on-disk element count match what the page reports? A
  mismatch means a save was lost.
