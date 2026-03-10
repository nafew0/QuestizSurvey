import { useState } from 'react'

import { cn } from '@/lib/utils'

const BRAND_LOGO_PATH = '/branding/logo.svg'

export default function BrandLogo({
  className,
  iconClassName,
  imageClassName,
  titleClassName,
  subtitleClassName,
  showSubtitle = true,
  title = 'Questiz',
  subtitle = 'Survey intelligence platform',
  compact = false,
}) {
  const [logoFailed, setLogoFailed] = useState(false)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border border-[rgb(var(--theme-border-rgb)/0.9)] bg-white shadow-[0_14px_28px_rgb(var(--theme-shadow-rgb)/0.08)]',
          compact ? 'h-10 w-10' : 'h-12 w-12',
          iconClassName
        )}
      >
        {logoFailed ? (
          <span
            className={cn(
              'font-black tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]',
              compact ? 'text-lg' : 'text-xl'
            )}
          >
            Q
          </span>
        ) : (
          <img
            src={BRAND_LOGO_PATH}
            alt="Questiz logo"
            className={cn(
              'object-contain',
              compact ? 'h-6 w-6' : 'h-8 w-8',
              imageClassName
            )}
            onError={() => setLogoFailed(true)}
          />
        )}
        <span className="absolute inset-x-2 bottom-1 h-px bg-gradient-to-r from-transparent via-[rgb(var(--theme-primary-rgb)/0.55)] to-transparent" />
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-semibold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))]',
            compact ? 'text-lg' : 'text-xl',
            titleClassName
          )}
        >
          {title}
        </p>
        {showSubtitle ? (
          <p
            className={cn(
              'truncate text-[10px] uppercase tracking-[0.26em] text-muted-foreground',
              subtitleClassName
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}
