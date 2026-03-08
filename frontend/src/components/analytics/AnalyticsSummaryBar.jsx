import { ArrowDownRight, ArrowUpRight, Clock3, Gauge, Inbox, TrendingDown } from 'lucide-react'
import { Line, LineChart, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  buildSparklineData,
  computeResponsesToday,
  formatDuration,
  formatPercent,
} from '@/lib/analytics'

function MetricCard({ label, value, helper, icon: Icon, children }) {
  return (
    <Card className="theme-panel rounded-[1.75rem] border-[rgb(var(--theme-border-rgb)/0.82)]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {label}
          </p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
        </div>
        <div className="theme-icon-primary flex h-11 w-11 items-center justify-center rounded-2xl">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
      {children ? <div className="px-5 pb-4">{children}</div> : null}
    </Card>
  )
}

export default function AnalyticsSummaryBar({
  summary,
  loading = false,
  filtersActive = false,
}) {
  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="theme-panel rounded-[1.75rem] p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-24" />
            <Skeleton className="mt-6 h-16 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const sparklineData = buildSparklineData(summary)
  const { todayCount, delta } = computeResponsesToday(summary)
  const completionRate = Number(summary?.completion_rate || 0)
  const dropOffRate = Math.max(0, 100 - completionRate)

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <MetricCard
        label={`Total Responses${filtersActive ? ' (filtered)' : ''}`}
        value={summary?.total_responses ?? 0}
        helper="Last 14 days"
        icon={Inbox}
      >
        <div className="h-14 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="count"
                stroke="rgb(var(--theme-primary-rgb))"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </MetricCard>

      <MetricCard
        label="Completion Rate"
        value={formatPercent(completionRate)}
        helper={`${summary?.completed_count ?? 0} completed`}
        icon={Gauge}
      >
        <div className="flex h-14 items-center justify-start">
          <ResponsiveContainer width={72} height={72}>
            <RadialBarChart
              data={[{ value: completionRate }]}
              startAngle={90}
              endAngle={-270}
              innerRadius="76%"
              outerRadius="100%"
              barSize={8}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={12}
                fill="rgb(var(--theme-secondary-rgb))"
                background={{ fill: 'rgb(var(--theme-neutral-strong-rgb))' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      </MetricCard>

      <MetricCard
        label="Average Duration"
        value={formatDuration(Math.round(summary?.average_duration_seconds ?? 0))}
        helper="Across completed responses"
        icon={Clock3}
      />

      <MetricCard
        label="Responses Today"
        value={todayCount}
        helper={delta >= 0 ? `${delta} vs yesterday` : `${Math.abs(delta)} below yesterday`}
        icon={delta >= 0 ? ArrowUpRight : ArrowDownRight}
      />

      <MetricCard
        label="Drop-off Rate"
        value={formatPercent(dropOffRate)}
        helper={`${summary?.in_progress_count ?? 0} still in progress`}
        icon={TrendingDown}
      />
    </div>
  )
}
