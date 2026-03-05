'use client'

import { useState, useEffect, useCallback } from 'react'
import { getPOSProducts, getPOSCategories, processPOSSale, getPOSShiftSummary, lookupByBarcode, generatePOSVATInvoice } from './actions'
import type { POSProduct, CartItem } from './actions'
import { formatVND } from '@/lib/utils'
import {
    Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote,
    QrCode, Wine, Check, X, BarChart3, Receipt, ScanBarcode, FileText
} from 'lucide-react'

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
        const result = await generatePOSVATInvoice({ soNo: lastSale.soNo, customerName: 'Khách lẻ' })
        setVatLoading(false)
        if (result.success) {
            alert(`Đã xuất hóa đơn VAT: ${result.invoiceNo}`)
        } else {
            alert(result.error)
        }
    }

    const cartTotal = cart.reduce((sum, item) => {
        const lineTotal = item.qty * item.unitPrice
        return sum + lineTotal * (1 - item.discountPct / 100)
    }, 0)

    const handleCheckout = async () => {
        setLoading(true)
        const result = await processPOSSale({
            items: cart,
            paymentMethod,
            cashReceived: paymentMethod === 'CASH' ? Number(cashReceived) : undefined,
        })
        setLoading(false)

        if (result.success) {
            setLastSale({ soNo: result.soNo!, totalAmount: result.totalAmount!, change: result.change })
            setShowPayment(false)
            setShowReceipt(true)
            setCart([])
            setCashReceived('')
            loadProducts()
            getPOSShiftSummary().then(setShiftSummary)
        } else {
            alert(result.error)
        }
    }

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 60px)', gap: 0, background: '#0B1A2B' }}>
            {/* LEFT: Products */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', overflow: 'hidden' }}>
                {/* Shift Stats Bar */}
                {shiftSummary && (
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#142433', borderRadius: '8px', border: '1px solid #2A4355' }}>
                            <BarChart3 size={14} style={{ color: '#87CBB9' }} />
                            <span style={{ fontSize: '12px', color: '#8AAEBB' }}>Ca hôm nay:</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#E8F1F2' }}>{shiftSummary.transactionCount} đơn</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#142433', borderRadius: '8px', border: '1px solid #2A4355' }}>
                            <Receipt size={14} style={{ color: '#5BA88A' }} />
                            <span style={{ fontSize: '12px', color: '#8AAEBB' }}>Doanh thu:</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#5BA88A' }}>{formatVND(shiftSummary.totalRevenue)}</span>
                        </div>
                    </div>
                )}

                {/* Barcode Scanner Input */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <ScanBarcode size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#D4A853' }} />
                        <input
                            type="text" placeholder="Quét mã vạch hoặc nhập SKU..."
                            value={barcodeInput}
                            onChange={e => { setBarcodeInput(e.target.value); setBarcodeError('') }}
                            onKeyDown={e => { if (e.key === 'Enter') handleBarcodeScan(barcodeInput) }}
                            style={{
                                width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px',
                                background: '#142433', border: `1px solid ${barcodeError ? '#8B1A2E' : '#2A4355'}`, color: '#E8F1F2',
                                fontSize: '13px', outline: 'none', fontFamily: '"DM Mono", monospace',
                            }}
                        />
                    </div>
                    <button onClick={() => handleBarcodeScan(barcodeInput)}
                        style={{
                            padding: '8px 14px', borderRadius: '8px', border: 'none',
                            background: '#D4A853', color: '#0B1A2B', fontWeight: 700, fontSize: '12px',
                            cursor: 'pointer',
                        }}
                    >Tìm</button>
                </div>
                {barcodeError && (
                    <p style={{ fontSize: '11px', color: '#8B1A2E', margin: '-8px 0 8px', padding: '0 4px' }}>{barcodeError}</p>
                )}

                {/* Search & Filters */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#4A6A7A' }} />
                        <input
                            type="text" placeholder="Tìm sản phẩm hoặc mã SKU..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px',
                                background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2',
                                fontSize: '13px', outline: 'none',
                            }}
                        />
                    </div>
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setActiveCategory('ALL')}
                        style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                            border: '1px solid', cursor: 'pointer',
                            ...(activeCategory === 'ALL'
                                ? { background: '#87CBB9', color: '#0B1A2B', borderColor: '#87CBB9' }
                                : { background: 'transparent', color: '#8AAEBB', borderColor: '#2A4355' }),
                        }}
                    >Tất cả</button>
                    {categories.map(cat => (
                        <button key={cat.value}
                            onClick={() => setActiveCategory(cat.value)}
                            style={{
                                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                border: '1px solid', cursor: 'pointer',
                                ...(activeCategory === cat.value
                                    ? { background: '#87CBB9', color: '#0B1A2B', borderColor: '#87CBB9' }
                                    : { background: 'transparent', color: '#8AAEBB', borderColor: '#2A4355' }),
                            }}
                        >{cat.label} ({cat.count})</button>
                    ))}
                </div>

                {/* Product Grid */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '10px', alignContent: 'start',
                }}>
                    {products.map(p => (
                        <button key={p.id}
                            onClick={() => addToCart(p)}
                            disabled={p.qtyAvailable <= 0}
                            style={{
                                padding: '14px 12px', borderRadius: '10px', cursor: p.qtyAvailable > 0 ? 'pointer' : 'not-allowed',
                                background: '#142433', border: '1px solid #2A4355', textAlign: 'left',
                                opacity: p.qtyAvailable <= 0 ? 0.4 : 1,
                                transition: 'border-color 0.15s',
                            }}
                            onMouseEnter={e => { if (p.qtyAvailable > 0) e.currentTarget.style.borderColor = '#87CBB9' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A4355' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                                <Wine size={26} style={{ color: '#87CBB9' }} />
                            </div>
                            <p style={{ fontSize: '11px', color: '#4A6A7A', marginBottom: '2px' }}>{p.skuCode}</p>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#E8F1F2', lineHeight: '1.3', minHeight: '32px' }}>
                                {p.productName.length > 30 ? p.productName.slice(0, 30) + '…' : p.productName}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#87CBB9' }}>
                                    {p.unitPrice > 0 ? formatVND(p.unitPrice) : '—'}
                                </span>
                                <span style={{ fontSize: '11px', color: p.qtyAvailable <= 5 ? '#D4A853' : '#4A6A7A' }}>
                                    SL: {p.qtyAvailable}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* RIGHT: Cart */}
            <div style={{
                width: '360px', background: '#101E2E', borderLeft: '1px solid #2A4355',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #2A4355' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingCart size={18} style={{ color: '#87CBB9' }} />
                        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#E8F1F2', margin: 0 }}>
                            Giỏ hàng <span style={{ color: '#4A6A7A', fontWeight: 400 }}>({cart.length})</span>
                        </h2>
                    </div>
                </div>

                {/* Cart Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {cart.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#4A6A7A', marginTop: '40px', fontSize: '13px' }}>
                            Chọn sản phẩm để thêm vào giỏ
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {cart.map(item => (
                                <div key={item.productId} style={{
                                    padding: '10px', borderRadius: '8px', background: '#142433', border: '1px solid #2A4355',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <div>
                                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#E8F1F2', margin: 0 }}>{item.productName.slice(0, 25)}</p>
                                            <p style={{ fontSize: '11px', color: '#4A6A7A', margin: 0 }}>{item.skuCode}</p>
                                        </div>
                                        <button onClick={() => removeFromCart(item.productId)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                                            <Trash2 size={14} style={{ color: '#8B1A2E' }} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button onClick={() => updateQty(item.productId, -1)}
                                                style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#0B1A2B', border: '1px solid #2A4355', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Minus size={12} style={{ color: '#8AAEBB' }} />
                                            </button>
                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#E8F1F2', minWidth: '24px', textAlign: 'center' }}>{item.qty}</span>
                                            <button onClick={() => updateQty(item.productId, 1)}
                                                style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#0B1A2B', border: '1px solid #2A4355', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Plus size={12} style={{ color: '#87CBB9' }} />
                                            </button>
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#87CBB9' }}>
                                            {formatVND(item.qty * item.unitPrice)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cart Footer */}
                <div style={{ borderTop: '1px solid #2A4355', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#8AAEBB' }}>Tổng cộng</span>
                        <span style={{ fontSize: '20px', fontWeight: 800, color: '#E8F1F2', fontFamily: 'var(--font-mono), monospace' }}>
                            {formatVND(cartTotal)}
                        </span>
                    </div>

                    {!showPayment ? (
                        <button
                            onClick={() => setShowPayment(true)}
                            disabled={cart.length === 0}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                                background: cart.length > 0 ? '#5BA88A' : '#2A4355',
                                color: cart.length > 0 ? '#fff' : '#4A6A7A',
                                fontSize: '14px', fontWeight: 700, cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                            }}
                        >
                            Thanh Toán
                        </button>
                    ) : (
                        <div>
                            {/* Payment Method */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                {[
                                    { method: 'CASH' as const, icon: Banknote, label: 'Tiền mặt' },
                                    { method: 'BANK_TRANSFER' as const, icon: CreditCard, label: 'Chuyển khoản' },
                                    { method: 'QR' as const, icon: QrCode, label: 'QR' },
                                ].map(({ method, icon: Icon, label }) => (
                                    <button key={method}
                                        onClick={() => setPaymentMethod(method)}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '6px',
                                            border: '1px solid',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                                            cursor: 'pointer', fontSize: '10px', fontWeight: 600,
                                            ...(paymentMethod === method
                                                ? { background: 'rgba(91,168,138,0.15)', borderColor: '#5BA88A', color: '#5BA88A' }
                                                : { background: 'transparent', borderColor: '#2A4355', color: '#8AAEBB' }),
                                        }}
                                    >
                                        <Icon size={16} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'CASH' && (
                                <input
                                    type="number" placeholder="Tiền khách đưa..."
                                    value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px',
                                        background: '#0B1A2B', border: '1px solid #2A4355', color: '#E8F1F2',
                                        fontSize: '14px', fontWeight: 600, outline: 'none',
                                    }}
                                />
                            )}

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setShowPayment(false)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#2A4355', border: 'none', color: '#8AAEBB', cursor: 'pointer', fontWeight: 600 }}>
                                    Huỷ
                                </button>
                                <button onClick={handleCheckout} disabled={loading}
                                    style={{
                                        flex: 2, padding: '10px', borderRadius: '6px', border: 'none',
                                        background: '#5BA88A', color: '#fff', cursor: 'pointer',
                                        fontWeight: 700, fontSize: '14px',
                                    }}>
                                    {loading ? 'Đang xử lý...' : 'Xác Nhận'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Receipt Modal */}
                {showReceipt && lastSale && (
                    <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    }}>
                        <div style={{
                            background: '#142433', borderRadius: '12px', padding: '32px',
                            width: '360px', border: '1px solid #2A4355', textAlign: 'center',
                        }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
                                background: 'rgba(91,168,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Check size={28} style={{ color: '#5BA88A' }} />
                            </div>
                            <h3 style={{ color: '#E8F1F2', margin: '0 0 8px', fontSize: '18px' }}>Thanh toán thành công!</h3>
                            <p style={{ color: '#4A6A7A', fontSize: '13px', margin: '0 0 16px' }}>Mã đơn: {lastSale.soNo}</p>
                            <div style={{ padding: '12px', background: '#0B1A2B', borderRadius: '8px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ color: '#8AAEBB', fontSize: '13px' }}>Tổng tiền</span>
                                    <span style={{ color: '#E8F1F2', fontWeight: 700, fontSize: '16px' }}>{formatVND(lastSale.totalAmount)}</span>
                                </div>
                                {lastSale.change !== undefined && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#8AAEBB', fontSize: '13px' }}>Tiền thối</span>
                                        <span style={{ color: '#D4A853', fontWeight: 700, fontSize: '16px' }}>{formatVND(lastSale.change)}</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowReceipt(false)}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                                    background: '#5BA88A', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '14px',
                                }}>
                                Đơn mới
                            </button>
                            <button onClick={handleVATInvoice} disabled={vatLoading}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #2A4355',
                                    background: 'transparent', color: '#D4A853', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                                    marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                }}
                            >
                                <FileText size={14} />
                                {vatLoading ? 'Đang xuất...' : 'Xuất Hóa Đơn VAT'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
