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
import type { AppConfig, AppView, ExternalImage, GenerateRequest, GenerateResponse } from './types'

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

async function normalizeContentImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 1800
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(64, Math.round(bitmap.width * scale))
  const height = Math.max(64, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable.')
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const pixels = context.getImageData(0, 0, width, height).data
  let hasTransparency = false
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) {
      hasTransparency = true
      break
    }
  }
  const mediaType = hasTransparency ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('Image conversion failed.')),
    mediaType,
    hasTransparency ? undefined : .88,
  ))
  if (blob.size > 3 * 1024 * 1024) throw new Error('IMAGE_TOO_LARGE')
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Image conversion failed.'))
    reader.readAsDataURL(blob)
  })
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
  const [imagesBusy, setImagesBusy] = useState(false)
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

  async function importContentImages(files: File[]) {
    if (!files.length) return
    if (form.images.length + files.length > 5) {
      setError(t.errors.imagesLimit)
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError(t.errors.imagesType)
      return
    }
    setImagesBusy(true)
    try {
      const used = new Set(form.images.map((image) => image.id))
      const ids = Array.from({ length: 5 }, (_, index) => `image-${index + 1}`).filter((id) => !used.has(id))
      const prepared: ExternalImage[] = []
      for (let index = 0; index < files.length; index += 1) {
        prepared.push({
          id: ids[index],
          name: files[index].name,
          dataUrl: await normalizeContentImage(files[index]),
          analysis: { description: '', subjects: [], mood: '', composition: '', relevantCells: [], focusRect: { x: 0, y: 0, width: 0, height: 0 }, safeTextAreas: [], cropTolerance: '', confidence: 0 },
        })
      }
      const nextImages = [...form.images, ...prepared]
      update('images', nextImages)
      if (form.postCount < nextImages.length) update('postCount', nextImages.length)
    } catch (reason) {
      setError(reason instanceof Error && reason.message === 'IMAGE_TOO_LARGE' ? t.errors.imagesSize : t.errors.imagesOpen)
    } finally {
      setImagesBusy(false)
    }
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
          busy={busy || imagesBusy}
          error={error}
          onStepChange={setStep}
          onUpdate={update}
          onImportPhoto={importPhoto}
          onImportContentImages={(files) => { void importContentImages(files) }}
          onRemoveContentImage={(id) => update('images', form.images.filter((image) => image.id !== id))}
          onDismissError={() => setError('')}
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
