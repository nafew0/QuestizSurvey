import { useMemo } from 'react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import QBarChart from '@/components/charts/QBarChart'
import QHeatmap from '@/components/charts/QHeatmap'
import { Badge } from '@/components/ui/badge'

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

export default function CrossTabReadOnlyCard({ crosstab }) {
  const view = crosstab?.view || 'table'

  const columns = useMemo(() => {
    const dynamicColumns = (crosstab?.col_totals ?? []).map((item) => ({
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
        header: crosstab?.row_question?.text || 'Row answer',
      },
      ...dynamicColumns,
      {
        accessorKey: 'row_total',
        header: 'Total',
      },
    ]
  }, [crosstab])

  const table = useReactTable({
    data: crosstab?.matrix ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const series = (crosstab?.col_totals ?? []).map((item) => ({
    dataKey: item.col_label,
    name: item.col_label,
  }))

  return (
    <section className="theme-panel rounded-[2rem] p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Cross-tab</Badge>
            <Badge variant="secondary">{view.replaceAll('_', ' ')}</Badge>
          </div>
          <h3 className="mt-3 text-base font-semibold tracking-tight text-foreground">
            {crosstab?.row_question?.text} × {crosstab?.col_question?.text}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {crosstab?.response_pairs ?? 0} paired responses compared.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={crosstab?.chi_square?.significant ? 'success' : 'outline'}>
            {crosstab?.chi_square?.significant ? 'Significant' : 'Not significant'}
          </Badge>
          <Badge variant="outline">
            χ² {crosstab?.chi_square?.statistic ?? 0} • p {crosstab?.chi_square?.p_value ?? 1}
          </Badge>
        </div>
      </div>

      <div className="mt-5">
        {view === 'heatmap' ? <QHeatmap data={buildHeatmapData(crosstab)} /> : null}

        {view === 'stacked_bar' ? (
          <QBarChart
            data={buildStackedBarData(crosstab)}
            nameKey="label"
            series={series}
            stacked
            showLabels
          />
        ) : null}

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
          </div>
        ) : null}
      </div>

      {crosstab?.insights?.available ? (
        <div className="mt-5 rounded-[1.5rem] border border-[rgb(var(--theme-secondary-strong-rgb)/0.85)] bg-[rgb(var(--theme-secondary-soft-rgb)/0.75)] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--theme-secondary-ink-rgb))]">
            {crosstab.insights.headline}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--theme-secondary-ink-rgb))]">
            {crosstab.insights.bullets.map((bullet) => (
              <li key={bullet}>• {bullet}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
