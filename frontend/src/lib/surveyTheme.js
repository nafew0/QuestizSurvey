const WHITE_RGB = { r: 255, g: 255, b: 255 }
const DEFAULT_INK_RGB = { r: 15, g: 23, b: 42 }

export const SURVEY_FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', family: '"Inter"' },
  { value: 'Roboto', label: 'Roboto', family: '"Roboto"' },
  { value: 'Open Sans', label: 'Open Sans', family: '"Open Sans"' },
  { value: 'Lato', label: 'Lato', family: '"Lato"' },
  { value: 'Merriweather', label: 'Merriweather', family: '"Merriweather"' },
]

export const SURVEY_BUTTON_STYLE_OPTIONS = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' },
  { value: 'pill', label: 'Pill' },
]

export const SURVEY_LOGO_POSITION_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

export const SURVEY_SPACING_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Balanced' },
  { value: 'spacious', label: 'Spacious' },
]

export const DEFAULT_SURVEY_THEME = {
  primary_color: '#f79945',
  background_color: '#ffffff',
  text_color: '#5b2d62',
  font_family: 'Inter',
  button_style: 'rounded',
  progress_bar_color: '#f79945',
  logo_url: '',
  logo_position: 'left',
  background_image_url: '',
  background_image_opacity: 0.18,
  question_spacing: 'comfortable',
}

export const SURVEY_THEME_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    description: 'Questiz brand colors on a clean white canvas.',
    theme: DEFAULT_SURVEY_THEME,
  },
  {
    id: 'corporate',
    name: 'Corporate',
    description: 'Blue-gray clarity for leadership and customer feedback.',
    theme: {
      ...DEFAULT_SURVEY_THEME,
      primary_color: '#1d4ed8',
      background_color: '#f8fbff',
      text_color: '#10233d',
      font_family: 'Inter',
      button_style: 'rounded',
      progress_bar_color: '#1d4ed8',
    },
  },
  {
    id: 'sea-green',
    name: 'Sea Green',
    description: 'Soft sea-green accents with a clean canvas.',
    theme: {
      ...DEFAULT_SURVEY_THEME,
      primary_color: '#0f766e',
      background_color: '#f6fffc',
      text_color: '#134e4a',
      font_family: 'Open Sans',
      button_style: 'rounded',
      progress_bar_color: '#0f766e',
      question_spacing: 'comfortable',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    description: 'Friendly amber tones for community and experience research.',
    theme: {
      ...DEFAULT_SURVEY_THEME,
      primary_color: '#f97316',
      background_color: '#fff8f1',
      text_color: '#4b2a14',
      font_family: 'Lato',
      button_style: 'pill',
      progress_bar_color: '#ea580c',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Night-mode presentation for brand-heavy launches.',
    theme: {
      ...DEFAULT_SURVEY_THEME,
      primary_color: '#38bdf8',
      background_color: '#0f172a',
      text_color: '#e2e8f0',
      font_family: 'Roboto',
      button_style: 'rounded',
      progress_bar_color: '#38bdf8',
    },
  },
  {
    id: 'playful',
    name: 'Playful',
    description: 'Bright, energetic styling for internal pulses and events.',
    theme: {
      ...DEFAULT_SURVEY_THEME,
      primary_color: '#ec4899',
      background_color: '#fff7fb',
      text_color: '#3b1130',
      font_family: 'Merriweather',
      button_style: 'pill',
      progress_bar_color: '#8b5cf6',
      question_spacing: 'spacious',
    },
  },
]

const FONT_FAMILY_LOOKUP = Object.fromEntries(
  SURVEY_FONT_OPTIONS.map((option) => [option.value, option.family])
)

const BUTTON_RADIUS_MAP = {
  rounded: '0.85rem',
  square: '0.45rem',
  pill: '1.05rem',
}

const CARD_RADIUS_MAP = {
  rounded: '0.98rem',
  square: '0.58rem',
  pill: '1.12rem',
}

const SPACING_GAP_MAP = {
  compact: '0.95rem',
  comfortable: '1.35rem',
  spacious: '1.9rem',
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeOpacity(value, fallback = DEFAULT_SURVEY_THEME.background_image_opacity) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) {
    return fallback
  }
  return Math.round(clamp(numeric, 0, 1) * 100) / 100
}

export function normalizeHex(value, fallback = DEFAULT_SURVEY_THEME.primary_color) {
  if (!value) {
    return fallback
  }

  const trimmed = `${value}`.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`

  if (/^#[0-9a-f]{3}$/i.test(withHash)) {
    return `#${withHash
      .slice(1)
      .split('')
      .map((part) => `${part}${part}`)
      .join('')
      .toLowerCase()}`
  }

  if (/^#[0-9a-f]{6}$/i.test(withHash)) {
    return withHash.toLowerCase()
  }

  return fallback
}

function hexToRgb(value) {
  const hex = normalizeHex(value)
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToCssValue({ r, g, b }) {
  return `${r} ${g} ${b}`
}

function mixRgb(base, mixWith, mixWeight) {
  return {
    r: Math.round(base.r * (1 - mixWeight) + mixWith.r * mixWeight),
    g: Math.round(base.g * (1 - mixWeight) + mixWith.g * mixWeight),
    b: Math.round(base.b * (1 - mixWeight) + mixWith.b * mixWeight),
  }
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min

  let hue = 0

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6
    } else if (max === green) {
      hue = (blue - red) / delta + 2
    } else {
      hue = (red - green) / delta + 4
    }
  }

  hue = Math.round(hue * 60)
  if (hue < 0) {
    hue += 360
  }

  const lightness = (max + min) / 2
  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))

  return {
    h: clamp(hue, 0, 360),
    s: clamp(Number((saturation * 100).toFixed(1)), 0, 100),
    l: clamp(Number((lightness * 100).toFixed(1)), 0, 100),
  }
}

function hslToCssValue(rgb) {
  const { h, s, l } = rgbToHsl(rgb)
  return `${h} ${s}% ${l}%`
}

function getRelativeLuminance({ r, g, b }) {
  const channel = [r, g, b].map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return channel[0] * 0.2126 + channel[1] * 0.7152 + channel[2] * 0.0722
}

function getReadableForeground(background) {
  return getRelativeLuminance(background) > 0.43 ? DEFAULT_INK_RGB : WHITE_RGB
}

function getFontFamily(fontFamily) {
  return FONT_FAMILY_LOOKUP[fontFamily] || FONT_FAMILY_LOOKUP[DEFAULT_SURVEY_THEME.font_family]
}

function escapeCssUrl(url) {
  return `${url}`.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function normalizeSurveyTheme(theme = {}, fallbackColors = {}) {
  const rawTheme = theme || {}
  const primaryColor = normalizeHex(
    rawTheme.primary_color || rawTheme.primary || fallbackColors.primary,
    DEFAULT_SURVEY_THEME.primary_color
  )

  return {
    primary_color: primaryColor,
    background_color: normalizeHex(
      rawTheme.background_color,
      DEFAULT_SURVEY_THEME.background_color
    ),
    text_color: normalizeHex(
      rawTheme.text_color || rawTheme.accent || fallbackColors.accent,
      DEFAULT_SURVEY_THEME.text_color
    ),
    font_family: SURVEY_FONT_OPTIONS.some((option) => option.value === rawTheme.font_family)
      ? rawTheme.font_family
      : DEFAULT_SURVEY_THEME.font_family,
    button_style: SURVEY_BUTTON_STYLE_OPTIONS.some((option) => option.value === rawTheme.button_style)
      ? rawTheme.button_style
      : DEFAULT_SURVEY_THEME.button_style,
    progress_bar_color: normalizeHex(
      rawTheme.progress_bar_color || primaryColor,
      primaryColor
    ),
    logo_url: `${rawTheme.logo_url || ''}`.trim(),
    logo_position: SURVEY_LOGO_POSITION_OPTIONS.some((option) => option.value === rawTheme.logo_position)
      ? rawTheme.logo_position
      : DEFAULT_SURVEY_THEME.logo_position,
    background_image_url: `${rawTheme.background_image_url || ''}`.trim(),
    background_image_opacity: normalizeOpacity(rawTheme.background_image_opacity),
    question_spacing: SURVEY_SPACING_OPTIONS.some((option) => option.value === rawTheme.question_spacing)
      ? rawTheme.question_spacing
      : DEFAULT_SURVEY_THEME.question_spacing,
  }
}

export function createInitialSurveyTheme(colors = {}) {
  return normalizeSurveyTheme({
    primary_color: colors.primary || colors.primary_color,
    text_color: colors.accent || colors.text_color,
    background_color: colors.background_color || DEFAULT_SURVEY_THEME.background_color,
    progress_bar_color: colors.primary || colors.primary_color,
  })
}

export function buildSurveyThemeCss(themeInput, selector = '.survey-theme-root') {
  const theme = normalizeSurveyTheme(themeInput)
  const primary = hexToRgb(theme.primary_color)
  const background = hexToRgb(theme.background_color)
  const text = hexToRgb(theme.text_color)
  const progress = hexToRgb(theme.progress_bar_color)

  const panel = mixRgb(primary, background, 0.92)
  const card = mixRgb(text, background, 0.95)
  const cardSoft = mixRgb(primary, background, 0.86)
  const border = mixRgb(text, background, 0.8)
  const input = mixRgb(primary, background, 0.95)
  const muted = mixRgb(text, background, 0.96)
  const mutedForeground = mixRgb(text, background, 0.4)
  const primarySoft = mixRgb(primary, background, 0.82)
  const heroEnd = mixRgb(text, background, 0.94)
  const shadow = mixRgb(text, background, 0.38)
  const primaryForeground = getReadableForeground(primary)
  const buttonRadius = BUTTON_RADIUS_MAP[theme.button_style] || BUTTON_RADIUS_MAP.rounded
  const cardRadius = CARD_RADIUS_MAP[theme.button_style] || CARD_RADIUS_MAP.rounded
  const questionGap = SPACING_GAP_MAP[theme.question_spacing] || SPACING_GAP_MAP.comfortable
  const logoJustify =
    theme.logo_position === 'center'
      ? 'center'
      : theme.logo_position === 'right'
        ? 'flex-end'
        : 'flex-start'

  const backgroundRule = theme.background_image_url
    ? `
${selector} {
  background-image:
    linear-gradient(
      rgba(${background.r}, ${background.g}, ${background.b}, ${1 - theme.background_image_opacity}),
      rgba(${background.r}, ${background.g}, ${background.b}, ${1 - theme.background_image_opacity})
    ),
    url("${escapeCssUrl(theme.background_image_url)}");
  background-size: cover;
  background-position: center;
}`
    : `
${selector} {
  background-image:
    radial-gradient(circle at 14% 118%, rgb(${rgbToCssValue(primarySoft)} / 0.66), transparent 28%),
    radial-gradient(circle at 84% 122%, rgb(${rgbToCssValue(panel)} / 0.76), transparent 34%),
    linear-gradient(180deg, rgb(${rgbToCssValue(background)}) 0%, rgb(${rgbToCssValue(background)}) 58%, rgb(${rgbToCssValue(heroEnd)} / 0.62) 100%);
}`

  return `
${selector} {
  --survey-primary-rgb: ${rgbToCssValue(primary)};
  --survey-background-rgb: ${rgbToCssValue(background)};
  --survey-text-rgb: ${rgbToCssValue(text)};
  --survey-panel-rgb: ${rgbToCssValue(panel)};
  --survey-card-rgb: ${rgbToCssValue(card)};
  --survey-card-soft-rgb: ${rgbToCssValue(cardSoft)};
  --survey-border-rgb: ${rgbToCssValue(border)};
  --survey-input-rgb: ${rgbToCssValue(input)};
  --survey-muted-rgb: ${rgbToCssValue(muted)};
  --survey-muted-foreground-rgb: ${rgbToCssValue(mutedForeground)};
  --survey-primary-soft-rgb: ${rgbToCssValue(primarySoft)};
  --survey-progress-rgb: ${rgbToCssValue(progress)};
  --survey-shadow-rgb: ${rgbToCssValue(shadow)};
  --survey-button-radius: ${buttonRadius};
  --survey-card-radius: ${cardRadius};
  --survey-question-gap: ${questionGap};
  --survey-font-family: ${getFontFamily(theme.font_family)}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --background: ${hslToCssValue(background)};
  --foreground: ${hslToCssValue(text)};
  --card: ${hslToCssValue(card)};
  --card-foreground: ${hslToCssValue(text)};
  --popover: ${hslToCssValue(card)};
  --popover-foreground: ${hslToCssValue(text)};
  --primary: ${hslToCssValue(primary)};
  --primary-foreground: ${hslToCssValue(primaryForeground)};
  --secondary: ${hslToCssValue(panel)};
  --secondary-foreground: ${hslToCssValue(text)};
  --muted: ${hslToCssValue(muted)};
  --muted-foreground: ${hslToCssValue(mutedForeground)};
  --accent: ${hslToCssValue(primarySoft)};
  --accent-foreground: ${hslToCssValue(text)};
  --border: ${hslToCssValue(border)};
  --input: ${hslToCssValue(input)};
  --ring: ${hslToCssValue(progress)};
}

${selector} .survey-theme-logo-row {
  justify-content: ${logoJustify};
}
${backgroundRule}
`
}
