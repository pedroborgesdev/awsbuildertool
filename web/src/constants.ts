import type { ColorTheme, ContentLevel, GenerateRequest, PageTheme, Platform } from './types'

export const formats: Array<{ value: Platform; label: string; dimensions: string; channel: string }> = [
  { value: 'instagram-portrait', label: 'Portrait', dimensions: '1080 × 1350', channel: 'Instagram' },
  { value: 'instagram-square', label: 'Square', dimensions: '1080 × 1080', channel: 'Instagram' },
  { value: 'instagram-story', label: 'Stories', dimensions: '1080 × 1920', channel: 'Instagram' },
  { value: 'linkedin-portrait', label: 'Portrait', dimensions: '1080 × 1350', channel: 'LinkedIn' },
  { value: 'linkedin-document', label: 'PDF document', dimensions: '1080 × 1350', channel: 'LinkedIn' },
  { value: 'x-landscape', label: 'Landscape', dimensions: '1600 × 900', channel: 'X' },
  { value: 'facebook-portrait', label: 'Portrait', dimensions: '1080 × 1500', channel: 'Facebook' },
  { value: 'youtube-community', label: 'Community', dimensions: '1080 × 1080', channel: 'YouTube' },
]

export const contentLevels: Array<{ value: ContentLevel; label: string; description: string }> = [
  { value: 'essential', label: 'Essential', description: 'Little text, one central idea, and very fast reading.' },
  { value: 'balanced', label: 'Balanced', description: 'Enough context, short examples, and a good visual rhythm.' },
  { value: 'deep', label: 'Deep', description: 'More explanations and details, distributed without reducing the font.' },
]

export const colorThemes: Array<{ value: ColorTheme; label: string }> = [
  { value: 'pink', label: 'Pink' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'colorful', label: 'Colorful' },
]

export const pageThemes: Array<{ value: PageTheme; label: string; description: string }> = [
  { value: 'dark', label: 'Dark', description: 'All pages use a dark background.' },
  { value: 'light', label: 'Light', description: 'All pages use a light background.' },
  { value: 'both', label: 'Both', description: 'Alternates light and dark backgrounds across the campaign.' },
]

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
