import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function InputField({ label, className = '', ...props }: Props) {
  return (
    <div className="flex flex-col">
      {label && <label className="input-label">{label}</label>}
      <input className={`input-field ${className}`} {...props} />
    </div>
  )
}
