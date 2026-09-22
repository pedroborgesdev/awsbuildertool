import type { ReactNode } from 'react'

interface AlertProps {
  children: ReactNode
  className?: string
  role?: 'alert' | undefined
}

export function Alert({ children, className = 'mt-5', role }: AlertProps) {
  return (
    <p role={role} className={`${className} border-l-4 border-orange bg-orange/10 px-4 py-3 text-sm text-orange`}>
      {children}
    </p>
  )
}

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-6 border-l-4 border-orange bg-orange/10 p-4 text-sm text-orange">
      {children}
    </div>
  )
}
