// Authoring helper for the Excalidraw space.
//
// Deliberately mirrors the API of tldraw-space/tools/space.mjs so board
// scripts port across with only cosmetic changes. It emits Excalidraw
// "skeleton" elements — the simplified form that convertToExcalidrawElements()
// expands into full elements. Text measurement needs font metrics, so the
// expansion happens in the browser: run this script, then call
// window.buildFromSkeleton() on the page (see README).

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKELETON = path.join(HERE, '..', 'public', 'skeleton.json')

// tldraw palette names -> Excalidraw hex, so board scripts keep reading well.
const STROKE = {
  black: '#1e1e1e',
  grey: '#868e96',
  red: '#e03131',
  green: '#2f9e44',
  blue: '#1971c2',
  violet: '#9c36b5',
  orange: '#f08c00',
  yellow: '#f08c00',
  'light-blue': '#4dabf7',
  'light-violet': '#b197fc',
  'light-green': '#69db7c',
  'light-red': '#ff8787',
}

const TINT = {
  black: '#e9ecef',
  grey: '#f1f3f5',
  red: '#ffc9c9',
  green: '#b2f2bb',
  blue: '#a5d8ff',
  violet: '#eebefa',
  orange: '#ffec99',
  yellow: '#ffec99',
  'light-blue': '#d0ebff',
  'light-violet': '#f3f0ff',
  'light-green': '#d3f9d8',
  'light-red': '#ffe3e3',
}

const FONT_SIZE = { s: 16, m: 20, l: 28, xl: 36 }
const stroke = (c) => STROKE[c] ?? STROKE.black

// Excalidraw does not re-flow a standalone text element to a target width, so
// wrap it ourselves. Excalifont averages ~0.50em per character (measured: 99
// chars at 20px renders 998px). 0.52 leaves a margin so lines land inside the
// target width rather than spilling past it.
function wrapText(text, width, fontSize) {
  if (!width) return text
  const NL = String.fromCharCode(10)
  const perLine = Math.max(8, Math.floor(width / (fontSize * 0.52)))
  return text
    .split(NL)
    .map((paragraph) => {
      const out = []
      let line = ''
      for (const word of paragraph.split(' ')) {
        if (!line) line = word
        else if ((line + ' ' + word).length <= perLine) line += ' ' + word
        else { out.push(line); line = word }
      }
      out.push(line)
      return out.join(NL)
    })
    .join(NL)
}

export async function openSpace() {
  const elements = []
  const add = (el) => {
    elements.push(el)
    return el
  }

  const shape = (type) => ({
    x = 0, y = 0, w = 200, h = 100, text = '', color = 'black',
    fill = 'none', size = 's', align = 'middle', opacity = 1, dash = 'solid',
  } = {}) =>
    add({
      type,
      x, y, width: w, height: h,
      strokeColor: stroke(color),
      backgroundColor: fill === 'none' ? 'transparent' : (TINT[color] ?? TINT.grey),
      fillStyle: 'solid',
      strokeStyle: dash === 'dashed' ? 'dashed' : 'solid',
      strokeWidth: 1,
      roughness: 0,          // clean lines; 1 = the hand-drawn look
      roundness: { type: 3 },
      opacity: Math.round(opacity * 100),
      ...(text
        ? {
            label: {
              text,
              fontSize: FONT_SIZE[size] ?? 16,
              strokeColor: stroke('black'),
              textAlign: align === 'start' ? 'left' : align === 'end' ? 'right' : 'center',
              verticalAlign: 'middle',
            },
          }
        : {}),
    })

  return {
    elements,

    rect: shape('rectangle'),
    ellipse: shape('ellipse'),
    diamond: shape('diamond'),

    text({ x = 0, y = 0, text = '', color = 'black', size = 'm', width, opacity = 1 } = {}) {
      const fontSize = FONT_SIZE[size] ?? 20
      return add({
        type: 'text',
        x, y,
        text: wrapText(text, width, fontSize),
        fontSize,
        strokeColor: stroke(color),
        opacity: Math.round(opacity * 100),
        textAlign: 'left',
        verticalAlign: 'top',
      })
    },

    arrow({ from = { x: 0, y: 0 }, to = { x: 100, y: 100 }, text = '', color = 'black', size = 's', opacity = 1 } = {}) {
      return add({
        type: 'arrow',
        x: from.x,
        y: from.y,
        width: to.x - from.x,
        height: to.y - from.y,
        strokeColor: stroke(color),
        strokeWidth: 1,
        roughness: 0,
        opacity: Math.round(opacity * 100),
        ...(text ? { label: { text, fontSize: FONT_SIZE[size] ?? 16 } } : {}),
      })
    },

    shapes() {
      return elements
    },

    clear() {
      elements.length = 0
    },

    async save() {
      await fs.mkdir(path.dirname(SKELETON), { recursive: true })
      await fs.writeFile(SKELETON, JSON.stringify(elements, null, 2))
      return SKELETON
    },
  }
}
