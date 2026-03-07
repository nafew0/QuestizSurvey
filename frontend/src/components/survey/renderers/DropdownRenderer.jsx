import { CustomSelect } from '@/components/ui/custom-select'

export default function DropdownRenderer({ question, value, onChange, disabled = false }) {
  return (
    <CustomSelect
      value={value || ''}
      onChange={onChange}
      disabled={disabled}
      placeholder="Select an option"
      options={[
        { value: '', label: 'Select an option' },
        ...(question.choices?.map((choice) => ({
          value: choice.id,
          label: choice.text,
        })) ?? []),
      ]}
      triggerClassName="h-12 rounded-2xl px-4 text-sm"
      contentClassName="max-h-80"
    />
  )
}
