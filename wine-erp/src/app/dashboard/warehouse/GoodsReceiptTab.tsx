'use client'

import { useState, useEffect } from 'react'
import { PackagePlus, Plus, X, Eye, CheckCircle2, Loader2, ChevronRight, AlertCircle, Save, Package } from 'lucide-react'
import { toast } from 'sonner'
import {
    type GoodsReceiptRow,
    getGoodsReceipts, getPOsForReceiving, createGoodsReceipt, confirmGoodsReceipt,
    getGRDetail,
} from './actions'
import { formatDate, formatVND } from '@/lib/utils'

type POOption = {
    id: string; poNo: string; supplierName: string
    lines: { productId: string; productName: string; skuCode: string; qtyOrdered: number }[]
}

type LocationOption = { id: string; locationCode: string }

const GR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.15)' },
    CONFIRMED: { label: 'Đã Xác Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
}

type GRDetail = Awaited<ReturnType<typeof getGRDetail>>

export function GoodsReceiptTab({ warehouses }: {
    warehouses: { id: string; code: string; name: string }[]
}) {
    const [rows, setRows] = useState<GoodsReceiptRow[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailData, setDetailData] = useState<GRDetail>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    useEffect(() => { reload() }, [])
    const reload = async () => { setLoading(true); const d = await getGoodsReceipts(); setRows(d); setLoading(false) }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        const data = await getGRDetail(id)
        setDetailData(data)
        setDetailLoading(false)
    }

    const handleConfirm = async (id: string) => {
        if (!confirm('Xác nhận Goods Receipt? Tồn kho sẽ được cập nhật.')) return
        toast.promise(
            confirmGoodsReceipt(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi xác nhận GR')
                reload()
                return res
            }),
            { loading: 'Đang xác nhận...', success: 'GR đã xác nhận — Tồn kho đã cập nhật!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <PackagePlus size={16} style={{ color: '#87CBB9' }} /> Phiếu Nhập Kho (Goods Receipt)
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Nhập hàng từ Purchase Order → Tồn kho</p>
                </div>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={14} /> Tạo GR
                </button>
            </div>

            {/* GR List Table */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Số GR', 'Số PO', 'Kho', 'Dòng', 'SL Nhận', 'Trạng Thái', 'Người XN', 'Ngày XN', 'Ngày Tạo', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="text-center py-12">
                                <Loader2 size={20} className="animate-spin inline" style={{ color: '#87CBB9' }} />
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu nhập kho</td></tr>
                        ) : rows.map(gr => {
                            const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                            return (
                                <tr key={gr.id} className="transition-colors cursor-pointer"
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                    onClick={() => openDetail(gr.id)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{gr.grNo}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#D4A853', fontFamily: '"DM Mono", monospace' }}>{gr.poNo}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{gr.warehouseName}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{gr.lineCount} SP</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>
                                        {gr.totalQtyReceived.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: gr.confirmedBy ? '#5BA88A' : '#2A4355' }}>
                                        {gr.confirmedBy ?? '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
                                        {gr.confirmedAt ? formatDate(gr.confirmedAt) : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(gr.createdAt)}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => openDetail(gr.id)} className="p-1.5 rounded-lg"
                                                style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}>
                                                <Eye size={12} />
                                            </button>
                                            {gr.status === 'DRAFT' && (
                                                <button onClick={() => handleConfirm(gr.id)} className="p-1.5 rounded-lg"
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
                                    Chi Tiết GR {detailData?.grNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                        PO: {detailData.poNo} · NCC: {detailData.supplierName} · Kho: {detailData.warehouseName}
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
                                    <InfoCard label="Trạng thái" value={(GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).label} />
                                    <InfoCard label="Ngày tạo" value={formatDate(detailData.createdAt)} />
                                    <InfoCard label="Người xác nhận" value={detailData.confirmedBy ?? '—'} />
                                    <InfoCard label="Ngày xác nhận" value={detailData.confirmedAt ? formatDate(detailData.confirmedAt) : '—'} />
                                </div>

                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                                {['SKU', 'Sản Phẩm', 'Lô', 'Vị Trí', 'Dự Kiến', 'Thực Nhận', 'Chênh Lệch'].map(h => (
                                                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.lines.map(l => (
                                                <tr key={l.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}>
                                                    <td className="px-3 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{l.skuCode}</td>
                                                    <td className="px-3 py-2 text-xs" style={{ color: '#E8F1F2' }}>{l.productName}</td>
                                                    <td className="px-3 py-2 text-xs font-mono" style={{ color: '#D4A853' }}>{l.lotNo}</td>
                                                    <td className="px-3 py-2 text-xs font-mono" style={{ color: '#8AAEBB' }}>{l.locationCode}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#E8F1F2' }}>{l.qtyExpected}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: '#87CBB9' }}>{l.qtyReceived}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold" style={{
                                                        color: l.variance === 0 ? '#4A6A7A' : l.variance < 0 ? '#8B1A2E' : '#D4A853',
                                                    }}>
                                                        {l.variance === 0 ? '—' : (l.variance > 0 ? '+' : '') + l.variance}
                                                    </td>
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

            {/* Create GR Drawer */}
            {createOpen && <CreateGRDrawer warehouses={warehouses} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); reload() }} />}
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

// ── Create GR Drawer ───────────────────────────────
function CreateGRDrawer({ warehouses, onClose, onCreated }: {
    warehouses: { id: string; code: string; name: string }[]
    onClose: () => void; onCreated: () => void
}) {
    const [pos, setPOs] = useState<POOption[]>([])
    const [selectedPO, setSelectedPO] = useState<POOption | null>(null)
    const [warehouseId, setWarehouseId] = useState('')
    const [lines, setLines] = useState<{ productId: string; qtyReceived: number; locationId: string }[]>([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        getPOsForReceiving().then(data => {
            setPOs(data as any)
        })
    }, [])

    const selectPO = (poId: string) => {
        const po = pos.find(p => p.id === poId) || null
        setSelectedPO(po)
        if (po) {
            setLines(po.lines.map(l => ({
                productId: l.productId,
                qtyReceived: l.qtyOrdered,
                locationId: '',
            })))
        }
    }

    const handleSave = async () => {
        if (!selectedPO || !warehouseId) return toast.error('Chọn PO và kho')
        const validLines = lines.filter(l => l.qtyReceived > 0 && l.locationId)
        if (validLines.length === 0) return toast.error('Nhập số lượng và chọn vị trí')
        setSaving(true)
        toast.promise(
            createGoodsReceipt({ poId: selectedPO.id, warehouseId, lines: validLines }).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi')
                onCreated()
                return res
            }),
            {
                loading: 'Đang tạo phiếu nhập kho...',
                success: 'Đã tạo Goods Receipt!',
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-[560px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Phiếu Nhập Kho (GR)</h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Purchase Order *</label>
                            <select value={selectedPO?.id ?? ''} onChange={e => selectPO(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                <option value="">— Chọn PO —</option>
                                {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Kho Nhận *</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                <option value="">— Chọn kho —</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {selectedPO && lines.length > 0 && (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D4A853' }}>
                                Sản Phẩm ({lines.length} dòng)
                            </p>
                            <div className="space-y-2">
                                {selectedPO.lines.map((pol, i) => (
                                    <div key={pol.productId} className="p-3 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{pol.productName}</p>
                                        <p className="text-xs mb-2" style={{ color: '#4A6A7A' }}>
                                            {pol.skuCode} · PO qty: {pol.qtyOrdered}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] block mb-0.5" style={{ color: '#4A6A7A' }}>SL Thực Nhận</label>
                                                <input type="number" min={0} value={lines[i]?.qtyReceived ?? 0}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], qtyReceived: Number(e.target.value) }; setLines(v)
                                                    }}
                                                    className="w-full px-2 py-1.5 rounded text-xs"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853' }} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] block mb-0.5" style={{ color: '#4A6A7A' }}>Vị Trí Kho</label>
                                                <input type="text" placeholder="VD: loc_id" value={lines[i]?.locationId ?? ''}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], locationId: e.target.value }; setLines(v)
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
                        Tạo Phiếu Nhập Kho
                    </button>
                </div>
            </div>
        </div>
    )
}
