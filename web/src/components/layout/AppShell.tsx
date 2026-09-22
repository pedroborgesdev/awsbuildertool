import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import { Button } from '../ui/Button'
import type { AppView } from '../../types'

export function AppShell({ view, children }: { view: AppView; children: ReactNode }) {
  return (
    <div className={`app-shell view-${view} bg-ink text-white`}>
      <div className="background-grid pointer-events-none" aria-hidden="true" />
      {children}
    </div>
  )
}

export function SiteHeader({
  view,
  canCreate,
  hasResult,
  onHome,
  onStart,
  onResult,
  onEdit,
}: {
  view: AppView
  canCreate: boolean
  hasResult: boolean
  onHome: () => void
  onStart: () => void
  onResult: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button type="button" className="brand-lockup" onClick={onHome}>
          <img src="/logo.png" alt="" />
          <span className="brand-copy">
            <span className="brand-title">{t.brand.title}</span>
            <span className="brand-subtitle">{t.brand.subtitle}</span>
          </span>
        </button>
        <div className="header-actions">
          {view === 'landing' && (
            <Button className="header-cta" onClick={onStart} disabled={!canCreate}>
              {t.header.start}
            </Button>
          )}
          {view === 'create' && hasResult && (
            <Button variant="secondary" onClick={onResult}>{t.header.viewPosts}</Button>
          )}
          {view === 'result' && (
            <Button variant="secondary" onClick={onEdit}>{t.header.edit}</Button>
          )}
        </div>
      </div>
    </header>
  )
}
