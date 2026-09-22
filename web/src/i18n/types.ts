export const supportedLocales = ['en', 'pt-BR'] as const

export type Locale = (typeof supportedLocales)[number]

export type StepIssue = '' | 'topic' | 'goal' | 'context'
