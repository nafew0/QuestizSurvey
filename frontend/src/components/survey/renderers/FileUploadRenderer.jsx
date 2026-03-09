export default function FileUploadRenderer({ value, onChange, disabled = false }) {
  return (
    <label className="survey-theme-filedrop flex min-h-[160px] cursor-pointer flex-col items-center justify-center px-6 text-center">
      <span className="text-sm font-semibold text-foreground">
        {value?.name || 'Choose a file'}
      </span>
      <span className="survey-theme-muted mt-1 text-sm">PDF, PNG, JPG, or DOC</span>
      <input
        type="file"
        disabled={disabled}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  )
}
