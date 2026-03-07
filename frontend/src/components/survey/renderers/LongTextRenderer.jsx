import { Textarea } from '@/components/ui/textarea'

export default function LongTextRenderer({ value, onChange, disabled = false }) {
  return (
    <Textarea
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Write your answer"
      className="min-h-[140px] rounded-2xl"
    />
  )
}

