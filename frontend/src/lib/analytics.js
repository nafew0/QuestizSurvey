import { QUESTION_TYPE_META } from '@/constants/surveyBuilder'

export const ANALYTICS_COLOR_SCHEMES = {
  default: {
    label: 'Default Blue',
    colors: [
      'rgb(var(--theme-primary-rgb))',
      'rgb(var(--theme-secondary-rgb))',
      'rgb(var(--theme-accent-rgb))',
      'rgb(var(--theme-primary-strong-rgb))',
      'rgb(var(--theme-secondary-strong-rgb))',
    ],
  },
  warm: {
    label: 'Warm',
    colors: ['#f97316', '#fb923c', '#f59e0b', '#ef4444', '#fda4af'],
  },
  cool: {
    label: 'Cool',
    colors: ['#0f766e', '#14b8a6', '#2563eb', '#38bdf8', '#6366f1'],
  },
  monochrome: {
    label: 'Monochrome',
    colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'],
  },
  pastel: {
    label: 'Pastel',
    colors: ['#7dd3fc', '#86efac', '#fdba74', '#f9a8d4', '#c4b5fd'],
  },
  vibrant: {
    label: 'Vibrant',
    colors: ['#2563eb', '#7c3aed', '#f43f5e', '#f97316', '#22c55e'],
  },
}

export function getAnalyticsColors(scheme = 'default') {
  return ANALYTICS_COLOR_SCHEMES[scheme]?.colors || ANALYTICS_COLOR_SCHEMES.default.colors
}

export function getQuestionTypeLabel(type) {
  return QUESTION_TYPE_META[type]?.label || type.replaceAll('_', ' ')
}

export function formatDuration(durationSeconds) {
  if (durationSeconds == null) {
    return 'N/A'
  }

  const minutes = Math.floor(durationSeconds / 60)
  const seconds = durationSeconds % 60
  if (!minutes) {
    return `${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

export function formatCompactNumber(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value ?? 0)
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`
}

export function buildSparklineData(summary) {
  const source = summary?.responses_over_time ?? []
  if (!source.length) {
    return []
  }

  return source.slice(-14).map((entry) => ({
    date: entry.date,
    count: entry.count,
  }))
}

export function computeResponsesToday(summary) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const lookup = Object.fromEntries(
    (summary?.responses_over_time ?? []).map((entry) => [entry.date, entry.count])
  )

  const todayCount = lookup[today] || 0
  const yesterdayCount = lookup[yesterdayDate] || 0
  return {
    todayCount,
    delta: todayCount - yesterdayCount,
  }
}

export function buildCategoricalTableRows(analytics) {
  return (analytics?.choices ?? []).map((choice) => ({
    label: choice.text,
    count: choice.count,
    percentage: choice.percentage,
  }))
}

export function buildNumericDistributionRows(analytics) {
  return (analytics?.distribution ?? []).map((item) => ({
    label: item.value,
    count: item.count,
    percentage: item.percentage,
  }))
}

export function buildTextFrequencyRows(analytics, minFrequency = 1, maxWords = 80) {
  return (analytics?.word_frequencies ?? [])
    .filter((item) => item.count >= minFrequency)
    .slice(0, maxWords)
    .map((item) => ({
      text: item.word,
      value: item.count,
    }))
}

export function buildMatrixHeatmapData(analytics) {
  return (analytics?.rows ?? []).map((row) => ({
    id: row.row_label,
    data: row.columns.map((column) => ({
      x: column.col_label,
      y: column.count,
      count: column.count,
      percentage: column.percentage,
    })),
  }))
}

export function buildResponseFilterChips(filters, questionLookup = {}, collectorLookup = {}) {
  const chips = []

  if (filters.date_from || filters.date_to) {
    chips.push({
      key: 'date',
      label: `Date: ${filters.date_from || 'Any'} → ${filters.date_to || 'Any'}`,
    })
  }

  if (filters.collector_id) {
    chips.push({
      key: 'collector_id',
      label: `Collector: ${collectorLookup[filters.collector_id] || 'Selected collector'}`,
    })
  }

  if (filters.status) {
    chips.push({
      key: 'status',
      label: `Status: ${filters.status.replaceAll('_', ' ')}`,
    })
  }

  if (filters.duration_min_seconds || filters.duration_max_seconds) {
    chips.push({
      key: 'duration',
      label: `Duration: ${filters.duration_min_seconds || 0}s - ${filters.duration_max_seconds || '∞'}s`,
    })
  }

  for (const [index, filter] of (filters.answer_filters ?? []).entries()) {
    chips.push({
      key: `answer-${index}`,
      label: `Answer: ${questionLookup[filter.question_id] || 'Question'} match`,
      answerIndex: index,
    })
  }

  if (filters.text_search) {
    chips.push({
      key: 'text_search',
      label: `Contains: ${filters.text_search}`,
    })
  }

  return chips
}

export function createDefaultReportConfig(filters = {}) {
  return {
    filters,
    question_ids: null,
    chart_overrides: {},
    card_preferences: {},
    cross_tabs: [],
    cross_tab: {
      row: '',
      col: '',
      view: 'table',
    },
    layout: 'summary',
    active_tab: 'overview',
  }
}

export function normalizeReportConfig(config = {}) {
  const next = {
    ...createDefaultReportConfig(),
    ...config,
  }

  if (
    (!next.chart_overrides || !Object.keys(next.chart_overrides).length) &&
    next.card_preferences &&
    Object.keys(next.card_preferences).length
  ) {
    next.chart_overrides = Object.fromEntries(
      Object.entries(next.card_preferences).map(([questionId, preference]) => [
        questionId,
        {
          chart_type: preference?.chartType || preference?.chart_type || null,
          color_scheme: preference?.colorScheme || preference?.color_scheme || 'default',
          show_table: preference?.showTable ?? preference?.show_table ?? false,
          show_labels: preference?.showLabels ?? preference?.show_labels ?? false,
        },
      ])
    )
  }

  if (
    (!next.card_preferences || !Object.keys(next.card_preferences).length) &&
    next.chart_overrides &&
    Object.keys(next.chart_overrides).length
  ) {
    next.card_preferences = Object.fromEntries(
      Object.entries(next.chart_overrides).map(([questionId, preference]) => [
        questionId,
        {
          chartType: preference?.chart_type || preference?.chartType || null,
          colorScheme: preference?.color_scheme || preference?.colorScheme || 'default',
          showTable: preference?.show_table ?? preference?.showTable ?? false,
          showLabels: preference?.show_labels ?? preference?.showLabels ?? false,
        },
      ])
    )
  }

  if ((!next.cross_tabs || !next.cross_tabs.length) && next.cross_tab?.row && next.cross_tab?.col) {
    next.cross_tabs = [
      {
        row_question_id: next.cross_tab.row,
        col_question_id: next.cross_tab.col,
        view: next.cross_tab.view || 'table',
      },
    ]
  }

  if ((!next.cross_tab || !next.cross_tab.row || !next.cross_tab.col) && next.cross_tabs?.length) {
    const first = next.cross_tabs[0]
    next.cross_tab = {
      row: first?.row_question_id || first?.row_q_id || first?.row || '',
      col: first?.col_question_id || first?.col_q_id || first?.col || '',
      view: first?.view || 'table',
    }
  }

  return next
}

export function buildReportSaveConfig({
  filters = {},
  cardPreferences = {},
  crossTabState = {},
  isResponsesTab = false,
  existingConfig = {},
}) {
  const normalizedCrossTab = {
    row: crossTabState.row || '',
    col: crossTabState.col || '',
    view: crossTabState.view || 'table',
  }
  const baseConfig = normalizeReportConfig(existingConfig)

  return normalizeReportConfig({
    ...baseConfig,
    filters,
    chart_overrides: Object.fromEntries(
      Object.entries(cardPreferences).map(([questionId, preference]) => [
        questionId,
        {
          chart_type: preference?.chartType || preference?.chart_type || null,
          color_scheme: preference?.colorScheme || preference?.color_scheme || 'default',
          show_table: preference?.showTable ?? preference?.show_table ?? false,
          show_labels: preference?.showLabels ?? preference?.show_labels ?? false,
        },
      ])
    ),
    card_preferences: cardPreferences,
    cross_tabs:
      normalizedCrossTab.row && normalizedCrossTab.col
        ? [
            {
              row_question_id: normalizedCrossTab.row,
              col_question_id: normalizedCrossTab.col,
              view: normalizedCrossTab.view,
            },
          ]
        : [],
    cross_tab: normalizedCrossTab,
    layout: baseConfig.layout || 'summary',
    active_tab: isResponsesTab ? 'responses' : 'overview',
  })
}
