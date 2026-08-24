// Regenerates the board skeleton into public/skeleton.json.
// Then run window.buildFromSkeleton() on http://localhost:5200 to expand and save.

import { openSpace } from './space.mjs'
import { drawDemo } from './board-demo.mjs'

const space = await openSpace()
space.clear()
drawDemo(space)

console.log('skeleton elements:', space.shapes().length)
console.log('saved:', await space.save())
