import { Input } from '@/components/ui/input'

export default function ConstantSumRenderer({
  question,
  value = {},
  onChange,
  disabled = false,
}) {
  const target = Number(question.settings?.target_sum ?? 100)
  const total = Object.values(value).reduce((sum, item) => sum + Number(item || 0), 0)

  return (
    <div className="space-y-4">
      {question.choices?.map((choice) => (
        <div
          key={choice.id ?? choice.order}
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <span className="text-sm font-medium text-slate-700">{choice.text}</span>
          <Input
            type="number"
            min="0"
            value={value[choice.id] ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...value,
                [choice.id]: event.target.value,
              })
            }
            className="w-24 rounded-2xl text-right"
          />
        </div>
      ))}
      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
        Total: {total} / Target: {target}
      </div>
    </div>
  )
}

