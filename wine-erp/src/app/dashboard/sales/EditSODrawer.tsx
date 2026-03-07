'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, Tag } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    updateSalesOrder, SOUpdateInput, SalesChannel,
    getProductPricesForChannel, getSalesOrderDetailWithMargin,
} from './actions'
import { formatVND } from '@/lib/utils'

const CHANNELS: { value: SalesChannel; label: string }[] = [
    { value: 'HORECA', label: 'HORECA' },
    { value: 'WHOLESALE_DISTRIBUTOR', label: 'Đại Lý / Wholesale' },
    { value: 'VIP_RETAIL', label: 'VIP Retail' },
    { value: 'DIRECT_INDIVIDUAL', label: 'Trực Tiếp' },
]

interface Customer { id: string; name: string; code: string; creditLimit: number; paymentTerm: string; channel: string | null }
interface ProductItem { id: string; skuCode: string; productName: string; wineType: string; country: string; totalStock: number }
interface SOLine { productId: string; productName: string; skuCode: string; qtyOrdered: number; unitPrice: number; lineDiscountPct: number; stock: number }

const inputStyle = {
    background: '#142433',
    border: '1px solid #2A4355',
    color: '#E8F1F2',
    borderRadius: '4px',
    outline: 'none',
}

interface EditSODrawerProps {
    open: boolean
    soId: string
    onClose: () => void
    onSaved: () => void
}

export function EditSODrawer({ open, soId, onClose, onSaved }: EditSODrawerProps) {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [products, setProducts] = useState<ProductItem[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [loadingSO, setLoadingSO] = useState(true)

    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [lines, setLines] = useState<SOLine[]>([])

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [arBalance, setArBalance] = useState(0)

    const [priceMap, setPriceMap] = useState<Record<string, number>>({})

    const [saving, setSaving] = useState(false)
    const [soNo, setSoNo] = useState('')

    // Load reference data
    const loadReferenceData = useCallback(async () => {
        setLoadingData(true)
        const [custs, prods] = await Promise.all([getCustomersForSO(), getProductsWithStock()])
        setCustomers(custs as any)
        setProducts(prods as any)
        setLoadingData(false)
    }, [])

    // Load SO data
    const loadSOData = useCallback(async () => {
        if (!soId) return
        setLoadingSO(true)
        const { detail } = await getSalesOrderDetailWithMargin(soId)
        if (!detail) {
            toast.error('Không tìm thấy SO')
            onClose()
            return
        }

        setSoNo(detail.soNo)
        setCustomerId(detail.customerId)
        setChannel(detail.channel as SalesChannel)
        setPaymentTerm(detail.paymentTerm)
        setOrderDiscount(Number(detail.orderDiscount ?? 0))

        // Set lines from detail
        setLines(detail.lines.map((l: any) => ({
            productId: l.productId,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            qtyOrdered: Number(l.qtyOrdered),
            unitPrice: Number(l.unitPrice),
            lineDiscountPct: Number(l.lineDiscountPct ?? 0),
            stock: 0, // will be populated from products list
        })))

        setLoadingSO(false)
    }, [soId, onClose])

    useEffect(() => {
        if (open) {
            loadReferenceData()
            loadSOData()
        }
    }, [open, loadReferenceData, loadSOData])

    // Set selected customer when data loaded
    useEffect(() => {
        if (customerId && customers.length > 0) {
            const c = customers.find(c => c.id === customerId)
            setSelectedCustomer(c ?? null)
            if (c) {
                getCustomerARBalance(customerId).then(setArBalance)
            }
        }
    }, [customerId, customers])

    // Update stock info in lines
    useEffect(() => {
        if (products.length > 0 && lines.length > 0) {
            setLines(prev => prev.map(l => {
                const p = products.find(p => p.id === l.productId)
                return { ...l, stock: p?.totalStock ?? 0 }
            }))
        }
    }, [products]) // eslint-disable-line

    // Load prices when channel changes
    useEffect(() => {
        if (channel && products.length > 0) {
            getProductPricesForChannel(channel).then(setPriceMap)
        }
    }, [channel, products])

    const handleCustomerChange = async (cId: string) => {
        setCustomerId(cId)
        const c = customers.find(c => c.id === cId)
        setSelectedCustomer(c ?? null)
        if (c) {
            if (c.channel) setChannel(c.channel as SalesChannel)
            if (c.paymentTerm) setPaymentTerm(c.paymentTerm)
            setArBalance(await getCustomerARBalance(cId))
        }
    }

    const addLine = (productId: string) => {
        if (lines.find(l => l.productId === productId)) return toast.error('Sản phẩm đã có trong đơn')
        const p = products.find(p => p.id === productId)
        if (!p) return
        const price = priceMap[productId] ?? 0
        setLines(prev => [...prev, {
            productId: p.id, productName: p.productName, skuCode: p.skuCode,
            qtyOrdered: 1, unitPrice: price, lineDiscountPct: 0, stock: p.totalStock,
        }])
    }

    const updateLine = (idx: number, field: keyof SOLine, value: number) => {
        setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
    }

    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

    const subtotal = lines.reduce((sum, l) => {
        const line = l.qtyOrdered * l.unitPrice
        return sum + line - line * (l.lineDiscountPct / 100)
    }, 0)
    const finalTotal = subtotal * (1 - orderDiscount / 100)

    const creditAvailable = selectedCustomer ? Number(selectedCustomer.creditLimit) - arBalance : 0
    const creditWarning = selectedCustomer && finalTotal > creditAvailable

    const handleSave = async () => {
        if (!customerId) return toast.error('Vui lòng chọn khách hàng')
        if (lines.length === 0) return toast.error('Thêm ít nhất 1 sản phẩm')

        setSaving(true)
        const promise = updateSalesOrder({
            soId,
            customerId,
            channel,
            paymentTerm,
            orderDiscount,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
            })),
        } as SOUpdateInput).then(res => {
            if (!res.success) throw new Error(res.error ?? 'Có lỗi xảy ra')
            return res
        })

        toast.promise(promise, {
            loading: 'Đang cập nhật...',
            success: () => {
                setTimeout(() => { onSaved() }, 500)
                return `Đã cập nhật ${soNo}`
            },
            error: (e: Error) => e.message,
            finally: () => setSaving(false),
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(10,25,38,0.8)' }}>
            <div className="flex-1" onClick={onClose} />
            <div className="w-full max-w-2xl h-full overflow-y-auto" style={{ background: '#0F2133', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: '#D4A853' }}>Sửa Đơn Hàng</h2>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{soNo} — Chỉ DRAFT mới sửa được</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white/5"><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                <div className="p-4 space-y-4">
                    {(loadingData || loadingSO) ? (
                        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                    ) : (
                        <>
                            {/* Customer */}
                            <div>
                                <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Khách Hàng</label>
                                <select value={customerId} onChange={e => handleCustomerChange(e.target.value)}
                                    className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                    <option value="">-- Chọn --</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                                </select>
                            </div>

                            {/* Channel + Payment */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Kênh bán</label>
                                    <select value={channel} onChange={e => setChannel(e.target.value as SalesChannel)}
                                        className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                        {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Payment Term</label>
                                    <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)}
                                        className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                        {['COD', 'NET15', 'NET30', 'NET45', 'NET60'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Credit Warning */}
                            {creditWarning && (
                                <div className="flex items-center gap-2 p-3 rounded" style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)' }}>
                                    <AlertCircle size={14} style={{ color: '#E05252' }} />
                                    <span className="text-xs" style={{ color: '#E05252' }}>Vượt hạn mức tín dụng! Khả dụng: {formatVND(creditAvailable)}</span>
                                </div>
                            )}

                            {/* Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold" style={{ color: '#4A6A7A' }}>Sản Phẩm</label>
                                    <select onChange={e => { if (e.target.value) { addLine(e.target.value); e.target.value = '' } }}
                                        className="text-xs px-2 py-1" style={inputStyle}>
                                        <option value="">+ Thêm SP</option>
                                        {products.filter(p => !lines.find(l => l.productId === p.id)).map(p => (
                                            <option key={p.id} value={p.id}>{p.skuCode} — {p.productName} (tồn: {p.totalStock})</option>
                                        ))}
                                    </select>
                                </div>

                                {lines.length === 0 ? (
                                    <div className="text-center py-6 rounded" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                        <Plus size={20} className="mx-auto mb-1" style={{ color: '#2A4355' }} />
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Chọn sản phẩm từ dropdown</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {lines.map((l, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-3 rounded" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate" style={{ color: '#E8F1F2' }}>{l.skuCode}</p>
                                                    <p className="text-xs truncate" style={{ color: '#4A6A7A' }}>{l.productName}</p>
                                                    {l.stock < l.qtyOrdered && (
                                                        <p className="text-xs mt-0.5" style={{ color: '#D4A853' }}>⚠ Tồn: {l.stock}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <input type="number" min={1} value={l.qtyOrdered}
                                                        onChange={e => updateLine(idx, 'qtyOrdered', Math.max(1, +e.target.value))}
                                                        className="w-14 px-2 py-1 text-xs text-center" style={inputStyle} />
                                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>×</span>
                                                    <input type="number" min={0} value={l.unitPrice}
                                                        onChange={e => updateLine(idx, 'unitPrice', Math.max(0, +e.target.value))}
                                                        className="w-24 px-2 py-1 text-xs text-right" style={inputStyle} />
                                                    <div className="flex items-center gap-0.5">
                                                        <Tag size={10} style={{ color: '#D4A853' }} />
                                                        <input type="number" min={0} max={100} value={l.lineDiscountPct}
                                                            onChange={e => updateLine(idx, 'lineDiscountPct', Math.min(100, Math.max(0, +e.target.value)))}
                                                            className="w-12 px-1 py-1 text-xs text-center" style={inputStyle} />
                                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>%</span>
                                                    </div>
                                                    <button onClick={() => removeLine(idx)} className="p-1 rounded hover:bg-white/5">
                                                        <Trash2 size={14} style={{ color: '#8B1A2E' }} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Order Discount */}
                            <div className="flex items-center gap-3 p-3 rounded" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <Tag size={14} style={{ color: '#D4A853' }} />
                                <span className="text-xs" style={{ color: '#4A6A7A' }}>CK Đơn Hàng</span>
                                <input type="number" min={0} max={100} value={orderDiscount}
                                    onChange={e => setOrderDiscount(Math.min(100, Math.max(0, +e.target.value)))}
                                    className="w-16 px-2 py-1 text-xs text-center" style={inputStyle} />
                                <span className="text-xs" style={{ color: '#4A6A7A' }}>%</span>
                                <div className="flex-1" />
                                <div className="text-right">
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Tổng cộng</p>
                                    <p className="text-lg font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                        {formatVND(finalTotal)}
                                    </p>
                                </div>
                            </div>

                            {/* Save */}
                            <button onClick={handleSave} disabled={saving || lines.length === 0}
                                className="w-full py-3 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all"
                                style={{ background: saving ? '#2A4355' : '#D4A853', color: '#0A1926' }}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {saving ? 'Đang lưu...' : 'Cập Nhật Đơn Hàng'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
