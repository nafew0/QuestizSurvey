import { CustomSelect } from '@/components/ui/custom-select'

export default function MatrixPlusRenderer({
  question,
  value = {},
  onChange,
  disabled = false,
}) {
  const rows = question.settings?.rows ?? []
  const columns = question.settings?.columns ?? []
  const dropdownOptions = question.settings?.dropdown_options ?? []
  const gridTemplateColumns = `minmax(10rem,1.2fr) repeat(${Math.max(columns.length, 1)}, minmax(7rem,1fr))`

  if (!rows.length || !columns.length || !dropdownOptions.length) {
    return (
      <div className="rounded-[var(--survey-card-radius)] border border-dashed border-[rgb(var(--survey-border-rgb)/0.82)] bg-[rgb(var(--survey-panel-rgb)/0.65)] px-4 py-5 text-sm text-[rgb(var(--survey-muted-foreground-rgb))]">
        Add rows, columns, and dropdown options in the builder to use Matrix+.
      </div>
    )
  }

  const selectOptions = [
    { value: '', label: 'Select an option' },
    ...dropdownOptions.map((option) => ({
      value: option,
      label: option,
    })),
  ]

  return (
    <div className="overflow-hidden rounded-[var(--survey-card-radius)] border border-[rgb(var(--survey-border-rgb)/0.82)] bg-[rgb(var(--survey-card-rgb))]">
      <div
        className="grid gap-px bg-[rgb(var(--survey-border-rgb)/0.82)] text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(var(--survey-muted-foreground-rgb))]"
        style={{ gridTemplateColumns }}
      >
        <div className="bg-[rgb(var(--survey-panel-rgb)/0.85)] px-4 py-3">Row</div>
        {columns.map((column) => (
          <div key={column} className="bg-[rgb(var(--survey-panel-rgb)/0.85)] px-4 py-3 text-center">
            {column}
          </div>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={row}
          className="grid gap-px border-t border-[rgb(var(--survey-border-rgb)/0.82)] bg-[rgb(var(--survey-border-rgb)/0.82)]"
          style={{ gridTemplateColumns }}
        >
          <div className="bg-[rgb(var(--survey-card-rgb))] px-4 py-4 text-sm font-medium text-foreground">
            {row}
          </div>
          {columns.map((column) => (
            <div key={`${row}-${column}`} className="bg-[rgb(var(--survey-card-rgb))] px-3 py-3">
              <CustomSelect
                value={value?.[row]?.[column] || ''}
                onChange={(nextValue) =>
                  onChange({
                    ...(value || {}),
                    [row]: {
                      ...(value?.[row] || {}),
                      [column]: nextValue,
                    },
                  })
                }
                disabled={disabled}
                options={selectOptions}
                placeholder="Select"
                portal={false}
                triggerClassName="survey-theme-control survey-theme-input h-11 text-sm"
                contentClassName="max-h-72"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
