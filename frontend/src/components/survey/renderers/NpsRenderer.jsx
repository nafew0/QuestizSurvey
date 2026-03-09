export default function NpsRenderer({ question, value, onChange, disabled = false }) {
  const min = question.settings?.min_value ?? 0
  const max = question.settings?.max_value ?? 10

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: max - min + 1 }, (_, index) => {
          const score = min + index
          const zoneClass =
            score <= 6 ? 'hover:border-rose-300 hover:bg-rose-50' : score <= 8 ? 'hover:border-amber-300 hover:bg-amber-50' : 'hover:border-emerald-300 hover:bg-emerald-50'

          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(score)}
              className={`survey-theme-choice survey-theme-control px-3 py-3 text-sm font-semibold ${
                value === score
                  ? 'survey-theme-choice-active bg-primary text-primary-foreground'
                  : `text-foreground ${zoneClass}`
              }`}
            >
              {score}
            </button>
          )
        })}
      </div>
      <div className="survey-theme-muted flex justify-between text-xs">
        <span>{question.settings?.labels?.low || 'Not likely'}</span>
        <span>{question.settings?.labels?.high || 'Extremely likely'}</span>
      </div>
    </div>
  )
}
