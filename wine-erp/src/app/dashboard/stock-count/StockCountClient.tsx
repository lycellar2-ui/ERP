'use client'

import React, { useState, useEffect } from 'react'
import {
    ClipboardList, Plus, Search, Filter, Warehouse, MapPin, Smartphone,
    Printer, CheckCircle2, ShieldCheck, QrCode, AlertCircle, Eye, EyeOff,
    UserCheck, RefreshCw, Layers, Zap, AlertTriangle, FileText,
    RotateCcw, Check, Calendar, ArrowRight, Sparkles
} from 'lucide-react'
import {
    getStockCountList, getStockCountDetail, getCountStats,
    getWarehouseOptions, getWarehouseLocationOptions, getStaffUserOptions,
    createStockCountSessionExtended, startStockCount, approveAndCreateAdjustment,
    assignStaffToZones, getCycleCountProgress, type CycleCountProgress
} from './actions'
import MobileLocationCounter from './MobileLocationCounter'
import PrintableAuditReport from './PrintableAuditReport'
import { BarcodeLookupModal } from './BarcodeLookupModal'
import { StockCountTableModal } from './StockCountTableModal'

type SessionRow = {
    id: string
    sessionNo: string
    title: string
    warehouseId: string
    warehouseName: string
    zone: string | null
    type: string
    scopeType: string
    isBlindCount: boolean
    status: string
    assignedToId: string | null
    assignedToName: string | null
    createdById?: string | null
    createdByName?: string
    lineCount: number
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    totalSystemQty: number
    totalActualQty: number
    totalVariance: number
    hasSignatures: boolean
}

type Props = {
    initialList?: SessionRow[]
    initialRows?: SessionRow[]
    initialStats?: { total: number; inProgress: number; completed: number; assignedToMe?: number }
    stats?: { total: number; inProgress: number; completed: number; assignedToMe?: number }
}

export function StockCountClient({ initialList, initialRows = [], initialStats, stats: propsStats }: Props) {
    const defaultList = initialList || initialRows
    const defaultStats = initialStats || propsStats || { total: 0, inProgress: 0, completed: 0, assignedToMe: 0 }
    const [list, setList] = useState<SessionRow[]>(defaultList)
    const [stats, setStats] = useState<{ total: number; inProgress: number; completed: number; assignedToMe?: number }>(defaultStats)
    const [activeTab, setActiveTab] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showStats, setShowStats] = useState(false)

    // Modal & View states
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [selectedDetail, setSelectedDetail] = useState<any>(null)
    const [mobileViewDetail, setMobileViewDetail] = useState<any>(null)
    const [printViewDetail, setPrintViewDetail] = useState<any>(null)
    const [showBarcodeLookup, setShowBarcodeLookup] = useState(false)
    const [tableModalSessionId, setTableModalSessionId] = useState<string | null>(null)

    // Zone Assignment Modal State
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [assignSessionDetail, setAssignSessionDetail] = useState<any>(null)
    const [zoneAssignments, setZoneAssignments] = useState<Record<string, string>>({})
    const [isSavingAssignments, setIsSavingAssignments] = useState(false)

    const handleOpenAssignModal = async (sessionId: string) => {
        setIsLoading(true)
        const detail = await getStockCountDetail(sessionId)
        setIsLoading(false)
        if (!detail) return alert('Không thể lấy chi tiết phiên kiểm kê')

        setAssignSessionDetail(detail)
        const initialMap: Record<string, string> = {}
        for (const line of detail.lines) {
            const zName = line.zone || line.locationCode || 'Khu vực chung'
            if (!initialMap[zName]) {
                initialMap[zName] = line.assignedToId || ''
            }
        }
        setZoneAssignments(initialMap)
        setShowAssignModal(true)
    }

    // Form inputs for creation
    const [warehouses, setWarehouses] = useState<Array<{ id: string; code: string; name: string }>>([])
    const [staffList, setStaffList] = useState<Array<{ id: string; name: string; email: string }>>([])
    const [locationOptions, setLocationOptions] = useState<Array<{ id: string; locationCode: string; zone: string }>>([])

    const [formWarehouseId, setFormWarehouseId] = useState('')
    const [formTitle, setFormTitle] = useState('')
    const [formScopeType, setFormScopeType] = useState<'FULL_WAREHOUSE' | 'CYCLE_COUNT' | 'TRANSACTED_ITEMS' | 'SPOT_COUNT'>('FULL_WAREHOUSE')
    const [formIsBlind, setFormIsBlind] = useState(false)
    const [formAssignedToId, setFormAssignedToId] = useState('')
    const [formSelectedZone, setFormSelectedZone] = useState('')
    const [formWineType, setFormWineType] = useState('')
    const [formTransactedDays, setFormTransactedDays] = useState(30)
    const [formSpotSkus, setFormSpotSkus] = useState('')

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [createError, setCreateError] = useState('')

    // Weekly Cycle Count Planner State
    const [cycleProgress, setCycleProgress] = useState<CycleCountProgress | null>(null)
    const [cycleWarehouseId, setCycleWarehouseId] = useState<string>('')
    const [cycleDaysWindow, setCycleDaysWindow] = useState<number>(7)
    const [loadingCycle, setLoadingCycle] = useState<boolean>(false)
    const [activeCycleTab, setActiveCycleTab] = useState<'UNCOUNTED' | 'COUNTED'>('UNCOUNTED')

    // Daily Batch Count Modal State
    const [showDailyBatchModal, setShowDailyBatchModal] = useState<boolean>(false)
    const [selectedDailySkus, setSelectedDailySkus] = useState<string[]>([])
    const [batchCountTitle, setBatchCountTitle] = useState<string>('')
    const [batchIsBlind, setBatchIsBlind] = useState<boolean>(false)
    const [batchAssigneeId, setBatchAssigneeId] = useState<string>('')
    const [isCreatingBatch, setIsCreatingBatch] = useState<boolean>(false)
    const [batchSearchTerm, setBatchSearchTerm] = useState<string>('')

    const loadCycleProgress = async (whId?: string, days?: number) => {
        const targetWh = whId || cycleWarehouseId || warehouses[0]?.id
        if (!targetWh) return
        setLoadingCycle(true)
        try {
            const data = await getCycleCountProgress(targetWh, days || cycleDaysWindow)
            setCycleProgress(data)
        } finally {
            setLoadingCycle(false)
        }
    }

    const fetchLocationOptions = async (whId: string) => {
        const locs = await getWarehouseLocationOptions(whId)
        setLocationOptions(locs)
    }

    const loadOptions = async () => {
        const [whRes, staffRes] = await Promise.all([
            getWarehouseOptions(),
            getStaffUserOptions()
        ])
        setWarehouses(whRes)
        setStaffList(staffRes)
        if (whRes.length > 0) {
            const firstId = whRes[0].id
            setFormWarehouseId(firstId)
            setCycleWarehouseId(firstId)
            fetchLocationOptions(firstId)
            loadCycleProgress(firstId, 7)
        }
    }

    const fetchData = async () => {
        setIsLoading(true)
        const [newList, newStats] = await Promise.all([
            getStockCountList(),
            getCountStats()
        ])
        setList(newList)
        setStats(newStats)
        setIsLoading(false)
    }

    const handleSaveZoneAssignments = async () => {
        if (!assignSessionDetail) return
        setIsSavingAssignments(true)
        const arr = Object.entries(zoneAssignments).map(([zone, userId]) => ({
            zone,
            assignedToId: userId || null
        }))
        const res = await assignStaffToZones(assignSessionDetail.id, arr)
        setIsSavingAssignments(false)

        if (res.success) {
            setShowAssignModal(false)
            fetchData()
        } else {
            alert(res.error || 'Không thể lưu phân công vị trí')
        }
    }

    // Load initial dropdown options
    useEffect(() => {
        loadOptions()
        fetchData()
    }, [])

    const handleOpenDetail = async (sessionId: string) => {
        const detail = await getStockCountDetail(sessionId)
        if (detail) setSelectedDetail(detail)
    }

    const handleOpenMobileView = async (sessionId: string) => {
        const detail = await getStockCountDetail(sessionId)
        if (detail) setMobileViewDetail(detail)
    }

    const handleOpenPrintView = async (sessionId: string) => {
        const detail = await getStockCountDetail(sessionId)
        if (detail) setPrintViewDetail(detail)
    }

    const handleStartSession = async (sessionId: string) => {
        const res = await startStockCount(sessionId)
        if (res.success) {
            fetchData()
            if (selectedDetail && selectedDetail.id === sessionId) {
                handleOpenDetail(sessionId)
            }
        } else {
            alert(res.error || 'Lỗi khi bắt đầu đếm')
        }
    }

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError('')
        setIsSubmitting(true)

        // Parse spot SKUs if provided
        let skus: string[] | undefined = undefined
        if (formScopeType === 'SPOT_COUNT' && formSpotSkus.trim()) {
            skus = formSpotSkus.split(/[\n,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
            if (skus.length === 0) {
                setIsSubmitting(false)
                setCreateError('Vui lòng nhập ít nhất 1 mã SKU cần kiểm kê đột xuất / chọn lọc')
                return
            }
        }

        const res = await createStockCountSessionExtended({
            warehouseId: formWarehouseId,
            title: formTitle || undefined,
            scopeType: formScopeType,
            isBlindCount: formIsBlind,
            assignedToId: formAssignedToId || undefined,
            selectedZone: formSelectedZone || undefined,
            selectedWineType: formWineType || undefined,
            transactedDays: Number(formTransactedDays) || 30,
            skuCodes: skus,
        })

        setIsSubmitting(false)
        if (res.success) {
            setShowCreateModal(false)
            fetchData()
            loadCycleProgress()
            if (res.sessionId) handleOpenMobileView(res.sessionId)
        } else {
            setCreateError(res.error || 'Khởi tạo phiên kiểm kê thất bại')
        }
    }

    const handleCreateBatchSession = async () => {
        if (!selectedDailySkus || selectedDailySkus.length === 0) {
            alert('Vui lòng chọn ít nhất 1 mã SKU để kiểm kê')
            return
        }
        setIsCreatingBatch(true)
        const res = await createStockCountSessionExtended({
            warehouseId: cycleWarehouseId,
            title: batchCountTitle || `Kiểm kê cuốn chiếu ${new Date().toLocaleDateString('vi-VN')} (${selectedDailySkus.length} mã)`,
            scopeType: 'CYCLE_COUNT',
            type: 'CYCLE',
            isBlindCount: batchIsBlind,
            assignedToId: batchAssigneeId || undefined,
            skuCodes: selectedDailySkus,
        })
        setIsCreatingBatch(false)
        if (res.success) {
            setShowDailyBatchModal(false)
            fetchData()
            loadCycleProgress()
            if (res.sessionId) handleOpenMobileView(res.sessionId)
        } else {
            alert(res.error || 'Khởi tạo đợt kiểm thất bại')
        }
    }

    // Filter list
    const filteredList = list.filter(item => {
        const matchTab = activeTab === 'ALL' ||
            (activeTab === 'ASSIGNED' && item.assignedToId) ||
            (activeTab === 'IN_PROGRESS' && (item.status === 'IN_PROGRESS' || item.status === 'DRAFT')) ||
            (activeTab === 'COMPLETED' && (item.status === 'COMPLETED' || item.status === 'APPROVED'))

        const matchSearch = !searchTerm ||
            item.sessionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.warehouseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.assignedToName && item.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()))

        return matchTab && matchSearch
    })

    if (mobileViewDetail) {
        return (
            <MobileLocationCounter
                detail={mobileViewDetail}
                onBack={() => {
                    setMobileViewDetail(null)
                    fetchData()
                }}
                onRefreshed={() => fetchData()}
                onOpenTableModal={() => {
                    const sid = mobileViewDetail.id
                    setMobileViewDetail(null)
                    setTableModalSessionId(sid)
                }}
            />
        )
    }

    return (
        <div className="w-full space-y-4 max-w-screen-2xl">
            {/* Header & Quick Stats Bar — Matched with Sales Order UI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kiểm Kê Kho</h1>

                    {/* Inline Quick Stats */}
                    <div className="hidden lg:flex items-center gap-x-4 text-xs border-l border-slate-200 pl-4">
                        <span className="text-slate-500">Tổng Phiếu: <strong className="font-mono text-sm ml-1 text-slate-900">{stats.total}</strong></span>
                        <span className="text-slate-500">Đang kiểm: <strong className="font-mono text-sm ml-1 text-amber-600">{stats.inProgress}</strong></span>
                        <span className="text-slate-500">Đã xong: <strong className="font-mono text-sm ml-1 text-emerald-600">{stats.completed}</strong></span>
                        <span className="text-slate-500">Phân công tôi: <strong className="font-mono text-sm ml-1 text-cyan-700">{stats.assignedToMe || 0}</strong></span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                            showStats
                                ? 'bg-[#0E7490]/15 text-slate-900 border-[#0E7490]/40'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                    >
                        📊 Thống Kê
                    </button>
                    <button
                        onClick={() => setShowBarcodeLookup(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
                    >
                        <QrCode size={14} className="text-emerald-600" /> Tra cứu Barcode
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 bg-[#0891B2] hover:bg-[#0E7490] rounded-md transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                        <Plus size={15} /> Tạo Phiếu Kiểm Kê
                    </button>
                </div>
            </div>

            {/* Collapsible Stats Cards — Matched with Sales Order UI */}
            {showStats && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Thống Kê Chi Tiết</span>
                        <button onClick={() => setShowStats(false)} className="text-xs font-semibold hover:underline flex items-center gap-1 text-[#0891B2]">
                            Thu gọn chỉ số ✕
                        </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block">TỔNG PHIẾU</span>
                            <strong className="text-lg font-black text-slate-900 mt-0.5 block font-mono">{stats.total}</strong>
                        </div>
                        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
                            <span className="text-[10px] font-bold text-amber-600 uppercase block">ĐANG KIỂM KÊ</span>
                            <strong className="text-lg font-black text-amber-600 mt-0.5 block font-mono">{stats.inProgress}</strong>
                        </div>
                        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase block">ĐÃ DUYỆT / XONG</span>
                            <strong className="text-lg font-black text-emerald-600 mt-0.5 block font-mono">{stats.completed}</strong>
                        </div>
                        <div className="bg-white border border-slate-200 p-3.5 rounded-lg shadow-2xs">
                            <span className="text-[10px] font-bold text-cyan-700 uppercase block">PHÂN CÔNG CHO TÔI</span>
                            <strong className="text-lg font-black text-cyan-700 mt-0.5 block font-mono">{stats.assignedToMe || 0}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ 🔄 KẾ HOẠCH KIỂM KÊ CUỐN CHIẾU THEO TUẦN (CYCLE COUNT PLANNER) ═══ */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0">
                            <RotateCcw size={18} className="text-lys-teal-strong" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span>Kế Hoạch Kiểm Kê Cuốn Chiếu</span>
                                <span className="text-[10px] font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle px-2 py-0.5 rounded-full">
                                    Chu kỳ {cycleDaysWindow} ngày
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500">
                                Chia nhỏ kiểm kê cả kho thành từng ngày, kiểm cuốn chiếu không làm gián đoạn bán hàng
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Warehouse selector for cycle plan */}
                        <div className="relative">
                            <select
                                value={cycleWarehouseId}
                                onChange={e => {
                                    setCycleWarehouseId(e.target.value)
                                    loadCycleProgress(e.target.value, cycleDaysWindow)
                                }}
                                className="bg-slate-50 border border-slate-300 text-slate-900 rounded-md px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer focus:border-lys-teal-strong max-w-[180px] truncate"
                            >
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Days window selector */}
                        <select
                            value={cycleDaysWindow}
                            onChange={e => {
                                const days = parseInt(e.target.value, 10) || 7
                                setCycleDaysWindow(days)
                                loadCycleProgress(cycleWarehouseId, days)
                            }}
                            className="bg-slate-50 border border-slate-300 text-slate-900 rounded-md px-2.5 py-1.5 text-xs font-semibold outline-none cursor-pointer focus:border-lys-teal-strong"
                        >
                            <option value={7}>Chu kỳ 7 ngày (1 tuần)</option>
                            <option value={14}>Chu kỳ 14 ngày (2 tuần)</option>
                            <option value={30}>Chu kỳ 30 ngày (1 tháng)</option>
                        </select>

                        {/* CTA button to create today's batch count */}
                        <button
                            type="button"
                            onClick={() => {
                                if (!cycleProgress || cycleProgress.uncountedProducts.length === 0) {
                                    alert('Tất cả các mã trong kho đã được kiểm kê trong chu kỳ này!')
                                    return
                                }
                                const topN = cycleProgress.uncountedProducts.slice(0, cycleProgress.dailySuggestedCount).map(p => p.skuCode)
                                setSelectedDailySkus(topN)
                                setBatchCountTitle(`Kiểm kê cuốn chiếu ${new Date().toLocaleDateString('vi-VN')} (${topN.length} mã) - ${cycleProgress.warehouseName}`)
                                setBatchSearchTerm('')
                                setShowDailyBatchModal(true)
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-lys-teal-strong hover:bg-lys-teal-hover rounded-md shadow-xs transition cursor-pointer active:scale-95"
                        >
                            <Zap size={14} />
                            <span>Tạo Đợt Đếm Hôm Nay</span>
                        </button>
                    </div>
                </div>

                {/* Progress Bar & Key Cycle Stats */}
                {loadingCycle ? (
                    <div className="py-4 text-center text-xs text-slate-400">Đang đồng bộ tiến độ kiểm kê kho...</div>
                ) : cycleProgress ? (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                        {/* Progress bar */}
                        <div>
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="font-semibold text-slate-700">
                                    Tiến độ hoàn tất: <strong className="text-lys-teal-strong font-mono">{cycleProgress.countedProductCount}</strong> / <span className="font-mono">{cycleProgress.totalProducts}</span> mã SKU
                                </span>
                                <span className="font-bold text-lys-teal-strong font-mono">
                                    {cycleProgress.progressPercent}% đã kiểm
                                </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
                                <div
                                    className="bg-lys-teal-strong h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, cycleProgress.progressPercent))}%` }}
                                />
                            </div>
                        </div>

                        {/* 4 Mini metric pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2.5 rounded-md bg-emerald-50/60 border border-emerald-200/80">
                                <span className="text-[10px] text-emerald-800 uppercase font-bold block">MÃ ĐÃ KIỂM</span>
                                <span className="text-base font-black text-emerald-700 font-mono mt-0.5 block">
                                    {cycleProgress.countedProductCount} mã
                                </span>
                            </div>
                            <div className="p-2.5 rounded-md bg-amber-50/60 border border-amber-200/80">
                                <span className="text-[10px] text-amber-800 uppercase font-bold block">MÃ CẦN KIỂM TIẾP</span>
                                <span className="text-base font-black text-amber-700 font-mono mt-0.5 block">
                                    {cycleProgress.uncountedProductCount} mã
                                </span>
                            </div>
                            <div className="p-2.5 rounded-md bg-lys-teal-soft border border-lys-teal-subtle">
                                <span className="text-[10px] text-lys-teal-strong uppercase font-bold block">GỢI Ý HÔM NAY</span>
                                <span className="text-base font-black text-lys-teal-strong font-mono mt-0.5 block">
                                    ~{cycleProgress.dailySuggestedCount} mã / ngày
                                </span>
                            </div>
                            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200">
                                <span className="text-[10px] text-slate-500 uppercase font-bold block">TỔNG TỒN HIỆN CÓ</span>
                                <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                                    {cycleProgress.totalBottles.toLocaleString()} chai
                                </span>
                            </div>
                        </div>

                        {/* Collapsible Tabs: Uncounted vs Counted items toggle */}
                        <div className="pt-1 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setActiveCycleTab('UNCOUNTED')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                                        activeCycleTab === 'UNCOUNTED'
                                            ? 'bg-slate-200 text-slate-900 font-bold'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Chưa kiểm kê ({cycleProgress.uncountedProducts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveCycleTab('COUNTED')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                                        activeCycleTab === 'COUNTED'
                                            ? 'bg-slate-200 text-slate-900 font-bold'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Đã kiểm kê ({cycleProgress.countedProducts.length})
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => loadCycleProgress()}
                                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-[11px] font-medium cursor-pointer"
                                title="Làm mới tiến độ kiểm kê"
                            >
                                <RefreshCw size={11} />
                                <span>Cập nhật</span>
                            </button>
                        </div>

                        {/* Quick preview of items in activeCycleTab */}
                        {activeCycleTab === 'UNCOUNTED' && cycleProgress.uncountedProducts.length > 0 && (
                            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md bg-slate-50/50">
                                {cycleProgress.uncountedProducts.slice(0, 10).map(p => (
                                    <div key={p.id} className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-100/70">
                                        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                            <span className="font-mono font-bold text-slate-900 shrink-0">{p.skuCode}</span>
                                            <span className="truncate text-slate-700">{p.productName}</span>
                                            {p.vintage && <span className="text-[10px] text-slate-500 font-mono shrink-0">({p.vintage})</span>}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px]">
                                            <span className="hidden sm:inline truncate max-w-[150px]">{p.locations.length > 0 ? p.locations.join(', ') : 'Chưa gán vị trí'}</span>
                                            <strong className="font-mono text-slate-900 shrink-0">{p.totalQty.toLocaleString()} chai</strong>
                                        </div>
                                    </div>
                                ))}
                                {cycleProgress.uncountedProducts.length > 10 && (
                                    <div className="p-1.5 text-center text-[10px] text-slate-400 italic">
                                        và còn {cycleProgress.uncountedProducts.length - 10} mã SKU khác chưa kiểm...
                                    </div>
                                )}
                            </div>
                        )}

                        {activeCycleTab === 'COUNTED' && cycleProgress.countedProducts.length > 0 && (
                            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-md bg-slate-50/50">
                                {cycleProgress.countedProducts.slice(0, 10).map(p => (
                                    <div key={p.id} className="p-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-100/70">
                                        <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
                                            <span className="font-mono font-bold text-emerald-800 shrink-0">{p.skuCode}</span>
                                            <span className="truncate text-slate-700">{p.productName}</span>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px]">
                                            <span className="hidden sm:inline">{p.lastCountedAt ? new Date(p.lastCountedAt).toLocaleDateString('vi-VN') : '—'}</span>
                                            <span className="text-emerald-700 font-bold shrink-0">✓ Đã kiểm</span>
                                        </div>
                                    </div>
                                ))}
                                {cycleProgress.countedProducts.length > 10 && (
                                    <div className="p-1.5 text-center text-[10px] text-slate-400 italic">
                                        và {cycleProgress.countedProducts.length - 10} mã khác...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Filter Tabs & Search Bar — Matched with Sales Order UI */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    {[
                        { key: 'ALL', label: 'Tất cả', count: stats.total },
                        { key: 'ASSIGNED', label: 'Phân công', count: stats.assignedToMe || 0 },
                        { key: 'IN_PROGRESS', label: 'Đang kiểm', count: stats.inProgress },
                        { key: 'COMPLETED', label: 'Đã xong', count: stats.completed },
                    ].map(tab => {
                        const isActive = activeTab === tab.key
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-3 py-1 rounded-md text-xs whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                    isActive
                                        ? 'bg-[#0E7490]/25 text-slate-900 font-extrabold border border-[#0E7490]/50 shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 font-semibold'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-[#0891B2] text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm số phiếu, kho, nhân viên..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0E7490] focus:ring-1 focus:ring-[#0E7490] text-slate-900 placeholder-slate-400 shadow-2xs"
                    />
                </div>
            </div>

            {/* Sessions Table — Matched with Sales Order Table UI */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="w-full">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <th className="p-3 pl-4">SỐ PHIẾU ↑</th>
                                <th className="p-3">TIÊU ĐỀ KIỂM KÊ</th>
                                <th className="p-3 whitespace-nowrap">KHO HÀNG</th>
                                <th className="p-3 whitespace-nowrap">PHẠM VI / CHẾ ĐỘ</th>
                                <th className="p-3 whitespace-nowrap">NGƯỜI PHỤ TRÁCH</th>
                                <th className="p-3 text-center whitespace-nowrap">SỐ DÒNG</th>
                                <th className="p-3 text-right whitespace-nowrap">CHÊNH LỆCH ⇅</th>
                                <th className="p-3 text-center whitespace-nowrap">TRẠNG THÁI</th>
                                <th className="p-3 whitespace-nowrap text-center">NGÀY TẠO ⌄</th>
                                <th className="p-3 pr-4 text-right whitespace-nowrap">HÀNH ĐỘNG</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-slate-400">
                                        Không tìm thấy phiên kiểm kê nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(row => {
                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => setTableModalSessionId(row.id)}
                                            className="hover:bg-slate-50/80 transition cursor-pointer group"
                                        >
                                            <td className="p-3 pl-4 font-mono font-bold text-[#0891B2] text-xs whitespace-nowrap group-hover:underline">
                                                {row.sessionNo}
                                            </td>

                                            <td className="p-3">
                                                <div className="font-bold text-slate-900 text-xs leading-snug line-clamp-1">{row.title}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    👤 Tạo bởi: {row.createdByName || 'Hệ thống'}
                                                </div>
                                            </td>

                                            <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    {row.warehouseName}
                                                </div>
                                            </td>

                                            <td className="p-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center shrink-0">
                                                        {row.scopeType === 'FULL_WAREHOUSE' ? '📦 Full Kho' :
                                                         row.scopeType === 'CYCLE_COUNT' ? '🔄 Cycle Count' :
                                                         row.scopeType === 'TRANSACTED_ITEMS' ? '⚡ Mã Giao Dịch' : '🚨 Đột Xuất'}
                                                    </span>
                                                    {row.isBlindCount && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center shrink-0">
                                                            Mù
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-3 whitespace-nowrap">
                                                {row.assignedToName ? (
                                                    <span className="text-xs font-semibold text-cyan-700 flex items-center gap-1">
                                                        <UserCheck className="w-3.5 h-3.5 shrink-0" /> {row.assignedToName}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>
                                                )}
                                            </td>

                                            <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">{row.lineCount} mã</td>

                                            <td className="p-3 text-right font-mono font-bold whitespace-nowrap">
                                                <span className={row.totalVariance === 0 ? 'text-slate-500' : row.totalVariance > 0 ? 'text-amber-600' : 'text-rose-600'}>
                                                    {row.totalVariance > 0 ? `+${row.totalVariance}` : row.totalVariance} chai
                                                </span>
                                            </td>

                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                                                    row.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                    row.status === 'COMPLETED' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
                                                    row.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        row.status === 'APPROVED' ? 'bg-emerald-500' :
                                                        row.status === 'COMPLETED' ? 'bg-cyan-500' :
                                                        row.status === 'IN_PROGRESS' ? 'bg-amber-500' :
                                                        'bg-slate-400'
                                                    }`} />
                                                    {row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'COMPLETED' ? 'Đã đếm xong' : row.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Nháp'}
                                                </span>
                                            </td>

                                            <td className="p-3 text-center text-[11px] text-slate-500 whitespace-nowrap">
                                                {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                                            </td>

                                            <td className="p-3 pr-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    {row.status === 'DRAFT' && (
                                                        <button
                                                            onClick={() => handleStartSession(row.id)}
                                                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                                            title="Kích hoạt bắt đầu kiểm kê"
                                                        >
                                                            <Zap className="w-3 h-3" /> Bắt Đầu
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => setTableModalSessionId(row.id)}
                                                        className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                                        title="Xem & Làm việc chi tiết"
                                                    >
                                                        <Eye className="w-3 h-3" /> Xem
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenPrintView(row.id)}
                                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                                        title="In Biên bản"
                                                    >
                                                        <Printer className="w-3 h-3 text-slate-500" /> In
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sessions Cards — Mobile View (< 768px) */}
            <div className="block md:hidden space-y-3">
                {filteredList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-lg text-xs font-bold">
                        Không tìm thấy phiên kiểm kê nào.
                    </div>
                ) : (
                    filteredList.map(row => (
                        <div key={row.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 whitespace-nowrap shrink-0">
                                    {row.sessionNo}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap inline-flex items-center shrink-0 ${
                                    row.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                    row.status === 'COMPLETED' ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' :
                                    row.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}>
                                    {row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'COMPLETED' ? 'Đã đếm xong' : row.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Nháp'}
                                </span>
                            </div>

                            <div>
                                <h4 className="text-sm font-extrabold text-slate-900">{row.title}</h4>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <Warehouse className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {row.warehouseName}
                                    </span>
                                    <span className="font-semibold text-slate-700">👤 Tạo bởi: {row.createdByName}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 font-mono">
                                <span>Số dòng: <strong className="text-slate-900">{row.lineCount} mã</strong></span>
                                <span className={row.totalVariance === 0 ? 'text-slate-500' : row.totalVariance > 0 ? 'text-amber-700' : 'text-rose-600'}>
                                    Lệch: {row.totalVariance > 0 ? `+${row.totalVariance}` : row.totalVariance} chai
                                </span>
                            </div>

                            {row.status === 'DRAFT' && (
                                <button
                                    onClick={() => handleStartSession(row.id)}
                                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Zap className="w-4 h-4" /> ⚡ Bắt Đầu Kiểm Kê Ngay
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                    onClick={() => setTableModalSessionId(row.id)}
                                    className="py-2.5 bg-[#0891B2] hover:bg-[#0E7490] text-white font-black rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Bảng Điền
                                </button>
                                <button
                                    onClick={() => handleOpenMobileView(row.id)}
                                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-lg text-[11px] flex items-center justify-center gap-1 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Smartphone className="w-3.5 h-3.5" /> Đếm ĐT
                                </button>
                                <button
                                    onClick={() => handleOpenAssignModal(row.id)}
                                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-lg text-[11px] flex items-center justify-center gap-1 border border-slate-200 shadow-2xs cursor-pointer"
                                >
                                    <UserCheck className="w-3.5 h-3.5 text-cyan-600" /> Phân công
                                </button>
                                <button
                                    onClick={() => handleOpenPrintView(row.id)}
                                    className="py-2 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-lg text-[11px] flex items-center justify-center gap-1 border border-slate-200 shadow-2xs cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5 text-amber-600" /> In Biên Bản
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Extended Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-xl w-full p-6 text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                            <div>
                                <h2 className="text-base font-extrabold text-slate-900">Khởi Tạo Phiếu Kiểm Kê Mới</h2>
                                <p className="text-xs text-slate-500">Chọn 1 trong 4 chế độ kiểm kê nâng cao</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">✕</button>
                        </div>

                        {createError && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                            {/* Scope Selector Grid */}
                            <div>
                                <label className="text-slate-700 font-bold block mb-2">CHỌN CHẾ ĐỘ KIỂM KÊ:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'FULL_WAREHOUSE', title: '📦 Full Kho', desc: 'Toàn bộ mã & vị trí' },
                                        { key: 'CYCLE_COUNT', title: '🔄 Cycle Count', desc: 'Theo vị trí / loại rượu' },
                                        { key: 'TRANSACTED_ITEMS', title: '⚡ Mã Giao Dịch', desc: 'Có nhập/xuất gần đây' },
                                        { key: 'SPOT_COUNT', title: '🚨 Đột Xuất', desc: 'Kiểm tức thì theo mã/khu' },
                                    ].map(mode => (
                                        <button
                                            type="button"
                                            key={mode.key}
                                            onClick={() => setFormScopeType(mode.key as any)}
                                            className={`p-3 rounded-lg text-left border transition cursor-pointer ${formScopeType === mode.key ? 'bg-teal-50 border-2 border-teal-500 text-teal-900 font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            <div className="font-bold text-xs">{mode.title}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Warehouse Selector */}
                            <div>
                                <label className="text-slate-700 font-bold block mb-1">Kho Hàng Kiểm Kê:*</label>
                                <select
                                    value={formWarehouseId}
                                    onChange={e => {
                                        setFormWarehouseId(e.target.value)
                                        fetchLocationOptions(e.target.value)
                                    }}
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20"
                                    required
                                >
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="text-slate-700 font-bold block mb-1">Tên / Mục Đích Phiếu Kiểm Kê:</label>
                                <input
                                    type="text"
                                    placeholder="vd: Kiểm kê định kỳ tháng 8, Kiểm kê đột xuất hầm rượu..."
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20"
                                />
                            </div>

                            {/* Scope-specific Options */}
                            {formScopeType === 'CYCLE_COUNT' && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                                    <div>
                                        <label className="text-slate-700 font-bold block mb-1">Lọc theo Vị trí (Zone):</label>
                                        <select
                                            value={formSelectedZone}
                                            onChange={e => setFormSelectedZone(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 text-xs focus:outline-none"
                                        >
                                            <option value="">-- Tất cả vị trí --</option>
                                            {Array.from(new Set(locationOptions.map(l => l.zone))).map(z => (
                                                <option key={z} value={z}>{z}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {formScopeType === 'TRANSACTED_ITEMS' && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    <label className="text-slate-700 font-bold block mb-1">Phát sinh giao dịch trong (Ngày):</label>
                                    <input
                                        type="number"
                                        value={formTransactedDays}
                                        onChange={e => setFormTransactedDays(parseInt(e.target.value, 10) || 30)}
                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 font-mono text-xs focus:outline-none"
                                    />
                                </div>
                            )}

                            {formScopeType === 'SPOT_COUNT' && (
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                                    <div>
                                        <label className="text-slate-700 font-bold block mb-1">Nhập danh sách mã SKU cần đột xuất (cách nhau bởi dấu phẩy/xuống dòng):</label>
                                        <textarea
                                            rows={3}
                                            placeholder="vd: L10001, L10007, L20015..."
                                            value={formSpotSkus}
                                            onChange={e => setFormSpotSkus(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2 font-mono text-xs focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Staff Assignee */}
                            <div>
                                <label className="text-slate-700 font-bold block mb-1">Phân Công Cho Nhân Viên:</label>
                                <select
                                    value={formAssignedToId}
                                    onChange={e => setFormAssignedToId(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20"
                                >
                                    <option value="">-- Chưa phân công (Để tự do) --</option>
                                    {staffList.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Blind Count Option Toggle */}
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <input
                                    type="checkbox"
                                    id="blindToggle"
                                    checked={formIsBlind}
                                    onChange={e => setFormIsBlind(e.target.checked)}
                                    className="w-4 h-4 rounded text-teal-600 focus:ring-0 bg-white border-slate-300"
                                />
                                <label htmlFor="blindToggle" className="cursor-pointer">
                                    <span className="font-bold text-slate-900 block">Kiểm Kê Mù (Giấu Tồn Sổ Sách)</span>
                                    <span className="text-[10px] text-slate-500 block">Ẩn số liệu tồn sổ sách trên điện thoại nhân viên để đảm bảo đếm thực tế 100%</span>
                                </label>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-[#0891B2] hover:bg-[#0E7490] text-white font-extrabold rounded-lg shadow-xs cursor-pointer"
                                >
                                    {isSubmitting ? 'Đang khởi tạo...' : 'Tạo Phiếu Kiểm Kê'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Printable A4 Report Overlay Modal */}
            {printViewDetail && (
                <PrintableAuditReport
                    detail={printViewDetail}
                    onClose={() => setPrintViewDetail(null)}
                    onRefreshed={() => fetchData()}
                />
            )}

            {/* Barcode Camera Modal */}
            <BarcodeLookupModal
                isOpen={showBarcodeLookup}
                onClose={() => setShowBarcodeLookup(false)}
            />

            {/* Modal Phân Công Vị Trí / Khu Vực Cho Nhân Sự */}
            {showAssignModal && assignSessionDetail && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <div>
                                <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                    {assignSessionDetail.sessionNo}
                                </span>
                                <h3 className="text-base font-extrabold text-slate-900 mt-1">Phân Công Nhân Sự Theo Vị Trí Kệ</h3>
                                <p className="text-xs text-slate-500">Giao trách nhiệm phụ trách khu vực kiểm kê cho từng nhân viên</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">✕</button>
                        </div>

                        <div className="space-y-3">
                            {Object.keys(zoneAssignments).length === 0 ? (
                                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                                    Phiếu này không chia theo khu vực cụ thể.
                                </div>
                            ) : (
                                Object.keys(zoneAssignments).map(zoneName => {
                                    const totalInZone = assignSessionDetail.lines.filter((l: any) => (l.zone || l.locationCode || 'Khu vực chung') === zoneName).length

                                    return (
                                        <div key={zoneName} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                                            <div className="flex justify-between items-center font-bold">
                                                <span className="text-slate-900 flex items-center gap-1.5">
                                                    <MapPin className="w-4 h-4 text-emerald-600" />
                                                    {zoneName}
                                                </span>
                                                <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                    {totalInZone} sản phẩm
                                                </span>
                                            </div>

                                            <div>
                                                <label className="text-[11px] text-slate-500 font-bold block mb-1">Nhân sự phụ trách:</label>
                                                <select
                                                    value={zoneAssignments[zoneName] || ''}
                                                    onChange={e => {
                                                        const val = e.target.value
                                                        setZoneAssignments(prev => ({ ...prev, [zoneName]: val }))
                                                    }}
                                                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2 text-xs outline-none focus:border-cyan-500 font-semibold cursor-pointer"
                                                >
                                                    <option value="">-- Chưa phân công --</option>
                                                    {staffList.map(st => (
                                                        <option key={st.id} value={st.id}>
                                                            {st.name} ({st.email})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setShowAssignModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveZoneAssignments}
                                disabled={isSavingAssignments}
                                className="px-5 py-2 bg-[#0891B2] hover:bg-[#0E7490] text-white font-extrabold rounded-lg shadow-xs cursor-pointer"
                            >
                                {isSavingAssignments ? 'Đang lưu...' : 'Lưu Phân Công Vị Trí'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL BẢNG ĐIỀN TRỰC TIẾP & LỌC VỊ TRÍ */}
            {tableModalSessionId && (
                <StockCountTableModal
                    sessionId={tableModalSessionId}
                    onClose={() => setTableModalSessionId(null)}
                    onOpenMobileView={id => handleOpenMobileView(id)}
                    onOpenAssignModal={id => handleOpenAssignModal(id)}
                    onOpenPrintView={id => handleOpenPrintView(id)}
                    onRefreshSession={fetchData}
                />
            )}

            {/* ═══ MODAL TẠO ĐỢT KIỂM KÊ CUỐN CHIẾU HÔM NAY (DAILY BATCH CYCLE COUNT) ═══ */}
            {showDailyBatchModal && cycleProgress && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-extrabold text-slate-900">
                                        Tạo Đợt Kiểm Kê Cuốn Chiếu Hôm Nay
                                    </h3>
                                    <span className="text-[11px] font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle px-2 py-0.5 rounded-full">
                                        {cycleProgress.warehouseName.startsWith('Kho') ? cycleProgress.warehouseName : `Kho ${cycleProgress.warehouseName}`}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Hệ thống gợi ý các mã chưa kiểm trong chu kỳ {cycleDaysWindow} ngày. Chọn các mã cần đếm hôm nay.
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDailyBatchModal(false)}
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Title of this daily session */}
                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Tên đợt kiểm kê hôm nay:
                            </label>
                            <input
                                type="text"
                                value={batchCountTitle}
                                onChange={e => setBatchCountTitle(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-md p-2 text-xs outline-none focus:border-lys-teal-strong font-medium"
                                placeholder="vd: Kiểm kê cuốn chiếu ngày..."
                            />
                        </div>

                        {/* Quick Presets Selection */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <label className="font-bold text-slate-700">
                                    Chọn nhanh các mã chưa kiểm kê ({cycleProgress.uncountedProducts.length} mã còn lại):
                                </label>
                                <span className="font-bold text-lys-teal-strong">
                                    Đã chọn: {selectedDailySkus.length} mã
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const top5 = cycleProgress.uncountedProducts.slice(0, 5).map(p => p.skuCode)
                                        setSelectedDailySkus(top5)
                                    }}
                                    className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 cursor-pointer"
                                >
                                    + 5 mã đầu (tồn cao nhất)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const top10 = cycleProgress.uncountedProducts.slice(0, 10).map(p => p.skuCode)
                                        setSelectedDailySkus(top10)
                                    }}
                                    className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 cursor-pointer"
                                >
                                    + 10 mã
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const top15 = cycleProgress.uncountedProducts.slice(0, 15).map(p => p.skuCode)
                                        setSelectedDailySkus(top15)
                                    }}
                                    className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 cursor-pointer"
                                >
                                    + 15 mã
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedDailySkus(cycleProgress.uncountedProducts.map(p => p.skuCode))
                                    }}
                                    className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 cursor-pointer"
                                >
                                    Tất cả ({cycleProgress.uncountedProducts.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDailySkus([])}
                                    className="px-2.5 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 text-slate-500 font-semibold border border-slate-200 cursor-pointer"
                                >
                                    Bỏ chọn
                                </button>
                            </div>
                        </div>

                        {/* Search and list of uncounted products */}
                        <div className="space-y-1.5">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm mã SKU hoặc tên sản phẩm..."
                                    value={batchSearchTerm}
                                    onChange={e => setBatchSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-lys-teal-strong"
                                />
                            </div>

                            <div className="border border-slate-200 rounded-md max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white">
                                {cycleProgress.uncountedProducts
                                    .filter(p => !batchSearchTerm || p.skuCode.toLowerCase().includes(batchSearchTerm.toLowerCase()) || p.productName.toLowerCase().includes(batchSearchTerm.toLowerCase()))
                                    .map(p => {
                                        const isSelected = selectedDailySkus.includes(p.skuCode)
                                        return (
                                            <label
                                                key={p.id}
                                                className={`p-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                                                    isSelected ? 'bg-lys-teal-soft/40' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {
                                                            if (isSelected) {
                                                                setSelectedDailySkus(prev => prev.filter(s => s !== p.skuCode))
                                                            } else {
                                                                setSelectedDailySkus(prev => [...prev, p.skuCode])
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-teal-600 focus:ring-0 bg-white border-slate-300"
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                            <span className="font-mono text-lys-teal-strong shrink-0">{p.skuCode}</span>
                                                            <span className="truncate">{p.productName}</span>
                                                            {p.vintage && <span className="text-[10px] text-slate-400 font-mono font-normal shrink-0">({p.vintage})</span>}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate">
                                                            Vị trí: {p.locations.length > 0 ? p.locations.join(', ') : 'Chưa gán vị trí'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <strong className="font-mono text-slate-900">{p.totalQty.toLocaleString()} chai</strong>
                                                </div>
                                            </label>
                                        )
                                    })}
                            </div>
                        </div>

                        {/* Assignee & Blind Count */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Phân công nhân viên đếm:
                                </label>
                                <select
                                    value={batchAssigneeId}
                                    onChange={e => setBatchAssigneeId(e.target.value)}
                                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-md p-2 text-xs outline-none focus:border-lys-teal-strong"
                                >
                                    <option value="">-- Để tự do (chưa gán) --</option>
                                    {staffList.map(st => (
                                        <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-2 pt-4">
                                <input
                                    type="checkbox"
                                    id="batchBlindToggle"
                                    checked={batchIsBlind}
                                    onChange={e => setBatchIsBlind(e.target.checked)}
                                    className="w-4 h-4 rounded text-teal-600 focus:ring-0 bg-white border-slate-300 cursor-pointer"
                                />
                                <label htmlFor="batchBlindToggle" className="cursor-pointer">
                                    <span className="font-bold text-slate-900 block">Kiểm Kê Mù (Blind Count)</span>
                                    <span className="text-[10px] text-slate-500 block">Giấu tồn sổ sách trên máy nhân viên đếm</span>
                                </label>
                            </div>
                        </div>

                        {/* Submit Buttons */}
                        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setShowDailyBatchModal(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateBatchSession}
                                disabled={isCreatingBatch || selectedDailySkus.length === 0}
                                className="px-5 py-2 bg-lys-teal-strong hover:bg-lys-teal-hover text-white font-extrabold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <Zap size={14} />
                                <span>{isCreatingBatch ? 'Đang khởi tạo...' : `Tạo Phiếu & Bắt Đầu Đếm (${selectedDailySkus.length} mã)`}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default StockCountClient
