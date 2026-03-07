'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, CheckCircle2, Tag, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    createSalesOrder, SOCreateInput, SalesChannel,
    getProductPricesForChannel, getActiveAllocationsForProducts
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

export function CreateSODrawer({ open, onClose, onSaved, userId }: { open: boolean; onClose: () => void; onSaved: () => void; userId: string }) {
    const [customers, setCustomers] = useState<Customer[]>([])
    const [products, setProducts] = useState<ProductItem[]>([])
    const [loadingData, setLoadingData] = useState(false)

    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [lines, setLines] = useState<SOLine[]>([])

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [arBalance, setArBalance] = useState(0)
    const [loadingAR, setLoadingAR] = useState(false)

    const [priceMap, setPriceMap] = useState<Record<string, number>>({})
    const [allocations, setAllocations] = useState<{ productId: string; campaignName: string; remaining: number }[]>([])
    const [loadingPrices, setLoadingPrices] = useState(false)

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        setLoadingData(true)
        Promise.all([getCustomersForSO(), getProductsWithStock()])
            .then(([c, p]) => { setCustomers(c as any); setProducts(p) })
            .finally(() => setLoadingData(false))
    }, [open])

    // Auto-load prices when channel changes
    const loadPricesForChannel = useCallback(async (ch: string) => {
        setLoadingPrices(true)
        try {
            const prices = await getProductPricesForChannel(ch)
            setPriceMap(prices)
            // Auto-update existing lines that have no manual price
            setLines(prev => prev.map(l => {
                const autoPrice = prices[l.productId]
                if (autoPrice && l.unitPrice === 0) {
                    return { ...l, unitPrice: autoPrice }
                }
                return l
            }))
        } catch { /* silent */ }
        setLoadingPrices(false)
    }, [])

    useEffect(() => {
        if (open && channel) loadPricesForChannel(channel)
    }, [open, channel, loadPricesForChannel])

    // Load allocation info when products change
    useEffect(() => {
        if (!open || products.length === 0) return
        getActiveAllocationsForProducts(products.map(p => p.id))
            .then(setAllocations)
            .catch(() => { })
    }, [open, products])

    const handleCustomerChange = async (id: string) => {
        setCustomerId(id)
        const c = customers.find(c => c.id === id)
        setSelectedCustomer(c ?? null)
        if (c) {
            setPaymentTerm(c.paymentTerm)
            setChannel((c.channel ?? 'HORECA') as SalesChannel)
            setLoadingAR(true)
            const bal = await getCustomerARBalance(id)
            setArBalance(bal)
            setLoadingAR(false)
        }
    }

    const addLine = () => {
        if (products.length === 0) return
        const p = products[0]
        const autoPrice = priceMap[p.id] ?? 0
        setLines(prev => [...prev, { productId: p.id, productName: p.productName, skuCode: p.skuCode, qtyOrdered: 1, unitPrice: autoPrice, lineDiscountPct: 0, stock: p.totalStock }])
    }

    const updateLine = (i: number, field: keyof SOLine, value: any) => {
        setLines(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            if (field === 'productId') {
                const p = products.find(p => p.id === value)!
                const autoPrice = priceMap[value] ?? 0
                return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice: autoPrice }
            }
            return { ...l, [field]: value }
        }))
    }

    const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

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
        const promise = createSalesOrder({
            customerId,
            salesRepId: userId || 'SYSTEM',
            channel,
            paymentTerm,
            orderDiscount,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
            })),
        } as SOCreateInput).then(res => {
            if (!res.success) throw new Error(res.error ?? 'Có lỗi xảy ra')
            return res
        })

        toast.promise(promise, {
            loading: 'Đang tạo đơn hàng...',
            success: (result) => {
                setTimeout(() => { onSaved(); resetForm() }, 500)
                return `Tạo thành công ${result.soNo}`
            },
            error: (err: any) => `Lỗi: ${err.message}`,
            finally: () => setSaving(false)
        })
    }

    const resetForm = () => {
        setCustomerId(''); setSelectedCustomer(null); setChannel('HORECA')
        setPaymentTerm('NET30'); setOrderDiscount(0); setLines([])
        setArBalance(0); setPriceMap({})
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/50" onClick={onClose} />

            {/* Drawer */}
            <div className="w-full max-w-2xl flex flex-col overflow-hidden"
                style={{ background: '#1B2E3D', borderLeft: '1px solid #2A4355' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="text-lg font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                            Tạo Đơn Bán Hàng
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Sales Order — SLS</p>
                    </div>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={20} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {loadingData && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                        </div>
                    )}

                    {!loadingData && (
                        <>
                            {/* Customer */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#4A6A7A' }}>
                                    Khách Hàng *
                                </label>
                                <select
                                    value={customerId}
                                    onChange={e => handleCustomerChange(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ ...inputStyle }}
                                >
                                    <option value="">-- Chọn khách hàng --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Credit status */}
                            {selectedCustomer && (
                                <div className="p-3 rounded-md" style={{ background: creditWarning ? 'rgba(139,26,46,0.1)' : 'rgba(91,168,138,0.08)', border: `1px solid ${creditWarning ? 'rgba(139,26,46,0.3)' : 'rgba(91,168,138,0.2)'}` }}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {creditWarning && <AlertCircle size={14} style={{ color: '#8B1A2E' }} />}
                                        <p className="text-xs font-semibold" style={{ color: creditWarning ? '#8B1A2E' : '#5BA88A' }}>
                                            {creditWarning ? '⚠️ Vượt Credit Limit' : '✅ Credit OK'}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                        <div>
                                            <p style={{ color: '#4A6A7A' }}>Credit Limit</p>
                                            <p className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                                {formatVND(Number(selectedCustomer.creditLimit))}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ color: '#4A6A7A' }}>Dư Nợ Hiện Tại</p>
                                            <p className="font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                {loadingAR ? '...' : formatVND(arBalance)}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ color: '#4A6A7A' }}>Khả Dụng</p>
                                            <p className="font-bold" style={{ color: creditWarning ? '#8B1A2E' : '#5BA88A', fontFamily: '"DM Mono"' }}>
                                                {formatVND(Math.max(0, creditAvailable))}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Channel + Payment Term */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#4A6A7A' }}>
                                        Kênh Bán
                                    </label>
                                    <select value={channel} onChange={e => setChannel(e.target.value as SalesChannel)}
                                        className="w-full px-3 py-2.5 text-sm outline-none" style={{ ...inputStyle }}>
                                        {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#4A6A7A' }}>
                                        Thanh Toán
                                    </label>
                                    <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm outline-none" style={{ ...inputStyle }}>
                                        {['COD', 'NET7', 'NET14', 'NET30', 'NET45', 'NET60', 'PREPAID'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* SO Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                                        Sản Phẩm *
                                    </label>
                                    <button onClick={addLine}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-all"
                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', borderRadius: '4px' }}>
                                        <Plus size={13} /> Thêm dòng
                                    </button>
                                </div>

                                {lines.length === 0 ? (
                                    <div className="py-8 text-center rounded-md" style={{ border: '1px dashed #2A4355' }}>
                                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có sản phẩm — Click "+ Thêm dòng"</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {lines.map((line, i) => {
                                            const lineTotal = line.qtyOrdered * line.unitPrice * (1 - line.lineDiscountPct / 100)
                                            const lowStock = line.qtyOrdered > line.stock
                                            const alloc = allocations.find(a => a.productId === line.productId)
                                            const quotaExceeded = alloc && line.qtyOrdered > alloc.remaining
                                            const hasAutoPrice = priceMap[line.productId] !== undefined
                                            return (
                                                <div key={i} className="p-3 rounded-md space-y-2"
                                                    style={{ background: '#142433', border: `1px solid ${lowStock || quotaExceeded ? 'rgba(139,26,46,0.35)' : '#2A4355'}` }}>
                                                    <div className="flex items-start gap-2">
                                                        <select
                                                            value={line.productId}
                                                            onChange={e => updateLine(i, 'productId', e.target.value)}
                                                            className="flex-1 px-2.5 py-2 text-xs outline-none"
                                                            style={{ ...inputStyle, minWidth: 0 }}
                                                        >
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    [{p.skuCode}] {p.productName} — Tồn: {p.totalStock}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button onClick={() => removeLine(i)} style={{ color: '#8B1A2E', padding: '8px' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                    {/* Allocation & Price badges */}
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {alloc && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                                                style={{ background: quotaExceeded ? 'rgba(139,26,46,0.15)' : 'rgba(212,168,83,0.12)', color: quotaExceeded ? '#8B1A2E' : '#D4A853', border: `1px solid ${quotaExceeded ? 'rgba(139,26,46,0.3)' : 'rgba(212,168,83,0.25)'}` }}>
                                                                <ShieldAlert size={11} />
                                                                {alloc.campaignName}: {quotaExceeded ? `Vượt! Còn ${alloc.remaining}` : `Còn ${alloc.remaining}`}
                                                            </span>
                                                        )}
                                                        {hasAutoPrice && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                                                style={{ background: 'rgba(91,168,138,0.1)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.2)' }}>
                                                                <Tag size={11} /> Giá theo {channel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Số Lượng</p>
                                                            <input type="number" min="1" value={line.qtyOrdered}
                                                                onChange={e => updateLine(i, 'qtyOrdered', Number(e.target.value))}
                                                                className="w-full px-2.5 py-1.5 text-sm outline-none"
                                                                style={{ ...inputStyle, border: `1px solid ${lowStock ? 'rgba(139,26,46,0.5)' : '#2A4355'}` }}
                                                            />
                                                            {lowStock && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>⚠️ Vượt tồn kho ({line.stock})</p>}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Đơn Giá (VND){hasAutoPrice && <span style={{ color: '#5BA88A' }}> ✦</span>}</p>
                                                            <input type="number" min="0" value={line.unitPrice}
                                                                onChange={e => updateLine(i, 'unitPrice', Number(e.target.value))}
                                                                className="w-full px-2.5 py-1.5 text-sm outline-none"
                                                                style={{ ...inputStyle }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>CK Dòng (%)</p>
                                                            <input type="number" min="0" max="100" value={line.lineDiscountPct}
                                                                onChange={e => updateLine(i, 'lineDiscountPct', Number(e.target.value))}
                                                                className="w-full px-2.5 py-1.5 text-sm outline-none"
                                                                style={{ ...inputStyle }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <p className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                            = {formatVND(lineTotal)}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Order discount + Total */}
                            {lines.length > 0 && (
                                <div className="p-4 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-semibold" style={{ color: '#4A6A7A' }}>Chiết Khấu Tổng Đơn (%)</label>
                                        <input type="number" min="0" max="100" value={orderDiscount}
                                            onChange={e => setOrderDiscount(Number(e.target.value))}
                                            className="w-24 px-2.5 py-1.5 text-sm outline-none text-right"
                                            style={{ ...inputStyle }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        <p className="text-sm font-semibold" style={{ color: '#8AAEBB' }}>Tổng Cộng</p>
                                        <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                                            {formatVND(finalTotal)}
                                        </p>
                                    </div>
                                </div>
                            )}


                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2 text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}>
                        Huỷ
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold transition-all"
                        style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : 'Tạo Đơn'}
                    </button>
                </div>
            </div>
        </div>
    )
}
