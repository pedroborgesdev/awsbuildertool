import type { StepIssue } from './i18n/types'
import type { ColorTheme, ContentLevel, GenerateRequest, PageTheme, Platform } from './types'

export const creatorStepIds = ['idea', 'publish', 'look', 'about', 'finish'] as const

export const formats: Array<{ value: Platform; dimensions: string; channel: string }> = [
  { value: 'instagram-portrait', dimensions: '1080 × 1350', channel: 'Instagram' },
  { value: 'instagram-square', dimensions: '1080 × 1080', channel: 'Instagram' },
  { value: 'instagram-story', dimensions: '1080 × 1920', channel: 'Instagram' },
  { value: 'linkedin-portrait', dimensions: '1080 × 1350', channel: 'LinkedIn' },
  { value: 'linkedin-document', dimensions: '1920 × 1080', channel: 'LinkedIn' },
  { value: 'x-landscape', dimensions: '1600 × 900', channel: 'X' },
  { value: 'facebook-portrait', dimensions: '1080 × 1500', channel: 'Facebook' },
  { value: 'youtube-community', dimensions: '1080 × 1080', channel: 'YouTube' },
]

export const formatChoices: Array<{ id: string; values: Platform[]; dimensions: string; channels: string[]; pdf?: boolean }> = [
  { id: 'portrait', values: ['instagram-portrait', 'linkedin-portrait'], dimensions: '1080 × 1350', channels: ['Instagram', 'LinkedIn'] },
  { id: 'square', values: ['instagram-square', 'youtube-community'], dimensions: '1080 × 1080', channels: ['Instagram', 'YouTube'] },
  { id: 'story', values: ['instagram-story'], dimensions: '1080 × 1920', channels: ['Instagram'] },
  { id: 'pdf', values: ['linkedin-document'], dimensions: '1920 × 1080', channels: [], pdf: true },
  { id: 'landscape', values: ['x-landscape'], dimensions: '1600 × 900', channels: ['X'] },
  { id: 'facebook', values: ['facebook-portrait'], dimensions: '1080 × 1500', channels: ['Facebook'] },
]

export function choiceFor(platform: Platform) {
  return formatChoices.find((choice) => choice.values.includes(platform)) ?? formatChoices[0]
}

export const contentLevels: ContentLevel[] = ['essential', 'balanced', 'deep']

export const colorThemes: ColorTheme[] = ['pink', 'green', 'blue', 'orange', 'purple', 'colorful']

export const languages = ['English', 'Português', 'Español', 'Français', 'Deutsch']

export const pageThemes: PageTheme[] = ['dark', 'light', 'both']

export function stepIssue(step: number, form: GenerateRequest): StepIssue {
  if (step === 0) {
    if (form.theme.trim().length < 3) return 'topic'
    if (form.goal.trim().length < 3) return 'goal'
    if (form.additionalContext.trim().length < 150) return 'context'
  }
  return ''
}

export function canVisitStep(step: number, form: GenerateRequest) {
  for (let index = 0; index < step; index += 1) {
    if (stepIssue(index, form)) return false
  }
  return true
}

export const initialForm: GenerateRequest = {
  useAboutFooter: true,
  aboutName: '',
  aboutSubtitle: '',
  aboutPhoto: '',
  colorTheme: 'colorful',
  pageTheme: 'both',
  theme: '',
  goal: '',
  audience: 'Technology students and professionals',
  platform: 'instagram-portrait',
  postCount: 5,
  contentLevel: 'balanced',
  tone: 'Educational, direct, and technical',
  language: 'English',
  cta: '',
  firstPageCta: false,
  lastPageCta: true,
  additionalContext: '',
  model: '',
}
