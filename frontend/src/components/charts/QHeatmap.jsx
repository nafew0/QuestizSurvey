import { ResponsiveHeatMap } from '@nivo/heatmap'

import { createNivoTheme } from '@/lib/nivo-theme'
import { getAnalyticsColors } from '@/lib/analytics'

export default function QHeatmap({
  data = [],
  colorScheme = 'default',
  height = 320,
}) {
  const colors = getAnalyticsColors(colorScheme)

  return (
    <div className="h-[320px] w-full" style={{ height }}>
      <ResponsiveHeatMap
        data={data}
        margin={{ top: 24, right: 16, bottom: 50, left: 80 }}
        valueFormat={(value) => `${value ?? 0}`}
        axisTop={null}
        axisRight={null}
        colors={{
          type: 'sequential',
          colors,
        }}
        emptyColor="rgb(var(--theme-neutral-rgb))"
        theme={createNivoTheme()}
        labelTextColor="rgb(var(--theme-foreground-rgb))"
        tooltip={({ cell }) => (
          <div className="theme-panel rounded-2xl px-3 py-2 text-xs shadow-lg">
            <p className="font-semibold text-foreground">
              {cell.serieId} × {cell.xKey}
            </p>
            <p className="mt-1 text-muted-foreground">
              {cell.data.count ?? cell.value} responses
            </p>
            {cell.data.percentage != null ? (
              <p className="text-muted-foreground">{cell.data.percentage}%</p>
            ) : null}
          </div>
        )}
      />
    </div>
  )
}
