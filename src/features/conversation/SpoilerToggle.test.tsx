// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createReadingStore, ReadingContext } from '@/features/viewer/reading'
import { SpoilerToggle } from './SpoilerToggle'

afterEach(cleanup)

describe('SpoilerToggle', () => {
  it('shows "Hasta pág. N" live as the viewer page changes and sends it as max_page only while on', async () => {
    const store = createReadingStore({ page: 4 })
    render(<ReadingContext.Provider value={store}><SpoilerToggle /></ReadingContext.Provider>)
    const toggle = screen.getByRole('switch', { name: /Solo lo que leí/ })
    expect(store.maxPage()).toBeNull()
    expect(screen.queryByText(/Hasta pág/)).toBeNull()

    await userEvent.click(toggle)
    expect(screen.getByText('Hasta pág. 4')).toBeTruthy()
    expect(store.maxPage()).toBe(4)

    act(() => store.setPage(9)) // the reader scrolls on
    expect(screen.getByText('Hasta pág. 9')).toBeTruthy()
    expect(store.maxPage()).toBe(9)

    await userEvent.click(toggle)
    expect(store.maxPage()).toBeNull()
  })

  it('is disabled for documents without pages', () => {
    render(<ReadingContext.Provider value={createReadingStore({ spoilerSafe: true })}><SpoilerToggle /></ReadingContext.Provider>)
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByText(/Hasta pág/)).toBeNull()
  })
})
