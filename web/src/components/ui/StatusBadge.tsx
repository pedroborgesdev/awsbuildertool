import type { AppConfig } from '../../types'

export function StatusBadge({ config }: { config: AppConfig | null }) {
  const ready = Boolean(config?.designSystemReady && config.rendererReady && (config.tokenConfigured || config.mockMode))
  const label = !config ? 'Connecting' : ready ? (config.mockMode ? 'Demo' : 'Ready') : 'Unavailable'

  return (
    <div className="flex items-center gap-2 whitespace-nowrap border border-grid px-2.5 py-1.5 text-[11px]">
      <span className={`inline-block size-2 ${ready ? 'bg-green' : 'bg-orange'}`} />
      {label}
    </div>
  )
}
