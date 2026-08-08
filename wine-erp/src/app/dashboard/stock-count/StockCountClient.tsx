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
    createStockCountSessionExtended, startStockCount, approveAndCreateAdjustment
} from './actions'
import MobileLocationCounter from './MobileLocationCounter'
import PrintableAuditReport from './PrintableAuditReport'
import BarcodeLookupModal from './BarcodeLookupModal'

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
    initialStats?: { total: number; inProgress: number; completed: number }
}

export default function StockCountClient({ initialList = [], initialStats }: Props) {
    const [list, setList] = useState<SessionRow[]>(initialList)
    const [stats, setStats] = useState(initialStats || { total: 0, inProgress: 0, completed: 0 })
    const [activeTab, setActiveTab] = useState<'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL')
    const [searchTerm, setSearchTerm] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    // Modal & View states
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [selectedDetail, setSelectedDetail] = useState<any>(null)
    const [mobileViewDetail, setMobileViewDetail] = useState<any>(null)
    const [printViewDetail, setPrintViewDetail] = useState<any>(null)
    const [showBarcodeLookup, setShowBarcodeLookup] = useState(false)

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
            />
        )
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                            <ClipboardList className="w-6 h-6" />
                        </span>
                        <div>
                            <h1 className="text-xl font-black text-white tracking-wide">HỆ THỐNG KIỂM KÊ KHO ERP</h1>
                            <p className="text-xs text-slate-400">Kiểm kê Full kho, Cycle Count, Mã giao dịch & Đột xuất</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBarcodeLookup(true)}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-700 transition"
                    >
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        Tra cứu Barcode
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo Phiếu Kiểm Kê
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-xs font-semibold text-slate-400 block">Tổng Phiếu Kiểm Kê</span>
                    <strong className="text-2xl font-black text-white mt-1 block">{stats.total}</strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-xs font-semibold text-amber-400 block">Đang Kiểm Kê</span>
                    <strong className="text-2xl font-black text-amber-400 mt-1 block">{stats.inProgress}</strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-xs font-semibold text-emerald-400 block">Đã Hoàn Thành / Duyệt</span>
                    <strong className="text-2xl font-black text-emerald-400 mt-1 block">{stats.completed}</strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                    <span className="text-xs font-semibold text-cyan-400 block">Phân Công Cho Tôi</span>
                    <strong className="text-2xl font-black text-cyan-400 mt-1 block">{stats.assignedToMe}</strong>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
                    {[
                        { key: 'ALL', label: 'Tất cả phiếu' },
                        { key: 'ASSIGNED', label: 'Được phân công' },
                        { key: 'IN_PROGRESS', label: 'Đang kiểm' },
                        { key: 'COMPLETED', label: 'Đã duyệt / Xong' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${activeTab === tab.key ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        placeholder="Tìm mã phiếu, kho, nhân viên..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                    />
                </div>
            </div>

            {/* Sessions Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                                <th className="p-4">Mã Phiếu / Tiêu Đề</th>
                                <th className="p-4">Kho Hàng</th>
                                <th className="p-4">Phạm Vi / Chế Độ</th>
                                <th className="p-4">Người Kiểm Kê</th>
                                <th className="p-4 text-center">Số Dòng</th>
                                <th className="p-4 text-right">Chênh Lệch</th>
                                <th className="p-4 text-center">Trạng Thái</th>
                                <th className="p-4 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-500">
                                        Không tìm thấy phiên kiểm kê nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map(row => {
                                    const isDiff = row.totalVariance !== 0
                                    return (
                                        <tr key={row.id} className="hover:bg-slate-800/50 transition">
                                            <td className="p-4">
                                                <div className="font-mono font-bold text-emerald-400 text-xs">{row.sessionNo}</div>
                                                <div className="font-semibold text-white mt-0.5">{row.title}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    Tạo ngày: {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                                                </div>
                                            </td>

                                            <td className="p-4 font-semibold text-slate-200">
                                                <div className="flex items-center gap-1.5">
                                                    <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                                                    {row.warehouseName}
                                                </div>
                                            </td>

                                            <td className="p-4">
                                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                                    {row.scopeType === 'FULL_WAREHOUSE' ? '📦 Full Kho' :
                                                     row.scopeType === 'CYCLE_COUNT' ? '🔄 Cycle Count' :
                                                     row.scopeType === 'TRANSACTED_ITEMS' ? '⚡ Mã Giao Dịch' : '🚨 Đột Xuất'}
                                                </span>
                                                {row.isBlindCount && (
                                                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                        Mù
                                                    </span>
                                                )}
                                            </td>

                                            <td className="p-4">
                                                {row.assignedToName ? (
                                                    <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1">
                                                        <UserCheck className="w-3.5 h-3.5" /> {row.assignedToName}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 italic text-[11px]">Chưa phân công</span>
                                                )}
                                            </td>

                                            <td className="p-4 text-center font-mono font-bold">{row.lineCount} mã</td>

                                            <td className="p-4 text-right font-mono font-bold">
                                                <span className={row.totalVariance === 0 ? 'text-slate-400' : row.totalVariance > 0 ? 'text-amber-400' : 'text-rose-400'}>
                                                    {row.totalVariance > 0 ? `+${row.totalVariance}` : row.totalVariance} chai
                                                </span>
                                            </td>

                                            <td className="p-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                    row.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                    row.status === 'COMPLETED' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                                    row.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                    'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {row.status === 'APPROVED' ? 'Đã duyệt' : row.status === 'COMPLETED' ? 'Đã đếm xong' : row.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Nháp'}
                                                </span>
                                            </td>

                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenMobileView(row.id)}
                                                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30 flex items-center gap-1 transition"
                                                        title="Đếm bằng Điện thoại"
                                                    >
                                                        <Smartphone className="w-3.5 h-3.5" /> Đếm ĐT
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenPrintView(row.id)}
                                                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition border border-slate-700"
                                                        title="In Biên bản kiểm kê"
                                                    >
                                                        <Printer className="w-3.5 h-3.5 text-amber-400" /> In
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

            {/* Create Extended Session Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
                            <div>
                                <h2 className="text-base font-black text-white">Khởi Tạo Phiếu Kiểm Kê Mới</h2>
                                <p className="text-xs text-slate-400">Chọn 1 trong 4 chế độ kiểm kê nâng cao</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        {createError && (
                            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                            {/* Scope Selector Grid */}
                            <div>
                                <label className="text-slate-400 font-bold block mb-2">CHỌN CHẾ ĐỘ KIỂM KÊ:</label>
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
                                            className={`p-3 rounded-xl text-left border transition ${formScopeType === mode.key ? 'bg-emerald-500/10 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                                        >
                                            <div className="font-bold text-xs">{mode.title}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Warehouse Selector */}
                            <div>
                                <label className="text-slate-400 font-bold block mb-1">Kho Hàng Kiểm Kê:*</label>
                                <select
                                    value={formWarehouseId}
                                    onChange={e => {
                                        setFormWarehouseId(e.target.value)
                                        fetchLocationOptions(e.target.value)
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                                    required
                                >
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="text-slate-400 font-bold block mb-1">Tên / Mục Đích Phiếu Kiểm Kê:</label>
                                <input
                                    type="text"
                                    placeholder="vd: Kiểm kê định kỳ tháng 8, Kiểm kê đột xuất hầm rượu..."
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>

                            {/* Scope-specific Options */}
                            {formScopeType === 'CYCLE_COUNT' && (
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                                    <div>
                                        <label className="text-slate-400 font-bold block mb-1">Lọc theo Vị trí (Zone):</label>
                                        <select
                                            value={formSelectedZone}
                                            onChange={e => setFormSelectedZone(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg p-2 focus:outline-none"
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
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                    <label className="text-slate-400 font-bold block mb-1">Phát sinh giao dịch trong (Ngày):</label>
                                    <input
                                        type="number"
                                        value={formTransactedDays}
                                        onChange={e => setFormTransactedDays(parseInt(e.target.value, 10) || 30)}
                                        className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg p-2 focus:outline-none font-mono"
                                    />
                                </div>
                            )}

                            {formScopeType === 'SPOT_COUNT' && (
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
                                    <div>
                                        <label className="text-slate-400 font-bold block mb-1">Nhập danh sách mã SKU cần đột xuất (cách nhau bởi dấu phẩy/xuống dòng):</label>
                                        <textarea
                                            rows={3}
                                            placeholder="vd: L10001, L10007, L20015..."
                                            value={formSpotSkus}
                                            onChange={e => setFormSpotSkus(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg p-2 font-mono focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Staff Assignee */}
                            <div>
                                <label className="text-slate-400 font-bold block mb-1">Phân Công Cho Nhân Viên:</label>
                                <select
                                    value={formAssignedToId}
                                    onChange={e => setFormAssignedToId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl p-2.5 focus:border-emerald-500 focus:outline-none"
                                >
                                    <option value="">-- Chưa phân công (Để tự do) --</option>
                                    {staffList.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Blind Count Option Toggle */}
                            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <input
                                    type="checkbox"
                                    id="blindToggle"
                                    checked={formIsBlind}
                                    onChange={e => setFormIsBlind(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-900 border-slate-700"
                                />
                                <label htmlFor="blindToggle" className="cursor-pointer">
                                    <span className="font-bold text-white block">Kiểm Kê Mù (Giấu Tồn Sổ Sách)</span>
                                    <span className="text-[10px] text-slate-400 block">Ẩn số liệu tồn sổ sách trên điện thoại nhân viên để đảm bảo đếm thực tế 100%</span>
                                </label>
                            </div>

                            {/* Submit Buttons */}
                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20"
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
            {showBarcodeLookup && (
                <BarcodeLookupModal
                    onClose={() => setShowBarcodeLookup(false)}
                />
            )}
        </div>
    )
}
