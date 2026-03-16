import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const PLAN_STYLES = {
  free: 'border-slate-200 bg-slate-100 text-slate-700',
  pro: 'border-sky-200 bg-sky-100 text-sky-700',
  enterprise: 'border-emerald-200 bg-emerald-100 text-emerald-700',
}

function PlanBadge({ plan, className }) {
  const slug = (plan?.slug || 'free').toLowerCase()
  const label = plan?.name ? `${plan.name} Plan` : 'Free Plan'

  return (
    <Badge
      variant="secondary"
      className={cn(PLAN_STYLES[slug] ?? PLAN_STYLES.free, className)}
    >
      {label}
    </Badge>
  )
}

export default PlanBadge
