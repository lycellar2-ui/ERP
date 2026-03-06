'use client'

import { useState, useEffect } from 'react'
import { RotateCcw, Plus, X, Save, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
    type ReturnOrderRow,
    getReturnOrders, createReturnOrder, approveReturnOrder,
    getSOOptionsForReturn, getSOLinesForReturn
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.15)' },
    PENDING_INSPECTION: { label: 'Chờ Kiểm Tra', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    APPROVED: { label: 'Đã Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    REJECTED: { label: 'Từ Chối', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
    COMPLETED: { label: 'Hoàn Thành', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
}

export function ReturnsClient({ initialRows, stats }: {
    initialRows: ReturnOrderRow[]
    stats: { total: number; pending: number; approved: number; totalCredited: number }
}) {
    const [rows, setRows] = useState(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [soOptions, setSoOptions] = useState<any[]>([])
    const [selectedSo, setSelectedSo] = useState('')
    const [soLines, setSoLines] = useState<any[]>([])
    const [reason, setReason] = useState('')
    const [returnLines, setReturnLines] = useState<{ productId: string; qtyReturned: number; unitPrice: number; reason: string; condition: string }[]>([])

    const reload = async () => {
        const data = await getReturnOrders()
        setRows(data)
    }

    const openCreate = async () => {
        const opts = await getSOOptionsForReturn()
        setSoOptions(opts)
        setCreateOpen(true)
    }

    const handleSelectSO = async (soId: string) => {
        setSelectedSo(soId)
        if (!soId) { setSoLines([]); setReturnLines([]); return }
        const lines = await getSOLinesForReturn(soId)
        setSoLines(lines)
        setReturnLines(lines.map((l: any) => ({
            productId: l.productId, qtyReturned: 0,
            unitPrice: Number(l.unitPrice), reason: '', condition: 'GOOD',
        })))
    }

    const handleCreate = async () => {
        const validLines = returnLines.filter(l => l.qtyReturned > 0)
        if (!selectedSo || !reason || validLines.length === 0) {
            toast.error('Điền đủ thông tin')
            return
        }
        toast.promise(
            createReturnOrder({ soId: selectedSo, reason, lines: validLines }).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo đơn trả hàng')
                setCreateOpen(false); setSelectedSo(''); setReason(''); setReturnLines([]); setSoLines([])
                reload()
                return res
            }),
            {
                loading: 'Đang tạo đơn trả hàng...',
                success: 'Đã tạo đơn trả hàng!',
                error: (err: any) => `Lỗi: ${err.message}`
            }
        )
    }

    const handleApprove = async (id: string) => {
        if (!confirm('Duyệt đơn trả hàng này? Hệ thống sẽ tự tạo Credit Note.')) return
        toast.promise(
            approveReturnOrder(id).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi duyệt đơn đổi trả')
                reload()
                return res
            }),
            {
                loading: 'Đang duyệt đơn trả hàng...',
                success: 'Đã duyệt đơn trả hàng!',
                error: (err: any) => `Lỗi: ${err.message}`
            }
        )
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Trả Hàng & Credit Note
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý đơn trả hàng, kiểm tra chất lượng, sinh Credit Note
                    </p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo Đơn Trả
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Tổng Đơn Trả', value: stats.total, accent: '#87CBB9', icon: RotateCcw },
                    { label: 'Chờ Xử Lý', value: stats.pending, accent: '#D4A853', icon: Clock },
                    { label: 'Đã Duyệt', value: stats.approved, accent: '#5BA88A', icon: CheckCircle2 },
                    { label: 'Tổng Credit', value: `${(stats.totalCredited / 1e6).toFixed(0)}M ₫`, accent: '#4A8FAB', icon: AlertCircle },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${s.accent}18` }}>
                                <Icon size={20} style={{ color: s.accent }} />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xl font-bold mt-0.5" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Mã', 'SO Gốc', 'Khách Hàng', 'Lý Do', 'Trạng Thái', 'Giá Trị', 'Credit Note', 'Ngày', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có đơn trả hàng</td></tr>
                        ) : rows.map((r: any) => {
                            const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{r.returnNo}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{r.soNo}</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2' }}>{r.customerName}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{r.reason}</td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>{formatVND(r.totalAmount)}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: r.creditNoteNo ? '#5BA88A' : '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                        {r.creditNoteNo ?? '—'}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(r.createdAt)}</td>
                                    <td className="px-3 py-2.5">
                                        {(r.status === 'DRAFT' || r.status === 'PENDING_INSPECTION') && (
                                            <button onClick={() => handleApprove(r.id)} className="text-xs px-2 py-1 rounded font-semibold"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>Duyệt</button>
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
                    <div className="w-[520px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Đơn Trả Hàng</h3>
                            <button onClick={() => setCreateOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Đơn Hàng Gốc (SO)</label>
                                <select value={selectedSo} onChange={e => handleSelectSO(e.target.value)}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn SO —</option>
                                    {soOptions.map((s: any) => <option key={s.id} value={s.id}>{s.soNo} — {s.customer.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Lý Do Trả Hàng</label>
                                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                                    className="w-full px-3 py-2 rounded text-sm resize-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                    placeholder="Mô tả lý do trả hàng..." />
                            </div>

                            {soLines.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#D4A853' }}>
                                        Sản Phẩm Trả Lại (nhập SL {'>'} 0)
                                    </p>
                                    <div className="space-y-2">
                                        {soLines.map((l: any, i: number) => (
                                            <div key={l.productId} className="p-3 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{l.product.skuCode}</span>
                                                        <span className="text-xs ml-2" style={{ color: '#8AAEBB' }}>{l.product.productName}</span>
                                                    </div>
                                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>Đã mua: {Number(l.qtyOrdered)}</span>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[10px]" style={{ color: '#4A6A7A' }}>SL Trả</label>
                                                        <input type="number" min={0} max={Number(l.qtyOrdered)} value={returnLines[i]?.qtyReturned ?? 0}
                                                            onChange={e => {
                                                                const v = [...returnLines]; v[i] = { ...v[i], qtyReturned: Number(e.target.value) }; setReturnLines(v)
                                                            }}
                                                            className="w-full px-2 py-1 rounded text-sm" style={{ background: '#142433', border: '1px solid #2A4355', color: '#D4A853' }} />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px]" style={{ color: '#4A6A7A' }}>Tình Trạng</label>
                                                        <select value={returnLines[i]?.condition ?? 'GOOD'}
                                                            onChange={e => {
                                                                const v = [...returnLines]; v[i] = { ...v[i], condition: e.target.value }; setReturnLines(v)
                                                            }}
                                                            className="w-full px-2 py-1 rounded text-sm" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                                            <option value="GOOD">Tốt</option>
                                                            <option value="DAMAGED">Hư hỏng</option>
                                                            <option value="EXPIRED">Hết hạn</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px]" style={{ color: '#4A6A7A' }}>Ghi chú</label>
                                                        <input type="text" value={returnLines[i]?.reason ?? ''}
                                                            onChange={e => {
                                                                const v = [...returnLines]; v[i] = { ...v[i], reason: e.target.value }; setReturnLines(v)
                                                            }}
                                                            className="w-full px-2 py-1 rounded text-sm" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                            placeholder="..." />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {returnLines.some(l => l.qtyReturned > 0) && (
                                        <div className="mt-3 p-3 rounded flex items-center justify-between" style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)' }}>
                                            <span className="text-xs" style={{ color: '#D4A853' }}>Tổng giá trị trả lại:</span>
                                            <span className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                {formatVND(returnLines.filter((l: any) => l.qtyReturned > 0).reduce((s: number, l: any) => s + l.qtyReturned * l.unitPrice, 0))}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <Save size={14} /> Tạo Đơn Trả Hàng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
