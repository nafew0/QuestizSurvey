import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

export default function QGaugeChart({ value = 0, height = 280 }) {
  const normalized = Math.max(-100, Math.min(100, Number(value || 0)))
  const fillAngle = ((normalized + 100) / 200) * 180

  const data = [
    { name: 'Detractors', value: 60, color: '#ef4444' },
    { name: 'Passives', value: 20, color: '#f59e0b' },
    { name: 'Promoters', value: 20, color: '#22c55e' },
  ]

  return (
    <div className="relative h-[280px] w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="68%"
            outerRadius="94%"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Pie
            data={[{ value: fillAngle }, { value: 180 - fillAngle }]}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="48%"
            outerRadius="62%"
            stroke="none"
          >
            <Cell fill="rgb(var(--theme-foreground-rgb))" />
            <Cell fill="rgb(var(--theme-neutral-strong-rgb))" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">NPS score</p>
        <p className="text-4xl font-semibold tracking-tight text-foreground">
          {normalized > 0 ? '+' : ''}
          {normalized}
        </p>
      </div>
    </div>
  )
}
