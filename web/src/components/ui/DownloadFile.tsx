import type { ReactNode } from 'react'

interface DownloadFileProps {
  href: string
  badge: string
  children: ReactNode
  trailing?: ReactNode
  className?: string
}

const defaultClass = [
  'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-grid bg-ink p-3 text-[11px] text-white no-underline',
  'hover:border-green',
  '[&>span:first-child]:bg-pink [&>span:first-child]:px-[7px] [&>span:first-child]:py-[5px] [&>span:first-child]:font-black [&>span:first-child]:text-ink',
  '[&_b]:truncate',
].join(' ')

export function DownloadFile({ href, badge, children, trailing = '↗', className = defaultClass }: DownloadFileProps) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      <span>{badge}</span>
      <b>{children}</b>
      <span>{trailing}</span>
    </a>
  )
}
