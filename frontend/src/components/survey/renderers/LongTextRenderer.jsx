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
        className="min-h-[140px] rounded-2xl"
      />
      <p className="text-right text-xs text-muted-foreground">
        {characterCount} characters
      </p>
    </div>
  )
}
