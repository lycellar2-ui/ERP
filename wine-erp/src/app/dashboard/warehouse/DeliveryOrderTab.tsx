'use client'

import { useState, useEffect, useMemo } from 'react'
import { Truck, Plus, X, Eye, CheckCircle2, Loader2, Save, PackageCheck, AlertCircle, Search, ArrowRight, Box } from 'lucide-react'
import { toast } from 'sonner'
import {
    type DeliveryOrderRow,
    getDeliveryOrders, getSOsForDelivery, createDeliveryOrder, confirmDeliveryOrder,
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
                return res
            }),
            { loading: 'Đang xác nhận...', success: 'DO đã xác nhận — Hàng đã xuất kho!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    return (
        <div className="space-y-5">
            {/* Header & Sub-tab Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <Truck size={18} style={{ color: '#87CBB9' }} /> Xuất Kho & Nhặt Hàng (Fulfillment)
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Theo dõi đơn hàng cần xuất & Tạo phiếu xuất kho (DO) FIFO</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Navigation Tabs */}
                    <div className="flex p-1 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <button
                            onClick={() => setActiveSubTab('pending')}
                            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all"
                            style={{
                                background: activeSubTab === 'pending' ? '#87CBB9' : 'transparent',
                                color: activeSubTab === 'pending' ? '#0A1926' : '#8AAEBB'
                            }}
                        >
                            <PackageCheck size={14} />
                            Đơn Đang Chờ Xuất
                            {pendingSOs.length > 0 && (
                                <span className="px-1.5 py-0.2 text-[10px] font-extrabold rounded-full"
                                    style={{
                                        background: activeSubTab === 'pending' ? '#0A1926' : 'rgba(212,168,83,0.2)',
                                        color: activeSubTab === 'pending' ? '#87CBB9' : '#D4A853'
                                    }}>
                                    {pendingSOs.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveSubTab('history')}
                            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all"
                            style={{
                                background: activeSubTab === 'history' ? '#87CBB9' : 'transparent',
                                color: activeSubTab === 'history' ? '#0A1926' : '#8AAEBB'
                            }}
                        >
                            <Truck size={14} />
                            Lịch Sử Phiếu DO
                            <span className="text-[10px] opacity-75">({rows.length})</span>
                        </button>
                    </div>

                    <button onClick={() => { setPreselectedSOId(null); setCreateOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all hover:brightness-110"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        <Plus size={14} /> Tạo DO Mới
                    </button>
                </div>
            </div>

            {/* TAB 1: PENDING SALES ORDERS WAITING FOR FULFILLMENT */}
            {activeSubTab === 'pending' && (
                <div className="space-y-4">
                    {/* Search & Stats Bar */}
                    <div className="flex items-center justify-between gap-4 p-3 rounded-xl" style={{ background: '#102230', border: '1px solid #2A4355' }}>
                        <div className="relative flex-1 max-w-md">
                            <Search size={14} className="absolute left-3 top-2.5" style={{ color: '#4A6A7A' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm theo Mã SO, Tên Khách Hàng, SKU..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg outline-none"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            />
                        </div>
                        <div className="text-xs" style={{ color: '#8AAEBB' }}>
                            Hiển thị <span className="font-bold text-white">{filteredPendingSOs.length}</span> / {pendingSOs.length} đơn hàng đã xác nhận
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    ) : filteredPendingSOs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl" style={{ border: '1px dashed #2A4355', background: '#0D1E2B' }}>
                            <CheckCircle2 size={36} style={{ color: '#5BA88A' }} />
                            <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                {searchQuery ? 'Không tìm thấy đơn hàng phù hợp' : 'Không có đơn hàng nào chờ xuất kho'}
                            </p>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Các đơn bán hàng sau khi được xác nhận sẽ tự động xuất hiện ở đây.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredPendingSOs.map(so => {
                                const totalItems = so.lines.reduce((sum, l) => sum + l.qtyOrdered, 0)
                                return (
                                    <div
                                        key={so.id}
                                        className="p-4 rounded-2xl flex flex-col justify-between transition-all"
                                        style={{ background: '#102230', border: '1px solid #2A4355' }}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-1 text-xs font-extrabold font-mono rounded-lg"
                                                        style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                        {so.soNo}
                                                    </span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>
                                                        Sẵn Sàng Xuất Kho
                                                    </span>
                                                </div>
                                                <span className="text-xs font-semibold" style={{ color: '#8AAEBB' }}>
                                                    {so.lines.length} sản phẩm ({totalItems} chai)
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-bold truncate" style={{ color: '#E8F1F2' }}>
                                                {so.customerName}
                                            </h4>

                                            {/* Product Lines Preview */}
                                            <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                                {so.lines.map(line => (
                                                    <div key={line.productId} className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg"
                                                        style={{ background: '#172C3C', border: '1px solid rgba(42,67,85,0.5)' }}>
                                                        <div className="truncate pr-2">
                                                            <span className="font-semibold text-white truncate block">{line.productName}</span>
                                                            <span className="text-[10px] text-[#4A6A7A]">{line.skuCode} {line.vintage ? `· VTG: ${line.vintage}` : ''}</span>
                                                        </div>
                                                        <span className="font-mono font-bold text-[#87CBB9] whitespace-nowrap">
                                                            x{line.qtyOrdered}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                                            <span className="text-[11px]" style={{ color: '#4A6A7A' }}>
                                                Tự động phân bổ lô theo FIFO
                                            </span>
                                            <button
                                                onClick={() => handleStartPicking(so.id)}
                                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all hover:scale-105"
                                                style={{ background: '#87CBB9', color: '#0A1926' }}
                                            >
                                                <Box size={14} /> Nhặt Hàng & Xuất Kho <ArrowRight size={12} />
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
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    {/* Desktop Table (>= 768px) */}
                    <div className="hidden md:block">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Số DO', 'Số SO', 'Kho', 'Dòng', 'SL Xuất', 'Trạng Thái', 'Ngày Tạo', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="text-center py-12">
                                        <Loader2 size={20} className="animate-spin inline" style={{ color: '#87CBB9' }} />
                                    </td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu xuất kho nào được tạo</td></tr>
                                ) : rows.map(d => {
                                    const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                                    return (
                                        <tr key={d.id} className="transition-colors cursor-pointer"
                                            style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                            onClick={() => openDetail(d.id)}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                            <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>{d.doNo}</td>
                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#D4A853' }}>{d.soNo}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{d.warehouseName}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{d.lineCount} SP</td>
                                            <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#E8F1F2' }}>
                                                {d.totalQtyShipped.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(d.createdAt)}</td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => openDetail(d.id)} className="p-1.5 rounded-lg"
                                                        style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}>
                                                        <Eye size={12} />
                                                    </button>
                                                    {d.status === 'DRAFT' && (
                                                        <button onClick={() => handleConfirm(d.id)} className="p-1.5 rounded-lg"
                                                            style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A' }}>
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
                    <div className="block md:hidden p-3 space-y-3">
                        {loading ? (
                            <div className="text-center py-12"><Loader2 size={20} className="animate-spin inline" style={{ color: '#87CBB9' }} /></div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu xuất kho nào</div>
                        ) : rows.map(d => {
                            const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                            return (
                                <div key={d.id} onClick={() => openDetail(d.id)}
                                    className="p-3.5 rounded-xl space-y-2 cursor-pointer transition-all active:scale-[0.99]"
                                    style={{ background: '#102230', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                            DO: {d.doNo}
                                        </span>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
                                            {st.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span style={{ color: '#4A6A7A' }}>Đơn hàng SO: <strong className="font-mono text-[#D4A853]">{d.soNo}</strong></span>
                                        <span style={{ color: '#8AAEBB' }}>Kho: {d.warehouseName}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t text-xs" style={{ borderColor: 'rgba(42,67,85,0.5)' }}>
                                        <span style={{ color: '#8AAEBB' }}>{d.lineCount} sản phẩm · {d.totalQtyShipped.toLocaleString()} chai</span>
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => openDetail(d.id)} className="px-2.5 py-1 text-xs font-semibold rounded-lg"
                                                style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>
                                                Chi Tiết
                                            </button>
                                            {d.status === 'DRAFT' && (
                                                <button onClick={() => handleConfirm(d.id)} className="px-2.5 py-1 text-xs font-bold rounded-lg"
                                                    style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A' }}>
                                                    Xác Nhận
                                                </button>
                                            )}
                                        </div>
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

                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
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

    const handleSave = async () => {
        if (!selectedSO || !warehouseId) return toast.error('Chọn SO và kho')
        const validLines = lines.filter(l => l.qtyPicked > 0 && l.lotId)
        if (validLines.length === 0) return toast.error('Chọn lô hàng cho ít nhất 1 sản phẩm')
        setSaving(true)
        toast.promise(
            createDeliveryOrder({ soId: selectedSO.id, warehouseId, lines: validLines }).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi')
                onCreated()
                return res
            }),
            {
                loading: 'Đang tạo phiếu xuất kho...',
                success: 'Đã tạo Delivery Order!',
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full sm:w-[580px] max-w-full h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="text-base font-bold" style={{ color: '#E8F1F2' }}>Nhặt Hàng & Tạo Phiếu Xuất (DO)</h3>
                        {selectedSO && (
                            <p className="text-xs mt-0.5 font-mono font-semibold" style={{ color: '#D4A853' }}>
                                Đơn hàng: {selectedSO.soNo} · {selectedSO.customerName}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Sales Order *</label>
                            <select value={selectedSO?.id ?? ''} onChange={e => selectSO(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                <option value="">— Chọn SO —</option>
                                {sos.map(s => <option key={s.id} value={s.id}>{s.soNo} — {s.customerName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Kho Xuất *</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                <option value="">— Chọn kho —</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {selectedSO && lines.length > 0 && (
                        <>
                            <div className="flex items-center justify-between pt-2">
                                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                                    Danh Sách Sản Phẩm Nhặt ({lines.length} loại)
                                </p>
                                <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                    Ưu tiên FIFO
                                </span>
                            </div>

                            <div className="space-y-3">
                                {selectedSO.lines.map((sol, i) => (
                                    <div key={sol.productId} className="p-3.5 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{sol.productName}</p>
                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ background: '#1B2E3D', color: '#87CBB9' }}>
                                                Cần xuất: {sol.qtyOrdered}
                                            </span>
                                        </div>
                                        <p className="text-xs mb-3" style={{ color: '#4A6A7A' }}>
                                            SKU: {sol.skuCode} {sol.vintage ? `· VTG: ${sol.vintage}` : ''}
                                        </p>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-semibold block mb-1" style={{ color: '#8AAEBB' }}>Chọn Vị Trí / Lô Hàng Tồn (FIFO)</label>
                                                <select
                                                    value={lines[i]?.lotId ?? ''}
                                                    onChange={e => {
                                                        const lotId = e.target.value
                                                        const availLots = lotsMap[sol.productId] || []
                                                        const chosenLot = availLots.find(l => l.id === lotId)
                                                        const v = [...lines]
                                                        v[i] = { 
                                                            ...v[i], 
                                                            lotId, 
                                                            locationId: chosenLot?.locationId ?? '' 
                                                        }
                                                        setLines(v)
                                                    }}
                                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none font-mono"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: lines[i]?.lotId ? '#D4A853' : '#4A6A7A' }}
                                                >
                                                    <option value="">— Vị Trí / Lô Hàng —</option>
                                                    {(lotsMap[sol.productId] || []).map(lot => (
                                                        <option key={lot.id} value={lot.id}>
                                                            📍 {lot.locationCode} · Lô: {lot.lotNo} (Tồn: {lot.qtyAvailable})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-semibold block mb-1" style={{ color: '#8AAEBB' }}>SL Nhặt</label>
                                                <input type="number" min={0} value={lines[i]?.qtyPicked ?? 0}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], qtyPicked: Number(e.target.value) }; setLines(v)
                                                    }}
                                                    className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold text-center"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#87CBB9' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="pt-2">
                        <button onClick={handleSave} disabled={saving}
                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-xl shadow-md transition-all hover:brightness-110"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Hoàn Tất Nhặt Hàng & Tạo Phiếu DO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
