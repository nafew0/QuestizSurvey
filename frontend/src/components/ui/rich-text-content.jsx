import { useMemo } from 'react'

import { cn } from '@/lib/utils'
import { sanitizeRichTextHtml } from '@/utils/richText'

export default function RichTextContent({
  html = '',
  plainText = '',
  className = '',
}) {
  const sanitizedHtml = useMemo(() => sanitizeRichTextHtml(html), [html])

  if (sanitizedHtml) {
    return (
      <div
        className={cn('rich-text-content break-words', className)}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    )
  }

  if (!plainText) {
    return null
  }

  return (
    <div className={cn('rich-text-content whitespace-pre-wrap break-words', className)}>
      {plainText}
    </div>
  )
}
