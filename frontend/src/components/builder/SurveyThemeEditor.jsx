import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { HelpPopover } from '@/components/ui/help-popover'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/useToast'
import {
  normalizeHex,
  normalizeSurveyTheme,
  SURVEY_BUTTON_STYLE_OPTIONS,
  SURVEY_FONT_OPTIONS,
  SURVEY_LOGO_POSITION_OPTIONS,
  SURVEY_SPACING_OPTIONS,
  SURVEY_THEME_PRESETS,
} from '@/lib/surveyTheme'
import { uploadSurveyThemeAsset } from '@/services/surveys'

function ActiveChip() {
  return (
    <span className="rounded-full border border-[rgb(var(--theme-primary-strong-rgb)/0.88)] bg-[rgb(var(--theme-primary-soft-rgb)/0.88)] px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[rgb(var(--theme-primary-ink-rgb))]">
      Active
    </span>
  )
}

function SectionHeader({ title, help }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <HelpPopover title={title} align="end">
        {help}
      </HelpPopover>
    </div>
  )
}

function ThemeColorField({ label, value, onChange, help }) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  const commitValue = () => {
    const nextValue = normalizeHex(draftValue, value)
    setDraftValue(nextValue)
    onChange(nextValue)
  }

  return (
    <div className="rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <HelpPopover title={label} contentClassName="w-64">
            {help}
          </HelpPopover>
        </div>
        <span
          className="h-8 w-8 shrink-0 rounded-full border border-white shadow-sm"
          style={{ backgroundColor: value }}
        />
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_128px] gap-3">
        <div className="theme-color-shell">
          <input
            type="color"
            value={value}
            onChange={(event) => {
              setDraftValue(event.target.value)
              onChange(event.target.value)
            }}
            className="theme-color-input"
          />
        </div>
        <Input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitValue()
            }
          }}
          className="h-11 rounded-2xl uppercase"
        />
      </div>
    </div>
  )
}

function ThemeOptionButton({ active, label, onClick, preview }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.35rem] border p-3 text-left transition ${
        active
          ? 'border-[rgb(var(--theme-primary-rgb)/0.52)] bg-[rgb(var(--theme-primary-soft-rgb)/0.42)] shadow-sm'
          : 'border-[rgb(var(--theme-border-rgb)/0.76)] bg-white hover:border-[rgb(var(--theme-primary-rgb)/0.35)]'
      }`}
    >
      <div className="mb-3">{preview}</div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
    </button>
  )
}

function ThemeAssetField({
  label,
  assetType,
  value,
  uploading,
  onUpload,
  onClear,
  help,
}) {
  const inputRef = useRef(null)

  return (
    <div className="space-y-3 rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <HelpPopover title={label} align="end" contentClassName="w-64">
            {help}
          </HelpPopover>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-3"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
          {value ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-full px-3"
              disabled={uploading}
              onClick={() => onClear(assetType)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-neutral-rgb)/0.72)]">
        {value ? (
          <img src={value} alt={label} className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-28 items-center justify-center text-[13px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              <span>No {label.toLowerCase()}</span>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0]
          if (nextFile) {
            onUpload(assetType, nextFile)
          }
          event.target.value = ''
        }}
      />
    </div>
  )
}

export default function SurveyThemeEditor({ survey, onSurveyFieldChange }) {
  const { toast } = useToast()
  const [uploadingAsset, setUploadingAsset] = useState('')

  const theme = normalizeSurveyTheme(survey.theme)

  const updateTheme = (patch) => {
    onSurveyFieldChange('theme', {
      ...theme,
      ...patch,
    })
  }

  const handleUploadAsset = async (assetType, file) => {
    setUploadingAsset(assetType)

    try {
      const response = await uploadSurveyThemeAsset(survey.id, {
        assetType,
        file,
      })
      onSurveyFieldChange('theme', response.theme)
      toast({
        title: 'Theme asset uploaded',
        description: `${assetType === 'logo' ? 'Logo' : 'Background image'} updated successfully.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description:
          error.response?.data?.asset?.[0] ||
          error.response?.data?.detail ||
          'The image could not be uploaded.',
        variant: 'error',
      })
    } finally {
      setUploadingAsset('')
    }
  }

  const handleClearAsset = async (assetType) => {
    setUploadingAsset(assetType)

    try {
      const response = await uploadSurveyThemeAsset(survey.id, {
        assetType,
        clear: true,
      })
      onSurveyFieldChange('theme', response.theme)
      toast({
        title: 'Theme asset removed',
        description: `${assetType === 'logo' ? 'Logo' : 'Background image'} removed from the survey theme.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: error.response?.data?.detail || 'The image could not be removed.',
        variant: 'error',
      })
    } finally {
      setUploadingAsset('')
    }
  }

  return (
    <div className="space-y-4">
      <section className="theme-panel rounded-[1.75rem] p-4">
        <SectionHeader
          title="Theme presets"
          help="Choose a preset and then fine-tune colors, layout, or media below."
        />

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {SURVEY_THEME_PRESETS.map((preset) => {
            const presetTheme = normalizeSurveyTheme(preset.theme)
            const isActive =
              theme.primary_color === presetTheme.primary_color &&
              theme.background_color === presetTheme.background_color &&
              theme.text_color === presetTheme.text_color &&
              theme.font_family === presetTheme.font_family &&
              theme.button_style === presetTheme.button_style &&
              theme.progress_bar_color === presetTheme.progress_bar_color

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSurveyFieldChange('theme', presetTheme)}
                className={`relative overflow-hidden rounded-[1.45rem] border p-3.5 text-left transition ${
                  isActive
                    ? 'border-[rgb(var(--theme-primary-rgb)/0.52)] bg-[rgb(var(--theme-primary-soft-rgb)/0.42)] shadow-sm'
                    : 'border-[rgb(var(--theme-border-rgb)/0.76)] bg-white hover:border-[rgb(var(--theme-primary-rgb)/0.35)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="pr-2 text-base font-semibold text-foreground">{preset.name}</p>
                  {isActive ? <ActiveChip /> : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {[
                    presetTheme.background_color,
                    presetTheme.primary_color,
                    presetTheme.text_color,
                    presetTheme.progress_bar_color,
                  ].map((color, index) => (
                    <span
                      key={`${preset.id}-${color}-${index}`}
                      className="h-8 w-8 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="theme-panel rounded-[1.75rem] p-4">
        <SectionHeader
          title="Colors"
          help="Background keeps the survey airy, primary drives controls and emphasis, text handles readability, and progress controls the step bar."
        />

        <div className="mt-4 grid gap-3">
          <ThemeColorField
            label="Primary"
            value={theme.primary_color}
            onChange={(value) => updateTheme({ primary_color: value, progress_bar_color: value })}
            help="Buttons, focus states, and the main survey accent."
          />
          <ThemeColorField
            label="Background"
            value={theme.background_color}
            onChange={(value) => updateTheme({ background_color: value })}
            help="The dominant survey shell and card surface."
          />
          <ThemeColorField
            label="Text"
            value={theme.text_color}
            onChange={(value) => updateTheme({ text_color: value })}
            help="Question copy, labels, and supporting text."
          />
          <ThemeColorField
            label="Progress"
            value={theme.progress_bar_color}
            onChange={(value) => updateTheme({ progress_bar_color: value })}
            help="Used for page progress and completion emphasis."
          />
        </div>
      </section>

      <section className="theme-panel rounded-[1.75rem] p-4">
        <SectionHeader
          title="Layout"
          help="Font, logo position, button shape, and question spacing apply immediately to the builder preview and public survey."
        />

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                  Font
                </p>
                <HelpPopover title="Font">
                  Select the typeface used by the survey shell, prompts, and inputs.
                </HelpPopover>
              </div>
              <CustomSelect
                value={theme.font_family}
                onChange={(value) => updateTheme({ font_family: value })}
                options={SURVEY_FONT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                  Logo
                </p>
                <HelpPopover title="Logo position">
                  Choose where the uploaded logo sits in the survey header.
                </HelpPopover>
              </div>
              <CustomSelect
                value={theme.logo_position}
                onChange={(value) => updateTheme({ logo_position: value })}
                options={SURVEY_LOGO_POSITION_OPTIONS}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                Buttons
              </p>
              <HelpPopover title="Button style">
                Rounded softens the survey, square sharpens it, and pill pushes a friendlier look.
              </HelpPopover>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {SURVEY_BUTTON_STYLE_OPTIONS.map((option) => (
                <ThemeOptionButton
                  key={option.value}
                  active={theme.button_style === option.value}
                  label={option.label}
                  onClick={() => updateTheme({ button_style: option.value })}
                  preview={
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-10 w-16 border border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-primary-soft-rgb)/0.6)] ${
                          option.value === 'pill'
                            ? 'rounded-full'
                            : option.value === 'square'
                              ? 'rounded-lg'
                              : 'rounded-2xl'
                        }`}
                      />
                      <span className="h-10 w-10 rounded-full border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white" />
                    </div>
                  }
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                Spacing
              </p>
              <HelpPopover title="Question spacing">
                Controls the vertical gap between question cards.
              </HelpPopover>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {SURVEY_SPACING_OPTIONS.map((option) => (
                <ThemeOptionButton
                  key={option.value}
                  active={theme.question_spacing === option.value}
                  label={option.label}
                  onClick={() => updateTheme({ question_spacing: option.value })}
                  preview={
                    <div className="space-y-2">
                      {[0, 1, 2].map((rowIndex) => (
                        <div
                          key={rowIndex}
                          className={`rounded-xl border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white ${
                            option.value === 'compact'
                              ? 'h-6'
                              : option.value === 'spacious'
                                ? 'h-10'
                                : 'h-8'
                          }`}
                        />
                      ))}
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="theme-panel rounded-[1.75rem] p-4">
        <SectionHeader
          title="Branding"
          help="Upload a logo or background image stored in your Django media storage. Background opacity controls how strongly the image shows through."
        />

        <div className="mt-4 space-y-3">
          <ThemeAssetField
            label="Logo"
            assetType="logo"
            value={theme.logo_url}
            uploading={uploadingAsset === 'logo'}
            onUpload={handleUploadAsset}
            onClear={handleClearAsset}
            help="Use a transparent PNG, SVG, or a compact brand mark."
          />

          <ThemeAssetField
            label="Background"
            assetType="background"
            value={theme.background_image_url}
            uploading={uploadingAsset === 'background'}
            onUpload={handleUploadAsset}
            onClear={handleClearAsset}
            help="Wide, low-noise images work best because the form shell sits on top."
          />

          <div className="rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">Opacity</p>
                <HelpPopover title="Background opacity">
                  Higher values make the background image more visible behind the survey shell.
                </HelpPopover>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {Math.round(theme.background_image_opacity * 100)}%
              </span>
            </div>
            <Slider
              className="mt-3"
              value={[theme.background_image_opacity]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(value) => updateTheme({ background_image_opacity: value[0] ?? 0 })}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
