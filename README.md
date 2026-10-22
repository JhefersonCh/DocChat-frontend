# DocChat — Frontend

Interfaz web de **DocChat**: chateá con tus fuentes (PDF, texto, imágenes, audio y video) y obtené respuestas con citas que te llevan al pasaje exacto.

> Este repo es solo el frontend. Necesita el backend corriendo:
> **https://github.com/JhefersonCh/DocChat-backend** (por defecto en `http://localhost:8000`).

## Funcionalidades

**Conversación**
- Layout de 3 columnas: **chats | visor | conversación**.
- Respuestas en *streaming* (SSE) con **citas clickeables**: abren la fuente y resaltan el pasaje exacto, la región de la imagen (bbox) o el tiempo de audio/video.
- Chats con **múltiples fuentes**, **proyectos**, **categorías** y búsqueda por conceptos en la biblioteca.
- **Paleta de búsqueda global** (`Ctrl+K`).
- **Verificar respuestas**, modo *spoiler-safe*, **persona** y nivel de explicación.
- **Tira X-ray** de retrieval (qué fragmentos se recuperaron).
- **Tutor socrático**.
- **Notas** y exportación a Markdown.
- **Modo voz** manos libres.
- Pegar texto como fuente, y **fijar (pin)** elementos.

**Visores**: PDF, texto, imagen, audio y video.

**Estudio** (generado a partir de las fuentes): FAQ, guía, quiz, flashcards, mapas conceptuales, gráficos, extracción, auditoría, grafo de entidades, rúbrica, línea de tiempo y **slides** con exportación a **PPTX/PDF**.

## Requisitos

- **Node.js**: `package.json` no define `engines`. Desarrollado con Node `v26.11.1`; cualquier Node reciente compatible con Vite 8 debería servir.
- Backend de DocChat corriendo en `http://localhost:8000`.

## Instalación y desarrollo

```bash
npm install
npm run dev
```

Abrí **http://localhost:5173**.

El navegador habla siempre con el mismo origen: Vite hace proxy de `/api` hacia `http://localhost:8000` (con `changeOrigin`). El proxy no comprime ni bufferiza, así que los streams SSE fluyen en vivo. Por eso el backend no necesita cambios de CORS.

**Apuntar a otro backend**: no hay variable de entorno para eso. Editá el `target` en `vite.config.ts`:

```ts
server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } } }
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Sirve el build generado |
| `npm test` | Tests con Vitest (`vitest run`) |
| `npm run lint` | Lint con oxlint |
| `npm run sync:vad` | Copia los assets de VAD a `public/vad/` |

`predev` y `prebuild` ejecutan `sync:vad` automáticamente.

## Proveedores y modelos

Se configuran **desde la pantalla Ajustes** de la app, no por variables de entorno: perfiles de **chat**, **embedding**, **visión**, **STT** y **TTS**.

## Modo voz

- Usa VAD (`@ricky0123/vad-web`) en el navegador. Los assets (modelo Silero, worklet, onnxruntime wasm; ~17 MB) se copian a `public/vad/` con `sync:vad` (carpeta ignorada por git) y se **cargan de forma lazy** la primera vez que activás la voz.
- El permiso de micrófono requiere **`localhost` o `https`**.
- En dev, el plugin `vad-runtime-raw` de `vite.config.ts` sirve los `.mjs` de onnxruntime sin transformar (si no, Vite responde 500 al `?import`).

## Arquitectura

- **React 19 + Vite 8 + TypeScript**, rutas con `react-router`.
- **`src/domain/`**: lógica pura (citas, búsqueda, export MD, slides, voz, etc.) con tests unitarios al lado (`*.test.ts`).
- **`src/api/`**: clientes HTTP por recurso, cliente SSE y `queryKeys` centralizadas.
- **Estado de servidor** con `@tanstack/react-query`.
- **`src/features/<nombre>/`**: una carpeta por funcionalidad (chats, conversation, viewer, studio, voice, tutor, notes, providers, etc.).
- **`src/ui/`**: componentes base y *design tokens*.
- **Animaciones** con `motion`, respetando `prefers-reduced-motion`.
- **Diseño**: tema editorial oscuro, acento ámbar; tipografías **Instrument Serif**, **Newsreader** e **IBM Plex Mono**.
- Markdown con `react-markdown` + `remark-gfm`; PDF con `react-pdf`/pdf.js (chunk lazy); slides con `pptxgenjs`.
- Build con *code splitting* manual (react, motion, markdown).

## Estructura

```
frontend/
├── index.html
├── vite.config.ts        # proxy /api, plugin VAD, chunks
├── scripts/
│   └── sync-vad-assets.mjs
├── public/vad/           # generado, gitignored
└── src/
    ├── main.tsx
    ├── app/              # shell, sidebar, rutas
    ├── api/              # clientes HTTP + SSE
    ├── domain/           # lógica pura + tests
    ├── ui/               # componentes base, tokens.css, motion
    ├── features/         # chats, conversation, viewer, studio, voice,
    │                     # tutor, notes, projects, library, search, ...
    └── test/             # fixtures
```
