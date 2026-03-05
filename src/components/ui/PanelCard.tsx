import type { HTMLAttributes } from 'react'
import { cn } from './cn'

type PanelCardProps = HTMLAttributes<HTMLElement>

function PanelCard({ className, ...props }: PanelCardProps) {
  return <section className={cn('mt-2.5 rounded-xl border border-slate-600/80 bg-slate-950/75 p-2.5', className)} {...props} />
}

export default PanelCard
