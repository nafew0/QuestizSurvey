import { cn } from '@/lib/utils'

function Switch({ checked, onCheckedChange, className, disabled = false, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onCheckedChange?.(!checked)
        }
      }}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-[rgb(var(--theme-neutral-strong-rgb))]',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  )
}

export { Switch }
