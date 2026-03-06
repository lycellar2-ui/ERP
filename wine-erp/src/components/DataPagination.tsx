'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DataPaginationProps {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    pageSizeOptions?: number[]
}

export function DataPagination({
    page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100],
}: DataPaginationProps) {
    const totalPages = Math.ceil(total / pageSize)
    if (total === 0) return null

    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, total)

    const getPageNumbers = (): (number | '...')[] => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages: (number | '...')[] = [1]
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
        if (page < totalPages - 2) pages.push('...')
        if (totalPages > 1) pages.push(totalPages)
        return pages
    }

    return (
        <div className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
            <div className="flex items-center gap-3">
                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                    Hiển thị <span style={{ color: '#8AAEBB' }}>{start}–{end}</span> trong <span style={{ color: '#8AAEBB' }}>{total.toLocaleString()}</span>
                </p>
                {onPageSizeChange && (
                    <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))}
                        className="px-2 py-1 text-xs outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', borderRadius: '4px' }}>
                        {pageSizeOptions.map(s => <option key={s} value={s}>{s} / trang</option>)}
                    </select>
                )}
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                    className="p-1.5 rounded disabled:opacity-30 transition-colors"
                    style={{ color: '#8AAEBB' }}
                    onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1B2E3D')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <ChevronLeft size={16} />
                </button>
                {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                        <span key={`e${i}`} className="px-1 text-xs" style={{ color: '#4A6A7A' }}>…</span>
                    ) : (
                        <button key={p} onClick={() => onPageChange(p)}
                            className="min-w-[32px] h-8 px-2 rounded text-xs font-medium transition-all"
                            style={{
                                background: p === page ? '#87CBB9' : 'transparent',
                                color: p === page ? '#0A1926' : '#8AAEBB',
                            }}>
                            {p}
                        </button>
                    )
                )}
                <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                    className="p-1.5 rounded disabled:opacity-30 transition-colors"
                    style={{ color: '#8AAEBB' }}
                    onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1B2E3D')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    )
}
