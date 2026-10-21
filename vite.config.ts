import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vitest/config'

// https://vite.dev/config/
// onnxruntime-web `import()`s its loader from /vad/*.mjs at runtime; Vite's dev server answers any
// `?import` of a /public file with a 500. Serve those files raw instead (a plain static file in build).
const vadRuntime: Plugin = {
  name: 'vad-runtime-raw',
  configureServer(server) {
    server.middlewares.use('/vad', (req, res, next) => {
      const name = (req.url ?? '').split('?')[0]!.replace(/^\//, '')
      if (!/^[\w.-]+\.mjs$/.test(name)) return next()
      res.setHeader('content-type', 'text/javascript')
      res.end(readFileSync(new URL(`./node_modules/onnxruntime-web/dist/${name}`, import.meta.url)))
    })
  },
}

export default defineConfig({
  plugins: [react(), vadRuntime],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Same-origin to the browser -> no CORS change in the backend.
    // http-proxy does not compress or buffer, so SSE streams flow through.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // pdf.js (~640 kB) is already a lazy chunk (PdfViewer); everything else stays well under the default.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 3 },
            { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/, priority: 3 },
            {
              name: 'markdown',
              test: /node_modules[\\/](react-markdown|unified|bail|trough|is-plain-obj|vfile|vfile-message|devlop|property-information|space-separated-tokens|comma-separated-tokens|html-url-attributes|style-to-js|style-to-object|inline-style-parser|(remark|rehype|mdast|hast|micromark|unist|decode-named)[\w-]*)[\\/]/,
              priority: 3,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
