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
          className={`survey-theme-choice flex cursor-pointer items-center gap-3 px-4 py-3 ${
            value === choice.id ? 'survey-theme-choice-active' : ''
          }`}
        >
          <input
            type="radio"
            name={question.id}
            checked={value === choice.id}
            onChange={() => onChange(choice.id)}
            disabled={disabled}
            className="h-4 w-4 accent-primary"
          />
          <span className="text-sm font-medium text-foreground">{choice.text}</span>
        </label>
      ))}
    </div>
  )
}
