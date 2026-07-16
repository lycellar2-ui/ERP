'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, CheckCircle2, Tag, ShieldAlert } from 'lucide-react'
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
interface ProductItem { id: string; skuCode: string; productName: string; wineType: string; country: string; totalStock: number }
interface SOLine { productId: string; productName: string; skuCode: string; qtyOrdered: number; unitPrice: number; lineDiscountPct: number; stock: number; priceSource?: string | null }

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
    const [legalEntityId, setLegalEntityId] = useState('')
    const [shippingAddressId, setShippingAddressId] = useState('')

    const [customerSearchInput, setCustomerSearchInput] = useState('')
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

    const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})
    const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null)

    const getFilteredProducts = useCallback((query: string) => {
        const q = query.trim().toLowerCase()
        if (!q) return products.slice(0, 15)
        
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
        if (!q || q.startsWith('[')) return sortedCustomersForSelect.slice(0, 50)
        return sortedCustomersForSelect.filter(c => 
            c.name.toLowerCase().includes(q) || 
            c.code.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [customerSearchInput, sortedCustomersForSelect])

    useEffect(() => {
        if (selectedCustomer) {
            setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name}`)
        } else {
            setCustomerSearchInput('')
        }
    }, [selectedCustomer])

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
            setLegalEntityId(c.defaultLegalEntityId ?? '')
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
        setLines(prev => [...prev, { productId: '', productName: '', skuCode: '', qtyOrdered: 1, unitPrice: 0, lineDiscountPct: 0, stock: 0, priceSource: null }])
    }

    const updateLine = (i: number, field: keyof SOLine, value: any) => {
        setLines(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            if (field === 'productId') {
                const p = products.find(p => p.id === value)!
                const autoPrice = priceMap[value]?.price ?? 0
                const source = priceMap[value]?.source ?? null
                
                // Update search query display
                setSearchQueries(prevQueries => ({
                    ...prevQueries,
                    [i]: `[${p.skuCode}] ${p.productName}`
                }))

                return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice: autoPrice, priceSource: source }
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
                priceSource: l.priceSource || undefined,
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
                                            className="w-full px-3 py-1.5 text-xs outline-none rounded"
                                            style={{ ...inputStyle }}
                                        />
                                        {customerDropdownOpen && (
                                            <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded bg-[#142433] border border-[#2A4355] w-full shadow-2xl">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="px-3 py-2.5 text-xs text-gray-500">
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
                                                                className={`px-3 py-2.5 text-xs text-left border-b border-[#2A4355]/30 last:border-b-0 transition-colors ${
                                                                    isDisabled ? 'opacity-50 cursor-not-allowed bg-[#0F1C28]/80 text-gray-500' : 'cursor-pointer hover:bg-[#1B2E3D] text-white'
                                                                }`}
                                                            >
                                                                <span className="font-bold text-[#87CBB9] mr-2">[{c.code}]</span>
                                                                <span>{c.name}</span>
                                                                {isCompany && (
                                                                    <span className="ml-2 text-[10px] uppercase font-semibold text-[#8AAEBB]" style={{ color: '#8AAEBB' }}>
                                                                        {c.allowDirectSO ? '🏢 Công ty (Được bán)' : '🏢 Công ty (Mẹ - Chỉ gánh nợ)'}
                                                                    </span>
                                                                )}
                                                                {c.brandGroup && (
                                                                    <span className="ml-2 text-[10px] px-1 bg-[#2A4355]/50 border border-[#2A4355] text-gray-300 rounded">
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

                            {selectedCustomer && shippingAddressId && (() => {
                                const selectedAddr = selectedCustomer.addresses?.find(a => a.id === shippingAddressId)
                                if (!selectedAddr) return null
                                return (
                                    <div className="p-2 rounded bg-[#142433]/60 border border-[#2A4355]/40 text-[11px] text-gray-300 leading-normal">
                                        <span className="font-bold text-[#87CBB9]">{selectedAddr.label}: </span>
                                        {selectedAddr.address}{selectedAddr.ward && `, ${selectedAddr.ward}`}{selectedAddr.district && `, ${selectedAddr.district}`}{selectedAddr.city && `, ${selectedAddr.city}`}
                                    </div>
                                )
                            })()}

                            {/* Row 2: Credit Status & Order general details */}
                            {selectedCustomer && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Credit Status Card */}
                                    <div className="p-2.5 rounded-lg flex flex-col justify-between"
                                        style={{ background: creditWarning ? 'rgba(139,26,46,0.06)' : 'rgba(91,168,138,0.04)', border: `1px solid ${creditWarning ? 'rgba(139,26,46,0.25)' : 'rgba(91,168,138,0.15)'}` }}>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: creditWarning ? '#EF4444' : '#5BA88A' }}>
                                                {isCreditHold ? '⚠️ Giữ tín dụng' : creditWarning ? '⚠️ Vượt hạn mức' : '✅ Tín dụng OK'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                                            <div>
                                                <p style={{ color: '#4A6A7A' }} className="text-[10px]">Hạn mức</p>
                                                <p className="font-semibold font-mono" style={{ color: '#E8F1F2' }}>{formatVND(effectiveCreditLimit)}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: '#4A6A7A' }} className="text-[10px]">Dư nợ</p>
                                                <p className="font-semibold font-mono" style={{ color: '#D4A853' }}>{loadingAR ? '...' : formatVND(arBalance)}</p>
                                            </div>
                                            <div>
                                                <p style={{ color: '#4A6A7A' }} className="text-[10px]">Khả dụng</p>
                                                <p className="font-semibold font-mono" style={{ color: creditWarning ? '#EF4444' : '#5BA88A' }}>{formatVND(Math.max(0, creditAvailable))}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* General Order Info */}
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
                                                                            onFocus={() => setActiveDropdownIndex(i)}
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
                                                                            className="w-full px-2.5 py-1.5 text-xs outline-none bg-[#0D1E2B] border border-[#2A4355] text-white rounded"
                                                                        />
                                                                        
                                                                        {activeDropdownIndex === i && (
                                                                            <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded bg-[#142433] border border-[#2A4355] w-[450px]">
                                                                                {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                                    <div className="px-3 py-2 text-xs text-gray-500">
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
                                                                                            className="px-3 py-2 text-xs cursor-pointer hover:bg-[#1B2E3D] transition-colors text-left text-white"
                                                                                        >
                                                                                            <span className="font-bold text-[#87CBB9] mr-1.5">[{p.skuCode}]</span>
                                                                                            <span>{p.productName}</span>
                                                                                            <span className="ml-2 text-gray-400 text-[10px]">(Tồn: {p.totalStock})</span>
                                                                                        </div>
                                                                                    ))
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {line.productId && (
                                                                        <div className="mt-1 text-[10px] text-gray-300 bg-[#0A1926] p-1.5 rounded border border-[#2A4355]/40 whitespace-normal leading-relaxed">
                                                                            {line.productName}
                                                                        </div>
                                                                    )}
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
                                                                        className="w-14 px-2 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
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
                                                                        className="w-12 px-1 py-1 text-xs text-center bg-[#0D1E2B] border border-[#2A4355] text-white rounded outline-none"
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
                                                                    onFocus={() => {
                                                                        setActiveDropdownIndex(i)
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
                                                                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-md shadow-lg border"
                                                                         style={{ background: '#142433', borderColor: '#2A4355' }}>
                                                                        {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                            <div className="px-3 py-2 text-xs text-gray-500">
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
                                                                                    className="px-3 py-2 text-xs cursor-pointer hover:bg-[#1B2E3D] transition-colors text-left"
                                                                                    style={{ color: '#E8F1F2' }}
                                                                                >
                                                                                    <span className="font-bold text-[#87CBB9] mr-1.5">[{p.skuCode}]</span>
                                                                                    <span>{p.productName}</span>
                                                                                    <span className="ml-2 text-gray-400 text-[10px]">(Tồn: {p.totalStock})</span>
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
                                                        {line.productId && (
                                                            <div className="text-[10px] text-gray-300 bg-[#0A1926] p-1.5 rounded border border-[#2A4355]/40 whitespace-normal leading-relaxed">
                                                                {line.productName}
                                                            </div>
                                                        )}
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
                                                                    readOnly
                                                                    className="w-full px-2.5 py-1.5 text-sm outline-none opacity-70 cursor-not-allowed"
                                                                    style={{ ...inputStyle, background: 'rgba(20,36,51,0.5)' }}
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
                                    <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        <p className="text-sm font-semibold" style={{ color: '#8AAEBB' }}>Tổng Cộng</p>
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
