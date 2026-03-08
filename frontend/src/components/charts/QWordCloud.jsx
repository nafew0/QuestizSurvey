import { useMemo, useState } from 'react'

import { Slider } from '@/components/ui/slider'
import { getAnalyticsColors } from '@/lib/analytics'

export default function QWordCloud({
  words = [],
  maxWords = 80,
  colorScheme = 'default',
  onWordClick,
}) {
  const [minFrequency, setMinFrequency] = useState(1)
  const colors = getAnalyticsColors(colorScheme)

  const filteredWords = useMemo(() => {
    const source = words.filter((word) => word.value >= minFrequency).slice(0, maxWords)
    const maxValue = Math.max(...source.map((item) => item.value), 1)
    return source.map((item, index) => ({
      ...item,
      fontSize: 14 + ((item.value / maxValue) * 58),
      color: colors[index % colors.length],
      rotate: item.value % 5 === 0 ? 'rotate(90deg)' : 'rotate(0deg)',
    }))
  }, [colors, maxWords, minFrequency, words])

  const maxFrequency = Math.max(...words.map((item) => item.value), 1)

  return (
    <div className="space-y-4">
      <div className="flex min-h-[350px] flex-wrap content-center items-center justify-center gap-4 rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.8)] bg-[rgb(var(--theme-neutral-rgb)/0.65)] px-6 py-8 text-center">
        {filteredWords.length ? filteredWords.map((word) => (
          <button
            key={word.text}
            type="button"
            title={`${word.text}: ${word.value}`}
            onClick={() => onWordClick?.(word.text)}
            className="leading-none transition-transform hover:scale-105"
            style={{
              color: word.color,
              fontSize: `${word.fontSize}px`,
              transform: word.rotate,
            }}
          >
            {word.text}
          </button>
        )) : (
          <p className="text-sm text-muted-foreground">No words meet the current minimum frequency.</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Min frequency</span>
          <span>{minFrequency}</span>
        </div>
        <Slider
          value={[minFrequency]}
          min={1}
          max={maxFrequency}
          step={1}
          onValueChange={([value]) => setMinFrequency(value)}
        />
      </div>
    </div>
  )
}
