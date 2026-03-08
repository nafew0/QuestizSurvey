import { useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table'
import { BarChart3, Expand, PieChart as PieChartIcon, Table2, Tags } from 'lucide-react'

import QBarChart from '@/components/charts/QBarChart'
import QGaugeChart from '@/components/charts/QGaugeChart'
import QHeatmap from '@/components/charts/QHeatmap'
import QLineChart from '@/components/charts/QLineChart'
import QPieChart from '@/components/charts/QPieChart'
import QTreemap from '@/components/charts/QTreemap'
import QWaffleChart from '@/components/charts/QWaffleChart'
import QWordCloud from '@/components/charts/QWordCloud'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HelpPopover } from '@/components/ui/help-popover'
import { Switch } from '@/components/ui/switch'
import {
  buildCategoricalTableRows,
  buildMatrixHeatmapData,
  buildNumericDistributionRows,
  buildTextFrequencyRows,
  getQuestionTypeLabel,
} from '@/lib/analytics'

const COLOR_OPTIONS = [
  { value: 'default', label: 'Default Blue' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'monochrome', label: 'Monochrome' },
  { value: 'pastel', label: 'Pastel' },
  { value: 'vibrant', label: 'Vibrant' },
]

function getDefaultChartType(analytics) {
  switch (analytics.type) {
    case 'categorical':
      return analytics.question?.type === 'yes_no' ? 'waffle' : 'bar'
    case 'numeric':
      return analytics.question?.type === 'nps' ? 'gauge' : 'bar'
    case 'text':
      return 'word_cloud'
    case 'matrix':
      return 'heatmap'
    case 'ranking':
      return 'horizontal_bar'
    case 'constant_sum':
      return 'bar'
    case 'temporal':
      return 'line'
    case 'demographics':
      return 'treemap'
    case 'files':
      return 'table'
    default:
      return 'bar'
  }
}

function getChartOptions(analytics) {
  switch (analytics.type) {
    case 'categorical':
      return [
        { value: 'bar', label: 'Bar', icon: BarChart3 },
        { value: 'pie', label: 'Pie', icon: PieChartIcon },
        { value: 'donut', label: 'Donut', icon: PieChartIcon },
        { value: 'horizontal_bar', label: 'H Bar', icon: BarChart3 },
        ...(analytics.question?.type === 'yes_no' ? [{ value: 'waffle', label: 'Waffle', icon: Tags }] : []),
      ]
    case 'numeric':
      return [
        { value: 'bar', label: 'Bar', icon: BarChart3 },
        { value: 'line', label: 'Line', icon: BarChart3 },
        { value: 'area', label: 'Area', icon: BarChart3 },
        ...(analytics.question?.type === 'nps' ? [{ value: 'gauge', label: 'Gauge', icon: Tags }] : []),
      ]
    case 'text':
      return [
        { value: 'word_cloud', label: 'Word Cloud', icon: Tags },
        { value: 'response_list', label: 'Responses', icon: Table2 },
      ]
    case 'matrix':
      return [
        { value: 'heatmap', label: 'Heatmap', icon: Tags },
        { value: 'stacked_bar', label: 'Stacked', icon: BarChart3 },
        { value: 'grouped_bar', label: 'Grouped', icon: BarChart3 },
      ]
    case 'ranking':
      return [
        { value: 'horizontal_bar', label: 'H Bar', icon: BarChart3 },
        { value: 'table', label: 'Table', icon: Table2 },
      ]
    case 'constant_sum':
      return [
        { value: 'bar', label: 'Bar', icon: BarChart3 },
        { value: 'pie', label: 'Pie', icon: PieChartIcon },
      ]
    case 'temporal':
      return [
        { value: 'line', label: 'Line', icon: BarChart3 },
        { value: 'bar', label: 'Bar', icon: BarChart3 },
      ]
    case 'demographics':
      return [
        { value: 'treemap', label: 'Treemap', icon: Tags },
        { value: 'bar', label: 'Bar', icon: BarChart3 },
      ]
    case 'files':
      return [{ value: 'table', label: 'Table', icon: Table2 }]
    default:
      return [{ value: 'bar', label: 'Bar', icon: BarChart3 }]
  }
}

function buildTableConfig(analytics) {
  switch (analytics.type) {
    case 'categorical':
      return {
        data: buildCategoricalTableRows(analytics),
        columns: [
          { accessorKey: 'label', header: 'Label' },
          { accessorKey: 'count', header: 'Count' },
          { accessorKey: 'percentage', header: '%' },
        ],
      }
    case 'numeric':
      return {
        data: buildNumericDistributionRows(analytics),
        columns: [
          { accessorKey: 'label', header: 'Value' },
          { accessorKey: 'count', header: 'Count' },
          { accessorKey: 'percentage', header: '%' },
        ],
      }
    case 'ranking':
      return {
        data: analytics.items ?? [],
        columns: [
          { accessorKey: 'text', header: 'Item' },
          { accessorKey: 'avg_rank', header: 'Avg rank' },
        ],
      }
    case 'constant_sum':
      return {
        data: analytics.items ?? [],
        columns: [
          { accessorKey: 'text', header: 'Item' },
          { accessorKey: 'mean_value', header: 'Mean' },
          { accessorKey: 'total_value', header: 'Total' },
          { accessorKey: 'percentage', header: '%' },
        ],
      }
    case 'temporal':
      return {
        data: analytics.distribution?.map((entry) => ({ label: entry.date_bucket, count: entry.count })) ?? [],
        columns: [
          { accessorKey: 'label', header: 'Bucket' },
          { accessorKey: 'count', header: 'Count' },
        ],
      }
    case 'demographics':
      return {
        data: Object.entries(analytics.fields ?? {}).flatMap(([field, items]) =>
          items.map((item) => ({
            field,
            value: item.value,
            count: item.count,
            percentage: item.percentage,
          }))
        ),
        columns: [
          { accessorKey: 'field', header: 'Field' },
          { accessorKey: 'value', header: 'Value' },
          { accessorKey: 'count', header: 'Count' },
          { accessorKey: 'percentage', header: '%' },
        ],
      }
    case 'files':
      return {
        data: analytics.files ?? [],
        columns: [
          { accessorKey: 'file_url', header: 'File' },
          { accessorKey: 'file_type', header: 'Type' },
          { accessorKey: 'answered_at', header: 'Answered' },
        ],
      }
    default:
      return {
        data: [],
        columns: [],
      }
  }
}

function AnalyticsTable({ analytics }) {
  const [sorting, setSorting] = useState([])
  const tableConfig = useMemo(() => buildTableConfig(analytics), [analytics])

  const table = useReactTable({
    data: tableConfig.data,
    columns: tableConfig.columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!tableConfig.data.length) {
    return null
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.78)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[rgb(var(--theme-neutral-rgb))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-semibold text-foreground">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-[rgb(var(--theme-border-rgb)/0.72)]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top text-muted-foreground">
                    {cell.column.columnDef.cell
                      ? flexRender(cell.column.columnDef.cell, cell.getContext())
                      : `${cell.getValue() ?? '—'}`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function buildDemographicsTreemap(analytics) {
  return {
    name: 'Demographics',
    children: Object.entries(analytics.fields ?? {}).map(([field, items]) => ({
      name: field,
      children: items.slice(0, 6).map((item) => ({
        name: item.value,
        value: item.count,
      })),
    })),
  }
}

function renderChart(analytics, chartType, colorScheme, showLabels, onWordClick) {
  if (analytics.type === 'categorical') {
    const data = (analytics.choices ?? []).map((choice) => ({
      label: choice.text,
      count: choice.count,
      percentage: choice.percentage,
    }))
    if (chartType === 'pie') {
      return <QPieChart data={data} colorScheme={colorScheme} showLabels={showLabels} />
    }
    if (chartType === 'donut') {
      return <QPieChart data={data} colorScheme={colorScheme} showLabels={showLabels} donut />
    }
    if (chartType === 'waffle') {
      return (
        <QWaffleChart
          data={data.map((item) => ({ id: item.label, label: item.label, value: Math.round(item.percentage) }))}
          total={100}
          colorScheme={colorScheme}
        />
      )
    }
    return (
      <QBarChart
        data={data}
        dataKey="count"
        nameKey="label"
        colorScheme={colorScheme}
        showLabels={showLabels}
        orientation={chartType === 'horizontal_bar' ? 'horizontal' : 'vertical'}
      />
    )
  }

  if (analytics.type === 'numeric') {
    const data = (analytics.distribution ?? []).map((item) => ({
      label: String(item.value),
      count: item.count,
    }))
    if (chartType === 'gauge') {
      return <QGaugeChart value={analytics.nps_score ?? analytics.mean ?? 0} />
    }
    if (chartType === 'line' || chartType === 'area') {
      return (
        <QLineChart
          data={data}
          colorScheme={colorScheme}
          lines={[{ dataKey: 'count', name: 'Responses' }]}
          showArea={chartType === 'area'}
        />
      )
    }
    return <QBarChart data={data} dataKey="count" nameKey="label" colorScheme={colorScheme} showLabels={showLabels} />
  }

  if (analytics.type === 'text') {
    if (chartType === 'response_list') {
      return (
        <div className="space-y-3">
          {(analytics.responses ?? []).slice(0, 8).map((response, index) => (
            <div key={`${response.responded_at}-${index}`} className="rounded-2xl bg-[rgb(var(--theme-neutral-rgb))] px-4 py-3 text-sm leading-6 text-foreground">
              {response.text}
            </div>
          ))}
        </div>
      )
    }
    return (
      <QWordCloud
        words={buildTextFrequencyRows(analytics)}
        colorScheme={colorScheme}
        onWordClick={onWordClick}
      />
    )
  }

  if (analytics.type === 'matrix') {
    if (chartType === 'heatmap') {
      return <QHeatmap data={buildMatrixHeatmapData(analytics)} colorScheme={colorScheme} />
    }

    const data = (analytics.rows ?? []).map((row) => {
      const next = { label: row.row_label }
      row.columns.forEach((column) => {
        next[column.col_label] = column.count
      })
      return next
    })

    const series = (analytics.rows?.[0]?.columns ?? []).map((column) => ({
      dataKey: column.col_label,
      name: column.col_label,
    }))

    return (
      <QBarChart
        data={data}
        nameKey="label"
        series={series}
        colorScheme={colorScheme}
        stacked={chartType === 'stacked_bar'}
      />
    )
  }

  if (analytics.type === 'ranking') {
    if (chartType === 'table') {
      return <AnalyticsTable analytics={analytics} />
    }
    return (
      <QBarChart
        data={(analytics.items ?? []).map((item) => ({ label: item.text, count: item.avg_rank ?? 0 }))}
        dataKey="count"
        nameKey="label"
        colorScheme={colorScheme}
        orientation="horizontal"
      />
    )
  }

  if (analytics.type === 'constant_sum') {
    const data = (analytics.items ?? []).map((item) => ({ label: item.text, count: item.total_value, percentage: item.percentage }))
    if (chartType === 'pie') {
      return <QPieChart data={data} colorScheme={colorScheme} donut />
    }
    return <QBarChart data={data} dataKey="count" nameKey="label" colorScheme={colorScheme} showLabels={showLabels} />
  }

  if (analytics.type === 'temporal') {
    const data = (analytics.distribution ?? []).map((item) => ({ label: item.date_bucket, count: item.count }))
    if (chartType === 'bar') {
      return <QBarChart data={data} dataKey="count" nameKey="label" colorScheme={colorScheme} showLabels={showLabels} />
    }
    return <QLineChart data={data} colorScheme={colorScheme} lines={[{ dataKey: 'count', name: 'Responses' }]} />
  }

  if (analytics.type === 'demographics') {
    if (chartType === 'treemap') {
      return <QTreemap data={buildDemographicsTreemap(analytics)} colorScheme={colorScheme} />
    }
    const firstField = Object.entries(analytics.fields ?? {})[0]
    const data = (firstField?.[1] ?? []).map((item) => ({ label: item.value, count: item.count }))
    return <QBarChart data={data} dataKey="count" nameKey="label" colorScheme={colorScheme} orientation="horizontal" />
  }

  if (analytics.type === 'files') {
    return <AnalyticsTable analytics={analytics} />
  }

  return null
}

export default function QuestionAnalyticsCard({
  analytics,
  preference,
  onPreferenceChange,
  onWordClick,
  readOnly = false,
}) {
  const cardRef = useRef(null)
  const [fullScreenOpen, setFullScreenOpen] = useState(false)
  const [localPreference, setLocalPreference] = useState(() => ({
    chartType: preference?.chartType || getDefaultChartType(analytics),
    showTable: preference?.showTable || false,
    showLabels: preference?.showLabels || false,
    colorScheme: preference?.colorScheme || 'default',
  }))

  useEffect(() => {
    setLocalPreference({
      chartType: preference?.chartType || getDefaultChartType(analytics),
      showTable: preference?.showTable || false,
      showLabels: preference?.showLabels || false,
      colorScheme: preference?.colorScheme || 'default',
    })
  }, [analytics, preference])

  const applyPreference = (next) => {
    setLocalPreference(next)
    onPreferenceChange?.(analytics.question.id, next)
  }

  const chartOptions = getChartOptions(analytics)

  const handleDownload = async () => {
    if (!cardRef.current) {
      return
    }

    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
    })
    const link = document.createElement('a')
    link.download = `${analytics.question.text.slice(0, 40).replaceAll(/\s+/g, '-').toLowerCase() || 'question'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const content = renderChart(
    analytics,
    localPreference.chartType,
    localPreference.colorScheme,
    localPreference.showLabels,
    onWordClick
  )

  return (
    <>
      <div ref={cardRef} className="theme-panel rounded-[2rem] p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{getQuestionTypeLabel(analytics.question.type)}</Badge>
              <Badge variant="secondary">N={analytics.total_responses ?? 0}</Badge>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              {analytics.question.text}
            </h3>
          </div>

          {!readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="rounded-2xl">
                  <Expand className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
                <DropdownMenuItem onSelect={handleDownload}>Download as PNG</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFullScreenOpen(true)}>Full screen view</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {!readOnly ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chartOptions.map((option) => {
              const Icon = option.icon
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={localPreference.chartType === option.value ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() =>
                    applyPreference({
                      ...localPreference,
                      chartType: option.value,
                    })
                  }
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {option.label}
                </Button>
              )
            })}

            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Show table</span>
                <Switch
                  checked={localPreference.showTable}
                  onCheckedChange={(checked) =>
                    applyPreference({
                      ...localPreference,
                      showTable: checked,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Show labels</span>
                <Switch
                  checked={localPreference.showLabels}
                  onCheckedChange={(checked) =>
                    applyPreference({
                      ...localPreference,
                      showLabels: checked,
                    })
                  }
                />
              </div>
              <CustomSelect
                value={localPreference.colorScheme}
                onChange={(value) =>
                  applyPreference({
                    ...localPreference,
                    colorScheme: value,
                  })
                }
                options={COLOR_OPTIONS}
                triggerClassName="h-10 w-[11rem] rounded-full"
                contentClassName="rounded-2xl"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-5">{content}</div>

        {analytics.insights?.available ? (
          <div className="mt-5 rounded-[1.5rem] border border-[rgb(var(--theme-secondary-strong-rgb)/0.85)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.75)] p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
                {analytics.insights.headline}
              </p>
              <HelpPopover title="AI insights">
                <p className="text-sm">
                  These bullets are generated from the aggregated analytics payload using the ChatGPT API.
                </p>
              </HelpPopover>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--theme-secondary-ink-rgb))]">
              {analytics.insights.bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {localPreference.showTable && analytics.type !== 'ranking' && analytics.type !== 'files' ? (
          <div className="mt-5">
            <AnalyticsTable analytics={analytics} />
          </div>
        ) : null}

        {analytics.type === 'categorical' && (analytics.other_responses?.length || analytics.comments?.length) ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {analytics.other_responses?.length ? (
              <div className="rounded-[1.5rem] bg-[rgb(var(--theme-neutral-rgb))] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Other responses
                </p>
                <div className="mt-3 space-y-2 text-sm text-foreground">
                  {analytics.other_responses.slice(0, 5).map((item, index) => (
                    <p key={`${item}-${index}`}>{item}</p>
                  ))}
                </div>
              </div>
            ) : null}
            {analytics.comments?.length ? (
              <div className="rounded-[1.5rem] bg-[rgb(var(--theme-neutral-rgb))] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Comments
                </p>
                <div className="mt-3 space-y-2 text-sm text-foreground">
                  {analytics.comments.slice(0, 5).map((item, index) => (
                    <p key={`${item}-${index}`}>{item}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={!readOnly && fullScreenOpen} onOpenChange={setFullScreenOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{analytics.question.text}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    </>
  )
}
