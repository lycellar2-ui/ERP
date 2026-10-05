'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPOSProducts, getPOSCategories, processPOSSale, getPOSShiftSummary, lookupByBarcode, generatePOSVATInvoice } from './actions'
import type { POSProduct, CartItem } from './actions'
import { formatVND, cn } from '@/lib/utils'
import {
    Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
    QrCode, Wine, Check, BarChart3, Receipt, ScanBarcode, FileText, Star, ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button, Modal, Badge } from '@/components/ui'

export default function POSClient() {
    const [products, setProducts] = useState<POSProduct[]>([])
    const [categories, setCategories] = useState<{ value: string; label: string; count: number }[]>([])
    const [cart, setCart] = useState<CartItem[]>([])
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('ALL')
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QR'>('CASH')
    const [cashReceived, setCashReceived] = useState('')
    const [showPayment, setShowPayment] = useState(false)
    const [showReceipt, setShowReceipt] = useState(false)
    const [lastSale, setLastSale] = useState<{ soNo: string; totalAmount: number; change?: number } | null>(null)
    const [shiftSummary, setShiftSummary] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [barcodeInput, setBarcodeInput] = useState('')
    const [barcodeError, setBarcodeError] = useState('')
    const [vatLoading, setVatLoading] = useState(false)

    const loadProducts = useCallback(async () => {
        const data = await getPOSProducts(search || undefined, activeCategory)
        setProducts(data)
    }, [search, activeCategory])

    useEffect(() => { loadProducts() }, [loadProducts])
    useEffect(() => {
        getPOSCategories().then(setCategories)
        getPOSShiftSummary().then(setShiftSummary)
    }, [])

    const addToCart = (product: POSProduct) => {
        setCart(prev => {
            const existing = prev.find(c => c.productId === product.id)
            if (existing) {
                return prev.map(c =>
                    c.productId === product.id ? { ...c, qty: c.qty + 1 } : c
                )
            }
            return [...prev, {
                productId: product.id,
                skuCode: product.skuCode,
                productName: product.productName,
                qty: 1,
                unitPrice: product.unitPrice,
                discountPct: 0,
            }]
        })
    }

    const updateQty = (productId: string, delta: number) => {
        setCart(prev => prev.map(c => {
            if (c.productId !== productId) return c
            const newQty = Math.max(0, c.qty + delta)
            return newQty === 0 ? c : { ...c, qty: newQty }
        }))
    }

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(c => c.productId !== productId))
    }

    const handleBarcodeScan = async (code: string) => {
        if (!code.trim()) return
        setBarcodeError('')
        const product = await lookupByBarcode(code.trim())
        if (product) {
            addToCart(product)
            setBarcodeInput('')
        } else {
            setBarcodeError(`Không tìm thấy sản phẩm "${code}"`)
        }
    }

    const handleVATInvoice = async () => {
        if (!lastSale) return
        setVatLoading(true)
        toast.promise(
            generatePOSVATInvoice({ soNo: lastSale.soNo, customerName: 'Khách lẻ' }).then(result => {
                if (!result.success) throw new Error(result.error || 'Lỗi xuất hóa đơn')
                return result
            }),
            {
                loading: 'Đang xuất hóa đơn VAT...',
                success: (res: any) => `Đã xuất hóa đơn VAT ${res.invoiceNo}`,
                error: (err: any) => `Lỗi xuất VAT: ${err.message}`,
                finally: () => setVatLoading(false)
            }
        )
    }

    const cartTotal = cart.reduce((sum, item) => {
        const lineTotal = item.qty * item.unitPrice
        return sum + lineTotal * (1 - item.discountPct / 100)
    }, 0)

    const handleCheckout = async () => {
        setLoading(true)
        toast.promise(
            processPOSSale({
                items: cart,
                paymentMethod,
                cashReceived: paymentMethod === 'CASH' ? Number(cashReceived) : undefined,
            }).then(result => {
                if (!result.success) throw new Error(result.error || 'Thanh toán thất bại')

                setLastSale({ soNo: result.soNo!, totalAmount: result.totalAmount!, change: result.change })
                setShowPayment(false)
                setShowReceipt(true)
                setCart([])
                setCashReceived('')
                loadProducts()
                getPOSShiftSummary().then(setShiftSummary)
                return result
            }),
            {
                loading: 'Đang xử lý thanh toán...',
                success: 'Thanh toán thành công!',
                error: (err) => `Lỗi: ${err.message}`,
                finally: () => setLoading(false)
            }
        )
    }

    return (
        <div className="flex h-[calc(100vh-60px)] bg-lys-bg overflow-hidden -m-4 sm:-m-6">
            {/* LEFT: Product Catalog */}
            <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
                {/* Shift Stats Bar */}
                {shiftSummary && (
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-lys-border shadow-xs">
                            <BarChart3 size={14} className="text-lys-teal-strong" aria-hidden />
                            <span className="type-caption text-lys-secondary">Ca hôm nay:</span>
                            <span className="type-number font-bold text-lys-primary">{shiftSummary.transactionCount} đơn</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border border-lys-border shadow-xs">
                            <Receipt size={14} className="text-tone-success-fg" aria-hidden />
                            <span className="type-caption text-lys-secondary">Doanh thu:</span>
                            <span className="type-number font-bold text-tone-success-fg">{formatVND(shiftSummary.totalRevenue)}</span>
                        </div>
                        <Link
                            href="/dashboard/pos/loyalty"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-tone-warning-bg rounded-md border border-tone-warning-border text-tone-warning-fg hover:bg-amber-100/60 transition-colors"
                        >
                            <Star size={14} aria-hidden />
                            <span className="text-xs font-semibold">Loyalty</span>
                        </Link>
                    </div>
                )}

                {/* Barcode Scanner & Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div className="relative">
                        <ScanBarcode size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tone-warning-fg" aria-hidden />
                        <input
                            type="text"
                            placeholder="Quét mã vạch hoặc nhập SKU..."
                            value={barcodeInput}
                            onChange={e => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') handleBarcodeScan(barcodeInput) }}
                            className={cn(
                                'w-full pl-9 pr-16 py-2 rounded-md bg-white border text-sm text-lys-primary outline-none focus:ring-1 focus:ring-lys-teal focus:border-lys-teal transition-all shadow-xs',
                                barcodeError ? 'border-tone-danger-fg' : 'border-lys-border-strong'
                            )}
                        />
                        <button
                            type="button"
                            onClick={() => handleBarcodeScan(barcodeInput)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded bg-tone-warning-bg hover:bg-tone-warning-border text-tone-warning-fg font-semibold text-xs transition-colors"
                        >
                            Tìm
                        </button>
                    </div>

                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" aria-hidden />
                        <input
                            type="text"
                            placeholder="Tìm sản phẩm hoặc mã SKU..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-md bg-white border border-lys-border-strong text-sm text-lys-primary outline-none focus:ring-1 focus:ring-lys-teal focus:border-lys-teal transition-all shadow-xs"
                        />
                    </div>
                </div>
                {barcodeError && (
                    <p className="type-caption text-tone-danger-fg -mt-2 mb-2 px-1">{barcodeError}</p>
                )}

                {/* Category Pills */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setActiveCategory('ALL')}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                            activeCategory === 'ALL'
                                ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-xs'
                                : 'bg-white text-lys-secondary border-lys-border hover:bg-lys-subtle'
                        )}
                    >
                        Tất cả
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.value}
                            type="button"
                            onClick={() => setActiveCategory(cat.value)}
                            className={cn(
                                'px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                                activeCategory === cat.value
                                    ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-xs'
                                    : 'bg-white text-lys-secondary border-lys-border hover:bg-lys-subtle'
                            )}
                        >
                            {cat.label} ({cat.count})
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 align-start pr-1">
                    {products.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => addToCart(p)}
                            disabled={p.qtyAvailable <= 0}
                            className={cn(
                                'p-3.5 rounded-lg border text-left bg-white transition-all flex flex-col justify-between shadow-xs',
                                p.qtyAvailable > 0
                                    ? 'cursor-pointer border-lys-border hover:border-lys-teal hover:shadow-sm'
                                    : 'cursor-not-allowed opacity-50 border-lys-border'
                            )}
                        >
                            <div>
                                <div className="flex justify-center my-1.5">
                                    <div className="w-10 h-10 rounded-full bg-lys-teal-soft flex items-center justify-center">
                                        <Wine size={20} className="text-lys-teal-strong" aria-hidden />
                                    </div>
                                </div>
                                <p className="type-caption text-lys-muted mb-0.5">{p.skuCode}</p>
                                <p className="text-xs font-semibold text-lys-primary line-clamp-2 min-h-[32px] leading-tight">
                                    {p.productName}
                                </p>
                            </div>
                            <div className="flex items-baseline justify-between mt-3 pt-2 border-t border-lys-border">
                                <span className="type-number font-bold text-lys-teal-strong text-xs">
                                    {p.unitPrice > 0 ? formatVND(p.unitPrice) : '—'}
                                </span>
                                <span className={cn('type-caption', p.qtyAvailable <= 5 ? 'text-tone-warning-fg font-semibold' : 'text-lys-muted')}>
                                    Kho: {p.qtyAvailable}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: Cart Panel */}
            <div className="w-80 lg:w-96 bg-white border-l border-lys-border flex flex-col shadow-sm">
                <div className="p-4 border-b border-lys-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingCart size={18} className="text-lys-teal-strong" aria-hidden />
                        <h2 className="text-sm font-bold text-lys-primary">
                            Giỏ hàng <span className="text-lys-muted font-normal">({cart.length})</span>
                        </h2>
                    </div>
                    {cart.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setCart([])}
                            className="type-caption text-tone-danger-fg hover:underline cursor-pointer"
                        >
                            Xóa hết
                        </button>
                    )}
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.length === 0 ? (
                        <div className="text-center py-20">
                            <ShoppingCart size={32} className="mx-auto mb-2 text-lys-border-strong" aria-hidden />
                            <p className="type-caption">Chọn sản phẩm bên trái để thêm vào giỏ</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.productId} className="p-2.5 rounded-lg border border-lys-border bg-lys-subtle/50">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div>
                                        <p className="text-xs font-semibold text-lys-primary leading-tight line-clamp-1">{item.productName}</p>
                                        <p className="type-caption text-lys-muted">{item.skuCode}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFromCart(item.productId)}
                                        className="p-1 rounded text-lys-muted hover:text-tone-danger-fg hover:bg-tone-danger-bg transition-colors cursor-pointer"
                                        aria-label="Xóa"
                                    >
                                        <Trash2 size={13} aria-hidden />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 bg-white border border-lys-border rounded-md px-1 py-0.5">
                                        <button
                                            type="button"
                                            onClick={() => updateQty(item.productId, -1)}
                                            className="w-5 h-5 rounded flex items-center justify-center text-lys-secondary hover:bg-lys-subtle cursor-pointer"
                                            aria-label="Giảm"
                                        >
                                            <Minus size={11} aria-hidden />
                                        </button>
                                        <span className="type-number font-bold text-lys-primary min-w-[20px] text-center text-xs">
                                            {item.qty}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => updateQty(item.productId, 1)}
                                            className="w-5 h-5 rounded flex items-center justify-center text-lys-teal-strong hover:bg-lys-teal-soft cursor-pointer"
                                            aria-label="Tăng"
                                        >
                                            <Plus size={11} aria-hidden />
                                        </button>
                                    </div>
                                    <span className="type-number font-bold text-xs text-lys-teal-strong">
                                        {formatVND(item.qty * item.unitPrice)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Cart Footer */}
                <div className="border-t border-lys-border p-4 bg-lys-card">
                    <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs font-semibold text-lys-secondary">Tổng cộng</span>
                        <span className="type-number text-lg font-extrabold text-lys-primary">
                            {formatVND(cartTotal)}
                        </span>
                    </div>

                    {!showPayment ? (
                        <Button
                            className="w-full"
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                        >
                            Thanh Toán
                        </Button>
                    ) : (
                        <div className="space-y-3 animate-fade-in">
                            {/* Payment Method Selector */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { method: 'CASH' as const, icon: Banknote, label: 'Tiền mặt' },
                                    { method: 'BANK_TRANSFER' as const, icon: CreditCard, label: 'Chuyển khoản' },
                                    { method: 'QR' as const, icon: QrCode, label: 'QR' },
                                ].map(({ method, icon: Icon, label }) => (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentMethod(method)}
                                        className={cn(
                                            'p-2 rounded-md border flex flex-col items-center gap-1 cursor-pointer transition-all text-[11px] font-semibold',
                                            paymentMethod === method
                                                ? 'bg-lys-teal-soft border-lys-teal text-lys-teal-strong shadow-xs'
                                                : 'bg-white border-lys-border text-lys-secondary hover:bg-lys-subtle'
                                        )}
                                    >
                                        <Icon size={16} aria-hidden />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'CASH' && (
                                <div>
                                    <label className="type-caption text-lys-secondary block mb-1">Tiền khách đưa</label>
                                    <input
                                        type="number"
                                        placeholder="Nhập số tiền..."
                                        value={cashReceived}
                                        onChange={e => setCashReceived(e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-lys-border-strong text-sm text-lys-primary font-semibold outline-none focus:ring-1 focus:ring-lys-teal focus:border-lys-teal"
                                    />
                                    {Number(cashReceived) > cartTotal && (
                                        <p className="type-caption text-tone-success-fg mt-1">
                                            Tiền thối: <strong className="type-number">{formatVND(Number(cashReceived) - cartTotal)}</strong>
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    className="flex-1"
                                    onClick={() => setShowPayment(false)}
                                >
                                    Huỷ
                                </Button>
                                <Button
                                    className="flex-2"
                                    onClick={handleCheckout}
                                    loading={loading}
                                    disabled={loading}
                                >
                                    {loading ? 'Đang xử lý...' : 'Xác Nhận'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Receipt Modal */}
            {showReceipt && lastSale && (
                <Modal
                    open={showReceipt}
                    onClose={() => setShowReceipt(false)}
                    title="Thanh toán thành công!"
                    className="max-w-sm text-center"
                    footer={
                        <div className="flex flex-col gap-2 w-full">
                            <Button className="w-full" onClick={() => setShowReceipt(false)}>
                                Đơn mới
                            </Button>
                            <Button
                                variant="secondary"
                                className="w-full"
                                onClick={handleVATInvoice}
                                loading={vatLoading}
                                disabled={vatLoading}
                            >
                                <FileText size={14} aria-hidden />
                                {vatLoading ? 'Đang xuất...' : 'Xuất Hóa Đơn VAT'}
                            </Button>
                        </div>
                    }
                >
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-tone-success-bg text-tone-success-fg flex items-center justify-center mb-3">
                            <Check size={24} aria-hidden />
                        </div>
                        <p className="type-caption text-lys-muted mb-4">Mã đơn: <strong className="text-lys-primary type-number">{lastSale.soNo}</strong></p>

                        <div className="w-full p-3.5 bg-lys-subtle rounded-lg border border-lys-border space-y-2">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-lys-secondary">Tổng tiền</span>
                                <span className="type-number font-bold text-lys-primary text-sm">{formatVND(lastSale.totalAmount)}</span>
                            </div>
                            {lastSale.change !== undefined && (
                                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-lys-border">
                                    <span className="text-lys-secondary">Tiền thối</span>
                                    <span className="type-number font-bold text-tone-warning-fg">{formatVND(lastSale.change)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    )
}
