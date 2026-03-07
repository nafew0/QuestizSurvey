export default function DateTimeRenderer({ question, value, onChange, disabled = false }) {
  const mode = question.settings?.mode ?? 'both'

  if (mode === 'time') {
    return (
      <input
        type="time"
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    )
  }

  return (
    <input
      type={mode === 'date' ? 'date' : 'datetime-local'}
      value={value || ''}
      disabled={disabled}
      min={question.settings?.min_date || undefined}
      max={question.settings?.max_date || undefined}
      onChange={(event) => onChange(event.target.value)}
      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}

