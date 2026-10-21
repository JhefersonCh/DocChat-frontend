// Single place that configures the pdf.js worker (react-pdf 11 docs, "Import worker").
// pdfjs-dist is a transitive dep of react-pdf (pinned 6.3.289); resolved via hoisting.
// Import `pdfjs`/components from 'react-pdf' in the same module graph AFTER this file.
import { pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export { pdfjs }
