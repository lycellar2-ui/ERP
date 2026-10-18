'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
    Plus, Search, Trash2, Loader2, X, Check, Ban,
    FileText, Copy, Building2, SlidersHorizontal,
    Zap, ChevronRight, Clock, RefreshCw, Layers, ShieldCheck, Calendar, GitBranch
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
    submitCustomerPricingPolicyL2,
    approveCustomerPricingPolicyL2,
    rejectCustomerPricingPolicyL2,
    getPendingPricingPoliciesL2,
    getCustomerSpecialPriceDetail,
    PriceRuleRow,
    CustomerPricingMasterResult,
    PendingPricingPolicyL2Row,
} from './customer-rules-actions'
import { getProductsForPriceList } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getPriceListI18n } from './i18n'
import { toast } from 'sonner'
import {
    SearchInput, Table, THead, TBody, Tr, Th, Td, TableMessageRow, useConfirmDialog
} from '@/components/ui'

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    DRAFT: { color: '#475569', bg: 'rgba(100,116,139,0.12)' },
    PENDING_APPROVAL: { color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
    APPROVED: { color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
    REJECTED: { color: '#E11D48', bg: 'rgba(225,29,72,0.12)' },
}

const CHANNEL_STYLE: Record<string, { color: string; bg: string }> = {
    HORECA: { color: '#B45309', bg: 'rgba(217,119,6,0.12)' },
    WHOLESALE_DISTRIBUTOR: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    VIP_RETAIL: { color: '#0D9488', bg: 'rgba(13,148,136,0.12)' },
    DIRECT_INDIVIDUAL: { color: '#475569', bg: 'rgba(100,116,139,0.12)' },
}

const LEVEL2_STEP_LABELS: Record<number, { vi: string; en: string; role: string }> = {
    1: { vi: 'Cấp 1: TP.KD', en: 'Step 1: Sales Mgr', role: 'SALES_MGR' },
    2: { vi: 'Cấp 2: Kế Toán', en: 'Step 2: Accounting', role: 'KE_TOAN' },
    3: { vi: 'Cấp 3: CEO', en: 'Step 3: CEO', role: 'CEO' },
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
    const { locale, formatCurrency, formatDate } = useAppLocale()
    const i18n = getPriceListI18n(locale)
    const cr = i18n.customerRules
    const isEn = locale === 'en'

    const [masterOverview, setMasterOverview] = useState<CustomerPricingMasterResult | null>(null)
    const [rules, setRules] = useState<PriceRuleRow[]>([])
    const [pendingPoliciesL2, setPendingPoliciesL2] = useState<PendingPricingPolicyL2Row[]>([])
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

    // Level 2 Policy Proposal Form state inside Customer Drawer
    const [policyBasePriceType, setPolicyBasePriceType] = useState<string>('BY_CHANNEL')
    const [policyDiscountPct, setPolicyDiscountPct] = useState<number>(0)
    const [policyStartDate, setPolicyStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
    const [policyEndDate, setPolicyEndDate] = useState<string>('')
    const [policyJustification, setPolicyJustification] = useState<string>('')
    const [policyApplyBranches, setPolicyApplyBranches] = useState<boolean>(true)
    const [policySaving, setPolicySaving] = useState(false)

    // Inline Add Special Rule state inside Customer Drawer (Level 3)
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

    // Permissions check (RBAC)
    const userRoles = currentUser?.roles ?? []
    const userPerms = currentUser?.permissions ?? []
    const hasAnyRole = (...targets: string[]) => targets.some(t => userRoles.includes(t))

    const canApprove =
        userPerms.includes('SLS:APPROVE') ||
        hasAnyRole('CEO', 'ADMIN', 'SYS:ADMIN', 'DIRECTOR', 'BOD', 'SALES_MGR', 'Sales Manager', 'CBO')

    const canCreate =
        userPerms.includes('SLS:CREATE') ||
        userPerms.includes('PRC:WRITE') ||
        hasAnyRole('CEO', 'ADMIN', 'SYS:ADMIN', 'DIRECTOR', 'BOD', 'SALES_MGR', 'Sales Manager', 'CBO', 'SALES_REP', 'Sales Rep', 'SALES_ADMIN', 'Sales Admin')

    const canApproveL2Step = useCallback((currentLevel: number, requiredRole?: string) => {
        if (!currentUser) return false
        if (userRoles.some(r => ['CEO', 'ADMIN', 'SYS:ADMIN', 'DIRECTOR', 'BOD'].includes(r))) return true
        const targetRole = requiredRole || (currentLevel === 1 ? 'SALES_MGR' : currentLevel === 2 ? 'KE_TOAN' : 'CEO')
        if (targetRole === 'SALES_MGR' && userRoles.some(r => ['SALES_MGR', 'Sales Manager', 'CBO', 'MANAGER', 'TP', 'TRUONG_PHONG'].includes(r))) return true
        if (targetRole === 'KE_TOAN' && userRoles.some(r => ['KE_TOAN', 'Kế Toán', 'Kế toán', 'ACCOUNTANT', 'ACCOUNTING', 'CHIEF_ACCOUNTANT', 'KE_TOAN_TRUONG', 'Kế toán trưởng'].includes(r))) return true
        if (targetRole === 'CEO' && userRoles.some(r => ['CEO', 'ADMIN', 'SYS:ADMIN', 'DIRECTOR', 'BOD'].includes(r))) return true
        return userRoles.includes(targetRole)
    }, [currentUser, userRoles])

    const getStepTitle = (lvl: number) => {
        const item = LEVEL2_STEP_LABELS[lvl]
        if (!item) return `Step ${lvl}`
        return isEn ? item.en : item.vi
    }

    // ─── Data Loading ─────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [overviewData, rulesData, pendingL2Data, customersData, productsData] = await Promise.all([
                getCustomerPricingMasterOverview({
                    search: searchQuery,
                    channel: filterChannel !== 'ALL' ? filterChannel : undefined,
                    filterType: filterMasterType,
                }),
                getCustomerPriceRules(),
                getPendingPricingPoliciesL2(),
                getCustomersForRules(),
                getProductsForPriceList()
            ])
            setMasterOverview(overviewData)
            setRules(rulesData)
            setPendingPoliciesL2(pendingL2Data)
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
                setPolicyStartDate(
                    details.customer.effectiveL2.startDate
                        ? details.customer.effectiveL2.startDate.slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                )
                setPolicyEndDate(
                    details.customer.effectiveL2.endDate
                        ? details.customer.effectiveL2.endDate.slice(0, 10)
                        : ''
                )
                setPolicyJustification('')
                setPolicyApplyBranches(true)
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
                setPolicyStartDate(
                    details.customer.effectiveL2.startDate
                        ? details.customer.effectiveL2.startDate.slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                )
                setPolicyEndDate(
                    details.customer.effectiveL2.endDate
                        ? details.customer.effectiveL2.endDate.slice(0, 10)
                        : ''
                )
            }
        } catch (err) {
            console.error('Failed to refresh drawer', err)
        } finally {
            setDrawerLoading(false)
        }
    }

    // Submit Level 2 Pricing Mechanism Proposal (3-step approval: TP.KD -> KT -> CEO)
    const handleSubmitPolicyL2 = async () => {
        if (!drawerCustomer) return
        setPolicySaving(true)
        const branchIds = policyApplyBranches && drawerDetails?.customer?.branches
            ? drawerDetails.customer.branches.map(b => b.id)
            : []
        const res = await submitCustomerPricingPolicyL2(drawerCustomer.id, {
            basePriceType: policyBasePriceType,
            defaultDiscountPct: Number(policyDiscountPct),
            startDate: policyStartDate || undefined,
            endDate: policyEndDate || undefined,
            justification: policyJustification || undefined,
            applyToBranchIds: branchIds,
        })
        if (res.success) {
            toast.success(
                isEn
                    ? `Submitted Level 2 Pricing Policy Proposal (${res.proposalNo}) for 3-step approval. Active policy remains in effect until final approval.`
                    : `Đã lập tờ trình Cơ chế giá Level 2 (${res.proposalNo}) chờ duyệt 3 cấp (TP.KD -> Kế toán -> CEO). Chính sách cũ vẫn giữ hiệu lực cho tới khi duyệt xong.`
            )
            setPolicyJustification('')
            await Promise.all([loadData(), refreshDrawer()])
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setPolicySaving(false)
    }

    const handleApprovePolicyL2 = async (proposalId: string, proposalNo: string, currentLevel: number) => {
        const stepLabel = getStepTitle(currentLevel)
        const comment = prompt(
            isEn
                ? `Approve ${stepLabel} for Level 2 Pricing Proposal ${proposalNo} (Optional comment):`
                : `Xác nhận phê duyệt ${stepLabel} cho Tờ trình Cơ chế giá ${proposalNo} (Nhập ghi chú tùy chọn):`
        )
        if (comment === null) return
        setLoading(true)
        const res = await approveCustomerPricingPolicyL2(proposalId, comment)
        if (res.success) {
            if (res.newStatus === 'APPROVED') {
                toast.success(
                    isEn
                        ? `Final Step 3 (CEO) approved! Level 2 pricing policy (${proposalNo}) is now active.`
                        : `Đã phê duyệt hoàn tất Cấp 3 (CEO)! Cơ chế giá Level 2 của tờ trình ${proposalNo} đã chính thức có hiệu lực.`
                )
            } else {
                toast.success(
                    isEn
                        ? `Approved ${stepLabel} for ${proposalNo}. Forwarded to next approval level.`
                        : `Đã duyệt ${stepLabel} cho tờ trình ${proposalNo}. Đã chuyển sang cấp duyệt tiếp theo.`
                )
            }
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setLoading(false)
    }

    const handleRejectPolicyL2 = async (proposalId: string, proposalNo: string) => {
        const comment = prompt(
            isEn
                ? `Enter rejection reason for Proposal ${proposalNo} (required):`
                : `Nhập lý do từ chối Tờ trình Cơ chế giá ${proposalNo} (bắt buộc):`
        )
        if (!comment) {
            if (comment !== null) toast.warning(cr.dialogs.rejectReasonRequired)
            return
        }
        setLoading(true)
        const res = await rejectCustomerPricingPolicyL2(proposalId, comment)
        if (res.success) {
            toast.success(
                isEn
                    ? `Rejected proposal ${proposalNo}. Previous active policy remains unchanged.`
                    : `Đã từ chối tờ trình ${proposalNo}. Chính sách giá cũ của khách hàng vẫn được giữ nguyên.`
            )
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setLoading(false)
    }

    // Create Rule Action inside Drawer (Level 3)
    const handleCreateRule = async () => {
        if (!drawerCustomer || !formProduct || !formValue) {
            toast.warning(cr.dialogs.toastRuleRequired)
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
            toast.success(cr.dialogs.toastRuleAdded)
            await Promise.all([loadData(), refreshDrawer()])
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setSaving(false)
    }

    const handleApprove = async (id: string) => {
        const comment = prompt(cr.dialogs.approvePrompt)
        if (comment === null) return
        setLoading(true)
        const res = await approveCustomerPriceRule(id, comment)
        if (res.success) {
            toast.success(cr.dialogs.toastApproved)
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setLoading(false)
    }

    const handleReject = async (id: string) => {
        const comment = prompt(cr.dialogs.rejectPrompt)
        if (!comment) {
            if (comment !== null) toast.warning(cr.dialogs.rejectReasonRequired)
            return
        }
        setLoading(true)
        const res = await rejectCustomerPriceRule(id, comment)
        if (res.success) {
            toast.success(cr.dialogs.toastRejected)
            await loadData()
            if (drawerCustomer) await refreshDrawer()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setLoading(false)
    }

    const handleDelete = (id: string) => {
        confirm({
            title: cr.dialogs.deleteRuleTitle,
            message: cr.dialogs.deleteRuleMsg,
            confirmLabel: cr.dialogs.deleteRuleConfirm,
            cancelLabel: i18n.general.cancel,
            danger: true,
            onConfirm: async () => {
                setLoading(true)
                try {
                    const res = await deleteCustomerPriceRule(id)
                    if (res.success) {
                        toast.success(cr.dialogs.toastDeleted)
                        await loadData()
                        if (drawerCustomer) await refreshDrawer()
                    } else {
                        toast.error(i18n.general.errorPrefix + res.error)
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
            toast.warning(cr.dialogs.toastSelectSource)
            return
        }
        if (cloneTargetCustomers.length === 0) {
            toast.warning(cr.dialogs.toastSelectTarget)
            return
        }
        if (cloneSelectedRuleIds.length === 0) {
            toast.warning(cr.dialogs.toastNoSourceRules)
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
            toast.success(cr.dialogs.toastCloneSuccess(res.clonedCount ?? 0, res.targetCount ?? 0))
            setCloneModalOpen(false)
            await loadData()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setCloning(false)
    }

    // Pending rules for quick approval banner (Level 3)
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

    const getChannelLabel = (ch?: string | null) => {
        if (!ch) return i18n.channels.UNASSIGNED
        return (i18n.channels as Record<string, string>)[ch] ?? ch
    }

    const formatBaseLabelText = (basePriceType: string) => {
        if (basePriceType === 'WHOLESALE') return cr.baseTypes.WHOLESALE
        if (basePriceType === 'RETAIL') return cr.baseTypes.RETAIL
        if (basePriceType === 'HORECA') return cr.baseTypes.HORECA
        return cr.baseTypes.BY_CHANNEL
    }

    // Format Base Price Type Display (Level 2)
    const renderMasterLevel2Cell = (c: CustomerPricingMasterResult['customers'][number]) => {
        const label = formatBaseLabelText(c.basePriceType)
        const eff = c.effectiveL2
        const pending = c.pendingL2Proposal

        return (
            <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={c.defaultDiscountPct > 0 || c.basePriceType !== 'BY_CHANNEL' ? 'font-semibold text-slate-800' : 'text-slate-600'}>
                        {label}
                    </span>
                    {c.defaultDiscountPct > 0 && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold whitespace-nowrap">
                            -{c.defaultDiscountPct}% {isEn ? 'all SKUs' : 'toàn kho'}
                        </span>
                    )}
                    {eff.isInherited && eff.inheritedFromCode && (
                        <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-50 text-[#0891B2] border border-cyan-200 whitespace-nowrap"
                            title={isEn ? `Inherited from parent: ${eff.inheritedFromName}` : `Kế thừa từ Công ty mẹ: ${eff.inheritedFromName}`}
                        >
                            <GitBranch size={10} /> {isEn ? `From ${eff.inheritedFromCode}` : `Kế thừa từ ${eff.inheritedFromCode}`}
                        </span>
                    )}
                    {eff.isExpired && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            {isEn ? `Expired (-${eff.rawDiscountPct}%) -> Level 1` : `Hết hạn (-${eff.rawDiscountPct}%) -> Về Level 1`}
                        </span>
                    )}
                </div>

                {eff.isActive && (eff.startDate || eff.endDate) && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" />
                        <span>
                            {eff.startDate ? formatDate(eff.startDate) : '—'}
                            {' -> '}
                            {eff.endDate ? formatDate(eff.endDate) : cr.drawer.noExpiry}
                        </span>
                    </div>
                )}

                {pending && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-semibold">
                        <Clock size={11} />
                        <span>
                            {isEn ? 'Pending' : 'Đang trình'} {formatBaseLabelText(pending.proposedBasePriceType)} -{pending.proposedDiscountPct}% ({getStepTitle(pending.currentLevel)})
                        </span>
                    </div>
                )}
            </div>
        )
    }

    const kpis = masterOverview?.kpis
    const totalPendingCount = (kpis?.pendingRulesCount ?? 0) + (kpis?.pendingL2Count ?? pendingPoliciesL2.length)

    return (
        <div className="w-full space-y-3">
            {/* 4-Level Pricing Hierarchy Reference Bar */}
            <div className="p-3 rounded-lg bg-slate-900 text-white border border-slate-800 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                        <Layers size={15} className="text-[#0891B2] shrink-0" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {isEn
                                ? '4-Level Pricing Priority (Level 4 -> 3 -> 2 -> 1):'
                                : 'Thứ Tự Ưu Tiên Áp Giá 4 Tầng (Level 4 -> 3 -> 2 -> 1):'}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 flex-1 lg:max-w-4xl">
                        <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-bold text-amber-400 uppercase">Level 4 · {isEn ? 'Priority 1' : 'Ưu tiên 1'}</div>
                                <div className="text-xs font-semibold text-white">{isEn ? 'Promotion Campaign' : 'Chương Trình KM (CTKM)'}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">{isEn ? 'Highest' : 'Cao nhất'}</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-sky-700/60 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-bold text-sky-400 uppercase">Level 3 · {isEn ? 'Priority 2' : 'Ưu tiên 2'}</div>
                                <div className="text-xs font-semibold text-white">{isEn ? 'Special Price per SKU' : 'Giá Đặc Biệt Từng Mã SKU'}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">{isEn ? 'Overrides L2' : 'Đè Level 2'}</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-emerald-600/60 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-bold text-emerald-400 uppercase">Level 2 · {isEn ? 'Priority 3' : 'Ưu tiên 3'}</div>
                                <div className="text-xs font-semibold text-white">{isEn ? 'Customer % Policy (All SKUs)' : 'Cơ Chế Giảm % Toàn Kho'}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">{isEn ? '3-Step Approval' : 'Duyệt 3 cấp'}</span>
                        </div>
                        <div className="px-2.5 py-1.5 rounded bg-slate-800/90 border border-slate-700 flex items-center justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Level 1 · {isEn ? 'Base' : 'Nền tảng'}</div>
                                <div className="text-xs font-semibold text-slate-200">{isEn ? 'Channel Base Price' : 'Giá Chuẩn Theo Kênh'}</div>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">{isEn ? 'Default' : 'Mặc định'}</span>
                        </div>
                    </div>
                </div>
            </div>

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
                            {cr.filters.allCustomers} ({kpis?.totalCustomers ?? customers.length})
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
                            {isEn ? 'Level 2 Policy (% All SKUs)' : 'Cơ chế giảm % toàn kho - Level 2'} ({kpis?.customPolicyCount ?? 0})
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
                            {isEn ? 'Level 3 Special SKU Prices' : 'Giá đặc biệt theo SKU - Level 3'} ({kpis?.hasSpecialPriceCount ?? 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMasterType('PENDING')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                                filterMasterType === 'PENDING'
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : totalPendingCount > 0
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <Clock size={13} />
                            {cr.filters.pending} ({totalPendingCount})
                        </button>
                    </div>

                    {canCreate && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => openCloneModal()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition shadow-xs"
                            >
                                <Copy size={13} className="text-slate-500" /> {cr.filters.cloneToBranch}
                            </button>
                            <Link
                                href="/dashboard/proposals?category=PRICE_ADJUSTMENT&action=create"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#0E7490] hover:bg-[#155E75] text-white transition shadow-xs"
                            >
                                <FileText size={13} /> {cr.filters.createProposal}
                            </Link>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Search & Channel Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-1 max-w-xl">
                        <SearchInput
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={cr.filters.searchCustomerPlaceholder}
                            className="flex-1"
                        />

                        <select
                            value={filterChannel}
                            onChange={e => setFilterChannel(e.target.value)}
                            className="px-3 py-1.5 text-xs outline-none cursor-pointer bg-white border border-slate-300 focus:border-[#0891B2] text-slate-800 rounded-md transition shrink-0"
                        >
                            <option value="ALL">{i18n.channels.ALL}</option>
                            <option value="HORECA">{i18n.channels.HORECA}</option>
                            <option value="WHOLESALE_DISTRIBUTOR">{i18n.channels.WHOLESALE_DISTRIBUTOR}</option>
                            <option value="VIP_RETAIL">{i18n.channels.VIP_RETAIL}</option>
                            <option value="DIRECT_INDIVIDUAL">{i18n.channels.DIRECT_INDIVIDUAL}</option>
                        </select>
                    </div>

                    <div className="text-xs text-slate-500">
                        {cr.filters.showingCount} <strong className="text-slate-800">{masterOverview?.customers.length ?? 0}</strong> {cr.filters.customersUnit}
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* QUEUE 1: LEVEL 2 CUSTOMER PRICING MECHANISM APPROVAL (3-STEP FLOW)     */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {pendingPoliciesL2.length > 0 && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50/30 overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-emerald-100/80 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                            <ShieldCheck size={15} className="text-emerald-700" />
                            {isEn
                                ? `Level 2 Customer Pricing Mechanism Approval Queue (${pendingPoliciesL2.length} pending)`
                                : `Luồng Phê Duyệt Cơ Chế Giá Khách Hàng Toàn Kho — Level 2 (${pendingPoliciesL2.length} tờ trình đang chờ)`}
                        </span>
                        <span className="text-[11px] text-emerald-800 font-medium">
                            {isEn
                                ? 'Mandatory 3-Step Flow: Sales Mgr -> Accounting -> CEO · Current active policy stays in effect until Step 3 is approved'
                                : 'Quy trình bắt buộc 3 cấp: TP.KD (Cấp 1) -> Kế toán (Cấp 2) -> CEO (Cấp 3) · Chính sách cũ giữ hiệu lực tới khi Cấp 3 duyệt xong'}
                        </span>
                    </div>
                    <div className="overflow-x-auto bg-white">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{isEn ? 'Proposal / Customer' : 'Số TT / Khách Hàng'}</Th>
                                    <Th>{isEn ? 'Currently Active' : 'Đang Hiệu Lực'}</Th>
                                    <Th>{isEn ? 'Proposed Policy (Level 2)' : 'Đề Xuất Mới (Level 2)'}</Th>
                                    <Th>{isEn ? 'Validity Period' : 'Thời Hạn Hiệu Lực'}</Th>
                                    <Th>{isEn ? '3-Step Approval Progress' : 'Tiến Độ Duyệt 3 Cấp'}</Th>
                                    <Th align="right">{isEn ? 'Approval Action' : 'Thao Tác Phê Duyệt'}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {pendingPoliciesL2.map(item => {
                                    const canAct = canApproveL2Step(item.currentLevel, item.requiredRole)
                                    return (
                                        <Tr key={item.proposalId}>
                                            <Td>
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        href={`/dashboard/proposals?id=${item.proposalId}`}
                                                        className="font-mono font-bold text-[#0891B2] hover:underline"
                                                    >
                                                        {item.proposalNo}
                                                    </Link>
                                                    <span className="text-slate-300">|</span>
                                                    <span className="font-mono text-slate-600 font-semibold">{item.customerCode}</span>
                                                </div>
                                                <div className="font-semibold text-slate-900 mt-0.5">{item.customerName}</div>
                                                <div className="text-[11px] text-slate-500">
                                                    {item.creatorName} · {formatDate(item.createdAt)}
                                                </div>
                                            </Td>
                                            <Td>
                                                <div className="text-slate-700 font-medium">{formatBaseLabelText(item.currentActiveBasePriceType)}</div>
                                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-mono font-semibold">
                                                    -{item.currentActiveDiscountPct}%
                                                </span>
                                            </Td>
                                            <Td>
                                                <div className="font-semibold text-emerald-900">{formatBaseLabelText(item.proposedBasePriceType)}</div>
                                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                                                    -{item.proposedDiscountPct}% {isEn ? 'all SKUs' : 'toàn kho'}
                                                </span>
                                                {item.branchIds.length > 0 && (
                                                    <div className="text-[10px] text-[#0891B2] font-semibold mt-0.5">
                                                        + {item.branchIds.length} {isEn ? 'child branches' : 'chi nhánh con'}
                                                    </div>
                                                )}
                                            </Td>
                                            <Td className="text-[11px] text-slate-600">
                                                <div className="font-medium text-slate-800">
                                                    {item.startDate ? formatDate(item.startDate) : '—'}
                                                </div>
                                                <div className="text-slate-500">
                                                    {item.endDate ? `${cr.drawer.untilPrefix} ${formatDate(item.endDate)}` : cr.drawer.noExpiry}
                                                </div>
                                            </Td>
                                            <Td>
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {[1, 2, 3].map(lvl => {
                                                        const isDone = item.currentLevel > lvl
                                                        const isCurrent = item.currentLevel === lvl
                                                        return (
                                                            <span
                                                                key={lvl}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                                    isDone
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                        : isCurrent
                                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                        : 'bg-slate-50 text-slate-400 border-slate-200'
                                                                }`}
                                                            >
                                                                {isDone ? '✓ ' : isCurrent ? '● ' : ''}{getStepTitle(lvl)}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            </Td>
                                            <Td align="right">
                                                {canAct ? (
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprovePolicyL2(item.proposalId, item.proposalNo, item.currentLevel)}
                                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center gap-1"
                                                        >
                                                            <Check size={12} /> {isEn ? `Approve Step ${item.currentLevel}` : `Duyệt Cấp ${item.currentLevel}`}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRejectPolicyL2(item.proposalId, item.proposalNo)}
                                                            className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition inline-flex items-center gap-1"
                                                        >
                                                            <Ban size={12} /> {cr.pendingBanner.rejectBtn}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-amber-700 font-medium">
                                                        {isEn ? `Waiting ${getStepTitle(item.currentLevel)}` : `Chờ ${getStepTitle(item.currentLevel)}`}
                                                    </span>
                                                )}
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* QUEUE 2: LEVEL 3 PER-SKU SPECIAL PRICE APPROVAL                        */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {filterMasterType === 'PENDING' && pendingRules.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/40 overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-amber-100/70 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <Clock size={14} /> {cr.pendingBanner.title} — Level 3 ({pendingRules.length})
                        </span>
                        <span className="text-[11px] text-amber-800">
                            {cr.pendingBanner.subtitle}
                        </span>
                    </div>

                    {/* Desktop Pending Table */}
                    <div className="hidden md:block overflow-x-auto bg-white">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{cr.pendingBanner.colCustomer}</Th>
                                    <Th>{cr.pendingBanner.colProduct}</Th>
                                    <Th align="right">{cr.pendingBanner.colProposedPrice}</Th>
                                    <Th>{cr.pendingBanner.colRequester}</Th>
                                    <Th align="right">{cr.pendingBanner.colApproval}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {pendingRules.map(rule => (
                                    <Tr key={rule.id}>
                                        <Td>
                                            <span className="font-mono text-[#0891B2] font-semibold mr-1.5">[{rule.customerCode}]</span>
                                            <span className="font-semibold text-slate-900">{rule.customerName}</span>
                                        </Td>
                                        <Td>
                                            <span className="font-medium text-slate-900">{rule.productName}</span>
                                            <span className="font-mono text-[11px] text-slate-500 ml-1.5">({rule.skuCode})</span>
                                        </Td>
                                        <Td align="right" className="font-mono font-bold text-emerald-700">
                                            {rule.ruleType === 'FIXED_DISCOUNT' ? `-${rule.value}%` : formatCurrency(rule.value)}
                                        </Td>
                                        <Td className="text-slate-600">
                                            {rule.requesterName} · {formatDate(rule.startDate)}
                                        </Td>
                                        <Td align="right">
                                            {canApprove ? (
                                                <div className="inline-flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprove(rule.id)}
                                                        className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center gap-1"
                                                    >
                                                        <Check size={12} /> {cr.pendingBanner.approveBtn}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReject(rule.id)}
                                                        className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition inline-flex items-center gap-1"
                                                    >
                                                        <Ban size={12} /> {cr.pendingBanner.rejectBtn}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-amber-700 font-medium">{cr.pendingBanner.waitingManager}</span>
                                            )}
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Pending Cards (<768px) */}
                    <div className="block md:hidden divide-y divide-amber-200 bg-white">
                        {pendingRules.map(rule => (
                            <div key={rule.id} className="p-3.5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="font-mono text-xs text-[#0891B2] font-semibold mr-1.5">[{rule.customerCode}]</span>
                                        <span className="text-xs font-bold text-slate-900">{rule.customerName}</span>
                                        <p className="text-xs text-slate-700 mt-0.5">
                                            {rule.productName} <span className="font-mono text-[11px] text-slate-500">({rule.skuCode})</span>
                                        </p>
                                    </div>
                                    <span className="font-mono text-sm font-bold text-emerald-700 shrink-0">
                                        {rule.ruleType === 'FIXED_DISCOUNT' ? `-${rule.value}%` : formatCurrency(rule.value)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                    <span className="text-[11px] text-slate-500">
                                        {rule.requesterName} · {formatDate(rule.startDate)}
                                    </span>
                                    {canApprove ? (
                                        <div className="inline-flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(rule.id)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
                                            >
                                                <Check size={12} /> {cr.pendingBanner.approveBtn}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReject(rule.id)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 inline-flex items-center gap-1"
                                            >
                                                <Ban size={12} /> {cr.pendingBanner.rejectBtn}
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-amber-700 font-medium">{cr.pendingBanner.waitingManager}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Streamlined Master Customers Table */}
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <Table>
                        <THead>
                            <tr>
                                <Th>{cr.masterTable.colCustomer}</Th>
                                <Th className="w-36">{cr.masterTable.colChannel} (Level 1)</Th>
                                <Th>{cr.masterTable.colDefaultPolicy} (Level 2)</Th>
                                <Th>{cr.masterTable.colSpecialPrices} (Level 3)</Th>
                                <Th align="right" className="w-40">{cr.masterTable.colDetails}</Th>
                            </tr>
                        </THead>
                        <TBody>
                            {loading && !masterOverview ? (
                                <TableMessageRow colSpan={5}>
                                    <div className="py-8 text-center">
                                        <Loader2 className="animate-spin mx-auto text-[#0891B2]" size={26} />
                                        <p className="mt-2 text-xs text-slate-600">{cr.masterTable.loading}</p>
                                    </div>
                                </TableMessageRow>
                            ) : masterOverview?.customers.length === 0 ? (
                                <TableMessageRow colSpan={5}>
                                    <div className="py-6 text-center text-slate-500">
                                        {cr.masterTable.empty}
                                    </div>
                                </TableMessageRow>
                            ) : (
                                masterOverview?.customers.map(c => {
                                    const chStyle = CHANNEL_STYLE[c.channel ?? ''] ?? { color: '#475569', bg: 'rgba(100,116,139,0.12)' }
                                    const chLabel = getChannelLabel(c.channel)
                                    const hasSpecial = c.specialRuleCount > 0
                                    const hasPending = c.pendingRuleCount > 0

                                    return (
                                        <Tr
                                            key={c.id}
                                            onClick={() => handleOpenDrawer(c)}
                                            className="cursor-pointer group"
                                        >
                                            <Td>
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
                                                {c.parentName && (
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {isEn ? 'Parent:' : 'Thuộc chuỗi:'} <span className="font-medium text-slate-700">{c.parentName}</span>
                                                    </div>
                                                )}
                                            </Td>

                                            <Td>
                                                <span
                                                    className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                                                    style={{ color: chStyle.color, background: chStyle.bg }}
                                                >
                                                    {chLabel}
                                                </span>
                                            </Td>

                                            <Td>
                                                {renderMasterLevel2Cell(c)}
                                            </Td>

                                            <Td>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {hasSpecial ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
                                                            <Zap size={12} /> {c.specialRuleCount} {cr.masterTable.productsCount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">{cr.masterTable.byDefaultPrice}</span>
                                                    )}

                                                    {hasPending && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                                                            <Clock size={11} /> {c.pendingRuleCount} {cr.masterTable.pendingCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </Td>

                                            <Td align="right">
                                                <button
                                                    type="button"
                                                    onClick={e => {
                                                        e.stopPropagation()
                                                        handleOpenDrawer(c)
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-white group-hover:bg-[#0E7490] text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-[#0E7490] transition shadow-2xs"
                                                >
                                                    {cr.masterTable.configureBtn} <ChevronRight size={14} />
                                                </button>
                                            </Td>
                                        </Tr>
                                    )
                                })
                            )}
                        </TBody>
                    </Table>
                </div>

                {/* Mobile Card View (<768px) */}
                <div className="block md:hidden divide-y divide-slate-200">
                    {loading && !masterOverview ? (
                        <div className="py-12 text-center">
                            <Loader2 className="animate-spin mx-auto text-[#0891B2]" size={24} />
                            <p className="mt-2 text-xs text-slate-600">{cr.masterTable.loading}</p>
                        </div>
                    ) : masterOverview?.customers.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-500">
                            {cr.masterTable.empty}
                        </div>
                    ) : (
                        masterOverview?.customers.map(c => {
                            const chStyle = CHANNEL_STYLE[c.channel ?? ''] ?? { color: '#475569', bg: 'rgba(100,116,139,0.12)' }
                            const chLabel = getChannelLabel(c.channel)
                            const hasSpecial = c.specialRuleCount > 0
                            const hasPending = c.pendingRuleCount > 0

                            return (
                                <div
                                    key={c.id}
                                    onClick={() => handleOpenDrawer(c)}
                                    className="p-3.5 space-y-2.5 hover:bg-slate-50 cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-xs font-bold text-[#0891B2]">{c.code}</span>
                                                <span
                                                    className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                    style={{ color: chStyle.color, background: chStyle.bg }}
                                                >
                                                    {chLabel}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-snug">{c.name}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation()
                                                handleOpenDrawer(c)
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-white text-slate-700 border border-slate-300 shrink-0"
                                        >
                                            {cr.masterTable.configureBtn} <ChevronRight size={13} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                        <div>{renderMasterLevel2Cell(c)}</div>
                                        <div className="flex items-center gap-1.5">
                                            {hasSpecial ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                    <Zap size={11} /> {c.specialRuleCount} {cr.masterTable.productsCount}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[11px]">{cr.masterTable.byDefaultPrice}</span>
                                            )}
                                            {hasPending && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <Clock size={10} /> {c.pendingRuleCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* ALL-IN-ONE DRAWER: CUSTOMER PRICING CONFIGURATION                      */}
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
                                                {getChannelLabel(drawerDetails.customer.channel)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {cr.drawer.subtitle}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={refreshDrawer}
                                    className="p-2 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                    title={cr.drawer.reloadTitle}
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

                        {/* Section 1: Level 2 Pricing Mechanism (All SKUs - 3-Step Approval) */}
                        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                        {cr.drawer.section1Label} (Level 2)
                                    </span>
                                    {drawerDetails?.customer?.effectiveL2?.isActive ? (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            {isEn ? 'Active:' : 'Đang hiệu lực:'} {formatBaseLabelText(drawerDetails.customer.basePriceType)} -{drawerDetails.customer.defaultDiscountPct}%
                                        </span>
                                    ) : drawerDetails?.customer?.effectiveL2?.isExpired ? (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                            {isEn
                                                ? `Expired (-${drawerDetails.customer.effectiveL2.rawDiscountPct}%) -> Auto fallback to Level 1`
                                                : `Đã hết hạn (-${drawerDetails.customer.effectiveL2.rawDiscountPct}%) -> Đang tự về giá Kênh Level 1`}
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">
                                            {isEn ? 'Using Channel Base Price (Level 1)' : 'Đang áp giá Kênh Chuẩn (Level 1)'}
                                        </span>
                                    )}
                                    {drawerDetails?.customer?.effectiveL2?.isInherited && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-[#0891B2] border border-cyan-200">
                                            <GitBranch size={11} />
                                            {isEn
                                                ? `Inherited from Parent (${drawerDetails.customer.effectiveL2.inheritedFromCode})`
                                                : `Kế thừa từ Công ty mẹ (${drawerDetails.customer.effectiveL2.inheritedFromCode})`}
                                        </span>
                                    )}
                                </div>
                                {drawerDetails?.customer?.effectiveL2?.proposalNo && (
                                    <span className="text-[11px] text-slate-500 font-mono">
                                        {drawerDetails.customer.effectiveL2.proposalNo}
                                    </span>
                                )}
                            </div>

                            {/* Pending Level 2 Proposal Banner inside Drawer */}
                            {drawerDetails?.customer?.pendingL2Proposal && (
                                <div className="p-3 rounded-md bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                                            <Clock size={13} className="text-amber-700" />
                                            <span>
                                                {drawerDetails.customer.pendingL2Proposal.proposalNo}: {formatBaseLabelText(drawerDetails.customer.pendingL2Proposal.proposedBasePriceType)} · -{drawerDetails.customer.pendingL2Proposal.proposedDiscountPct}% {isEn ? 'all SKUs' : 'toàn kho'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-amber-800">
                                            {isEn
                                                ? `Active policy (${formatBaseLabelText(drawerDetails.customer.basePriceType)} -${drawerDetails.customer.defaultDiscountPct}%) remains in effect until Step 3 (CEO) is approved.`
                                                : `Chính sách đang hiệu lực (${formatBaseLabelText(drawerDetails.customer.basePriceType)} -${drawerDetails.customer.defaultDiscountPct}%) vẫn giữ nguyên trên Báo giá/Đơn hàng cho tới khi tờ trình này duyệt xong Cấp 3 (CEO).`}
                                        </div>
                                        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                            {[1, 2, 3].map(lvl => {
                                                const cur = drawerDetails.customer.pendingL2Proposal!.currentLevel
                                                const isDone = cur > lvl
                                                const isCurrent = cur === lvl
                                                return (
                                                    <span
                                                        key={lvl}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                            isDone
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                                : isCurrent
                                                                ? 'bg-amber-200/80 text-amber-950 border-amber-400'
                                                                : 'bg-white text-slate-400 border-slate-200'
                                                        }`}
                                                    >
                                                        {isDone ? '✓ ' : isCurrent ? '● ' : ''}{getStepTitle(lvl)}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    {canApproveL2Step(drawerDetails.customer.pendingL2Proposal.currentLevel) && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleApprovePolicyL2(
                                                    drawerDetails.customer.pendingL2Proposal!.proposalId,
                                                    drawerDetails.customer.pendingL2Proposal!.proposalNo,
                                                    drawerDetails.customer.pendingL2Proposal!.currentLevel
                                                )}
                                                className="px-3 py-1.5 rounded text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center gap-1"
                                            >
                                                <Check size={13} /> {isEn ? `Approve Step ${drawerDetails.customer.pendingL2Proposal.currentLevel}` : `Duyệt Cấp ${drawerDetails.customer.pendingL2Proposal.currentLevel}`}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRejectPolicyL2(
                                                    drawerDetails.customer.pendingL2Proposal!.proposalId,
                                                    drawerDetails.customer.pendingL2Proposal!.proposalNo
                                                )}
                                                className="px-3 py-1.5 rounded text-xs font-bold bg-white text-rose-700 border border-rose-300 hover:bg-rose-50 transition inline-flex items-center gap-1"
                                            >
                                                <Ban size={13} /> {cr.pendingBanner.rejectBtn}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Form to Submit New Level 2 Pricing Mechanism Proposal (RBAC Gated by canCreate) */}
                            {canCreate ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                        <div className="sm:col-span-3">
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                {isEn ? 'Base Price List (Level 2)' : 'Bảng Giá Gốc (Level 2)'}
                                            </label>
                                            <select
                                                value={policyBasePriceType}
                                                onChange={e => setPolicyBasePriceType(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2] font-medium"
                                            >
                                                <option value="BY_CHANNEL">
                                                    {cr.drawer.optByChannelPrefix} ({drawerDetails?.customer?.channel ? getChannelLabel(drawerDetails.customer.channel) : cr.drawer.optByChannelFallback})
                                                </option>
                                                <option value="WHOLESALE">{cr.drawer.optWholesale}</option>
                                                <option value="RETAIL">{cr.drawer.optRetail}</option>
                                                <option value="HORECA">{cr.drawer.optHoreca}</option>
                                            </select>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                {cr.drawer.discountPctLabel}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="0.5"
                                                    value={policyDiscountPct}
                                                    onChange={e => setPolicyDiscountPct(Number(e.target.value))}
                                                    className="w-full px-2.5 py-1.5 pr-6 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2] font-mono font-bold"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                {cr.drawer.validFromLabel}
                                            </label>
                                            <input
                                                type="date"
                                                value={policyStartDate}
                                                onChange={e => setPolicyStartDate(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                {cr.drawer.validToLabel}
                                            </label>
                                            <input
                                                type="date"
                                                value={policyEndDate}
                                                onChange={e => setPolicyEndDate(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                        </div>

                                        <div className="sm:col-span-3">
                                            <button
                                                type="button"
                                                disabled={policySaving || Boolean(drawerDetails?.customer?.pendingL2Proposal)}
                                                onClick={handleSubmitPolicyL2}
                                                className="w-full px-3 py-1.5 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                                            >
                                                {policySaving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                <span>{isEn ? 'Submit Policy (3-Step)' : 'Trình Duyệt Cơ Chế (3 Cấp)'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                                        <input
                                            value={policyJustification}
                                            onChange={e => setPolicyJustification(e.target.value)}
                                            placeholder={isEn ? 'Justification for Level 2 pricing policy...' : 'Lý do đề xuất cơ chế giá Level 2 (VD: Cam kết doanh số quý / Hợp đồng đại lý)...'}
                                            className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 text-slate-900 rounded-md outline-none focus:border-[#0891B2]"
                                        />
                                        {drawerDetails?.customer?.branches && drawerDetails.customer.branches.length > 0 && (
                                            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={policyApplyBranches}
                                                    onChange={e => setPolicyApplyBranches(e.target.checked)}
                                                    className="rounded accent-[#0891B2]"
                                                />
                                                <span>
                                                    {isEn
                                                        ? `Also apply to ${drawerDetails.customer.branches.length} child branches`
                                                        : `Áp dụng kèm ${drawerDetails.customer.branches.length} chi nhánh con`}
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-[11px] text-slate-500 italic">
                                    {isEn
                                        ? 'Read-only view: Only Sales / Commercial Management / BOD can submit new Level 2 pricing proposals.'
                                        : 'Chế độ xem: Chỉ bộ phận Kinh doanh (Sales) / Quản lý / Ban Giám Đốc có quyền trình đề xuất cơ chế giá Level 2 mới.'}
                                </div>
                            )}
                        </div>

                        {/* Section 2: Special Price Rules Toolbar (Level 3) */}
                        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    {cr.drawer.section2Title} — Level 3 ({drawerDetails?.rules.length ?? 0})
                                </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="relative w-48">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={drawerRuleSearch}
                                        onChange={e => setDrawerRuleSearch(e.target.value)}
                                        placeholder={cr.drawer.searchRulePlaceholder}
                                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                    />
                                </div>

                                {canCreate && (drawerDetails?.rules.length ?? 0) > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => openCloneModal(drawerCustomer.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition"
                                    >
                                        <Copy size={13} /> {cr.drawer.cloneBtn}
                                    </button>
                                )}

                                {canCreate && (
                                    <button
                                        type="button"
                                        onClick={() => setAddRuleOpen(prev => !prev)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-[#0E7490] hover:bg-[#155E75] text-white transition"
                                    >
                                        {addRuleOpen ? <X size={14} /> : <Plus size={14} />}
                                        {addRuleOpen ? cr.drawer.closeAddFormBtn : cr.drawer.openAddFormBtn}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Inline Add Special Rule Form inside Drawer */}
                        {addRuleOpen && (
                            <div className="p-4 bg-cyan-50/50 border-b border-cyan-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-[#0E7490] uppercase tracking-wider">
                                        {cr.drawer.addFormTitle}
                                    </h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    <div className="md:col-span-5">
                                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">{cr.drawer.selectProductLabel}</label>
                                        <input
                                            value={formProductSearch}
                                            onChange={e => setFormProductSearch(e.target.value)}
                                            placeholder={cr.drawer.filterProductPlaceholder}
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
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">{cr.drawer.priceTypeLabel}</label>
                                            <select
                                                value={formType}
                                                onChange={e => setFormType(e.target.value as 'SPECIAL_PRICE' | 'FIXED_DISCOUNT')}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            >
                                                <option value="SPECIAL_PRICE">{cr.drawer.optSpecialPrice}</option>
                                                <option value="FIXED_DISCOUNT">{cr.drawer.optFixedDiscount}</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                {formType === 'FIXED_DISCOUNT' ? cr.drawer.discountRateLabel : cr.drawer.agreedUnitPriceLabel}
                                            </label>
                                            <input
                                                type="number"
                                                value={formValue}
                                                onChange={e => setFormValue(e.target.value)}
                                                placeholder={formType === 'FIXED_DISCOUNT' ? cr.drawer.placeholderDiscount : cr.drawer.placeholderPrice}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2] font-mono font-semibold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">{cr.drawer.validFromLabel}</label>
                                            <input
                                                type="date"
                                                value={formStart}
                                                onChange={e => setFormStart(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">{cr.drawer.validToLabel}</label>
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
                                                placeholder={cr.drawer.notesPlaceholder}
                                                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md outline-none focus:border-[#0891B2]"
                                            />
                                            <button
                                                type="button"
                                                disabled={saving || !formProduct || !formValue}
                                                onClick={handleCreateRule}
                                                className="px-4 py-1.5 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] disabled:opacity-40 shrink-0"
                                            >
                                                {saving ? <Loader2 size={14} className="animate-spin" /> : cr.drawer.saveRuleBtn}
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
                                    <p className="mt-2 text-xs text-slate-600">{cr.drawer.loadingDetail}</p>
                                </div>
                            ) : !drawerDetails || drawerDetails.rules.length === 0 ? (
                                <div className="text-center py-14 border border-dashed border-slate-300 rounded-lg bg-white">
                                    <SlidersHorizontal size={28} className="mx-auto text-slate-400 mb-2" />
                                    <h4 className="text-sm font-semibold text-slate-800">{cr.drawer.emptyRulesTitle}</h4>
                                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                        {cr.drawer.emptyRulesDesc}
                                    </p>
                                    {canCreate && !addRuleOpen && (
                                        <button
                                            type="button"
                                            onClick={() => setAddRuleOpen(true)}
                                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75]"
                                        >
                                            <Plus size={14} /> {cr.drawer.addFirstRuleBtn}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-xs">
                                    {/* Desktop Drawer Rules Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <Table>
                                            <THead>
                                                <tr>
                                                    <Th>{cr.drawer.colProductSku}</Th>
                                                    <Th align="right">{cr.drawer.colListPrice}</Th>
                                                    <Th align="right">{cr.drawer.colAgreedPrice}</Th>
                                                    <Th align="center">{cr.drawer.colDiff}</Th>
                                                    <Th>{cr.drawer.colValidity}</Th>
                                                    <Th align="center">{cr.drawer.colStatus}</Th>
                                                    <Th align="right">{cr.drawer.colActions}</Th>
                                                </tr>
                                            </THead>
                                            <TBody>
                                                {filteredDrawerRules.map(rule => {
                                                    const statusStyle = STATUS_STYLE[rule.status] ?? { color: '#0F172A', bg: 'rgba(100,116,139,0.1)' }
                                                    const statusLabel = (cr.statuses as Record<string, string>)[rule.status] ?? rule.status
                                                    return (
                                                        <Tr key={rule.id}>
                                                            <Td>
                                                                <div className="font-semibold text-slate-900">{rule.productName}</div>
                                                                <div className="font-mono text-[11px] text-slate-500">{rule.skuCode}</div>
                                                            </Td>
                                                            <Td align="right" className="font-mono text-slate-500">
                                                                {rule.basePrice ? formatCurrency(rule.basePrice) : '—'}
                                                            </Td>
                                                            <Td align="right" className="font-mono font-bold text-emerald-700">
                                                                {formatCurrency(rule.effectivePrice)}
                                                            </Td>
                                                            <Td align="center">
                                                                {rule.savingsPct > 0 ? (
                                                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                                                        -{rule.savingsPct}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </Td>
                                                            <Td className="text-[11px] text-slate-600">
                                                                <div className="font-medium text-slate-800">{formatDate(rule.startDate)}</div>
                                                                <div className="text-slate-500">
                                                                    {rule.endDate ? `${cr.drawer.untilPrefix} ${formatDate(rule.endDate)}` : cr.drawer.noExpiry}
                                                                </div>
                                                            </Td>
                                                            <Td align="center">
                                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap" style={{ color: statusStyle.color, background: statusStyle.bg }}>
                                                                    {statusLabel}
                                                                </span>
                                                            </Td>
                                                            <Td align="right">
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    {rule.status === 'PENDING_APPROVAL' && canApprove && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleApprove(rule.id)}
                                                                                className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                                                                                title={cr.pendingBanner.approveBtn}
                                                                            >
                                                                                <Check size={14} />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleReject(rule.id)}
                                                                                className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                                                                                title={cr.pendingBanner.rejectBtn}
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
                                                                            title={cr.drawer.deleteRuleTitle}
                                                                        >
                                                                            <Trash2 size={14} />
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

                                    {/* Mobile Drawer Rules Cards (<768px) */}
                                    <div className="block md:hidden divide-y divide-slate-200">
                                        {filteredDrawerRules.map(rule => {
                                            const statusStyle = STATUS_STYLE[rule.status] ?? { color: '#0F172A', bg: 'rgba(100,116,139,0.1)' }
                                            const statusLabel = (cr.statuses as Record<string, string>)[rule.status] ?? rule.status
                                            return (
                                                <div key={rule.id} className="p-3.5 space-y-2">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <div className="font-mono text-xs font-bold text-[#0891B2]">{rule.skuCode}</div>
                                                            <div className="text-sm font-semibold text-slate-900 leading-snug">{rule.productName}</div>
                                                        </div>
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ color: statusStyle.color, background: statusStyle.bg }}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-100">
                                                        <div>
                                                            <span className="text-[11px] text-slate-500 block">{cr.drawer.colListPrice}</span>
                                                            <span className="font-mono text-slate-700">{rule.basePrice ? formatCurrency(rule.basePrice) : '—'}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[11px] text-slate-500 block">{cr.drawer.colAgreedPrice}</span>
                                                            <span className="font-mono font-bold text-emerald-700">{formatCurrency(rule.effectivePrice)}</span>
                                                            {rule.savingsPct > 0 && (
                                                                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    -{rule.savingsPct}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                                        <span className="text-[11px] text-slate-500">
                                                            {formatDate(rule.startDate)} · {rule.endDate ? `${cr.drawer.untilPrefix} ${formatDate(rule.endDate)}` : cr.drawer.noExpiry}
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            {rule.status === 'PENDING_APPROVAL' && canApprove && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleApprove(rule.id)}
                                                                        className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleReject(rule.id)}
                                                                        className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-100"
                                                                    >
                                                                        <Ban size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                            {canCreate && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDelete(rule.id)}
                                                                    className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Drawer Footer */}
                        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs text-slate-500">
                                {cr.drawer.footerNote}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setDrawerCustomer(null)
                                    setDrawerDetails(null)
                                }}
                                className="px-5 py-1.5 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition"
                            >
                                {cr.drawer.closeBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════════ */}
            {/* MODAL: CLONE SPECIAL PRICE RULES TO TARGET BRANCHES                    */}
            {/* ══════════════════════════════════════════════════════════════════════ */}
            {cloneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                    <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden">
                        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Copy size={16} className="text-[#0891B2]" /> {cr.cloneModal.title}
                            </h3>
                            <button type="button" onClick={() => setCloneModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">{cr.cloneModal.sourceCustomerLabel}</label>
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
                                    {cr.cloneModal.readyCountPrefix} <strong>{cloneSelectedRuleIds.length}</strong> {cr.cloneModal.readyCountSuffix}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    {cr.cloneModal.targetBranchesLabel}
                                </label>
                                <input
                                    value={cloneSearchTarget}
                                    onChange={e => setCloneSearchTarget(e.target.value)}
                                    placeholder={cr.cloneModal.searchTargetPlaceholder}
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
                                    {cr.cloneModal.overrideLabel}
                                </label>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setCloneModalOpen(false)}
                                className="px-5 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 transition"
                            >
                                {cr.cloneModal.cancelBtn}
                            </button>

                            <button
                                type="button"
                                disabled={cloning || cloneTargetCustomers.length === 0 || cloneSelectedRuleIds.length === 0}
                                onClick={handleExecuteClone}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] transition disabled:opacity-50"
                            >
                                {cloning ? <Loader2 size={14} className="animate-spin" /> : `${cr.cloneModal.executeBtnPrefix} ${cloneTargetCustomers.length} ${cr.cloneModal.executeBtnSuffix}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {confirmDialog}
        </div>
    )
}
