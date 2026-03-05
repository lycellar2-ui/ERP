'use client'

import { useState, useCallback } from 'react'
import {
    PackagePlus, X, Loader2, Save, CheckCircle2, AlertCircle,
    ChevronDown, PackageCheck, AlertTriangle, Truck
} from 'lucide-react'
import {
    GoodsReceiptRow, getGoodsReceipts, getPOsForReceiving,
    createGoodsReceipt, confirmGoodsReceipt, GRLineInput,
    getLocations, LocationRow
} from './actions'
import { formatDate } from '@/lib/utils'

const card: React.CSSProperties = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2', fontSize: '13px', outline: 'none',
}

const GR_STATUS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#D4A853' },
    CONFIRMED: { label: 'Đã xác nhận', color: '#5BA88A' },
    CANCELLED: { label: 'Đã hủy', color: '#8B1A2E' },
}

type POForReceiving = {
    id: string; poNo: string
    supplier: { name: string }
    lines: { id: string; productId: string; product: { productName: string; skuCode: string }; qtyOrdered: any }[]
}

// ── Create GR Drawer ─────────────────────────
function CreateGRDrawer({ open, onClose, onCreated, warehouses }: {
    open: boolean; onClose: () => void; onCreated: () => void
    warehouses: { id: string; code: string; name: string }[]
}) {
    const [step, setStep] = useState<'select-po' | 'lines'>('select-po')
    const [pos, setPos] = useState<POForReceiving[]>([])
    const [posLoading, setPosLoading] = useState(false)
    const [selectedPO, setSelectedPO] = useState<POForReceiving | null>(null)
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
    const [locations, setLocations] = useState<LocationRow[]>([])
    const [lines, setLines] = useState<(GRLineInput & { productName: string; skuCode: string; qtyOrdered: number })[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const loadPOs = useCallback(async () => {
        setPosLoading(true)
        const data = await getPOsForReceiving()
        setPos(data as any)
        setPosLoading(false)
    }, [])

    const handleOpen = useCallback(() => {
        if (open && pos.length === 0) loadPOs()
    }, [open, pos.length, loadPOs])

    // Load on open
    if (open && pos.length === 0 && !posLoading) loadPOs()

    const selectPO = async (po: POForReceiving) => {
        setSelectedPO(po)
        const locs = await getLocations(warehouseId)
        setLocations(locs)
        setLines(po.lines.map(l => ({
            productId: l.productId,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            qtyOrdered: Number(l.qtyOrdered),
            qtyReceived: Number(l.qtyOrdered),
            locationId: locs[0]?.id ?? '',
        })))
        setStep('lines')
    }

    const handleSave = async () => {
        if (!selectedPO || !warehouseId) return
        setSaving(true)
        setError('')
        const result = await createGoodsReceipt({
            poId: selectedPO.id,
            warehouseId,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyReceived: l.qtyReceived,
                locationId: l.locationId,
            })),
        })
        if (result.success) {
            onCreated()
            onClose()
            setStep('select-po')
            setSelectedPO(null)
            setLines([])
        } else {
            setError(result.error ?? 'Lỗi tạo GR')
        }
        setSaving(false)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: '#0D1B25' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <PackagePlus size={18} style={{ color: '#87CBB9' }} />
                        Tạo Phiếu Nhập Kho (GR)
                    </h3>
                    <button onClick={() => { onClose(); setStep('select-po'); setSelectedPO(null) }}>
                        <X size={18} style={{ color: '#4A6A7A' }} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                        style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.3)', color: '#f87171' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                {/* Step 1: Select PO */}
                {step === 'select-po' && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold block" style={{ color: '#8AAEBB' }}>Chọn Kho Nhận</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm" style={inputStyle}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                        </select>

                        <label className="text-xs font-semibold block mt-4" style={{ color: '#8AAEBB' }}>Chọn PO để nhập kho</label>
                        {posLoading ? (
                            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                        ) : pos.length === 0 ? (
                            <div className="text-center py-8 text-sm" style={{ color: '#4A6A7A' }}>Không có PO nào sẵn sàng nhập kho</div>
                        ) : pos.map(po => (
                            <button key={po.id} onClick={() => selectPO(po)}
                                className="w-full text-left p-4 rounded-md transition-all"
                                style={{ ...card }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#2A4355'}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{po.poNo}</span>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{po.supplier.name}</p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                        {po.lines.length} SKU
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 2: Enter quantities */}
                {step === 'lines' && selectedPO && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => { setStep('select-po'); setSelectedPO(null) }}
                                className="text-xs px-2 py-1 rounded" style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>
                                ← Đổi PO
                            </button>
                            <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{selectedPO.poNo}</span>
                            <span className="text-xs" style={{ color: '#4A6A7A' }}>— {selectedPO.supplier.name}</span>
                        </div>

                        {lines.map((line, i) => {
                            const variance = line.qtyReceived - line.qtyOrdered
                            return (
                                <div key={line.productId} className="p-3 rounded-md" style={card}>
                                    <p className="text-sm font-semibold mb-1" style={{ color: '#E8F1F2' }}>{line.productName}</p>
                                    <p className="text-xs mb-3" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{line.skuCode}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>SL Đặt</label>
                                            <div className="px-3 py-2 rounded text-sm" style={{ background: '#142433', color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                                {line.qtyOrdered}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: '#8AAEBB' }}>SL Nhận *</label>
                                            <input type="number" min={0} value={line.qtyReceived}
                                                onChange={e => {
                                                    const newLines = [...lines]
                                                    newLines[i] = { ...newLines[i], qtyReceived: Number(e.target.value) }
                                                    setLines(newLines)
                                                }}
                                                style={inputStyle} />
                                        </div>
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>Chênh Lệch</label>
                                            <div className="px-3 py-2 rounded text-sm font-bold" style={{
                                                background: '#142433',
                                                color: variance === 0 ? '#5BA88A' : variance > 0 ? '#D4A853' : '#8B1A2E',
                                                fontFamily: '"DM Mono"'
                                            }}>
                                                {variance > 0 ? '+' : ''}{variance}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>Vị Trí Kho</label>
                                        <select value={line.locationId} onChange={e => {
                                            const newLines = [...lines]
                                            newLines[i] = { ...newLines[i], locationId: e.target.value }
                                            setLines(newLines)
                                        }} className="w-full" style={inputStyle}>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.locationCode} ({loc.zone})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )
                        })}

                        <button onClick={handleSave} disabled={saving}
                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Đang lưu...' : 'Tạo Phiếu Nhập Kho'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── GR Tab Component ─────────────────────────
interface GoodsReceiptTabProps {
    warehouses: { id: string; code: string; name: string }[]
}

export function GoodsReceiptTab({ warehouses }: GoodsReceiptTabProps) {
    const [grs, setGrs] = useState<GoodsReceiptRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [confirming, setConfirming] = useState<string | null>(null)

    const loadGRs = useCallback(async () => {
        setLoading(true)
        const data = await getGoodsReceipts()
        setGrs(data)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) loadGRs()

    const handleConfirm = async (grId: string) => {
        setConfirming(grId)
        // TODO: get real user ID from session
        await confirmGoodsReceipt(grId, 'user-admin')
        loadGRs()
        setConfirming(null)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#8AAEBB' }}>{grs.length} phiếu nhập kho</p>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <PackagePlus size={16} /> Tạo GR Từ PO
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : grs.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <PackagePlus size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu nhập kho nào</p>
                </div>
            ) : (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Mã GR', 'PO', 'Kho', 'Dòng', 'SL Nhận', 'Ngày', 'Status', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {grs.map(gr => {
                                const st = GR_STATUS[gr.status] ?? GR_STATUS.DRAFT
                                return (
                                    <tr key={gr.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{gr.grNo}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{gr.poNo}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{gr.warehouseName}</td>
                                        <td className="px-3 py-2.5 text-center text-xs" style={{ color: '#8AAEBB' }}>{gr.lineCount}</td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>
                                            {gr.totalQtyReceived}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(gr.createdAt)}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ color: st.color, background: `${st.color}20` }}>{st.label}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {gr.status === 'DRAFT' && (
                                                <button onClick={() => handleConfirm(gr.id)} disabled={confirming === gr.id}
                                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                    {confirming === gr.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                    Xác nhận
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <CreateGRDrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={loadGRs}
                warehouses={warehouses}
            />
        </div>
    )
}
