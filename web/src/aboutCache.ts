import type { GenerateRequest } from './types'

const storageKey = 'builder-tool-about'

const aboutKeys = ['useAboutFooter', 'aboutName', 'aboutSubtitle', 'aboutPhoto'] as const

export type AboutCache = Pick<GenerateRequest, (typeof aboutKeys)[number]>

export function readAbout(): AboutCache | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AboutCache>
    if (typeof parsed.aboutName !== 'string' || typeof parsed.aboutSubtitle !== 'string' || typeof parsed.aboutPhoto !== 'string') return null
    return {
      useAboutFooter: parsed.useAboutFooter !== false,
      aboutName: parsed.aboutName.slice(0, 80),
      aboutSubtitle: parsed.aboutSubtitle.slice(0, 120),
      aboutPhoto: parsed.aboutPhoto.startsWith('data:image/') ? parsed.aboutPhoto : '',
    }
  } catch {
    return null
  }
}

export function writeAbout(value: AboutCache) {
  const payload: AboutCache = {
    useAboutFooter: value.useAboutFooter,
    aboutName: value.aboutName.slice(0, 80),
    aboutSubtitle: value.aboutSubtitle.slice(0, 120),
    aboutPhoto: value.aboutPhoto,
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...payload, aboutPhoto: '' }))
    } catch {
      // The browser refused to store the profile. The current form still keeps it.
    }
  }
}

export function isAboutField(key: keyof GenerateRequest): key is keyof AboutCache {
  return (aboutKeys as readonly string[]).includes(key)
}
