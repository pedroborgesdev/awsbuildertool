import type { AppConfig } from '../../types'

export function StatusBadge({ config }: { config: AppConfig | null }) {
  const ready = Boolean(config?.designSystemReady && config.rendererReady && (config.tokenConfigured || config.mockMode))
  const label = !config ? 'Connecting' : ready ? (config.mockMode ? 'Demo' : 'Ready') : 'Unavailable'

  return (
    <div className="status-badge">
      <span className={`status-dot ${ready ? 'bg-green' : 'bg-orange'}`} />
      {label}
    </div>
  )
}
