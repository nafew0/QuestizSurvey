import { Input } from '@/components/ui/input'

const FIELD_LABELS = {
  name: 'Full name',
  email: 'Email address',
  phone: 'Phone number',
  address: 'Street address',
  city: 'City',
  state: 'State',
  zip: 'ZIP code',
  country: 'Country',
}

export default function DemographicsRenderer({
  question,
  value = {},
  onChange,
  disabled = false,
}) {
  const fields = question.settings?.fields ?? {}

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(fields)
        .filter(([, enabled]) => enabled)
        .map(([field]) => (
          <div key={field} className="space-y-2">
            <label className="text-sm font-medium text-foreground">{FIELD_LABELS[field] ?? field}</label>
            <Input
              value={value[field] || ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...value,
                  [field]: event.target.value,
                })
              }
              className="survey-theme-control survey-theme-input h-12"
            />
          </div>
        ))}
    </div>
  )
}
