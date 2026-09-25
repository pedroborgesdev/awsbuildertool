import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import { Button } from '../ui/Button'
import type { AppView } from '../../types'

const viewClass: Record<AppView, string> = {
  landing: 'h-dvh overflow-x-hidden overflow-y-auto',
  create: 'grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden',
  result: 'grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden',
}

export function AppShell({ view, children }: { view: AppView; children: ReactNode }) {
  return (
    <div className={`relative isolate min-h-dvh w-full bg-ink pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-white ${viewClass[view]}`}>
      <div
        className="pointer-events-none fixed inset-y-0 left-0 hidden w-[72px] border-r border-grid bg-ink [background-image:linear-gradient(to_bottom,transparent_71px,#34404d_71px)] [background-size:72px_72px] min-[1200px]:block"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-[72px] border-l border-grid bg-ink [background-image:linear-gradient(to_bottom,transparent_71px,#34404d_71px)] [background-size:72px_72px] min-[1200px]:block"
        aria-hidden="true"
      />
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
    <header className="sticky top-0 z-30 h-[72px] border-b border-grid bg-ink min-[1200px]:bg-transparent">
      <div className="flex h-full w-full items-center justify-between gap-4 bg-ink px-5 py-2.5 min-[1200px]:mx-[72px] min-[1200px]:w-auto min-[1200px]:px-10 min-[1600px]:px-14">
        <button
          type="button"
          className="flex cursor-pointer min-h-11 w-auto max-w-[min(320px,68vw)] items-center gap-2.5 border-0 bg-transparent py-1 text-left max-[520px]:gap-2"
          onClick={onHome}
        >
          <img className="block size-9 object-cover max-[520px]:size-8" src="/logo.png" alt="" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-lg leading-[1.1] font-extrabold tracking-[-.03em] text-white max-[520px]:text-[15px]">{t.brand.title}</span>
            <span className="text-xs leading-[1.2] font-bold tracking-[.01em] text-muted-light max-[520px]:text-[10px]">{t.brand.subtitle}</span>
          </span>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view === 'landing' && (
            <a className="hidden min-h-10 items-center px-3 text-xs font-extrabold text-white no-underline hover:text-green focus-visible:text-green focus-visible:outline-none min-[720px]:inline-flex" href="https://github.com/pedroborgesdev/awsbuildertool" target="_blank" rel="noreferrer">
              {t.header.github} <span aria-hidden="true">↗</span>
            </a>
          )}
          {view === 'landing' && (
            <Button className="inline-flex items-center whitespace-nowrap max-[520px]:min-h-10 max-[520px]:px-3" onClick={onStart} disabled={!canCreate}>
              {t.header.start}
            </Button>
          )}
          {view === 'create' && hasResult && (
            <Button variant="secondary" className="min-h-10" onClick={onResult}>{t.header.viewPosts}</Button>
          )}
          {view === 'result' && (
            <Button variant="secondary" className="min-h-10" onClick={onEdit}>{t.header.edit}</Button>
          )}
        </div>
      </div>
    </header>
  )
}
