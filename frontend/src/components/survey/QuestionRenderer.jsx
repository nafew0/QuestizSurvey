import { cn } from '@/lib/utils'
import {
  getAnswerCommentText,
  getAnswerOtherText,
  getAnswerPrimaryValue,
  getQuestionChoicesForResponse,
  questionSupportsComment,
  shouldShowOtherInput,
  updateAnswerCommentText,
  updateAnswerOtherText,
  updateAnswerPrimaryValue,
} from '@/utils/questionAnswers'

import MultipleChoiceSingleRenderer from './renderers/MultipleChoiceSingleRenderer'
import MultipleChoiceMultiRenderer from './renderers/MultipleChoiceMultiRenderer'
import DropdownRenderer from './renderers/DropdownRenderer'
import ShortTextRenderer from './renderers/ShortTextRenderer'
import LongTextRenderer from './renderers/LongTextRenderer'
import YesNoRenderer from './renderers/YesNoRenderer'
import StarRatingRenderer from './renderers/StarRatingRenderer'
import RatingScaleRenderer from './renderers/RatingScaleRenderer'
import NpsRenderer from './renderers/NpsRenderer'
import ConstantSumRenderer from './renderers/ConstantSumRenderer'
import DateTimeRenderer from './renderers/DateTimeRenderer'
import MatrixRenderer from './renderers/MatrixRenderer'
import RankingRenderer from './renderers/RankingRenderer'
import ImageChoiceRenderer from './renderers/ImageChoiceRenderer'
import FileUploadRenderer from './renderers/FileUploadRenderer'
import DemographicsRenderer from './renderers/DemographicsRenderer'
import SectionHeadingRenderer from './renderers/SectionHeadingRenderer'
import InstructionalTextRenderer from './renderers/InstructionalTextRenderer'
import { Textarea } from '@/components/ui/textarea'

function BaseQuestionFrame({
  question,
  required,
  children,
  showPrompt = true,
  showDescription = true,
  frameClassName = '',
  numberLabel = null,
}) {
  const isStructural = ['section_heading', 'instructional_text'].includes(question.question_type)

  if (isStructural) {
    return children
  }

  return (
    <div
      className={cn(
        'survey-theme-card space-y-4 p-6',
        frameClassName
      )}
    >
      {showPrompt || (showDescription && question.description) ? (
        <div className="space-y-2">
          {showPrompt ? (
            <div className="flex items-start gap-2">
              {numberLabel ? (
                <span className="inline-flex min-w-7 items-center justify-center rounded-full border border-[rgb(var(--theme-border-rgb)/0.85)] bg-[rgb(var(--theme-neutral-rgb))] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
                  {numberLabel}
                </span>
              ) : null}
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                {question.text}
                {required ? <span className="ml-1 text-rose-500">*</span> : null}
              </h3>
            </div>
          ) : null}
          {showDescription && question.description ? (
            <p className="survey-theme-muted text-[13px]">{question.description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
  showPrompt = true,
  showDescription = true,
  frameClassName = '',
  numberLabel = null,
}) {
  const isStructural = ['section_heading', 'instructional_text'].includes(question.question_type)
  const responseQuestion = {
    ...question,
    choices: getQuestionChoicesForResponse(question),
  }
  const primaryValue = getAnswerPrimaryValue(value)
  const otherText = getAnswerOtherText(value)
  const commentText = getAnswerCommentText(value)

  const rendererProps = {
    question: responseQuestion,
    value: primaryValue,
    onChange: (nextValue) => onChange(updateAnswerPrimaryValue(value, nextValue)),
    disabled,
  }

  let renderer = null

  switch (question.question_type) {
    case 'multiple_choice_single':
      renderer = <MultipleChoiceSingleRenderer {...rendererProps} />
      break
    case 'multiple_choice_multi':
      renderer = <MultipleChoiceMultiRenderer {...rendererProps} />
      break
    case 'dropdown':
      renderer = <DropdownRenderer {...rendererProps} />
      break
    case 'short_text':
      renderer = <ShortTextRenderer {...rendererProps} />
      break
    case 'long_text':
      renderer = <LongTextRenderer {...rendererProps} />
      break
    case 'yes_no':
      renderer = <YesNoRenderer {...rendererProps} />
      break
    case 'star_rating':
      renderer = <StarRatingRenderer {...rendererProps} />
      break
    case 'rating_scale':
      renderer = <RatingScaleRenderer {...rendererProps} />
      break
    case 'nps':
      renderer = <NpsRenderer {...rendererProps} />
      break
    case 'constant_sum':
      renderer = <ConstantSumRenderer {...rendererProps} />
      break
    case 'date_time':
      renderer = <DateTimeRenderer {...rendererProps} />
      break
    case 'matrix':
      renderer = <MatrixRenderer {...rendererProps} />
      break
    case 'ranking':
      renderer = <RankingRenderer {...rendererProps} />
      break
    case 'image_choice':
      renderer = <ImageChoiceRenderer {...rendererProps} />
      break
    case 'file_upload':
      renderer = <FileUploadRenderer {...rendererProps} />
      break
    case 'demographics':
      renderer = <DemographicsRenderer {...rendererProps} />
      break
    case 'section_heading':
      renderer = <SectionHeadingRenderer {...rendererProps} />
      break
    case 'instructional_text':
      renderer = <InstructionalTextRenderer {...rendererProps} />
      break
    default:
      renderer = <ShortTextRenderer {...rendererProps} />
      break
  }

  return (
    <BaseQuestionFrame
      question={question}
      required={question.required}
      showPrompt={showPrompt}
      showDescription={showDescription}
      frameClassName={frameClassName}
      numberLabel={numberLabel}
    >
      <div className="space-y-4">
        {renderer}

        {!isStructural && shouldShowOtherInput(question, value) ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Other</label>
            <Textarea
              value={otherText}
              disabled={disabled}
              onChange={(event) => onChange(updateAnswerOtherText(value, event.target.value))}
              placeholder="Type your answer"
              className="survey-theme-control survey-theme-input min-h-24"
            />
          </div>
        ) : null}

        {!isStructural && questionSupportsComment(question) ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Comment</label>
            <Textarea
              value={commentText}
              disabled={disabled}
              onChange={(event) => onChange(updateAnswerCommentText(value, event.target.value))}
              placeholder="Add an optional comment"
              className="survey-theme-control survey-theme-input min-h-24"
            />
          </div>
        ) : null}
      </div>
    </BaseQuestionFrame>
  )
}
