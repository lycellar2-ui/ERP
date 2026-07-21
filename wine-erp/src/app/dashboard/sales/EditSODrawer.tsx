'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, Tag } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    updateSalesOrder, SOUpdateInput, SalesChannel,
    getProductPricesForChannel, getSalesOrderDetailWithMargin,
    getLegalEntities, LegalEntityRow,
} from './actions'
import { formatVND } from '@/lib/utils'
import { getCustomerResolvedPrices, ResolvedPrice } from '@/app/dashboard/price-list/customer-rules-actions'
import { useQuery } from '@tanstack/react-query'

const CHANNELS: { value: SalesChannel; label: string }[] = [
    { value: 'HORECA', label: 'HORECA' },
    { value: 'WHOLESALE_DISTRIBUTOR', label: 'Đại Lý / Wholesale' },
    { value: 'VIP_RETAIL', label: 'VIP Retail' },
    { value: 'DIRECT_INDIVIDUAL', label: 'Trực Tiếp' },
]

const getPriceBadgeStyle = (source: string) => {
    switch (source) {
        case 'SPECIAL_PRICE':
            return { background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }
        case 'FIXED_PRICE':
            return { background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }
        case 'FIXED_DISCOUNT':
            return { background: 'rgba(230,138,0,0.15)', color: '#E68A00', border: '1px solid rgba(230,138,0,0.3)' }
        case 'CHANNEL_BASE':
            return { background: 'rgba(91,168,138,0.1)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.2)' }
        case 'RETAIL_FALLBACK':
            return { background: 'rgba(138,180,248,0.1)', color: '#8AB4F8', border: '1px solid rgba(138,180,248,0.2)' }
        default:
            return { background: 'rgba(74,106,122,0.1)', color: '#4A6A7A', border: '1px solid rgba(74,106,122,0.2)' }
    }
}

const getPriceBadgeLabel = (resolved: any, defaultChannel: string) => {
    switch (resolved.source) {
        case 'SPECIAL_PRICE':
            return 'Giá Đặc Biệt (Campaign)'
        case 'FIXED_PRICE':
            return 'Giá Cố Định Riêng'
        case 'FIXED_DISCOUNT':
            return `Chiết Khấu Cố Định (-${resolved.discountPct}%)`
        case 'CHANNEL_BASE':
            return `Giá Kênh ${defaultChannel}`
        case 'RETAIL_FALLBACK':
            return 'Giá Bán Lẻ Mặc Định'
        default:
            return 'Giá Mặc Định'
    }
}

interface Customer {
    id: string
    name: string
    code: string
    creditLimit: number
    creditHold: boolean
    paymentTerm: string
    channel: string | null
    parentId: string | null
    entityType: string
    allowDirectSO: boolean
    brandGroup: string | null
    addresses?: {
        id: string
        label: string
        address: string
        ward?: string | null
        district?: string | null
        city?: string | null
        isDefault: boolean
        isBilling: boolean
    }[]
    parent?: {
        id: string
        name: string
        code: string
        creditLimit: number
        creditHold: boolean
    } | null
}
interface ProductItem { id: string; skuCode: string; productName: string; wineType: string; country: string; totalStock: number; vatRate?: number }
interface SOLine { productId: string; productName: string; skuCode: string; qtyOrdered: number; unitPrice: number; lineDiscountPct: number; stock: number; priceSource?: string | null; vatRate?: number }

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
    userId: string
}

export function EditSODrawer({ open, soId, onClose, onSaved, userId }: EditSODrawerProps) {
    // TanStack Query to fetch and cache reference data (shared cache with CreateSO)
    const { data: refData } = useQuery({
        queryKey: ['so_reference_data'],
        queryFn: async () => {
            const [c, p, e] = await Promise.all([
                getCustomersForSO(),
                getProductsWithStock(),
                getLegalEntities(),
            ])
            return {
                customers: (c as any) as Customer[],
                products: p as ProductItem[],
                entities: e as LegalEntityRow[]
            }
        },
        enabled: open,
        staleTime: 5 * 60_000,
    })

    const customers = refData?.customers ?? []
    const products = refData?.products ?? []
    const entities = refData?.entities ?? []
    const loadingData = !refData && open

    const sortedCustomersForSelect = useMemo(() => {
        const parentsAndStandalone = customers.filter(c => !c.parentId)
        const result: typeof customers = []

        parentsAndStandalone.forEach(parent => {
            result.push(parent)
            const children = customers.filter(c => c.parentId === parent.id)
            children.forEach(child => {
                result.push({
                    ...child,
                    name: `\u00A0\u00A0\u00A0↳ ${child.name}`
                })
            })
        })

        const childIds = result.map(r => r.id)
        const orphans = customers.filter(c => c.parentId && !childIds.includes(c.id))
        orphans.forEach(child => {
            result.push({
                ...child,
                name: `\u00A0\u00A0\u00A0↳ ${child.name}`
            })
        })

        return result
    }, [customers])

    const [loadingSO, setLoadingSO] = useState(true)

    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [lines, setLines] = useState<SOLine[]>([])

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [arBalance, setArBalance] = useState(0)

    const [priceMap, setPriceMap] = useState<Record<string, ResolvedPrice>>({})

    const [saving, setSaving] = useState(false)
    const [soNo, setSoNo] = useState('')
    const [legalEntityId, setLegalEntityId] = useState('')
    const [shippingAddressId, setShippingAddressId] = useState('')

    const [customerSearchInput, setCustomerSearchInput] = useState('')
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

    const activeProductIds = useMemo(() => new Set(lines.map(l => l.productId)), [lines])
    
    const [addProductSearchQuery, setAddProductSearchQuery] = useState('')
    const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false)

    // Autocomplete customer selection filter
    const filteredCustomers = useMemo(() => {
        const q = customerSearchInput.trim().toLowerCase()
        if (!q || q.startsWith('[')) return sortedCustomersForSelect.slice(0, 500)
        return sortedCustomersForSelect.filter(c => 
            c.name.toLowerCase().includes(q) || 
            c.code.toLowerCase().includes(q)
        ).slice(0, 500)
    }, [customerSearchInput, sortedCustomersForSelect])

    useEffect(() => {
        if (selectedCustomer) {
            setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name}`)
        } else {
            setCustomerSearchInput('')
        }
    }, [selectedCustomer])

    const getFilteredAddProducts = useCallback((query: string) => {
        const q = query.trim().toLowerCase()
        const available = products.filter(p => !activeProductIds.has(p.id))
        if (!q) return available.slice(0, 100)
        return available.filter(p =>
            p.productName.toLowerCase().includes(q) ||
            p.skuCode.toLowerCase().includes(q)
        )
    }, [products, activeProductIds])

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
        setLegalEntityId(detail.legalEntityId ?? '')
        setShippingAddressId(detail.shippingAddressId ?? '')

        // Set lines from detail
        setLines(detail.lines.map((l: any) => ({
            productId: l.productId,
            productName: l.product.productName,
            skuCode: l.product.skuCode,
            qtyOrdered: Number(l.qtyOrdered),
            unitPrice: Number(l.unitPrice),
            lineDiscountPct: Number(l.lineDiscountPct ?? 0),
            stock: 0, // will be populated from products list
            priceSource: l.priceSource ?? null,
            vatRate: l.vatRate ? Number(l.vatRate) : 10,
        })))

        setLoadingSO(false)
    }, [soId, onClose])

    useEffect(() => {
        if (open) {
            loadSOData()
        }
    }, [open, loadSOData])

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

    // Load customer-resolved prices or fallback channel prices
    const loadPrices = useCallback(async (custId: string | null, ch: SalesChannel, updateLines: boolean = false) => {
        try {
            if (custId) {
                const resolvedPrices = await getCustomerResolvedPrices(custId)
                setPriceMap(resolvedPrices)
                if (updateLines) {
                    setLines(prev => prev.map(l => {
                        const resolved = resolvedPrices[l.productId]
                        if (resolved) {
                            return { ...l, unitPrice: resolved.price, priceSource: resolved.source }
                        }
                        return l
                    }))
                }
            } else {
                const basePrices = await getProductPricesForChannel(ch)
                const converted: Record<string, ResolvedPrice> = {}
                for (const [prodId, price] of Object.entries(basePrices)) {
                    converted[prodId] = {
                        price: price,
                        source: 'CHANNEL_BASE'
                    }
                }
                setPriceMap(converted)
                if (updateLines) {
                    setLines(prev => prev.map(l => {
                        const resolved = converted[l.productId]
                        if (resolved) {
                            return { ...l, unitPrice: resolved.price, priceSource: resolved.source }
                        }
                        return l
                    }))
                }
            }
        } catch (err) {
            console.error("Lỗi load bảng giá:", err)
        }
    }, [])

    useEffect(() => {
        if (open && !loadingSO && !loadingData) {
            loadPrices(customerId || null, channel, false)
        }
    }, [open, loadingSO, loadingData])

    const handleCustomerChange = async (cId: string) => {
        setCustomerId(cId)
        const c = customers.find(c => c.id === cId)
        setSelectedCustomer(c ?? null)
        if (c) {
            const defaultAddress = c.addresses?.find(a => a.isDefault) || c.addresses?.[0]
            setShippingAddressId(defaultAddress?.id ?? '')
            const nextChannel = (c.channel ?? 'HORECA') as SalesChannel
            setChannel(nextChannel)
            if (c.paymentTerm) setPaymentTerm(c.paymentTerm)
            setArBalance(await getCustomerARBalance(cId))
            loadPrices(cId, nextChannel, true)
        } else {
            loadPrices(null, channel, true)
        }
    }

    const handleChannelChange = async (newChannel: SalesChannel) => {
        setChannel(newChannel)
        loadPrices(customerId || null, newChannel, true)
    }

    const addLine = (productId: string) => {
        if (lines.find(l => l.productId === productId)) return toast.error('Sản phẩm đã có trong đơn')
        const p = products.find(p => p.id === productId)
        if (!p) return
        const price = priceMap[productId]?.price ?? 0
        const source = priceMap[productId]?.source ?? null
        setLines(prev => [...prev, {
            productId: p.id, productName: p.productName, skuCode: p.skuCode,
            qtyOrdered: 1, unitPrice: price, lineDiscountPct: 0, stock: p.totalStock,
            priceSource: source, vatRate: p.vatRate ? Number(p.vatRate) : 10,
        }])
    }

    const updateLine = (idx: number, field: keyof SOLine, value: any) => {
        setLines(prev => prev.map((l, i) => {
            if (i !== idx) return l
            if (field === 'productId') {
                const p = products.find(p => p.id === value)!
                const price = priceMap[value]?.price ?? 0
                const source = priceMap[value]?.source ?? null
                return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice: price, priceSource: source, vatRate: p.vatRate ? Number(p.vatRate) : 10 }
            }
            return { ...l, [field]: value }
        }))
    }

    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

    const subtotal = lines.reduce((sum, l) => {
        const line = l.qtyOrdered * l.unitPrice
        return sum + line - line * (l.lineDiscountPct / 100)
    }, 0)
    const vatAmount = lines.reduce((sum, l) => {
        const line = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)
        const lineAfterOrderDiscount = line * (1 - orderDiscount / 100)
        return sum + lineAfterOrderDiscount * ((l.vatRate ?? 10) / 100)
    }, 0)
    const finalTotal = subtotal * (1 - orderDiscount / 100) + vatAmount

    const effectiveCreditLimit = selectedCustomer
        ? (selectedCustomer.parentId && Number(selectedCustomer.creditLimit) === 0 && selectedCustomer.parent)
            ? Number(selectedCustomer.parent.creditLimit)
            : Number(selectedCustomer.creditLimit)
        : 0
    const creditAvailable = selectedCustomer ? effectiveCreditLimit - arBalance : 0
    const isCreditHold = selectedCustomer?.creditHold || (selectedCustomer?.parent?.creditHold ?? false)
    const creditWarning = selectedCustomer && (finalTotal > creditAvailable || isCreditHold)

    const handleSave = async () => {
        if (!customerId) return toast.error('Vui lòng chọn khách hàng')
        if (!legalEntityId) return toast.error('Vui lòng chọn pháp nhân xuất tuyến')
        if (lines.length === 0) return toast.error('Thêm ít nhất 1 sản phẩm')

        setSaving(true)
        const promise = updateSalesOrder({
            soId,
            customerId,
            channel,
            paymentTerm,
            orderDiscount,
            legalEntityId,
            shippingAddressId: shippingAddressId || undefined,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                vatRate: l.vatRate ?? 10,
                priceSource: l.priceSource || undefined,
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
            <div className="hidden md:block md:flex-1" onClick={onClose} />
            <div className="w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl h-full overflow-y-auto" style={{ background: '#0F2133', borderLeft: '1px solid #2A4355' }}>
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
                            {/* Customer Autocomplete Search */}
                            <div>
                                <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Khách Hàng</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Gõ mã hoặc tên khách hàng để tìm..."
                                        value={customerSearchInput}
                                        onFocus={() => setCustomerDropdownOpen(true)}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setCustomerDropdownOpen(false)
                                                if (selectedCustomer) {
                                                    setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name}`)
                                                } else {
                                                    setCustomerSearchInput('')
                                                }
                                            }, 200)
                                        }}
                                        onChange={e => {
                                            setCustomerSearchInput(e.target.value)
                                            setCustomerDropdownOpen(true)
                                        }}
                                        className="w-full px-3 py-2 text-sm outline-none"
                                        style={inputStyle}
                                    />
                                    {customerDropdownOpen && (
                                        <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded bg-white dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] w-full shadow-2xl">
                                            {filteredCustomers.length === 0 ? (
                                                <div className="px-3 py-3 text-xs text-slate-400 dark:text-gray-500">
                                                    Không tìm thấy khách hàng
                                                </div>
                                            ) : (
                                                filteredCustomers.map(c => {
                                                    const isCompany = c.entityType === 'COMPANY'
                                                     const isDisabled = isCompany && !c.allowDirectSO
                                                     return (
                                                         <div
                                                             key={c.id}
                                                             onMouseDown={() => {
                                                                 if (isDisabled) return
                                                                 handleCustomerChange(c.id)
                                                                 setCustomerDropdownOpen(false)
                                                             }}
                                                             className={`px-3 py-2.5 text-xs text-left border-b border-slate-100 dark:border-[#2A4355]/30 last:border-b-0 transition-colors ${
                                                                 isDisabled 
                                                                     ? 'bg-slate-50 dark:bg-[#0F1C28]/80 text-slate-400 dark:text-gray-500 opacity-60 cursor-not-allowed' 
                                                                     : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1B2E3D] text-slate-700 dark:text-white'
                                                             }`}
                                                         >
                                                             <span className={`font-bold mr-2 ${isDisabled ? 'text-slate-400 dark:text-[#87CBB9]/60' : 'text-teal-600 dark:text-[#87CBB9]'}`}>
                                                                 [{c.code}]
                                                             </span>
                                                             <span className="font-medium">{c.name}</span>
                                                             {isCompany && (
                                                                 <span className={`ml-2 text-[10px] uppercase font-semibold ${isDisabled ? 'text-slate-400 dark:text-[#8AAEBB]/60' : 'text-slate-500 dark:text-[#8AAEBB]'}`}>
                                                                     {c.allowDirectSO ? '🏢 Công ty (Được bán)' : '🏢 Công ty (Mẹ - Chỉ gánh nợ)'}
                                                                 </span>
                                                             )}
                                                             {c.brandGroup && (
                                                                 <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-[#2A4355]/50 border border-slate-200 dark:border-[#2A4355] text-slate-600 dark:text-gray-300 rounded font-semibold">
                                                                     ✨ {c.brandGroup}
                                                                 </span>
                                                             )}
                                                         </div>
                                                     )
                                                 })
                                             )}
                                         </div>
                                     )}
                                </div>
                            </div>

                            {/* Shipping Address Selection */}
                            {selectedCustomer && (
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Địa Chỉ Giao Hàng *</label>
                                    {(!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) ? (
                                        <div className="p-3 rounded-md text-xs bg-red-950/20 border border-red-500/20 text-red-400">
                                            ⚠️ Khách hàng chưa cấu hình địa chỉ giao hàng. Hãy cấu hình ở mục Khách hàng.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <select
                                                value={shippingAddressId}
                                                onChange={e => setShippingAddressId(e.target.value)}
                                                className="w-full px-3 py-2 text-sm outline-none"
                                                style={inputStyle}
                                            >
                                                <option value="">-- Chọn địa chỉ giao hàng --</option>
                                                {selectedCustomer.addresses.map(addr => (
                                                    <option key={addr.id} value={addr.id}>
                                                        {addr.label} ({addr.address})
                                                    </option>
                                                ))}
                                            </select>
                                            {shippingAddressId && (() => {
                                                const selectedAddr = selectedCustomer.addresses.find(a => a.id === shippingAddressId)
                                                if (!selectedAddr) return null
                                                return (
                                                    <div className="p-3 rounded bg-[#142433] border border-[#2A4355]/40 text-xs text-gray-300 leading-relaxed">
                                                        <span className="font-bold text-[#87CBB9]">{selectedAddr.label}: </span>
                                                        {selectedAddr.address}
                                                        {selectedAddr.ward && `, ${selectedAddr.ward}`}
                                                        {selectedAddr.district && `, ${selectedAddr.district}`}
                                                        {selectedAddr.city && `, ${selectedAddr.city}`}
                                                        {selectedAddr.isDefault && <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-[#5BA88A]/20 text-[#5BA88A] rounded border border-[#5BA88A]/30">Mặc định</span>}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Channel + Payment + Legal Entity */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Kênh bán</label>
                                    <select value={channel} onChange={e => handleChannelChange(e.target.value as SalesChannel)}
                                        className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                        {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Payment Term</label>
                                    <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)}
                                        className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                        {['COD', 'NET15', 'NET30', 'NET45', 'NET60', 'EOM_10', 'EOM_15'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1 block" style={{ color: '#4A6A7A' }}>Pháp Nhân</label>
                                    <select value={legalEntityId} onChange={e => setLegalEntityId(e.target.value)}
                                        className="w-full px-3 py-2 text-sm" style={inputStyle}>
                                        <option value="">— Chọn —</option>
                                        {entities.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Credit Warning */}
                            {creditWarning && (
                                <div className="flex items-center gap-2 p-3 rounded" style={{ background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)' }}>
                                    <AlertCircle size={14} style={{ color: '#E05252' }} />
                                    <span className="text-xs" style={{ color: '#E05252' }}>
                                        {isCreditHold 
                                            ? 'Khách hàng đang bị GIỮ TÍN DỤNG (Credit Hold)!' 
                                            : `Vượt hạn mức tín dụng! Khả dụng: ${formatVND(creditAvailable)}`}
                                    </span>
                                </div>
                            )}

                            {/* Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2 relative">
                                    <label className="text-xs font-semibold" style={{ color: '#4A6A7A' }}>Sản Phẩm</label>
                                    <div className="w-64 relative">
                                        <input
                                            type="text"
                                            placeholder="Gõ mã/tên để thêm sản phẩm..."
                                            value={addProductSearchQuery}
                                            onFocus={() => setIsAddDropdownOpen(true)}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setIsAddDropdownOpen(false)
                                                    setAddProductSearchQuery('')
                                                }, 200)
                                            }}
                                            onChange={e => {
                                                setAddProductSearchQuery(e.target.value)
                                                setIsAddDropdownOpen(true)
                                            }}
                                            className="w-full px-2.5 py-1 text-xs outline-none"
                                            style={inputStyle}
                                        />
                                        
                                        {isAddDropdownOpen && (
                                            <div className="absolute right-0 left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded shadow-xl border text-left bg-white dark:bg-[#142433] border-slate-200 dark:border-[#2A4355]">
                                                {getFilteredAddProducts(addProductSearchQuery).length === 0 ? (
                                                    <div className="px-2.5 py-2 text-xs text-slate-500 dark:text-gray-500">
                                                        Không tìm thấy hoặc đã thêm
                                                    </div>
                                                ) : (
                                                    getFilteredAddProducts(addProductSearchQuery).map(p => (
                                                        <div
                                                            key={p.id}
                                                            onMouseDown={() => {
                                                                addLine(p.id)
                                                                setAddProductSearchQuery('')
                                                                setIsAddDropdownOpen(false)
                                                            }}
                                                            className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1B2E3D] transition-colors flex items-center gap-1.5 border-b border-slate-100 dark:border-[#2A4355]/30 last:border-b-0"
                                                        >
                                                            <span className="font-bold text-teal-600 dark:text-[#87CBB9] shrink-0">[{p.skuCode}]</span>
                                                            <span className="font-medium text-slate-800 dark:text-[#E8F1F2] truncate">{p.productName}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {lines.length === 0 ? (
                                    <div className="text-center py-6 rounded" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                        <Plus size={20} className="mx-auto mb-1" style={{ color: '#2A4355' }} />
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Tìm kiếm sản phẩm ở trên để thêm</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden sm:block overflow-x-auto border border-[#2A4355] rounded-md bg-[#142433] max-w-full" style={{ minHeight: '280px' }}>
                                            <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '600px' }}>
                                                <thead>
                                                    <tr className="bg-[#1B2E3D] text-[#4A6A7A] border-b border-[#2A4355] font-semibold">
                                                        <th className="px-3 py-2.5">Sản Phẩm</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">Tồn Kho</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">SL</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">Đơn Giá</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">CK %</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">Thành Tiền</th>
                                                        <th className="px-3 py-2.5 w-10 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#2A4355]/40">
                                                    {lines.map((l, idx) => {
                                                        const lineTotal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)
                                                        const lowStock = l.stock < l.qtyOrdered
                                                        const priceSource = priceMap[l.productId]?.source ?? l.priceSource
                                                        const hasPriceBadge = priceSource && priceSource !== 'DEFAULT_ZERO'
                                                        return (
                                                            <tr key={idx} className={`hover:bg-[#1B2E3D]/30 transition-colors ${lowStock ? 'bg-red-950/10' : ''}`}>
                                                                <td className="px-3 py-2">
                                                                    <p className="font-semibold text-white">{l.skuCode}</p>
                                                                    <p className="text-[11px] text-gray-300 whitespace-normal leading-relaxed max-w-[320px] mt-0.5">{l.productName}</p>
                                                                    {hasPriceBadge && (
                                                                        <div className="mt-1">
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                                style={getPriceBadgeStyle(priceSource)}>
                                                                                <Tag size={9} /> {getPriceBadgeLabel({ source: priceSource }, channel)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`font-semibold ${lowStock ? 'text-red-500' : 'text-[#8AAEBB]'}`}>{l.stock}</span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <input type="number" min={1} value={l.qtyOrdered}
                                                                        onChange={e => updateLine(idx, 'qtyOrdered', Math.max(1, +e.target.value))}
                                                                        className="w-14 px-2 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                        style={inputStyle}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-[#8AAEBB]">
                                                                    {formatVND(l.unitPrice)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <input type="number" min={0} max={100} value={l.lineDiscountPct}
                                                                        onChange={e => updateLine(idx, 'lineDiscountPct', Math.min(100, Math.max(0, +e.target.value)))}
                                                                        className="w-12 px-1 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                        style={inputStyle}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-[#87CBB9]">
                                                                    {formatVND(lineTotal)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-400 p-1.5 rounded transition-all">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile Card View */}
                                        <div className="block sm:hidden space-y-2">
                                            {lines.map((l, idx) => {
                                                const lineTotal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)
                                                const lowStock = l.stock < l.qtyOrdered
                                                const priceSource = priceMap[l.productId]?.source ?? l.priceSource
                                                const hasPriceBadge = priceSource && priceSource !== 'DEFAULT_ZERO'
                                                return (
                                                    <div key={idx} className="p-3 rounded-md space-y-2"
                                                        style={{ background: '#142433', border: `1px solid ${lowStock ? 'rgba(139,26,46,0.35)' : '#2A4355'}` }}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-[#E8F1F2] truncate">{l.skuCode}</p>
                                                                <p className="text-xs text-gray-300 whitespace-normal leading-relaxed">{l.productName}</p>
                                                            </div>
                                                            <button onClick={() => removeLine(idx)} style={{ color: '#8B1A2E', padding: '4px' }} type="button">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                        {hasPriceBadge && (
                                                            <div className="flex flex-wrap gap-1">
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                                    style={getPriceBadgeStyle(priceSource)}>
                                                                    <Tag size={9} /> {getPriceBadgeLabel({ source: priceSource }, channel)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>SL (Tồn: {l.stock})</p>
                                                                <input type="number" min={1} value={l.qtyOrdered}
                                                                    onChange={e => updateLine(idx, 'qtyOrdered', Math.max(1, +e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                    style={{ ...inputStyle, borderColor: lowStock ? '#8B1A2E' : '#2A4355' }}
                                                                />
                                                                {lowStock && <p className="text-[10px] text-red-500 mt-0.5">Vượt tồn!</p>}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Đơn Giá</p>
                                                                <input type="number" min={0} value={l.unitPrice}
                                                                    readOnly
                                                                    className="w-full px-2 py-1 text-xs text-right opacity-70 cursor-not-allowed bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                    style={{ ...inputStyle, background: 'rgba(20,36,51,0.5)' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>CK (%)</p>
                                                                <input type="number" min={0} max={100} value={l.lineDiscountPct}
                                                                    onChange={e => updateLine(idx, 'lineDiscountPct', Math.min(100, Math.max(0, +e.target.value)))}
                                                                    className="w-full px-2 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                    style={inputStyle}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>VAT (%)</p>
                                                                <select value={l.vatRate ?? 10}
                                                                    onChange={e => updateLine(idx, 'vatRate', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
                                                                    style={inputStyle}>
                                                                    <option value={10}>10%</option>
                                                                    <option value={8}>8%</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end pt-1">
                                                            <p className="text-xs font-bold text-[#87CBB9]">
                                                                = {formatVND(lineTotal)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </>
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
                                <div className="text-right space-y-1">
                                    <div className="flex justify-end gap-4 text-xs text-[#4A6A7A]">
                                        <span>Trước thuế: {formatVND(subtotal * (1 - orderDiscount / 100))}</span>
                                        <span>VAT: {formatVND(vatAmount)}</span>
                                    </div>
                                    <div className="flex justify-end items-center gap-2">
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Tổng thanh toán (Gồm VAT)</p>
                                        <p className="text-lg font-bold" style={{ color: '#D4A853' }}>
                                            {formatVND(finalTotal)}
                                        </p>
                                    </div>
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
