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
      portal={false}
      triggerClassName="survey-theme-control survey-theme-input h-12 px-4 text-sm"
      contentClassName="max-h-80"
    />
  )
}
