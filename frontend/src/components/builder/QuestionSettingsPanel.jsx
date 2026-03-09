import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

import SurveyThemeEditor from '@/components/builder/SurveyThemeEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { HelpPopover } from '@/components/ui/help-popover'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { DEMOGRAPHIC_FIELDS, QUESTION_TYPE_META } from '@/constants/surveyBuilder'
import {
  isRatingQuestion,
  questionHasChoices,
  questionSupportsLogicChoices,
  questionSupportsSkipLogic,
} from '@/utils/surveyBuilder'

function PanelSection({ eyebrow, title, description, children }) {
  return (
    <section className="theme-panel space-y-4 rounded-[1.75rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        </div>
        {description ? <HelpPopover title={title}>{description}</HelpPopover> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">{label}</p>
        {hint ? (
          <HelpPopover title={label} triggerClassName="h-7 w-7 text-slate-400">
            {hint}
          </HelpPopover>
        ) : null}
      </div>
      {children}
    </label>
  )
}

function MiniSelect({ value, onChange, options, className = '' }) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      triggerClassName={className}
      placeholder="Select an option"
    />
  )
}

function ReorderButtons({ canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="icon" disabled={!canMoveUp} onClick={onMoveUp}>
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" size="icon" disabled={!canMoveDown} onClick={onMoveDown}>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

function ArrayEditor({ label, items, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">{label}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, `${label} ${items.length + 1}`])}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(event) => {
                const nextItems = [...items]
                nextItems[index] = event.target.value
                onChange(nextItems)
              }}
              className="rounded-2xl"
            />
            <ReorderButtons
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onMoveUp={() => {
                const nextItems = [...items]
                ;[nextItems[index - 1], nextItems[index]] = [nextItems[index], nextItems[index - 1]]
                onChange(nextItems)
              }}
              onMoveDown={() => {
                const nextItems = [...items]
                ;[nextItems[index + 1], nextItems[index]] = [nextItems[index], nextItems[index + 1]]
                onChange(nextItems)
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={items.length <= 1}
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QuestionSettingsPanel({
  survey,
  selectedPage,
  question,
  onSurveyFieldChange,
  onPageFieldChange,
  onQuestionFieldChange,
}) {
  const [activeTab, setActiveTab] = useState('settings')
  const [surveyTab, setSurveyTab] = useState('settings')

  const targetPageOptions = useMemo(() => {
    if (!selectedPage) {
      return []
    }

    return survey.pages
      .filter((page) => page.order > selectedPage.order)
      .map((page) => ({
        value: page.id,
        label: page.title || `Page ${page.order}`,
      }))
  }, [selectedPage, survey.pages])

  const updateQuestionSettings = (patch) => {
    onQuestionFieldChange(question.id, 'settings', {
      ...(question.settings ?? {}),
      ...patch,
    })
  }

  const updateChoiceLogic = (choiceId, patch) => {
    const currentRules = [...(question.skip_logic ?? [])]
    const defaultRules = currentRules.filter((rule) => rule.condition?.default)
    const choiceRules = currentRules.filter((rule) => !rule.condition?.default && rule.condition?.choice_id !== choiceId)

    if (patch.action === 'continue') {
      onQuestionFieldChange(question.id, 'skip_logic', [...choiceRules, ...defaultRules])
      return
    }

    onQuestionFieldChange(question.id, 'skip_logic', [
      ...choiceRules,
      {
        condition: { choice_id: choiceId },
        action: patch.action,
        target: patch.target || '',
        message: patch.message || '',
      },
      ...defaultRules,
    ])
  }

  const updateDefaultLogic = (patch) => {
    const currentRules = [...(question.skip_logic ?? [])].filter((rule) => !rule.condition?.default)
    if (patch.action === 'continue') {
      onQuestionFieldChange(question.id, 'skip_logic', currentRules)
      return
    }

    onQuestionFieldChange(question.id, 'skip_logic', [
      ...currentRules,
      {
        condition: { default: true },
        action: patch.action,
        target: patch.target || '',
        message: patch.message || '',
      },
    ])
  }

  const replaceRatingRules = (nextRules) => {
    const defaultRule = (question.skip_logic ?? []).find((rule) => rule.condition?.default)
    onQuestionFieldChange(question.id, 'skip_logic', [
      ...nextRules.filter((rule) => rule.action && rule.action !== 'continue'),
      ...(defaultRule?.action && defaultRule.action !== 'continue' ? [defaultRule] : []),
    ])
  }

  if (!question) {
    return (
      <aside className="theme-sidebar flex min-h-[30rem] h-full flex-col gap-4 overflow-y-auto rounded-[2rem] p-4">
        <div className="theme-panel rounded-[1.75rem] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Survey</h2>
            <HelpPopover title="Survey workspace" align="end">
              Use Settings for survey-level behavior and page routing. Use Design to control the live respondent theme, branding, fonts, and spacing.
            </HelpPopover>
          </div>

          <div className="theme-panel-soft mt-4 grid grid-cols-2 gap-2 rounded-2xl p-1">
            {[
              ['settings', 'Settings'],
              ['design', 'Design'],
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setSurveyTab(tabKey)}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  surveyTab === tabKey
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {surveyTab === 'settings' ? (
          <>
            <PanelSection
              eyebrow="Survey"
              title="Survey settings"
              description="Tune the overall experience before drilling into any single question."
            >
              <Field label="Survey title">
                <Input
                  value={survey.title}
                  onChange={(event) => onSurveyFieldChange('title', event.target.value)}
                  className="rounded-2xl"
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={survey.description || ''}
                  onChange={(event) => onSurveyFieldChange('description', event.target.value)}
                  className="rounded-2xl"
                />
              </Field>

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                {[
                  ['progress_bar', 'Show progress bar'],
                  ['numbering', 'Display page numbering'],
                  ['save_continue', 'Allow save and continue'],
                  ['multi_response', 'Allow multiple responses'],
                ].map(([settingKey, label]) => (
                  <div key={settingKey} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{label}</p>
                    </div>
                    <Switch
                      checked={Boolean(survey.settings?.[settingKey])}
                      onCheckedChange={(checked) =>
                        onSurveyFieldChange('settings', {
                          ...(survey.settings ?? {}),
                          [settingKey]: checked,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </PanelSection>

            {selectedPage ? (
              <PanelSection
                eyebrow="Page"
                title={selectedPage.title || `Page ${selectedPage.order}`}
                description="Adjust the selected page and its outgoing branch."
              >
                <Field label="Page title">
                  <Input
                    value={selectedPage.title}
                    onChange={(event) => onPageFieldChange(selectedPage.id, 'title', event.target.value)}
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="Page description">
                  <Textarea
                    value={selectedPage.description || ''}
                    onChange={(event) =>
                      onPageFieldChange(selectedPage.id, 'description', event.target.value)
                    }
                    className="rounded-2xl"
                  />
                </Field>
                <Field
                  label="After this page, always skip to"
                  hint="Leave blank to continue to the next page."
                >
                  <MiniSelect
                    value={selectedPage.skip_logic?.target || ''}
                    onChange={(value) =>
                      onPageFieldChange(
                        selectedPage.id,
                        'skip_logic',
                        value ? { action: 'skip_to_page', target: value } : null
                      )
                    }
                    options={[
                      { value: '', label: 'Continue normally' },
                      ...targetPageOptions,
                    ]}
                  />
                </Field>
              </PanelSection>
            ) : null}
          </>
        ) : (
          <SurveyThemeEditor
            survey={survey}
            onSurveyFieldChange={onSurveyFieldChange}
          />
        )}
      </aside>
    )
  }

  const currentRules = question.skip_logic ?? []
  const defaultRule = currentRules.find((rule) => rule.condition?.default)
  const ratingRules = currentRules.filter((rule) => !rule.condition?.default)

  return (
    <aside className="theme-sidebar flex min-h-[30rem] h-full flex-col gap-4 overflow-y-auto rounded-[2rem] p-4">
      <div className="theme-panel rounded-[1.75rem] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">{QUESTION_TYPE_META[question.question_type]?.shortLabel}</Badge>
          <Badge variant="outline">Question editor</Badge>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {QUESTION_TYPE_META[question.question_type]?.label}
          </h2>
          <HelpPopover title="Question editor" align="end">
            {questionHasChoices(question.question_type)
              ? 'Edit question text and option labels in the canvas. Use this panel for helper text, behavior, validation, and branching.'
              : 'Use this panel for helper text, behavior, validation, and branching for the selected question.'}
          </HelpPopover>
        </div>

        <div className="theme-panel-soft mt-5 grid grid-cols-2 gap-2 rounded-2xl p-1">
          {[
            ['settings', 'Settings'],
            ['logic', 'Logic'],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                activeTab === tabKey
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'settings' ? (
        <>
          <PanelSection
            eyebrow="Content"
            title="Question copy"
            description="Write clear prompts and optional helper text."
          >
            <Field label="Question text">
              <Textarea
                value={question.text}
                onChange={(event) => onQuestionFieldChange(question.id, 'text', event.target.value)}
                className="rounded-2xl"
              />
            </Field>
            <Field label="Description / help text">
              <Textarea
                value={question.description || ''}
                onChange={(event) =>
                  onQuestionFieldChange(question.id, 'description', event.target.value)
                }
                className="rounded-2xl"
              />
            </Field>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700">Required</p>
                  <HelpPopover title="Required" triggerClassName="h-7 w-7 text-slate-400">
                    Respondents must answer before continuing.
                  </HelpPopover>
                </div>
                <Switch
                  checked={Boolean(question.required)}
                  onCheckedChange={(checked) => onQuestionFieldChange(question.id, 'required', checked)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-700">Allow comment</p>
                  <HelpPopover title="Allow comment" triggerClassName="h-7 w-7 text-slate-400">
                    Adds an optional comment box to responses.
                  </HelpPopover>
                </div>
                <Switch
                  checked={Boolean(question.settings?.allow_comment)}
                  onCheckedChange={(checked) => updateQuestionSettings({ allow_comment: checked })}
                />
              </div>
            </div>
          </PanelSection>

          {questionHasChoices(question.question_type) &&
          ('randomize_choices' in (question.settings ?? {}) ||
            'allow_other' in (question.settings ?? {}) ||
            question.question_type === 'multiple_choice_multi') ? (
            <PanelSection
              eyebrow="Choices"
              title="Choice behavior"
              description="Control how the option list behaves without editing the option text itself."
            >
              <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {'randomize_choices' in (question.settings ?? {}) ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">Randomize choices</p>
                      <HelpPopover title="Randomize choices" triggerClassName="h-7 w-7 text-slate-400">
                        Shuffles the option order for respondents to reduce position bias.
                      </HelpPopover>
                    </div>
                    <Switch
                      checked={Boolean(question.settings?.randomize_choices)}
                      onCheckedChange={(checked) =>
                        updateQuestionSettings({ randomize_choices: checked })
                      }
                    />
                  </div>
                ) : null}

                {'allow_other' in (question.settings ?? {}) ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">Allow other option</p>
                      <HelpPopover title="Allow other option" triggerClassName="h-7 w-7 text-slate-400">
                        Adds a free-text fallback option for respondents.
                      </HelpPopover>
                    </div>
                    <Switch
                      checked={Boolean(question.settings?.allow_other)}
                      onCheckedChange={(checked) =>
                        updateQuestionSettings({ allow_other: checked })
                      }
                    />
                  </div>
                ) : null}
              </div>

              {question.question_type === 'multiple_choice_multi' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Min selections" hint="Set 0 to allow respondents to skip this question unless it is required.">
                    <Input
                      type="number"
                      min="0"
                      value={question.settings?.min_selections ?? 0}
                      onChange={(event) =>
                        updateQuestionSettings({
                          min_selections: Number(event.target.value || 0),
                        })
                      }
                      className="rounded-2xl"
                    />
                  </Field>
                  <Field label="Max selections" hint="Set 0 for no maximum limit.">
                    <Input
                      type="number"
                      min="0"
                      value={question.settings?.max_selections ?? 0}
                      onChange={(event) =>
                        updateQuestionSettings({
                          max_selections: Number(event.target.value || 0),
                        })
                      }
                      className="rounded-2xl"
                    />
                  </Field>
                </div>
              ) : null}
            </PanelSection>
          ) : null}

          {isRatingQuestion(question.question_type) ? (
            <PanelSection
              eyebrow="Scale"
              title="Rating settings"
              description="Set the scale range and the labels respondents see."
            >
              <div className="grid grid-cols-3 gap-3">
                <Field label="Min">
                  <Input
                    type="number"
                    value={question.settings?.min_value ?? 1}
                    onChange={(event) =>
                      updateQuestionSettings({ min_value: Number(event.target.value || 0) })
                    }
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="Max">
                  <Input
                    type="number"
                    value={question.settings?.max_value ?? 5}
                    onChange={(event) =>
                      updateQuestionSettings({ max_value: Number(event.target.value || 0) })
                    }
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="Step">
                  <Input
                    type="number"
                    value={question.settings?.step ?? 1}
                    onChange={(event) =>
                      updateQuestionSettings({ step: Number(event.target.value || 1) })
                    }
                    className="rounded-2xl"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Low label">
                  <Input
                    value={question.settings?.labels?.low || ''}
                    onChange={(event) =>
                      updateQuestionSettings({
                        labels: {
                          ...(question.settings?.labels ?? {}),
                          low: event.target.value,
                        },
                      })
                    }
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="High label">
                  <Input
                    value={question.settings?.labels?.high || ''}
                    onChange={(event) =>
                      updateQuestionSettings({
                        labels: {
                          ...(question.settings?.labels ?? {}),
                          high: event.target.value,
                        },
                      })
                    }
                    className="rounded-2xl"
                  />
                </Field>
              </div>
            </PanelSection>
          ) : null}

          {question.question_type === 'matrix' ? (
            <PanelSection
              eyebrow="Matrix"
              title="Rows and columns"
              description="Define the dimensions and answer behavior for each matrix cell."
            >
              <ArrayEditor
                label="Rows"
                items={question.settings?.rows ?? []}
                onChange={(rows) => updateQuestionSettings({ rows })}
              />
              <ArrayEditor
                label="Columns"
                items={question.settings?.columns ?? []}
                onChange={(columns) => updateQuestionSettings({ columns })}
              />
              <Field label="Cell type">
                <MiniSelect
                  value={question.settings?.cell_type ?? 'radio'}
                  onChange={(value) => updateQuestionSettings({ cell_type: value })}
                  options={[
                    { value: 'radio', label: 'Single answer per row' },
                    { value: 'checkbox', label: 'Multiple answers per row' },
                  ]}
                />
              </Field>
            </PanelSection>
          ) : null}

          {question.question_type === 'constant_sum' ? (
            <PanelSection
              eyebrow="Allocation"
              title="Constant sum"
              description="Configure the target total and display mode."
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Target sum">
                  <Input
                    type="number"
                    value={question.settings?.target_sum ?? 100}
                    onChange={(event) =>
                      updateQuestionSettings({ target_sum: Number(event.target.value || 0) })
                    }
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="Display mode">
                  <MiniSelect
                    value={question.settings?.display_mode ?? 'numbers'}
                    onChange={(value) => updateQuestionSettings({ display_mode: value })}
                    options={[
                      { value: 'numbers', label: 'Numbers' },
                      { value: 'percentages', label: 'Percentages' },
                    ]}
                  />
                </Field>
              </div>
            </PanelSection>
          ) : null}

          {question.question_type === 'date_time' ? (
            <PanelSection
              eyebrow="Date / Time"
              title="Date constraints"
              description="Limit how respondents can answer this field."
            >
              <Field label="Mode">
                <MiniSelect
                  value={question.settings?.mode ?? 'both'}
                  onChange={(value) => updateQuestionSettings({ mode: value })}
                  options={[
                    { value: 'date', label: 'Date only' },
                    { value: 'time', label: 'Time only' },
                    { value: 'both', label: 'Date and time' },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min date">
                  <Input
                    type="datetime-local"
                    value={question.settings?.min_date || ''}
                    onChange={(event) => updateQuestionSettings({ min_date: event.target.value })}
                    className="rounded-2xl"
                  />
                </Field>
                <Field label="Max date">
                  <Input
                    type="datetime-local"
                    value={question.settings?.max_date || ''}
                    onChange={(event) => updateQuestionSettings({ max_date: event.target.value })}
                    className="rounded-2xl"
                  />
                </Field>
              </div>
            </PanelSection>
          ) : null}

          {question.question_type === 'demographics' ? (
            <PanelSection
              eyebrow="Fields"
              title="Demographics fields"
              description="Toggle the built-in fields you want to collect."
            >
              <div className="space-y-3">
                {DEMOGRAPHIC_FIELDS.map((field) => (
                  <div key={field} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <span className="text-sm font-medium capitalize text-slate-700">{field}</span>
                    <Switch
                      checked={Boolean(question.settings?.fields?.[field])}
                      onCheckedChange={(checked) =>
                        updateQuestionSettings({
                          fields: {
                            ...(question.settings?.fields ?? {}),
                            [field]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </PanelSection>
          ) : null}

          {question.question_type === 'image_choice' ? (
            <PanelSection
              eyebrow="Layout"
              title="Image selection"
              description="Control the grid density and whether respondents can choose multiple images."
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Grid columns">
                  <MiniSelect
                    value={`${question.settings?.grid_columns ?? 3}`}
                    onChange={(value) => updateQuestionSettings({ grid_columns: Number(value) })}
                    options={[
                      { value: '2', label: '2 columns' },
                      { value: '3', label: '3 columns' },
                      { value: '4', label: '4 columns' },
                    ]}
                  />
                </Field>
                <Field label="Selection mode">
                  <MiniSelect
                    value={question.settings?.single_select === false ? 'multi' : 'single'}
                    onChange={(value) =>
                      updateQuestionSettings({ single_select: value !== 'multi' })
                    }
                    options={[
                      { value: 'single', label: 'Single select' },
                      { value: 'multi', label: 'Multi select' },
                    ]}
                  />
                </Field>
              </div>
            </PanelSection>
          ) : null}

          {question.question_type === 'file_upload' ? (
            <PanelSection
              eyebrow="Upload"
              title="File rules"
              description="Define the file types and maximum upload size for this question."
            >
              <div className="space-y-3">
                {['pdf', 'png', 'jpg', 'doc'].map((fileType) => {
                  const allowedTypes = question.settings?.allowed_types ?? []
                  return (
                    <div key={fileType} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="text-sm font-medium uppercase text-slate-700">{fileType}</span>
                      <Switch
                        checked={allowedTypes.includes(fileType)}
                        onCheckedChange={(checked) => {
                          const nextTypes = checked
                            ? [...new Set([...allowedTypes, fileType])]
                            : allowedTypes.filter((item) => item !== fileType)
                          updateQuestionSettings({ allowed_types: nextTypes })
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              <Field label="Max file size (MB)">
                <Input
                  type="number"
                  value={question.settings?.max_file_size_mb ?? 10}
                  onChange={(event) =>
                    updateQuestionSettings({
                      max_file_size_mb: Number(event.target.value || 0),
                    })
                  }
                  className="rounded-2xl"
                />
              </Field>
            </PanelSection>
          ) : null}
        </>
      ) : (
        <PanelSection
          eyebrow="Logic"
          title="Skip logic"
          description="Define where respondents should go next based on how they answer."
        >
          <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-700">Enable skip logic</p>
              <HelpPopover title="Enable skip logic" triggerClassName="h-7 w-7 text-slate-400">
                {questionSupportsSkipLogic(question.question_type)
                  ? 'Create answer-specific jumps or exits.'
                  : 'This question type does not currently support branching.'}
              </HelpPopover>
            </div>
            <Switch
              checked={(question.skip_logic ?? []).length > 0}
              disabled={!questionSupportsSkipLogic(question.question_type)}
              onCheckedChange={(checked) => {
                if (!checked) {
                  onQuestionFieldChange(question.id, 'skip_logic', [])
                } else if (checked && question.question_type && !question.skip_logic?.length) {
                  onQuestionFieldChange(question.id, 'skip_logic', [
                    { condition: { default: true }, action: 'continue', target: '' },
                  ])
                }
              }}
            />
          </div>

          {questionSupportsLogicChoices(question.question_type) ? (
            <>
              {questionHasChoices(question.question_type) ? (
                <div className="space-y-3">
                  {(question.choices ?? []).map((choice) => {
                    const choiceRule = currentRules.find((rule) => rule.condition?.choice_id === choice.id)
                    return (
                      <div key={choice.id ?? choice.order} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-800">
                          If respondent selects &quot;{choice.text}&quot;
                        </p>
                        <MiniSelect
                          value={choiceRule?.action || 'continue'}
                          onChange={(value) =>
                            updateChoiceLogic(choice.id, {
                              ...(choiceRule ?? {}),
                              action: value,
                            })
                          }
                          options={[
                            { value: 'continue', label: 'Continue to next page' },
                            { value: 'skip_to_page', label: 'Skip to page' },
                            { value: 'end_survey', label: 'End survey' },
                            { value: 'disqualify', label: 'Disqualify' },
                          ]}
                        />
                        {choiceRule?.action === 'skip_to_page' ? (
                          <MiniSelect
                            value={choiceRule?.target || ''}
                            onChange={(value) =>
                              updateChoiceLogic(choice.id, {
                                ...(choiceRule ?? {}),
                                action: 'skip_to_page',
                                target: value,
                              })
                            }
                            options={[
                              { value: '', label: 'Choose a page' },
                              ...targetPageOptions,
                            ]}
                          />
                        ) : null}
                        {choiceRule?.action === 'disqualify' ? (
                          <Textarea
                            value={choiceRule?.message || ''}
                            placeholder="Disqualification message"
                            onChange={(event) =>
                              updateChoiceLogic(choice.id, {
                                ...(choiceRule ?? {}),
                                action: 'disqualify',
                                message: event.target.value,
                              })
                            }
                            className="rounded-2xl"
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {isRatingQuestion(question.question_type) ? (
                <div className="space-y-3">
                  {ratingRules.map((rule, index) => (
                    <div key={`rating-rule-${index}`} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="grid grid-cols-2 gap-3">
                        <MiniSelect
                          value={rule.condition?.operator || 'gt'}
                          onChange={(value) => {
                            const nextRules = [...ratingRules]
                            nextRules[index] = {
                              ...nextRules[index],
                              condition: {
                                ...nextRules[index].condition,
                                operator: value,
                              },
                            }
                            replaceRatingRules(nextRules)
                          }}
                          options={[
                            { value: 'eq', label: 'Equals' },
                            { value: 'lt', label: 'Less than' },
                            { value: 'gt', label: 'Greater than' },
                            { value: 'between', label: 'Between' },
                          ]}
                        />
                        <MiniSelect
                          value={rule.action || 'continue'}
                          onChange={(value) => {
                            const nextRules = [...ratingRules]
                            nextRules[index] = {
                              ...nextRules[index],
                              action: value,
                            }
                            replaceRatingRules(nextRules)
                          }}
                          options={[
                            { value: 'continue', label: 'Continue to next page' },
                            { value: 'skip_to_page', label: 'Skip to page' },
                            { value: 'end_survey', label: 'End survey' },
                            { value: 'disqualify', label: 'Disqualify' },
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          type="number"
                          placeholder={rule.condition?.operator === 'between' ? 'Min value' : 'Value'}
                          value={rule.condition?.operator === 'between' ? rule.condition?.min ?? '' : rule.condition?.value ?? ''}
                          onChange={(event) => {
                            const nextRules = [...ratingRules]
                            nextRules[index] = {
                              ...nextRules[index],
                              condition: {
                                ...nextRules[index].condition,
                                ...(rule.condition?.operator === 'between'
                                  ? { min: Number(event.target.value || 0) }
                                  : { value: Number(event.target.value || 0) }),
                              },
                            }
                            replaceRatingRules(nextRules)
                          }}
                          className="rounded-2xl"
                        />
                        {rule.condition?.operator === 'between' ? (
                          <Input
                            type="number"
                            placeholder="Max value"
                            value={rule.condition?.max ?? ''}
                            onChange={(event) => {
                              const nextRules = [...ratingRules]
                              nextRules[index] = {
                                ...nextRules[index],
                                condition: {
                                  ...nextRules[index].condition,
                                  max: Number(event.target.value || 0),
                                },
                              }
                              replaceRatingRules(nextRules)
                            }}
                            className="rounded-2xl"
                          />
                        ) : (
                          <div />
                        )}
                      </div>

                      {rule.action === 'skip_to_page' ? (
                        <MiniSelect
                          value={rule.target || ''}
                          onChange={(value) => {
                            const nextRules = [...ratingRules]
                            nextRules[index] = {
                              ...nextRules[index],
                              target: value,
                            }
                            replaceRatingRules(nextRules)
                          }}
                          options={[
                            { value: '', label: 'Choose a page' },
                            ...targetPageOptions,
                          ]}
                        />
                      ) : null}

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            replaceRatingRules(ratingRules.filter((_, ruleIndex) => ruleIndex !== index))
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove rule
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={() =>
                      replaceRatingRules([
                        ...ratingRules,
                        {
                          condition: { operator: 'gt', value: 7 },
                          action: 'skip_to_page',
                          target: '',
                        },
                      ])
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add range rule
                  </Button>
                </div>
              ) : null}

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">Default behavior</p>
                <MiniSelect
                  value={defaultRule?.action || 'continue'}
                  onChange={(value) => updateDefaultLogic({ ...(defaultRule ?? {}), action: value })}
                  options={[
                    { value: 'continue', label: 'Continue to next page' },
                    { value: 'skip_to_page', label: 'Skip to page' },
                    { value: 'end_survey', label: 'End survey' },
                    { value: 'disqualify', label: 'Disqualify' },
                  ]}
                />
                {defaultRule?.action === 'skip_to_page' ? (
                  <MiniSelect
                    value={defaultRule?.target || ''}
                    onChange={(value) =>
                      updateDefaultLogic({
                        ...(defaultRule ?? {}),
                        action: 'skip_to_page',
                        target: value,
                      })
                    }
                    options={[
                      { value: '', label: 'Choose a page' },
                      ...targetPageOptions,
                    ]}
                  />
                ) : null}
                {defaultRule?.action === 'disqualify' ? (
                  <Textarea
                    value={defaultRule?.message || ''}
                    onChange={(event) =>
                      updateDefaultLogic({
                        ...(defaultRule ?? {}),
                        action: 'disqualify',
                        message: event.target.value,
                      })
                    }
                    placeholder="Message to show when disqualifying"
                    className="rounded-2xl"
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Skip logic is only available for closed-ended, rating, and structural branching-friendly question types in this phase.
            </div>
          )}
        </PanelSection>
      )}
    </aside>
  )
}
