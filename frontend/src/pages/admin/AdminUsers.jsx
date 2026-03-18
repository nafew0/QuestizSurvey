import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAdminUsers } from '@/services/admin'

import { formatDateTime } from './admin-helpers'

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

export default function AdminUsers() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(
    () => ({
      page: searchParams.get('page') || '1',
      search: searchParams.get('search') || '',
      plan: searchParams.get('plan') || '',
      is_active: searchParams.get('is_active') || '',
      ordering: searchParams.get('ordering') || '-created_at',
    }),
    [searchParams]
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => getAdminUsers(params),
  })

  const columns = useMemo(
    () => [
      {
        accessorKey: 'username',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.username}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: 'current_plan',
        header: 'Plan',
        cell: ({ row }) => <Badge variant="outline">{row.original.current_plan?.name || 'Free'}</Badge>,
      },
      {
        accessorKey: 'survey_count',
        header: 'Surveys',
      },
      {
        accessorKey: 'response_count',
        header: 'Responses',
      },
      {
        accessorKey: 'is_active',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.is_active ? 'success' : 'danger'}>
            {row.original.is_active ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Joined',
        cell: ({ row }) => formatDateTime(row.original.created_at, { hour: undefined, minute: undefined }),
      },
    ],
    []
  )

  const table = useReactTable({
    data: data?.results || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const planOptions = [
    { label: 'All plans', value: '' },
    ...((data?.plans || []).map((plan) => ({ label: plan.name, value: plan.slug }))),
  ]

  if (isLoading) {
    return <div className="theme-panel rounded-[1.8rem] p-6 text-sm text-muted-foreground">Loading users...</div>
  }

  if (error) {
    return <div className="theme-panel rounded-[1.8rem] p-6 text-sm text-rose-600">Questiz could not load users right now.</div>
  }

  const currentPage = Number(params.page || 1)
  const totalPages = Math.max(1, Math.ceil((data?.count || 0) / 20))

  return (
    <Card className="theme-panel rounded-[1.8rem] border-0">
      <CardHeader className="gap-4">
        <div>
          <CardTitle>Users</CardTitle>
          <CardDescription>Search, filter, and inspect Questiz accounts.</CardDescription>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,0.8fr))]">
          <Input
            placeholder="Search username or email"
            value={params.search}
            onChange={(event) =>
              updateSearchParams(searchParams, { search: event.target.value }, setSearchParams)
            }
          />
          <CustomSelect
            value={params.plan}
            onChange={(value) => updateSearchParams(searchParams, { plan: value }, setSearchParams)}
            options={planOptions}
          />
          <CustomSelect
            value={params.is_active}
            onChange={(value) => updateSearchParams(searchParams, { is_active: value }, setSearchParams)}
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ]}
          />
          <CustomSelect
            value={params.ordering}
            onChange={(value) => updateSearchParams(searchParams, { ordering: value }, setSearchParams)}
            options={[
              { label: 'Newest first', value: '-created_at' },
              { label: 'Oldest first', value: 'created_at' },
              { label: 'Most surveys', value: '-survey_count' },
              { label: 'Most responses', value: '-response_count' },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="pb-3 pr-4">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-[rgb(var(--theme-border-rgb)/0.7)] transition hover:bg-white/50"
                  onClick={() => navigate(`/admin/users/${row.original.id}`)}
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
                updateSearchParams(searchParams, { page: String(currentPage - 1) }, setSearchParams)
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={currentPage >= totalPages}
              onClick={() =>
                updateSearchParams(searchParams, { page: String(currentPage + 1) }, setSearchParams)
              }
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
