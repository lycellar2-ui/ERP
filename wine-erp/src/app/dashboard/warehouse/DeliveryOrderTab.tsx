'use client'

import { useState, useCallback } from 'react'
import {
    Truck, X, Loader2, Save, CheckCircle2, AlertCircle,
    PackageOpen, ArrowRightCircle
} from 'lucide-react'
import {
    DeliveryOrderRow, getDeliveryOrders, getSOsForDelivery,
    createDeliveryOrder, confirmDeliveryOrder, DOLineInput,
    getStockInventory, StockLotRow
} from './actions'
import { formatDate } from '@/lib/utils'

const card: React.CSSProperties = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2', fontSize: '13px', outline: 'none',
}

const DO_STATUS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#D4A853' },
    PICKING: { label: 'Đang lấy hàng', color: '#4A8FAB' },
    PACKED: { label: 'Đóng gói', color: '#87CBB9' },
    SHIPPED: { label: 'Đã giao', color: '#5BA88A' },
    DELIVERED: { label: 'Giao thành công', color: '#5BA88A' },
    CANCELLED: { label: 'Đã hủy', color: '#8B1A2E' },
}

type SOForDelivery = {
    id: string; soNo: string
    customer: { name: string }
    lines: { id: string; productId: string; product: { productName: string; skuCode: string }; qtyOrdered: any }[]
}

// ── Create DO Drawer ─────────────────────────
function CreateDODrawer({ open, onClose, onCreated, warehouses }: {
    open: boolean; onClose: () => void; onCreated: () => void
    warehouses: { id: string; code: string; name: string }[]
}) {
    const [step, setStep] = useState<'select-so' | 'lines'>('select-so')
    const [sos, setSos] = useState<SOForDelivery[]>([])
    const [sosLoading, setSosLoading] = useState(false)
    const [selectedSO, setSelectedSO] = useState<SOForDelivery | null>(null)
    const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '')
    const [stockLots, setStockLots] = useState<StockLotRow[]>([])
    const [lines, setLines] = useState<(DOLineInput & { productName: string; skuCode: string; qtyOrdered: number })[]>([])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && sos.length === 0 && !sosLoading) {
        setSosLoading(true)
        getSOsForDelivery().then(data => { setSos(data as any); setSosLoading(false) })
    }

    const selectSO = async (so: SOForDelivery) => {
        setSelectedSO(so)
        const lots = await getStockInventory({ warehouseId, status: 'AVAILABLE' })
        setStockLots(lots)
        setLines(so.lines.map(l => {
            const matchLot = lots.find(lot => lot.productId === l.productId)
            return {
                productId: l.productId,
                productName: l.product.productName,
                skuCode: l.product.skuCode,
                qtyOrdered: Number(l.qtyOrdered),
                lotId: matchLot?.id ?? '',
                locationId: '', // will be set from lot
                qtyPicked: Math.min(Number(l.qtyOrdered), matchLot?.qtyAvailable ?? 0),
            }
        }))
        setStep('lines')
    }

    const handleSave = async () => {
        if (!selectedSO || !warehouseId) return
        const validLines = lines.filter(l => l.lotId && l.qtyPicked > 0)
        if (validLines.length === 0) { setError('Cần ít nhất 1 dòng có lô hàng'); return }

        setSaving(true)
        setError('')
        const result = await createDeliveryOrder({
            soId: selectedSO.id,
            warehouseId,
            lines: validLines.map(l => {
                const lot = stockLots.find(s => s.id === l.lotId)
                return {
                    productId: l.productId,
                    lotId: l.lotId,
                    locationId: lot?.id ? stockLots.find(s => s.id === l.lotId)?.id ?? '' : '',
                    qtyPicked: l.qtyPicked,
                }
            }),
        })
        if (result.success) {
            onCreated()
            onClose()
            setStep('select-so')
            setSelectedSO(null)
            setLines([])
        } else {
            setError(result.error ?? 'Lỗi tạo DO')
        }
        setSaving(false)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: '#0D1B25' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                        <Truck size={18} style={{ color: '#87CBB9' }} />
                        Tạo Phiếu Xuất Kho (DO)
                    </h3>
                    <button onClick={() => { onClose(); setStep('select-so'); setSelectedSO(null) }}>
                        <X size={18} style={{ color: '#4A6A7A' }} />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                        style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.3)', color: '#f87171' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                {step === 'select-so' && (
                    <div className="space-y-3">
                        <label className="text-xs font-semibold block" style={{ color: '#8AAEBB' }}>Chọn Kho Xuất</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                            className="w-full px-3 py-2 rounded text-sm" style={inputStyle}>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                        </select>

                        <label className="text-xs font-semibold block mt-4" style={{ color: '#8AAEBB' }}>Chọn SO để xuất kho</label>
                        {sosLoading ? (
                            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                        ) : sos.length === 0 ? (
                            <div className="text-center py-8 text-sm" style={{ color: '#4A6A7A' }}>Không có SO nào sẵn sàng xuất kho</div>
                        ) : sos.map(so => (
                            <button key={so.id} onClick={() => selectSO(so)}
                                className="w-full text-left p-4 rounded-md transition-all" style={card}
                                onMouseEnter={e => e.currentTarget.style.borderColor = '#87CBB9'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = '#2A4355'}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{so.soNo}</span>
                                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{so.customer.name}</p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                        {so.lines.length} SKU
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'lines' && selectedSO && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => { setStep('select-so'); setSelectedSO(null) }}
                                className="text-xs px-2 py-1 rounded" style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>← Đổi SO</button>
                            <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{selectedSO.soNo}</span>
                            <span className="text-xs" style={{ color: '#4A6A7A' }}>— {selectedSO.customer.name}</span>
                        </div>

                        {lines.map((line, i) => {
                            const availableLots = stockLots.filter(l => l.productId === line.productId)
                            const selectedLot = stockLots.find(l => l.id === line.lotId)
                            return (
                                <div key={line.productId} className="p-3 rounded-md" style={card}>
                                    <p className="text-sm font-semibold mb-1" style={{ color: '#E8F1F2' }}>{line.productName}</p>
                                    <p className="text-xs mb-3" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{line.skuCode}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>SL Đặt</label>
                                            <div className="px-3 py-2 rounded text-sm" style={{ background: '#142433', color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                                {line.qtyOrdered}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs block mb-1" style={{ color: '#8AAEBB' }}>SL Xuất *</label>
                                            <input type="number" min={0} max={selectedLot?.qtyAvailable ?? 0} value={line.qtyPicked}
                                                onChange={e => { const n = [...lines]; n[i] = { ...n[i], qtyPicked: Number(e.target.value) }; setLines(n) }}
                                                style={inputStyle} />
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="text-xs block mb-1" style={{ color: '#4A6A7A' }}>Chọn Lô Hàng (FIFO)</label>
                                        <select value={line.lotId} onChange={e => {
                                            const n = [...lines]; n[i] = { ...n[i], lotId: e.target.value }; setLines(n)
                                        }} className="w-full" style={inputStyle}>
                                            <option value="">— Chưa chọn lô —</option>
                                            {availableLots.map(lot => (
                                                <option key={lot.id} value={lot.id}>
                                                    {lot.lotNo} — {lot.locationCode} — Tồn: {lot.qtyAvailable}
                                                </option>
                                            ))}
                                        </select>
                                        {availableLots.length === 0 && (
                                            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#8B1A2E' }}>
                                                <AlertCircle size={10} /> Không có lô hàng nào cho SP này
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}

                        <button onClick={handleSave} disabled={saving}
                            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Đang lưu...' : 'Tạo Phiếu Xuất Kho'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ── DO Tab Component ─────────────────────────
interface DeliveryOrderTabProps {
    warehouses: { id: string; code: string; name: string }[]
}

export function DeliveryOrderTab({ warehouses }: DeliveryOrderTabProps) {
    const [dos, setDos] = useState<DeliveryOrderRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [confirming, setConfirming] = useState<string | null>(null)

    const loadDOs = useCallback(async () => {
        setLoading(true)
        const data = await getDeliveryOrders()
        setDos(data)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) loadDOs()

    const handleConfirm = async (doId: string) => {
        setConfirming(doId)
        await confirmDeliveryOrder(doId)
        loadDOs()
        setConfirming(null)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#8AAEBB' }}>{dos.length} phiếu xuất kho</p>
                <button onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Truck size={16} /> Tạo DO Từ SO
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : dos.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <Truck size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có phiếu xuất kho nào</p>
                </div>
            ) : (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Mã DO', 'SO', 'Kho', 'Dòng', 'SL Xuất', 'Ngày', 'Status', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {dos.map(d => {
                                const st = DO_STATUS[d.status] ?? DO_STATUS.DRAFT
                                return (
                                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{d.doNo}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{d.soNo}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>{d.warehouseName}</td>
                                        <td className="px-3 py-2.5 text-center text-xs" style={{ color: '#8AAEBB' }}>{d.lineCount}</td>
                                        <td className="px-3 py-2.5 text-center text-xs font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>
                                            {d.totalQtyShipped}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(d.createdAt)}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ color: st.color, background: `${st.color}20` }}>{st.label}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            {d.status === 'DRAFT' && (
                                                <button onClick={() => handleConfirm(d.id)} disabled={confirming === d.id}
                                                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                                                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                    {confirming === d.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />}
                                                    Xuất kho
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

            <CreateDODrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={loadDOs}
                warehouses={warehouses}
            />
        </div>
    )
}
