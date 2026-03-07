export default function DropdownRenderer({ question, value, onChange, disabled = false }) {
  return (
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <option value="">Select an option</option>
      {question.choices?.map((choice) => (
        <option key={choice.id ?? choice.order} value={choice.id}>
          {choice.text}
        </option>
      ))}
    </select>
  )
}

