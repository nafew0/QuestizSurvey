export const OPEN_ENDED_OTHER_KEY = '__other__'

export const USER_INPUT_VALIDATION_OPTIONS = [
  {
    value: 'email',
    label: 'Email',
    description: 'Requires a valid email address.',
  },
  {
    value: 'phone',
    label: 'Phone',
    description: 'Requires a valid phone number.',
  },
  {
    value: 'text_only',
    label: 'Texts only',
    description: 'Allows letters, spaces, and common punctuation.',
  },
  {
    value: 'numbers_only',
    label: 'Numbers only',
    description: 'Allows numeric values with an optional range.',
  },
  {
    value: 'url',
    label: 'URL',
    description: 'Requires a valid website link.',
  },
  {
    value: 'alphanumeric',
    label: 'Alphanumeric',
    description: 'Allows letters and numbers only.',
  },
]

const VALIDATION_TYPE_SET = new Set(
  USER_INPUT_VALIDATION_OPTIONS.map((option) => option.value)
)

export function normalizeInputValidationRule(rule = {}) {
  return {
    enabled: Boolean(rule?.enabled),
    type: VALIDATION_TYPE_SET.has(rule?.type) ? rule.type : '',
    char_limit:
      rule?.char_limit == null || rule?.char_limit === '' ? '' : `${rule.char_limit}`,
    min_number:
      rule?.min_number == null || rule?.min_number === '' ? '' : `${rule.min_number}`,
    max_number:
      rule?.max_number == null || rule?.max_number === '' ? '' : `${rule.max_number}`,
  }
}

function hasContent(value) {
  return `${value ?? ''}`.trim().length > 0
}

function isValidPhoneNumber(value) {
  const trimmedValue = `${value || ''}`.trim()
  if (!/^\+?[\d\s().-]+$/.test(trimmedValue)) {
    return false
  }

  const digitsOnly = trimmedValue.replace(/\D/g, '')
  return digitsOnly.length >= 7 && digitsOnly.length <= 15
}

function isValidTextOnlyValue(value) {
  return /^[\p{L}\s'.,-]+$/u.test(`${value || ''}`.trim())
}

function isValidAlphanumericValue(value) {
  return /^[\p{L}\p{N}\s'.,-]+$/u.test(`${value || ''}`.trim())
}

function isNumericValue(value) {
  return /^-?\d+(\.\d+)?$/.test(`${value || ''}`.trim())
}

function isValidUrl(value) {
  try {
    const parsedUrl = new URL(`${value || ''}`.trim())
    return ['http:', 'https:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

export function validateInputValue(value, rule) {
  const normalizedRule = normalizeInputValidationRule(rule)
  const trimmedValue = `${value || ''}`.trim()

  if (!normalizedRule.enabled || !normalizedRule.type || !hasContent(trimmedValue)) {
    return ''
  }

  switch (normalizedRule.type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
        ? ''
        : 'Enter a valid email address.'
    case 'phone':
      return isValidPhoneNumber(trimmedValue)
        ? ''
        : 'Enter a valid phone number.'
    case 'text_only': {
      if (!isValidTextOnlyValue(trimmedValue)) {
        return 'Use letters and text characters only.'
      }

      const charLimit = Number(normalizedRule.char_limit || 0)
      if (charLimit > 0 && trimmedValue.length > charLimit) {
        return `Use no more than ${charLimit} characters.`
      }

      return ''
    }
    case 'numbers_only': {
      if (!isNumericValue(trimmedValue)) {
        return 'Enter numbers only.'
      }

      const numericValue = Number(trimmedValue)
      const minNumber = normalizedRule.min_number === '' ? null : Number(normalizedRule.min_number)
      const maxNumber = normalizedRule.max_number === '' ? null : Number(normalizedRule.max_number)

      if (minNumber != null && !Number.isNaN(minNumber) && numericValue < minNumber) {
        return `Enter a value greater than or equal to ${minNumber}.`
      }

      if (maxNumber != null && !Number.isNaN(maxNumber) && numericValue > maxNumber) {
        return `Enter a value less than or equal to ${maxNumber}.`
      }

      return ''
    }
    case 'url':
      return isValidUrl(trimmedValue) ? '' : 'Enter a valid URL.'
    case 'alphanumeric':
      return isValidAlphanumericValue(trimmedValue)
        ? ''
        : 'Use letters and numbers only.'
    default:
      return ''
  }
}

export function getInputValidationInputProps(rule) {
  const normalizedRule = normalizeInputValidationRule(rule)

  if (!normalizedRule.enabled || !normalizedRule.type) {
    return {}
  }

  const charLimit = Number(normalizedRule.char_limit || 0)
  const baseProps = {
    maxLength: charLimit > 0 && normalizedRule.type === 'text_only' ? charLimit : undefined,
  }

  switch (normalizedRule.type) {
    case 'email':
      return {
        ...baseProps,
        type: 'email',
        inputMode: 'email',
        autoComplete: 'email',
      }
    case 'phone':
      return {
        ...baseProps,
        type: 'tel',
        inputMode: 'tel',
        autoComplete: 'tel',
      }
    case 'numbers_only':
      return {
        ...baseProps,
        type: 'text',
        inputMode: 'decimal',
      }
    case 'url':
      return {
        ...baseProps,
        type: 'url',
        inputMode: 'url',
        autoComplete: 'url',
      }
    default:
      return {
        ...baseProps,
        type: 'text',
      }
  }
}
