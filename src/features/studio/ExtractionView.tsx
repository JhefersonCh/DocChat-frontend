import type { ExtractionData } from '@/domain/artifacts'
import { toCsv } from '@/domain/studio'
import { Button } from '@/ui/Button'
import { PageLink } from './PageLink'
import styles from './views.module.css'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ExtractionView({ data }: { data: ExtractionData }) {
  return (
    <div className={styles.extract}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr>{data.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {data.columns.map((c) => {
                  const cell = row[c]
                  return (
                    <td key={c} title={cell?.quote ? `“${cell.quote}”` : undefined}>
                      {cell?.value ?? <span className={styles.none}>—</span>}
                      {cell?.value && <PageLink pageRef={cell} quote={cell.quote} />}
                      {cell?.quote && <q className={styles.quote}>{cell.quote}</q>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={() => download('extraccion.csv', toCsv(data.columns, data.rows))}>Exportar CSV</Button>
    </div>
  )
}
