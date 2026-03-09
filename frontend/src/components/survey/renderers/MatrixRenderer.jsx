export default function MatrixRenderer({ question, value = {}, onChange, disabled = false }) {
  const rows = question.settings?.rows ?? []
  const columns = question.settings?.columns ?? []
  const cellType = question.settings?.cell_type ?? 'radio'
  const gridTemplateColumns = `minmax(10rem,1.5fr) repeat(${Math.max(columns.length, 1)}, minmax(5rem,1fr))`

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
          <div className="bg-[rgb(var(--survey-card-rgb))] px-4 py-4 text-sm font-medium text-foreground">{row}</div>
          {columns.map((column) => {
            const checked =
              cellType === 'checkbox'
                ? Boolean(value[row]?.[column])
                : value[row] === column

            return (
              <label
                key={`${row}-${column}`}
                className="flex items-center justify-center bg-[rgb(var(--survey-card-rgb))] px-4 py-4"
              >
                <input
                  type={cellType === 'checkbox' ? 'checkbox' : 'radio'}
                  name={`matrix-${question.id}-${row}`}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    if (cellType === 'checkbox') {
                      onChange({
                        ...value,
                        [row]: {
                          ...(value[row] ?? {}),
                          [column]: !value[row]?.[column],
                        },
                      })
                    } else {
                      onChange({
                        ...value,
                        [row]: column,
                      })
                    }
                  }}
                  className="h-4 w-4 accent-primary"
                />
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}
