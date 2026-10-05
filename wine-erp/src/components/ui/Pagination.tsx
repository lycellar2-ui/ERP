'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPageNumbers } from '@/lib/ui/pagination'

interface PaginationProps {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    pageSizeOptions?: number[]
    /** Noun for the summary line, e.g. "đơn hàng" / "orders". */
    itemLabel?: string
    isEn?: boolean
    /** Called when hovering a page target — use for intent-based prefetching. */
    onPageHover?: (page: number) => void
    className?: string
}

const navBtn =
    'inline-flex items-center justify-center min-w-8 h-8 px-2 rounded-md border border-lys-border text-lys-secondary text-xs font-semibold cursor-pointer transition-colors hover:bg-lys-subtle disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'

export function Pagination({
    page, pageSize, total, onPageChange, onPageSizeChange,
    pageSizeOptions = [20, 50, 100], itemLabel, isEn, onPageHover, className,
}: PaginationProps) {
    if (total <= 0) return null
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const hover = (p: number) => () => { if (p !== page && p >= 1 && p <= totalPages) onPageHover?.(p) }
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    const noun = itemLabel ?? (isEn ? 'records' : 'bản ghi')

    return (
        <nav
            aria-label={isEn ? 'Pagination' : 'Phân trang'}
            className={cn('flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-2.5 bg-lys-card border border-lys-border rounded-lg', className)}
        >
            <div className="flex flex-wrap items-center gap-3 type-caption text-lys-muted">
                <span>
                    {isEn ? 'Showing' : 'Hiển thị'}{' '}
                    <span className="text-lys-primary type-number">{from}–{to}</span>{' '}
                    {isEn ? 'of' : 'trong'}{' '}
                    <span className="text-lys-primary type-number">{total}</span> {noun}
                </span>
                {onPageSizeChange && (
                    <label className="flex items-center gap-1.5 pl-3 border-l border-lys-border">
                        {isEn ? 'Show:' : 'Hiển thị:'}
                        <select
                            value={pageSize}
                            onChange={e => onPageSizeChange(Number(e.target.value))}
                            className="h-7 px-1.5 rounded-md border border-lys-border bg-white text-lys-primary text-xs cursor-pointer focus:outline-none focus:border-lys-teal"
                        >
                            {pageSizeOptions.map(s => (
                                <option key={s} value={s}>{s} {isEn ? '/ page' : '/ trang'}</option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1">
                    <button type="button" className={navBtn} onClick={() => onPageChange(1)} disabled={page <= 1} aria-label={isEn ? 'First page' : 'Trang đầu'}>
                        <ChevronsLeft size={15} />
                    </button>
                    <button type="button" className={navBtn} onClick={() => onPageChange(page - 1)} onMouseEnter={hover(page - 1)} disabled={page <= 1} aria-label={isEn ? 'Previous page' : 'Trang trước'}>
                        <ChevronLeft size={15} />
                    </button>
                    {getPageNumbers(page, totalPages).map((p, i) =>
                        p === '...' ? (
                            <span key={`dots-${i}`} className="px-1 text-xs text-lys-muted select-none">…</span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => onPageChange(p)}
                                onMouseEnter={hover(p)}
                                aria-current={p === page ? 'page' : undefined}
                                className={cn(navBtn, 'type-number', p === page && 'bg-lys-teal-soft text-lys-teal-strong border-lys-teal hover:bg-lys-teal-soft')}
                            >
                                {p}
                            </button>
                        ),
                    )}
                    <button type="button" className={navBtn} onClick={() => onPageChange(page + 1)} onMouseEnter={hover(page + 1)} disabled={page >= totalPages} aria-label={isEn ? 'Next page' : 'Trang sau'}>
                        <ChevronRight size={15} />
                    </button>
                    <button type="button" className={navBtn} onClick={() => onPageChange(totalPages)} disabled={page >= totalPages} aria-label={isEn ? 'Last page' : 'Trang cuối'}>
                        <ChevronsRight size={15} />
                    </button>
                </div>
            )}
        </nav>
    )
}
