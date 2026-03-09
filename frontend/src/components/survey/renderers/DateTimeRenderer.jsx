export default function DateTimeRenderer({ question, value, onChange, disabled = false }) {
  const mode = question.settings?.mode ?? 'both'

  if (mode === 'time') {
    return (
      <input
        type="time"
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="survey-theme-control survey-theme-input h-12 w-full px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
      className="survey-theme-control survey-theme-input h-12 w-full px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}
