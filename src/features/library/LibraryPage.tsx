import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import type { ApiClientError } from '@/api/client'
import type { LibraryFilters } from '@/domain/library'
import { KIND_ICON, KIND_LABEL } from '@/domain/sources'
import type { SourceKind } from '@/domain/types'
import { useProjects } from '@/features/projects/hooks'
import { ErrorNote } from '@/ui/ErrorNote'
import { CategoryBar } from './CategoryBar'
import { DocRow } from './DocRow'
import { ResultCard } from './ResultCard'
import { SelectionBar } from './SelectionBar'
import { useCategoryActions, useLibrary, useLibrarySearch } from './hooks'
import styles from './LibraryPage.module.css'

const KINDS: SourceKind[] = ['pdf', 'text', 'image', 'audio', 'video']
const EXAMPLES = ['presupuesto del año', 'un perro', 'zorro', 'contrato de arrendamiento']

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

/** The library: every document of every chat and project, filterable, with concept search across all of them. */
export function LibraryPage() {
  const [text, setText] = useState('')
  const query = useDebounced(text.trim(), 400)
  const [filters, setFilters] = useState<LibraryFilters>({})
  const [picked, setPicked] = useState<string[]>([])
  const projects = useProjects()
  const library = useLibrary(filters)
  const search = useLibrarySearch(query, filters)
  const { unassign } = useCategoryActions()
  const searching = query.length > 1

  const docs = useMemo(() => library.data ?? [], [library.data])
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const shown = searching ? [] : docs
  const results = search.data?.results ?? []
  const set = (next: Partial<LibraryFilters>) => setFilters((f) => ({ ...f, ...next }))

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <p className={styles.kicker}>Todos tus documentos</p>
          <h1 className={styles.title}>Biblioteca</h1>
        </header>

        <div className={styles.searchRow}>
          <label className={styles.search}>
            <span className={styles.glyph} aria-hidden="true">⌕</span>
            <input
              type="text" role="searchbox" className={styles.input} value={text} placeholder="Buscá por concepto: «presupuesto», «un perro», «zorro»…"
              aria-label="Buscar por concepto en todos los documentos" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setText('') }}
            />
            {text && <button type="button" className={styles.clear} aria-label="Borrar búsqueda" onClick={() => setText('')}>×</button>}
          </label>
          <div className={styles.filters}>
            <div className={styles.kinds} role="group" aria-label="Tipo de documento">
              <button type="button" className={styles.kind} data-on={!filters.kind} onClick={() => set({ kind: null })}>Todo</button>
              {KINDS.map((k) => (
                <button key={k} type="button" className={styles.kind} data-on={filters.kind === k} onClick={() => set({ kind: filters.kind === k ? null : k })}>
                  <span aria-hidden="true">{KIND_ICON[k]}</span> {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <select className={styles.select} value={filters.project_id ?? ''} aria-label="Filtrar por proyecto" onChange={(e) => set({ project_id: e.target.value || null })}>
              <option value="">Todos los proyectos</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <CategoryBar filters={filters} onFilters={setFilters} total={docs.length} />

        {searching ? (
          <section aria-live="polite" aria-label="Resultados de la búsqueda">
            {search.isFetching && <p className={styles.state} role="status">Buscando en {docs.length} documentos…</p>}
            {search.error && <ErrorNote error={search.error as ApiClientError} handlers={{ retry: () => void search.refetch() }} />}
            {search.data && !search.isFetching && (
              <p className={styles.state}>
                {results.length === 0 ? 'Ningún documento parece tratar de eso.' : `${results.length} ${results.length === 1 ? 'documento' : 'documentos'} para «${search.data.query}», por relevancia`}
                {' · '}{search.data.searched} buscados{search.data.skipped_unready > 0 && `, ${search.data.skipped_unready} aún sin indexar`}
              </p>
            )}
            {search.data?.notes.map((n) => <p key={n} className={styles.warn} role="status">{n}</p>)}
            <ol className={styles.results}>
              <AnimatePresence initial={false}>
                {results.map((r, i) => <ResultCard key={r.document.id} rank={i + 1} result={r} selected={picked.includes(r.document.id)} onToggle={() => toggle(r.document.id)} />)}
              </AnimatePresence>
            </ol>
          </section>
        ) : (
          <section aria-label="Documentos">
            {library.error && <ErrorNote error={library.error as ApiClientError} handlers={{ retry: () => void library.refetch() }} />}
            {library.data && shown.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>{docs.length === 0 && !filters.kind && !filters.category_id && !filters.project_id && !filters.uncategorized ? 'La biblioteca está vacía.' : 'Ningún documento con estos filtros.'}</p>
                <p className={styles.state}>Probá una búsqueda por concepto: {EXAMPLES.map((e) => <button key={e} type="button" className={styles.example} onClick={() => setText(e)}>{e}</button>)}</p>
              </div>
            )}
            <ul className={styles.list} aria-label="Lista de documentos">
              {shown.map((d) => (
                <DocRow key={d.id} doc={d} selected={picked.includes(d.id)} onToggle={() => toggle(d.id)} onUnassign={(categoryId) => unassign.mutate({ id: categoryId, documentIds: [d.id] })} />
              ))}
            </ul>
          </section>
        )}
        {unassign.error && <ErrorNote error={unassign.error as ApiClientError} />}
        <AnimatePresence>{picked.length > 0 && <SelectionBar ids={picked} onClear={() => setPicked([])} />}</AnimatePresence>
      </div>
    </div>
  )
}
