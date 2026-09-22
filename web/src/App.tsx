import { FormEvent, useEffect, useMemo, useState } from 'react'
import { generateScript, getConfig, previewPrompt } from './api'
import { formats, initialForm } from './constants'
import { AppShell, FormPane, Header, Workspace } from './components/layout/AppShell'
import { BriefForm } from './components/form/BriefForm'
import { BriefIntro } from './components/form/BriefIntro'
import { Gallery } from './components/gallery/Gallery'
import { PhotoCropper } from './components/photo/PhotoCropper'
import { ResultPanel } from './components/result/ResultPanel'
import { ErrorAlert } from './components/ui/Alert'
import type { AppConfig, GenerateRequest, GenerateResponse, StudioMode } from './types'

function App() {
  const [form, setForm] = useState<GenerateRequest>(initialForm)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [mode, setMode] = useState<StudioMode>('brief')
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
    <AppShell>
      <Header config={config} />
      <Workspace>
        <FormPane>
          <BriefIntro config={config} result={result} />
          <BriefForm
            form={form}
            config={config}
            busy={busy}
            onUpdate={update}
            onImportPhoto={importPhoto}
            onPreview={handlePreview}
            onSubmit={handleSubmit}
          />
          {error && <ErrorAlert>{error}</ErrorAlert>}
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
        </FormPane>
        <Gallery
          result={result}
          resultIsStale={artifactIsStale}
          loading={busy === 'generate'}
          theme={form.theme}
          pageCount={form.postCount}
          channel={selectedFormat.channel}
        />
      </Workspace>
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
