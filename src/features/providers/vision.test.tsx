// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getActive, listProviders } from '@/api/providers'
import type { Provider } from '@/domain/types'
import { ProbeBadge } from './ProbeBadge'
import { ProvidersScreen } from './ProvidersScreen'

vi.mock('@/api/providers', () => ({
  listProviders: vi.fn(), getActive: vi.fn(), createProvider: vi.fn(), patchProvider: vi.fn(),
  deleteProvider: vi.fn(), testProvider: vi.fn(), setActive: vi.fn(),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const visionProfile: Provider = {
  id: 'v1', kind: 'vision', name: 'DeepSeek visión', base_url: 'https://api.deepseek.com/v1',
  model: 'deepseek-flash', api_key_masked: 'sk-****1234', dimensions: null, query_prefix: null,
  document_prefix: null, supports_tools: false, default_k: 5, max_k: 15, max_tool_calls: 3,
}

describe('vision profiles UI', () => {
  it('has its own column with the active profile marked', async () => {
    vi.mocked(listProviders).mockResolvedValue([visionProfile])
    vi.mocked(getActive).mockResolvedValue({ chat_profile_id: null, embedding_profile_id: null, vision_profile_id: 'v1' })
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ProvidersScreen />
      </QueryClientProvider>,
    )
    const column = await screen.findByRole('region', { name: 'Visión' })
    expect(column.textContent).toContain('DeepSeek visión')
    expect(column.textContent).toContain('ACTIVO')
  })

  it('the probe readout shows what the model said about the test image', () => {
    render(<ProbeBadge pending={false} result={{ ok: true, detail: 'vision ok', caption: 'Un degradado azul' }} />)
    expect(screen.getByRole('status').textContent).toContain('Un degradado azul')
  })
})
