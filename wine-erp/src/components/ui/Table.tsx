import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Compact data table primitives (row ≈ 40px, 13px text, sticky header). */
export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
    return (
        <div className="relative w-full overflow-auto bg-lys-card border border-lys-border rounded-lg">
            <table className={cn('w-full border-collapse type-table text-lys-primary', className)} {...props}>
                {children}
            </table>
        </div>
    )
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn('sticky top-0 z-10 bg-lys-subtle', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn('divide-y divide-lys-border', className)} {...props} />
}

export function Tr({ className, onClick, selected, ...props }: HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
    return (
        <tr
            onClick={onClick}
            aria-selected={selected || undefined}
            className={cn(
                'h-10 transition-colors hover:bg-lys-subtle/70',
                onClick && 'cursor-pointer',
                selected && 'bg-lys-teal-soft hover:bg-lys-teal-soft',
                className,
            )}
            {...props}
        />
    )
}

type Align = 'left' | 'right' | 'center'
const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' }

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
    align?: Align
    /** When set, header becomes a sort toggle. */
    sort?: 'asc' | 'desc' | false
    onSort?: () => void
}

export function Th({ className, align = 'left', sort, onSort, children, ...props }: ThProps) {
    const sortable = onSort !== undefined
    return (
        <th
            scope="col"
            aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
            className={cn(
                'h-9 px-3 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap border-b border-lys-border',
                sort ? 'text-lys-teal-strong' : 'text-lys-secondary',
                ALIGN[align],
                className,
            )}
            {...props}
        >
            {sortable ? (
                <button type="button" onClick={onSort} className="inline-flex items-center gap-1 uppercase cursor-pointer hover:text-lys-primary">
                    {children}
                    {sort === 'asc' ? <ChevronUp size={12} /> : sort === 'desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} className="opacity-40" />}
                </button>
            ) : (
                children
            )}
        </th>
    )
}

export function Td({ className, align = 'left', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
    return <td className={cn('px-3 py-2 align-middle', ALIGN[align], align === 'right' && 'type-number', className)} {...props} />
}

/** Full-width row for empty / loading states inside a table body. */
export function TableMessageRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} className="p-0">{children}</td>
        </tr>
    )
}
