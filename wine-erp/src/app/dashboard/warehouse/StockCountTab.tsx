'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Plus, X, Play, CheckCircle, ArrowLeftRight, Eye, Save, QrCode, Scan, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
    type StockCountRow,
    getStockCountList, createStockCountSession, getWarehouseOptions,
    startStockCount, getStockCountDetail, recordCountLine, completeStockCount, adjustStockFromCount,
    recordCountByBarcode,
} from '../stock-count/actions'
import { formatDate, formatCasesAndBottles } from '@/lib/utils'
import { BarcodeLookupModal } from '../stock-count/BarcodeLookupModal'

type WarehouseOption = {
    id: string
    code: string
    name: string
}

type StockCountLine = {
    id: string
    skuCode: string
    productName: string
    locationCode: string
    qtySystem: number
    qtyActual: number | null
    variance: number | null
}

type StockCountDetail = {
    id: string
    warehouseName: string
    zone: string | null
    type: string
    status: string
    lines: StockCountLine[]
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Chờ Bắt Đầu', color: '#475569', bg: '#F1F5F9' },
    IN_PROGRESS: { label: 'Đang Kiểm', color: '#B47816', bg: 'rgba(212,168,83,0.15)' },
    COMPLETED: { label: 'Đã Hoàn Thành', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' },
    ADJUSTED: { label: 'Đã Điều Chỉnh', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
}

export function StockCountTab() {
    const [rows, setRows] = useState<StockCountRow[]>([])
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
    const [form, setForm] = useState<{ warehouseId: string; zone: string; type: 'CYCLE' | 'FULL' | 'SPOT'; notes: string }>({ warehouseId: '', zone: '', type: 'CYCLE', notes: '' })
    const [saving, setSaving] = useState(false)

    const [detailData, setDetailData] = useState<StockCountDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [barcodeModalOpen, setBarcodeModalOpen] = useState(false)

    const reload = async () => {
        setLoading(true)
        try {
            const data = await getStockCountList()
            setRows(data)
        } catch (err: any) {
            toast.error('Lỗi tải đợt kiểm kê: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { reload() }, [])

    const openCreate = async () => {
        try {
            const whs = await getWarehouseOptions()
            setWarehouses(whs)
            setCreateOpen(true)
        } catch (err: any) {
            toast.error('Lỗi tải kho: ' + err.message)
        }
    }

    const handleCreate = async () => {
        if (!form.warehouseId) {
            toast.error('Vui lòng chọn kho kiểm kê')
            return
        }
        setSaving(true)
        try {
            const res = await createStockCountSession(form)
            if (!res.success) throw new Error(res.error || 'Lỗi tạo đợt kiểm kê')
            toast.success('✅ Đã tạo đợt kiểm kê thành công!')
            setCreateOpen(false)
            setForm({ warehouseId: '', zone: '', type: 'CYCLE', notes: '' })
            reload()
        } catch (err: any) {
            toast.error('Lỗi: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleStart = async (id: string) => {
        toast.promise(
            startStockCount(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi bắt đầu')
                reload()
                if (detailData?.id === id) openDetail(id)
                return res
            }),
            { loading: 'Đang bắt đầu...', success: '✅ Đã bắt đầu kiểm kê!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        try {
            const data = await getStockCountDetail(id)
            setDetailData(data)
        } catch (err: any) {
            toast.error('Lỗi tải chi tiết: ' + err.message)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleLineQtyChange = async (lineId: string, qtyActual: number) => {
        if (!detailData) return
        try {
            const res = await recordCountLine(lineId, qtyActual)
            if (res.success) {
                setDetailData(prev => {
                    if (!prev) return null
                    return {
                        ...prev,
                        lines: prev.lines.map(l => {
                            if (l.id === lineId) {
                                const v = qtyActual - l.qtySystem
                                return { ...l, qtyActual, variance: v }
                            }
                            return l
                        })
                    }
                })
            }
        } catch (err: any) {
            toast.error('Lỗi lưu số lượng: ' + err.message)
        }
    }

    const handleComplete = async (id: string) => {
        if (!confirm('Hoàn thành kiểm kê đợt này?')) return
        toast.promise(
            completeStockCount(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi hoàn thành')
                reload()
                openDetail(id)
                return res
            }),
            { loading: 'Đang hoàn thành...', success: '✅ Đã hoàn thành kiểm kê!', error: (err: Error) => `Lỗi: ${err.message}` }
        )
    }

    const handleAdjust = async (id: string) => {
        if (!confirm('XÁC NHẬN ĐIỀU CHỈNH TỒN KHO? Hệ thống sẽ tạo giao dịch chỉnh số dư tồn thực tế.')) return
        toast.promise(
            adjustStockFromCount(id).then(async (res) => {
                if (!res.success) throw new Error(res.error || 'Lỗi điều chỉnh')
                reload()
                openDetail(id)
                return res
            }),
            {
                loading: 'Đang điều chỉnh kho...',
                success: (res) => `✅ Đã điều chỉnh tồn kho cho ${res.adjustedLines || 0} sản phẩm!`,
                error: (err: Error) => `Lỗi: ${err.message}`
            }
        )
    }

    const inProgressCount = rows.filter(r => r.status === 'IN_PROGRESS').length
    const completedCount = rows.filter(r => r.status === 'COMPLETED' || r.status === 'ADJUSTED').length

    return (
        <div className="space-y-4">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div>
                    <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                        <ClipboardList size={18} style={{ color: '#D4A853' }} /> Kiểm Kê Kho Hàng (Stock Audit & Count)
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                        Tạo đợt kiểm kê định kỳ, kiểm đếm thực tế qua Barcode di động & cân đối số dư
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={reload} className="p-2 rounded-lg hover:bg-slate-100 transition-colors" style={{ color: '#64748B' }} title="Làm mới">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={openCreate} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm transition-all hover:brightness-105"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        <Plus size={14} /> Tạo Đợt Kiểm Kê
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Tổng Đợt Kiểm Kê', value: rows.length, accent: '#0F172A' },
                    { label: 'Đang Tiến Hành Kiểm', value: inProgressCount, accent: '#B47816' },
                    { label: 'Đã Hoàn Thành / Đã Chỉnh', value: completedCount, accent: '#16A34A' },
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
                                {['Kho', 'Khu Vực (Zone)', 'Loại Kiểm', 'Trạng Thái', 'Ngày Kiểm', ''].map(h => (
                                    <th key={h} className="px-3.5 py-2.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <Loader2 size={20} className="animate-spin inline" style={{ color: '#D4A853' }} />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-xs" style={{ color: '#64748B' }}>Chưa có đợt kiểm kê nào</td>
                                </tr>
                            ) : rows.map((r: StockCountRow) => {
                                const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                                return (
                                    <tr key={r.id} className="transition-colors cursor-pointer hover:bg-slate-50"
                                        style={{ borderBottom: '1px solid #F1F5F9' }}
                                        onClick={() => openDetail(r.id)}>
                                        <td className="px-3.5 py-3 text-xs font-bold" style={{ color: '#0F172A' }}>{r.warehouseName}</td>
                                        <td className="px-3.5 py-3 text-xs font-mono" style={{ color: '#B47816' }}>{r.zone || 'Tất cả Zone'}</td>
                                        <td className="px-3.5 py-3 text-xs" style={{ color: '#475569' }}>
                                            {r.type === 'FULL' || r.type === 'FULL_PHYSICAL' ? 'Kiểm Toàn Bộ Kho' : r.type === 'SPOT' ? 'Kiểm Đột Xuất' : 'Kiểm Định Kỳ (Cycle)'}
                                        </td>
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
                                                {r.status === 'DRAFT' && (
                                                    <button onClick={() => handleStart(r.id)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all hover:brightness-105"
                                                        style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                                        <Play size={11} /> Bắt Đầu
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
                    <div className="w-full sm:w-[640px] max-w-full h-full overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                    Chi Tiết Đợt Kiểm Kê — {detailData?.warehouseName ?? '...'}
                                </h3>
                                {detailData && (
                                    <p className="text-xs mt-0.5 font-medium" style={{ color: '#64748B' }}>
                                        Zone: {detailData.zone || 'Tất cả'} · Trạng thái: {(STATUS_CFG[detailData.status] ?? STATUS_CFG.DRAFT).label}
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setDetailData(null)} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>

                        {detailLoading ? (
                            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: '#D4A853' }} /></div>
                        ) : detailData && (
                            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                                {/* Actions Bar */}
                                <div className="flex flex-wrap gap-2">
                                    {detailData.status === 'DRAFT' && (
                                        <button onClick={() => handleStart(detailData.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm"
                                            style={{ background: '#D4A853', color: '#0A1926' }}>
                                            <Play size={13} /> Bắt Đầu Kiểm Kê
                                        </button>
                                    )}

                                    {detailData.status === 'IN_PROGRESS' && (
                                        <>
                                            <button onClick={() => setBarcodeModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm"
                                                style={{ background: '#2563EB', color: '#FFFFFF' }}>
                                                <Scan size={13} /> Quét Barcode Di Động
                                            </button>
                                            <button onClick={() => handleComplete(detailData.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm"
                                                style={{ background: '#16A34A', color: '#FFFFFF' }}>
                                                <CheckCircle size={13} /> Hoàn Thành Kiểm Kê
                                            </button>
                                        </>
                                    )}

                                    {detailData.status === 'COMPLETED' && (
                                        <button onClick={() => handleAdjust(detailData.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg shadow-sm"
                                            style={{ background: '#D4A853', color: '#0A1926' }}>
                                            <ArrowLeftRight size={13} /> Điều Chỉnh Sổ Tồn Kho
                                        </button>
                                    )}
                                </div>

                                {/* Product Lines Table */}
                                <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #E2E8F0' }}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                                    {['SKU', 'Sản Phẩm', 'Vintage', 'Vị Trí', 'SL Sổ', 'SL Thực Tế (Thùng + Lẻ)', 'Chênh Lệch'].map(h => (
                                                        <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detailData.lines.map(l => {
                                                    const isMismatch = l.variance !== null && l.variance !== 0
                                                    const upc = (l as any).unitsPerCase || 6
                                                    const sysCases = formatCasesAndBottles(l.qtySystem, upc)
                                                    const actCases = l.qtyActual !== null ? formatCasesAndBottles(l.qtyActual, upc) : '—'
                                                    const varCases = l.variance !== null ? formatCasesAndBottles(l.variance, upc) : '—'

                                                    return (
                                                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                                            <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#B47816' }}>{l.skuCode}</td>
                                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>{l.productName}</td>
                                                            <td className="px-3 py-2.5 text-xs font-mono font-bold text-amber-800 bg-amber-50 rounded px-1.5 py-0.5">
                                                                {(l as any).vintage ?? 'NV'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#475569' }}>{l.locationCode}</td>
                                                            <td className="px-3 py-2.5 text-xs font-bold font-mono" style={{ color: '#0F172A' }} title={`${l.qtySystem} chai`}>{sysCases}</td>
                                                            <td className="px-3 py-2.5">
                                                                {detailData.status === 'IN_PROGRESS' ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            value={l.qtyActual ?? ''}
                                                                            onChange={e => handleLineQtyChange(l.id, Number(e.target.value))}
                                                                            className="w-16 px-2 py-1 rounded text-xs font-mono font-bold text-center outline-none"
                                                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                                                        />
                                                                        <span className="text-[10px] text-slate-500 font-mono">({actCases})</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs font-mono font-bold" style={{ color: '#0F172A' }} title={l.qtyActual !== null ? `${l.qtyActual} chai` : ''}>
                                                                        {actCases}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-xs font-mono font-bold">
                                                                {l.variance === null ? (
                                                                    <span style={{ color: '#94A3B8' }}>—</span>
                                                                ) : l.variance === 0 ? (
                                                                    <span style={{ color: '#16A34A' }}>✓ 0</span>
                                                                ) : (
                                                                    <span style={{ color: l.variance > 0 ? '#16A34A' : '#DC2626' }}>
                                                                        {varCases}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(15,23,42,0.4)' }}>
                    <div className="w-full sm:w-[460px] max-w-full h-full overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FFFFFF' }}>
                        <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <h3 className="text-base font-bold" style={{ color: '#0F172A' }}>Tạo Đợt Kiểm Kê Mới</h3>
                            <button onClick={() => setCreateOpen(false)} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Chọn Kho Kiểm Kê *</label>
                                <select value={form.warehouseId} onChange={e => setForm(prev => ({ ...prev, warehouseId: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                                    <option value="">— Chọn kho —</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Zone Kiểm (Để trống nếu kiểm toàn kho)</label>
                                <input type="text" value={form.zone} onChange={e => setForm(prev => ({ ...prev, zone: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                    placeholder="VD: ZONE-A" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Loại Kiểm Kê</label>
                                <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value as any }))}
                                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}>
                                    <option value="CYCLE">Kiểm Kê Định Kỳ (Cycle Count)</option>
                                    <option value="FULL">Kiểm Kê Toàn Bộ Kho (Full Inventory)</option>
                                    <option value="SPOT">Kiểm Kê Đột Xuất (Spot Count)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: '#475569' }}>Ghi Chú</label>
                                <input type="text" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                                    placeholder="VD: Kiểm kê quý III..." />
                            </div>

                            <button onClick={handleCreate} disabled={saving}
                                className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl shadow-md transition-all hover:brightness-105 mt-4"
                                style={{ background: '#D4A853', color: '#0A1926', minHeight: '44px' }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                {saving ? 'Đang tạo...' : 'Tạo Đợt Kiểm Kê'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Scanner Modal */}
            <BarcodeLookupModal
                isOpen={barcodeModalOpen}
                onClose={() => setBarcodeModalOpen(false)}
            />
        </div>
    )
}
