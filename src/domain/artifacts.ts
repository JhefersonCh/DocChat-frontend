export type ArtifactKind = 'faq' | 'study_guide' | 'quiz' | 'flashcards' | 'mind_map' | 'chart' | 'extraction' | 'audit' | 'entity_graph' | 'rubric' | 'timeline' | 'slides' | 'concept_map'
export type ArtifactStatus = 'pending' | 'ready' | 'failed'

/** Where an item comes from: the page (null in TXT/MD or when the model's page was not real) + its chunk. */
export interface PageRef { page: number | null; chunk_id: string | null; /** Source of the chunk in a multi-source chat. */ document_id?: string | null }

export interface Artifact {
  id: string
  kind: ArtifactKind
  status: ArtifactStatus
  options: { request?: string; columns?: string[]; preset?: RubricPreset; slides?: number; audience?: string; style?: SlideStyle; focus?: string; depth?: number; max_nodes?: number }
  data: unknown
  error: string | null
  created_at: string
}

export interface FaqData { items: (PageRef & { question: string; answer: string })[] }
export interface TermItem extends PageRef { term: string; definition: string }
export interface StudyGuideData {
  concepts: TermItem[]
  glossary: TermItem[]
  sections: (PageRef & { title: string; summary: string })[]
}
export interface QuizQuestion extends PageRef { question: string; options: string[]; answer_index: number; explanation: string }
export interface QuizData { questions: QuizQuestion[] }
export interface FlashcardsData { cards: (PageRef & { front: string; back: string })[] }
export interface MindNode extends PageRef { title: string; children: MindNode[] }
export interface MindMapData { root: MindNode }
export interface ChartSpec extends PageRef {
  type: 'bar' | 'line' | 'pie'
  title: string
  labels: string[]
  series: { name: string; values: number[] }[]
}
export interface ChartData { chart: ChartSpec | null; message?: string }
export interface Cell extends PageRef { value: string | null; quote: string | null }
export interface ExtractionData { columns: string[]; rows: Record<string, Cell>[] }

export type RubricPreset = 'plan_negocios' | 'articulo_academico' | 'ensayo' | 'general'
export const RUBRIC_PRESETS: { value: RubricPreset; label: string }[] = [
  { value: 'plan_negocios', label: 'Plan de negocios' },
  { value: 'articulo_academico', label: 'Artículo académico' },
  { value: 'ensayo', label: 'Ensayo' },
  { value: 'general', label: 'General' },
]

/** A claim with its verbatim passage: `quote` was found in the chunk, so it can be highlighted in the PDF. */
export interface Evidence extends PageRef { quote: string; value?: number }
export interface AuditFinding {
  type: 'sum_mismatch' | 'percent_total' | 'conflicting_values' | 'scale_mismatch' | 'unit_mismatch'
  severity: 'high' | 'medium' | 'low'
  message: string
  evidence: Evidence[]
  expected?: number
  actual?: number
}
export interface AuditData {
  findings: AuditFinding[]
  facts_count: number
  checked_groups: number
  checked: { sum_groups?: number; percent_groups?: number; repeated_metrics?: number }
  message: string
}

export type EntityType = 'persona' | 'organización' | 'lugar' | 'concepto' | 'objeto' | 'evento'
export const TYPE_COLOR: Record<EntityType, string> = {
  persona: '#FFB000', 'organización': '#6FCF97', lugar: '#7AA2F7', concepto: '#C792EA', objeto: '#9AA3AD', evento: '#FF6B5E',
}
export interface GraphEntity extends PageRef { id: string; name: string; type: EntityType; description: string; aliases: string[] }
export interface GraphRelation extends PageRef { source: string; target: string; label: string; quote: string }
export interface EntityGraphData { entities: GraphEntity[]; relations: GraphRelation[] }

export type RubricStatus = 'cumple' | 'parcial' | 'no_encontrado'
export interface RubricCriterion extends PageRef {
  id: string
  label: string
  status: RubricStatus
  justification: string
  quote: string | null
  suggestion: string | null
}
export interface RubricData {
  preset: RubricPreset
  preset_label: string
  criteria: RubricCriterion[]
  summary: Record<RubricStatus, number>
}

export interface TimelineEvent extends PageRef {
  date_text: string
  date_iso: string | null
  title: string
  description: string
  quote: string
}
export interface TimelineData { events: TimelineEvent[]; ordered_by: 'date' | 'document' | null; message?: string }

export type SlideStyle = 'ejecutiva' | 'académica' | 'didáctica'
export const SLIDE_STYLES: SlideStyle[] = ['ejecutiva', 'académica', 'didáctica']
export type SlideLayout = 'title' | 'bullets' | 'two_column' | 'image' | 'chart' | 'quote' | 'closing'
/** A quote verified against its chunk: located by page (documents) or time (audio / video). */
export interface SlideRef {
  quote: string
  page: number | null
  t_start: number | null
  t_end: number | null
  /** Region of the page / image the quote sits in (normalized 0-1); media segments only. */
  bbox?: [number, number, number, number] | null
  kind: 'text' | 'audio' | 'video' | 'image'
  chunk_id: string | null
  document_id: string | null
}
export type SlideVisual =
  | { kind: 'image'; segment_id: string; caption: string; page: number | null; t_start: number | null; document_id: string | null }
  | { kind: 'chart'; spec: ChartSpec }
export interface Slide { layout: SlideLayout; title: string; bullets: string[]; notes: string; refs: SlideRef[]; visual: SlideVisual | null }
export interface SlidesData { title: string; subtitle: string; style: SlideStyle; audience: string | null; slides: Slide[] }
/** POST /chats/{id}/artifacts/slides/assess */
export interface SlidesAssessment { suitable: boolean; score: number; reasons: string[]; recommended_slides: number; audience: string | null; outline_hint: string[] }

/** Concept map (Novak): concepts joined by labeled links; every node and link carries verified refs. */
export interface ConceptNode { id: string; label: string; summary: string; level: number; kind: 'concepto' | 'ejemplo'; aliases?: string[]; refs: SlideRef[] }
export interface ConceptLink { id: string; source: string; target: string; label: string; kind: 'jerarquia' | 'cruce'; refs: SlideRef[] }
export interface ConceptMapData { root_id: string; nodes: ConceptNode[]; links: ConceptLink[] }
/** POST /chats/{id}/artifacts/{artifact_id}/expand */
export interface ExpandResult { artifact: Artifact; added_nodes: string[]; added_links: string[] }

export const KIND_META: Record<ArtifactKind, { label: string; hint: string }> = {
  faq: { label: 'Preguntas frecuentes', hint: '6 a 10 preguntas con respuesta' },
  study_guide: { label: 'Guía de estudio', hint: 'Conceptos, glosario y resumen por sección' },
  quiz: { label: 'Cuestionario', hint: 'Opción múltiple con puntaje' },
  flashcards: { label: 'Tarjetas', hint: 'Frente y dorso para repasar' },
  mind_map: { label: 'Mapa conceptual (esquema)', hint: 'Esquema jerárquico navegable' },
  chart: { label: 'Gráfico', hint: 'Datos numéricos del documento' },
  extraction: { label: 'Extracción', hint: 'Tabla con las columnas que elijas' },
  audit: { label: 'Auditoría de cifras', hint: 'Suma de totales, porcentajes y contradicciones' },
  entity_graph: { label: 'Grafo de entidades', hint: 'Personas, lugares y sus relaciones' },
  rubric: { label: 'Evaluación', hint: 'Checklist de criterios con evidencia' },
  timeline: { label: 'Línea de tiempo', hint: 'Eventos con fecha, en orden' },
  slides: { label: 'Presentación', hint: 'Diapositivas con fuentes, notas y exportación' },
  concept_map: { label: 'Mapa conceptual', hint: 'Conceptos con enlaces rotulados, ramas y expansión' },
}
/** What the Estudio offers: `mind_map` only exists in artifacts generated before concept maps. */
export const KINDS = (Object.keys(KIND_META) as ArtifactKind[]).filter((k) => k !== 'mind_map')

export const isPending = (items: Artifact[] | undefined) => !!items?.some((a) => a.status === 'pending')
