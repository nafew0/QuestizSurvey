import { useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'

import { QUESTION_TYPE_ICONS } from '@/components/builder/questionTypeIcons'
import { Button } from '@/components/ui/button'
import { QUESTION_TYPE_GROUPS, QUESTION_TYPE_META } from '@/constants/surveyBuilder'

export default function QuestionTypePalette() {
  const [openGroups, setOpenGroups] = useState(() =>
    QUESTION_TYPE_GROUPS.reduce((acc, group) => {
      acc[group.id] = true
      return acc
    }, {})
  )

  const groupedTypes = useMemo(() => QUESTION_TYPE_GROUPS, [])

  return (
    <aside className="flex min-h-[30rem] h-full flex-col rounded-[2rem] border border-slate-200 bg-white/90 p-3 shadow-lg shadow-slate-900/5">
      <div className="mb-4 space-y-1.5 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
          Question Palette
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Build the flow
        </h2>
        <p className="text-sm leading-5 text-slate-500">
          Drag blocks into the canvas or use the insert buttons between questions.
        </p>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {groupedTypes.map((group) => (
          <section
            key={group.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50"
          >
            <button
              type="button"
              onClick={() =>
                setOpenGroups((current) => ({
                  ...current,
                  [group.id]: !current[group.id],
                }))
              }
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold tracking-tight text-slate-900">
                  {group.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{group.description}</p>
              </div>
              <GripVertical className="h-4 w-4 text-slate-400" />
            </button>

            {openGroups[group.id] ? (
              <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                {group.types.map((type) => {
                  const Icon = QUESTION_TYPE_ICONS[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            kind: 'new-question',
                            questionType: type,
                          })
                        )
                        event.dataTransfer.effectAllowed = 'copyMove'
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                        <Icon className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {QUESTION_TYPE_META[type].label}
                        </p>
                        <p className="text-xs text-slate-500">
                          {QUESTION_TYPE_META[type].shortLabel}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <div className="mt-3 rounded-3xl bg-slate-950 px-4 py-4 text-white">
        <p className="text-sm font-semibold">Tip</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Use insert buttons for click-to-add, or drag a block between cards to place it exactly where respondents should see it.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-3 h-10 w-full rounded-2xl bg-white/10 text-white hover:bg-white/20"
        >
          Native drag enabled
        </Button>
      </div>
    </aside>
  )
}
