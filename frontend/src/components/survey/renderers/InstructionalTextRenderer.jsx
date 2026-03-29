import RichTextContent from '@/components/ui/rich-text-content'
import { getQuestionTextHtml } from '@/utils/richText'

export default function InstructionalTextRenderer({ question }) {
  return (
    <div className="survey-theme-structural px-6 py-5">
      <RichTextContent
        html={getQuestionTextHtml(question)}
        plainText={question.text}
        className="text-sm leading-6 text-foreground"
      />
      {question.description ? (
        <p className="survey-theme-muted mt-3 whitespace-pre-wrap text-xs leading-5">
          {question.description}
        </p>
      ) : null}
    </div>
  )
}
