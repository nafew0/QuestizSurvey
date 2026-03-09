import { useEffect, useMemo, useState } from 'react'
import { Palette, RotateCcw, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HelpPopover } from '@/components/ui/help-popover'
import { Input } from '@/components/ui/input'
import { useSiteTheme } from '@/contexts/SiteThemeContext'
import { normalizeHex } from '@/lib/siteTheme'

const COLOR_FIELDS = [
  {
    key: 'primary',
    label: 'Primary',
    helper: 'Main actions, links, and dominant highlights.',
  },
  {
    key: 'secondary',
    label: 'Secondary',
    helper: 'Support surfaces, cards, and softer chips.',
  },
  {
    key: 'accent',
    label: 'Accent',
    helper: 'Callouts, decorative chips, and contrast moments.',
  },
]

function ActiveChip() {
  return (
    <span className="rounded-full border border-[rgb(var(--theme-primary-strong-rgb)/0.88)] bg-[rgb(var(--theme-primary-soft-rgb)/0.88)] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--theme-primary-ink-rgb))]">
      Active
    </span>
  )
}

export default function ThemeStudioDialog() {
  const {
    presets,
    mode,
    activePreset,
    activeColors,
    setPresetTheme,
    setCustomColor,
    resetTheme,
  } = useSiteTheme()
  const [open, setOpen] = useState(false)
  const [draftColors, setDraftColors] = useState(activeColors)

  useEffect(() => {
    if (open) {
      setDraftColors(activeColors)
    }
  }, [activeColors, open])

  const subtitle = useMemo(() => {
    if (mode === 'custom') {
      return 'Custom'
    }

    return activePreset?.name || 'Preset'
  }, [activePreset?.name, mode])

  const commitDraftColor = (key) => {
    const normalized = normalizeHex(draftColors[key], activeColors[key])
    setDraftColors((current) => ({
      ...current,
      [key]: normalized,
    }))
    setCustomColor(key, normalized)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-full border-[rgb(var(--theme-border-rgb)/0.85)] bg-white/85 shadow-sm"
        >
          <Palette className="h-4 w-4 text-primary" />
          Theme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl pr-16 sm:pr-20">
        <DialogHeader className="space-y-0">
          <div className="flex items-center justify-between gap-3 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Theme Studio
              </DialogTitle>
              <Badge variant="outline" className="rounded-full">
                {subtitle}
              </Badge>
            </div>
            <HelpPopover title="Site theme" align="end">
              Pick one preset or set your own primary, secondary, and accent colors. Softer chips, cards, and surfaces are derived mathematically from those three colors.
            </HelpPopover>
          </div>
          <DialogDescription className="sr-only">
            Configure the site-wide three-color palette.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Presets</p>
                <HelpPopover title="Presets">
                  Choose a ready-made palette. You can still adjust any color below.
                </HelpPopover>
              </div>
              <Button variant="ghost" size="sm" className="gap-2" onClick={resetTheme}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {presets.map((preset) => {
                const isActive = mode === 'preset' && activePreset?.id === preset.id

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPresetTheme(preset.id)}
                    className={`relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition ${
                      isActive
                        ? 'border-[rgb(var(--theme-primary-rgb)/0.55)] bg-[rgb(var(--theme-primary-soft-rgb)/0.46)] shadow-sm'
                        : 'border-[rgb(var(--theme-border-rgb)/0.8)] bg-white hover:border-[rgb(var(--theme-primary-rgb)/0.35)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="pr-2 text-base font-semibold text-foreground">
                        {preset.name}
                      </p>
                      {isActive ? <ActiveChip /> : null}
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      {Object.values(preset.colors).map((color) => (
                        <span
                          key={`${preset.id}-${color}`}
                          className="h-9 w-9 rounded-full border border-white/80 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.8)] bg-[rgb(var(--theme-neutral-rgb)/0.8)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Custom</p>
                <HelpPopover title="Custom palette">
                  Primary usually drives buttons and focus states, secondary softens panels, and accent lifts chips and highlights.
                </HelpPopover>
              </div>

              <div className="space-y-3">
                {COLOR_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="grid items-center gap-3 rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.75)] bg-white p-3 md:grid-cols-[84px_minmax(0,1fr)_140px]"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{field.label}</p>
                      <HelpPopover title={field.label} contentClassName="w-64">
                        {field.helper}
                      </HelpPopover>
                    </div>
                    <div className="theme-color-shell">
                      <input
                        type="color"
                        value={activeColors[field.key]}
                        onChange={(event) => {
                          setDraftColors((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                          setCustomColor(field.key, event.target.value)
                        }}
                        className="theme-color-input"
                      />
                    </div>
                    <Input
                      value={draftColors[field.key]}
                      onChange={(event) =>
                        setDraftColors((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      onBlur={() => commitDraftColor(field.key)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitDraftColor(field.key)
                        }
                      }}
                      className="h-11 rounded-2xl uppercase"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="theme-panel rounded-[1.75rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Preview</p>
                <HelpPopover title="Preview" align="end">
                  This shows how your three colors flow into chips, icons, and soft interface surfaces.
                </HelpPopover>
              </div>
              <div className="theme-icon-accent flex h-11 w-11 items-center justify-center rounded-2xl">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Primary</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Accent</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="theme-panel-soft space-y-3 rounded-[1.35rem] p-4">
                  <div className="theme-icon-primary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Palette className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Builder</p>
                </div>

                <div className="theme-panel-soft space-y-3 rounded-[1.35rem] p-4">
                  <div className="theme-icon-secondary flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Palette className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Cards</p>
                </div>

                <div className="theme-panel-soft space-y-3 rounded-[1.35rem] p-4">
                  <div className="theme-icon-accent flex h-10 w-10 items-center justify-center rounded-2xl">
                    <Palette className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Badges</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.8)] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">Header</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="theme-chip-secondary">/af89b9af8aa0</span>
                    <span className="theme-chip-accent">2 pages</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
