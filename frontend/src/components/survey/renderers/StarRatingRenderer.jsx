import { Star } from 'lucide-react'

export default function StarRatingRenderer({ question, value, onChange, disabled = false }) {
  const maxValue = question.settings?.max_value ?? 5

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: maxValue }, (_, index) => {
          const starValue = index + 1
          const active = (value ?? 0) >= starValue

          return (
            <button
              key={starValue}
              type="button"
              disabled={disabled}
              onClick={() => onChange(starValue)}
              className="rounded-full p-2 transition hover:bg-amber-100 disabled:cursor-not-allowed"
            >
              <Star
                className={`h-8 w-8 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
              />
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

