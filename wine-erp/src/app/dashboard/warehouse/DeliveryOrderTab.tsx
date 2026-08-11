'use client'

import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, X, Eye, CheckCircle2, Loader2, Save, PackageCheck, AlertCircle, Search, ArrowRight, Box, Printer, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
    type DeliveryOrderRow,
    getDeliveryOrders, getSOsForDelivery, createDeliveryOrder, confirmDeliveryOrder, markDODelivered,
    reverseDeliveryOrder, updateDeliveryOrderDate, getDODetail, getAvailableLotsForProduct, getWarehouses,
} from './actions'
import { formatDate } from '@/lib/utils'

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
    CONFIRMED: { label: 'Đã XN', color: '#B47816', bg: 'rgba(212,168,83,0.15)' },
    SHIPPED: { label: 'Đã Giao', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
    REVERSED: { label: 'Đã Reverse', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
    CANCELLED: { label: 'Đã Hủy', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
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

    // If SO already had a warehouseId specified, check if that warehouse matches the SO's legal entity
    if (targetSO.warehouseId) {
        const preSelectedWh = warehouses.find(w => w.id === targetSO.warehouseId)
        if (preSelectedWh) {
            const matchesEntity = entityWhs.length === 0 || entityWhs.some(w => w.id === preSelectedWh.id)
            if (matchesEntity) return preSelectedWh.id
        }
    }

    // Pick the default warehouse belonging to THIS specific Legal Entity
    const pool = entityWhs.length > 0 ? entityWhs : warehouses
    const defaultWh = pool.find((w: any) => w.isDefault && w.allowSales !== false)
        ?? pool.find((w: any) => w.allowSales !== false)
        ?? pool[0]

    return defaultWh ? defaultWh.id : (warehouses[0]?.id ?? '')
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
        if (!searchQuery.trim()) return pendingSOs
        const q = searchQuery.toLowerCase()
        return pendingSOs.filter(s => 
            s.soNo.toLowerCase().includes(q) || 
            s.customerName?.toLowerCase().includes(q) ||
            s.lines.some(l => l.productName.toLowerCase().includes(q) || l.skuCode.toLowerCase().includes(q))
        )
    }, [pendingSOs, searchQuery])

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

    const handleStartPicking = (soId: string) => {
        setPreselectedSOId(soId)
        setCreateOpen(true)
    }

    const handleConfirm = async (id: string) => {
        if (!confirm('Xác nhận Delivery Order? Hàng sẽ được xuất kho.')) return
        toast.promise(
            confirmDeliveryOrder(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi xác nhận DO')
                reload()
                setDetailData(null)
                return res
            }),
            { loading: 'Đang xác nhận...', success: 'DO đã xác nhận — Hàng đã xuất kho!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const handleMarkDelivered = async (id: string) => {
        if (!confirm('Đánh dấu đơn hàng đã giao thành công?')) return
        toast.promise(
            markDODelivered(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi cập nhật trạng thái')
                reload()
                setDetailData(null)
                return res
            }),
            { loading: 'Đang cập nhật...', success: '✅ Đơn hàng đã giao thành công!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const handleReverse = async (id: string, doNo?: string) => {
        if (!confirm(`⚠️ XÁC NHẬN REVERSE (HOÀN TÁC) PHIẾU ${doNo ?? id}?\n\n- Tồn kho sẽ được hoàn trả lại về các Lô tương ứng.\n- Đơn bán hàng (SO) sẽ được khôi phục về trạng thái Chờ xuất kho.`)) return
        toast.promise(
            reverseDeliveryOrder(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi hoàn tác xuất kho')
                reload()
                setDetailData(null)
                return res
            }),
            { loading: 'Đang xử lý Reverse phiếu...', success: `↺ Phiếu ${doNo ?? ''} đã Reverse & khôi phục tồn kho thành công!`, error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    return (
        <div className="space-y-3 sm:space-y-5">
            {/* Header & Sub-tab Navigation */}
            <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5" style={{ color: '#0F172A' }}>
                        <Truck size={16} style={{ color: '#D4A853' }} /> Xuất Kho (DO)
                    </h3>
                    <button onClick={() => { setPreselectedSOId(null); setCreateOpen(true) }}
                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg shadow-sm transition-all hover:brightness-105 shrink-0"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        <Plus size={12} /> Tạo DO
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex p-1 rounded-xl overflow-x-auto no-scrollbar" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                    <button
                        onClick={() => setActiveSubTab('pending')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all shrink-0 shadow-xs"
                        style={{
                            background: activeSubTab === 'pending' ? '#FFFFFF' : 'transparent',
                            color: activeSubTab === 'pending' ? '#0F172A' : '#64748B',
                            border: activeSubTab === 'pending' ? '1px solid #CBD5E1' : '1px solid transparent'
                        }}
                    >
                        Chờ Xuất
                        {pendingSOs.length > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full"
                                style={{
                                    background: activeSubTab === 'pending' ? 'rgba(212,168,83,0.2)' : '#CBD5E1',
                                    color: activeSubTab === 'pending' ? '#B47816' : '#475569'
                                }}>
                                {pendingSOs.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('history')}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold rounded-lg transition-all shrink-0 shadow-xs"
                        style={{
                            background: activeSubTab === 'history' ? '#FFFFFF' : 'transparent',
                            color: activeSubTab === 'history' ? '#0F172A' : '#64748B',
                            border: activeSubTab === 'history' ? '1px solid #CBD5E1' : '1px solid transparent'
                        }}
                    >
                        Lịch Sử
                        <span className="text-[9px] opacity-60">({rows.length})</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: PENDING SALES ORDERS WAITING FOR FULFILLMENT */}
            {activeSubTab === 'pending' && (
                <div className="space-y-2.5 sm:space-y-4">
                    {/* Search Bar - compact */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5" style={{ color: '#64748B' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm Mã SO, Tên KH, SKU..."
                            className="w-full pl-9 pr-3 py-2 text-[11px] rounded-lg outline-none font-medium"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                        />
                        <span className="absolute right-3 top-2.5 text-[10px] font-semibold" style={{ color: '#64748B' }}>
                            {filteredPendingSOs.length} / {pendingSOs.length}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 size={20} className="animate-spin" style={{ color: '#D4A853' }} />
                        </div>
                    ) : filteredPendingSOs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 rounded-xl" style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                            <CheckCircle2 size={28} style={{ color: '#16A34A' }} />
                            <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>
                                {searchQuery ? 'Không tìm thấy đơn hàng' : 'Không có đơn chờ xuất'}
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
                                        className="p-3.5 sm:p-4 rounded-xl flex flex-col justify-between transition-all shadow-sm hover:shadow-md"
                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                                    >
                                        <div>
                                            {/* SO Header */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-0.5 text-[11px] font-extrabold font-mono rounded"
                                                        style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                                        {so.soNo}
                                                    </span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                                                        style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>
                                                        Sẵn Sàng
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-semibold" style={{ color: '#64748B' }}>
                                                    {so.lines.length} SP ({totalItems} chai đặt)
                                                </span>
                                            </div>

                                            {/* Customer Name */}
                                            <h4 className="text-[13px] font-bold truncate mb-1.5" style={{ color: '#0F172A' }}>
                                                {so.customerName || (so as any).customer?.name || 'Khách hàng'}
                                            </h4>

                                            {/* Default Warehouse Badge */}
                                            <div className="mb-2.5">
                                                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded flex items-center gap-1 inline-flex"
                                                    style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' }}>
                                                    🏢 Kho xuất: <strong style={{ color: '#0F172A' }}>{targetWh?.name || 'Kho Mặc Định'}</strong>
                                                </span>
                                            </div>

                                            {/* Product Lines */}
                                            <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
                                                {so.lines.map(line => {
                                                    const pName = line.productName || (line as any).product?.productName || ''
                                                    const pCode = line.skuCode || (line as any).product?.skuCode || ''
                                                    return (
                                                        <div key={line.productId} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg"
                                                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                                            <div className="truncate pr-2 flex items-center gap-1.5 min-w-0">
                                                                {pCode && <span className="font-mono font-extrabold text-[#4A6A7A] shrink-0">{pCode}</span>}
                                                                {pCode && pName && <span className="text-[#CBD5E1] shrink-0">•</span>}
                                                                <span className="font-semibold text-[#0F172A] truncate">{pName || pCode || 'Sản phẩm'}</span>
                                                            </div>
                                                            <span className="font-mono font-bold shrink-0 text-[#D97706] ml-2">
                                                                x{line.qtyOrdered}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Action Footer */}
                                        <div className="mt-3 pt-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #E2E8F0' }}>
                                            <span className="text-[10px] font-medium" style={{ color: '#64748B' }}>
                                                FIFO tự động
                                            </span>
                                            <button
                                                onClick={() => handleStartPicking(so.id)}
                                                className="flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold rounded-lg shadow-sm transition-all hover:brightness-105 active:scale-95"
                                                style={{ background: '#D4A853', color: '#0A1926', minHeight: '36px' }}
                                            >
                                                Nhặt Hàng & Xuất Kho <ArrowRight size={12} />
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
                <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    {/* Desktop Table (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    {['Số DO', 'Số SO', 'Khách Hàng', 'Kho', 'SP', 'SL Đặt', 'SL Giao', 'Trạng Thái', 'Ngày', 'Thao Tác'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="text-center py-10">
                                        <Loader2 size={18} className="animate-spin inline" style={{ color: '#D4A853' }} />
                                    </td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-10 text-xs" style={{ color: '#64748B' }}>Chưa có DO nào</td></tr>
                                ) : rows.map(d => {
                                    const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                                    const canReverse = d.status !== 'REVERSED' && d.status !== 'CANCELLED'
                                    return (
                                        <tr key={d.id} className="transition-colors cursor-pointer hover:bg-slate-50"
                                            style={{ borderBottom: '1px solid #F1F5F9' }}
                                            onClick={() => openDetail(d.id)}>
                                            <td className="px-3 py-2.5 text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: '#B47816' }}>{d.doNo}</td>
                                            <td className="px-3 py-2.5 text-[11px] font-mono whitespace-nowrap" style={{ color: '#475569' }}>{d.soNo}</td>
                                            <td className="px-3 py-2.5 text-[11px]">
                                                <span className="font-bold text-[#0F172A] block truncate max-w-[170px]" title={d.customerName}>
                                                    {d.customerName}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-[11px]" style={{ color: '#475569' }}>{d.warehouseName}</td>
                                            <td className="px-3 py-2.5 text-[11px]" style={{ color: '#475569' }}>{d.lineCount}</td>
                                            <td className="px-3 py-2.5 text-[11px] font-mono" style={{ color: '#475569' }}>
                                                {d.totalQtyOrdered.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 text-[11px] font-bold font-mono" style={{ color: '#0F172A' }}>
                                                {d.totalQtyShipped.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: '#64748B' }}>{formatDate(d.createdAt)}</td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => openDetail(d.id)} className="p-1.5 rounded-lg hover:bg-slate-100"
                                                        title="Xem chi tiết"
                                                        style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                                        <Eye size={13} />
                                                    </button>
                                                    {d.status === 'DRAFT' && (
                                                        <button onClick={() => handleConfirm(d.id)} className="p-1.5 rounded-lg hover:bg-slate-100"
                                                            title="Xác nhận"
                                                            style={{ background: 'rgba(91,168,138,0.1)', color: '#5BA88A' }}>
                                                            <CheckCircle2 size={13} />
                                                        </button>
                                                    )}
                                                    {canReverse && (
                                                        <button onClick={() => handleReverse(d.id, d.doNo)}
                                                            title="Reverse (Hoàn Tác Xuất Kho — Chỉ Admin)"
                                                            className="px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition-all hover:brightness-105"
                                                            style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                                                            <RotateCcw size={11} /> Reverse
                                                        </button>
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
                    <div className="block md:hidden p-2.5 space-y-2">
                        {loading ? (
                            <div className="text-center py-10"><Loader2 size={18} className="animate-spin inline" style={{ color: '#D4A853' }} /></div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-10 text-xs" style={{ color: '#64748B' }}>Chưa có DO nào</div>
                        ) : rows.map(d => {
                            const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                            const canReverse = d.status !== 'REVERSED' && d.status !== 'CANCELLED'
                            return (
                                <div key={d.id} onClick={() => openDetail(d.id)}
                                    className="p-3 rounded-xl space-y-2 cursor-pointer transition-all active:scale-[0.99] shadow-sm"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold font-mono" style={{ color: '#B47816' }}>
                                            {d.doNo}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>
                                            {st.label}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-[#0F172A] truncate">
                                        {d.customerName}
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span style={{ color: '#64748B' }}>SO: <strong className="font-mono text-[#334155]">{d.soNo}</strong></span>
                                        <span className="font-mono font-bold" style={{ color: '#0F172A' }}>
                                            Giao {d.totalQtyShipped} / Đặt {d.totalQtyOrdered} chai
                                        </span>
                                    </div>
                                    {canReverse && (
                                        <div className="pt-1.5 flex justify-end" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => handleReverse(d.id, d.doNo)}
                                                className="px-2.5 py-1 text-[10px] font-bold rounded-md flex items-center gap-1"
                                                style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
                                                <RotateCcw size={11} /> Reverse (Admin)
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
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15,23,42,0.4)' }}>
                    <div className="w-full sm:w-[560px] max-w-full h-full overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                    Chi Tiết DO {detailData?.doNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                                        SO: {detailData.soNo} · KH: {detailData.customerName} · Kho: {detailData.warehouseName}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setDetailData(null)} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#D4A853' }} /></div>
                        ) : detailData && (
                            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                                <div className="grid grid-cols-2 gap-3">
                                    <InfoCard label="Trạng thái" value={(DO_STATUS[detailData.status] ?? DO_STATUS.DRAFT).label} />
                                    <InfoCard label="Ngày xuất ban đầu" value={formatDate(detailData.createdAt)} />
                                </div>

                                {/* Custom Date Editor for backdating/editing data */}
                                <div className="px-3.5 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>📅 Ngày Xuất Hàng (Chỉnh sửa dữ liệu)</p>
                                        <p className="text-xs font-bold mt-0.5" style={{ color: '#0F172A' }}>{formatDate(detailData.createdAt)}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <input
                                            type="date"
                                            value={editDoDate}
                                            onChange={e => setEditDoDate(e.target.value)}
                                            className="px-2 py-1 text-xs rounded border border-slate-300 font-mono outline-none shadow-xs"
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
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-105 shadow-sm"
                                        style={{ background: '#D4A853', color: '#0A1926' }}
                                    >
                                        <Printer size={14} /> In Phiếu Xuất Kho
                                    </button>
                                    {detailData.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleConfirm(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-105"
                                            style={{ background: 'rgba(91,168,138,0.15)', color: '#16A34A', border: '1px solid rgba(91,168,138,0.3)' }}
                                        >
                                            <CheckCircle2 size={14} /> Xác Nhận Xuất Kho
                                        </button>
                                    )}
                                    {(detailData.status === 'DRAFT' || detailData.status === 'PICKING' || detailData.status === 'PACKED' || detailData.status === 'SHIPPED') && (
                                        <button
                                            onClick={() => handleMarkDelivered(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-105"
                                            style={{ background: 'rgba(74,143,171,0.15)', color: '#2563EB', border: '1px solid rgba(74,143,171,0.3)' }}
                                        >
                                            <Truck size={14} /> Đã Giao Hàng
                                        </button>
                                    )}
                                    {detailData.status !== 'CANCELLED' && (
                                        <button
                                            onClick={() => handleReverse(detailData.id, detailData.doNo)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-105"
                                            style={{ background: 'rgba(220,38,38,0.15)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}
                                        >
                                            <RotateCcw size={14} /> Reverse Phiếu (Admin)
                                        </button>
                                    )}
                                </div>

                                {/* Detail Lines — Desktop Table */}
                                <div className="rounded-xl overflow-hidden hidden sm:block shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                {['SKU', 'Sản Phẩm', 'Vintage', 'Vị Trí Kho', 'Picked', 'Shipped'].map(h => (
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
                                                    <td className="px-3 py-2 text-xs font-mono font-medium" style={{ color: '#475569' }}>{l.locationCode}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#0F172A' }}>{l.qtyPicked}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#16A34A' }}>{l.qtyShipped}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Detail Lines — Mobile Cards */}
                                <div className="block sm:hidden space-y-2">
                                    {detailData.lines.map(l => (
                                        <div key={l.id} className="p-3 rounded-xl space-y-1.5 shadow-sm" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold font-mono" style={{ color: '#B47816' }}>{l.skuCode}</span>
                                                <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">🍇 Vintage: {(l as any).vintage ?? 'NV'}</span>
                                            </div>
                                            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{l.productName}</p>
                                            <div className="flex items-center gap-1 text-xs" style={{ color: '#64748B' }}>
                                                📍 {l.locationCode}
                                            </div>
                                            <div className="flex items-center justify-between pt-1.5 border-t text-xs" style={{ borderColor: '#E2E8F0' }}>
                                                <span style={{ color: '#64748B' }}>Picked: <strong className="font-mono text-[#0F172A]">{l.qtyPicked}</strong></span>
                                                <span style={{ color: '#64748B' }}>Shipped: <strong className="font-mono text-[#16A34A]">{l.qtyShipped}</strong></span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create DO Drawer */}
            {createOpen && (
                <CreateDODrawer
                    warehouses={warehouses}
                    initialSOId={preselectedSOId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => { setCreateOpen(false); reload() }}
                />
            )}
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
                                // If total stock across all lots < qtyOrdered
                                if (remainingNeeded > 0) {
                                    const lastLot = availLots[availLots.length - 1]
                                    allocatedLines.push({
                                        productId: sol.productId,
                                        lotId: lastLot.id,
                                        locationId: lastLot.locationId,
                                        qtyPicked: remainingNeeded
                                    })
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

    // ── Shared sub-components ───────────────────────
    const renderSOSelect = () => (
        <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Sales Order *</label>
            <select value={selectedSO?.id ?? ''} onChange={e => selectSO(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none transition-colors"
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                <option value="" style={{ background: '#FFFFFF', color: '#0F172A' }}>— Chọn SO —</option>
                {sos.map(s => <option key={s.id} value={s.id} style={{ background: '#FFFFFF', color: '#0F172A' }}>{s.soNo} — {s.customerName}</option>)}
            </select>
        </div>
    )

    const renderDateSelect = () => (
        <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>📅 Ngày Xuất Hàng *</label>
            <input
                type="date"
                value={issuedDate}
                onChange={e => setIssuedDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-medium"
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
            />
        </div>
    )

    const renderWarehouseSelect = () => (
        <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Kho Xuất Bán Hàng *</label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors font-medium"
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                <option value="" style={{ background: '#FFFFFF', color: '#0F172A' }}>— Chọn kho xuất bán —</option>
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
                            <option key={w.id} value={w.id} disabled={!isAllowed} style={{ background: '#FFFFFF', color: isAllowed ? '#0F172A' : '#94A3B8' }}>
                                {isAllowed
                                    ? `${w.isDefault ? '⭐ [Kho Mặc Định]' : '✔️ [Kho Xuất Bán]'} ${w.code} — ${w.name}`
                                    : `⛔ [Chỉ Điều Chuyển - Không Xuất Bán] ${w.code} — ${w.name}`
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
            <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B47816' }}>
                    Nhặt Hàng ({selectedSO!.lines.length} loại sản phẩm)
                </p>
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
                        <div key={sol.productId} className="p-3.5 rounded-xl space-y-3"
                            style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-bold leading-tight" style={{ color: '#0F172A' }}>{sol.productName}</p>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0"
                                    style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                    ×{sol.qtyOrdered}
                                </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs" style={{ color: '#64748B' }}>
                                <span>SKU: <strong className="font-mono text-[#334155]">{sol.skuCode}</strong> · 🍇 Vintage Đơn Hàng: <strong className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{sol.vintage ? sol.vintage : 'NV'}</strong></span>
                                <span className={`text-[11px] font-semibold ${isOverPicked ? 'text-amber-600 font-bold' : isSufficient ? 'text-emerald-600' : 'text-amber-600 font-bold'}`}>
                                    {isSufficient 
                                        ? `✅ Đủ (Tồn kho: ${totalStockAvailable} — Nhặt ${totalPickedForProduct}/${sol.qtyOrdered} chai)`
                                        : isOverPicked 
                                        ? `⚠️ Nhặt vượt nhu cầu (${totalPickedForProduct}/${sol.qtyOrdered} chai)`
                                        : `⚠️ Thiếu (Tồn kho: ${totalStockAvailable} — Nhặt ${totalPickedForProduct}/${sol.qtyOrdered} chai)`
                                    }
                                </span>
                            </div>

                            {/* Render Split Location Pick Lines for this Product */}
                            <div className="space-y-2.5 pt-1">
                                {productPicks.map((pick, pickIdx) => {
                                    const selectedLot = availLots.find(l => l.id === pick.lotId)
                                    const isLocInsufficient = selectedLot && selectedLot.qtyAvailable < pick.qtyPicked

                                    return (
                                        <div key={pick.globalIdx} className="p-2.5 rounded-lg border bg-white grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                                            style={{ borderColor: isLocInsufficient ? '#FCA5A5' : '#E2E8F0' }}>
                                            <div className="sm:col-span-8">
                                                <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>
                                                    Vị Trí Kho & Niên Vụ (Vintage) {productPicks.length > 1 ? `· Vị trí ${pickIdx + 1}` : ''}
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
                                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none font-sans font-medium"
                                                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: pick.lotId ? '#B47816' : '#64748B' }}
                                                >
                                                    <option value="" style={{ background: '#FFFFFF', color: '#0F172A' }}>— Chọn vị trí nhặt hàng —</option>
                                                    {availLots.map((lot, idx) => {
                                                        const vtg = lot.vintage ? lot.vintage : (sol.vintage ? sol.vintage : 'NV')
                                                        return (
                                                            <option key={lot.id} value={lot.id} style={{ background: '#FFFFFF', color: '#0F172A' }}>
                                                                {idx === 0 ? '⭐ [Ưu Tiên FIFO] ' : ''}📍 {lot.zone}{lot.rack ? ` / Kệ: ${lot.rack}` : ''}{lot.bin ? ` / Ô: ${lot.bin}` : ''} · 🍇 Vintage: {vtg} (Tồn: {lot.qtyAvailable} chai)
                                                            </option>
                                                        )
                                                    })}
                                                </select>
                                                {selectedLot && (
                                                    <div className="mt-1 flex items-center gap-2 text-[10px] px-2 py-1 rounded flex-wrap font-medium"
                                                        style={{ background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)', color: '#1E293B' }}>
                                                        <span>📍 Vị Trí: <strong className="font-bold text-slate-900">{selectedLot.zone}</strong>{selectedLot.rack && <> / Kệ: {selectedLot.rack}</>}{selectedLot.bin && <> / Ô: {selectedLot.bin}</>}</span>
                                                        <span>| 🍇 Vintage: <strong className="font-bold text-amber-800">{selectedLot.vintage ? selectedLot.vintage : (sol.vintage ? sol.vintage : 'NV')}</strong></span>
                                                        <span>| 📦 Tồn: <strong className="font-bold text-emerald-700">{selectedLot.qtyAvailable} chai</strong></span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="sm:col-span-4 flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#64748B' }}>SL Nhặt</label>
                                                    <input type="number" min={0} value={pick.qtyPicked}
                                                        onChange={e => {
                                                            const v = [...lines]
                                                            v[pick.globalIdx] = { ...v[pick.globalIdx], qtyPicked: Number(e.target.value) }
                                                            setLines(v)
                                                        }}
                                                        className="w-full px-2.5 py-1.5 rounded-lg text-sm font-mono font-bold text-center"
                                                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: isLocInsufficient ? '#DC2626' : '#16A34A' }} />
                                                </div>
                                                {productPicks.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLines(prev => prev.filter((_, idx) => idx !== pick.globalIdx))
                                                        }}
                                                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 mt-4 transition-colors"
                                                        title="Xóa vị trí nhặt hàng này"
                                                    >
                                                        <X size={16} />
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
                                    className="text-xs font-semibold text-amber-700 flex items-center gap-1 hover:underline pt-1"
                                >
                                    <Plus size={14} /> Thêm vị trí nhặt hàng khác cho sản phẩm này (Tách vị trí)
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </>
    )

    const renderSaveButtons = () => (
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={() => handleSave(false)} disabled={saving}
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl transition-all hover:brightness-95"
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', minHeight: '48px' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu Nháp DO
            </button>

            <button onClick={() => handleSave(true)} disabled={saving}
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl shadow-md transition-all hover:brightness-105"
                style={{ background: '#D4A853', color: '#0A1926', minHeight: '48px' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                ⚡ Xác Nhận Xuất Kho
            </button>
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
            <div className="w-full sm:w-[580px] max-w-full h-full flex flex-col shadow-2xl" style={{ background: '#FFFFFF' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <div className="min-w-0">
                        <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>Nhặt Hàng & Tạo DO</h3>
                        {selectedSO && (
                            <p className="text-xs mt-0.5 font-mono font-semibold truncate" style={{ color: '#B47816' }}>
                                {selectedSO.soNo} · {selectedSO.customerName}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg shrink-0 hover:bg-slate-100 transition-colors" style={{ color: '#64748B' }}><X size={20} /></button>
                </div>

                {/* Mobile Step Indicator */}
                <div className="flex sm:hidden items-center gap-1 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    {[
                        { step: 1 as const, label: 'Chọn Đơn' },
                        { step: 2 as const, label: 'Nhặt Hàng' },
                        { step: 3 as const, label: 'Xác Nhận' },
                    ].map((s, idx) => (
                        <div key={s.step} className="flex items-center gap-1 flex-1">
                            <button
                                onClick={() => {
                                    if (s.step === 1) setMobileStep(1)
                                    else if (s.step === 2 && canGoStep2) setMobileStep(2)
                                    else if (s.step === 3 && canGoStep2 && validLinesCount > 0) setMobileStep(3)
                                }}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold w-full justify-center transition-all"
                                style={{
                                    background: mobileStep === s.step ? '#D4A853' : mobileStep > s.step ? 'rgba(22,163,74,0.15)' : '#F1F5F9',
                                    color: mobileStep === s.step ? '#0A1926' : mobileStep > s.step ? '#16A34A' : '#64748B',
                                }}
                            >
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                                    style={{
                                        background: mobileStep === s.step ? '#0A1926' : 'transparent',
                                        color: mobileStep === s.step ? '#D4A853' : 'inherit',
                                        border: mobileStep === s.step ? 'none' : '1px solid currentColor',
                                    }}>
                                    {mobileStep > s.step ? '✓' : s.step}
                                </span>
                                {s.label}
                            </button>
                            {idx < 2 && <div className="w-3 h-px shrink-0" style={{ background: '#CBD5E1' }} />}
                        </div>
                    ))}
                </div>

                {/* Content — scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {/* ═══ DESKTOP: Single page ═══ */}
                    <div className="hidden sm:block p-5 space-y-4">
                        {selectedSO ? (
                            <div className="space-y-3">
                                <div className="p-3.5 rounded-xl flex items-center justify-between" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#64748B' }}>Đơn Hàng Bán (Mặc Định)</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-sm font-bold font-mono" style={{ color: '#B47816' }}>{selectedSO.soNo}</span>
                                            <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>· {selectedSO.customerName}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: '#64748B' }}>Kho Xuất Bán (Tự Động Mặc Định)</span>
                                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>
                                            🏢 {warehouses.find((w: any) => w.id === warehouseId)?.name || 'Kho Mặc Định'}
                                        </span>
                                    </div>
                                </div>
                                <div className="max-w-xs">
                                    {renderDateSelect()}
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                {renderSOSelect()}
                                {renderWarehouseSelect()}
                                {renderDateSelect()}
                            </div>
                        )}
                        {selectedSO && lines.length > 0 && renderProductLines()}
                        {renderSaveButtons()}
                    </div>

                    {/* ═══ MOBILE: Step Wizard ═══ */}
                    <div className="block sm:hidden p-4 space-y-4">
                        {/* Step 1 */}
                        {mobileStep === 1 && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#B47816' }}>
                                        Bước 1: Chọn Đơn Hàng, Kho & Ngày Xuất
                                    </p>
                                    <div className="space-y-3">
                                        {renderSOSelect()}
                                        {renderWarehouseSelect()}
                                        {renderDateSelect()}
                                    </div>
                                </div>
                                {selectedSO && (
                                    <div className="p-3 rounded-xl space-y-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <p className="text-xs font-semibold" style={{ color: '#64748B' }}>Sản phẩm trong đơn:</p>
                                        {selectedSO.lines.map(l => (
                                            <div key={l.productId} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                <span className="truncate pr-2" style={{ color: '#0F172A' }}>{l.productName}</span>
                                                <span className="font-mono font-bold shrink-0" style={{ color: '#B47816' }}>×{l.qtyOrdered}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => setMobileStep(2)}
                                    disabled={!canGoStep2}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-all"
                                    style={{
                                        background: canGoStep2 ? '#D4A853' : '#F1F5F9',
                                        color: canGoStep2 ? '#0A1926' : '#94A3B8',
                                        minHeight: '48px',
                                    }}>
                                    Tiếp Theo → Nhặt Hàng <ArrowRight size={16} />
                                </button>
                            </div>
                        )}

                        {/* Step 2 */}
                        {mobileStep === 2 && selectedSO && lines.length > 0 && (
                            <div className="space-y-4">
                                {renderProductLines()}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setMobileStep(1)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl"
                                        style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#334155', minHeight: '48px' }}>
                                        ← Quay Lại
                                    </button>
                                    <button
                                        onClick={() => setMobileStep(3)}
                                        disabled={validLinesCount === 0}
                                        className="flex-[2] flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl"
                                        style={{
                                            background: validLinesCount > 0 ? '#D4A853' : '#F1F5F9',
                                            color: validLinesCount > 0 ? '#0A1926' : '#94A3B8',
                                            minHeight: '48px',
                                        }}>
                                        Xác Nhận ({validLinesCount}/{lines.length}) →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3 */}
                        {mobileStep === 3 && selectedSO && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#B47816' }}>
                                        Bước 3: Xác Nhận Xuất Kho
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Đơn hàng</p>
                                            <p className="text-sm font-bold font-mono" style={{ color: '#B47816' }}>{selectedSO.soNo}</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Kho xuất</p>
                                            <p className="text-sm font-bold" style={{ color: '#0F172A' }}>
                                                {warehouses.find(w => w.id === warehouseId)?.code ?? '—'}
                                            </p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Sản phẩm</p>
                                            <p className="text-sm font-bold" style={{ color: '#16A34A' }}>{validLinesCount} loại</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Tổng nhặt</p>
                                            <p className="text-sm font-bold font-mono" style={{ color: '#16A34A' }}>{totalPicked.toLocaleString()} chai</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        {selectedSO.lines.map((sol, i) => {
                                            const line = lines[i]
                                            const lot = lotsMap[sol.productId]?.find(l => l.id === line?.lotId)
                                            return (
                                                <div key={sol.productId} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg"
                                                    style={{ background: '#FFFFFF', border: line?.lotId ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(212,168,83,0.3)' }}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className="truncate font-medium" style={{ color: '#0F172A' }}>{sol.productName}</p>
                                                        <p className="text-[10px] font-medium" style={{ color: '#64748B' }}>
                                                            {lot ? `📍 Vị Trí: ${lot.zone}${lot.rack ? ` / Kệ: ${lot.rack}` : ''}${lot.bin ? ` / Ô: ${lot.bin}` : ''} · 🍇 Vintage: ${lot.vintage ? lot.vintage : (sol.vintage ? sol.vintage : 'NV')}` : '⚠️ Chưa chọn vị trí'}
                                                        </p>
                                                    </div>
                                                    <span className="font-mono font-bold shrink-0" style={{ color: line?.lotId ? '#16A34A' : '#B47816' }}>
                                                        {line?.lotId ? `✓ ${line.qtyPicked}` : '—'}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMobileStep(2)}
                                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-xl"
                                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569' }}>
                                    ← Sửa Lại Nhặt Hàng
                                </button>
                                {renderSaveButtons()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
