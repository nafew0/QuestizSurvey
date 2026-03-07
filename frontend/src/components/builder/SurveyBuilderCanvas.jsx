import { useMemo, useState } from 'react'
import {
  Copy,
  GripVertical,
  LayoutPanelTop,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QUESTION_TYPE_META } from '@/constants/surveyBuilder'

function DropSlot({ onDrop, label }) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="group flex items-center gap-3 py-2"
    >
      <div className="h-px flex-1 bg-slate-200 transition group-hover:bg-primary/50" />
      <div className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition group-hover:border-primary/40 group-hover:text-primary">
        {label}
      </div>
      <div className="h-px flex-1 bg-slate-200 transition group-hover:bg-primary/50" />
    </div>
  )
}

function QuestionCard({
  question,
  selected,
  onSelect,
  onDragStart,
  onTitleChange,
  onDuplicate,
  onDelete,
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article
      className={`rounded-[1.75rem] border bg-white p-4 shadow-sm transition ${
        selected
          ? 'border-primary shadow-lg shadow-primary/10'
          : 'border-slate-200 hover:border-slate-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:text-slate-700"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{QUESTION_TYPE_META[question.question_type]?.shortLabel}</Badge>
            {question.required ? <Badge variant="danger">Required</Badge> : null}
          </div>

          <input
            value={question.text}
            onChange={(event) => onTitleChange(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            className="w-full border-none bg-transparent p-0 text-lg font-semibold tracking-tight text-slate-900 focus:outline-none"
          />

          {question.description ? (
            <p className="text-sm leading-6 text-slate-500">{question.description}</p>
          ) : null}

          {question.choices?.length ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setExpanded((current) => !current)
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              <Sparkles className="h-4 w-4" />
              {expanded ? 'Hide choices' : `Preview ${question.choices.length} choices`}
            </button>
          ) : null}

          {expanded && question.choices?.length ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {question.choices.map((choice) => (
                <div
                  key={choice.id ?? choice.order}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
                >
                  {choice.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="icon" onClick={(event) => {
            event.stopPropagation()
            onDuplicate()
          }}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function SurveyBuilderCanvas({
  survey,
  selectedQuestionId,
  selectedPageId,
  onSelectQuestion,
  onSelectPage,
  onPageFieldChange,
  onQuestionFieldChange,
  onAddPage,
  onMovePage,
  onDeletePage,
  onAddQuestion,
  onMoveQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
}) {
  const pageOptions = useMemo(
    () =>
      survey.pages.map((page) => ({
        value: page.id,
        label: page.title || `Page ${page.order}`,
      })),
    [survey.pages]
  )

  const getDragPayload = (event) => {
    try {
      return JSON.parse(event.dataTransfer.getData('application/json'))
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <DropSlot
        label="Move or drop a page here"
        onDrop={(event) => {
          const payload = getDragPayload(event)
          if (payload?.kind === 'page') {
            onMovePage(payload.pageId, 0)
          }
        }}
      />

      {survey.pages.map((page, pageIndex) => (
        <div key={page.id} className="space-y-4">
          <section
            className={`rounded-[2rem] border bg-white p-5 shadow-lg shadow-slate-900/5 transition ${
              selectedPageId === page.id && !selectedQuestionId
                ? 'border-primary shadow-primary/10'
                : 'border-slate-200'
            }`}
            onClick={() => {
              onSelectPage(page.id)
              onSelectQuestion(null)
            }}
          >
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-1 items-start gap-3">
                <button
                  type="button"
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        kind: 'page',
                        pageId: page.id,
                      })
                    )
                  }
                  className="mt-1 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-slate-400 hover:text-slate-700"
                >
                  <GripVertical className="h-4 w-4" />
                </button>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">Page {page.order}</Badge>
                    <Badge variant="outline">{page.questions.length} questions</Badge>
                  </div>
                  <input
                    value={page.title}
                    onChange={(event) => onPageFieldChange(page.id, 'title', event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full border-none bg-transparent p-0 text-2xl font-semibold tracking-tight text-slate-950 focus:outline-none"
                  />
                  <textarea
                    value={page.description || ''}
                    onChange={(event) => onPageFieldChange(page.id, 'description', event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    placeholder="Page description"
                    className="min-h-[80px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:w-[280px]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Page logic
                  </span>
                  <select
                    value={page.skip_logic?.target || ''}
                    onChange={(event) =>
                      onPageFieldChange(
                        page.id,
                        'skip_logic',
                        event.target.value
                          ? { action: 'skip_to_page', target: event.target.value }
                          : null
                      )
                    }
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Continue to next page</option>
                    {pageOptions
                      .filter((option) => option.value !== page.id)
                      .map((option) => (
                        <option key={option.value} value={option.value}>
                          Skip to {option.label}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-2xl" onClick={() => onAddPage(page.id)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add page after
                  </Button>
                  <Button type="button" variant="outline" size="icon" onClick={() => onDeletePage(page.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <DropSlot
                label="Drop question here"
                onDrop={(event) => {
                  const payload = getDragPayload(event)
                  if (!payload) {
                    return
                  }

                  if (payload.kind === 'new-question') {
                    onAddQuestion(page.id, payload.questionType, 0)
                  }

                  if (payload.kind === 'question') {
                    onMoveQuestion(payload.questionId, page.id, 0)
                  }
                }}
              />

              <div className="space-y-3">
                {page.questions.map((question, questionIndex) => (
                  <div key={question.id} className="space-y-3">
                    <QuestionCard
                      question={question}
                      selected={selectedQuestionId === question.id}
                      onSelect={() => {
                        onSelectPage(page.id)
                        onSelectQuestion(question.id)
                      }}
                      onDragStart={(event) =>
                        event.dataTransfer.setData(
                          'application/json',
                          JSON.stringify({
                            kind: 'question',
                            questionId: question.id,
                            pageId: page.id,
                          })
                        )
                      }
                      onTitleChange={(value) => onQuestionFieldChange(question.id, 'text', value)}
                      onDuplicate={() => onDuplicateQuestion(question.id)}
                      onDelete={() => onDeleteQuestion(question.id)}
                    />

                    <DropSlot
                      label={questionIndex === page.questions.length - 1 ? 'Drop at end' : 'Insert question'}
                      onDrop={(event) => {
                        const payload = getDragPayload(event)
                        if (!payload) {
                          return
                        }

                        if (payload.kind === 'new-question') {
                          onAddQuestion(page.id, payload.questionType, questionIndex + 1)
                        }

                        if (payload.kind === 'question') {
                          onMoveQuestion(payload.questionId, page.id, questionIndex + 1)
                        }
                      }}
                    />
                  </div>
                ))}

                {!page.questions.length ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <LayoutPanelTop className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Drop your first question into this page
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Drag from the left palette or use the page-level quick actions.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <DropSlot
            label="Move or drop a page here"
            onDrop={(event) => {
              const payload = getDragPayload(event)
              if (payload?.kind === 'page') {
                onMovePage(payload.pageId, pageIndex + 1)
              }
            }}
          />
        </div>
      ))}

      {!survey.pages.length ? (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-slate-900">No pages yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Start by creating a page, then drag question blocks from the palette.
          </p>
          <Button type="button" className="mt-4 rounded-2xl" onClick={() => onAddPage()}>
            <Plus className="mr-2 h-4 w-4" />
            Create first page
          </Button>
        </div>
      ) : null}
    </div>
  )
}
