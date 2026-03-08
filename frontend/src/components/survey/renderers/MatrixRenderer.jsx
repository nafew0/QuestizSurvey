export default function MatrixRenderer({ question, value = {}, onChange, disabled = false }) {
  const rows = question.settings?.rows ?? []
  const columns = question.settings?.columns ?? []
  const cellType = question.settings?.cell_type ?? 'radio'
  const gridTemplateColumns = `minmax(10rem,1.5fr) repeat(${Math.max(columns.length, 1)}, minmax(5rem,1fr))`

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div
        className="grid gap-px bg-slate-200 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
        style={{ gridTemplateColumns }}
      >
        <div className="bg-slate-50 px-4 py-3">Row</div>
        {columns.map((column) => (
          <div key={column} className="bg-slate-50 px-4 py-3 text-center">
            {column}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row}
          className="grid gap-px border-t border-slate-200 bg-slate-200"
          style={{ gridTemplateColumns }}
        >
          <div className="bg-white px-4 py-4 text-sm font-medium text-slate-700">{row}</div>
          {columns.map((column) => {
            const checked =
              cellType === 'checkbox'
                ? Boolean(value[row]?.[column])
                : value[row] === column

            return (
              <label
                key={`${row}-${column}`}
                className="flex items-center justify-center bg-white px-4 py-4"
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
