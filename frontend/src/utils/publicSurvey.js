import {
  getInitialQuestionValue,
  questionValueHasContent,
  resolveNextPreviewStep,
} from '@/utils/surveyBuilder'

export const RESPONDED_COOKIE_PREFIX = 'questiz_responded_'

function buildQuestionIndex(survey) {
  return Object.fromEntries(
    (survey.pages ?? []).flatMap((page) =>
      page.questions.map((question) => [question.id, question])
    )
  )
}

function formatDateInputValue(value) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString().slice(0, 10)
}

function formatDateTimeLocalValue(value) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const pad = (part) => `${part}`.padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function toIsoDateTime(value) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

export function getRespondedCookieName(slug) {
  return `${RESPONDED_COOKIE_PREFIX}${slug}`
}

export function hasRespondedCookie(slug) {
  if (typeof document === 'undefined') {
    return false
  }

  const cookieName = `${getRespondedCookieName(slug)}=`
  return document.cookie.split(';').some((cookie) => cookie.trim().startsWith(cookieName))
}

export function setRespondedCookie(slug, days = 30) {
  if (typeof document === 'undefined') {
    return
  }

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${getRespondedCookieName(slug)}=true; expires=${expires}; path=/; SameSite=Lax`
}

export function buildInitialPublicAnswers(survey) {
  return (survey.pages ?? []).reduce((answers, page) => {
    page.questions.forEach((question) => {
      answers[question.id] = getInitialQuestionValue(question)
    })
    return answers
  }, {})
}

export function restorePublicAnswers(survey, response) {
  const answers = buildInitialPublicAnswers(survey)
  const questionIndex = buildQuestionIndex(survey)

  ;(response?.answers ?? []).forEach((answer) => {
    const question = questionIndex[answer.question]
    if (!question) {
      return
    }

    switch (question.question_type) {
      case 'multiple_choice_single':
      case 'dropdown':
      case 'yes_no':
        answers[question.id] = answer.choice_ids?.[0] || ''
        break
      case 'multiple_choice_multi':
        answers[question.id] = answer.choice_ids ?? []
        break
      case 'image_choice':
        answers[question.id] =
          question.settings?.single_select === false
            ? answer.choice_ids ?? []
            : answer.choice_ids?.[0] || ''
        break
      case 'short_text':
      case 'long_text':
        answers[question.id] = answer.text_value || ''
        break
      case 'rating_scale':
      case 'star_rating':
      case 'nps':
        answers[question.id] =
          answer.numeric_value == null ? null : Number(answer.numeric_value)
        break
      case 'constant_sum':
        answers[question.id] = answer.constant_sum_data || {}
        break
      case 'date_time':
        if ((question.settings?.mode ?? 'both') === 'time') {
          answers[question.id] = answer.text_value || ''
        } else if ((question.settings?.mode ?? 'both') === 'date') {
          answers[question.id] = formatDateInputValue(answer.date_value)
        } else {
          answers[question.id] = formatDateTimeLocalValue(answer.date_value)
        }
        break
      case 'matrix':
      case 'demographics':
        answers[question.id] = answer.matrix_data || {}
        break
      case 'ranking':
        answers[question.id] = answer.ranking_data || []
        break
      case 'file_upload':
        answers[question.id] = answer.file_url || null
        break
      default:
        answers[question.id] = answer.text_value || ''
        break
    }
  })

  return answers
}

export function buildResumePageHistory(survey, answers, currentPageId) {
  const pages = survey.pages ?? []

  if (!pages.length) {
    return []
  }

  const targetPageIndex = currentPageId
    ? pages.findIndex((page) => page.id === currentPageId)
    : 0

  if (targetPageIndex <= 0) {
    return [0]
  }

  const history = [0]
  const visited = new Set(history)

  while (history[history.length - 1] !== targetPageIndex) {
    const currentPageIndex = history[history.length - 1]
    const resolution = resolveNextPreviewStep({
      pages,
      currentPageIndex,
      answers,
    })

    if (
      resolution.type !== 'page' ||
      resolution.pageIndex === currentPageIndex ||
      visited.has(resolution.pageIndex)
    ) {
      break
    }

    history.push(resolution.pageIndex)
    visited.add(resolution.pageIndex)
  }

  if (history[history.length - 1] === targetPageIndex) {
    return history
  }

  return Array.from({ length: targetPageIndex + 1 }, (_, index) => index)
}

export function serializePublicAnswers(survey, answers) {
  return (survey.pages ?? [])
    .flatMap((page) => page.questions)
    .filter((question) => !['section_heading', 'instructional_text'].includes(question.question_type))
    .map((question) => {
      const value = answers[question.id]
      const basePayload = {
        question: question.id,
      }

      switch (question.question_type) {
        case 'multiple_choice_single':
        case 'dropdown':
        case 'yes_no':
          return {
            ...basePayload,
            choice_ids: value ? [value] : [],
          }
        case 'multiple_choice_multi':
          return {
            ...basePayload,
            choice_ids: value ?? [],
          }
        case 'image_choice':
          return {
            ...basePayload,
            choice_ids:
              question.settings?.single_select === false
                ? value ?? []
                : value
                  ? [value]
                  : [],
          }
        case 'short_text':
        case 'long_text':
          return {
            ...basePayload,
            text_value: value || '',
          }
        case 'rating_scale':
        case 'star_rating':
        case 'nps':
          return {
            ...basePayload,
            numeric_value: value == null ? null : Number(value),
          }
        case 'constant_sum':
          return {
            ...basePayload,
            constant_sum_data: Object.fromEntries(
              Object.entries(value || {}).filter(([, entryValue]) => `${entryValue}`.trim() !== '')
            ),
          }
        case 'date_time':
          if ((question.settings?.mode ?? 'both') === 'time') {
            return {
              ...basePayload,
              text_value: value || '',
            }
          }

          return {
            ...basePayload,
            date_value: toIsoDateTime(
              (question.settings?.mode ?? 'both') === 'date'
                ? `${value}T00:00:00`
                : value
            ),
          }
        case 'matrix':
        case 'demographics':
          return {
            ...basePayload,
            matrix_data: value || {},
          }
        case 'ranking':
          return {
            ...basePayload,
            ranking_data: value || [],
          }
        case 'file_upload':
          return {
            ...basePayload,
            file_url: typeof value === 'string' ? value : '',
          }
        default:
          return {
            ...basePayload,
            text_value: value || '',
          }
      }
    })
}

function getEnabledDemographicFields(question) {
  return Object.entries(question.settings?.fields ?? {})
    .filter(([, enabled]) => enabled)
    .map(([field]) => field)
}

export function getQuestionValidationError(question, value) {
  if (!question.required) {
    if (question.question_type === 'constant_sum' && questionValueHasContent(question, value)) {
      const target = Number(question.settings?.target_sum ?? 100)
      const total = Object.values(value || {}).reduce(
        (sum, item) => sum + Number(item || 0),
        0
      )
      if (total !== target) {
        return `Total must equal ${target}.`
      }
    }
    return ''
  }

  switch (question.question_type) {
    case 'multiple_choice_multi': {
      const total = (value || []).length
      const minSelections = Number(question.settings?.min_selections || 0)
      const maxSelections = Number(question.settings?.max_selections || 0)

      if (!total) {
        return 'Select at least one option.'
      }
      if (minSelections > 0 && total < minSelections) {
        return `Select at least ${minSelections} options.`
      }
      if (maxSelections > 0 && total > maxSelections) {
        return `Select no more than ${maxSelections} options.`
      }
      return ''
    }
    case 'constant_sum': {
      const target = Number(question.settings?.target_sum ?? 100)
      const total = Object.values(value || {}).reduce(
        (sum, item) => sum + Number(item || 0),
        0
      )

      if (!Object.keys(value || {}).length) {
        return 'Complete the allocation before continuing.'
      }
      if (total !== target) {
        return `Total must equal ${target}.`
      }
      return ''
    }
    case 'matrix': {
      const rows = question.settings?.rows ?? []
      const cellType = question.settings?.cell_type ?? 'radio'
      const missingRow = rows.find((row) => {
        if (cellType === 'checkbox') {
          return !Object.values(value?.[row] ?? {}).some(Boolean)
        }
        return !value?.[row]
      })
      return missingRow ? 'Answer each row before continuing.' : ''
    }
    case 'demographics': {
      const missingField = getEnabledDemographicFields(question).find(
        (field) => !`${value?.[field] ?? ''}`.trim()
      )
      return missingField ? 'Complete all required fields before continuing.' : ''
    }
    case 'file_upload':
      return value ? '' : 'Add a file before continuing.'
    default:
      return questionValueHasContent(question, value)
        ? ''
        : 'This question is required.'
  }
}

export function validateSurveyPage(page, answers) {
  const errors = {}

  page.questions.forEach((question) => {
    if (['section_heading', 'instructional_text'].includes(question.question_type)) {
      return
    }

    const errorMessage = getQuestionValidationError(question, answers[question.id])
    if (errorMessage) {
      errors[question.id] = errorMessage
    }
  })

  return errors
}
