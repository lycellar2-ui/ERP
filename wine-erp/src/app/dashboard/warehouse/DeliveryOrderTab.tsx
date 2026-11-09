'use client'

import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, Minus, X, Eye, CheckCircle2, Loader2, Save, PackageCheck, AlertCircle, Search, ArrowRight, Box, Printer, RotateCcw, Phone, MapPin, Trash2, ShieldAlert, Check, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import {
    type DeliveryOrderRow,
    getDeliveryOrders, getSOsForDelivery, createDeliveryOrder, confirmDeliveryOrder, markDODelivered,
    reverseDeliveryOrder, updateDeliveryOrderDate, getDODetail, getAvailableLotsForProduct, getWarehouses,
    swapDOLineAndQuarantineDamaged,
} from './actions'
import { formatDate } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui'
import { formatFriendlyLocationName } from '../stock-count/location-names'

type SOOption = {
    id: string; soNo: string; customerName: string; createdAt?: Date | string; warehouseId?: string; legalEntityId?: string | null; legalEntityCode?: string | null
    lines: { productId: string; productName: string; skuCode: string; qtyOrdered: number; vintage: number | null }[]
}

type AvailableLot = {
    id: string; lotNo: string; locationId: string; locationCode: string
    qtyAvailable: number; receivedDate: Date
}

const DO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: '#F1F5F9' },
    CONFIRMED: { label: 'Đã XN', color: '#B47816', bg: 'rgba(180,83,9,0.15)' },
    SHIPPED: { label: 'Đã Giao', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
    REVERSED: { label: 'Đã Hoàn Tác', color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
    CANCELLED: { label: 'Đã Hủy', color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
}

type DODetail = Awaited<ReturnType<typeof getDODetail>>

export type WarehouseOption = {
    id: string
    code: string
    name: string
    legalEntityId?: string | null
    legalEntityCode?: string | null
    allowSales?: boolean
    allowTransfer?: boolean
    isDefault?: boolean
}

export function resolveWarehouseForSO(targetSO: SOOption, warehouses: WarehouseOption[]): string {
    const targetLegalEntityId = (targetSO as any).legalEntityId
    const targetLegalEntityCode = (targetSO as any).legalEntityCode
    const targetLegalEntityName = (targetSO as any).legalEntityName

    // Strictly filter warehouses belonging to the SO's legal entity by ID, Code, or Name match
    const entityWhs = warehouses.filter((w: any) => {
        if (!targetLegalEntityId && !targetLegalEntityCode && !targetLegalEntityName) return true
        if (targetLegalEntityId && w.legalEntityId === targetLegalEntityId) return true
        if (targetLegalEntityCode && w.legalEntityCode === targetLegalEntityCode) return true
        if (targetLegalEntityCode === 'TA' && (w.code?.includes('TA') || w.name?.includes('Thắng Ân'))) return true
        if (targetLegalEntityCode === 'LC' && (w.code?.includes('LYS') || w.name?.includes('Lys'))) return true
        if (targetLegalEntityName && w.legalEntityName && w.legalEntityName === targetLegalEntityName) return true
        return false
    })

    // If SO already had a warehouseId specified, check if that warehouse matches the SO's legal entity and allows sales
    if (targetSO.warehouseId) {
        const preSelectedWh = warehouses.find(w => w.id === targetSO.warehouseId)
        if (preSelectedWh && preSelectedWh.allowSales !== false) {
            const matchesEntity = entityWhs.length === 0 || entityWhs.some(w => w.id === preSelectedWh.id)
            if (matchesEntity) return preSelectedWh.id
        }
    }

    // Pick the default warehouse belonging to THIS specific Legal Entity that allows sales
    const pool = entityWhs.length > 0 ? entityWhs : warehouses
    const salesPool = pool.filter((w: any) => w.allowSales !== false)
    const defaultWh = salesPool.find((w: any) => w.isDefault)
        ?? salesPool[0]

    return defaultWh ? defaultWh.id : (warehouses.find(w => w.allowSales !== false)?.id ?? '')
}

export function DeliveryOrderTab({ warehouses }: {
    warehouses: WarehouseOption[]
}) {
    const [rows, setRows] = useState<DeliveryOrderRow[]>([])
    const [pendingSOs, setPendingSOs] = useState<SOOption[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [preselectedSOId, setPreselectedSOId] = useState<string | null>(null)
    const [detailData, setDetailData] = useState<DODetail>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending')
    const [searchQuery, setSearchQuery] = useState('')
    const [warehouseFilter, setWarehouseFilter] = useState('')
    const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL')
    const [showStats, setShowStats] = useState(true)
    const [swapTarget, setSwapTarget] = useState<any | null>(null)

    const [activeWarehouses, setActiveWarehouses] = useState<WarehouseOption[]>(warehouses)

    const reload = async () => { 
        setLoading(true)
        const [d, sosData, whsData] = await Promise.all([
            getDeliveryOrders(),
            getSOsForDelivery(),
            getWarehouses()
        ])
        setRows(d)
        setPendingSOs(sosData as any)
        if (whsData && whsData.length > 0) {
            setActiveWarehouses(whsData as any)
        }
        setLoading(false) 
    }

    useEffect(() => { reload() }, [])

    const filteredPendingSOs = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return pendingSOs.filter(s => {
            const targetWhId = resolveWarehouseForSO(s, activeWarehouses)
            const matchesWh = !warehouseFilter || targetWhId === warehouseFilter
            const matchesSearch = !q ||
                s.soNo.toLowerCase().includes(q) || 
                s.customerName?.toLowerCase().includes(q) ||
                s.lines.some(l =>
                    l.productName?.toLowerCase().includes(q) ||
                    l.skuCode?.toLowerCase().includes(q) ||
                    String(l.vintage ?? 'NV').toLowerCase().includes(q)
                )
            return matchesWh && matchesSearch
        })
    }, [pendingSOs, searchQuery, warehouseFilter, activeWarehouses])

    const filteredHistoryRows = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return rows.filter(d => {
            const matchesStatus = historyStatusFilter === 'ALL' || d.status === historyStatusFilter
            const matchesWh = !warehouseFilter || (d as any).warehouseId === warehouseFilter || d.warehouseName === activeWarehouses.find(w => w.id === warehouseFilter)?.name
            const matchesSearch = !q ||
                d.doNo.toLowerCase().includes(q) ||
                d.soNo.toLowerCase().includes(q) ||
                d.customerName?.toLowerCase().includes(q) ||
                d.warehouseName?.toLowerCase().includes(q)
            return matchesStatus && matchesWh && matchesSearch
        })
    }, [rows, searchQuery, warehouseFilter, historyStatusFilter, activeWarehouses])

    const historyCounts = useMemo(() => ({
        ALL: rows.length,
        DRAFT: rows.filter(r => r.status === 'DRAFT').length,
        CONFIRMED: rows.filter(r => r.status === 'CONFIRMED').length,
        SHIPPED: rows.filter(r => r.status === 'SHIPPED').length,
        REVERSED: rows.filter(r => r.status === 'REVERSED' || r.status === 'CANCELLED').length,
    }), [rows])

    const totalShippedBottles = useMemo(() => rows
        .filter(r => r.status === 'CONFIRMED' || r.status === 'SHIPPED')
        .reduce((sum, r) => sum + (r.totalQtyShipped ?? 0), 0), [rows])

    const totalPendingBottles = useMemo(() => pendingSOs
        .reduce((sum, s) => sum + s.lines.reduce((acc, l) => acc + l.qtyOrdered, 0), 0), [pendingSOs])

    const activeFilterCount = [searchQuery, warehouseFilter, historyStatusFilter !== 'ALL' ? historyStatusFilter : ''].filter(Boolean).length
    const resetFilters = () => {
        setSearchQuery('')
        setWarehouseFilter('')
        setHistoryStatusFilter('ALL')
    }

    const [editDoDate, setEditDoDate] = useState('')
    const [savingDate, setSavingDate] = useState(false)

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        const data = await getDODetail(id)
        setDetailData(data)
        if (data?.createdAt) {
            setEditDoDate(new Date(data.createdAt).toISOString().slice(0, 10))
        }
        setDetailLoading(false)
    }

    const handleSaveDate = async () => {
        if (!detailData || !editDoDate) return
        setSavingDate(true)
        try {
            const res = await updateDeliveryOrderDate(detailData.id, editDoDate)
            if (!res.success) throw new Error(res.error || 'Lỗi cập nhật ngày')
            toast.success(`Đã cập nhật Ngày Xuất Hàng thành ${editDoDate}!`)
            reload()
            const updatedData = await getDODetail(detailData.id)
            setDetailData(updatedData)
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setSavingDate(false)
        }
    }

    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const handleStartPicking = (soId: string) => {
        setPreselectedSOId(soId)
        setCreateOpen(true)
    }

    const handleConfirm = (id: string) => {
        confirm({
            title: 'Xác nhận xuất kho (Delivery Order)',
            message: 'Xác nhận Delivery Order? Hàng sẽ được trừ tồn kho thực tế và cập nhật trạng thái xuất kho.',
            confirmLabel: 'Xác nhận xuất kho',
            onConfirm: async () => {
                const res = await confirmDeliveryOrder(id)
                if (!res.success) {
                    toast.error(res.error || 'Lỗi xác nhận DO')
                    return
                }
                toast.success('DO đã xác nhận — Hàng đã xuất kho!')
                reload()
                setDetailData(null)
            }
        })
    }

    const handleMarkDelivered = (id: string) => {
        confirm({
            title: 'Xác nhận đã giao hàng',
            message: 'Đánh dấu đơn hàng này đã được giao thành công tới khách hàng?',
            confirmLabel: 'Đã giao thành công',
            onConfirm: async () => {
                const res = await markDODelivered(id)
                if (!res.success) {
                    toast.error(res.error || 'Lỗi cập nhật trạng thái')
                    return
                }
                toast.success('Đơn hàng đã giao thành công')
                reload()
                setDetailData(null)
            }
        })
    }

    const handleReverse = (id: string, doNo?: string) => {
        confirm({
            title: `Hoàn tác (Reverse) phiếu xuất kho ${doNo ?? id}`,
            message: (
                <div className="space-y-2 text-xs">
                    <p className="font-semibold text-slate-800">Bạn có chắc chắn muốn hoàn tác (Reverse) phiếu xuất kho này?</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        <li>Tồn kho vật lý sẽ được hoàn trả lại về các Lô tương ứng.</li>
                        <li>Đơn bán hàng (SO) sẽ được khôi phục về trạng thái Chờ xuất kho.</li>
                    </ul>
                </div>
            ),
            danger: true,
            confirmLabel: 'Xác nhận hoàn tác',
            onConfirm: async () => {
                const res = await reverseDeliveryOrder(id)
                if (!res.success) {
                    toast.error(res.error || 'Lỗi hoàn tác xuất kho')
                    return
                }
                toast.success(`Phiếu ${doNo ?? ''} đã hoàn tác (Reverse) & khôi phục tồn kho thành công!`)
                reload()
                setDetailData(null)
            }
        })
    }

    return (
        <div className="space-y-4 pb-6 md:pb-4">
            {/* ── TIER 1: Standardized Module Header Bar ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                            <Truck size={18} className="text-amber-700" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                    Xuất Kho & Lệnh Nhặt Hàng (DO)
                                </h3>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    {pendingSOs.length} chờ xuất · {rows.length} phiếu DO
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Tự động phân bổ lô FIFO theo SKU, Vintage và vị trí kệ kho
                            </p>
                        </div>
                    </div>

                    {/* Sub-tab Switcher */}
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('pending')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                activeSubTab === 'pending'
                                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Đơn SO Chờ Xuất</span>
                            {pendingSOs.length > 0 && (
                                <span className="inline-block px-1.5 py-0.2 text-[10px] font-mono font-extrabold rounded-full bg-amber-500 text-white">
                                    {pendingSOs.length}
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSubTab('history')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                activeSubTab === 'history'
                                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span>Lịch Sử Phiếu DO</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                                {rows.length}
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowStats(!showStats)}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                    >
                        {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className="hidden sm:inline">Chỉ số</span>
                    </button>

                    <button
                        type="button"
                        onClick={reload}
                        disabled={loading}
                        className="flex items-center justify-center p-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                        title="Làm mới danh sách"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-amber-700' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={() => { setPreselectedSOId(null); setCreateOpen(true) }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-xs transition-all hover:opacity-90 active:scale-95 cursor-pointer bg-lys-teal-strong text-white"
                    >
                        <Plus size={14} /> Tạo Phiếu DO
                    </button>
                </div>
            </div>

            {/* ── TIER 2: Collapsible KPI Stat Cards ── */}
            {showStats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #B45309' }}>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Đơn SO Chờ Nhặt Hàng</span>
                        <div className="mt-1">
                            <span className="text-lg sm:text-xl font-extrabold font-mono text-amber-700">{pendingSOs.length} đơn</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">
                            Tổng cần nhặt: <strong className="font-mono text-slate-700">{totalPendingBottles.toLocaleString()}</strong> chai
                        </span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #0891B2' }}>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tổng Phiếu Xuất (DO)</span>
                        <div className="mt-1">
                            <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">{rows.length} phiếu</span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">
                            Nháp chờ duyệt: <strong className="font-mono text-slate-700">{historyCounts.DRAFT}</strong> phiếu
                        </span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #15803D' }}>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Đã Xuất Kho / Đã Giao</span>
                        <div className="mt-1">
                            <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-700">
                                {(historyCounts.CONFIRMED + historyCounts.SHIPPED).toLocaleString()} phiếu
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">
                            Đã giao hoàn tất: <strong className="font-mono text-emerald-700">{historyCounts.SHIPPED}</strong> phiếu
                        </span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #334155' }}>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tổng Chai Đã Xuất Kho</span>
                        <div className="mt-1">
                            <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                                {totalShippedBottles.toLocaleString()} <span className="text-xs font-semibold text-slate-500">chai</span>
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1">
                            Hoàn tác / Hủy: <strong className="font-mono text-rose-600">{historyCounts.REVERSED}</strong> phiếu
                        </span>
                    </div>
                </div>
            )}

            {/* ── TIER 3: Unified Filter & Search Toolbar ── */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-3">
                {activeSubTab === 'history' && (
                    <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
                        {[
                            { key: 'ALL', label: 'Tất Cả Phiếu DO', count: historyCounts.ALL },
                            { key: 'DRAFT', label: 'Nháp / Chờ Xác Nhận', count: historyCounts.DRAFT },
                            { key: 'CONFIRMED', label: 'Đã Xuất Kho', count: historyCounts.CONFIRMED },
                            { key: 'SHIPPED', label: 'Đã Giao Hàng', count: historyCounts.SHIPPED },
                            { key: 'REVERSED', label: 'Hoàn Tác / Hủy', count: historyCounts.REVERSED },
                        ].map(tab => {
                            const active = historyStatusFilter === tab.key
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setHistoryStatusFilter(tab.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border ${
                                        active
                                            ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-2xs'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                                        active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={activeSubTab === 'pending' ? 'Tìm mã SO, khách hàng, mã SKU, tên rượu, niên vụ...' : 'Tìm số DO, số SO, tên khách hàng, kho xuất...'}
                            className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-lys-teal-strong"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    <select
                        value={warehouseFilter}
                        onChange={e => setWarehouseFilter(e.target.value)}
                        className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                    >
                        <option value="">Tất cả kho xuất</option>
                        {activeWarehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>

                    {activeFilterCount > 0 && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-1 px-2.5 py-1.5 h-9 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer transition-all"
                        >
                            <RotateCcw size={12} />
                            <span>Xóa lọc ({activeFilterCount})</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── TIER 4: Content Area ── */}
            {/* TAB 1: PENDING SALES ORDERS WAITING FOR FULFILLMENT */}
            {activeSubTab === 'pending' && (
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-12 bg-white rounded-lg border border-slate-200">
                            <Loader2 size={22} className="animate-spin text-lys-teal-strong" />
                        </div>
                    ) : filteredPendingSOs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 gap-2 rounded-lg border border-dashed border-slate-300 bg-white">
                            <CheckCircle2 size={28} className="text-emerald-600" />
                            <p className="text-xs font-semibold text-slate-900">
                                {searchQuery || warehouseFilter ? 'Không tìm thấy đơn hàng khớp bộ lọc' : 'Không có đơn chờ xuất kho'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {filteredPendingSOs.map(so => {
                                const totalItems = so.lines.reduce((sum, l) => sum + l.qtyOrdered, 0)
                                const targetWhId = resolveWarehouseForSO(so, activeWarehouses)
                                const targetWh = activeWarehouses.find(w => w.id === targetWhId)
                                return (
                                    <div
                                        key={so.id}
                                        className="p-4 rounded-lg flex flex-col justify-between transition-all shadow-2xs hover:shadow-md bg-white border border-slate-200"
                                    >
                                        <div>
                                            {/* SO Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="inline-block px-2 py-0.5 text-[11px] font-extrabold font-mono rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                                        {so.soNo}
                                                    </span>
                                                    <span className="inline-block text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                                                        Sẵn Sàng Nhặt
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-mono font-bold text-slate-600">
                                                    {so.lines.length} SKU · {totalItems} chai
                                                </span>
                                            </div>

                                            {/* Customer Name & Warehouse */}
                                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                                    {so.customerName || (so as any).customer?.name || 'Khách hàng'}
                                                </h4>
                                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                                    Kho: <strong>{targetWh?.name || 'Kho Mặc Định'}</strong>
                                                </span>
                                            </div>

                                            {/* Product Lines with SKU + Vintage clearly shown */}
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                                                {so.lines.map((line, idx) => {
                                                    const pName = line.productName || (line as any).product?.productName || ''
                                                    const pCode = line.skuCode || (line as any).product?.skuCode || ''
                                                    const vStr = line.vintage ? String(line.vintage) : 'NV'
                                                    return (
                                                        <div
                                                            key={`${line.productId}-${idx}`}
                                                            className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-slate-50 border border-slate-200/80"
                                                        >
                                                            <div className="truncate pr-2 flex items-center gap-1.5 min-w-0">
                                                                {pCode && (
                                                                    <span className="font-mono font-extrabold text-[11px] px-1.5 py-0.2 rounded bg-white text-slate-800 border border-slate-200 shrink-0">
                                                                        {pCode}
                                                                    </span>
                                                                )}
                                                                <span className="font-mono font-bold text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                                                    {vStr}
                                                                </span>
                                                                <span className="font-semibold text-slate-900 truncate">{pName || pCode || 'Sản phẩm'}</span>
                                                            </div>
                                                            <span className="font-mono font-extrabold shrink-0 text-amber-700 ml-2">
                                                                x{line.qtyOrdered}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-slate-100">
                                            <span className="text-[11px] font-medium text-slate-500">
                                                Tự động gợi ý vị trí & lô FIFO
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleStartPicking(so.id)}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg shadow-2xs transition-all hover:opacity-90 active:scale-95 bg-lys-teal-strong text-white cursor-pointer"
                                            >
                                                Nhặt Hàng & Xuất Kho <ArrowRight size={13} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: PROCESSED DELIVERY ORDERS HISTORY */}
            {activeSubTab === 'history' && (
                <div className="rounded-lg overflow-hidden shadow-xs bg-white border border-slate-200">
                    {/* Desktop Table (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    {['Số DO', 'Số SO', 'Khách Hàng', 'Kho Xuất', 'Số SKU', 'SL Đặt', 'SL Giao', 'Trạng Thái', 'Ngày Lập', 'Thao Tác'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold text-slate-600 whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={10} className="text-center py-10">
                                        <Loader2 size={20} className="animate-spin inline text-lys-teal-strong" />
                                    </td></tr>
                                ) : filteredHistoryRows.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-xs text-slate-500">Không tìm thấy phiếu xuất kho (DO) nào khớp bộ lọc</td></tr>
                                ) : filteredHistoryRows.map(d => {
                                    const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                                    const canReverse = d.status !== 'REVERSED' && d.status !== 'CANCELLED'
                                    return (
                                        <tr key={d.id} className="transition-colors cursor-pointer hover:bg-slate-50/80"
                                            onClick={() => openDetail(d.id)}>
                                            <td className="px-3 py-2.5 font-bold font-mono text-lys-teal-strong whitespace-nowrap">{d.doNo}</td>
                                            <td className="px-3 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">{d.soNo}</td>
                                            <td className="px-3 py-2.5">
                                                <span className="font-bold text-slate-900 block truncate max-w-[180px]" title={d.customerName}>
                                                    {d.customerName}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-2.5 text-slate-600 truncate max-w-[160px]" title={d.warehouseName}>{d.warehouseName}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-600">{d.lineCount}</td>
                                            <td className="px-3 py-2.5 font-mono text-slate-600">
                                                {d.totalQtyOrdered.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 font-bold font-mono text-slate-900">
                                                {d.totalQtyShipped.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap shrink-0" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap">{formatDate(d.createdAt)}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => openDetail(d.id)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                                                        title="Xem chi tiết"
                                                        style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                                        <Eye size={13} />
                                                    </button>
                                                    {d.status === 'DRAFT' && (
                                                        <button onClick={() => handleConfirm(d.id)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                                                            title="Xác nhận"
                                                            style={{ background: 'rgba(21,128,61,0.1)', color: '#15803D' }}>
                                                            <CheckCircle2 size={13} />
                                                        </button>
                                                    )}
                                                    {canReverse && (
                                                        <button onClick={() => handleReverse(d.id, d.doNo)}
                                                            title="Reverse (Hoàn Tác Xuất Kho — Chỉ Admin)"
                                                            className="px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all hover:brightness-105 cursor-pointer"
                                                            style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.2)' }}>
                                                            <RotateCcw size={11} /> Hoàn Tác</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards (< 768px) */}
                    <div className="block md:hidden p-2.5 space-y-2 bg-slate-50/60">
                        {loading ? (
                            <div className="text-center py-10"><Loader2 size={18} className="animate-spin inline text-lys-teal-strong" /></div>
                        ) : filteredHistoryRows.length === 0 ? (
                            <div className="text-center py-10 text-xs text-slate-500">Không tìm thấy phiếu DO nào</div>
                        ) : filteredHistoryRows.map(d => {
                            const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                            const canReverse = d.status !== 'REVERSED' && d.status !== 'CANCELLED'
                            return (
                                <div key={d.id} onClick={() => openDetail(d.id)}
                                    className="p-3 rounded-lg space-y-2 cursor-pointer transition-all active:scale-[0.99] shadow-2xs bg-white border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold font-mono text-lys-teal-strong">
                                            {d.doNo}
                                        </span>
                                        <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap shrink-0" style={{ color: st.color, background: st.bg }}>
                                            {st.label}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                        {d.customerName}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-500">SO: <strong className="font-mono text-slate-700">{d.soNo}</strong></span>
                                        <span className="font-mono font-bold text-slate-900">
                                            Giao {d.totalQtyShipped} / Đặt {d.totalQtyOrdered} chai
                                        </span>
                                    </div>
                                    {canReverse && (
                                        <div className="pt-1.5 flex justify-end" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => handleReverse(d.id, d.doNo)}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1"
                                                style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.2)' }}>
                                                <RotateCcw size={11} /> Hoàn Tác (Admin)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-fade-in">
                    <div className="w-full sm:w-[560px] max-w-full h-full overflow-hidden shadow-2xl flex flex-col bg-white animate-drawer-in">
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                    Chi Tiết DO {detailData?.doNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <div className="text-xs mt-1 space-y-0.5" style={{ color: '#64748B' }}>
                                        <p>
                                            <strong className="text-slate-900">SO:</strong> {detailData.soNo} · <strong className="text-slate-900">KH:</strong> {detailData.customerName} · <strong className="text-slate-900">Kho:</strong> {detailData.warehouseName}
                                        </p>
                                        {(detailData as any).customerPhone && (
                                            <p className="flex items-center gap-1.5 font-mono text-emerald-700 font-bold">
                                                <Phone size={11} /> {(detailData as any).customerPhone}
                                                {(detailData as any).receiverName && (detailData as any).receiverName !== detailData.customerName && (
                                                    <span className="text-slate-500 font-sans font-normal">({(detailData as any).receiverName})</span>
                                                )}
                                            </p>
                                        )}
                                        {(detailData as any).shippingAddress && (
                                            <p className="flex items-center gap-1 text-[11px] text-slate-500 truncate" title={(detailData as any).shippingAddress}>
                                                <MapPin size={10} className="shrink-0" /> {(detailData as any).shippingAddress}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setDetailData(null)} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#B45309' }} /></div>
                        ) : detailData && (
                            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <InfoCard label="Trạng thái" value={(DO_STATUS[detailData.status] ?? DO_STATUS.DRAFT).label} />
                                    <InfoCard label="Ngày xuất ban đầu" value={formatDate(detailData.createdAt)} />
                                </div>

                                {/* Custom Date Editor for backdating/editing data */}
                                <div className="px-3.5 py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>Ngày Xuất Hàng (Chỉnh sửa dữ liệu)</p>
                                        <p className="text-xs font-bold mt-0.5" style={{ color: '#0F172A' }}>{formatDate(detailData.createdAt)}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <input
                                            type="date"
                                            value={editDoDate}
                                            onChange={e => setEditDoDate(e.target.value)}
                                            className="px-2 py-1.5 text-base sm:text-xs rounded-lg border border-slate-300 font-mono outline-none shadow-xs"
                                            style={{ background: '#FFFFFF', color: '#0F172A' }}
                                        />
                                        <button
                                            onClick={handleSaveDate}
                                            disabled={savingDate}
                                            className="px-2.5 py-1 text-xs font-bold rounded text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center gap-1 shadow-xs"
                                        >
                                            {savingDate ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                            Lưu Ngày
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => window.open(`/dashboard/warehouse/print?id=${detailData.id}`, '_blank')}
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:brightness-105 shadow-sm"
                                        style={{ background: '#D97706', color: '#FFFFFF' }}
                                    >
                                        <Printer size={14} /> In Phiếu Xuất Kho
                                    </button>
                                    {detailData.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleConfirm(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:brightness-105"
                                            style={{ background: 'rgba(21,128,61,0.15)', color: '#16A34A', border: '1px solid rgba(21,128,61,0.3)' }}
                                        >
                                            <CheckCircle2 size={14} /> Xác Nhận Xuất Kho
                                        </button>
                                    )}
                                    {(detailData.status === 'DRAFT' || detailData.status === 'PICKING' || detailData.status === 'PACKED' || detailData.status === 'SHIPPED') && (
                                        <button
                                            onClick={() => handleMarkDelivered(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:brightness-105"
                                            style={{ background: 'rgba(29,78,216,0.15)', color: '#2563EB', border: '1px solid rgba(29,78,216,0.3)' }}
                                        >
                                            <Truck size={14} /> Đã Giao Hàng
                                        </button>
                                    )}
                                    {detailData.status !== 'CANCELLED' && (
                                        <button
                                            onClick={() => handleReverse(detailData.id, detailData.doNo)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all hover:brightness-105"
                                            style={{ background: 'rgba(185,28,28,0.15)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.3)' }}
                                        >
                                            <RotateCcw size={14} /> Hoàn Tác Phiếu (Admin)
                                        </button>
                                    )}
                                </div>

                                {/* Detail Lines — Desktop Table */}
                                <div className="rounded-lg overflow-x-hidden hidden sm:block shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                {['SKU', 'Sản Phẩm', 'Niên Vụ', 'Vị Trí Kho', 'SL Nhặt', 'SL Xuất', ...((detailData.status === 'DRAFT' || detailData.status === 'PICKING') ? ['Thao Tác'] : [])].map(h => (
                                                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.lines.map(l => (
                                                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td className="px-3 py-2 text-xs font-bold font-mono" style={{ color: '#B47816' }}>
                                                        {l.skuCode}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs" style={{ color: '#0F172A' }}>{l.productName}</td>
                                                    <td className="px-3 py-2 text-xs font-bold text-amber-700 font-mono">{(l as any).vintage ?? 'NV'}</td>
                                                    <td className="px-3 py-2 text-xs font-medium" style={{ color: '#475569' }}>{formatFriendlyLocationName({ locationCode: l.locationCode, zone: (l as any).zone })}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#0F172A' }}>{l.qtyPicked}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#16A34A' }}>{l.qtyShipped}</td>
                                                    {(detailData.status === 'DRAFT' || detailData.status === 'PICKING') && (
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSwapTarget({
                                                                    doId: detailData.id,
                                                                    doLineId: l.id,
                                                                    productName: l.productName,
                                                                    skuCode: l.skuCode,
                                                                    currentLotNo: l.lotNo,
                                                                    qtyPicked: l.qtyPicked,
                                                                    productId: (l as any).productId,
                                                                    warehouseId: (detailData as any).warehouseId,
                                                                    vintage: (l as any).vintage ?? null,
                                                                })}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer shadow-2xs"
                                                                title="Báo chai vỡ / Đổi vị trí lấy hàng"
                                                            >
                                                                <ShieldAlert size={12} className="text-amber-700" />
                                                                Báo Chai Vỡ / Đổi Vị Trí
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Detail Lines — Mobile Cards */}
                                <div className="block sm:hidden space-y-2">
                                    {detailData.lines.map(l => (
                                        <div key={l.id} className="p-3 rounded-lg space-y-1.5 shadow-sm" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold font-mono" style={{ color: '#B47816' }}>{l.skuCode}</span>
                                                <span className="inline-block text-xs font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">Niên vụ: {(l as any).vintage ?? 'NV'}</span>
                                            </div>
                                            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{l.productName}</p>
                                            <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                                                Vị trí: <strong className="font-semibold text-slate-800">{formatFriendlyLocationName({ locationCode: l.locationCode, zone: (l as any).zone })}</strong>
                                            </div>
                                            <div className="flex items-center justify-between pt-1.5 border-t text-xs" style={{ borderColor: '#E2E8F0' }}>
                                                <span style={{ color: '#64748B' }}>SL Nhặt: <strong className="font-mono text-[#0F172A]">{l.qtyPicked}</strong></span>
                                                <span style={{ color: '#64748B' }}>SL Xuất: <strong className="font-mono text-[#16A34A]">{l.qtyShipped}</strong></span>
                                            </div>
                                            {(detailData.status === 'DRAFT' || detailData.status === 'PICKING') && (
                                                <div className="pt-2 flex justify-end border-t border-slate-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSwapTarget({
                                                            doId: detailData.id,
                                                            doLineId: l.id,
                                                            productName: l.productName,
                                                            skuCode: l.skuCode,
                                                            currentLotNo: l.lotNo,
                                                            qtyPicked: l.qtyPicked,
                                                            productId: (l as any).productId,
                                                            warehouseId: (detailData as any).warehouseId,
                                                            vintage: (l as any).vintage ?? null,
                                                        })}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
                                                    >
                                                        <ShieldAlert size={12} className="text-amber-700" />
                                                        Báo Chai Vỡ / Đổi Vị Trí
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Swap Defect Lot Modal */}
            <SwapDefectLotModal
                target={swapTarget}
                onClose={() => setSwapTarget(null)}
                onSuccess={() => {
                    if (detailData) openDetail(detailData.id)
                    reload()
                }}
            />

            {/* Create DO Drawer */}
            {createOpen && (
                <CreateDODrawer
                    warehouses={warehouses}
                    initialSOId={preselectedSOId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => { setCreateOpen(false); reload() }}
                />
            )}

            {confirmDialog}
        </div>
    )
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-3 py-2.5 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: '#0F172A' }}>{value}</p>
        </div>
    )
}

// ── Create DO Drawer ──────────────────────────────
function CreateDODrawer({ warehouses, initialSOId, onClose, onCreated }: {
    warehouses: WarehouseOption[]
    initialSOId?: string | null
    onClose: () => void; onCreated: () => void
}) {
    const [sos, setSOs] = useState<SOOption[]>([])
    const [selectedSO, setSelectedSO] = useState<SOOption | null>(null)
    const [warehouseId, setWarehouseId] = useState('')
    const [issuedDate, setIssuedDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [lines, setLines] = useState<{ productId: string; lotId: string; locationId: string; qtyPicked: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [lotsMap, setLotsMap] = useState<Record<string, any[]>>({})
    const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1)

    const [currentWhs, setCurrentWhs] = useState<WarehouseOption[]>(warehouses)

    useEffect(() => {
        if (!selectedSO || !warehouseId) {
            setLotsMap({})
            return
        }
        let active = true
        const fetchLots = async () => {
            const map: Record<string, any[]> = {}
            try {
                await Promise.all(
                    selectedSO.lines.map(async (line) => {
                        const lots = await getAvailableLotsForProduct(line.productId, warehouseId, line.vintage)
                        if (active) {
                            map[line.productId] = lots
                        }
                    })
                )
                if (active) {
                    setLotsMap(map)
                    setLines(() => {
                        const allocatedLines: { productId: string; lotId: string; locationId: string; qtyPicked: number }[] = []
                        for (const sol of selectedSO.lines) {
                            const availLots = map[sol.productId] || []
                            let remainingNeeded = sol.qtyOrdered

                            if (availLots.length === 0) {
                                allocatedLines.push({
                                    productId: sol.productId,
                                    lotId: '',
                                    locationId: '',
                                    qtyPicked: sol.qtyOrdered
                                })
                            } else {
                                for (const lot of availLots) {
                                    if (remainingNeeded <= 0) break
                                    const allocQty = Math.min(remainingNeeded, lot.qtyAvailable)
                                    if (allocQty > 0) {
                                        allocatedLines.push({
                                            productId: sol.productId,
                                            lotId: lot.id,
                                            locationId: lot.locationId,
                                            qtyPicked: allocQty
                                        })
                                        remainingNeeded -= allocQty
                                    }
                                }
                            }
                        }
                        return allocatedLines
                    })
                }
            } catch (err: any) {
                if (active) {
                    toast.error('Lỗi khi tải danh sách lô hàng: ' + err.message)
                }
            }
        }
        fetchLots()
        return () => {
            active = false
        }
    }, [selectedSO, warehouseId])

    useEffect(() => {
        Promise.all([
            getSOsForDelivery(),
            getWarehouses()
        ]).then(([data, whsData]) => {
            setSOs(data as any)
            const activeWhsList = (whsData && whsData.length > 0) ? (whsData as any) : warehouses
            setCurrentWhs(activeWhsList)

            if (initialSOId) {
                const targetSO = (data as any[]).find(s => s.id === initialSOId)
                if (targetSO) {
                    setSelectedSO(targetSO)
                    setWarehouseId(resolveWarehouseForSO(targetSO, activeWhsList))
                    setMobileStep(2)
                }
            }
        })
    }, [initialSOId])

    const selectSO = (soId: string) => {
        const targetSO = sos.find(s => s.id === soId) || null
        setSelectedSO(targetSO)
        if (targetSO) {
            setWarehouseId(resolveWarehouseForSO(targetSO, currentWhs))
            setMobileStep(2)
        }
    }

    const handleSave = async (autoConfirm = false) => {
        if (!selectedSO || !warehouseId) return toast.error('Chọn SO và kho xuất hàng')
        const validLines = lines.filter(l => l.qtyPicked > 0 && l.lotId)
        if (validLines.length === 0) return toast.error('Chưa có vị trí nhặt hàng nào được chọn.')
        setSaving(true)
        try {
            const res = await createDeliveryOrder({
                soId: selectedSO.id,
                warehouseId,
                lines: validLines,
                issuedDate: issuedDate ? new Date(issuedDate) : undefined,
            })
            if (!res.success || !res.doId) throw new Error(res.error || 'Lỗi tạo DO')

            if (autoConfirm) {
                const confirmRes = await confirmDeliveryOrder(res.doId)
                if (!confirmRes.success) throw new Error(confirmRes.error || 'Lỗi xác nhận xuất kho')
                toast.success(`Đã tạo & xác nhận xuất kho phiếu ${res.doNo} thành công!`)
            } else {
                toast.success(`Đã tạo phiếu nháp DO ${res.doNo}!`)
            }
            onCreated()
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally {
            setSaving(false)
        }
    }

    const canGoStep2 = !!selectedSO && !!warehouseId
    const validLinesCount = lines.filter(l => l.qtyPicked > 0 && l.lotId).length
    const totalPicked = lines.reduce((sum, l) => sum + (l.lotId ? l.qtyPicked : 0), 0)

    const lightInputStyle = {
        background: '#FFFFFF',
        border: '1px solid #CBD5E1',
        color: '#0F172A',
    }

    // ── Shared sub-components ───────────────────────
    const renderSOSelect = () => (
        <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Đơn Hàng (Sales Order) *</label>
            <select
                value={selectedSO?.id ?? ''}
                onChange={e => selectSO(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-base sm:text-sm font-mono outline-none transition-colors"
                style={lightInputStyle}
            >
                <option value="">— Chọn đơn SO —</option>
                {sos.map(s => (
                    <option key={s.id} value={s.id}>{s.soNo} — {s.customerName} ({s.lines.length} SP)</option>
                ))}
            </select>
        </div>
    )

    const renderDateSelect = () => (
        <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Ngày Xuất Hàng *</label>
            <input
                type="date"
                value={issuedDate}
                onChange={e => setIssuedDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-base sm:text-sm outline-none font-medium"
                style={lightInputStyle}
            />
        </div>
    )

    const renderWarehouseSelect = () => (
        <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Kho Xuất Bán Hàng *</label>
            <select
                value={warehouseId}
                onChange={e => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-base sm:text-sm outline-none transition-colors font-medium"
                style={lightInputStyle}
            >
                <option value="">— Chọn kho xuất bán —</option>
                {currentWhs
                    .filter((w: any) => {
                        const targetLegalEntityId = selectedSO?.legalEntityId
                        const targetLegalEntityCode = (selectedSO as any)?.legalEntityCode
                        if (!targetLegalEntityId && !targetLegalEntityCode) return true
                        if (targetLegalEntityId && w.legalEntityId === targetLegalEntityId) return true
                        if (targetLegalEntityCode && w.legalEntityCode === targetLegalEntityCode) return true
                        if (targetLegalEntityCode === 'TA' && (w.code?.includes('TA') || w.name?.includes('Thắng Ân'))) return true
                        if (targetLegalEntityCode === 'LC' && (w.code?.includes('LYS') || w.name?.includes('Lys'))) return true
                        return false
                    })
                    .sort((a: any, b: any) => {
                        if (a.allowSales !== b.allowSales) return a.allowSales ? -1 : 1
                        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
                        return a.name.localeCompare(b.name)
                    })
                    .map((w: any) => {
                        const isAllowed = w.allowSales !== false
                        return (
                            <option key={w.id} value={w.id} disabled={!isAllowed}>
                                {isAllowed
                                    ? `[Kho xuất bán] ${w.code} — ${w.name}${w.isDefault ? ' (Mặc định)' : ''}`
                                    : `[Chỉ điều chuyển] ${w.code} — ${w.name}`
                                }
                            </option>
                        )
                    })
                }
            </select>
        </div>
    )

    const renderProductLines = () => (
        <>
            <div className="flex items-center justify-between pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Sản Phẩm Cần Nhặt ({selectedSO!.lines.length} mặt hàng)
                </p>
                <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Tổng nhặt: {totalPicked.toLocaleString()} chai
                </span>
            </div>

            <div className="space-y-3">
                {selectedSO!.lines.map((sol) => {
                    const availLots = lotsMap[sol.productId] || []
                    const productPicks = lines
                        .map((l, globalIdx) => ({ ...l, globalIdx }))
                        .filter(l => l.productId === sol.productId)
                    
                    const totalPickedForProduct = productPicks.reduce((sum, p) => sum + (p.lotId ? p.qtyPicked : 0), 0)
                    const totalStockAvailable = availLots.reduce((sum, l) => sum + l.qtyAvailable, 0)
                    const isSufficient = totalPickedForProduct === sol.qtyOrdered
                    const isOverPicked = totalPickedForProduct > sol.qtyOrdered

                    return (
                        <div key={sol.productId} className="p-3.5 rounded-xl space-y-3 border border-slate-200 bg-white shadow-xs">
                            {/* Product Header: Name + Badges */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-900 leading-snug">
                                        {sol.productName}
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                                        <span className="inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
                                            {sol.skuCode}
                                        </span>
                                        <span className="inline-block font-semibold px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                            Niên vụ: {sol.vintage ? sol.vintage : 'NV'}
                                        </span>
                                    </div>
                                </div>

                                {/* Ordered Badge & Status */}
                                <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-center">
                                    <span className="inline-block text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0">
                                        CẦN: {sol.qtyOrdered} CHAI
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0"
                                        style={
                                            isSufficient
                                                ? { background: 'rgba(22,163,74,0.1)', color: '#15803D', border: '1px solid rgba(22,163,74,0.3)' }
                                                : isOverPicked
                                                ? { background: 'rgba(217,119,6,0.1)', color: '#B45309', border: '1px solid rgba(217,119,6,0.3)' }
                                                : { background: 'rgba(185,28,28,0.1)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.3)' }
                                        }>
                                        {isSufficient ? (
                                            <>
                                                <CheckCircle2 size={13} />
                                                <span>Đủ {totalPickedForProduct}/{sol.qtyOrdered}</span>
                                            </>
                                        ) : isOverPicked ? (
                                            <span>Dư {totalPickedForProduct}/{sol.qtyOrdered}</span>
                                        ) : (
                                            <>
                                                <AlertCircle size={13} />
                                                <span>Thiếu ({totalPickedForProduct}/{sol.qtyOrdered} · Tồn: {totalStockAvailable})</span>
                                            </>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Render Split Location Pick Lines */}
                            <div className="space-y-2 pt-0.5">
                                {productPicks.map((pick, pickIdx) => {
                                    const selectedLot = availLots.find(l => l.id === pick.lotId)
                                    const isLocInsufficient = selectedLot && selectedLot.qtyAvailable < pick.qtyPicked

                                    return (
                                        <div key={pick.globalIdx} className="p-3 rounded-lg border bg-slate-50/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                                            style={{ borderColor: isLocInsufficient ? '#B91C1C' : '#E2E8F0' }}>
                                            {/* Col 1: Location selection */}
                                            <div className="sm:col-span-7 space-y-1">
                                                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                                    <span>Vị Trí Kệ Lấy Hàng {productPicks.length > 1 ? `(#${pickIdx + 1})` : ''}</span>
                                                    {selectedLot && (
                                                        <span className="text-emerald-700 font-mono text-[11px]">
                                                            Tồn kệ: {selectedLot.qtyAvailable} chai
                                                        </span>
                                                    )}
                                                </label>
                                                <select
                                                    value={pick.lotId}
                                                    onChange={e => {
                                                        const lotId = e.target.value
                                                        const chosenLot = availLots.find(l => l.id === lotId)
                                                        const v = [...lines]
                                                        v[pick.globalIdx] = {
                                                            ...v[pick.globalIdx],
                                                            lotId,
                                                            locationId: chosenLot?.locationId ?? ''
                                                        }
                                                        setLines(v)
                                                    }}
                                                    className="w-full h-10 px-3 rounded-lg text-sm outline-none font-semibold bg-white border border-slate-300 text-slate-900"
                                                >
                                                    <option value="">— Chọn vị trí kệ —</option>
                                                    {availLots.map((lot, idx) => {
                                                        const vtg = lot.vintage ? lot.vintage : (sol.vintage ? sol.vintage : 'NV')
                                                        return (
                                                            <option key={lot.id} value={lot.id}>
                                                                {idx === 0 ? '[Gợi ý] ' : ''}{formatFriendlyLocationName(lot)} · Niên vụ {vtg} (Tồn: {lot.qtyAvailable} chai)
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                            </div>

                                            {/* Col 2: Quantity picked input with touch +/- buttons */}
                                            <div className="sm:col-span-5 flex items-end gap-1.5">
                                                <div className="flex-1 space-y-1">
                                                    <label className="text-[11px] font-bold block text-center text-slate-700">
                                                        Số Lượng Lấy (Chai)
                                                    </label>
                                                    <div className="flex items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const v = [...lines]
                                                                v[pick.globalIdx] = {
                                                                    ...v[pick.globalIdx],
                                                                    qtyPicked: Math.max(0, (pick.qtyPicked || 0) - 1)
                                                                }
                                                                setLines(v)
                                                            }}
                                                            className="h-10 w-10 flex items-center justify-center rounded-l-lg border border-r-0 border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 cursor-pointer shrink-0"
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={pick.qtyPicked}
                                                            onChange={e => {
                                                                const v = [...lines]
                                                                v[pick.globalIdx] = { ...v[pick.globalIdx], qtyPicked: Math.max(0, Number(e.target.value)) }
                                                                setLines(v)
                                                            }}
                                                            className="w-full h-10 px-2 text-sm font-mono font-bold text-center outline-none bg-white border-y"
                                                            style={{
                                                                borderColor: isLocInsufficient ? '#B91C1C' : '#CBD5E1',
                                                                color: isLocInsufficient ? '#B91C1C' : '#16A34A'
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const v = [...lines]
                                                                const maxAvail = selectedLot ? selectedLot.qtyAvailable : 9999
                                                                v[pick.globalIdx] = {
                                                                    ...v[pick.globalIdx],
                                                                    qtyPicked: Math.min(maxAvail, (pick.qtyPicked || 0) + 1)
                                                                }
                                                                setLines(v)
                                                            }}
                                                            className="h-10 w-10 flex items-center justify-center rounded-r-lg border border-l-0 border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 cursor-pointer shrink-0"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                {productPicks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLines(prev => prev.filter((_, idx) => idx !== pick.globalIdx))
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center rounded-lg shrink-0 transition-colors cursor-pointer text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white"
                                                        title="Xóa vị trí kệ này"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}

                                <button
                                    type="button"
                                    onClick={() => {
                                        setLines(prev => [
                                            ...prev,
                                            { productId: sol.productId, lotId: '', locationId: '', qtyPicked: 1 }
                                        ])
                                    }}
                                    className="text-xs font-bold inline-flex items-center gap-1.5 text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                    <Plus size={13} /> Lấy thêm từ vị trí kệ khác
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px] animate-fade-in">
            <div className="w-full sm:w-[680px] max-w-full h-full flex flex-col shadow-2xl bg-white border-l border-slate-200 animate-drawer-in">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4 shrink-0 border-b border-slate-200 bg-white">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">Nhặt Hàng & Xuất Kho</h3>
                            {selectedSO && (
                                <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                    {selectedSO.soNo}
                                </span>
                            )}
                        </div>
                        {selectedSO && (
                            <p className="text-xs mt-0.5 truncate text-slate-600">
                                Khách hàng: <strong className="text-slate-900">{selectedSO.customerName}</strong>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Unified Scrollable Content for both Mobile & Desktop */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
                    {selectedSO && initialSOId ? (
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 items-center shadow-2xs">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                                    Đơn Hàng
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-sm font-bold font-mono text-amber-800">{selectedSO.soNo}</span>
                                    <span className="text-xs font-semibold text-slate-700 truncate">· {selectedSO.customerName}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">
                                    Kho Xuất Bán
                                </span>
                                <span className="text-xs font-bold px-2.5 py-1 rounded-md inline-block mt-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    {currentWhs.find((w: any) => w.id === warehouseId)?.name || 'Kho Mặc Định'}
                                </span>
                            </div>
                            <div>
                                {renderDateSelect()}
                            </div>
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-2xs">
                            {renderSOSelect()}
                            {renderWarehouseSelect()}
                            {renderDateSelect()}
                        </div>
                    )}

                    {selectedSO && lines.length > 0 && renderProductLines()}
                </div>

                {/* Sticky Bottom Footer for 1-Tap Action on Mobile & Desktop */}
                <div className="p-3.5 sm:px-5 sm:py-4 shrink-0 border-t border-slate-200 bg-white grid grid-cols-2 gap-2.5 shadow-lg">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={saving || !selectedSO}
                        className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        <span>Lưu Nháp</span>
                    </button>

                    <button
                        onClick={() => handleSave(true)}
                        disabled={saving || !selectedSO || validLinesCount === 0}
                        className="flex items-center justify-center gap-1.5 py-3 text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 hover:brightness-105 active:scale-[0.99]"
                        style={{ background: '#D97706', color: '#FFFFFF' }}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        <span>Xác Nhận Xuất Kho</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Swap Defect Lot Modal ─────────────────────────
function SwapDefectLotModal({
    target,
    onClose,
    onSuccess,
}: {
    target: {
        doId: string
        doLineId: string
        productName: string
        skuCode: string
        currentLotNo: string
        qtyPicked: number
        productId: string
        warehouseId: string
        vintage: number | null
    } | null
    onClose: () => void
    onSuccess: () => void
}) {
    const [lots, setLots] = useState<any[]>([])
    const [loadingLots, setLoadingLots] = useState(false)
    const [selectedNewLotId, setSelectedNewLotId] = useState('')
    const [qtyToSwap, setQtyToSwap] = useState(1)
    const [reason, setReason] = useState('Bể vỡ khi nhặt hàng tại sàn kho')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!target) return
        setLoadingLots(true)
        setQtyToSwap(1)
        setSelectedNewLotId('')
        getAvailableLotsForProduct(target.productId, target.warehouseId, target.vintage)
            .then(res => {
                const others = res.filter(l => l.lotNo !== target.currentLotNo && l.qtyAvailable > 0)
                setLots(others)
                if (others.length > 0) setSelectedNewLotId(others[0].id)
            })
            .catch((err: any) => toast.error('Không tải được danh sách vị trí thay thế: ' + err.message))
            .finally(() => setLoadingLots(false))
    }, [target])

    if (!target) return null

    const handleConfirmSwap = async () => {
        if (!selectedNewLotId) return toast.error('Vui lòng chọn vị trí kệ thay thế')
        if (qtyToSwap <= 0 || qtyToSwap > target.qtyPicked) {
            return toast.error(`Số lượng chai đổi phải từ 1 đến ${target.qtyPicked}`)
        }
        if (!reason.trim()) return toast.error('Vui lòng nhập lý do')

        setSubmitting(true)
        try {
            const res = await swapDOLineAndQuarantineDamaged({
                doId: target.doId,
                doLineId: target.doLineId,
                newLotId: selectedNewLotId,
                qtyToSwap,
                reason,
            })
            if (!res.success) throw new Error(res.error || 'Lỗi khi đổi vị trí')
            toast.success(`Đã đổi ${qtyToSwap} chai sang vị trí mới và chuyển chai lỗi vào mục Hàng Lỗi / Hỏng!`)
            onSuccess()
            onClose()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 border border-slate-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                            <ShieldAlert size={18} />
                        </span>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Báo Chai Vỡ / Đổi Vị Trí Lấy</h3>
                            <p className="text-xs text-slate-500 font-mono">Mã SKU: {target.skuCode}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 border border-slate-200">
                    <p className="font-bold text-slate-900">{target.productName}</p>
                    <p className="text-slate-600">Niên vụ: <strong className="text-amber-800">{target.vintage ? target.vintage : 'NV'}</strong> · Đang nhặt: <strong className="text-slate-900">{target.qtyPicked} chai</strong></p>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng Chai Hỏng Cần Đổi *</label>
                        <input
                            type="number"
                            min={1}
                            max={target.qtyPicked}
                            value={qtyToSwap}
                            onChange={e => setQtyToSwap(Math.min(target.qtyPicked, Math.max(1, Number(e.target.value))))}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono font-bold text-slate-900 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Chọn Vị Trí Kệ Thay Thế *</label>
                        {loadingLots ? (
                            <div className="flex items-center gap-2 py-3 text-xs text-slate-500">
                                <Loader2 size={16} className="animate-spin text-amber-600" /> Đang tìm vị trí kệ khả dụng...
                            </div>
                        ) : lots.length === 0 ? (
                            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                                Không còn vị trí kệ nào khác có sẵn sản phẩm này trong kho để thay thế!
                            </p>
                        ) : (
                            <select
                                value={selectedNewLotId}
                                onChange={e => setSelectedNewLotId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-medium text-slate-900 outline-none"
                            >
                                {lots.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {formatFriendlyLocationName(l)} · Niên vụ {l.vintage ? l.vintage : 'NV'} (Tồn: {l.qtyAvailable} chai)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Lý Do Báo Hỏng (Chuyển Vào Mục Hàng Lỗi / Hỏng) *</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Ví dụ: Bể vỡ khi lấy hàng, hỏng nút bần, tem rách..."
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900 outline-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        disabled={submitting || lots.length === 0}
                        onClick={handleConfirmSwap}
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                    >
                        {submitting && <Loader2 size={13} className="animate-spin" />}
                        Xác Nhận Đổi Vị Trí
                    </button>
                </div>
            </div>
        </div>
    )
}
