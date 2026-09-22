import type { ReactNode } from 'react'
import { StatusBadge } from '../ui/StatusBadge'
import type { AppConfig } from '../../types'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell bg-ink text-white">
      <div className="background-grid fixed inset-0 pointer-events-none" aria-hidden="true" />
      {children}
    </div>
  )
}

export function Header({ config }: { config: AppConfig | null }) {
  return (
    <header className="relative z-10 border-b border-grid bg-ink/95">
      <div className="flex min-h-24 w-full items-center justify-between gap-6 px-6 md:px-10 xl:px-12">
        <div className="flex items-center gap-4">
          <div className="brand-lockup">
            <img src="/design-assets/brand/lockup-dark.png" alt="AWS Builder Center" />
          </div>
          <div>
            <p className="eyebrow text-green">Builder Center toolkit</p>
            <h1 className="text-lg font-bold tracking-tight md:text-xl">Universal Post Studio</h1>
          </div>
        </div>
        <StatusBadge config={config} />
      </div>
    </header>
  )
}

export function Workspace({ children }: { children: ReactNode }) {
  return <main className="app-workspace app-scrollbar relative z-10 min-w-0 bg-grid">{children}</main>
}

export function FormPane({ children }: { children: ReactNode }) {
  return <section className="workspace-pane workspace-form app-scrollbar bg-ink px-6 py-10 md:px-10 md:py-12 xl:px-12">{children}</section>
}
