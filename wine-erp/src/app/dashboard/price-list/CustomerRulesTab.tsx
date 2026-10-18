'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
    Plus, Search, Trash2, Loader2, X, Check, Ban,
    FileText, Copy, Building2, SlidersHorizontal,
    Zap, ChevronRight, Clock, RefreshCw
} from 'lucide-react'
import {
    getCustomerPriceRules,
    createCustomerPriceRule,
    approveCustomerPriceRule,
    rejectCustomerPriceRule,
    deleteCustomerPriceRule,
    getCustomersForRules,
    cloneCustomerPriceRules,
    getCustomerPricingMasterOverview,
    updateCustomerDefaultPricing,
    getCustomerSpecialPriceDetail,
    PriceRuleRow,
    CustomerPricingMasterResult,
} from './customer-rules-actions'
import { getProductsForPriceList } from './actions'
import { formatVND } from '@/lib/utils'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ui'

const RULE_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    FIXED_DISCOUNT: { label: 'Chiết Khấu %', color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
    FIXED_PRICE: { label: 'Giá Cố Định', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    SPECIAL_PRICE: { label: 'Giá Đặc Biệt', color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: 'rgba(100,116,139,0.12)' },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
    APPROVED: { label: 'Đã Duyệt', color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
    REJECTED: { label: 'Từ Chối', color: '#E11D48', bg: 'rgba(225,29,72,0.12)' },
}

const CHANNEL_BADGES: Record<string, { label: string; color: string; bg: string }> = {
    HORECA: { label: 'HORECA', color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
    WHOLESALE_DISTRIBUTOR: { label: 'Đại Lý', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    VIP_RETAIL: { label: 'VIP Retail', color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
    DIRECT_INDIVIDUAL: { label: 'Trực Tiếp', color: '#475569', bg: 'rgba(100,116,139,0.12)' },
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
    const [masterOverview, setMasterOverview] = useState<CustomerPricingMasterResult | null>(null)
    const [rules, setRules] = useState<PriceRuleRow[]>([])
    const [customers, setCustomers] = useState<CustomerOption[]>([])
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // Master Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [filterChannel, setFilterChannel] = useState('ALL')
    const [filterMasterType, setFilterMasterType] = useState<'ALL' | 'HAS_SPECIAL' | 'HAS_CUSTOM_DISCOUNT' | 'PENDING'>('ALL')

    // Unified Customer Drawer state
    const [drawerCustomer, setDrawerCustomer] = useState<{ id: string; name: string; code: string } | null>(null)
    const [drawerDetails, setDrawerDetails] = useState<Awaited<ReturnType<typeof getCustomerSpecialPriceDetail>> | null>(null)
    const [drawerLoading, setDrawerLoading] = useState(false)
    const [drawerRuleSearch, setDrawerRuleSearch] = useState('')

    // Inline Default Policy state inside Customer Drawer
    const [policyBasePriceType, setPolicyBasePriceType] = useState<string>('BY_CHANNEL')
    const [policyDiscountPct, setPolicyDiscountPct] = useState<number>(0)
    const [policySaving, setPolicySaving] = useState(false)

    // Inline Add Special Rule state inside Customer Drawer
    const [addRuleOpen, setAddRuleOpen] = useState(false)
    const [formProduct, setFormProduct] = useState('')
    const [formType, setFormType] = useState<'SPECIAL_PRICE' | 'FIXED_DISCOUNT'>('SPECIAL_PRICE')
    const [formValue, setFormValue] = useState('')
    const [formStart, setFormStart] = useState(new Date().toISOString().slice(0, 10))
    const [formEnd, setFormEnd] = useState('')
    const [formNotes, setFormNotes] = useState('')
    const [formProductSearch, setFormProductSearch] = useState('')

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

    // Open Customer Inspection & Configuration Drawer
    const handleOpenDrawer = async (cust: { id: string; name: string; code: string }) => {
        setDrawerCustomer(cust)
        setDrawerRuleSearch('')
        setAddRuleOpen(false)
        setDrawerLoading(true)
        try {
            const details = await getCustomerSpecialPriceDetail(cust.id)
            setDrawerDetails(details)
            if (details?.customer) {
                setPolicyBasePriceType(details.customer.basePriceType || 'BY_CHANNEL')
                setPolicyDiscountPct(details.customer.defaultDiscountPct || 0)
            }
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
            if (details?.customer) {
                setPolicyBasePriceType(details.customer.basePriceType || 'BY_CHANNEL')
                setPolicyDiscountPct(details.customer.defaultDiscountPct || 0)
            }
        } catch (err) {
            console.error('Failed to refresh drawer', err)
        } finally {
            setDrawerLoading(false)
        }
    }

    // Save Inline Policy inside Drawer
    const handleSaveInlinePolicy = async () => {
        if (!drawerCustomer) return
        setPolicySaving(true)
        const res = await updateCustomerDefaultPricing(drawerCustomer.id, {
            basePriceType: policyBasePriceType,
            defaultDiscountPct: Number(policyDiscountPct),
        })
        if (res.success) {
            toast.success('Đã lưu cơ chế giá mặc định')
            await Promise.all([loadData(), refreshDrawer()])
        } else {
            toast.error('Lỗi cập nhật: ' + res.error)
        }
        setPolicySaving(false)
    }

    // Create Rule Action inside Drawer
    const handleCreateRule = async () => {
        if (!drawerCustomer || !formProduct || !formValue) {
            toast.warning('Vui lòng chọn sản phẩm và nhập giá/chiết khấu')
            return
        }
        setSaving(true)
        const res = await createCustomerPriceRule({
            customerId: drawerCustomer.id,
            productId: formProduct,
            ruleType: formType,
            value: Number(formValue),
            startDate: formStart,
            endDate: formEnd || undefined,
            notes: formNotes,
        })
        if (res.success) {
            setAddRuleOpen(false)
            setFormProduct('')
            setFormValue('')
            setFormEnd('')
            setFormNotes('')
            setFormProductSearch('')
            toast.success('Đã thêm giá riêng cho sản phẩm')
            await Promise.all([loadData(), refreshDrawer()])
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    const handleApprove = async (id: string) => {
        const comment = prompt('Nhập ghi chú phê duyệt (tùy chọn):')
        if (comment === null) return
        setLoading(true)
        const res = await approveCustomerPriceRule(id, comment)
        if (res.success) {
            toast.success('Đã phê duyệt chính sách giá')
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    const handleReject = async (id: string) => {
        const comment = prompt('Nhập lý do từ chối (bắt buộc):')
        if (!comment) {
            if (comment !== null) toast.warning('Lý do từ chối là bắt buộc')
            return
        }
        setLoading(true)
        const res = await rejectCustomerPriceRule(id, comment)
        if (res.success) {
            toast.success('Đã từ chối chính sách giá')
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    const handleDelete = (id: string) => {
        confirm({
            title: 'Xóa Chính Sách Giá',
            message: 'Bạn chắc chắn muốn xóa chính sách giá này?',
            confirmLabel: 'Xóa Chính Sách',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                setLoading(true)
                try {
                    const res = await deleteCustomerPriceRule(id)
                    if (res.success) {
                        toast.success('Đã xóa chính sách giá')
                        await loadData()
                        if (drawerCustomer) await refreshDrawer()
                    } else {
                        toast.error('Lỗi: ' + res.error)
                    }
                } finally {
                    setLoading(false)
                }
            }
        })
    }

    // Clone Modal helpers
    const openCloneModal = (sourceCustId?: string) => {
        const initialSourceId = sourceCustId || drawerCustomer?.id || customers[0]?.id || ''
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
            toast.warning('Vui lòng chọn khách hàng nguồn')
            return
        }
        if (cloneTargetCustomers.length === 0) {
            toast.warning('Vui lòng chọn ít nhất 1 cơ sở đích cần áp dụng cơ chế giá')
            return
        }
        if (cloneSelectedRuleIds.length === 0) {
            toast.warning('Khách hàng nguồn chưa có sản phẩm giá riêng (Đã duyệt) nào để sao chép')
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
            toast.success(`Đã sao chép thành công ${res.clonedCount} chính sách giá sang ${res.targetCount} cơ sở đích!`)
            setCloneModalOpen(false)
            await loadData()
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setCloning(false)
    }

    // Pending rules for quick approval banner
    const pendingRules = useMemo(() => {
        return rules.filter(r => r.status === 'PENDING_APPROVAL')
    }, [rules])

    // Filtered rules inside Customer Drawer
    const filteredDrawerRules = useMemo(() => {
        if (!drawerDetails?.rules) return []
        const q = drawerRuleSearch.trim().toLowerCase()
        if (!q) return drawerDetails.rules
        return drawerDetails.rules.filter(r =>
            r.skuCode.toLowerCase().includes(q) ||
            r.productName.toLowerCase().includes(q)
        )
    }, [drawerDetails?.rules, drawerRuleSearch])

    const isPolicyDirty = Boolean(
        drawerDetails?.customer && (
            policyBasePriceType !== (drawerDetails.customer.basePriceType || 'BY_CHANNEL') ||
            Number(policyDiscountPct) !== Number(drawerDetails.customer.defaultDiscountPct || 0)
        )
    )

    // Format Base Price Type Display
    const formatBaseType = (basePriceType: string, defaultDiscountPct: number) => {
        let label = 'Theo Kênh Chuẩn'
        if (basePriceType === 'WHOLESALE') label = 'Bảng Giá Buôn'
        else if (basePriceType === 'RETAIL') label = 'Bảng Giá Lẻ'
        else if (basePriceType === 'HORECA') label = 'Bảng Giá HORECA'

        if (defaultDiscountPct > 0) {
            return (
                <div className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800">{label}</span>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold whitespace-nowrap">
                        -{defaultDiscountPct}%
                    </span>
                </div>
            )
        }

        return <span className="text-slate-600">{label}</span>
    }

    const kpis = masterOverview?.kpis

    return (
        <div className="w-full space-y-3">
            {/* Unified Filter & Action Bar */}
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-xs space-y-3">
                {/* Top Row: Quick Filter Pills (with embedded KPI counts) + Secondary Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setFilterMasterType('ALL')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                                filterMasterType === 'ALL'
                                    ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Tất cả khách hàng ({kpis?.totalCustomers ?? customers.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMasterType('HAS_SPECIAL')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                                filterMasterType === 'HAS_SPECIAL'
                                    ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Có giá riêng theo chai ({kpis?.hasSpecialPriceCount ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMasterType('HAS_CUSTOM_DISCOUNT')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ${
                                filterMasterType === 'HAS_CUSTOM_DISCOUNT'
                                    ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            Chiết khấu mặc định ({kpis?.customPolicyCount ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMasterType('PENDING')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                                filterMasterType === 'PENDING'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : (kpis?.pendingRulesCount ?? 0) > 0
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <Clock size={13} />
                            Chờ duyệt ({kpis?.pendingRulesCount ?? 0})
                        </button>
                    </div>

                    {canCreate && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => openCloneModal()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition shadow-xs"
                            >
                                <Copy size={13} className="text-slate-500" /> Sao Chép Sang Chi Nhánh
                            </button>
                            <Link
                                href="/dashboard/proposals?category=PRICE_ADJUSTMENT&action=create"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0E7490] hover:bg-[#155E75] text-white transition shadow-xs"
                            >
                                <FileText size={13} /> Lập Tờ Trình Giá
                            </Link>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Search & Channel Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-1 max-w-xl">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm mã hoặc tên khách hàng..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs outline-none bg-white border border-slate-300 focus:border-[#0891B2] text-slate-900 placeholder:text-slate-400 rounded-md transition"
                            />
                        </div>

                        <select
                            value={filterChannel}
                            onChange={e => setFilterChannel(e.target.value)}
                            className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-white border border-slate-300 focus:border-[#0891B2] text-slate-800 rounded-md transition shrink-0"
                        >
                            <option value="ALL">Tất cả Kênh</option>
                            <option value="HORECA">HORECA</option>
                            <option value="WHOLESALE_DISTRIBUTOR">Đại Lý</option>
                            <option value="VIP_RETAIL">VIP Retail</option>
                            <option value="DIRECT_INDIVIDUAL">Trực Tiếp</option>
                        </select>
                    </div>

                    <div className="text-xs text-slate-500">
                        Hiển thị <strong className="text-slate-800">{masterOverview?.customers.length ?? 0}</strong> khách hàng
                    </div>
                </div>
            </div>

            {/* Quick Pending Approval Table when "Chờ duyệt" filter is selected */}
            {filterMasterType === 'PENDING' && pendingRules.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/40 overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-amber-100/70 border-b border-amber-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Clock size={14} /> Danh Sách Deal Giá Riêng Đang Chờ Phê Duyệt ({pendingRules.length})
                        </span>
                        <span className="text-[11px] text-amber-800">
                            Duyệt nhanh trực tiếp hoặc bấm vào khách hàng bên dưới để xem toàn bộ danh mục
                        </span>
                    </div>
                    <div className="overflow-x-auto bg-white">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                    <th className="p-3 font-semibold">Khách Hàng</th>
                                    <th className="p-3 font-semibold">Sản Phẩm</th>
                                    <th className="p-3 font-semibold text-right">Giá Đề Xuất</th>
                                    <th className="p-3 font-semibold">Người Đề Xuất</th>
                                    <th className="p-3 font-semibold text-right">Phê Duyệt</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {pendingRules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-slate-50">
                                        <td className="p-3">
                                            <span className="font-mono text-[#0891B2] font-semibold mr-1.5">[{rule.customerCode}]</span>
                                            <span className="font-semibold text-slate-900">{rule.customerName}</span>
                                        </td>
                                        <td className="p-3">
                                            <span className="font-medium text-slate-900">{rule.productName}</span>
                                            <span className="font-mono text-[11px] text-slate-500 ml-1.5">({rule.skuCode})</span>
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                            {rule.ruleType === 'FIXED_DISCOUNT' ? `-${rule.value}%` : formatVND(rule.value)}
                                        </td>
                                        <td className="p-3 text-slate-600">
                                            {rule.requesterName} · {new Date(rule.startDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="p-3 text-right">
                                            {canApprove ? (
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprove(rule.id)}
                                                        className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center gap-1"
                                                    >
                                                        <Check size={12} /> Duyệt
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReject(rule.id)}
                                                        className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition inline-flex items-center gap-1"
                                                    >
                                                        <Ban size={12} /> Từ chối
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-amber-700 font-medium">Chờ Quản lý duyệt</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Streamlined Master Customers Table */}
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <th className="p-3.5 font-semibold">Khách Hàng</th>
                                <th className="p-3.5 font-semibold w-36">Kênh</th>
                                <th className="p-3.5 font-semibold">Cơ Chế Mặc Định (Toàn Kho)</th>
                                <th className="p-3.5 font-semibold">Giá Riêng Theo Chai</th>
                                <th className="p-3.5 text-right font-semibold w-40">Chi Tiết</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading && !masterOverview ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-14">
                                        <Loader2 className="animate-spin mx-auto text-[#0891B2]" size={26} />
                                        <p className="mt-2 text-xs text-slate-600">Đang tải danh sách giá khách hàng...</p>
                                    </td>
                                </tr>
                            ) : masterOverview?.customers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-slate-500">
                                        Không tìm thấy khách hàng nào phù hợp bộ lọc.
                                    </td>
                                </tr>
                            ) : (
                                masterOverview?.customers.map(c => {
                                    const chBadge = CHANNEL_BADGES[c.channel ?? ''] ?? { label: c.channel ?? 'Chưa gắn', color: '#475569', bg: 'rgba(100,116,139,0.12)' }
                                    const hasSpecial = c.specialRuleCount > 0
                                    const hasPending = c.pendingRuleCount > 0

                                    return (
                                        <tr
                                            key={c.id}
                                            onClick={() => handleOpenDrawer(c)}
                                            className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                                        >
                                            {/* Khách hàng */}
                                            <td className="p-3.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono font-semibold text-[#0891B2]">{c.code}</span>
                                                    <span className="font-semibold text-slate-900 group-hover:text-[#0891B2] transition-colors">
                                                        {c.name}
                                                    </span>
                                                    {c.brandGroup && (
                                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            {c.brandGroup}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Kênh */}
                                            <td className="p-3.5">
                                                <span
                                                    className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                                                    style={{ color: chBadge.color, background: chBadge.bg }}
                                                >
                                                    {chBadge.label}
                                                </span>
                                            </td>

                                            {/* Cơ Chế Mặc Định */}
                                            <td className="p-3.5">
                                                {formatBaseType(c.basePriceType, c.defaultDiscountPct)}
                                            </td>

                                            {/* Giá đặc biệt riêng */}
                                            <td className="p-3.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {hasSpecial ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
                                                            <Zap size={12} /> {c.specialRuleCount} sản phẩm
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">Theo giá mặc định</span>
                                                    )}

                                                    {hasPending && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                                            <Clock size={11} /> {c.pendingRuleCount} chờ duyệt
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Chi Tiết */}
                                            <td className="p-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        handleOpenDrawer(c)
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-white group-hover:bg-[#0E7490] text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-[#0E7490] transition shadow-2xs"
                                                >
                                                    Cấu hình <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* ALL-IN-ONE DRAWER: CẤU HÌNH CƠ CHẾ & GIÁ ĐẶC BIỆT CỦA 1 KHÁCH HÀNG     */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {drawerCustomer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-4xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden">
                        {/* Drawer Header */}
                        <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-[#E6F4F1] border border-[#0E7490]/30 flex items-center justify-center text-[#0891B2] shrink-0">
                                    <Building2 size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-[#0891B2] border border-slate-200 font-bold">
                                            {drawerCustomer.code}
                                        </span>
                                        <h3 className="text-base font-bold text-slate-900 truncate">{drawerCustomer.name}</h3>
                                        {drawerDetails?.customer?.channel && (
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                                {CHANNEL_BADGES[drawerDetails.customer.channel]?.label ?? drawerDetails.customer.channel}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Cấu hình cơ chế chiết khấu toàn kho & danh mục giá thỏa thuận riêng theo từng chai
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={refreshDrawer}
                                    className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
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
                                    className="p-2 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Section 1: Inline Default Pricing Policy (Toàn Kho) */}
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                            1. Bảng Giá Gốc Mặc Định (Toàn Kho)
                                        </label>
                                        <select
                                            value={policyBasePriceType}
                                            onChange={e => setPolicyBasePriceType(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2] font-medium"
                                        >
                                            <option value="BY_CHANNEL">Theo Kênh Bán Hàng Mặc Định ({drawerDetails?.customer?.channel ?? 'Chuẩn'})</option>
                                            <option value="WHOLESALE">Bảng Giá Buôn (Wholesale)</option>
                                            <option value="RETAIL">Bảng Giá Lẻ (Retail)</option>
                                            <option value="HORECA">Bảng Giá Riêng HORECA</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                                            Chiết Khấu Mặc Định Toàn Kho (%)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={policyDiscountPct}
                                                    onChange={e => setPolicyDiscountPct(Number(e.target.value))}
                                                    className="w-full px-3 py-2 pr-7 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2] font-mono font-semibold"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={!isPolicyDirty || policySaving}
                                                onClick={handleSaveInlinePolicy}
                                                className="px-3.5 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] disabled:opacity-40 transition shrink-0"
                                            >
                                                {policySaving ? <Loader2 size={14} className="animate-spin" /> : 'Lưu Cơ Chế'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Special Price Rules Toolbar */}
                        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    2. Danh Mục Giá Riêng Theo Chai ({drawerDetails?.rules.length ?? 0})
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative w-48">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={drawerRuleSearch}
                                        onChange={e => setDrawerRuleSearch(e.target.value)}
                                        placeholder="Tìm SKU hoặc tên rượu..."
                                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                    />
                                </div>

                                {canCreate && (drawerDetails?.rules.length ?? 0) > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => openCloneModal(drawerCustomer.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition"
                                    >
                                        <Copy size={13} /> Sao Chép Sang Cơ Sở Khác
                                    </button>
                                )}

                                {canCreate && (
                                    <button
                                        type="button"
                                        onClick={() => setAddRuleOpen(prev => !prev)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-[#0E7490] hover:bg-[#155E75] text-white transition"
                                    >
                                        {addRuleOpen ? <X size={14} /> : <Plus size={14} />}
                                        {addRuleOpen ? 'Đóng Khung Thêm' : 'Thêm Chai Giá Riêng'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Inline Add Special Rule Form inside Drawer */}
                        {addRuleOpen && (
                            <div className="p-4 bg-cyan-50/50 border-b border-cyan-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-[#0E7490] uppercase tracking-wider">
                                        Thêm Giá Thỏa Thuận Riêng Cho Khách Hàng Này
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-5">
                                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chọn Sản Phẩm *</label>
                                        <input
                                            value={formProductSearch}
                                            onChange={e => setFormProductSearch(e.target.value)}
                                            placeholder="Gõ mã SKU hoặc tên rượu để lọc..."
                                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md mb-1 outline-none focus:border-[#0891B2]"
                                        />
                                        <select
                                            value={formProduct}
                                            onChange={e => setFormProduct(e.target.value)}
                                            size={3}
                                            className="w-full p-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                        >
                                            {products
                                                .filter(p => !formProductSearch || p.productName.toLowerCase().includes(formProductSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(formProductSearch.toLowerCase()))
                                                .slice(0, 40)
                                                .map(p => (
                                                    <option key={p.id} value={p.id} className="p-1 cursor-pointer">
                                                        [{p.skuCode}] {p.productName}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5 content-start">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hình Thức Giá</label>
                                            <select
                                                value={formType}
                                                onChange={e => setFormType(e.target.value as any)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            >
                                                <option value="SPECIAL_PRICE">Giá Cố Định Theo Chai (VND)</option>
                                                <option value="FIXED_DISCOUNT">Chiết Khấu Riêng Theo Chai (%)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                {formType === 'FIXED_DISCOUNT' ? 'Mức Chiết Khấu (%) *' : 'Đơn Giá Thỏa Thuận (VND) *'}
                                            </label>
                                            <input
                                                type="number"
                                                value={formValue}
                                                onChange={e => setFormValue(e.target.value)}
                                                placeholder={formType === 'FIXED_DISCOUNT' ? 'VD: 15' : 'VD: 850000'}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2] font-mono font-semibold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hiệu Lực Từ</label>
                                            <input
                                                type="date"
                                                value={formStart}
                                                onChange={e => setFormStart(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Đến Ngày (Tùy chọn)</label>
                                            <input
                                                type="date"
                                                value={formEnd}
                                                onChange={e => setFormEnd(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                        </div>

                                        <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1">
                                            <input
                                                value={formNotes}
                                                onChange={e => setFormNotes(e.target.value)}
                                                placeholder="Ghi chú số hợp đồng / tờ trình (tùy chọn)..."
                                                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                            <button
                                                type="button"
                                                disabled={saving || !formProduct || !formValue}
                                                onClick={handleCreateRule}
                                                className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] disabled:opacity-40 shrink-0"
                                            >
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Lưu Giá Riêng'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rules List Table */}
                        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40">
                            {drawerLoading ? (
                                <div className="text-center py-16">
                                    <Loader2 className="animate-spin mx-auto text-[#0891B2]" size={26} />
                                    <p className="mt-2 text-xs text-slate-600">Đang tải chi tiết giá khách hàng...</p>
                                </div>
                            ) : !drawerDetails || drawerDetails.rules.length === 0 ? (
                                <div className="text-center py-14 border border-dashed border-slate-300 rounded-lg bg-white">
                                    <SlidersHorizontal size={28} className="mx-auto text-slate-400 mb-2" />
                                    <h4 className="text-sm font-semibold text-slate-800">Khách hàng chưa có chai giá riêng nào</h4>
                                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                        Toàn bộ sản phẩm đang áp dụng theo <strong>Cơ Chế Giá Mặc Định</strong> ở mục 1 phía trên.
                                    </p>
                                    {canCreate && !addRuleOpen && (
                                        <button
                                            type="button"
                                            onClick={() => setAddRuleOpen(true)}
                                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75]"
                                        >
                                            <Plus size={14} /> Thêm Chai Giá Riêng Đầu Tiên
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                                    <th className="p-3 font-semibold">Sản Phẩm & SKU</th>
                                                    <th className="p-3 font-semibold text-right">Giá Niêm Yết</th>
                                                    <th className="p-3 font-semibold text-right">Giá Thỏa Thuận</th>
                                                    <th className="p-3 font-semibold text-center">Chênh Lệch</th>
                                                    <th className="p-3 font-semibold">Thời Hạn</th>
                                                    <th className="p-3 text-center font-semibold">Trạng Thái</th>
                                                    <th className="p-3 text-right font-semibold">Thao Tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {filteredDrawerRules.map(rule => {
                                                    const statusCfg = STATUS_CFG[rule.status] ?? { label: rule.status, color: '#0F172A', bg: 'rgba(100,116,139,0.1)' }
                                                    return (
                                                        <tr key={rule.id} className="hover:bg-slate-50 transition">
                                                            <td className="p-3">
                                                                <div className="font-semibold text-slate-900">{rule.productName}</div>
                                                                <div className="font-mono text-[11px] text-slate-500">{rule.skuCode}</div>
                                                            </td>
                                                            <td className="p-3 text-right font-mono text-slate-500">
                                                                {rule.basePrice ? formatVND(rule.basePrice) : '—'}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-emerald-700">
                                                                {formatVND(rule.effectivePrice)}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {rule.savingsPct > 0 ? (
                                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                                                        -{rule.savingsPct}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-[11px] text-slate-600">
                                                                <div className="font-medium text-slate-800">{new Date(rule.startDate).toLocaleDateString('vi-VN')}</div>
                                                                <div className="text-slate-500">
                                                                    {rule.endDate ? `Đến ${new Date(rule.endDate).toLocaleDateString('vi-VN')}` : 'Không thời hạn'}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ color: statusCfg.color, background: statusCfg.bg }}>
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
                                                                                className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                                                                                title="Duyệt giá"
                                                                            >
                                                                                <Check size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleReject(rule.id)}
                                                                                className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
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
                                                                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                                                            title="Xóa dòng giá riêng"
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
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                Giá riêng đã duyệt sẽ tự động ưu tiên áp dụng khi lên Đơn Bán Hàng (SO)
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawerCustomer(null)
                                    setDrawerDetails(null)
                                }}
                                className="px-5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: SAO CHÉP CHÍNH SÁCH GIÁ CHO CƠ SỞ / CHI NHÁNH KHÁC             */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {cloneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden">
                        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Copy size={16} className="text-[#0891B2]" /> Sao Chép Giá Riêng Sang Các Cơ Sở Khác
                            </h3>
                            <button type="button" onClick={() => setCloneModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Khách Hàng Nguồn (Đã có giá đã duyệt):</label>
                                <select
                                    value={cloneSourceCustomer}
                                    onChange={e => {
                                        const sId = e.target.value
                                        setCloneSourceCustomer(sId)
                                        const sRules = rules.filter(r => r.customerId === sId && r.status === 'APPROVED')
                                        setCloneSelectedRuleIds(sRules.map(r => r.id))
                                    }}
                                    className="w-full p-2.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2]"
                                >
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Có <strong>{cloneSelectedRuleIds.length}</strong> sản phẩm giá riêng đã duyệt sẵn sàng sao chép.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Chọn Các Cơ Sở / Chi Nhánh Đích Cần Áp Dụng:
                                </label>
                                <input
                                    value={cloneSearchTarget}
                                    onChange={e => setCloneSearchTarget(e.target.value)}
                                    placeholder="Tìm mã hoặc tên cơ sở đích..."
                                    className="w-full p-2 text-xs bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-md mb-2 focus:border-[#0891B2]"
                                />
                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md p-2 space-y-1 bg-white">
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
                                                        isSelected ? 'bg-[#0E7490]/15 border border-[#0E7490]/40' : 'hover:bg-slate-50 border border-transparent'
                                                    }`}
                                                >
                                                    <span className="text-slate-800 font-medium">
                                                        <span className="font-mono text-[#0891B2] mr-1">[{c.code}]</span> {c.name}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        className="rounded accent-[#0891B2]"
                                                    />
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                <input
                                    type="checkbox"
                                    id="overrideExisting"
                                    checked={cloneOverrideExisting}
                                    onChange={e => setCloneOverrideExisting(e.target.checked)}
                                    className="rounded accent-[#0891B2]"
                                />
                                <label htmlFor="overrideExisting" className="text-xs text-slate-700 cursor-pointer">
                                    Ghi đè giá nếu sản phẩm đã tồn tại ở cơ sở đích
                                </label>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCloneModalOpen(false)}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition"
                            >
                                Hủy Bỏ
                            </button>

                            <button
                                type="button"
                                disabled={cloning || cloneTargetCustomers.length === 0 || cloneSelectedRuleIds.length === 0}
                                onClick={handleExecuteClone}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] transition disabled:opacity-50"
                            >
                                {cloning ? <Loader2 size={14} className="animate-spin" /> : `Sao Chép Sang ${cloneTargetCustomers.length} Cơ Sở`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {confirmDialog}
        </div>
    )
}
