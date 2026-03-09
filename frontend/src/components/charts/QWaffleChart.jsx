import { ResponsiveWaffle } from '@nivo/waffle'

import { createNivoTheme } from '@/lib/nivo-theme'
import { getAnalyticsColors } from '@/lib/analytics'

export default function QWaffleChart({ data = [], total = 100, colorScheme = 'default', height = 260 }) {
  const colors = getAnalyticsColors(colorScheme)
  const preparedData = data.map((item, index) => ({
    ...item,
    color: item.color || colors[index % colors.length] || colors[0] || '#2563eb',
  }))

  return (
    <div className="h-[260px] w-full" style={{ height }}>
      <ResponsiveWaffle
        data={preparedData}
        total={total}
        rows={10}
        columns={10}
        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
        colors={(item) => item?.color || colors[0] || '#2563eb'}
        emptyColor="rgb(var(--theme-neutral-strong-rgb))"
        theme={createNivoTheme()}
      />
    </div>
  )
}
