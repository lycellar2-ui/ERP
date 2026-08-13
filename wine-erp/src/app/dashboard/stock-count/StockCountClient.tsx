'use client'

import React, { useState, useEffect } from 'react'
import {
    ClipboardList, Plus, Search, Filter, Warehouse, MapPin, Smartphone,
    Printer, CheckCircle2, ShieldCheck, QrCode, AlertCircle, Eye, EyeOff,
    UserCheck, RefreshCw, Layers, Zap, AlertTriangle, FileText
} from 'lucide-react'
import {
    getStockCountList, getStockCountDetail, getCountStats,
    getWarehouseOptions, getWarehouseLocationOptions, getStaffUserOptions,
    createStockCountSessionExtended, startStockCount, approveAndCreateAdjustment,
    assignStaffToZones
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

    // Load initial dropdown options
    useEffect(() => {
        loadOptions()
        fetchData()
    }, [])

    const loadOptions = async () => {
        const [whRes, staffRes] = await Promise.all([
            getWarehouseOptions(),
            getStaffUserOptions()
        ])
        setWarehouses(whRes)
        setStaffList(staffRes)
        if (whRes.length > 0) {
            setFormWarehouseId(whRes[0].id)
            fetchLocationOptions(whRes[0].id)
        }
    }

    const fetchLocationOptions = async (whId: string) => {
        const locs = await getWarehouseLocationOptions(whId)
        setLocationOptions(locs)
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
        const productIds: string[] = []
        if (formScopeType === 'SPOT_COUNT' && formSpotSkus.trim()) {
            const skus = formSpotSkus.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
            // We pass skus to backend via API
        }

        const res = await createStockCountSessionExtended({
            warehouseId: formWarehouseId,
            title: formTitle || undefined,
            scopeType: formScopeType,
            isBlindCount: formIsBlind,
            assignedToId: formAssignedToId || undefined,
            selectedZone: formSelectedZone || undefined,
            selectedWineType: formWineType || undefined,
            transactedDays: Number(formTransactedDays) || 30
        })

        setIsSubmitting(false)
        if (res.success) {
            setShowCreateModal(false)
            fetchData()
            if (res.sessionId) handleOpenMobileView(res.sessionId)
        } else {
            setCreateError(res.error || 'Khởi tạo phiên kiểm kê thất bại')
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
        <div className="w-full space-y-3 sm:space-y-6">
            {/* DESKTOP HEADER BANNER (Hidden on Mobile) */}
            <div className="hidden md:flex flex-row items-center justify-between gap-4 bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
                <div className="flex items-center gap-3">
                    <span className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl">
                        <ClipboardList className="w-6 h-6" />
                    </span>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">HỆ THỐNG KIỂM KÊ KHO ERP</h1>
                        <p className="text-xs text-slate-500">Kiểm kê Full kho, Cycle Count, Mã giao dịch & Đột xuất</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBarcodeLookup(true)}
                        className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-200 shadow-2xs transition cursor-pointer"
                    >
                        <QrCode className="w-4 h-4 text-emerald-600" />
                        Tra cứu Barcode
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-2.5 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo Phiếu Kiểm Kê
                    </button>
                </div>
            </div>

            {/* MOBILE COMPACT ACTION BAR (< 768px) */}
            <div className="flex md:hidden items-center justify-between gap-2 bg-white border border-slate-200 p-2.5 rounded-xl shadow-2xs">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                    <ClipboardList className="w-4 h-4 text-emerald-600 shrink-0" /> KIỂM KÊ KHO
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={() => setShowBarcodeLookup(true)}
                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200 flex items-center gap-1 active:scale-95"
                    >
                        <QrCode className="w-3.5 h-3.5 text-emerald-600" /> Barcode
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-1.5 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-black text-[11px] rounded-lg flex items-center gap-1 active:scale-95 shadow-2xs"
                    >
                        <Plus className="w-3.5 h-3.5" /> + Phiếu Mới
                    </button>
                </div>
            </div>

            {/* DESKTOP KPI CARDS (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-4 gap-2.5">
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide block">TỔNG PHIẾU</span>
                        <strong className="text-lg font-black text-slate-900 leading-tight mt-0.5 block">{stats.total}</strong>
                    </div>
                    <ClipboardList className="w-5 h-5 text-slate-400 shrink-0" />
                </div>
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wide block">ĐANG KIỂM KÊ</span>
                        <strong className="text-lg font-black text-amber-600 leading-tight mt-0.5 block">{stats.inProgress}</strong>
                    </div>
                    <RefreshCw className="w-5 h-5 text-amber-500 shrink-0" />
                </div>
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wide block">ĐÃ DUYỆT / XONG</span>
                        <strong className="text-lg font-black text-emerald-600 leading-tight mt-0.5 block">{stats.completed}</strong>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
                <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-extrabold text-cyan-700 uppercase tracking-wide block">PHÂN CÔNG CHO TÔI</span>
                        <strong className="text-lg font-black text-cyan-700 leading-tight mt-0.5 block">{stats.assignedToMe}</strong>
                    </div>
                    <UserCheck className="w-5 h-5 text-cyan-600 shrink-0" />
                </div>
            </div>

            {/* MOBILE 1-ROW COMPACT STAT STRIP (< 768px) */}
            <div className="grid md:hidden grid-cols-4 gap-1.5 bg-slate-100 border border-slate-200/80 p-1.5 rounded-xl">
                <div className="text-center bg-white py-1 px-1 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-slate-500 uppercase block leading-none">Tất Cả</span>
                    <strong className="text-xs font-black text-slate-900 leading-none mt-0.5 block">{stats.total}</strong>
                </div>
                <div className="text-center bg-white py-1 px-1 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-amber-600 uppercase block leading-none">Đang Kiểm</span>
                    <strong className="text-xs font-black text-amber-600 leading-none mt-0.5 block">{stats.inProgress}</strong>
                </div>
                <div className="text-center bg-white py-1 px-1 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block leading-none">Đã Xong</span>
                    <strong className="text-xs font-black text-emerald-600 leading-none mt-0.5 block">{stats.completed}</strong>
                </div>
                <div className="text-center bg-white py-1 px-1 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-cyan-700 uppercase block leading-none">Gán Tôi</span>
                    <strong className="text-xs font-black text-cyan-700 leading-none mt-0.5 block">{stats.assignedToMe}</strong>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto no-scrollbar">
                    {[
                        { key: 'ALL', label: `Tất cả (${stats.total})` },
                        { key: 'ASSIGNED', label: `Phân công (${stats.assignedToMe})` },
                        { key: 'IN_PROGRESS', label: `Đang kiểm (${stats.inProgress})` },
                        { key: 'COMPLETED', label: `Đã xong (${stats.completed})` },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition cursor-pointer ${activeTab === tab.key ? 'bg-[#87CBB9] text-[#0A1926] font-extrabold shadow-2xs border border-[#76BAA8]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-bold'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Tìm mã phiếu, kho, nhân viên..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl pl-9 pr-3 py-1.5 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20 shadow-2xs"
                    />
                </div>
            </div>

            {/* Sessions Table — Desktop View (>= 768px) */}
            <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px] text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                                <th className="p-4 min-w-[280px]">Mã Phiếu / Tiêu Đề</th>
                                <th className="p-4 whitespace-nowrap min-w-[160px]">Kho Hàng</th>
                                <th className="p-4 whitespace-nowrap min-w-[150px]">Phạm Vi / Chế Độ</th>
                                <th className="p-4 whitespace-nowrap min-w-[140px]">Người Kiểm Kê</th>
                                <th className="p-4 text-center whitespace-nowrap">Số Dòng</th>
                                <th className="p-4 text-right whitespace-nowrap">Chênh Lệch</th>
                                <th className="p-4 text-center whitespace-nowrap">Trạng Thái</th>
                                <th className="p-4 text-right whitespace-nowrap min-w-[240px]">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        Không tìm thấy phiên kiểm kê nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(row => {
                                    return (
                                        <tr key={row.id} className="hover:bg-amber-50/40 transition">
                                            <td className="p-4 min-w-[280px]">
                                                <div className="font-mono font-extrabold text-emerald-800 text-xs whitespace-nowrap tracking-tight">{row.sessionNo}</div>
                                                <div className="font-bold text-slate-900 mt-0.5 text-xs leading-snug line-clamp-2">{row.title}</div>
                                                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 whitespace-nowrap">
                                                    <span>Tạo ngày: {new Date(row.createdAt).toLocaleDateString('vi-VN')}</span>
                                                    <span>•</span>
                                                    <span className="font-semibold text-slate-700">👤 Tạo bởi: {row.createdByName}</span>
                                                </div>
                                            </td>

                                            <td className="p-4 font-bold text-slate-900">
                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                    <Warehouse className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                    {row.warehouseName}
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap inline-flex items-center shrink-0">
                                                        {row.scopeType === 'FULL_WAREHOUSE' ? '📦 Full Kho' :
                                                         row.scopeType === 'CYCLE_COUNT' ? '🔄 Cycle Count' :
                                                         row.scopeType === 'TRANSACTED_ITEMS' ? '⚡ Mã Giao Dịch' : '🚨 Đột Xuất'}
                                                    </span>
                                                    {row.isBlindCount && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap inline-flex items-center shrink-0">
                                                            Mù
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                {row.assignedToName ? (
                                                    <span className="text-xs font-bold text-cyan-700 flex items-center gap-1 whitespace-nowrap">
                                                        <UserCheck className="w-3.5 h-3.5 shrink-0" /> {row.assignedToName}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[11px] whitespace-nowrap">Chưa phân công</span>
                                                )}
                                            </td>

                                            <td className="p-4 text-center font-mono font-bold text-slate-800 whitespace-nowrap">{row.lineCount} mã</td>

                                            <td className="p-4 text-right font-mono font-bold whitespace-nowrap">
                                                <span className={row.totalVariance === 0 ? 'text-slate-500' : row.totalVariance > 0 ? 'text-amber-700' : 'text-rose-600'}>
                                                    {row.totalVariance > 0 ? `+${row.totalVariance}` : row.totalVariance} chai
                                                </span>
                                            </td>

                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase whitespace-nowrap inline-flex items-center shrink-0 ${
                                                    row.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                                    row.status === 'COMPLETED' ? 'bg-cyan-50 text-cyan-800 border border-cyan-200' :
                                                    row.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'COMPLETED' ? 'Đã đếm xong' : row.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Nháp'}
                                                </span>
                                            </td>

                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {row.status === 'DRAFT' && (
                                                        <button
                                                            onClick={() => handleStartSession(row.id)}
                                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
                                                            title="Kích hoạt bắt đầu kiểm kê"
                                                        >
                                                            <Zap className="w-3.5 h-3.5" /> Bắt Đầu Kiểm Kê
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => setTableModalSessionId(row.id)}
                                                        className="px-2.5 py-1.5 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] rounded-lg text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                                        title="Mở Bảng điền trực tiếp & Lọc vị trí"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" /> Bảng Điền
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenAssignModal(row.id)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                                                        title="Phân công vị trí kiểm kê"
                                                    >
                                                        <UserCheck className="w-3.5 h-3.5 text-cyan-600" /> Phân công
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenMobileView(row.id)}
                                                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                                                        title="Đếm bằng Điện thoại"
                                                    >
                                                        <Smartphone className="w-3.5 h-3.5" /> Đếm ĐT
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenPrintView(row.id)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 transition border border-slate-200 cursor-pointer"
                                                        title="In Biên bản kiểm kê"
                                                    >
                                                        <Printer className="w-3.5 h-3.5 text-amber-600" /> In
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
                    <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl text-xs font-bold">
                        Không tìm thấy phiên kiểm kê nào.
                    </div>
                ) : (
                    filteredList.map(row => (
                        <div key={row.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
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
                                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Zap className="w-4 h-4" /> ⚡ Bắt Đầu Kiểm Kê Ngay
                                </button>
                            )}

                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <button
                                    onClick={() => setTableModalSessionId(row.id)}
                                    className="py-2.5 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-black rounded-xl text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <FileText className="w-3.5 h-3.5" /> Bảng Điền
                                </button>
                                <button
                                    onClick={() => handleOpenMobileView(row.id)}
                                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1 border border-emerald-200 shadow-2xs cursor-pointer active:scale-95"
                                >
                                    <Smartphone className="w-3.5 h-3.5" /> Đếm ĐT
                                </button>
                                <button
                                    onClick={() => handleOpenAssignModal(row.id)}
                                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1 border border-slate-200 shadow-2xs cursor-pointer"
                                >
                                    <UserCheck className="w-3.5 h-3.5 text-cyan-600" /> Phân công
                                </button>
                                <button
                                    onClick={() => handleOpenPrintView(row.id)}
                                    className="py-2 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl text-[11px] flex items-center justify-center gap-1 border border-slate-200 shadow-2xs cursor-pointer"
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
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 text-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                            <div>
                                <h2 className="text-base font-extrabold text-slate-900">Khởi Tạo Phiếu Kiểm Kê Mới</h2>
                                <p className="text-xs text-slate-500">Chọn 1 trong 4 chế độ kiểm kê nâng cao</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">✕</button>
                        </div>

                        {createError && (
                            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
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
                                            className={`p-3 rounded-xl text-left border transition cursor-pointer ${formScopeType === mode.key ? 'bg-teal-50 border-2 border-teal-500 text-teal-900 font-bold shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}
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
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20"
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
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20"
                                />
                            </div>

                            {/* Scope-specific Options */}
                            {formScopeType === 'CYCLE_COUNT' && (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
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
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
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
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
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
                                    className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20"
                                >
                                    <option value="">-- Chưa phân công (Để tự do) --</option>
                                    {staffList.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Blind Count Option Toggle */}
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
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
                                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 rounded-xl cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-extrabold rounded-xl shadow-xs cursor-pointer"
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
                    <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
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
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                                    Phiếu này không chia theo khu vực cụ thể.
                                </div>
                            ) : (
                                Object.keys(zoneAssignments).map(zoneName => {
                                    const totalInZone = assignSessionDetail.lines.filter((l: any) => (l.zone || l.locationCode || 'Khu vực chung') === zoneName).length

                                    return (
                                        <div key={zoneName} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
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
                                                    className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2 text-xs outline-none focus:border-cyan-500 font-semibold cursor-pointer"
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
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveZoneAssignments}
                                disabled={isSavingAssignments}
                                className="px-5 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-extrabold rounded-xl shadow-xs cursor-pointer"
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
                    onRefreshSession={fetchData}
                />
            )}
        </div>
    )
}

export default StockCountClient
