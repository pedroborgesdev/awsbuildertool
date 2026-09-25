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
        className="pointer-events-none fixed inset-0 -z-10 opacity-[.38] [background-image:linear-gradient(to_right,#34404d_1px,transparent_1px),linear-gradient(to_bottom,#34404d_1px,transparent_1px)] [background-size:120px_120px] [mask-image:linear-gradient(to_bottom,#000_0%,transparent_75%)]"
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
    <header className="sticky top-0 z-30 border-b border-grid bg-ink">
      <div className="mx-auto flex min-h-18 w-[min(1180px,100%)] items-center justify-between gap-4 px-5 py-2.5">
        <button
          type="button"
          className="flex cursor-pointer min-h-11 w-auto max-w-[min(320px,68vw)] items-center gap-2.5 border-0 bg-transparent py-1 text-left max-[520px]:gap-2"
          onClick={onHome}
        >
          <img className="block size-9 object-cover max-[520px]:size-8" src="/logo.png" alt="" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] leading-[1.1] font-extrabold tracking-[-.03em] text-white max-[520px]:text-[13px]">{t.brand.title}</span>
            <span className="text-[11px] leading-[1.2] font-bold tracking-[.01em] text-muted-light max-[520px]:text-[9px]">{t.brand.subtitle}</span>
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
