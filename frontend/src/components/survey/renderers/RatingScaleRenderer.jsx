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
              className={`rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                value === scaleValue
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {scaleValue}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{question.settings?.labels?.low || 'Low'}</span>
        <span>{question.settings?.labels?.high || 'High'}</span>
      </div>
    </div>
  )
}

