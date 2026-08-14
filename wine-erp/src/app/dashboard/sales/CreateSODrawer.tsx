'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, CheckCircle2, Tag, ShieldAlert, Printer, Eye, Search, Building2, Star, ChevronDown, History, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    createSalesOrder, SOCreateInput, SalesChannel, SOType,
    getProductPricesForChannel, getActiveAllocationsForProducts,
    getLegalEntities, LegalEntityRow, getApprovedProposalsForSO, getProposalWithItemsForSO,
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
    defaultLegalEntityId?: string | null
    parentId: string | null
    entityType: string
    allowDirectSO: boolean
    brandGroup: string | null
    purchasingName?: string | null
    purchasingPhone?: string | null
    receiverName?: string | null
    receiverPhone?: string | null
    contacts?: {
        id?: string
        name?: string | null
        phone?: string | null
        isPrimary?: boolean
    }[]
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
        taxId?: string | null
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

export interface CloneSOData {
    customerId: string
    channel: SalesChannel
    paymentTerm: string
    orderDiscount: number
    legalEntityId: string
    shippingAddressId?: string
    notes?: string
    orderType?: SOType
    proposalId?: string
    lines: {
        productId: string
        productName: string
        skuCode: string
        qtyOrdered: number
        unitPrice: number
        lineDiscountPct: number
        vatRate?: number
        priceSource?: string | null
        stock?: number
    }[]
}

export function CreateSODrawer({ open, onClose, onSaved, userId, userRoles = [], cloneData }: { open: boolean; onClose: () => void; onSaved: (soId?: string) => void; userId: string; userRoles?: string[]; cloneData?: CloneSOData | null }) {
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

    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0])
    const [customerId, setCustomerId] = useState('')
    const [channel, setChannel] = useState<SalesChannel>('HORECA')
    const [paymentTerm, setPaymentTerm] = useState('NET30')
    const [orderDiscount, setOrderDiscount] = useState(0)
    const [lines, setLines] = useState<SOLine[]>([])
    const [notes, setNotes] = useState('')
    const [orderType, setOrderType] = useState<SOType>('STANDARD')
    const [proposalId, setProposalId] = useState('')
    const [proposals, setProposals] = useState<{ id: string; proposalNo: string; title: string; estimatedAmount: number; customer?: { id: string; name: string } | null }[]>([])

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

    // Hydrate form data if opening with cloned SO data
    useEffect(() => {
        if (open && cloneData) {
            setCustomerId(cloneData.customerId)
            setChannel(cloneData.channel)
            setPaymentTerm(cloneData.paymentTerm)
            setOrderDiscount(cloneData.orderDiscount)
            if (cloneData.legalEntityId) setLegalEntityId(cloneData.legalEntityId)
            if (cloneData.shippingAddressId) setShippingAddressId(cloneData.shippingAddressId)
            if (cloneData.notes) setNotes(cloneData.notes)
            if (cloneData.orderType) setOrderType(cloneData.orderType)
            if (cloneData.proposalId) setProposalId(cloneData.proposalId)

            setLines(cloneData.lines.map(l => ({
                productId: l.productId,
                productName: l.productName,
                skuCode: l.skuCode,
                qtyOrdered: l.qtyOrdered,
                unitPrice: l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                vatRate: l.vatRate ?? 10,
                priceSource: l.priceSource || undefined,
                stock: l.stock ?? 100,
            })))

            if (cloneData.proposalId && cloneData.lines.length === 0) {
                getProposalWithItemsForSO(cloneData.proposalId).then(prop => {
                    if (prop) {
                        setNotes(`Đơn Tasting kèm Tờ trình ${prop.proposalNo}: ${prop.title}`)
                        if (prop.priceItems && prop.priceItems.length > 0) {
                            const loadedLines = prop.priceItems.map((item: any) => ({
                                productId: item.productId,
                                productName: item.productName,
                                skuCode: item.skuCode,
                                qtyOrdered: item.quantity || 1,
                                unitPrice: 0,
                                lineDiscountPct: 0,
                                vatRate: 10,
                                priceSource: 'TASTING_FREE',
                                stock: 100,
                            }))
                            setLines(loadedLines)
                            toast.success(`✨ Tự động nạp ${loadedLines.length} sản phẩm theo Tờ trình ${prop.proposalNo}`)
                        }
                    }
                }).catch(() => {})
            }
        }
    }, [open, cloneData])

    useEffect(() => {
        if (open && cloneData && sortedCustomersForSelect.length > 0) {
            const found = sortedCustomersForSelect.find(c => c.id === cloneData.customerId)
            if (found) {
                setSelectedCustomer(found)
                setCustomerSearchInput(`[${found.code}] ${found.name.replace(/^\u00A0\u00A0\u00A0↳\s*/, '')}`)
            }
        }
    }, [open, cloneData, sortedCustomersForSelect])

    useEffect(() => {
        if (selectedCustomer) {
            setCustomerSearchInput(`[${selectedCustomer.code}] ${selectedCustomer.name}`)
        } else {
            setCustomerSearchInput('')
        }
    }, [selectedCustomer])

    useEffect(() => {
        if (open) {
            getApprovedProposalsForSO(customerId || undefined).then(res => {
                setProposals(res || [])
            }).catch(() => {})
        }
    }, [open, customerId])

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
                    if (resolved && resolved.price > 0) {
                        return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source }
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
                        return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source }
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
                if (!l.productId) return l
                const resolved = resolvedPrices[l.productId]
                if (resolved && resolved.price > 0) {
                    return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source }
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
        const existingLine = lines.find(l => l.productId)
        const inheritedVatRate = existingLine ? (existingLine.vatRate ?? 10) : 10
        setLines(prev => [...prev, { productId: '', productName: '', skuCode: '', qtyOrdered: 1, unitPrice: 0, lineDiscountPct: 0, stock: 0, priceSource: null, vatRate: inheritedVatRate }])
    }

    const updateLine = (i: number, field: keyof SOLine, value: any) => {
        setLines(prev => {
            let newVatRate: number | null = null
            if (field === 'vatRate') {
                newVatRate = Number(value)
                toast.info(`Đã áp dụng thuế suất VAT ${newVatRate}% đồng bộ cho toàn bộ đơn hàng`)
            }

            return prev.map((l, idx) => {
                if (field === 'vatRate' && newVatRate !== null) {
                    return { ...l, vatRate: newVatRate }
                }
                if (idx !== i) return l
                if (field === 'productId') {
                    const p = products.find(p => p.id === value)!
                    const mapEntry = priceMap[value]
                    const resolvedPrice = (mapEntry && mapEntry.price > 0) ? mapEntry.price : 0
                    const wp = p?.wholesalePrice ?? 0
                    const rp = p?.retailPrice ?? 0
                    const isWholesaleChan = (channel === 'HORECA' || channel === 'WHOLESALE_DISTRIBUTOR')
                    const fallbackUnitPrice = isWholesaleChan ? (wp > 0 ? wp : rp) : (rp > 0 ? rp : wp)
                    const unitPrice = resolvedPrice > 0 ? resolvedPrice : fallbackUnitPrice
                    const priceSource = (mapEntry && resolvedPrice > 0) ? mapEntry.source : (isWholesaleChan ? 'WHOLESALE_BASE' : 'RETAIL_BASE')
                    
                    // Update search query display
                    setSearchQueries(prevQueries => ({
                        ...prevQueries,
                        [i]: `[${p.skuCode}] ${p.productName}`
                    }))

                    const existingLine = prev.find((item, itemIdx) => itemIdx !== i && item.productId)
                    const inheritedVatRate = existingLine ? (existingLine.vatRate ?? 10) : (p?.vatRate ? Number(p.vatRate) : 10)

                    if (existingLine && p?.vatRate && Number(p.vatRate) !== inheritedVatRate) {
                        toast.info(`Sản phẩm "${p.productName}" có VAT gốc ${p.vatRate}%, đã được áp dụng VAT ${inheritedVatRate}% theo đơn hàng để đồng nhất 1 loại thuế suất.`)
                    }

                    return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: p.totalStock, unitPrice, lineDiscountPct: 0, priceSource, vatRate: inheritedVatRate }
                }
                return { ...l, [field]: value }
            })
        })
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

        const distinctVat = Array.from(new Set(lines.map(l => Number(l.vatRate ?? 10))))
        if (distinctVat.length > 1) {
            return toast.error(`Mỗi hóa đơn/đơn hàng chỉ được phép có 1 loại thuế suất VAT duy nhất! Đơn hiện tại đang dính các mức: ${distinctVat.join('%, ')}%.`)
        }

        setSaving(true)
        const promise = createSalesOrder({
            orderDate,
            customerId,
            salesRepId: userId || 'SYSTEM',
            channel,
            orderType,
            proposalId: proposalId || undefined,
            paymentTerm: orderType === 'TASTING' ? (paymentTerm || 'TASTING - Không thu tiền') : paymentTerm,
            orderDiscount: orderType === 'TASTING' ? 0 : orderDiscount,
            notes,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: orderType === 'TASTING' ? 0 : l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                vatRate: l.vatRate ?? 10,
                priceSource: orderType === 'TASTING' ? 'TASTING_FREE' : (l.priceSource || undefined)
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
                setTimeout(() => { onSaved(result.soId); resetForm() }, 500)
                return `Tạo thành công ${result.soNo}`
            },
            error: (err: any) => `Lỗi: ${err.message}`,
            finally: () => setSaving(false)
        })
    }

    const resetForm = () => {
        setOrderDate(new Date().toISOString().split('T')[0])
        setCustomerId(''); setSelectedCustomer(null); setChannel('HORECA')
        setPaymentTerm('NET30'); setOrderDiscount(0); setLines([])
        setOrderType('STANDARD'); setProposalId('')
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
                            {orderType === 'TASTING' ? '🍷 Tạo Đơn Hàng Tasting' : '🛒 Tạo Đơn Bán Hàng'}
                        </h3>
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
                            {/* Order Type Selector: Commercial vs Tasting */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">LOẠI ĐƠN HÀNG:</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrderType('STANDARD')
                                            }}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                orderType === 'STANDARD'
                                                    ? 'bg-emerald-700 text-white shadow border border-emerald-800'
                                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                                            }`}
                                        >
                                            📦 Đơn Thương Mại
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrderType('TASTING')
                                                setPaymentTerm('TASTING - Không thu tiền')
                                                setLines(prev => prev.map(l => ({ ...l, unitPrice: 0 })))
                                            }}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                orderType === 'TASTING'
                                                    ? 'bg-amber-600 text-white shadow border border-amber-700 ring-2 ring-amber-500/30'
                                                    : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-400'
                                            }`}
                                        >
                                            🍷 Đơn Tasting (Ko thu tiền)
                                        </button>
                                    </div>
                                </div>

                                {orderType === 'TASTING' && (
                                    <span className="text-[11px] text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-md flex items-center gap-1 font-semibold shadow-xs">
                                        ✨ Đơn Tasting theo Sale — Đơn giá xuất kho 0 VNĐ & đính kèm Tờ trình Tasting
                                    </span>
                                )}
                            </div>

                            {/* Proposal Selector for Tasting Orders */}
                            {orderType === 'TASTING' && (
                                <div className="p-4 rounded-xl border-2 border-amber-400/90 bg-amber-50/95 shadow-md space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                        <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText size={16} className="text-amber-800" />
                                            TỜ TRÌNH TASTING LIÊN KẾT *
                                        </label>
                                        <span className="text-[11px] font-bold text-amber-900 bg-amber-200/60 px-2.5 py-0.5 rounded-full border border-amber-300">
                                            Căn cứ phê duyệt đơn xuất kho Tasting 0đ
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        {/* Field 1: Choose Proposal */}
                                        <div className="md:col-span-6">
                                            <label className="block text-[11px] font-black uppercase text-amber-950 mb-1">
                                                CHỌN TỜ TRÌNH TASTING ĐÃ DUYỆT *
                                            </label>
                                            <select
                                                value={proposalId}
                                                onChange={async e => {
                                                    const selectedId = e.target.value
                                                    setProposalId(selectedId)
                                                    if (!selectedId) return
                                                    try {
                                                        const fullProp = await getProposalWithItemsForSO(selectedId)
                                                        if (fullProp) {
                                                            setNotes(`Đơn Tasting kèm Tờ trình ${fullProp.proposalNo}: ${fullProp.title}`)
                                                            if (fullProp.customerId && !customerId) {
                                                                setCustomerId(fullProp.customerId)
                                                                const foundCust = sortedCustomersForSelect.find(c => c.id === fullProp.customerId)
                                                                if (foundCust) setSelectedCustomer(foundCust)
                                                            }
                                                            if (fullProp.priceItems && fullProp.priceItems.length > 0) {
                                                                const loadedLines = fullProp.priceItems.map((item: any) => ({
                                                                    productId: item.productId,
                                                                    productName: item.productName,
                                                                    skuCode: item.skuCode,
                                                                    qtyOrdered: item.quantity || 1,
                                                                    unitPrice: orderType === 'TASTING' ? 0 : item.proposedPrice,
                                                                    lineDiscountPct: 0,
                                                                    vatRate: 10,
                                                                    priceSource: orderType === 'TASTING' ? 'TASTING_FREE' : 'PROPOSAL',
                                                                    stock: 100,
                                                                }))
                                                                setLines(loadedLines)
                                                                toast.success(`✨ Tự động nạp ${loadedLines.length} sản phẩm và số lượng chuẩn từ Tờ trình ${fullProp.proposalNo}`)
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error(err)
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-xs font-bold rounded-lg border-2 border-amber-400 bg-white text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                <option value="" className="text-slate-500 font-normal">-- Chọn Tờ trình Tasting đã duyệt --</option>
                                                {proposals.map(p => (
                                                    <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                                                        [{p.proposalNo}] {p.title} ({p.customer ? p.customer.name : 'Chung'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Field 2: SỐ TỜ TRÌNH (Explicit dedicated field) */}
                                        <div className="md:col-span-6">
                                            <label className="block text-[11px] font-black uppercase text-amber-950 mb-1">
                                                SỐ TỜ TRÌNH (VD: TT-2026-008) *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    placeholder="Số Tờ trình (Tự động điền khi chọn Tờ trình)"
                                                    value={proposals.find(p => p.id === proposalId)?.proposalNo || (proposalId ? proposalId : '')}
                                                    className="w-full px-3 py-2 text-xs font-extrabold font-mono rounded-lg border-2 border-amber-400 bg-amber-100/90 text-amber-950 placeholder:text-amber-700/60 shadow-xs focus:outline-none"
                                                />
                                                {proposalId && (
                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded border border-emerald-400">
                                                        ✓ ĐÃ LIÊN KẾT
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Field 3: Notes / Note Details */}
                                        <div className="md:col-span-12">
                                            <input
                                                type="text"
                                                placeholder="Ghi chú thêm về Đơn Tasting / Lý do cấp rượu mẫu..."
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-amber-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Row 1: Customer, Address & Order Date */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                {/* Customer Autocomplete Search */}
                                <div className="md:col-span-5">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                                            Khách Hàng *
                                        </label>
                                        {selectedCustomer && (
                                            <a href="/dashboard/crm" target="_blank" className="text-[10px] text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1 transition-colors" title="Mở tab CRM để xem lịch sử mua hàng chi tiết">
                                                <History size={10} />
                                                Lịch sử mua hàng
                                            </a>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className={`relative flex items-center w-full rounded-md border-2 transition-all ${customerDropdownOpen ? 'border-teal-500 ring-4 ring-teal-500/10 dark:border-[#87CBB9] dark:ring-[#87CBB9]/10' : 'border-slate-200 hover:border-slate-300 dark:border-[#2A4355] dark:hover:border-[#3B5466]'} bg-white dark:bg-[#142433]`}>
                                            <div className="pl-3 text-slate-400">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Tìm kiếm theo mã, tên khách hàng..."
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
                                                className="w-full pl-3 pr-10 py-2 text-sm font-semibold text-slate-900 dark:text-white bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-[#6A8A9A]"
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
                                                    className="absolute right-2 p-1.5 text-slate-400 hover:text-white hover:bg-rose-500 dark:bg-[#1F3547] rounded-md transition-colors"
                                                    title="Xóa khách hàng đã chọn"
                                                >
                                                    <X size={14} />
                                                </button>
                                            ) : (
                                                <div className="absolute right-3 pointer-events-none text-slate-400">
                                                    <ChevronDown size={14} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Results List */}
                                        {customerDropdownOpen && (
                                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-white dark:bg-[#142433] border border-slate-200 dark:border-[#2A4355] shadow-xl py-1 divide-y divide-slate-100 dark:divide-[#1F3547]">
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
                                                                        toast.error('Công ty này chỉ dùng để quản lý công nợ tập trung. Vui lòng chọn Nhà hàng/Chi nhánh con bên dưới để lên đơn!')
                                                                        return
                                                                    }
                                                                    handleCustomerChange(c.id)
                                                                    setCustomerSearchInput(`[${c.code}] ${c.name}`)
                                                                    setCustomerDropdownOpen(false)
                                                                }}
                                                                className={`px-3.5 py-2.5 cursor-pointer transition-colors ${isDisabled ? 'bg-slate-50 opacity-60 cursor-not-allowed dark:bg-[#0E1A24]' : isSelected ? 'bg-teal-50 dark:bg-[#1A3040]' : 'hover:bg-slate-50 dark:hover:bg-[#1F3547]'}`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${isDisabled ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500' : 'bg-teal-100 text-teal-700 dark:bg-[#1C3344] dark:text-[#87CBB9]'}`}>
                                                                                {c.code}
                                                                            </span>
                                                                            <span className={`font-semibold text-sm ${isDisabled ? 'text-slate-400 dark:text-slate-500' : isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                                {c.name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                                                                            {isCompany && (
                                                                                <span className={`flex items-center gap-1 font-medium ${isDisabled ? 'text-slate-400 dark:text-slate-500' : 'text-sky-600 dark:text-sky-400'}`}>
                                                                                    <Building2 size={12} />
                                                                                    {c.allowDirectSO ? 'Công ty' : 'Công ty Cha (Chỉ tính công nợ)'}
                                                                                </span>
                                                                            )}
                                                                            {c.brandGroup && (
                                                                                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-200/90 font-medium">
                                                                                    <Star size={12} className="fill-amber-400/50" />
                                                                                    {c.brandGroup}
                                                                                </span>
                                                                            )}
                                                                            {c.channel && (
                                                                                <span className="text-slate-500 dark:text-[#8AAEBB] font-medium border-l border-slate-200 dark:border-[#2A4355] pl-2 ml-1">
                                                                                    {c.channel}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <div className="shrink-0 text-teal-500 dark:text-[#87CBB9] mt-1">
                                                                            <CheckCircle2 size={18} />
                                                                        </div>
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
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#4A6A7A' }}>
                                        Địa Chỉ Giao Hàng *
                                    </label>
                                    {!selectedCustomer ? (
                                        <div className="w-full px-3 py-2 text-xs rounded border border-[#2A4355] text-gray-500 bg-[#0A1926]/40">
                                            Chưa chọn khách hàng
                                        </div>
                                    ) : (!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) ? (
                                        <div className="px-3 py-2 text-xs bg-red-950/20 border border-red-500/20 text-red-400 rounded">
                                            ⚠️ Chưa có địa chỉ giao hàng
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <select
                                                value={shippingAddressId}
                                                onChange={e => setShippingAddressId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs outline-none rounded"
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

                                {/* Order Date Selection */}
                                <div className="md:col-span-3">
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#4A6A7A' }}>
                                        📅 Ngày Đơn Hàng *
                                    </label>
                                    <input
                                        type="date"
                                        value={orderDate}
                                        onChange={e => setOrderDate(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-semibold outline-none rounded font-mono"
                                        style={{ ...inputStyle }}
                                    />
                                </div>
                            </div>

                            {/* Compact Order Info & Credit Status */}
                            {selectedCustomer && (
                                <div className="flex flex-col gap-2 p-2 rounded-md" style={{ background: '#142433/60', border: '1px solid #2A4355' }}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold" style={{ color: creditWarning ? '#EF4444' : '#5BA88A' }}>
                                                {isCreditHold ? '⚠️ Giữ tín dụng' : creditWarning ? '⚠️ Vượt hạn mức' : '✅ Tín dụng OK'}
                                            </span>
                                            <span style={{ color: '#4A6A7A' }}>Hạn mức: <strong className="font-mono text-slate-200">{formatVND(effectiveCreditLimit)}</strong></span>
                                            <span style={{ color: '#4A6A7A' }}>Dư nợ: <strong className="font-mono text-amber-300">{loadingAR ? '...' : formatVND(arBalance)}</strong></span>
                                            <span style={{ color: '#4A6A7A' }}>Khả dụng: <strong className="font-mono" style={{ color: creditWarning ? '#EF4444' : '#87CBB9' }}>{formatVND(Math.max(0, creditAvailable))}</strong></span>
                                        </div>
                                        {canOverride && (
                                            <button onClick={() => setOverrideMode(!overrideMode)} className="text-[10px] px-1.5 py-0.5 rounded transition-all" style={{ color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', background: 'rgba(212,168,83,0.08)' }}>
                                                {overrideMode ? 'Xong' : 'Sửa thông tin'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="h-px w-full bg-[#2A4355]/50" />
                                    {!overrideMode ? (
                                        <div className="flex items-center gap-4 text-[11px]">
                                            <span style={{ color: '#4A6A7A' }}>Kênh: <strong style={{ color: '#E8F1F2' }}>{CHANNELS.find(c => c.value === channel)?.label ?? channel}</strong></span>
                                            <span style={{ color: '#4A6A7A' }}>Thanh toán: <strong style={{ color: '#E8F1F2' }}>{paymentTerm}</strong></span>
                                            <span style={{ color: '#4A6A7A' }}>Pháp nhân: <strong style={{ color: '#E8F1F2' }} title={entities.find(e => e.id === legalEntityId)?.name}>{entities.find(e => e.id === legalEntityId)?.code ?? 'Mặc định'}</strong></span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <select value={channel} onChange={e => handleChannelChange(e.target.value as SalesChannel)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                            <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                {['COD', 'NET7', 'NET14', 'NET30', 'NET45', 'NET60', 'PREPAID', 'EOM_10', 'EOM_15'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <select value={legalEntityId} onChange={e => setLegalEntityId(e.target.value)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                <option value="">— Pháp Nhân —</option>
                                                {entities.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                                            </select>
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
                        <Printer size={15} /> Xem File In
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
                            {saving ? 'Đang lưu...' : (orderType === 'TASTING' ? '🍷 Tạo Đơn Hàng Tasting' : 'Tạo Đơn')}
                        </button>
                    </div>
                </div>
            </div>

            {/* PRINT PREVIEW MODAL */}
            {previewOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal print:block print:p-0 print:bg-transparent">
                    <div className="bg-[#0D1821] border border-[#2A4355] rounded-xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:border-none print:max-h-none print:bg-white print:m-0 print:w-full print:max-w-none">
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F3547] bg-[#142433] print:hidden">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                                <Printer size={18} />
                                <span>{orderType === 'TASTING' ? 'XEM TRƯỚC PHIẾU ĐƠN HÀNG TASTING (PRINT PREVIEW)' : 'XEM TRƯỚC PHIẾU ĐƠN BÁN HÀNG (PRINT PREVIEW)'}</span>
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
                        <div className="p-0 bg-white text-black font-sans w-full h-full overflow-y-auto print:overflow-visible">
                            <div className="max-w-[850px] mx-auto p-8 sm:p-12 print:p-0 print:max-w-none">
                                {/* Print Header - Clean Company Info */}
                                <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-3">
                                    <div>
                                        <h2 className="font-bold text-xs text-slate-900 uppercase tracking-wide">
                                            {entities.find(e => e.id === legalEntityId)?.name || "CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN"}
                                        </h2>
                                        <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                                            Địa chỉ: {(entities.find(e => e.id === legalEntityId) as any)?.address || "Số 10 ngõ 52 Giang Văn Minh, Phường Đội Cấn, Q. Ba Đình, TP. Hà Nội"}<br />
                                            MST: {(entities.find(e => e.id === legalEntityId) as any)?.taxId || "0316123456"} &nbsp;|&nbsp; 
                                            SĐT: {(entities.find(e => e.id === legalEntityId) as any)?.phone || "024.3933.8888"} &nbsp;|&nbsp; 
                                            Email: {(entities.find(e => e.id === legalEntityId) as any)?.email || "orders@lyscellars.com"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5 text-black">
                                            {orderType === 'TASTING' ? 'ĐƠN HÀNG TASTING' : 'ĐƠN BÁN HÀNG'}
                                        </h1>
                                        <p className="text-xs font-bold font-mono text-slate-900">DỰ THẢO</p>
                                        <p className="text-[9px] text-slate-600 mt-0.5">Ngày lập: {new Date().toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                                {/* Customer & Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-3 text-xs leading-tight">
                                    <div>
                                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Thông tin khách hàng</h3>
                                        <table className="w-full text-[10px]">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Khách hàng:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{selectedCustomer?.name}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Mã KH:</td>
                                                    <td className="font-mono text-slate-900 py-0.5">{selectedCustomer?.code}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">SĐT liên hệ:</td>
                                                    <td className="font-semibold font-mono text-slate-900 py-0.5">
                                                        {selectedCustomer?.purchasingPhone || (selectedCustomer as any)?.contacts?.find((c: any) => c.isPrimary)?.phone || (selectedCustomer as any)?.contacts?.[0]?.phone || '—'}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Phân kênh:</td>
                                                    <td className="py-0.5 text-slate-900">{channel || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Mã số thuế:</td>
                                                    <td className="font-mono text-slate-900 py-0.5">{selectedCustomer?.taxId || (selectedCustomer as any)?.parent?.taxId || '—'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div>
                                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">Thông tin giao nhận</h3>
                                        <table className="w-full text-[10px]">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Người nhận:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{selectedCustomer?.receiverName || selectedCustomer?.name}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">SĐT nhận hàng:</td>
                                                    <td className="font-bold font-mono text-slate-900 py-0.5">
                                                        {selectedCustomer?.receiverPhone || selectedCustomer?.purchasingPhone || (selectedCustomer as any)?.contacts?.find((c: any) => c.isPrimary)?.phone || '—'}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Địa chỉ giao:</td>
                                                    <td className="py-0.5 text-slate-900">{selectedCustomer?.addresses?.find(a => a.id === shippingAddressId)?.address || selectedCustomer?.addresses?.[0]?.address || 'Nhận tại kho'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Sales Rep:</td>
                                                    <td className="py-0.5 text-slate-900">Tài khoản của bạn</td>
                                                </tr>

                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Thanh toán:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{paymentTerm}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Ghi chú / Diễn giải đơn hàng & Lưu ý giao hàng */}
                                {((selectedCustomer as any)?.deliveryNotes || notes) && (
                                    <div className="mb-3 text-[10px] p-2 bg-slate-50 border border-slate-300 rounded leading-relaxed space-y-1">
                                        {(selectedCustomer as any)?.deliveryNotes && (
                                            <div>
                                                <span className="font-bold text-amber-900 uppercase">📦 Lưu ý giao hàng: </span>
                                                <span className="text-slate-900 font-medium">{(selectedCustomer as any).deliveryNotes}</span>
                                            </div>
                                        )}
                                        {notes && (
                                            <div>
                                                <span className="font-bold text-slate-900 uppercase">Ghi chú / Diễn giải: </span>
                                                <span className="text-slate-800 italic">{notes}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Product Lines Table - WHITE HEADER WITH BLACK TEXT */}
                                <table className="w-full text-[10px] mb-3 border-collapse border border-slate-300">
                                    <thead>
                                        <tr className="bg-white text-black font-bold border-b-2 border-slate-800">
                                            <td className="px-2 py-1.5 text-center w-8 border-r border-slate-300">STT</td>
                                            <td className="px-2 py-1.5 w-24 border-r border-slate-300">Mã AX</td>
                                            <td className="px-2 py-1.5 border-r border-slate-300">Tên sản phẩm</td>
                                            <td className="px-2 py-1.5 text-right w-10 border-r border-slate-300">SL</td>
                                            <td className="px-2 py-1.5 text-right w-24 border-r border-slate-300">Đơn giá</td>
                                            <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">CK %</td>
                                            <td className="px-2 py-1.5 text-right w-28">Thành tiền</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lines.map((l, idx) => {
                                            const p = products.find(prod => prod.id === l.productId)
                                            const lineVal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100)

                                            return (
                                                <tr key={idx} className="border-b border-slate-200 align-middle">
                                                    <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{idx + 1}</td>
                                                    <td className="px-2 py-1.5 font-mono font-semibold text-[10px] text-slate-900 border-r border-slate-200">{p?.skuCode}</td>
                                                    <td className="px-2 py-1.5 border-r border-slate-200">
                                                        <div className="font-semibold text-slate-900 leading-tight">{p?.productName}</div>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-slate-900 border-r border-slate-200">{l.qtyOrdered}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-900 border-r border-slate-200">{formatVND(l.unitPrice)}</td>
                                                    <td className="px-2 py-1.5 text-center font-mono text-slate-600 tabular-nums border-r border-slate-200">{l.lineDiscountPct > 0 ? `${l.lineDiscountPct}%` : '—'}</td>
                                                    <td className="px-2 py-1.5 text-right font-mono font-bold tabular-nums text-slate-900">{formatVND(lineVal)}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                {/* Totals Section */}
                                <div className="flex justify-end mb-3 break-inside-avoid print:break-inside-avoid">
                                    <table className="w-80 text-[11px] border-collapse">
                                        <tbody>
                                            <tr className="border-b border-slate-200 font-semibold">
                                                <td className="py-1 text-slate-700">Tổng số lượng hàng hóa:</td>
                                                <td className="py-1 text-right font-mono font-bold text-slate-900 tabular-nums">
                                                    {lines.reduce((sum, item) => sum + Number(item.qtyOrdered), 0)} chai
                                                </td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1 text-slate-600">Cộng tiền hàng (chưa VAT):</td>
                                                <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(subtotal)}</td>
                                            </tr>
                                            {orderDiscount > 0 && (
                                                <tr className="border-b border-slate-200">
                                                    <td className="py-1 text-slate-600">Chiết khấu đơn ({orderDiscount}%):</td>
                                                    <td className="py-1 text-right font-mono text-red-600 tabular-nums">-{formatVND(subtotal * (orderDiscount / 100))}</td>
                                                </tr>
                                            )}
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1 text-slate-600">Thuế VAT:</td>
                                                <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(vatAmount)}</td>
                                            </tr>
                                            <tr className="font-bold border-t-2 border-black">
                                                <td className="py-1.5 text-slate-900 text-xs">Tổng cộng thanh toán:</td>
                                                <td className="py-1.5 text-right font-mono text-xs tabular-nums text-black">{formatVND(finalTotal)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Bank Account Details - ONLY FOR COD ORDERS */}
                                {(paymentTerm === 'COD' || paymentTerm?.toUpperCase().includes('COD')) && (
                                    <div className="border border-slate-200 rounded p-2.5 mb-3 bg-slate-50 text-[10px] leading-relaxed break-inside-avoid print:break-inside-avoid">
                                        <p className="font-bold text-slate-700 uppercase mb-1 text-[9px]">Thông tin chuyển khoản thanh toán (COD):</p>
                                        <table className="w-full">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-500 w-20 py-0.5">Chủ tài khoản:</td>
                                                    <td className="font-semibold text-slate-800 py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankAccountName || "CÔNG TY TNHH LY'S CELLARS"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-500 py-0.5">Số tài khoản:</td>
                                                    <td className="font-semibold font-mono text-slate-800 py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankAccountNumber || "1023456789"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-500 py-0.5">Ngân hàng:</td>
                                                    <td className="text-slate-800 font-semibold py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankName || "Vietcombank (VCB) - Chi nhánh TP. Hồ Chí Minh"}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Signatures */}
                                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-2 border-t border-dashed border-slate-300 pb-4 break-inside-avoid print:break-inside-avoid">
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Sale Admin duyệt</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Kế toán kiểm soát</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Thủ kho</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Người nhận hàng</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(Ký, ghi rõ họ tên)</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

