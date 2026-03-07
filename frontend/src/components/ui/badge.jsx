import { cn } from '@/lib/utils'

const BADGE_VARIANTS = {
  default: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
  outline: 'bg-transparent text-slate-700 border-slate-200',
}

function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
        BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.default,
        className
      )}
      {...props}
    />
  )
}

export { Badge }

