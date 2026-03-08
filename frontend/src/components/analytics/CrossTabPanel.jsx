import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

import QBarChart from '@/components/charts/QBarChart'
import QHeatmap from '@/components/charts/QHeatmap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchCrossTab } from '@/services/analytics'

function buildHeatmapData(crosstab) {
  return (crosstab?.matrix ?? []).map((row) => ({
    id: row.row_label,
    data: row.cells.map((cell) => ({
      x: cell.col_label,
      y: cell.count,
      count: cell.count,
      percentage: cell.percentage,
    })),
  }))
}

function buildStackedBarData(crosstab) {
  return (crosstab?.matrix ?? []).map((row) => {
    const next = { label: row.row_label }
    row.cells.forEach((cell) => {
      next[cell.col_label] = cell.count
    })
    return next
  })
}

export default function CrossTabPanel({
  open,
  onOpenChange,
  surveyId,
  questionOptions,
  filters,
  value,
  onChange,
  onAddToReport,
}) {
  const [view, setView] = useState(value.view || 'table')

  useEffect(() => {
    setView(value.view || 'table')
  }, [value.view])

  const query = useQuery({
    queryKey: ['analytics-crosstab', surveyId, value.row, value.col, filters],
    queryFn: () => fetchCrossTab(surveyId, value.row, value.col, filters, true),
    enabled: open && Boolean(value.row && value.col),
  })

  const columns = useMemo(() => {
    const dynamicColumns = (query.data?.col_totals ?? []).map((item) => ({
      accessorKey: item.col_label,
      header: item.col_label,
      cell: ({ row }) => {
        const cell = row.original.cells.find((entry) => entry.col_label === item.col_label)
        return (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{cell?.count ?? 0}</p>
            <p className="text-xs text-muted-foreground">{cell?.percentage ?? 0}%</p>
          </div>
        )
      },
    }))

    return [
      {
        accessorKey: 'row_label',
        header: 'Row answer',
      },
      ...dynamicColumns,
      {
        accessorKey: 'row_total',
        header: 'Total',
      },
    ]
  }, [query.data])

  const table = useReactTable({
    data: query.data?.matrix ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const series = (query.data?.col_totals ?? []).map((item) => ({
    dataKey: item.col_label,
    name: item.col_label,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Cross-tab analysis</DialogTitle>
          <DialogDescription>
            Compare two questions and inspect the overlap between respondent segments.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <CustomSelect
            value={value.row}
            onChange={(next) => onChange({ ...value, row: next })}
            options={questionOptions}
            placeholder="Row question"
          />
          <CustomSelect
            value={value.col}
            onChange={(next) => onChange({ ...value, col: next })}
            options={questionOptions}
            placeholder="Column question"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['table', 'stacked_bar', 'heatmap'].map((option) => (
            <Button
              key={option}
              type="button"
              variant={view === option ? 'default' : 'outline'}
              className="rounded-full"
              onClick={() => {
                setView(option)
                onChange({ ...value, view: option })
              }}
            >
              {option.replaceAll('_', ' ')}
            </Button>
          ))}
          <Button type="button" className="ml-auto rounded-full" onClick={() => onAddToReport?.({ ...value, view })}>
            Add to report
          </Button>
        </div>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-[360px] w-full" />
          </div>
        ) : query.data ? (
          <div className="space-y-4">
            {view === 'table' ? (
              <div className="overflow-hidden rounded-[1.75rem] border border-[rgb(var(--theme-border-rgb)/0.82)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
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
                        <tr key={row.id} className="border-t border-[rgb(var(--theme-border-rgb)/0.75)]">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 align-top">
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

                <div className="flex flex-wrap items-center gap-3 border-t border-[rgb(var(--theme-border-rgb)/0.75)] bg-[rgb(var(--theme-neutral-rgb)/0.55)] px-4 py-3 text-sm">
                  <Badge variant={query.data.chi_square.significant ? 'success' : 'outline'}>
                    {query.data.chi_square.significant ? 'Significant' : 'Not significant'}
                  </Badge>
                  <span className="text-muted-foreground">
                    χ² {query.data.chi_square.statistic} • p {query.data.chi_square.p_value}
                  </span>
                </div>
              </div>
            ) : null}

            {view === 'stacked_bar' ? (
              <QBarChart
                data={buildStackedBarData(query.data)}
                nameKey="label"
                series={series}
                stacked
                showLabels
              />
            ) : null}

            {view === 'heatmap' ? (
              <QHeatmap data={buildHeatmapData(query.data)} />
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
