import {
  getMatchedSkipRule,
  getInitialQuestionValue,
  questionValueHasContent,
  resolveNextPreviewStep,
} from '@/utils/surveyBuilder'
import { DEMOGRAPHIC_FIELDS } from '@/constants/surveyBuilder'
import {
  buildRestoredAnswerValue,
  createEnhancedAnswerValue,
  getAnswerPrimaryValue,
  getAnswerCommentText,
  getAnswerOtherText,
  stripOtherSelections,
} from '@/utils/questionAnswers'

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

function compactOpenEndedMatrixData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, rowValue]) => `${rowValue ?? ''}`.trim() !== '')
  )
}

function compactMatrixPlusData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([rowLabel, rowValues]) => {
      if (!rowValues || typeof rowValues !== 'object' || Array.isArray(rowValues)) {
        return []
      }

      const compactRow = Object.fromEntries(
        Object.entries(rowValues).filter(([, cellValue]) => `${cellValue ?? ''}`.trim() !== '')
      )

      return Object.keys(compactRow).length ? [[rowLabel, compactRow]] : []
    })
  )
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
      answers[question.id] = createEnhancedAnswerValue(getInitialQuestionValue(question))
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
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.choice_ids?.[0] || '',
          answer
        )
        break
      case 'multiple_choice_multi':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.choice_ids ?? [],
          answer
        )
        break
      case 'image_choice':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          question.settings?.single_select === false
            ? answer.choice_ids ?? []
            : answer.choice_ids?.[0] || '',
          answer
        )
        break
      case 'short_text':
      case 'long_text':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.text_value || '',
          answer
        )
        break
      case 'rating_scale':
      case 'star_rating':
      case 'nps':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.numeric_value == null ? null : Number(answer.numeric_value),
          answer
        )
        break
      case 'constant_sum':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.constant_sum_data || {},
          answer
        )
        break
      case 'date_time':
        if ((question.settings?.mode ?? 'both') === 'time') {
          answers[question.id] = buildRestoredAnswerValue(
            question,
            answer.text_value || '',
            answer
          )
        } else if ((question.settings?.mode ?? 'both') === 'date') {
          answers[question.id] = buildRestoredAnswerValue(
            question,
            formatDateInputValue(answer.date_value),
            answer
          )
        } else {
          answers[question.id] = buildRestoredAnswerValue(
            question,
            formatDateTimeLocalValue(answer.date_value),
            answer
          )
        }
        break
      case 'matrix':
      case 'open_ended':
      case 'matrix_plus':
      case 'demographics':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.matrix_data || {},
          answer
        )
        break
      case 'ranking':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.ranking_data || [],
          answer
        )
        break
      case 'file_upload':
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.file_url || null,
          answer
        )
        break
      default:
        answers[question.id] = buildRestoredAnswerValue(
          question,
          answer.text_value || '',
          answer
        )
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
      const storedValue = answers[question.id]
      const value = getAnswerPrimaryValue(storedValue)
      const basePayload = {
        question: question.id,
      }
      const otherText = getAnswerOtherText(storedValue).trim()
      const commentText = getAnswerCommentText(storedValue).trim()

      let payload = null

      switch (question.question_type) {
        case 'multiple_choice_single':
        case 'dropdown':
        case 'yes_no':
          payload = {
            ...basePayload,
            choice_ids: stripOtherSelections(question, value)
              ? [stripOtherSelections(question, value)]
              : [],
          }
          break
        case 'multiple_choice_multi':
          payload = {
            ...basePayload,
            choice_ids: stripOtherSelections(question, value ?? []),
          }
          break
        case 'image_choice':
          payload = {
            ...basePayload,
            choice_ids:
              question.settings?.single_select === false
                ? stripOtherSelections(question, value ?? [])
                : value
                  ? [stripOtherSelections(question, value)]
                  : [],
          }
          break
        case 'short_text':
        case 'long_text':
          payload = {
            ...basePayload,
            text_value: value || '',
          }
          break
        case 'rating_scale':
        case 'star_rating':
        case 'nps':
          payload = {
            ...basePayload,
            numeric_value: value == null ? null : Number(value),
          }
          break
        case 'constant_sum':
          payload = {
            ...basePayload,
            constant_sum_data: Object.fromEntries(
              Object.entries(value || {}).filter(([, entryValue]) => `${entryValue}`.trim() !== '')
            ),
          }
          break
        case 'date_time':
          if ((question.settings?.mode ?? 'both') === 'time') {
            payload = {
              ...basePayload,
              text_value: value || '',
            }
            break
          }

          payload = {
            ...basePayload,
            date_value: toIsoDateTime(
              (question.settings?.mode ?? 'both') === 'date'
                ? `${value}T00:00:00`
                : value
            ),
          }
          break
        case 'matrix':
        case 'demographics':
          payload = {
            ...basePayload,
            matrix_data: value || {},
          }
          break
        case 'open_ended':
          payload = {
            ...basePayload,
            matrix_data: compactOpenEndedMatrixData(value),
          }
          break
        case 'matrix_plus':
          payload = {
            ...basePayload,
            matrix_data: compactMatrixPlusData(value),
          }
          break
        case 'ranking':
          payload = {
            ...basePayload,
            ranking_data: value || [],
          }
          break
        case 'file_upload':
          payload = {
            ...basePayload,
            file_url: typeof value === 'string' ? value : '',
          }
          break
        default:
          payload = {
            ...basePayload,
            text_value: value || '',
          }
          break
      }

      if (otherText) {
        payload.other_text = otherText
      }

      if (commentText) {
        payload.comment_text = commentText
      }

      return payload
    })
}

function getEnabledDemographicFields(question) {
  const configuredFields = question.settings?.fields

  if (Array.isArray(configuredFields)) {
    return DEMOGRAPHIC_FIELDS.filter((field) => configuredFields.includes(field))
  }

  return DEMOGRAPHIC_FIELDS.filter((field) => Boolean(configuredFields?.[field]))
}

export function getQuestionValidationError(question, value) {
  const primaryValue = getAnswerPrimaryValue(value)

  if (!question.required) {
    if (question.question_type === 'constant_sum' && questionValueHasContent(question, primaryValue)) {
      const target = Number(question.settings?.target_sum ?? 100)
      const total = Object.values(primaryValue || {}).reduce(
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
      const total = (primaryValue || []).length
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
      const total = Object.values(primaryValue || {}).reduce(
        (sum, item) => sum + Number(item || 0),
        0
      )

      if (!Object.keys(primaryValue || {}).length) {
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
          return !Object.values(primaryValue?.[row] ?? {}).some(Boolean)
        }
        return !primaryValue?.[row]
      })
      return missingRow ? 'Answer each row before continuing.' : ''
    }
    case 'open_ended': {
      const rows = question.settings?.rows ?? []
      const missingRow = rows.find((row) => !`${primaryValue?.[row] ?? ''}`.trim())
      return missingRow ? 'Complete each short-answer row before continuing.' : ''
    }
    case 'matrix_plus': {
      const rows = question.settings?.rows ?? []
      const columns = question.settings?.columns ?? []
      const missingCell = rows.find((row) =>
        columns.some((column) => !`${primaryValue?.[row]?.[column] ?? ''}`.trim())
      )
      return missingCell ? 'Answer every matrix cell before continuing.' : ''
    }
    case 'demographics': {
      const missingField = getEnabledDemographicFields(question).find(
        (field) => !`${primaryValue?.[field] ?? ''}`.trim()
      )
      return missingField ? 'Complete all required fields before continuing.' : ''
    }
    case 'file_upload':
      return primaryValue ? '' : 'Add a file before continuing.'
    default:
      return questionValueHasContent(question, primaryValue)
        ? ''
        : 'This question is required.'
  }
}

export function validateSurveyPage(page, answers) {
  const errors = {}
  let shouldStopValidation = false

  for (const question of page.questions) {
    if (['section_heading', 'instructional_text'].includes(question.question_type)) {
      continue
    }

    if (shouldStopValidation) {
      continue
    }

    const errorMessage = getQuestionValidationError(question, answers[question.id])
    if (errorMessage) {
      errors[question.id] = errorMessage
      continue
    }

    const matchedRule = getMatchedSkipRule(question, answers[question.id])
    if (matchedRule && matchedRule.action !== 'continue') {
      shouldStopValidation = true
    }
  }

  return errors
}
