function renderInline(text, keyPrefix) {
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g
  const nodes = []
  let lastIndex = 0
  let match
  let partIndex = 0

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${partIndex}`}
          href={match[3]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-4"
        >
          {match[2]}
        </a>
      )
    } else if (match[4]) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${partIndex}`} className="font-semibold text-foreground">
          {match[4]}
        </strong>
      )
    } else if (match[5]) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${partIndex}`}
          className="rounded bg-[rgb(var(--theme-neutral-rgb))] px-1.5 py-0.5 font-mono text-[0.92em] text-foreground"
        >
          {match[5]}
        </code>
      )
    }

    lastIndex = match.index + match[0].length
    partIndex += 1
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length ? nodes : text
}

function isTableSeparator(line) {
  return /^[\s|:-]+$/.test(line)
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export default function SafeMarkdown({ content = '', className = '' }) {
  const normalized = `${content || ''}`.replace(/\r\n/g, '\n').trim()

  if (!normalized) {
    return null
  }

  const lines = normalized.split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const current = lines[index]

    if (!current.trim()) {
      index += 1
      continue
    }

    if (current.trim().startsWith('```')) {
      const codeLines = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) {
        index += 1
      }
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      continue
    }

    if (
      current.includes('|') &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1])
    ) {
      const header = parseTableRow(current)
      index += 2
      const rows = []

      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]))
        index += 1
      }

      blocks.push({ type: 'table', header, rows })
      continue
    }

    if (/^\s*[-*]\s+/.test(current)) {
      const items = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    if (/^\s*\d+\.\s+/.test(current)) {
      const items = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    const paragraphLines = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith('```') &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !(
        lines[index].includes('|') &&
        index + 1 < lines.length &&
        isTableSeparator(lines[index + 1])
      )
    ) {
      paragraphLines.push(lines[index].trim())
      index += 1
    }

    blocks.push({ type: 'p', content: paragraphLines.join(' ') })
  }

  return (
    <div className={`space-y-3 text-sm leading-6 text-foreground ${className}`.trim()}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'code') {
          return (
            <pre
              key={`code-${blockIndex}`}
              className="overflow-x-auto rounded-[1.25rem] bg-[rgb(var(--theme-neutral-rgb))] px-4 py-3 text-xs leading-6 text-foreground"
            >
              <code>{block.content}</code>
            </pre>
          )
        }

        if (block.type === 'table') {
          return (
            <div
              key={`table-${blockIndex}`}
              className="overflow-x-auto rounded-[1.25rem] border border-[rgb(var(--theme-border-rgb)/0.78)]"
            >
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead className="bg-[rgb(var(--theme-neutral-rgb))]">
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th key={`head-${cellIndex}`} className="px-3 py-2 font-semibold text-foreground">
                        {renderInline(cell, `th-${blockIndex}-${cellIndex}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="border-t border-[rgb(var(--theme-border-rgb)/0.7)]">
                      {row.map((cell, cellIndex) => (
                        <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-muted-foreground">
                          {renderInline(cell, `td-${blockIndex}-${rowIndex}-${cellIndex}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === 'ul') {
          return (
            <ul key={`ul-${blockIndex}`} className="space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`ul-${blockIndex}-${itemIndex}`}>{renderInline(item, `ul-${blockIndex}-${itemIndex}`)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ol') {
          return (
            <ol key={`ol-${blockIndex}`} className="space-y-1.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`ol-${blockIndex}-${itemIndex}`}>{renderInline(item, `ol-${blockIndex}-${itemIndex}`)}</li>
              ))}
            </ol>
          )
        }

        return (
          <p key={`p-${blockIndex}`}>
            {renderInline(block.content, `p-${blockIndex}`)}
          </p>
        )
      })}
    </div>
  )
}
