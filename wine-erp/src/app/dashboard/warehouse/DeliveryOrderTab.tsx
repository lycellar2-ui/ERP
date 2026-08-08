'use client'

import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, X, Eye, CheckCircle2, Loader2, Save, PackageCheck, AlertCircle, Search, ArrowRight, Box, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
    type DeliveryOrderRow,
    getDeliveryOrders, getSOsForDelivery, createDeliveryOrder, confirmDeliveryOrder, markDODelivered,
    getDODetail, getAvailableLotsForProduct,
} from './actions'
import { formatDate } from '@/lib/utils'

type SOOption = {
    id: string; soNo: string; customerName: string; createdAt?: Date | string; warehouseId?: string
    lines: { productId: string; productName: string; skuCode: string; qtyOrdered: number; vintage: number | null }[]
}

type AvailableLot = {
    id: string; lotNo: string; locationId: string; locationCode: string
    qtyAvailable: number; receivedDate: Date
}

const DO_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.15)' },
    CONFIRMED: { label: 'Đã XN', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    SHIPPED: { label: 'Đã Giao', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
}

type DODetail = Awaited<ReturnType<typeof getDODetail>>

export function DeliveryOrderTab({ warehouses }: {
    warehouses: { id: string; code: string; name: string }[]
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

    const reload = async () => { 
        setLoading(true)
        const [d, sosData] = await Promise.all([
            getDeliveryOrders(),
            getSOsForDelivery()
        ])
        setRows(d)
        setPendingSOs(sosData as any)
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

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        const data = await getDODetail(id)
        setDetailData(data)
        setDetailLoading(false)
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

    return (
        <div className="space-y-3 sm:space-y-5">
            {/* Header & Sub-tab Navigation */}
            <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5" style={{ color: '#E8F1F2' }}>
                        <Truck size={16} style={{ color: '#D4A853' }} /> Xuất Kho (DO)
                    </h3>
                    <button onClick={() => { setPreselectedSOId(null); setCreateOpen(true) }}
                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg shadow-sm transition-all hover:brightness-110 shrink-0"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        <Plus size={12} /> Tạo DO
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex p-0.5 rounded-lg overflow-x-auto no-scrollbar" style={{ background: '#142433', border: '1px solid #1E3445' }}>
                    <button
                        onClick={() => setActiveSubTab('pending')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all shrink-0"
                        style={{
                            background: activeSubTab === 'pending' ? '#D4A853' : 'transparent',
                            color: activeSubTab === 'pending' ? '#0A1926' : '#6B8A9A'
                        }}
                    >
                        Chờ Xuất
                        {pendingSOs.length > 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded-full"
                                style={{
                                    background: activeSubTab === 'pending' ? '#0A1926' : 'rgba(212,168,83,0.2)',
                                    color: activeSubTab === 'pending' ? '#D4A853' : '#D4A853'
                                }}>
                                {pendingSOs.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('history')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-md transition-all shrink-0"
                        style={{
                            background: activeSubTab === 'history' ? '#D4A853' : 'transparent',
                            color: activeSubTab === 'history' ? '#0A1926' : '#6B8A9A'
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
                                                    {so.lines.length} SP ({totalItems} chai)
                                                </span>
                                            </div>

                                            {/* Customer Name */}
                                            <h4 className="text-[13px] font-bold truncate mb-2.5" style={{ color: '#0F172A' }}>
                                                {so.customerName || (so as any).customer?.name || 'Khách hàng'}
                                            </h4>

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
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1E3445' }}>
                    {/* Desktop Table (>= 768px) */}
                    <div className="hidden md:block">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #1E3445' }}>
                                    {['Số DO', 'Số SO', 'Kho', 'SP', 'SL', 'Trạng Thái', 'Ngày', ''].map(h => (
                                        <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-10">
                                        <Loader2 size={18} className="animate-spin inline" style={{ color: '#D4A853' }} />
                                    </td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-10 text-xs" style={{ color: '#4A6A7A' }}>Chưa có DO nào</td></tr>
                                ) : rows.map(d => {
                                    const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                                    return (
                                        <tr key={d.id} className="transition-colors cursor-pointer"
                                            style={{ borderBottom: '1px solid rgba(30,52,69,0.6)' }}
                                            onClick={() => openDetail(d.id)}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.03)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                            <td className="px-3 py-2 text-[11px] font-bold font-mono" style={{ color: '#D4A853' }}>{d.doNo}</td>
                                            <td className="px-3 py-2 text-[11px] font-mono" style={{ color: '#8AAEBB' }}>{d.soNo}</td>
                                            <td className="px-3 py-2 text-[11px]" style={{ color: '#6B8A9A' }}>{d.warehouseName}</td>
                                            <td className="px-3 py-2 text-[11px]" style={{ color: '#6B8A9A' }}>{d.lineCount}</td>
                                            <td className="px-3 py-2 text-[11px] font-bold font-mono" style={{ color: '#E8F1F2' }}>
                                                {d.totalQtyShipped.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                            </td>
                                            <td className="px-3 py-2 text-[10px]" style={{ color: '#4A6A7A' }}>{formatDate(d.createdAt)}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => openDetail(d.id)} className="p-1 rounded"
                                                        style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                                        <Eye size={12} />
                                                    </button>
                                                    {d.status === 'DRAFT' && (
                                                        <button onClick={() => handleConfirm(d.id)} className="p-1 rounded"
                                                            style={{ background: 'rgba(91,168,138,0.1)', color: '#5BA88A' }}>
                                                            <CheckCircle2 size={12} />
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
                    <div className="block md:hidden p-2 space-y-2">
                        {loading ? (
                            <div className="text-center py-10"><Loader2 size={18} className="animate-spin inline" style={{ color: '#D4A853' }} /></div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-10 text-xs" style={{ color: '#4A6A7A' }}>Chưa có DO nào</div>
                        ) : rows.map(d => {
                            const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                            return (
                                <div key={d.id} onClick={() => openDetail(d.id)}
                                    className="p-2.5 rounded-lg space-y-1.5 cursor-pointer transition-all active:scale-[0.99]"
                                    style={{ background: '#0F1D2B', border: '1px solid #1E3445' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold font-mono" style={{ color: '#D4A853' }}>
                                            {d.doNo}
                                        </span>
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: st.color, background: st.bg }}>
                                            {st.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span style={{ color: '#6B8A9A' }}>SO: <strong className="font-mono text-[#8AAEBB]">{d.soNo}</strong></span>
                                        <span className="font-mono font-bold" style={{ color: '#E8F1F2' }}>{d.totalQtyShipped} chai</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-full sm:w-[560px] max-w-full h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                                    Chi Tiết DO {detailData?.doNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                        SO: {detailData.soNo} · KH: {detailData.customerName} · Kho: {detailData.warehouseName}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setDetailData(null)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                        ) : detailData && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <InfoCard label="Trạng thái" value={(DO_STATUS[detailData.status] ?? DO_STATUS.DRAFT).label} />
                                    <InfoCard label="Ngày tạo" value={formatDate(detailData.createdAt)} />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => window.open(`/dashboard/warehouse/print?id=${detailData.id}`, '_blank')}
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-110"
                                        style={{ background: '#D4A853', color: '#0A1926' }}
                                    >
                                        <Printer size={14} /> In Phiếu Xuất Kho
                                    </button>
                                    {detailData.status === 'DRAFT' && (
                                        <button
                                            onClick={() => handleConfirm(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-110"
                                            style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                                        >
                                            <CheckCircle2 size={14} /> Xác Nhận Xuất Kho
                                        </button>
                                    )}
                                    {(detailData.status === 'DRAFT' || detailData.status === 'PICKING' || detailData.status === 'PACKED' || detailData.status === 'SHIPPED') && (
                                        <button
                                            onClick={() => handleMarkDelivered(detailData.id)}
                                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all hover:brightness-110"
                                            style={{ background: 'rgba(74,143,171,0.2)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}
                                        >
                                            <Truck size={14} /> Đã Giao Hàng
                                        </button>
                                    )}
                                </div>

                                {/* Detail Lines — Desktop Table */}
                                <div className="rounded-xl overflow-hidden hidden sm:block" style={{ border: '1px solid #2A4355' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                                {['SKU', 'Sản Phẩm', 'Lô Hàng', 'Vị Trí', 'Picked', 'Shipped'].map(h => (
                                                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.lines.map(l => (
                                                <tr key={l.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
                                                    <td className="px-3 py-2 text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>
                                                        {l.skuCode}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs" style={{ color: '#E8F1F2' }}>{l.productName}</td>
                                                    <td className="px-3 py-2 text-xs font-mono" style={{ color: '#D4A853' }}>{l.lotNo}</td>
                                                    <td className="px-3 py-2 text-xs font-mono" style={{ color: '#8AAEBB' }}>{l.locationCode}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#E8F1F2' }}>{l.qtyPicked}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#5BA88A' }}>{l.qtyShipped}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Detail Lines — Mobile Cards */}
                                <div className="block sm:hidden space-y-2">
                                    {detailData.lines.map(l => (
                                        <div key={l.id} className="p-3 rounded-xl space-y-1.5" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{l.skuCode}</span>
                                                <span className="text-xs font-mono" style={{ color: '#D4A853' }}>Lô: {l.lotNo}</span>
                                            </div>
                                            <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{l.productName}</p>
                                            <div className="flex items-center gap-1 text-xs" style={{ color: '#8AAEBB' }}>
                                                📍 {l.locationCode}
                                            </div>
                                            <div className="flex items-center justify-between pt-1.5 border-t text-xs" style={{ borderColor: 'rgba(42,67,85,0.5)' }}>
                                                <span style={{ color: '#4A6A7A' }}>Picked: <strong className="font-mono text-white">{l.qtyPicked}</strong></span>
                                                <span style={{ color: '#4A6A7A' }}>Shipped: <strong className="font-mono" style={{ color: '#5BA88A' }}>{l.qtyShipped}</strong></span>
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
        <div className="px-3 py-2.5 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: '#E8F1F2' }}>{value}</p>
        </div>
    )
}

// ── Create DO Drawer ──────────────────────────────
function CreateDODrawer({ warehouses, initialSOId, onClose, onCreated }: {
    warehouses: { id: string; code: string; name: string }[]
    initialSOId?: string | null
    onClose: () => void; onCreated: () => void
}) {
    const [sos, setSOs] = useState<SOOption[]>([])
    const [selectedSO, setSelectedSO] = useState<SOOption | null>(null)
    const [warehouseId, setWarehouseId] = useState('')
    const [lines, setLines] = useState<{ productId: string; lotId: string; locationId: string; qtyPicked: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [lotsMap, setLotsMap] = useState<Record<string, any[]>>({})
    const [mobileStep, setMobileStep] = useState<1 | 2 | 3>(1)

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
                    setLines(prev => {
                        return selectedSO.lines.map((sol, i) => {
                            const availLots = map[sol.productId] || []
                            const oldestLot = availLots[0]
                            const existingLine = prev[i]
                            if (oldestLot) {
                                return {
                                    productId: sol.productId,
                                    lotId: existingLine?.lotId || oldestLot.id,
                                    locationId: existingLine?.locationId || oldestLot.locationId,
                                    qtyPicked: existingLine?.qtyPicked ?? sol.qtyOrdered
                                }
                            }
                            return existingLine || {
                                productId: sol.productId,
                                lotId: '',
                                locationId: '',
                                qtyPicked: sol.qtyOrdered
                            }
                        })
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

    const handleAutoAssignFIFO = () => {
        if (!selectedSO) return
        setLines(prev => {
            return selectedSO.lines.map((sol, i) => {
                const availLots = lotsMap[sol.productId] || []
                const oldestLot = availLots[0]
                if (oldestLot) {
                    return {
                        productId: sol.productId,
                        lotId: oldestLot.id,
                        locationId: oldestLot.locationId,
                        qtyPicked: sol.qtyOrdered
                    }
                }
                return prev[i] || {
                    productId: sol.productId,
                    lotId: '',
                    locationId: '',
                    qtyPicked: sol.qtyOrdered
                }
            })
        })
        toast.success('Đã tự động phân bổ lô hàng theo chuẩn FIFO (Cũ nhất xuất trước)!')
    }

    useEffect(() => {
        getSOsForDelivery().then(data => {
            setSOs(data as any)
            if (initialSOId) {
                const targetSO = (data as any[]).find(s => s.id === initialSOId)
                if (targetSO) {
                    setSelectedSO(targetSO)
                    setLines(targetSO.lines.map((l: any) => ({
                        productId: l.productId,
                        lotId: '',
                        locationId: '',
                        qtyPicked: l.qtyOrdered,
                    })))
                    if (targetSO.warehouseId) {
                        setWarehouseId(targetSO.warehouseId)
                    } else if (warehouses.length > 0) {
                        setWarehouseId(warehouses[0].id)
                    }
                    setMobileStep(2)
                }
            }
        })
    }, [initialSOId, warehouses])

    const selectSO = (soId: string) => {
        const so = sos.find(s => s.id === soId) || null
        setSelectedSO(so)
        if (so) {
            setLines(so.lines.map(l => ({
                productId: l.productId,
                lotId: '',
                locationId: '',
                qtyPicked: l.qtyOrdered,
            })))
            if ((so as any).warehouseId) {
                setWarehouseId((so as any).warehouseId)
            } else if (warehouses.length > 0) {
                setWarehouseId(warehouses[0].id)
            }
        }
    }

    const handleSave = async (autoConfirm = false) => {
        if (!selectedSO || !warehouseId) return toast.error('Chọn SO và kho')
        const validLines = lines.filter(l => l.qtyPicked > 0 && l.lotId)
        if (validLines.length === 0) return toast.error('Chưa có lô hàng nào được chọn. Hãy bấm [⚡ Tự Động Phân Bổ FIFO]')
        setSaving(true)
        try {
            const res = await createDeliveryOrder({ soId: selectedSO.id, warehouseId, lines: validLines })
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
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8AAEBB' }}>Sales Order *</label>
            <select value={selectedSO?.id ?? ''} onChange={e => selectSO(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-mono" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                <option value="">— Chọn SO —</option>
                {sos.map(s => <option key={s.id} value={s.id}>{s.soNo} — {s.customerName}</option>)}
            </select>
        </div>
    )

    const renderWarehouseSelect = () => (
        <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#8AAEBB' }}>Kho Xuất *</label>
            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                <option value="">— Chọn kho —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
        </div>
    )

    const renderProductLines = () => (
        <>
            <div className="flex items-center justify-between pt-2">
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                    Nhặt Hàng ({lines.length} loại)
                </p>
                <button
                    onClick={handleAutoAssignFIFO}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-all hover:brightness-110 shadow-sm"
                    style={{ background: 'rgba(135,203,185,0.15)', border: '1px solid #87CBB9', color: '#87CBB9', minHeight: '36px' }}
                    title="Tự động chọn các lô cũ nhất theo nguyên tắc FIFO"
                >
                    ⚡ FIFO
                </button>
            </div>

            <div className="space-y-3">
                {selectedSO!.lines.map((sol, i) => {
                    const availLots = lotsMap[sol.productId] || []
                    const selectedLot = availLots.find(l => l.id === lines[i]?.lotId)
                    const isInsufficient = selectedLot && selectedLot.qtyAvailable < (lines[i]?.qtyPicked || 0)

                    return (
                        <div key={sol.productId} className="p-3.5 rounded-xl space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-bold leading-tight" style={{ color: '#E8F1F2' }}>{sol.productName}</p>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0" style={{ background: '#1B2E3D', color: '#87CBB9' }}>
                                    ×{sol.qtyOrdered}
                                </span>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs" style={{ color: '#4A6A7A' }}>
                                <span>SKU: {sol.skuCode} {sol.vintage ? `· VTG: ${sol.vintage}` : ''}</span>
                                {selectedLot ? (
                                    <span className={`text-[11px] font-semibold ${isInsufficient ? 'text-amber-400 font-bold' : 'text-emerald-400'}`}>
                                        {isInsufficient ? `⚠️ Thiếu (Tồn: ${selectedLot.qtyAvailable})` : `✅ Đủ (Tồn: ${selectedLot.qtyAvailable})`}
                                    </span>
                                ) : (
                                    <span className="text-[11px] text-amber-400 italic">
                                        {availLots.length > 0 ? '⚠️ Chưa chọn lô' : '❌ Hết hàng'}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                <div className="sm:col-span-2">
                                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#8AAEBB' }}>Lô Hàng (FIFO)</label>
                                    <select
                                        value={lines[i]?.lotId ?? ''}
                                        onChange={e => {
                                            const lotId = e.target.value
                                            const chosenLot = availLots.find(l => l.id === lotId)
                                            const v = [...lines]
                                            v[i] = { 
                                                ...v[i], 
                                                lotId, 
                                                locationId: chosenLot?.locationId ?? '' 
                                            }
                                            setLines(v)
                                        }}
                                        className="w-full px-2.5 py-2 rounded-lg text-xs outline-none font-mono"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: lines[i]?.lotId ? '#D4A853' : '#4A6A7A' }}
                                    >
                                        <option value="">— Chọn lô —</option>
                                        {availLots.map((lot, idx) => (
                                            <option key={lot.id} value={lot.id}>
                                                {idx === 0 ? '⭐ ' : ''}📍 {lot.zone}{lot.rack ? ` / ${lot.rack}` : ''}{lot.bin ? ` / ${lot.bin}` : ''} · {lot.lotNo} (Tồn: {lot.qtyAvailable})
                                            </option>
                                        ))}
                                    </select>
                                    {selectedLot && (
                                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg flex-wrap" style={{ background: 'rgba(74,143,171,0.1)', color: '#8AAEBB' }}>
                                            📍 <span className="font-bold">{selectedLot.zone}</span>
                                            {selectedLot.rack && <><span style={{ color: '#4A6A7A' }}>/</span> <span>{selectedLot.rack}</span></>}
                                            {selectedLot.bin && <><span style={{ color: '#4A6A7A' }}>/</span> <span>{selectedLot.bin}</span></>}
                                            <span style={{ color: '#4A6A7A' }}>·</span>
                                            <span className="font-mono" style={{ color: '#4A6A7A' }}>{selectedLot.locationCode}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[10px] font-semibold block mb-1" style={{ color: '#8AAEBB' }}>SL Nhặt</label>
                                    <input type="number" min={0} value={lines[i]?.qtyPicked ?? 0}
                                        onChange={e => {
                                            const v = [...lines]; v[i] = { ...v[i], qtyPicked: Number(e.target.value) }; setLines(v)
                                        }}
                                        className="w-full px-2.5 py-2 rounded-lg text-sm font-mono font-bold text-center"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#87CBB9' }} />
                                </div>
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
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl transition-all hover:brightness-110"
                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', minHeight: '48px' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu Nháp DO
            </button>

            <button onClick={() => handleSave(true)} disabled={saving}
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl shadow-md transition-all hover:brightness-110"
                style={{ background: '#87CBB9', color: '#0A1926', minHeight: '48px' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                ⚡ Xác Nhận Xuất Kho
            </button>
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full sm:w-[580px] max-w-full h-full flex flex-col" style={{ background: '#0F1D2B' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="min-w-0">
                        <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>Nhặt Hàng & Tạo DO</h3>
                        {selectedSO && (
                            <p className="text-xs mt-0.5 font-mono font-semibold truncate" style={{ color: '#D4A853' }}>
                                {selectedSO.soNo} · {selectedSO.customerName}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg shrink-0" style={{ color: '#4A6A7A' }}><X size={20} /></button>
                </div>

                {/* Mobile Step Indicator */}
                <div className="flex sm:hidden items-center gap-1 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #2A4355', background: '#142433' }}>
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
                                    background: mobileStep === s.step ? '#87CBB9' : mobileStep > s.step ? 'rgba(91,168,138,0.15)' : '#1B2E3D',
                                    color: mobileStep === s.step ? '#0A1926' : mobileStep > s.step ? '#5BA88A' : '#4A6A7A',
                                }}
                            >
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                                    style={{
                                        background: mobileStep === s.step ? '#0A1926' : 'transparent',
                                        color: mobileStep === s.step ? '#87CBB9' : 'inherit',
                                        border: mobileStep === s.step ? 'none' : '1px solid currentColor',
                                    }}>
                                    {mobileStep > s.step ? '✓' : s.step}
                                </span>
                                {s.label}
                            </button>
                            {idx < 2 && <div className="w-3 h-px shrink-0" style={{ background: '#2A4355' }} />}
                        </div>
                    ))}
                </div>

                {/* Content — scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {/* ═══ DESKTOP: Single page ═══ */}
                    <div className="hidden sm:block p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {renderSOSelect()}
                            {renderWarehouseSelect()}
                        </div>
                        {selectedSO && lines.length > 0 && renderProductLines()}
                        {renderSaveButtons()}
                    </div>

                    {/* ═══ MOBILE: Step Wizard ═══ */}
                    <div className="block sm:hidden p-4 space-y-4">
                        {/* Step 1 */}
                        {mobileStep === 1 && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl" style={{ background: '#102230', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#D4A853' }}>
                                        Bước 1: Chọn Đơn Hàng & Kho
                                    </p>
                                    <div className="space-y-3">
                                        {renderSOSelect()}
                                        {renderWarehouseSelect()}
                                    </div>
                                </div>
                                {selectedSO && (
                                    <div className="p-3 rounded-xl space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <p className="text-xs font-semibold" style={{ color: '#8AAEBB' }}>Sản phẩm trong đơn:</p>
                                        {selectedSO.lines.map(l => (
                                            <div key={l.productId} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg"
                                                style={{ background: '#1B2E3D' }}>
                                                <span className="truncate pr-2" style={{ color: '#E8F1F2' }}>{l.productName}</span>
                                                <span className="font-mono font-bold shrink-0" style={{ color: '#87CBB9' }}>×{l.qtyOrdered}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    onClick={() => setMobileStep(2)}
                                    disabled={!canGoStep2}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold rounded-xl transition-all"
                                    style={{
                                        background: canGoStep2 ? '#87CBB9' : '#1B2E3D',
                                        color: canGoStep2 ? '#0A1926' : '#4A6A7A',
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
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB', minHeight: '48px' }}>
                                        ← Quay Lại
                                    </button>
                                    <button
                                        onClick={() => setMobileStep(3)}
                                        disabled={validLinesCount === 0}
                                        className="flex-[2] flex items-center justify-center gap-1.5 py-3 text-xs font-bold rounded-xl"
                                        style={{
                                            background: validLinesCount > 0 ? '#87CBB9' : '#1B2E3D',
                                            color: validLinesCount > 0 ? '#0A1926' : '#4A6A7A',
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
                                <div className="p-3 rounded-xl" style={{ background: '#102230', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#D4A853' }}>
                                        Bước 3: Xác Nhận Xuất Kho
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#142433' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Đơn hàng</p>
                                            <p className="text-sm font-bold font-mono" style={{ color: '#D4A853' }}>{selectedSO.soNo}</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#142433' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Kho xuất</p>
                                            <p className="text-sm font-bold" style={{ color: '#8AAEBB' }}>
                                                {warehouses.find(w => w.id === warehouseId)?.code ?? '—'}
                                            </p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#142433' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Sản phẩm</p>
                                            <p className="text-sm font-bold" style={{ color: '#87CBB9' }}>{validLinesCount} loại</p>
                                        </div>
                                        <div className="px-3 py-2 rounded-lg" style={{ background: '#142433' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Tổng nhặt</p>
                                            <p className="text-sm font-bold font-mono" style={{ color: '#87CBB9' }}>{totalPicked.toLocaleString()} chai</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        {selectedSO.lines.map((sol, i) => {
                                            const line = lines[i]
                                            const lot = lotsMap[sol.productId]?.find(l => l.id === line?.lotId)
                                            return (
                                                <div key={sol.productId} className="flex items-center justify-between text-xs px-2.5 py-2 rounded-lg"
                                                    style={{ background: '#142433', border: line?.lotId ? '1px solid rgba(91,168,138,0.2)' : '1px solid rgba(212,168,83,0.2)' }}>
                                                    <div className="min-w-0 pr-2">
                                                        <p className="truncate font-medium" style={{ color: '#E8F1F2' }}>{sol.productName}</p>
                                                        <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>
                                                            {lot ? `📍 ${lot.zone}${lot.rack ? ` / ${lot.rack}` : ''}${lot.bin ? ` / ${lot.bin}` : ''} · ${lot.lotNo}` : '⚠️ Chưa chọn lô'}
                                                        </p>
                                                    </div>
                                                    <span className="font-mono font-bold shrink-0" style={{ color: line?.lotId ? '#5BA88A' : '#D4A853' }}>
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
                                    style={{ background: 'transparent', border: '1px solid #2A4355', color: '#8AAEBB' }}>
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
