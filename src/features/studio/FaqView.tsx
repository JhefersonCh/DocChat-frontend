import { useState } from 'react'
import type { FaqData, StudyGuideData, TermItem } from '@/domain/artifacts'
import { PageLink } from './PageLink'
import styles from './views.module.css'

export function FaqView({ data }: { data: FaqData }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <ul className={styles.list}>
      {data.items.map((it, i) => (
        <li key={i} className={styles.row}>
          <button type="button" className={styles.q} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {it.question}
          </button>
          {open === i && (
            <p className={styles.a}>{it.answer} <PageLink pageRef={it} /></p>
          )}
        </li>
      ))}
    </ul>
  )
}

function Terms({ title, items }: { title: string; items: TermItem[] }) {
  if (!items.length) return null
  return (
    <section className={styles.block}>
      <h4 className={styles.h}>{title}</h4>
      <dl className={styles.dl}>
        {items.map((t, i) => (
          <div key={i} className={styles.term}>
            <dt>{t.term}</dt>
            <dd>{t.definition} <PageLink pageRef={t} /></dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function GuideView({ data }: { data: StudyGuideData }) {
  return (
    <div className={styles.guide}>
      <Terms title="Conceptos clave" items={data.concepts} />
      <Terms title="Glosario" items={data.glossary} />
      {data.sections.length > 0 && (
        <section className={styles.block}>
          <h4 className={styles.h}>Resumen por sección</h4>
          {data.sections.map((s, i) => (
            <div key={i} className={styles.term}>
              <h5 className={styles.sub}>{s.title}</h5>
              <p className={styles.a}>{s.summary} <PageLink pageRef={s} /></p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
