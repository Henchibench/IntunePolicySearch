import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GroupTypeBadge } from './GroupTypeBadge';
import { SavedViewsMenu } from './SavedViewsMenu';
import { type SavedView } from '@/lib/savedViews';
import type { GroupAssignmentResult } from '@/types/graph';

export interface ResultsTableProps {
  rows: GroupAssignmentResult[];
  tenantId: string;
  onRowClick: (row: GroupAssignmentResult) => void;
}

export function ResultsTable({ rows, tenantId, onRowClick }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const showAppIntent = useMemo(() => rows.some((r) => r.appIntent), [rows]);

  const columns = useMemo<ColumnDef<GroupAssignmentResult>[]>(() => {
    const base: ColumnDef<GroupAssignmentResult>[] = [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <SortHeader column={column}>Name</SortHeader>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <SortHeader column={column}>Category</SortHeader>,
        cell: ({ row }) => <GroupTypeBadge category={row.original.category} />,
        filterFn: (row, _id, value: string[]) =>
          value.length === 0 || value.includes(row.original.category),
      },
      {
        accessorKey: 'platform',
        header: ({ column }) => <SortHeader column={column}>Platform</SortHeader>,
        cell: ({ row }) => row.original.platform ?? '—',
      },
      {
        accessorKey: 'intent',
        header: ({ column }) => <SortHeader column={column}>Intent</SortHeader>,
        cell: ({ row }) => (
          <Badge variant={row.original.intent === 'exclude' ? 'destructive' : 'default'}>
            {row.original.intent}
          </Badge>
        ),
      },
    ];
    if (showAppIntent) {
      base.push({
        accessorKey: 'appIntent',
        header: ({ column }) => <SortHeader column={column}>App intent</SortHeader>,
        cell: ({ row }) => row.original.appIntent ?? '—',
      });
    }
    base.push(
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) =>
          row.original.source.kind === 'direct' ? (
            <Badge variant="outline">Direct</Badge>
          ) : (
            <Badge variant="outline">via {row.original.source.groupName ?? '?'}</Badge>
          ),
      },
      {
        accessorKey: 'filter',
        header: 'Filter',
        cell: ({ row }) =>
          row.original.filter ? (
            <span className="text-xs">
              {row.original.filter.displayName ?? row.original.filter.id} ({row.original.filter.mode})
            </span>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'lastModified',
        header: ({ column }) => <SortHeader column={column}>Last modified</SortHeader>,
        cell: ({ row }) =>
          row.original.lastModified
            ? new Date(row.original.lastModified).toLocaleDateString()
            : '—',
      },
    );
    return base;
  }, [showAppIntent]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _id, value) =>
      row.original.name.toLowerCase().includes(String(value).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filtersByColumn: Record<string, string[]> = {};
  for (const f of columnFilters) {
    if (Array.isArray(f.value)) filtersByColumn[f.id] = f.value as string[];
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search by name…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSorting([]);
            setColumnFilters([]);
            setGlobalFilter('');
          }}
        >
          Reset
        </Button>
        <div className="ml-auto">
          <SavedViewsMenu
            tenantId={tenantId}
            current={{ filters: filtersByColumn, sorting, freeTextSearch: globalFilter }}
            onApply={(v) => applyView(v, setSorting, setColumnFilters, setGlobalFilter)}
          />
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-sm text-muted-foreground">
                  No matching results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRowClick(r.original)}
                >
                  {r.getVisibleCells().map((c) => (
                    <TableCell key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader({
  column,
  children,
}: {
  column: Column<GroupAssignmentResult, unknown>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}

function applyView(
  v: SavedView,
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>,
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>,
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>,
) {
  setSorting(v.sorting);
  setColumnFilters(
    Object.entries(v.filters).map(([id, value]) => ({ id, value })),
  );
  setGlobalFilter(v.freeTextSearch);
}
