import { Textarea } from '@/components/ui/textarea'

export default function LongTextRenderer({ value, onChange, disabled = false }) {
  const characterCount = `${value || ''}`.length

  return (
    <div className="space-y-2">
      <Textarea
        value={value || ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer"
        className="survey-theme-control survey-theme-input min-h-[140px]"
      />
      <p className="survey-theme-muted text-right text-xs">
        {characterCount} characters
      </p>
    </div>
  )
}
