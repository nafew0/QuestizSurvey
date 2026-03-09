export default function MultipleChoiceMultiRenderer({
  question,
  value = [],
  onChange,
  disabled = false,
}) {
  return (
    <div className="space-y-3">
      {question.choices?.map((choice) => {
        const checked = value.includes(choice.id)
        return (
          <label
            key={choice.id ?? choice.order}
            className={`survey-theme-choice flex cursor-pointer items-center gap-3 px-4 py-3 ${
              checked ? 'survey-theme-choice-active' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (checked) {
                  onChange(value.filter((item) => item !== choice.id))
                } else {
                  onChange([...value, choice.id])
                }
              }}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="text-sm font-medium text-foreground">{choice.text}</span>
          </label>
        )
      })}
    </div>
  )
}
