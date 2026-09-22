import type { ReactNode } from 'react'
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
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button type="button" className="brand-lockup" onClick={onHome}>
          <img src="/logo.png" alt="" />
          <span className="brand-copy">
            <span className="brand-title">Builder Tool</span>
            <span className="brand-subtitle">For AWS Builder Center</span>
          </span>
        </button>
        <div className="header-actions">
          {view === 'landing' && (
            <Button className="header-cta" onClick={onStart} disabled={!canCreate}>
              Start a post
            </Button>
          )}
          {view === 'create' && hasResult && (
            <Button variant="secondary" onClick={onResult}>View posts</Button>
          )}
          {view === 'result' && (
            <Button variant="secondary" onClick={onEdit}>Edit brief</Button>
          )}
        </div>
      </div>
    </header>
  )
}
