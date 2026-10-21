// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Thumb } from './Thumb'

afterEach(cleanup)

describe('Thumb', () => {
  it('is a lazy image from the segment thumb endpoint inside a fixed-aspect box (no layout shift)', () => {
    const { container } = render(<Thumb chunkId="c1" alt="Imagen · pág. 3" width={96} />)
    const img = screen.getByRole('img', { name: 'Imagen · pág. 3' })
    expect(img.getAttribute('src')).toBe('/api/v1/segments/c1/thumb')
    expect(img.getAttribute('loading')).toBe('lazy')
    const box = container.firstElementChild as HTMLElement
    expect(box.style.aspectRatio).toBe('4 / 3')
    expect(box.style.width).toBe('96px')
    expect(box.dataset.state).toBe('loading')
    fireEvent.load(img)
    expect(box.dataset.state).toBe('ok')
  })
  it('falls back to a quiet glyph when the thumbnail is gone', () => {
    render(<Thumb chunkId="c1" alt="Figura" />)
    fireEvent.error(screen.getByRole('img', { name: 'Figura' }))
    expect(screen.getByRole('img', { name: 'Figura (no disponible)' })).toBeTruthy()
  })
})
