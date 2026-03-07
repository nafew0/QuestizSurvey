export default function MultipleChoiceSingleRenderer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="space-y-3">
      {question.choices?.map((choice) => (
        <label
          key={choice.id ?? choice.order}
          className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-primary/40 hover:bg-primary/5"
        >
          <input
            type="radio"
            name={question.id}
            checked={value === choice.id}
            onChange={() => onChange(choice.id)}
            disabled={disabled}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium text-slate-700">{choice.text}</span>
        </label>
      ))}
    </div>
  )
}

