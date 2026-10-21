// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Citation } from '@/domain/types'
import { TraceBar } from './TraceBar'

const base: Citation = { n: 0, document_id: 'd', filename: 'a.pdf', page: 5, page_end: 5, snippet: '', chunk_id: null, content: null }

afterEach(cleanup)

describe('TraceBar origin', () => {
  it('studio link: "estudio · pág. N", no "cita antigua"', () => {
    render(<TraceBar citation={{ ...base, origin: 'studio' }} quality="page-only" />)
    expect(screen.getByText('estudio · pág. 5')).toBeTruthy()
    expect(screen.queryByText(/cita antigua/)).toBeNull()
  })
  it('search hit: "búsqueda"', () => {
    render(<TraceBar citation={{ ...base, origin: 'search', content: 'x' }} quality="exact" />)
    expect(screen.getByText('búsqueda · pág. 5')).toBeTruthy()
  })
  it('video: "video · 01:20" for a frame, "video · 01:20–01:40" for the speech of a video source', () => {
    const video = { ...base, page: null, n: 1, chunk_id: null, content: 'x', kind: 'video' as const, t_start: 80, t_end: null }
    const { unmount } = render(<TraceBar citation={video} quality="time" />)
    expect(screen.getByText('[1] · video · 01:20')).toBeTruthy()
    unmount()
    render(<TraceBar citation={{ ...video, kind: 'audio', source_kind: 'video', t_end: 100 }} quality="time" />)
    expect(screen.getByText('[1] · video · 01:20–01:40')).toBeTruthy()
  })
  it('stays one line: the full text rides in the tooltip, the label ellipsizes', () => {
    render(<TraceBar citation={{ ...base, n: 3, section: 'Una sección muy larga '.repeat(8), content: 'x', chunk_id: 'abcd1234' }} quality="page-only" />)
    const bar = screen.getByRole('status')
    expect(bar.getAttribute('title')).toContain('chunk abcd')
    expect(bar.getAttribute('title')).toContain('Una sección muy larga')
  })
  it('old answer citation without content keeps the legacy note', () => {
    render(<TraceBar citation={{ ...base, n: 2 }} quality="page-only" />)
    expect(screen.getByText(/cita antigua/)).toBeTruthy()
  })
})
