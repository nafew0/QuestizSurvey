export function formatDateTime(value, options = {}) {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  })
}

export function formatMoney(amount, currency = 'USD') {
  const numeric = Number(amount || 0)
  if (!Number.isFinite(numeric)) {
    return '0'
  }

  if (currency === 'BDT') {
    return `৳${numeric.toFixed(2)}`
  }

  return `$${numeric.toFixed(2)}`
}

export function titleize(value) {
  return String(value || '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ')
}
