import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary'
  children: ReactNode
  fullWidth?: boolean
}

export function Button({ variant = 'primary', children, fullWidth = true, className = '', ...props }: Props) {
  const base = `btn ${fullWidth ? 'w-full' : 'w-auto'}`
  const variantClass = variant === 'accent' ? 'btn-accent' : variant === 'secondary' ? 'btn-secondary' : 'btn-primary'
  return (
    <button className={`${base} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  )
}
