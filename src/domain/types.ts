// Mirror of backend/docs/frontend-api.md §8. Contract wins over this file.

export type UUID = string
export type ISODate = string // "2026-10-14T15:08:47.480869Z"

export type ProviderKind = 'chat' | 'embedding' | 'stt' | 'tts' | 'vision'
export type SttProtocol = 'openai' | 'ollama'

export interface Provider {
  id: UUID
  kind: ProviderKind
  name: string
  base_url: string
  model: string
  api_key_masked: string | null
  dimensions: number | null
  query_prefix: string | null
  document_prefix: string | null
  supports_tools: boolean
  default_k: number
  max_k: number
  max_tool_calls: number
  voice?: string | null // tts
  language?: string | null // stt / tts
  protocol?: SttProtocol | null // stt
  supports_vision?: boolean // chat: accepts image parts
  modalities?: string[] // embedding: 'text' + 'image' / 'audio' (filled by the probe)
}

export interface ProviderIn {
  kind: ProviderKind
  name: string
  base_url: string
  model: string
  api_key?: string | null
  dimensions?: number | null
  query_prefix?: string | null
  document_prefix?: string | null
  supports_tools?: boolean
  default_k?: number
  max_k?: number
  max_tool_calls?: number
  voice?: string | null
  language?: string | null
  protocol?: SttProtocol | null
  supports_vision?: boolean
}

/** PATCH: all optional; `kind` is immutable. api_key null/"" deletes the key. */
export type ProviderPatch = Partial<Omit<ProviderIn, 'kind'>>

export interface ActiveSettings {
  chat_profile_id: UUID | null
  embedding_profile_id: UUID | null
  stt_profile_id?: UUID | null
  tts_profile_id?: UUID | null
  vision_profile_id?: UUID | null
}

/** Fields that don't apply to the probed kind are omitted (not null). */
export interface ProbeResult {
  ok: boolean
  detail: string
  dimensions?: number
  supports_tools?: boolean
  transcript?: string
  audio_bytes?: number
  caption?: string // vision: what the model said about the probe image
}

export interface Health {
  status: 'ok'
  providers: {
    chat: { name: string; reachable: boolean } | null
    embedding: { name: string; reachable: boolean } | null
  }
}

export type ChatStyle = 'normal' | 'simple' | 'conciso' | 'custom'
export type ChatLength = 'corta' | 'normal' | 'larga'

/** Per-chat answer settings (PATCH /chats/{id}: all optional; custom_instructions null clears them). */
export interface ChatSettings {
  style: ChatStyle
  custom_instructions: string | null
  length: ChatLength
  /** Voice the answers are written in ("el zorro", "el autor"); null/absent = none. */
  persona: string | null
}

export interface Chat extends Partial<ChatSettings> {
  id: UUID
  title: string // "" until the first source; then its name, or "N fuentes"
  created_at: ISODate
  /** Sources in the chat (phase 7); absent in older payloads. */
  source_count?: number
  /** Sources the user muted for this chat. */
  disabled_sources?: UUID[]
  /** Project the chat lives in (its sources are the project's); absent / null = a loose chat. */
  project_id?: UUID | null
  /** When the chat was pinned in the sidebar; null / absent = not pinned. */
  pinned_at?: ISODate | null
}

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'

export type SummaryStatus = 'pending' | 'ready' | 'failed' | 'skipped'

/** Chunks embedded / total while `processing`; null otherwise. */
export interface IngestProgress {
  done: number
  total: number
}

export interface Document {
  id: UUID
  filename: string
  status: DocumentStatus
  error: string | null
  page_count: number | null
  created_at: ISODate
  summary: string | null
  suggested_questions: string[]
  summary_status: SummaryStatus
  progress?: IngestProgress | null
  /** Multimedia sources (migration 011). Absent in older payloads = a pdf/text source. */
  kind?: SourceKind
  duration_s?: number | null // audio / video
  width?: number | null // image / video
  height?: number | null
  /** What `progress` measures while processing. */
  stage?: IngestStage | null
  enrich_status?: EnrichStatus
  /** Why the descriptions stage is partial / failed. */
  enrich_error?: string | null
}

/** A source of a chat: its document + alias (S1..Sn by order added) + whether the chat reads it. */
export interface Source extends Document {
  alias: string
  active: boolean
}

export interface SourceSummary {
  alias: string
  document_id: UUID
  filename: string
  kind: SourceKind
  summary: string | null
}

/** Aggregate of the per-source overviews; the backend sends it for chats with 2+ sources. */
export interface CollectionOverview {
  sources: SourceSummary[]
  summary: string | null
  suggested_questions: string[]
}

export interface ChatDetail extends Chat {
  /** The first source (S1), kept for compatibility; read `sources`. */
  document: Document | null
  sources?: Source[]
  active_source_ids?: UUID[]
  overview?: CollectionOverview | null
}

export interface UploadResult {
  document_id: UUID
  status: 'pending' | 'processing'
}

export type SourceKind = 'pdf' | 'text' | 'image' | 'audio' | 'video'
export type SegmentModality = 'text' | 'image' | 'audio' | 'frame'
export type SegmentOrigin = 'embedded_image' | 'figure' | 'page' | 'tile' | 'region' | 'whole_image' | 'window' | 'frame'
export type CitationKind = 'text' | 'image' | 'audio' | 'video'
export type IngestStage = 'extracting' | 'embedding' | 'describing' | 'transcribing'
export type EnrichStatus = 'pending' | 'running' | 'ready' | 'partial' | 'failed' | 'skipped'
/** [x0, y0, x1, y1] normalized 0-1 over the page (PDF) or the image; independent of DPI/zoom. */
export type BBox = [number, number, number, number]

/** PDF points, origin top-left (PyMuPDF). Not implemented by the backend yet. */
export interface CitationRect {
  page: number // 1-based
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Citation {
  n: number
  /** Synthetic (non-answer) citation: 'search' = viewer search hit, 'studio' = Estudio page link, 'inspector' = chunk inspector row, 'xray' = retrieval minimap tick. Absent = real answer citation. */
  origin?: 'search' | 'studio' | 'inspector' | 'xray'
  document_id: UUID
  filename: string
  page: number | null // 1-based; null in TXT/MD
  snippet: string
  chunk_id: UUID | null // null in old messages
  page_end: number | null // last page of the chunk; null in TXT/MD or old messages
  content: string | null // full chunk text; null in old messages
  section?: string | null // heading the chunk falls under; null outside any section / old messages
  score?: number | null // relevance 0..1 (query similarity); null / absent in old messages
  rects?: CitationRect[] | null
  /** What the viewer opens. Absent in citations persisted before multimedia = 'text'. */
  kind?: CitationKind
  bbox?: BBox | null // region of the page / image
  t_start?: number | null // seconds (audio / video)
  t_end?: number | null
  /** GET /api/v1/segments/{chunk_id}/thumb exists (256 px webp). */
  has_thumb?: boolean
  source_kind?: SourceKind | null // kind of the source document
  /** Which source of a multi-source chat (S1..Sn). Absent in citations persisted before phase 7. */
  source_id?: UUID
  source_alias?: string | null
  source_name?: string
  /** What a region segment shows ("colibrí"); absent for whole images. */
  region_label?: string | null
}

/** One retrieved chunk of a search (X-ray). Absent in answers persisted before it existed. */
export interface Found {
  n: number // citation number [n] it would carry
  chunk_id: UUID | null
  page_start: number | null
  page_end: number | null
  section: string | null
  score: number | null // relevance 0..1
  kind?: CitationKind // absent = text; tolerated when the backend does not send it yet
  bbox?: BBox | null
  t_start?: number | null // seconds (audio / video)
  t_end?: number | null
  has_thumb?: boolean
  /** Source of the segment (phase 7). */
  document_id?: UUID | null
  source_alias?: string | null
}

export interface Search {
  query: string
  k: number
  found?: Found[]
  /** The safety-net pass spread over the document (not a model query). */
  panorama?: boolean
  /** Modality hint the model gave; absent in old answers = 'auto'. */
  modality?: 'auto' | 'texto' | 'imagen' | 'audio' | 'video'
  /** find_all: every occurrence, each verified (not a top-k search). */
  exhaustive?: boolean
  /** Candidates per ranking ({vector,text,image,audio}); find_all: {checked,discarded,asked}. */
  rankings?: Record<string, number>
  /** Sources the search read: "all" or aliases ("S1,S3"). */
  source?: string
}

export interface Message {
  id: UUID
  role: 'user' | 'assistant'
  content: string
  created_at: ISODate
  citations: Citation[] | null
  searches: Search[] | null
  /** Follow-up questions of an assistant answer; null until generated. */
  suggestions: string[] | null
  /** The best source was a weak match (absent in old messages = false). */
  weak_evidence?: boolean
  /** Claim check, once requested (POST .../verify); null/absent until then. */
  verification?: Verification | null
  /** Persona the answer was written in, if any. */
  persona?: string | null
}

export type ClaimStatus = 'respaldada' | 'parcial' | 'sin_respaldo'

export interface Claim {
  text: string
  sentence_index: number
  status: ClaimStatus
  source_ns: number[]
  quote?: string | null
  reason: string
}

/** `sentences`: the answer without `[n]`/markdown, in order; `claims[].sentence_index` points into it. */
export interface Verification {
  sentences: string[]
  claims: Claim[]
}

/** GET /documents/{id}/search?q=&k=: passages that match, no LLM involved. */
export interface SearchHit {
  chunk_id: UUID | null
  page_start: number | null
  page_end: number | null
  section: string | null
  snippet: string
  content: string | null
  score: number | null
  kind?: CitationKind // multimedia contract, same as Citation
  bbox?: BBox | null
  t_start?: number | null
  t_end?: number | null
  has_thumb?: boolean
}

export interface DocumentSearchResult {
  query: string
  hits: SearchHit[]
}

export interface ApiError {
  code: string
  message: string
}

// SSE. Order: search (1..N) -> citations -> token (0..N) -> done | error
export type SearchEvent = {
  query: string
  k: number
  hits: number
  found?: Found[]
  panorama?: boolean
  modality?: Search['modality']
  exhaustive?: boolean
  rankings?: Record<string, number>
  source?: string
}
export type TokenEvent = { text: string }
export type DoneEvent = { message_id: UUID; cited: number[]; weak_evidence?: boolean }
export type SseEvent =
  | { event: 'search'; data: SearchEvent }
  | { event: 'citations'; data: Citation[] }
  | { event: 'token'; data: TokenEvent }
  | { event: 'done'; data: DoneEvent }
  | { event: 'error'; data: ApiError }

/** An answer saved as a note: content and citations are a snapshot taken at save time (they survive reindex). */
export interface Note {
  id: UUID
  message_id: UUID | null
  title: string // "" when the user gave none
  content: string
  citations: Citation[]
  created_at: ISODate
}

/** GET /documents/{id}/chunks: how the document was split (debug). */
export interface ChunkInfo {
  chunk_id: UUID | null
  ordinal: number
  page_start: number | null
  page_end: number | null
  section: string | null
  chars: number
  content: string
  /** Multimedia segments (migration 011); absent = text. */
  modality?: SegmentModality
  origin?: SegmentOrigin | null
  bbox?: BBox | null
  t_start?: number | null // seconds (audio window / frame)
  t_end?: number | null
  text_status?: 'pending' | 'ready' | 'failed' | 'skipped' | null
  has_thumb?: boolean
}

export interface ChunkPage {
  total: number
  offset: number
  items: ChunkInfo[]
}
