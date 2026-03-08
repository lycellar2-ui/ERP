'use client'

import { useState, useEffect } from 'react'
import { Truck, Plus, X, Eye, CheckCircle2, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
    type DeliveryOrderRow,
    getDeliveryOrders, getSOsForDelivery, createDeliveryOrder, confirmDeliveryOrder,
    getDODetail,
} from './actions'
import { formatDate } from '@/lib/utils'

type SOOption = {
    id: string; soNo: string; customerName: string
    lines: { productId: string; productName: string; skuCode: string; qtyOrdered: number }[]
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
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailData, setDetailData] = useState<DODetail>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    useEffect(() => { reload() }, [])
    const reload = async () => { setLoading(true); const d = await getDeliveryOrders(); setRows(d); setLoading(false) }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        const data = await getDODetail(id)
        setDetailData(data)
        setDetailLoading(false)
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
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <Truck size={16} style={{ color: '#87CBB9' }} /> Phiếu Xuất Kho (Delivery Order)
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Xuất hàng từ Sales Order → FIFO picking</p>
                </div>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={14} /> Tạo DO
                </button>
            </div>

            {/* DO List Table */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
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
                            <tr><td colSpan={8} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu xuất kho</td></tr>
                        ) : rows.map(d => {
                            const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                            return (
                                <tr key={d.id} className="transition-colors cursor-pointer"
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                    onClick={() => openDetail(d.id)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{d.doNo}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#D4A853', fontFamily: '"DM Mono", monospace' }}>{d.soNo}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{d.warehouseName}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{d.lineCount} SP</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>
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

            {/* Detail Drawer */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[560px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
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
                                                    <td className="px-3 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
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

            {/* Create DO Drawer  */}
            {createOpen && <CreateDODrawer warehouses={warehouses} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); reload() }} />}
        </div>
    )
}

// Small info card helper
function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-3 py-2.5 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: '#E8F1F2' }}>{value}</p>
        </div>
    )
}

// ── Create DO Drawer ──────────────────────────────
function CreateDODrawer({ warehouses, onClose, onCreated }: {
    warehouses: { id: string; code: string; name: string }[]
    onClose: () => void; onCreated: () => void
}) {
    const [sos, setSOs] = useState<SOOption[]>([])
    const [selectedSO, setSelectedSO] = useState<SOOption | null>(null)
    const [warehouseId, setWarehouseId] = useState('')
    const [lines, setLines] = useState<{ productId: string; lotId: string; locationId: string; qtyPicked: number }[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => { getSOsForDelivery().then(data => setSOs(data as any)) }, [])

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
        }
    }

    const handleSave = async () => {
        if (!selectedSO || !warehouseId) return toast.error('Chọn SO và kho')
        const validLines = lines.filter(l => l.qtyPicked > 0 && l.lotId)
        if (validLines.length === 0) return toast.error('Chọn lô hàng')
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
            <div className="w-[560px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Phiếu Xuất Kho (DO)</h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Sales Order *</label>
                            <select value={selectedSO?.id ?? ''} onChange={e => selectSO(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
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
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                                Sản Phẩm ({lines.length} dòng)
                            </p>
                            <div className="space-y-2">
                                {selectedSO.lines.map((sol, i) => (
                                    <div key={sol.productId} className="p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{sol.productName}</p>
                                        <p className="text-xs mb-2" style={{ color: '#4A6A7A' }}>
                                            {sol.skuCode} · SO qty: {sol.qtyOrdered}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] block mb-0.5" style={{ color: '#4A6A7A' }}>Lot ID (FIFO)</label>
                                                <input type="text" placeholder="lot_id" value={lines[i]?.lotId ?? ''}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], lotId: e.target.value }; setLines(v)
                                                    }}
                                                    className="w-full px-2 py-1.5 rounded text-xs"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853' }} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] block mb-0.5" style={{ color: '#4A6A7A' }}>SL Pick</label>
                                                <input type="number" min={0} value={lines[i]?.qtyPicked ?? 0}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], qtyPicked: Number(e.target.value) }; setLines(v)
                                                    }}
                                                    className="w-full px-2 py-1.5 rounded text-xs"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Tạo Phiếu Xuất Kho
                    </button>
                </div>
            </div>
        </div>
    )
}
