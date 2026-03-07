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
      return 'Custom palette'
    }

    return activePreset?.name || 'Preset palette'
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="default">Theme Studio</Badge>
            <Badge variant="outline">{subtitle}</Badge>
          </div>
          <DialogTitle>Primary, secondary, and accent for the whole site</DialogTitle>
          <DialogDescription>
            Extra surfaces are derived mathematically from those three colors by
            mixing them with white for soft backgrounds and with the default ink
            for readable tinted text.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Palette presets</p>
                  <p className="text-sm text-muted-foreground">
                    Start from a curated combination, then customize if needed.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="gap-2" onClick={resetTheme}>
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {presets.map((preset) => {
                  const isActive =
                    mode === 'preset' && activePreset?.id === preset.id

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPresetTheme(preset.id)}
                      className={`rounded-[1.5rem] border p-4 text-left transition ${
                        isActive
                          ? 'border-[rgb(var(--theme-primary-rgb)/0.55)] bg-[rgb(var(--theme-primary-soft-rgb)/0.55)] shadow-sm'
                          : 'border-[rgb(var(--theme-border-rgb)/0.8)] bg-white hover:border-[rgb(var(--theme-primary-rgb)/0.35)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">{preset.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {preset.description}
                          </p>
                        </div>
                        {isActive ? <Badge variant="default">Active</Badge> : null}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        {Object.values(preset.colors).map((color) => (
                          <span
                            key={`${preset.id}-${color}`}
                            className="h-8 w-8 rounded-full border border-white/80 shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4 rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.8)] bg-[rgb(var(--theme-neutral-rgb)/0.8)] p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Custom palette</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paste or pick any three colors. The site updates live as you
                  commit each field.
                </p>
              </div>

              <div className="space-y-4">
                {COLOR_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="grid gap-3 rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.75)] bg-white p-4 md:grid-cols-[1fr_120px_150px]"
                  >
                    <div>
                      <p className="font-medium text-foreground">{field.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {field.helper}
                      </p>
                    </div>
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
                      className="h-11 w-full cursor-pointer rounded-2xl border border-input bg-background p-1"
                    />
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
                      className="rounded-2xl uppercase"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="theme-panel rounded-[1.75rem] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Live preview</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This is how the palette is applied across chips, icons, and
                    soft surfaces.
                  </p>
                </div>
                <div className="theme-icon-accent flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Primary</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Accent</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="theme-panel-soft rounded-[1.5rem] p-4">
                    <div className="theme-icon-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                      <Palette className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-semibold text-foreground">Builder shell</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Primary-tinted actions and focus states.
                    </p>
                  </div>

                  <div className="theme-panel-soft rounded-[1.5rem] p-4">
                    <div className="theme-icon-secondary flex h-11 w-11 items-center justify-center rounded-2xl">
                      <Palette className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-semibold text-foreground">Cards</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Secondary surfaces keep the workspace colorful but calm.
                    </p>
                  </div>

                  <div className="theme-panel-soft rounded-[1.5rem] p-4">
                    <div className="theme-icon-accent flex h-11 w-11 items-center justify-center rounded-2xl">
                      <Palette className="h-5 w-5" />
                    </div>
                    <p className="mt-3 font-semibold text-foreground">Badges</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Accent pills lift the labels without darkening the UI.
                    </p>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.8)] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Example survey header
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Slugs, counts, and support chips now inherit the palette.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="theme-chip-secondary">/af89b9af8aa0</span>
                      <span className="theme-chip-accent">2 pages</span>
                    </div>
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
