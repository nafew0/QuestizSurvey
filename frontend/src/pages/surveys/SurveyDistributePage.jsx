import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import {
  ArrowLeft,
  Copy,
  Globe,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  QrCode,
  Send,
  Share2,
} from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
import {
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
} from 'react-share'
import { QRCodeSVG } from 'qrcode.react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSiteTheme } from '@/contexts/SiteThemeContext'
import { useToast } from '@/hooks/useToast'
import {
  createCollector,
  listCollectorInvitations,
  listCollectors,
  sendCollectorEmails,
  sendCollectorReminders,
  updateCollector,
} from '@/services/collectors'
import { fetchSurvey } from '@/services/surveys'
import { normalizeSurvey } from '@/utils/surveyBuilder'

const DISTRIBUTION_TABS = [
  { id: 'web_link', label: 'Web Link', icon: Globe },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'embed', label: 'Embed', icon: MonitorSmartphone },
  { id: 'social', label: 'Social', icon: Share2 },
  { id: 'qr', label: 'QR Code', icon: QrCode },
]

const DEFAULT_COLLECTORS = [
  {
    type: 'web_link',
    name: 'Web Link',
    settings: {
      password_enabled: false,
      password: '',
      response_limit: '',
      close_date: '',
    },
  },
  {
    type: 'email',
    name: 'Email Invitations',
    settings: {
      email_subject: '',
      email_message: '',
    },
  },
  {
    type: 'embed',
    name: 'Embed',
    settings: {},
  },
  {
    type: 'social',
    name: 'Social Share',
    settings: {},
  },
  {
    type: 'qr',
    name: 'QR Code',
    settings: {},
  },
]

const INVITATION_BADGE_VARIANTS = {
  pending: 'outline',
  sent: 'secondary',
  opened: 'default',
  completed: 'success',
  bounced: 'danger',
}

function formatDateTimeInput(value) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const pad = (part) => `${part}`.padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function toIsoDateTime(value) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return parsed.toISOString()
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not yet'
  }

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildPopupEmbedCode(publicUrl) {
  return `<button id="questiz-launch">Open survey</button>
<script>
  (function () {
    var button = document.getElementById('questiz-launch');
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.62);display:none;align-items:center;justify-content:center;padding:24px;z-index:9999;';
    overlay.innerHTML = '<div style="position:relative;width:min(960px,100%);height:min(720px,100%);background:#fff;border-radius:24px;overflow:hidden;"><button style="position:absolute;top:12px;right:12px;z-index:2;border:0;background:#fff;border-radius:999px;padding:8px 12px;cursor:pointer;" id="questiz-close">Close</button><iframe src="${publicUrl}" style="width:100%;height:100%;border:0;"></iframe></div>';
    document.body.appendChild(overlay);
    button.addEventListener('click', function () {
      overlay.style.display = 'flex';
    });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay || event.target.id === 'questiz-close') {
        overlay.style.display = 'none';
      }
    });
  }());
</script>`
}

function buildIframeEmbedCode(publicUrl) {
  return `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" style="border:0;border-radius:24px;overflow:hidden;"></iframe>`
}

function addUtmSource(url, source) {
  const shareUrl = new URL(url)
  shareUrl.searchParams.set('utm_source', source)
  return shareUrl.toString()
}

function getCollector(collectors, type) {
  return collectors.find((collector) => collector.type === type) ?? null
}

async function copyText(text, toast, messages) {
  try {
    await navigator.clipboard.writeText(text)
    toast({
      title: messages.title,
      description: messages.description,
      variant: 'success',
    })
  } catch (error) {
    toast({
      title: 'Copy failed',
      description: 'Clipboard access was not available in this browser.',
      variant: 'error',
    })
  }
}

export default function SurveyDistributePage() {
  const navigate = useNavigate()
  const { surveyId = '' } = useParams()
  const { activeColors } = useSiteTheme()
  const { toast } = useToast()
  const qrRef = useRef(null)

  const [survey, setSurvey] = useState(null)
  const [collectors, setCollectors] = useState([])
  const [invitations, setInvitations] = useState([])
  const [selectedTab, setSelectedTab] = useState('web_link')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingTab, setSavingTab] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [remindingIds, setRemindingIds] = useState([])
  const [embedMode, setEmbedMode] = useState('iframe')

  const [webLinkForm, setWebLinkForm] = useState({
    password_enabled: false,
    password: '',
    response_limit: '',
    close_date: '',
  })
  const [emailForm, setEmailForm] = useState({
    emailsText: '',
    subject: '',
    message: '',
  })
  const [qrColor, setQrColor] = useState(activeColors.primary)

  const publicUrl = useMemo(() => {
    if (!survey) {
      return ''
    }
    return `${window.location.origin}/s/${survey.slug}`
  }, [survey])

  const emailCollector = useMemo(
    () => getCollector(collectors, 'email'),
    [collectors]
  )

  const embedCode = useMemo(() => {
    if (!publicUrl) {
      return ''
    }

    return embedMode === 'popup'
      ? buildPopupEmbedCode(publicUrl)
      : buildIframeEmbedCode(publicUrl)
  }, [embedMode, publicUrl])

  const loadInvitations = useCallback(
    async (collectorId) => {
      if (!collectorId) {
        setInvitations([])
        return
      }

      const nextInvitations = await listCollectorInvitations(surveyId, collectorId)
      setInvitations(nextInvitations)
    },
    [surveyId]
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const [surveyResponse, collectorsResponse] = await Promise.all([
          fetchSurvey(surveyId),
          listCollectors(surveyId),
        ])

        const nextSurvey = normalizeSurvey(surveyResponse)
        const existingCollectors = [...collectorsResponse]
        const missingDefinitions = DEFAULT_COLLECTORS.filter(
          ({ type }) =>
            !existingCollectors.some((collector) => collector.type === type)
        )

        if (missingDefinitions.length) {
          const createdCollectors = await Promise.all(
            missingDefinitions.map((definition) =>
              createCollector(surveyId, definition)
            )
          )
          existingCollectors.push(...createdCollectors)
        }

        if (cancelled) {
          return
        }

        setSurvey(nextSurvey)
        setCollectors(existingCollectors)

        const nextWebCollector = getCollector(existingCollectors, 'web_link')
        const nextEmailCollector = getCollector(existingCollectors, 'email')
        const nextQrCollector = getCollector(existingCollectors, 'qr')

        setWebLinkForm({
          password_enabled: Boolean(nextWebCollector?.settings?.password_enabled),
          password: nextWebCollector?.settings?.password || '',
          response_limit:
            nextWebCollector?.settings?.response_limit?.toString?.() || '',
          close_date: formatDateTimeInput(nextWebCollector?.settings?.close_date),
        })
        setEmailForm((current) => ({
          ...current,
          subject: nextEmailCollector?.settings?.email_subject || '',
          message: nextEmailCollector?.settings?.email_message || '',
        }))
        setQrColor(
          nextQrCollector?.settings?.foreground_color ||
            nextSurvey.theme?.primary ||
            activeColors.primary
        )

        await loadInvitations(nextEmailCollector?.id)
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || 'Unable to load distribution tools.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [activeColors.primary, loadInvitations, surveyId])

  const saveCollectorSettings = async (collectorType, settings) => {
    const collector = getCollector(collectors, collectorType)
    if (!collector) {
      return
    }

    setSavingTab(collectorType)
    try {
      const updatedCollector = await updateCollector(surveyId, collector.id, {
        settings: {
          ...(collector.settings ?? {}),
          ...settings,
        },
      })

      setCollectors((current) =>
        current.map((entry) =>
          entry.id === updatedCollector.id ? updatedCollector : entry
        )
      )
      toast({
        title: 'Settings saved',
        description: 'Collector settings were updated.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Save failed',
        description:
          err.response?.data?.detail || 'Collector settings could not be saved.',
        variant: 'error',
      })
    } finally {
      setSavingTab('')
    }
  }

  const handleSendInvitations = async () => {
    if (!emailCollector) {
      return
    }

    setEmailSending(true)
    try {
      await sendCollectorEmails(surveyId, emailCollector.id, {
        emails_text: emailForm.emailsText,
        subject: emailForm.subject,
        message: emailForm.message,
      })

      setEmailForm((current) => ({
        ...current,
        emailsText: '',
      }))

      await loadInvitations(emailCollector.id)
      setCollectors((current) =>
        current.map((collector) =>
          collector.id === emailCollector.id
            ? {
                ...collector,
                settings: {
                  ...(collector.settings ?? {}),
                  email_subject: emailForm.subject,
                  email_message: emailForm.message,
                },
              }
            : collector
        )
      )
      toast({
        title: 'Invitations queued',
        description: 'The email invitations have been queued for delivery.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Invitation send failed',
        description:
          err.response?.data?.detail || 'The invitations could not be queued.',
        variant: 'error',
      })
    } finally {
      setEmailSending(false)
    }
  }

  const handleSendReminder = async (invitationIds = []) => {
    if (!emailCollector) {
      return
    }

    setRemindingIds(invitationIds)
    try {
      await sendCollectorReminders(surveyId, emailCollector.id, {
        invitation_ids: invitationIds.length ? invitationIds : undefined,
      })
      await loadInvitations(emailCollector.id)
      toast({
        title: 'Reminder queued',
        description: 'Reminder emails have been queued.',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Reminder failed',
        description:
          err.response?.data?.detail || 'Reminder emails could not be queued.',
        variant: 'error',
      })
    } finally {
      setRemindingIds([])
    }
  }

  const handleDownloadQrPng = async () => {
    if (!qrRef.current || !survey) {
      return
    }

    const canvas = await html2canvas(qrRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    })
    const link = document.createElement('a')
    link.download = `${survey.slug}-qr.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleDownloadQrSvg = () => {
    if (!qrRef.current || !survey) {
      return
    }

    const svg = qrRef.current.querySelector('svg')
    if (!svg) {
      return
    }

    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${survey.slug}-qr.svg`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintQr = () => {
    if (!survey) {
      return
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      return
    }

    printWindow.document.write(`
      <html>
        <head><title>${survey.title} QR Code</title></head>
        <body style="font-family:Arial,sans-serif;text-align:center;padding:32px;">
          <h1>${survey.title}</h1>
          <p>${publicUrl}</p>
          ${qrRef.current?.innerHTML || ''}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  if (loading) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="theme-panel flex items-center gap-3 rounded-2xl px-5 py-4">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Loading distribution tools
          </span>
        </div>
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="theme-app-gradient flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="max-w-lg rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-rose-900">
            Distribution unavailable
          </h1>
          <p className="mt-3 text-sm leading-7 text-rose-700">
            {error || 'The distribution workspace could not be loaded.'}
          </p>
          <Button
            className="mt-6 rounded-2xl"
            onClick={() => navigate(`/surveys/${surveyId}/edit`)}
          >
            Back to builder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="theme-panel rounded-[2rem] px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to builder
                </Button>
                <Badge variant="default">Phase 4 Distribution</Badge>
                <Badge variant="outline">/{survey.slug}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  Share {survey.title}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                  Configure public access, send invitations, generate embed code, and create share assets from one workspace.
                </p>
              </div>
            </div>

            <div className="theme-panel-soft flex flex-wrap items-center gap-2 rounded-[1.5rem] p-2">
              {DISTRIBUTION_TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      selectedTab === tab.id
                        ? 'bg-white text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {selectedTab === 'web_link' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Public survey link</CardTitle>
                <CardDescription>
                  This is the shareable respondent URL for your survey.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Public URL
                  </p>
                  <p className="mt-2 break-all text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]">
                    {publicUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    copyText(publicUrl, toast, {
                      title: 'Public link copied',
                      description: 'The shareable survey link is on your clipboard.',
                    })
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </Button>
              </CardContent>
            </Card>

            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Access settings</CardTitle>
                <CardDescription>
                  Control access for the web-link collector.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Password protection
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Require a password before the survey opens.
                    </p>
                  </div>
                  <Switch
                    checked={webLinkForm.password_enabled}
                    onCheckedChange={(checked) =>
                      setWebLinkForm((current) => ({
                        ...current,
                        password_enabled: checked,
                      }))
                    }
                  />
                </div>

                {webLinkForm.password_enabled ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Password
                    </label>
                    <Input
                      value={webLinkForm.password}
                      onChange={(event) =>
                        setWebLinkForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      placeholder="Enter access password"
                      className="rounded-2xl"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Response limit
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={webLinkForm.response_limit}
                    onChange={(event) =>
                      setWebLinkForm((current) => ({
                        ...current,
                        response_limit: event.target.value,
                      }))
                    }
                    placeholder="Unlimited"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Close date
                  </label>
                  <Input
                    type="datetime-local"
                    value={webLinkForm.close_date}
                    onChange={(event) =>
                      setWebLinkForm((current) => ({
                        ...current,
                        close_date: event.target.value,
                      }))
                    }
                    className="rounded-2xl"
                  />
                </div>

                <Button
                  type="button"
                  className="rounded-2xl"
                  disabled={savingTab === 'web_link'}
                  onClick={() =>
                    saveCollectorSettings('web_link', {
                      password_enabled: webLinkForm.password_enabled,
                      password: webLinkForm.password_enabled
                        ? webLinkForm.password
                        : '',
                      response_limit: webLinkForm.response_limit
                        ? Number(webLinkForm.response_limit)
                        : '',
                      close_date: toIsoDateTime(webLinkForm.close_date),
                    })
                  }
                >
                  {savingTab === 'web_link' ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save web link settings
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {selectedTab === 'email' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Email invitations</CardTitle>
                <CardDescription>
                  Paste one recipient per line, customize the message, and queue invitation emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Recipient list
                  </label>
                  <Textarea
                    value={emailForm.emailsText}
                    onChange={(event) =>
                      setEmailForm((current) => ({
                        ...current,
                        emailsText: event.target.value,
                      }))
                    }
                    placeholder={'alex@example.com\njamie@example.com\nsam@example.com'}
                    className="min-h-[180px] rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Subject
                  </label>
                  <Input
                    value={emailForm.subject}
                    onChange={(event) =>
                      setEmailForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder={`You are invited to ${survey.title}`}
                    className="rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Message
                  </label>
                  <Textarea
                    value={emailForm.message}
                    onChange={(event) =>
                      setEmailForm((current) => ({
                        ...current,
                        message: event.target.value,
                      }))
                    }
                    placeholder="Add a short note before the survey link."
                    className="rounded-2xl"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className="rounded-2xl"
                    disabled={emailSending}
                    onClick={handleSendInvitations}
                  >
                    {emailSending ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send invitations
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={!invitations.length || remindingIds.length > 0}
                    onClick={() => handleSendReminder([])}
                  >
                    Send reminder to incomplete
                  </Button>
                </div>

                <div className="overflow-hidden rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white">
                  <div className="grid grid-cols-[1.5fr_120px_160px_160px_120px] gap-4 border-b border-[rgb(var(--theme-border-rgb)/0.82)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <span>Email</span>
                    <span>Status</span>
                    <span>Sent</span>
                    <span>Opened</span>
                    <span>Action</span>
                  </div>
                  <div className="divide-y divide-[rgb(var(--theme-border-rgb)/0.72)]">
                    {invitations.length ? (
                      invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className="grid grid-cols-[1.5fr_120px_160px_160px_120px] items-center gap-4 px-4 py-3 text-sm"
                        >
                          <span className="truncate text-foreground">
                            {invitation.email}
                          </span>
                          <Badge
                            variant={
                              INVITATION_BADGE_VARIANTS[invitation.status] || 'outline'
                            }
                          >
                            {invitation.status}
                          </Badge>
                          <span className="text-muted-foreground">
                            {formatTimestamp(invitation.sent_at)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatTimestamp(invitation.opened_at)}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            disabled={
                              invitation.status === 'completed' ||
                              remindingIds.includes(invitation.id)
                            }
                            onClick={() => handleSendReminder([invitation.id])}
                          >
                            {remindingIds.includes(invitation.id) ? 'Queueing' : 'Remind'}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No invitations have been sent yet.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Email preview</CardTitle>
                <CardDescription>
                  This is the structure recipients will receive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Email subject
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">
                    {emailForm.subject || `You are invited to ${survey.title}`}
                  </p>
                  <div className="mt-5 rounded-[1.5rem] bg-[rgb(var(--theme-neutral-rgb)/0.72)] p-5">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {emailForm.message || 'You have been invited to take part in this survey.'}
                    </p>
                    <Button type="button" className="mt-5 rounded-2xl">
                      Open survey
                    </Button>
                    <p className="mt-4 break-all text-xs text-primary">
                      {publicUrl}?invite=unique-token
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {selectedTab === 'embed' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Embed code</CardTitle>
                <CardDescription>
                  Generate embed code for iframe or popup delivery.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="theme-panel-soft inline-flex rounded-[1.5rem] p-1">
                  {[
                    ['iframe', 'Iframe'],
                    ['popup', 'Popup'],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEmbedMode(mode)}
                      className={`rounded-[1.25rem] px-4 py-2 text-sm font-medium transition ${
                        embedMode === mode
                          ? 'bg-white text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <pre className="overflow-x-auto rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.72)] p-4 text-xs leading-6 text-[rgb(var(--theme-secondary-ink-rgb))]">
                  <code>{embedCode}</code>
                </pre>

                <Button
                  type="button"
                  className="rounded-2xl"
                  onClick={() =>
                    copyText(embedCode, toast, {
                      title: 'Embed code copied',
                      description: 'The embed snippet is on your clipboard.',
                    })
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy code
                </Button>
              </CardContent>
            </Card>

            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Live preview</CardTitle>
                <CardDescription>
                  Preview the selected embed style.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {embedMode === 'iframe' ? (
                  <div className="overflow-hidden rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white">
                    <iframe
                      src={publicUrl}
                      title="Survey embed preview"
                      className="h-[420px] w-full border-0"
                    />
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-6 text-center">
                    <p className="text-sm leading-7 text-muted-foreground">
                      Popup embeds launch the live survey in an overlay from a trigger button.
                    </p>
                    <Button
                      type="button"
                      className="mt-5 rounded-2xl"
                      onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}
                    >
                      Preview popup launch
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {selectedTab === 'social' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Social sharing</CardTitle>
                <CardDescription>
                  Share the public survey URL with pre-filled tracking links.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-5">
                    <FacebookShareButton
                      url={addUtmSource(publicUrl, 'facebook')}
                      quote={`Take part in ${survey.title}`}
                    >
                      <div className="flex items-center gap-4">
                        <FacebookIcon size={48} round />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">Facebook</p>
                          <p className="text-xs text-muted-foreground">
                            Share with `utm_source=facebook`
                          </p>
                        </div>
                      </div>
                    </FacebookShareButton>
                  </div>
                  <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-5">
                    <TwitterShareButton
                      url={addUtmSource(publicUrl, 'twitter')}
                      title={`Take part in ${survey.title}`}
                    >
                      <div className="flex items-center gap-4">
                        <TwitterIcon size={48} round />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">X / Twitter</p>
                          <p className="text-xs text-muted-foreground">
                            Share with `utm_source=twitter`
                          </p>
                        </div>
                      </div>
                    </TwitterShareButton>
                  </div>
                  <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-5">
                    <LinkedinShareButton
                      url={addUtmSource(publicUrl, 'linkedin')}
                      title={survey.title}
                      summary={survey.description}
                    >
                      <div className="flex items-center gap-4">
                        <LinkedinIcon size={48} round />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">LinkedIn</p>
                          <p className="text-xs text-muted-foreground">
                            Share with `utm_source=linkedin`
                          </p>
                        </div>
                      </div>
                    </LinkedinShareButton>
                  </div>
                  <div className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-5">
                    <EmailShareButton
                      url={addUtmSource(publicUrl, 'email')}
                      subject={`Take part in ${survey.title}`}
                      body={survey.description || 'Please share your feedback using this survey.'}
                    >
                      <div className="flex items-center gap-4">
                        <EmailIcon size={48} round />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">Email</p>
                          <p className="text-xs text-muted-foreground">
                            Share with `utm_source=email`
                          </p>
                        </div>
                      </div>
                    </EmailShareButton>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Tracking note</CardTitle>
                <CardDescription>
                  Each share option appends a UTM source for downstream response attribution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>Facebook: {addUtmSource(publicUrl, 'facebook')}</p>
                <p>Twitter: {addUtmSource(publicUrl, 'twitter')}</p>
                <p>LinkedIn: {addUtmSource(publicUrl, 'linkedin')}</p>
                <p>Email: {addUtmSource(publicUrl, 'email')}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {selectedTab === 'qr' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>QR code</CardTitle>
                <CardDescription>
                  Customize the QR foreground color and export PNG or SVG assets.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <HexColorPicker color={qrColor} onChange={setQrColor} />
                  <div className="flex items-center justify-between rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-4 py-3">
                    <span className="text-sm font-medium text-foreground">
                      Current color
                    </span>
                    <span className="text-sm text-muted-foreground">{qrColor}</span>
                  </div>
                  <Button
                    type="button"
                    className="w-full rounded-2xl"
                    disabled={savingTab === 'qr'}
                    onClick={() =>
                      saveCollectorSettings('qr', { foreground_color: qrColor })
                    }
                  >
                    {savingTab === 'qr' ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save QR color
                  </Button>
                </div>

                <div className="space-y-5">
                  <div
                    ref={qrRef}
                    className="flex flex-col items-center justify-center rounded-[2rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white p-8"
                  >
                    <QRCodeSVG
                      value={publicUrl}
                      size={240}
                      fgColor={qrColor}
                      bgColor="#ffffff"
                      includeMargin
                    />
                    <p className="mt-5 text-sm font-medium text-foreground">
                      {survey.title}
                    </p>
                    <p className="mt-2 break-all text-center text-xs text-muted-foreground">
                      {publicUrl}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="rounded-2xl"
                      onClick={handleDownloadQrPng}
                    >
                      Download PNG
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={handleDownloadQrSvg}
                    >
                      Download SVG
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl"
                      onClick={handlePrintQr}
                    >
                      Print layout
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="theme-panel rounded-[2rem]">
              <CardHeader>
                <CardTitle>Usage</CardTitle>
                <CardDescription>
                  Printed materials can route respondents directly to the live public link.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
                <p>Use the saved QR in posters, flyers, tables, and event handouts.</p>
                <p>
                  The generated code always points to the public survey URL for this
                  survey.
                </p>
                <p>Current destination: {publicUrl}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}
