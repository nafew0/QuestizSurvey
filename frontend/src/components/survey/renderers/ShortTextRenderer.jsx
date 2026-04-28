import { Input } from '@/components/ui/input'
import { getInputValidationInputProps } from '@/utils/inputValidation'

export default function ShortTextRenderer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const inputProps = getInputValidationInputProps(question?.settings?.input_validation)

  return (
    <Input
      {...inputProps}
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Type your answer"
      className="survey-theme-control survey-theme-input h-12"
    />
  )
}
