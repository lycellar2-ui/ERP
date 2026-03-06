'use client'

import { useState } from 'react'
import { Edit2, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { ProductRow } from './actions'
import { WineTypeBadge, StatusBadge } from './ProductsClient'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
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

function ProductTableRow({ row, onEdit }: { row: ProductRow; onEdit: () => void }) {
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
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden"
                        style={{ background: row.primaryImageUrl ? 'transparent' : '#142433', border: '1px solid #2A4355' }}>
                        {row.primaryImageUrl
                            ? <img src={row.primaryImageUrl} alt={row.productName} className="w-full h-full object-cover rounded-lg" />
                            : <ImageOff size={14} style={{ color: '#2A4355' }} />}
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
                <button onClick={onEdit}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: '#8AAEBB' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(135,203,185,0.15)'; e.currentTarget.style.color = '#87CBB9' }}
                    onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#8AAEBB' }}>
                    <Edit2 size={14} />
                </button>
            </td>
        </tr>
    )
}

interface ProductTableProps {
    rows: ProductRow[]
    total: number
    loading: boolean
    page: number
    pageSize: number
    onPageChange: (p: number) => void
    onEdit: (id: string) => void
    onRefresh: () => void
}

export function ProductTable({ rows, total, loading, page, pageSize, onPageChange, onEdit }: ProductTableProps) {
    const totalPages = Math.ceil(total / pageSize)
    const headers = [
        { label: 'Sản phẩm', cls: 'px-4 py-3 w-[300px]' },
        { label: 'Vintage', cls: 'px-3 py-3 w-[70px] text-center' },
        { label: 'Loại', cls: 'px-3 py-3 w-[100px]' },
        { label: 'Nhà SX / Vùng', cls: 'px-3 py-3 w-[220px]' },
        { label: 'ABV', cls: 'px-3 py-3 w-[60px] text-center' },
        { label: 'Đóng gói', cls: 'px-3 py-3 w-[110px] text-center' },
        { label: 'Tồn kho', cls: 'px-3 py-3 w-[80px] text-center' },
        { label: 'Trạng thái', cls: 'px-3 py-3 w-[120px]' },
        { label: '', cls: 'px-3 py-3 w-[44px]' },
    ]

    return (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
            <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {headers.map(h => (
                                <th key={h.label} className={`${h.cls} text-xs uppercase tracking-wider font-semibold`}
                                    style={{ color: '#4A6A7A' }}>{h.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}>
                                    {headers.map((_, j) => (
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
                                    <ProductTableRow key={row.id} row={row} onEdit={() => onEdit(row.id)} />
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
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                            <button key={p} onClick={() => onPageChange(p)}
                                className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium"
                                style={{ background: p === page ? '#87CBB9' : 'transparent', color: p === page ? '#0A1926' : '#8AAEBB' }}>
                                {p}
                            </button>
                        ))}
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
