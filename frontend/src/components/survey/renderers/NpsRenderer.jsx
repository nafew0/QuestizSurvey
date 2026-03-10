import { Slider } from '@/components/ui/slider'

export default function NpsRenderer({ question, value, onChange, disabled = false }) {
  const min = question.settings?.min_value ?? 0
  const max = question.settings?.max_value ?? 10
  const sliderValue = value == null ? min : Number(value)

  return (
    <div className="space-y-4">
      <div className="survey-theme-choice rounded-[1.5rem] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-foreground">Move the bar to choose a score</span>
          <span className="rounded-full bg-[rgb(var(--survey-panel-rgb)/0.92)] px-3 py-1 text-sm font-semibold text-foreground">
            {value == null ? 'Not set' : sliderValue}
          </span>
        </div>

        <div className="mt-5 px-1">
          <Slider
            min={min}
            max={max}
            step={question.settings?.step ?? 1}
            value={[sliderValue]}
            disabled={disabled}
            onValueChange={(nextValue) => onChange(nextValue[0])}
          />
        </div>

        <div className="mt-4 grid grid-cols-11 gap-1 text-center text-[11px] font-semibold text-[rgb(var(--survey-muted-foreground-rgb))]">
          {Array.from({ length: max - min + 1 }, (_, index) => {
            const score = min + index

            return (
              <span key={score} className={value === score ? 'text-foreground' : undefined}>
                {score}
              </span>
            )
          })}
        </div>
      </div>

      <div className="survey-theme-muted flex justify-between text-xs">
        <span>{question.settings?.labels?.low || 'Not likely'}</span>
        <span>{question.settings?.labels?.high || 'Extremely likely'}</span>
      </div>
    </div>
  )
}
