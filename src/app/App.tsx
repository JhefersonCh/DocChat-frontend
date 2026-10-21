import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { SpeechProvider } from '@/features/voice/SpeechProvider'
import { ChatRoute } from '@/features/chats/ChatRoute'
import { EmptyHome } from '@/features/chats/EmptyHome'
import { AppShell } from './AppShell'
import { RouteFallback } from './RouteFallback'

const LibraryPage = lazy(() => import('@/features/library/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const ProjectPage = lazy(() => import('@/features/projects/ProjectPage').then((m) => ({ default: m.ProjectPage })))
const ProvidersScreen = lazy(() => import('@/features/providers/ProvidersScreen').then((m) => ({ default: m.ProvidersScreen })))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: false } },
})

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <SpeechProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<EmptyHome />} />
              <Route path="chats/:id" element={<ChatRoute />} />
              <Route path="projects/:id" element={<Suspense fallback={<RouteFallback />}><ProjectPage /></Suspense>} />
              <Route path="library" element={<Suspense fallback={<RouteFallback />}><LibraryPage /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<RouteFallback />}><ProvidersScreen /></Suspense>} />
              <Route path="*" element={<EmptyHome />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </SpeechProvider>
      </QueryClientProvider>
    </MotionConfig>
  )
}
