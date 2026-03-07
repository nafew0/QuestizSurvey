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
            className={`overflow-hidden rounded-3xl border text-left transition ${
              selected
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                : 'border-slate-200 bg-white hover:border-primary/40'
            }`}
          >
            <div className="aspect-[4/3] bg-slate-100">
              {choice.image_url ? (
                <img src={choice.image_url} alt={choice.text} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Upload image
                </div>
              )}
            </div>
            <div className="px-4 py-3 text-sm font-medium text-slate-700">{choice.text}</div>
          </button>
        )
      })}
    </div>
  )
}

