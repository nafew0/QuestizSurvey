import { ArrowDown, ArrowUp } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function RankingRenderer({ question, value = [], onChange, disabled = false }) {
  const orderedItems = value.length
    ? value
        .map((choiceId) =>
          (question.choices ?? []).find((choice) => choice.id === choiceId)
        )
        .filter(Boolean)
    : question.choices ?? []

  const moveItem = (index, direction) => {
    const nextItems = [...orderedItems]
    const targetIndex = index + direction
    const [item] = nextItems.splice(index, 1)
    nextItems.splice(targetIndex, 0, item)
    onChange(nextItems.map((choice) => choice.id))
  }

  return (
    <div className="space-y-3">
      {orderedItems.map((item, index) => (
        <div
          key={item.id ?? item.text}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
        >
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Rank {index + 1}</p>
            <p className="text-sm font-medium text-slate-700">{item.text}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={disabled || index === 0}
              onClick={() => moveItem(index, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={disabled || index === orderedItems.length - 1}
              onClick={() => moveItem(index, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
