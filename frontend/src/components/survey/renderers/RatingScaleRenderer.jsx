export default function RatingScaleRenderer({ question, value, onChange, disabled = false }) {
  const min = question.settings?.min_value ?? 1
  const max = question.settings?.max_value ?? 5

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: max - min + 1 }, (_, index) => {
          const scaleValue = min + index
          return (
            <button
              key={scaleValue}
              type="button"
              disabled={disabled}
              onClick={() => onChange(scaleValue)}
              className={`survey-theme-choice survey-theme-control px-3 py-3 text-sm font-semibold ${
                value === scaleValue
                  ? 'survey-theme-choice-active bg-primary text-primary-foreground'
                  : 'text-foreground'
              }`}
            >
              {scaleValue}
            </button>
          )
        })}
      </div>
      <div className="survey-theme-muted flex justify-between text-xs">
        <span>{question.settings?.labels?.low || 'Low'}</span>
        <span>{question.settings?.labels?.high || 'High'}</span>
      </div>
    </div>
  )
}
