import { Input } from '@/components/ui/input'

export default function ShortTextRenderer({ value, onChange, disabled = false }) {
  return (
    <Input
      value={value || ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Type your answer"
      className="h-12 rounded-2xl"
    />
  )
}

