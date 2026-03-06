'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft, Plus, Play, CheckCircle2, Factory, Store, X, Truck, Ban, Save, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
    type TransferOrderRow,
    getTransferOrders, createTransferOrder, advanceTransferStatus, getTransferOptions,
} from './actions'
import { formatDate } from '@/lib/utils'

type WarehouseOption = { id: string; code: string; name: string };
type ProductOption = { id: string; skuCode: string; productName: string };

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; next?: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.15)', next: '→ Xác Nhận' },
    CONFIRMED: { label: 'Đã XN', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', next: '→ Xuất Kho' },
    IN_TRANSIT: { label: 'Đang Chuyển', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)', next: '→ Nhận Kho' },
    RECEIVED: { label: 'Đã Nhận', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    CANCELLED: { label: 'Hủy', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

export function TransfersClient({ initialRows, stats }: {
    initialRows: TransferOrderRow[]
    stats: { total: number; inTransit: number; completed: number }
}) {
    const [rows, setRows] = useState<TransferOrderRow[]>(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [options, setOptions] = useState<{ warehouses: WarehouseOption[]; products: ProductOption[] }>({ warehouses: [], products: [] })
    const [form, setForm] = useState({ fromWarehouseId: '', toWarehouseId: '', notes: '' })
    const [lines, setLines] = useState<{ productId: string; qtyTransferred: number }[]>([])

    const reload = async () => { const data = await getTransferOrders(); setRows(data) }

    const openCreate = async () => {
        const opts = await getTransferOptions()
        setOptions(opts)
        setCreateOpen(true)
    }

    const addLine = () => setLines(prev => [...prev, { productId: '', qtyTransferred: 0 }])

    const handleCreate = async () => {
        const validLines = lines.filter(l => l.productId && l.qtyTransferred > 0)
        if (!form.fromWarehouseId || !form.toWarehouseId || validLines.length === 0) {
            toast.error('Điền đủ thông tin')
            return
        }

        toast.promise(
            createTransferOrder({ ...form, lines: validLines }).then(async (res: { success: boolean; error?: string }) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo lệnh chuyển kho')
                setCreateOpen(false); setForm({ fromWarehouseId: '', toWarehouseId: '', notes: '' }); setLines([]); reload()
                return res
            }),
            {
                loading: 'Đang tạo lệnh chuyển kho...',
                success: 'Đã tạo lệnh chuyển kho!',
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
    }

    const handleAdvance = async (id: string) => {
        toast.promise(
            advanceTransferStatus(id).then(async (res: { success: boolean; error?: string }) => {
                if (!res.success) throw new Error(res.error || 'Lỗi cập nhật trạng thái')
                reload()
                return res
            }),
            {
                loading: 'Đang cập nhật trạng thái...',
                success: 'Đã cập nhật trạng thái chuyến!',
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Chuyển Kho Nội Bộ
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Transfer Orders — Di chuyển hàng giữa các kho
                    </p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo Lệnh Chuyển
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng Lệnh', value: stats.total, accent: '#87CBB9' },
                    { label: 'Đang Vận Chuyển', value: stats.inTransit, accent: '#D4A853' },
                    { label: 'Đã Hoàn Thành', value: stats.completed, accent: '#5BA88A' },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: s.accent }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Mã TO', 'Từ Kho', '→', 'Đến Kho', 'SP', 'Tổng SL', 'Trạng Thái', 'Ngày', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có lệnh chuyển kho</td></tr>
                        ) : rows.map((r: TransferOrderRow) => {
                            const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{r.transferNo}</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2' }}>{r.fromWarehouse}</td>
                                    <td className="px-3 py-2.5"><ArrowRightLeft size={12} className="text-[#4A6A7A]" /></td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2' }}>{r.toWarehouse}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{r.lineCount} SKU</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{r.totalQty}</td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(r.createdAt)}</td>
                                    <td className="px-3 py-2.5">
                                        {st.next && (
                                            <button onClick={() => handleAdvance(r.id)} className="flex items-center gap-1 text-xs px-2 py-1 rounded font-semibold"
                                                style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                                {st.next} <ChevronRight size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Create Drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[480px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Lệnh Chuyển Kho</h3>
                            <button onClick={() => setCreateOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Kho Xuất</label>
                                    <select value={form.fromWarehouseId} onChange={e => setForm(prev => ({ ...prev, fromWarehouseId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        <option value="">— Chọn —</option>
                                        {options.warehouses.map((w: WarehouseOption) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Kho Nhận</label>
                                    <select value={form.toWarehouseId} onChange={e => setForm(prev => ({ ...prev, toWarehouseId: e.target.value }))}
                                        className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                        <option value="">— Chọn —</option>
                                        {options.warehouses.filter(w => w.id !== form.fromWarehouseId).map((w: WarehouseOption) =>
                                            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Ghi Chú</label>
                                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                    placeholder="VD: Bổ sung tồn showroom" />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D4A853' }}>Sản Phẩm Chuyển</p>
                                    <button onClick={addLine} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                        <Plus size={12} className="inline" /> Thêm
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {lines.map((l, i) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 items-end">
                                            <div className="col-span-8">
                                                <select value={l.productId} onChange={e => {
                                                    const v = [...lines]; v[i] = { ...v[i], productId: e.target.value }; setLines(v)
                                                }}
                                                    className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                                    <option value="">— SP —</option>
                                                    {options.products.map((p: ProductOption) => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" min={1} value={l.qtyTransferred || ''}
                                                    onChange={e => { const v = [...lines]; v[i] = { ...v[i], qtyTransferred: Number(e.target.value) }; setLines(v) }}
                                                    className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#142433', border: '1px solid #2A4355', color: '#D4A853' }}
                                                    placeholder="SL" />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <button onClick={() => { const v = [...lines]; v.splice(i, 1); setLines(v) }} style={{ color: '#8B1A2E' }}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {lines.length === 0 && (
                                        <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Nhấn "Thêm" để thêm sản phẩm</p>
                                    )}
                                </div>
                            </div>

                            <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <Save size={14} /> Tạo Lệnh Chuyển Kho
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
