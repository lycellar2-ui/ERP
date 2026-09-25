'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Package, Handshake, TrendingUp, CheckCircle2, Plus, Eye, X, Wine,
    ChevronRight, FileText, AlertCircle, MapPin, AlertTriangle, Printer,
    ArrowRightLeft, ShoppingCart, Warehouse as WarehouseIcon, Building2,
    Calendar, RefreshCw, Send, Check, DollarSign, Search
} from 'lucide-react'
import { toast } from 'sonner'
import PrintableConsignmentCount, { ConsignmentCountHeader } from './PrintableConsignmentCount'
import PrintableConsignmentDispatch, { ConsignmentDispatchData } from './PrintableConsignmentDispatch'
import type {
    ConsignmentRow, ConsignmentStockRow, ConsignmentReportRow, ConsignedStockMapRow,
    ReplenishmentAlert, PhysicalCountSession, PhysicalCountItem, ConsignmentWarehouseRow
} from './actions'
import {
    getConsignmentAgreements, getConsignmentStats, createConsignmentAgreement,
    getConsignmentStocks, addConsignmentStock, getConsignmentReports,
    createConsignmentReport, confirmConsignmentReport,
    getCustomerOptionsForCSG, getProductOptionsForCSG,
    getConsignedStockMap, getReplenishmentAlerts,
    createPhysicalCount, confirmPhysicalCount,
    getConsignmentWarehouses, createConsignmentWarehouse,
    getInternalWarehouses, getWarehouseStockForTransfer,
    createConsignmentTransfer, getConsignmentInventoryForCount,
    getConsignmentTransferPrintData, getConsignmentTransfers,
    sellFromConsignmentWarehouse
} from './actions'

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Đang Hoạt Động', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    EXPIRED: { label: 'Hết Hạn', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    TERMINATED: { label: 'Đã Kết Thúc', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    RECEIVED: { label: 'Đã Nhận Hàng', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    IN_TRANSIT: { label: 'Đang Vận Chuyển', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    CONFIRMED: { label: 'Đã Duyệt Xuất', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    DRAFT: { label: 'Bản Nháp', color: '#475569', bg: 'rgba(138,174,187,0.15)' },
}

const FREQ_LABEL: Record<string, string> = {
    WEEKLY: 'Hàng Tuần', MONTHLY: 'Hàng Tháng', QUARTERLY: 'Hàng Quý', AS_NEEDED: 'Khi Cần',
}

export function ConsignmentClient({ initialRows, stats: initialStats }: { initialRows?: ConsignmentRow[]; stats?: any } = {}) {
    const [mainTab, setMainTab] = useState<'warehouses' | 'transfers' | 'sales' | 'stockCount' | 'agreements' | 'stockMap'>('warehouses')

    // Data States
    const [warehouses, setWarehouses] = useState<ConsignmentWarehouseRow[]>([])
    const [transfers, setTransfers] = useState<any[]>([])
    const [agreements, setAgreements] = useState<ConsignmentRow[]>(initialRows || [])
    const [stats, setStats] = useState(initialStats || { total: 0, active: 0, totalStockSent: 0, totalSold: 0 })
    const [stockMap, setStockMap] = useState<ConsignedStockMapRow[]>([])
    const [alerts, setAlerts] = useState<ReplenishmentAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modals
    const [createWHOpen, setCreateWHOpen] = useState(false)
    const [createTransferOpen, setCreateTransferOpen] = useState(false)
    const [createSaleOpen, setCreateSaleOpen] = useState(false)
    const [createAgreementOpen, setCreateAgreementOpen] = useState(false)
    const [selectedAgreement, setSelectedAgreement] = useState<ConsignmentRow | null>(null)
    const [preselectedWarehouseId, setPreselectedWarehouseId] = useState<string>('')

    // Print Data Modals
    const [printCountData, setPrintCountData] = useState<ConsignmentCountHeader | null>(null)
    const [printDispatchData, setPrintDispatchData] = useState<ConsignmentDispatchData | null>(null)

    // Load initial data
    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [whList, trfList, agList, st] = await Promise.all([
                getConsignmentWarehouses(),
                getConsignmentTransfers(),
                getConsignmentAgreements(),
                getConsignmentStats(),
            ])
            setWarehouses(whList)
            setTransfers(trfList)
            setAgreements(agList)
            setStats(st)
        } catch (err: any) {
            toast.error('Lỗi tải dữ liệu ký gửi: ' + err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    const loadStockMapData = async () => {
        try {
            const [map, repAlerts] = await Promise.all([getConsignedStockMap(), getReplenishmentAlerts()])
            setStockMap(map)
            setAlerts(repAlerts)
        } catch (err: any) {
            console.error(err)
        }
    }

    // Trigger Print Consignment Count Sheet
    const handleOpenPrintCount = async (warehouseId: string) => {
        toast.loading('Đang chuẩn bị biên bản kiểm kê...', { id: 'count-sheet' })
        const res = await getConsignmentInventoryForCount(warehouseId)
        toast.dismiss('count-sheet')
        if (!res.success || !res.data) {
            toast.error(res.error || 'Không thể lấy dữ liệu kiểm kê')
            return
        }
        setPrintCountData(res.data)
    }

    // Trigger Print Consignment Dispatch Voucher
    const handleOpenPrintDispatch = async (transferNoOrId: string) => {
        toast.loading('Đang chuẩn bị phiếu xuất kho...', { id: 'dispatch-sheet' })
        const res = await getConsignmentTransferPrintData(transferNoOrId)
        toast.dismiss('dispatch-sheet')
        if (!res.success || !res.data) {
            toast.error(res.error || 'Không thể lấy dữ liệu phiếu xuất')
            return
        }
        setPrintDispatchData(res.data)
    }

    const totalBottlesInConsignment = warehouses.reduce((sum, w) => sum + w.totalBottles, 0)
    const totalValueInConsignment = warehouses.reduce((sum, w) => sum + w.totalStockValue, 0)

    const statCards = [
        { label: 'Kho Ký Gửi (Khách Hàng)', value: warehouses.length, icon: Building2, accent: '#87CBB9' },
        { label: 'Tổng Chai Đang Ký Gửi', value: totalBottlesInConsignment.toLocaleString('vi-VN'), icon: Package, accent: '#D4A853' },
        { label: 'Giá Trị Hàng Ký Gửi (Vốn)', value: totalValueInConsignment.toLocaleString('vi-VN') + ' ₫', icon: DollarSign, accent: '#5BA88A' },
        { label: 'Đã Bán Tiêu Thụ', value: stats.totalSold.toLocaleString('vi-VN') + ' chai', icon: TrendingUp, accent: '#87CBB9' },
    ]

    const filteredWarehouses = warehouses.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                        Quản Lý Hàng Ký Gửi (Consignment Inventory)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#475569' }}>
                        Kho ký gửi theo từng khách hàng, xuất kho không hóa đơn, xuất bán trừ tồn, in biên bản kiểm kê A4
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setCreateWHOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                        style={{ background: '#0891B2', color: '#FFFFFF' }}
                    >
                        <Plus size={15} /> Tạo Kho Ký Gửi Khách Hàng
                    </button>
                    <button
                        onClick={() => { setPreselectedWarehouseId(''); setCreateTransferOpen(true); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                        style={{ background: '#D97706', color: '#FFFFFF' }}
                    >
                        <ArrowRightLeft size={15} /> Xuất Hàng Ký Gửi
                    </button>
                    <button
                        onClick={() => { setPreselectedWarehouseId(''); setCreateSaleOpen(true); }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                        style={{ background: '#5BA88A', color: '#0F172A' }}
                    >
                        <ShoppingCart size={15} /> Xuất Bán Từ Kho Ký Gửi
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map(c => {
                    const Icon = c.icon
                    return (
                        <div key={c.label} className="p-4 rounded-xl shadow-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} style={{ color: c.accent }} />
                                <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#475569' }}>{c.label}</span>
                            </div>
                            <p className="text-xl font-bold font-mono" style={{ color: c.accent }}>{c.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex flex-wrap gap-1 border-b" style={{ borderColor: '#E2E8F0' }}>
                <button
                    onClick={() => setMainTab('warehouses')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'warehouses' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'warehouses' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <WarehouseIcon size={14} /> Kho Ký Gửi Khách Hàng ({warehouses.length})
                </button>

                <button
                    onClick={() => setMainTab('transfers')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'transfers' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'transfers' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <ArrowRightLeft size={14} /> Lịch Sử Xuất Kho Ký Gửi ({transfers.length})
                </button>

                <button
                    onClick={() => setMainTab('sales')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'sales' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'sales' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <ShoppingCart size={14} /> Xuất Bán Từ Kho Ký Gửi
                </button>

                <button
                    onClick={() => setMainTab('stockCount')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'stockCount' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'stockCount' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <Printer size={14} /> Kiểm Kê Kho Ký Gửi (In A4)
                </button>

                <button
                    onClick={() => setMainTab('agreements')}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'agreements' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'agreements' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <Handshake size={14} /> Hợp Đồng ({agreements.length})
                </button>

                <button
                    onClick={() => { setMainTab('stockMap'); loadStockMapData(); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                        color: mainTab === 'stockMap' ? '#87CBB9' : '#475569',
                        borderBottom: mainTab === 'stockMap' ? '2px solid #87CBB9' : '2px solid transparent'
                    }}
                >
                    <MapPin size={14} /> Bản Đồ Tồn Ký Gửi
                </button>
            </div>

            {/* TAB 1: KHO KÝ GỬI (CUSTOMER CONSIGNMENT WAREHOUSES) */}
            {mainTab === 'warehouses' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Tìm kho, khách hàng, mã..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                            />
                        </div>
                        <div className="text-xs text-slate-400">
                            Hiển thị <span className="font-bold text-white">{filteredWarehouses.length}</span> kho ký gửi
                        </div>
                    </div>

                    <div className="rounded-xl overflow-hidden shadow-xs" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {['Mã Kho', 'Tên Kho Ký Gửi', 'Khách Hàng (HORECA/Đại Lý)', 'Số SKU', 'Tồn Kho (Chai)', 'Giá Trị Tồn', 'Thao Tác'].map(h => (
                                        <th key={h} className="px-3.5 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-sm text-slate-400">Đang tải danh sách kho ký gửi...</td></tr>
                                ) : filteredWarehouses.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-16 text-sm text-slate-400">
                                            Chưa có kho ký gửi nào. Nhấn "Tạo Kho Ký Gửi Khách Hàng" ở góc trên để tạo mới.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWarehouses.map(wh => (
                                        <tr key={wh.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }} className="hover:bg-slate-800/20">
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                                {wh.code}
                                            </td>
                                            <td className="px-3.5 py-3 text-xs font-semibold" style={{ color: '#0F172A' }}>
                                                <div>{wh.name}</div>
                                                {wh.address && <div className="text-[11px] text-slate-400 mt-0.5">{wh.address}</div>}
                                            </td>
                                            <td className="px-3.5 py-3 text-xs" style={{ color: '#0F172A' }}>
                                                <div className="font-semibold">{wh.customerName}</div>
                                                <div className="text-[11px] text-slate-400">Mã KH: {wh.customerCode} {wh.customerPhone ? `| SĐT: ${wh.customerPhone}` : ''}</div>
                                            </td>
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#D4A853' }}>
                                                {wh.skuCount} SKU
                                            </td>
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: wh.totalBottles > 0 ? '#5BA88A' : '#475569' }}>
                                                {wh.totalBottles.toLocaleString('vi-VN')} chai
                                            </td>
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                                {wh.totalStockValue.toLocaleString('vi-VN')} ₫
                                            </td>
                                            <td className="px-3.5 py-3 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateTransferOpen(true); }}
                                                        title="Xuất hàng sang kho này"
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition"
                                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#D4A853' }}
                                                    >
                                                        <ArrowRightLeft size={12} /> Xuất Hàng
                                                    </button>
                                                    <button
                                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateSaleOpen(true); }}
                                                        title="Bán hàng từ kho ký gửi này"
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition"
                                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#5BA88A' }}
                                                    >
                                                        <ShoppingCart size={12} /> Xuất Bán
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenPrintCount(wh.id)}
                                                        title="In Biên bản kiểm kê kho ký gửi (A4)"
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition"
                                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0891B2' }}
                                                    >
                                                        <Printer size={12} /> In Kiểm Kê
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 2: XUẤT HÀNG KÝ GỬI (TRANSFER ORDERS) */}
            {mainTab === 'transfers' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-400">
                            Các đợt chuyển hàng từ kho tổng sang kho ký gửi khách hàng (chuyển kho nội bộ không xuất hóa đơn).
                        </p>
                        <button
                            onClick={() => { setPreselectedWarehouseId(''); setCreateTransferOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition"
                            style={{ background: '#D97706', color: '#FFFFFF' }}
                        >
                            <Plus size={14} /> Lập Phiếu Xuất Hàng Ký Gửi
                        </button>
                    </div>

                    <div className="rounded-xl overflow-hidden shadow-xs" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {['Số Lệnh', 'Loại Lệnh', 'Kho Xuất', 'Kho Nhận Ký Gửi', 'Khách Hàng', 'Tổng Chai', 'Ngày Xuất', 'Trạng Thái', 'In Phiếu'].map(h => (
                                        <th key={h} className="px-3.5 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {transfers.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-12 text-sm text-slate-400">Chưa có giao dịch chuyển kho ký gửi nào.</td></tr>
                                ) : transfers.map(trf => {
                                    const st = STATUS_MAP[trf.status] ?? STATUS_MAP.RECEIVED
                                    return (
                                        <tr key={trf.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                                {trf.transferNo}
                                            </td>
                                            <td className="px-3.5 py-3 text-xs font-bold">
                                                <span className={`text-[11px] px-2 py-0.5 rounded ${trf.type === 'XUẤT_KÝ_GỬI' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                    {trf.type === 'XUẤT_KÝ_GỬI' ? 'Xuất Ký Gửi' : 'Thu Hồi'}
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-3 text-xs" style={{ color: '#0F172A' }}>{trf.fromWarehouseName}</td>
                                            <td className="px-3.5 py-3 text-xs font-semibold" style={{ color: '#0F172A' }}>{trf.toWarehouseName}</td>
                                            <td className="px-3.5 py-3 text-xs" style={{ color: '#475569' }}>{trf.customerName}</td>
                                            <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#D4A853' }}>
                                                {trf.totalQty.toLocaleString('vi-VN')} chai ({trf.itemCount} SKU)
                                            </td>
                                            <td className="px-3.5 py-3 text-xs text-slate-400">
                                                {new Date(trf.transferDate).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-3.5 py-3 text-xs">
                                                <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3.5 py-3 text-xs">
                                                <button
                                                    onClick={() => handleOpenPrintDispatch(trf.id)}
                                                    className="px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#D4A853' }}
                                                >
                                                    <Printer size={12} /> In Phiếu A4
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: XUẤT BÁN TỪ KHO KÝ GỬI (SALES) */}
            {mainTab === 'sales' && (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4" style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}>
                        <div>
                            <h3 className="text-base font-bold text-white mb-1">Nghiệp Vụ Xuất Bán Hàng Ký Gửi</h3>
                            <p className="text-xs text-slate-400">
                                Khi khách hàng thông báo số lượng đã tiêu thụ, hệ thống sẽ tự động trừ tồn kho tại Kho Ký Gửi đó, tạo Đơn bán hàng hoàn tất (SO) và phát hành Hóa đơn VAT / Công nợ (AR Invoice).
                            </p>
                        </div>
                        <button
                            onClick={() => { setPreselectedWarehouseId(''); setCreateSaleOpen(true); }}
                            className="px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md"
                            style={{ background: '#5BA88A', color: '#0F172A' }}
                        >
                            <ShoppingCart size={15} /> Tạo Đơn Xuất Bán Mới
                        </button>
                    </div>

                    <div className="rounded-xl p-5 border" style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}>
                        <h4 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">
                            Chọn nhanh kho ký gửi để lập đơn xuất bán:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {warehouses.map(wh => (
                                <div
                                    key={wh.id}
                                    onClick={() => { setPreselectedWarehouseId(wh.id); setCreateSaleOpen(true); }}
                                    className="p-3.5 rounded-lg border hover:border-[#5BA88A] cursor-pointer transition-all bg-white"
                                    style={{ borderColor: '#E2E8F0' }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-sm text-white">{wh.name}</div>
                                        <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold text-emerald-400 bg-emerald-950/40">
                                            {wh.totalBottles} chai
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">Khách hàng: <span className="text-slate-300 font-semibold">{wh.customerName}</span></div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">Mã kho: {wh.code} | {wh.skuCount} mặt hàng</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: KIỂM KÊ KHO KÝ GỬI (STOCK COUNT SHEET) */}
            {mainTab === 'stockCount' && (
                <div className="space-y-4">
                    <div className="p-5 rounded-xl border" style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-white mb-1">In Biên Bản Kiểm Kê Hàng Hóa Ký Gửi (A4)</h3>
                                <p className="text-xs text-slate-400">
                                    Chọn kho ký gửi của khách hàng để in Biên bản kiểm kê chuẩn A4 phục vụ công tác kiểm đếm thực tế và ký kết xác nhận giữa 2 bên. Không can thiệp logic sau khi in.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {warehouses.map(wh => (
                            <div key={wh.id} className="p-4 rounded-xl border bg-white flex flex-col justify-between" style={{ borderColor: '#E2E8F0' }}>
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="font-bold text-sm text-white">{wh.name}</div>
                                        <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-white text-[#0891B2]">
                                            {wh.code}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium">{wh.customerName}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{wh.address || 'Tại cơ sở khách hàng'}</p>

                                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded bg-white">
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-400">Mặt hàng</div>
                                            <div className="text-sm font-bold font-mono text-amber-400">{wh.skuCount} SKU</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-400">Tồn sổ sách</div>
                                            <div className="text-sm font-bold font-mono text-emerald-400">{wh.totalBottles} chai</div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenPrintCount(wh.id)}
                                    className="w-full py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
                                    style={{ background: '#0891B2', color: '#FFFFFF' }}
                                >
                                    <Printer size={14} /> Mở Biên Bản Kiểm Kê (A4)
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: HỢP ĐỒNG KÝ GỬI (AGREEMENTS) */}
            {mainTab === 'agreements' && (
                <div className="rounded-xl overflow-hidden shadow-xs" style={{ border: '1px solid #E2E8F0' }}>
                    <div className="p-3.5 bg-white border-b flex justify-between items-center" style={{ borderColor: '#E2E8F0' }}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Danh sách hợp đồng thỏa thuận ký gửi</span>
                        <button
                            onClick={() => setCreateAgreementOpen(true)}
                            className="px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition"
                            style={{ background: '#0891B2', color: '#FFFFFF' }}
                        >
                            <Plus size={14} /> Thêm Hợp Đồng Ký Gửi
                        </button>
                    </div>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                {['Mã HĐ', 'Khách Hàng', 'Trạng Thái', 'Tần Suất BC', 'SKU Gửi', 'Tổng Chai', 'Thời Hạn', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {agreements.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-16 text-sm text-slate-400">Chưa có hợp đồng ký gửi nào.</td></tr>
                            ) : agreements.map(row => {
                                const st = STATUS_MAP[row.status] ?? STATUS_MAP.ACTIVE
                                return (
                                    <tr
                                        key={row.id}
                                        className="cursor-pointer hover:bg-slate-800/30"
                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onClick={() => setSelectedAgreement(row)}
                                    >
                                        <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                            CSG-{row.id.slice(-6).toUpperCase()}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#0F172A' }}>{row.customerName}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color }}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#475569' }}>
                                            {FREQ_LABEL[row.reportFrequency] ?? row.reportFrequency}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#D4A853' }}>
                                            {row.stockCount}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#0F172A' }}>
                                            {row.totalQty.toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-slate-400">
                                            {new Date(row.startDate).toLocaleDateString('vi-VN')} — {new Date(row.endDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <ChevronRight size={14} style={{ color: '#64748B' }} />
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* TAB 6: BẢN ĐỒ TỒN KHO KÝ GỬI */}
            {mainTab === 'stockMap' && (
                <div className="space-y-4">
                    {alerts.length > 0 && (
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={15} style={{ color: '#D4A853' }} />
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                                    Cảnh báo cần bổ sung hàng ký gửi ({alerts.length} mục)
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {alerts.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg text-xs bg-white border border-slate-700/40">
                                        <div>
                                            <div className="font-semibold text-white">{a.customerName}</div>
                                            <div className="text-[11px] text-[#0891B2] font-mono">{a.skuCode}</div>
                                        </div>
                                        <span className="font-bold font-mono text-rose-400">Còn {a.qtyRemaining} chai</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl overflow-hidden shadow-xs" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {['Điểm Ký Gửi', 'SKU', 'Sản Phẩm', 'Gửi', 'Đã Bán', 'Còn Lại', '% Bán'].map(h => (
                                        <th key={h} className="px-3.5 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#475569' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {stockMap.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-sm text-slate-400">Chưa có dữ liệu phân bổ hàng ký gửi</td></tr>
                                ) : stockMap.map((row, i) => {
                                    const barColor = row.pctSold >= 80 ? '#5BA88A' : row.pctSold >= 50 ? '#D4A853' : '#87CBB9'
                                    const isLow = row.qtyRemaining <= 10
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: isLow ? 'rgba(139,26,46,0.04)' : 'transparent' }}>
                                            <td className="px-3.5 py-2.5 text-xs font-semibold text-white">{row.customerName}</td>
                                            <td className="px-3.5 py-2.5 text-xs font-bold font-mono text-[#0891B2]">{row.skuCode}</td>
                                            <td className="px-3.5 py-2.5 text-xs text-slate-300">{row.productName}</td>
                                            <td className="px-3.5 py-2.5 text-xs font-bold font-mono text-[#D4A853]">{row.qtyConsigned}</td>
                                            <td className="px-3.5 py-2.5 text-xs font-bold font-mono text-[#5BA88A]">{row.qtySold}</td>
                                            <td className="px-3.5 py-2.5 text-xs font-bold font-mono" style={{ color: isLow ? '#F43F5E' : '#0F172A' }}>
                                                {row.qtyRemaining}
                                                {isLow && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded font-sans font-bold bg-rose-950/60 text-rose-300 border border-rose-800/40">Thấp</span>}
                                            </td>
                                            <td className="px-3.5 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(row.pctSold, 100)}%`, background: barColor }} />
                                                    </div>
                                                    <span className="text-xs font-bold font-mono text-slate-300">{row.pctSold.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL: TẠO KHO KÝ GỬI CHO KHÁCH HÀNG */}
            {createWHOpen && (
                <CreateConsignmentWarehouseModal
                    open={createWHOpen}
                    onClose={() => setCreateWHOpen(false)}
                    onSuccess={() => { setCreateWHOpen(false); loadAll(); }}
                />
            )}

            {/* MODAL: XUẤT HÀNG KÝ GỬI (CHUYỂN KHO KHÔNG HÓA ĐƠN) */}
            {createTransferOpen && (
                <CreateConsignmentTransferModal
                    open={createTransferOpen}
                    preselectedWarehouseId={preselectedWarehouseId}
                    warehouses={warehouses}
                    onClose={() => setCreateTransferOpen(false)}
                    onSuccess={(transferNo) => {
                        setCreateTransferOpen(false)
                        loadAll()
                        if (transferNo) handleOpenPrintDispatch(transferNo)
                    }}
                />
            )}

            {/* MODAL: XUẤT BÁN TỪ KHO KÝ GỬI */}
            {createSaleOpen && (
                <CreateConsignmentSaleModal
                    open={createSaleOpen}
                    preselectedWarehouseId={preselectedWarehouseId}
                    warehouses={warehouses}
                    onClose={() => setCreateSaleOpen(false)}
                    onSuccess={() => { setCreateSaleOpen(false); loadAll(); }}
                />
            )}

            {/* MODAL: IN BIÊN BẢN KIỂM KÊ (A4) */}
            {printCountData && (
                <PrintableConsignmentCount
                    data={printCountData}
                    onClose={() => setPrintCountData(null)}
                />
            )}

            {/* MODAL: IN PHIẾU XUẤT KHO KÝ GỬI (A4) */}
            {printDispatchData && (
                <PrintableConsignmentDispatch
                    data={printDispatchData}
                    onClose={() => setPrintDispatchData(null)}
                />
            )}

            {/* MODAL / DRAWER: TẠO HỢP ĐỒNG */}
            <CreateDrawer open={createAgreementOpen} onClose={() => setCreateAgreementOpen(false)} onCreated={loadAll} />
            <DetailDrawer agreement={selectedAgreement} onClose={() => setSelectedAgreement(null)} onRefresh={loadAll} />
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: MODAL TẠO KHO KÝ GỬI
// ═══════════════════════════════════════════════════
function CreateConsignmentWarehouseModal({ open, onClose, onSuccess }: {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}) {
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            getCustomerOptionsForCSG().then(setCustomers)
        }
    }, [open])

    const handleSelectCustomer = (cId: string) => {
        setSelectedCustomerId(cId)
        const c = customers.find(item => item.id === cId)
        if (c) {
            setName(`Kho Ký Gửi - ${c.name}`)
        }
    }

    const handleSubmit = async () => {
        if (!selectedCustomerId) {
            toast.error('Vui lòng chọn khách hàng')
            return
        }
        setLoading(true)
        try {
            const res = await createConsignmentWarehouse({
                customerId: selectedCustomerId,
                name: name.trim() || undefined,
                address: address.trim() || undefined,
            })
            if (!res.success) {
                toast.error(res.error || 'Lỗi tạo kho')
            } else {
                toast.success('Đã tạo thành công kho ký gửi cho khách hàng!')
                onSuccess()
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#0891B2]" />
                        <h3 className="text-base font-bold text-white">Tạo Kho Ký Gửi Khách Hàng Mới</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Khách Hàng Ký Gửi (HORECA / Đại Lý) *</label>
                        <select
                            value={selectedCustomerId}
                            onChange={e => handleSelectCustomer(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        >
                            <option value="">-- Chọn khách hàng --</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.code} — {c.name} {c.customerType ? `(${c.customerType})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Tên Kho Ký Gửi</label>
                        <input
                            type="text"
                            placeholder="VD: Kho Ký Gửi - Nhà Hàng Pincho"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">Mã kho sẽ tự động sinh: WH-CSG-[Mã KH]</p>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Địa Chỉ Kho Ký Gửi (Điểm đặt hàng)</label>
                        <input
                            type="text"
                            placeholder="Địa chỉ giao nhận tại cơ sở của khách..."
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-400 space-y-1">
                        <div>✓ Hệ thống sẽ tự động cấu hình thuộc tính <b>type = CONSIGNMENT</b>.</div>
                        <div>✓ Tự động sinh Location mặc định <b>CSG-DEFAULT</b> để tiếp nhận các đợt chuyển kho.</div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-slate-900 cursor-pointer transition shadow-md"
                            style={{ background: '#87CBB9' }}
                        >
                            {loading ? 'Đang tạo...' : 'Tạo Kho Ký Gửi'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: MODAL XUẤT HÀNG KÝ GỬI (TRANSFER)
// ═══════════════════════════════════════════════════
function CreateConsignmentTransferModal({
    open, preselectedWarehouseId, warehouses, onClose, onSuccess
}: {
    open: boolean
    preselectedWarehouseId?: string
    warehouses: ConsignmentWarehouseRow[]
    onClose: () => void
    onSuccess: (transferNo?: string) => void
}) {
    const [internalWarehouses, setInternalWarehouses] = useState<{ id: string; code: string; name: string }[]>([])
    const [fromWarehouseId, setFromWarehouseId] = useState('')
    const [toWarehouseId, setToWarehouseId] = useState(preselectedWarehouseId || '')
    const [availableStock, setAvailableStock] = useState<any[]>([])
    const [notes, setNotes] = useState('Xuất hàng gửi bán đại lý / ký gửi (chuyển kho không xuất hóa đơn)')
    const [loading, setLoading] = useState(false)

    // Lines to transfer
    const [lines, setLines] = useState<{ productId: string; qtyTransferred: number; vintage?: number | null }[]>([])

    useEffect(() => {
        if (open) {
            getInternalWarehouses().then(whs => {
                setInternalWarehouses(whs)
                if (whs.length > 0) setFromWarehouseId(whs[0].id)
            })
            if (preselectedWarehouseId) setToWarehouseId(preselectedWarehouseId)
            else if (warehouses.length > 0) setToWarehouseId(warehouses[0].id)
        }
    }, [open, preselectedWarehouseId, warehouses])

    // Load available stock when source warehouse changes
    useEffect(() => {
        if (fromWarehouseId) {
            getWarehouseStockForTransfer(fromWarehouseId).then(setAvailableStock)
            setLines([])
        }
    }, [fromWarehouseId])

    const handleAddLine = (productId: string, vintage: number | null) => {
        const existingIdx = lines.findIndex(l => l.productId === productId && (l.vintage ?? null) === (vintage ?? null))
        if (existingIdx >= 0) return
        setLines(prev => [...prev, { productId, qtyTransferred: 6, vintage }])
    }

    const handleRemoveLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx))
    }

    const handleQtyChange = (idx: number, qty: number) => {
        setLines(prev => {
            const next = [...prev]
            next[idx].qtyTransferred = Math.max(1, qty)
            return next
        })
    }

    const handleSubmit = async () => {
        if (!fromWarehouseId || !toWarehouseId) {
            toast.error('Vui lòng chọn Kho xuất và Kho nhận ký gửi')
            return
        }
        if (lines.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 sản phẩm để xuất kho')
            return
        }

        setLoading(true)
        try {
            const res = await createConsignmentTransfer({
                fromWarehouseId,
                toWarehouseId,
                notes,
                lines,
                instantReceive: true, // Auto received into consignment warehouse
            })
            if (!res.success) {
                toast.error(res.error || 'Lỗi xuất hàng ký gửi')
            } else {
                toast.success(`Đã xuất hàng ký gửi thành công! Mã lệnh: ${res.transferNo}`)
                onSuccess(res.transferNo)
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl bg-slate-50 border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-[#D4A853]" />
                        <h3 className="text-base font-bold text-white">Xuất Hàng Ký Gửi (Chuyển Kho Không Hóa Đơn)</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-semibold mb-1 text-slate-300">Kho Xuất (Kho Nội Bộ) *</label>
                            <select
                                value={fromWarehouseId}
                                onChange={e => setFromWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                            >
                                {internalWarehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block font-semibold mb-1 text-slate-300">Kho Nhận (Kho Ký Gửi Khách Hàng) *</label>
                            <select
                                value={toWarehouseId}
                                onChange={e => setToWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                            >
                                {warehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name} ({wh.customerName})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Ghi Chú Lệnh Điều Động</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    {/* Danh Sách Mặt Hàng */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-bold text-slate-200">Danh Sách Mặt Hàng Xuất Kho Ký Gửi</label>
                            <span className="text-slate-400">Đã chọn: {lines.length} mặt hàng</span>
                        </div>

                        {lines.length === 0 ? (
                            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-slate-400">
                                Chưa chọn sản phẩm nào. Hãy chọn từ danh mục bên dưới.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {lines.map((line, idx) => {
                                    const prod = availableStock.find(s => s.productId === line.productId && (s.vintage ?? null) === (line.vintage ?? null))
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-semibold text-white truncate">{prod?.productName || line.productId}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    SKU: <span className="font-mono text-[#0891B2]">{prod?.skuCode}</span> | Niên vụ: {line.vintage || 'NV'} | Sẵn có: {prod?.qtyAvailable || 0} chai
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={prod?.qtyAvailable || 9999}
                                                    value={line.qtyTransferred}
                                                    onChange={e => handleQtyChange(idx, Number(e.target.value))}
                                                    className="w-20 px-2 py-1 text-center font-bold font-mono rounded bg-white border border-slate-200 text-slate-900"
                                                />
                                                <button
                                                    onClick={() => handleRemoveLine(idx)}
                                                    className="p-1 hover:bg-rose-950 text-rose-400 rounded cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Bảng chọn sản phẩm từ kho nguồn */}
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">
                            Bấm để thêm rượu vang từ Kho xuất ({availableStock.length} SKU còn hàng):
                        </label>
                        <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg bg-white border border-slate-200">
                            {availableStock.map(item => (
                                <button
                                    key={item.productId + (item.vintage || '')}
                                    type="button"
                                    onClick={() => handleAddLine(item.productId, item.vintage)}
                                    className="p-2 rounded bg-white hover:bg-slate-800 text-left border border-slate-700/50 cursor-pointer flex justify-between items-center"
                                >
                                    <div className="truncate pr-1">
                                        <div className="font-medium text-white truncate">{item.productName}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{item.skuCode} {item.vintage ? `(${item.vintage})` : ''}</div>
                                    </div>
                                    <span className="text-[11px] font-bold font-mono text-emerald-400 whitespace-nowrap">
                                        {item.qtyAvailable} chai
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-slate-900 cursor-pointer transition shadow-md"
                            style={{ background: '#D4A853' }}
                        >
                            {loading ? 'Đang xuất kho...' : 'Xác Nhận Xuất Kho Ký Gửi'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: MODAL XUẤT BÁN TỪ KHO KÝ GỬI (SALES)
// ═══════════════════════════════════════════════════
function CreateConsignmentSaleModal({
    open, preselectedWarehouseId, warehouses, onClose, onSuccess
}: {
    open: boolean
    preselectedWarehouseId?: string
    warehouses: ConsignmentWarehouseRow[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [warehouseId, setWarehouseId] = useState(preselectedWarehouseId || '')
    const [stockItems, setStockItems] = useState<any[]>([])
    const [saleItems, setSaleItems] = useState<{ productId: string; qty: number; vintage?: number | null; unitPrice: number }[]>([])
    const [notes, setNotes] = useState('Xuất bán từ kho ký gửi khách hàng')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (preselectedWarehouseId) setWarehouseId(preselectedWarehouseId)
            else if (warehouses.length > 0) setWarehouseId(warehouses[0].id)
        }
    }, [open, preselectedWarehouseId, warehouses])

    useEffect(() => {
        if (warehouseId) {
            getWarehouseStockForTransfer(warehouseId).then(items => {
                setStockItems(items)
                setSaleItems([])
            })
        }
    }, [warehouseId])

    const handleAddSaleItem = (item: any) => {
        const existing = saleItems.find(s => s.productId === item.productId && (s.vintage ?? null) === (item.vintage ?? null))
        if (existing) return
        setSaleItems(prev => [...prev, {
            productId: item.productId,
            qty: 1,
            vintage: item.vintage,
            unitPrice: 500000,
        }])
    }

    const handleRemoveSaleItem = (idx: number) => {
        setSaleItems(prev => prev.filter((_, i) => i !== idx))
    }

    const handleQtyChange = (idx: number, qty: number) => {
        setSaleItems(prev => {
            const next = [...prev]
            next[idx].qty = Math.max(1, qty)
            return next
        })
    }

    const handlePriceChange = (idx: number, price: number) => {
        setSaleItems(prev => {
            const next = [...prev]
            next[idx].unitPrice = Math.max(0, price)
            return next
        })
    }

    const selectedWH = warehouses.find(w => w.id === warehouseId)
    const totalAmount = saleItems.reduce((s, item) => s + (item.qty * item.unitPrice), 0)

    const handleSubmit = async () => {
        if (!warehouseId) {
            toast.error('Vui lòng chọn kho ký gửi')
            return
        }
        if (saleItems.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 mặt hàng đã bán')
            return
        }

        setLoading(true)
        try {
            const res = await sellFromConsignmentWarehouse({
                warehouseId,
                notes,
                items: saleItems,
            })
            if (!res.success) {
                toast.error(res.error || 'Lỗi xuất bán từ kho ký gửi')
            } else {
                toast.success(`Đã tạo đơn bán ${res.soNo} và phát hành hóa đơn ${res.invoiceNo}!`)
                onSuccess()
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-xl overflow-hidden shadow-2xl bg-slate-50 border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-[#5BA88A]" />
                        <h3 className="text-base font-bold text-white">Xuất Bán Từ Kho Ký Gửi (Tạo SO & Hóa Đơn)</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Kho Ký Gửi (Khách Hàng) *</label>
                        <select
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        >
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>
                                    {wh.name} — Khách: {wh.customerName} ({wh.totalBottles} chai tồn)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Ghi Chú Đơn Hàng</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    {/* Danh sách mặt hàng xuất bán */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-bold text-slate-200">Các Mã Rượu Xuất Bán Tiêu Thụ</label>
                            <span className="text-slate-400">Đã chọn: {saleItems.length} mã</span>
                        </div>

                        {saleItems.length === 0 ? (
                            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-slate-400">
                                Chưa chọn mặt hàng nào. Bấm vào danh sách hàng tồn bên dưới để chọn.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {saleItems.map((item, idx) => {
                                    const stock = stockItems.find(s => s.productId === item.productId && (s.vintage ?? null) === (item.vintage ?? null))
                                    return (
                                        <div key={idx} className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 gap-2">
                                            <div className="flex-1 min-w-[160px]">
                                                <div className="font-semibold text-white truncate">{stock?.productName || item.productId}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    SKU: <span className="font-mono text-[#0891B2]">{stock?.skuCode}</span> | Niên vụ: {item.vintage || 'NV'} | Tồn kho: {stock?.qtyAvailable || 0} chai
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="text-[10px] text-slate-400 mb-0.5 text-center">Số lượng</div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={stock?.qtyAvailable || 9999}
                                                        value={item.qty}
                                                        onChange={e => handleQtyChange(idx, Number(e.target.value))}
                                                        className="w-16 px-1.5 py-1 text-center font-bold font-mono rounded bg-white border border-slate-200 text-slate-900"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-slate-400 mb-0.5 text-center">Đơn giá bán</div>
                                                    <input
                                                        type="number"
                                                        step={10000}
                                                        value={item.unitPrice}
                                                        onChange={e => handlePriceChange(idx, Number(e.target.value))}
                                                        className="w-28 px-2 py-1 text-right font-mono rounded bg-white border border-slate-200 text-slate-900 font-bold"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => handleRemoveSaleItem(idx)}
                                                    className="p-1 mt-3 hover:bg-rose-950 text-rose-400 rounded cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Chọn từ tồn kho ký gửi */}
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">
                            Bấm để chọn từ hàng đang có tại kho ký gửi này ({stockItems.length} SKU):
                        </label>
                        {stockItems.length === 0 ? (
                            <div className="p-3 rounded bg-white text-center text-slate-400">
                                Kho ký gửi này chưa có hàng tồn. Vui lòng lập lệnh "Xuất Hàng Ký Gửi" trước.
                            </div>
                        ) : (
                            <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg bg-white border border-slate-200">
                                {stockItems.map(item => (
                                    <button
                                        key={item.productId + (item.vintage || '')}
                                        type="button"
                                        onClick={() => handleAddSaleItem(item)}
                                        className="p-2 rounded bg-white hover:bg-slate-800 text-left border border-slate-700/50 cursor-pointer flex justify-between items-center"
                                    >
                                        <div className="truncate pr-1">
                                            <div className="font-medium text-white truncate">{item.productName}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{item.skuCode} {item.vintage ? `(${item.vintage})` : ''}</div>
                                        </div>
                                        <span className="text-[11px] font-bold font-mono text-emerald-400 whitespace-nowrap">
                                            {item.qtyAvailable} chai
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tổng kết giá trị */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200 flex justify-between items-center">
                        <span className="text-slate-400 font-semibold uppercase text-[11px]">Tổng giá trị xuất bán:</span>
                        <div className="text-right">
                            <div className="text-base font-bold font-mono text-[#5BA88A]">{totalAmount.toLocaleString('vi-VN')} ₫</div>
                            <div className="text-[10px] text-slate-400">+ VAT 10%: {(totalAmount * 0.1).toLocaleString('vi-VN')} ₫</div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-slate-900 cursor-pointer transition shadow-md"
                            style={{ background: '#5BA88A' }}
                        >
                            {loading ? 'Đang xuất bán...' : 'Xác Nhận Xuất Bán & Phát Hành Hóa Đơn'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: CREATE AGREEMENT DRAWER (Legacy)
// ═══════════════════════════════════════════════════
function CreateDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [customers, setCustomers] = useState<any[]>([])
    const [form, setForm] = useState<{ customerId: string; reportFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'AS_NEEDED'; startDate: string; endDate: string }>({ customerId: '', reportFrequency: 'MONTHLY', startDate: '', endDate: '' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) getCustomerOptionsForCSG().then(setCustomers)
    }, [open])

    const handleSubmit = async () => {
        if (!form.customerId || !form.startDate || !form.endDate) {
            toast.error('Vui lòng điền đầy đủ')
            return
        }
        setLoading(true)
        try {
            const res = await createConsignmentAgreement(form)
            if (!res.success) throw new Error(res.error || 'Lỗi tạo hợp đồng')
            toast.success('Đã tạo hợp đồng ký gửi!')
            onCreated()
            onClose()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="w-[480px] h-full overflow-y-auto bg-slate-50 border-l border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900">Tạo Hợp Đồng Ký Gửi</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Khách Hàng *</label>
                        <select
                            value={form.customerId}
                            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                        >
                            <option value="">-- Chọn KH HORECA/Đại lý --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block font-semibold mb-1 text-slate-300">Tần Suất Báo Cáo</label>
                        <select
                            value={form.reportFrequency}
                            onChange={e => setForm(f => ({ ...f, reportFrequency: e.target.value as any }))}
                            className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                        >
                            {Object.entries(FREQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-semibold mb-1 text-slate-300">Ngày Bắt Đầu *</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block font-semibold mb-1 text-slate-300">Ngày Kết Thúc *</label>
                            <input
                                type="date"
                                value={form.endDate}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-2.5 font-bold rounded cursor-pointer transition-all mt-4 text-slate-900"
                        style={{ background: loading ? '#E2E8F0' : '#87CBB9' }}
                    >
                        {loading ? 'Đang tạo...' : 'Tạo Hợp Đồng'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: DETAIL DRAWER (Legacy Agreement)
// ═══════════════════════════════════════════════════
function DetailDrawer({ agreement, onClose, onRefresh }: {
    agreement: ConsignmentRow | null; onClose: () => void; onRefresh: () => void
}) {
    const [stocks, setStocks] = useState<ConsignmentStockRow[]>([])
    const [reports, setReports] = useState<ConsignmentReportRow[]>([])

    const loadData = useCallback(async () => {
        if (!agreement) return
        const [s, r] = await Promise.all([getConsignmentStocks(agreement.id), getConsignmentReports(agreement.id)])
        setStocks(s)
        setReports(r)
    }, [agreement])

    useEffect(() => { loadData() }, [loadData])

    if (!agreement) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="w-[540px] h-full overflow-y-auto bg-slate-50 border-l border-slate-200 flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <div>
                        <h3 className="text-base font-bold text-white">{agreement.customerName}</h3>
                        <p className="text-xs text-slate-400">Hợp đồng: CSG-{agreement.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                        <div className="p-3 bg-white font-bold text-slate-900">Chi Tiết Tồn Hàng Theo Hợp Đồng</div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white text-slate-400 text-[11px] border-b border-slate-200">
                                    <th className="p-2">SKU</th>
                                    <th className="p-2">Sản Phẩm</th>
                                    <th className="p-2 text-right">Gửi</th>
                                    <th className="p-2 text-right">Đã Bán</th>
                                    <th className="p-2 text-right">Còn Lại</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">Chưa có sản phẩm ký gửi</td></tr>
                                ) : stocks.map(st => (
                                    <tr key={st.id} className="border-b border-slate-800">
                                        <td className="p-2 font-mono text-[#0891B2]">{st.skuCode}</td>
                                        <td className="p-2 text-white">{st.productName}</td>
                                        <td className="p-2 text-right font-mono text-amber-400">{st.qtyConsigned}</td>
                                        <td className="p-2 text-right font-mono text-emerald-400">{st.qtySold}</td>
                                        <td className="p-2 text-right font-mono font-bold text-white">{st.qtyRemaining}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConsignmentClient
