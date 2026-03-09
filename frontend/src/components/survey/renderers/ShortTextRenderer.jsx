import { Input } from '@/components/ui/input'

export default function ShortTextRenderer({ value, onChange, disabled = false }) {
  return (
    <Input
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Type your answer"
      className="survey-theme-control survey-theme-input h-12"
    />
  )
}
