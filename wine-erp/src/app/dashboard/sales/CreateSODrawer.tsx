'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, CheckCircle2, Tag, ShieldAlert, Printer, Eye } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    createSalesOrder, SOCreateInput, SalesChannel,
    getProductPricesForChannel, getActiveAllocationsForProducts,
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
    taxId?: string | null
    creditLimit: number
    creditHold: boolean
    paymentTerm: string
    channel: string | null
    defaultLegalEntityId: string | null
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
interface ProductItem { id: string; skuCode: string; productName: string; wineType: string; country: string; totalStock: number; vatRate?: number; wholesalePrice?: number; retailPrice?: number }
interface SOLine { productId: string; productName: string; skuCode: string; qtyOrdered: number; unitPrice: number; lineDiscountPct: number; stock: number; priceSource?: string | null; vatRate?: number }

const inputStyle = {
    background: '#142433',
    border: '1px solid #2A4355',
    color: '#E8F1F2',
    borderRadius: '4px',
    outline: 'none',
}

const OVERRIDE_ROLES = ['CEO', 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'Kế Toán', 'KE_TOAN']

export function CreateSODrawer({ open, onClose, onSaved, userId, userRoles = [] }: { open: boolean; onClose: () => void; onSaved: () => void; userId: string; userRoles?: string[] }) {
    // TanStack Query to fetch and cache reference data for Sales Order Creation
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
        staleTime: 5 * 60_000, // Cache reference data for 5 minutes
    })

    const customers = refData?.customers ?? []
    const products = refData?.products ?? []
    const entities = refData?.entities ?? []
    const loadingData = !refData && open

    const [overrideMode, setOverrideMode] = useState(false)
    const canOverride = OVERRIDE_ROLES.some(r => userRoles.includes(r))

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

    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [lines, setLines] = useState<SOLine[]>([])
    const [notes, setNotes] = useState('')

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
    const [arBalance, setArBalance] = useState(0)
    const [loadingAR, setLoadingAR] = useState(false)

    const [priceMap, setPriceMap] = useState<Record<string, ResolvedPrice>>({})
    const [allocations, setAllocations] = useState<{ productId: string; campaignName: string; remaining: number }[]>([])
    const [loadingPrices, setLoadingPrices] = useState(false)

    const [saving, setSaving] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [legalEntityId, setLegalEntityId] = useState('')
    const [shippingAddressId, setShippingAddressId] = useState('')

    const [customerSearchInput, setCustomerSearchInput] = useState('')
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

    const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})
    const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null)

    const getFilteredProducts = useCallback((query: string) => {
        let q = query.trim().toLowerCase()
        if (!q) return products.slice(0, 15)
        
        // If q starts with [, strip the bracketed SKU prefix if present e.g. "[L10014] REGOLO..."
        if (q.startsWith('[')) {
            const closeIdx = q.indexOf(']')
            if (closeIdx !== -1) {
                const afterClose = q.substring(closeIdx + 1).trim()
                if (afterClose) {
                    q = afterClose
                } else {
                    return products.slice(0, 15)
                }
            }
        }
        
        // High-performance filter with early exit to resolve typing lag
        const results = []
        for (const p of products) {
            if (p.productName.toLowerCase().includes(q) || p.skuCode.toLowerCase().includes(q)) {
                results.push(p)
                if (results.length >= 15) break
            }
        }
        return results
    }, [products])

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

    useEffect(() => {
        if (entities.length > 0 && !legalEntityId) {
            const defaultEntity = entities.find(e => e.code === 'TA') || entities[0]
            if (defaultEntity) {
                setLegalEntityId(defaultEntity.id)
            }
        }
    }, [entities, legalEntityId])

    useEffect(() => {
        const queries: Record<number, string> = {}
        lines.forEach((l, idx) => {
            if (l.productId) {
                queries[idx] = `[${l.skuCode}] ${l.productName}`
            } else {
                queries[idx] = ''
            }
        })
        setSearchQueries(queries)
    }, [lines.length]) // eslint-disable-line


    // Load customer-resolved prices or fallback channel prices
    const loadPrices = useCallback(async (custId: string | null, ch: SalesChannel) => {
        setLoadingPrices(true)
        try {
            if (custId) {
                const resolvedPrices = await getCustomerResolvedPrices(custId)
                setPriceMap(resolvedPrices)
                // Auto-update existing lines to resolved prices and source
                setLines(prev => prev.map(l => {
                    const resolved = resolvedPrices[l.productId]
                    if (resolved) {
                        return { ...l, unitPrice: resolved.price, priceSource: resolved.source }
                    }
                    return l
                }))
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
                // Auto-update existing lines to resolved prices and source
                setLines(prev => prev.map(l => {
                    const resolved = converted[l.productId]
                    if (resolved) {
                        return { ...l, unitPrice: resolved.price, priceSource: resolved.source }
                    }
                    return l
                }))
            }
        } catch (err) {
            console.error("Lỗi load bảng giá:", err)
        }
        setLoadingPrices(false)
    }, [])

    useEffect(() => {
        if (open) {
            loadPrices(null, 'HORECA')
        }
    }, [open, loadPrices])

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
            const defaultAddress = c.addresses?.find(a => a.isDefault) || c.addresses?.[0]
            setShippingAddressId(defaultAddress?.id ?? '')
            setPaymentTerm(c.paymentTerm)
            const nextChannel = (c.channel ?? 'HORECA') as SalesChannel
            setChannel(nextChannel)
            const fallbackLE = entities.find(e => e.code === 'TA')?.id || entities[0]?.id || ''
            setLegalEntityId(c.defaultLegalEntityId || fallbackLE)
            setLoadingAR(true)
            
            // Parallelize balance and customer prices fetch to eliminate waterfalls
            const [bal, resolvedPrices] = await Promise.all([
                getCustomerARBalance(id),
                getCustomerResolvedPrices(id)
            ])
            
            setArBalance(bal)
            setLoadingAR(false)
            setPriceMap(resolvedPrices)
            
            // Auto-update existing lines to resolved prices and source
            setLines(prev => prev.map(l => {
                const resolved = resolvedPrices[l.productId]
                if (resolved) {
                    return { ...l, unitPrice: resolved.price, priceSource: resolved.source }
                }
                return l
            }))
        } else {
            loadPrices(null, channel)
        }
    }

    const handleChannelChange = async (newChannel: SalesChannel) => {
        setChannel(newChannel)
        loadPrices(customerId || null, newChannel)
    }

    const addLine = () => {
        setLines(prev => [...prev, { productId: '', productName: '', skuCode: '', qtyOrdered: 1, unitPrice: 0, lineDiscountPct: 0, stock: 0, priceSource: null, vatRate: 10 }])
    }

    const updateLine = (i: number, field: keyof SOLine, value: any) => {
        setLines(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            if (field === 'productId') {
                const p = products.find(p => p.id === value)!
                const mapEntry = priceMap[value]
                const resolvedPrice = (mapEntry && mapEntry.price > 0) ? mapEntry.price : 0
                const wp = p?.wholesalePrice ?? 0
                const rp = p?.retailPrice ?? 0
                const fallbackPrice = wp > 0 ? wp : (rp > 0 ? rp : 0)
                const autoPrice: number = resolvedPrice > 0 ? resolvedPrice : fallbackPrice
                const source = (mapEntry && mapEntry.price > 0)
                    ? mapEntry.source
                    : (wp > 0 ? 'RETAIL_FALLBACK' : (rp > 0 ? 'RETAIL_FALLBACK' : null))
                
                // Update search query display
                setSearchQueries(prevQueries => ({
                    ...prevQueries,
                    [i]: `[${p.skuCode}] ${p.productName}`
                }))

                return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice: autoPrice, priceSource: source, vatRate: p.vatRate ? Number(p.vatRate) : 10 }
            }
            return { ...l, [field]: value }
        }))
    }

    const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

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
        if (lines.some(l => !l.productId)) return toast.error('Vui lòng chọn sản phẩm cho tất cả các dòng')

        setSaving(true)
        const promise = createSalesOrder({
            customerId,
            salesRepId: userId || 'SYSTEM',
            channel,
            paymentTerm,
            orderDiscount,
            notes,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                vatRate: l.vatRate ?? 10,
                priceSource: l.priceSource || undefined
            })),
            legalEntityId,
            shippingAddressId: shippingAddressId || undefined,
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
        setArBalance(0); setPriceMap({}); setLegalEntityId(''); setSearchQueries({})
        setNotes(''); setOverrideMode(false)
        setShippingAddressId('')
        setCustomerSearchInput('')
        setCustomerDropdownOpen(false)
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(10,25,38,0.8)' }}>
            {/* Backdrop */}
            <div className="hidden md:block md:flex-1" onClick={onClose} />

            {/* Drawer */}
            <div className="w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl h-full flex flex-col overflow-hidden"
                style={{ background: '#1B2E3D', borderLeft: '1px solid #2A4355' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid #2A4355' }}>
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
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
                            {/* Row 1: Customer & Address */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Customer Autocomplete Search */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#4A6A7A' }}>
                                        Khách Hàng *
                                    </label>
                                    <div className="relative">
                                        <div className={`relative flex items-center w-full rounded border-2 transition-all ${customerDropdownOpen ? 'border-[#87CBB9] ring-2 ring-[#87CBB9]/20' : 'border-[#2A4355]'} bg-[#142433]`}>
                                            <span className="pl-3 text-slate-400 text-sm">🔍</span>
                                            <input
                                                type="text"
                                                placeholder="Bấm vào đây hoặc gõ mã, tên khách hàng..."
                                                value={customerSearchInput}
                                                onFocus={e => {
                                                    setCustomerDropdownOpen(true)
                                                    e.target.select()
                                                }}
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
                                                className="w-full pl-2 pr-8 py-2 text-sm font-semibold text-white bg-transparent outline-none placeholder:text-[#6A8A9A]"
                                            />
                                            {selectedCustomer ? (
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        handleCustomerChange('')
                                                        setCustomerSearchInput('')
                                                        setCustomerDropdownOpen(true)
                                                    }}
                                                    className="absolute right-2 px-1.5 py-0.5 text-xs text-slate-400 hover:text-white bg-[#1F3547] hover:bg-red-500/80 rounded transition-colors"
                                                    title="Bỏ chọn khách hàng"
                                                >
                                                    ✕
                                                </button>
                                            ) : (
                                                <span className="absolute right-2.5 text-slate-400 pointer-events-none text-xs">▼</span>
                                            )}
                                        </div>
                                        {customerDropdownOpen && (
                                            <div className="absolute left-0 mt-1 max-h-72 overflow-y-auto z-[100] rounded-lg bg-[#0F1C28] border-2 border-[#2A4355] w-full shadow-2xl divide-y divide-[#1F3547]">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="px-4 py-4 text-xs font-medium text-amber-400/90 text-center bg-[#142433]">
                                                        🔍 Không tìm thấy khách hàng khớp với từ khóa "{customerSearchInput}"
                                                    </div>
                                                ) : (
                                                    filteredCustomers.map(c => {
                                                        const isCompany = c.entityType === 'COMPANY'
                                                        const isDisabled = isCompany && !c.allowDirectSO
                                                        const isSelected = selectedCustomer?.id === c.id
                                                        return (
                                                            <div
                                                                key={c.id}
                                                                onMouseDown={() => {
                                                                    if (isDisabled) return
                                                                    handleCustomerChange(c.id)
                                                                    setCustomerDropdownOpen(false)
                                                                }}
                                                                className={`px-3.5 py-3 text-xs text-left transition-all ${
                                                                    isDisabled 
                                                                        ? 'bg-[#0A141E] text-slate-500 opacity-60 cursor-not-allowed' 
                                                                        : isSelected
                                                                        ? 'bg-[#1F3E4D] text-white border-l-4 border-l-[#87CBB9]'
                                                                        : 'cursor-pointer hover:bg-[#1B2E3D] hover:border-l-4 hover:border-l-[#87CBB9] text-white'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className={`font-bold text-sm ${isDisabled ? 'text-slate-500' : 'text-[#87CBB9]'}`}>
                                                                            [{c.code}]
                                                                        </span>
                                                                        <span className="font-semibold text-sm text-white">{c.name}</span>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#87CBB9]/20 text-[#87CBB9] font-bold">✓ Đã chọn</span>
                                                                    )}
                                                                </div>
                                                                <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                                                                    {isCompany && (
                                                                        <span className={`font-semibold ${isDisabled ? 'text-slate-500' : 'text-sky-400'}`}>
                                                                            {c.allowDirectSO ? '🏢 Công ty (Được bán)' : '🏢 Công ty Mẹ (Chỉ gánh nợ)'}
                                                                        </span>
                                                                    )}
                                                                    {c.brandGroup && (
                                                                        <span className="px-2 py-0.5 bg-[#2A4355] text-slate-200 rounded font-semibold">
                                                                            ✨ {c.brandGroup}
                                                                        </span>
                                                                    )}
                                                                    {c.channel && (
                                                                        <span className="px-2 py-0.5 bg-[#1C3344] text-[#8AAEBB] rounded">
                                                                            Kênh: {c.channel}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Shipping Address Selection */}
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#4A6A7A' }}>
                                        Địa Chỉ Giao Hàng *
                                    </label>
                                    {!selectedCustomer ? (
                                        <div className="w-full px-3 py-1.5 text-xs rounded border border-[#2A4355] text-gray-500 bg-[#0A1926]/40">
                                            Chưa chọn khách hàng
                                        </div>
                                    ) : (!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) ? (
                                        <div className="px-3 py-1 text-xs bg-red-950/20 border border-red-500/20 text-red-400 rounded">
                                            ⚠️ Chưa có địa chỉ giao hàng
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <select
                                                value={shippingAddressId}
                                                onChange={e => setShippingAddressId(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs outline-none rounded"
                                                style={{ ...inputStyle }}
                                            >
                                                <option value="">-- Chọn địa chỉ --</option>
                                                {selectedCustomer.addresses.map(addr => (
                                                    <option key={addr.id} value={addr.id}>
                                                        {addr.label} ({addr.address})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Compact Credit Status Bar */}
                            {selectedCustomer && (
                                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-md text-[11px]"
                                    style={{ background: creditWarning ? 'rgba(139,26,46,0.1)' : 'rgba(15,28,40,0.8)', border: `1px solid ${creditWarning ? 'rgba(139,26,46,0.3)' : '#2A4355'}` }}>
                                    <span className="font-bold text-[11px]" style={{ color: creditWarning ? '#EF4444' : '#5BA88A' }}>
                                        {isCreditHold ? '⚠️ Giữ tín dụng' : creditWarning ? '⚠️ Vượt hạn mức' : '✅ Tín dụng OK'}
                                    </span>
                                    <div className="flex items-center gap-3 text-[11px]">
                                        <span style={{ color: '#4A6A7A' }}>Hạn mức: <strong className="font-mono text-slate-200">{formatVND(effectiveCreditLimit)}</strong></span>
                                        <span style={{ color: '#4A6A7A' }}>Dư nợ: <strong className="font-mono text-amber-300">{loadingAR ? '...' : formatVND(arBalance)}</strong></span>
                                        <span style={{ color: '#4A6A7A' }}>Khả dụng: <strong className="font-mono" style={{ color: creditWarning ? '#EF4444' : '#87CBB9' }}>{formatVND(Math.max(0, creditAvailable))}</strong></span>
                                    </div>
                                </div>
                            )}

                            {/* General Order Info */}
                            {selectedCustomer && (
                                <div className="p-2.5 rounded-lg flex flex-col justify-between" style={{ background: '#142433/60', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>Thông tin đơn hàng</p>
                                        {canOverride && (
                                            <button
                                                onClick={() => setOverrideMode(!overrideMode)}
                                                className="text-xs px-1.5 py-0.5 rounded transition-all"
                                                style={{ color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', background: 'rgba(212,168,83,0.08)' }}
                                            >
                                                {overrideMode ? 'Xong' : 'Thay đổi'}
                                            </button>
                                        )}
                                    </div>

                                    {!overrideMode ? (
                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                            <div>
                                                <p className="text-[10px] mb-0.5" style={{ color: '#4A6A7A' }}>Kênh Bán</p>
                                                <p className="font-semibold" style={{ color: '#E8F1F2' }}>
                                                    {CHANNELS.find(c => c.value === channel)?.label ?? channel}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] mb-0.5" style={{ color: '#4A6A7A' }}>Thanh Toán</p>
                                                <p className="font-semibold" style={{ color: '#E8F1F2' }}>{paymentTerm}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] mb-0.5" style={{ color: '#4A6A7A' }}>Pháp Nhân</p>
                                                <p className="font-semibold truncate" style={{ color: '#E8F1F2' }} title={entities.find(e => e.id === legalEntityId)?.name}>
                                                    {entities.find(e => e.id === legalEntityId)?.code ?? 'Mặc định'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <select value={channel} onChange={e => handleChannelChange(e.target.value as SalesChannel)}
                                                    className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                    {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)}
                                                    className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                    {['COD', 'NET7', 'NET14', 'NET30', 'NET45', 'NET60', 'PREPAID', 'EOM_10', 'EOM_15'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <select value={legalEntityId} onChange={e => setLegalEntityId(e.target.value)}
                                                    className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                    <option value="">— Pháp Nhân —</option>
                                                    {entities.map(e => (
                                                        <option key={e.id} value={e.id}>{e.code}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Diễn giải đơn hàng */}
                            <div>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Nhập diễn giải/ghi chú đơn hàng..."
                                    rows={1}
                                    className="w-full px-3 py-1.5 text-xs outline-none rounded"
                                    style={{ ...inputStyle }}
                                />
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
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden sm:block overflow-x-auto border border-[#2A4355] rounded-md bg-[#142433] max-w-full" style={{ minHeight: '280px' }}>
                                            <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '600px' }}>
                                                <thead>
                                                    <tr className="bg-[#1B2E3D] text-[#4A6A7A] border-b border-[#2A4355] font-semibold">
                                                        <th className="px-3 py-2.5" style={{ minWidth: '320px' }}>Sản Phẩm *</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">Tồn Kho</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">SL</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">Đơn Giá</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">CK %</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">Thành Tiền</th>
                                                        <th className="px-3 py-2.5 w-10 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#2A4355]/40">
                                                    {lines.map((line, i) => {
                                                        const lineTotal = line.qtyOrdered * line.unitPrice * (1 - line.lineDiscountPct / 100)
                                                        const lowStock = line.productId ? line.qtyOrdered > line.stock : false
                                                        const alloc = allocations.find(a => a.productId === line.productId)
                                                        const quotaExceeded = alloc && line.qtyOrdered > alloc.remaining
                                                        const resolved = priceMap[line.productId]
                                                        const hasAutoPrice = resolved !== undefined && resolved.source !== 'DEFAULT_ZERO'
                                                        return (
                                                            <tr key={i} className={`hover:bg-[#1B2E3D]/30 transition-colors ${lowStock || quotaExceeded ? 'bg-red-950/10' : ''}`}>
                                                                <td className="px-3 py-2 relative">
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Gõ SKU hoặc tên sản phẩm..."
                                                                            value={searchQueries[i] ?? ''}
                                                                            onFocus={e => {
                                                                                setActiveDropdownIndex(i)
                                                                                e.target.select()
                                                                            }}
                                                                            onBlur={() => {
                                                                                setTimeout(() => {
                                                                                    setActiveDropdownIndex(null)
                                                                                    if (line.productId) {
                                                                                        setSearchQueries(prev => ({
                                                                                            ...prev,
                                                                                            [i]: `[${line.skuCode}] ${line.productName}`
                                                                                        }))
                                                                                    } else {
                                                                                        setSearchQueries(prev => ({ ...prev, [i]: '' }))
                                                                                    }
                                                                                }, 200)
                                                                            }}
                                                                            onChange={e => {
                                                                                const val = e.target.value
                                                                                setSearchQueries(prev => ({ ...prev, [i]: val }))
                                                                                setActiveDropdownIndex(i)
                                                                            }}
                                                                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                                                                            style={{ ...inputStyle }}
                                                                        />
                                                                        
                                                                        {activeDropdownIndex === i && (
                                                                            <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded bg-white dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] w-[520px] shadow-xl">
                                                                                {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                                    <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-500">
                                                                                        Không tìm thấy sản phẩm
                                                                                    </div>
                                                                                ) : (
                                                                                    getFilteredProducts(searchQueries[i] ?? '').map(p => (
                                                                                        <div
                                                                                            key={p.id}
                                                                                            onMouseDown={() => {
                                                                                                updateLine(i, 'productId', p.id)
                                                                                                setActiveDropdownIndex(null)
                                                                                            }}
                                                                                            className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1B2E3D] transition-colors text-left flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#2A4355]/30 last:border-b-0"
                                                                                        >
                                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                <span className="font-bold text-teal-600 dark:text-[#87CBB9] shrink-0">[{p.skuCode}]</span>
                                                                                                <span className="font-medium text-slate-800 dark:text-[#E8F1F2] truncate">{p.productName}</span>
                                                                                            </div>
                                                                                            <span className="text-slate-500 dark:text-gray-400 text-[10px] whitespace-nowrap shrink-0">(Tồn: {p.totalStock})</span>
                                                                                        </div>
                                                                                    ))
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {alloc && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                                                <ShieldAlert size={10} />
                                                                                {alloc.campaignName}: {quotaExceeded ? `Vượt! Còn ${alloc.remaining}` : `Còn ${alloc.remaining}`}
                                                                            </span>
                                                                        )}
                                                                        {hasAutoPrice && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                                                                style={getPriceBadgeStyle(resolved.source)}>
                                                                                <Tag size={10} /> {getPriceBadgeLabel(resolved, channel)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`font-semibold ${lowStock ? 'text-red-500' : 'text-[#8AAEBB]'}`}>
                                                                        {line.productId ? line.stock : '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={line.qtyOrdered}
                                                                        onChange={e => updateLine(i, 'qtyOrdered', Number(e.target.value))}
                                                                        className="w-14 px-2 py-1 text-xs text-center rounded outline-none"
                                                                        style={{ ...inputStyle }}
                                                                    />
                                                                    {lowStock && <p className="text-[10px] text-red-500 mt-0.5">Vượt tồn!</p>}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-[#8AAEBB]">
                                                                    {formatVND(line.unitPrice)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        value={line.lineDiscountPct}
                                                                        onChange={e => updateLine(i, 'lineDiscountPct', Number(e.target.value))}
                                                                        className="w-12 px-1 py-1 text-xs text-center rounded outline-none"
                                                                        style={{ ...inputStyle }}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-[#87CBB9]">
                                                                    {formatVND(lineTotal)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-400 p-1.5 rounded transition-all" type="button">
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
                                            {lines.map((line, i) => {
                                                const lineTotal = line.qtyOrdered * line.unitPrice * (1 - line.lineDiscountPct / 100)
                                                const lowStock = line.productId ? line.qtyOrdered > line.stock : false
                                                const alloc = allocations.find(a => a.productId === line.productId)
                                                const quotaExceeded = alloc && line.qtyOrdered > alloc.remaining
                                                const resolved = priceMap[line.productId]
                                                const hasAutoPrice = resolved !== undefined && resolved.source !== 'DEFAULT_ZERO'
                                                return (
                                                    <div key={i} className="p-3 rounded-md space-y-2"
                                                        style={{ background: '#142433', border: `1px solid ${lowStock || quotaExceeded ? 'rgba(139,26,46,0.35)' : '#2A4355'}` }}>
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-1 relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Gõ mã SKU hoặc tên sản phẩm..."
                                                                    value={searchQueries[i] ?? ''}
                                                                    onFocus={e => {
                                                                        setActiveDropdownIndex(i)
                                                                        e.target.select()
                                                                    }}
                                                                    onBlur={() => {
                                                                        setTimeout(() => {
                                                                            setActiveDropdownIndex(null)
                                                                            if (line.productId) {
                                                                                setSearchQueries(prev => ({
                                                                                    ...prev,
                                                                                    [i]: `[${line.skuCode}] ${line.productName}`
                                                                                }))
                                                                            } else {
                                                                                setSearchQueries(prev => ({ ...prev, [i]: '' }))
                                                                            }
                                                                        }, 200)
                                                                    }}
                                                                    onChange={e => {
                                                                        const val = e.target.value
                                                                        setSearchQueries(prev => ({ ...prev, [i]: val }))
                                                                        setActiveDropdownIndex(i)
                                                                    }}
                                                                    className="w-full px-3 py-2 text-xs outline-none"
                                                                    style={{ ...inputStyle, minWidth: 0 }}
                                                                />
                                                                
                                                                {activeDropdownIndex === i && (
                                                                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-md shadow-xl border bg-white dark:bg-[#142433] border-slate-200 dark:border-[#2A4355]">
                                                                        {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                            <div className="px-3 py-2 text-xs text-slate-500 dark:text-gray-500">
                                                                                Không tìm thấy sản phẩm
                                                                            </div>
                                                                        ) : (
                                                                            getFilteredProducts(searchQueries[i] ?? '').map(p => (
                                                                                <div
                                                                                    key={p.id}
                                                                                    onMouseDown={() => {
                                                                                        updateLine(i, 'productId', p.id)
                                                                                        setActiveDropdownIndex(null)
                                                                                    }}
                                                                                    className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-[#1B2E3D] transition-colors text-left flex items-center justify-between gap-2 border-b border-slate-100 dark:border-[#2A4355]/30 last:border-b-0"
                                                                                >
                                                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                        <span className="font-bold text-teal-600 dark:text-[#87CBB9] shrink-0">[{p.skuCode}]</span>
                                                                                        <span className="font-medium text-slate-800 dark:text-[#E8F1F2] truncate">{p.productName}</span>
                                                                                    </div>
                                                                                    <span className="text-slate-500 dark:text-gray-400 text-[10px] whitespace-nowrap shrink-0">(Tồn: {p.totalStock})</span>
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button onClick={() => removeLine(i)} style={{ color: '#8B1A2E', padding: '8px' }} type="button">
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
                                                                    style={getPriceBadgeStyle(resolved.source)}>
                                                                    <Tag size={11} /> {getPriceBadgeLabel(resolved, channel)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Số Lượng</p>
                                                                <input type="number" min="1" value={line.qtyOrdered}
                                                                    onChange={e => updateLine(i, 'qtyOrdered', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs outline-none"
                                                                    style={{ ...inputStyle, border: `1px solid ${lowStock ? 'rgba(139,26,46,0.5)' : '#2A4355'}` }}
                                                                />
                                                                {lowStock && <p className="text-xs mt-1" style={{ color: '#8B1A2E' }}>⚠️ Vượt tồn ({line.stock})</p>}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Đơn Giá</p>
                                                                <input type="number" min="0" value={line.unitPrice}
                                                                    readOnly
                                                                    className="w-full px-2 py-1 text-xs outline-none opacity-70 cursor-not-allowed"
                                                                    style={{ ...inputStyle, background: 'rgba(20,36,51,0.5)' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>CK (%)</p>
                                                                <input type="number" min="0" max="100" value={line.lineDiscountPct}
                                                                    onChange={e => updateLine(i, 'lineDiscountPct', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs outline-none"
                                                                    style={{ ...inputStyle }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>VAT (%)</p>
                                                                <select value={line.vatRate ?? 10}
                                                                    onChange={e => updateLine(i, 'vatRate', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs outline-none"
                                                                    style={{ ...inputStyle }}>
                                                                    <option value={10}>10%</option>
                                                                    <option value={8}>8%</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <p className="text-xs font-bold" style={{ color: '#87CBB9' }}>
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
                                    <div className="flex justify-between items-center text-xs text-[#8AAEBB] mb-1.5">
                                        <p>Trước thuế (Sau CK)</p>
                                        <p className="font-mono">{formatVND(subtotal * (1 - orderDiscount / 100))}</p>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-[#8AAEBB] mb-2.5">
                                        <p>Thuế VAT</p>
                                        <p className="font-mono">{formatVND(vatAmount)}</p>
                                    </div>
                                    <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        <p className="text-sm font-semibold" style={{ color: '#8AAEBB' }}>Tổng Thanh Toán (Gồm VAT)</p>
                                        <p className="text-xl font-bold" style={{ color: '#87CBB9' }}>
                                            {formatVND(finalTotal)}
                                        </p>
                                    </div>
                                </div>
                            )}


                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4" style={{ borderTop: '1px solid #2A4355' }}>
                    <button
                        onClick={() => {
                            if (!selectedCustomer) {
                                toast.error('Vui lòng chọn khách hàng để xem file in')
                                return
                            }
                            if (lines.length === 0 || lines.every(l => !l.productId)) {
                                toast.error('Vui lòng chọn ít nhất 1 sản phẩm để xem file in')
                                return
                            }
                            setPreviewOpen(true)
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded transition-colors bg-[#1F3547] hover:bg-[#2A4355] text-amber-300 border border-amber-500/30 shadow"
                        title="Xem trước phiếu đơn hàng trước khi tạo đơn"
                    >
                        <Printer size={15} /> 🖨️ Xem File In
                    </button>

                    <div className="flex items-center gap-3">
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

            {/* PRINT PREVIEW MODAL */}
            {previewOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-[#0D1821] border border-[#2A4355] rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F3547] bg-[#142433]">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <Printer size={18} />
                                <span>XEM TRƯỚC PHIẾU ĐƠN BÁN HÀNG (PRINT PREVIEW)</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors shadow"
                                >
                                    <Printer size={14} /> In / Xuất PDF
                                </button>
                                <button
                                    onClick={() => setPreviewOpen(false)}
                                    className="p-1 text-slate-400 hover:text-white rounded bg-[#1F3547]"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Invoice Content Area */}
                        <div className="p-8 overflow-y-auto bg-white text-slate-900 text-xs font-sans space-y-6">
                            {/* Company & Order Header */}
                            <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                                <div>
                                    <h1 className="text-xl font-bold text-slate-900 tracking-wide uppercase">LY'S CELLAR — WINE & SPIRITS</h1>
                                    <p className="text-slate-600 font-medium mt-0.5">Pháp nhân xuất bán: <strong className="text-slate-900">{entities.find(e => e.id === legalEntityId)?.name || 'CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN'}</strong></p>
                                    <p className="text-slate-500">Mã số thuế: {entities.find(e => e.id === legalEntityId)?.taxId || '0100112162'}</p>
                                    <p className="text-slate-500">Kênh bán: <span className="font-semibold text-slate-800">{channel}</span></p>
                                </div>
                                <div className="text-right">
                                    <div className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 rounded text-amber-900 font-bold text-xs uppercase">
                                        Đơn Bán Hàng Dự Thảo
                                    </div>
                                    <p className="text-slate-500 mt-2">Ngày lập: {new Date().toLocaleDateString('vi-VN')}</p>
                                    <p className="text-slate-500">Hạn thanh toán: <strong className="text-slate-800">{paymentTerm}</strong></p>
                                </div>
                            </div>

                            {/* Customer Info Box */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-400 uppercase font-bold text-[10px]">THÔNG TIN KHÁCH HÀNG</p>
                                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                                        [{selectedCustomer?.code}] {selectedCustomer?.name}
                                    </p>
                                    <p className="text-slate-600 mt-1">Mã số thuế: {selectedCustomer?.taxId || '—'}</p>
                                    <p className="text-slate-600">Phân loại: {selectedCustomer?.entityType || 'Khách hàng HORECA'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 uppercase font-bold text-[10px]">ĐỊA CHỈ GIAO HÀNG</p>
                                    <p className="text-slate-800 font-medium mt-0.5">
                                        {selectedCustomer?.addresses?.find(a => a.id === shippingAddressId)?.address ||
                                         selectedCustomer?.addresses?.[0]?.address ||
                                         'Giao theo địa chỉ mặc định trên hợp đồng'}
                                    </p>
                                    <p className="text-slate-500 mt-1">Ghi chú đơn: {notes || 'Không có ghi chú thêm'}</p>
                                </div>
                            </div>

                            {/* Line Items Table */}
                            <table className="w-full border-collapse border border-slate-300 text-xs">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                                        <th className="p-2 border border-slate-300 text-center w-10">STT</th>
                                        <th className="p-2 border border-slate-300 text-left">Mã SP (SKU)</th>
                                        <th className="p-2 border border-slate-300 text-left">Tên Rượu / Sản Phẩm</th>
                                        <th className="p-2 border border-slate-300 text-center w-16">SL</th>
                                        <th className="p-2 border border-slate-300 text-right w-24">Đơn Giá</th>
                                        <th className="p-2 border border-slate-300 text-center w-16">CK (%)</th>
                                        <th className="p-2 border border-slate-300 text-center w-16">VAT (%)</th>
                                        <th className="p-2 border border-slate-300 text-right w-28">Thành Tiền (VNĐ)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lines.filter(l => l.productId).map((l, idx) => {
                                        const p = products.find(prod => prod.id === l.productId)
                                        const lineVal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)
                                        return (
                                            <tr key={idx} className="border-b border-slate-200">
                                                <td className="p-2 border border-slate-200 text-center font-mono">{idx + 1}</td>
                                                <td className="p-2 border border-slate-200 font-mono font-semibold text-slate-700">{p?.skuCode}</td>
                                                <td className="p-2 border border-slate-200 font-medium text-slate-900">
                                                    {p?.productName}
                                                    {l.priceSource === 'SPECIAL_PRICE' && (
                                                        <span className="ml-2 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">
                                                            ★ Giá Đặc Biệt
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 border border-slate-200 text-center font-bold">{l.qtyOrdered}</td>
                                                <td className="p-2 border border-slate-200 text-right font-mono">{formatVND(l.unitPrice)}</td>
                                                <td className="p-2 border border-slate-200 text-center font-mono">{l.lineDiscountPct ? `${l.lineDiscountPct}%` : '—'}</td>
                                                <td className="p-2 border border-slate-200 text-center font-mono">{l.vatRate ?? 10}%</td>
                                                <td className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-900">
                                                    {formatVND(lineVal)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>

                            {/* Financial Totals */}
                            <div className="flex justify-end pt-2">
                                <div className="w-80 space-y-2 text-xs">
                                    <div className="flex justify-between text-slate-600">
                                        <span>Cộng tiền hàng (trước thuế):</span>
                                        <span className="font-mono font-semibold">{formatVND(subtotal)}</span>
                                    </div>
                                    {orderDiscount > 0 && (
                                        <div className="flex justify-between text-amber-700 font-medium">
                                            <span>Chiết khấu tổng đơn ({orderDiscount}%):</span>
                                            <span className="font-mono">-{formatVND(subtotal * (orderDiscount / 100))}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-slate-600">
                                        <span>Tiền thuế VAT:</span>
                                        <span className="font-mono font-semibold">{formatVND(vatAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-400 pt-2">
                                        <span>TỔNG THÀNH TIỀN:</span>
                                        <span className="font-mono text-emerald-700 text-base">{formatVND(finalTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Signature Footer */}
                            <div className="grid grid-cols-3 gap-4 text-center pt-8 text-slate-700 border-t border-slate-200 mt-8">
                                <div>
                                    <p className="font-bold uppercase text-[11px]">Người Lập Đơn</p>
                                    <p className="text-[10px] text-slate-500">(Ký & ghi rõ họ tên)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-900">Nhân viên Sales</p>
                                </div>
                                <div>
                                    <p className="font-bold uppercase text-[11px]">Đại Diện Khách Hàng</p>
                                    <p className="text-[10px] text-slate-500">(Xác nhận đơn hàng)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-900">{selectedCustomer?.name}</p>
                                </div>
                                <div>
                                    <p className="font-bold uppercase text-[11px]">Kế Toán / Duyệt Đơn</p>
                                    <p className="text-[10px] text-slate-500">(Ký & duyệt xuất hàng)</p>
                                    <div className="h-16"></div>
                                    <p className="font-semibold text-slate-900">Ban Lãnh Đạo ERP</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
