'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
    Plus, Search, Trash2, Loader2, X, Check, Ban, Calendar, Settings,
    ShieldAlert, AlertCircle, HelpCircle, FileText, Copy, Building2,
    CheckSquare, Square, Sparkles, Share2, ArrowRight, Eye, SlidersHorizontal,
    Percent, Zap, ChevronRight, CheckCircle2, Clock, ArrowUpRight, RefreshCw
} from 'lucide-react'
import {
    getCustomerPriceRules,
    createCustomerPriceRule,
    updateCustomerPriceRule,
    approveCustomerPriceRule,
    rejectCustomerPriceRule,
    deleteCustomerPriceRule,
    getChannelPriceMapping,
    saveChannelPriceMapping,
    getCustomersForRules,
    cloneCustomerPriceRules,
    getCustomerPricingMasterOverview,
    updateCustomerDefaultPricing,
    getCustomerSpecialPriceDetail,
    PriceRuleRow,
    CustomerPricingMasterRow,
    CustomerPricingMasterResult,
} from './customer-rules-actions'
import { getProductsForPriceList } from './actions'
import { formatVND } from '@/lib/utils'

const RULE_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    FIXED_DISCOUNT: { label: 'Chiết Khấu %', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    FIXED_PRICE: { label: 'Giá Cố Định', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    SPECIAL_PRICE: { label: 'Giá Đặc Biệt', color: '#0891B2', bg: 'rgba(8,145,178,0.15)' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    APPROVED: { label: 'Đã Duyệt', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    REJECTED: { label: 'Từ Chối', color: '#E11D48', bg: 'rgba(225,29,72,0.15)' },
}

const CHANNEL_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    HORECA: { label: 'HORECA', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    WHOLESALE_DISTRIBUTOR: { label: 'Đại Lý', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    VIP_RETAIL: { label: 'VIP Retail', color: '#0891B2', bg: 'rgba(8,145,178,0.15)' },
    DIRECT_INDIVIDUAL: { label: 'Trực Tiếp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
}

interface CustomerOption {
    id: string
    name: string
    code: string
    channel: string | null
    brandGroup?: string | null
    parentId?: string | null
}

interface Props {
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
}

export function CustomerRulesTab({ currentUser }: Props) {
    // ─── Modes & Master Overview ─────────────────────
    const [viewMode, setViewMode] = useState<'CUSTOMERS' | 'RULES'>('CUSTOMERS')
    const [masterOverview, setMasterOverview] = useState<CustomerPricingMasterResult | null>(null)
    const [rules, setRules] = useState<PriceRuleRow[]>([])
    const [customers, setCustomers] = useState<CustomerOption[]>([])
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Master Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [filterChannel, setFilterChannel] = useState('ALL')
    const [filterMasterType, setFilterMasterType] = useState<'ALL' | 'HAS_SPECIAL' | 'HAS_CUSTOM_DISCOUNT' | 'PENDING'>('ALL')

    // Rule Audit Filters
    const [filterCustomer, setFilterCustomer] = useState('ALL')
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterType, setFilterType] = useState('ALL')

    // Drawer state (Chi tiết giá đặc biệt của 1 khách hàng)
    const [drawerCustomer, setDrawerCustomer] = useState<{ id: string; name: string; code: string } | null>(null)
    const [drawerDetails, setDrawerDetails] = useState<Awaited<ReturnType<typeof getCustomerSpecialPriceDetail>> | null>(null)
    const [drawerLoading, setDrawerLoading] = useState(false)

    // Quick Change Default Policy Modal
    const [policyModalCustomer, setPolicyModalCustomer] = useState<CustomerPricingMasterRow | null>(null)
    const [policyBasePriceType, setPolicyBasePriceType] = useState<string>('BY_CHANNEL')
    const [policyDiscountPct, setPolicyDiscountPct] = useState<number>(0)
    const [policySaving, setPolicySaving] = useState(false)

    // Form state for creating single rule
    const [createOpen, setCreateOpen] = useState(false)
    const [formCustomer, setFormCustomer] = useState('')
    const [formProduct, setFormProduct] = useState('')
    const [formType, setFormType] = useState<'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'>('FIXED_DISCOUNT')
    const [formValue, setFormValue] = useState('')
    const [formStart, setFormStart] = useState(new Date().toISOString().slice(0, 10))
    const [formEnd, setFormEnd] = useState('')
    const [formNotes, setFormNotes] = useState('')
    const [formProductSearch, setFormProductSearch] = useState('')
    const [formCustomerSearch, setFormCustomerSearch] = useState('')

    // Clone Modal state
    const [cloneModalOpen, setCloneModalOpen] = useState(false)
    const [cloneSourceCustomer, setCloneSourceCustomer] = useState('')
    const [cloneTargetCustomers, setCloneTargetCustomers] = useState<string[]>([])
    const [cloneSelectedRuleIds, setCloneSelectedRuleIds] = useState<string[]>([])
    const [cloneOverrideExisting, setCloneOverrideExisting] = useState(true)
    const [cloneSearchTarget, setCloneSearchTarget] = useState('')
    const [cloning, setCloning] = useState(false)

    // Permissions check
    const canApprove = currentUser?.permissions.includes('SLS:APPROVE') || currentUser?.roles.includes('CEO')
    const canCreate = currentUser?.permissions.includes('SLS:CREATE')

    // ─── Data Loading ─────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [overviewData, rulesData, customersData, productsData] = await Promise.all([
                getCustomerPricingMasterOverview({
                    search: searchQuery,
                    channel: filterChannel !== 'ALL' ? filterChannel : undefined,
                    filterType: filterMasterType,
                }),
                getCustomerPriceRules(),
                getCustomersForRules(),
                getProductsForPriceList()
            ])
            setMasterOverview(overviewData)
            setRules(rulesData)
            setCustomers(customersData)
            setProducts(productsData)
        } catch (e) {
            console.error('Failed to load pricing data', e)
        }
        setLoading(false)
    }, [searchQuery, filterChannel, filterMasterType])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Open Customer Inspection Drawer
    const handleOpenDrawer = async (cust: { id: string; name: string; code: string }) => {
        setDrawerCustomer(cust)
        setDrawerLoading(true)
        try {
            const details = await getCustomerSpecialPriceDetail(cust.id)
            setDrawerDetails(details)
        } catch (err) {
            console.error('Failed to load customer detail', err)
        } finally {
            setDrawerLoading(false)
        }
    }

    const refreshDrawer = async () => {
        if (!drawerCustomer) return
        setDrawerLoading(true)
        try {
            const details = await getCustomerSpecialPriceDetail(drawerCustomer.id)
            setDrawerDetails(details)
        } catch (err) {
            console.error('Failed to refresh drawer', err)
        } finally {
            setDrawerLoading(false)
        }
    }

    // Open Policy Modal
    const handleOpenPolicyModal = (cust: CustomerPricingMasterRow) => {
        setPolicyModalCustomer(cust)
        setPolicyBasePriceType(cust.basePriceType || 'BY_CHANNEL')
        setPolicyDiscountPct(cust.defaultDiscountPct || 0)
    }

    // Save Policy Modal
    const handleSavePolicy = async () => {
        if (!policyModalCustomer) return
        setPolicySaving(true)
        const res = await updateCustomerDefaultPricing(policyModalCustomer.id, {
            basePriceType: policyBasePriceType,
            defaultDiscountPct: Number(policyDiscountPct),
        })
        if (res.success) {
            setPolicyModalCustomer(null)
            await loadData()
            if (drawerCustomer?.id === policyModalCustomer.id) {
                await refreshDrawer()
            }
        } else {
            alert('Lỗi cập nhật: ' + res.error)
        }
        setPolicySaving(false)
    }

    // Open Add Single Rule Modal with preselected customer
    const handleOpenCreateWithCustomer = (custId: string) => {
        setFormCustomer(custId)
        setFormProduct('')
        setFormValue('')
        setFormEnd('')
        setFormNotes('')
        setFormType('SPECIAL_PRICE')
        setCreateOpen(true)
    }

    // Create Rule Action
    const handleCreateRule = async () => {
        if (!formCustomer || !formProduct || !formValue) {
            alert('Vui lòng điền đầy đủ Khách hàng, Sản phẩm và Giá trị')
            return
        }
        setSaving(true)
        const res = await createCustomerPriceRule({
            customerId: formCustomer,
            productId: formProduct,
            ruleType: formType,
            value: Number(formValue),
            startDate: formStart,
            endDate: formEnd || undefined,
            notes: formNotes,
        })
        if (res.success) {
            setCreateOpen(false)
            setFormCustomer('')
            setFormProduct('')
            setFormValue('')
            setFormEnd('')
            setFormNotes('')
            setFormProductSearch('')
            setFormCustomerSearch('')
            await loadData()
            if (drawerCustomer?.id === formCustomer) {
                await refreshDrawer()
            }
        } else {
            alert('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    const handleApprove = async (id: string) => {
        const comment = prompt('Nhập ghi chú phê duyệt (tùy chọn):')
        if (comment === null) return
        setLoading(true)
        const res = await approveCustomerPriceRule(id, comment)
        if (res.success) {
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            alert('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    const handleReject = async (id: string) => {
        const comment = prompt('Nhập lý do từ chối (bắt buộc):')
        if (!comment) {
            if (comment !== null) alert('Lý do từ chối là bắt buộc')
            return
        }
        setLoading(true)
        const res = await rejectCustomerPriceRule(id, comment)
        if (res.success) {
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            alert('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn chắc chắn muốn xóa chính sách giá này?')) return
        setLoading(true)
        const res = await deleteCustomerPriceRule(id)
        if (res.success) {
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            alert('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    // Clone Modal helpers
    const openCloneModal = (sourceCustId?: string) => {
        const initialSourceId = sourceCustId || (filterCustomer !== 'ALL' ? filterCustomer : customers[0]?.id || '')
        setCloneSourceCustomer(initialSourceId)
        setCloneTargetCustomers([])
        setCloneSearchTarget('')
        setCloneOverrideExisting(true)

        const sourceRules = rules.filter(r => r.customerId === initialSourceId && r.status === 'APPROVED')
        setCloneSelectedRuleIds(sourceRules.map(r => r.id))
        setCloneModalOpen(true)
    }

    const handleExecuteClone = async () => {
        if (!cloneSourceCustomer) {
            alert('Vui lòng chọn khách hàng nguồn')
            return
        }
        if (cloneTargetCustomers.length === 0) {
            alert('Vui lòng chọn ít nhất 1 cơ sở đích cần áp dụng cơ chế giá')
            return
        }
        if (cloneSelectedRuleIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 chính sách giá cần sao chép')
            return
        }

        setCloning(true)
        const res = await cloneCustomerPriceRules({
            sourceCustomerId: cloneSourceCustomer,
            targetCustomerIds: cloneTargetCustomers,
            ruleIds: cloneSelectedRuleIds,
            overrideExisting: cloneOverrideExisting
        })

        if (res.success) {
            alert(`✅ Đã sao chép thành công ${res.clonedCount} chính sách giá sang ${res.targetCount} cơ sở đích!`)
            setCloneModalOpen(false)
            await loadData()
        } else {
            alert('Lỗi: ' + res.error)
        }
        setCloning(false)
    }

    // Filter rules for Audit View
    const filteredRules = useMemo(() => {
        return rules.filter(r => {
            const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus
            const matchesType = filterType === 'ALL' || r.ruleType === filterType
            const matchesCustomer = filterCustomer === 'ALL' || r.customerId === filterCustomer
            const matchesSearch = !searchQuery ||
                r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.customerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.skuCode.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesStatus && matchesType && matchesCustomer && matchesSearch
        })
    }, [rules, filterStatus, filterType, filterCustomer, searchQuery])

    // Format Base Price Type Display
    const formatBaseType = (basePriceType: string, defaultDiscountPct: number) => {
        let label = 'Theo Kênh Chuẩn'
        if (basePriceType === 'WHOLESALE') label = 'Bảng Giá Buôn (Wholesale)'
        else if (basePriceType === 'RETAIL') label = 'Bảng Giá Lẻ (Retail)'
        else if (basePriceType === 'HORECA') label = 'Bảng Giá HORECA'

        if (defaultDiscountPct > 0) {
            return (
                <div className="flex flex-col">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        {label} <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">-{defaultDiscountPct}%</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Tự động áp dụng cho mọi sản phẩm</span>
                </div>
            )
        }

        return (
            <div className="flex flex-col">
                <span className="font-medium text-slate-300">{label}</span>
                <span className="text-[10px] text-slate-500">Nguyên giá niêm yết</span>
            </div>
        )
    }

    return (
        <div className="w-full space-y-4">
            {/* Top Switcher & Action Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-lg bg-[#142433] border border-[#2A4355] shadow-sm">
                {/* Dual-View Switcher */}
                <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#182F40] border border-[#2E4E67]">
                    <button
                        type="button"
                        onClick={() => setViewMode('CUSTOMERS')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all ${
                            viewMode === 'CUSTOMERS'
                                ? 'bg-[#87CBB9] text-[#0A1926] shadow-sm font-bold'
                                : 'text-slate-200 hover:text-white hover:bg-white/15'
                        }`}
                    >
                        <Building2 size={15} />
                        Theo Khách Hàng (Tổng Quan Cơ Chế & Giá)
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('RULES')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-all ${
                            viewMode === 'RULES'
                                ? 'bg-[#87CBB9] text-[#0A1926] shadow-sm font-bold'
                                : 'text-slate-200 hover:text-white hover:bg-white/15'
                        }`}
                    >
                        <Sparkles size={15} />
                        Toàn Bộ Quy Tắc (Audit & Duyệt Deal)
                    </button>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => openCloneModal()}
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition shadow-sm hover:opacity-90"
                            style={{ background: 'rgba(212,168,83,0.18)', border: '1px solid rgba(212,168,83,0.4)', color: '#D4A853' }}
                        >
                            <Copy size={14} /> Áp Dụng Cho Cơ Sở Khác
                        </button>
                    )}
                    {canCreate && (
                        <Link
                            href="/dashboard/proposals?category=PRICE_ADJUSTMENT&action=create"
                            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition shadow-sm hover:opacity-90"
                            style={{ background: 'rgba(135,203,185,0.15)', border: '1px solid #87CBB9', color: '#87CBB9' }}
                        >
                            <FileText size={14} /> + Đề Xuất Giá (Tờ Trình)
                        </Link>
                    )}
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => {
                                setFormCustomer(customers[0]?.id || '')
                                setCreateOpen(true)
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition shadow-md hover:opacity-90"
                            style={{ background: '#87CBB9', color: '#0A1926' }}
                        >
                            <Plus size={15} /> + Thêm Giá Đặc Biệt
                        </button>
                    )}
                </div>
            </div>

            {/* 4 Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg border border-[#2A4355] bg-[#1B2E3D]">
                    <div className="flex items-center justify-between text-[#8AAEBB] text-xs">
                        <span>Tổng Khách Hàng</span>
                        <Building2 size={16} className="text-[#87CBB9]" />
                    </div>
                    <div className="text-2xl font-bold text-[#E8F1F2] mt-1.5">
                        {masterOverview?.kpis.totalCustomers ?? customers.length}
                    </div>
                    <p className="text-[11px] text-[#4A6A7A] mt-0.5">Tác nghiệp toàn hệ thống</p>
                </div>

                <div className="p-3.5 rounded-lg border border-[#2A4355] bg-[#1B2E3D]">
                    <div className="flex items-center justify-between text-[#8AAEBB] text-xs">
                        <span>Cơ Chế Chiết Khấu Riêng</span>
                        <Percent size={16} className="text-[#D4A853]" />
                    </div>
                    <div className="text-2xl font-bold text-[#D4A853] mt-1.5">
                        {masterOverview?.kpis.customPolicyCount ?? 0}
                    </div>
                    <p className="text-[11px] text-[#4A6A7A] mt-0.5">Wholesale -X% / Retail -Y% tự động</p>
                </div>

                <div className="p-3.5 rounded-lg border border-[#2A4355] bg-[#1B2E3D]">
                    <div className="flex items-center justify-between text-[#8AAEBB] text-xs">
                        <span>Khách Có Giá Đặc Biệt</span>
                        <Zap size={16} className="text-[#38BDF8]" />
                    </div>
                    <div className="text-2xl font-bold text-[#38BDF8] mt-1.5">
                        {masterOverview?.kpis.hasSpecialPriceCount ?? 0}
                    </div>
                    <p className="text-[11px] text-[#4A6A7A] mt-0.5">Có thỏa thuận giá riêng theo chai</p>
                </div>

                <div className="p-3.5 rounded-lg border border-[#2A4355] bg-[#1B2E3D]">
                    <div className="flex items-center justify-between text-[#8AAEBB] text-xs">
                        <span>Đề Xuất Chờ Duyệt</span>
                        <AlertCircle size={16} className="text-[#F59E0B]" />
                    </div>
                    <div className="text-2xl font-bold text-[#F59E0B] mt-1.5">
                        {masterOverview?.kpis.pendingRulesCount ?? 0}
                    </div>
                    <p className="text-[11px] text-[#4A6A7A] mt-0.5">Chờ Ban Giám Đốc / QL duyệt</p>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE 1: CUSTOMER-CENTRIC MASTER OVERVIEW (TRUNG TÂM QUẢN LÝ CHUNG) */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {viewMode === 'CUSTOMERS' && (
                <div className="space-y-3">
                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-[#142433] border border-[#2A4355]">
                        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                            <div className="relative flex-1 md:w-72">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Tìm tên, mã khách hàng..."
                                    style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs outline-none bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white placeholder:text-slate-400 rounded-md transition shadow-xs"
                                />
                            </div>

                            <select
                                value={filterChannel}
                                onChange={e => setFilterChannel(e.target.value)}
                                style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white rounded-md transition shadow-xs"
                            >
                                <option value="ALL">Tất cả Kênh</option>
                                <option value="HORECA">Kênh HORECA</option>
                                <option value="WHOLESALE_DISTRIBUTOR">Đại Lý Phân Phối</option>
                                <option value="VIP_RETAIL">Khách VIP Retail</option>
                                <option value="DIRECT_INDIVIDUAL">Khách Trực Tiếp</option>
                            </select>

                            <select
                                value={filterMasterType}
                                onChange={e => setFilterMasterType(e.target.value as any)}
                                style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white rounded-md transition shadow-xs"
                            >
                                <option value="ALL">Tất cả Cơ Chế</option>
                                <option value="HAS_SPECIAL">Có Giá Đặc Biệt (⚡)</option>
                                <option value="HAS_CUSTOM_DISCOUNT">Có Chiết Khấu Mặc Định (%)</option>
                                <option value="PENDING">Có Deal Chờ Duyệt (⏳)</option>
                            </select>
                        </div>

                        <div className="text-xs text-slate-300">
                            Hiển thị <strong className="text-white">{masterOverview?.customers.length ?? 0}</strong> khách hàng
                        </div>
                    </div>

                    {/* Master Customers Table */}
                    <div className="rounded-lg overflow-hidden border border-[#2A4355] bg-[#1B2E3D]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#142433] text-[#8AAEBB] border-b border-[#2A4355]">
                                        <th className="p-3.5 font-semibold">Khách Hàng & Kênh</th>
                                        <th className="p-3.5 font-semibold">Cơ Chế Giá Mặc Định (Toàn Kho)</th>
                                        <th className="p-3.5 font-semibold">Tình Trạng Giá Đặc Biệt (Theo Chai)</th>
                                        <th className="p-3.5 text-right font-semibold">Hành Động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2A4355]">
                                    {loading && !masterOverview ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-14">
                                                <Loader2 className="animate-spin mx-auto text-[#87CBB9]" size={28} />
                                                <p className="mt-2 text-xs text-[#8AAEBB]">Đang tải ma trận giá khách hàng...</p>
                                            </td>
                                        </tr>
                                    ) : masterOverview?.customers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12 text-[#8AAEBB]">
                                                Không tìm thấy khách hàng nào phù hợp bộ lọc.
                                            </td>
                                        </tr>
                                    ) : (
                                        masterOverview?.customers.map(c => {
                                            const chBadge = CHANNEL_BADGES[c.channel] ?? { label: c.channel, color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' }
                                            const hasSpecial = c.specialRuleCount > 0
                                            const hasPending = c.pendingRuleCount > 0

                                            return (
                                                <tr key={c.id} className="hover:bg-[#1f3445] transition-colors">
                                                    {/* Khách hàng */}
                                                    <td className="p-3.5">
                                                        <div className="flex items-start gap-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-[#E6F4F1] border border-[#87CBB9] flex items-center justify-center text-[#0D4F43] shrink-0 font-bold text-xs shadow-xs">
                                                                {c.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono font-semibold text-[#87CBB9]">[{c.code}]</span>
                                                                    <span className="font-semibold text-white hover:text-[#87CBB9] cursor-pointer" onClick={() => handleOpenDrawer(c)}>
                                                                        {c.name}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: chBadge.color, background: chBadge.bg }}>
                                                                        {chBadge.label}
                                                                    </span>
                                                                    {c.brandGroup && (
                                                                        <span className="text-[10px] text-slate-200 bg-slate-700/60 px-2 py-0.5 rounded border border-slate-600 font-medium">
                                                                            {c.brandGroup}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Cơ Chế Mặc Định */}
                                                    <td className="p-3.5">
                                                        <div className="flex items-center justify-between gap-3">
                                                            {formatBaseType(c.basePriceType, c.defaultDiscountPct)}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenPolicyModal(c)}
                                                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:text-teal-900 bg-slate-100 hover:bg-white rounded-md border border-slate-300 hover:border-slate-400 shadow-xs transition"
                                                                title="Cấu hình cơ chế giá mặc định"
                                                            >
                                                                <Settings size={13} className="text-slate-600" />
                                                                Đổi
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Giá đặc biệt riêng */}
                                                    <td className="p-3.5">
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {hasSpecial ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                                                        <Zap size={12} /> Có {c.specialRuleCount} chai giá riêng
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 text-xs">— Theo giá chuẩn</span>
                                                                )}

                                                                {hasPending && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                                        <Clock size={11} /> {c.pendingRuleCount} chờ duyệt
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Preview sample deals */}
                                                            {c.activeRulesSummary && c.activeRulesSummary.length > 0 && (
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {c.activeRulesSummary.slice(0, 2).map((r, idx) => (
                                                                        <span key={idx} className="text-[10px] bg-[#142433] text-slate-300 px-2 py-0.5 rounded border border-[#2A4355]">
                                                                            {r.productName}: {r.ruleType === 'FIXED_DISCOUNT' ? `-${r.value}%` : formatVND(r.value)}
                                                                        </span>
                                                                    ))}
                                                                    {c.activeRulesSummary.length > 2 && (
                                                                        <span className="text-[10px] text-slate-500">
                                                                            +{c.activeRulesSummary.length - 2} chai nữa
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Hành động */}
                                                    <td className="p-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenDrawer(c)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-[#87CBB9] hover:bg-[#A3E5D4] text-[#0A1926] shadow-xs hover:shadow transition"
                                                            >
                                                                <Eye size={13} /> Xem Giá Riêng
                                                            </button>

                                                            {canCreate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenCreateWithCustomer(c.id)}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 border border-slate-300 hover:border-slate-400 shadow-xs transition"
                                                                    title="Thêm giá đặc biệt cho khách hàng này"
                                                                >
                                                                    + Deal
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* VIEW MODE 2: RULE-CENTRIC AUDIT VIEW (TOÀN BỘ QUY TẮC TOÀN HỆ THỐNG)  */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {viewMode === 'RULES' && (
                <div className="space-y-3">
                    {/* Filters Header */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-[#142433] border border-[#2A4355]">
                        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                            <div className="relative flex-1 md:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Tìm khách hàng hoặc sản phẩm..."
                                    style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                    className="w-full pl-9 pr-3 py-1.5 text-xs outline-none bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white placeholder:text-slate-400 rounded-md transition shadow-xs"
                                />
                            </div>

                            <select
                                value={filterCustomer}
                                onChange={e => setFilterCustomer(e.target.value)}
                                style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer max-w-[180px] truncate bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white rounded-md transition shadow-xs"
                            >
                                <option value="ALL">Tất cả Khách Hàng ({customers.length})</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                                ))}
                            </select>

                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white rounded-md transition shadow-xs"
                            >
                                <option value="ALL">Tất cả Trạng Thái</option>
                                <option value="DRAFT">Nháp</option>
                                <option value="PENDING_APPROVAL">Chờ Duyệt</option>
                                <option value="APPROVED">Đã Duyệt</option>
                                <option value="REJECTED">Từ Chối</option>
                            </select>

                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-[#1B2E3D] border border-[#3A5D77] focus:border-[#87CBB9] text-white rounded-md transition shadow-xs"
                            >
                                <option value="ALL">Tất cả Loại Giá</option>
                                <option value="FIXED_DISCOUNT">Chiết Khấu %</option>
                                <option value="FIXED_PRICE">Giá Cố Định</option>
                                <option value="SPECIAL_PRICE">Giá Đặc Biệt</option>
                            </select>
                        </div>

                        <div className="text-xs text-[#8AAEBB]">
                            Tìm thấy <strong>{filteredRules.length}</strong> quy tắc
                        </div>
                    </div>

                    {/* Table of rules */}
                    <div className="rounded-lg overflow-hidden border border-[#2A4355] bg-[#1B2E3D]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#142433] text-[#8AAEBB] border-b border-[#2A4355]">
                                        <th className="p-3 font-semibold">Khách Hàng</th>
                                        <th className="p-3 font-semibold">Sản Phẩm Vang</th>
                                        <th className="p-3 font-semibold">Loại Giá</th>
                                        <th className="p-3 font-semibold">Giá Trị Áp Dụng</th>
                                        <th className="p-3 font-semibold">Thời Hạn</th>
                                        <th className="p-3 text-center font-semibold">Trạng Thái</th>
                                        <th className="p-3 font-semibold">Đề Xuất / Duyệt</th>
                                        <th className="p-3 text-right font-semibold">Hành Động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#2A4355]">
                                    {loading && rules.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12">
                                                <Loader2 className="animate-spin mx-auto text-[#87CBB9]" size={24} />
                                                <p className="mt-2 text-slate-400">Đang tải dữ liệu...</p>
                                            </td>
                                        </tr>
                                    ) : filteredRules.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-[#8AAEBB]">
                                                Không tìm thấy chính sách giá nào khớp bộ lọc.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRules.map(rule => {
                                            const typeCfg = RULE_TYPE_CFG[rule.ruleType] ?? { label: rule.ruleType, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                            const statusCfg = STATUS_CFG[rule.status] ?? { label: rule.status, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                            return (
                                                <tr key={rule.id} className="hover:bg-[#1f3445] transition">
                                                    <td className="p-3">
                                                        <div className="font-semibold text-slate-100">{rule.customerName}</div>
                                                        <div className="font-mono text-[11px] text-[#8AAEBB]">{rule.customerCode}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-medium text-slate-100">{rule.productName}</div>
                                                        <div className="font-mono text-[11px] text-[#8AAEBB]">{rule.skuCode}</div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ color: typeCfg.color, background: typeCfg.bg }}>
                                                            {typeCfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 font-semibold text-emerald-400">
                                                        {rule.ruleType === 'FIXED_DISCOUNT' ? `${rule.value}%` : formatVND(rule.value)}
                                                    </td>
                                                    <td className="p-3 text-slate-300 text-[11px]">
                                                        {new Date(rule.startDate).toLocaleDateString('vi-VN')}
                                                        {rule.endDate ? ` → ${new Date(rule.endDate).toLocaleDateString('vi-VN')}` : ' (Vô thời hạn)'}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                            {statusCfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-[11px] text-slate-400">
                                                        <div>Đề xuất: {rule.requesterName}</div>
                                                        {rule.approverName && <div className="text-emerald-400">Duyệt: {rule.approverName}</div>}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {rule.status === 'PENDING_APPROVAL' && canApprove && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApprove(rule.id)}
                                                                        className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                                                                        title="Phê duyệt quy tắc này"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleReject(rule.id)}
                                                                        className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                                                                        title="Từ chối quy tắc này"
                                                                    >
                                                                        <Ban size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canCreate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(rule.id)}
                                                                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                                                    title="Xóa quy tắc này"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* DRAWER / MODAL: CHI TIẾT CƠ CHẾ & GIÁ ĐẶC BIỆT CỦA 1 KHÁCH HÀNG       */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {drawerCustomer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl h-full bg-[#1B2E3D] border-l border-[#2A4355] shadow-2xl flex flex-col overflow-hidden">
                        {/* Drawer Header */}
                        <div className="p-4 bg-[#142433] border-b border-[#2A4355] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#E6F4F1] border border-[#87CBB9] flex items-center justify-center text-[#0D4F43] font-bold shadow-xs">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#87CBB9]/20 text-[#87CBB9] border border-[#87CBB9]/40 font-semibold">
                                            {drawerCustomer.code}
                                        </span>
                                        <h3 className="text-base font-bold text-slate-100">{drawerCustomer.name}</h3>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Chi tiết danh mục giá đặc biệt & chính sách chiết khấu toàn kho
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={refreshDrawer}
                                    className="p-2 rounded text-slate-300 hover:text-white hover:bg-white/10 transition"
                                    title="Tải lại dữ liệu"
                                >
                                    <RefreshCw size={16} className={drawerLoading ? 'animate-spin' : ''} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDrawerCustomer(null)
                                        setDrawerDetails(null)
                                    }}
                                    className="p-2 rounded text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Customer Mechanism Summary Box */}
                        {drawerDetails?.customer && (
                            <div className="p-4 bg-[#142433] border-b border-[#2A4355] grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 rounded-lg bg-[#1B2E3D] border border-[#2E4E67] shadow-xs">
                                    <span className="text-[#8AAEBB] font-medium">Kênh Khách Hàng:</span>
                                    <div className="font-semibold text-slate-100 mt-1 flex items-center gap-2">
                                        <span className="text-sm">{drawerDetails.customer.channel}</span>
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-[#1B2E3D] border border-[#2E4E67] shadow-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[#8AAEBB] font-medium">Cơ Chế Giá Mặc Định:</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const found = masterOverview?.customers.find(x => x.id === drawerCustomer.id)
                                                if (found) handleOpenPolicyModal(found)
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:text-teal-900 bg-slate-100 hover:bg-white rounded border border-slate-300 hover:border-slate-400 transition shadow-xs flex items-center gap-1"
                                        >
                                            <Settings size={12} className="text-slate-600" /> Cập nhật
                                        </button>
                                    </div>
                                    <div className="mt-1">
                                        {formatBaseType(drawerDetails.customer.basePriceType, drawerDetails.customer.defaultDiscountPct)}
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-[#1B2E3D] border border-[#2E4E67] shadow-xs">
                                    <span className="text-[#8AAEBB] font-medium">Tổng Số Chai Giá Riêng:</span>
                                    <div className="font-bold text-sky-400 mt-1 flex items-center gap-1.5 text-sm">
                                        <Zap size={14} /> {drawerDetails.rules.length} chai đã cấu hình
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Drawer Actions Toolbar */}
                        <div className="p-3 bg-[#1B2E3D] border-b border-[#2A4355] flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">
                                Danh Mục Giá Đặc Biệt ({drawerDetails?.rules.length ?? 0} chai)
                            </span>

                            {canCreate && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenCreateWithCustomer(drawerCustomer.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] shadow-sm hover:opacity-90 transition"
                                >
                                    <Plus size={14} /> Thêm Chai Mới
                                </button>
                            )}
                        </div>

                        {/* Rules List Table */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {drawerLoading ? (
                                <div className="text-center py-16">
                                    <Loader2 className="animate-spin mx-auto text-[#87CBB9]" size={28} />
                                    <p className="mt-2 text-xs text-[#8AAEBB]">Đang tải chi tiết giá khách hàng...</p>
                                </div>
                            ) : !drawerDetails || drawerDetails.rules.length === 0 ? (
                                <div className="text-center py-16 border border-dashed border-[#2A4355] rounded-lg">
                                    <Zap size={32} className="mx-auto text-slate-500 mb-2" />
                                    <h4 className="text-sm font-semibold text-slate-300">Khách hàng chưa có chai giá đặc biệt nào</h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                                        Hiện tại khách hàng này đang áp dụng 100% theo <strong>Cơ Chế Giá Mặc Định</strong> ở trên. Mọi sản phẩm mới về kho sẽ tự động áp dụng công thức này.
                                    </p>
                                    {canCreate && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCreateWithCustomer(drawerCustomer.id)}
                                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926]"
                                        >
                                            <Plus size={14} /> Thiết Lập Giá Đặc Biệt Cho Chai Cụ Thể
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-[#2A4355] overflow-hidden bg-[#142433]">
                                    <table className="w-full text-xs text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#182F40] text-slate-200 border-b border-[#2E4E67]">
                                                <th className="p-3 font-semibold">Tên Rượu Vang & SKU</th>
                                                <th className="p-3 font-semibold text-right">Giá Niêm Yết</th>
                                                <th className="p-3 font-semibold text-right">Giá Thỏa Thuận</th>
                                                <th className="p-3 font-semibold text-center">Tiết Kiệm (%)</th>
                                                <th className="p-3 font-semibold">Hiệu Lực</th>
                                                <th className="p-3 text-center font-semibold">Trạng Thái</th>
                                                <th className="p-3 text-right font-semibold">Hành Động</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2A4355]">
                                            {drawerDetails.rules.map(rule => {
                                                const statusCfg = STATUS_CFG[rule.status] ?? { label: rule.status, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                                return (
                                                    <tr key={rule.id} className="hover:bg-[#1B2E3D] transition">
                                                        <td className="p-3">
                                                            <div className="font-semibold text-slate-100">{rule.productName}</div>
                                                            <div className="font-mono text-[11px] text-[#8AAEBB]">{rule.skuCode}</div>
                                                        </td>
                                                        <td className="p-3 text-right font-mono text-slate-400">
                                                            {rule.basePrice ? formatVND(rule.basePrice) : '—'}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                                            {formatVND(rule.effectivePrice)}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {rule.savingsPct > 0 ? (
                                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300">
                                                                    -{rule.savingsPct}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-500">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-[11px] text-slate-300">
                                                            <div>{new Date(rule.startDate).toLocaleDateString('vi-VN')}</div>
                                                            <div className="text-slate-500">
                                                                {rule.endDate ? `Đến: ${new Date(rule.endDate).toLocaleDateString('vi-VN')}` : 'Không thời hạn'}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                                {statusCfg.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                {rule.status === 'PENDING_APPROVAL' && canApprove && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleApprove(rule.id)}
                                                                            className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition"
                                                                            title="Duyệt giá"
                                                                        >
                                                                            <Check size={14} />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleReject(rule.id)}
                                                                            className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition"
                                                                            title="Từ chối"
                                                                        >
                                                                            <Ban size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {canCreate && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(rule.id)}
                                                                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                                                        title="Xóa deal này"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 bg-[#142433] border-t border-[#2A4355] flex items-center justify-between">
                            <span className="text-xs text-slate-300">
                                Cập nhật tự động trên POS & Báo Giá Sales
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawerCustomer(null)
                                    setDrawerDetails(null)
                                }}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 hover:text-slate-950 transition shadow-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: ĐỔI CƠ CHẾ GIÁ MẶC ĐỊNH CHO KHÁCH HÀNG                          */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {policyModalCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                    <div className="w-full max-w-lg bg-[#1B2E3D] border border-[#2A4355] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 bg-[#142433] border-b border-[#2A4355] flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-[#87CBB9]/15 text-[#87CBB9]">
                                    <SlidersHorizontal size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-100">
                                        Cấu Hình Cơ Chế Giá Mặc Định
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        [{policyModalCustomer.code}] {policyModalCustomer.name}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPolicyModalCustomer(null)}
                                className="text-slate-400 hover:text-slate-200 p-1"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Bảng Giá Gốc Làm Chuẩn:
                                </label>
                                <select
                                    value={policyBasePriceType}
                                    onChange={e => setPolicyBasePriceType(e.target.value)}
                                    style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                    className="w-full p-2.5 text-xs bg-[#1B2E3D] border border-[#3A5D77] text-white rounded-lg outline-none cursor-pointer focus:border-[#87CBB9] transition shadow-xs"
                                >
                                    <option value="BY_CHANNEL">Theo Kênh Bán Hàng Mặc Định ({policyModalCustomer.channel})</option>
                                    <option value="WHOLESALE">Bảng Giá Buôn (Wholesale Price List)</option>
                                    <option value="RETAIL">Bảng Giá Lẻ Niêm Yết (Retail Price List)</option>
                                    <option value="HORECA">Bảng Giá Riêng Kênh HORECA</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Mức Chiết Khấu Mặc Định Toàn Kho (%):
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={policyDiscountPct}
                                        onChange={e => setPolicyDiscountPct(Number(e.target.value))}
                                        placeholder="Ví dụ: 10 (nghĩa là -10%)"
                                        style={{ color: '#FFFFFF', backgroundColor: '#1B2E3D' }}
                                        className="w-full p-2.5 pr-8 text-xs bg-[#1B2E3D] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9] transition shadow-xs"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">
                                        %
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Nhập <code>10</code> để khách luôn được chiết khấu 10% trên bảng giá gốc.
                                </p>
                            </div>

                            {/* Dynamic Explanation Box */}
                            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
                                <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                                    <CheckCircle2 size={14} /> Tự Động Định Giá Động Khi Có Hàng Mới
                                </div>
                                <p className="text-slate-300 text-[11px] leading-relaxed">
                                    Khi công ty nhập thêm bất kỳ chai vang mới nào về kho, hệ thống sẽ <strong>tự động tính giá bán</strong> cho khách hàng này theo công thức:
                                </p>
                                <div className="p-2.5 rounded-lg bg-[#142433] text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30 shadow-xs">
                                    Giá Khách Mua = [Bảng Giá {policyBasePriceType === 'WHOLESALE' ? 'Buôn' : policyBasePriceType === 'RETAIL' ? 'Lẻ' : 'Gốc'}] × (1 - {policyDiscountPct}%)
                                </div>
                                <p className="text-slate-400 text-[10px]">
                                    * Ngoại trừ những chai rượu được cấu hình riêng trong mục "Giá Đặc Biệt" thì sẽ ưu tiên áp dụng giá thỏa thuận riêng.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-[#142433] border-t border-[#2A4355] flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setPolicyModalCustomer(null)}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 hover:text-slate-950 transition shadow-xs"
                            >
                                Hủy Bỏ
                            </button>

                            <button
                                type="button"
                                disabled={policySaving}
                                onClick={handleSavePolicy}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] shadow-md hover:opacity-90 transition disabled:opacity-50"
                            >
                                {policySaving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> Đang lưu...
                                    </>
                                ) : (
                                    'Lưu Cơ Chế Giá'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: TẠO QUY TẮC GIÁ ĐẶC BIỆT ĐƠN LẺ                                 */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                    <div className="w-full max-w-lg bg-[#1B2E3D] border border-[#2A4355] rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 bg-[#142433] border-b border-[#2A4355] flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <Plus size={16} className="text-[#87CBB9]" /> Thêm Giá Đặc Biệt Cho Khách Hàng
                            </h3>
                            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-200">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Khách Hàng:</label>
                                <select
                                    value={formCustomer}
                                    onChange={e => setFormCustomer(e.target.value)}
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                >
                                    <option value="">-- Chọn khách hàng --</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Sản Phẩm Vang:</label>
                                <input
                                    value={formProductSearch}
                                    onChange={e => setFormProductSearch(e.target.value)}
                                    placeholder="Gõ để lọc sản phẩm..."
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2 text-xs bg-[#142433] border border-[#3A5D77] text-white placeholder:text-slate-400 rounded-lg mb-1.5 focus:border-[#87CBB9]"
                                />
                                <select
                                    value={formProduct}
                                    onChange={e => setFormProduct(e.target.value)}
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                    size={4}
                                >
                                    {products
                                        .filter(p => !formProductSearch || p.productName.toLowerCase().includes(formProductSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(formProductSearch.toLowerCase()))
                                        .map(p => (
                                            <option key={p.id} value={p.id} className="p-1.5 cursor-pointer">
                                                [{p.skuCode}] {p.productName}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Loại Quy Tắc:</label>
                                    <select
                                        value={formType}
                                        onChange={e => setFormType(e.target.value as any)}
                                        style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                        className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                    >
                                        <option value="SPECIAL_PRICE">Giá Đặc Biệt (VND)</option>
                                        <option value="FIXED_PRICE">Giá Cố Định (VND)</option>
                                        <option value="FIXED_DISCOUNT">Chiết Khấu % (So với base)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        {formType === 'FIXED_DISCOUNT' ? 'Tỷ Lệ Chiết Khấu (%)' : 'Mức Giá (VND)'}:
                                    </label>
                                    <input
                                        type="number"
                                        value={formValue}
                                        onChange={e => setFormValue(e.target.value)}
                                        placeholder={formType === 'FIXED_DISCOUNT' ? 'Ví dụ: 15' : 'Ví dụ: 850000'}
                                        style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                        className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày Bắt Đầu:</label>
                                    <input
                                        type="date"
                                        value={formStart}
                                        onChange={e => setFormStart(e.target.value)}
                                        style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                        className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg focus:border-[#87CBB9]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày Hết Hạn (Tùy chọn):</label>
                                    <input
                                        type="date"
                                        value={formEnd}
                                        onChange={e => setFormEnd(e.target.value)}
                                        style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                        className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg focus:border-[#87CBB9]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi Chú / Số Hợp Đồng:</label>
                                <textarea
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    placeholder="Thỏa thuận theo Hợp đồng số... hoặc tờ trình số..."
                                    rows={2}
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-[#142433] border-t border-[#2A4355] flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCreateOpen(false)}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 hover:text-slate-950 transition shadow-xs"
                            >
                                Hủy Bỏ
                            </button>

                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleCreateRule}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] shadow-md hover:opacity-90 disabled:opacity-50"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Lưu & Trình Duyệt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: SAO CHÉP CHÍNH SÁCH GIÁ CHO CƠ SỞ / CHI NHÁNH KHÁC             */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {cloneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
                    <div className="w-full max-w-2xl bg-[#1B2E3D] border border-[#2A4355] rounded-xl shadow-2xl overflow-hidden">
                        <div className="p-4 bg-[#142433] border-b border-[#2A4355] flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                <Copy size={16} className="text-[#D4A853]" /> Sao Chép Cơ Chế Giá Cho Các Cơ Sở Khác
                            </h3>
                            <button type="button" onClick={() => setCloneModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">Khách Hàng Nguồn (Đã có giá):</label>
                                <select
                                    value={cloneSourceCustomer}
                                    onChange={e => {
                                        const sId = e.target.value
                                        setCloneSourceCustomer(sId)
                                        const sRules = rules.filter(r => r.customerId === sId && r.status === 'APPROVED')
                                        setCloneSelectedRuleIds(sRules.map(r => r.id))
                                    }}
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2.5 text-xs bg-[#142433] border border-[#3A5D77] text-white rounded-lg outline-none focus:border-[#87CBB9]"
                                >
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Chọn Các Cơ Sở / Khách Hàng Đích Cần Áp Dụng:
                                </label>
                                <input
                                    value={cloneSearchTarget}
                                    onChange={e => setCloneSearchTarget(e.target.value)}
                                    placeholder="Tìm tên cơ sở đích..."
                                    style={{ color: '#FFFFFF', backgroundColor: '#142433' }}
                                    className="w-full p-2 text-xs bg-[#142433] border border-[#3A5D77] text-white placeholder:text-slate-400 rounded-lg mb-2 focus:border-[#87CBB9]"
                                />
                                <div className="max-h-48 overflow-y-auto border border-[#3A5D77] rounded-lg p-2 space-y-1 bg-[#142433]">
                                    {customers
                                        .filter(c => c.id !== cloneSourceCustomer)
                                        .filter(c => !cloneSearchTarget || c.name.toLowerCase().includes(cloneSearchTarget.toLowerCase()) || c.code.toLowerCase().includes(cloneSearchTarget.toLowerCase()))
                                        .map(c => {
                                            const isSelected = cloneTargetCustomers.includes(c.id)
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCloneTargetCustomers(prev =>
                                                            prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                                                        )
                                                    }}
                                                    className={`p-2 rounded flex items-center justify-between text-xs cursor-pointer transition ${
                                                        isSelected ? 'bg-[#87CBB9]/20 border border-[#87CBB9]/50' : 'hover:bg-white/10 border border-transparent'
                                                    }`}
                                                >
                                                    <span className="text-slate-100 font-medium">
                                                        <span className="font-mono text-[#87CBB9] mr-1">[{c.code}]</span> {c.name}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        className="rounded accent-[#87CBB9]"
                                                    />
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-[#2A4355]">
                                <input
                                    type="checkbox"
                                    id="overrideExisting"
                                    checked={cloneOverrideExisting}
                                    onChange={e => setCloneOverrideExisting(e.target.checked)}
                                    className="rounded accent-[#87CBB9]"
                                />
                                <label htmlFor="overrideExisting" className="text-xs text-slate-300 cursor-pointer">
                                    Ghi đè giá nếu sản phẩm đã tồn tại ở cơ sở đích
                                </label>
                            </div>
                        </div>

                        <div className="p-4 bg-[#142433] border-t border-[#2A4355] flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCloneModalOpen(false)}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 hover:text-slate-950 transition shadow-xs"
                            >
                                Hủy Bỏ
                            </button>

                            <button
                                type="button"
                                disabled={cloning || cloneTargetCustomers.length === 0}
                                onClick={handleExecuteClone}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded bg-[#87CBB9] text-[#0A1926] shadow-md hover:opacity-90 disabled:opacity-50"
                            >
                                {cloning ? <Loader2 size={14} className="animate-spin" /> : `Sao Chép Sang ${cloneTargetCustomers.length} Cơ Sở`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
