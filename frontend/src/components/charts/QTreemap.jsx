import { ResponsiveTreeMap } from '@nivo/treemap'

import { createNivoTheme } from '@/lib/nivo-theme'
import { getAnalyticsColors } from '@/lib/analytics'

export default function QTreemap({ data, colorScheme = 'default', height = 320 }) {
  const colors = getAnalyticsColors(colorScheme)

  return (
    <div className="h-[320px] w-full" style={{ height }}>
      <ResponsiveTreeMap
        data={data}
        identity="name"
        value="value"
        innerPadding={3}
        labelSkipSize={12}
        colors={colors}
        theme={createNivoTheme()}
      />
    </div>
  )
}
