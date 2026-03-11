import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Gift,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  WandSparkles,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import LotteryWheel from '@/components/lottery/LotteryWheel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CustomSelect } from '@/components/ui/custom-select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/useToast'
import {
  drawSurveyLotteryWinner,
  fetchSurveyLottery,
  resetSurveyLottery,
  updateSurveyLottery,
} from '@/services/lottery'
import { fetchSurvey } from '@/services/surveys'

const LOTTERY_QUERY_KEY = 'survey-lottery'
const LOTTERY_SOUND_PATH = '/audio/lottery-tick.mp3'
const LOTTERY_WIN_SOUND_PATH = '/audio/lottery-win.mp3'
const PRIZE_LABEL_PRESETS = [
  'First prize',
  'Second prize',
  'Third prize',
  'Fourth prize',
]

function buildPrizeSlots(count) {
  return Array.from({ length: count }, (_, index) => {
    return PRIZE_LABEL_PRESETS[index] || `Prize ${index + 1}`
  })
}

function normalizeLotteryDraft(draft) {
  return {
    enabled: Boolean(draft.enabled),
    exclude_previous_winners: Boolean(draft.exclude_previous_winners),
    selected_fields: Array.from(new Set((draft.selected_fields ?? []).filter(Boolean))),
    prize_slots: Array.from(
      new Set(
        (draft.prize_slots ?? [])
          .map((label) => `${label || ''}`.trim())
          .filter(Boolean)
      )
    ),
  }
}

function getNextOpenPrizeLabel(prizeSlots, history) {
  const usedLabels = new Set((history ?? []).map((entry) => entry.prize_label))
  return prizeSlots.find((label) => !usedLabels.has(label)) || ''
}

function buildNextRotation(currentRotation, winnerIndex, totalEntries) {
  const segmentAngle = 360 / totalEntries
  const targetAngle = (360 - (winnerIndex * segmentAngle + segmentAngle / 2)) % 360
  const currentNormalized = ((currentRotation % 360) + 360) % 360
  const delta = (targetAngle - currentNormalized + 360) % 360
  const extraTurns = (6 + Math.floor(Math.random() * 2)) * 360
  return currentRotation + extraTurns + delta
}

export default function SurveyLotteryPage() {
  const navigate = useNavigate()
  const { surveyId = '' } = useParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const audioRef = useRef(null)
  const celebrationTimerRef = useRef(null)

  const [draft, setDraft] = useState({
    enabled: true,
    selected_fields: [],
    prize_slots: buildPrizeSlots(3),
    exclude_previous_winners: true,
  })
  const [dirty, setDirty] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [wheelEntries, setWheelEntries] = useState([])
  const [currentPrizeLabel, setCurrentPrizeLabel] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [pendingDrawResult, setPendingDrawResult] = useState(null)
  const [celebrationDraw, setCelebrationDraw] = useState(null)

  const surveyQuery = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => fetchSurvey(surveyId),
    enabled: Boolean(surveyId),
  })

  const lotteryQuery = useQuery({
    queryKey: [LOTTERY_QUERY_KEY, surveyId],
    queryFn: () => fetchSurveyLottery(surveyId),
    enabled: Boolean(surveyId),
  })

  const saveMutation = useMutation({
    mutationFn: (payload) => updateSurveyLottery(surveyId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData([LOTTERY_QUERY_KEY, surveyId], data)
      setDraft({
        enabled: data.settings.enabled,
        selected_fields: data.settings.selected_fields,
        prize_slots: data.settings.prize_slots,
        exclude_previous_winners: data.settings.exclude_previous_winners,
      })
      setDirty(false)
      toast({
        title: 'Lottery saved',
        description: 'Prize slots and entrant fields are ready for the next draw.',
        variant: 'success',
      })
    },
  })

  const drawMutation = useMutation({
    mutationFn: (payload) => drawSurveyLotteryWinner(surveyId, payload),
  })

  const resetMutation = useMutation({
    mutationFn: () => resetSurveyLottery(surveyId),
    onSuccess: (data) => {
      queryClient.setQueryData([LOTTERY_QUERY_KEY, surveyId], data)
      setPendingDrawResult(null)
      setCelebrationDraw(null)
      setDirty(false)
      toast({
        title: 'Lottery reset',
        description: 'All saved winners were cleared for this survey.',
        variant: 'success',
      })
    },
  })

  const lotteryData = lotteryQuery.data
  const history = useMemo(() => lotteryData?.history ?? [], [lotteryData?.history])
  const availableFields = useMemo(
    () => lotteryData?.available_fields ?? [],
    [lotteryData?.available_fields]
  )
  const openPrizeSlots = useMemo(() => {
    const usedLabels = new Set(history.map((entry) => entry.prize_label))
    return draft.prize_slots.filter((label) => !usedLabels.has(label))
  }, [draft.prize_slots, history])

  useEffect(() => {
    if (!lotteryData || dirty) {
      return
    }

    setDraft({
      enabled: lotteryData.settings.enabled,
      selected_fields: lotteryData.settings.selected_fields,
      prize_slots: lotteryData.settings.prize_slots,
      exclude_previous_winners: lotteryData.settings.exclude_previous_winners,
    })
  }, [dirty, lotteryData])

  useEffect(() => {
    if (!lotteryData || isSpinning) {
      return
    }

    setWheelEntries(lotteryData.entries ?? [])
  }, [isSpinning, lotteryData])

  useEffect(() => {
    if (!currentPrizeLabel || openPrizeSlots.includes(currentPrizeLabel)) {
      if (currentPrizeLabel || !openPrizeSlots.length) {
        return
      }
    }

    setCurrentPrizeLabel(getNextOpenPrizeLabel(draft.prize_slots, history))
  }, [currentPrizeLabel, draft.prize_slots, history, openPrizeSlots])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current)
      }
      if (!audio) {
        return
      }
      audio.pause()
      audio.currentTime = 0
    }
  }, [])

  const fieldGroups = useMemo(() => {
    return availableFields.reduce((groups, field) => {
      const groupKey = field.page_title || 'Response'
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(field)
      return groups
    }, {})
  }, [availableFields])

  const selectedFieldBadges = useMemo(() => {
    const selectedLookup = new Set(draft.selected_fields)
    return availableFields.filter((field) => selectedLookup.has(field.id))
  }, [availableFields, draft.selected_fields])

  const displayedEntries = isSpinning ? wheelEntries : lotteryData?.entries ?? []
  const highlightedWinnerResponseId =
    celebrationDraw?.response_id || history[history.length - 1]?.response_id || ''
  const nextPrizeLabel = currentPrizeLabel || getNextOpenPrizeLabel(draft.prize_slots, history)
  const stats = lotteryData?.stats ?? {
    completed_responses: 0,
    eligible_entries: 0,
    drawn_count: 0,
    remaining_prize_slots: draft.prize_slots.length,
  }

  const stopSpinAudio = () => {
    const audio = audioRef.current
    if (!audio) {
      return
    }
    audio.pause()
    audio.currentTime = 0
    audioRef.current = null
  }

  const playSpinAudio = async () => {
    if (!soundEnabled) {
      return
    }

    stopSpinAudio()
    const audio = new Audio(LOTTERY_SOUND_PATH)
    audio.loop = true
    audio.volume = 0.72
    audio.playbackRate = 1.08
    audioRef.current = audio

    try {
      await audio.play()
    } catch (error) {
      audioRef.current = null
    }
  }

  const playFinishAudio = async () => {
    if (!soundEnabled) {
      return
    }

    try {
      const finishAudio = new Audio(LOTTERY_WIN_SOUND_PATH)
      finishAudio.volume = 0.88
      await finishAudio.play()
    } catch (error) {
      return
    }
  }

  const updateDraft = (patch) => {
    setDraft((current) => ({
      ...current,
      ...patch,
    }))
    setDirty(true)
  }

  const toggleSelectedField = (fieldId) => {
    setDraft((current) => {
      const selected = new Set(current.selected_fields)
      if (selected.has(fieldId)) {
        selected.delete(fieldId)
      } else {
        selected.add(fieldId)
      }

      return {
        ...current,
        selected_fields: Array.from(selected),
      }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    const payload = normalizeLotteryDraft(draft)
    if (!payload.prize_slots.length) {
      toast({
        title: 'Prize slots required',
        description: 'Add at least one prize slot before saving the lottery.',
        variant: 'warning',
      })
      return
    }

    await saveMutation.mutateAsync(payload)
  }

  const handleSpin = async () => {
    if (isSpinning) {
      return
    }

    const payload = normalizeLotteryDraft(draft)
    if (!payload.selected_fields.length) {
      toast({
        title: 'Select entrant fields',
        description: 'Choose one or more survey fields to label the wheel entries.',
        variant: 'warning',
      })
      return
    }

    if (!nextPrizeLabel) {
      toast({
        title: 'No open prize slots',
        description: 'Reset the lottery or add more prize slots to continue drawing.',
        variant: 'info',
      })
      return
    }

    try {
      if (dirty) {
        await saveMutation.mutateAsync(payload)
      }

      const drawResult = await drawMutation.mutateAsync({
        prize_label: nextPrizeLabel,
      })
      const drawEntries = drawResult.entries ?? []
      const winnerIndex = drawEntries.findIndex(
        (entry) => entry.response_id === drawResult.draw.response_id
      )

      if (winnerIndex < 0 || !drawEntries.length) {
        throw new Error('The winner was not found in the draw pool.')
      }

      setPendingDrawResult(drawResult)
      setCelebrationDraw(null)
      setWheelEntries(drawEntries)
      setIsSpinning(true)
      setRotation((currentRotation) =>
        buildNextRotation(currentRotation, winnerIndex, drawEntries.length)
      )
      await playSpinAudio()
    } catch (error) {
      toast({
        title: 'Spin failed',
        description:
          error?.response?.data?.detail ||
          error?.message ||
          'The prize wheel could not complete this draw.',
        variant: 'error',
      })
    }
  }

  const handleWheelTransitionEnd = () => {
    if (!isSpinning) {
      return
    }

    stopSpinAudio()
    setIsSpinning(false)

    if (pendingDrawResult) {
      const { draw, entries, history: nextHistory, settings } = pendingDrawResult
      const nextEntries = settings.exclude_previous_winners
        ? entries.filter((entry) => entry.response_id !== draw.response_id)
        : entries

      queryClient.setQueryData([LOTTERY_QUERY_KEY, surveyId], (current) => ({
        ...(current ?? {}),
        settings,
        available_fields: current?.available_fields ?? [],
        entries: nextEntries,
        history: nextHistory,
        stats: {
          ...(current?.stats ?? {}),
          completed_responses: current?.stats?.completed_responses ?? 0,
          eligible_entries: nextEntries.length,
          drawn_count: nextHistory.length,
          remaining_prize_slots: Math.max(settings.prize_slots.length - nextHistory.length, 0),
        },
      }))

      setPendingDrawResult(null)
      setCelebrationDraw(draw)
      setCurrentPrizeLabel(getNextOpenPrizeLabel(settings.prize_slots, nextHistory))
      playFinishAudio()

      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current)
      }
      celebrationTimerRef.current = window.setTimeout(() => {
        setCelebrationDraw(null)
        celebrationTimerRef.current = null
      }, 4200)

      toast({
        title: `${draw.prize_label} winner selected`,
        description: draw.entry_label,
        variant: 'success',
      })
    }
  }

  if (surveyQuery.isLoading || lotteryQuery.isLoading) {
    return (
      <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-6">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <Skeleton className="h-20 w-full rounded-[2rem]" />
          <Skeleton className="h-[640px] w-full rounded-[2.5rem]" />
        </div>
      </div>
    )
  }

  if (surveyQuery.isError || lotteryQuery.isError || !surveyQuery.data || !lotteryData) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <Card className="max-w-xl rounded-[2rem] border-rose-200 bg-rose-50">
          <CardContent className="space-y-4 p-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-rose-900">
              Lottery workspace unavailable
            </h1>
            <p className="text-sm leading-6 text-rose-700">
              {surveyQuery.error?.response?.data?.detail ||
                lotteryQuery.error?.response?.data?.detail ||
                'The survey lottery page could not be loaded.'}
            </p>
            <Button className="rounded-full" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const survey = surveyQuery.data

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="theme-panel rounded-[2.2rem] px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-2xl"
              onClick={() => navigate(`/surveys/${surveyId}/analyze`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{survey.status}</Badge>
                <Badge variant="outline">Lottery workspace</Badge>
                <Badge variant="outline">{stats.eligible_entries} eligible entrants</Badge>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                {survey.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                Pick prize fields, configure the award slots, and spin a branded wheel tied to completed survey responses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => setSoundEnabled((current) => !current)}
              >
                {soundEnabled ? (
                  <Volume2 className="mr-2 h-4 w-4" />
                ) : (
                  <VolumeX className="mr-2 h-4 w-4" />
                )}
                Sound
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={resetMutation.isPending || isSpinning || !history.length}
                onClick={() => {
                  if (window.confirm('Clear all saved winners for this survey lottery?')) {
                    resetMutation.mutate()
                  }
                }}
              >
                {resetMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                Reset winners
              </Button>
              <Button
                type="button"
                className="rounded-full"
                disabled={saveMutation.isPending || isSpinning}
                onClick={handleSave}
              >
                {saveMutation.isPending ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save setup
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
            <div className="theme-panel overflow-hidden rounded-[2.5rem] p-4 md:p-5">
              <div className="relative">
                <LotteryWheel
                  entries={displayedEntries}
                  rotation={rotation}
                  isSpinning={isSpinning}
                  prizeLabel={nextPrizeLabel || celebrationDraw?.prize_label}
                  winnerResponseId={highlightedWinnerResponseId}
                  onTransitionEnd={handleWheelTransitionEnd}
                />

                <div className="absolute inset-0 z-20 flex items-center justify-center p-6">
                  <Button
                    type="button"
                    className="h-28 w-28 rounded-full border border-white/12 bg-white/92 p-0 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.25)] backdrop-blur md:h-32 md:w-32"
                    disabled={
                      isSpinning ||
                      drawMutation.isPending ||
                      saveMutation.isPending ||
                      !draft.selected_fields.length ||
                      !openPrizeSlots.length
                    }
                    onClick={handleSpin}
                    >
                    <span className="flex flex-col items-center justify-center text-center">
                      {isSpinning || drawMutation.isPending ? (
                        <LoaderCircle className="h-7 w-7 animate-spin" />
                      ) : (
                        <Sparkles className="h-7 w-7" />
                      )}
                      <span className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em]">
                        {isSpinning ? 'Spinning' : 'Spin'}
                      </span>
                      <span className="mt-1 max-w-[5.5rem] text-[10px] leading-4 text-slate-500">
                        {nextPrizeLabel || 'Prize'}
                      </span>
                    </span>
                  </Button>
                </div>

                {celebrationDraw ? (
                  <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(250,204,21,0.3),rgba(255,255,255,0.06)_44%,rgba(15,23,42,0.56))] backdrop-blur-[4px]" />
                    <div className="absolute left-8 top-8 h-28 w-28 rounded-full bg-amber-300/30 blur-3xl animate-ping" />
                    <div className="absolute bottom-10 right-10 h-24 w-24 rounded-full bg-rose-300/26 blur-3xl animate-ping" />
                    <div className="absolute right-20 top-16 h-16 w-16 rounded-full bg-sky-300/22 blur-2xl animate-ping" />
                    <div className="relative w-full max-w-2xl rounded-[2.35rem] border border-white/20 bg-white/94 px-8 py-10 text-center shadow-[0_32px_100px_rgba(15,23,42,0.34)] sm:px-10 sm:py-12">
                      <Badge variant="success">Winner locked</Badge>
                      <div className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-[rgb(var(--theme-primary-soft-rgb)/0.72)] shadow-[0_18px_40px_rgba(251,191,36,0.26)]">
                        <Trophy className="h-10 w-10 text-amber-500" />
                      </div>
                      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                        {celebrationDraw.prize_label}
                      </p>
                      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                        {celebrationDraw.entry_label}
                      </h2>
                      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                        The wheel has locked the winner for this prize slot. Save the moment, then continue to the next draw when you are ready.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                        {celebrationDraw.selected_values.map((value) => (
                          <Badge
                            key={`${celebrationDraw.id}-${value.field_id}`}
                            variant="outline"
                            className="px-3 py-1 text-sm"
                          >
                            {value.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <Card className="theme-panel rounded-[2.5rem]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="theme-icon-accent flex h-12 w-12 items-center justify-center rounded-2xl">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Prize slot & winner board</CardTitle>
                    <CardDescription>
                      Choose the active prize slot and reveal winners one spin at a time.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.4rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Completed
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      {stats.completed_responses}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Drawn
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                      {stats.drawn_count}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Prize slot</label>
                  <CustomSelect
                    value={nextPrizeLabel}
                    onChange={setCurrentPrizeLabel}
                    options={openPrizeSlots.map((label) => ({
                      value: label,
                      label,
                    }))}
                    placeholder={openPrizeSlots.length ? 'Choose a prize slot' : 'No open prize slots'}
                    disabled={!openPrizeSlots.length || isSpinning}
                    triggerClassName="rounded-[1.35rem]"
                  />
                </div>

                <div className="space-y-3">
                  {draft.prize_slots.map((slot) => {
                    const winner = history.find((entry) => entry.prize_label === slot)

                    return (
                      <div
                        key={slot}
                        className={`rounded-[1.45rem] border px-4 py-4 ${
                          winner
                            ? 'border-amber-200 bg-[linear-gradient(160deg,rgba(251,191,36,0.14),rgba(255,255,255,0.96))]'
                            : 'border-[rgb(var(--theme-border-rgb)/0.72)] bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {slot}
                          </p>
                          {winner ? <Badge variant="success">Drawn</Badge> : <Badge variant="outline">Open</Badge>}
                        </div>
                        <p className="mt-3 text-base font-semibold tracking-tight text-foreground">
                          {winner ? winner.entry_label : isSpinning && slot === nextPrizeLabel ? 'Wheel is spinning...' : 'Waiting for the wheel'}
                        </p>
                        {winner?.selected_values?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {winner.selected_values.map((value) => (
                              <Badge key={`${slot}-${value.field_id}`} variant="outline">
                                {value.value}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="theme-panel rounded-[2rem]">
            <CardContent className="space-y-4 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Prize slots
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Keep the slot editor horizontal so the wheel stays dominant.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[3, 4].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => updateDraft({ prize_slots: buildPrizeSlots(count) })}
                    >
                      Top {count}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      updateDraft({
                        prize_slots: [
                          ...draft.prize_slots,
                          `Prize ${draft.prize_slots.length + 1}`,
                        ],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add slot
                  </Button>
                  <div className="ml-2 flex items-center gap-3 rounded-full border border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-neutral-rgb))] px-4 py-2">
                    <span className="text-sm font-medium text-foreground">Exclude previous winners</span>
                    <Switch
                      checked={draft.exclude_previous_winners}
                      onCheckedChange={(checked) =>
                        updateDraft({ exclude_previous_winners: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {draft.prize_slots.map((slot, index) => (
                  <div
                    key={`${slot}-${index}`}
                    className="flex min-w-[200px] flex-1 items-center gap-3 rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white px-4 py-3"
                  >
                    <Input
                      value={slot}
                      onChange={(event) =>
                        updateDraft({
                          prize_slots: draft.prize_slots.map((currentSlot, slotIndex) =>
                            slotIndex === index ? event.target.value : currentSlot
                          ),
                        })
                      }
                      className="border-none p-0 shadow-none focus-visible:ring-0"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="rounded-full"
                      disabled={draft.prize_slots.length <= 1}
                      onClick={() =>
                        updateDraft({
                          prize_slots: draft.prize_slots.filter((_, slotIndex) => slotIndex !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="theme-panel rounded-[2.1rem]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="theme-icon-secondary flex h-11 w-11 items-center justify-center rounded-2xl">
                      <WandSparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Entrant fields</CardTitle>
                      <CardDescription>
                        Choose the answer fields that should label each ticket on the wheel.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedFieldBadges.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedFieldBadges.map((field) => (
                        <Badge key={field.id} variant="secondary">
                          {field.label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No fields selected yet. Pick at least one to generate wheel labels.
                    </p>
                  )}

                  <div className="space-y-4">
                    {Object.entries(fieldGroups).map(([groupLabel, fields]) => (
                      <div key={groupLabel} className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {groupLabel}
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {fields.map((field) => {
                            const checked = draft.selected_fields.includes(field.id)

                            return (
                              <button
                                key={field.id}
                                type="button"
                                className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                                  checked
                                    ? 'border-[rgb(var(--theme-primary-rgb))] bg-[rgb(var(--theme-primary-soft-rgb)/0.62)]'
                                    : 'border-[rgb(var(--theme-border-rgb)/0.72)] bg-white hover:border-[rgb(var(--theme-primary-rgb)/0.35)]'
                                }`}
                                onClick={() => toggleSelectedField(field.id)}
                              >
                                <div className="flex items-start gap-3">
                                  <input type="checkbox" checked={checked} readOnly className="mt-1" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                      {field.label}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {field.source_type === 'demographic'
                                        ? 'Demographic field'
                                        : field.source_type === 'response'
                                          ? 'Response profile'
                                          : 'Question answer'}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            <Card className="theme-panel rounded-[2.1rem]">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="theme-icon-secondary flex h-11 w-11 items-center justify-center rounded-2xl">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Entrant preview</CardTitle>
                    <CardDescription>
                      Responses with values in the chosen fields will enter the wheel.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-neutral-rgb))] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Eligible entrants
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {stats.eligible_entries}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Fields selected
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {draft.selected_fields.length}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(lotteryData.entries ?? []).slice(0, 8).map((entry) => (
                    <div
                      key={entry.response_id}
                      className="rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.72)] bg-white px-4 py-4"
                    >
                      <p className="text-sm font-medium text-foreground">{entry.entry_label}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.selected_values.map((value) => (
                          <Badge key={`${entry.response_id}-${value.field_id}`} variant="outline">
                            {value.label}: {value.value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!lotteryData.entries?.length ? (
                    <div className="rounded-[1.35rem] border border-dashed border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-neutral-rgb))] px-4 py-5 text-sm text-muted-foreground">
                      No entrants yet. Save the field selection to generate the wheel pool.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
