import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { detectLocale, htmlLang, messagesFor, type Messages } from './translate'
import type { Locale } from './types'

type I18n = {
  locale: Locale
  t: Messages
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const value = useMemo(() => {
    const locale = detectLocale()
    const t = messagesFor(locale)
    document.documentElement.lang = htmlLang(locale)
    document.title = t.meta.title
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', t.meta.description)
    return { locale, t }
  }, [])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}
