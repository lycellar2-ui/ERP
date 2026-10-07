'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    ClipboardList, Plus, Search, Filter, Warehouse, MapPin, Smartphone,
    Printer, CheckCircle2, ShieldCheck, QrCode, AlertCircle, Eye, EyeOff,
    UserCheck, RefreshCw, Layers, Zap, AlertTriangle, FileText,
    RotateCcw, Check, Calendar, ArrowRight, ArrowLeft, Sparkles, Shuffle,
    BarChart3, X
} from 'lucide-react'
import {
    getStockCountList, getStockCountDetail, getCountStats,
    getWarehouseOptions, getWarehouseLocationOptions, getStaffUserOptions,
    createStockCountSessionExtended, startStockCount, approveAndCreateAdjustment,
    assignStaffToZones, getCycleCountProgress, getRandomSampleSkus, type CycleCountProgress
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
    const [viewMode, setViewMode] = useState<'SESSIONS' | 'CYCLE_PLAN'>('SESSIONS')
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

    // 2-Step Creation Wizard State
    const [createWizardStep, setCreateWizardStep] = useState<1 | 2>(1)
    const [countCategory, setCountCategory] = useState<'FULL' | 'PARTIAL' | 'RANDOM' | 'CYCLE'>('FULL')
    const [randomCountMode, setRandomCountMode] = useState<'RANDOM_SAMPLE' | 'MANUAL_SKUS'>('RANDOM_SAMPLE')
    const [sampleCountSize, setSampleCountSize] = useState<number>(10)
    const [previewSampleSkus, setPreviewSampleSkus] = useState<Array<{ id: string; skuCode: string; productName: string; vintage: number | null; totalQty: number }>>([])
    const [loadingSample, setLoadingSample] = useState(false)

    // Weekly Cycle Count Planner State
    const [cycleProgress, setCycleProgress] = useState<CycleCountProgress | null>(null)
    const [cycleWarehouseId, setCycleWarehouseId] = useState<string>('')
    const [cycleDaysWindow, setCycleDaysWindow] = useState<number>(7)
    const [cycleDateMode, setCycleDateMode] = useState<'PRESET' | 'CUSTOM'>('PRESET')
    const [cycleDateFrom, setCycleDateFrom] = useState<string>(() => {
        const d = new Date()
        d.setDate(d.getDate() - 7)
        return d.toISOString().slice(0, 10)
    })
    const [cycleDateTo, setCycleDateTo] = useState<string>(() => {
        return new Date().toISOString().slice(0, 10)
    })
    const [loadingCycle, setLoadingCycle] = useState<boolean>(false)
    const [activeCycleTab, setActiveCycleTab] = useState<'UNCOUNTED' | 'COUNTED'>('UNCOUNTED')
    const [wizardCycleSearchTerm, setWizardCycleSearchTerm] = useState<string>('')

    // Daily Batch Count Modal State
    const [showDailyBatchModal, setShowDailyBatchModal] = useState<boolean>(false)
    const [selectedDailySkus, setSelectedDailySkus] = useState<string[]>([])
    const [batchCountTitle, setBatchCountTitle] = useState<string>('')
    const [batchIsBlind, setBatchIsBlind] = useState<boolean>(false)
    const [batchAssigneeId, setBatchAssigneeId] = useState<string>('')
    const [isCreatingBatch, setIsCreatingBatch] = useState<boolean>(false)
    const [batchSearchTerm, setBatchSearchTerm] = useState<string>('')
    const [cycleSearchTerm, setCycleSearchTerm] = useState<string>('')

    const filteredCycleProducts = useMemo(() => {
        if (!cycleProgress) return []
        const base = activeCycleTab === 'UNCOUNTED'
            ? cycleProgress.uncountedProducts
            : cycleProgress.countedProducts
        if (!cycleSearchTerm.trim()) return base
        const term = cycleSearchTerm.toLowerCase().trim()
        return base.filter((p: any) =>
            p.skuCode.toLowerCase().includes(term) ||
            p.productName.toLowerCase().includes(term) ||
            (Array.isArray(p.locations) && p.locations.some((loc: string) => loc.toLowerCase().includes(term)))
        )
    }, [cycleProgress, activeCycleTab, cycleSearchTerm])

    const filteredWizardCycleProducts = useMemo(() => {
        if (!cycleProgress?.uncountedProducts) return []
        if (!wizardCycleSearchTerm.trim()) return cycleProgress.uncountedProducts
        const term = wizardCycleSearchTerm.toLowerCase().trim()
        return cycleProgress.uncountedProducts.filter(p =>
            p.skuCode.toLowerCase().includes(term) ||
            p.productName.toLowerCase().includes(term) ||
            (Array.isArray(p.locations) && p.locations.some((loc: string) => loc.toLowerCase().includes(term)))
        )
    }, [cycleProgress, wizardCycleSearchTerm])

    const loadCycleProgress = async (whId?: string, days?: number, fromDateStr?: string, toDateStr?: string) => {
        const targetWh = whId || cycleWarehouseId || warehouses[0]?.id
        if (!targetWh) return
        setLoadingCycle(true)
        try {
            const isCustom = cycleDateMode === 'CUSTOM' || (fromDateStr !== undefined && toDateStr !== undefined)
            const fDate = fromDateStr !== undefined ? fromDateStr : (isCustom ? cycleDateFrom : undefined)
            const tDate = toDateStr !== undefined ? toDateStr : (isCustom ? cycleDateTo : undefined)
            const data = await getCycleCountProgress(targetWh, days || cycleDaysWindow, fDate, tDate)
            setCycleProgress(data)
            if (data?.daysWindow) {
                setCycleDaysWindow(data.daysWindow)
            }
        } finally {
            setLoadingCycle(false)
        }
    }

    const fetchLocationOptions = async (whId: string) => {
        const locs = await getWarehouseLocationOptions(whId)
        setLocationOptions(locs)
    }

    const handleFetchSampleSkus = async (whId: string, count: number) => {
        if (!whId) return
        setLoadingSample(true)
        try {
            const samples = await getRandomSampleSkus(whId, count)
            setPreviewSampleSkus(samples)
        } finally {
            setLoadingSample(false)
        }
    }

    const handleSelectCategory = (cat: 'FULL' | 'PARTIAL' | 'RANDOM' | 'CYCLE') => {
        setCountCategory(cat)
        setCreateWizardStep(2)
        setCreateError('')
        const targetWhId = formWarehouseId || warehouses[0]?.id || ''
        const targetWh = warehouses.find(w => w.id === targetWhId) || warehouses[0]
        const whName = targetWh?.name || 'Kho'
        const today = new Date().toLocaleDateString('vi-VN')

        if (cat === 'FULL') {
            setFormScopeType('FULL_WAREHOUSE')
            setFormTitle(`Kiểm kê toàn bộ - ${whName} (${today})`)
        } else if (cat === 'PARTIAL') {
            setFormScopeType('CYCLE_COUNT')
            setFormTitle(`Kiểm kê phân khu kệ - ${whName}`)
            if (targetWh?.id) {
                fetchLocationOptions(targetWh.id)
            }
        } else if (cat === 'RANDOM') {
            setFormScopeType('SPOT_COUNT')
            setRandomCountMode('RANDOM_SAMPLE')
            setFormTitle(`Kiểm kê ngẫu nhiên (${sampleCountSize} mã) - ${whName}`)
            if (targetWh?.id) {
                handleFetchSampleSkus(targetWh.id, sampleCountSize)
            }
        } else if (cat === 'CYCLE') {
            setFormScopeType('CYCLE_COUNT')
            setFormTitle(`Kiểm kê cuốn chiếu ${today} - ${whName}`)
            if (targetWh?.id) {
                loadCycleProgress(targetWh.id, cycleDaysWindow)
            }
        }
    }

    const handleWarehouseChange = (whId: string) => {
        setFormWarehouseId(whId)
        fetchLocationOptions(whId)
        const targetWh = warehouses.find(w => w.id === whId)
        const whName = targetWh?.name || 'Kho'
        const today = new Date().toLocaleDateString('vi-VN')

        if (countCategory === 'FULL') {
            setFormTitle(`Kiểm kê toàn bộ - ${whName} (${today})`)
        } else if (countCategory === 'PARTIAL') {
            setFormTitle(`Kiểm kê phân khu kệ - ${whName}`)
        } else if (countCategory === 'RANDOM') {
            setFormTitle(`Kiểm kê ngẫu nhiên (${sampleCountSize} mã) - ${whName}`)
            if (randomCountMode === 'RANDOM_SAMPLE') {
                handleFetchSampleSkus(whId, sampleCountSize)
            }
        } else if (countCategory === 'CYCLE') {
            setFormTitle(`Kiểm kê cuốn chiếu ${today} - ${whName}`)
            loadCycleProgress(whId, cycleDaysWindow)
        }
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

        let skus: string[] | undefined = undefined
        let randomCount: number | undefined = undefined

        if (countCategory === 'RANDOM') {
            if (randomCountMode === 'MANUAL_SKUS') {
                if (formSpotSkus.trim()) {
                    skus = formSpotSkus.split(/[\n,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
                }
                if (!skus || skus.length === 0) {
                    setIsSubmitting(false)
                    setCreateError('Vui lòng nhập ít nhất 1 mã SKU cần kiểm kê đột xuất')
                    return
                }
            } else {
                if (previewSampleSkus.length > 0) {
                    skus = previewSampleSkus.map(s => s.skuCode)
                } else {
                    randomCount = sampleCountSize
                }
            }
        } else if (countCategory === 'CYCLE') {
            if (selectedDailySkus.length > 0) {
                skus = selectedDailySkus
            } else if (cycleProgress && cycleProgress.uncountedProducts.length > 0) {
                const topN = cycleProgress.uncountedProducts.slice(0, cycleProgress.dailySuggestedCount).map(p => p.skuCode)
                skus = topN
            }
            if (!skus || skus.length === 0) {
                setIsSubmitting(false)
                setCreateError('Vui lòng chọn ít nhất 1 mã SKU để kiểm kê cuốn chiếu')
                return
            }
        }

        const res = await createStockCountSessionExtended({
            warehouseId: formWarehouseId,
            title: formTitle || undefined,
            scopeType: countCategory === 'FULL' ? 'FULL_WAREHOUSE' : countCategory === 'RANDOM' ? 'SPOT_COUNT' : 'CYCLE_COUNT',
            isBlindCount: formIsBlind,
            assignedToId: formAssignedToId || undefined,
            selectedZone: countCategory === 'PARTIAL' ? (formSelectedZone || undefined) : undefined,
            selectedWineType: countCategory === 'PARTIAL' ? (formWineType || undefined) : undefined,
            skuCodes: skus,
            randomSampleCount: randomCount,
        })

        setIsSubmitting(false)
        if (res.success) {
            setShowCreateModal(false)
            setCreateWizardStep(1)
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
                    loadCycleProgress()
                }}
                onRefreshed={() => {
                    fetchData()
                    loadCycleProgress()
                }}
                onOpenTableModal={() => {
                    const sid = mobileViewDetail.id
                    setMobileViewDetail(null)
                    setTableModalSessionId(sid)
                }}
                onOpenReport={sid => {
                    setMobileViewDetail(null)
                    handleOpenPrintView(sid)
                }}
            />
        )
    }

    return (
        <div className="w-full space-y-4 max-w-screen-2xl">
            {/* Header & Quick Stats Bar */}
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
                        <BarChart3 size={14} className="text-slate-600" /> Thống kê
                    </button>
                    <button
                        onClick={() => setShowBarcodeLookup(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
                    >
                        <QrCode size={14} className="text-emerald-600" /> Tra cứu Barcode
                    </button>
                    {viewMode === 'SESSIONS' ? (
                        <button
                            onClick={() => {
                                setCreateWizardStep(1)
                                setShowCreateModal(true)
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-lys-teal-strong hover:bg-lys-teal-hover rounded-md transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                            <Plus size={15} /> Tạo Phiếu Kiểm Kê
                        </button>
                    ) : (
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
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-lys-teal-strong hover:bg-lys-teal-hover rounded-md transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                            <Zap size={14} /> Tạo Đợt Đếm Hôm Nay
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsible Stats Cards */}
            {showStats && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Thống Kê Chi Tiết</span>
                        <button onClick={() => setShowStats(false)} className="text-xs font-semibold hover:underline flex items-center gap-1 text-[#0891B2]">
                            Thu gọn chỉ số
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

            {/* ═══ TOP NAVIGATION TABS: PHIẾU KIỂM KÊ vs KẾ HOẠCH CUỐN CHIẾU ═══ */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 w-full sm:w-fit">
                <button
                    type="button"
                    onClick={() => setViewMode('SESSIONS')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'SESSIONS'
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-black'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                >
                    <ClipboardList size={15} className={viewMode === 'SESSIONS' ? 'text-lys-teal-strong' : 'text-slate-400'} />
                    <span>Danh Sách Phiếu Kiểm</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        viewMode === 'SESSIONS' ? 'bg-lys-teal-soft text-lys-teal-strong font-bold' : 'bg-slate-200 text-slate-700'
                    }`}>
                        {stats.total}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode('CYCLE_PLAN')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        viewMode === 'CYCLE_PLAN'
                            ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80 font-black'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                >
                    <RotateCcw size={15} className={viewMode === 'CYCLE_PLAN' ? 'text-lys-teal-strong' : 'text-slate-400'} />
                    <span>Kế Hoạch Cuốn Chiếu (Hôm Nay)</span>
                    {cycleProgress && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            viewMode === 'CYCLE_PLAN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                            {cycleProgress.progressPercent}%
                        </span>
                    )}
                </button>
            </div>

            {/* ═══ TAB 2: KẾ HOẠCH KIỂM KÊ CUỐN CHIẾU (CHỈ HIỂN THỊ KHI CHỌN TAB NÀY) ═══ */}
            {viewMode === 'CYCLE_PLAN' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 animate-in fade-in-50 duration-150">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0 mt-0.5">
                                <RotateCcw size={20} className="text-lys-teal-strong" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                                    <span>Kế Hoạch Kiểm Kê Cuốn Chiếu (Cycle Count)</span>
                                    <span className="text-[10px] font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle px-2 py-0.5 rounded-full">
                                        {cycleProgress?.dateFrom && cycleProgress?.dateTo ? (
                                            `Từ ${new Date(cycleProgress.dateFrom).toLocaleDateString('vi-VN')} đến ${new Date(cycleProgress.dateTo).toLocaleDateString('vi-VN')} (${cycleProgress.daysWindow} ngày)`
                                        ) : (
                                            `Chu kỳ ${cycleDaysWindow} ngày`
                                        )}
                                    </span>
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Chia nhỏ danh mục kho thành từng đợt đếm hàng ngày để kiểm soát tồn kho thực tế liên tục mà không gián đoạn bán hàng.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Warehouse selector */}
                            <select
                                value={cycleWarehouseId}
                                onChange={e => {
                                    setCycleWarehouseId(e.target.value)
                                    loadCycleProgress(e.target.value, cycleDaysWindow)
                                }}
                                className="bg-slate-50 border border-slate-300 text-slate-900 rounded-md px-3 py-2 text-xs font-semibold outline-none cursor-pointer focus:border-lys-teal-strong"
                            >
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>

                            {/* Date mode: PRESET vs CUSTOM */}
                            {cycleDateMode === 'PRESET' ? (
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={cycleDaysWindow}
                                        onChange={e => {
                                            const days = parseInt(e.target.value, 10) || 7
                                            setCycleDaysWindow(days)
                                            loadCycleProgress(cycleWarehouseId, days)
                                        }}
                                        className="bg-slate-50 border border-slate-300 text-slate-900 rounded-md px-3 py-2 text-xs font-semibold outline-none cursor-pointer focus:border-lys-teal-strong"
                                    >
                                        <option value={7}>Chu kỳ 7 ngày (1 tuần)</option>
                                        <option value={14}>Chu kỳ 14 ngày (2 tuần)</option>
                                        <option value={30}>Chu kỳ 30 ngày (1 tháng)</option>
                                        <option value={60}>Chu kỳ 60 ngày (2 tháng)</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setCycleDateMode('CUSTOM')}
                                        className="px-2.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md flex items-center gap-1 cursor-pointer"
                                        title="Chuyển sang chọn ngày tùy ý"
                                    >
                                        <Calendar size={13} />
                                        <span>Tùy chọn ngày</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-md border border-slate-300">
                                    <span className="text-[11px] font-bold text-slate-600 pl-1">Từ:</span>
                                    <input
                                        type="date"
                                        value={cycleDateFrom}
                                        onChange={e => setCycleDateFrom(e.target.value)}
                                        className="bg-white border border-slate-300 text-slate-900 rounded px-2 py-1 text-xs outline-none focus:border-lys-teal-strong"
                                    />
                                    <span className="text-[11px] font-bold text-slate-600">Đến:</span>
                                    <input
                                        type="date"
                                        value={cycleDateTo}
                                        onChange={e => setCycleDateTo(e.target.value)}
                                        className="bg-white border border-slate-300 text-slate-900 rounded px-2 py-1 text-xs outline-none focus:border-lys-teal-strong"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => loadCycleProgress(cycleWarehouseId, undefined, cycleDateFrom, cycleDateTo)}
                                        className="px-2 py-1 bg-lys-teal-strong hover:bg-lys-teal-hover text-white rounded font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title="Tính toán lại theo khoảng ngày"
                                    >
                                        <RefreshCw size={11} /> Áp dụng
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCycleDateMode('PRESET')
                                            loadCycleProgress(cycleWarehouseId, 7)
                                        }}
                                        className="px-2 py-1 bg-white hover:bg-slate-200 text-slate-600 rounded font-semibold text-xs cursor-pointer border border-slate-200"
                                        title="Trở lại chu kỳ cố định"
                                    >
                                        Theo tuần
                                    </button>
                                </div>
                            )}

                            {/* Primary CTA */}
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
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-lys-teal-strong hover:bg-lys-teal-hover rounded-md shadow-xs transition cursor-pointer active:scale-95"
                            >
                                <Zap size={14} />
                                <span>Tạo Đợt Đếm Hôm Nay</span>
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar & Key Cycle Stats */}
                    {loadingCycle ? (
                        <div className="py-8 text-center text-xs text-slate-400">Đang đồng bộ tiến độ kiểm kê kho...</div>
                    ) : cycleProgress ? (
                        <div className="space-y-4">
                            {/* Progress bar */}
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                <div className="flex items-center justify-between text-xs mb-2">
                                    <span className="font-semibold text-slate-700">
                                        Tiến độ hoàn tất chu kỳ ({cycleDaysWindow} ngày): <strong className="text-lys-teal-strong font-mono text-sm">{cycleProgress.countedProductCount}</strong> / <span className="font-mono text-sm">{cycleProgress.totalProducts}</span> mã SKU
                                    </span>
                                    <span className="font-extrabold text-sm text-lys-teal-strong font-mono">
                                        {cycleProgress.progressPercent}% ĐÃ KIỂM
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300">
                                    <div
                                        className="bg-lys-teal-strong h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, Math.max(0, cycleProgress.progressPercent))}%` }}
                                    />
                                </div>
                            </div>

                            {/* 4 Metric cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">MÃ ĐÃ KIỂM</span>
                                    <span className="text-lg font-black text-emerald-700 font-mono mt-1 block">
                                        {cycleProgress.countedProductCount} mã
                                    </span>
                                </div>
                                <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200">
                                    <span className="text-[10px] text-amber-800 uppercase font-bold block">MÃ CẦN KIỂM TIẾP</span>
                                    <span className="text-lg font-black text-amber-700 font-mono mt-1 block">
                                        {cycleProgress.uncountedProductCount} mã
                                    </span>
                                </div>
                                <div className="p-3.5 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle">
                                    <span className="text-[10px] text-lys-teal-strong uppercase font-bold block">GỢI Ý HÔM NAY</span>
                                    <span className="text-lg font-black text-lys-teal-strong font-mono mt-1 block">
                                        ~{cycleProgress.dailySuggestedCount} mã / ngày
                                    </span>
                                </div>
                                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold block">TỔNG TỒN HIỆN CÓ</span>
                                    <span className="text-lg font-black text-slate-900 font-mono mt-1 block">
                                        {cycleProgress.totalBottles.toLocaleString()} chai
                                    </span>
                                </div>
                            </div>

                            {/* Sub-tabs & Search for SKU inventory list */}
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setActiveCycleTab('UNCOUNTED')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                                            activeCycleTab === 'UNCOUNTED'
                                                ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Chưa kiểm ({cycleProgress.uncountedProducts.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveCycleTab('COUNTED')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                                            activeCycleTab === 'COUNTED'
                                                ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        Đã kiểm ({cycleProgress.countedProducts.length})
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="relative w-full sm:w-64">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Tìm mã SKU, tên rượu, vị trí..."
                                            value={cycleSearchTerm}
                                            onChange={e => setCycleSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0E7490] text-slate-900 shadow-2xs"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => loadCycleProgress()}
                                        className="text-slate-500 hover:text-slate-800 p-2 border border-slate-200 rounded-md bg-white hover:bg-slate-50 cursor-pointer"
                                        title="Cập nhật tiến độ"
                                    >
                                        <RefreshCw size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* SKU Items List */}
                            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white shadow-2xs">
                                {filteredCycleProducts.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-slate-400">
                                        {cycleSearchTerm ? 'Không tìm thấy sản phẩm nào khớp với tìm kiếm.' : 'Không có sản phẩm nào trong danh mục này.'}
                                    </div>
                                ) : (
                                    filteredCycleProducts.map((p: any) => (
                                        <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 transition">
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                                                <span className="font-mono font-bold text-slate-900 shrink-0 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                    {p.skuCode}
                                                </span>
                                                <span className="truncate font-semibold text-slate-800">{p.productName}</span>
                                                {p.vintage && <span className="text-[10px] text-slate-500 font-mono shrink-0">({p.vintage})</span>}
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0 text-slate-500 text-xs">
                                                <span className="hidden sm:inline truncate max-w-[180px] text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                                    {p.locations && p.locations.length > 0 ? p.locations.join(', ') : 'Chưa gán vị trí'}
                                                </span>
                                                {activeCycleTab === 'COUNTED' && (
                                                    <span className="text-emerald-700 font-bold shrink-0 text-[11px]">
                                                        Đã kiểm: {p.lastCountedAt ? new Date(p.lastCountedAt).toLocaleDateString('vi-VN') : ''}
                                                    </span>
                                                )}
                                                <strong className="font-mono text-slate-900 shrink-0 min-w-[70px] text-right">
                                                    {(p.totalQty ?? 0).toLocaleString()} chai
                                                </strong>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* ═══ BÁO CÁO CÁC ĐỢT KIỂM KÊ & CHÊNH LỆCH TRONG KỲ ═══ */}
                            <div className="pt-4 border-t border-slate-200 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <FileText size={16} className="text-lys-teal-strong" />
                                            <span>Báo Cáo Các Đợt Kiểm Kê & Chênh Lệch Trong Kỳ</span>
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Tổng hợp kết quả các đợt kiểm kê cuốn chiếu, tỷ lệ chênh lệch thực tế so với sổ sách và xuất biên bản đối soát A4.
                                        </p>
                                    </div>

                                    {/* Stats summary badges */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 font-semibold">
                                            Tổng: <strong>{cycleProgress.recentSessions?.length || 0}</strong> đợt
                                        </span>
                                        {cycleProgress.recentSessions && cycleProgress.recentSessions.filter(s => s.hasVariance).length > 0 && (
                                            <span className="text-xs bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                {cycleProgress.recentSessions.filter(s => s.hasVariance).length} đợt có lệch
                                            </span>
                                        )}
                                        {cycleProgress.recentSessions && cycleProgress.recentSessions.filter(s => !s.hasVariance && s.status !== 'DRAFT').length > 0 && (
                                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                                                <CheckCircle2 size={12} />
                                                {cycleProgress.recentSessions.filter(s => !s.hasVariance && s.status !== 'DRAFT').length} đợt khớp 100%
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Table of recent sessions */}
                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                                <th className="p-2.5 pl-3">SỐ PHIẾU / TIÊU ĐỀ</th>
                                                <th className="p-2.5 whitespace-nowrap">NGÀY THỰC HIỆN</th>
                                                <th className="p-2.5 text-center whitespace-nowrap">SỐ MÃ SKU</th>
                                                <th className="p-2.5 text-center whitespace-nowrap">TRẠNG THÁI</th>
                                                <th className="p-2.5 text-center whitespace-nowrap">CHÊNH LỆCH TỒN</th>
                                                <th className="p-2.5 pr-3 text-right whitespace-nowrap">BÁO CÁO & ĐỐI SOÁT</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-800">
                                            {!cycleProgress.recentSessions || cycleProgress.recentSessions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                                        Chưa có đợt kiểm kê nào được tạo trong khoảng thời gian này.
                                                    </td>
                                                </tr>
                                            ) : (
                                                cycleProgress.recentSessions.map(s => {
                                                    return (
                                                        <tr key={s.id} className="hover:bg-slate-50/80 transition">
                                                            <td className="p-2.5 pl-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenDetail(s.id)}
                                                                    className="font-mono font-bold text-lys-teal-strong hover:underline block text-left"
                                                                >
                                                                    {s.sessionNo}
                                                                </button>
                                                                <span className="text-[11px] text-slate-600 truncate max-w-xs block font-medium">
                                                                    {s.title}
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 whitespace-nowrap text-slate-600 font-medium">
                                                                {new Date(s.createdAt).toLocaleDateString('vi-VN')}
                                                            </td>
                                                            <td className="p-2.5 text-center whitespace-nowrap font-mono font-bold text-slate-800">
                                                                {s.lineCount} mã
                                                            </td>
                                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                                    s.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                                                    s.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                                    'bg-slate-100 text-slate-700 border border-slate-200'
                                                                }`}>
                                                                    {s.status === 'APPROVED' ? 'Đã duyệt' :
                                                                     s.status === 'COMPLETED' ? 'Đã hoàn tất' :
                                                                     s.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Nháp'}
                                                                </span>
                                                            </td>
                                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                                {s.status === 'DRAFT' ? (
                                                                    <span className="text-slate-400 text-[11px]">Chưa đếm</span>
                                                                ) : s.hasVariance ? (
                                                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                                                        <AlertTriangle size={11} />
                                                                        Lệch {s.totalVariance} chai
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                                        <CheckCircle2 size={11} />
                                                                        Khớp 100% (0 chai)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-2.5 pr-3 text-right whitespace-nowrap">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenPrintView(s.id)}
                                                                        className="px-2.5 py-1.5 bg-[#0891B2] hover:bg-[#0E7490] text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition active:scale-95"
                                                                        title="Xem biên bản đối soát và chênh lệch kiểm kê"
                                                                    >
                                                                        <FileText size={12} />
                                                                        <span>Báo Cáo Chênh Lệch</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenDetail(s.id)}
                                                                        className="px-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] cursor-pointer"
                                                                        title="Xem chi tiết phiên kiểm"
                                                                    >
                                                                        Chi tiết
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
                        </div>
                    ) : null}
                </div>
            )}

            {/* ═══ TAB 1: DANH SÁCH PHIẾU KIỂM KÊ (CHỈ HIỂN THỊ KHI CHỌN TAB NÀY) ═══ */}
            {viewMode === 'SESSIONS' && (
                <>
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
                                                    Tạo bởi: {row.createdByName || 'Hệ thống'}
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
                                                        {row.scopeType === 'FULL_WAREHOUSE' ? 'Toàn bộ kho' :
                                                         row.scopeType === 'CYCLE_COUNT' ? 'Cuốn chiếu' :
                                                         row.scopeType === 'TRANSACTED_ITEMS' ? 'Mã phát sinh' : 'Đột xuất'}
                                                    </span>
                                                    {row.isBlindCount && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center shrink-0">
                                                            Giấu sổ
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
                                                        className="px-2 py-1 bg-cyan-50 hover:bg-cyan-100 text-[#0891B2] border border-[#0891B2]/30 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                                                        title="Xem báo cáo chênh lệch & In biên bản đối soát A4"
                                                    >
                                                        <FileText className="w-3 h-3 text-[#0891B2]" /> Báo Cáo
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
                                    <span className="font-semibold text-slate-700">Tạo bởi: {row.createdByName}</span>
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
                                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Zap className="w-4 h-4" /> Bắt đầu kiểm kê
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                    onClick={() => setTableModalSessionId(row.id)}
                                    className="py-2.5 bg-[#0891B2] hover:bg-[#0E7490] text-white font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Bảng kiểm kê
                                </button>
                                <button
                                    onClick={() => handleOpenMobileView(row.id)}
                                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Smartphone className="w-3.5 h-3.5" /> Đếm di động
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
                                    <FileText className="w-3.5 h-3.5 text-lys-teal-strong" /> Báo Cáo A4
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            </>
            )}

            {/* Create Extended Session Modal — 2-Step Wizard */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 text-slate-900 shadow-2xl overflow-y-auto max-h-[92vh]">
                        {createWizardStep === 1 ? (
                            /* ═══════════ BƯỚC 1: CHỌN HÌNH THỨC KIỂM KÊ ═══════════ */
                            <div className="space-y-4">
                                <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0891B2]/15 text-[#0E7490] border border-[#0891B2]/30">
                                                BƯỚC 1 / 2
                                            </span>
                                            <h2 className="text-base font-extrabold text-slate-900">Chọn Hình Thức Kiểm Kê</h2>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Hệ thống sẽ tối ưu hóa danh mục quét và biểu mẫu phù hợp với nhu cầu kiểm đếm của kho
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                                    {/* Card 1: Toàn bộ */}
                                    <div
                                        onClick={() => handleSelectCategory('FULL')}
                                        className="group relative p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer shadow-2xs hover:shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                                                    Toàn diện 100%
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#0E7490] transition">
                                                Kiểm Kê Toàn Bộ Kho
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                Kiểm đếm 100% SKU và toàn bộ vị trí kệ. Thích hợp cho chốt kỳ kế toán tháng, quý hoặc kiểm toán cuối năm.
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0E7490]">
                                            <span className="text-[11px] text-slate-400 font-normal">Quét tất cả mã & vị trí</span>
                                            <span className="flex items-center gap-1">Chọn hình thức này <ArrowRight className="w-3.5 h-3.5" /></span>
                                        </div>
                                    </div>

                                    {/* Card 2: 1 Phần / Khu vực */}
                                    <div
                                        onClick={() => handleSelectCategory('PARTIAL')}
                                        className="group relative p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer shadow-2xs hover:shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wide">
                                                    Theo Phân Vùng
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#0E7490] transition">
                                                Kiểm Kê 1 Phần / Khu Vực
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                Giới hạn theo phân khu (Zone A, B...), tủ mát rượu hoặc loại vang cụ thể. Các khu vực khác trong kho tiếp tục xuất nhập bình thường.
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0E7490]">
                                            <span className="text-[11px] text-slate-400 font-normal">Tùy chọn Zone / Kệ</span>
                                            <span className="flex items-center gap-1">Chọn hình thức này <ArrowRight className="w-3.5 h-3.5" /></span>
                                        </div>
                                    </div>

                                    {/* Card 3: Ngẫu nhiên / Đột xuất */}
                                    <div
                                        onClick={() => handleSelectCategory('RANDOM')}
                                        className="group relative p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer shadow-2xs hover:shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                                                    <Shuffle className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wide">
                                                    Giám Sát Rủi Ro
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#0E7490] transition">
                                                Kiểm Kê Ngẫu Nhiên / Đột Xuất
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                Hệ thống bốc ngẫu nhiên 5-20 mã từ kho hoặc kiểm tra tức thì các mã SKU nghi vấn lệch tồn, hàng đắt tiền.
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0E7490]">
                                            <span className="text-[11px] text-slate-400 font-normal">Bốc mẫu / Nhập mã</span>
                                            <span className="flex items-center gap-1">Chọn hình thức này <ArrowRight className="w-3.5 h-3.5" /></span>
                                        </div>
                                    </div>

                                    {/* Card 4: Cuốn chiếu */}
                                    <div
                                        onClick={() => handleSelectCategory('CYCLE')}
                                        className="group relative p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer shadow-2xs hover:shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-200 text-[#0891B2] flex items-center justify-center">
                                                    <RefreshCw className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 uppercase tracking-wide">
                                                    Chu Kỳ Xoay Vòng
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 group-hover:text-[#0E7490] transition">
                                                Kiểm Kê Cuốn Chiếu Hàng Ngày
                                            </h4>
                                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                Đếm đều đặn ~15 mã mỗi ngày xoay vòng theo chu kỳ 7/14/30 ngày. Ưu tiên hàng tồn lớn trước mà không làm gián đoạn bán hàng.
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0E7490]">
                                            <span className="text-[11px] text-slate-400 font-normal">Chia nhỏ theo tuần</span>
                                            <span className="flex items-center gap-1">Chọn hình thức này <ArrowRight className="w-3.5 h-3.5" /></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ═══════════ BƯỚC 2: CẤU HÌNH BIỂU MẪU CHUYÊN BIỆT ═══════════ */
                            <div className="space-y-4">
                                <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setCreateWizardStep(1)}
                                            className="text-xs text-[#0891B2] hover:text-[#0E7490] font-bold flex items-center gap-1 cursor-pointer mb-1 transition"
                                        >
                                            <ArrowLeft size={14} /> Quay lại chọn hình thức khác
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0891B2]/15 text-[#0E7490] border border-[#0891B2]/30">
                                                BƯỚC 2 / 2
                                            </span>
                                            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                                {countCategory === 'FULL' && (
                                                    <>
                                                        <span>Kiểm kê toàn bộ kho</span>
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">Toàn diện 100%</span>
                                                    </>
                                                )}
                                                {countCategory === 'PARTIAL' && (
                                                    <>
                                                        <span>Kiểm kê một phần / Phân khu</span>
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">Theo phân vùng</span>
                                                    </>
                                                )}
                                                {countCategory === 'RANDOM' && (
                                                    <>
                                                        <span>Kiểm kê ngẫu nhiên / Đột xuất</span>
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">Giám sát rủi ro</span>
                                                    </>
                                                )}
                                                {countCategory === 'CYCLE' && (
                                                    <>
                                                        <span>Kiểm kê cuốn chiếu hàng ngày</span>
                                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">Chu kỳ tuần</span>
                                                    </>
                                                )}
                                            </h2>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateModal(false)}
                                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {createError && (
                                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                        {createError}
                                    </div>
                                )}

                                <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                                    {/* Kho hàng */}
                                    <div>
                                        <label className="text-slate-700 font-bold block mb-1">Kho Hàng Kiểm Kê:*</label>
                                        <select
                                            value={formWarehouseId}
                                            onChange={e => handleWarehouseChange(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20"
                                            required
                                        >
                                            {warehouses.map(w => (
                                                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Tiêu đề */}
                                    <div>
                                        <label className="text-slate-700 font-bold block mb-1">Tên / Mục Đích Phiếu Kiểm Kê:*</label>
                                        <input
                                            type="text"
                                            placeholder="vd: Kiểm kê toàn bộ hầm rượu, Kiểm kê đột xuất tủ vang..."
                                            value={formTitle}
                                            onChange={e => setFormTitle(e.target.value)}
                                            className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20"
                                            required
                                        />
                                    </div>

                                    {/* Cấu hình đặc thù: FULL */}
                                    {countCategory === 'FULL' && (
                                        <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-lg flex items-start gap-2.5 text-emerald-950">
                                            <Layers className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                                            <div>
                                                <h5 className="font-bold text-xs text-emerald-900">Phạm Vi Toàn Kho (100% SKU)</h5>
                                                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                                                    Hệ thống sẽ tự động quét và nạp toàn bộ danh mục sản phẩm cùng các vị trí lưu kho đang có tồn tại kho hàng này để đưa vào biên bản kiểm đếm.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cấu hình đặc thù: PARTIAL */}
                                    {countCategory === 'PARTIAL' && (
                                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-slate-700 font-bold block mb-1">Lọc theo Vị trí (Zone / Kệ):*</label>
                                                    <select
                                                        value={formSelectedZone}
                                                        onChange={e => setFormSelectedZone(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs focus:outline-none focus:border-[#0E7490]"
                                                    >
                                                        <option value="">-- Tất cả vị trí trong kho --</option>
                                                        {Array.from(new Set(locationOptions.map(l => l.zone))).map(z => (
                                                            <option key={z} value={z}>{z}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-slate-700 font-bold block mb-1">Lọc theo Loại Vang (Tùy chọn):</label>
                                                    <select
                                                        value={formWineType}
                                                        onChange={e => setFormWineType(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs focus:outline-none focus:border-[#0E7490]"
                                                    >
                                                        <option value="">-- Tất cả loại vang --</option>
                                                        <option value="RED">Vang đỏ (Red Wine)</option>
                                                        <option value="WHITE">Vang trắng (White Wine)</option>
                                                        <option value="SPARKLING">Champagne & Sủi bọt</option>
                                                        <option value="ROSE">Vang hồng (Rosé)</option>
                                                        <option value="FORTIFIED">Fortified / Dessert Wine</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-500 italic">
                                                ℹ️ Chỉ kiểm kê các kệ hoặc phân loại được chọn, các khu vực khác không bị khóa dữ liệu.
                                            </p>
                                        </div>
                                    )}

                                    {/* Cấu hình đặc thù: RANDOM */}
                                    {countCategory === 'RANDOM' && (
                                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setRandomCountMode('RANDOM_SAMPLE')
                                                        handleFetchSampleSkus(formWarehouseId, sampleCountSize)
                                                    }}
                                                    className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                                                        randomCountMode === 'RANDOM_SAMPLE'
                                                            ? 'bg-[#0891B2] text-white shadow-2xs'
                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <Shuffle size={13} /> Bốc Ngẫu Nhiên Hệ Thống
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setRandomCountMode('MANUAL_SKUS')}
                                                    className={`px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                                                        randomCountMode === 'MANUAL_SKUS'
                                                            ? 'bg-[#0891B2] text-white shadow-2xs'
                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    Nhập mã SKU cần kiểm tra
                                                </button>
                                            </div>

                                            {randomCountMode === 'RANDOM_SAMPLE' ? (
                                                <div className="space-y-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-slate-600 font-bold">Số lượng mã:</span>
                                                            {[5, 10, 15, 20].map(sz => (
                                                                <button
                                                                    type="button"
                                                                    key={sz}
                                                                    onClick={() => {
                                                                        setSampleCountSize(sz)
                                                                        handleFetchSampleSkus(formWarehouseId, sz)
                                                                        const targetWh = warehouses.find(w => w.id === formWarehouseId)
                                                                        setFormTitle(`Kiểm kê ngẫu nhiên (${sz} mã) - ${targetWh?.name || 'Kho'}`)
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                                                                        sampleCountSize === sz
                                                                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                                                                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    {sz} mã
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleFetchSampleSkus(formWarehouseId, sampleCountSize)}
                                                            disabled={loadingSample}
                                                            className="px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-bold flex items-center gap-1 cursor-pointer transition"
                                                        >
                                                            <RotateCcw size={12} className={loadingSample ? 'animate-spin' : ''} />
                                                            Bốc bộ mã khác
                                                        </button>
                                                    </div>

                                                    {/* Preview list */}
                                                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                                                        <div className="p-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-[11px] font-bold text-slate-700">
                                                            <span>Danh sách {previewSampleSkus.length} mã SKU được bốc ngẫu nhiên:</span>
                                                            <span className="text-slate-500 font-normal">Có thể loại bỏ mã nếu muốn</span>
                                                        </div>
                                                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                            {loadingSample ? (
                                                                <div className="p-4 text-center text-slate-400">Đang bốc ngẫu nhiên từ kho...</div>
                                                            ) : previewSampleSkus.length === 0 ? (
                                                                <div className="p-4 text-center text-slate-400">Kho hàng chưa có dữ liệu tồn để bốc mẫu.</div>
                                                            ) : (
                                                                previewSampleSkus.map(s => (
                                                                    <div key={s.id} className="p-2 px-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                                                                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                                                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 shrink-0">
                                                                                {s.skuCode}
                                                                            </span>
                                                                            <span className="truncate font-semibold text-slate-800">{s.productName}</span>
                                                                            {s.vintage && <span className="text-[10px] text-slate-500 font-mono shrink-0">({s.vintage})</span>}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            <span className="font-mono text-slate-700 text-xs font-bold">{s.totalQty} chai</span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setPreviewSampleSkus(prev => prev.filter(x => x.id !== s.id))}
                                                                                className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                                                                                title="Loại bỏ mã này"
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <label className="text-slate-700 font-bold block mb-1">Nhập danh sách mã SKU cần kiểm tra đột xuất:*</label>
                                                    <textarea
                                                        rows={3}
                                                        placeholder="vd: L10001, L10007, CH-MARG-2015 (cách nhau bởi dấu phẩy hoặc xuống dòng)..."
                                                        value={formSpotSkus}
                                                        onChange={e => setFormSpotSkus(e.target.value)}
                                                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-[#0E7490]"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Cấu hình đặc thù: CYCLE */}
                                    {countCategory === 'CYCLE' && (
                                        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                                            {/* Progress & Cycle Summary */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pb-2 border-b border-slate-200">
                                                <div>
                                                    <span className="font-bold text-slate-800">
                                                        Kho: <strong className="text-slate-900">{cycleProgress?.warehouseName || '...'}</strong> ({cycleProgress?.daysWindow || cycleDaysWindow} ngày)
                                                    </span>
                                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                                        Đã kiểm: <span className="font-mono font-bold text-emerald-700">{cycleProgress?.countedProductCount || 0}</span> / {cycleProgress?.totalProducts || 0} mã · Còn lại: <span className="font-mono font-bold text-amber-700">{cycleProgress?.uncountedProductCount || 0}</span> mã
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 text-[11px] font-mono">
                                                        Đã kiểm {cycleProgress?.progressPercent || 0}%
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                        selectedDailySkus.length > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        Đã chọn: {selectedDailySkus.length} mã
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Quick Selection Presets */}
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-slate-700 block">
                                                    Chọn nhanh mã theo gợi ý hoặc số lượng:
                                                </label>
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (cycleProgress && cycleProgress.uncountedProducts.length > 0) {
                                                                const topN = cycleProgress.uncountedProducts.slice(0, cycleProgress.dailySuggestedCount).map(p => p.skuCode)
                                                                setSelectedDailySkus(topN)
                                                                setFormTitle(`Kiểm kê cuốn chiếu hôm nay (${topN.length} mã) - ${cycleProgress.warehouseName}`)
                                                            }
                                                        }}
                                                        className="px-2.5 py-1 bg-lys-teal-strong hover:bg-lys-teal-hover text-white rounded font-bold text-[11px] cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                                                    >
                                                        <Zap size={12} /> Đề xuất ~{cycleProgress?.dailySuggestedCount || 15} mã hôm nay
                                                    </button>
                                                    {[5, 10, 20].map(cnt => (
                                                        <button
                                                            type="button"
                                                            key={cnt}
                                                            onClick={() => {
                                                                if (cycleProgress && cycleProgress.uncountedProducts.length > 0) {
                                                                    const topN = cycleProgress.uncountedProducts.slice(0, cnt).map(p => p.skuCode)
                                                                    setSelectedDailySkus(topN)
                                                                    setFormTitle(`Kiểm kê cuốn chiếu (${topN.length} mã) - ${cycleProgress.warehouseName}`)
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold text-[11px] cursor-pointer"
                                                        >
                                                            Top {cnt} tồn cao
                                                        </button>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (cycleProgress && cycleProgress.uncountedProducts.length > 0) {
                                                                const all = cycleProgress.uncountedProducts.map(p => p.skuCode)
                                                                setSelectedDailySkus(all)
                                                                setFormTitle(`Kiểm kê cuốn chiếu tất cả (${all.length} mã) - ${cycleProgress.warehouseName}`)
                                                            }
                                                        }}
                                                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded font-semibold text-[11px] cursor-pointer"
                                                    >
                                                        Chọn tất cả ({cycleProgress?.uncountedProducts.length || 0})
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedDailySkus([])
                                                        }}
                                                        className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded font-semibold text-[11px] cursor-pointer"
                                                    >
                                                        Bỏ chọn hết
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Search SKU in uncounted list */}
                                            <div className="space-y-1.5 pt-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <label className="font-bold text-slate-700">
                                                        Danh sách mã SKU chưa kiểm (Click để chọn / bỏ chọn từng mã):*
                                                    </label>
                                                    <span className="text-[11px] text-slate-500 font-mono">
                                                        {filteredWizardCycleProducts.length} mã hiển thị
                                                    </span>
                                                </div>

                                                <div className="relative">
                                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm mã SKU, tên rượu vang, vị trí kệ..."
                                                        value={wizardCycleSearchTerm}
                                                        onChange={e => setWizardCycleSearchTerm(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-lys-teal-strong shadow-2xs"
                                                    />
                                                </div>

                                                {/* Checklist of uncounted SKUs */}
                                                <div className="border border-slate-200 rounded-md max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white">
                                                    {filteredWizardCycleProducts.length === 0 ? (
                                                        <div className="p-4 text-center text-slate-400 text-xs">
                                                            {wizardCycleSearchTerm ? 'Không tìm thấy mã SKU nào khớp với tìm kiếm.' : 'Tất cả các mã trong kho đã được kiểm kê!'}
                                                        </div>
                                                    ) : (
                                                        filteredWizardCycleProducts.map(p => {
                                                            const isSelected = selectedDailySkus.includes(p.skuCode)
                                                            return (
                                                                <label
                                                                    key={p.id}
                                                                    className={`p-2 flex items-center justify-between gap-3 text-xs cursor-pointer transition select-none ${
                                                                        isSelected ? 'bg-lys-teal-soft/50 font-semibold' : 'hover:bg-slate-50'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isSelected}
                                                                            onChange={() => {
                                                                                if (isSelected) {
                                                                                    const next = selectedDailySkus.filter(s => s !== p.skuCode)
                                                                                    setSelectedDailySkus(next)
                                                                                    setFormTitle(`Kiểm kê cuốn chiếu (${next.length} mã) - ${cycleProgress?.warehouseName || ''}`)
                                                                                } else {
                                                                                    const next = [...selectedDailySkus, p.skuCode]
                                                                                    setSelectedDailySkus(next)
                                                                                    setFormTitle(`Kiểm kê cuốn chiếu (${next.length} mã) - ${cycleProgress?.warehouseName || ''}`)
                                                                                }
                                                                            }}
                                                                            className="w-4 h-4 rounded text-teal-600 focus:ring-0 bg-white border-slate-300"
                                                                        />
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="font-mono font-bold text-lys-teal-strong shrink-0 bg-white px-1.5 py-0.5 rounded border border-lys-teal-subtle text-[11px]">
                                                                                    {p.skuCode}
                                                                                </span>
                                                                                <span className="truncate text-slate-900">{p.productName}</span>
                                                                                {p.vintage && <span className="text-[10px] text-slate-500 font-mono shrink-0">({p.vintage})</span>}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                                                                {p.locations && p.locations.length > 0 ? p.locations.join(', ') : 'Chưa gán vị trí'}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="text-right shrink-0">
                                                                        <strong className="font-mono text-slate-900 text-xs">{(p.totalQty ?? 0).toLocaleString()} chai</strong>
                                                                    </div>
                                                                </label>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Phân công & Tùy chọn */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="text-slate-700 font-bold block mb-1">Phân Công Nhân Viên:</label>
                                            <select
                                                value={formAssignedToId}
                                                onChange={e => setFormAssignedToId(e.target.value)}
                                                className="w-full bg-white border border-slate-200 text-slate-900 rounded-lg p-2.5 text-xs outline-none focus:border-[#0E7490]"
                                            >
                                                <option value="">-- Để tự do (Ai đếm cũng được) --</option>
                                                {staffList.map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200 self-end">
                                            <input
                                                type="checkbox"
                                                id="blindToggle"
                                                checked={formIsBlind}
                                                onChange={e => setFormIsBlind(e.target.checked)}
                                                className="w-4 h-4 rounded text-teal-600 focus:ring-0 bg-white border-slate-300 cursor-pointer"
                                            />
                                            <label htmlFor="blindToggle" className="cursor-pointer">
                                                <span className="font-bold text-slate-900 block text-xs">Kiểm Kê Mù (Blind Count)</span>
                                                <span className="text-[10px] text-slate-500 block">Ẩn số tồn sổ sách trên máy người đếm</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Submit Buttons */}
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setCreateWizardStep(1)}
                                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg border border-slate-200 text-xs cursor-pointer flex items-center gap-1"
                                        >
                                            <ArrowLeft size={13} /> Chọn lại hình thức
                                        </button>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowCreateModal(false)}
                                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-lg text-xs cursor-pointer"
                                            >
                                                Hủy
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting || (countCategory === 'CYCLE' && selectedDailySkus.length === 0)}
                                                className="px-5 py-2 bg-[#0891B2] hover:bg-[#0E7490] text-white font-extrabold rounded-lg shadow-xs text-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                <Zap size={14} />
                                                {isSubmitting
                                                    ? 'Đang khởi tạo...'
                                                    : countCategory === 'CYCLE' && selectedDailySkus.length > 0
                                                        ? `Tạo Phiếu Đếm (${selectedDailySkus.length} mã)`
                                                        : 'Tạo Phiếu & Bắt Đầu Kiểm Kê'}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}
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
                            <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
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
                                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
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
