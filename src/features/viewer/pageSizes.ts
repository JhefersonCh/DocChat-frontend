/** The slice of pdf.js's `PDFDocumentProxy` we need (keeps this testable without a worker). */
export interface SizedDocument {
  numPages: number
  getPage(n: number): Promise<{ getViewport(o: { scale: number }): { width: number; height: number } }>
}

const BATCH = 8

/**
 * Height/width of every page at scale 1, WITHOUT rendering anything (page metadata is cheap).
 * Placeholders use exactly these ratios, so a sheet never changes size when its canvas mounts.
 * Fetched in small parallel batches so a 400-page file doesn't flood the worker.
 */
export async function loadPageSizes(pdf: SizedDocument, isCancelled: () => boolean = () => false) {
  const sizes: { width: number; height: number }[] = new Array(pdf.numPages)
  for (let from = 1; from <= pdf.numPages; from += BATCH) {
    const ns = Array.from({ length: Math.min(BATCH, pdf.numPages - from + 1) }, (_, i) => from + i)
    await Promise.all(ns.map(async (n) => {
      const { width, height } = (await pdf.getPage(n)).getViewport({ scale: 1 })
      sizes[n - 1] = { width, height }
    }))
    if (isCancelled()) return null
  }
  return sizes
}
