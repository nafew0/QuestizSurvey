import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { questionHasChoices } from '@/utils/surveyBuilder'

const FILTER_TYPES = [
  { value: 'date', label: 'Date range' },
  { value: 'collector', label: 'Collector' },
  { value: 'status', label: 'Completion status' },
  { value: 'answer', label: 'Question answer' },
  { value: 'duration', label: 'Duration' },
  { value: 'text', label: 'Text search' },
]

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In progress' },
]

export default function FilterBuilderDialog({
  open,
  onOpenChange,
  survey,
  collectors = [],
  onApply,
}) {
  const [filterType, setFilterType] = useState('date')
  const [formState, setFormState] = useState({
    date_from: '',
    date_to: '',
    collector_id: '',
    status: '',
    question_id: '',
    choice_id: '',
    duration_min_seconds: '',
    duration_max_seconds: '',
    text_search: '',
  })

  const choiceQuestions = useMemo(
    () =>
      (survey?.pages ?? [])
        .flatMap((page) => page.questions)
        .filter((question) => questionHasChoices(question.question_type)),
    [survey]
  )

  const selectedQuestion = choiceQuestions.find(
    (question) => question.id === formState.question_id
  )

  const choiceOptions = (selectedQuestion?.choices ?? []).map((choice) => ({
    value: choice.id,
    label: choice.text,
  }))

  const handleApply = () => {
    switch (filterType) {
      case 'date':
        onApply({
          type: 'date',
          payload: {
            date_from: formState.date_from,
            date_to: formState.date_to,
          },
        })
        break
      case 'collector':
        onApply({
          type: 'collector',
          payload: {
            collector_id: formState.collector_id,
          },
        })
        break
      case 'status':
        onApply({
          type: 'status',
          payload: {
            status: formState.status,
          },
        })
        break
      case 'answer':
        onApply({
          type: 'answer',
          payload: {
            question_id: formState.question_id,
            choice_id: formState.choice_id,
          },
        })
        break
      case 'duration':
        onApply({
          type: 'duration',
          payload: {
            duration_min_seconds: formState.duration_min_seconds,
            duration_max_seconds: formState.duration_max_seconds,
          },
        })
        break
      case 'text':
        onApply({
          type: 'text',
          payload: {
            text_search: formState.text_search,
          },
        })
        break
      default:
        break
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add filter</DialogTitle>
          <DialogDescription>
            Build a filter chip and apply it across the analytics dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Step 1
            </p>
            <CustomSelect
              value={filterType}
              onChange={setFilterType}
              options={FILTER_TYPES}
            />
          </div>

          {filterType === 'date' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  From
                </p>
                <Input
                  type="date"
                  value={formState.date_from}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, date_from: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  To
                </p>
                <Input
                  type="date"
                  value={formState.date_to}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, date_to: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          {filterType === 'collector' ? (
            <CustomSelect
              value={formState.collector_id}
              onChange={(value) => setFormState((current) => ({ ...current, collector_id: value }))}
              options={collectors.map((collector) => ({ value: collector.id, label: collector.name }))}
              placeholder="Choose collector"
            />
          ) : null}

          {filterType === 'status' ? (
            <CustomSelect
              value={formState.status}
              onChange={(value) => setFormState((current) => ({ ...current, status: value }))}
              options={STATUS_OPTIONS}
              placeholder="Choose status"
            />
          ) : null}

          {filterType === 'answer' ? (
            <div className="grid gap-4">
              <CustomSelect
                value={formState.question_id}
                onChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    question_id: value,
                    choice_id: '',
                  }))
                }
                options={choiceQuestions.map((question) => ({
                  value: question.id,
                  label: question.text,
                }))}
                placeholder="Choose question"
              />
              <CustomSelect
                value={formState.choice_id}
                onChange={(value) => setFormState((current) => ({ ...current, choice_id: value }))}
                options={choiceOptions}
                placeholder="Choose answer"
                disabled={!selectedQuestion}
              />
            </div>
          ) : null}

          {filterType === 'duration' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                type="number"
                min="0"
                placeholder="Min seconds"
                value={formState.duration_min_seconds}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    duration_min_seconds: event.target.value,
                  }))
                }
              />
              <Input
                type="number"
                min="0"
                placeholder="Max seconds"
                value={formState.duration_max_seconds}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    duration_max_seconds: event.target.value,
                  }))
                }
              />
            </div>
          ) : null}

          {filterType === 'text' ? (
            <Input
              placeholder="Search respondent email, IP, or text answers"
              value={formState.text_search}
              onChange={(event) =>
                setFormState((current) => ({ ...current, text_search: event.target.value }))
              }
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleApply}>
            Apply filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
