import RichTextContent from '@/components/ui/rich-text-content'
import { getQuestionTextHtml } from '@/utils/richText'

export default function SectionHeadingRenderer({ question }) {
  return (
    <div className="survey-theme-structural px-6 py-5">
      <RichTextContent
        html={getQuestionTextHtml(question)}
        plainText={question.text}
        className="text-lg font-semibold tracking-tight text-foreground"
      />
      {question.description ? (
        <p className="survey-theme-muted mt-2 whitespace-pre-wrap text-sm">
          {question.description}
        </p>
      ) : null}
    </div>
  )
}
