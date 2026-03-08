import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { getAnalyticsColors } from '@/lib/analytics'

import { ChartTooltip } from './chart-utils'

export default function QPieChart({
  data = [],
  dataKey = 'count',
  nameKey = 'label',
  colorScheme = 'default',
  colors,
  donut = false,
  showLabels = false,
  height = 300,
}) {
  const palette = colors || getAnalyticsColors(colorScheme)

  return (
    <div className="h-[300px] w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            innerRadius={donut ? '58%' : 0}
            outerRadius="84%"
            paddingAngle={3}
            label={showLabels ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`${entry[nameKey]}-${index}`}
                fill={palette[index % palette.length]}
              />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
