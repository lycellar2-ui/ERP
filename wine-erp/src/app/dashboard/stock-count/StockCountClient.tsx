'use client'

import React, { useState, useEffect } from 'react'
import { ClipboardList, Plus, X, Play, CheckCircle, ArrowLeftRight, Eye, Save } from 'lucide-react'
import {
    type StockCountRow,
    getStockCountList, createStockCountSession, getWarehouseOptions,
    startStockCount, getStockCountDetail, recordCountLine, completeStockCount, adjustStockFromCount,
} from './actions'
import { formatDate } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Chờ Bắt Đầu', color: '#8AAEBB', bg: 'rgba(138,174,187,0.15)' },
    IN_PROGRESS: { label: 'Đang Kiểm', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    COMPLETED: { label: 'Hoàn Thành', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
}

const TYPE_LABEL: Record<string, string> = {
    FULL: 'Toàn Bộ', CYCLE: 'Luân Phiên', SPOT: 'Đột Xuất',
}

export function StockCountClient({ initialRows, stats }: {
    initialRows: StockCountRow[]
    stats: { total: number; inProgress: number; completed: number }
}) {
    const [rows, setRows] = useState(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<any>(null)
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [form, setForm] = useState({ warehouseId: '', zone: '', type: 'FULL' })

    const reload = async () => { const data = await getStockCountList(); setRows(data) }

    const openCreate = async () => {
        const wh = await getWarehouseOptions()
        setWarehouses(wh)
        setCreateOpen(true)
    }

    const handleCreate = async () => {
        if (!form.warehouseId) return alert('Chọn kho')
        const res = await createStockCountSession({
            warehouseId: form.warehouseId,
            zone: form.zone || undefined,
            type: form.type as any,
        })
        if (res.success) {
            setCreateOpen(false); setForm({ warehouseId: '', zone: '', type: 'FULL' }); reload()
        } else alert(res.error)
    }

    const handleStart = async (id: string) => {
        const res = await startStockCount(id)
        if (res.success) reload()
        else alert(res.error)
    }

    const handleComplete = async (id: string) => {
        const res = await completeStockCount(id)
        if (res.success) reload()
        else alert(res.error)
    }

    const handleAdjust = async (id: string) => {
        if (!confirm('Điều chỉnh tồn kho theo kết quả kiểm kê?')) return
        const res = await adjustStockFromCount(id)
        if (res.success) { alert(`Đã điều chỉnh ${res.adjustedLines} dòng`); reload() }
        else alert(res.error)
    }

    const openDetail = async (id: string) => {
        setDetailId(id)
        const data = await getStockCountDetail(id)
        setDetail(data)
    }

    const handleRecordLine = async (lineId: string, qtyActual: number) => {
        await recordCountLine(lineId, qtyActual)
        if (detailId) {
            const data = await getStockCountDetail(detailId)
            setDetail(data)
        }
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Kiểm Kê / Cycle Count
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Kiểm đếm tồn kho định kỳ, phát hiện chênh lệch
                    </p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo Phiên KK
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng Phiên', value: stats.total, accent: '#87CBB9' },
                    { label: 'Đang Kiểm', value: stats.inProgress, accent: '#D4A853' },
                    { label: 'Hoàn Thành', value: stats.completed, accent: '#5BA88A' },
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
                            {['Kho', 'Khu', 'Loại', 'SP', 'Hệ Thống', 'Thực Tế', 'Lệch', 'TT', 'Ngày', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiên kiểm kê</td></tr>
                        ) : rows.map(r => {
                            const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                            const hasVariance = r.totalVariance !== 0
                            return (
                                <tr key={r.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#E8F1F2' }}>{r.warehouseName}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{r.zone ?? '—'}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#87CBB9' }}>{TYPE_LABEL[r.type] ?? r.type}</td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{r.lineCount} dòng</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{r.totalSystemQty}</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>{r.totalActualQty || '—'}</td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: hasVariance ? (r.totalVariance < 0 ? '#8B1A2E' : '#5BA88A') : '#4A6A7A' }}>
                                        {hasVariance ? (r.totalVariance > 0 ? '+' : '') + r.totalVariance : '—'}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(r.createdAt)}</td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex gap-1">
                                            <button onClick={() => openDetail(r.id)} className="text-xs px-2 py-1 rounded"
                                                style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}><Eye size={12} /></button>
                                            {r.status === 'DRAFT' && (
                                                <button onClick={() => handleStart(r.id)} className="text-xs px-2 py-1 rounded"
                                                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}><Play size={12} /></button>
                                            )}
                                            {r.status === 'IN_PROGRESS' && (
                                                <button onClick={() => handleComplete(r.id)} className="text-xs px-2 py-1 rounded"
                                                    style={{ background: 'rgba(91,168,138,0.12)', color: '#5BA88A' }}><CheckCircle size={12} /></button>
                                            )}
                                            {r.status === 'COMPLETED' && hasVariance && (
                                                <button onClick={() => handleAdjust(r.id)} className="text-xs px-2 py-1 rounded"
                                                    style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}><ArrowLeftRight size={12} /></button>
                                            )}
                                        </div>
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
                    <div className="w-[420px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>Tạo Phiên Kiểm Kê</h3>
                            <button onClick={() => setCreateOpen(false)} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Kho *</label>
                                <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    <option value="">— Chọn kho —</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Khu vực (Zone)</label>
                                <input type="text" value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                    placeholder="VD: A, B, C (rỗng = toàn bộ)" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#8AAEBB' }}>Loại Kiểm Kê</label>
                                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                    className="w-full px-3 py-2 rounded text-sm" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                <ClipboardList size={14} /> Tạo Phiên & Sinh Dòng Kiểm Kê
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {detailId && detail && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[560px] h-full overflow-y-auto" style={{ background: '#0F1D2B' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                                    Chi Tiết Kiểm Kê
                                </h3>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                    {detail.warehouseName} {detail.zone ? `· Zone ${detail.zone}` : ''} · {TYPE_LABEL[detail.type]}
                                </p>
                            </div>
                            <button onClick={() => { setDetailId(null); setDetail(null) }} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                        </div>
                        <div className="p-5">
                            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                            {['SKU', 'Sản Phẩm', 'Vị Trí', 'HT', 'Thực Tế', 'Lệch'].map(h => (
                                                <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detail.lines.map((l: any) => (
                                            <tr key={l.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                                <td className="px-3 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{l.skuCode}</td>
                                                <td className="px-3 py-2 text-xs" style={{ color: '#E8F1F2' }}>{l.productName}</td>
                                                <td className="px-3 py-2 text-xs" style={{ color: '#8AAEBB' }}>{l.locationCode}</td>
                                                <td className="px-3 py-2 text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{l.qtySystem}</td>
                                                <td className="px-3 py-2">
                                                    {detail.status === 'IN_PROGRESS' ? (
                                                        <input type="number" min={0} defaultValue={l.qtyActual ?? ''}
                                                            onBlur={e => {
                                                                const v = Number(e.target.value)
                                                                if (!isNaN(v) && v >= 0) handleRecordLine(l.id, v)
                                                            }}
                                                            className="w-16 px-2 py-1 rounded text-xs text-center"
                                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#D4A853' }} />
                                                    ) : (
                                                        <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#D4A853' }}>{l.qtyActual ?? '—'}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs font-bold" style={{
                                                    fontFamily: '"DM Mono"',
                                                    color: l.variance === null ? '#4A6A7A' : l.variance < 0 ? '#8B1A2E' : l.variance > 0 ? '#5BA88A' : '#4A6A7A',
                                                }}>
                                                    {l.variance !== null ? (l.variance > 0 ? '+' : '') + l.variance : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
