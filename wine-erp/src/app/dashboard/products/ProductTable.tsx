'use client'

import { useState } from 'react'
import { Edit2, ChevronLeft, ChevronRight, ImageOff, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { ProductRow, ProductFilters } from './actions'
import { WineTypeBadge, StatusBadge } from './ProductsClient'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'rgba(135,203,185,0.1)' }}>🍷</div>
            <div className="text-center">
                <p className="font-semibold" style={{ color: '#E8F1F2' }}>Chưa có sản phẩm nào</p>
                <p className="text-sm mt-1" style={{ color: '#4A6A7A' }}>Bấm "Thêm Sản Phẩm" để bắt đầu danh mục</p>
            </div>
        </div>
    )
}

function ProductTableRow({ row, onEdit, onDelete }: { row: ProductRow; onEdit: () => void; onDelete: () => void }) {
    const flag = COUNTRY_FLAGS[row.country] ?? '🌍'
    const stockColor = row.totalStock === 0 ? '#8B1A2E' : row.totalStock < 12 ? '#87CBB9' : '#5BA88A'

    return (
        <tr className="group transition-colors duration-100"
            style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>

            {/* Product */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="relative group/img w-14 h-10 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden cursor-zoom-in"
                        style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        {row.primaryImageUrl ? (
                            <>
                                <img src={row.primaryImageUrl} alt={row.productName} className="w-full h-full object-contain p-0.5 -rotate-90 transition-transform duration-200 group-hover/img:scale-105 group-hover/img:-rotate-90" />
                                
                                {/* Gorgeous hover preview card */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-52 bg-[#0D1E2B]/95 backdrop-blur-md rounded-2xl p-4 border border-[#2A4355] shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 scale-95 pointer-events-none group-hover/img:opacity-100 group-hover/img:scale-100 transition-all duration-200 z-50 flex flex-col items-center gap-3">
                                    <div className="w-full h-64 bg-[#142433] rounded-xl p-3 flex items-center justify-center border border-[#2A4355]/40 overflow-hidden">
                                        <img src={row.primaryImageUrl} alt={row.productName} className="h-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]" />
                                    </div>
                                    <div className="text-center w-full min-w-0">
                                        <p className="text-xs font-bold truncate text-ellipsis" style={{ color: '#E8F1F2' }}>{row.productName}</p>
                                        <p className="text-[10px] mt-1" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>{row.skuCode}</p>
                                        <p className="text-[10px] font-bold mt-1 inline-block px-2 py-0.5 rounded" style={{ background: row.vintage ? 'rgba(135,203,185,0.1)' : 'rgba(74,106,122,0.1)', color: row.vintage ? '#87CBB9' : '#4A6A7A' }}>
                                            {row.vintage ? `Năm: ${row.vintage}` : 'Không niên vụ (NV)'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <ImageOff size={16} style={{ color: '#2A4355' }} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate max-w-[260px]" style={{ color: '#E8F1F2' }}>
                            {row.productName}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>
                            {row.skuCode}
                        </p>
                    </div>
                </div>
            </td>

            {/* Vintage */}
            <td className="px-3 py-3 text-center">
                <span className="text-sm font-semibold" style={{ color: row.vintage ? '#87CBB9' : '#2A4355', fontFamily: '"DM Mono", monospace' }}>
                    {row.vintage ?? 'NV'}
                </span>
            </td>

            {/* Type */}
            <td className="px-3 py-3"><WineTypeBadge type={row.wineType} /></td>

            {/* Producer + Region */}
            <td className="px-3 py-3">
                <p className="text-sm truncate max-w-[200px]" style={{ color: '#8AAEBB' }}>{row.producerName}</p>
                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                    {flag} {row.appellationName ?? row.country}
                </p>
            </td>

            {/* ABV */}
            <td className="px-3 py-3 text-center">
                <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                    {row.abvPercent != null ? `${row.abvPercent}°` : '—'}
                </span>
            </td>

            {/* Pack */}
            <td className="px-3 py-3 text-center">
                <span className="text-xs" style={{ color: '#4A6A7A' }}>
                    {row.packagingType === 'OWC' ? '📦 OWC' : '📫 Carton'} ×{row.unitsPerCase}
                </span>
            </td>

            {/* Stock */}
            <td className="px-3 py-3 text-center">
                <span className="text-sm font-bold" style={{ color: stockColor, fontFamily: '"DM Mono", monospace' }}>
                    {row.totalStock}
                </span>
                <span className="text-xs ml-1" style={{ color: '#4A6A7A' }}>chai</span>
            </td>

            {/* Status */}
            <td className="px-3 py-3"><StatusBadge status={row.status} /></td>

            {/* Actions */}
            <td className="px-3 py-3">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={onEdit}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#8AAEBB' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(135,203,185,0.15)'; e.currentTarget.style.color = '#87CBB9' }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#8AAEBB' }}
                        title="Chỉnh sửa">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={onDelete}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,26,46,0.15)'; e.currentTarget.style.color = '#E05252' }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#4A6A7A' }}
                        title="Xóa">
                        <Trash2 size={14} />
                    </button>
                </div>
            </td>
        </tr>
    )
}

function SortIcon({ column, sortBy, sortDir }: { column: string; sortBy?: string; sortDir?: string }) {
    if (sortBy !== column) return <ArrowUpDown size={11} style={{ color: '#2A4355' }} />
    return sortDir === 'asc'
        ? <ArrowUp size={11} style={{ color: '#87CBB9' }} />
        : <ArrowDown size={11} style={{ color: '#87CBB9' }} />
}

interface ProductTableProps {
    rows: ProductRow[]
    total: number
    loading: boolean
    page: number
    pageSize: number
    sortBy?: ProductFilters['sortBy']
    sortDir?: ProductFilters['sortDir']
    onPageChange: (p: number) => void
    onSort: (sortBy: ProductFilters['sortBy']) => void
    onEdit: (id: string) => void
    onDelete: (id: string, name: string) => void
    onRefresh: () => void
}

export function ProductTable({ rows, total, loading, page, pageSize, sortBy, sortDir, onPageChange, onSort, onEdit, onDelete }: ProductTableProps) {
    const totalPages = Math.ceil(total / pageSize)

    const sortableHeaders = [
        { key: 'name' as const, label: 'Sản phẩm', cls: 'px-4 py-3 w-[300px]', sortable: true },
        { key: 'vintage' as const, label: 'Vintage', cls: 'px-3 py-3 w-[70px] text-center', sortable: true },
        { key: undefined, label: 'Loại', cls: 'px-3 py-3 w-[100px]', sortable: false },
        { key: undefined, label: 'Nhà SX / Vùng', cls: 'px-3 py-3 w-[220px]', sortable: false },
        { key: 'abv' as const, label: 'ABV', cls: 'px-3 py-3 w-[60px] text-center', sortable: true },
        { key: undefined, label: 'Đóng gói', cls: 'px-3 py-3 w-[110px] text-center', sortable: false },
        { key: 'stock' as const, label: 'Tồn kho', cls: 'px-3 py-3 w-[80px] text-center', sortable: false },
        { key: undefined, label: 'Trạng thái', cls: 'px-3 py-3 w-[120px]', sortable: false },
        { key: undefined, label: '', cls: 'px-3 py-3 w-[70px]', sortable: false },
    ]

    // Smart pagination: show 1, ..., currentPage±1, ..., last
    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages: (number | '...')[] = [1]
        if (page > 3) pages.push('...')
        for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
            pages.push(i)
        }
        if (page < totalPages - 2) pages.push('...')
        if (totalPages > 1) pages.push(totalPages)
        return pages
    }

    return (
        <div className="rounded-2xl overflow-hidden relative" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
            <style>{`
                @keyframes barProgress {
                    0% { left: -30%; }
                    100% { left: 100%; }
                }
            `}</style>

            {loading && rows.length > 0 && (
                <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden bg-[#142433] z-10">
                    <div className="absolute h-full bg-[#87CBB9]" style={{
                        width: '30%',
                        animation: 'barProgress 1.2s infinite ease-in-out'
                    }} />
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {sortableHeaders.map((h, i) => (
                                <th key={i}
                                    className={`${h.cls} text-xs uppercase tracking-wider font-semibold ${h.sortable ? 'cursor-pointer select-none' : ''}`}
                                    style={{ color: h.sortable && sortBy === h.key ? '#87CBB9' : '#4A6A7A' }}
                                    onClick={() => h.sortable && h.key && onSort(h.key)}>
                                    <span className="inline-flex items-center gap-1.5">
                                        {h.label}
                                        {h.sortable && h.key && <SortIcon column={h.key} sortBy={sortBy} sortDir={sortDir} />}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className={`transition-opacity duration-200 ${loading && rows.length > 0 ? 'opacity-40 pointer-events-none' : ''}`}>
                        {rows.length === 0 && loading
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}>
                                    {sortableHeaders.map((_, j) => (
                                        <td key={j} className="px-4 py-4">
                                            <div className="h-4 rounded animate-pulse"
                                                style={{ background: '#1B2E3D', width: j === 0 ? '80%' : '55%' }} />
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : rows.length === 0
                                ? <tr><td colSpan={9}><EmptyState /></td></tr>
                                : rows.map(row => (
                                    <ProductTableRow
                                        key={row.id}
                                        row={row}
                                        onEdit={() => onEdit(row.id)}
                                        onDelete={() => onDelete(row.id, row.productName)}
                                    />
                                ))
                        }
                    </tbody>
                </table>
            </div>

            {total > 0 && (
                <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                    <p className="text-xs" style={{ color: '#4A6A7A' }}>
                        Hiển thị <span style={{ color: '#8AAEBB' }}>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}</span> trong <span style={{ color: '#8AAEBB' }}>{total}</span>
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
                            className="p-1.5 rounded-lg disabled:opacity-30"
                            style={{ color: '#8AAEBB' }}
                            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1B2E3D')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <ChevronLeft size={16} />
                        </button>
                        {getPageNumbers().map((p, i) =>
                            p === '...' ? (
                                <span key={`dots-${i}`} className="px-1 text-xs" style={{ color: '#4A6A7A' }}>…</span>
                            ) : (
                                <button key={p} onClick={() => onPageChange(p as number)}
                                    className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium"
                                    style={{ background: p === page ? '#87CBB9' : 'transparent', color: p === page ? '#0A1926' : '#8AAEBB' }}>
                                    {p}
                                </button>
                            )
                        )}
                        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
                            className="p-1.5 rounded-lg disabled:opacity-30"
                            style={{ color: '#8AAEBB' }}
                            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = '#1B2E3D')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
