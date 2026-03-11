import { useId } from 'react'

import { cn } from '@/lib/utils'

const SEGMENT_COLORS = [
  '#f97316',
  '#fb7185',
  '#38bdf8',
  '#14b8a6',
  '#facc15',
  '#8b5cf6',
  '#22c55e',
  '#ef4444',
]

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const radians = (angleInDegrees * Math.PI) / 180
  return {
    x: centerX + radius * Math.sin(radians),
    y: centerY - radius * Math.cos(radians),
  }
}

function describeSegmentPath(startAngle, endAngle) {
  const start = polarToCartesian(50, 50, 48, startAngle)
  const end = polarToCartesian(50, 50, 48, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    'M 50 50',
    `L ${start.x} ${start.y}`,
    `A 48 48 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ')
}

function describeLabelClipPath(startAngle, endAngle, innerRadius = 29, outerRadius = 46) {
  const outerStart = polarToCartesian(50, 50, outerRadius, startAngle)
  const outerEnd = polarToCartesian(50, 50, outerRadius, endAngle)
  const innerStart = polarToCartesian(50, 50, innerRadius, startAngle)
  const innerEnd = polarToCartesian(50, 50, innerRadius, endAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

export default function LotteryWheel({
  entries = [],
  rotation = 0,
  isSpinning = false,
  prizeLabel = '',
  winnerResponseId = '',
  onTransitionEnd,
}) {
  const wheelId = useId().replaceAll(':', '-')

  if (!entries.length) {
    return (
      <div className="relative aspect-square min-h-[490px] w-full overflow-hidden rounded-[2.75rem] border border-[rgb(var(--theme-border-rgb)/0.75)] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.24),_transparent_42%),linear-gradient(160deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="absolute inset-6 rounded-[2.2rem] border border-white/10" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
            Lottery wheel
          </div>
          <h3 className="mt-6 max-w-sm text-2xl font-semibold tracking-tight">
            Select at least one field and save the setup to build the draw.
          </h3>
          <p className="mt-3 max-w-md text-sm leading-7 text-white/70">
            Completed survey responses with values in the selected fields will appear here.
          </p>
        </div>
      </div>
    )
  }

  const segmentAngle = 360 / entries.length
  const labelRadius = Math.max(32, 35 - entries.length * 0.07)
  const labelFontSize = Math.max(1.45, 4.25 - entries.length * 0.1)
  const maxLabelChars = Math.max(7, Math.floor(22 - entries.length * 0.28))

  return (
    <div className="relative aspect-square min-h-[490px] w-full overflow-hidden rounded-[2.75rem] border border-[rgb(var(--theme-border-rgb)/0.75)] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.22),_transparent_42%),linear-gradient(160deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
      <div className="absolute inset-4 rounded-[2.35rem] border border-white/10" />
      <div className="absolute inset-x-0 top-4 flex justify-center">
        <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/72 backdrop-blur">
          {prizeLabel || 'Prize draw'}
        </div>
      </div>

      <div className="absolute left-1/2 top-[4.8rem] z-20 h-0 w-0 -translate-x-1/2 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_12px_28px_rgba(245,158,11,0.45)]" />

      <div className="relative flex h-full items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(251,191,36,0.14),_transparent_56%)] blur-2xl" />
        <svg
          viewBox="0 0 100 100"
          className="relative h-full w-full max-h-[705px] max-w-[705px] drop-shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning
              ? 'transform 6200ms cubic-bezier(0.12, 0.92, 0.18, 1)'
              : 'transform 420ms ease-out',
          }}
          onTransitionEnd={onTransitionEnd}
        >
          <defs>
            {entries.map((entry, index) => {
              const startAngle = index * segmentAngle
              const endAngle = startAngle + segmentAngle

              return (
                <clipPath key={`${entry.response_id}-clip`} id={`${wheelId}-segment-${index}`}>
                  <path d={describeLabelClipPath(startAngle, endAngle)} />
                </clipPath>
              )
            })}
          </defs>
          <circle cx="50" cy="50" r="49" fill="rgba(255,255,255,0.06)" />
          {entries.map((entry, index) => {
            const startAngle = index * segmentAngle
            const endAngle = startAngle + segmentAngle
            const centerAngle = startAngle + segmentAngle / 2
            const labelPoint = polarToCartesian(50, 50, labelRadius, centerAngle)
            const textRotation =
              centerAngle > 180 ? centerAngle + 180 : centerAngle
            const isWinner =
              winnerResponseId &&
              !isSpinning &&
              winnerResponseId === entry.response_id
            const label =
              (entry.entry_label || entry.short_label || '').length > maxLabelChars
                ? `${(entry.entry_label || entry.short_label || '').slice(0, maxLabelChars - 1).trim()}…`
                : entry.entry_label || entry.short_label

            return (
              <g key={entry.response_id}>
                <path
                  d={describeSegmentPath(startAngle, endAngle)}
                  fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]}
                  fillOpacity={isWinner ? 1 : 0.92}
                  stroke="rgba(15,23,42,0.18)"
                  strokeWidth="0.45"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  transform={`rotate(${textRotation} ${labelPoint.x} ${labelPoint.y})`}
                  clipPath={`url(#${wheelId}-segment-${index})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontSize: `${labelFontSize}px`,
                    writingMode: 'vertical-rl',
                  }}
                  className={cn(
                    'fill-white font-semibold tracking-[0.06em]',
                    isWinner ? 'opacity-100' : 'opacity-90'
                  )}
                >
                  {label}
                </text>
              </g>
            )
          })}

          <circle cx="50" cy="50" r="14" fill="rgba(15,23,42,0.92)" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
          <circle cx="50" cy="50" r="10.5" fill="rgba(255,255,255,0.1)" />
          <text
            x="50"
            y="47.4"
            textAnchor="middle"
            className="fill-white text-[3.2px] font-semibold uppercase tracking-[0.24em]"
          >
            MindSpear
          </text>
          <text
            x="50"
            y="53.2"
            textAnchor="middle"
            className="fill-white/80 text-[2.6px] font-medium"
          >
            Prize wheel
          </text>
        </svg>
      </div>
    </div>
  )
}
