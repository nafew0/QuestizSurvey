export default function FileUploadRenderer({ value, onChange, disabled = false }) {
  return (
    <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
      <span className="text-sm font-semibold text-slate-700">
        {value?.name || 'Choose a file'}
      </span>
      <span className="mt-1 text-sm text-slate-500">PDF, PNG, JPG, or DOC</span>
      <input
        type="file"
        disabled={disabled}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  )
}

