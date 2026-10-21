const STOP = new Set(['El', 'La', 'Los', 'Las', 'Este', 'Esta', 'Estos', 'Estas', 'Un', 'Una', 'En', 'Se', 'Su', 'Sus', 'Al', 'Del', 'Por', 'Con', 'Para', 'Como', 'Cuando', 'Donde', 'También', 'Además', 'Según', 'Sin', 'Entre', 'Desde', 'Hasta'])
const NAME = /(?<![.!?¿¡]\s)(?<!^)\p{Lu}\p{Ll}{2,}(?:\s\p{Lu}\p{Ll}+)*/gu

/** Voices worth offering: always "el autor", plus up to 4 proper names found in the document overview. */
export function personaSuggestions(summary: string | null | undefined): string[] {
  const names = (summary ?? '').match(NAME) ?? []
  const unique = [...new Set(names.filter((n) => !STOP.has(n)))].slice(0, 4)
  return ['el autor', ...unique]
}

export const MAX_PERSONA = 120
