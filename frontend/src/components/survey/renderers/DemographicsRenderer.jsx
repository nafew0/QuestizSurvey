import { DEMOGRAPHIC_FIELDS } from '@/constants/surveyBuilder'
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
  const configuredFields = question.settings?.fields
  const enabledFields = Array.isArray(configuredFields)
    ? DEMOGRAPHIC_FIELDS.filter((field) => configuredFields.includes(field))
    : DEMOGRAPHIC_FIELDS.filter((field) => Boolean(configuredFields?.[field]))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {enabledFields.map((field) => (
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
