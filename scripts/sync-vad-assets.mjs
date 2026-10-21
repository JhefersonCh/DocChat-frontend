// Copies the VAD runtime (silero model, audio worklet, onnxruntime wasm) to public/vad so it is
// served same-origin and only downloaded when the user enables voice mode. Runs before dev/build.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'vad')
const files = [
  ['node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx'],
  ['node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'],
]
mkdirSync(out, { recursive: true })
for (const [src] of files) copyFileSync(join(root, src), join(out, src.split('/').pop()))
console.log(`vad assets -> public/vad (${files.length} files)`)
