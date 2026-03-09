import { Input } from '@/components/ui/input'

export default function ConstantSumRenderer({
  question,
  value = {},
  onChange,
  disabled = false,
}) {
  const target = Number(question.settings?.target_sum ?? 100)
  const total = Object.values(value).reduce((sum, item) => sum + Number(item || 0), 0)

  return (
    <div className="space-y-4">
      {question.choices?.map((choice) => (
        <div
          key={choice.id ?? choice.order}
          className="survey-theme-choice flex items-center justify-between gap-4 px-4 py-3"
        >
          <span className="text-sm font-medium text-foreground">{choice.text}</span>
          <Input
            type="number"
            min="0"
            value={value[choice.id] ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                [choice.id]: event.target.value,
              })
            }
            className="survey-theme-control survey-theme-input w-24 text-right"
          />
        </div>
      ))}
      <div className="survey-theme-control bg-[rgb(var(--survey-panel-rgb)/0.85)] px-4 py-3 text-sm font-medium text-[rgb(var(--survey-muted-foreground-rgb))]">
        Total: {total} / Target: {target}
      </div>
    </div>
  )
}
