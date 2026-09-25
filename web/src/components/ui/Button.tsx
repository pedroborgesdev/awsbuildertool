import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'mini' | 'mini-accent' | 'close'

const variantClass: Record<ButtonVariant, string> = {
  primary: [
    'min-h-12 border border-green bg-green px-[18px] text-xs font-black tracking-[.02em] text-ink',
    'hover:not-disabled:border-blue hover:not-disabled:bg-blue',
  ].join(' '),
  secondary: [
    'min-h-12 border border-[#657384] bg-transparent px-[18px] text-xs font-black tracking-[.02em] text-white',
    'hover:not-disabled:border-white',
  ].join(' '),
  mini: 'min-h-9 border border-border bg-transparent px-3 text-[11px] font-extrabold text-white hover:border-white',
  'mini-accent': 'min-h-9 border border-green bg-green px-3 text-[11px] font-extrabold text-ink hover:border-white',
  close: [
    'grid size-11 shrink-0 place-items-center border border-pink bg-pink text-[29px] leading-none font-black text-ink',
    'hover:border-white hover:bg-white focus-visible:border-white focus-visible:bg-white focus-visible:outline-none',
  ].join(' '),
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'primary', className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={['cursor-pointer disabled:cursor-not-allowed disabled:opacity-50', variantClass[variant], className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
