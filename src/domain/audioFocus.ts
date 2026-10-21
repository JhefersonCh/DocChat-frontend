// Shared audio focus: only one thing makes sound at a time (viewer player, citation preview, TTS voice).
// Each source registers how to silence itself; whoever starts calls `takeFocus` and the others stop.

type Silence = () => void

const holders = new Map<string, Silence>()

/** Registers a source; returns the unregister function. Re-registering an id replaces its callback. */
export function joinFocus(id: string, silence: Silence): () => void {
  holders.set(id, silence)
  return () => { if (holders.get(id) === silence) holders.delete(id) }
}

/** `id` is about to play: every other registered source is silenced. */
export function takeFocus(id: string): void {
  for (const [other, silence] of [...holders]) if (other !== id) silence()
}
