import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { AlertTriangle, Eye, Printer, Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  bulkDeleteSurveyResponses,
  deleteSurveyResponse,
  fetchSurveyResponse,
  listSurveyResponses,
} from '@/services/analytics'
import { formatDuration } from '@/lib/analytics'

const STATUS_VARIANTS = {
  completed: 'success',
  in_progress: 'warning',
}

function normalizeResponseListPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      count: payload.length,
      next: null,
      previous: null,
      results: payload,
    }
  }

  if (payload && Array.isArray(payload.results)) {
    return {
      count: Number(payload.count || 0),
      next: payload.next || null,
      previous: payload.previous || null,
      results: payload.results,
    }
  }

  return {
    count: 0,
    next: null,
    previous: null,
    results: [],
  }
}

function RenderAnswer({ answer }) {
  switch (answer.question_type) {
    case 'multiple_choice_single':
    case 'multiple_choice_multi':
    case 'dropdown':
    case 'yes_no':
    case 'image_choice':
      return (
        <div className="flex flex-wrap gap-2">
          {answer.choice_texts.map((choiceText) => (
            <Badge key={choiceText} variant="secondary">
              {choiceText}
            </Badge>
          ))}
          {answer.other_text ? <p className="w-full text-sm text-muted-foreground">Other: {answer.other_text}</p> : null}
          {answer.comment_text ? <p className="w-full text-sm text-muted-foreground">Comment: {answer.comment_text}</p> : null}
        </div>
      )
    case 'short_text':
    case 'long_text':
      return <p className="text-sm leading-6 text-foreground">{answer.text_value || 'No answer provided.'}</p>
    case 'star_rating':
    case 'rating_scale':
    case 'nps':
      return <p className="text-sm font-semibold text-foreground">{answer.numeric_value ?? 'No answer'}</p>
    case 'matrix':
      return (
        <div className="overflow-hidden rounded-2xl border border-[rgb(var(--theme-border-rgb)/0.78)]">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(answer.matrix_data || {}).map(([row, value]) => (
                <tr key={row} className="border-t first:border-t-0 border-[rgb(var(--theme-border-rgb)/0.72)]">
                  <td className="bg-[rgb(var(--theme-neutral-rgb))] px-3 py-2 font-medium text-foreground">{row}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {typeof value === 'object'
                      ? Object.entries(value)
                          .filter(([, checked]) => checked)
                          .map(([label]) => label)
                          .join(', ')
                      : value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'ranking':
      return (
        <ol className="space-y-1 pl-5 text-sm text-foreground">
          {answer.ranking_texts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      )
    case 'constant_sum':
      return (
        <div className="space-y-2">
          {answer.constant_sum_items.map((item) => (
            <div key={item.choice_id} className="flex items-center justify-between rounded-2xl bg-[rgb(var(--theme-neutral-rgb))] px-3 py-2 text-sm">
              <span className="text-foreground">{item.text}</span>
              <span className="font-semibold text-[rgb(var(--theme-secondary-rgb))]">{item.value}</span>
            </div>
          ))}
        </div>
      )
    case 'date_time':
      return <p className="text-sm text-foreground">{answer.date_value || answer.text_value || 'No answer'}</p>
    case 'demographics':
      return (
        <div className="grid gap-2 md:grid-cols-2">
          {Object.entries(answer.matrix_data || {}).map(([field, value]) => (
            <div key={field} className="rounded-2xl bg-[rgb(var(--theme-neutral-rgb))] px-3 py-2 text-sm">
              <p className="font-medium capitalize text-foreground">{field}</p>
              <p className="text-muted-foreground">{value}</p>
            </div>
          ))}
        </div>
      )
    case 'file_upload':
      return (
        <a href={answer.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Open uploaded file
        </a>
      )
    default:
      return <p className="text-sm text-muted-foreground">No renderer for this answer type.</p>
  }
}

export default function ResponseBrowser({
  surveyId,
  externalSearch = '',
  collectorLookup = {},
}) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(externalSearch)
  const [ordering, setOrdering] = useState('-started_at')
  const [selectedResponseId, setSelectedResponseId] = useState('')
  const [selectedIds, setSelectedIds] = useState({})

  useEffect(() => {
    setSearch(externalSearch || '')
    setPage(1)
  }, [externalSearch])

  const listQuery = useQuery({
    queryKey: ['survey-responses', surveyId, page, ordering, search],
    queryFn: () => listSurveyResponses(surveyId, { page, ordering, search }),
  })

  const detailQuery = useQuery({
    queryKey: ['survey-response-detail', surveyId, selectedResponseId],
    queryFn: () => fetchSurveyResponse(surveyId, selectedResponseId),
    enabled: Boolean(selectedResponseId),
  })

  const listData = useMemo(() => normalizeResponseListPayload(listQuery.data), [listQuery.data])

  useEffect(() => {
    if (!selectedResponseId && listData.results.length) {
      setSelectedResponseId(listData.results[0].id)
    }
  }, [listData.results, selectedResponseId])

  const deleteMutation = useMutation({
    mutationFn: (responseId) => deleteSurveyResponse(surveyId, responseId),
    onSuccess: () => {
      setSelectedResponseId('')
      queryClient.invalidateQueries({ queryKey: ['survey-responses', surveyId] })
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => bulkDeleteSurveyResponses(surveyId, ids),
    onSuccess: () => {
      setSelectedIds({})
      setSelectedResponseId('')
      queryClient.invalidateQueries({ queryKey: ['survey-responses', surveyId] })
    },
  })

  const rows = useMemo(() => listData.results, [listData.results])
  const detailData = selectedResponseId ? detailQuery.data : null

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            checked={rows.length > 0 && rows.every((row) => selectedIds[row.id])}
            onChange={(event) => {
              if (event.target.checked) {
                setSelectedIds(Object.fromEntries(rows.map((row) => [row.id, true])))
              } else {
                setSelectedIds({})
              }
            }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={Boolean(selectedIds[row.original.id])}
            onChange={(event) =>
              setSelectedIds((current) => ({
                ...current,
                [row.original.id]: event.target.checked,
              }))
            }
            onClick={(event) => event.stopPropagation()}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <button type="button" onClick={() => setOrdering(ordering === 'status' ? '-status' : 'status')}>Status</button>
        ),
        cell: ({ row }) => (
          <Badge variant={STATUS_VARIANTS[row.original.status] || 'outline'}>
            {row.original.status.replaceAll('_', ' ')}
          </Badge>
        ),
      },
      {
        accessorKey: 'started_at',
        header: () => (
          <button type="button" onClick={() => setOrdering(ordering === 'started_at' ? '-started_at' : 'started_at')}>Date</button>
        ),
        cell: ({ row }) => new Date(row.original.started_at).toLocaleString(),
      },
      {
        accessorKey: 'duration_seconds',
        header: () => (
          <button type="button" onClick={() => setOrdering(ordering === 'duration_seconds' ? '-duration_seconds' : 'duration_seconds')}>Duration</button>
        ),
        cell: ({ row }) => formatDuration(row.original.duration_seconds),
      },
      {
        accessorKey: 'collector',
        header: 'Collector',
        cell: ({ row }) => collectorLookup[row.original.collector] || '—',
      },
      {
        accessorKey: 'respondent_email',
        header: 'Email',
        cell: ({ row }) => row.original.respondent_email || '—',
      },
    ],
    [collectorLookup, ordering, rows, selectedIds]
  )

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedCount = Object.values(selectedIds).filter(Boolean).length

  return (
    <div className="grid min-h-[60vh] gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)]">
      <Card className="theme-panel overflow-hidden rounded-[2rem]">
        <CardHeader className="space-y-4 border-b border-[rgb(var(--theme-border-rgb)/0.72)] pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg">Responses</CardTitle>
            {selectedCount ? (
              <Button
                type="button"
                variant="destructive"
                className="rounded-full"
                onClick={() => {
                  const ids = Object.entries(selectedIds)
                    .filter(([, checked]) => checked)
                    .map(([id]) => id)
                  if (window.confirm(`Delete ${ids.length} selected response(s)?`)) {
                    bulkDeleteMutation.mutate(ids)
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedCount})
              </Button>
            ) : null}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search email, IP, or response text"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : listQuery.isError ? (
            <div className="flex min-h-[320px] items-center justify-center p-6">
              <div className="max-w-md text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm font-semibold text-foreground">Responses failed to load</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {listQuery.error?.response?.data?.detail ||
                    listQuery.error?.message ||
                    'The response list request failed.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
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
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-t border-[rgb(var(--theme-border-rgb)/0.72)] transition hover:bg-[rgb(var(--theme-neutral-rgb)/0.55)] ${
                          row.original.id === selectedResponseId ? 'bg-[rgb(var(--theme-primary-soft-rgb)/0.56)]' : ''
                        }`}
                        onClick={() => setSelectedResponseId(row.original.id)}
                      >
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

              <div className="flex items-center justify-between border-t border-[rgb(var(--theme-border-rgb)/0.72)] px-5 py-4 text-sm">
                <span className="text-muted-foreground">
                  {listData.count} total responses
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={!listData.previous}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-muted-foreground">Page {page}</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={!listData.next}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="theme-panel rounded-[2rem]">
        <CardHeader className="border-b border-[rgb(var(--theme-border-rgb)/0.72)]">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg">Response detail</CardTitle>
            {detailData ? (
              <>
                <Button type="button" variant="outline" className="ml-auto rounded-full" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-full"
                  onClick={() => {
                    if (window.confirm('Delete this response?')) {
                      deleteMutation.mutate(detailData.id)
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Response
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {detailQuery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : detailQuery.isError ? (
            <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-[rgb(var(--theme-border-rgb)/0.78)] p-6">
              <div className="max-w-md text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
                <p className="mt-3 text-sm font-semibold text-foreground">Response detail failed to load</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {detailQuery.error?.response?.data?.detail ||
                    detailQuery.error?.message ||
                    'The response detail request failed.'}
                </p>
              </div>
            </div>
          ) : detailData ? (
            <>
              <div className="grid gap-3 rounded-[1.5rem] bg-[rgb(var(--theme-neutral-rgb)/0.7)] p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Response ID</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{detailData.id}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                  <Badge variant={STATUS_VARIANTS[detailData.status] || 'outline'} className="mt-2">
                    {detailData.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Started</p>
                  <p className="mt-1 text-sm text-foreground">{new Date(detailData.started_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Duration</p>
                  <p className="mt-1 text-sm text-foreground">{formatDuration(detailData.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Collector</p>
                  <p className="mt-1 text-sm text-foreground">{collectorLookup[detailData.collector] || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email / IP</p>
                  <p className="mt-1 text-sm text-foreground">{detailData.respondent_email || detailData.ip_address || '—'}</p>
                </div>
              </div>

              <div className="space-y-4">
                {detailData.answers.map((answer) => (
                  <div key={answer.id} className="rounded-[1.5rem] border border-[rgb(var(--theme-border-rgb)/0.78)] p-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {answer.question_type.replaceAll('_', ' ')}
                      </p>
                      <h3 className="text-base font-semibold tracking-tight text-foreground">
                        {answer.question_text}
                      </h3>
                    </div>
                    <div className="mt-4">
                      <RenderAnswer answer={answer} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-[rgb(var(--theme-border-rgb)/0.78)]">
              <div className="text-center">
                <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Select a response to inspect its full detail.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
