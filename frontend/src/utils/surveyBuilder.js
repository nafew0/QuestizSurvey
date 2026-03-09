import { DEMOGRAPHIC_FIELDS, QUESTION_TYPE_META } from '@/constants/surveyBuilder'
import { normalizeSurveyTheme } from '@/lib/surveyTheme'

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createClientUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function questionHasChoices(questionType) {
  return [
    'multiple_choice_single',
    'multiple_choice_multi',
    'dropdown',
    'yes_no',
    'constant_sum',
    'ranking',
    'image_choice',
  ].includes(questionType)
}

export function questionSupportsSkipLogic(questionType) {
  return !['short_text', 'long_text', 'file_upload', 'section_heading', 'instructional_text'].includes(
    questionType
  )
}

export function isRatingQuestion(questionType) {
  return ['rating_scale', 'star_rating', 'nps'].includes(questionType)
}

export function defaultChoicesForType(questionType) {
  switch (questionType) {
    case 'yes_no':
      return [
        { id: createClientUuid(), text: 'Yes', order: 1, score: 1 },
        { id: createClientUuid(), text: 'No', order: 2, score: 0 },
      ]
    case 'image_choice':
      return [
        { id: createClientUuid(), text: 'Image option 1', order: 1, image_url: '' },
        { id: createClientUuid(), text: 'Image option 2', order: 2, image_url: '' },
      ]
    default:
      return [
        { id: createClientUuid(), text: 'Option 1', order: 1 },
        { id: createClientUuid(), text: 'Option 2', order: 2 },
      ]
  }
}

export function defaultSettingsForType(questionType) {
  switch (questionType) {
    case 'multiple_choice_multi':
      return {
        allow_comment: false,
        allow_other: false,
        randomize_choices: false,
        min_selections: 0,
        max_selections: 0,
      }
    case 'multiple_choice_single':
    case 'dropdown':
    case 'yes_no':
      return {
        allow_comment: false,
        allow_other: false,
        randomize_choices: false,
      }
    case 'rating_scale':
      return {
        allow_comment: false,
        min_value: 1,
        max_value: 5,
        step: 1,
        labels: {
          low: 'Poor',
          high: 'Excellent',
        },
      }
    case 'star_rating':
      return {
        allow_comment: false,
        min_value: 1,
        max_value: 5,
        step: 1,
        labels: {
          low: 'Not likely',
          high: 'Very likely',
        },
      }
    case 'nps':
      return {
        allow_comment: false,
        min_value: 0,
        max_value: 10,
        step: 1,
        labels: {
          low: 'Not at all likely',
          high: 'Extremely likely',
        },
      }
    case 'constant_sum':
      return {
        target_sum: 100,
        display_mode: 'numbers',
      }
    case 'matrix':
      return {
        rows: ['Row 1', 'Row 2'],
        columns: ['Column 1', 'Column 2'],
        cell_type: 'radio',
      }
    case 'ranking':
      return {
        randomize_choices: false,
      }
    case 'date_time':
      return {
        mode: 'both',
        min_date: '',
        max_date: '',
      }
    case 'file_upload':
      return {
        allowed_types: ['pdf', 'png', 'jpg'],
        max_file_size_mb: 10,
      }
    case 'image_choice':
      return {
        single_select: true,
        grid_columns: 3,
      }
    case 'demographics':
      return {
        fields: DEMOGRAPHIC_FIELDS.reduce((acc, field) => {
          acc[field] = ['name', 'email'].includes(field)
          return acc
        }, {}),
      }
    case 'section_heading':
      return {
        heading_level: 'h2',
      }
    case 'instructional_text':
      return {
        emphasis: 'muted',
      }
    default:
      return {
        allow_comment: false,
      }
  }
}

export function createQuestionDraft(questionType) {
  return {
    question_type: questionType,
    text: `Untitled ${QUESTION_TYPE_META[questionType]?.label ?? 'Question'}`,
    description: '',
    required: false,
    settings: defaultSettingsForType(questionType),
    skip_logic: [],
    choices: questionHasChoices(questionType)
      ? defaultChoicesForType(questionType)
      : [],
  }
}

export function createPageDraft(order) {
  return {
    title: `Page ${order}`,
    description: '',
    order,
    skip_logic: null,
    questions: [],
  }
}

export function normalizeQuestion(question) {
  return {
    ...question,
    description: question.description ?? '',
    settings: question.settings ?? {},
    skip_logic: question.skip_logic ?? [],
    choices: (question.choices ?? []).map((choice, index) => ({
      ...choice,
      order: choice.order ?? index + 1,
      image_url: choice.image_url ?? '',
      is_other: Boolean(choice.is_other),
    })),
  }
}

export function normalizePage(page) {
  return {
    ...page,
    title: page.title ?? '',
    description: page.description ?? '',
    skip_logic: page.skip_logic ?? null,
    questions: (page.questions ?? []).map(normalizeQuestion).sort((left, right) => left.order - right.order),
  }
}

export function normalizeSurvey(survey) {
  return {
    ...survey,
    description: survey.description ?? '',
    theme: normalizeSurveyTheme(survey.theme ?? {}),
    settings: survey.settings ?? {},
    welcome_page: survey.welcome_page ?? {},
    thank_you_page: survey.thank_you_page ?? {},
    pages: (survey.pages ?? []).map(normalizePage).sort((left, right) => left.order - right.order),
  }
}

export function findQuestionLocation(pages, questionId) {
  for (const page of pages) {
    const questionIndex = page.questions.findIndex((question) => question.id === questionId)
    if (questionIndex >= 0) {
      return {
        page,
        question: page.questions[questionIndex],
        questionIndex,
      }
    }
  }

  return null
}

export function reindexPages(pages) {
  return pages.map((page, index) => ({
    ...page,
    order: index + 1,
  }))
}

export function reindexQuestions(questions) {
  return questions.map((question, index) => ({
    ...question,
    order: index + 1,
    choices: (question.choices ?? []).map((choice, choiceIndex) => ({
      ...choice,
      order: choiceIndex + 1,
    })),
  }))
}

export function moveArrayItem(items, fromIndex, toIndex) {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, item)
  return nextItems
}

export function getQuestionPayload(question) {
  return {
    question_type: question.question_type,
    text: question.text,
    description: question.description,
    required: question.required,
    order: question.order,
    settings: question.settings ?? {},
    skip_logic: question.skip_logic ?? [],
    choices: (question.choices ?? []).map((choice, index) => ({
      id: choice.id,
      text: choice.text,
      image_url: choice.image_url || null,
      is_other: Boolean(choice.is_other),
      order: choice.order ?? index + 1,
      score: choice.score ?? null,
    })),
  }
}

export function getPagePayload(page) {
  return {
    title: page.title,
    description: page.description,
    order: page.order,
    skip_logic: page.skip_logic,
  }
}

export function buildQuestionReorderPayload(pages) {
  return pages.flatMap((page) =>
    page.questions.map((question, index) => ({
      id: question.id,
      page: page.id,
      order: index + 1,
    }))
  )
}

export function buildPageReorderPayload(pages) {
  return pages.map((page, index) => ({
    id: page.id,
    order: index + 1,
  }))
}

export function getStatusLabel(status) {
  return status?.charAt(0).toUpperCase() + status?.slice(1)
}

export function formatSurveyDate(value) {
  if (!value) {
    return 'Recently'
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getInitialQuestionValue(question) {
  switch (question.question_type) {
    case 'multiple_choice_multi':
    case 'ranking':
      return []
    case 'constant_sum':
    case 'matrix':
    case 'demographics':
      return {}
    case 'image_choice':
      return question.settings?.single_select === false ? [] : ''
    case 'yes_no':
      return ''
    case 'star_rating':
    case 'rating_scale':
    case 'nps':
      return null
    default:
      return ''
  }
}

export function questionValueHasContent(question, value) {
  if (value == null) {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }

  return `${value}`.trim().length > 0
}

export function matchesSkipRule(rule, question, answerValue) {
  if (!rule || !questionValueHasContent(question, answerValue)) {
    return false
  }

  if (rule.condition?.default) {
    return true
  }

  if (rule.condition?.choice_id) {
    if (Array.isArray(answerValue)) {
      return answerValue.includes(rule.condition.choice_id)
    }
    return answerValue === rule.condition.choice_id
  }

  if (rule.condition?.operator) {
    const numericAnswer = Number(answerValue)
    const value = Number(rule.condition.value)
    const min = Number(rule.condition.min)
    const max = Number(rule.condition.max)

    switch (rule.condition.operator) {
      case 'eq':
        return numericAnswer === value
      case 'lt':
        return numericAnswer < value
      case 'gt':
        return numericAnswer > value
      case 'between':
        return numericAnswer >= min && numericAnswer <= max
      default:
        return false
    }
  }

  return false
}

export function resolveNextPreviewStep({ pages, currentPageIndex, answers }) {
  const currentPage = pages[currentPageIndex]

  if (!currentPage) {
    return { type: 'complete' }
  }

  for (const question of currentPage.questions) {
    const answerValue = answers[question.id]
    const rules = question.skip_logic ?? []
    const matchedRule =
      rules.find((rule) => !rule.condition?.default && matchesSkipRule(rule, question, answerValue)) ??
      rules.find((rule) => rule.condition?.default)

    if (matchedRule) {
      if (matchedRule.action === 'skip_to_page' && matchedRule.target) {
        const pageIndex = pages.findIndex((page) => page.id === matchedRule.target)
        if (pageIndex >= 0) {
          return { type: 'page', pageIndex }
        }
      }

      if (matchedRule.action === 'end_survey') {
        return { type: 'complete' }
      }

      if (matchedRule.action === 'disqualify') {
        return {
          type: 'disqualify',
          message: matchedRule.message || 'This preview flow ended based on your logic rule.',
        }
      }
    }
  }

  if (currentPage.skip_logic?.action === 'skip_to_page' && currentPage.skip_logic?.target) {
    const pageIndex = pages.findIndex((page) => page.id === currentPage.skip_logic.target)
    if (pageIndex >= 0) {
      return { type: 'page', pageIndex }
    }
  }

  if (currentPageIndex >= pages.length - 1) {
    return { type: 'complete' }
  }

  return {
    type: 'page',
    pageIndex: currentPageIndex + 1,
  }
}

export function questionSupportsLogicChoices(questionType) {
  return questionHasChoices(questionType) || ['rating_scale', 'star_rating', 'nps'].includes(questionType)
}
