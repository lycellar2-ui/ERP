'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Loader2, X, Check, Ban, Calendar, Settings, ShieldAlert, AlertCircle, HelpCircle, FileText, Copy, Building2, CheckSquare, Square, Sparkles, Share2, ArrowRight } from 'lucide-react'
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
    PriceRuleRow
} from './customer-rules-actions'
import { getProductsForPriceList } from './actions'
import { formatVND } from '@/lib/utils'

const RULE_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    FIXED_DISCOUNT: { label: 'Chiết Khấu Cố Định %', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    FIXED_PRICE: { label: 'Giá Cố Định', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    SPECIAL_PRICE: { label: 'Giá Đặc Biệt', color: '#0891B2', bg: 'rgba(8,145,178,0.15)' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    APPROVED: { label: 'Đã Duyệt', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    REJECTED: { label: 'Từ Chối', color: '#E11D48', bg: 'rgba(225,29,72,0.15)' },
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
    const [rules, setRules] = useState<PriceRuleRow[]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [customers, setCustomers] = useState<CustomerOption[]>([])
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])
    
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    
    // Filters
    const [filterCustomer, setFilterCustomer] = useState('ALL')
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterType, setFilterType] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    // Form state for creating single rule
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

    // Mapping state
    const [mapHoreca, setMapHoreca] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapWholesale, setMapWholesale] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapVip, setMapVip] = useState('DIRECT_INDIVIDUAL')
    const [mapDirect, setMapDirect] = useState('DIRECT_INDIVIDUAL')

    // Permissions check
    const canApprove = currentUser?.permissions.includes('SLS:APPROVE') || currentUser?.roles.includes('CEO')
    const canCreate = currentUser?.permissions.includes('SLS:CREATE')

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [rulesData, mappingData, customersData, productsData] = await Promise.all([
                getCustomerPriceRules(),
                getChannelPriceMapping(),
                getCustomersForRules(),
                getProductsForPriceList()
            ])
            setRules(rulesData)
            setMapping(mappingData)
            setCustomers(customersData)
            setProducts(productsData)

            // Setup mapping states
            setMapHoreca(mappingData.HORECA ?? 'WHOLESALE_DISTRIBUTOR')
            setMapWholesale(mappingData.WHOLESALE_DISTRIBUTOR ?? 'WHOLESALE_DISTRIBUTOR')
            setMapVip(mappingData.VIP_RETAIL ?? 'DIRECT_INDIVIDUAL')
            setMapDirect(mappingData.DIRECT_INDIVIDUAL ?? 'DIRECT_INDIVIDUAL')
        } catch (e) {
            console.error('Failed to load pricing data', e)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

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
        } else {
            alert('Lỗi: ' + res.error)
        }
        setLoading(false)
    }

    // Open Clone Modal helper
    const openCloneModal = (sourceCustId?: string, preselectedRuleId?: string) => {
        const initialSourceId = sourceCustId || (filterCustomer !== 'ALL' ? filterCustomer : customers[0]?.id || '')
        setCloneSourceCustomer(initialSourceId)
        setCloneTargetCustomers([])
        setCloneSearchTarget('')
        setCloneOverrideExisting(true)

        // Select rules
        const sourceRules = rules.filter(r => r.customerId === initialSourceId && r.status === 'APPROVED')
        if (preselectedRuleId) {
            setCloneSelectedRuleIds([preselectedRuleId])
        } else {
            setCloneSelectedRuleIds(sourceRules.map(r => r.id))
        }

        setCloneModalOpen(true)
    }

    // When source customer changes in Clone Modal
    const handleSourceCustomerChange = (newSourceId: string) => {
        setCloneSourceCustomer(newSourceId)
        const sourceRules = rules.filter(r => r.customerId === newSourceId && r.status === 'APPROVED')
        setCloneSelectedRuleIds(sourceRules.map(r => r.id))
        setCloneTargetCustomers([])
    }

    // Source customer object & its approved rules
    const currentSourceObj = useMemo(() => {
        return customers.find(c => c.id === cloneSourceCustomer)
    }, [customers, cloneSourceCustomer])

    const sourceRulesList = useMemo(() => {
        return rules.filter(r => r.customerId === cloneSourceCustomer && r.status === 'APPROVED')
    }, [rules, cloneSourceCustomer])

    // Sibling / Related Branches suggestions
    const relatedBranches = useMemo(() => {
        if (!currentSourceObj) return []
        const parentId = currentSourceObj.parentId ?? currentSourceObj.id
        const brandGroup = currentSourceObj.brandGroup
        return customers.filter(c => {
            if (c.id === currentSourceObj.id) return false
            const sameParent = c.parentId === parentId || c.id === parentId
            const sameBrand = brandGroup && c.brandGroup && c.brandGroup.toLowerCase() === brandGroup.toLowerCase()
            return sameParent || sameBrand
        })
    }, [customers, currentSourceObj])

    // Filter target customers in modal
    const filteredTargetCustomers = useMemo(() => {
        const query = cloneSearchTarget.toLowerCase().trim()
        return customers.filter(c => {
            if (c.id === cloneSourceCustomer) return false
            if (!query) return true
            return c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query) || (c.brandGroup && c.brandGroup.toLowerCase().includes(query))
        })
    }, [customers, cloneSourceCustomer, cloneSearchTarget])

    const handleSelectAllRelatedBranches = () => {
        const relatedIds = relatedBranches.map(r => r.id)
        setCloneTargetCustomers(prev => Array.from(new Set([...prev, ...relatedIds])))
    }

    const toggleTargetCustomer = (id: string) => {
        setCloneTargetCustomers(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const toggleRuleSelection = (ruleId: string) => {
        setCloneSelectedRuleIds(prev =>
            prev.includes(ruleId) ? prev.filter(x => x !== ruleId) : [...prev, ruleId]
        )
    }

    const handleSelectAllRules = () => {
        if (cloneSelectedRuleIds.length === sourceRulesList.length) {
            setCloneSelectedRuleIds([])
        } else {
            setCloneSelectedRuleIds(sourceRulesList.map(r => r.id))
        }
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

    // Filter rules in main table
    const filteredRules = rules.filter(r => {
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

    return (
        <div className="w-full space-y-4">
            {/* Filter and Action Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-md bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                    <div className="relative flex-1 md:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm khách hàng hoặc sản phẩm..."
                            className="w-full pl-9 pr-3 py-2 text-xs outline-none bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-md"
                            style={{ color: '#0F172A' }}
                        />
                    </div>
                    <select
                        value={filterCustomer}
                        onChange={e => setFilterCustomer(e.target.value)}
                        className="px-3 py-2 text-xs outline-none cursor-pointer max-w-[180px] truncate bg-white border border-slate-300 text-slate-900 rounded-md"
                        style={{ color: '#0F172A' }}
                    >
                        <option value="ALL">Tất cả Khách Hàng ({customers.length})</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2 text-xs outline-none cursor-pointer bg-white border border-slate-300 text-slate-900 rounded-md"
                        style={{ color: '#0F172A' }}
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
                        className="px-3 py-2 text-xs outline-none cursor-pointer"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                    >
                        <option value="ALL">Tất cả Loại Giá</option>
                        <option value="FIXED_DISCOUNT">Chiết Khấu %</option>
                        <option value="FIXED_PRICE">Giá Cố Định</option>
                        <option value="SPECIAL_PRICE">Giá Đặc Biệt</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {canCreate && (
                        <button
                            type="button"
                            onClick={() => openCloneModal()}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
                            style={{ background: 'rgba(212,168,83,0.18)', border: '1px solid rgba(212,168,83,0.4)', color: '#D4A853', borderRadius: '6px' }}
                            title="Sao chép cơ chế giá từ khách hàng này sang các chi nhánh / cơ sở khác"
                        >
                            <Copy size={14} /> Áp Dụng Cho Cơ Sở Khác
                        </button>
                    )}
                    {canCreate && (
                        <Link
                            href="/dashboard/proposals?category=PRICE_ADJUSTMENT&action=create"
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90 shadow-sm"
                            style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                        >
                            <FileText size={14} /> + Đề Xuất Giá (Tờ Trình)
                        </Link>
                    )}
                </div>
            </div>

            {/* Table of rules */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433' }}>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Mã Khách Hàng</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Tên Khách Hàng</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Mã Sản Phẩm</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Tên Sản Phẩm</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Loại Áp Dụng</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Giá Trị</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Ngày Bắt Đầu</th>
                                <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Ngày Kết Thúc</th>
                                <th className="p-3 text-center font-semibold" style={{ color: '#4A6A7A' }}>Trạng Thái</th>
                                <th className="p-3 text-right font-semibold" style={{ color: '#4A6A7A' }}>Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rules.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12">
                                        <Loader2 className="animate-spin mx-auto" size={24} style={{ color: '#87CBB9' }} />
                                        <p className="mt-2" style={{ color: '#4A6A7A' }}>Đang tải dữ liệu...</p>
                                    </td>
                                </tr>
                            ) : filteredRules.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                        Không tìm thấy chính sách giá nào khớp bộ lọc.
                                    </td>
                                </tr>
                            ) : filteredRules.map(rule => {
                                const typeCfg = RULE_TYPE_CFG[rule.ruleType] ?? { label: rule.ruleType, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                const statusCfg = STATUS_CFG[rule.status] ?? { label: rule.status, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                return (
                                    <tr key={rule.id} style={{ borderTop: '1px solid #2A4355', background: '#1B2E3D' }} className="hover:bg-[#1f3445] transition">
                                        <td className="p-3 font-mono font-semibold text-xs" style={{ color: '#8AAEBB' }}>
                                            {rule.customerCode}
                                        </td>
                                        <td className="p-3 font-semibold" style={{ color: '#E8F1F2' }}>
                                            {rule.customerName}
                                            {rule.customerChannel && (
                                                <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded" style={{ background: '#142433', color: '#4A6A7A' }}>
                                                    {rule.customerChannel}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono font-semibold" style={{ color: '#87CBB9' }}>
                                            {rule.skuCode}
                                        </td>
                                        <td className="p-3 font-medium text-xs max-w-[220px] truncate" style={{ color: '#E8F1F2' }} title={rule.productName}>
                                            {rule.productName}
                                        </td>
                                        <td className="p-3">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: typeCfg.color, background: typeCfg.bg }}>
                                                {typeCfg.label}
                                            </span>
                                        </td>
                                        <td className="p-3 font-bold">
                                            {rule.ruleType === 'FIXED_DISCOUNT' ? (
                                                <span className="text-[#D4A853]">-{rule.value}%</span>
                                            ) : (
                                                <span className="text-[#87CBB9]">{formatVND(rule.value)}</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                            {new Date(rule.startDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="p-3 text-xs whitespace-nowrap" style={{ color: rule.endDate ? '#8AAEBB' : '#4A6A7A' }}>
                                            {rule.endDate ? new Date(rule.endDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                {statusCfg.label}
                                            </span>
                                            {rule.notes && (
                                                <div className="text-[10px] max-w-[120px] truncate mx-auto mt-1 cursor-help" style={{ color: '#4A6A7A' }} title={rule.notes}>
                                                    {rule.notes}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {canCreate && rule.status === 'APPROVED' && (
                                                    <button
                                                        onClick={() => openCloneModal(rule.customerId, rule.id)}
                                                        className="p-1 rounded bg-[#D4A853]/10 hover:bg-[#D4A853]/20 text-[#D4A853] transition"
                                                        title="Sao chép cơ chế giá này sang cơ sở khác"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                )}
                                                {rule.status === 'PENDING_APPROVAL' && canApprove && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApprove(rule.id)}
                                                            className="p-1 rounded bg-[#87CBB9]/10 hover:bg-[#87CBB9]/20 transition"
                                                            title="Duyệt giá"
                                                        >
                                                            <Check size={14} className="text-[#87CBB9]" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(rule.id)}
                                                            className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 transition"
                                                            title="Từ chối duyệt"
                                                        >
                                                            <Ban size={14} className="text-red-500" />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(rule.id)}
                                                    className="p-1 rounded hover:bg-red-500/10 transition"
                                                    title="Xóa chính sách"
                                                >
                                                    <Trash2 size={14} style={{ color: '#8B1A2E' }} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── MODAL SAO CHÉP / ÁP DỤNG CHO CƠ SỞ KHÁC ─── */}
            {cloneModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div 
                        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[#2A4355] bg-[#1B2E3D]">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-[#D4A853]/15 text-[#D4A853]">
                                    <Copy size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[#E8F1F2]">Sao Chép / Áp Dụng Cơ Chế Giá Cho Các Cơ Sở Khác</h3>
                                    <p className="text-[11px]" style={{ color: '#8AAEBB' }}>Nhân bản chính sách giá đặc biệt sang các chi nhánh hoặc chuỗi khách hàng</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setCloneModalOpen(false)}
                                className="p-1.5 rounded-md hover:bg-white/10 text-[#8AAEBB] hover:text-white transition"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
                            {/* 1. Source Customer Selection */}
                            <div className="space-y-1.5">
                                <label className="font-bold text-[#87CBB9] uppercase tracking-wide flex items-center gap-1.5">
                                    <Building2 size={13} /> 1. Khách Hàng Nguồn (Đang có cơ chế giá) *
                                </label>
                                <select
                                    value={cloneSourceCustomer}
                                    onChange={e => handleSourceCustomerChange(e.target.value)}
                                    className="w-full px-3 py-2.5 text-xs outline-none rounded-md cursor-pointer font-medium"
                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                >
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>
                                            [{c.code}] {c.name} {c.brandGroup ? `(${c.brandGroup})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 2. Rules Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#87CBB9] uppercase tracking-wide">
                                        2. Chọn Chính Sách Giá Cần Sao Chép ({cloneSelectedRuleIds.length}/{sourceRulesList.length}) *
                                    </label>
                                    {sourceRulesList.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleSelectAllRules}
                                            className="text-[11px] text-[#D4A853] hover:underline font-semibold"
                                        >
                                            {cloneSelectedRuleIds.length === sourceRulesList.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                        </button>
                                    )}
                                </div>

                                {sourceRulesList.length === 0 ? (
                                    <div className="p-3 rounded-md text-center text-[#4A6A7A] bg-[#1B2E3D]/50 border border-dashed border-[#2A4355]">
                                        Khách hàng nguồn này chưa có chính sách giá đã duyệt (Approved) nào.
                                    </div>
                                ) : (
                                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-md bg-[#1B2E3D] border border-[#2A4355]">
                                        {sourceRulesList.map(r => {
                                            const isChecked = cloneSelectedRuleIds.includes(r.id)
                                            const typeCfg = RULE_TYPE_CFG[r.ruleType] ?? { label: r.ruleType, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                            return (
                                                <div
                                                    key={r.id}
                                                    onClick={() => toggleRuleSelection(r.id)}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                                                        isChecked ? 'bg-[#2A4355]/60 border border-[#87CBB9]/40' : 'hover:bg-white/5 border border-transparent'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {}} // Handled by parent div
                                                            className="rounded cursor-pointer accent-[#87CBB9]"
                                                        />
                                                        <div>
                                                            <span className="font-mono font-bold text-[#87CBB9] mr-1.5">{r.skuCode}</span>
                                                            <span className="font-medium text-[#E8F1F2]">{r.productName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: typeCfg.color, background: typeCfg.bg }}>
                                                            {typeCfg.label}
                                                        </span>
                                                        <span className="font-bold text-[#87CBB9]">
                                                            {r.ruleType === 'FIXED_DISCOUNT' ? `-${r.value}%` : formatVND(r.value)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 3. Target Branches / Customers Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="font-bold text-[#87CBB9] uppercase tracking-wide flex items-center gap-1.5">
                                        <Share2 size={13} /> 3. Chọn Cơ Sở / Khách Hàng Đích ({cloneTargetCustomers.length} đã chọn) *
                                    </label>
                                </div>

                                {/* Smart Suggestions Pill for Sibling Branches */}
                                {relatedBranches.length > 0 && (
                                    <div className="p-3 rounded-lg bg-[#D4A853]/10 border border-[#D4A853]/30 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[#D4A853] font-bold">
                                                <Sparkles size={14} /> Gợi ý cùng chuỗi / thương hiệu ({relatedBranches.length} cơ sở):
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSelectAllRelatedBranches}
                                                className="px-2 py-0.5 text-[11px] font-semibold bg-[#D4A853]/20 hover:bg-[#D4A853]/30 text-[#D4A853] rounded transition"
                                            >
                                                + Chọn tất cả {relatedBranches.length} cơ sở cùng chuỗi
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {relatedBranches.map(rb => {
                                                const isSel = cloneTargetCustomers.includes(rb.id)
                                                return (
                                                    <button
                                                        key={rb.id}
                                                        type="button"
                                                        onClick={() => toggleTargetCustomer(rb.id)}
                                                        className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition ${
                                                            isSel ? 'bg-[#87CBB9] text-[#0A1926] font-bold' : 'bg-[#142433] text-[#E8F1F2] border border-[#2A4355] hover:border-[#87CBB9]'
                                                        }`}
                                                    >
                                                        {isSel ? <Check size={12} /> : <Plus size={12} />}
                                                        [{rb.code}] {rb.name}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Target Customer Search & List */}
                                <div className="space-y-1.5 p-3 rounded-md bg-[#1B2E3D] border border-[#2A4355]">
                                    <div className="relative mb-2">
                                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4A6A7A]" />
                                        <input
                                            value={cloneSearchTarget}
                                            onChange={e => setCloneSearchTarget(e.target.value)}
                                            placeholder="Tìm nhanh cơ sở / khách hàng theo tên, mã hoặc thương hiệu..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs outline-none rounded bg-[#142433] border border-[#2A4355] text-[#E8F1F2]"
                                        />
                                    </div>

                                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                        {filteredTargetCustomers.map(c => {
                                            const isSelected = cloneTargetCustomers.includes(c.id)
                                            return (
                                                <div
                                                    key={c.id}
                                                    onClick={() => toggleTargetCustomer(c.id)}
                                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition ${
                                                        isSelected ? 'bg-[#87CBB9]/15 border border-[#87CBB9]/50' : 'hover:bg-white/5 border border-transparent'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 truncate">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded cursor-pointer accent-[#87CBB9]"
                                                        />
                                                        <div className="truncate">
                                                            <span className="font-mono font-semibold text-[#8AAEBB] mr-1.5">[{c.code}]</span>
                                                            <span className="font-medium text-[#E8F1F2]">{c.name}</span>
                                                        </div>
                                                    </div>
                                                    {c.brandGroup && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#142433] text-[#4A6A7A] ml-2 shrink-0">
                                                            {c.brandGroup}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* 4. Overwrite Option */}
                            <div className="flex items-center gap-2 pt-1 border-t border-[#2A4355]">
                                <input
                                    type="checkbox"
                                    id="overrideExisting"
                                    checked={cloneOverrideExisting}
                                    onChange={e => setCloneOverrideExisting(e.target.checked)}
                                    className="rounded cursor-pointer accent-[#87CBB9]"
                                />
                                <label htmlFor="overrideExisting" className="text-xs text-[#8AAEBB] cursor-pointer">
                                    Ghi đè chính sách giá nếu mã sản phẩm đã tồn tại ở cơ sở đích
                                </label>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-[#2A4355] bg-[#1B2E3D]">
                            <button
                                type="button"
                                onClick={() => setCloneModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold rounded-md border border-[#2A4355] hover:bg-white/5 transition text-[#8AAEBB]"
                            >
                                Hủy bỏ
                            </button>

                            <button
                                type="button"
                                disabled={cloning || cloneTargetCustomers.length === 0 || cloneSelectedRuleIds.length === 0}
                                onClick={handleExecuteClone}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-md transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: '#87CBB9', color: '#0A1926' }}
                            >
                                {cloning ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" /> Đang sao chép...
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} /> Sao Chép Ngay ({cloneTargetCustomers.length} cơ sở, {cloneSelectedRuleIds.length} chính sách)
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
