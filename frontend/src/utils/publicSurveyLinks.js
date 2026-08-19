export const RESERVED_SURVEY_SLUGS = new Set([
  'admin',
  'api',
  'assets',
  'audio',
  'branding',
  'dashboard',
  'forgot-password',
  'login',
  'media',
  'payment',
  'pricing',
  'profile',
  'register',
  'reports',
  'reset-password',
  's',
  'static',
  'surveys',
  'verify-email',
  'ws',
])

const SURVEY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeSurveySlug(value) {
  return `${value ?? ''}`.trim().toLowerCase()
}

export function getSurveySlugValidationError(value) {
  const slug = normalizeSurveySlug(value)

  if (slug.length < 2) {
    return 'Use at least 2 characters.'
  }
  if (slug.length > 32) {
    return 'Use no more than 32 characters.'
  }
  if (!SURVEY_SLUG_PATTERN.test(slug)) {
    return 'Use only letters, numbers, and single hyphens. Start and end with a letter or number.'
  }
  if (RESERVED_SURVEY_SLUGS.has(slug)) {
    return 'That share link is reserved. Choose a different one.'
  }

  return ''
}

export function isReservedSurveySlug(value) {
  return RESERVED_SURVEY_SLUGS.has(normalizeSurveySlug(value))
}

export function buildPublicSurveyPath(slug) {
  return `/${normalizeSurveySlug(slug)}`
}

export function getPublicSurveyOrigin() {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_SURVEY_URL?.trim()
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, '')
  }

  return globalThis.location?.origin?.replace(/\/+$/, '') || ''
}

export function buildPublicSurveyUrl(slug) {
  return `${getPublicSurveyOrigin()}${buildPublicSurveyPath(slug)}`
}
