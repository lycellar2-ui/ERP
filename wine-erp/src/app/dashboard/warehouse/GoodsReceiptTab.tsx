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

const GR_STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
    CONFIRMED: { label: 'Đã Xác Nhận', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
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

    const reload = async () => { setLoading(true); const d = await getGoodsReceipts(); setRows(d); setLoading(false) }
    useEffect(() => { reload() }, [])

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
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                        <PackagePlus size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                            Phiếu Nhập Kho (Goods Receipt)
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Nhập hàng từ Purchase Order vào tồn kho thực tế</p>
                    </div>
                </div>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer active:scale-95">
                    <Plus size={15} /> Tạo GR
                </button>
            </div>

            {/* GR List — Desktop Table */}
            <div className="rounded-2xl overflow-hidden hidden md:block bg-white border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                            {['Số GR', 'Số PO', 'Kho', 'Dòng', 'SL Nhận', 'Trạng Thái', 'Người XN', 'Ngày XN', 'Ngày Tạo', 'Thao Tác'].map(h => (
                                <th key={h} className="px-3.5 py-3 text-[11px] uppercase tracking-wider font-extrabold">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={10} className="text-center py-12">
                                <Loader2 size={20} className="animate-spin inline text-emerald-600" />
                            </td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-12 text-xs text-slate-400 font-medium">Chưa có phiếu nhập kho nào</td></tr>
                        ) : rows.map(gr => {
                            const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                            return (
                                <tr key={gr.id} className="transition-colors cursor-pointer hover:bg-slate-50"
                                    onClick={() => openDetail(gr.id)}>
                                    <td className="px-3.5 py-3">
                                        <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            {gr.grNo}
                                        </span>
                                    </td>
                                    <td className="px-3.5 py-3 text-xs font-mono text-amber-700 font-bold">{gr.poNo}</td>
                                    <td className="px-3.5 py-3 text-xs text-slate-700 font-medium">{gr.warehouseName}</td>
                                    <td className="px-3.5 py-3 text-xs text-slate-500 font-medium">{gr.lineCount} SP</td>
                                    <td className="px-3.5 py-3 text-xs font-bold font-mono text-slate-900">
                                        {gr.totalQtyReceived.toLocaleString()}
                                    </td>
                                    <td className="px-3.5 py-3">
                                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                                            {st.label}
                                        </span>
                                    </td>
                                    <td className="px-3.5 py-3 text-xs text-slate-600 font-medium">
                                        {gr.confirmedBy ?? '—'}
                                    </td>
                                    <td className="px-3.5 py-3 text-xs text-slate-500 font-medium">
                                        {gr.confirmedAt ? formatDate(gr.confirmedAt) : '—'}
                                    </td>
                                    <td className="px-3.5 py-3 text-xs text-slate-500 font-medium">{formatDate(gr.createdAt)}</td>
                                    <td className="px-3.5 py-3">
                                        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => openDetail(gr.id)} className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer">
                                                <Eye size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* GR List — Mobile Cards */}
            <div className="block md:hidden space-y-2">
                {loading ? (
                    <div className="text-center py-12"><Loader2 size={20} className="animate-spin inline text-emerald-600" /></div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">Chưa có phiếu nhập kho</div>
                ) : rows.map(gr => {
                    const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                    return (
                        <div key={gr.id} onClick={() => openDetail(gr.id)}
                            className="p-3.5 rounded-2xl space-y-2 cursor-pointer transition-all active:scale-[0.99] bg-white border border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    GR: {gr.grNo}
                                </span>
                                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border" style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                                    {st.label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">PO: <strong className="font-mono text-amber-700">{gr.poNo}</strong></span>
                                <span className="text-slate-700 font-medium">Kho: {gr.warehouseName}</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                <span className="text-slate-500">{gr.lineCount} sản phẩm · <strong className="font-mono text-slate-900">{gr.totalQtyReceived.toLocaleString()}</strong> chai</span>
                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openDetail(gr.id)} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                                        Chi Tiết
                                    </button>
                                    {gr.status === 'DRAFT' && (
                                        <button onClick={() => handleConfirm(gr.id)} className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                                            Xác Nhận
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Detail Drawer */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
                    <div className="w-full sm:w-[560px] max-w-full h-full overflow-y-auto bg-white border-l border-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900">
                                    Chi Tiết GR {detailData?.grNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5 text-slate-500 font-medium">
                                        PO: {detailData.poNo} · NCC: {detailData.supplierName} · Kho: {detailData.warehouseName}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setDetailData(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
                        </div>
                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-emerald-600" /></div>
                        ) : detailData && (
                            <div className="p-5 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <InfoCard label="Trạng thái" value={(GR_STATUS[detailData.status] ?? GR_STATUS.DRAFT).label} />
                                    <InfoCard label="Ngày tạo" value={formatDate(detailData.createdAt)} />
                                    <InfoCard label="Người xác nhận" value={detailData.confirmedBy ?? '—'} />
                                    <InfoCard label="Ngày xác nhận" value={detailData.confirmedAt ? formatDate(detailData.confirmedAt) : '—'} />
                                </div>

                                {/* Detail Lines — Desktop Table */}
                                <div className="rounded-2xl overflow-hidden hidden sm:block bg-white border border-slate-200">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700">
                                                {['SKU', 'Sản Phẩm', 'Lô', 'Vị Trí', 'Dự Kiến', 'Thực Nhận', 'Chênh Lệch'].map(h => (
                                                    <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-extrabold">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {detailData.lines.map(l => (
                                                <tr key={l.id} className="hover:bg-slate-50">
                                                    <td className="px-3 py-2 text-xs font-bold font-mono text-emerald-700">{l.skuCode}</td>
                                                    <td className="px-3 py-2 text-xs font-bold text-slate-900">{l.productName}</td>
                                                    <td className="px-3 py-2 text-xs font-mono text-amber-700 font-bold">{l.lotNo}</td>
                                                    <td className="px-3 py-2 text-xs font-mono text-slate-600">{l.locationCode}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold text-slate-700">{l.qtyExpected}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold text-emerald-600">{l.qtyReceived}</td>
                                                    <td className="px-3 py-2 text-xs font-mono font-bold text-slate-700">
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
        <div className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">{label}</p>
            <p className="text-sm font-extrabold mt-0.5 text-slate-900">{value}</p>
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

    const inputCls = "w-full px-3 py-2 rounded-xl text-xs outline-none bg-white border border-slate-200 text-slate-900 focus:border-emerald-500 shadow-2xs"

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full sm:w-[560px] max-w-full h-full overflow-y-auto bg-white border-l border-slate-200 shadow-2xl">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h3 className="text-base font-extrabold text-slate-900">Tạo Phiếu Nhập Kho (GR)</h3>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold mb-1 text-slate-700">Purchase Order *</label>
                            <select value={selectedPO?.id ?? ''} onChange={e => selectPO(e.target.value)} className={inputCls}>
                                <option value="">— Chọn PO —</option>
                                {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 text-slate-700">Kho Nhận *</label>
                            <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className={inputCls}>
                                <option value="">— Chọn kho —</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {selectedPO && lines.length > 0 && (
                        <>
                            <p className="text-xs font-extrabold uppercase tracking-wide text-amber-700">
                                Sản Phẩm ({lines.length} dòng)
                            </p>
                            <div className="space-y-2">
                                {selectedPO.lines.map((pol, i) => (
                                    <div key={pol.productId} className="p-3 rounded-2xl bg-white border border-slate-200 space-y-2">
                                        <p className="text-xs font-extrabold text-slate-900">{pol.productName}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {pol.skuCode} · PO qty: {pol.qtyOrdered}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] font-bold block mb-0.5 text-slate-600">SL Thực Nhận</label>
                                                <input type="number" min={0} value={lines[i]?.qtyReceived ?? 0}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], qtyReceived: Number(e.target.value) }; setLines(v)
                                                    }}
                                                    className={inputCls} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold block mb-0.5 text-slate-600">Vị Trí Kho</label>
                                                <input type="text" placeholder="VD: loc_id" value={lines[i]?.locationId ?? ''}
                                                    onChange={e => {
                                                        const v = [...lines]; v[i] = { ...v[i], locationId: e.target.value }; setLines(v)
                                                    }}
                                                    className={inputCls} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <button onClick={handleSave} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Tạo Phiếu Nhập Kho
                    </button>
                </div>
            </div>
        </div>
    )
}
