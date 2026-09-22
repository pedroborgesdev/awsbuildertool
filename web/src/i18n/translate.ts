import en from './locales/en'
import ptBR from './locales/pt-BR'
import { supportedLocales, type Locale } from './types'

export type Messages = typeof en

const catalogs: Record<Locale, Messages> = {
  en,
  'pt-BR': ptBR,
}

export function messagesFor(locale: Locale): Messages {
  return catalogs[locale]
}

// To add a language: extend Locale, add a catalog that satisfies Messages,
// register it in catalogs, and map its BCP 47 prefix here and in index.html.
function matchLocale(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase().replace('_', '-')
  if (!normalized) return null
  if (normalized === 'pt' || normalized.startsWith('pt-')) return 'pt-BR'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en'
  return null
}

export function resolveLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const locale = matchLocale(tag)
    if (locale) return locale
  }
  return 'en'
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language]
  return resolveLocale(preferred.filter(Boolean))
}

export function htmlLang(locale: Locale) {
  return locale === 'pt-BR' ? 'pt-BR' : 'en'
}

export { supportedLocales }
