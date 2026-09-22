import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'mini' | 'mini-accent' | 'close'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  mini: 'mini-button',
  'mini-accent': 'mini-button mini-button-accent',
  close: 'viewer-close',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'primary', className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={[variantClass[variant], className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  )
}
