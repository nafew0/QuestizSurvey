export const RICH_TEXT_COLOR_PALETTE = [
  { label: 'Slate', value: '#0f172a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#059669' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Purple', value: '#7c3aed' },
]

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'span'])
const BLOCK_TAGS = new Set(['p', 'ul', 'ol'])
const ALIGNABLE_TAGS = new Set(['p', 'ul', 'ol', 'li'])
const COLORABLE_TAGS = new Set(['span'])
const ALLOWED_COLORS = new Set(RICH_TEXT_COLOR_PALETTE.map((item) => item.value))
const ALLOWED_ALIGNMENTS = new Set(['left', 'center', 'right'])

function canUseDom() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof DOMParser !== 'undefined'
  )
}

function escapeHtml(value) {
  return `${value ?? ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeColorValue(value) {
  const candidate = `${value ?? ''}`.trim().toLowerCase()
  if (ALLOWED_COLORS.has(candidate)) {
    return candidate
  }

  const rgbMatch = candidate.match(
    /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/
  )
  if (!rgbMatch) {
    return null
  }

  const channels = rgbMatch.slice(1).map((part) => Math.max(0, Math.min(255, Number(part))))
  const normalized = `#${channels.map((part) => part.toString(16).padStart(2, '0')).join('')}`
  return ALLOWED_COLORS.has(normalized) ? normalized : null
}

function sanitizeElementStyles(element) {
  const tagName = element.tagName.toLowerCase()
  const declarations = []

  if (ALIGNABLE_TAGS.has(tagName)) {
    const textAlign = `${element.style.textAlign || ''}`.trim().toLowerCase()
    if (ALLOWED_ALIGNMENTS.has(textAlign)) {
      declarations.push(`text-align: ${textAlign}`)
    }
  }

  if (COLORABLE_TAGS.has(tagName)) {
    const color = normalizeColorValue(element.style.color)
    if (color) {
      declarations.push(`color: ${color}`)
    }
  }

  if (declarations.length > 0) {
    element.setAttribute('style', declarations.join('; '))
  } else {
    element.removeAttribute('style')
  }
}

function replaceElementTag(element, nextTagName) {
  const replacement = document.createElement(nextTagName)

  Array.from(element.attributes).forEach((attribute) => {
    replacement.setAttribute(attribute.name, attribute.value)
  })

  while (element.firstChild) {
    replacement.appendChild(element.firstChild)
  }

  element.parentNode?.replaceChild(replacement, element)
  return replacement
}

function unwrapElement(element) {
  const parent = element.parentNode
  if (!parent) {
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }
  parent.removeChild(element)
}

function wrapRootInlineContent(container) {
  let paragraph = null

  Array.from(container.childNodes).forEach((node) => {
    const isBlockElement =
      node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(node.tagName.toLowerCase())

    if (isBlockElement) {
      paragraph = null
      return
    }

    const isMeaningfulText = node.nodeType !== Node.TEXT_NODE || `${node.textContent ?? ''}`.trim()
    if (!isMeaningfulText && !paragraph) {
      container.removeChild(node)
      return
    }

    if (!paragraph) {
      paragraph = document.createElement('p')
      container.insertBefore(paragraph, node)
    }

    paragraph.appendChild(node)
  })
}

function normalizeRichTextDom(container) {
  const elements = Array.from(container.querySelectorAll('*'))

  elements.forEach((node) => {
    if (!node.parentNode) {
      return
    }

    const tagName = node.tagName.toLowerCase()
    let element = node

    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'meta', 'link'].includes(tagName)) {
      node.remove()
      return
    }

    if (tagName === 'b') {
      element = replaceElementTag(node, 'strong')
    } else if (tagName === 'i') {
      element = replaceElementTag(node, 'em')
    } else if (tagName === 'font') {
      const nextColor = normalizeColorValue(node.getAttribute('color'))
      element = replaceElementTag(node, 'span')
      if (nextColor) {
        element.style.color = nextColor
      }
    } else if (tagName === 'div') {
      element = replaceElementTag(node, 'p')
    } else if (!ALLOWED_TAGS.has(tagName)) {
      unwrapElement(node)
      return
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name !== 'style') {
        element.removeAttribute(attribute.name)
      }
    })
    sanitizeElementStyles(element)
  })

  wrapRootInlineContent(container)
}

export function richTextHtmlToPlainText(value) {
  const rawHtml = `${value ?? ''}`.trim()
  if (!rawHtml) {
    return ''
  }

  if (!canUseDom()) {
    return rawHtml.replace(/<[^>]+>/g, '').trim()
  }

  const documentParser = new DOMParser()
  const parsedDocument = documentParser.parseFromString(`<div>${rawHtml}</div>`, 'text/html')
  const container = parsedDocument.body.firstElementChild || parsedDocument.body
  const parts = []

  const append = (nextValue) => {
    if (nextValue) {
      parts.push(nextValue)
    }
  }

  const appendBreak = (count = 1) => {
    if (!parts.length) {
      return
    }

    let trailingBreaks = 0
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (parts[index] !== '\n') {
        break
      }
      trailingBreaks += 1
    }

    for (let index = trailingBreaks; index < count; index += 1) {
      parts.push('\n')
    }
  }

  const walk = (node, listContext = null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      append(node.textContent)
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return
    }

    const tagName = node.tagName.toLowerCase()
    if (tagName === 'br') {
      append('\n')
      return
    }

    if (tagName === 'ul' || tagName === 'ol') {
      Array.from(node.childNodes).forEach((childNode, index) =>
        walk(childNode, { listType: tagName, index })
      )
      appendBreak(1)
      return
    }

    if (tagName === 'li') {
      const prefix =
        listContext?.listType === 'ol' ? `${(listContext.index ?? 0) + 1}. ` : '• '
      append(prefix)
      Array.from(node.childNodes).forEach((childNode) => walk(childNode, null))
      append('\n')
      return
    }

    Array.from(node.childNodes).forEach((childNode) => walk(childNode, null))

    if (tagName === 'p') {
      appendBreak(2)
    }
  }

  Array.from(container.childNodes).forEach((node) => walk(node, null))

  return parts
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function plainTextToRichTextHtml(value) {
  const normalized = `${value ?? ''}`.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return ''
  }

  return normalized
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('')
}

export function sanitizeRichTextHtml(value) {
  const rawHtml = `${value ?? ''}`.trim()
  if (!rawHtml) {
    return ''
  }

  if (!canUseDom()) {
    return plainTextToRichTextHtml(rawHtml.replace(/<[^>]+>/g, ' '))
  }

  const container = document.createElement('div')
  container.innerHTML = rawHtml
  normalizeRichTextDom(container)

  const normalizedHtml = container.innerHTML.trim()
  return richTextHtmlToPlainText(normalizedHtml) ? normalizedHtml : ''
}

export function resolveRichTextEditorHtml(html, plainText = '') {
  const normalizedHtml = sanitizeRichTextHtml(html)
  if (normalizedHtml) {
    return normalizedHtml
  }

  return plainTextToRichTextHtml(plainText)
}

export function getQuestionTextHtml(question) {
  return question?.settings?.rich_text?.text_html ?? ''
}

function mergeQuestionRichTextSettings(settings, textHtml) {
  const nextSettings = {
    ...(settings ?? {}),
  }
  const nextRichText = {
    ...(nextSettings.rich_text ?? {}),
  }

  if (textHtml) {
    nextRichText.text_html = textHtml
  } else {
    delete nextRichText.text_html
  }

  if (Object.keys(nextRichText).length > 0) {
    nextSettings.rich_text = nextRichText
  } else {
    delete nextSettings.rich_text
  }

  return nextSettings
}

export function buildQuestionRichTextUpdate(question, nextHtml) {
  const textHtml = sanitizeRichTextHtml(nextHtml)
  return {
    text: richTextHtmlToPlainText(textHtml),
    settings: mergeQuestionRichTextSettings(question?.settings, textHtml),
  }
}

export function buildMessageDescriptionRichTextValue(messageConfig, nextHtml) {
  const textHtml = sanitizeRichTextHtml(nextHtml)
  const nextConfig = {
    ...(messageConfig ?? {}),
    desc: richTextHtmlToPlainText(textHtml),
  }

  if (textHtml) {
    nextConfig.desc_html = textHtml
  } else {
    delete nextConfig.desc_html
  }

  return nextConfig
}
