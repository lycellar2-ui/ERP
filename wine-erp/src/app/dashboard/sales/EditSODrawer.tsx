'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, Tag, Search, ChevronDown, CheckCircle2, Building2, Star, Calendar, FileText, ShoppingBag, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    updateSalesOrder, SOUpdateInput, SalesChannel,
    getProductPricesForChannel, getSalesOrderDetailWithMargin,
    getLegalEntities, LegalEntityRow,
} from './actions'
import { formatVND, getLocalDateString } from '@/lib/utils'
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
            return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50'
        case 'FIXED_PRICE':
            return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700/50'
        case 'FIXED_DISCOUNT':
            return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700/50'
        case 'CHANNEL_BASE':
            return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50'
        case 'RETAIL_FALLBACK':
            return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700/50'
        default:
            return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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

    const [orderDate, setOrderDate] = useState('')
    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [notes, setNotes] = useState('')
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
            setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name.replace(/^\u00A0\u00A0\u00A0↳\s*/, '')}`)
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
        if (detail.createdAt) {
            setOrderDate(getLocalDateString(new Date(detail.createdAt)))
        }
        setCustomerId(detail.customerId)
        setChannel(detail.channel as SalesChannel)
        setPaymentTerm(detail.paymentTerm)
        setOrderDiscount(Number(detail.orderDiscount ?? 0))
        setNotes(detail.notes ?? '')
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
                        if (resolved && resolved.price > 0) {
                            return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source }
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
                            return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source }
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
        const prodVat = p.vatRate !== undefined ? Number(p.vatRate) : 10

        setLines(prev => [...prev, {
            productId: p.id, productName: p.productName, skuCode: p.skuCode,
            qtyOrdered: 1, unitPrice: price, lineDiscountPct: 0, stock: p.totalStock,
            priceSource: source, vatRate: prodVat,
        }])
    }

    const updateLine = (idx: number, field: keyof SOLine, value: any) => {
        setLines(prev => {
            return prev.map((l, i) => {
                if (i !== idx) return l
                if (field === 'productId') {
                    const p = products.find(p => p.id === value)!
                    const price = priceMap[value]?.price ?? 0
                    const source = priceMap[value]?.source ?? null
                    const prodVat = p?.vatRate !== undefined ? Number(p.vatRate) : 10

                    return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice: price, lineDiscountPct: 0, priceSource: source, vatRate: prodVat }
                }
                return { ...l, [field]: value }
            })
        })
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

    const vatBreakdown = useMemo(() => {
        const map: Record<number, { amount: number; rate: number }> = {}
        const discountMultiplier = 1 - orderDiscount / 100
        for (const l of lines) {
            if (!l.productId) continue
            const rate = l.vatRate ?? 10
            const lineAmt = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100) * discountMultiplier
            if (!map[rate]) map[rate] = { amount: 0, rate }
            map[rate].amount += lineAmt * (rate / 100)
        }
        return Object.values(map).sort((a, b) => a.rate - b.rate)
    }, [lines, orderDiscount])

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
            orderDate,
            customerId,
            channel,
            paymentTerm,
            orderDiscount,
            notes,
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
                return `Đã cập nhật thành công ${soNo}`
            },
            error: (e: Error) => e.message,
            finally: () => setSaving(false),
        })
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            {/* Backdrop click outside to close */}
            <div className="hidden md:block md:flex-1" onClick={onClose} />

            {/* Main Drawer Container */}
            <div className="w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl h-full flex flex-col overflow-hidden bg-white dark:bg-[#111C24] shadow-2xl border-l border-slate-200 dark:border-[#223645] animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#223645] bg-white dark:bg-[#15232E] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-lg border border-amber-500/20">
                            ✏️
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">Sửa Đơn Bán Hàng</h2>
                                <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md border border-amber-300 dark:border-amber-700/50">
                                    {soNo}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chỉnh sửa thông tin đơn hàng ở trạng thái DRAFT</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        title="Đóng"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50 dark:bg-[#0E171E]">
                    {(loadingData || loadingSO) ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <Loader2 size={32} className="animate-spin text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu đơn hàng...</p>
                        </div>
                    ) : (
                        <>
                            {/* Row 1: Khách hàng + Địa chỉ + Ngày đơn hàng */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                                {/* Customer Selection */}
                                <div className="md:col-span-5">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Khách Hàng *
                                    </label>
                                    <div className="relative">
                                        <div className={`relative flex items-center w-full rounded-lg border-2 transition-all bg-white dark:bg-[#16232F] ${customerDropdownOpen ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-slate-200 dark:border-[#2A4355] hover:border-slate-300 dark:hover:border-[#3B5466]'}`}>
                                            <div className="pl-3 text-slate-400">
                                                <Search size={15} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo mã hoặc tên khách hàng..."
                                                value={customerSearchInput}
                                                onFocus={e => {
                                                    setCustomerDropdownOpen(true)
                                                    e.target.select()
                                                }}
                                                onBlur={() => {
                                                    setTimeout(() => {
                                                        setCustomerDropdownOpen(false)
                                                        if (selectedCustomer) {
                                                            setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name.replace(/^\u00A0\u00A0\u00A0↳\s*/, '')}`)
                                                        } else {
                                                            setCustomerSearchInput('')
                                                        }
                                                    }, 200)
                                                }}
                                                onChange={e => {
                                                    setCustomerSearchInput(e.target.value)
                                                    setCustomerDropdownOpen(true)
                                                }}
                                                className="w-full pl-2.5 pr-8 py-2 text-xs font-semibold text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                            />
                                            {selectedCustomer ? (
                                                <button
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        setCustomerId('')
                                                        setCustomerSearchInput('')
                                                        setCustomerDropdownOpen(true)
                                                    }}
                                                    className="absolute right-2 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                                    title="Xóa khách hàng"
                                                >
                                                    <X size={14} />
                                                </button>
                                            ) : (
                                                <div className="absolute right-2.5 pointer-events-none text-slate-400">
                                                    <ChevronDown size={14} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Customer Results */}
                                        {customerDropdownOpen && (
                                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-white dark:bg-[#16232F] border border-slate-200 dark:border-[#2A4355] shadow-xl py-1 divide-y divide-slate-100 dark:divide-[#223645]">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="px-4 py-3 text-xs text-slate-400 text-center">
                                                        Không tìm thấy khách hàng phù hợp
                                                    </div>
                                                ) : (
                                                    filteredCustomers.map(c => {
                                                        const isCompany = c.entityType === 'COMPANY'
                                                        const isDisabled = isCompany && !c.allowDirectSO
                                                        const isSelected = c.id === customerId

                                                        return (
                                                            <div
                                                                key={c.id}
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault()
                                                                    if (isDisabled) {
                                                                        toast.error('Công ty này chỉ dùng quản lý công nợ. Vui lòng chọn Chi nhánh/Nhà hàng con!')
                                                                        return
                                                                    }
                                                                    handleCustomerChange(c.id)
                                                                    setCustomerDropdownOpen(false)
                                                                }}
                                                                className={`px-3.5 py-2.5 cursor-pointer transition-colors ${
                                                                    isDisabled 
                                                                        ? 'bg-slate-50 opacity-60 cursor-not-allowed dark:bg-slate-900/40' 
                                                                        : isSelected 
                                                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500' 
                                                                        : 'hover:bg-slate-50 dark:hover:bg-[#1C2C3A]'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col gap-1 min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${isDisabled ? 'bg-slate-200 text-slate-500' : 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'}`}>
                                                                                {c.code}
                                                                            </span>
                                                                            <span className={`font-semibold text-xs truncate ${isSelected ? 'text-amber-900 dark:text-amber-200' : 'text-slate-800 dark:text-slate-200'}`}>
                                                                                {c.name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                                                            {isCompany && (
                                                                                <span className="flex items-center gap-1 text-sky-600 font-medium">
                                                                                    <Building2 size={11} /> {c.allowDirectSO ? 'Công ty' : 'Công ty Mẹ'}
                                                                                </span>
                                                                            )}
                                                                            {c.brandGroup && (
                                                                                <span className="text-amber-600 font-medium">
                                                                                    ✨ {c.brandGroup}
                                                                                </span>
                                                                            )}
                                                                            {c.channel && <span>Kênh: {c.channel}</span>}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <span className="shrink-0 text-amber-600 dark:text-amber-400">
                                                                            <CheckCircle2 size={16} />
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
                                <div className="md:col-span-4">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Địa Chỉ Giao Hàng *
                                    </label>
                                    {!selectedCustomer ? (
                                        <div className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-[#2A4355] text-slate-400 bg-slate-100/60 dark:bg-slate-900/40">
                                            Chưa chọn khách hàng
                                        </div>
                                    ) : (!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) ? (
                                        <div className="px-3 py-2 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-lg">
                                            ⚠️ Khách hàng chưa có địa chỉ
                                        </div>
                                    ) : (
                                        <select
                                            value={shippingAddressId}
                                            onChange={e => setShippingAddressId(e.target.value)}
                                            className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                        >
                                            <option value="">-- Chọn địa chỉ giao hàng --</option>
                                            {selectedCustomer.addresses.map(addr => (
                                                <option key={addr.id} value={addr.id}>
                                                    {addr.label}: {addr.address}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Order Date */}
                                <div className="md:col-span-3">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        📅 Ngày Đơn Hàng *
                                    </label>
                                    <input
                                        type="date"
                                        value={orderDate}
                                        onChange={e => setOrderDate(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-semibold font-mono rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {/* Customer Selected Info / Address Preview */}
                            {selectedCustomer && shippingAddressId && (() => {
                                const selectedAddr = selectedCustomer.addresses?.find(a => a.id === shippingAddressId)
                                if (!selectedAddr) return null
                                return (
                                    <div className="p-3 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <span className="font-bold text-teal-800 dark:text-teal-300">{selectedAddr.label}: </span>
                                            {selectedAddr.address}
                                            {selectedAddr.ward && `, ${selectedAddr.ward}`}
                                            {selectedAddr.district && `, ${selectedAddr.district}`}
                                            {selectedAddr.city && `, ${selectedAddr.city}`}
                                        </div>
                                        {selectedAddr.isDefault && (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-200 text-teal-900 rounded-full border border-teal-300">
                                                Mặc định
                                            </span>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Credit Status Banner */}
                            {selectedCustomer && (
                                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-white dark:bg-[#16232F] border border-slate-200 dark:border-[#2A4355] shadow-xs text-xs">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <span className={`font-bold flex items-center gap-1.5 ${isCreditHold ? 'text-rose-600' : creditWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {isCreditHold ? '⚠️ Bị giữ tín dụng' : creditWarning ? '⚠️ Vượt hạn mức' : '✅ Tín dụng hợp lệ'}
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Hạn mức: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatVND(effectiveCreditLimit)}</strong>
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Dư nợ: <strong className="font-mono text-amber-700 dark:text-amber-300">{formatVND(arBalance)}</strong>
                                        </span>
                                        <span className="text-slate-500 dark:text-slate-400">
                                            Khả dụng: <strong className={`font-mono ${creditWarning ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatVND(Math.max(0, creditAvailable))}</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Row 2: Kênh Bán, Payment Term, Pháp Nhân */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Kênh Bán
                                    </label>
                                    <select
                                        value={channel}
                                        onChange={e => handleChannelChange(e.target.value as SalesChannel)}
                                        className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    >
                                        {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Payment Term (Hạn TT)
                                    </label>
                                    <select
                                        value={paymentTerm}
                                        onChange={e => setPaymentTerm(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    >
                                        {['COD', 'NET7', 'NET14', 'NET15', 'NET30', 'NET45', 'NET60', 'PREPAID', 'EOM_10', 'EOM_15'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                        Pháp Nhân Xuất Tuyến *
                                    </label>
                                    <select
                                        value={legalEntityId}
                                        onChange={e => setLegalEntityId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    >
                                        <option value="">— Chọn Pháp Nhân —</option>
                                        {entities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Diễn giải / Ghi chú đơn hàng */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                                    Diễn Giải / Ghi Chú Đơn Hàng
                                </label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Nhập diễn giải/ghi chú giao hàng hoặc hóa đơn..."
                                    rows={2}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>

                            {/* Section: Bảng Sản Phẩm */}
                            <div className="space-y-3 pt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <ShoppingBag size={16} className="text-amber-600" />
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                            DANH SÁCH SẢN PHẨM * ({lines.length})
                                        </label>
                                    </div>

                                    {/* Add Product Search Input */}
                                    <div className="w-full sm:w-80 relative">
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                placeholder="Gõ mã SKU hoặc tên để thêm sản phẩm..."
                                                value={addProductSearchQuery}
                                                onFocus={() => setIsAddDropdownOpen(true)}
                                                onBlur={() => {
                                                    setTimeout(() => {
                                                        setIsAddDropdownOpen(false)
                                                        setAddProductSearchQuery('')
                                                    }, 250)
                                                }}
                                                onChange={e => {
                                                    setAddProductSearchQuery(e.target.value)
                                                    setIsAddDropdownOpen(true)
                                                }}
                                                className="w-full pl-3 pr-8 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-[#2A4355] bg-white dark:bg-[#16232F] text-slate-900 dark:text-white placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                            />
                                            <div className="absolute right-2.5 text-slate-400 pointer-events-none">
                                                <Search size={14} />
                                            </div>
                                        </div>

                                        {/* Autocomplete Product Results */}
                                        {isAddDropdownOpen && (
                                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-lg shadow-xl border bg-white dark:bg-[#16232F] border-slate-200 dark:border-[#2A4355] divide-y divide-slate-100 dark:divide-[#223645]">
                                                {getFilteredAddProducts(addProductSearchQuery).length === 0 ? (
                                                    <div className="px-3 py-2.5 text-xs text-slate-400 text-center">
                                                        Không tìm thấy hoặc sản phẩm đã có trong đơn
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
                                                            className="px-3 py-2 text-xs cursor-pointer hover:bg-amber-50/70 dark:hover:bg-[#1C2C3A] transition-colors flex items-center justify-between gap-2"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <span className="font-bold font-mono text-teal-700 dark:text-teal-400 shrink-0">[{p.skuCode}]</span>
                                                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{p.productName}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-medium">
                                                                (Tồn: {p.totalStock})
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {lines.length === 0 ? (
                                    <div className="text-center py-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#223645] bg-white dark:bg-[#121E27]">
                                        <ShoppingBag size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Đơn hàng chưa có sản phẩm nào</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">Tìm kiếm sản phẩm ở ô phía trên để thêm vào đơn</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#223645] bg-white dark:bg-[#121E27] shadow-xs">
                                        <table className="w-full text-xs text-left border-collapse min-w-[650px]">
                                            <thead>
                                                <tr className="bg-slate-100/90 dark:bg-[#162531] text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-[#223645] font-bold">
                                                    <th className="px-3.5 py-3">Sản Phẩm</th>
                                                    <th className="px-3 py-3 w-20 text-center">Tồn Kho</th>
                                                    <th className="px-3 py-3 w-20 text-center">SL</th>
                                                    <th className="px-3 py-3 w-28 text-right">Đơn Giá</th>
                                                    <th className="px-3 py-3 w-20 text-center">CK %</th>
                                                    <th className="px-3 py-3 w-20 text-center">VAT %</th>
                                                    <th className="px-3 py-3 w-28 text-right">Thành Tiền</th>
                                                    <th className="px-2 py-3 w-10 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-[#1C2C3A]">
                                                {lines.map((l, idx) => {
                                                    const lineTotal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)
                                                    const lowStock = l.stock < l.qtyOrdered
                                                    const priceSource = priceMap[l.productId]?.source ?? l.priceSource
                                                    const hasPriceBadge = priceSource && priceSource !== 'DEFAULT_ZERO'

                                                    return (
                                                        <tr key={idx} className={`hover:bg-slate-50/80 dark:hover:bg-[#16232F]/50 transition-colors ${lowStock ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                                                            <td className="px-3.5 py-2.5">
                                                                <p className="font-mono font-bold text-slate-900 dark:text-white">{l.skuCode}</p>
                                                                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5 max-w-[320px]">{l.productName}</p>
                                                                {hasPriceBadge && (
                                                                    <div className="mt-1">
                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getPriceBadgeStyle(priceSource)}`}>
                                                                            <Tag size={9} /> {getPriceBadgeLabel({ source: priceSource }, channel)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <span className={`font-mono font-bold ${lowStock ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                                                    {l.stock}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={l.qtyOrdered}
                                                                    onChange={e => updateLine(idx, 'qtyOrdered', Math.max(1, +e.target.value))}
                                                                    className="w-16 px-2 py-1 text-xs text-center font-bold rounded-md border border-slate-300 dark:border-[#2A4355] bg-slate-50 dark:bg-[#1A2A38] text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-amber-500"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                                                {formatVND(l.unitPrice)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={l.lineDiscountPct}
                                                                    onChange={e => updateLine(idx, 'lineDiscountPct', Math.min(100, Math.max(0, +e.target.value)))}
                                                                    className="w-14 px-1.5 py-1 text-xs text-center rounded-md border border-slate-300 dark:border-[#2A4355] bg-slate-50 dark:bg-[#1A2A38] text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-amber-500"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center">
                                                                <select
                                                                    value={l.vatRate ?? 10}
                                                                    onChange={e => updateLine(idx, 'vatRate', Number(e.target.value))}
                                                                    className="w-16 px-1.5 py-1 text-xs text-center rounded-md border border-slate-300 dark:border-[#2A4355] bg-slate-50 dark:bg-[#1A2A38] text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-amber-500"
                                                                >
                                                                    <option value={10}>10%</option>
                                                                    <option value={8}>8%</option>
                                                                    <option value={0}>0%</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                                                                {formatVND(lineTotal)}
                                                            </td>
                                                            <td className="px-2 py-2.5 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeLine(idx)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                                                    title="Xóa dòng"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Section: Tổng Hợp Tài Chính & Chiết Khấu */}
                            <div className="p-4 rounded-xl bg-white dark:bg-[#16232F] border border-slate-200 dark:border-[#2A4355] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <Tag size={15} className="text-amber-600" />
                                    <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">CK Đơn Hàng:</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={orderDiscount}
                                        onChange={e => setOrderDiscount(Math.min(100, Math.max(0, +e.target.value)))}
                                        className="w-16 px-2 py-1 text-xs text-center font-bold rounded-lg border border-slate-300 dark:border-[#2A4355] bg-slate-50 dark:bg-[#1A2A38] text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-amber-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-500">%</span>
                                </div>

                                <div className="text-right space-y-1">
                                    <div className="flex justify-end gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                        <span>Trước thuế: <strong className="font-mono text-slate-700 dark:text-slate-200">{formatVND(subtotal * (1 - orderDiscount / 100))}</strong></span>
                                        <span>•</span>
                                        {vatBreakdown.length > 1 ? (
                                            <span>
                                                VAT: {vatBreakdown.map(v => `${v.rate}%: ${formatVND(Math.round(v.amount))}`).join(' | ')} (Tổng: {formatVND(Math.round(vatAmount))})
                                            </span>
                                        ) : (
                                            <span>VAT ({vatBreakdown[0]?.rate ?? 10}%): <strong className="font-mono text-slate-700 dark:text-slate-200">{formatVND(Math.round(vatAmount))}</strong></span>
                                        )}
                                    </div>
                                    <div className="flex justify-end items-baseline gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tổng thanh toán (Gồm VAT):</span>
                                        <span className="text-xl font-black font-mono text-amber-700 dark:text-amber-400">
                                            {formatVND(finalTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-[#223645] bg-white dark:bg-[#15232E] flex items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-xs font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || lines.length === 0 || loadingSO}
                        className="px-6 py-2.5 text-xs font-bold rounded-lg flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </button>
                </div>
            </div>
        </div>
    )
}
