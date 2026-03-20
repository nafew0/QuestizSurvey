import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Globe2,
  LayoutTemplate,
  Mail,
  QrCode,
  Send,
  Share2,
  Sparkles,
  WandSparkles,
} from 'lucide-react'

import BrandLogo from '@/components/branding/BrandLogo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

const TRUSTED_TRACK = [
  'Product Research',
  'CX Programs',
  'Innovation Labs',
  'Field Operations',
  'Advisory Studios',
  'Learning Teams',
]

const ANALYTICS_CARDS = [
  {
    icon: BarChart3,
    title: 'Bar chart',
    description: 'Watch segment volume rise as responses land.',
  },
  {
    icon: LayoutTemplate,
    title: 'Pie chart',
    description: 'Read contribution share without opening a report.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Line graph',
    description: 'Track movement over time in one cleaner trend view.',
  },
]

const DISTRIBUTION_NODES = [
  {
    icon: Mail,
    label: 'Email campaign',
    meta: 'Tracked invites',
    positionClassName: 'left-[8%] top-6',
  },
  {
    icon: Share2,
    label: 'Social share',
    meta: 'Public link',
    positionClassName: 'left-[6%] bottom-10',
  },
  {
    icon: Globe2,
    label: 'Web embed',
    meta: 'Owned channels',
    positionClassName: 'right-[6%] top-12',
  },
  {
    icon: QrCode,
    label: 'Smart QR',
    meta: 'Offline to online',
    positionClassName: 'right-[14%] bottom-8',
  },
]

const FOOTER_LINKS = [
  ['Upgrade', '/pricing'],
  ['Login', '/login'],
  ['Register', '/register'],
]

function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return (
    <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
      <span className="theme-chip-secondary">{eyebrow}</span>
      <h2 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-muted-foreground sm:text-lg">
        {description}
      </p>
    </div>
  )
}

function HeroVisual() {
  return (
    <div className="mx-auto w-full max-w-[30rem]">
      <div className="rotate-[3.25deg]">
        <div className="rounded-[2rem] border border-[rgb(var(--theme-primary-rgb)/0.48)] bg-white p-5 shadow-[0_28px_70px_rgb(var(--theme-shadow-rgb)/0.14)] sm:p-6 home-float">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-400 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-[rgb(var(--theme-secondary-soft-rgb))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[rgb(var(--theme-primary-ink-rgb))]">
              Live pulse
            </span>
          </div>

          <div className="mt-14">
            <p className="text-[2rem] font-semibold tracking-tight text-[rgb(var(--theme-primary-ink-rgb))] sm:text-[2.35rem]">
              Customer Sentiments
            </p>
            <div className="mt-6 space-y-4">
              {[
                ['78%', 'rgb(var(--theme-primary-rgb))', '0ms'],
                ['52%', 'rgb(var(--theme-secondary-rgb))', '240ms'],
                ['90%', 'rgb(24 118 170)', '480ms'],
              ].map(([width, color, delay]) => (
                <div key={width} className="h-2.5 overflow-hidden rounded-full bg-[rgb(var(--theme-border-rgb)/0.65)]">
                  <div
                    className="home-signal-bar h-full rounded-full"
                    style={{
                      width,
                      background: color,
                      animationDelay: delay,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-20 border-t border-[rgb(var(--theme-border-rgb)/0.74)] pt-6">
            <p className="text-sm italic text-muted-foreground">
              “The insights generated are transformative...”
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsBand() {
  const pieSegments = [
    { label: 'Promoters', percent: 42, color: 'rgb(var(--theme-primary-rgb))' },
    { label: 'Passive', percent: 33, color: 'rgb(var(--theme-secondary-rgb))' },
    { label: 'At risk', percent: 25, color: 'rgb(var(--theme-accent-rgb))' },
  ]
  const circumference = 2 * Math.PI * 30
  let accumulatedOffset = 0

  return (
    <section className="border-y border-[rgb(var(--theme-border-rgb)/0.72)] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[0.82fr_1.18fr] xl:items-center">
          <div>
            <span className="theme-chip-accent">Analytics</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Read the signal faster.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Move from raw responses to clearer trends with live bars, distribution share, and time-series movement in one analysis layer.
            </p>

            <div className="mt-6 space-y-3">
              {[
                'Spot spikes in response volume at a glance.',
                'See audience share without tab-hopping.',
                'Track trend direction before exporting insights.',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.56)] px-4 py-4 text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ANALYTICS_CARDS.map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="theme-panel-soft rounded-3xl px-5 py-5">
                <div className="theme-icon-primary flex h-11 w-11 items-center justify-center rounded-2xl">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p>

                {index === 0 ? (
                  <div className="mt-6 rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.62)] px-4 pb-4 pt-6">
                    <div className="flex h-36 items-end gap-3">
                      {[
                        ['28%', '0ms'],
                        ['54%', '120ms'],
                        ['42%', '240ms'],
                        ['72%', '360ms'],
                        ['58%', '480ms'],
                        ['84%', '600ms'],
                      ].map(([height, delay], barIndex) => (
                        <div key={delay} className="flex h-full flex-1 items-end">
                          <div
                            className={cn(
                              'home-bar-rise w-full rounded-t-[1rem]',
                              barIndex % 3 === 0
                                ? 'bg-[rgb(var(--theme-primary-rgb))]'
                                : barIndex % 3 === 1
                                  ? 'bg-[rgb(var(--theme-secondary-rgb))]'
                                  : 'bg-[rgb(var(--theme-accent-rgb))]'
                            )}
                            style={{
                              height,
                              animationDelay: delay,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span>Mon</span>
                      <span>Fri</span>
                    </div>
                  </div>
                ) : null}

                {index === 1 ? (
                  <div className="mt-6 rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.62)] p-5">
                    <div className="flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="h-36 w-36">
                        <circle
                          cx="50"
                          cy="50"
                          r="30"
                          fill="none"
                          stroke="rgb(var(--theme-border-rgb))"
                          strokeWidth="16"
                        />
                        {pieSegments.map((segment, segmentIndex) => {
                          const segmentLength = (circumference * segment.percent) / 100
                          const segmentOffset = accumulatedOffset
                          accumulatedOffset += segmentLength

                          return (
                            <circle
                              key={segment.label}
                              cx="50"
                              cy="50"
                              r="30"
                              fill="none"
                              stroke={segment.color}
                              strokeWidth="16"
                              strokeLinecap="round"
                              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                              strokeDashoffset={-segmentOffset}
                              transform="rotate(-90 50 50)"
                              className="home-ring-settle"
                              style={{ animationDelay: `${segmentIndex * 160}ms` }}
                            />
                          )
                        })}
                        <text
                          x="50"
                          y="48"
                          textAnchor="middle"
                          className="fill-[rgb(var(--theme-primary-ink-rgb))] text-[12px] font-semibold"
                        >
                          84%
                        </text>
                        <text
                          x="50"
                          y="60"
                          textAnchor="middle"
                          className="fill-muted-foreground text-[5px] font-semibold uppercase tracking-[0.28em]"
                        >
                          Clarity
                        </text>
                      </svg>
                    </div>

                    <div className="mt-4 space-y-2">
                      {pieSegments.map((segment) => (
                        <div key={segment.label} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: segment.color }}
                            />
                            <span className="text-[rgb(var(--theme-secondary-ink-rgb))]">
                              {segment.label}
                            </span>
                          </div>
                          <span className="font-semibold text-foreground">{segment.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {index === 2 ? (
                  <div className="mt-6 rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.62)] p-4">
                    <svg viewBox="0 0 200 96" className="h-36 w-full overflow-visible">
                      {[18, 42, 66].map((lineY) => (
                        <line
                          key={lineY}
                          x1="8"
                          y1={lineY}
                          x2="192"
                          y2={lineY}
                          stroke="rgb(var(--theme-border-rgb))"
                          strokeWidth="1"
                        />
                      ))}
                      <polyline
                        points="12,72 42,60 74,66 108,38 140,46 188,20"
                        fill="none"
                        stroke="rgb(var(--theme-primary-rgb))"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="home-line-draw"
                      />
                      {[
                        [12, 72, '0ms'],
                        [42, 60, '120ms'],
                        [74, 66, '240ms'],
                        [108, 38, '360ms'],
                        [140, 46, '480ms'],
                        [188, 20, '600ms'],
                      ].map(([cx, cy, delay]) => (
                        <circle
                          key={`${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r="4.5"
                          fill="rgb(var(--theme-secondary-rgb))"
                          className="home-chart-point"
                          style={{ animationDelay: delay }}
                        />
                      ))}
                    </svg>
                    <div className="mt-2 flex justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <span>Week 1</span>
                      <span>Week 6</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function InsightConversation() {
  return (
    <div className="theme-panel h-full rounded-3xl p-6 sm:p-7">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3">
          <div className="theme-icon-accent flex h-11 w-11 items-center justify-center rounded-2xl">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI analytical partner</p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgb(var(--theme-primary-rgb))]">
              Synthesizing
            </p>
          </div>
        </div>

        <div className="mt-7 flex-1 space-y-4">
          <div className="max-w-[85%] rounded-3xl rounded-bl-md bg-[rgb(var(--theme-neutral-rgb))] px-4 py-3 text-sm leading-6 text-muted-foreground">
            “Based on 1,400 responses, preference for guided onboarding jumped 23%. Do you want the follow-up cut by segment?”
          </div>
          <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-md border border-[rgb(var(--theme-primary-rgb)/0.18)] bg-[rgb(var(--theme-primary-soft-rgb)/0.72)] px-4 py-3 text-sm font-medium leading-6 text-[rgb(var(--theme-primary-ink-rgb))]">
            “Yes. Draft the summary for the executive readout and highlight churn-risk respondents.”
          </div>
          <div className="flex gap-2 px-2">
            <span className="home-typing-dot h-2.5 w-2.5 rounded-full bg-[rgb(var(--theme-secondary-rgb)/0.35)]" />
            <span
              className="home-typing-dot h-2.5 w-2.5 rounded-full bg-[rgb(var(--theme-secondary-rgb)/0.35)]"
              style={{ animationDelay: '180ms' }}
            />
            <span
              className="home-typing-dot h-2.5 w-2.5 rounded-full bg-[rgb(var(--theme-secondary-rgb)/0.35)]"
              style={{ animationDelay: '360ms' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DistributionMap() {
  return (
    <>
      <div className="relative mx-auto mt-14 hidden h-[26rem] max-w-5xl md:block">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[rgb(var(--theme-border-rgb)/0.95)]" />
        <div className="absolute left-1/2 top-1/2 h-px w-[60%] -translate-x-1/2 -translate-y-1/2 bg-[rgb(var(--theme-border-rgb)/0.9)]" />
        <div className="absolute left-1/2 top-1/2 h-[60%] w-px -translate-x-1/2 -translate-y-1/2 bg-[rgb(var(--theme-border-rgb)/0.9)]" />

        {DISTRIBUTION_NODES.map(({ icon: Icon, label, meta, positionClassName }, index) => (
          <div
            key={label}
            className={cn(
              'theme-panel-soft absolute w-40 rounded-3xl px-4 py-4 home-orbit-node',
              positionClassName
            )}
            style={{ animationDelay: `${index * 240}ms` }}
          >
            <div className="theme-icon-secondary flex h-11 w-11 items-center justify-center rounded-2xl">
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {meta}
            </p>
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[rgb(var(--theme-primary-rgb)/0.22)] bg-white shadow-[0_20px_46px_rgb(var(--theme-shadow-rgb)/0.12)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--theme-primary-rgb))]">
              <Send className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:hidden">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[rgb(var(--theme-primary-rgb)/0.22)] bg-white shadow-[0_20px_46px_rgb(var(--theme-shadow-rgb)/0.12)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--theme-primary-rgb))]">
            <Send className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {DISTRIBUTION_NODES.map(({ icon: Icon, label, meta }, index) => (
            <div
              key={label}
              className={cn(
                'theme-panel-soft rounded-3xl px-4 py-4',
                index % 2 === 1 && 'sm:translate-y-6'
              )}
            >
              <div className="theme-icon-secondary flex h-11 w-11 items-center justify-center rounded-2xl">
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">{label}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {meta}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default function Home() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-white" style={{ fontFamily: '"Inter", sans-serif' }}>
      <section className="border-b border-[rgb(var(--theme-border-rgb)/0.72)]">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12 lg:px-8 lg:pt-14">
          <div className="home-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[rgb(var(--theme-secondary-rgb))]">
              The Future of Feedback
            </p>

            <h1 className="mt-6 max-w-4xl text-[3.3rem] font-semibold leading-[0.94] tracking-[-0.04em] text-[rgb(var(--theme-primary-ink-rgb))] sm:text-[4.8rem] xl:text-[5.7rem]">
              Transforming{' '}
              <span
                className="font-normal italic text-[rgb(var(--theme-primary-rgb))]"
                style={{ fontFamily: '"Merriweather", serif' }}
              >
                data
              </span>{' '}
              into actionable brilliance.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[rgb(var(--theme-secondary-ink-rgb))] sm:text-xl">
              mindspear is an editorial-first survey workspace built for teams that want cleaner design, smarter distribution, and better analysis.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <Button size="lg" className="rounded-full px-7">
                  {isAuthenticated ? 'Open Workspace' : 'Start Building'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="rounded-full px-7" asChild>
                <a href="#builder">View Demo</a>
              </Button>
            </div>
          </div>

          <div className="mt-10 home-fade-up lg:mt-0" style={{ animationDelay: '120ms' }}>
            <HeroVisual />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Trusted by insight-led teams
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {TRUSTED_TRACK.map((item, index) => (
              <div
                key={item}
                className={cn(
                  'rounded-full border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-5 py-3 text-sm font-medium text-[rgb(var(--theme-secondary-ink-rgb))]',
                  index % 2 === 1 && 'home-float'
                )}
                style={index % 2 === 1 ? { animationDelay: `${index * 180}ms` } : undefined}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="builder" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <SectionHeading
          eyebrow="The Analytical Luminary"
          title="The Analytical Luminary"
          description="We’ve reimagined data collection as a premium editorial experience."
        />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.22fr_0.78fr]">
          <div className="theme-panel rounded-3xl p-6 sm:p-8">
            <span className="theme-chip-primary">Smart Builder</span>
            <h3 className="mt-5 max-w-lg text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Architectural precision for your inquiries.
            </h3>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
              Create beautiful, logic-aware surveys that adapt in real time.
            </p>
            <a
              href="#analytics"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[rgb(var(--theme-primary-rgb))] transition-transform hover:translate-x-1"
            >
              Explore Builder
              <ArrowRight className="h-4 w-4" />
            </a>

            <div className="mt-8 overflow-hidden rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-[rgb(var(--theme-neutral-rgb)/0.72)] p-4">
              <img
                src="/branding/homepagebuilder.webp"
                alt="MindSpear smart builder preview"
                className="h-56 w-full rounded-2xl object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="h-full overflow-hidden rounded-3xl border border-[rgb(var(--theme-accent-rgb)/0.2)] bg-[linear-gradient(180deg,rgb(38_51_86),rgb(54_53_95))] p-6 text-white shadow-[0_28px_80px_rgb(var(--theme-shadow-rgb)/0.16)] sm:p-7">
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-[rgb(var(--theme-secondary-rgb))] text-[rgb(var(--theme-accent-rgb))]">
                  <WandSparkles className="h-7 w-7" />
                </div>
                <h3 className="mt-10 text-[2.3rem] font-semibold tracking-tight text-white">
                  Question Improver
                </h3>
                <p className="mt-5 max-w-sm text-lg leading-9 text-white/62">
                  Our engine analyzes your phrasing for bias and clarity, ensuring every response is high-fidelity.
                </p>
              </div>

              <div className="mt-10 rounded-[1.75rem] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/62">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span>Optimization active</span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/12">
                  <div
                    className="home-signal-bar h-full w-[88%] rounded-full bg-[linear-gradient(90deg,rgb(var(--theme-secondary-rgb)),rgb(var(--theme-primary-rgb)))]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="border-y border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-muted-rgb))] py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-stretch gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="home-fade-up h-full">
              <InsightConversation />
            </div>

            <div className="home-fade-up flex h-full max-w-2xl flex-col justify-center lg:pl-8" style={{ animationDelay: '120ms' }}>
              <span className="theme-chip-accent">Conversational intelligence</span>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                Your data now speaks human.
              </h2>
              <p className="mt-5 text-base leading-8 text-muted-foreground sm:text-lg">
                Ask complex questions about your survey and get clearer answers without a spreadsheet detour.
              </p>

              <div className="mt-7 space-y-4">
                {[
                  'Ask follow-up questions in plain language.',
                  'Generate executive summaries without cleanup.',
                  'Surface patterns and drop-offs faster.',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-3xl border border-[rgb(var(--theme-border-rgb)/0.82)] bg-white px-4 py-4 shadow-[0_14px_32px_rgb(var(--theme-shadow-rgb)/0.05)]"
                  >
                    <div className="theme-icon-secondary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-7 text-[rgb(var(--theme-secondary-ink-rgb))]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id="analytics">
        <AnalyticsBand />
      </div>

      <section id="distribution" className="border-y border-[rgb(var(--theme-border-rgb)/0.72)] bg-[rgb(var(--theme-muted-rgb))]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <SectionHeading
            eyebrow="Omni Distribution"
            title="Reach your audience wherever they are."
            description="One link, multiple channels, cleaner delivery."
            align="center"
          />

          <DistributionMap />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8 lg:pb-10">
        <div className="rounded-3xl border border-[rgb(var(--theme-accent-rgb)/0.16)] bg-[rgb(var(--theme-accent-ink-rgb))] px-6 py-12 text-white shadow-[0_24px_60px_rgb(var(--theme-shadow-rgb)/0.14)] sm:px-10 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full border border-white/14 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
              Ready when you are
            </span>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Ready to unlock deeper insights?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
              Start with the builder, launch through the right channel, and move directly into analysis.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={isAuthenticated ? '/dashboard' : '/register'}>
                <Button size="lg" className="rounded-full px-7">
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started Free'}
                </Button>
              </Link>
              <Link to="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/18 bg-white/6 px-7 text-white hover:bg-white/12 hover:text-white"
                >
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <footer className="mt-8 flex flex-col gap-5 border-t border-[rgb(var(--theme-border-rgb)/0.72)] py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <BrandLogo compact imageClassName="h-[1.3rem] w-[7rem] sm:h-[1.45rem] sm:w-[7.8rem]" />
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              mindspear • survey intelligence
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {FOOTER_LINKS.map(([label, to]) => (
              <Link key={label} to={to} className="transition-colors hover:text-foreground">
                {label}
              </Link>
            ))}
          </div>
        </footer>
      </section>
    </div>
  )
}
