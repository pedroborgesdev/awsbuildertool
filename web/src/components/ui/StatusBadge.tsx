import type { AppConfig } from '../../types'

export function StatusBadge({ config }: { config: AppConfig | null }) {
  const label = !config
    ? 'Connecting'
    : !config.designSystemReady
      ? 'Design system missing'
      : !config.rendererReady
        ? 'Renderer unavailable'
        : config.mockMode
          ? `Mock mode • ${config.rendererMode}`
          : config.tokenConfigured
            ? `HF + ${config.rendererMode}`
            : 'Token pending'
  const ok = Boolean(config?.designSystemReady && config.rendererReady && (config.tokenConfigured || config.mockMode))
  return (
    <div className="hidden items-center gap-2 border border-grid px-3 py-2 text-xs sm:flex">
      <span className={`status-dot ${ok ? 'bg-green' : 'bg-orange'}`} />
      {label}
    </div>
  )
}
