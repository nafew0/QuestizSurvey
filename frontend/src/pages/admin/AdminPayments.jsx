import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import { useToast } from '@/hooks/useToast'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  exportAdminPayments,
  getAdminPayments,
  refundAdminBkashPayment,
  searchAdminBkashTransaction,
} from '@/services/admin'

import { formatDateTime, formatMoney } from './admin-helpers'

function updateSearchParams(searchParams, patch, setSearchParams) {
  const next = new URLSearchParams(searchParams)
  Object.entries(patch).forEach(([key, value]) => {
    if (!value) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  })
  if (patch.page === undefined) {
    next.set('page', '1')
  }
  setSearchParams(next)
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function getBkashProviderSummary(providerStatus) {
  if (!providerStatus) {
    return ''
  }

  return [
    providerStatus.transactionStatus,
    providerStatus.statusMessage,
    providerStatus.paymentID ? `payment ${providerStatus.paymentID}` : '',
    providerStatus.trxID ? `trx ${providerStatus.trxID}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export default function AdminPayments() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [bkashSearchTrxId, setBkashSearchTrxId] = useState('')
  const [bkashSearchResult, setBkashSearchResult] = useState(null)
  const [refundDialogOpen, setRefundDialogOpen] = useState(false)
  const [refundTarget, setRefundTarget] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundSku, setRefundSku] = useState('')

  const params = useMemo(
    () => ({
      page: searchParams.get('page') || '1',
      search: searchParams.get('search') || '',
      provider: searchParams.get('provider') || '',
      status: searchParams.get('status') || '',
      user_id: searchParams.get('user_id') || '',
      date_from: searchParams.get('date_from') || '',
      date_to: searchParams.get('date_to') || '',
      ordering: searchParams.get('ordering') || '-created_at',
    }),
    [searchParams]
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-payments', params],
    queryFn: () => getAdminPayments(params),
  })

  const searchBkashMutation = useMutation({
    mutationFn: searchAdminBkashTransaction,
    onSuccess: (response) => {
      setBkashSearchResult(response)
    },
    onError: (requestError) => {
      toast({
        title: 'Search failed',
        description:
          requestError.response?.data?.detail ||
          'Questiz could not search bKash by trxID right now.',
        variant: 'error',
      })
    },
  })

  const closeRefundDialog = () => {
    setRefundDialogOpen(false)
    setRefundTarget(null)
    setRefundAmount('')
    setRefundReason('')
    setRefundSku('')
  }

  const refundMutation = useMutation({
    mutationFn: ({ paymentId, payload }) =>
      refundAdminBkashPayment(paymentId, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      setBkashSearchResult((current) => {
        if (!current?.transaction) {
          return current
        }

        if (
          current.transaction.provider_reference !==
          response.transaction.provider_reference
        ) {
          return current
        }

        return {
          ...current,
          transaction: response.transaction,
          provider_status: response.provider_status,
        }
      })
      toast({
        title: 'Refund submitted',
        description: `bKash refund status: ${response.transaction.refund_status}.`,
        variant: 'success',
      })
      closeRefundDialog()
    },
    onError: (requestError) => {
      toast({
        title: 'Refund failed',
        description:
          requestError.response?.data?.detail ||
          'Questiz could not submit the bKash refund.',
        variant: 'error',
      })
    },
  })

  const openRefundDialog = (payment) => {
    setRefundTarget(payment)
    setRefundAmount(payment.available_refund_amount || payment.amount || '')
    setRefundReason(payment.refund_reason || '')
    setRefundSku(payment.invoice_number || '')
    setRefundDialogOpen(true)
  }

  const handleBkashSearch = async () => {
    const normalizedTrxId = bkashSearchTrxId.trim()
    if (!normalizedTrxId) {
      toast({
        title: 'trxID required',
        description: 'Enter a bKash trxID before running reconciliation search.',
        variant: 'error',
      })
      return
    }

    await searchBkashMutation.mutateAsync(normalizedTrxId)
  }

  const handleRefundSubmit = () => {
    if (!refundTarget) {
      return
    }

    const normalizedAmount = refundAmount.trim()
    if (!normalizedAmount) {
      toast({
        title: 'Refund amount required',
        description: 'Enter the amount to refund before submitting.',
        variant: 'error',
      })
      return
    }

    refundMutation.mutate({
      paymentId: refundTarget.provider_reference,
      payload: {
        amount: normalizedAmount,
        reason: refundReason.trim(),
        sku: refundSku.trim(),
      },
    })
  }

  const columns = useMemo(
    () => [
      {
        accessorKey: 'provider',
        header: 'Provider',
        cell: ({ row }) => <Badge variant="outline">{row.original.provider}</Badge>,
      },
      {
        accessorKey: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">
              {row.original.user.username || 'Unmatched'}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.original.user.email || 'No email'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'plan',
        header: 'Plan',
        cell: ({ row }) => row.original.plan.name || 'Unknown',
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => formatMoney(row.original.amount, row.original.currency),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <div className="space-y-2">
            <Badge
              variant={
                row.original.status === 'paid' ||
                row.original.status === 'completed'
                  ? 'success'
                  : 'secondary'
              }
            >
              {row.original.status}
            </Badge>
            {row.original.refund_status && row.original.refund_status !== 'none' ? (
              <div>
                <Badge variant="outline">
                  refund {row.original.refund_status}
                </Badge>
              </div>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="space-y-2">
            {row.original.provider === 'bkash' ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {row.original.provider_reference}
                </p>
                {row.original.trx_id ? (
                  <p className="text-xs text-muted-foreground">
                    trx {row.original.trx_id}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={!row.original.refundable}
                  onClick={() => openRefundDialog(row.original)}
                >
                  Refund
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No admin action</span>
            )}
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: data?.results || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const currentPage = Number(params.page || 1)
  const totalPages = Math.max(1, Math.ceil((data?.count || 0) / 20))

  const handleExport = async () => {
    try {
      const blob = await exportAdminPayments({
        ...params,
        page: undefined,
      })
      downloadBlob(blob, 'questiz-payments.csv')
    } catch (requestError) {
      toast({
        title: 'Export failed',
        description:
          requestError.response?.data?.detail ||
          'Questiz could not export the filtered payments.',
        variant: 'error',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="theme-panel rounded-[1.8rem] p-6 text-sm text-muted-foreground">
        Loading payments...
      </div>
    )
  }

  if (error) {
    return (
      <div className="theme-panel rounded-[1.8rem] p-6 text-sm text-rose-600">
        Questiz could not load payment records right now.
      </div>
    )
  }

  return (
    <>
      <Card className="theme-panel rounded-[1.8rem] border-0">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                Combined Stripe invoice history and local bKash transactions.
              </CardDescription>
            </div>
            <Button className="rounded-xl" onClick={handleExport}>
              Export CSV
            </Button>
          </div>
          {data?.warnings?.length ? (
            <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {data.warnings.join(' ')}
            </div>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-[1.3fr_repeat(4,minmax(0,0.8fr))]">
            <Input
              placeholder="Search invoice, payment, user, or plan"
              value={params.search}
              onChange={(event) =>
                updateSearchParams(
                  searchParams,
                  { search: event.target.value },
                  setSearchParams
                )
              }
            />
            <CustomSelect
              value={params.provider}
              onChange={(value) =>
                updateSearchParams(searchParams, { provider: value }, setSearchParams)
              }
              options={[
                { label: 'All providers', value: '' },
                { label: 'Stripe', value: 'stripe' },
                { label: 'bKash', value: 'bkash' },
              ]}
            />
            <CustomSelect
              value={params.status}
              onChange={(value) =>
                updateSearchParams(searchParams, { status: value }, setSearchParams)
              }
              options={[
                { label: 'All statuses', value: '' },
                { label: 'Paid', value: 'paid' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
                { label: 'Cancelled', value: 'cancelled' },
                { label: 'Past due / open', value: 'open' },
              ]}
            />
            <Input
              type="date"
              value={params.date_from}
              onChange={(event) =>
                updateSearchParams(
                  searchParams,
                  { date_from: event.target.value },
                  setSearchParams
                )
              }
            />
            <Input
              type="date"
              value={params.date_to}
              onChange={(event) =>
                updateSearchParams(
                  searchParams,
                  { date_to: event.target.value },
                  setSearchParams
                )
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_auto]">
            <Input
              placeholder="Optional user ID"
              value={params.user_id}
              onChange={(event) =>
                updateSearchParams(
                  searchParams,
                  { user_id: event.target.value },
                  setSearchParams
                )
              }
            />
            <CustomSelect
              value={params.ordering}
              onChange={(value) =>
                updateSearchParams(searchParams, { ordering: value }, setSearchParams)
              }
              options={[
                { label: 'Newest first', value: '-created_at' },
                { label: 'Oldest first', value: 'created_at' },
                { label: 'Highest amount', value: '-amount' },
                { label: 'Lowest amount', value: 'amount' },
              ]}
            />
            <div className="rounded-[1.2rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white/75 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">Revenue totals</p>
              <p className="mt-1 text-muted-foreground">
                {Object.entries(data?.revenue_totals || {}).length
                  ? Object.entries(data.revenue_totals)
                      .map(
                        ([currency, amount]) =>
                          `${formatMoney(amount, currency)} ${currency}`
                      )
                      .join(' · ')
                  : 'No paid revenue in this filter set.'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[1.35rem] border border-[rgb(var(--theme-border-rgb)/0.76)] bg-white/75 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  bKash reconciliation
                </p>
                <p className="text-sm text-muted-foreground">
                  Search a trxID directly against bKash and compare it with the local
                  Questiz record.
                </p>
              </div>
              <div className="flex w-full flex-wrap gap-3 md:w-auto">
                <Input
                  className="min-w-[16rem]"
                  placeholder="Enter bKash trxID"
                  value={bkashSearchTrxId}
                  onChange={(event) => setBkashSearchTrxId(event.target.value)}
                />
                <Button
                  className="rounded-xl"
                  onClick={handleBkashSearch}
                  disabled={searchBkashMutation.isPending}
                >
                  {searchBkashMutation.isPending ? 'Searching...' : 'Search trxID'}
                </Button>
              </div>
            </div>
            {bkashSearchResult ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1rem] border border-[rgb(var(--theme-border-rgb)/0.65)] px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">Gateway result</p>
                  <p className="mt-1 text-muted-foreground">
                    {getBkashProviderSummary(bkashSearchResult.provider_status) ||
                      'No provider details returned.'}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-[rgb(var(--theme-border-rgb)/0.65)] px-4 py-3 text-sm">
                  <p className="font-semibold text-foreground">Local match</p>
                  {bkashSearchResult.transaction ? (
                    <p className="mt-1 text-muted-foreground">
                      {bkashSearchResult.transaction.user.username} ·{' '}
                      {bkashSearchResult.transaction.plan.name} ·{' '}
                      {formatMoney(
                        bkashSearchResult.transaction.amount,
                        bkashSearchResult.transaction.currency
                      )}{' '}
                      · {bkashSearchResult.transaction.status}
                    </p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      No local bKash transaction matched this trxID.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="pb-3 pr-4">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-[rgb(var(--theme-border-rgb)/0.7)]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3 pr-4 align-top">
                        {cell.column.columnDef.cell
                          ? flexRender(cell.column.columnDef.cell, cell.getContext())
                          : cell.getValue()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing page {currentPage} of {totalPages}.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={currentPage <= 1}
                onClick={() =>
                  updateSearchParams(
                    searchParams,
                    { page: String(currentPage - 1) },
                    setSearchParams
                  )
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  updateSearchParams(
                    searchParams,
                    { page: String(currentPage + 1) },
                    setSearchParams
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          if (!open && !refundMutation.isPending) {
            closeRefundDialog()
            return
          }
          setRefundDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund bKash payment</DialogTitle>
            <DialogDescription>
              Submit a single full or partial refund for the selected bKash
              transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Payment reference
              </p>
              <p className="rounded-lg border border-[rgb(var(--theme-border-rgb)/0.65)] bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {refundTarget?.provider_reference || 'No payment selected.'}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="refund-amount">
                  Amount
                </label>
                <Input
                  id="refund-amount"
                  inputMode="decimal"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="refund-sku">
                  SKU
                </label>
                <Input
                  id="refund-sku"
                  value={refundSku}
                  onChange={(event) => setRefundSku(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="refund-reason">
                Reason
              </label>
              <Textarea
                id="refund-reason"
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder="Optional refund note for reconciliation."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={closeRefundDialog}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleRefundSubmit}
              disabled={refundMutation.isPending}
            >
              {refundMutation.isPending ? 'Submitting...' : 'Submit refund'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
