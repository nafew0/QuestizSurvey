import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  plainTextToRichTextHtml,
  resolveRichTextEditorHtml,
  RICH_TEXT_COLOR_PALETTE,
  richTextHtmlToPlainText,
  sanitizeRichTextHtml,
} from '@/utils/richText'

const TOOLBAR_BUTTONS = [
  { command: 'bold', label: 'Bold', icon: Bold },
  { command: 'italic', label: 'Italic', icon: Italic },
  { command: 'underline', label: 'Underline', icon: Underline },
  { command: 'insertUnorderedList', label: 'Bulleted list', icon: List },
  { command: 'insertOrderedList', label: 'Numbered list', icon: ListOrdered },
  { command: 'justifyLeft', label: 'Align left', icon: AlignLeft },
  { command: 'justifyCenter', label: 'Align center', icon: AlignCenter },
  { command: 'justifyRight', label: 'Align right', icon: AlignRight },
]

export default function RichTextEditor({
  valueHtml = '',
  plainText = '',
  placeholder = '',
  onChange,
  className = '',
  editorClassName = '',
}) {
  const editorRef = useRef(null)
  const selectionRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)

  const resolvedHtml = useMemo(
    () => resolveRichTextEditorHtml(valueHtml, plainText),
    [plainText, valueHtml]
  )

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || isFocused) {
      return
    }

    if (editor.innerHTML !== resolvedHtml) {
      editor.innerHTML = resolvedHtml
    }
  }, [isFocused, resolvedHtml])

  const syncEditorHtml = useCallback((nextHtml) => {
    const editor = editorRef.current
    if (!editor || editor.innerHTML === nextHtml) {
      return
    }

    editor.innerHTML = nextHtml
  }, [])

  const saveSelection = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()

    if (
      !editor ||
      !selection ||
      selection.rangeCount === 0 ||
      !editor.contains(selection.anchorNode) ||
      !editor.contains(selection.focusNode)
    ) {
      return
    }

    selectionRef.current = selection.getRangeAt(0).cloneRange()
  }, [])

  const placeCaretAtEnd = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()

    if (!editor || !selection) {
      return
    }

    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    selectionRef.current = range.cloneRange()
  }, [])

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()

    if (!editor || !selection) {
      return
    }

    if (selectionRef.current) {
      try {
        selection.removeAllRanges()
        selection.addRange(selectionRef.current)
        return
      } catch {
        selectionRef.current = null
      }
    }

    placeCaretAtEnd()
  }, [placeCaretAtEnd])

  const emitChange = useCallback(
    (nextHtml, { normalizeEditor = false } = {}) => {
      const sanitizedHtml = sanitizeRichTextHtml(nextHtml)
      const nextText = richTextHtmlToPlainText(sanitizedHtml)

      if (normalizeEditor) {
        syncEditorHtml(sanitizedHtml)
      }

      onChange?.({
        html: sanitizedHtml,
        text: nextText,
      })
    },
    [onChange, syncEditorHtml]
  )

  const applyCommand = useCallback(
    (command, value = null) => {
      const editor = editorRef.current
      if (!editor) {
        return
      }

      editor.focus()
      restoreSelection()
      document.execCommand(command, false, value)
      saveSelection()
      emitChange(editor.innerHTML ?? '')
    },
    [emitChange, restoreSelection, saveSelection]
  )

  return (
    <div className={cn('theme-panel-soft overflow-hidden rounded-[1.5rem]', className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[rgb(var(--theme-border-rgb)/0.88)] bg-white px-2 py-2">
        {TOOLBAR_BUTTONS.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              applyCommand(command)
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-muted-foreground transition hover:border-[rgb(var(--theme-border-rgb)/0.88)] hover:bg-[rgb(var(--theme-neutral-rgb))] hover:text-foreground"
            aria-label={label}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}

        <div className="mx-1 h-6 w-px bg-[rgb(var(--theme-border-rgb)/0.95)]" />

        <div className="flex flex-wrap items-center gap-1">
          {RICH_TEXT_COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                applyCommand('foreColor', swatch.value)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 shadow-sm ring-1 ring-[rgb(var(--theme-border-rgb)/0.9)] transition hover:scale-105"
              style={{ backgroundColor: swatch.value }}
              aria-label={`Text color ${swatch.label}`}
              title={`Text color ${swatch.label}`}
            >
              <span className="sr-only">{swatch.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className={cn(
          'rich-text-editor-surface min-h-[8.5rem] px-4 py-3 text-sm text-foreground',
          editorClassName
        )}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          emitChange(editorRef.current?.innerHTML ?? '', { normalizeEditor: true })
          setIsFocused(false)
          selectionRef.current = null
        }}
        onInput={() => {
          saveSelection()
          emitChange(editorRef.current?.innerHTML ?? '')
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onPaste={(event) => {
          event.preventDefault()

          const pastedHtml = event.clipboardData.getData('text/html')
          const pastedText = event.clipboardData.getData('text/plain')
          const nextHtml =
            sanitizeRichTextHtml(pastedHtml) || plainTextToRichTextHtml(pastedText)

          editorRef.current?.focus()
          restoreSelection()
          document.execCommand('insertHTML', false, nextHtml)
          saveSelection()
          emitChange(editorRef.current?.innerHTML ?? '')
        }}
      />
    </div>
  )
}
