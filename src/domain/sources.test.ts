import { describe, expect, it } from 'vitest'
import { doc } from '@/test/fixtures'
import { citationAlias, mergeFresh, readable, resolveTab, sourceStatus, sourcesOf, sourcesTitle, tabForCitation, toggleActive, withAlias } from './sources'
import type { Source } from './types'

const src = (id: string, alias: string, over: Partial<Source> = {}): Source => ({ ...doc({ id, filename: `${id}.pdf` }), alias, active: true, ...over })
const S = [src('a', 'S1'), src('b', 'S2'), src('c', 'S3')]

describe('sourcesOf', () => {
  it('uses `sources` when the backend sends them', () => {
    expect(sourcesOf({ sources: S, document: doc() })).toBe(S)
  })
  it('a payload from before phase 7 (only `document`) is a single source S1', () => {
    expect(sourcesOf({ document: doc({ id: 'x' }), sources: undefined })).toMatchObject([{ id: 'x', alias: 'S1', active: true }])
    expect(sourcesOf({ document: null, sources: undefined })).toEqual([])
    expect(sourcesOf(null)).toEqual([])
  })
  it('honours the muted list of an old payload', () => {
    expect(sourcesOf({ document: doc({ id: 'x' }), sources: undefined, disabled_sources: ['x'] })[0]!.active).toBe(false)
  })
})

describe('citation routing', () => {
  it('a citation switches the tab to its own source, and only when that is not the current one', () => {
    expect(tabForCitation(S, 'a', { document_id: 'c' })).toBe('c')
    expect(tabForCitation(S, 'c', { document_id: 'c' })).toBeNull()
    expect(tabForCitation(S, 'a', { document_id: 'gone' })).toBeNull() // a removed source has no tab
    expect(tabForCitation(S, 'a', null)).toBeNull()
  })
  it('the alias comes from the current sources, falling back to the persisted one; none in single-source chats', () => {
    expect(citationAlias(S, { document_id: 'b', source_alias: 'S9' })).toBe('S2')
    expect(citationAlias(S, { document_id: 'gone', source_alias: 'S5' })).toBe('S5')
    expect(citationAlias([S[0]!], { document_id: 'a', source_alias: 'S1' })).toBeNull()
  })
  it('labels a locator with its alias', () => {
    expect(withAlias('S2', 'pág. 3')).toBe('S2 · pág. 3')
    expect(withAlias(null, 'pág. 3')).toBe('pág. 3')
    expect(withAlias('S2', null)).toBe('S2')
  })
})

describe('tab and selection state', () => {
  it('keeps the current tab, else the first ready source, else the first', () => {
    expect(resolveTab(S, 'b')).toBe('b')
    expect(resolveTab(S, 'gone')).toBe('a')
    expect(resolveTab([src('p', 'S1', { status: 'processing' }), src('r', 'S2')], null)).toBe('r')
    expect(resolveTab([src('p', 'S1', { status: 'processing' })], null)).toBe('p')
    expect(resolveTab([], null)).toBeNull()
  })
  it('toggling returns the new active ids, and never turns the last one off', () => {
    expect(toggleActive(S, 'b')).toEqual(['a', 'c'])
    expect(toggleActive([src('a', 'S1', { active: false }), src('b', 'S2')], 'a')).toEqual(['a', 'b'])
    expect(toggleActive([src('a', 'S1')], 'a')).toBeNull()
  })
  it('a question reads the ready and active sources only', () => {
    expect(readable([src('a', 'S1'), src('b', 'S2', { active: false }), src('c', 'S3', { status: 'failed' })]).map((s) => s.id)).toEqual(['a'])
  })
})

describe('source state', () => {
  it('summarises progress, failure and quiet sources', () => {
    expect(sourceStatus(doc({ status: 'ready' }))).toBeNull()
    expect(sourceStatus(doc({ status: 'failed' }))).toBe('falló')
    expect(sourceStatus(doc({ status: 'pending' }))).toBe('en cola')
    expect(sourceStatus(doc({ status: 'processing', progress: { done: 3, total: 10 }, stage: 'embedding' }))).toBe('Indexando 3/10')
    expect(sourceStatus(doc({ status: 'ready', enrich_status: 'running', progress: { done: 1, total: 4 }, stage: 'describing' }))).toBe('Describiendo imágenes 1/4')
  })
  it('polling brings fresher documents without losing alias / active', () => {
    const merged = mergeFresh(S, { b: doc({ id: 'b', status: 'processing' }) })
    expect(merged[1]).toMatchObject({ id: 'b', status: 'processing', alias: 'S2', active: true })
    expect(merged[0]).toBe(S[0])
  })
  it('titles the chat like the backend', () => {
    expect(sourcesTitle([])).toBe('')
    expect(sourcesTitle(['a.pdf'])).toBe('a.pdf')
    expect(sourcesTitle(['a', 'b', 'c'])).toBe('3 fuentes')
  })
})
