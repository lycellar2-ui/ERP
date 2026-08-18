'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Search, Plus, PackagePlus, CheckCircle2, Clock,
    FileText, ChevronDown, X, Trash2, Loader2, Save, AlertCircle,
    Package, RefreshCw, Printer, Calendar, ArrowUpDown, ChevronRight,
    Download, ChevronUp, MapPin, Eye, Building2, Layers, ShieldCheck, CheckSquare, Sparkles, Box
} from 'lucide-react'
import { toast } from 'sonner'
import {
    type GoodsReceiptRow,
    getGoodsReceipts, getPOsForReceiving, createGoodsReceipt, confirmGoodsReceipt,
    getGRDetail, getLocations, exportGoodsReceiptsExcel,
} from './actions'
import { formatVND, formatDate, formatDateTime } from '@/lib/utils'

// ── Types ──────────────────────────────────────────
type POLineOption = {
    id: string
    productId: string
    productName: string
    skuCode: string
    unitsPerCase: number
    qtyOrdered: number
    casesOrdered: number
}

type POOption = {
    id: string
    poNo: string
    supplierName: string
    lines: POLineOption[]
}

type GRDetail = Awaited<ReturnType<typeof getGRDetail>>

// ── Status Config (Matching Sales & Procurement) ───
const GR_STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: React.FC<any> }> = {
    DRAFT: {
        label: 'Nháp / Chờ Nhập',
        color: '#D4A853',
        bg: 'rgba(212,168,83,0.15)',
        border: 'rgba(212,168,83,0.3)',
        icon: Clock,
    },
    CONFIRMED: {
        label: 'Đã Xác Nhận Vào Kho',
        color: '#5BA88A',
        bg: 'rgba(91,168,138,0.15)',
        border: 'rgba(91,168,138,0.3)',
        icon: CheckCircle2,
    },
}

// ── Date Presets (MISA Standard) ───────────────────
export type DatePresetKey =
    | 'ALL'
    | 'TODAY'
    | 'YESTERDAY'
    | 'THIS_WEEK'
    | 'LAST_WEEK'
    | 'THIS_MONTH'
    | 'LAST_MONTH'
    | 'THIS_QUARTER'
    | 'LAST_QUARTER'
    | 'THIS_YEAR'
    | 'LAST_YEAR'
    | 'CUSTOM'

export const DATE_PRESET_OPTIONS: { key: DatePresetKey; label: string }[] = [
    { key: 'ALL', label: 'Tất cả thời gian' },
    { key: 'TODAY', label: 'Hôm nay' },
    { key: 'YESTERDAY', label: 'Hôm qua' },
    { key: 'THIS_WEEK', label: 'Tuần này' },
    { key: 'LAST_WEEK', label: 'Tuần trước' },
    { key: 'THIS_MONTH', label: 'Tháng này' },
    { key: 'LAST_MONTH', label: 'Tháng trước' },
    { key: 'THIS_QUARTER', label: 'Quý này' },
    { key: 'LAST_QUARTER', label: 'Quý trước' },
    { key: 'THIS_YEAR', label: 'Năm nay' },
    { key: 'LAST_YEAR', label: 'Năm trước' },
    { key: 'CUSTOM', label: 'Tùy chỉnh' },
]

export function getDatePresetRange(preset: DatePresetKey): { dateFrom: string; dateTo: string } {
    const now = new Date()
    const formatDateStr = (d: Date) => {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    switch (preset) {
        case 'TODAY': {
            const todayStr = formatDateStr(now)
            return { dateFrom: todayStr, dateTo: todayStr }
        }
        case 'YESTERDAY': {
            const y = new Date(now)
            y.setDate(y.getDate() - 1)
            const yStr = formatDateStr(y)
            return { dateFrom: yStr, dateTo: yStr }
        }
        case 'THIS_WEEK': {
            const dayOfWeek = now.getDay()
            const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
            const mon = new Date(now)
            mon.setDate(now.getDate() + diffToMon)
            return { dateFrom: formatDateStr(mon), dateTo: formatDateStr(now) }
        }
        case 'LAST_WEEK': {
            const dayOfWeek = now.getDay()
            const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
            const lastMon = new Date(now)
            lastMon.setDate(now.getDate() + diffToMon - 7)
            const lastSun = new Date(lastMon)
            lastSun.setDate(lastMon.getDate() + 6)
            return { dateFrom: formatDateStr(lastMon), dateTo: formatDateStr(lastSun) }
        }
        case 'THIS_MONTH': {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_MONTH': {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'THIS_QUARTER': {
            const currentMonth = now.getMonth()
            const qStartMonth = Math.floor(currentMonth / 3) * 3
            const firstDay = new Date(now.getFullYear(), qStartMonth, 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_QUARTER': {
            const currentMonth = now.getMonth()
            const qStartMonth = Math.floor(currentMonth / 3) * 3 - 3
            const firstDay = new Date(now.getFullYear(), qStartMonth, 1)
            const lastDay = new Date(now.getFullYear(), qStartMonth + 3, 0)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'THIS_YEAR': {
            const firstDay = new Date(now.getFullYear(), 0, 1)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(now) }
        }
        case 'LAST_YEAR': {
            const firstDay = new Date(now.getFullYear() - 1, 0, 1)
            const lastDay = new Date(now.getFullYear() - 1, 11, 31)
            return { dateFrom: formatDateStr(firstDay), dateTo: formatDateStr(lastDay) }
        }
        case 'ALL':
        default:
            return { dateFrom: '', dateTo: '' }
    }
}

// ── Stat Card Component ────────────────────────────
function GRStatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
    return (
        <div className="p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.01]"
            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}20` }}>
                <div className="w-3.5 h-3.5 rounded-xs" style={{ background: accent }} />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{label}</p>
                <p className="text-xl font-bold mt-0.5 font-mono" style={{ color: '#E8F1F2' }}>{value}</p>
                {sub && <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{sub}</p>}
            </div>
        </div>
    )
}

// ── Filter Tabs ────────────────────────────────────
const TAB_ORDER = ['ALL', 'DRAFT', 'CONFIRMED'] as const
const TAB_LABELS: Record<string, string> = {
    ALL: 'Tất cả',
    DRAFT: 'Nháp / Chờ xác nhận',
    CONFIRMED: 'Đã xác nhận nhập kho',
}

function FilterTabs({ active, counts, onChange }: { active: string; counts: Record<string, number>; onChange: (s: string) => void }) {
    return (
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {TAB_ORDER.map(tab => {
                const isActive = (tab === 'ALL' && active === '') || tab === active
                const count = tab === 'ALL' ? (counts.ALL ?? 0) : (counts[tab] ?? 0)
                return (
                    <button
                        key={tab}
                        onClick={() => onChange(tab === 'ALL' ? '' : tab)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer"
                        style={{
                            background: isActive ? 'rgba(135,203,185,0.15)' : 'transparent',
                            color: isActive ? '#87CBB9' : '#8AAEBB',
                            border: isActive ? '1px solid rgba(135,203,185,0.4)' : '1px solid transparent',
                        }}
                    >
                        <span>{TAB_LABELS[tab]}</span>
                        <span
                            className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
                            style={{
                                background: isActive ? '#87CBB9' : '#2A4355',
                                color: isActive ? '#0F1E2E' : '#8AAEBB',
                            }}
                        >
                            {count}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MAIN GOODS RECEIPT COMPONENT
// ═══════════════════════════════════════════════════
export function GoodsReceiptTab({ warehouses }: {
    warehouses: { id: string; code: string; name: string }[]
}) {
    const [rows, setRows] = useState<GoodsReceiptRow[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailData, setDetailData] = useState<GRDetail>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // Filters state
    const [statusFilter, setStatusFilter] = useState('')
    const [warehouseFilter, setWarehouseFilter] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [datePreset, setDatePreset] = useState<DatePresetKey>('ALL')
    const [customDateFrom, setCustomDateFrom] = useState('')
    const [customDateTo, setCustomDateTo] = useState('')
    const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'QTY_DESC' | 'GR_NO'>('NEWEST')
    const [showStats, setShowStats] = useState(true)
    const [exporting, setExporting] = useState(false)

    const reload = async () => {
        setLoading(true)
        try {
            const d = await getGoodsReceipts()
            setRows(d)
        } catch (err: any) {
            toast.error(`Lỗi tải danh sách GR: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { reload() }, [])

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        try {
            const data = await getGRDetail(id)
            setDetailData(data)
        } catch (err: any) {
            toast.error(`Lỗi tải chi tiết: ${err.message}`)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleConfirm = async (id: string, grNo: string) => {
        if (!confirm(`Xác nhận nhập kho phiếu ${grNo}? Tồn kho thực tế sẽ được cập nhật ngay lập tức.`)) return
        toast.promise(
            confirmGoodsReceipt(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi xác nhận GR')
                await reload()
                if (detailData && detailData.id === id) {
                    const refreshed = await getGRDetail(id)
                    setDetailData(refreshed)
                }
                return res
            }),
            {
                loading: 'Đang xác nhận nhập kho...',
                success: `Phiếu ${grNo} đã xác nhận — Tồn kho đã cập nhật!`,
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
    }

    // Export Excel
    const handleExportExcel = async () => {
        setExporting(true)
        try {
            const { dateFrom, dateTo } = datePreset === 'CUSTOM'
                ? { dateFrom: customDateFrom, dateTo: customDateTo }
                : getDatePresetRange(datePreset)

            const res = await exportGoodsReceiptsExcel({
                warehouseId: warehouseFilter || undefined,
                status: statusFilter || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
            })

            const byteCharacters = atob(res.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = res.filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success(`Đã xuất file Excel: ${res.filename}`)
        } catch (err: any) {
            toast.error(`Lỗi xuất Excel: ${err.message}`)
        } finally {
            setExporting(false)
        }
    }

    // Filtered & Sorted Rows
    const filteredRows = useMemo(() => {
        const { dateFrom, dateTo } = datePreset === 'CUSTOM'
            ? { dateFrom: customDateFrom, dateTo: customDateTo }
            : getDatePresetRange(datePreset)

        return rows.filter(r => {
            // Status filter
            if (statusFilter && r.status !== statusFilter) return false

            // Warehouse filter
            if (warehouseFilter && r.warehouseId !== warehouseFilter) return false

            // Search query (GR No, PO No, Warehouse name, ConfirmedBy, Product summary)
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchGR = r.grNo.toLowerCase().includes(q)
                const matchPO = r.poNo.toLowerCase().includes(q)
                const matchWH = r.warehouseName.toLowerCase().includes(q)
                const matchConfirmer = (r.confirmedBy ?? '').toLowerCase().includes(q)
                const matchProducts = (r.productSummary ?? '').toLowerCase().includes(q)
                if (!matchGR && !matchPO && !matchWH && !matchConfirmer && !matchProducts) return false
            }

            // Date Range
            if (dateFrom || dateTo) {
                const rowDate = new Date(r.createdAt).toISOString().split('T')[0]
                if (dateFrom && rowDate < dateFrom) return false
                if (dateTo && rowDate > dateTo) return false
            }

            return true
        }).sort((a, b) => {
            if (sortBy === 'NEWEST') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            if (sortBy === 'OLDEST') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            if (sortBy === 'QTY_DESC') return b.totalQtyReceived - a.totalQtyReceived
            if (sortBy === 'GR_NO') return a.grNo.localeCompare(b.grNo)
            return 0
        })
    }, [rows, statusFilter, warehouseFilter, searchQuery, datePreset, customDateFrom, customDateTo, sortBy])

    // Metric counts
    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: rows.length, DRAFT: 0, CONFIRMED: 0 }
        for (const r of rows) {
            if (r.status in counts) {
                counts[r.status]++
            }
        }
        return counts
    }, [rows])

    const totalBottlesFiltered = useMemo(() => {
        return filteredRows.reduce((sum, r) => sum + r.totalQtyReceived, 0)
    }, [filteredRows])

    const totalCasesFiltered = useMemo(() => {
        return filteredRows.reduce((sum, r) => sum + (r.totalCases || Math.round((r.totalQtyReceived / 6) * 10) / 10), 0)
    }, [filteredRows])

    const inputCls = "px-3 py-2 rounded-lg text-xs outline-none transition-all"
    const darkInputStyle = {
        background: '#1B2E3D',
        border: '1px solid #2A4355',
        color: '#E8F1F2',
    }

    return (
        <div className="space-y-4">
            {/* ── 1. Header with Inline Metrics & Quick Actions (Sales/Procurement Style) ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl border shadow-sm"
                style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0 shadow-sm"
                        style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.35)' }}>
                        <PackagePlus size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                                Phiếu Nhập Kho (Goods Receipt)
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                {rows.length} phiếu
                            </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>
                            Quản lý tiếp nhận hàng hóa thực tế từ Purchase Order vào kho & vị trí
                        </p>

                        {/* Inline Quick Stats Badges */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                            <span style={{ color: '#4A6A7A' }}>Chỉ số:</span>
                            <span className="font-semibold" style={{ color: '#8AAEBB' }}>
                                Tổng GR: <strong className="font-mono" style={{ color: '#E8F1F2' }}>{rows.length}</strong>
                            </span>
                            <span style={{ color: '#2A4355' }}>·</span>
                            <span className="font-semibold" style={{ color: '#D4A853' }}>
                                Chờ xác nhận: <strong className="font-mono">{statusCounts.DRAFT ?? 0}</strong>
                            </span>
                            <span style={{ color: '#2A4355' }}>·</span>
                            <span className="font-semibold" style={{ color: '#5BA88A' }}>
                                Đã nhập kho: <strong className="font-mono">{statusCounts.CONFIRMED ?? 0}</strong>
                            </span>
                            <span style={{ color: '#2A4355' }}>·</span>
                            <span className="font-semibold" style={{ color: '#4A8FAB' }}>
                                Tổng nhận: <strong className="font-mono text-emerald-400">
                                    {Math.round(rows.reduce((s, r) => s + (r.totalCases || r.totalQtyReceived / 6), 0) * 10) / 10} thùng
                                </strong> ({rows.reduce((s, r) => s + r.totalQtyReceived, 0).toLocaleString()} chai)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 self-start lg:self-center flex-wrap">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB' }}
                        title={showStats ? "Ẩn chỉ số" : "Hiện chỉ số"}
                    >
                        {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>Chỉ số</span>
                    </button>

                    <button
                        onClick={reload}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB' }}
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
                        <span>Làm mới</span>
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={exporting || rows.length === 0}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#87CBB9' }}
                    >
                        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>Xuất Excel</span>
                    </button>

                    <button
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-sm cursor-pointer hover:opacity-90 active:scale-95"
                        style={{ background: '#5BA88A', color: '#0F1E2E' }}
                    >
                        <Plus size={15} />
                        <span>Tạo Phiếu GR</span>
                    </button>
                </div>
            </div>

            {/* ── 2. Collapsible Stat Cards (Matching SalesClient) ── */}
            {showStats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <GRStatCard
                        label="Tổng Phiếu GR"
                        value={filteredRows.length}
                        sub={`Trong bộ lọc hiện tại`}
                        accent="#87CBB9"
                    />
                    <GRStatCard
                        label="Chờ Xác Nhận (Nháp)"
                        value={filteredRows.filter(r => r.status === 'DRAFT').length}
                        sub="Chưa cập nhật tồn kho"
                        accent="#D4A853"
                    />
                    <GRStatCard
                        label="Đã Nhập Kho Thực Tế"
                        value={filteredRows.filter(r => r.status === 'CONFIRMED').length}
                        sub="Tồn kho đã ghi nhận"
                        accent="#5BA88A"
                    />
                    <GRStatCard
                        label="Tổng Thùng / Chai Nhận"
                        value={`${Math.round(totalCasesFiltered * 10) / 10} thùng`}
                        sub={`${totalBottlesFiltered.toLocaleString()} chai thực nhận`}
                        accent="#4A8FAB"
                    />
                </div>
            )}

            {/* ── 3. Single-Row MISA Filter & Preset Toolbar ── */}
            <div className="p-4 rounded-xl border space-y-3"
                style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                {/* Filter Tabs */}
                <div className="border-b pb-3" style={{ borderColor: '#2A4355' }}>
                    <FilterTabs active={statusFilter} counts={statusCounts} onChange={setStatusFilter} />
                </div>

                {/* Search + Dropdowns + Date Presets Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                        <input
                            type="text"
                            placeholder="Tìm số GR, số PO, mã SKU, tên SP, kho nhận..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className={`${inputCls} w-full pl-9 pr-8`}
                            style={darkInputStyle}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#8AAEBB] hover:text-[#E8F1F2]"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Warehouse Filter */}
                    <div className="min-w-[160px]">
                        <select
                            value={warehouseFilter}
                            onChange={e => setWarehouseFilter(e.target.value)}
                            className={inputCls}
                            style={darkInputStyle}
                        >
                            <option value="">— Tất cả các kho —</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* MISA Date Preset Selector */}
                    <div className="min-w-[150px]">
                        <select
                            value={datePreset}
                            onChange={e => setDatePreset(e.target.value as DatePresetKey)}
                            className={inputCls}
                            style={darkInputStyle}
                        >
                            {DATE_PRESET_OPTIONS.map(p => (
                                <option key={p.key} value={p.key}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Custom Date Pickers when CUSTOM is selected */}
                    {datePreset === 'CUSTOM' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                                type="date"
                                value={customDateFrom}
                                onChange={e => setCustomDateFrom(e.target.value)}
                                className={inputCls}
                                style={darkInputStyle}
                                placeholder="Từ ngày"
                            />
                            <span style={{ color: '#4A6A7A' }}>→</span>
                            <input
                                type="date"
                                value={customDateTo}
                                onChange={e => setCustomDateTo(e.target.value)}
                                className={inputCls}
                                style={darkInputStyle}
                                placeholder="Đến ngày"
                            />
                        </div>
                    )}

                    {/* Sort Selector */}
                    <div className="min-w-[140px]">
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value as any)}
                            className={inputCls}
                            style={darkInputStyle}
                        >
                            <option value="NEWEST">Mới nhất trước</option>
                            <option value="OLDEST">Cũ nhất trước</option>
                            <option value="QTY_DESC">SL nhận giảm dần</option>
                            <option value="GR_NO">Mã GR (A-Z)</option>
                        </select>
                    </div>

                    {/* Reset Filters button if any active */}
                    {(statusFilter || warehouseFilter || searchQuery || datePreset !== 'ALL') && (
                        <button
                            onClick={() => {
                                setStatusFilter('')
                                setWarehouseFilter('')
                                setSearchQuery('')
                                setDatePreset('ALL')
                                setCustomDateFrom('')
                                setCustomDateTo('')
                            }}
                            className="px-2.5 py-2 text-xs font-semibold rounded-lg text-[#8AAEBB] hover:text-[#E8F1F2] hover:bg-[#142433] transition-all cursor-pointer"
                        >
                            Xóa lọc
                        </button>
                    )}
                </div>
            </div>

            {/* ── 4. Desktop Table View (Sales/Procurement Matching Style) ── */}
            <div className="rounded-xl overflow-hidden hidden md:block border shadow-sm"
                style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', color: '#8AAEBB' }}>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Số Phiếu GR</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Đơn Mua (PO)</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Kho Tiếp Nhận</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Số Mặt Hàng</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Tổng SL Nhận (Thùng / Chai)</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Trạng Thái</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Người Xác Nhận</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold">Ngày Tạo</th>
                            <th className="px-4 py-3.5 text-[11px] uppercase tracking-wider font-bold text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#2A4355' }}>
                        {loading ? (
                            <tr>
                                <td colSpan={9} className="text-center py-16">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 size={24} className="animate-spin text-emerald-400" />
                                        <span className="text-xs" style={{ color: '#8AAEBB' }}>Đang tải danh sách phiếu nhập kho...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-16 text-xs" style={{ color: '#4A6A7A' }}>
                                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                                    Không tìm thấy phiếu nhập kho nào phù hợp với bộ lọc
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map(gr => {
                                const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                                const StatusIcon = st.icon
                                const cases = gr.totalCases ?? (Math.round((gr.totalQtyReceived / 6) * 10) / 10)
                                return (
                                    <tr
                                        key={gr.id}
                                        onClick={() => openDetail(gr.id)}
                                        className="transition-colors cursor-pointer hover:bg-[#142433]/60"
                                        style={{ borderBottom: '1px solid #2A4355' }}
                                    >
                                        {/* GR No */}
                                        <td className="px-4 py-3.5">
                                            <span
                                                className="text-xs font-bold font-mono px-2.5 py-1 rounded-md inline-block shadow-2xs"
                                                style={{
                                                    background: 'rgba(135,203,185,0.15)',
                                                    color: '#87CBB9',
                                                    border: '1px solid rgba(135,203,185,0.3)',
                                                }}
                                            >
                                                {gr.grNo}
                                            </span>
                                        </td>

                                        {/* PO No */}
                                        <td className="px-4 py-3.5">
                                            <span
                                                className="text-xs font-mono font-bold px-2 py-0.5 rounded inline-block"
                                                style={{
                                                    background: 'rgba(212,168,83,0.12)',
                                                    color: '#D4A853',
                                                    border: '1px solid rgba(212,168,83,0.25)',
                                                }}
                                            >
                                                {gr.poNo}
                                            </span>
                                        </td>

                                        {/* Warehouse */}
                                        <td className="px-4 py-3.5 text-xs font-medium" style={{ color: '#E8F1F2' }}>
                                            <div className="flex items-center gap-1.5">
                                                <MapPin size={13} style={{ color: '#4A8FAB' }} />
                                                <span>{gr.warehouseName}</span>
                                            </div>
                                        </td>

                                        {/* SKU count */}
                                        <td className="px-4 py-3.5 text-xs font-medium" style={{ color: '#8AAEBB' }}>
                                            {gr.lineCount} sản phẩm
                                        </td>

                                        {/* Total Qty (Cases + Bottles) */}
                                        <td className="px-4 py-3.5 text-xs font-medium">
                                            <div className="flex items-baseline gap-1.5">
                                                <strong className="font-mono text-sm" style={{ color: '#87CBB9' }}>
                                                    {cases} thùng
                                                </strong>
                                                <span className="text-[11px] font-mono" style={{ color: '#8AAEBB' }}>
                                                    ({gr.totalQtyReceived.toLocaleString()} chai)
                                                </span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5">
                                            <span
                                                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                                                style={{ color: st.color, background: st.bg, borderColor: st.border }}
                                            >
                                                <StatusIcon size={12} />
                                                {st.label}
                                            </span>
                                        </td>

                                        {/* Confirmer & ConfirmedAt */}
                                        <td className="px-4 py-3.5 text-xs" style={{ color: '#8AAEBB' }}>
                                            {gr.confirmedBy ? (
                                                <div>
                                                    <p className="font-semibold" style={{ color: '#E8F1F2' }}>{gr.confirmedBy}</p>
                                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                        {gr.confirmedAt ? formatDateTime(gr.confirmedAt) : ''}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#4A6A7A' }}>—</span>
                                            )}
                                        </td>

                                        {/* CreatedAt */}
                                        <td className="px-4 py-3.5 text-xs" style={{ color: '#8AAEBB' }}>
                                            {formatDate(gr.createdAt)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => openDetail(gr.id)}
                                                    className="p-1.5 rounded-lg transition-all cursor-pointer hover:bg-[#142433]"
                                                    style={{ color: '#87CBB9', border: '1px solid #2A4355' }}
                                                    title="Xem chi tiết phiếu nhập kho"
                                                >
                                                    <Eye size={14} />
                                                </button>

                                                {gr.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleConfirm(gr.id, gr.grNo)}
                                                        className="px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                                                        style={{ background: '#5BA88A', color: '#0F1E2E' }}
                                                        title="Xác nhận nhập kho ngay"
                                                    >
                                                        Xác Nhận
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>

                {/* Table Summary Footer */}
                {!loading && filteredRows.length > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 text-xs border-t"
                        style={{ background: '#142433', borderColor: '#2A4355', color: '#8AAEBB' }}>
                        <span>
                            Hiển thị <strong style={{ color: '#E8F1F2' }}>{filteredRows.length}</strong> / {rows.length} phiếu nhập kho
                        </span>
                        <div className="flex items-center gap-4">
                            <span>
                                Tổng SL thực nhận: <strong className="font-mono text-sm" style={{ color: '#87CBB9' }}>{Math.round(totalCasesFiltered * 10) / 10} thùng</strong> <span style={{ color: '#8AAEBB' }}>({totalBottlesFiltered.toLocaleString()} chai)</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── 5. Mobile Cards View (Responsive) ── */}
            <div className="block md:hidden space-y-2.5">
                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 size={24} className="animate-spin inline text-emerald-400" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="text-center py-12 text-xs rounded-xl border p-4"
                        style={{ background: '#1B2E3D', borderColor: '#2A4355', color: '#4A6A7A' }}>
                        Không có phiếu nhập kho nào
                    </div>
                ) : (
                    filteredRows.map(gr => {
                        const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                        const StatusIcon = st.icon
                        const cases = gr.totalCases ?? (Math.round((gr.totalQtyReceived / 6) * 10) / 10)
                        return (
                            <div
                                key={gr.id}
                                onClick={() => openDetail(gr.id)}
                                className="p-4 rounded-xl space-y-2.5 cursor-pointer transition-all active:scale-[0.99] border shadow-sm"
                                style={{ background: '#1B2E3D', borderColor: '#2A4355' }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span
                                        className="text-xs font-bold font-mono px-2 py-0.5 rounded"
                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}
                                    >
                                        GR: {gr.grNo}
                                    </span>
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                        style={{ color: st.color, background: st.bg, borderColor: st.border }}
                                    >
                                        <StatusIcon size={10} />
                                        {st.label}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <span style={{ color: '#8AAEBB' }}>
                                        PO: <strong className="font-mono" style={{ color: '#D4A853' }}>{gr.poNo}</strong>
                                    </span>
                                    <span className="font-medium" style={{ color: '#E8F1F2' }}>
                                        Kho: {gr.warehouseName}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between pt-2 text-xs border-t"
                                    style={{ borderColor: '#2A4355' }}>
                                    <span style={{ color: '#8AAEBB' }}>
                                        {gr.lineCount} sản phẩm · <strong className="font-mono text-emerald-400">{cases} thùng</strong> ({gr.totalQtyReceived.toLocaleString()} chai)
                                    </span>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openDetail(gr.id)}
                                            className="px-2.5 py-1 text-xs font-bold rounded-lg"
                                            style={{ background: '#142433', color: '#87CBB9', border: '1px solid #2A4355' }}
                                        >
                                            Chi Tiết
                                        </button>
                                        {gr.status === 'DRAFT' && (
                                            <button
                                                onClick={() => handleConfirm(gr.id, gr.grNo)}
                                                className="px-2.5 py-1 text-xs font-bold rounded-lg"
                                                style={{ background: '#5BA88A', color: '#0F1E2E' }}
                                            >
                                                Xác Nhận
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* ── 6. Detail Slide-over Drawer (Matching Sales/Procurement) ── */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs">
                    <div className="w-full sm:w-[780px] max-w-full h-full overflow-y-auto border-l shadow-2xl flex flex-col"
                        style={{ background: '#0F1E2E', borderColor: '#2A4355' }}>
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-5 border-b flex-shrink-0"
                            style={{ background: '#142433', borderColor: '#2A4355' }}>
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>
                                        Phiếu Nhập Kho {detailData?.grNo ?? '...'}
                                    </h3>
                                    {detailData && (
                                        <span
                                            className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border"
                                            style={{
                                                color: (GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).color,
                                                background: (GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).bg,
                                                borderColor: (GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).border,
                                            }}
                                        >
                                            {(GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).label}
                                        </span>
                                    )}
                                </div>
                                {detailData && (
                                    <p className="text-xs mt-1" style={{ color: '#8AAEBB' }}>
                                        Đơn Mua: <strong className="font-mono text-[#D4A853]">{detailData.poNo}</strong> · NCC: <strong className="text-[#E8F1F2]">{detailData.supplierName}</strong>
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {detailData && detailData.status === 'DRAFT' && (
                                    <button
                                        onClick={() => handleConfirm(detailData.id, detailData.grNo)}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs"
                                        style={{ background: '#5BA88A', color: '#0F1E2E' }}
                                    >
                                        Xác Nhận GR
                                    </button>
                                )}
                                <button
                                    onClick={() => setDetailData(null)}
                                    className="p-1.5 rounded-lg text-[#8AAEBB] hover:text-[#E8F1F2] hover:bg-[#1B2E3D] cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Drawer Body */}
                        {detailLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 flex-1">
                                <Loader2 size={32} className="animate-spin text-emerald-400" />
                                <p className="text-xs mt-2" style={{ color: '#8AAEBB' }}>Đang nạp chi tiết phiếu nhập kho...</p>
                            </div>
                        ) : detailData && (
                            <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                                {/* Info Cards 4-grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="p-3 rounded-xl border" style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Kho Nhận</p>
                                        <p className="text-xs font-bold mt-1 truncate" style={{ color: '#E8F1F2' }}>{detailData.warehouseName}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border" style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Ngày Lập</p>
                                        <p className="text-xs font-bold mt-1 font-mono" style={{ color: '#E8F1F2' }}>{formatDate(detailData.createdAt)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border" style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Người Xác Nhận</p>
                                        <p className="text-xs font-bold mt-1 truncate" style={{ color: '#E8F1F2' }}>{detailData.confirmedBy ?? 'Chưa xác nhận'}</p>
                                    </div>
                                    <div className="p-3 rounded-xl border" style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                                        <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Ngày Xác Nhận</p>
                                        <p className="text-xs font-bold mt-1 font-mono" style={{ color: '#E8F1F2' }}>
                                            {detailData.confirmedAt ? formatDate(detailData.confirmedAt) : '—'}
                                        </p>
                                    </div>
                                </div>

                                {/* Step Workflow Indicator */}
                                <div className="p-3.5 rounded-xl border" style={{ background: '#142433', borderColor: '#2A4355' }}>
                                    <p className="text-[10px] uppercase font-bold tracking-wider mb-2.5" style={{ color: '#8AAEBB' }}>
                                        Tiến Trình Nhập Kho
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="p-2 rounded-lg" style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                            <p className="font-bold">1. Tạo GR</p>
                                            <p className="text-[10px] opacity-80">{formatDate(detailData.createdAt)}</p>
                                        </div>
                                        <div className="p-2 rounded-lg" style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                            <p className="font-bold">2. Kiểm Đếm & Vị Trí</p>
                                            <p className="text-[10px] opacity-80">{detailData.lines.length} mặt hàng</p>
                                        </div>
                                        <div
                                            className="p-2 rounded-lg"
                                            style={detailData.status === 'CONFIRMED' ? {
                                                background: 'rgba(91,168,138,0.15)',
                                                color: '#5BA88A',
                                                border: '1px solid rgba(91,168,138,0.3)',
                                            } : {
                                                background: 'rgba(212,168,83,0.12)',
                                                color: '#D4A853',
                                                border: '1px solid rgba(212,168,83,0.25)',
                                            }}
                                        >
                                            <p className="font-bold">3. Nhập Tồn Kho</p>
                                            <p className="text-[10px] opacity-80">
                                                {detailData.status === 'CONFIRMED' ? 'Đã cập nhật tồn' : 'Chờ xác nhận'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Detail Lines Table */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#87CBB9' }}>
                                            Chi Tiết Sản Phẩm Nhập Kho ({detailData.lines.length} dòng)
                                        </h4>
                                        <span className="text-xs" style={{ color: '#8AAEBB' }}>
                                            Tổng nhận: <strong className="font-mono text-emerald-400" style={{ color: '#87CBB9' }}>
                                                {Math.round(detailData.lines.reduce((s, l) => s + (l.casesReceived || (l.qtyReceived / (l.unitsPerCase || 6))), 0) * 10) / 10} thùng
                                            </strong> ({detailData.lines.reduce((s, l) => s + l.qtyReceived, 0).toLocaleString()} chai)
                                        </span>
                                    </div>

                                    <div className="rounded-xl overflow-hidden border shadow-sm"
                                        style={{ background: '#1B2E3D', borderColor: '#2A4355' }}>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', color: '#8AAEBB' }}>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Mã SKU</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Tên Sản Phẩm</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Quy Cách</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Niên Vụ</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Mã Lô</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold">Vị Trí</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-right">Dự Kiến (PO)</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-right">Thực Nhận</th>
                                                        <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-right">Chênh Lệch</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y" style={{ borderColor: '#2A4355' }}>
                                                    {detailData.lines.map(l => (
                                                        <tr key={l.id} className="hover:bg-[#142433]/50">
                                                            <td className="px-3 py-2.5 font-bold font-mono" style={{ color: '#87CBB9' }}>
                                                                {l.skuCode}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-medium" style={{ color: '#E8F1F2' }}>
                                                                {l.productName}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: '#8AAEBB' }}>
                                                                {l.unitsPerCase || 6} chai/thùng
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono font-bold" style={{ color: '#D4A853' }}>
                                                                {l.vintage ? l.vintage : '—'}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[11px]" style={{ color: '#8AAEBB' }}>
                                                                {l.lotNo}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono font-medium" style={{ color: '#4A8FAB' }}>
                                                                {l.locationCode}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-right" style={{ color: '#8AAEBB' }}>
                                                                <div>
                                                                    <strong>{l.casesExpected ?? Math.round((l.qtyExpected / (l.unitsPerCase || 6)) * 10) / 10} thg</strong>
                                                                    <p className="text-[10px] opacity-75">{l.qtyExpected} chai</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-right" style={{ color: '#5BA88A' }}>
                                                                <div>
                                                                    <strong>{l.casesReceived ?? Math.round((l.qtyReceived / (l.unitsPerCase || 6)) * 10) / 10} thg</strong>
                                                                    <p className="text-[10px] opacity-75">{l.qtyReceived} chai</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono font-bold text-right"
                                                                style={{
                                                                    color: l.variance > 0 ? '#5BA88A' : (l.variance < 0 ? '#E85D5D' : '#8AAEBB')
                                                                }}>
                                                                {l.variance === 0 ? '—' : (
                                                                    <div>
                                                                        <span>{l.casesVariance > 0 ? `+${l.casesVariance}` : l.casesVariance} thg</span>
                                                                        <p className="text-[10px]">{l.variance > 0 ? `+${l.variance}` : l.variance} chai</p>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── 7. Create GR Drawer (Matching Sales/Procurement Drawer Style) ── */}
            {createOpen && (
                <CreateGRDrawer
                    warehouses={warehouses}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => {
                        setCreateOpen(false)
                        reload()
                    }}
                />
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// CREATE GR DRAWER (Dark Theme & Live Dropdowns + Cases)
// ═══════════════════════════════════════════════════
function CreateGRDrawer({ warehouses, onClose, onCreated }: {
    warehouses: { id: string; code: string; name: string }[]
    onClose: () => void
    onCreated: () => void
}) {
    const [pos, setPOs] = useState<POOption[]>([])
    const [selectedPO, setSelectedPO] = useState<POOption | null>(null)
    const [poSearch, setPoSearch] = useState('')
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '')
    const [locations, setLocations] = useState<{ id: string; locationCode: string; zone: string; rack?: string | null; bin?: string | null }[]>([])
    const [loadingLocations, setLoadingLocations] = useState(false)
    const [lines, setLines] = useState<{
        productId: string
        qtyReceived: number
        casesReceived: number
        locationId: string
        vintage: string
    }[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getPOsForReceiving().then(data => {
            setPOs(data as any)
        })
    }, [])

    // Fetch locations when warehouse changes
    useEffect(() => {
        if (!warehouseId) {
            setLocations([])
            return
        }
        setLoadingLocations(true)
        getLocations(warehouseId).then(locs => {
            setLocations(locs)
            if (locs.length > 0) {
                // Auto-fill first location for lines if not set
                setLines(prev => prev.map(l => ({
                    ...l,
                    locationId: l.locationId || locs[0].id
                })))
            }
        }).catch(err => {
            console.error('Lỗi khi lấy vị trí kho:', err)
        }).finally(() => {
            setLoadingLocations(false)
        })
    }, [warehouseId])

    const selectPO = (poId: string) => {
        const po = pos.find(p => p.id === poId) || null
        setSelectedPO(po)
        if (po) {
            setLines(po.lines.map(l => {
                const u = l.unitsPerCase || 6
                return {
                    productId: l.productId,
                    qtyReceived: l.qtyOrdered,
                    casesReceived: l.casesOrdered ?? Math.round((l.qtyOrdered / u) * 10) / 10,
                    locationId: locations.length > 0 ? locations[0].id : '',
                    vintage: '',
                }
            }))
        }
    }

    const filteredPOs = useMemo(() => {
        if (!poSearch.trim()) return pos
        const q = poSearch.toLowerCase()
        return pos.filter(p => p.poNo.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q))
    }, [pos, poSearch])

    const handleSave = async () => {
        if (!selectedPO || !warehouseId) return toast.error('Vui lòng chọn PO và kho nhận')
        const validLines = lines.filter(l => l.qtyReceived > 0 && l.locationId)
        if (validLines.length === 0) return toast.error('Vui lòng nhập số lượng nhận (> 0) và chọn vị trí kho cho các sản phẩm')

        setSaving(true)
        try {
            await toast.promise(
                createGoodsReceipt({
                    poId: selectedPO.id,
                    warehouseId,
                    lines: validLines.map(l => ({
                        productId: l.productId,
                        qtyReceived: l.qtyReceived,
                        locationId: l.locationId,
                        vintage: l.vintage?.trim() ? (isNaN(Number(l.vintage.trim())) ? l.vintage.trim() : Number(l.vintage.trim())) : null,
                    }))
                }).then(async (res) => {
                    if (!res.success) throw new Error(res.error || 'Lỗi tạo phiếu nhập kho')
                    onCreated()
                    return res
                }),
                {
                    loading: 'Đang tạo phiếu nhập kho & khởi tạo lô hàng...',
                    success: 'Đã tạo Goods Receipt thành công!',
                    error: (err: Error) => `Lỗi: ${err.message}`
                }
            )
        } finally {
            setSaving(false)
        }
    }

    const inputCls = "w-full px-3 py-2 rounded-lg text-xs outline-none transition-all"
    const darkInputStyle = {
        background: '#1B2E3D',
        border: '1px solid #2A4355',
        color: '#E8F1F2',
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full sm:w-[740px] max-w-full h-full overflow-y-auto border-l shadow-2xl flex flex-col"
                style={{ background: '#0F1E2E', borderColor: '#2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b flex-shrink-0"
                    style={{ background: '#142433', borderColor: '#2A4355' }}>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>
                            Tạo Phiếu Nhập Kho (Goods Receipt)
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>
                            Nhập hàng từ đơn mua PO đã duyệt vào vị trí kho thực tế
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[#8AAEBB] hover:text-[#E8F1F2] hover:bg-[#1B2E3D] cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* PO Selector */}
                        <div>
                            <label className="block text-xs font-bold mb-1.5" style={{ color: '#E8F1F2' }}>
                                Đơn Mua Hàng (Purchase Order) *
                            </label>
                            <select
                                value={selectedPO?.id ?? ''}
                                onChange={e => selectPO(e.target.value)}
                                className={inputCls}
                                style={darkInputStyle}
                            >
                                <option value="">— Chọn đơn PO —</option>
                                {filteredPOs.map(p => (
                                    <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName} ({p.lines.length} SP)</option>
                                ))}
                            </select>
                        </div>

                        {/* Warehouse Selector */}
                        <div>
                            <label className="block text-xs font-bold mb-1.5" style={{ color: '#E8F1F2' }}>
                                Kho Tiếp Nhận *
                            </label>
                            <select
                                value={warehouseId}
                                onChange={e => setWarehouseId(e.target.value)}
                                className={inputCls}
                                style={darkInputStyle}
                            >
                                <option value="">— Chọn kho tiếp nhận —</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {selectedPO && lines.length > 0 && (
                        <>
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#87CBB9' }}>
                                    Sản Phẩm Cần Nhập ({lines.length} dòng)
                                </p>
                                <span className="text-[11px]" style={{ color: '#8AAEBB' }}>
                                    {locations.length > 0
                                        ? `Đã nạp ${locations.length} vị trí khả dụng`
                                        : (loadingLocations ? 'Đang nạp vị trí...' : 'Chưa có vị trí')}
                                </span>
                            </div>

                            <div className="space-y-3.5">
                                {selectedPO.lines.map((pol, i) => {
                                    const u = pol.unitsPerCase || 6
                                    return (
                                        <div
                                            key={pol.productId}
                                            className="p-4 rounded-xl border space-y-3 shadow-sm"
                                            style={{ background: '#1B2E3D', borderColor: '#2A4355' }}
                                        >
                                            {/* Product Title & Badges */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-bold" style={{ color: '#E8F1F2' }}>
                                                        {pol.productName || 'Sản phẩm ' + pol.skuCode}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <span
                                                            className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                                                            style={{
                                                                background: 'rgba(135,203,185,0.15)',
                                                                color: '#87CBB9',
                                                                border: '1px solid rgba(135,203,185,0.3)',
                                                            }}
                                                        >
                                                            SKU: {pol.skuCode}
                                                        </span>
                                                        <span
                                                            className="text-[11px] font-semibold px-2 py-0.5 rounded"
                                                            style={{
                                                                background: '#142433',
                                                                color: '#8AAEBB',
                                                                border: '1px solid #2A4355',
                                                            }}
                                                        >
                                                            Quy cách: {u} chai/thùng
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 self-start sm:self-center">
                                                    <span
                                                        className="text-xs font-mono font-bold px-2.5 py-1 rounded-md shrink-0"
                                                        style={{
                                                            background: 'rgba(212,168,83,0.15)',
                                                            color: '#D4A853',
                                                            border: '1px solid rgba(212,168,83,0.3)',
                                                        }}
                                                    >
                                                        PO: {pol.casesOrdered ?? Math.round((pol.qtyOrdered / u) * 10) / 10} thùng ({pol.qtyOrdered} chai)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Input Grid: SL Thùng, SL Chai, Niên Vụ, Vị Trí Kho */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                                                {/* SL Thùng */}
                                                <div>
                                                    <label className="text-[10px] font-bold block mb-1" style={{ color: '#87CBB9' }}>
                                                        SL Thùng Thực Nhận *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min={0}
                                                        value={lines[i]?.casesReceived ?? 0}
                                                        onChange={e => {
                                                            const cases = Number(e.target.value)
                                                            const bottles = Math.round(cases * u)
                                                            const v = [...lines]
                                                            v[i] = { ...v[i], casesReceived: cases, qtyReceived: bottles }
                                                            setLines(v)
                                                        }}
                                                        className={inputCls}
                                                        style={darkInputStyle}
                                                    />
                                                </div>

                                                {/* SL Chai */}
                                                <div>
                                                    <label className="text-[10px] font-bold block mb-1" style={{ color: '#8AAEBB' }}>
                                                        SL Chai Thực Nhận *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={lines[i]?.qtyReceived ?? 0}
                                                        onChange={e => {
                                                            const bottles = Number(e.target.value)
                                                            const cases = Math.round((bottles / u) * 10) / 10
                                                            const v = [...lines]
                                                            v[i] = { ...v[i], qtyReceived: bottles, casesReceived: cases }
                                                            setLines(v)
                                                        }}
                                                        className={inputCls}
                                                        style={darkInputStyle}
                                                    />
                                                </div>

                                                {/* Niên Vụ (Vintage) */}
                                                <div>
                                                    <label className="text-[10px] font-bold block mb-1" style={{ color: '#8AAEBB' }}>
                                                        Niên Vụ (Vintage)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="VD: 2020, 2022, NV..."
                                                        value={lines[i]?.vintage ?? ''}
                                                        onChange={e => {
                                                            const v = [...lines]
                                                            v[i] = { ...v[i], vintage: e.target.value }
                                                            setLines(v)
                                                        }}
                                                        className={inputCls}
                                                        style={darkInputStyle}
                                                    />
                                                </div>

                                                {/* Vị Trí Kho */}
                                                <div>
                                                    <label className="text-[10px] font-bold block mb-1" style={{ color: '#8AAEBB' }}>
                                                        Vị Trí Kho * {loadingLocations && <Loader2 size={10} className="animate-spin inline ml-1 text-emerald-400" />}
                                                    </label>
                                                    {locations.length > 0 ? (
                                                        <select
                                                            value={lines[i]?.locationId ?? ''}
                                                            onChange={e => {
                                                                const v = [...lines]
                                                                v[i] = { ...v[i], locationId: e.target.value }
                                                                setLines(v)
                                                            }}
                                                            className={inputCls}
                                                            style={darkInputStyle}
                                                        >
                                                            <option value="">-- Chọn vị trí --</option>
                                                            {locations.map(loc => (
                                                                <option key={loc.id} value={loc.id}>
                                                                    📍 {loc.locationCode} {loc.zone ? `(Khu ${loc.zone}${loc.rack ? ` - Kệ ${loc.rack}` : ''}${loc.bin ? ` - Ô ${loc.bin}` : ''})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder={loadingLocations ? "Đang tải vị trí..." : "Nhập mã vị trí (hoặc ID)"}
                                                            value={lines[i]?.locationId ?? ''}
                                                            onChange={e => {
                                                                const v = [...lines]
                                                                v[i] = { ...v[i], locationId: e.target.value }
                                                                setLines(v)
                                                            }}
                                                            className={inputCls}
                                                            style={darkInputStyle}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t flex-shrink-0"
                    style={{ background: '#142433', borderColor: '#2A4355' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedPO}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 hover:opacity-90 active:scale-[0.99]"
                        style={{ background: '#5BA88A', color: '#0F1E2E' }}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        <span>Tạo Phiếu Nhập Kho & Khởi Tạo Lô Hàng</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
