import { CircleHelp } from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './dropdown-menu'

export function HelpPopover({
  title = 'Help',
  children,
  align = 'start',
  contentClassName = '',
  triggerClassName = '',
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
            triggerClassName
          )}
        >
          <CircleHelp className="h-4 w-4" />
          <span className="sr-only">{title}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className={cn(
          'w-80 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10',
          contentClassName
        )}
      >
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <div className="text-sm leading-6 text-slate-500">{children}</div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
