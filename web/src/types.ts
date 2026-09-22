export type Platform =
  | 'instagram-portrait'
  | 'instagram-square'
  | 'instagram-story'
  | 'linkedin-portrait'
  | 'linkedin-document'
  | 'x-landscape'
  | 'facebook-portrait'
  | 'youtube-community'

export type ContentLevel = 'essential' | 'balanced' | 'deep'
export type ColorTheme = 'pink' | 'green' | 'blue' | 'orange' | 'purple' | 'colorful'
export type PageTheme = 'dark' | 'light' | 'both'
export type AppView = 'landing' | 'create' | 'result'
export type Accent = 'pink' | 'green' | 'orange' | 'blue'

export interface GenerateRequest {
  useAboutFooter: boolean
  aboutName: string
  aboutSubtitle: string
  aboutPhoto: string
  colorTheme: ColorTheme
  pageTheme: PageTheme
  theme: string
  goal: string
  audience: string
  platform: Platform
  postCount: number
  contentLevel: ContentLevel
  tone: string
  language: string
  cta: string
  firstPageCta: boolean
  lastPageCta: boolean
  additionalContext: string
  model: string
}

export interface GenerateResponse {
	draft: CampaignDraft
  script: string
  prompt: string
  filename: string
  model: string
  jobId: string
  files: GeneratedAsset[]
  executionLog?: string
  executionError?: string
  cost: GenerationCost
}

export interface GenerationCost {
  hf: number
  jev: number
  total: number
  currency: string
  estimated: boolean
  hfPromptTokens: number
  hfCompletionTokens: number
  jevPromptTokens: number
  jevCompletionTokens: number
}

export interface GeneratedAsset {
	kind: 'page' | 'preview' | 'document'
	width?: number
	height?: number
  name: string
  url: string
  mediaType: string
}

export interface AppConfig {
  model: string
  tokenConfigured: boolean
  designSystemReady: boolean
  mockMode: boolean
  rendererReady: boolean
  rendererMode: string
}

export interface ApiErrorShape {
  error?: string
}

export type PageRole = 'cover' | 'list' | 'flow' | 'comparison' | 'manifesto' | 'cta' | 'diagram' | 'chart' | 'timeline' | 'stats'
export interface PageContent {
  role: PageRole
  eyebrow: string
  title: string
  body: string
  items: Array<{ title: string; text: string; iconIntent: string; value?: number }>
  cta: string
  iconIntent: string
}
export interface CampaignDraft {
  version: number
  layoutSeed: number
  brief: GenerateRequest
  pages: PageContent[]
}
export interface ContentResponse { draft: CampaignDraft; prompt: string }
