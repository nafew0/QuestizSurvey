import { useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'

import { QUESTION_TYPE_ICONS } from '@/components/builder/questionTypeIcons'
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
    <aside className="theme-sidebar flex min-h-[30rem] h-full flex-col rounded-[2rem] p-3">
      <div className="mb-4 space-y-1.5 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Question Palette
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Build the flow
        </h2>
        <p className="text-sm leading-5 text-muted-foreground">
          Drag blocks into the canvas or use the insert buttons between questions.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {groupedTypes.map((group) => (
          <section
            key={group.id}
            className="theme-panel-soft overflow-hidden rounded-3xl"
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
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {group.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              </div>
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {openGroups[group.id] ? (
              <div className="space-y-2 border-t border-[rgb(var(--theme-border-rgb)/0.82)] bg-white/90 p-3">
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
                      className="flex w-full items-center gap-3 rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-3 py-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="theme-icon-secondary flex h-10 w-10 items-center justify-center rounded-2xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {QUESTION_TYPE_META[type].label}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
    </aside>
  )
}
