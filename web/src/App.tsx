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

const historyViewKey = 'builderToolView'

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
  const [configLoading, setConfigLoading] = useState(true)
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
      .finally(() => setConfigLoading(false))
  }, [])

  useEffect(() => {
    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    window.history.replaceState({ ...currentState, [historyViewKey]: 'landing' }, '')

    const restoreView = (event: PopStateEvent) => {
      const nextView = event.state?.[historyViewKey]
      setView(nextView === 'create' || nextView === 'result' ? nextView : 'landing')
    }
    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [])

  function navigateTo(nextView: AppView, mode: 'push' | 'replace' = 'replace') {
    const currentState = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
    const nextState = { ...currentState, [historyViewKey]: nextView }
    if (mode === 'push') window.history.pushState(nextState, '')
    else window.history.replaceState(nextState, '')
    setView(nextView)
  }

  function returnHome() {
    if (window.history.state?.[historyViewKey] !== 'landing') {
      window.history.back()
      return
    }
    navigateTo('landing')
  }

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
    navigateTo('create', 'push')
  }

  function resetBrief() {
    setForm({ ...initialForm, ...localizedDefaults(t.defaults), ...readAbout(), model: config?.model ?? '' })
    setResult(null)
    setArtifactIsStale(false)
    setError('')
    setStep(0)
    returnHome()
  }

  async function generatePosts(returnToCreatorOnError: boolean) {
    setBusy(true)
    setError('')
    navigateTo('result')
    try {
      const value = await generateScript(form)
      setResult(value)
      setArtifactIsStale(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.errors.generate)
      if (returnToCreatorOnError) navigateTo('create')
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void generatePosts(true)
  }

  const ready = canCreatePosts(config)

  return (
    <AppShell view={view}>
      <SiteHeader
        view={view}
        canCreate={ready}
        configLoading={configLoading}
        hasResult={Boolean(result)}
        onHome={returnHome}
        onStart={openCreator}
        onResult={() => navigateTo('result')}
      />
      {view === 'landing' && <LandingPage config={config} configLoading={configLoading} canCreate={ready} error={error} onStart={openCreator} />}
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
          onExit={returnHome}
          onSubmit={handleSubmit}
        />
      )}
      {view === 'result' && (
        <ResultPage
          result={result}
          stale={artifactIsStale}
          loading={busy}
          error={error}
          onEdit={() => { setStep(creatorStepIds.length - 1); navigateTo('create') }}
          onRetry={() => { void generatePosts(false) }}
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
