import { FormEvent, useEffect, useState } from 'react'
import { isAboutField, readAbout, writeAbout } from './aboutCache'
import { generateScript, getConfig } from './api'
import { creatorStepIds, initialForm } from './constants'
import { useI18n } from './i18n/context'
import { AppShell, SiteHeader } from './components/layout/AppShell'
import { CreatorPage } from './components/pages/CreatorPage'
import { LandingPage } from './components/pages/LandingPage'
import { ResultPage } from './components/pages/ResultPage'
import { PhotoCropper } from './components/photo/PhotoCropper'
import type { AppConfig, AppView, GenerateRequest, GenerateResponse } from './types'

function canCreatePosts(config: AppConfig | null) {
  return Boolean(config?.designSystemReady && config.rendererReady && (config.tokenConfigured || config.mockMode))
}

function localizedDefaults(localeDefaults: { audience: string; tone: string; language: string }): Pick<GenerateRequest, 'audience' | 'tone' | 'language'> {
  return {
    audience: localeDefaults.audience,
    tone: localeDefaults.tone,
    language: localeDefaults.language,
  }
}

function App() {
  const { t } = useI18n()
  const [form, setForm] = useState<GenerateRequest>(() => ({
    ...initialForm,
    ...localizedDefaults(t.defaults),
    ...readAbout(),
  }))
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [view, setView] = useState<AppView>('landing')
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [artifactIsStale, setArtifactIsStale] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cropSource, setCropSource] = useState<string | null>(null)

  useEffect(() => {
    getConfig()
      .then((value) => {
        setConfig(value)
        setForm((current) => ({ ...current, model: value.model }))
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  function update<K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (isAboutField(key)) writeAbout(next)
      return next
    })
    if (result) setArtifactIsStale(true)
    setError('')
  }

  function importPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t.errors.photoType)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropSource(String(reader.result))
    reader.onerror = () => setError(t.errors.photoOpen)
    reader.readAsDataURL(file)
  }

  function openCreator() {
    if (!canCreatePosts(config)) return
    setError('')
    setView('create')
  }

  function resetBrief() {
    setForm({ ...initialForm, ...localizedDefaults(t.defaults), ...readAbout(), model: config?.model ?? '' })
    setResult(null)
    setArtifactIsStale(false)
    setError('')
    setStep(0)
    setView('landing')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setView('result')
    try {
      const value = await generateScript(form)
      setResult(value)
      setArtifactIsStale(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.errors.generate)
      setView('create')
    } finally {
      setBusy(false)
    }
  }

  const ready = canCreatePosts(config)

  return (
    <AppShell view={view}>
      <SiteHeader
        view={view}
        canCreate={ready}
        hasResult={Boolean(result)}
        onHome={() => setView('landing')}
        onStart={openCreator}
        onResult={() => setView('result')}
        onEdit={() => { setStep(creatorStepIds.length - 1); setView('create') }}
      />
      {view === 'landing' && <LandingPage config={config} canCreate={ready} error={error} onStart={openCreator} />}
      {view === 'create' && (
        <CreatorPage
          form={form}
          config={config}
          step={step}
          busy={busy}
          error={error}
          onStepChange={setStep}
          onUpdate={update}
          onImportPhoto={importPhoto}
          onExit={() => setView('landing')}
          onSubmit={handleSubmit}
        />
      )}
      {view === 'result' && (
        <ResultPage
          result={result}
          stale={artifactIsStale}
          loading={busy}
          onEdit={() => { setStep(creatorStepIds.length - 1); setView('create') }}
          onReset={resetBrief}
        />
      )}
      {cropSource && (
        <PhotoCropper
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onConfirm={(photo) => { update('aboutPhoto', photo); setCropSource(null) }}
        />
      )}
    </AppShell>
  )
}

export default App
