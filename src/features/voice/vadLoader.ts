/** The only importer of the VAD runtime: a separate lazy chunk, fetched when voice mode is first enabled. */
export const loadVad = () => import('@ricky0123/vad-web')
