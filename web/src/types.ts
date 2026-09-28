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

export interface NormalizedRect { x: number; y: number; width: number; height: number }
export interface ImageAnalysis {
  description: string
  subjects: string[]
  mood: string
  composition: string
  relevantCells: string[]
  focusRect: NormalizedRect
  safeTextAreas: string[]
  cropTolerance: 'low' | 'medium' | 'high' | ''
  confidence: number
}
export interface ExternalImage {
  id: string
  name: string
  dataUrl: string
  analysis: ImageAnalysis
}

export interface GenerateRequest {
  useAboutFooter: boolean
  aboutName: string
  aboutSubtitle: string
  aboutPhoto: string
  colorTheme: ColorTheme
  pageTheme: PageTheme
  showGrid: boolean
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
  images: ExternalImage[]
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
export type TextHighlightTarget = 'title' | 'body' | `items.${number}.title` | `items.${number}.text`
export interface TextHighlight {
  target: TextHighlightTarget
  text: string
}
export interface PageContent {
  role: PageRole
  eyebrow: string
  title: string
  body: string
  items: Array<{ title: string; text: string; iconIntent: string; value?: number }>
  highlights: TextHighlight[]
  cta: string
  iconIntent: string
  imageId: string
  imageRole: '' | 'hero' | 'support' | 'background' | 'portrait' | 'evidence'
}
export interface CampaignDraft {
  version: number
  layoutSeed: number
  brief: GenerateRequest
  pages: PageContent[]
}
export interface ContentResponse { draft: CampaignDraft; prompt: string }
