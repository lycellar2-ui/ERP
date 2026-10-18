'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    Stamp, Plus, AlertTriangle, CheckCircle, Package, Trash2,
    ShieldAlert, BookOpen, Download, Search, Filter, RefreshCw,
    Ship, Warehouse, FileSpreadsheet, ArrowRight, Info,
    Layers, ChevronDown, ChevronUp, Check, Hash, Calendar,
    Printer, FileText, Store, CheckCircle2, Eye, CheckSquare, Square, X
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
    createStampPurchase,
    safeRecordStampUsage,
    createStampDestruction,
    getStampAlerts,
    getStampDestructions,
    getStampLogbook,
    exportStampLogbookExcel,
    exportStampReportExcel,
    allocateStampsToPO,
    getPOStampAllocations,
} from './actions'
import { PageHeader, Button, SearchInput, StatusTabs, Table, THead, TBody, Tr, Th, Td } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getStampsI18n } from './i18n'
import type {
    StampAlert,
    StampDestructionRecord,
    StampLogbookEntry,
    ReceivedPOForStamps,
    POStampAllocationRecord,
} from './actions'

interface StampUsageItem {
    id: string
    serialStart: string | null
    serialEnd: string | null
    qtyUsed: number
    qtyDamaged: number
    usedAt: Date | string
    shipmentId: string | null
    lotId: string | null
    notes: string | null
    shipment?: { id: string; billOfLading: string } | null
    lot?: { id: string; lotNo: string; product: { skuCode: string; productName: string } } | null
    reporter?: { id: string; name: string } | null
}

interface StampPurchase {
    id: string
    purchaseDate: Date | string
    stampType: 'UNDER_20_ABV' | 'OVER_20_ABV'
    symbol: string
    serialStart: string
    serialEnd: string
    totalQty: number
    usedQty: number
    status: string
    createdAt: Date | string
    usages: StampUsageItem[]
}

interface StampSummary {
    under20: { total: number; used: number; remaining: number; activeBatches: number }
    over20: { total: number; used: number; remaining: number; activeBatches: number }
    all: { total: number; used: number; remaining: number; activeBatches: number }
}

interface LinkingOptions {
    shipments: { id: string; billOfLading: string; status: string; vesselName?: string | null }[]
    lots: { id: string; lotNo: string; qtyAvailable: any; product: { skuCode: string; productName: string } }[]
}

interface Props {
    purchases: StampPurchase[]
    summary: StampSummary
    linkingOptions?: LinkingOptions
    initialLogbook?: StampLogbookEntry[]
    initialPOs?: ReceivedPOForStamps[]
    initialPOAllocations?: POStampAllocationRecord[]
}

const cardStyle: React.CSSProperties = {
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    borderRadius: '8px',
    padding: '24px',
}

const labelStyle: React.CSSProperties = {
    color: '#64748B',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '6px',
    display: 'block',
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    background: '#FFFFFF',
    color: '#0F172A',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 14px',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: '#F8FAFC',
}

const tdStyle: React.CSSProperties = {
    padding: '12px 14px',
    color: '#334155',
    fontSize: '13px',
    verticalAlign: 'middle',
}

export default function StampsClient({
    purchases,
    summary,
    linkingOptions,
    initialLogbook = [],
    initialPOs = [],
    initialPOAllocations = [],
}: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { locale, formatDate, formatNumber } = useAppLocale()
    const t = getStampsI18n(locale)

    // Navigation Tabs
    const [activeTab, setActiveTab] = useState<'po_allocations' | 'logbook' | 'batches' | 'destructions'>('po_allocations')

    // Modals
    const [showAddForm, setShowAddForm] = useState(false)
    const [usageTargetPurchase, setUsageTargetPurchase] = useState<StampPurchase | null>(null)
    const [destroyTargetPurchase, setDestroyTargetPurchase] = useState<StampPurchase | null>(null)
    const [loading, setLoading] = useState(false)

    // Alerts & Destructions & Logbook
    const [alerts, setAlerts] = useState<StampAlert[]>([])
    const [destructions, setDestructions] = useState<StampDestructionRecord[]>([])
    const [logbookEntries, setLogbookEntries] = useState<StampLogbookEntry[]>(initialLogbook)
    const [logbookLoading, setLogbookLoading] = useState(false)
    const [exportingLogbook, setExportingLogbook] = useState(false)

    // PO Stamp Allocation State
    const [receivedPOs, setReceivedPOs] = useState<ReceivedPOForStamps[]>(initialPOs)
    const [poAllocations, setPOAllocations] = useState<POStampAllocationRecord[]>(initialPOAllocations)
    const [expandedPOId, setExpandedPOId] = useState<string | null>(null)
    const [poAllocSearch, setPOAllocSearch] = useState<string>('')

    // PO Allocation & Sticking Guide State
    const [showPOAllocModal, setShowPOAllocModal] = useState(false)
    const [selectedPOId, setSelectedPOId] = useState<string>('')
    const [selectedStampPurchaseId, setSelectedStampPurchaseId] = useState<string>('')
    const [poBaseSerialStart, setPOBaseSerialStart] = useState<string>('')
    const [poItemSerials, setPOItemSerials] = useState<Record<string, {
        qty: number
        qtySR: number
        qtyMain: number
        start: string
        end: string
        mainStart: string
        mainEnd: string
        srStart: string
        srEnd: string
        damaged: number
    }>>({})
    const [poAllocNotes, setPOAllocNotes] = useState<string>('')
    const [poAllocSubmitting, setPOAllocSubmitting] = useState(false)

    // Sticking Guide Worker View Modal
    const [stickingGuideAlloc, setStickingGuideAlloc] = useState<POStampAllocationRecord | null>(null)
    const [stickingDoneMap, setStickingDoneMap] = useState<Record<string, boolean>>({})
    const [stickingViewMode, setStickingViewMode] = useState<'cards' | 'table'>('cards')

    // Logbook filters
    const currentYear = new Date().getFullYear()
    const [logYear, setLogYear] = useState<number>(currentYear)
    const [logQuarter, setLogQuarter] = useState<number>(0)
    const [logStampType, setLogStampType] = useState<'ALL' | 'UNDER_20_ABV' | 'OVER_20_ABV'>('ALL')
    const [logSearch, setLogSearch] = useState<string>('')

    useEffect(() => {
        getStampAlerts().then(setAlerts)
        getStampDestructions().then(setDestructions)
    }, [])

    // Helper: Contiguous sequential serial calculation with optional Showroom split
    function calculateContiguousSerials(
        baseStart: string,
        items: Array<{ productId: string; qty: number; qtySR?: number }>
    ): Record<string, {
        start: string
        end: string
        mainStart: string
        mainEnd: string
        srStart: string
        srEnd: string
        qtyMain: number
        qtySR: number
    }> {
        const trimmed = (baseStart || '').trim()
        const defaultEmpty = items.reduce((acc, it) => {
            const qty = Math.max(0, Number(it.qty) || 0)
            const qtySR = Math.min(qty, Math.max(0, Number(it.qtySR) || 0))
            const qtyMain = qty - qtySR
            return {
                ...acc,
                [it.productId]: {
                    start: '', end: '',
                    mainStart: '', mainEnd: '',
                    srStart: '', srEnd: '',
                    qtyMain, qtySR,
                },
            }
        }, {})

        if (!trimmed) return defaultEmpty

        const match = trimmed.match(/^([A-Za-z\-_/]*?)(\d+)$/)
        if (!match) return defaultEmpty

        const prefix = match[1]
        const numStr = match[2]
        const padLen = numStr.length
        let current = parseInt(numStr, 10)
        const result: Record<string, any> = {}

        for (const it of items) {
            const qty = Math.max(0, Number(it.qty) || 0)
            const qtySR = Math.min(qty, Math.max(0, Number(it.qtySR) || 0))
            const qtyMain = qty - qtySR

            if (qty === 0) {
                result[it.productId] = {
                    start: '', end: '',
                    mainStart: '', mainEnd: '',
                    srStart: '', srEnd: '',
                    qtyMain: 0, qtySR: 0,
                }
                continue
            }

            const startStr = prefix + String(current).padStart(padLen, '0')
            const endNum = current + qty - 1
            const endStr = prefix + String(endNum).padStart(padLen, '0')

            let mainStart = ''
            let mainEnd = ''
            let srStart = ''
            let srEnd = ''

            if (qtyMain > 0 && qtySR > 0) {
                // Split between Kho Thanh Trì and Showroom
                mainStart = startStr
                mainEnd = prefix + String(current + qtyMain - 1).padStart(padLen, '0')
                srStart = prefix + String(current + qtyMain).padStart(padLen, '0')
                srEnd = endStr
            } else if (qtySR > 0 && qtyMain === 0) {
                // 100% Showroom
                srStart = startStr
                srEnd = endStr
            } else {
                // 100% Kho Thanh Trì (kho chính)
                mainStart = startStr
                mainEnd = endStr
            }

            current = endNum + 1

            result[it.productId] = {
                start: startStr,
                end: endStr,
                mainStart,
                mainEnd,
                srStart,
                srEnd,
                qtyMain,
                qtySR,
            }
        }
        return result
    }

    const selectedPO = receivedPOs.find(p => p.id === selectedPOId)
    const selectedPurchase = purchases.find(p => p.id === selectedStampPurchaseId)

    const handleSelectPO = (poId: string) => {
        setSelectedPOId(poId)
        const po = receivedPOs.find(p => p.id === poId)
        if (!po) return

        let pId = selectedStampPurchaseId
        if (!pId) {
            const matchingPurchase = purchases.find(p => {
                const remaining = p.totalQty - p.usedQty
                if (remaining <= 0) return false
                if (po.recommendedStampType === 'MIXED') return true
                return p.stampType === po.recommendedStampType
            })
            if (matchingPurchase) {
                pId = matchingPurchase.id
                setSelectedStampPurchaseId(pId)
                if (!poBaseSerialStart) {
                    setPOBaseSerialStart(matchingPurchase.serialStart)
                }
            }
        }

        const chosenPurchase = purchases.find(p => p.id === pId)
        const base = poBaseSerialStart || chosenPurchase?.serialStart || ''
        const initialItems = po.items.map(it => ({ productId: it.productId, qty: it.qty, qtySR: 0 }))
        const serials = calculateContiguousSerials(base, initialItems)
        const nextSerials: Record<string, any> = {}
        for (const it of po.items) {
            const s = serials[it.productId]
            nextSerials[it.productId] = {
                qty: it.qty,
                qtySR: 0,
                qtyMain: it.qty,
                start: s?.start || '',
                end: s?.end || '',
                mainStart: s?.mainStart || '',
                mainEnd: s?.mainEnd || '',
                srStart: s?.srStart || '',
                srEnd: s?.srEnd || '',
                damaged: 0,
            }
        }
        setPOItemSerials(nextSerials)
    }

    const handleSelectPurchase = (purchaseId: string) => {
        setSelectedStampPurchaseId(purchaseId)
        const p = purchases.find(item => item.id === purchaseId)
        if (p && !poBaseSerialStart) {
            setPOBaseSerialStart(p.serialStart)
            if (selectedPO) {
                const itemsList = selectedPO.items.map(it => ({
                    productId: it.productId,
                    qty: poItemSerials[it.productId]?.qty ?? it.qty,
                    qtySR: poItemSerials[it.productId]?.qtySR ?? 0,
                }))
                const serials = calculateContiguousSerials(p.serialStart, itemsList)
                const updated = { ...poItemSerials }
                for (const it of selectedPO.items) {
                    const s = serials[it.productId]
                    updated[it.productId] = {
                        ...(updated[it.productId] || { qty: it.qty, qtySR: 0, qtyMain: it.qty, damaged: 0 }),
                        start: s?.start || '',
                        end: s?.end || '',
                        mainStart: s?.mainStart || '',
                        mainEnd: s?.mainEnd || '',
                        srStart: s?.srStart || '',
                        srEnd: s?.srEnd || '',
                        qtyMain: s?.qtyMain ?? it.qty,
                        qtySR: s?.qtySR ?? 0,
                    }
                }
                setPOItemSerials(updated)
            }
        }
    }

    const handleBaseSerialChange = (newBase: string) => {
        setPOBaseSerialStart(newBase)
        if (selectedPO) {
            const itemsList = selectedPO.items.map(it => ({
                productId: it.productId,
                qty: poItemSerials[it.productId]?.qty ?? it.qty,
                qtySR: poItemSerials[it.productId]?.qtySR ?? 0,
            }))
            const serials = calculateContiguousSerials(newBase, itemsList)
            const updated = { ...poItemSerials }
            for (const it of selectedPO.items) {
                const s = serials[it.productId]
                updated[it.productId] = {
                    ...(updated[it.productId] || { qty: it.qty, qtySR: 0, qtyMain: it.qty, damaged: 0 }),
                    start: s?.start || '',
                    end: s?.end || '',
                    mainStart: s?.mainStart || '',
                    mainEnd: s?.mainEnd || '',
                    srStart: s?.srStart || '',
                    srEnd: s?.srEnd || '',
                    qtyMain: s?.qtyMain ?? it.qty,
                    qtySR: s?.qtySR ?? 0,
                }
            }
            setPOItemSerials(updated)
        }
    }

    const handleItemFieldChange = (
        productId: string,
        field: 'qty' | 'qtySR' | 'start' | 'end' | 'mainStart' | 'mainEnd' | 'srStart' | 'srEnd' | 'damaged',
        value: any
    ) => {
        setPOItemSerials(prev => {
            const cur = prev[productId] || {
                qty: 0, qtySR: 0, qtyMain: 0,
                start: '', end: '', mainStart: '', mainEnd: '',
                srStart: '', srEnd: '', damaged: 0
            }
            const next = { ...cur, [field]: value }

            if (field === 'qty' || field === 'qtySR') {
                const total = Math.max(0, field === 'qty' ? (Number(value) || 0) : next.qty)
                const sr = Math.min(total, Math.max(0, field === 'qtySR' ? (Number(value) || 0) : next.qtySR))
                next.qty = total
                next.qtySR = sr
                next.qtyMain = total - sr

                if (selectedPO && poBaseSerialStart) {
                    const itemsList = selectedPO.items.map(it => {
                        if (it.productId === productId) {
                            return { productId: it.productId, qty: total, qtySR: sr }
                        }
                        const existing = prev[it.productId]
                        return {
                            productId: it.productId,
                            qty: existing?.qty ?? it.qty,
                            qtySR: existing?.qtySR ?? 0,
                        }
                    })
                    const computed = calculateContiguousSerials(poBaseSerialStart, itemsList)
                    const updated = { ...prev }
                    for (const it of selectedPO.items) {
                        const c = computed[it.productId]
                        const baseObj = it.productId === productId ? next : (prev[it.productId] || { qty: it.qty, qtySR: 0, damaged: 0 })
                        updated[it.productId] = {
                            ...baseObj,
                            start: c?.start || '',
                            end: c?.end || '',
                            mainStart: c?.mainStart || '',
                            mainEnd: c?.mainEnd || '',
                            srStart: c?.srStart || '',
                            srEnd: c?.srEnd || '',
                            qtyMain: c?.qtyMain ?? (baseObj.qty - (baseObj.qtySR || 0)),
                            qtySR: c?.qtySR ?? (baseObj.qtySR || 0),
                        }
                    }
                    return updated
                }
            }

            return { ...prev, [productId]: next }
        })
    }

    const handleSubmitPOAllocation = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPOId || !selectedPO) {
            toast.error(t.toasts.selectPO)
            return
        }
        if (!selectedStampPurchaseId || !selectedPurchase) {
            toast.error(t.toasts.selectBatch)
            return
        }

        const itemsToSubmit = Object.entries(poItemSerials).map(([productId, data]) => {
            const original = selectedPO.items.find(it => it.productId === productId)
            return {
                productId,
                lotId: original?.lotId || null,
                qty: Number(data.qty || 0),
                qtyDamaged: Number(data.damaged || 0),
                serialStart: data.start?.trim() || '',
                serialEnd: data.end?.trim() || '',
                qtyMain: Number(data.qtyMain ?? (data.qty - (data.qtySR || 0))),
                mainSerialStart: data.mainStart?.trim() || '',
                mainSerialEnd: data.mainEnd?.trim() || '',
                qtySR: Number(data.qtySR || 0),
                srSerialStart: data.srStart?.trim() || '',
                srSerialEnd: data.srEnd?.trim() || '',
            }
        }).filter(it => it.qty > 0 || it.qtyDamaged > 0)

        if (itemsToSubmit.length === 0) {
            toast.error(t.toasts.noValidItems)
            return
        }

        for (const it of itemsToSubmit) {
            if (it.qty > 0 && (!it.serialStart || !it.serialEnd)) {
                toast.error(t.toasts.missingSerials)
                return
            }
        }

        const totalQty = itemsToSubmit.reduce((sum, it) => sum + it.qty + it.qtyDamaged, 0)
        const remaining = selectedPurchase.totalQty - selectedPurchase.usedQty
        if (totalQty > remaining) {
            toast.error(t.toasts.exceedStock(formatNumber(remaining)))
            return
        }

        setPOAllocSubmitting(true)
        try {
            const res = await allocateStampsToPO({
                purchaseId: selectedStampPurchaseId,
                poId: selectedPOId,
                items: itemsToSubmit,
                notes: poAllocNotes,
            })

            if (!res.success) {
                throw new Error(res.error || t.toasts.allocError)
            }

            toast.success(t.toasts.allocSuccess(selectedPO.poNo))
            setShowPOAllocModal(false)
            setSelectedPOId('')
            setPOBaseSerialStart('')
            setPOItemSerials({})
            setPOAllocNotes('')

            // Refresh allocations
            const freshAllocations = await getPOStampAllocations()
            setPOAllocations(freshAllocations)
            startTransition(() => {
                router.refresh()
            })
        } catch (err: any) {
            toast.error(err.message || t.toasts.allocError)
        } finally {
            setPOAllocSubmitting(false)
        }
    }

    // Fetch logbook when filters change
    const fetchLogbook = async () => {
        setLogbookLoading(true)
        try {
            const data = await getStampLogbook({
                year: logYear || undefined,
                quarter: logQuarter > 0 ? logQuarter : undefined,
                stampType: logStampType,
                search: logSearch || undefined,
            })
            setLogbookEntries(data)
        } catch (err: any) {
            toast.error(t.toasts.logbookError(err.message))
        } finally {
            setLogbookLoading(false)
        }
    }

    // Add stamp purchase form state
    const [formData, setFormData] = useState({
        purchaseDate: new Date().toISOString().split('T')[0],
        stampType: 'UNDER_20_ABV' as 'UNDER_20_ABV' | 'OVER_20_ABV',
        symbol: '',
        serialStart: '',
        serialEnd: '',
        totalQty: 0,
    })

    // Usage & Allocation form state
    const [usageData, setUsageData] = useState({
        targetType: 'NONE' as 'NONE' | 'SHIPMENT' | 'STOCK_LOT',
        shipmentId: '',
        lotId: '',
        serialStart: '',
        serialEnd: '',
        qtyUsed: 0,
        qtyDamaged: 0,
        notes: '',
    })

    // Destruction form state
    const [destroyData, setDestroyData] = useState({
        qtyDestroyed: 0,
        reason: '',
        witnessName: '',
        destructionDate: new Date().toISOString().split('T')[0],
        notes: '',
    })

    async function handleAddPurchase(e: React.FormEvent) {
        e.preventDefault()
        if (formData.totalQty <= 0) {
            toast.error(t.toasts.qtyMustBePositive)
            return
        }
        setLoading(true)
        try {
            await createStampPurchase(formData)
            toast.success(t.toasts.batchSaved)
            setShowAddForm(false)
            setFormData({
                purchaseDate: new Date().toISOString().split('T')[0],
                stampType: 'UNDER_20_ABV',
                symbol: '',
                serialStart: '',
                serialEnd: '',
                totalQty: 0,
            })
            startTransition(() => {
                router.refresh()
            })
            fetchLogbook()
        } catch (err: any) {
            toast.error(t.toasts.batchError(err.message))
        } finally {
            setLoading(false)
        }
    }

    async function handleRecordUsage(e: React.FormEvent) {
        e.preventDefault()
        if (!usageTargetPurchase) return
        if (usageData.qtyUsed <= 0 && usageData.qtyDamaged <= 0) {
            toast.error(t.toasts.usageQtyRequired)
            return
        }

        const remaining = usageTargetPurchase.totalQty - usageTargetPurchase.usedQty
        if (usageData.qtyUsed + usageData.qtyDamaged > remaining) {
            toast.error(t.toasts.exceedStock(formatNumber(remaining)))
            return
        }

        setLoading(true)
        try {
            const res = await safeRecordStampUsage({
                purchaseId: usageTargetPurchase.id,
                shipmentId: usageData.targetType === 'SHIPMENT' ? usageData.shipmentId : undefined,
                lotId: usageData.targetType === 'STOCK_LOT' ? usageData.lotId : undefined,
                serialStart: usageData.serialStart || undefined,
                serialEnd: usageData.serialEnd || undefined,
                qtyUsed: usageData.qtyUsed,
                qtyDamaged: usageData.qtyDamaged,
                notes: usageData.notes || undefined,
            })

            if (!res.success) {
                throw new Error(res.error || t.toasts.usageError)
            }

            toast.success(t.toasts.usageSuccess)
            setUsageTargetPurchase(null)
            setUsageData({
                targetType: 'NONE',
                shipmentId: '',
                lotId: '',
                serialStart: '',
                serialEnd: '',
                qtyUsed: 0,
                qtyDamaged: 0,
                notes: '',
            })
            startTransition(() => {
                router.refresh()
            })
            fetchLogbook()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleDestruction(e: React.FormEvent) {
        e.preventDefault()
        if (!destroyTargetPurchase) return
        if (!destroyData.reason.trim()) {
            toast.error(t.toasts.destroyReasonRequired)
            return
        }
        if (!destroyData.witnessName.trim()) {
            toast.error(t.toasts.destroyWitnessRequired)
            return
        }
        if (destroyData.qtyDestroyed <= 0) {
            toast.error(t.toasts.destroyQtyRequired)
            return
        }

        setLoading(true)
        try {
            const res = await createStampDestruction({
                purchaseId: destroyTargetPurchase.id,
                ...destroyData,
            })

            if (!res.success) {
                throw new Error(res.error || t.toasts.destroyError)
            }

            toast.success(t.toasts.destroySuccess)
            setDestroyTargetPurchase(null)
            setDestroyData({
                qtyDestroyed: 0,
                reason: '',
                witnessName: '',
                destructionDate: new Date().toISOString().split('T')[0],
                notes: '',
            })
            startTransition(() => {
                router.refresh()
            })
            getStampAlerts().then(setAlerts)
            getStampDestructions().then(setDestructions)
            fetchLogbook()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleExportLogbook() {
        setExportingLogbook(true)
        try {
            const res = await exportStampLogbookExcel({
                year: logYear || undefined,
                quarter: logQuarter > 0 ? logQuarter : undefined,
                stampType: logStampType,
                search: logSearch || undefined,
            })

            if (!res.success || !res.base64 || !res.filename) {
                throw new Error(res.error || t.toasts.exportError)
            }

            const link = document.createElement('a')
            link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`
            link.download = res.filename
            link.click()
            toast.success(t.toasts.exportSuccess)
        } catch (err: any) {
            toast.error(t.toasts.exportFailed(err.message))
        } finally {
            setExportingLogbook(false)
        }
    }

    const pct = (used: number, total: number) =>
        total > 0 ? Math.round((used / total) * 100) : 0

    const modalTotalQtyUsed = Object.values(poItemSerials).reduce((s, it) => s + (Number(it.qty) || 0), 0)
    const modalTotalQtyDamaged = Object.values(poItemSerials).reduce((s, it) => s + (Number(it.damaged) || 0), 0)
    const modalTotalNeeded = modalTotalQtyUsed + modalTotalQtyDamaged

    const validStarts = Object.values(poItemSerials).map(it => it.start).filter(Boolean)
    const validEnds = Object.values(poItemSerials).map(it => it.end).filter(Boolean)
    const overallComputedRange = {
        start: validStarts[0] || '',
        end: validEnds[validEnds.length - 1] || '',
    }

    const filteredPOAllocations = poAllocations.filter(alloc => {
        if (!poAllocSearch.trim()) return true
        const q = poAllocSearch.trim().toLowerCase()
        return (
            alloc.poNo.toLowerCase().includes(q) ||
            alloc.purchaseSymbol.toLowerCase().includes(q) ||
            alloc.serialStart.toLowerCase().includes(q) ||
            alloc.serialEnd.toLowerCase().includes(q) ||
            (alloc.notes && alloc.notes.toLowerCase().includes(q))
        )
    })

    return (
        <div className="p-3 sm:p-6 md:p-8 max-w-[1440px] mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                <div>
                    <h1 className="text-lg sm:text-2xl font-bold text-lys-primary tracking-tight">
                        {t.header.title}
                    </h1>
                    <p className="hidden sm:block text-xs sm:text-sm text-lys-muted mt-0.5">
                        {t.header.subtitle}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                            if (receivedPOs.length === 0) {
                                toast.info(t.toasts.noReceivedPO)
                                return
                            }
                            setShowPOAllocModal(true)
                            if (!selectedPOId && receivedPOs[0]) {
                                handleSelectPO(receivedPOs[0].id)
                            }
                        }}
                        className="flex-1 sm:flex-none justify-center"
                    >
                        <Stamp size={14} className="mr-1.5" />
                        {t.header.allocatePO}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            setActiveTab('batches')
                            setShowAddForm(!showAddForm)
                        }}
                        className="flex-1 sm:flex-none justify-center"
                    >
                        <Plus size={14} className="mr-1.5" />
                        {t.header.addBatch}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExportLogbook}
                        disabled={exportingLogbook}
                        className="flex-1 sm:flex-none justify-center"
                    >
                        <FileSpreadsheet size={14} className="mr-1.5" />
                        <span className="hidden sm:inline">{t.header.exportLogbookFull}</span>
                        <span className="sm:hidden">{t.header.exportLogbookShort}</span>
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="mb-4 sm:mb-6">
                <StatusTabs
                    items={[
                        { value: 'po_allocations', label: t.tabs.poAllocations, count: poAllocations.length },
                        { value: 'logbook', label: t.tabs.logbook, count: logbookEntries.length },
                        { value: 'batches', label: t.tabs.batches, count: purchases.length },
                        { value: 'destructions', label: t.tabs.destructions, count: destructions.length },
                    ]}
                    value={activeTab}
                    onChange={val => {
                        setActiveTab(val as any)
                        if (val === 'logbook' && logbookEntries.length === 0) fetchLogbook()
                    }}
                />
            </div>

            {/* TAB 1: BATCHES & ALLOCATION */}
            {activeTab === 'batches' && (
                <div>
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 sm:mb-6">
                        {[
                            { label: t.batches.kpiUnder20, data: summary.under20, color: '#0891B2' },
                            { label: t.batches.kpiOver20, data: summary.over20, color: '#D97706' },
                            { label: t.batches.kpiAll, data: summary.all, color: '#0F172A' },
                        ].map(({ label, data, color }) => (
                            <div key={label} className="bg-white border border-lys-border rounded-lg p-3.5 sm:p-4 shadow-xs">
                                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-lys-muted truncate mb-1">
                                    {label}
                                </p>
                                <div className="flex items-baseline justify-between mb-2">
                                    <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight" style={{ color }}>
                                        {formatNumber(data.remaining)}
                                    </span>
                                    <span className="text-xs text-lys-muted font-medium">
                                        / {formatNumber(data.total)} {t.batches.unitStamp}
                                    </span>
                                </div>
                                <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
                                    <div
                                        style={{
                                            background: pct(data.used, data.total) > 90 ? '#B91C1C' : color,
                                            width: `${pct(data.used, data.total)}%`,
                                        }}
                                        className="h-full rounded-full transition-all duration-300"
                                    />
                                </div>
                                <div className="flex items-center justify-between text-[11px] sm:text-xs text-lys-muted">
                                    <span>{t.batches.used} {formatNumber(data.used)}</span>
                                    <span>{data.activeBatches} {t.batches.activeBatches}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Alerts Banner */}
                    {alerts.length > 0 && (
                        <div style={{
                            ...cardStyle,
                            marginBottom: '24px',
                            borderColor: alerts.some(a => a.severity === 'CRITICAL') ? '#FCA5A5' : '#FDE68A',
                            background: alerts.some(a => a.severity === 'CRITICAL') ? '#FEF2F2' : '#FFFBEB',
                            padding: '16px 20px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <ShieldAlert size={18} style={{ color: alerts.some(a => a.severity === 'CRITICAL') ? '#B91C1C' : '#D97706' }} />
                                <h4 style={{ color: '#0F172A', margin: 0, fontSize: '14px', fontWeight: 600 }}>
                                    {t.batches.alertsTitle} ({alerts.length})
                                </h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {alerts.map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 12px', borderRadius: '6px',
                                        background: '#FFFFFF',
                                        border: '1px solid #E2E8F0',
                                        fontSize: '13px',
                                    }}>
                                        <AlertTriangle size={14} style={{ color: a.severity === 'CRITICAL' ? '#B91C1C' : '#D97706' }} />
                                        <span style={{ color: '#1E293B', flex: 1 }}>{a.message}</span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px',
                                            background: a.severity === 'CRITICAL' ? '#FEE2E2' : '#FEF3C7',
                                            color: a.severity === 'CRITICAL' ? '#991B1B' : '#92400E',
                                        }}>
                                            {a.severity === 'CRITICAL' ? t.batches.severityCritical : t.batches.severityWarning}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Stamp Purchase Form */}
                    {showAddForm && (
                        <div style={{ ...cardStyle, marginBottom: '24px', borderColor: '#0891B2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Stamp size={16} style={{ color: '#0891B2' }} />
                                    {t.batches.addTitle}
                                </h3>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '13px' }}
                                >
                                    {t.batches.close}
                                </button>
                            </div>
                            <form onSubmit={handleAddPurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label style={labelStyle}>{t.batches.purchaseDate}</label>
                                    <input
                                        type="date"
                                        value={formData.purchaseDate}
                                        onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.batches.stampType}</label>
                                    <select
                                        value={formData.stampType}
                                        onChange={e => setFormData({ ...formData, stampType: e.target.value as any })}
                                        style={inputStyle}
                                    >
                                        <option value="UNDER_20_ABV">{t.batches.typeUnder20Option}</option>
                                        <option value="OVER_20_ABV">{t.batches.typeOver20Option}</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.batches.symbol}</label>
                                    <input
                                        placeholder={t.batches.symbolPlaceholder}
                                        value={formData.symbol}
                                        onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.batches.serialStart}</label>
                                    <input
                                        placeholder={t.batches.serialStartPlaceholder}
                                        value={formData.serialStart}
                                        onChange={e => setFormData({ ...formData, serialStart: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.batches.serialEnd}</label>
                                    <input
                                        placeholder={t.batches.serialEndPlaceholder}
                                        value={formData.serialEnd}
                                        onChange={e => setFormData({ ...formData, serialEnd: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.batches.totalQty}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.totalQty || ''}
                                        onChange={e => setFormData({ ...formData, totalQty: parseInt(e.target.value) || 0 })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex gap-2 justify-end mt-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)}>
                                        {t.batches.cancel}
                                    </Button>
                                    <Button type="submit" variant="primary" size="sm" disabled={loading}>
                                        {loading ? t.batches.saving : t.batches.saveBatch}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Stamp Batches Table */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                                {t.batches.tableTitle}
                            </h3>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                                {t.batches.totalBatches(purchases.length)}
                            </span>
                        </div>

                        {purchases.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                                <Package size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p>{t.batches.emptyBatches}</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards (<768px) */}
                                <div className="block md:hidden space-y-3">
                                    {purchases.map(p => {
                                        const remaining = p.totalQty - p.usedQty
                                        const isExhaust = remaining <= 0
                                        const isLow = remaining > 0 && remaining < p.totalQty * 0.15

                                        return (
                                            <div key={p.id} className="bg-white border border-lys-border rounded-lg p-3.5 shadow-2xs space-y-2.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-lys-primary">{p.symbol}</span>
                                                            <span className={cn(
                                                                'px-2 py-0.5 rounded text-[11px] font-semibold',
                                                                p.stampType === 'UNDER_20_ABV' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                                                            )}>
                                                                {p.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-lys-muted mt-0.5">
                                                            {formatDate(p.purchaseDate)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        {isExhaust ? (
                                                            <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-semibold">
                                                                <AlertTriangle size={13} /> {t.batches.statusExhausted}
                                                            </span>
                                                        ) : isLow ? (
                                                            <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
                                                                <AlertTriangle size={13} /> {t.batches.statusLow}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-lys-teal-strong text-xs font-semibold">
                                                                <CheckCircle size={13} /> {t.batches.statusAvailable}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700">
                                                    {p.serialStart} → {p.serialEnd}
                                                </div>

                                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                                                    <div>
                                                        <span className="text-[11px] text-lys-muted block">{t.batches.colTotal}</span>
                                                        <span className="font-mono font-semibold text-lys-primary">{formatNumber(p.totalQty)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[11px] text-lys-muted block">{t.batches.colUsed}</span>
                                                        <span className="font-mono text-slate-600">{formatNumber(p.usedQty)}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[11px] text-lys-muted block">{t.batches.colRemaining}</span>
                                                        <span className={cn(
                                                            'font-mono font-bold',
                                                            isExhaust ? 'text-rose-700' : isLow ? 'text-amber-600' : 'text-lys-teal-strong'
                                                        )}>
                                                            {formatNumber(remaining)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {!isExhaust && (
                                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => {
                                                                setUsageTargetPurchase(p)
                                                                setUsageData({
                                                                    targetType: 'NONE',
                                                                    shipmentId: '',
                                                                    lotId: '',
                                                                    serialStart: '',
                                                                    serialEnd: '',
                                                                    qtyUsed: 0,
                                                                    qtyDamaged: 0,
                                                                    notes: '',
                                                                })
                                                            }}
                                                        >
                                                            {t.batches.btnAllocateAndStick}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => {
                                                                setDestroyTargetPurchase(p)
                                                                setDestroyData({
                                                                    qtyDestroyed: 0,
                                                                    reason: '',
                                                                    witnessName: '',
                                                                    destructionDate: new Date().toISOString().split('T')[0],
                                                                    notes: '',
                                                                })
                                                            }}
                                                        >
                                                            {t.batches.btnDestroy}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Desktop Table (>=768px) */}
                                <div className="hidden md:block">
                                    <Table>
                                        <THead>
                                            <Tr>
                                                <Th>{t.batches.colPurchaseDate}</Th>
                                                <Th>{t.batches.colType}</Th>
                                                <Th>{t.batches.colSymbol}</Th>
                                                <Th>{t.batches.colSerialRange}</Th>
                                                <Th className="text-right">{t.batches.colTotal}</Th>
                                                <Th className="text-right">{t.batches.colUsed}</Th>
                                                <Th className="text-right">{t.batches.colRemaining}</Th>
                                                <Th>{t.batches.colStatus}</Th>
                                                <Th className="text-center">{t.batches.colActions}</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            {purchases.map(p => {
                                                const remaining = p.totalQty - p.usedQty
                                                const isExhaust = remaining <= 0
                                                const isLow = remaining > 0 && remaining < p.totalQty * 0.15

                                                return (
                                                    <Tr key={p.id}>
                                                        <Td>{formatDate(p.purchaseDate)}</Td>
                                                        <Td>
                                                            <span style={{
                                                                padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
                                                                background: p.stampType === 'UNDER_20_ABV' ? '#E0F2FE' : '#FEF3C7',
                                                                color: p.stampType === 'UNDER_20_ABV' ? '#0369A1' : '#B45309',
                                                            }}>
                                                                {p.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}
                                                            </span>
                                                        </Td>
                                                        <Td className="font-semibold text-lys-primary">{p.symbol}</Td>
                                                        <Td className="font-mono text-slate-600">
                                                            {p.serialStart} → {p.serialEnd}
                                                        </Td>
                                                        <Td className="text-right font-mono">{formatNumber(p.totalQty)}</Td>
                                                        <Td className="text-right font-mono text-slate-500">{formatNumber(p.usedQty)}</Td>
                                                        <Td className={cn(
                                                            'text-right font-mono font-semibold',
                                                            isExhaust ? 'text-rose-700' : isLow ? 'text-amber-600' : 'text-lys-teal-strong'
                                                        )}>
                                                            {formatNumber(remaining)}
                                                        </Td>
                                                        <Td>
                                                            {isExhaust ? (
                                                                <span className="inline-flex items-center gap-1 text-rose-700 text-xs">
                                                                    <AlertTriangle size={13} /> {t.batches.statusExhausted}
                                                                </span>
                                                            ) : isLow ? (
                                                                <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                                                                    <AlertTriangle size={13} /> {t.batches.statusLow}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-lys-teal-strong text-xs">
                                                                    <CheckCircle size={13} /> {t.batches.statusAvailable}
                                                                </span>
                                                            )}
                                                        </Td>
                                                        <Td className="text-center">
                                                            <div className="flex gap-1.5 justify-center">
                                                                {!isExhaust && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setUsageTargetPurchase(p)
                                                                            setUsageData({
                                                                                targetType: 'NONE',
                                                                                shipmentId: '',
                                                                                lotId: '',
                                                                                serialStart: '',
                                                                                serialEnd: '',
                                                                                qtyUsed: 0,
                                                                                qtyDamaged: 0,
                                                                                notes: '',
                                                                            })
                                                                        }}
                                                                        style={{
                                                                            padding: '4px 10px',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid #0891B2',
                                                                            background: '#F0FDFA',
                                                                            color: '#0891B2',
                                                                            fontSize: '12px',
                                                                            fontWeight: 500,
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        {t.batches.btnAllocateAndStick}
                                                                    </button>
                                                                )}
                                                                {!isExhaust && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setDestroyTargetPurchase(p)
                                                                            setDestroyData({
                                                                                qtyDestroyed: 0,
                                                                                reason: '',
                                                                                witnessName: '',
                                                                                destructionDate: new Date().toISOString().split('T')[0],
                                                                                notes: '',
                                                                            })
                                                                        }}
                                                                        style={{
                                                                            padding: '4px 10px',
                                                                            borderRadius: '4px',
                                                                            border: '1px solid #FCA5A5',
                                                                            background: '#FEF2F2',
                                                                            color: '#B91C1C',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                        }}
                                                                    >
                                                                        {t.batches.btnDestroy}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </Td>
                                                    </Tr>
                                                )
                                            })}
                                        </TBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: PHÂN TEM THEO ĐƠN PO */}
            {activeTab === 'po_allocations' && (
                <div style={cardStyle}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                            <h3 className="text-sm sm:text-base font-semibold text-lys-primary flex items-center gap-2 m-0">
                                <Stamp size={16} className="text-lys-teal" />
                                {t.poAlloc.title}
                            </h3>
                            <p className="text-xs text-lys-muted mt-1 m-0">
                                {t.poAlloc.subtitle}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-full sm:w-60">
                                <SearchInput
                                    placeholder={t.poAlloc.searchPlaceholder}
                                    value={poAllocSearch}
                                    onChange={e => setPOAllocSearch(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    if (receivedPOs.length === 0) {
                                        toast.info(t.toasts.noReceivedPO)
                                        return
                                    }
                                    setShowPOAllocModal(true)
                                    if (!selectedPOId && receivedPOs[0]) {
                                        handleSelectPO(receivedPOs[0].id)
                                    }
                                }}
                            >
                                <Plus size={14} className="mr-1.5" />
                                {t.poAlloc.btnNewPOAlloc}
                            </Button>
                        </div>
                    </div>

                    {/* Danh sách các đợt phân tem cho PO */}
                    {filteredPOAllocations.length === 0 ? (
                        <div className="text-center py-12 text-lys-muted">
                            <Stamp size={40} className="opacity-30 mx-auto mb-2" />
                            <p className="text-sm">{t.poAlloc.emptyTitle}</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    if (receivedPOs.length === 0) {
                                        toast.info(t.toasts.noReceivedPO)
                                        return
                                    }
                                    setShowPOAllocModal(true)
                                    if (!selectedPOId && receivedPOs[0]) {
                                        handleSelectPO(receivedPOs[0].id)
                                    }
                                }}
                                className="mt-2"
                            >
                                <Plus size={13} className="mr-1" />
                                {t.poAlloc.btnEmptyAction}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredPOAllocations.map(alloc => {
                                const expandKey = `${alloc.poNo}-${alloc.purchaseId}-${alloc.allocatedDate}`
                                const isExpanded = expandedPOId === expandKey

                                return (
                                    <div
                                        key={expandKey}
                                        className="border border-lys-border rounded-lg bg-white overflow-hidden shadow-xs transition-all"
                                    >
                                        {/* Row Summary */}
                                        <div
                                            onClick={() => setExpandedPOId(isExpanded ? null : expandKey)}
                                            className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 cursor-pointer select-none"
                                        >
                                            <div className="flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-400 bg-slate-100"
                                                >
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-lys-primary font-mono bg-cyan-50 border border-cyan-200 text-lys-teal-strong px-2 py-0.5 rounded">
                                                            {alloc.poNo}
                                                        </span>
                                                        <span className={cn(
                                                            'text-[11px] font-semibold px-2 py-0.5 rounded',
                                                            alloc.stampType === 'UNDER_20_ABV'
                                                                ? 'bg-sky-100 text-sky-800'
                                                                : 'bg-amber-100 text-amber-800'
                                                        )}>
                                                            {alloc.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}
                                                        </span>
                                                        <span className="text-xs text-lys-muted font-medium">
                                                            {t.poAlloc.stampBatch} <strong className="text-slate-700">{alloc.purchaseSymbol}</strong>
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-lys-muted mt-1">
                                                        <span>{t.poAlloc.allocatedDate} {formatDate(alloc.allocatedDate)}</span>
                                                        <span>•</span>
                                                        <span>{t.poAlloc.reporter} {alloc.reporterName}</span>
                                                        <span>•</span>
                                                        <span>{t.poAlloc.productsCount(alloc.items.length)}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Serial Range badge & Quick Sheet action */}
                                            <div className="flex flex-wrap items-center gap-3 pl-10 md:pl-0">
                                                <div className="text-right">
                                                    <div className="text-[11px] uppercase tracking-wider text-lys-muted font-semibold">
                                                        {t.poAlloc.serialRangeLabel}
                                                    </div>
                                                    <div className="font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded inline-block mt-0.5">
                                                        {alloc.serialStart} → {alloc.serialEnd}
                                                    </div>
                                                </div>
                                                <div className="text-right border-l pl-3 border-slate-200">
                                                    <div className="text-[11px] uppercase tracking-wider text-lys-muted font-semibold">
                                                        {t.poAlloc.totalStampsLabel}
                                                    </div>
                                                    <div className="font-bold text-lys-teal-strong text-base">
                                                        {formatNumber(alloc.totalQty)} <span className="text-xs font-normal text-slate-500">{t.poAlloc.unitBottles}</span>
                                                    </div>
                                                </div>
                                                <div className="border-l pl-3 border-slate-200">
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setStickingGuideAlloc(alloc)
                                                        }}
                                                        className="bg-lys-teal hover:bg-lys-teal-strong text-white font-medium shadow-xs"
                                                    >
                                                        <FileText size={14} className="mr-1.5" />
                                                        {t.poAlloc.btnViewGuide}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Products Breakdown Table */}
                                        {isExpanded && (
                                            <div className="border-t border-lys-border bg-slate-50/50 p-3 sm:p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-lys-muted m-0 flex items-center gap-1.5">
                                                        <Layers size={13} className="text-lys-teal" />
                                                        {t.poAlloc.breakdownTitle(alloc.poNo)}
                                                    </h4>
                                                    <span className="text-xs text-lys-muted">
                                                        {t.poAlloc.totalItems(alloc.items.length)}
                                                    </span>
                                                </div>

                                                <div className="overflow-x-auto rounded border border-lys-border bg-white no-scrollbar">
                                                    <table className="w-full text-xs sm:text-sm" style={{ borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                                                <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t.poAlloc.colNo}</th>
                                                                <th style={thStyle}>{t.poAlloc.colProductSku}</th>
                                                                <th style={{ ...thStyle, width: '90px' }}>{t.poAlloc.colLot}</th>
                                                                <th style={{ ...thStyle, width: '80px', textAlign: 'right' }}>{t.poAlloc.colTotalQty}</th>
                                                                <th style={{ ...thStyle, background: '#F0FDFA', color: '#0F766E', textAlign: 'center' }}>
                                                                    {t.poAlloc.colMainWh}
                                                                </th>
                                                                <th style={{ ...thStyle, background: '#FFFBEB', color: '#B45309', textAlign: 'center' }}>
                                                                    {t.poAlloc.colShowroom}
                                                                </th>
                                                                <th style={{ ...thStyle, background: '#ECFEFF', color: '#0891B2', textAlign: 'center' }}>
                                                                    {t.poAlloc.colTotalRange}
                                                                </th>
                                                                <th style={{ ...thStyle, width: '50px', textAlign: 'right' }}>{t.poAlloc.colDamaged}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {alloc.items.map((it, itemIdx) => {
                                                                const hasSplit = !!(it.qtySR && it.qtySR > 0)
                                                                return (
                                                                    <tr key={it.id || itemIdx} className="border-b border-slate-100 hover:bg-slate-50">
                                                                        <td style={{ ...tdStyle, textAlign: 'center', color: '#94A3B8' }}>{itemIdx + 1}</td>
                                                                        <td style={tdStyle}>
                                                                            <div className="font-semibold text-slate-900">{it.productName}</div>
                                                                            <div className="text-[11px] text-slate-500 font-mono">SKU: {it.skuCode}</div>
                                                                        </td>
                                                                        <td style={{ ...tdStyle, color: '#475569' }}>{it.lotNo || '—'}</td>
                                                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                                                            {formatNumber(it.qtyUsed)}
                                                                        </td>
                                                                        <td style={{ ...tdStyle, textAlign: 'center', background: '#F0FDFA' }}>
                                                                            <div className="font-mono font-bold text-teal-800">
                                                                                {it.mainSerialStart || it.serialStart} → {it.mainSerialEnd || it.serialEnd}
                                                                            </div>
                                                                            <div className="text-[10px] text-teal-600 font-semibold">
                                                                                {t.poAlloc.qtyPrefix} {formatNumber(it.qtyMain ?? (it.qtyUsed - (it.qtySR || 0)))} {t.poAlloc.unitBottles}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ ...tdStyle, textAlign: 'center', background: '#FFFBEB' }}>
                                                                            {hasSplit ? (
                                                                                <>
                                                                                    <div className="font-mono font-bold text-amber-800">
                                                                                        {it.srSerialStart} → {it.srSerialEnd}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-amber-600 font-semibold">
                                                                                        {t.poAlloc.qtyPrefix} {formatNumber(it.qtySR || 0)} {t.poAlloc.unitBottles}
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <span className="text-slate-400 text-xs italic">{t.poAlloc.noSplitSR}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="font-mono" style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#0891B2', background: '#F8FAFC' }}>
                                                                            {it.serialStart} → {it.serialEnd}
                                                                        </td>
                                                                        <td style={{ ...tdStyle, textAlign: 'right', color: it.qtyDamaged > 0 ? '#B91C1C' : '#94A3B8' }}>
                                                                            {it.qtyDamaged > 0 ? formatNumber(it.qtyDamaged) : '0'}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: ELECTRONIC LOGBOOK */}
            {activeTab === 'logbook' && (
                <div>
                    {/* Logbook Filters Bar */}
                    <div style={{
                        ...cardStyle,
                        marginBottom: '20px',
                        padding: '16px 20px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Filter size={14} style={{ color: '#64748B' }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{t.logbook.filterLabel}</span>
                            </div>

                            {/* Year select */}
                            <select
                                value={logYear}
                                onChange={e => setLogYear(parseInt(e.target.value))}
                                style={{ ...inputStyle, width: '110px' }}
                            >
                                {[currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(y => (
                                    <option key={y} value={y}>{t.logbook.yearOption(y)}</option>
                                ))}
                            </select>

                            {/* Quarter select */}
                            <select
                                value={logQuarter}
                                onChange={e => setLogQuarter(parseInt(e.target.value))}
                                style={{ ...inputStyle, width: '130px' }}
                            >
                                <option value={0}>{t.logbook.allYear}</option>
                                <option value={1}>{t.logbook.q1}</option>
                                <option value={2}>{t.logbook.q2}</option>
                                <option value={3}>{t.logbook.q3}</option>
                                <option value={4}>{t.logbook.q4}</option>
                            </select>

                            {/* Stamp Type select */}
                            <select
                                value={logStampType}
                                onChange={e => setLogStampType(e.target.value as any)}
                                style={{ ...inputStyle, width: '160px' }}
                            >
                                <option value="ALL">{t.logbook.allAbv}</option>
                                <option value="UNDER_20_ABV">{t.logbook.under20}</option>
                                <option value="OVER_20_ABV">{t.logbook.over20}</option>
                            </select>

                            {/* Search input */}
                            <div className="w-60">
                                <SearchInput
                                    placeholder={t.logbook.searchPlaceholder}
                                    value={logSearch}
                                    onChange={e => setLogSearch(e.target.value)}
                                />
                            </div>

                            <Button variant="secondary" size="sm" onClick={fetchLogbook} disabled={logbookLoading}>
                                <RefreshCw size={13} style={{ marginRight: '4px' }} className={logbookLoading ? 'animate-spin' : ''} />
                                {t.logbook.btnFilter}
                            </Button>
                        </div>

                        <div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleExportLogbook}
                                disabled={exportingLogbook}
                            >
                                <FileSpreadsheet size={14} style={{ marginRight: '6px' }} />
                                {exportingLogbook ? t.logbook.exporting : t.logbook.btnDownloadExcel}
                            </Button>
                        </div>
                    </div>

                    {/* Logbook Table */}
                    <div style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                                    {t.logbook.title}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    {t.logbook.subtitle}
                                </p>
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                                {t.logbook.showingCount(logbookEntries.length)}
                            </span>
                        </div>

                        {logbookEntries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                                <BookOpen size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p>{t.logbook.empty}</p>
                            </div>
                        ) : (
                            <>
                                {/* Mobile Cards (<768px) */}
                                <div className="block md:hidden space-y-3">
                                    {logbookEntries.map((e, idx) => (
                                        <div
                                            key={e.id}
                                            className={cn(
                                                'border rounded-lg p-3.5 shadow-2xs space-y-2',
                                                e.txType === 'NHAP_KHO'
                                                    ? 'bg-slate-50/70 border-slate-200'
                                                    : e.txType === 'HUY_TEM'
                                                        ? 'bg-rose-50/40 border-rose-200'
                                                        : 'bg-white border-lys-border'
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-mono text-slate-400">#{idx + 1}</span>
                                                        <span className="font-bold text-sm text-lys-primary">{e.symbol}</span>
                                                        <span className="text-xs text-lys-muted">{e.stampTypeLabel}</span>
                                                    </div>
                                                    <div className="text-xs text-lys-muted mt-0.5">
                                                        {formatDate(e.date)} • {e.reporterName}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                                    background: e.txType === 'NHAP_KHO' ? '#E0F2FE' : e.txType === 'HUY_TEM' ? '#FEE2E2' : '#F1F5F9',
                                                    color: e.txType === 'NHAP_KHO' ? '#0369A1' : e.txType === 'HUY_TEM' ? '#991B1B' : '#334155',
                                                }}>
                                                    {e.txLabel}
                                                </span>
                                            </div>

                                            <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700">
                                                {e.serialStart} → {e.serialEnd}
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                                                <div>
                                                    <span className="text-[10px] text-lys-muted block">{t.logbook.colQtyIn}</span>
                                                    <span className="font-mono font-semibold text-lys-teal-strong">
                                                        {e.qtyIn > 0 ? formatNumber(e.qtyIn) : '—'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-lys-muted block">{t.logbook.colQtyUsed}</span>
                                                    <span className="font-mono font-semibold text-lys-primary">
                                                        {e.qtyUsed > 0 ? formatNumber(e.qtyUsed) : '—'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-lys-muted block">{t.logbook.colQtyDamaged}</span>
                                                    <span className="font-mono font-semibold text-rose-700">
                                                        {e.qtyDamaged > 0 ? formatNumber(e.qtyDamaged) : '—'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-lys-muted block">{t.logbook.colBalanceAfter}</span>
                                                    <span className="font-mono font-bold text-cyan-800">
                                                        {formatNumber(e.balanceAfter)}
                                                    </span>
                                                </div>
                                            </div>

                                            {(e.referenceTitle || e.notes) && (
                                                <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-0.5">
                                                    {e.referenceTitle && <div className="font-medium truncate">{e.referenceTitle}</div>}
                                                    {e.notes && <div className="text-lys-muted truncate">{e.notes}</div>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Table (>=768px) */}
                                <div className="hidden md:block">
                                    <Table>
                                        <THead>
                                            <Tr>
                                                <Th className="text-center">{t.logbook.colNo}</Th>
                                                <Th>{t.logbook.colDate}</Th>
                                                <Th>{t.logbook.colTxType}</Th>
                                                <Th>{t.logbook.colSymbol}</Th>
                                                <Th>{t.logbook.colStampType}</Th>
                                                <Th>{t.logbook.colSerialStart}</Th>
                                                <Th>{t.logbook.colSerialEnd}</Th>
                                                <Th className="text-right">{t.logbook.colQtyIn}</Th>
                                                <Th className="text-right">{t.logbook.colQtyUsed}</Th>
                                                <Th className="text-right">{t.logbook.colQtyDamaged}</Th>
                                                <Th className="text-right">{t.logbook.colBalanceAfter}</Th>
                                                <Th>{t.logbook.colRef}</Th>
                                                <Th>{t.logbook.colReporter}</Th>
                                                <Th>{t.logbook.colNotes}</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            {logbookEntries.map((e, idx) => (
                                                <Tr key={e.id} className={cn(
                                                    e.txType === 'NHAP_KHO' && 'bg-slate-50/70',
                                                    e.txType === 'HUY_TEM' && 'bg-rose-50/40'
                                                )}>
                                                    <Td className="text-center text-slate-400">{idx + 1}</Td>
                                                    <Td>{formatDate(e.date)}</Td>
                                                    <Td>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                                                            background: e.txType === 'NHAP_KHO' ? '#E0F2FE' : e.txType === 'HUY_TEM' ? '#FEE2E2' : '#F1F5F9',
                                                            color: e.txType === 'NHAP_KHO' ? '#0369A1' : e.txType === 'HUY_TEM' ? '#991B1B' : '#334155',
                                                        }}>
                                                            {e.txLabel}
                                                        </span>
                                                    </Td>
                                                    <Td className="font-semibold text-lys-primary">{e.symbol}</Td>
                                                    <Td>{e.stampTypeLabel}</Td>
                                                    <Td className="font-mono">{e.serialStart}</Td>
                                                    <Td className="font-mono">{e.serialEnd}</Td>
                                                    <Td className={cn('text-right font-mono', e.qtyIn > 0 ? 'font-semibold text-lys-teal-strong' : 'text-slate-400')}>
                                                        {e.qtyIn > 0 ? formatNumber(e.qtyIn) : '—'}
                                                    </Td>
                                                    <Td className={cn('text-right font-mono', e.qtyUsed > 0 ? 'font-semibold text-lys-primary' : 'text-slate-400')}>
                                                        {e.qtyUsed > 0 ? formatNumber(e.qtyUsed) : '—'}
                                                    </Td>
                                                    <Td className={cn('text-right font-mono', e.qtyDamaged > 0 ? 'font-semibold text-rose-700' : 'text-slate-400')}>
                                                        {e.qtyDamaged > 0 ? formatNumber(e.qtyDamaged) : '—'}
                                                    </Td>
                                                    <Td className="text-right font-mono font-semibold text-cyan-800">
                                                        {formatNumber(e.balanceAfter)}
                                                    </Td>
                                                    <Td className="max-w-[200px] truncate" title={e.referenceTitle}>
                                                        {e.referenceTitle}
                                                    </Td>
                                                    <Td>{e.reporterName}</Td>
                                                    <Td className="text-slate-500 max-w-[180px] truncate" title={e.notes || ''}>
                                                        {e.notes || '—'}
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 4: DESTRUCTION RECORDS */}
            {activeTab === 'destructions' && (
                <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                        <div>
                            <h3 style={{ color: '#0F172A', margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trash2 size={16} style={{ color: '#B91C1C' }} />
                                {t.destructions.title}
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                {t.destructions.subtitle}
                            </p>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>
                            {t.destructions.totalCount(destructions.length)}
                        </span>
                    </div>

                    {destructions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: '#64748B' }}>
                            <Trash2 size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p>{t.destructions.empty}</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Cards (<768px) */}
                            <div className="block md:hidden space-y-3">
                                {destructions.map(d => (
                                    <div key={d.id} className="bg-white border border-lys-border rounded-lg p-3.5 shadow-2xs space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="font-bold text-sm text-lys-primary">{d.purchaseSymbol}</div>
                                                <div className="text-xs text-lys-muted mt-0.5">{formatDate(d.destructionDate)}</div>
                                            </div>
                                            <span className="font-mono font-bold text-sm text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded">
                                                -{formatNumber(d.qtyDestroyed)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-700 pt-2 border-t border-slate-100 space-y-1">
                                            <div>
                                                <span className="text-lys-muted">{t.destructions.colReason}:</span>{' '}
                                                <span className="font-medium">{d.reason}</span>
                                            </div>
                                            <div>
                                                <span className="text-lys-muted">{t.destructions.colWitness}:</span>{' '}
                                                <span className="font-medium">{d.witnessName}</span>
                                            </div>
                                            {d.notes && (
                                                <div className="text-lys-muted">{d.notes}</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table (>=768px) */}
                            <div className="hidden md:block">
                                <Table>
                                    <THead>
                                        <Tr>
                                            <Th>{t.destructions.colDate}</Th>
                                            <Th>{t.destructions.colBatch}</Th>
                                            <Th className="text-right">{t.destructions.colQtyDestroyed}</Th>
                                            <Th>{t.destructions.colReason}</Th>
                                            <Th>{t.destructions.colWitness}</Th>
                                            <Th>{t.destructions.colNotes}</Th>
                                        </Tr>
                                    </THead>
                                    <TBody>
                                        {destructions.map(d => (
                                            <Tr key={d.id}>
                                                <Td>{formatDate(d.destructionDate)}</Td>
                                                <Td className="font-semibold text-lys-primary">{d.purchaseSymbol}</Td>
                                                <Td className="text-right font-mono font-semibold text-rose-700">
                                                    {formatNumber(d.qtyDestroyed)}
                                                </Td>
                                                <Td className="text-slate-700">{d.reason}</Td>
                                                <Td>{d.witnessName}</Td>
                                                <Td className="text-slate-500 max-w-[300px]">{d.notes || '—'}</Td>
                                            </Tr>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* MODAL: PHÂN TEM & GHI NHẬN DÁN TEM */}
            {usageTargetPurchase && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
                }} onClick={() => setUsageTargetPurchase(null)}>
                    <div style={{ ...cardStyle, width: '560px', maxWidth: '95vw', borderColor: '#0891B2', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '16px', fontWeight: 600 }}>
                                    {t.usageModal.title}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    {t.poAlloc.stampBatch} <strong style={{ color: '#0891B2' }}>{usageTargetPurchase.symbol}</strong> ({usageTargetPurchase.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'}) — {t.usageModal.availableStock} <strong style={{ color: '#0F172A' }}>{formatNumber(usageTargetPurchase.totalQty - usageTargetPurchase.usedQty)}</strong> {t.batches.unitStamp}
                                </p>
                            </div>
                            <button onClick={() => setUsageTargetPurchase(null)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '14px' }}>
                                {t.batches.close}
                            </button>
                        </div>

                        <form onSubmit={handleRecordUsage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Phân bổ theo Lô hàng NK / Kho */}
                            <div>
                                <label style={labelStyle}>{t.usageModal.targetTypeLabel}</label>
                                <select
                                    value={usageData.targetType}
                                    onChange={e => setUsageData({ ...usageData, targetType: e.target.value as any, shipmentId: '', lotId: '' })}
                                    style={inputStyle}
                                >
                                    <option value="NONE">{t.usageModal.targetNone}</option>
                                    <option value="SHIPMENT">{t.usageModal.targetShipment}</option>
                                    <option value="STOCK_LOT">{t.usageModal.targetLot}</option>
                                </select>
                            </div>

                            {/* Dropdown Lô hàng NK */}
                            {usageData.targetType === 'SHIPMENT' && (
                                <div style={{ background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '6px', padding: '12px' }}>
                                    <label style={{ ...labelStyle, color: '#0D9488' }}>{t.usageModal.selectShipment}</label>
                                    <select
                                        value={usageData.shipmentId}
                                        onChange={e => setUsageData({ ...usageData, shipmentId: e.target.value })}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">{t.usageModal.selectShipmentPlaceholder}</option>
                                        {linkingOptions?.shipments.map(s => (
                                            <option key={s.id} value={s.id}>
                                                B/L: {s.billOfLading} ({s.status}) {s.vesselName ? `— ${t.usageModal.vessel} ${s.vesselName}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dropdown Lô Kho */}
                            {usageData.targetType === 'STOCK_LOT' && (
                                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '12px' }}>
                                    <label style={labelStyle}>{t.usageModal.selectLot}</label>
                                    <select
                                        value={usageData.lotId}
                                        onChange={e => setUsageData({ ...usageData, lotId: e.target.value })}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">{t.usageModal.selectLotPlaceholder}</option>
                                        {linkingOptions?.lots.map(l => (
                                            <option key={l.id} value={l.id}>
                                                {t.usageModal.lotPrefix} {l.lotNo} — {l.product.productName} ({t.usageModal.availPrefix} {formatNumber(Number(l.qtyAvailable))} {t.poAlloc.unitBottles})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Dải số seri nhập tay theo yêu cầu */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label style={labelStyle}>{t.usageModal.serialStart}</label>
                                    <input
                                        placeholder={t.usageModal.serialStartPlaceholder}
                                        value={usageData.serialStart}
                                        onChange={e => setUsageData({ ...usageData, serialStart: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.usageModal.serialEnd}</label>
                                    <input
                                        placeholder={t.usageModal.serialEndPlaceholder}
                                        value={usageData.serialEnd}
                                        onChange={e => setUsageData({ ...usageData, serialEnd: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Số lượng dán & hỏng */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label style={labelStyle}>{t.usageModal.qtyUsed}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={usageData.qtyUsed || ''}
                                        onChange={e => setUsageData({ ...usageData, qtyUsed: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.usageModal.qtyDamaged}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={usageData.qtyDamaged || ''}
                                        onChange={e => setUsageData({ ...usageData, qtyDamaged: parseInt(e.target.value) || 0 })}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <label style={labelStyle}>{t.usageModal.notes}</label>
                                <textarea
                                    rows={2}
                                    placeholder={t.usageModal.notesPlaceholder}
                                    value={usageData.notes}
                                    onChange={e => setUsageData({ ...usageData, notes: e.target.value })}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setUsageTargetPurchase(null)}>
                                    {t.batches.cancel}
                                </Button>
                                <Button type="submit" variant="primary" size="sm" disabled={loading}>
                                    {loading ? t.usageModal.submitting : t.usageModal.submit}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: BIÊN BẢN HỦY TEM */}
            {destroyTargetPurchase && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
                }} onClick={() => setDestroyTargetPurchase(null)}>
                    <div style={{ ...cardStyle, width: '520px', maxWidth: '95vw', borderColor: '#B91C1C' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ color: '#0F172A', margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Trash2 size={16} style={{ color: '#B91C1C' }} />
                                    {t.destroyModal.title}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                                    {t.poAlloc.stampBatch} {destroyTargetPurchase.symbol} — {t.usageModal.availPrefix} {formatNumber(destroyTargetPurchase.totalQty - destroyTargetPurchase.usedQty)} {t.batches.unitStamp}
                                </p>
                            </div>
                            <button onClick={() => setDestroyTargetPurchase(null)} style={{ border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: '14px' }}>
                                {t.batches.close}
                            </button>
                        </div>

                        <form onSubmit={handleDestruction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label style={labelStyle}>{t.destroyModal.qtyDestroyed}</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={destroyData.qtyDestroyed || ''}
                                        onChange={e => setDestroyData({ ...destroyData, qtyDestroyed: parseInt(e.target.value) || 0 })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>{t.destroyModal.destructionDate}</label>
                                    <input
                                        type="date"
                                        value={destroyData.destructionDate}
                                        onChange={e => setDestroyData({ ...destroyData, destructionDate: e.target.value })}
                                        required
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>{t.destroyModal.reason}</label>
                                <input
                                    placeholder={t.destroyModal.reasonPlaceholder}
                                    value={destroyData.reason}
                                    onChange={e => setDestroyData({ ...destroyData, reason: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>{t.destroyModal.witness}</label>
                                <input
                                    placeholder={t.destroyModal.witnessPlaceholder}
                                    value={destroyData.witnessName}
                                    onChange={e => setDestroyData({ ...destroyData, witnessName: e.target.value })}
                                    required
                                    style={inputStyle}
                                />
                            </div>

                            <div>
                                <label style={labelStyle}>{t.destroyModal.notes}</label>
                                <textarea
                                    rows={2}
                                    placeholder={t.destroyModal.notesPlaceholder}
                                    value={destroyData.notes}
                                    onChange={e => setDestroyData({ ...destroyData, notes: e.target.value })}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                                <Button type="button" variant="secondary" size="sm" onClick={() => setDestroyTargetPurchase(null)}>
                                    {t.batches.cancel}
                                </Button>
                                <Button type="submit" variant="primary" size="sm" disabled={loading} style={{ background: '#B91C1C' }}>
                                    {loading ? t.destroyModal.submitting : t.destroyModal.submit}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: PHÂN BỔ TEM CHO ĐƠN PO NHẬN VỀ */}
            {showPOAllocModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
                    }}
                    onClick={() => setShowPOAllocModal(false)}
                >
                    <div
                        style={{ ...cardStyle, width: '840px', maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto' }}
                        className="no-scrollbar"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-lys-border">
                            <div>
                                <h3 className="text-base font-bold text-lys-primary flex items-center gap-2 m-0">
                                    <Stamp size={18} className="text-lys-teal" />
                                    {t.poModal.title}
                                </h3>
                                <p className="text-xs text-lys-muted mt-0.5 m-0">
                                    {t.poModal.subtitle}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label={t.batches.close}
                                onClick={() => setShowPOAllocModal(false)}
                                className="border-none bg-transparent text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitPOAllocation} className="flex flex-col gap-4">
                            {/* Step 1: Chọn PO */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label style={labelStyle}>{t.poModal.step1SelectPO}</label>
                                    <select
                                        value={selectedPOId}
                                        onChange={e => handleSelectPO(e.target.value)}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">{t.poModal.selectPOPlaceholder}</option>
                                        {receivedPOs.map(po => (
                                            <option key={po.id} value={po.id}>
                                                {po.poNo} — {po.supplierName} ({po.items.length} {t.poModal.itemsShort}, {formatNumber(po.totalBottles)} {t.poAlloc.unitBottles})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={labelStyle}>{t.poModal.step2SelectBatch}</label>
                                    <select
                                        value={selectedStampPurchaseId}
                                        onChange={e => handleSelectPurchase(e.target.value)}
                                        required
                                        style={inputStyle}
                                    >
                                        <option value="">{t.poModal.selectBatchPlaceholder}</option>
                                        {purchases
                                            .filter(p => (p.totalQty - p.usedQty) > 0)
                                            .map(p => {
                                                const rem = p.totalQty - p.usedQty
                                                const typeLabel = p.stampType === 'UNDER_20_ABV' ? '< 20° ABV' : '≥ 20° ABV'
                                                return (
                                                    <option key={p.id} value={p.id}>
                                                        {p.symbol} ({typeLabel}) — {t.usageModal.availPrefix} {formatNumber(rem)} {t.batches.unitStamp} (Seri: {p.serialStart} → {p.serialEnd})
                                                    </option>
                                                )
                                            })}
                                    </select>
                                </div>
                            </div>

                            {/* PO & Stamp Details Card */}
                            {selectedPO && selectedPurchase && (
                                <div className="p-3 bg-slate-50 border border-lys-border rounded-md text-xs flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <span className="text-lys-muted">{t.poModal.poLabel}</span> <strong className="text-lys-primary font-mono">{selectedPO.poNo}</strong>
                                        <span className="mx-2">•</span>
                                        <span className="text-lys-muted">{t.poModal.supplierLabel}</span> <strong>{selectedPO.supplierName}</strong>
                                        <span className="mx-2">•</span>
                                        <span className="text-lys-muted">{t.poModal.totalBottlesReceived}</span> <strong className="text-lys-teal-strong">{formatNumber(selectedPO.totalBottles)} {t.poAlloc.unitBottles}</strong>
                                    </div>
                                    <div>
                                        <span className="text-lys-muted">{t.poModal.availableStamps}</span> <strong className="text-emerald-700 font-mono">{formatNumber(selectedPurchase.totalQty - selectedPurchase.usedQty)}</strong> {t.batches.unitStamp}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Dải Seri Bắt Đầu Tổng */}
                            <div className="p-3.5 bg-cyan-50/60 border border-cyan-200 rounded-md">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                                    <div>
                                        <label style={{ ...labelStyle, color: '#0891B2' }}>
                                            {t.poModal.step3BaseSerial}
                                        </label>
                                        <input
                                            className="font-mono"
                                            placeholder={t.poModal.baseSerialPlaceholder}
                                            value={poBaseSerialStart}
                                            onChange={e => handleBaseSerialChange(e.target.value)}
                                            required
                                            style={{ ...inputStyle, borderColor: '#0891B2', fontWeight: 600 }}
                                        />
                                        <span className="text-[11px] text-cyan-800 mt-1 block">
                                            {t.poModal.baseSerialHint}
                                        </span>
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <div className="text-[11px] uppercase tracking-wider text-cyan-800 font-semibold mb-1">
                                            {t.poModal.estimatedRangeLabel}
                                        </div>
                                        <div className="font-mono text-base font-bold text-lys-primary bg-white border border-cyan-300 rounded px-3 py-1.5 inline-block">
                                            {overallComputedRange.start && overallComputedRange.end ? (
                                                <span>{overallComputedRange.start} → {overallComputedRange.end}</span>
                                            ) : (
                                                <span className="text-slate-400 font-normal text-xs">{t.poModal.waitingBaseSerial}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Bảng phân chia cho các sản phẩm trong PO */}
                            {selectedPO && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label style={labelStyle} className="mb-0">
                                            {t.poModal.step4Breakdown}
                                        </label>
                                        <span className="text-[11px] text-lys-muted">
                                            {t.poModal.step4Hint}
                                        </span>
                                    </div>

                                    <div className="border border-lys-border rounded-md overflow-x-auto no-scrollbar">
                                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                                    <th style={thStyle}>{t.poModal.colProductSku}</th>
                                                    <th style={{ ...thStyle, width: '55px', textAlign: 'center' }}>{t.poModal.colAbv}</th>
                                                    <th style={{ ...thStyle, width: '80px', textAlign: 'right' }}>{t.poModal.colTotalQty}</th>
                                                    <th style={{ ...thStyle, width: '85px', textAlign: 'right', background: '#FFFBEB', color: '#B45309' }}>
                                                        {t.poModal.colSplitSR}
                                                    </th>
                                                    <th style={{ ...thStyle, width: '150px', textAlign: 'center', background: '#F0FDFA', color: '#0F766E' }}>
                                                        {t.poModal.colMainWh}
                                                    </th>
                                                    <th style={{ ...thStyle, width: '150px', textAlign: 'center', background: '#FFFBEB', color: '#B45309' }}>
                                                        {t.poModal.colShowroom}
                                                    </th>
                                                    <th style={{ ...thStyle, width: '140px', textAlign: 'center', background: '#ECFEFF', color: '#0891B2' }}>
                                                        {t.poModal.colTotalRange}
                                                    </th>
                                                    <th style={{ ...thStyle, width: '60px', textAlign: 'right' }}>{t.poModal.colDamaged}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedPO.items.map(it => {
                                                    const data = poItemSerials[it.productId] || {
                                                        qty: it.qty,
                                                        qtySR: 0,
                                                        qtyMain: it.qty,
                                                        start: '',
                                                        end: '',
                                                        mainStart: '',
                                                        mainEnd: '',
                                                        srStart: '',
                                                        srEnd: '',
                                                        damaged: 0,
                                                    }
                                                    const hasSR = (data.qtySR || 0) > 0

                                                    return (
                                                        <tr key={it.productId} className="border-b border-slate-200 hover:bg-slate-50/50">
                                                            <td style={tdStyle}>
                                                                <div className="font-semibold text-lys-primary">{it.productName}</div>
                                                                <div className="text-[11px] text-lys-muted font-mono">
                                                                    SKU: {it.skuCode} {it.lotNo ? `• ${t.usageModal.lotPrefix} ${it.lotNo}` : ''}
                                                                </div>
                                                            </td>
                                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                                <span className={cn(
                                                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                                                                    it.abvPercent < 20 ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                                                                )}>
                                                                    {it.abvPercent}%
                                                                </span>
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={data.qty}
                                                                    onChange={e => handleItemFieldChange(it.productId, 'qty', parseInt(e.target.value) || 0)}
                                                                    style={{ ...inputStyle, textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}
                                                                />
                                                            </td>
                                                            <td style={{ ...tdStyle, background: '#FFFDF5' }}>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={data.qty}
                                                                    placeholder="0"
                                                                    value={data.qtySR || ''}
                                                                    onChange={e => handleItemFieldChange(it.productId, 'qtySR', parseInt(e.target.value) || 0)}
                                                                    style={{ ...inputStyle, textAlign: 'right', padding: '4px 6px', fontWeight: 600, borderColor: '#F59E0B' }}
                                                                />
                                                            </td>
                                                            <td style={{ ...tdStyle, textAlign: 'center', background: '#F0FDFA' }}>
                                                                <div className="font-mono font-bold text-teal-900">
                                                                    {data.mainStart && data.mainEnd ? `${data.mainStart} → ${data.mainEnd}` : '—'}
                                                                </div>
                                                                <div className="text-[10px] text-teal-700 font-medium">
                                                                    {t.poAlloc.qtyPrefix} {formatNumber(data.qtyMain ?? (data.qty - (data.qtySR || 0)))} {t.poAlloc.unitBottles}
                                                                </div>
                                                            </td>
                                                            <td style={{ ...tdStyle, textAlign: 'center', background: '#FFFBEB' }}>
                                                                {hasSR ? (
                                                                    <>
                                                                        <div className="font-mono font-bold text-amber-900">
                                                                            {data.srStart && data.srEnd ? `${data.srStart} → ${data.srEnd}` : '—'}
                                                                        </div>
                                                                        <div className="text-[10px] text-amber-700 font-medium">
                                                                            {t.poAlloc.qtyPrefix} {formatNumber(data.qtySR)} {t.poAlloc.unitBottles}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-slate-400 text-[11px] italic">0 {t.poAlloc.unitBottles}</span>
                                                                )}
                                                            </td>
                                                            <td style={{ ...tdStyle, textAlign: 'center', background: '#F8FAFC' }}>
                                                                <div className="font-mono font-bold text-lys-teal-strong">
                                                                    {data.start && data.end ? `${data.start} → ${data.end}` : '—'}
                                                                </div>
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={data.damaged || 0}
                                                                    onChange={e => handleItemFieldChange(it.productId, 'damaged', parseInt(e.target.value) || 0)}
                                                                    style={{ ...inputStyle, textAlign: 'right', padding: '4px 6px', color: '#B91C1C' }}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Summary & Ghi chú */}
                            <div>
                                <label style={labelStyle}>{t.poModal.notesLabel}</label>
                                <textarea
                                    rows={2}
                                    placeholder={t.poModal.notesPlaceholder}
                                    value={poAllocNotes}
                                    onChange={e => setPOAllocNotes(e.target.value)}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-lys-border">
                                <div className="text-xs text-lys-muted">
                                    {t.poModal.totalRequired} <strong className="text-lys-primary font-mono text-sm">{formatNumber(modalTotalNeeded)}</strong> {t.batches.unitStamp}
                                    {selectedPurchase && (
                                        <span className={cn(
                                            'ml-2 font-medium',
                                            modalTotalNeeded > (selectedPurchase.totalQty - selectedPurchase.usedQty) ? 'text-rose-600 font-bold' : 'text-emerald-700'
                                        )}>
                                            ({t.poModal.inStock} {formatNumber(selectedPurchase.totalQty - selectedPurchase.usedQty)})
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setShowPOAllocModal(false)}
                                    >
                                        {t.poModal.cancel}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        size="sm"
                                        disabled={poAllocSubmitting || modalTotalNeeded <= 0}
                                    >
                                        {poAllocSubmitting ? t.poModal.submitting : t.poModal.submit}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL / VIEW: PHIẾU CHỈ DẪN DÁN TEM CHO NHÂN VIÊN */}
            {stickingGuideAlloc && (
                <div
                    className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-scrollbar print:p-0 print:bg-white print:static"
                    onClick={() => setStickingGuideAlloc(null)}
                >
                    <div
                        className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:m-0"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70 sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:static print:bg-transparent print:border-b-2 print:border-slate-800">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs font-mono uppercase bg-cyan-100 text-cyan-900 border border-cyan-300 px-2.5 py-0.5 rounded">
                                        {stickingGuideAlloc.poNo}
                                    </span>
                                    <span className={cn(
                                        'text-xs font-semibold px-2 py-0.5 rounded',
                                        stickingGuideAlloc.stampType === 'UNDER_20_ABV' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                                    )}>
                                        {stickingGuideAlloc.stampType === 'UNDER_20_ABV' ? t.guideModal.under20Badge : t.guideModal.over20Badge}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">
                                        {t.poAlloc.stampBatch} <strong className="text-slate-800">{stickingGuideAlloc.purchaseSymbol}</strong>
                                    </span>
                                </div>
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 m-0">
                                    {t.guideModal.title}
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5 m-0">
                                    {t.poModal.supplierLabel} <strong className="text-slate-700">{stickingGuideAlloc.supplierName || '—'}</strong> • {t.poAlloc.allocatedDate} {formatDate(stickingGuideAlloc.allocatedDate)} • {t.poAlloc.reporter} {stickingGuideAlloc.reporterName}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 print:hidden">
                                {/* Toggle view mode */}
                                <div className="bg-slate-200 p-0.5 rounded-lg flex items-center text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setStickingViewMode('cards')}
                                        className={cn(
                                            'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                                            stickingViewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        {t.guideModal.viewCards}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStickingViewMode('table')}
                                        className={cn(
                                            'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
                                            stickingViewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                        )}
                                    >
                                        {t.guideModal.viewTable}
                                    </button>
                                </div>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => window.print()}
                                    className="print:hidden"
                                >
                                    <Printer size={14} className="mr-1.5" />
                                    {t.guideModal.btnPrint}
                                </Button>
                                <button
                                    type="button"
                                    aria-label={t.batches.close}
                                    onClick={() => setStickingGuideAlloc(null)}
                                    className="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer print:hidden"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Overview Banner */}
                        {(() => {
                            const completedCount = stickingGuideAlloc.items.filter((it, idx) => stickingDoneMap[`${stickingGuideAlloc.poNo}-${it.id || idx}`]).length
                            const totalItems = stickingGuideAlloc.items.length
                            const isAllDone = totalItems > 0 && completedCount === totalItems

                            return (
                                <div className="p-4 sm:p-6 bg-slate-50/50 border-b border-slate-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                                {t.guideModal.kpiTotalBottles}
                                            </div>
                                            <div className="text-xl sm:text-2xl font-bold font-mono text-lys-teal-strong mt-0.5">
                                                {formatNumber(stickingGuideAlloc.totalQty)} <span className="text-xs font-normal text-slate-500">{t.poAlloc.unitBottles}</span>
                                            </div>
                                        </div>

                                        <div className="bg-white border border-cyan-200 rounded-lg p-3.5 shadow-xs bg-cyan-50/40">
                                            <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-800">
                                                {t.guideModal.kpiTotalRange}
                                            </div>
                                            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5">
                                                {stickingGuideAlloc.serialStart} → {stickingGuideAlloc.serialEnd}
                                            </div>
                                        </div>

                                        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
                                            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                                <span>{t.guideModal.kpiProgress}</span>
                                                <span className="font-mono text-slate-800 font-bold">
                                                    {completedCount}/{totalItems} {t.poModal.itemsShort}
                                                </span>
                                            </div>
                                            <div className="bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                                                <div
                                                    className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                                                    style={{ width: `${(completedCount / (totalItems || 1)) * 100}%` }}
                                                />
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {isAllDone ? (
                                                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> {t.guideModal.allDone}
                                                    </span>
                                                ) : (
                                                    t.guideModal.tapHint
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {/* Sticking Content: Cards View (Default mobile/tablet friendly) */}
                        {stickingViewMode === 'cards' && (
                            <div className="p-4 sm:p-6 space-y-3.5">
                                {stickingGuideAlloc.items.map((it, idx) => {
                                    const itemKey = `${stickingGuideAlloc.poNo}-${it.id || idx}`
                                    const isDone = !!stickingDoneMap[itemKey]
                                    const hasSplit = !!(it.qtySR && it.qtySR > 0)

                                    return (
                                        <div
                                            key={itemKey}
                                            className={cn(
                                                'border rounded-lg p-4 transition-all shadow-xs',
                                                isDone
                                                    ? 'bg-emerald-50/40 border-emerald-300'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            )}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                                                        isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                                                    )}>
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                                                            {it.productName}
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                                                                SKU: {it.skuCode}
                                                            </span>
                                                            {it.lotNo && (
                                                                <span>{t.usageModal.lotPrefix} <strong className="text-slate-700">{it.lotNo}</strong></span>
                                                            )}
                                                            <span>•</span>
                                                            <span className="text-slate-800 font-semibold">
                                                                {t.guideModal.totalToStick} {formatNumber(it.qtyUsed)} {t.poAlloc.unitBottles}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => setStickingDoneMap(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                                                    className={cn(
                                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0 print:hidden self-start sm:self-auto',
                                                        isDone
                                                            ? 'bg-emerald-600 text-white shadow-xs'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    )}
                                                >
                                                    <CheckCircle2 size={15} />
                                                    <span>{isDone ? t.guideModal.btnDone : t.guideModal.btnMarkDone}</span>
                                                </button>
                                            </div>

                                            {/* Serial Ranges */}
                                            <div className="mt-3.5 pt-3 border-t border-slate-100">
                                                {hasSplit ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        {/* Kho Thanh Trì */}
                                                        <div className="p-3 rounded-lg bg-teal-50/70 border border-teal-200">
                                                            <div className="flex items-center justify-between text-xs font-bold text-teal-900 mb-1">
                                                                <span className="flex items-center gap-1">
                                                                    <Warehouse size={13} className="text-teal-700" />
                                                                    {t.guideModal.mainWhTitle}
                                                                </span>
                                                                <span className="font-mono bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                                                                    {formatNumber(it.qtyMain ?? (it.qtyUsed - (it.qtySR || 0)))} {t.poAlloc.unitBottles}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-teal-700 font-medium">{t.guideModal.serialRangeLabel}</div>
                                                            <div className="font-mono text-base sm:text-lg font-extrabold text-teal-950 mt-0.5">
                                                                {it.mainSerialStart || it.serialStart} → {it.mainSerialEnd || it.serialEnd}
                                                            </div>
                                                        </div>

                                                        {/* Showroom */}
                                                        <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200">
                                                            <div className="flex items-center justify-between text-xs font-bold text-amber-900 mb-1">
                                                                <span className="flex items-center gap-1">
                                                                    <Store size={13} className="text-amber-700" />
                                                                    {t.guideModal.srTransferTitle}
                                                                </span>
                                                                <span className="font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                                                    {formatNumber(it.qtySR || 0)} {t.poAlloc.unitBottles}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-amber-700 font-medium">{t.guideModal.serialRangeLabel}</div>
                                                            <div className="font-mono text-base sm:text-lg font-extrabold text-amber-950 mt-0.5">
                                                                {it.srSerialStart} → {it.srSerialEnd}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div>
                                                            <div className="text-xs text-slate-500 font-medium">{t.guideModal.allMainWhRangeLabel}</div>
                                                            <div className="font-mono text-base sm:text-lg font-extrabold text-lys-teal-strong mt-0.5">
                                                                {it.serialStart} → {it.serialEnd}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-semibold text-slate-700 font-mono bg-white px-2.5 py-1 rounded border border-slate-200 inline-block self-start sm:self-auto">
                                                            {t.guideModal.qtyLabel} {formatNumber(it.qtyUsed)} {t.poAlloc.unitBottles}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Sticking Content: Table View */}
                        {stickingViewMode === 'table' && (
                            <div className="p-4 sm:p-6 overflow-x-auto no-scrollbar">
                                <table className="w-full text-xs sm:text-sm" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                                            <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>{t.poAlloc.colNo}</th>
                                            <th style={thStyle}>{t.poAlloc.colProductSku}</th>
                                            <th style={{ ...thStyle, width: '80px', textAlign: 'right' }}>{t.poAlloc.colTotalQty}</th>
                                            <th style={{ ...thStyle, background: '#F0FDFA', color: '#0F766E', textAlign: 'center' }}>
                                                {t.poAlloc.colMainWh}
                                            </th>
                                            <th style={{ ...thStyle, background: '#FFFBEB', color: '#B45309', textAlign: 'center' }}>
                                                {t.poAlloc.colShowroom}
                                            </th>
                                            <th style={{ ...thStyle, background: '#ECFEFF', color: '#0891B2', textAlign: 'center' }}>
                                                {t.poAlloc.colTotalRange}
                                            </th>
                                            <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>{t.guideModal.colProgress}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {stickingGuideAlloc.items.map((it, idx) => {
                                            const itemKey = `${stickingGuideAlloc.poNo}-${it.id || idx}`
                                            const isDone = !!stickingDoneMap[itemKey]
                                            const hasSplit = !!(it.qtySR && it.qtySR > 0)

                                            return (
                                                <tr
                                                    key={itemKey}
                                                    onClick={() => setStickingDoneMap(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                                                    className={cn(
                                                        'border-b border-slate-100 hover:bg-slate-50/80 cursor-pointer transition-colors',
                                                        isDone && 'bg-emerald-50/40'
                                                    )}
                                                >
                                                    <td style={{ ...tdStyle, textAlign: 'center', color: '#94A3B8' }}>{idx + 1}</td>
                                                    <td style={tdStyle}>
                                                        <div className="font-semibold text-slate-900">{it.productName}</div>
                                                        <div className="text-[11px] text-slate-500 font-mono">SKU: {it.skuCode}</div>
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                                                        {formatNumber(it.qtyUsed)}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center', background: '#F0FDFA' }}>
                                                        <div className="font-mono font-bold text-teal-900">
                                                            {it.mainSerialStart || it.serialStart} → {it.mainSerialEnd || it.serialEnd}
                                                        </div>
                                                        <div className="text-[10px] text-teal-700 font-semibold">
                                                            {t.poAlloc.qtyPrefix} {formatNumber(it.qtyMain ?? (it.qtyUsed - (it.qtySR || 0)))} {t.poAlloc.unitBottles}
                                                        </div>
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center', background: '#FFFBEB' }}>
                                                        {hasSplit ? (
                                                            <>
                                                                <div className="font-mono font-bold text-amber-900">
                                                                    {it.srSerialStart} → {it.srSerialEnd}
                                                                </div>
                                                                <div className="text-[10px] text-amber-700 font-semibold">
                                                                    {t.poAlloc.qtyPrefix} {formatNumber(it.qtySR || 0)} {t.poAlloc.unitBottles}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs italic">{t.poAlloc.noSplitSR}</span>
                                                        )}
                                                    </td>
                                                    <td className="font-mono" style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: '#0891B2', background: '#F8FAFC' }}>
                                                        {it.serialStart} → {it.serialEnd}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                        <span className={cn(
                                                            'inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded',
                                                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                                        )}>
                                                            <CheckCircle2 size={13} />
                                                            {isDone ? t.guideModal.statusDone : t.guideModal.statusPending}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-4 sm:p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 print:hidden">
                            <span>
                                {t.guideModal.footerNote}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setStickingGuideAlloc(null)}
                            >
                                {t.guideModal.btnCloseSheet}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
