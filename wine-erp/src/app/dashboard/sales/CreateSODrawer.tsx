'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Badge, Button, Drawer } from '@/components/ui'
import { X, Plus, Trash2, AlertCircle, Loader2, Save, CheckCircle2, Tag, ShieldAlert, Printer, Eye, Search, Building2, Star, ChevronDown, History, FileText, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import {
    getCustomersForSO, getProductsWithStock, getCustomerARBalance,
    createSalesOrder, SOCreateInput, SalesChannel, SOType,
    getProductPricesForChannel, getActiveAllocationsForProducts,
    getLegalEntities, LegalEntityRow, getApprovedProposalsForSO, getProposalWithItemsForSO,
    getCustomerProductCodes,
} from './actions'
import { formatVND, getLocalDateString } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import { SALES_I18N, getSOChannelLabel, getPriceBadgeLabelByLocale } from './i18n'
import { getCustomerResolvedPrices, ResolvedPrice } from '@/app/dashboard/price-list/customer-rules-actions'
import { useQuery } from '@tanstack/react-query'
import { DebouncedInput, DebouncedTextarea } from '@/components/DebouncedInput'

const CHANNELS: { value: SalesChannel; label: string }[] = [
    { value: 'HORECA', label: 'HORECA' },
    { value: 'WHOLESALE_DISTRIBUTOR', label: 'Äáº¡i LÃ½ / Wholesale' },
    { value: 'VIP_RETAIL', label: 'VIP Retail' },
    { value: 'DIRECT_INDIVIDUAL', label: 'Trá»±c Tiáº¿p' },
]

const getPriceBadgeStyle = (source: string) => {
    switch (source) {
        case 'SPECIAL_PRICE':
            return { background: 'rgba(180,83,9,0.15)', color: '#B45309', border: '1px solid rgba(180,83,9,0.3)' }
        case 'FIXED_PRICE':
            return { background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }
        case 'FIXED_DISCOUNT':
            return { background: 'rgba(230,138,0,0.15)', color: '#E68A00', border: '1px solid rgba(230,138,0,0.3)' }
        case 'CHANNEL_BASE':
            return { background: 'rgba(21,128,61,0.1)', color: '#15803D', border: '1px solid rgba(21,128,61,0.2)' }
        case 'RETAIL_FALLBACK':
            return { background: 'rgba(138,180,248,0.1)', color: '#8AB4F8', border: '1px solid rgba(138,180,248,0.2)' }
        default:
            return { background: 'rgba(100,116,139,0.1)', color: '#64748B', border: '1px solid rgba(100,116,139,0.2)' }
    }
}

const getPriceBadgeLabel = (resolved: any, defaultChannel: string) => {
    switch (resolved.source) {
        case 'SPECIAL_PRICE':
            return 'GiÃ¡ Äáº·c Biá»‡t (Campaign)'
        case 'FIXED_PRICE':
            return 'GiÃ¡ Cá»‘ Äá»‹nh RiÃªng'
        case 'FIXED_DISCOUNT':
            return `Chiáº¿t Kháº¥u Cá»‘ Äá»‹nh (-${resolved.discountPct}%)`
        case 'CHANNEL_BASE':
            return `GiÃ¡ KÃªnh ${defaultChannel}`
        case 'RETAIL_FALLBACK':
            return 'GiÃ¡ BÃ¡n Láº» Máº·c Äá»‹nh'
        default:
            return 'GiÃ¡ Máº·c Äá»‹nh'
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
interface ProductItem { id: string; skuCode: string; productName: string; wineType: string; country: string; totalStock: number; salesStockByEntity?: Record<string, number>; totalStockByEntity?: Record<string, number>; vatRate?: number; wholesalePrice?: number; retailPrice?: number }
interface SOLine { productId: string; productName: string; skuCode: string; qtyOrdered: number; unitPrice: number; lineDiscountPct: number; stock: number; priceSource?: string | null; vatRate?: number; customerItemCode?: string | null }

const inputStyle = {
    background: '#FFFFFF',
    border: '1px solid #CBD5E1',
    color: '#0F172A',
    borderRadius: '4px',
    outline: 'none',
}

const OVERRIDE_ROLES = ['CEO', 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'Káº¿ ToÃ¡n', 'KE_TOAN', 'Trá»£ LÃ½', 'TRO_LY']

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
    const { locale, isEn, formatCurrency } = useAppLocale()
    const t = SALES_I18N[locale].createDrawer

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
                    name: `\u00A0\u00A0\u00A0â†³ ${child.name}`
                })
            })
        })

        const childIds = result.map(r => r.id)
        const orphans = customers.filter(c => c.parentId && !childIds.includes(c.id))
        orphans.forEach(child => {
            result.push({
                ...child,
                name: `\u00A0\u00A0\u00A0â†³ ${child.name}`
            })
        })

        return result
    }, [customers])

    const [orderDate, setOrderDate] = useState(() => getLocalDateString())
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
    const [customerCodesMap, setCustomerCodesMap] = useState<Record<string, string>>({})
    const hasCustomerCodes = useMemo(() => Object.keys(customerCodesMap).length > 0 || lines.some(l => Boolean(l.customerItemCode)), [customerCodesMap, lines])

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
            const custCode = customerCodesMap[p.id]
            if (
                p.productName.toLowerCase().includes(q) || 
                p.skuCode.toLowerCase().includes(q) ||
                (custCode && custCode.toLowerCase().includes(q))
            ) {
                results.push(p)
                if (results.length >= 20) break
            }
        }
        return results
    }, [products, customerCodesMap])

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
                        setNotes(`ÄÆ¡n Tasting kÃ¨m Tá» trÃ¬nh ${prop.proposalNo}: ${prop.title}`)
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
                            toast.success(`âœ¨ Tá»± Ä‘á»™ng náº¡p ${loadedLines.length} sáº£n pháº©m theo Tá» trÃ¬nh ${prop.proposalNo}`)
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
                setCustomerSearchInput(`[${found.code}] ${found.name.replace(/^\u00A0\u00A0\u00A0â†³\s*/, '')}`)
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

    const selectedEntityCode = useMemo(() => {
        const ent = entities.find(e => e.id === legalEntityId || e.code === legalEntityId)
        return ent?.code || ''
    }, [entities, legalEntityId])

    const getProductStock = useCallback((p: ProductItem | undefined, entityId: string) => {
        if (!p) return 0
        if (entityId && p.salesStockByEntity) {
            if (p.salesStockByEntity[entityId] !== undefined) {
                return p.salesStockByEntity[entityId]
            }
            const entity = entities.find(e => e.id === entityId || e.code === entityId)
            if (entity && p.salesStockByEntity[entity.id] !== undefined) {
                return p.salesStockByEntity[entity.id]
            }
            if (entity && p.salesStockByEntity[entity.code] !== undefined) {
                return p.salesStockByEntity[entity.code]
            }
            return 0
        }
        return p.totalStock ?? 0
    }, [entities])

    // Synchronize lines stock whenever legalEntityId changes or products load
    useEffect(() => {
        if (products.length > 0 && lines.length > 0) {
            setLines(prev => prev.map(l => {
                if (!l.productId) return l
                const p = products.find(prod => prod.id === l.productId)
                const effectiveStock = getProductStock(p, legalEntityId)
                if (l.stock === effectiveStock) return l
                return { ...l, stock: effectiveStock }
            }))
        }
    }, [legalEntityId, products, getProductStock])

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
            console.error("Lá»—i load báº£ng giÃ¡:", err)
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
            
            // Parallelize balance, customer prices, and customer product codes fetch
            const [bal, resolvedPrices, codesRes] = await Promise.all([
                getCustomerARBalance(id),
                getCustomerResolvedPrices(id),
                getCustomerProductCodes(id).catch(() => ({ map: {}, reverseMap: {}, list: [] }))
            ])
            
            setArBalance(bal)
            setLoadingAR(false)
            setPriceMap(resolvedPrices)
            setCustomerCodesMap(codesRes.map || {})
            
            // Auto-update existing lines to resolved prices and customer item codes
            setLines(prev => prev.map(l => {
                if (!l.productId) return l
                const resolved = resolvedPrices[l.productId]
                const custCode = (codesRes.map as Record<string, string>)?.[l.productId] || l.customerItemCode
                if (resolved && resolved.price > 0) {
                    return { ...l, unitPrice: resolved.price, lineDiscountPct: 0, priceSource: resolved.source, customerItemCode: custCode }
                }
                return { ...l, customerItemCode: custCode }
            }))
        } else {
            setCustomerCodesMap({})
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
        setLines(prev => {
            return prev.map((l, idx) => {
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
                    
                    const custCode = customerCodesMap[value] || null
                    // Update search query display
                    setSearchQueries(prevQueries => ({
                        ...prevQueries,
                        [i]: custCode ? `[${custCode} | ${p.skuCode}] ${p.productName}` : `[${p.skuCode}] ${p.productName}`
                    }))

                    const prodVat = p?.vatRate !== undefined ? Number(p.vatRate) : 10
                    const prodStock = getProductStock(p, legalEntityId)
                    return { ...l, productId: value, productName: p.productName, skuCode: p.skuCode, stock: prodStock, unitPrice, lineDiscountPct: 0, priceSource, vatRate: prodVat, customerItemCode: custCode }
                }
                return { ...l, [field]: value }
            })
        })
    }

    const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i))

    const isVatInclusive = channel === 'RETAIL' || channel === 'DIRECT_INDIVIDUAL' || (channel as string) === 'POS'

    const subtotal = lines.reduce((sum, l) => {
        const line = l.qtyOrdered * l.unitPrice
        return sum + line - line * (l.lineDiscountPct / 100)
    }, 0)

    const { netSubtotal, vatAmount, finalTotal, vatBreakdown } = useMemo(() => {
        const discountMultiplier = 1 - orderDiscount / 100
        const map: Record<number, { amount: number; rate: number }> = {}
        let net = 0
        let vat = 0

        for (const l of lines) {
            if (!l.productId) continue
            const rate = l.vatRate ?? 10
            const lineVal = l.qtyOrdered * l.unitPrice * (1 - l.lineDiscountPct / 100) * discountMultiplier

            if (isVatInclusive) {
                const lineNet = lineVal / (1 + rate / 100)
                const lineVat = lineVal - lineNet
                net += lineNet
                vat += lineVat
                if (!map[rate]) map[rate] = { amount: 0, rate }
                map[rate].amount += lineVat
            } else {
                const lineNet = lineVal
                const lineVat = lineNet * (rate / 100)
                net += lineNet
                vat += lineVat
                if (!map[rate]) map[rate] = { amount: 0, rate }
                map[rate].amount += lineVat
            }
        }

        const payable = isVatInclusive
            ? subtotal * discountMultiplier
            : net + vat

        return {
            netSubtotal: Math.round(net),
            vatAmount: Math.round(vat),
            finalTotal: Math.round(payable),
            vatBreakdown: Object.values(map).sort((a, b) => a.rate - b.rate)
        }
    }, [lines, orderDiscount, isVatInclusive, subtotal])

    const effectiveCreditLimit = selectedCustomer
        ? (selectedCustomer.parentId && Number(selectedCustomer.creditLimit) === 0 && selectedCustomer.parent)
            ? Number(selectedCustomer.parent.creditLimit)
            : Number(selectedCustomer.creditLimit)
        : 0
    const creditAvailable = selectedCustomer ? effectiveCreditLimit - arBalance : 0
    const isCreditHold = selectedCustomer?.creditHold || (selectedCustomer?.parent?.creditHold ?? false)
    const creditWarning = selectedCustomer && (finalTotal > creditAvailable || isCreditHold)

    const handleSave = async () => {
        if (!customerId) return toast.error(isEn ? 'Please select a customer' : 'Vui lÃ²ng chá»n khÃ¡ch hÃ ng')
        if (!legalEntityId) return toast.error(isEn ? 'Please select a legal entity' : 'Vui lÃ²ng chá»n phÃ¡p nhÃ¢n xuáº¥t tuyáº¿n')
        if (lines.length === 0) return toast.error(isEn ? 'Add at least 1 product' : 'ThÃªm Ã­t nháº¥t 1 sáº£n pháº©m')
        if (lines.some(l => !l.productId)) return toast.error(isEn ? 'Please select a product for all lines' : 'Vui lÃ²ng chá»n sáº£n pháº©m cho táº¥t cáº£ cÃ¡c dÃ²ng')

        setSaving(true)
        const promise = createSalesOrder({
            orderDate,
            customerId,
            salesRepId: userId || 'SYSTEM',
            channel,
            orderType,
            proposalId: proposalId || undefined,
            paymentTerm: orderType === 'TASTING' ? (paymentTerm || 'TASTING - KhÃ´ng thu tiá»n') : paymentTerm,
            orderDiscount: orderType === 'TASTING' ? 0 : orderDiscount,
            notes,
            lines: lines.map(l => ({
                productId: l.productId,
                qtyOrdered: l.qtyOrdered,
                unitPrice: orderType === 'TASTING' ? 0 : l.unitPrice,
                lineDiscountPct: l.lineDiscountPct,
                vatRate: l.vatRate ?? 10,
                priceSource: orderType === 'TASTING' ? 'TASTING_FREE' : (l.priceSource || undefined),
                customerItemCode: l.customerItemCode || customerCodesMap[l.productId] || undefined,
            })),
            legalEntityId,
            shippingAddressId: shippingAddressId || undefined,
        } as SOCreateInput).then(res => {
            if (!res.success) throw new Error(res.error ?? (isEn ? 'An error occurred' : 'CÃ³ lá»—i xáº£y ra'))
            return res
        })

        toast.promise(promise, {
            loading: isEn ? 'Creating sales order...' : 'Äang táº¡o Ä‘Æ¡n hÃ ng...',
            success: (result) => {
                setTimeout(() => { onSaved(result.soId); resetForm() }, 500)
                return isEn ? `Successfully created ${result.soNo}` : `Táº¡o thÃ nh cÃ´ng ${result.soNo}`
            },
            error: (err: any) => `${isEn ? 'Error:' : 'Lá»—i:'} ${err.message}`,
            finally: () => setSaving(false)
        })
    }

    const resetForm = () => {
        setOrderDate(getLocalDateString())
        setCustomerId(''); setSelectedCustomer(null); setChannel('HORECA')
        setPaymentTerm('NET30'); setOrderDiscount(0); setLines([])
        setOrderType('STANDARD'); setProposalId('')
        setArBalance(0); setPriceMap({}); setLegalEntityId(''); setSearchQueries({})
        setNotes(''); setOverrideMode(false)
        setShippingAddressId('')
        setCustomerSearchInput('')
        setCustomerDropdownOpen(false)
        setCustomerCodesMap({})
    }

    if (!open) return null

    return (
        <>
            <Drawer
                open
                onClose={() => (previewOpen ? setPreviewOpen(false) : onClose())}
                size="xl"
                className="bg-lys-bg"
                title={orderType === 'TASTING' ? t.tastingTitle : t.title}
                headerExtra={
                    <Badge tone={orderType === 'TASTING' ? 'warning' : 'neutral'}>
                        {orderType === 'TASTING' ? 'TASTING' : 'STANDARD'}
                    </Badge>
                }
                description={t.subtitle}
                footer={
                    <>
                        <Button
                            variant="secondary"
                            className="mr-auto"
                            title={t.previewPrintHint}
                            onClick={() => {
                                if (!selectedCustomer) {
                                    toast.error(t.selectCustomerForPrint)
                                    return
                                }
                                if (lines.length === 0 || lines.every(l => !l.productId)) {
                                    toast.error(t.selectProductForPrint)
                                    return
                                }
                                setPreviewOpen(true)
                            }}
                        >
                            <Printer size={15} aria-hidden /> {t.previewPrint}
                        </Button>
                        <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
                        <Button onClick={handleSave} loading={saving} disabled={saving}>
                            {!saving && <Save size={14} aria-hidden />}
                            {saving ? t.saving : t.createOrderBtn(orderType === 'TASTING')}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    {loadingData && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} />
                        </div>
                    )}

                    {!loadingData && (
                        <>
                            {/* Order Type Selector: Commercial vs Tasting */}
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{t.orderTypeLabel}</span>
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
                                            ðŸ“¦ {t.commercialOrder}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrderType('TASTING')
                                                setPaymentTerm('TASTING - KhÃ´ng thu tiá»n')
                                                setLines(prev => prev.map(l => ({ ...l, unitPrice: 0 })))
                                            }}
                                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                orderType === 'TASTING'
                                                    ? 'bg-amber-600 text-white shadow border border-amber-700 ring-2 ring-amber-500/30'
                                                    : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-400'
                                            }`}
                                        >
                                            ðŸ· {t.tastingOrder}
                                        </button>
                                    </div>
                                </div>

                                {orderType === 'TASTING' && (
                                    <span className="text-[11px] text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-md flex items-center gap-1 font-semibold shadow-xs">
                                        âœ¨ {t.tastingBanner}
                                    </span>
                                )}
                            </div>

                            {/* Proposal Selector for Tasting Orders */}
                            {orderType === 'TASTING' && (
                                <div className="p-4 rounded-xl border-2 border-amber-400/90 bg-amber-50/95 shadow-md space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-1">
                                        <label className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                            <FileText size={16} className="text-amber-800" />
                                            {t.tastingProposalTitle}
                                        </label>
                                        <span className="text-[11px] font-bold text-amber-900 bg-amber-200/60 px-2.5 py-0.5 rounded-full border border-amber-300">
                                            {t.tastingProposalBasis}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        {/* Field 1: Choose Proposal */}
                                        <div className="md:col-span-6">
                                            <label className="block text-[11px] font-black uppercase text-amber-950 mb-1">
                                                {t.chooseProposalLabel}
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
                                                            setNotes(`ÄÆ¡n Tasting kÃ¨m Tá» trÃ¬nh ${fullProp.proposalNo}: ${fullProp.title}`)
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
                                                                toast.success(t.autoLoadedProposalItems(loadedLines.length, fullProp.proposalNo))
                                                            }
                                                        }
                                                    } catch (err) {
                                                        console.error(err)
                                                    }
                                                }}
                                                className="w-full px-3 py-2 text-xs font-bold rounded-lg border-2 border-amber-400 bg-white text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                <option value="" className="text-slate-500 font-normal">{t.chooseProposalPlaceholder}</option>
                                                {proposals.map(p => (
                                                    <option key={p.id} value={p.id} className="text-slate-900 font-medium">
                                                        [{p.proposalNo}] {p.title} ({p.customer ? p.customer.name : (isEn ? 'General' : 'Chung')})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Field 2: Sá» Tá»œ TRÃŒNH (Explicit dedicated field) */}
                                        <div className="md:col-span-6">
                                            <label className="block text-[11px] font-black uppercase text-amber-950 mb-1">
                                                {t.proposalNoLabel}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    placeholder={t.proposalNoPlaceholder}
                                                    value={proposals.find(p => p.id === proposalId)?.proposalNo || (proposalId ? proposalId : '')}
                                                    className="w-full px-3 py-2 text-xs font-extrabold font-mono rounded-lg border-2 border-amber-400 bg-amber-100/90 text-amber-950 placeholder:text-amber-700/60 shadow-xs focus:outline-none"
                                                />
                                                {proposalId && (
                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded border border-emerald-400">
                                                        {t.proposalLinkedBadge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Field 3: Notes / Note Details */}
                                        <div className="md:col-span-12">
                                            <DebouncedInput
                                                placeholder={t.proposalNotesPlaceholder}
                                                value={notes}
                                                onChange={setNotes}
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
                                        <label className="block text-[11px] font-bold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                            {t.customerLabel}
                                        </label>
                                        {selectedCustomer && (
                                            <a href="/dashboard/crm" target="_blank" className="text-[10px] text-[#0891B2] hover:text-[#06748E] font-semibold hover:underline flex items-center gap-1 transition-colors" title={isEn ? "Open CRM to view customer purchase history" : "Má»Ÿ tab CRM Ä‘á»ƒ xem lá»‹ch sá»­ mua hÃ ng chi tiáº¿t"}>
                                                <History size={10} />
                                                {t.purchaseHistory}
                                            </a>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className={`relative flex items-center w-full rounded-md border-2 transition-all ${customerDropdownOpen ? 'border-teal-500 ring-4 ring-teal-500/10' : 'border-slate-200 hover:border-slate-300'} bg-white`}>
                                            <div className="pl-3 text-slate-400">
                                                <Search size={16} />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder={t.searchCustomerPlaceholder}
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
                                                className="w-full pl-3 pr-10 py-2 text-sm font-semibold text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                                                style={{ color: '#0F172A' }}
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
                                                    className="absolute right-2 p-1.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-md transition-colors"
                                                    title={t.clearCustomer}
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
                                            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg bg-white border border-slate-200 shadow-xl py-1 divide-y divide-slate-100">
                                                {filteredCustomers.length === 0 ? (
                                                    <div className="px-4 py-3 text-xs text-slate-400 text-center">
                                                        {t.noCustomerFound}
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
                                                                        toast.error(t.companyDebtOnlyError)
                                                                        return
                                                                    }
                                                                    handleCustomerChange(c.id)
                                                                    setCustomerSearchInput(`[${c.code}] ${c.name}`)
                                                                    setCustomerDropdownOpen(false)
                                                                }}
                                                                className={`px-3.5 py-2.5 cursor-pointer transition-colors ${isDisabled ? 'bg-slate-50 opacity-60 cursor-not-allowed' : isSelected ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${isDisabled ? 'bg-slate-200 text-slate-500' : 'bg-teal-100 text-teal-700'}`}>
                                                                                {c.code}
                                                                            </span>
                                                                            <span className={`font-semibold text-sm ${isDisabled ? 'text-slate-400' : isSelected ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                                                                                {c.name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                                                                            {isCompany && (
                                                                                <span className={`flex items-center gap-1 font-medium ${isDisabled ? 'text-slate-400' : 'text-sky-600'}`}>
                                                                                    <Building2 size={12} />
                                                                                    {c.allowDirectSO ? t.company : t.parentCompanyOnly}
                                                                                </span>
                                                                            )}
                                                                            {c.brandGroup && (
                                                                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                                                                    <Star size={12} className="fill-amber-400/50" />
                                                                                    {c.brandGroup}
                                                                                </span>
                                                                            )}
                                                                            {c.channel && (
                                                                                <span className="text-slate-500 font-medium border-l border-slate-200 pl-2 ml-1">
                                                                                    {getSOChannelLabel(c.channel, locale, true)}
                                                                                </span>
                                                                            )}
                                                                            {(c.taxId || (c as any).parent?.taxId) && (
                                                                                <span className="text-slate-500 font-mono text-[11px] border-l border-slate-200 pl-2 ml-1">
                                                                                    MST: {c.taxId || `${(c as any).parent?.taxId} (${isEn ? 'Parent Co' : 'Cty Cha'})`}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && (
                                                                        <div className="shrink-0 text-teal-600 mt-1">
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
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>
                                        {t.shippingAddressLabel}
                                    </label>
                                    {!selectedCustomer ? (
                                        <div className="w-full px-3 py-2 text-xs rounded border border-slate-200 text-gray-500 bg-slate-50/40">
                                            {t.noCustomerSelected}
                                        </div>
                                    ) : (!selectedCustomer.addresses || selectedCustomer.addresses.length === 0) ? (
                                        <div className="px-3 py-2 text-xs bg-red-950/20 border border-red-500/20 text-red-700 rounded">
                                            {t.noShippingAddress}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <select
                                                value={shippingAddressId}
                                                onChange={e => setShippingAddressId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs outline-none rounded"
                                                style={{ ...inputStyle }}
                                            >
                                                <option value="">{t.selectAddressPlaceholder}</option>
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
                                    <label className="block text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>
                                        ðŸ“… {t.orderDateLabel}
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
                                <div className="flex flex-col gap-2 p-2 rounded-md" style={{ background: '#FFFFFF/60', border: '1px solid #E2E8F0' }}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold" style={{ color: creditWarning ? '#B91C1C' : '#15803D' }}>
                                                {isCreditHold ? t.creditHold : creditWarning ? t.creditOver : t.creditOk}
                                            </span>
                                            <span style={{ color: '#64748B' }}>{t.creditLimit} <strong className="font-mono text-slate-800">{formatCurrency(effectiveCreditLimit)}</strong></span>
                                            <span style={{ color: '#64748B' }}>{t.arBalance} <strong className="font-mono text-amber-700">{loadingAR ? '...' : formatCurrency(arBalance)}</strong></span>
                                            <span style={{ color: '#64748B' }}>{t.creditAvailable} <strong className="font-mono" style={{ color: creditWarning ? '#B91C1C' : '#0D9488' }}>{formatCurrency(Math.max(0, creditAvailable))}</strong></span>
                                        </div>
                                        {canOverride && (
                                            <button onClick={() => setOverrideMode(!overrideMode)} className="text-[10px] px-1.5 py-0.5 rounded transition-all" style={{ color: '#B45309', border: '1px solid rgba(180,83,9,0.3)', background: 'rgba(180,83,9,0.08)' }}>
                                                {overrideMode ? t.done : t.editInfo}
                                            </button>
                                        )}
                                    </div>
                                    <div className="h-px w-full bg-slate-200" />
                                    {!overrideMode ? (
                                        <div className="flex items-center gap-4 text-[11px] text-slate-600">
                                            <span>{t.channelLabel} <strong className="text-slate-900">{getSOChannelLabel(channel, locale)}</strong></span>
                                            <span>{t.paymentLabel} <strong className="text-slate-900">{paymentTerm}</strong></span>
                                            <span>{t.entityLabel} <strong className="text-slate-900" title={entities.find(e => e.id === legalEntityId)?.name}>{entities.find(e => e.id === legalEntityId)?.code ?? t.defaultEntity}</strong></span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-2">
                                            <select value={channel} onChange={e => handleChannelChange(e.target.value as SalesChannel)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                {CHANNELS.map(c => <option key={c.value} value={c.value}>{getSOChannelLabel(c.value, locale)}</option>)}
                                            </select>
                                            <select value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                {['COD', 'NET7', 'NET14', 'NET30', 'NET45', 'NET60', 'PREPAID', 'EOM_10', 'EOM_15'].map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <select value={legalEntityId} onChange={e => setLegalEntityId(e.target.value)} className="w-full px-1.5 py-1 text-[11px] outline-none rounded" style={{ ...inputStyle }}>
                                                <option value="">{t.selectEntityPlaceholder}</option>
                                                {entities.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Diá»…n giáº£i Ä‘Æ¡n hÃ ng */}
                            <div>
                                <DebouncedTextarea
                                    value={notes}
                                    onChange={setNotes}
                                    placeholder={t.notesPlaceholder}
                                    rows={1}
                                    className="w-full px-3 py-1.5 text-xs outline-none rounded"
                                    style={{ ...inputStyle }}
                                />
                            </div>

                            {/* SO Lines */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                                        {t.productsLabel}
                                    </label>
                                    <button onClick={addLine}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold transition-all"
                                        style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)', borderRadius: '4px' }}>
                                        <Plus size={13} /> {t.addLine}
                                    </button>
                                </div>

                                {lines.length === 0 ? (
                                    <div className="py-8 text-center rounded-md" style={{ border: '1px dashed #E2E8F0' }}>
                                        <p className="text-sm" style={{ color: '#64748B' }}>{t.noProductsYet}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table View */}
                                        <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-md bg-white max-w-full" style={{ minHeight: '280px' }}>
                                            <table className="w-full text-xs text-left border-collapse" style={{ minWidth: '600px' }}>
                                                <thead>
                                                    <tr className="bg-white text-slate-500 border-b border-slate-200 font-semibold">
                                                        <th className="px-3 py-2.5" style={{ minWidth: '300px' }}>{t.thProduct}</th>
                                                        {hasCustomerCodes && (
                                                            <th className="px-3 py-2.5 w-24 text-center text-amber-500 font-bold">{t.thCustomerCode}</th>
                                                        )}
                                                        <th className="px-3 py-2.5 w-20 text-center">{t.thStock} {entities.find(e => e.id === legalEntityId)?.code ? `[${entities.find(e => e.id === legalEntityId)?.code}]` : ''}</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">{t.thQty}</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">{t.thUnitPrice}</th>
                                                        <th className="px-3 py-2.5 w-20 text-center">{t.thDiscount}</th>
                                                        <th className="px-3 py-2.5 w-28 text-right">{t.thTotal}</th>
                                                        <th className="px-3 py-2.5 w-10 text-center"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200/40">
                                                    {lines.map((line, i) => {
                                                        const lineTotal = line.qtyOrdered * line.unitPrice * (1 - line.lineDiscountPct / 100)
                                                        const lowStock = line.productId ? line.qtyOrdered > line.stock : false
                                                        const alloc = allocations.find(a => a.productId === line.productId)
                                                        const quotaExceeded = alloc && line.qtyOrdered > alloc.remaining
                                                        const resolved = priceMap[line.productId]
                                                        const hasAutoPrice = resolved !== undefined && resolved.source !== 'DEFAULT_ZERO'
                                                        return (
                                                            <tr key={i} className={`hover:bg-white/30 transition-colors ${lowStock || quotaExceeded ? 'bg-red-950/10' : ''}`}>
                                                                <td className="px-3 py-2 relative">
                                                                    <div className="relative">
                                                                        <input
                                                                            type="text"
                                                                            placeholder={t.searchProductPlaceholder}
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
                                                                            <div className="absolute left-0 mt-1 max-h-60 overflow-y-auto z-50 rounded bg-white border border-slate-200 w-[520px] shadow-xl">
                                                                                {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                                    <div className="px-3 py-2 text-xs text-slate-500">
                                                                                        {t.noProductFound}
                                                                                    </div>
                                                                                ) : (
                                                                                    getFilteredProducts(searchQueries[i] ?? '').map(p => (
                                                                                        <div
                                                                                            key={p.id}
                                                                                            onMouseDown={() => {
                                                                                                updateLine(i, 'productId', p.id)
                                                                                                setActiveDropdownIndex(null)
                                                                                            }}
                                                                                            className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 transition-colors text-left flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0"
                                                                                        >
                                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                {customerCodesMap[p.id] && (
                                                                                                    <span className="font-bold font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 text-[10px] shrink-0">
                                                                                                        [{customerCodesMap[p.id]}]
                                                                                                    </span>
                                                                                                )}
                                                                                                <span className="font-bold text-teal-600 shrink-0">[{p.skuCode}]</span>
                                                                                                <span className="font-medium text-slate-800 truncate">{p.productName}</span>
                                                                                            </div>
                                                                                            <span className="text-slate-500 text-[10px] whitespace-nowrap shrink-0">({isEn ? 'Stock' : 'Tá»“n'}: {getProductStock(p, legalEntityId)})</span>
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
                                                                                {alloc.campaignName}: {quotaExceeded ? `${isEn ? 'Exceeded' : 'VÆ°á»£t'}! ${isEn ? 'Left' : 'CÃ²n'} ${alloc.remaining}` : `${isEn ? 'Left' : 'CÃ²n'} ${alloc.remaining}`}
                                                                            </span>
                                                                        )}
                                                                        {hasAutoPrice && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                                                                style={getPriceBadgeStyle(resolved.source)}>
                                                                                <Tag size={10} /> {getPriceBadgeLabelByLocale(resolved, channel, locale)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {hasCustomerCodes && (
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className="font-mono font-bold text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                                            {line.customerItemCode || customerCodesMap[line.productId] || 'â€”'}
                                                                        </span>
                                                                    </td>
                                                                )}
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className={`font-semibold ${lowStock ? 'text-red-500' : 'text-slate-600'}`}>
                                                                        {line.productId ? line.stock : 'â€”'}
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
                                                                    {lowStock && <p className="text-[10px] text-red-500 mt-0.5">{t.stockExceeded}</p>}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">
                                                                    {formatCurrency(line.unitPrice)}
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
                                                                <td className="px-3 py-2 text-right font-mono font-bold text-[#0891B2]">
                                                                    {formatCurrency(lineTotal)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 p-1.5 rounded transition-all" type="button">
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
                                                        style={{ background: '#FFFFFF', border: `1px solid ${lowStock || quotaExceeded ? 'rgba(185,28,28,0.35)' : '#E2E8F0'}` }}>
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-1 relative">
                                                                <input
                                                                    type="text"
                                                                    placeholder={t.searchProductPlaceholder}
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
                                                                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 rounded-md shadow-xl border bg-white border-slate-200">
                                                                        {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                                            <div className="px-3 py-2 text-xs text-slate-500">
                                                                                {t.noProductFound}
                                                                            </div>
                                                                        ) : (
                                                                            getFilteredProducts(searchQueries[i] ?? '').map(p => (
                                                                                <div
                                                                                    key={p.id}
                                                                                    onMouseDown={() => {
                                                                                        updateLine(i, 'productId', p.id)
                                                                                        setActiveDropdownIndex(null)
                                                                                    }}
                                                                                    className="px-3 py-2 text-xs cursor-pointer hover:bg-slate-100 transition-colors text-left flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0"
                                                                                >
                                                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                        {customerCodesMap[p.id] && (
                                                                                            <span className="font-bold font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300 text-[10px] shrink-0">
                                                                                                [{customerCodesMap[p.id]}]
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="font-bold text-teal-600 shrink-0">[{p.skuCode}]</span>
                                                                                        <span className="font-medium text-slate-800 truncate">{p.productName}</span>
                                                                                    </div>
                                                                                    <span className="text-slate-500 text-[10px] whitespace-nowrap shrink-0">({isEn ? 'Stock' : 'Tá»“n'}: {getProductStock(p, legalEntityId)})</span>
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button onClick={() => removeLine(i)} style={{ color: '#B91C1C', padding: '8px' }} type="button">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>

                                                        {/* Allocation & Price badges */}
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {alloc && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                                                    style={{ background: quotaExceeded ? 'rgba(185,28,28,0.15)' : 'rgba(180,83,9,0.12)', color: quotaExceeded ? '#B91C1C' : '#B45309', border: `1px solid ${quotaExceeded ? 'rgba(185,28,28,0.3)' : 'rgba(180,83,9,0.25)'}` }}>
                                                                    <ShieldAlert size={11} />
                                                                    {alloc.campaignName}: {quotaExceeded ? `${isEn ? 'Exceeded' : 'VÆ°á»£t'}! ${isEn ? 'Left' : 'CÃ²n'} ${alloc.remaining}` : `${isEn ? 'Left' : 'CÃ²n'} ${alloc.remaining}`}
                                                                </span>
                                                            )}
                                                            {hasAutoPrice && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                                                    style={getPriceBadgeStyle(resolved.source)}>
                                                                    <Tag size={11} /> {getPriceBadgeLabelByLocale(resolved, channel, locale)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t.thQty}</p>
                                                                <input type="number" min="1" value={line.qtyOrdered}
                                                                    onChange={e => updateLine(i, 'qtyOrdered', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs outline-none"
                                                                    style={{ ...inputStyle, border: `1px solid ${lowStock ? 'rgba(185,28,28,0.5)' : '#E2E8F0'}` }}
                                                                />
                                                                {lowStock && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>âš ï¸ {t.stockExceeded} ({line.stock})</p>}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t.thUnitPrice}</p>
                                                                <input type="number" min="0" value={line.unitPrice}
                                                                    readOnly
                                                                    className="w-full px-2 py-1 text-xs outline-none opacity-70 cursor-not-allowed"
                                                                    style={{ ...inputStyle, background: 'rgba(20,36,51,0.5)' }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#64748B' }}>{t.thDiscount}</p>
                                                                <input type="number" min="0" max="100" value={line.lineDiscountPct}
                                                                    onChange={e => updateLine(i, 'lineDiscountPct', Number(e.target.value))}
                                                                    className="w-full px-2 py-1 text-xs outline-none"
                                                                    style={{ ...inputStyle }}
                                                                />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs mb-1" style={{ color: '#64748B' }}>VAT (%)</p>
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
                                                            <p className="text-xs font-bold" style={{ color: '#0891B2' }}>
                                                                = {formatCurrency(lineTotal)}
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
                                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-xs font-semibold" style={{ color: '#64748B' }}>{t.orderDiscountLabel}</label>
                                        <input type="number" min="0" max="100" value={orderDiscount}
                                            onChange={e => setOrderDiscount(Number(e.target.value))}
                                            className="w-24 px-2.5 py-1.5 text-sm outline-none text-right"
                                            style={{ ...inputStyle }}
                                        />
                                    </div>
                                    {isVatInclusive && (
                                        <div className="mb-2.5 px-2.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-700">
                                            <span>{t.vatInclusiveNotice(channel)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-xs text-slate-600 mb-1.5">
                                        <p>{isVatInclusive ? t.subtotalGoods : t.subtotalBeforeTax}</p>
                                        <p className="font-mono">{formatCurrency(isVatInclusive ? Math.round(subtotal * (1 - orderDiscount / 100)) : netSubtotal)}</p>
                                    </div>
                                    {isVatInclusive && (
                                        <div className="flex justify-between items-center text-xs text-slate-600 mb-1.5">
                                            <p>{t.subtotalPreTaxExtracted}</p>
                                            <p className="font-mono">{formatCurrency(netSubtotal)}</p>
                                        </div>
                                    )}
                                    {vatBreakdown.length > 1 ? (
                                        <div className="space-y-1 my-2 py-2 border-y border-slate-200/40 text-xs text-slate-600">
                                            {vatBreakdown.map(vb => (
                                                <div key={vb.rate} className="flex justify-between items-center pl-2">
                                                    <p>{isVatInclusive ? t.vatExtracted(vb.rate) : t.vatStandard(vb.rate)}</p>
                                                    <p className="font-mono">{formatCurrency(Math.round(vb.amount))}</p>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center font-semibold pt-1 text-slate-900">
                                                <p>{t.totalVat}</p>
                                                <p className="font-mono">{formatCurrency(vatAmount)}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center text-xs text-slate-600 mb-2.5">
                                            <p>{t.vatSingle(vatBreakdown[0]?.rate ?? 10, isVatInclusive)}</p>
                                            <p className="font-mono">{formatCurrency(vatAmount)}</p>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                                        <p className="text-sm font-semibold" style={{ color: '#475569' }}>{t.grandTotal}</p>
                                        <p className="text-xl font-bold" style={{ color: '#0891B2' }}>
                                            {formatCurrency(finalTotal)}
                                        </p>
                                    </div>
                                </div>
                            )}


                        </>
                    )}
                </div>
            </Drawer>

            {/* PRINT PREVIEW MODAL */}
            {previewOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal print:block print:p-0 print:bg-transparent">
                    <div className="bg-white border border-lys-border rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:shadow-none print:border-none print:max-h-none print:bg-white print:m-0 print:w-full print:max-w-none">
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white print:hidden">
                            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                                <Printer size={18} />
                                <span>{orderType === 'TASTING' ? t.printPreviewTastingTitle : t.printPreviewTitle}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => window.print()}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors shadow"
                                >
                                    <Printer size={14} /> {t.printExportPdf}
                                </button>
                                <button
                                    onClick={() => setPreviewOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-900 rounded bg-slate-50"
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
                                            {entities.find(e => e.id === legalEntityId)?.name || "CÃ”NG TY Cá»” PHáº¦N THÆ¯Æ NG Máº I THáº®NG Ã‚N"}
                                        </h2>
                                        <p className="text-[10px] text-slate-700 leading-snug mt-0.5">
                                            Äá»‹a chá»‰: {(entities.find(e => e.id === legalEntityId) as any)?.address || "Sá»‘ 10 ngÃµ 52 Giang VÄƒn Minh, PhÆ°á»ng Äá»™i Cáº¥n, Q. Ba ÄÃ¬nh, TP. HÃ  Ná»™i"}<br />
                                            MST: {(entities.find(e => e.id === legalEntityId) as any)?.taxId || "0316123456"} &nbsp;|&nbsp; 
                                            SÄT: {(entities.find(e => e.id === legalEntityId) as any)?.phone || "024.3933.8888"} &nbsp;|&nbsp; 
                                            Email: {(entities.find(e => e.id === legalEntityId) as any)?.email || "orders@lyscellars.com"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <h1 className="text-xl font-bold uppercase tracking-wider mb-0.5 text-black">
                                            {orderType === 'TASTING' ? 'ÄÆ N HÃ€NG TASTING' : 'ÄÆ N BÃN HÃ€NG'}
                                        </h1>
                                        <p className="text-xs font-bold font-mono text-slate-900">Dá»° THáº¢O</p>
                                        <p className="text-[9px] text-slate-600 mt-0.5">NgÃ y láº­p: {new Date().toLocaleDateString('vi-VN')}</p>
                                    </div>
                                </div>
                                {/* Customer & Info Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-3 text-xs leading-tight">
                                    <div>
                                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">ThÃ´ng tin khÃ¡ch hÃ ng</h3>
                                        <table className="w-full text-[10px]">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">KhÃ¡ch hÃ ng:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{selectedCustomer?.name}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">MÃ£ KH:</td>
                                                    <td className="font-mono text-slate-900 py-0.5">{selectedCustomer?.code}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">SÄT liÃªn há»‡:</td>
                                                    <td className="font-semibold font-mono text-slate-900 py-0.5">
                                                        {selectedCustomer?.purchasingPhone || (selectedCustomer as any)?.contacts?.find((c: any) => c.isPrimary)?.phone || (selectedCustomer as any)?.contacts?.[0]?.phone || 'â€”'}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">PhÃ¢n kÃªnh:</td>
                                                    <td className="py-0.5 text-slate-900">{channel || 'â€”'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">MÃ£ sá»‘ thuáº¿:</td>
                                                    <td className="font-mono text-slate-900 py-0.5">{selectedCustomer?.taxId || (selectedCustomer as any)?.parent?.taxId || 'â€”'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div>
                                        <h3 className="font-bold border-b border-slate-300 pb-0.5 mb-1.5 text-slate-800 uppercase tracking-wide text-[10px]">ThÃ´ng tin giao nháº­n</h3>
                                        <table className="w-full text-[10px]">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">NgÆ°á»i nháº­n:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{selectedCustomer?.receiverName || selectedCustomer?.name}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">SÄT nháº­n hÃ ng:</td>
                                                    <td className="font-bold font-mono text-slate-900 py-0.5">
                                                        {selectedCustomer?.receiverPhone || selectedCustomer?.purchasingPhone || (selectedCustomer as any)?.contacts?.find((c: any) => c.isPrimary)?.phone || 'â€”'}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 w-20 py-0.5">Äá»‹a chá»‰ giao:</td>
                                                    <td className="py-0.5 text-slate-900">{selectedCustomer?.addresses?.find(a => a.id === shippingAddressId)?.address || selectedCustomer?.addresses?.[0]?.address || 'Nháº­n táº¡i kho'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Sales Rep:</td>
                                                    <td className="py-0.5 text-slate-900">TÃ i khoáº£n cá»§a báº¡n</td>
                                                </tr>

                                                <tr>
                                                    <td className="text-slate-600 pr-2 py-0.5">Thanh toÃ¡n:</td>
                                                    <td className="font-semibold text-slate-900 py-0.5">{paymentTerm}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Ghi chÃº / Diá»…n giáº£i Ä‘Æ¡n hÃ ng & LÆ°u Ã½ giao hÃ ng */}
                                {((selectedCustomer as any)?.deliveryNotes || notes) && (
                                    <div className="mb-3 text-[10px] p-2 bg-slate-50 border border-slate-300 rounded leading-relaxed space-y-1">
                                        {(selectedCustomer as any)?.deliveryNotes && (
                                            <div>
                                                <span className="font-bold text-amber-900 uppercase">ðŸ“¦ LÆ°u Ã½ giao hÃ ng: </span>
                                                <span className="text-slate-900 font-medium">{(selectedCustomer as any).deliveryNotes}</span>
                                            </div>
                                        )}
                                        {notes && (
                                            <div>
                                                <span className="font-bold text-slate-900 uppercase">Ghi chÃº / Diá»…n giáº£i: </span>
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
                                            <td className="px-2 py-1.5 w-24 border-r border-slate-300">MÃ£ AX</td>
                                            <td className="px-2 py-1.5 border-r border-slate-300">TÃªn sáº£n pháº©m</td>
                                            <td className="px-2 py-1.5 text-right w-10 border-r border-slate-300">SL</td>
                                            <td className="px-2 py-1.5 text-right w-24 border-r border-slate-300">ÄÆ¡n giÃ¡</td>
                                            <td className="px-2 py-1.5 text-center w-12 border-r border-slate-300">CK %</td>
                                            <td className="px-2 py-1.5 text-right w-28">ThÃ nh tiá»n</td>
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
                                                    <td className="px-2 py-1.5 text-center font-mono text-slate-600 tabular-nums border-r border-slate-200">{l.lineDiscountPct > 0 ? `${l.lineDiscountPct}%` : 'â€”'}</td>
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
                                                <td className="py-1 text-slate-700">Tá»•ng sá»‘ lÆ°á»£ng hÃ ng hÃ³a:</td>
                                                <td className="py-1 text-right font-mono font-bold text-slate-900 tabular-nums">
                                                    {lines.reduce((sum, item) => sum + Number(item.qtyOrdered), 0)} chai
                                                </td>
                                            </tr>
                                            <tr className="border-b border-slate-200">
                                                <td className="py-1 text-slate-600">Cá»™ng tiá»n hÃ ng (chÆ°a VAT):</td>
                                                <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(subtotal)}</td>
                                            </tr>
                                            {orderDiscount > 0 && (
                                                <tr className="border-b border-slate-200">
                                                    <td className="py-1 text-slate-600">Chiáº¿t kháº¥u Ä‘Æ¡n ({orderDiscount}%):</td>
                                                    <td className="py-1 text-right font-mono text-red-600 tabular-nums">-{formatVND(subtotal * (orderDiscount / 100))}</td>
                                                </tr>
                                            )}
                                            {vatBreakdown.length > 1 ? (
                                                <>
                                                    {vatBreakdown.map(vb => (
                                                        <tr key={vb.rate} className="border-b border-slate-200">
                                                            <td className="py-1 text-slate-600">Thuáº¿ GTGT ({vb.rate}%):</td>
                                                            <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(Math.round(vb.amount))}</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="border-b border-slate-200 font-semibold">
                                                        <td className="py-1 text-slate-700">Tá»•ng tiá»n thuáº¿ VAT:</td>
                                                        <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(Math.round(vatAmount))}</td>
                                                    </tr>
                                                </>
                                            ) : (
                                                <tr className="border-b border-slate-200">
                                                    <td className="py-1 text-slate-600">Thuáº¿ VAT ({vatBreakdown[0]?.rate ?? 10}%):</td>
                                                    <td className="py-1 text-right font-mono tabular-nums text-slate-900">{formatVND(Math.round(vatAmount))}</td>
                                                </tr>
                                            )}
                                            <tr className="font-bold border-t-2 border-black">
                                                <td className="py-1.5 text-slate-900 text-xs">Tá»•ng cá»™ng thanh toÃ¡n:</td>
                                                <td className="py-1.5 text-right font-mono text-xs tabular-nums text-black">{formatVND(finalTotal)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Bank Account Details - ONLY FOR COD ORDERS */}
                                {(paymentTerm === 'COD' || paymentTerm?.toUpperCase().includes('COD')) && (
                                    <div className="border border-slate-200 rounded p-2.5 mb-3 bg-slate-50 text-[10px] leading-relaxed break-inside-avoid print:break-inside-avoid">
                                        <p className="font-bold text-slate-700 uppercase mb-1 text-[9px]">ThÃ´ng tin chuyá»ƒn khoáº£n thanh toÃ¡n (COD):</p>
                                        <table className="w-full">
                                            <tbody>
                                                <tr>
                                                    <td className="text-slate-500 w-20 py-0.5">Chá»§ tÃ i khoáº£n:</td>
                                                    <td className="font-semibold text-slate-800 py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankAccountName || "CÃ”NG TY TNHH LY'S CELLARS"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-500 py-0.5">Sá»‘ tÃ i khoáº£n:</td>
                                                    <td className="font-semibold font-mono text-slate-800 py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankAccountNumber || "1023456789"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="text-slate-500 py-0.5">NgÃ¢n hÃ ng:</td>
                                                    <td className="text-slate-800 font-semibold py-0.5">
                                                        {entities.find(e => e.id === legalEntityId)?.bankName || "Vietcombank (VCB) - Chi nhÃ¡nh TP. Há»“ ChÃ­ Minh"}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Signatures */}
                                <div className="grid grid-cols-4 gap-2 text-center text-xs mt-4 pt-2 border-t border-dashed border-slate-300 pb-4 break-inside-avoid print:break-inside-avoid">
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Sale Admin duyá»‡t</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(KÃ½, ghi rÃµ há» tÃªn)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Káº¿ toÃ¡n kiá»ƒm soÃ¡t</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(KÃ½, ghi rÃµ há» tÃªn)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">Thá»§ kho</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(KÃ½, ghi rÃµ há» tÃªn)</p>
                                    </div>
                                    <div className="flex flex-col pb-12">
                                        <p className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">NgÆ°á»i nháº­n hÃ ng</p>
                                        <p className="text-slate-400 italic text-[9px] mt-0.5">(KÃ½, ghi rÃµ há» tÃªn)</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

