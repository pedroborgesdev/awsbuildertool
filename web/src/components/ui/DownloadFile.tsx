import type { ReactNode } from 'react'

interface DownloadFileProps {
  href: string
  badge: string
  children: ReactNode
  trailing?: ReactNode
  className?: string
}

export function DownloadFile({ href, badge, children, trailing = '↗', className = 'download-file' }: DownloadFileProps) {
  return (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      <span>{badge}</span>
      <b>{children}</b>
      <span>{trailing}</span>
    </a>
  )
}
