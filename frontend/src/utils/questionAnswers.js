const CHOICE_QUESTION_TYPES = new Set([
  'multiple_choice_single',
  'multiple_choice_multi',
  'dropdown',
  'yes_no',
])

export const SYNTHETIC_OTHER_CHOICE_ID = '__questiz_other__'

export function isEnhancedAnswerValue(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.prototype.hasOwnProperty.call(value, 'value') &&
      (Object.prototype.hasOwnProperty.call(value, 'other_text') ||
        Object.prototype.hasOwnProperty.call(value, 'comment_text'))
  )
}

export function createEnhancedAnswerValue(primaryValue, overrides = {}) {
  return {
    value: primaryValue,
    other_text: '',
    comment_text: '',
    ...overrides,
  }
}

export function normalizeEnhancedAnswerValue(value) {
  if (isEnhancedAnswerValue(value)) {
    return {
      value: value.value,
      other_text: value.other_text || '',
      comment_text: value.comment_text || '',
    }
  }

  return createEnhancedAnswerValue(value)
}

export function getAnswerPrimaryValue(value) {
  return isEnhancedAnswerValue(value) ? value.value : value
}

export function getAnswerOtherText(value) {
  return isEnhancedAnswerValue(value) ? value.other_text || '' : ''
}

export function getAnswerCommentText(value) {
  return isEnhancedAnswerValue(value) ? value.comment_text || '' : ''
}

export function updateAnswerPrimaryValue(currentValue, nextPrimaryValue) {
  const current = normalizeEnhancedAnswerValue(currentValue)
  return {
    ...current,
    value: nextPrimaryValue,
  }
}

export function updateAnswerOtherText(currentValue, nextOtherText) {
  const current = normalizeEnhancedAnswerValue(currentValue)
  return {
    ...current,
    other_text: nextOtherText,
  }
}

export function updateAnswerCommentText(currentValue, nextCommentText) {
  const current = normalizeEnhancedAnswerValue(currentValue)
  return {
    ...current,
    comment_text: nextCommentText,
  }
}

export function questionSupportsOther(question) {
  return (
    CHOICE_QUESTION_TYPES.has(question?.question_type) &&
    Boolean(question?.settings?.allow_other)
  )
}

export function questionSupportsComment(question) {
  return Boolean(question?.settings?.allow_comment)
}

export function getOtherChoiceIds(question) {
  return (question?.choices ?? [])
    .filter((choice) => choice.is_other)
    .map((choice) => choice.id)
}

function getAllOtherChoiceIds(question) {
  return [...getOtherChoiceIds(question), SYNTHETIC_OTHER_CHOICE_ID]
}

export function getQuestionChoicesForResponse(question) {
  if (!questionSupportsOther(question)) {
    return question?.choices ?? []
  }

  const existingChoices = question?.choices ?? []
  if (existingChoices.some((choice) => choice.is_other)) {
    return existingChoices
  }

  return [
    ...existingChoices,
    {
      id: SYNTHETIC_OTHER_CHOICE_ID,
      text: 'Other',
      is_other: true,
      order: existingChoices.length + 1,
    },
  ]
}

export function isOtherChoiceSelected(question, answerValue) {
  if (!questionSupportsOther(question)) {
    return false
  }

  const primaryValue = getAnswerPrimaryValue(answerValue)
  const otherChoiceIds = new Set(getAllOtherChoiceIds(question))

  if (Array.isArray(primaryValue)) {
    return primaryValue.some((choiceId) => otherChoiceIds.has(choiceId))
  }

  return otherChoiceIds.has(primaryValue)
}

export function shouldShowOtherInput(question, answerValue) {
  return (
    questionSupportsOther(question) &&
    (isOtherChoiceSelected(question, answerValue) ||
      getAnswerOtherText(answerValue).trim().length > 0)
  )
}

export function stripOtherSelections(question, primaryValue) {
  if (!questionSupportsOther(question)) {
    return primaryValue
  }

  const otherChoiceIds = new Set(getAllOtherChoiceIds(question))

  if (Array.isArray(primaryValue)) {
    return primaryValue.filter((choiceId) => !otherChoiceIds.has(choiceId))
  }

  return otherChoiceIds.has(primaryValue) ? '' : primaryValue
}

export function buildRestoredAnswerValue(question, primaryValue, answer = {}) {
  let nextPrimaryValue = primaryValue
  const otherText = answer.other_text || ''

  if (
    questionSupportsOther(question) &&
    otherText.trim() &&
    !isOtherChoiceSelected(question, createEnhancedAnswerValue(primaryValue, { other_text: otherText }))
  ) {
    if (Array.isArray(nextPrimaryValue)) {
      nextPrimaryValue = [...nextPrimaryValue, SYNTHETIC_OTHER_CHOICE_ID]
    } else if (!nextPrimaryValue) {
      nextPrimaryValue = SYNTHETIC_OTHER_CHOICE_ID
    }
  }

  return createEnhancedAnswerValue(nextPrimaryValue, {
    other_text: otherText,
    comment_text: answer.comment_text || '',
  })
}
