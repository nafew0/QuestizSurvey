import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, GripVertical, LayoutPanelTop, Plus, Trash2 } from 'lucide-react'

import { QUESTION_TYPE_ICONS } from '@/components/builder/questionTypeIcons'
import QuestionRenderer from '@/components/survey/QuestionRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HelpPopover } from '@/components/ui/help-popover'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { QUESTION_TYPE_GROUPS, QUESTION_TYPE_META } from '@/constants/surveyBuilder'
import { cn } from '@/lib/utils'
import {
  createClientUuid,
  getInitialQuestionValue,
  questionHasChoices,
} from '@/utils/surveyBuilder'

function PageDropSlot({ onDrop, label }) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="group flex items-center gap-3 py-2"
    >
      <div className="theme-divider h-px flex-1 transition group-hover:bg-primary/50" />
      <div className="rounded-full border border-dashed border-[rgb(var(--theme-border-rgb)/0.92)] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition group-hover:border-primary/40 group-hover:text-primary">
        {label}
      </div>
      <div className="theme-divider h-px flex-1 transition group-hover:bg-primary/50" />
    </div>
  )
}

function QuestionInsertMenu({ onInsert }) {
  const [open, setOpen] = useState(false)
  const [opensUpward, setOpensUpward] = useState(false)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const updateDirection = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect()
    if (!triggerRect) {
      return
    }

    setOpensUpward(triggerRect.top >= window.innerHeight * 0.7)
  }

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const handleViewportChange = () => updateDirection()

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          updateDirection()
          setOpen((current) => !current)
        }}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-[rgb(var(--theme-border-rgb)/0.92)] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))] transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <Plus className="h-4 w-4" />
        Insert question
      </button>

      {open ? (
        <div
          ref={panelRef}
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          className={cn(
            'theme-panel absolute left-1/2 z-40 w-[34rem] max-w-[min(92vw,34rem)] -translate-x-1/2 rounded-[1.5rem] p-3',
            'max-h-[min(70vh,34rem)] overflow-y-auto overscroll-contain',
            opensUpward ? 'bottom-full mb-3 origin-bottom' : 'top-full mt-3 origin-top'
          )}
        >
          {QUESTION_TYPE_GROUPS.map((group, index) => (
            <section
              key={group.id}
              className={index > 0 ? 'mt-3 border-t border-[rgb(var(--theme-border-rgb)/0.82)] pt-3' : ''}
            >
              <p className="px-1 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {group.types.map((type) => {
                  const Icon = QUESTION_TYPE_ICONS[type]

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        onInsert(type)
                        setOpen(false)
                      }}
                      className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="theme-icon-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {QUESTION_TYPE_META[type].label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function QuestionInsertSlot({ onDrop, onInsert }) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="group flex items-center gap-3 py-3"
    >
      <div className="theme-divider h-px flex-1 transition group-hover:bg-primary/50" />
      <QuestionInsertMenu onInsert={onInsert} />
      <div className="theme-divider h-px flex-1 transition group-hover:bg-primary/50" />
    </div>
  )
}

function buildInitialPreviewAnswers(pages) {
  return pages.reduce((answers, page) => {
    page.questions.forEach((question) => {
      answers[question.id] = getInitialQuestionValue(question)
    })
    return answers
  }, {})
}

function createChoiceDraft(questionType, text = '') {
  return {
    id: createClientUuid(),
    text,
    order: 0,
    image_url: questionType === 'image_choice' ? '' : '',
    is_other: false,
    score: null,
  }
}

function normalizeChoices(choices) {
  return choices.map((choice, index) => ({
    ...choice,
    order: index + 1,
  }))
}

function ChoiceIndicator({ questionType }) {
  if (questionType === 'multiple_choice_multi') {
    return <span className="h-5 w-5 rounded-md border-2 border-slate-300 bg-white" />
  }

  return <span className="h-5 w-5 rounded-full border-2 border-slate-300 bg-white" />
}

function ChoiceEditor({
  question,
  selected,
  onQuestionFieldChange,
  onChoiceFieldChange,
  onAddChoice,
  onRemoveChoice,
  onMoveChoice,
}) {
  const showScoreField =
    question.question_type === 'yes_no' ||
    (question.choices ?? []).some((choice) => choice.score != null)

  const applyBulkPaste = (event, choiceIndex) => {
    const pastedText = event.clipboardData.getData('text')
    const nextLines = pastedText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (nextLines.length < 2) {
      return
    }

    event.preventDefault()

    const currentChoices = [...(question.choices ?? [])]
    const existingChoice = currentChoices[choiceIndex]

    if (!existingChoice) {
      return
    }

    const replacementChoices = nextLines.map((line, index) =>
      index === 0
        ? {
            ...existingChoice,
            text: line,
          }
        : createChoiceDraft(question.question_type, line)
    )

    currentChoices.splice(choiceIndex, 1, ...replacementChoices)
    onQuestionFieldChange(question.id, 'choices', normalizeChoices(currentChoices))
  }

  return (
    <div className="space-y-3">
      {(question.choices ?? []).map((choice, index) => (
        <div key={choice.id ?? index} className="space-y-3">
          <div className="flex items-center gap-3">
            <ChoiceIndicator questionType={question.question_type} />

            <Input
              value={choice.text}
              placeholder={`Option ${index + 1}`}
              onChange={(event) =>
                onChoiceFieldChange(question.id, index, 'text', event.target.value)
              }
              onPaste={(event) => applyBulkPaste(event, index)}
              className="h-auto rounded-none border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-base text-slate-800 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />

            {selected ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => onMoveChoice(question.id, index, index - 1)}
                  className="h-8 w-8 rounded-full text-slate-500"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index >= question.choices.length - 1}
                  onClick={() => onMoveChoice(question.id, index, index + 1)}
                  className="h-8 w-8 rounded-full text-slate-500"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveChoice(question.id, index)}
                  className="h-8 w-8 rounded-full text-slate-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>

          {selected && (question.question_type === 'image_choice' || showScoreField || choice.is_other) ? (
            <div className="ml-8 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
              {question.question_type === 'image_choice' ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Image URL
                  </span>
                  <Input
                    value={choice.image_url || ''}
                    placeholder="https://..."
                    onChange={(event) =>
                      onChoiceFieldChange(question.id, index, 'image_url', event.target.value)
                    }
                    className="rounded-2xl bg-white"
                  />
                </label>
              ) : null}

              {showScoreField ? (
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Score
                  </span>
                  <Input
                    type="number"
                    value={choice.score ?? ''}
                    placeholder="Optional"
                    onChange={(event) =>
                      onChoiceFieldChange(
                        question.id,
                        index,
                        'score',
                        event.target.value === '' ? null : Number(event.target.value)
                      )
                    }
                    className="rounded-2xl bg-white"
                  />
                </label>
              ) : null}

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <span className="text-sm font-medium text-slate-700">Other option</span>
                <Switch
                  checked={Boolean(choice.is_other)}
                  onCheckedChange={(checked) =>
                    onChoiceFieldChange(question.id, index, 'is_other', checked)
                  }
                />
              </label>
            </div>
          ) : null}
        </div>
      ))}

      {selected ? (
        <div className="flex items-center gap-2 pl-8">
          <Button
            type="button"
            variant="ghost"
            className="justify-start rounded-full px-0 text-base text-slate-500 hover:bg-transparent hover:text-slate-900"
            onClick={() => onAddChoice(question.id)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add option
          </Button>
          <HelpPopover title="Options">
            Paste multiple lines into any option field to create several answer choices at once.
          </HelpPopover>
        </div>
      ) : null}
    </div>
  )
}

function QuestionCard({
  question,
  selected,
  previewValue,
  onSelect,
  onDragStart,
  onTitleChange,
  onPreviewValueChange,
  onQuestionFieldChange,
  onDuplicate,
  onDelete,
  onChoiceFieldChange,
  onAddChoice,
  onRemoveChoice,
  onMoveChoice,
}) {
  const isChoiceQuestion = questionHasChoices(question.question_type)
  const isInstructional = question.question_type === 'instructional_text'
  const isStructural = ['section_heading', 'instructional_text'].includes(question.question_type)

  return (
    <article
      className={`theme-panel rounded-[1.75rem] p-5 transition ${
        selected
          ? 'border-primary shadow-lg shadow-primary/10'
          : 'hover:border-[rgb(var(--theme-mix-strong-rgb)/0.95)]'
      }`}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          className="theme-panel-soft mt-1 rounded-2xl p-2 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {isInstructional ? (
                <Textarea
                  value={question.text}
                  onChange={(event) => onTitleChange(event.target.value)}
                  className="min-h-[110px] border-0 bg-transparent px-0 py-0 text-lg leading-8 text-slate-900 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              ) : (
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Input
                    value={question.text}
                    onChange={(event) => onTitleChange(event.target.value)}
                    className="h-auto rounded-none border-0 bg-transparent px-0 py-0 text-2xl font-semibold tracking-tight text-slate-950 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  {question.required ? (
                    <span className="pt-1 text-2xl font-semibold text-rose-500">*</span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <HelpPopover title="Question block" align="end">
                {isChoiceQuestion
                  ? 'Edit the question and answer options in the canvas. Helper text, required state, behavior, and branching stay in the right panel.'
                  : 'Edit the main question in the canvas. Helper text, required state, behavior, and branching stay in the right panel.'}
              </HelpPopover>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation()
                  onDuplicate()
                }}
                className="h-9 w-9 rounded-full text-muted-foreground"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
                className="h-9 w-9 rounded-full text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isChoiceQuestion ? (
            <ChoiceEditor
              question={question}
              selected={selected}
              onQuestionFieldChange={onQuestionFieldChange}
              onChoiceFieldChange={onChoiceFieldChange}
              onAddChoice={onAddChoice}
              onRemoveChoice={onRemoveChoice}
              onMoveChoice={onMoveChoice}
            />
          ) : !isStructural ? (
            <QuestionRenderer
              question={question}
              value={previewValue}
              onChange={onPreviewValueChange}
              showPrompt={false}
              showDescription={false}
              frameClassName="border-0 bg-transparent p-0 shadow-none"
            />
          ) : null}
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
  onChoiceFieldChange,
  onAddChoice,
  onRemoveChoice,
  onMoveChoice,
}) {
  const [previewAnswers, setPreviewAnswers] = useState(() =>
    buildInitialPreviewAnswers(survey.pages)
  )

  const pageOptions = useMemo(
    () =>
      survey.pages.map((page) => ({
        value: page.id,
        label: page.title || `Page ${page.order}`,
      })),
    [survey.pages]
  )

  useEffect(() => {
    setPreviewAnswers((current) => {
      const nextAnswers = {}

      survey.pages.forEach((page) => {
        page.questions.forEach((question) => {
          nextAnswers[question.id] = Object.prototype.hasOwnProperty.call(current, question.id)
            ? current[question.id]
            : getInitialQuestionValue(question)
        })
      })

      return nextAnswers
    })
  }, [survey.pages])

  const updatePreviewAnswer = (questionId, value) => {
    setPreviewAnswers((current) => ({
      ...current,
      [questionId]: value,
    }))
  }

  const getDragPayload = (event) => {
    try {
      return JSON.parse(event.dataTransfer.getData('application/json'))
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <PageDropSlot
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
            className={`theme-panel rounded-[2rem] p-5 transition ${
              selectedPageId === page.id && !selectedQuestionId
                ? 'border-primary shadow-primary/10'
                : ''
            }`}
            onClick={() => {
              onSelectPage(page.id)
              onSelectQuestion(null)
            }}
          >
            <div className="flex flex-col gap-4 border-b border-[rgb(var(--theme-border-rgb)/0.82)] pb-4 md:flex-row md:items-start md:justify-between">
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
                  className="theme-panel-soft mt-1 rounded-2xl p-2 text-muted-foreground hover:text-foreground"
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
                    className="w-full border-none bg-transparent p-0 text-2xl font-semibold tracking-tight text-foreground focus:outline-none"
                  />
                  <textarea
                    value={page.description || ''}
                    onChange={(event) => onPageFieldChange(page.id, 'description', event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    placeholder="Page description"
                    className="min-h-[80px] w-full rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.9)] px-3 py-3 text-sm text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:w-[280px]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                    className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-2xl"
                    onClick={() => onAddPage(page.id)}
                  >
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
              <QuestionInsertSlot
                onInsert={(questionType) => onAddQuestion(page.id, questionType, 0)}
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
                      previewValue={previewAnswers[question.id]}
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
                      onPreviewValueChange={(value) => updatePreviewAnswer(question.id, value)}
                      onQuestionFieldChange={onQuestionFieldChange}
                      onDuplicate={() => onDuplicateQuestion(question.id)}
                      onDelete={() => onDeleteQuestion(question.id)}
                      onChoiceFieldChange={onChoiceFieldChange}
                      onAddChoice={onAddChoice}
                      onRemoveChoice={onRemoveChoice}
                      onMoveChoice={onMoveChoice}
                    />

                    <QuestionInsertSlot
                      onInsert={(questionType) =>
                        onAddQuestion(page.id, questionType, questionIndex + 1)
                      }
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
                  <div className="theme-panel-soft rounded-[1.75rem] border-dashed px-6 py-10 text-center">
                    <LayoutPanelTop className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
                      Drop your first question into this page
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Use the insert button or drag a block from the left palette.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <PageDropSlot
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
        <div className="theme-panel rounded-[2rem] border-dashed px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">No pages yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
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
