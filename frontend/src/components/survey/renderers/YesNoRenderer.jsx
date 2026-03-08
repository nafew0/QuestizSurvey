import { Button } from '@/components/ui/button'

export default function YesNoRenderer({
  question,
  value,
  onChange,
  disabled = false,
}) {
  const options =
    question?.choices?.length >= 2
      ? question.choices.map((choice) => ({
          id: choice.id,
          label: choice.text,
        }))
      : [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ]

  return (
    <div className={`grid gap-3 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          variant={value === option.id ? 'default' : 'outline'}
          disabled={disabled}
          onClick={() => onChange(option.id)}
          className="h-12 rounded-2xl text-sm"
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
