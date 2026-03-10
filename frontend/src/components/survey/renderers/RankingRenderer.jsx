import { useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function RankingRenderer({ question, value = [], onChange, disabled = false }) {
  const [draggingId, setDraggingId] = useState('')
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

  const moveByChoiceId = (fromChoiceId, toChoiceId) => {
    const fromIndex = orderedItems.findIndex((choice) => choice.id === fromChoiceId)
    const toIndex = orderedItems.findIndex((choice) => choice.id === toChoiceId)

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return
    }

    const nextItems = [...orderedItems]
    const [draggedItem] = nextItems.splice(fromIndex, 1)
    nextItems.splice(toIndex, 0, draggedItem)
    onChange(nextItems.map((choice) => choice.id))
  }

  return (
    <div className="space-y-3">
      {orderedItems.map((item, index) => (
        <div
          key={item.id ?? item.text}
          draggable={!disabled}
          onDragStart={(event) => {
            if (disabled) {
              return
            }

            setDraggingId(item.id)
            event.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => setDraggingId('')}
          onDragOver={(event) => {
            if (!disabled) {
              event.preventDefault()
            }
          }}
          onDrop={(event) => {
            event.preventDefault()
            if (disabled || !draggingId) {
              return
            }

            moveByChoiceId(draggingId, item.id)
            setDraggingId('')
          }}
          className={`survey-theme-choice flex items-center justify-between gap-3 px-4 py-3 ${
            draggingId === item.id ? 'opacity-70' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="survey-theme-muted cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" />
            </div>
            <p className="survey-theme-muted text-xs uppercase tracking-[0.16em]">Rank {index + 1}</p>
            <p className="text-sm font-medium text-foreground">{item.text}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={disabled || index === 0}
              onClick={() => moveItem(index, -1)}
              className="survey-theme-control"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={disabled || index === orderedItems.length - 1}
              onClick={() => moveItem(index, 1)}
              className="survey-theme-control"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
