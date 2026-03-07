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

function BaseQuestionFrame({ question, required, children }) {
  const isStructural = ['section_heading', 'instructional_text'].includes(question.question_type)

  if (isStructural) {
    return children
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
          {question.text}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </h3>
        {question.description ? <p className="text-sm text-slate-500">{question.description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export default function QuestionRenderer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const rendererProps = {
    question,
    value,
    onChange,
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
    <BaseQuestionFrame question={question} required={question.required}>
      {renderer}
    </BaseQuestionFrame>
  )
}
