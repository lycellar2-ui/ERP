'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2, Loader2, X, Check, Ban, Calendar, Settings, ShieldAlert, AlertCircle, HelpCircle, FileText } from 'lucide-react'
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
    PriceRuleRow
} from './customer-rules-actions'
import { getProductsForPriceList } from './actions'
import { formatVND } from '@/lib/utils'

const RULE_TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    FIXED_DISCOUNT: { label: 'Chiết Khấu Cố Định %', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    FIXED_PRICE: { label: 'Giá Cố Định', color: '#87CBB9', bg: 'rgba(135,203,185,0.12)' },
    SPECIAL_PRICE: { label: 'Giá Đặc Biệt (Có Hạn)', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    PENDING_APPROVAL: { label: 'Chờ Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    APPROVED: { label: 'Đã Duyệt', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    REJECTED: { label: 'Từ Chối', color: '#E11D48', bg: 'rgba(225,29,72,0.15)' },
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
    const [customers, setCustomers] = useState<{ id: string; name: string; code: string; channel: string | null }[]>([])
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])
    
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    
    // Filters
    const [filterCustomer, setFilterCustomer] = useState('ALL')
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterType, setFilterType] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    // Form state
    const [formCustomer, setFormCustomer] = useState('')
    const [formProduct, setFormProduct] = useState('')
    const [formType, setFormType] = useState<'FIXED_DISCOUNT' | 'FIXED_PRICE' | 'SPECIAL_PRICE'>('FIXED_DISCOUNT')
    const [formValue, setFormValue] = useState('')
    const [formStart, setFormStart] = useState(new Date().toISOString().slice(0, 10))
    const [formEnd, setFormEnd] = useState('')
    const [formNotes, setFormNotes] = useState('')
    const [formProductSearch, setFormProductSearch] = useState('')
    const [formCustomerSearch, setFormCustomerSearch] = useState('')

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

    const handleSaveMapping = async () => {
        setSaving(true)
        const res = await saveChannelPriceMapping({
            HORECA: mapHoreca,
            WHOLESALE_DISTRIBUTOR: mapWholesale,
            VIP_RETAIL: mapVip,
            DIRECT_INDIVIDUAL: mapDirect,
        })
        if (res.success) {
            alert('Lưu cấu hình ánh xạ thành công!')
            await loadData()
        } else {
            alert('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    // Filter rules
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

    // Filtered products/customers for create modal
    const filteredProductsForSelect = formProductSearch
        ? products.filter(p => p.productName.toLowerCase().includes(formProductSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(formProductSearch.toLowerCase()))
        : products

    const filteredCustomersForSelect = formCustomerSearch
        ? customers.filter(c => c.name.toLowerCase().includes(formCustomerSearch.toLowerCase()) || c.code.toLowerCase().includes(formCustomerSearch.toLowerCase()))
        : customers

    return (
        <div className="w-full space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm khách hàng hoặc sản phẩm..."
                                className="w-full pl-9 pr-3 py-2 text-xs outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                            />
                        </div>
                        <select
                            value={filterCustomer}
                            onChange={e => setFilterCustomer(e.target.value)}
                            className="px-3 py-2 text-xs outline-none cursor-pointer max-w-[180px] truncate"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        >
                            <option value="ALL">Tất cả Khách Hàng ({customers.length})</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>[{c.code}] {c.name}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                            className="px-3 py-2 text-xs outline-none cursor-pointer"
                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
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
                            <option value="SPECIAL_PRICE">Giá Đặc Biệt (Có Hạn)</option>
                        </select>
                    </div>

                    {canCreate && (
                        <Link
                            href="/dashboard/proposals?category=PRICE_ADJUSTMENT&action=create"
                            className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
                            style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                        >
                            <FileText size={14} /> + Đề Xuất Giá (Tờ Trình)
                        </Link>
                    )}
                </div>

                {/* Table of rules */}
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433' }}>
                                    <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Khách Hàng</th>
                                    <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Sản Phẩm</th>
                                    <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Loại Áp Dụng</th>
                                    <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Giá Trị</th>
                                    <th className="p-3 text-left font-semibold" style={{ color: '#4A6A7A' }}>Hiệu Lực</th>
                                    <th className="p-3 text-center font-semibold" style={{ color: '#4A6A7A' }}>Trạng Thái</th>
                                    <th className="p-3 text-right font-semibold" style={{ color: '#4A6A7A' }}>Hành Động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && rules.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12">
                                            <Loader2 className="animate-spin mx-auto" size={24} style={{ color: '#87CBB9' }} />
                                            <p className="mt-2" style={{ color: '#4A6A7A' }}>Đang tải dữ liệu...</p>
                                        </td>
                                    </tr>
                                ) : filteredRules.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12" style={{ color: '#4A6A7A' }}>
                                            Không tìm thấy chính sách giá nào khớp bộ lọc.
                                        </td>
                                    </tr>
                                ) : filteredRules.map(rule => {
                                    const typeCfg = RULE_TYPE_CFG[rule.ruleType] ?? { label: rule.ruleType, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                    const statusCfg = STATUS_CFG[rule.status] ?? { label: rule.status, color: '#E8F1F2', bg: 'rgba(255,255,255,0.1)' }
                                    return (
                                        <tr key={rule.id} style={{ borderTop: '1px solid #2A4355', background: '#1B2E3D' }} className="hover:bg-[#1f3445] transition">
                                            <td className="p-3 font-semibold" style={{ color: '#E8F1F2' }}>
                                                {rule.customerName}
                                                <div className="text-[10px] font-normal" style={{ color: '#4A6A7A' }}>
                                                    {rule.customerCode} • Kênh: {rule.customerChannel ?? 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-3" style={{ color: '#E8F1F2' }}>
                                                <span className="font-semibold text-[#87CBB9]">{rule.skuCode}</span>
                                                <div className="truncate max-w-[150px] text-[10px] font-normal" style={{ color: '#4A6A7A' }}>{rule.productName}</div>
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
                                            <td className="p-3 text-[10px] whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                                <div>{new Date(rule.startDate).toLocaleDateString('vi-VN')}</div>
                                                <div style={{ color: '#4A6A7A' }}>
                                                    {rule.endDate ? `đến ${new Date(rule.endDate).toLocaleDateString('vi-VN')}` : 'Vô thời hạn'}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                    {statusCfg.label}
                                                </span>
                                                {rule.notes && (
                                                    <div className="text-[10px] max-w-[100px] truncate mx-auto mt-1 cursor-help" style={{ color: '#4A6A7A' }} title={rule.notes}>
                                                        {rule.notes}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
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
        </div>
    )
}
