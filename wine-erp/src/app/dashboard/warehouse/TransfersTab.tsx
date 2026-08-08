'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft, Plus, X, Save, ChevronRight, Eye, Ban, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
    type TransferOrderRow,
    getTransferOrders, createTransferOrder, advanceTransferStatus, getTransferOptions,
    cancelTransferOrder, getTransferDetail,
} from '../transfers/actions'
import { formatDate } from '@/lib/utils'

type WarehouseOption = { id: string; code: string; name: string }
type ProductOption = { id: string; skuCode: string; productName: string }
type TODetail = Awaited<ReturnType<typeof getTransferDetail>>

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; next?: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: '#F1F5F9', next: '→ Xác Nhận' },
    CONFIRMED: { label: 'Đã XN', color: '#B47816', bg: 'rgba(212,168,83,0.15)', next: '→ Xuất Kho' },
    IN_TRANSIT: { label: 'Đang Chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', next: '→ Nhận Kho' },
    RECEIVED: { label: 'Đã Nhận', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
    CANCELLED: { label: 'Đã Hủy', color: '#DC2626', bg: 'rgba(220,38,38,0.12)' },
}

export function TransfersTab() {
    const [rows, setRows] = useState<TransferOrderRow[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [options, setOptions] = useState<{ warehouses: WarehouseOption[]; products: ProductOption[] }>({ warehouses: [], products: [] })
    const [form, setForm] = useState({ fromWarehouseId: '', toWarehouseId: '', notes: '' })
    const [lines, setLines] = useState<{ productId: string; qtyTransferred: number }[]>([])
    const [detailData, setDetailData] = useState<TODetail>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const reload = async () => {
        setLoading(true)
        try {
            const data = await getTransferOrders()
            setRows(data)
        } catch (err: any) {
            toast.error('Lỗi tải danh sách chuyển kho: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { reload() }, [])

    const openCreate = async () => {
        try {
            const opts = await getTransferOptions()
            setOptions(opts)
            setCreateOpen(true)
        } catch (err: any) {
            toast.error('Lỗi tải danh mục: ' + err.message)
        }
    }

    const addLine = () => setLines(prev => [...prev, { productId: '', qtyTransferred: 0 }])

    const handleCreate = async () => {
        const validLines = lines.filter(l => l.productId && l.qtyTransferred > 0)
        if (!form.fromWarehouseId || !form.toWarehouseId || validLines.length === 0) {
            toast.error('Vui lòng chọn đủ Kho xuất, Kho nhận và ít nhất 1 sản phẩm')
            return
        }
        toast.promise(
            createTransferOrder({ ...form, lines: validLines }).then(async (res: { success: boolean; error?: string }) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo lệnh chuyển kho')
                setCreateOpen(false)
                setForm({ fromWarehouseId: '', toWarehouseId: '', notes: '' })
                setLines([])
                reload()
                return res
            }),
            { loading: 'Đang tạo lệnh chuyển kho...', success: '✅ Đã tạo lệnh chuyển kho thành công!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const handleAdvance = async (id: string) => {
        toast.promise(
            advanceTransferStatus(id).then(async (res: { success: boolean; error?: string }) => {
                if (!res.success) throw new Error(res.error || 'Lỗi cập nhật')
                reload()
                return res
            }),
            { loading: 'Đang cập nhật trạng thái...', success: '✅ Đã chuyển trạng thái!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const handleCancel = async (id: string) => {
        if (!confirm('Hủy lệnh chuyển kho này?')) return
        toast.promise(
            cancelTransferOrder(id).then(async (res: { success: boolean; error?: string }) => {
                if (!res.success) throw new Error(res.error || 'Lỗi hủy')
                reload()
                return res
            }),
            { loading: 'Đang hủy...', success: 'Đã hủy lệnh chuyển kho', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        try {
            const data = await getTransferDetail(id)
            setDetailData(data)
        } catch (err: any) {
            toast.error('Lỗi tải chi tiết: ' + err.message)
        } finally {
            setDetailLoading(false)
        }
    }

    const inTransitCount = rows.filter(r => r.status === 'IN_TRANSIT').length
    const completedCount = rows.filter(r => r.status === 'RECEIVED').length

    return (
        <div className="space-y-4">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                        <ArrowRightLeft size={18} style={{ color: '#D4A853' }} /> Chuyển Kho Nội Bộ (Transfer Orders)
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                        Luân chuyển sản phẩm giữa các kho hàng & điểm lưu kho
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={reload} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" style={{ color: '#64748B' }} title="Làm mới">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all hover:brightness-105"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        <Plus size={14} /> Tạo Lệnh Chuyển Kho
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Tổng Số Lệnh', value: rows.length, accent: '#0F172A' },
                    { label: 'Đang Vận Chuyển', value: inTransitCount, accent: '#2563EB' },
                    { label: 'Đã Nhận Kho', value: completedCount, accent: '#16A34A' },
                ].map(s => (
                    <div key={s.label} className="p-3.5 rounded-xl shadow-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>{s.label}</p>
                        <p className="text-lg font-bold font-mono mt-0.5" style={{ color: s.accent }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                {['Mã TO', 'Từ Kho', '→', 'Đến Kho', 'SP', 'Tổng SL', 'Trạng Thái', 'Ngày', ''].map(h => (
                                    <th key={h} className="px-3.5 py-2.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12">
                                        <Loader2 size={20} className="animate-spin inline" style={{ color: '#D4A853' }} />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="text-center py-12 text-xs" style={{ color: '#64748B' }}>Chưa có lệnh chuyển kho nào</td>
                                </tr>
                            ) : rows.map((r: TransferOrderRow) => {
                                const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                                return (
                                    <tr key={r.id} className="transition-colors cursor-pointer hover:bg-slate-50"
                                        style={{ borderBottom: '1px solid #F1F5F9' }}
                                        onClick={() => openDetail(r.id)}>
                                        <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#B47816' }}>{r.transferNo}</td>
                                        <td className="px-3.5 py-3 text-xs font-bold" style={{ color: '#0F172A' }}>{r.fromWarehouse}</td>
                                        <td className="px-3.5 py-3"><ArrowRightLeft size={12} className="text-[#94A3B8]" /></td>
                                        <td className="px-3.5 py-3 text-xs font-bold" style={{ color: '#0F172A' }}>{r.toWarehouse}</td>
                                        <td className="px-3.5 py-3 text-xs" style={{ color: '#475569' }}>{r.lineCount} loại</td>
                                        <td className="px-3.5 py-3 text-xs font-bold font-mono" style={{ color: '#0F172A' }}>{r.totalQty.toLocaleString()}</td>
                                        <td className="px-3.5 py-3">
                                            <span className="text-[10px] px-2.5 py-0.5 rounded-md font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                        </td>
                                        <td className="px-3.5 py-3 text-[11px]" style={{ color: '#64748B' }}>{formatDate(r.createdAt)}</td>
                                        <td className="px-3.5 py-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => openDetail(r.id)} className="p-1.5 rounded-lg hover:bg-slate-100"
                                                    style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }} title="Xem chi tiết">
                                                    <Eye size={13} />
                                                </button>
                                                {st.next && (
                                                    <button onClick={() => handleAdvance(r.id)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all hover:brightness-105"
                                                        style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                                        {st.next} <ChevronRight size={12} />
                                                    </button>
                                                )}
                                                {r.status === 'DRAFT' && (
                                                    <button onClick={() => handleCancel(r.id)} className="p-1.5 rounded-lg hover:bg-red-50"
                                                        style={{ color: '#DC2626' }} title="Hủy">
                                                        <Ban size={13} />
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
            </div>

            {/* Detail Drawer */}
            {(detailData || detailLoading) && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15,23,42,0.4)' }}>
                    <div className="w-full sm:w-[540px] max-w-full h-full overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                    Chi Tiết Lệnh Chuyển {detailData?.transferNo ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5 font-medium" style={{ color: '#64748B' }}>
                                        {detailData.fromWarehouse} → {detailData.toWarehouse}
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
                                    <InfoCard label="Trạng thái" value={(STATUS_CFG[detailData.status] ?? STATUS_CFG.DRAFT).label} />
                                    <InfoCard label="Ngày tạo" value={formatDate(detailData.createdAt)} />
                                    <InfoCard label="Ngày xác nhận" value={detailData.confirmedAt ? formatDate(detailData.confirmedAt) : '—'} />
                                    <InfoCard label="Ngày nhận kho" value={detailData.receivedAt ? formatDate(detailData.receivedAt) : '—'} />
                                </div>
                                {detailData.notes && (
                                    <div className="px-3 py-2.5 rounded-lg text-xs" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
                                        📝 Ghi chú: {detailData.notes}
                                    </div>
                                )}

                                <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                {['SKU', 'Sản Phẩm', 'SL Chuyển', 'SL Nhận'].map(h => (
                                                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detailData.lines.map(l => (
                                                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                    <td className="px-3 py-2 text-xs font-bold font-mono" style={{ color: '#B47816' }}>{l.skuCode}</td>
                                                    <td className="px-3 py-2 text-xs" style={{ color: '#0F172A' }}>{l.productName}</td>
                                                    <td className="px-3 py-2 text-xs font-bold font-mono" style={{ color: '#0F172A' }}>{l.qtyTransferred}</td>
                                                    <td className="px-3 py-2 text-xs font-bold font-mono text-[#16A34A]">{l.qtyReceived}</td>
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

            {/* Create Drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15,23,42,0.4)' }}>
                    <div className="w-full sm:w-[500px] max-w-full h-full overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>Tạo Lệnh Chuyển Kho Nội Bộ</h3>
                            <button onClick={() => setCreateOpen(false)} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Kho Xuất *</label>
                                    <select value={form.fromWarehouseId} onChange={e => setForm(prev => ({ ...prev, fromWarehouseId: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                                        <option value="">— Chọn kho xuất —</option>
                                        {options.warehouses.map((w: WarehouseOption) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Kho Nhận *</label>
                                    <select value={form.toWarehouseId} onChange={e => setForm(prev => ({ ...prev, toWarehouseId: e.target.value }))}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                                        <option value="">— Chọn kho nhận —</option>
                                        {options.warehouses.filter(w => w.id !== form.fromWarehouseId).map((w: WarehouseOption) =>
                                            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Ghi Chú</label>
                                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                    placeholder="VD: Bổ sung hàng showroom..." />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B47816' }}>Sản Phẩm Chuyển</p>
                                    <button onClick={addLine} className="text-xs px-2.5 py-1 rounded-lg font-bold" style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                        <Plus size={12} className="inline" /> Thêm Dòng
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {lines.map((l, i) => (
                                        <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                            <div className="col-span-8">
                                                <select value={l.productId} onChange={e => {
                                                    const v = [...lines]; v[i] = { ...v[i], productId: e.target.value }; setLines(v)
                                                }}
                                                    className="w-full px-2.5 py-2 rounded-lg text-xs outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                                                    <option value="">— Chọn SP —</option>
                                                    {options.products.map((p: ProductOption) => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-3">
                                                <input type="number" min={1} value={l.qtyTransferred || ''}
                                                    onChange={e => { const v = [...lines]; v[i] = { ...v[i], qtyTransferred: Number(e.target.value) }; setLines(v) }}
                                                    className="w-full px-2.5 py-2 rounded-lg text-xs text-center font-bold" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                                    placeholder="SL" />
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <button onClick={() => { const v = [...lines]; v.splice(i, 1); setLines(v) }} style={{ color: '#DC2626' }}>
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {lines.length === 0 && (
                                        <p className="text-xs text-center py-4 italic" style={{ color: '#64748B' }}>Nhấn "Thêm Dòng" để chọn sản phẩm chuyển kho</p>
                                    )}
                                </div>
                            </div>

                            <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl shadow-md transition-all hover:brightness-105 mt-4"
                                style={{ background: '#D4A853', color: '#0A1926', minHeight: '44px' }}>
                                <Save size={14} /> Tạo Lệnh Chuyển Kho
                            </button>
                        </div>
                    </div>
                </div>
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
