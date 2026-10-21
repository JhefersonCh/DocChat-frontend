import { memo, useEffect, useMemo, type ComponentProps } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveRefs } from '@/domain/citations'
import type { Citation } from '@/domain/types'
import { CitationChip } from './CitationChip'
import { rehypeRich } from './richText'
import styles from './AssistantText.module.css'

const remember = (seen: { words: number }, words: number) => { seen.words = words }

interface Props {
  text: string
  citations: Citation[]
  /** Streaming: new words play the reveal. History renders plain. */
  reveal: boolean
}

// Model output is untrusted: no <img> (would fetch any URL the model writes), links leave the app safely.
const REMARK_PLUGINS = [remarkGfm]

const STATIC_COMPONENTS: Components = {
  img: ({ alt }) => (alt ? <span>{alt}</span> : null),
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
  // Wide tables scroll inside their own box, never the page; focusable so the keyboard can scroll it.
  table: ({ node: _node, ...props }) => (
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Tabla (desplazable)">
      <table {...props} />
    </div>
  ),
}

/** Markdown over the accumulated text; partial markdown just re-parses on each token (plan §11). */
export const AssistantText = memo(function AssistantText({ text, citations, reveal }: Props) {
  // Words already on screen. Mutated after commit, read while building the next render's plugin.
  const seen = useMemo(() => ({ words: 0 }), [])
  // The plugin only depends on the text while revealing: history (reveal off) keeps one stable instance.
  const rich = useMemo(() => {
    const stat = { words: 0 }
    return { stat, plugins: [rehypeRich({ reveal, seenWords: seen.words, stat })] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, reveal ? text : null, seen])
  useEffect(() => remember(seen, reveal ? rich.stat.words : 0))

  const components = useMemo<Components>(() => ({
    ...STATIC_COMPONENTS,
    span: ({ node: _node, ...props }: ComponentProps<'span'> & { node?: unknown }) => {
      const refs = (props as Record<string, unknown>)['data-cite']
      if (typeof refs !== 'string') return <span {...props} />
      const nums = citations.map((c) => c.n)
      return <>{resolveRefs(refs, nums).map(({ n, known }) => {
        const c = known ? citations.find((x) => x.n === n) : undefined
        return c
          ? <CitationChip key={n} citation={c} group={citations} />
          : <span key={n} className={styles.orphan} title="Sin fuente asociada">[{n}]</span>
      })}</>
    },
  }), [citations])

  return (
    <div className={styles.prose}>
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={rich.plugins} components={components}>{text}</Markdown>
    </div>
  )
})
