import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  triggerClassName = '',
  contentClassName = '',
  align = 'start',
}) {
  const normalizedValue = value ?? ''
  const selectedOption =
    options.find((option) => String(option.value ?? '') === String(normalizedValue)) ?? null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-input bg-background px-3 text-left text-sm text-foreground transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60',
            triggerClassName
          )}
        >
          <span
            className={cn(
              'truncate',
              selectedOption ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          'theme-panel w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem] rounded-2xl p-2',
          'max-h-72 overflow-y-auto',
          contentClassName
        )}
      >
        {options.map((option) => {
          const isSelected =
            String(option.value ?? '') === String(normalizedValue)

          return (
            <DropdownMenuItem
              key={`${option.value ?? 'empty'}-${option.label}`}
              onSelect={() => onChange(option.value)}
              className={cn(
                'rounded-xl px-3 py-2.5 text-sm',
                isSelected
                  ? 'bg-[rgb(var(--theme-primary-soft-rgb)/0.72)] text-[rgb(var(--theme-primary-ink-rgb))]'
                  : 'text-foreground'
              )}
            >
              <span className="truncate">{option.label}</span>
              {isSelected ? <Check className="ml-auto h-4 w-4" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
