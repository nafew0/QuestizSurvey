export default function ImageChoiceRenderer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const singleSelect = question.settings?.single_select !== false
  const currentValue = singleSelect ? value || '' : value || []
  const gridClass =
    question.settings?.grid_columns === 4
      ? 'md:grid-cols-4'
      : question.settings?.grid_columns === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-3'

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {question.choices?.map((choice) => {
        const selected = singleSelect
          ? currentValue === choice.id
          : currentValue.includes(choice.id)

        return (
          <button
            key={choice.id ?? choice.order}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (singleSelect) {
                onChange(choice.id)
                return
              }

              if (selected) {
                onChange(currentValue.filter((item) => item !== choice.id))
              } else {
                onChange([...currentValue, choice.id])
              }
            }}
            className={`survey-theme-control overflow-hidden border text-left transition ${
              selected
                ? 'survey-theme-choice survey-theme-choice-active'
                : 'survey-theme-choice'
            }`}
          >
            <div className="aspect-[4/3] bg-[rgb(var(--survey-panel-rgb)/0.86)]">
              {choice.image_url ? (
                <img src={choice.image_url} alt={choice.text} className="h-full w-full object-cover" />
              ) : (
                <div className="survey-theme-muted flex h-full items-center justify-center text-sm">
                  Upload image
                </div>
              )}
            </div>
            <div className="px-4 py-3 text-sm font-medium text-foreground">{choice.text}</div>
          </button>
        )
      })}
    </div>
  )
}
