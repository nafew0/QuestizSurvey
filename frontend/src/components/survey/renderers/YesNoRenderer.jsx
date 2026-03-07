import { Button } from '@/components/ui/button'

export default function YesNoRenderer({ value, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {['Yes', 'No'].map((label) => (
        <Button
          key={label}
          type="button"
          variant={value === label ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(label)}
          className="h-14 rounded-2xl text-base"
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

