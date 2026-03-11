import { Input } from '@/components/ui/input'

const OPEN_ENDED_OTHER_KEY = '__other__'

function getOrderedRows(question, value) {
  const configuredRows = question.settings?.rows ?? []
  const responseKeys = Object.keys(value || {}).filter((key) => key !== OPEN_ENDED_OTHER_KEY)
  const orderedRows = [...configuredRows]

  responseKeys.forEach((key) => {
    if (!orderedRows.includes(key)) {
      orderedRows.push(key)
    }
  })

  if (question.settings?.allow_other || value?.[OPEN_ENDED_OTHER_KEY]) {
    orderedRows.push(OPEN_ENDED_OTHER_KEY)
  }

  return orderedRows
}

export default function OpenEndedRenderer({
  question,
  value = {},
  onChange,
  disabled = false,
}) {
  const orderedRows = getOrderedRows(question, value)

  return (
    <div className="space-y-3">
      {orderedRows.map((rowKey) => {
        const label = rowKey === OPEN_ENDED_OTHER_KEY ? 'Other' : rowKey

        return (
          <div
            key={rowKey}
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-center"
          >
            <label className="text-sm font-medium text-foreground">{label}</label>
            <Input
              value={value?.[rowKey] || ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...(value || {}),
                  [rowKey]: event.target.value,
                })
              }
              placeholder="Type your answer"
              className="survey-theme-control survey-theme-input h-12"
            />
          </div>
        )
      })}
    </div>
  )
}
