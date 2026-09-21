import type { ApiErrorShape, AppConfig, GenerateRequest, GenerateResponse, CampaignDraft, ContentResponse } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorShape
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`)
  }
  return body
}

export function getConfig(): Promise<AppConfig> {
  return request<AppConfig>('/api/config')
}

export async function previewPrompt(payload: GenerateRequest): Promise<string> {
  const result = await request<{ prompt: string }>('/api/prompt', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return result.prompt
}

export function generateScript(payload: GenerateRequest): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function generateContent(payload: GenerateRequest): Promise<ContentResponse> {
  return request<ContentResponse>('/api/content', { method: 'POST', body: JSON.stringify(payload) })
}

export function renderContent(draft: CampaignDraft): Promise<GenerateResponse> {
  return request<GenerateResponse>('/api/render', { method: 'POST', body: JSON.stringify(draft) })
}
