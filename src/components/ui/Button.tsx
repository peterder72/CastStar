import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

type ButtonTone = 'default' | 'danger'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone
  size?: ButtonSize
}

const toneClasses: Record<ButtonTone, string> = {
  default:
    'border-slate-500/70 bg-slate-900/70 text-slate-100 hover:border-cyan-300/55 hover:bg-slate-800/80',
  danger: 'border-rose-500/60 bg-rose-950/70 text-rose-200 hover:bg-rose-900/70',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-[0.76rem]',
  md: 'px-3 py-1.5 text-xs font-semibold',
}

function Button({ tone = 'default', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('rounded-lg border text-left transition', toneClasses[tone], sizeClasses[size], className)}
      {...props}
    />
  )
}

export default Button
