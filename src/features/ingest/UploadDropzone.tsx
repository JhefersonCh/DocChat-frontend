import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { ApiClientError } from '@/api/client'
import { ACCEPT_ATTR, ACCEPT_LEGEND, asAudioWebm, isAudioFile, isImageFile, isVideoFile, isWebm, prepareUpload } from '@/domain/ingest'
import type { ErrorAction } from '@/domain/errors'
import { PasteTextModal } from '@/features/sources/PasteTextModal'
import { isTextEntry } from '@/domain/pasteText'
import { ErrorNote } from '@/ui/ErrorNote'
import { useUploadDocument } from './hooks'
import { hasVideoTrack } from './probe'
import styles from './UploadDropzone.module.css'

interface Props {
  chatId: string
  /** Re-upload over a failed document (backend replaces it). */
  replacing?: boolean
  handlers?: Partial<Record<ErrorAction, () => void>>
}

export function UploadDropzone({ chatId, replacing, handlers }: Props) {
  const upload = useUploadDocument(chatId)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [local, setLocal] = useState<ApiClientError | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const [prefill, setPrefill] = useState('')

  // Ctrl/Cmd+V on the empty dropzone (outside any input) opens the paste modal prefilled.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (pasting || upload.isPending || isTextEntry(e.target) || (e.clipboardData?.files.length ?? 0) > 0) return
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (!text.trim()) return
      e.preventDefault(); setPrefill(text); setPasting(true)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [pasting, upload.isPending])

  async function pick(files: FileList | null) {
    setNote(null)
    const file = files?.[0]
    if (!file) return
    const prepared = prepareUpload(file)
    if (!prepared.ok) {
      setLocal({ code: prepared.code, message: '', status: 415 } as ApiClientError)
      return
    }
    setLocal(null)
    let ready = prepared.file
    if (isWebm(ready) && (await hasVideoTrack(ready)) === false) ready = asAudioWebm(ready)
    if ((files?.length ?? 0) > 1) setNote('Un documento por chat: se subió solo el primero.')
    else if (isImageFile(ready)) setNote('Imagen: se indexa en el momento y después se describe con el perfil de visión.')
    else if (isVideoFile(ready)) setNote('Video: se extraen fotogramas en los cortes de escena (se describen con el perfil de visión) y su audio se transcribe; puede tardar según la duración.')
    else if (isAudioFile(ready)) setNote('Audio: se transcribe por ventanas de unos 20 s con el perfil de voz a texto; puede tardar según la duración.')
    upload.mutate(ready)
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files) }
  const error = local ?? (upload.error as ApiClientError | null)
  const busy = upload.isPending

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.zone} ${over ? styles.over : ''}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <span className={styles.corner} data-pos="tl" aria-hidden="true" />
        <span className={styles.corner} data-pos="tr" aria-hidden="true" />
        <span className={styles.corner} data-pos="bl" aria-hidden="true" />
        <span className={styles.corner} data-pos="br" aria-hidden="true" />
        <span className={styles.head}>{busy ? 'Enviando…' : over ? 'Soltalo acá' : replacing ? 'Subí otro archivo' : 'Soltá un PDF, TXT, MD, una imagen, un audio o un video'}</span>
        <span className={styles.sub}>{busy ? 'subiendo al backend' : 'o hacé click para elegir · un documento por chat'}</span>
        <span className={styles.accept}>{ACCEPT_LEGEND}</span>
      </button>
      <input
        ref={input} type="file" hidden accept={ACCEPT_ATTR}
        onChange={(e) => { void pick(e.target.files); e.target.value = '' }}
      />
      <button type="button" className={styles.paste} disabled={busy} onClick={() => { setPrefill(''); setPasting(true) }}>o pegar texto</button>
      <PasteTextModal
        open={pasting} initialText={prefill} busy={busy} onClose={() => setPasting(false)}
        onSubmit={(file) => { setLocal(null); setNote(null); upload.mutate(file, { onSettled: () => setPasting(false) }) }}
      />
      {note && <p className={styles.note} role="status">{note}</p>}
      {error && <ErrorNote error={error} handlers={handlers} />}
    </div>
  )
}
