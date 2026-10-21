import { Suspense, lazy, type ReactNode } from 'react'
import { segmentAssetUrl } from '@/api/media'
import type { Slide } from '@/domain/artifacts'
import { splitColumns } from '@/domain/slides'
import styles from './slides.module.css'

const ChartView = lazy(() => import('../ChartView'))

interface Props {
  slide: Slide
  /** 1-based position and total, shown bottom-right. */
  index: number
  total: number
  deckTitle: string
  /** Citation chips (viewer / presenter) or plain text (print). */
  sources?: ReactNode
  className?: string
}

function Bullets({ items }: { items: string[] }) {
  return <ul className={styles.bullets}>{items.map((b, i) => <li key={i}>{b}</li>)}</ul>
}

function Visual({ slide }: { slide: Slide }) {
  const v = slide.visual
  if (!v) return null
  if (v.kind === 'image') {
    return <figure className={styles.media}><img src={segmentAssetUrl(v.segment_id)} alt={v.caption || slide.title} loading="lazy" /></figure>
  }
  return (
    <figure className={`${styles.media} ${styles.chartBox}`}>
      <Suspense fallback={null}><ChartView data={{ chart: v.spec }} bare /></Suspense>
    </figure>
  )
}

function Body({ slide }: { slide: Slide }) {
  const [left, right] = splitColumns(slide.bullets)
  switch (slide.layout) {
    case 'title':
    case 'closing':
      return (
        <div className={styles.cover}>
          <span className={styles.rule} aria-hidden="true" />
          <h3 className={styles.coverTitle}>{slide.title}</h3>
          {slide.bullets.length > 0 && <p className={styles.coverSub}>{slide.bullets.join(' · ')}</p>}
        </div>
      )
    case 'quote':
      return (
        <div className={styles.quote}>
          <span className={styles.mark} aria-hidden="true">“</span>
          <blockquote>{slide.bullets[0]}</blockquote>
          <p className={styles.attr}>{slide.title}</p>
        </div>
      )
    case 'two_column':
      return (
        <>
          <h3 className={styles.title}>{slide.title}</h3>
          <div className={styles.cols}><Bullets items={left} /><Bullets items={right} /></div>
        </>
      )
    case 'image':
    case 'chart':
      return (
        <>
          <h3 className={styles.title}>{slide.title}</h3>
          <div className={styles.split}><Bullets items={slide.bullets} /><Visual slide={slide} /></div>
        </>
      )
    default:
      return (
        <>
          <h3 className={styles.title}>{slide.title}</h3>
          <div className={slide.visual ? styles.split : undefined}><Bullets items={slide.bullets} /><Visual slide={slide} /></div>
        </>
      )
  }
}

/** One 16:9 slide. Everything is sized in container units (cqw), so thumbnails, the viewer, the presenter and print share it. */
export function SlideStage({ slide, index, total, deckTitle, sources, className }: Props) {
  return (
    <div className={[styles.stage, className].filter(Boolean).join(' ')} data-layout={slide.layout}>
      <div className={styles.body}><Body slide={slide} /></div>
      <div className={styles.foot}>
        <span className={styles.deckName}>{deckTitle}</span>
        <span className={styles.sources}>{sources}</span>
        <span className={styles.count}>{index} / {total}</span>
      </div>
    </div>
  )
}
