import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { generateScript, getConfig, previewPrompt } from './api'
import type { AppConfig, ColorTheme, ContentLevel, GenerateRequest, GenerateResponse, GeneratedAsset, PageTheme, Platform } from './types'

const formats: Array<{ value: Platform; label: string; dimensions: string; channel: string }> = [
  { value: 'instagram-portrait', label: 'Portrait', dimensions: '1080 × 1350', channel: 'Instagram' },
  { value: 'instagram-square', label: 'Square', dimensions: '1080 × 1080', channel: 'Instagram' },
  { value: 'instagram-story', label: 'Stories', dimensions: '1080 × 1920', channel: 'Instagram' },
  { value: 'linkedin-portrait', label: 'Portrait', dimensions: '1080 × 1350', channel: 'LinkedIn' },
  { value: 'linkedin-document', label: 'PDF document', dimensions: '1080 × 1350', channel: 'LinkedIn' },
  { value: 'x-landscape', label: 'Landscape', dimensions: '1600 × 900', channel: 'X' },
  { value: 'facebook-portrait', label: 'Portrait', dimensions: '1200 × 1500', channel: 'Facebook' },
  { value: 'youtube-community', label: 'Community', dimensions: '1080 × 1080', channel: 'YouTube' },
]

const contentLevels: Array<{ value: ContentLevel; label: string; description: string }> = [
  { value: 'essential', label: 'Essential', description: 'Little text, one central idea, and very fast reading.' },
  { value: 'balanced', label: 'Balanced', description: 'Enough context, short examples, and a good visual rhythm.' },
  { value: 'deep', label: 'Deep', description: 'More explanations and details, distributed without reducing the font.' },
]

const colorThemes: Array<{ value: ColorTheme; label: string }> = [
  { value: 'pink', label: 'Pink' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'colorful', label: 'Colorful' },
]

const pageThemes: Array<{ value: PageTheme; label: string; description: string }> = [
  { value: 'dark', label: 'Dark', description: 'All pages use a dark background.' },
  { value: 'light', label: 'Light', description: 'All pages use a light background.' },
  { value: 'both', label: 'Both', description: 'Alternates light and dark backgrounds across the campaign.' },
]

const initialForm: GenerateRequest = {
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

type Mode = 'brief' | 'prompt' | 'result'

function App() {
  const [form, setForm] = useState<GenerateRequest>(initialForm)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [mode, setMode] = useState<Mode>('brief')
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [artifactIsStale, setArtifactIsStale] = useState(false)
  const [busy, setBusy] = useState<'prompt' | 'generate' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [cropSource, setCropSource] = useState<string | null>(null)

  useEffect(() => {
    getConfig()
      .then((value) => {
        setConfig(value)
        setForm((current) => ({ ...current, model: value.model }))
      })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  const selectedFormat = useMemo(
    () => formats.find((format) => format.value === form.platform) ?? formats[0],
    [form.platform],
  )

  function update<K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (result || mode === 'prompt') setArtifactIsStale(true)
    setError('')
  }

  function importPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP photo.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setCropSource(String(reader.result))
    reader.onerror = () => setError('The selected photo could not be opened.')
    reader.readAsDataURL(file)
  }

  async function handlePreview() {
    setBusy('prompt')
    setError('')
    try {
      const value = await previewPrompt(form)
      setPrompt(value)
      setArtifactIsStale(false)
      setMode('prompt')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The prompt could not be built.')
    } finally {
      setBusy(null)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy('generate')
    setError('')
    setCopied(false)
    try {
      const value = await generateScript(form)
      setResult(value)
      setArtifactIsStale(false)
      setPrompt(value.prompt)
      setMode('result')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The posts could not be generated.')
    } finally {
      setBusy(null)
    }
  }

  async function copyScript() {
    if (!result) return
    await navigator.clipboard.writeText(result.script)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function downloadScript() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([result.script], { type: 'text/x-python;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = result.filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell bg-ink text-white">
      <div className="background-grid fixed inset-0 pointer-events-none" aria-hidden="true" />
      <header className="relative z-10 border-b border-grid bg-ink/95">
        <div className="flex min-h-24 w-full items-center justify-between gap-6 px-6 md:px-10 xl:px-12">
          <div className="flex items-center gap-4">
            <div className="brand-lockup"><img src="/design-assets/brand/lockup-dark.png" alt="AWS Builder Center" /></div>
            <div>
              <p className="eyebrow text-green">Builder Center toolkit</p>
              <h1 className="text-lg font-bold tracking-tight md:text-xl">Universal Post Studio</h1>
            </div>
          </div>
          <Status config={config} />
        </div>
      </header>

      <main className="app-workspace app-scrollbar relative z-10 min-w-0 bg-grid">
        <section className="workspace-pane workspace-form app-scrollbar bg-ink px-6 py-10 md:px-10 md:py-12 xl:px-12">
          <div className="mb-10 max-w-3xl">
            <p className="eyebrow mb-4 text-pink">01 / Configure authorship and content</p>
            <h2 className="display-title">From brief to <span className="text-green">finished post.</span></h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-light">
              Enter the brief and receive finished posts. The AI writes only the content; the studio calculates three valid compositions per page and selects one within the design-system rules.
            </p>
            {config && !config.mockMode && !config.tokenConfigured && (
              <p className="mt-5 border-l-4 border-orange bg-orange/10 px-4 py-3 text-sm text-orange">
                Configure <code>HF_TOKEN</code> on the server to enable generation. Prompt preview remains available.
              </p>
            )}
            {config && !config.rendererReady && (
              <p className="mt-3 border-l-4 border-orange bg-orange/10 px-4 py-3 text-sm text-orange">
                Renderer unavailable: {config.rendererMode}. Check that Python 3 and Pillow are installed.
              </p>
            )}
            {result && <GenerationCostCard cost={result.cost} />}
          </div>

          <form onSubmit={handleSubmit} className="form-shell" aria-busy={busy !== null}>
            <fieldset disabled={busy !== null} className="form-stack">
            <FieldBlock number="01" title="About you" accent="blue">
              <Toggle checked={form.useAboutFooter} onChange={(value) => update('useAboutFooter', value)} label="Use About you in the footer?" />
              <fieldset disabled={!form.useAboutFooter} className={`about-fields mt-6 ${form.useAboutFooter ? '' : 'about-fields-disabled'}`}>
                <div className="grid gap-6 lg:grid-cols-[1fr_1fr_240px]">
                  <Field label="Your name" hint={`${form.aboutName.length}/80`}>
                    <input maxLength={80} value={form.aboutName} onChange={(e) => update('aboutName', e.target.value)} placeholder="Ex.: Pedro Borges" />
                  </Field>
                  <Field label="Your subtitle" hint={`${form.aboutSubtitle.length}/120`}>
                    <input maxLength={120} value={form.aboutSubtitle} onChange={(e) => update('aboutSubtitle', e.target.value)} placeholder="Ex.: Cloud Engineer · AWS Community Builder" />
                  </Field>
                  <div>
                    <p className="field-label mb-2">Your photo</p>
                    <div className="about-photo-control">
                      {form.aboutPhoto ? <img src={form.aboutPhoto} alt="Photo cropped for the footer" /> : <span aria-hidden="true">1080<br />×<br />1080</span>}
                      <label className="mini-button about-photo-import">
                        Import
                        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { importPhoto(event.target.files?.[0]); event.target.value = '' }} />
                      </label>
                      {form.aboutPhoto && <button type="button" className="mini-button" onClick={() => update('aboutPhoto', '')}>Remove</button>}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-light">The photo will be cropped in a square window and saved at 1080 × 1080 px before upload.</p>
              </fieldset>
            </FieldBlock>

            <FieldBlock number="02" title="Central idea" accent="pink">
              <div className="grid gap-6 lg:grid-cols-2">
                <Field label="What is the post topic?" hint={`${form.theme.length}/180`}>
                  <input required minLength={3} maxLength={180} value={form.theme} onChange={(e) => update('theme', e.target.value)} placeholder="E.g.: CI/CD with AWS services" />
                </Field>
                <Field label="What should the post achieve?" hint={`${form.goal.length}/500`}>
                  <input required minLength={3} maxLength={500} value={form.goal} onChange={(e) => update('goal', e.target.value)} placeholder="E.g.: Teach an application's pipeline" />
                </Field>
              </div>
            </FieldBlock>

            <FieldBlock number="03" title="Format and narrative" accent="green">
              <fieldset>
                <legend className="field-label mb-3">Where will it be published?</legend>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Publication format">
                  {formats.map((format) => (
                    <button type="button" role="radio" aria-checked={form.platform === format.value} key={format.value} className={`format-card ${form.platform === format.value ? 'format-card-active' : ''}`} onClick={() => update('platform', format.value)}>
                      <span className="text-xs uppercase tracking-[0.16em] text-muted-light">{format.channel}</span>
                      <strong className="mt-3 block text-sm">{format.label}</strong>
                      <span className="mt-1 block text-xs text-muted-light">{format.dimensions}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="field-label mb-3">How much information do you want?</legend>
                <div className="grid gap-2 md:grid-cols-3" role="radiogroup" aria-label="Information level">
                  {contentLevels.map((level) => (
                    <button type="button" role="radio" aria-checked={form.contentLevel === level.value} key={level.value} className={`format-card ${form.contentLevel === level.value ? 'format-card-active' : ''}`} onClick={() => update('contentLevel', level.value)}>
                      <strong className="block text-sm">{level.label}</strong>
                      <span className="mt-2 block text-xs leading-5 text-muted-light">{level.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="field-label mb-3">What will the theme color be?</legend>
                <div className="theme-picker" role="radiogroup" aria-label="Theme color">
                  {colorThemes.map((theme) => (
                    <button type="button" role="radio" aria-checked={form.colorTheme === theme.value} key={theme.value} className={`theme-option theme-option-${theme.value} ${form.colorTheme === theme.value ? 'theme-option-active' : ''}`} onClick={() => update('colorTheme', theme.value)}>
                      <span>{theme.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-light">One color keeps the campaign monochromatic. Colorful distributes official colors randomly and reproducibly.</p>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="field-label mb-3">Page appearance</legend>
                <div className="appearance-picker" role="radiogroup" aria-label="Light or dark page appearance">
                  {pageThemes.map((theme) => (
                    <button type="button" role="radio" aria-checked={form.pageTheme === theme.value} key={theme.value} className={`appearance-option appearance-option-${theme.value} ${form.pageTheme === theme.value ? 'appearance-option-active' : ''}`} onClick={() => update('pageTheme', theme.value)}>
                      <strong>{theme.label}</strong>
                      <span>{theme.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr_1fr]">
                <Field label="Quantity" hint="1–10 pages">
                  <div className="number-control">
                    <button type="button" aria-label="Decrease pages" onClick={() => update('postCount', Math.max(1, form.postCount - 1))}>−</button>
                    <output>{String(form.postCount).padStart(2, '0')}</output>
                    <button type="button" aria-label="Increase pages" onClick={() => update('postCount', Math.min(10, form.postCount + 1))}>+</button>
                  </div>
                </Field>
                <Field label="Audience">
                  <input value={form.audience} onChange={(e) => update('audience', e.target.value)} />
                </Field>
                <Field label="Voice and tone">
                  <input value={form.tone} onChange={(e) => update('tone', e.target.value)} />
                </Field>
              </div>
            </FieldBlock>

            <FieldBlock number="04" title="Action and context" accent="orange">
              <div className="grid gap-6 lg:grid-cols-3">
                <Field label="Desired CTA" hint="optional">
                  <input maxLength={280} value={form.cta} onChange={(e) => update('cta', e.target.value)} placeholder="E.g.: Save this to build your next pipeline" />
                </Field>
                <Field label="Language">
                  <input value={form.language} onChange={(e) => update('language', e.target.value)} />
                </Field>
                <Field label="Hugging Face model" hint="OpenAI-compatible">
                  <input value={form.model} onChange={(e) => update('model', e.target.value)} placeholder="openai/gpt-oss-120b:fastest" />
                </Field>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Toggle checked={form.firstPageCta} onChange={(value) => update('firstPageCta', value)} label="CTA na capa" />
                <Toggle checked={form.lastPageCta} onChange={(value) => update('lastPageCta', value)} label="CTA on the last post" />
              </div>
              <div className="mt-6">
                <Field label="Contexto adicional" hint={`${form.additionalContext.length}/4000`}>
                  <textarea maxLength={4000} rows={5} value={form.additionalContext} onChange={(e) => update('additionalContext', e.target.value)} placeholder="Required facts, topics, examples, content restrictions…" />
                </Field>
              </div>
            </FieldBlock>

            <div className="flex flex-col gap-3 bg-panel p-5 sm:flex-row sm:items-center sm:justify-between md:p-7">
              <p className="max-w-md text-sm leading-6 text-muted-light">Content, algorithmic composition, and final files are generated in one step.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="button-secondary" type="button" disabled={busy !== null} onClick={handlePreview}>
                  {busy === 'prompt' ? 'Building…' : 'Review prompt'}
                </button>
                <button className="button-primary" type="submit" disabled={busy !== null || !config?.designSystemReady || !config.rendererReady || (!config.mockMode && !config.tokenConfigured)}>
                  {busy === 'generate' ? 'Generating posts…' : 'Generate posts'} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
            </fieldset>
          </form>

          {error && <div role="alert" className="mt-6 border-l-4 border-orange bg-orange/10 p-4 text-sm text-orange">{error}</div>}

          {(mode === 'prompt' || mode === 'result') && (
            <ResultPanel
              mode={mode}
              prompt={prompt}
              result={result}
              stale={artifactIsStale}
              copied={copied}
              onCopy={copyScript}
              onDownload={downloadScript}
              onClose={() => setMode('brief')}
            />
          )}
        </section>

        <Gallery
          result={result}
          resultIsStale={artifactIsStale}
          loading={busy === 'generate'}
          theme={form.theme}
          pageCount={form.postCount}
          channel={selectedFormat.channel}
        />
      </main>
      {cropSource && (
        <PhotoCropper
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onConfirm={(photo) => { update('aboutPhoto', photo); setCropSource(null) }}
        />
      )}
    </div>
  )
}

function GenerationCostCard({ cost }: { cost: GenerateResponse['cost'] }) {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: cost.currency || 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return (
    <section className="cost-card mt-6" aria-label="Generation cost">
      <div className="flex items-start justify-between gap-4">
        <div><p className="eyebrow text-orange">Generation cost</p><p className="mt-2 text-sm text-muted-light">HF + Jev usage reported by providers</p></div>
        <strong className="cost-total">{money.format(cost.total)}</strong>
      </div>
      <div className="cost-breakdown mt-5">
        <div><span>Hugging Face</span><strong>{money.format(cost.hf)}</strong></div>
        <div><span>Jev</span><strong>{money.format(cost.jev)}</strong></div>
      </div>
      {(cost.hfPromptTokens > 0 || cost.hfCompletionTokens > 0) && <p className="mt-3 text-[10px] text-muted-light">HF tokens: {cost.hfPromptTokens.toLocaleString()} input + {cost.hfCompletionTokens.toLocaleString()} output</p>}
      {(cost.jevPromptTokens > 0 || cost.jevCompletionTokens > 0) && <p className="mt-1 text-[10px] text-muted-light">Jev tokens: {cost.jevPromptTokens.toLocaleString()} input + {cost.jevCompletionTokens.toLocaleString()} output</p>}
      {cost.estimated && <p className="mt-4 text-[10px] leading-4 text-muted-light">Usage or token pricing is unavailable for part of this generation, so that provider was not added to the total.</p>}
    </section>
  )
}

function Status({ config }: { config: AppConfig | null }) {
  const label = !config ? 'Connecting' : !config.designSystemReady ? 'Design system missing' : !config.rendererReady ? 'Renderer unavailable' : config.mockMode ? `Mock mode • ${config.rendererMode}` : config.tokenConfigured ? `HF + ${config.rendererMode}` : 'Token pending'
  const ok = Boolean(config?.designSystemReady && config.rendererReady && (config.tokenConfigured || config.mockMode))
  return <div className="hidden items-center gap-2 border border-grid px-3 py-2 text-xs sm:flex"><span className={`status-dot ${ok ? 'bg-green' : 'bg-orange'}`} />{label}</div>
}

function FieldBlock({ number, title, accent, children }: { number: string; title: string; accent: 'pink' | 'green' | 'orange' | 'blue'; children: React.ReactNode }) {
  const accentClass = { pink: 'text-pink', green: 'text-green', orange: 'text-orange', blue: 'text-blue' }[accent]
  return (
    <section className="form-section bg-panel p-5 md:p-7">
      <div className="mb-6 flex items-center gap-3"><span className={`step-number ${accentClass}`}>{number}</span><h3 className="text-base font-bold">{title}</h3></div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between gap-3"><span className="field-label">{label}</span>{hint && <span className="text-[11px] text-muted-light">{hint}</span>}</span>{children}</label>
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? 'toggle-active' : ''}`} onClick={() => onChange(!checked)}><span className="toggle-box" aria-hidden="true">{checked ? '✓' : ''}</span>{label}</button>
}

const cropSize = 420

function PhotoCropper({ source, onCancel, onConfirm }: { source: string; onCancel: () => void; onConfirm: (photo: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ pointer: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dimensions = useMemo(() => {
    if (!image) return { base: 1, width: cropSize, height: cropSize }
    const base = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight)
    return { base, width: image.naturalWidth * base * zoom, height: image.naturalHeight * base * zoom }
  }, [image, zoom])

  function clamp(next: { x: number; y: number }, width = dimensions.width, height = dimensions.height) {
    return {
      x: Math.min(0, Math.max(cropSize - width, next.x)),
      y: Math.min(0, Math.max(cropSize - height, next.y)),
    }
  }

  useEffect(() => {
    const photo = new Image()
    photo.onload = () => {
      const base = Math.max(cropSize / photo.naturalWidth, cropSize / photo.naturalHeight)
      const width = photo.naturalWidth * base
      const height = photo.naturalHeight * base
      setImage(photo)
      setZoom(1)
      setOffset({ x: (cropSize - width) / 2, y: (cropSize - height) / 2 })
    }
    photo.src = source
  }, [source])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, cropSize, cropSize)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, offset.x, offset.y, dimensions.width, dimensions.height)
  }, [image, offset, dimensions])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', close)
    }
  }, [onCancel])

  function changeZoom(value: number) {
    if (!image) return
    const oldWidth = dimensions.width
    const oldHeight = dimensions.height
    const centerX = (cropSize / 2 - offset.x) / oldWidth
    const centerY = (cropSize / 2 - offset.y) / oldHeight
    const base = Math.max(cropSize / image.naturalWidth, cropSize / image.naturalHeight)
    const width = image.naturalWidth * base * value
    const height = image.naturalHeight * base * value
    setZoom(value)
    setOffset(clamp({ x: cropSize / 2 - centerX * width, y: cropSize / 2 - centerY * height }, width, height))
  }

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const scale = cropSize / event.currentTarget.getBoundingClientRect().width
    dragRef.current = { pointer: event.pointerId, x: event.clientX * scale, y: event.clientY * scale, offsetX: offset.x, offsetY: offset.y }
  }

  function pointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointer !== event.pointerId) return
    const scale = cropSize / event.currentTarget.getBoundingClientRect().width
    setOffset(clamp({ x: drag.offsetX + event.clientX * scale - drag.x, y: drag.offsetY + event.clientY * scale - drag.y }))
  }

  function finishCrop() {
    if (!image) return
    const output = document.createElement('canvas')
    output.width = 1080
    output.height = 1080
    const context = output.getContext('2d')
    if (!context) return
    const scale = dimensions.base * zoom
    const sourceX = -offset.x / scale
    const sourceY = -offset.y / scale
    const sourceSide = cropSize / scale
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, sourceX, sourceY, sourceSide, sourceSide, 0, 0, 1080, 1080)
    onConfirm(output.toDataURL('image/jpeg', .9))
  }

  return (
    <div className="crop-overlay app-scrollbar" role="dialog" aria-modal="true" aria-label="Crop photo for the footer" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="crop-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <header className="crop-header">
          <div><p className="eyebrow text-blue">About you</p><h2 className="mt-2 text-lg font-bold">Square crop</h2></div>
          <button type="button" className="viewer-close" onClick={onCancel} aria-label="Cancel crop">×</button>
        </header>
        <div className="crop-body">
          <div className="crop-canvas-shell">
            <canvas ref={canvasRef} width={cropSize} height={cropSize} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} />
            <span className="crop-frame" aria-hidden="true" />
          </div>
          <label className="crop-zoom"><span className="field-label">Zoom</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} /></label>
          <p className="text-xs leading-5 text-muted-light">Drag the photo inside the square. The result will be exported at 1080 × 1080 px.</p>
        </div>
        <footer className="crop-actions"><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button><button type="button" className="button-primary" disabled={!image} onClick={finishCrop}>Use this crop</button></footer>
      </section>
    </div>
  )
}

function PipelineItem({ n, text, active }: { n: string; text: string; active: boolean }) {
  return <li className={`flex items-center gap-3 ${active ? 'text-white' : 'text-muted-light'}`}><span className={`grid h-7 w-7 place-items-center border text-xs ${active ? 'border-green text-green' : 'border-grid'}`}>{n}</span>{text}</li>
}

function Gallery({ result, resultIsStale, loading, theme, pageCount, channel }: { result: GenerateResponse | null; resultIsStale: boolean; loading: boolean; theme: string; pageCount: number; channel: string }) {
  const images = result?.files.filter((file) => file.kind === 'page') ?? []
  const documents = result?.files.filter((file) => file.kind === 'document') ?? []
  const preview = result?.files.find((file) => file.kind === 'preview')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => setViewerIndex(null), [result?.jobId])
  return (
    <aside className="gallery-shell workspace-pane workspace-gallery app-scrollbar bg-panel p-5 md:p-7">
      <div className="gallery-sticky">
        <div className="flex items-end justify-between gap-4 border-b border-grid pb-5">
          <div><p className="eyebrow text-blue">03 / Result</p><h2 className="mt-2 text-xl font-bold">Generated posts</h2></div>
          <span className="text-right text-xs text-muted-light">{resultIsStale && images.length ? 'Previous preview · ' : ''}{images.length ? `${images.length} images` : `${String(pageCount).padStart(2, '0')} expected`}</span>
        </div>

        {loading ? (
          <div className="gallery-loading mt-5" role="status">
            <div className="loading-card" /><div className="loading-card" />
            <p className="col-span-full mt-2 text-center text-xs text-green">Preparing your campaign…</p>
          </div>
        ) : images.length ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {images.map((file, index) => (
              <figure key={file.url} className="generated-card">
                <button type="button" onClick={() => setViewerIndex(index)} title={`View ${file.name} at full size`} aria-label={`Open viewer for post ${index + 1}`}>
                  <img src={file.url} alt={`Generated post ${index + 1}: ${file.name}`} loading="lazy" />
                </button>
                <figcaption><span>{String(index + 1).padStart(2, '0')}</span><span className="truncate">{file.width} × {file.height} · {file.name.split('/').pop()}</span></figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mt-5 aspect-[4/5] border border-grid bg-ink p-5 preview-card">
            <div className="flex items-start justify-between gap-4">
              <span className="preview-logo"><img src="/design-assets/brand/lockup-dark.png" alt="AWS Builder Center" /></span>
              <span className="text-xs text-muted-light">{String(pageCount).padStart(2, '0')} pages</span>
            </div>
            <div className="mt-auto">
              <p className="text-xs uppercase tracking-[0.2em] text-pink">{channel}</p>
              <p className="mt-3 break-words text-2xl font-bold leading-tight">{theme || 'Your gallery will appear here'}</p>
              <div className="mt-5 h-2 w-20 bg-green" />
            </div>
          </div>
        )}

        {preview && <a className="download-file mt-4" href={preview.url} target="_blank" rel="noreferrer"><span>PNG</span><b>Carousel overview</b><span>↗</span></a>}

        {documents.length > 0 && (
          <div className="mt-4 grid gap-2">
            {documents.map((file) => <a key={file.url} className="download-file" href={file.url} target="_blank" rel="noreferrer"><span>PDF</span><b>{file.name.split('/').pop()}</b><span>↓</span></a>)}
          </div>
        )}

        {result?.executionLog && (
          <details className="mt-4 min-w-0 border border-grid bg-code p-4 text-xs"><summary className="cursor-pointer font-bold text-muted-light">Rendering log</summary><pre className="app-scrollbar mt-3 max-h-48 min-w-0 overflow-auto whitespace-pre-wrap break-all text-code-text">{result.executionLog}</pre></details>
        )}

        <div className="mt-7 border-t border-grid pt-6">
          <p className="eyebrow text-muted-light">Pipeline</p>
          <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <PipelineItem n="1" text="Brief validated in Go" active />
            <PipelineItem n="2" text="AI generates content only" active={Boolean(result)} />
            <PipelineItem n="3" text="3 layouts calculated; 1 selected" active={images.length > 0} />
            <PipelineItem n="4" text="Design and files validated" active={images.length > 0} />
          </ol>
        </div>
      </div>
      {viewerIndex !== null && images[viewerIndex] && (
        <ImageViewer images={images} index={viewerIndex} onChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </aside>
  )
}

function ImageViewer({ images, index, onChange, onClose }: { images: GeneratedAsset[]; index: number; onChange: (index: number) => void; onClose: () => void }) {
  const current = images[index]
  const previous = () => onChange((index - 1 + images.length) % images.length)
  const next = () => onChange((index + 1) % images.length)

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') previous()
      if (event.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [index, images.length, onClose])

  return (
    <div className="image-viewer app-scrollbar" role="dialog" aria-modal="true" aria-label={`Post viewer, image ${index + 1} of ${images.length}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="viewer-grid" onMouseDown={(event) => event.stopPropagation()}>
        <header className="viewer-header">
          <div><p className="eyebrow text-green">Post {String(index + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</p><p className="viewer-filename">{current.name.split('/').pop()}</p></div>
          <button type="button" className="viewer-close" onClick={onClose} autoFocus aria-label="Close viewer">×</button>
        </header>

        <div className="viewer-stage">
          <img src={current.url} alt={`Generated post ${index + 1}: ${current.name}`} />
        </div>

        <aside className="viewer-downloads app-scrollbar" aria-label="Download images">
          <p className="eyebrow text-blue">Download image</p>
          <div className="viewer-download-list">
            {images.map((image, imageIndex) => (
              <a key={image.url} className={imageIndex === index ? 'viewer-download-active' : ''} href={image.url} download={image.name.split('/').pop()} onClick={() => onChange(imageIndex)}>
                <span>{String(imageIndex + 1).padStart(2, '0')}</span><b>PNG</b><span aria-hidden="true">↓</span>
              </a>
            ))}
          </div>
        </aside>

        <footer className="viewer-navigation">
          <button type="button" onClick={previous} disabled={images.length < 2}><span aria-hidden="true">←</span> Back</button>
          <span>{current.width} × {current.height}</span>
          <button type="button" onClick={next} disabled={images.length < 2}>Next <span aria-hidden="true">→</span></button>
        </footer>
      </div>
    </div>
  )
}

function ResultPanel({ mode, prompt, result, stale, copied, onCopy, onDownload, onClose }: { mode: Mode; prompt: string; result: GenerateResponse | null; stale: boolean; copied: boolean; onCopy: () => void; onDownload: () => void; onClose: () => void }) {
  const content = mode === 'result' && result ? result.script : prompt
  return (
    <section className="mt-8 border border-grid bg-code">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-grid p-4">
        <div><p className="eyebrow text-green">{mode === 'result' ? 'Code and rendering ready' : 'Production prompt'}</p><p className="mt-1 text-sm text-muted-light">{mode === 'result' && result ? `${result.filename} • ${result.model} • job ${result.jobId.slice(0, 8)}` : 'Review the production contract'}</p></div>
        <div className="flex gap-2">
          {mode === 'result' && <button type="button" className="mini-button" onClick={onCopy}>{copied ? 'Copied ✓' : 'Copy'}</button>}
          {mode === 'result' && <button type="button" className="mini-button mini-button-accent" onClick={onDownload}>Download .py</button>}
          <button type="button" className="mini-button" onClick={onClose}>Close</button>
        </div>
      </header>
      {stale && <div className="border-b border-orange bg-orange/10 px-5 py-3 text-xs font-bold text-orange">Preview predates the current changes. Generate again to update it.</div>}
      {mode === 'result' && <div className="border-b border-grid px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-green">Reproducible file: studio renderer, content, and layout seed</div>}
      <pre tabIndex={0} className="app-scrollbar max-h-[620px] min-w-0 overflow-auto whitespace-pre-wrap break-all p-5 text-xs leading-6 text-code-text md:p-7">{content}</pre>
    </section>
  )
}

export default App
