import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  LayoutTemplate,
  Palette,
  QrCode,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

import BrandLogo from '@/components/branding/BrandLogo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '../contexts/AuthContext'

const CORE_FEATURES = [
  {
    icon: LayoutTemplate,
    title: 'Visual survey builder',
    description:
      'Organize multi-page flows, question logic, welcome screens, and thank-you states from one builder.',
  },
  {
    icon: Send,
    title: 'Distribution controls',
    description:
      'Launch through public links, QR-ready collectors, and tracked invitation workflows without leaving the workspace.',
  },
  {
    icon: BarChart3,
    title: 'Analytics and crosstabs',
    description:
      'Read summaries, question-level charts, cross-tab comparisons, and individual response trails in a single analysis surface.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Executive exports',
    description:
      'Move findings into PDF, XLSX, or PowerPoint deliverables when the survey is ready for stakeholders.',
  },
]

const OPERATING_PILLARS = [
  '19 question types spanning choice, grouped text, ratings, matrices, ranking, demographics, and uploads.',
  'Built-in save and continue, collector rules, response limits, and public link controls.',
  'Per-survey theming, shared reports, and export workflows for polished client delivery.',
]

const WORKFLOW_STEPS = [
  {
    title: 'Model the respondent journey',
    description: 'Draft pages, route with skip logic, and preview every branch before launch.',
  },
  {
    title: 'Collect through the right channel',
    description: 'Choose open links, targeted invitations, or QR distribution based on the audience.',
  },
  {
    title: 'Turn results into decisions',
    description: 'Read analytics, save reports, and export board-ready summaries as soon as responses land.',
  },
]

const HERO_METRICS = [
  {
    value: '17',
    label: 'Question types',
    className: 'rounded-[1.35rem_1.35rem_2.1rem_1.35rem]',
  },
  {
    value: 'PDF/XLSX/PPTX',
    label: 'Export formats',
    className: 'rounded-[1.9rem_1.2rem_1.9rem_1.2rem]',
  },
  {
    value: 'Live',
    label: 'Branding and public sharing',
    className: 'rounded-[1.2rem_2rem_1.2rem_2rem]',
  },
]

const FEATURE_CARD_SHAPES = [
  'rounded-[1.9rem_1.9rem_2.6rem_1.45rem]',
  'rounded-[1.35rem_2.2rem_1.35rem_2.2rem]',
  'rounded-[2.2rem_1.35rem_2.2rem_1.35rem]',
  'rounded-[1.55rem_1.55rem_2.35rem_1.55rem]',
]

const SHOWCASE_FLOW = [
  ['Welcome page', 'Branded intro and consent'],
  ['Qualification block', 'Skip logic routes non-fit respondents'],
  ['Experience rating', 'Feeds live analytics and exports'],
]

const SHOWCASE_CHANNELS = [
  ['Public link', 'Open'],
  ['Email collector', 'Tracked'],
  ['QR share', 'Ready'],
]

const SHOWCASE_CAPABILITIES = [
  [Palette, 'Brand each survey'],
  [ShieldCheck, 'Protect collection rules'],
  [FileSpreadsheet, 'Export for stakeholders'],
]

const HERO_TAGS = ['Skip logic', 'Public links', 'Shared reports', 'Survey branding']

const Home = () => {
  const { isAuthenticated, user } = useAuth()

  return (
    <div className="theme-app-gradient min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="container mx-auto px-4 py-8 sm:py-10">
        <section className="relative overflow-hidden rounded-[2.35rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white/72 px-6 py-8 shadow-[0_32px_90px_rgb(var(--theme-shadow-rgb)/0.12)] backdrop-blur sm:px-8 sm:py-10 xl:px-10">
          <div className="absolute -left-24 top-8 h-56 w-56 rounded-full bg-[rgb(var(--theme-primary-rgb)/0.14)] blur-3xl" />
          <div className="absolute -right-16 bottom-6 h-64 w-64 rounded-full bg-[rgb(var(--theme-accent-rgb)/0.16)] blur-3xl" />

          <div className="relative mx-auto max-w-5xl text-center">
            <div className="flex justify-center">
              <BrandLogo />
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <span className="theme-chip-secondary">Research-ready platform</span>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Builder, analytics, reports, exports
              </Badge>
            </div>

            <h1
              className="mx-auto mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))] md:text-6xl xl:text-[4.75rem]"
              style={{ fontFamily: '"Merriweather", serif' }}
            >
              Build surveys that feel polished before the first response lands.
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-[rgb(var(--theme-secondary-ink-rgb))] sm:text-xl">
              Questiz gives your team one operating system for survey design, distribution, analytics, theming, and stakeholder-ready reporting.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard">
                    <Button size="lg" className="rounded-full px-7">
                      Open workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/profile">
                    <Button size="lg" variant="outline" className="rounded-full px-7">
                      Manage profile
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" className="rounded-full px-7">
                      Start free workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" className="rounded-full px-7">
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {HERO_METRICS.map(({ value, label, className }) => (
                <div
                  key={label}
                  className={`${className} border border-white/75 bg-white/82 px-4 py-4 text-left shadow-[0_18px_45px_rgb(var(--theme-shadow-rgb)/0.08)]`}
                >
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
              {HERO_TAGS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white/70 px-3 py-1.5"
                >
                  {item}
                </span>
              ))}
            </div>

            {isAuthenticated ? (
              <p className="mt-6 text-sm font-medium text-muted-foreground">
                Welcome back, <span className="text-foreground">{user?.first_name || user?.username}</span>. Your survey workspace is ready.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-[0.34fr_0.66fr] xl:items-start">
          <div className="theme-panel rounded-[1.7rem_2.4rem_1.7rem_1.5rem] p-6 sm:p-8">
            <span className="theme-chip-secondary">Inside the workspace</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Concept test, launch, and analyze in one cleaner workflow.
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              This section carries the product detail that was crowding the hero. It shows how Questiz handles page flow, collection channels, response analysis, branding, and exports once you move past the first fold.
            </p>

            <div className="mt-6 space-y-3">
              {[
                'Preview the respondent path before launch.',
                'Open the right collector for the audience.',
                'Push findings into analytics and report exports.',
              ].map((item, index) => (
                <div
                  key={item}
                  className={`flex items-start gap-3 border border-[rgb(var(--theme-border-rgb)/0.76)] bg-[rgb(var(--theme-neutral-rgb)/0.82)] px-4 py-4 ${
                    index === 1
                      ? 'rounded-[1rem_1.7rem_1rem_1.7rem]'
                      : 'rounded-[1.3rem_1.3rem_1.95rem_1.3rem]'
                  }`}
                >
                  <div className="theme-icon-secondary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="theme-panel rounded-[2rem_2.7rem_2.35rem_1.75rem] p-5 sm:p-6">
            <div className="grid gap-5">
              <div className="flex items-center justify-between rounded-[1.35rem_1.35rem_2.2rem_1.35rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Questiz workspace
                  </p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    Concept test, launch, analyze
                  </p>
                </div>
                <div className="theme-icon-primary flex h-12 w-12 items-center justify-center rounded-[1rem_1rem_1.35rem_1rem]">
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[1.55rem_1.55rem_2.45rem_1.55rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-[rgb(var(--theme-primary-soft-rgb)/0.64)] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[rgb(var(--theme-primary-ink-rgb))]">
                        Builder map
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">Preview the full respondent path</p>
                    </div>
                    <Workflow className="h-5 w-5 text-[rgb(var(--theme-primary-rgb))]" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {SHOWCASE_FLOW.map(([title, description], index) => (
                      <div
                        key={title}
                        className={`border border-white/80 bg-white/82 px-4 py-3 ${
                          index === 0
                            ? 'rounded-[1.15rem_1.15rem_1.9rem_1.15rem]'
                            : index === 1
                              ? 'rounded-[1.55rem_1rem_1.55rem_1rem]'
                              : 'rounded-[1rem_1.8rem_1rem_1.8rem]'
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.2rem_2rem_1.2rem_2rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Collection channels</p>
                      <QrCode className="h-4 w-4 text-[rgb(var(--theme-accent-rgb))]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {SHOWCASE_CHANNELS.map(([label, status]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between rounded-[1rem_1.4rem_1rem_1.4rem] bg-[rgb(var(--theme-neutral-rgb)/0.85)] px-3 py-2.5"
                        >
                          <span className="text-sm text-foreground">{label}</span>
                          <span className="theme-chip-accent px-2 py-1 text-[10px]">{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem_1.25rem_2rem_1.25rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.72)] p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
                        Insight pulse
                      </p>
                      <BarChart3 className="h-4 w-4 text-[rgb(var(--theme-secondary-rgb))]" />
                    </div>
                    <div className="mt-4 flex items-end gap-2">
                      {[40, 70, 52, 84, 66, 94].map((height, index) => (
                        <span
                          key={index}
                          className="flex-1 rounded-t-full bg-[linear-gradient(180deg,rgb(var(--theme-secondary-rgb)/0.85),rgb(var(--theme-primary-rgb)/0.85))]"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-[rgb(var(--theme-secondary-ink-rgb))]">
                      <CheckCircle2 className="h-4 w-4" />
                      Crosstabs, summaries, and response browser ready.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {SHOWCASE_CAPABILITIES.map(([Icon, label], index) => (
                  <div
                    key={label}
                    className={`border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white px-4 py-4 ${
                      index === 0
                        ? 'rounded-[1.1rem_1.7rem_1.1rem_1.7rem]'
                        : index === 1
                          ? 'rounded-[1.8rem_1.1rem_1.8rem_1.1rem]'
                          : 'rounded-[1.35rem_1.35rem_2rem_1.35rem]'
                    }`}
                  >
                    <div className="theme-icon-accent flex h-10 w-10 items-center justify-center rounded-[1rem_1rem_1.25rem_1rem]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-4 text-sm font-semibold text-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="theme-panel rounded-[1.9rem_1.9rem_2.7rem_1.55rem] p-6 sm:p-8">
            <span className="theme-chip-primary">Why teams switch</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              One system from draft to executive readout.
            </h2>
            <div className="mt-6 space-y-4">
              {OPERATING_PILLARS.map((item, index) => (
                <div
                  key={item}
                  className={`flex items-start gap-3 bg-[rgb(var(--theme-neutral-rgb)/0.78)] px-4 py-4 ${
                    index === 1
                      ? 'rounded-[1rem_1.7rem_1rem_1.7rem]'
                      : 'rounded-[1.35rem_1.35rem_1.95rem_1.35rem]'
                  }`}
                >
                  <div className="theme-icon-secondary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {CORE_FEATURES.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className={`theme-panel p-6 ${FEATURE_CARD_SHAPES[index]}`}>
                <div className="theme-icon-primary flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="theme-panel rounded-[2rem_1.6rem_2.8rem_1.6rem] p-6 sm:p-8">
            <span className="theme-chip-accent">Operating model</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              The Questiz workflow stays tight from fielding to report-out.
            </h2>
            <div className="mt-8 space-y-5">
              {WORKFLOW_STEPS.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="theme-icon-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.55rem_2.45rem_1.9rem_2.45rem] border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[linear-gradient(180deg,rgb(var(--theme-primary-soft-rgb)/0.7),rgb(var(--theme-secondary-soft-rgb)/0.65),rgb(255_255_255/0.92))] p-6 shadow-[0_24px_70px_rgb(var(--theme-shadow-rgb)/0.1)] sm:p-8">
            <span className="theme-chip-secondary">Launch faster</span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))] sm:text-4xl">
              Ready to turn the current build into a research workspace?
            </h2>
            <p className="mt-4 text-base leading-8 text-[rgb(var(--theme-secondary-ink-rgb))]">
              Start inside the builder, wire your collectors, and move straight into live analytics once responses arrive.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <Button size="lg" className="rounded-full px-7">
                  {isAuthenticated ? 'Go to dashboard' : 'Create account'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to={isAuthenticated ? '/profile' : '/login'}>
                <Button size="lg" variant="outline" className="rounded-full px-7">
                  {isAuthenticated ? 'Update profile' : 'Sign in'}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Home
