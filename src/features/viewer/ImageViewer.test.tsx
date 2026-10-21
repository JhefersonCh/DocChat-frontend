// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Citation } from '@/domain/types'
import { doc } from '@/test/fixtures'
import { BBoxOverlay } from './BBoxOverlay'
import { ImageViewer } from './ImageViewer'

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
})
afterEach(cleanup)

const tile: Citation = {
  n: 0, origin: 'inspector', document_id: 'd1', filename: 'gato.jpg', page: null, page_end: null, snippet: '', chunk_id: 't1', content: '',
  kind: 'image', bbox: [0, 0, 0.5, 0.5], has_thumb: true,
}

describe('BBoxOverlay', () => {
  it('positions the frame with percentages of the page box (zoom independent)', () => {
    const { container } = render(<BBoxOverlay rect={{ x: 0.1, y: 0.2, w: 0.4, h: 0.3 }} />)
    const box = container.querySelector<HTMLElement>('[data-bbox]')!
    expect(box.style.left).toBe('10%')
    expect(box.style.top).toBe('20%')
    expect(box.style.width).toBe('40%')
    expect(box.style.height).toBe('30%')
  })
})

describe('ImageViewer', () => {
  const d = doc({ kind: 'image', filename: 'gato.jpg', width: 1600, height: 1200, page_count: null })
  it('shows the original, fits it, zooms with the buttons and resets with Ajustar', () => {
    render(<ImageViewer doc={d} citation={null} seq={0} onTrace={vi.fn()} />)
    const img = screen.getByRole('img', { name: 'gato.jpg' })
    expect(img.getAttribute('src')).toBe('/api/v1/documents/d1/file')
    fireEvent.load(img)
    expect(screen.getByText('100%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }))
    expect(screen.getByText('125%')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar' }))
    expect(screen.getByText('100%')).toBeTruthy()
  })
  it('a tile citation draws the region frame, zooms into it and reports a "bbox" trace', () => {
    const onTrace = vi.fn()
    const { container } = render(<ImageViewer doc={d} citation={tile} seq={1} onTrace={onTrace} />)
    fireEvent.load(screen.getByRole('img', { name: 'gato.jpg' }))
    expect(container.querySelector('[data-bbox]')).toBeTruthy()
    expect(Number.parseInt(screen.getByText(/%$/).textContent ?? '0', 10)).toBeGreaterThan(100)
    expect(onTrace).toHaveBeenCalledWith(1, expect.objectContaining({ quality: 'bbox' }))
  })
  it('a whole-image citation paints no frame', () => {
    const { container } = render(<ImageViewer doc={d} citation={{ ...tile, bbox: [0, 0, 1, 1] }} seq={1} onTrace={vi.fn()} />)
    fireEvent.load(screen.getByRole('img', { name: 'gato.jpg' }))
    expect(container.querySelector('[data-bbox]')).toBeNull()
  })
})
