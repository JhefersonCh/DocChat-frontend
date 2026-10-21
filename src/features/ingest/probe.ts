/**
 * Does this file have a video track? `.webm` holds voice recordings and videos alike and the backend tells them
 * apart by MIME, so the dropzone asks the browser. null = could not tell (undecodable / timed out): keep the guess.
 */
export function hasVideoTrack(file: File, timeoutMs = 4000): Promise<boolean | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    const done = (v: boolean | null) => { window.clearTimeout(timer); el.removeAttribute('src'); el.load(); URL.revokeObjectURL(url); resolve(v) }
    const timer = window.setTimeout(() => done(null), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => done(el.videoWidth > 0)
    el.onerror = () => done(null)
    el.src = url
  })
}
