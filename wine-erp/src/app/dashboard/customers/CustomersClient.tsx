'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import Link from 'next/link'
import {
    Plus, Users, Building2, CreditCard, ShoppingBag, X, Save, Loader2, AlertCircle, BarChart3,
    Upload, Download, Search, Edit2, Trash2, Printer, ChevronDown, FileText, Tag, ArrowUpRight
} from 'lucide-react'
import {
    CustomerRow, CustomerInput, CustomerStats, CustomerFilters,
    createCustomer, updateCustomer, getCustomers, getCustomerById,
    deleteCustomer, exportCustomersData, bulkImportCustomers, getParentCandidates,
    getCustomerStats, getCustomerChannels, getSalesRepList, exportCustomerOnboardingForm,
    approveCustomer, rejectCustomer, getNextCustomerCode, checkCustomerDuplicates,
    lookupTaxInfo, syncCustomerTaxInfoFromGDT,
} from './actions'
import { getLegalEntities, LegalEntityRow } from '../sales/actions'
import { cn, formatVND } from '@/lib/utils'
import type { Tone } from '@/lib/ui/status'
import {
    Badge, Button, Drawer, EmptyState, PageHeader, Pagination, SearchInput, Select, Skeleton, StatCard, StatGrid, StatusBadge,
    Table, TableMessageRow, TableSkeleton, TBody, Td, Th, THead, Toolbar, Tr,
} from '@/components/ui'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { toast } from 'sonner'

const CUSTOMER_TYPE: Record<string, { label: string; tone: Tone }> = {
    HORECA: { label: 'HORECA', tone: 'brand' },
    CORPORATE: { label: 'Corporate', tone: 'success' },
    RETAIL: { label: 'Retail', tone: 'info' },
}

const CUSTOMER_STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Hoạt động',
    INACTIVE: 'Tạm dừng',
    CREDIT_HOLD: 'Giữ tín dụng',
    PENDING_APPROVAL: 'Chờ duyệt',
    REJECTED: 'Bị từ chối',
}
const CUSTOMER_TONE_OVERRIDES = { CREDIT_HOLD: 'warning', PENDING_APPROVAL: 'warning' } as const

const CHANNEL_LABEL: Record<string, string> = {
    HORECA: 'HORECA (Khách sạn/Nhà hàng)',
    CORPORATE: 'Corporate (Doanh nghiệp)',
    RETAIL: 'Retail (Bán lẻ)',
}

const CITIES = [
    'Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Nha Trang', 'Phú Quốc', 'Hội An',
    'Hải Phòng', 'Cần Thơ', 'Huế', 'Vũng Tàu', 'Đà Lạt', 'Quy Nhơn', 'Phan Thiết', 'Sapa',
]

function TypeBadge({ type }: { type: string | null }) {
    const key = type ?? 'HORECA'
    const cfg = CUSTOMER_TYPE[key] ?? { label: key, tone: 'neutral' as Tone }
    return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function StatusDot({ status }: { status: string }) {
    return <StatusBadge status={status} label={CUSTOMER_STATUS_LABEL[status]} toneOverrides={CUSTOMER_TONE_OVERRIDES} />
}

function CustomerMobileCard({
    row,
    onEdit,
    onDelete,
    onSyncTax,
}: {
    row: CustomerRow
    onEdit: () => void
    onDelete: () => void
    onSyncTax?: () => void
}) {
    const taxToDisplay = row.taxId || row.resolvedVatInfo?.taxId
    const isVatInherited = !row.taxId && Boolean(row.resolvedVatInfo?.taxId)

    return (
        <div 
            className="p-3.5 sm:p-4 rounded-lg transition-all duration-150 border space-y-2.5 shadow-sm active:scale-[0.99] cursor-pointer"
            style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
            onClick={onEdit}
        >
            {/* Row 1: Code, Badges, Status */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border border-cyan-200 bg-cyan-50 text-lys-teal-strong">
                        {row.code}
                    </span>
                    <TypeBadge type={row.channel} />
                    {row.entityType === 'COMPANY' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-800 bg-slate-100 border border-slate-200">
                            🏢 Cty Mẹ {row.childrenCount > 0 && `(${row.childrenCount} chi nhánh)`}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                            🍽️ Nhà hàng
                        </span>
                    )}
                </div>
                <StatusDot status={row.status} />
            </div>

            {/* Row 2: Customer Name & Brand */}
            <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2" title={row.name}>
                    {row.name}
                </h4>
                {row.shortName && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Tên viết tắt: {row.shortName}
                    </p>
                )}
                {row.brandGroup && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mt-1 text-slate-700 bg-slate-50 border border-slate-200">
                        ✨ Chuỗi: {row.brandGroup}
                    </span>
                )}
            </div>

            {/* Row 3: Meta details (Parent, MST, Sales Rep, Credit) */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 text-slate-600">
                {row.parentCode && (
                    <div className="col-span-2 flex items-center gap-1 text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200/60">
                        <span className="text-slate-400">Công ty Cha:</span>
                        <strong className="font-mono text-cyan-800 font-semibold">{row.parentCode}</strong>
                        <span className="truncate text-slate-600">— {row.parentName}</span>
                    </div>
                )}
                <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mã Số Thuế</span>
                    <div className="flex items-center gap-1 font-mono font-medium text-slate-700 mt-0.5">
                        {taxToDisplay ? (
                            <>
                                <span className={isVatInherited ? "text-amber-700 font-bold" : ""}>
                                    {taxToDisplay} {isVatInherited && '(Cha)'}
                                </span>
                                {onSyncTax && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onSyncTax()
                                        }}
                                        className="p-1 hover:bg-teal-50 text-teal-600 rounded transition-colors"
                                        title="Tra cứu Cục Thuế"
                                    >
                                        <Search size={11} />
                                    </button>
                                )}
                            </>
                        ) : '—'}
                    </div>
                </div>

                <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sales Phụ Trách</span>
                    <span className="font-medium text-slate-700 truncate block mt-0.5">
                        {row.salesRepName || '—'}
                    </span>
                </div>

                <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tín Dụng & Hạn Mức</span>
                    <span className="font-mono font-medium text-slate-700 mt-0.5 block">
                        {row.creditLimit > 0 ? formatVND(row.creditLimit) : '0 ₫'} <span className="text-[10px] text-slate-400 font-sans">({row.paymentTerm})</span>
                    </span>
                </div>

                <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Đơn Hàng</span>
                    <span className="font-mono font-bold text-emerald-700 mt-0.5 block">
                        {row.orderCount} <span className="text-[10px] text-slate-400 font-sans">đơn</span>
                    </span>
                </div>
            </div>

            {/* Row 4: Mobile Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onDelete}
                    className="flex-1 min-h-[38px] flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 border border-slate-200 hover:bg-rose-50 transition-colors"
                >
                    <Trash2 size={13} /> Xóa
                </button>
                <button
                    type="button"
                    onClick={onEdit}
                    className="flex-[2] min-h-[38px] flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-50 text-lys-teal-strong border border-cyan-300 hover:bg-cyan-100 transition-colors"
                >
                    <Edit2 size={13} /> Chỉnh sửa hồ sơ
                </button>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════
// CUSTOMER DRAWER (Create + Edit)
// ════════════════════════════════════════════════════════

function CustomerDrawer({ open, editingId, salesReps, legalEntities, onClose, onSaved, currentUser }: {
    open: boolean; editingId: string | null
    salesReps: { id: string; name: string }[]
    legalEntities: LegalEntityRow[]
    onClose: () => void; onSaved: () => void
    currentUser?: any
}) {
    const isSalesAdmin = currentUser?.roles?.includes('Sales Admin') || currentUser?.roles?.includes('SALES_ADMIN') || currentUser?.roles?.includes('ADMIN') || currentUser?.roles?.includes('CEO') || currentUser?.roles?.includes('Sales Manager') || currentUser?.roles?.includes('SALES_MGR') || currentUser?.roles?.includes('Kế Toán') || currentUser?.roles?.includes('KE_TOAN')
    const isSalesRep = currentUser?.roles?.includes('Sales Rep') || currentUser?.roles?.includes('SALES_REP')

    const [form, setForm] = useState<Partial<CustomerInput>>({
        paymentTerm: 'NET30', creditLimit: 0, status: isSalesRep ? 'PENDING_APPROVAL' : 'ACTIVE', channel: 'HORECA',
        entityType: 'RESTAURANT', allowDirectSO: false, brandGroup: null
    })
    const [officialCodeInput, setOfficialCodeInput] = useState('')
    const [approving, setApproving] = useState(false)
    const [approvalError, setApprovalError] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [exportingExcel, setExportingExcel] = useState(false)

    const [parentCandidates, setParentCandidates] = useState<{
        id: string
        name: string
        code: string
        entityType?: string
        taxId?: string | null
        vatCompanyName?: string | null
        vatAddress?: string | null
        vatEmail?: string | null
    }[]>([])

    const isEdit = !!editingId

    const [generatingCode, setGeneratingCode] = useState(false)

    const handleAutoGenerateCode = async (channelVal?: string, parentIdVal?: string | null) => {
        setGeneratingCode(true)
        try {
            const res = await getNextCustomerCode({
                channel: channelVal !== undefined ? channelVal : form.channel ?? 'HORECA',
                parentId: parentIdVal !== undefined ? (parentIdVal || undefined) : (form.parentId || undefined)
            })
            if (res.success && res.code) {
                setForm(f => ({ ...f, code: res.code }))
            }
        } catch {
        } finally {
            setGeneratingCode(false)
        }
    }

    const initialFormRef = useRef<Partial<CustomerInput> | null>(null)

    useEffect(() => {
        if (!open) return

        getParentCandidates(editingId || undefined)
            .then(setParentCandidates)
            .catch(() => {})

        if (editingId) {
            setLoading(true)
            getCustomerById(editingId).then(data => {
                if (data) {
                    const loadedForm: Partial<CustomerInput> = {
                        code: data.code,
                        name: data.name,
                        shortName: data.shortName,
                        taxId: data.taxId,
                        vatCompanyName: data.vatCompanyName,
                        vatAddress: data.vatAddress,
                        vatEmail: data.vatEmail,
                        channel: (data.channel as any) || 'HORECA',
                        paymentTerm: data.paymentTerm,
                        creditLimit: data.creditLimit,
                        salesRepId: data.salesRepId,
                        status: data.status as any,
                        parentId: data.parentId,
                        contactName: data.contactName,
                        email: data.email,
                        phone: data.phone,
                        address: data.address,
                        ward: data.ward,
                        district: data.district,
                        city: data.city,
                        entityType: data.entityType as any,
                        allowDirectSO: data.allowDirectSO,
                        brandGroup: data.brandGroup,
                        purchasingName: data.purchasingName,
                        purchasingPhone: data.purchasingPhone,
                        receiverName: data.receiverName,
                        receiverPhone: data.receiverPhone,
                        deliveryNotes: data.deliveryNotes,
                        orderChannel: data.orderChannel as any,
                        basePriceType: (data as any).basePriceType || 'BY_CHANNEL',
                        defaultDiscountPct: Number((data as any).defaultDiscountPct || 0),
                    }
                    setForm(loadedForm)
                    initialFormRef.current = loadedForm
                    setOfficialCodeInput('')
                    setApprovalError('')
                }
            }).finally(() => setLoading(false))
        } else {
            const newForm: Partial<CustomerInput> = { paymentTerm: 'NET30', creditLimit: 0, status: isSalesRep ? 'PENDING_APPROVAL' : 'ACTIVE', channel: 'HORECA', parentId: null, entityType: 'RESTAURANT', allowDirectSO: false, brandGroup: null, orderChannel: 'ZALO', vatCompanyName: null, vatAddress: null, vatEmail: null, taxId: null, basePriceType: 'BY_CHANNEL', defaultDiscountPct: 0 }
            setForm(newForm)
            initialFormRef.current = null
            setOfficialCodeInput('')
            setApprovalError('')
            if (!isSalesRep) {
                handleAutoGenerateCode('HORECA', null)
            }
        }
        setErrors({})
        setDuplicateWarnings([])
    }, [open, editingId, isSalesRep])

    const [duplicateWarnings, setDuplicateWarnings] = useState<{ type: 'TAX_ID' | 'PHONE' | 'NAME'; message: string; customer: { id: string; code: string; name: string } }[]>([])
    const [taxLookupLoading, setTaxLookupLoading] = useState(false)

    const handleLookupTax = async () => {
        const parentCandidate = parentCandidates.find(p => p.id === form.parentId)
        const taxToQuery = form.taxId || parentCandidate?.taxId
        if (!taxToQuery || !taxToQuery.trim()) {
            toast.error('Vui lòng nhập Mã số thuế hoặc chọn Công ty Cha có Mã số thuế trước khi tra cứu')
            return
        }
        setTaxLookupLoading(true)
        try {
            const res = await lookupTaxInfo(taxToQuery)
            if (!res.success || !res.data) {
                toast.error(res.error || 'Không tìm thấy thông tin đăng ký thuế cho MST này')
                return
            }
            if (!form.taxId && parentCandidate?.taxId) {
                set('taxId', parentCandidate.taxId)
            }
            set('vatCompanyName', res.data.vatCompanyName)
            set('vatAddress', res.data.vatAddress)
            toast.success(`✅ Lấy thành công: ${res.data.vatCompanyName}`)
        } catch (err: any) {
            toast.error('Lỗi tra cứu Cục Thuế: ' + err.message)
        } finally {
            setTaxLookupLoading(false)
        }
    }
    const [parentSearch, setParentSearch] = useState('')
    const [parentDropdownOpen, setParentDropdownOpen] = useState(false)
    const parentContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (parentContainerRef.current && !parentContainerRef.current.contains(e.target as Node)) {
                setParentDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (form.parentId && parentCandidates.length > 0) {
            const found = parentCandidates.find(c => c.id === form.parentId)
            if (found) {
                setParentSearch(`${found.code} — ${found.name}`)
            }
        } else if (!form.parentId) {
            setParentSearch('')
        }
    }, [form.parentId, parentCandidates])

    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            if (form.taxId || form.phone || (form.name && form.name.length >= 3)) {
                checkCustomerDuplicates({
                    taxId: form.taxId,
                    phone: form.phone,
                    name: form.name,
                    excludeId: editingId || undefined,
                    parentId: form.parentId || undefined,
                }).then(res => {
                    if (res.success && res.warnings) {
                        setDuplicateWarnings(res.warnings)
                    }
                }).catch(() => {})
            } else {
                setDuplicateWarnings([])
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [form.taxId, form.phone, form.name, form.parentId, open, editingId])

    const set = (k: keyof CustomerInput, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-base sm:text-sm outline-none transition-all placeholder:text-slate-400"
    const inputStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }

    const handlePrintCustomer = () => {
        if (!form) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return alert('Hãy cấp quyền mở popup trên trình duyệt của bạn')

        const customerTypeLabels: Record<string, string> = {
            HORECA: '🏨 HORECA (Nhà hàng / Khách sạn)',
            WHOLESALE_DISTRIBUTOR: '🏭 Phân Phối Sỉ / Đại lý',
            VIP_RETAIL: '👑 VIP Retail',
            INDIVIDUAL: '👤 Cá Nhân'
        }

        const statusLabels: Record<string, string> = {
            ACTIVE: 'Hoạt động',
            INACTIVE: 'Tạm dừng',
            CREDIT_HOLD: 'Giữ tín dụng',
            PENDING_APPROVAL: 'Chờ duyệt',
            REJECTED: 'Bị từ chối'
        }

        const mainAddress = form.address
            ? `${form.address}${form.ward ? ', Phường/Xã ' + form.ward : ''}${form.district ? ', Quận/Huyện ' + form.district : ''}${form.city ? ', Tỉnh/TP ' + form.city : ''}`
            : 'Chưa cấu hình địa chỉ chính'

        const htmlContent = `
            <html>
            <head>
                <title>Ho_so_khach_hang_${form.code || 'Moi'}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; margin: 40px; font-size: 13px; line-height: 1.6; }
                    .header { width: 100%; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
                    .title { font-size: 20px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 5px; }
                    .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 30px; font-style: italic; }
                    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    .info-table td { padding: 8px 12px; border: 1px solid #ddd; vertical-align: top; }
                    .info-label { font-weight: bold; width: 30%; background: #f9f9f9; }
                    .info-value { width: 70%; }
                    .signatures { width: 100%; margin-top: 60px; border-collapse: collapse; page-break-inside: avoid; }
                    .signatures td { text-align: center; width: 33%; vertical-align: top; border: none; padding: 10px; }
                    .sign-title { font-weight: bold; margin-bottom: 3px; text-transform: uppercase; }
                    @media print {
                        body { margin: 20px; }
                    }
                </style>
            </head>
            <body>
                <table style="width:100%; margin-bottom: 10px;">
                    <tr>
                        <td>
                            <strong style="font-size: 15px; text-transform: uppercase;">Ly's Cellar Wine Imports</strong><br/>
                            <span style="font-size: 11px; color: #555;">Hệ thống ERP Phân phối Rượu Vang</span>
                        </td>
                        <td style="text-align: right; font-size: 11px; color: #555;">
                            Mã số: BM-MDM-01-KH<br/>
                            Ngày in: ${new Date().toLocaleDateString('vi-VN')}
                        </td>
                    </tr>
                </table>
                <div class="header"></div>

                <div class="title">Phiếu Thông Tin Khách Hàng</div>
                <div class="subtitle">(Hồ sơ lưu trữ phê duyệt tạo mới & hạn mức tín dụng)</div>

                <table class="info-table">
                    <tr>
                        <td class="info-label">Mã Khách Hàng (Code):</td>
                        <td class="info-value"><strong>${form.code || ''}</strong></td>
                    </tr>
                    <tr>
                        <td class="info-label">Tên Khách Hàng:</td>
                        <td class="info-value"><strong>${form.name || ''}</strong></td>
                    </tr>
                    <tr>
                        <td class="info-label">Tên Viết Tắt:</td>
                        <td class="info-value">${form.shortName || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Mã Số Thuế:</td>
                        <td class="info-value">${form.taxId || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Kênh Bán Hàng (Channel):</td>
                        <td class="info-value">${form.channel || 'HORECA'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Kỳ Hạn Thanh Toán:</td>
                        <td class="info-value"><strong>${form.paymentTerm || 'NET30'}</strong></td>
                    </tr>
                    <tr>
                        <td class="info-label">Hạn Mức Nợ (Credit Limit):</td>
                        <td class="info-value"><strong>${(form.creditLimit || 0).toLocaleString('vi-VN')} ₫</strong></td>
                    </tr>
                    <tr>
                        <td class="info-label">Người Thu Mua (Purchasing):</td>
                        <td class="info-value">${form.purchasingName || '—'} ${form.purchasingPhone ? `(${form.purchasingPhone})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Người Nhận Hàng:</td>
                        <td class="info-value">${form.receiverName || '—'} ${form.receiverPhone ? `(${form.receiverPhone})` : ''}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Kênh Nhận Order:</td>
                        <td class="info-value">${form.orderChannel || 'ZALO'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Lưu Ý Giao Hàng:</td>
                        <td class="info-value">${form.deliveryNotes || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Người Liên Hệ Chính:</td>
                        <td class="info-value">${form.contactName || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Số Điện Thoại:</td>
                        <td class="info-value">${form.phone || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Email:</td>
                        <td class="info-value">${form.email || '—'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Địa Chỉ Giao Hàng:</td>
                        <td class="info-value">${mainAddress}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Trạng Thái Tài Khoản:</td>
                        <td class="info-value"><strong>${statusLabels[form.status || ''] || form.status || ''}</strong></td>
                    </tr>
                </table>

                <table class="signatures">
                    <tr>
                        <td>
                            <div class="sign-title">Nhân Viên Kinh Doanh</div>
                            <div style="font-size: 11px; color: #777; margin-bottom: 60px;">(Ký & ghi rõ họ tên)</div>
                        </td>
                        <td>
                            <div class="sign-title">Kế Toán Trưởng</div>
                            <div style="font-size: 11px; color: #777; margin-bottom: 60px;">(Ký & ghi rõ họ tên)</div>
                        </td>
                        <td>
                            <div class="sign-title">Giám Đốc Phê Duyệt</div>
                            <div style="font-size: 11px; color: #777; margin-bottom: 60px;">(Ký & ghi rõ họ tên)</div>
                        </td>
                    </tr>
                </table>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `
        printWindow.document.write(htmlContent)
        printWindow.document.close()
    }

    const handleExportExcelForm = async () => {
        if (!editingId) return
        setExportingExcel(true)
        try {
            const res = await exportCustomerOnboardingForm(editingId)
            if (res.success && res.data && res.filename) {
                const byteCharacters = atob(res.data)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = res.filename
                a.click()
                window.URL.revokeObjectURL(url)
                toast.success('Đã tải xuống biểu mẫu Excel thành công')
            } else {
                toast.error(res.error ?? 'Lỗi xuất biểu mẫu Excel')
            }
        } catch (err: any) {
            toast.error(err.message ?? 'Đã xảy ra lỗi')
        } finally {
            setExportingExcel(false)
        }
    }

    const handleApprove = async () => {
        if (!editingId) return
        setApprovalError('')
        setApproving(true)
        try {
            const res = await approveCustomer(editingId, officialCodeInput)
            if (res.success) {
                toast.success('Đã phê duyệt khách hàng thành công!')
                onSaved()
            } else {
                setApprovalError(res.error ?? 'Lỗi phê duyệt')
                toast.error(res.error ?? 'Lỗi phê duyệt')
            }
        } catch (err: any) {
            setApprovalError(err.message)
            toast.error(err.message)
        } finally {
            setApproving(false)
        }
    }

    const handleReject = async () => {
        if (!editingId) return
        setApprovalError('')
        setApproving(true)
        try {
            const res = await rejectCustomer(editingId)
            if (res.success) {
                toast.success('Đã từ chối yêu cầu duyệt khách hàng.')
                onSaved()
            } else {
                setApprovalError(res.error ?? 'Lỗi từ chối duyệt')
                toast.error(res.error ?? 'Lỗi từ chối duyệt')
            }
        } catch (err: any) {
            setApprovalError(err.message)
            toast.error(err.message)
        } finally {
            setApproving(false)
        }
    }

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!isEdit && !isSalesRep && !form.code) e.code = 'Bắt buộc'
        if (isEdit && !form.code) e.code = 'Bắt buộc'
        if (!form.name) e.name = 'Bắt buộc'
        setErrors(e)
        if (Object.keys(e).length) return
        setSaving(true)
        try {
            if (isEdit) {
                const res = await updateCustomer(editingId!, form as CustomerInput)
                if (res.success) {
                    toast.success('Đã cập nhật khách hàng')
                    onSaved()
                } else {
                    toast.error(res.error ?? 'Lỗi cập nhật khách hàng')
                    setErrors({ _global: res.error ?? 'Lỗi cập nhật khách hàng' })
                }
            } else {
                const res = await createCustomer(form as CustomerInput)
                if (res.success) {
                    toast.success('Đã tạo khách hàng mới')
                    onSaved()
                } else {
                    toast.error(res.error ?? 'Lỗi tạo khách hàng')
                    setErrors({ _global: res.error ?? 'Lỗi tạo khách hàng' })
                }
            }
        } catch (err: any) {
            setErrors({ _global: err.message })
            toast.error(err.message ?? 'Đã xảy ra lỗi')
        } finally {
            setSaving(false)
        }
    }

    const handleClose = () => {
        let isDirty = false
        if (!isEdit) {
            isDirty = Boolean(form.name || form.taxId || form.phone || form.address)
        } else if (initialFormRef.current) {
            isDirty = Object.keys(form).some(k => {
                const key = k as keyof CustomerInput
                const curVal = form[key] ?? null
                const initVal = initialFormRef.current?.[key] ?? null
                return curVal !== initVal
            })
        }
        if (isDirty) {
            if (window.confirm('Bạn có thông tin chưa lưu. Bạn có chắc chắn muốn đóng?')) {
                onClose()
            }
        } else {
            onClose()
        }
    }

    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose()
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                handleSave()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, form, isEdit])

    return (
        <Drawer
            open={open}
            onClose={handleClose}
            size="md"
            className="bg-lys-bg"
            title={isEdit ? 'Chỉnh Sửa Khách Hàng' : 'Thêm Khách Hàng'}
            description={isEdit ? 'Điền thông tin đầy đủ về khách hàng' : 'Khách sạn, nhà hàng, phân phối, VIP retail'}
            footer={
                <>
                    {isEdit && (
                        <div className="flex items-center gap-2 mr-auto">
                            <Button variant="secondary" onClick={handlePrintCustomer}>
                                <Printer size={14} aria-hidden /> In Hồ Sơ
                            </Button>
                            <Button variant="secondary" onClick={handleExportExcelForm} loading={exportingExcel} disabled={exportingExcel}>
                                {!exportingExcel && <Download size={14} aria-hidden />} Xuất Excel
                            </Button>
                        </div>
                    )}
                    <Button variant="secondary" onClick={handleClose}>Hủy</Button>
                    <Button onClick={handleSave} loading={saving} disabled={saving || loading} title="Ctrl+Enter">
                        {!saving && <Save size={14} aria-hidden />}
                        {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo KH'}
                    </Button>
                </>
            }
        >
                <div className="space-y-4 sm:space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
                    ) : (
                        <>
                            {errors._global && (
                                <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                                    style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.4)', color: '#B91C1C' }}>
                                    <AlertCircle size={14} /> {errors._global}
                                </div>
                            )}

                            {isEdit && (form.status === 'PENDING_APPROVAL' || form.status === 'REJECTED') && isSalesAdmin && (
                                <div className="p-4 rounded-lg space-y-3" style={{ background: 'rgba(212,150,58,0.08)', border: '1px solid rgba(212,150,58,0.3)' }}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">⚖️</span>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-[#D4963A]">Yêu cầu tạo Khách Hàng</p>
                                            <p className="text-[11px]" style={{ color: '#475569' }}>Khách hàng này do Sale tạo với mã tạm thời là <strong className="font-mono">{form.code}</strong>. Vui lòng ấn định mã chính thức để duyệt.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                        <div className="flex-1">
                                            <input type="text" placeholder="Mã KH chính thức (Ví dụ: KH-00123)"
                                                value={officialCodeInput}
                                                onChange={e => setOfficialCodeInput(e.target.value.toUpperCase())}
                                                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                                                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                                onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={handleReject} disabled={approving} type="button"
                                                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all text-[#B91C1C] border border-[#B91C1C]/30 hover:bg-[#B91C1C]/10 disabled:opacity-50">
                                                Từ chối
                                            </button>
                                            <button onClick={handleApprove} disabled={approving} type="button"
                                                className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all bg-[#15803D] hover:bg-[#72BF9E] text-slate-900 disabled:opacity-60">
                                                {approving ? <Loader2 size={14} className="animate-spin" /> : null}
                                                Duyệt
                                            </button>
                                        </div>
                                    </div>
                                    {approvalError && <p className="text-xs font-semibold text-[#B91C1C] mt-1">{approvalError}</p>}
                                </div>
                            )}

                            {duplicateWarnings.length > 0 && (
                                <div className="p-3.5 rounded-lg space-y-2 transition-all" style={{ background: 'rgba(212,150,58,0.12)', border: '1px solid rgba(212,150,58,0.4)' }}>
                                    <p className="text-xs font-bold uppercase tracking-wider text-[#D4963A] flex items-center gap-1.5">
                                        <AlertCircle size={15} /> Cảnh báo trùng lặp thông tin Khách Hàng
                                    </p>
                                    <div className="space-y-1 text-xs" style={{ color: '#0F172A' }}>
                                        {duplicateWarnings.map((w, idx) => (
                                            <div key={idx} className="flex items-start gap-1.5">
                                                <span className="text-[#D4963A] font-bold">•</span>
                                                <span>{w.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>── Thông Tin Cơ Bản</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Mã KH {(!isSalesRep || isEdit) && <span style={{ color: '#B91C1C' }}>*</span>}</label>
                                    <div className="flex gap-2">
                                        <input className={inputCls} style={inputStyle} 
                                            value={isEdit ? (form.code ?? '') : (isSalesRep ? 'MÃ TỰ SINH' : (form.code ?? ''))} 
                                            placeholder={isSalesRep ? 'Sẽ được sinh tự động' : 'VD: HR10023'}
                                            onChange={e => set('code', e.target.value.toUpperCase())} 
                                            disabled={isEdit || isSalesRep}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                        {!isEdit && !isSalesRep && (
                                            <button
                                                type="button"
                                                onClick={() => handleAutoGenerateCode()}
                                                disabled={generatingCode}
                                                title="Tạo mã tự động theo chuẩn Master Data"
                                                className="px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all hover:bg-[#E2E8F0] text-lys-teal-strong border border-slate-200 whitespace-nowrap shrink-0 min-h-[42px] sm:min-h-0"
                                                style={{ background: '#FFFFFF' }}
                                            >
                                                {generatingCode ? <Loader2 size={13} className="animate-spin" /> : '🎲 Sinh mã'}
                                            </button>
                                        )}
                                    </div>
                                    {errors.code && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.code}</p>}
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Kênh bán hàng *</label>
                                    <select className={inputCls} style={inputStyle} value={form.channel ?? 'HORECA'}
                                        onChange={e => {
                                            const val = e.target.value as any
                                            setForm(f => ({
                                                ...f,
                                                channel: val,
                                                ...(val !== 'HORECA' ? { parentId: null } : {})
                                            }))
                                            if (!isEdit && !isSalesRep) {
                                                handleAutoGenerateCode(val, val !== 'HORECA' ? null : form.parentId)
                                            }
                                        }}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                        <option value="HORECA">🏨 HORECA (Nhà hàng / Khách sạn)</option>
                                        <option value="CORPORATE">🏢 Corporate (Doanh nghiệp)</option>
                                        <option value="RETAIL">🛍️ Retail (Bán lẻ)</option>
                                    </select>
                                </div>
                            </div>

                            {form.channel === 'HORECA' && (
                                <div className="space-y-4">
                                    <div className="relative" ref={parentContainerRef}>
                                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Mã cha (Tính công nợ)</label>
                                        <div className="relative flex items-center">
                                            <Search size={14} className="absolute left-3 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                className={`${inputCls} pl-9 pr-8`}
                                                style={inputStyle}
                                                placeholder="Gõ tên hoặc mã cha để tìm..."
                                                value={parentSearch}
                                                onFocus={() => setParentDropdownOpen(true)}
                                                onChange={e => {
                                                    setParentSearch(e.target.value)
                                                    setParentDropdownOpen(true)
                                                    if (!e.target.value) {
                                                        set('parentId', null)
                                                        if (!isEdit && !isSalesRep) {
                                                            handleAutoGenerateCode(form.channel ?? undefined, null)
                                                        }
                                                    }
                                                }}
                                            />
                                            {form.parentId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        set('parentId', null)
                                                        setParentSearch('')
                                                        setParentDropdownOpen(false)
                                                        if (!isEdit && !isSalesRep) {
                                                            handleAutoGenerateCode(form.channel ?? undefined, null)
                                                        }
                                                    }}
                                                    className="absolute right-2.5 p-1 rounded-full text-slate-500 hover:text-slate-900 hover:bg-[#E2E8F0] transition-all"
                                                >
                                                    <X size={14} />
                                                </button>
                                            ) : (
                                                <ChevronDown size={14} className="absolute right-3 text-slate-500 pointer-events-none" />
                                            )}
                                        </div>

                                        {parentDropdownOpen && (
                                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-2xl border border-slate-200" style={{ background: '#F8FAFC' }}>
                                                <div className="overflow-y-auto max-h-[210px] divide-y divide-[#FFFFFF]">
                                                    <button
                                                        type="button"
                                                        className="w-full text-left px-3.5 py-2.5 text-xs text-slate-600 hover:bg-white transition-all"
                                                        onClick={() => {
                                                            set('parentId', null)
                                                            setParentSearch('')
                                                            setParentDropdownOpen(false)
                                                            if (!isEdit && !isSalesRep) {
                                                                handleAutoGenerateCode(form.channel ?? undefined, null)
                                                            }
                                                        }}
                                                    >
                                                        — Không chọn Mã cha —
                                                    </button>
                                                    {parentCandidates
                                                        .filter(c => {
                                                            if (!parentSearch.trim()) return true
                                                            const q = parentSearch.toLowerCase()
                                                            return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
                                                        })
                                                        .map(c => {
                                                            const isSelected = form.parentId === c.id
                                                            return (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    className={`w-full text-left px-3.5 py-2.5 text-xs transition-all flex items-center justify-between ${
                                                                        isSelected ? 'bg-white text-lys-teal-strong font-bold' : 'text-slate-900 hover:bg-white'
                                                                    }`}
                                                                    onClick={() => {
                                                                        set('parentId', c.id)
                                                                        setParentSearch(`${c.code} — ${c.name}`)
                                                                        setParentDropdownOpen(false)
                                                                        if (!isEdit && !isSalesRep) {
                                                                            handleAutoGenerateCode(form.channel ?? undefined, c.id)
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="flex items-center gap-2 truncate">
                                                                        <span className="font-mono text-lys-teal-strong bg-white px-1.5 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                                                                            {c.code}
                                                                        </span>
                                                                        <span className="truncate">{c.name}</span>
                                                                    </div>
                                                                    {c.entityType === 'COMPANY' && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0E7490]/10 text-lys-teal-strong border border-[#0E7490]/20 font-semibold shrink-0">
                                                                            🏢 Cty Cha
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                    {parentCandidates.filter(c => {
                                                        if (!parentSearch.trim()) return true
                                                        const q = parentSearch.toLowerCase()
                                                        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
                                                    }).length === 0 && (
                                                        <div className="px-3.5 py-3.5 text-center text-xs text-slate-500">
                                                            Không tìm thấy công ty phù hợp
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Loại thực thể</label>
                                            <select className={inputCls} style={inputStyle} value={form.entityType ?? 'RESTAURANT'}
                                                onChange={e => {
                                                    const val = e.target.value as 'COMPANY' | 'RESTAURANT'
                                                    setForm(f => ({
                                                        ...f,
                                                        entityType: val,
                                                        ...(val === 'COMPANY' ? { parentId: null } : { allowDirectSO: false })
                                                    }))
                                                }}
                                                onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                                <option value="RESTAURANT">🍽️ Nhà hàng / Chi nhánh con</option>
                                                <option value="COMPANY">🏢 Công ty cha tính công nợ</option>
                                            </select>
                                        </div>
                                        {form.entityType === 'COMPANY' ? (
                                            <div className="flex items-center pt-2 sm:pt-6">
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase tracking-wide" style={{ color: '#0F172A' }}>
                                                    <input type="checkbox" checked={form.allowDirectSO ?? false}
                                                        onChange={e => set('allowDirectSO', e.target.checked)}
                                                        className="rounded bg-white border-slate-200 text-lys-teal-strong focus:ring-0" />
                                                    Cho phép đặt SO trực tiếp
                                                </label>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tên Brand</label>
                                                <input className={inputCls} style={inputStyle} value={form.brandGroup ?? ''} placeholder="Ví dụ: Manwah, Gogi"
                                                    onChange={e => set('brandGroup', e.target.value || null)}
                                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tên Khách Hàng <span style={{ color: '#B91C1C' }}>*</span></label>
                                <input className={inputCls} style={inputStyle} value={form.name ?? ''} placeholder="Park Hyatt Saigon"
                                    onChange={e => set('name', e.target.value)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                {errors.name && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.name}</p>}
                                {duplicateWarnings.find(w => w.type === 'NAME') && (
                                    <p className="text-xs mt-1 font-medium flex items-center gap-1 text-[#D4963A]">
                                        <AlertCircle size={12} /> {duplicateWarnings.find(w => w.type === 'NAME')?.message}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tên viết tắt</label>
                                    <input className={inputCls} style={inputStyle} value={form.shortName ?? ''} placeholder="PH Saigon"
                                        onChange={e => set('shortName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Sales phụ trách</label>
                                    <select className={inputCls} style={inputStyle} value={form.salesRepId ?? ''}
                                        onChange={e => set('salesRepId', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                        <option value="">— Chọn Sales —</option>
                                        {salesReps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* VAT INVOICE SECTION */}
                            <div className="p-3.5 rounded-lg space-y-3.5" style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.25)' }}>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#B45309' }}>
                                        <FileText size={14} /> Thông Tin Xuất Hóa Đơn VAT
                                    </p>
                                    {form.parentId && (() => {
                                        const parent = parentCandidates.find(p => p.id === form.parentId)
                                        return (
                                            <span className="text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300">
                                                ℹ️ {parent?.taxId ? `Kế thừa MST (${parent.taxId}) từ Công Ty Cha` : 'Để trống sẽ tự động lấy theo Công Ty Cha'}
                                            </span>
                                        )
                                    })()}
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                        Tên Công Ty Xuất Hóa Đơn VAT
                                    </label>
                                    <input className={inputCls} style={inputStyle} value={form.vatCompanyName ?? ''} 
                                        placeholder={form.parentId ? (parentCandidates.find(p => p.id === form.parentId)?.vatCompanyName ? `Tên Cty Cha: ${parentCandidates.find(p => p.id === form.parentId)?.vatCompanyName}` : "Tự động lấy theo Tên Công ty Cha nếu để trống...") : "CÔNG TY TNHH ABC..."}
                                        onChange={e => set('vatCompanyName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5 gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide block" style={{ color: '#475569' }}>
                                                Mã Số Thuế VAT
                                            </label>
                                            <button
                                                type="button"
                                                disabled={taxLookupLoading}
                                                onClick={handleLookupTax}
                                                className="px-2.5 py-1 sm:py-0.5 rounded text-xs sm:text-[11px] font-extrabold bg-teal-50 text-lys-teal-strong hover:bg-teal-100 transition-all flex items-center gap-1 cursor-pointer border border-teal-300 active:scale-95 shrink-0 min-h-[30px] sm:min-h-0"
                                                title="Tự động tra cứu Tên công ty & Địa chỉ từ Tổng cục Thuế"
                                            >
                                                {taxLookupLoading ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
                                                <span>Tra Cứu Cục Thuế</span>
                                            </button>
                                        </div>
                                        <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} 
                                            placeholder={form.parentId ? (parentCandidates.find(p => p.id === form.parentId)?.taxId ? `Kế thừa MST Cha: ${parentCandidates.find(p => p.id === form.parentId)?.taxId}` : "Tự động dùng MST Công ty Cha") : "0302012345"}
                                            onChange={e => set('taxId', e.target.value || null)}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                        {(() => {
                                            const parent = parentCandidates.find(p => p.id === form.parentId)
                                            if (parent?.taxId && !form.taxId) {
                                                return (
                                                    <div className="mt-1 flex items-center justify-between text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                                        <span>🏢 MST Công ty Cha: <strong className="font-mono">{parent.taxId}</strong></span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                set('taxId', parent.taxId)
                                                                if (parent.vatCompanyName && !form.vatCompanyName) set('vatCompanyName', parent.vatCompanyName)
                                                                if (parent.vatAddress && !form.vatAddress) set('vatAddress', parent.vatAddress)
                                                                if (parent.vatEmail && !form.vatEmail) set('vatEmail', parent.vatEmail)
                                                            }}
                                                            className="text-[10px] font-bold text-lys-teal-strong hover:text-[#06748E] underline cursor-pointer ml-2"
                                                        >
                                                            Áp dụng
                                                        </button>
                                                    </div>
                                                )
                                            }
                                            if (parent?.taxId && form.taxId === parent.taxId) {
                                                return (
                                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-800 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                                                        <span>✅ Đang dùng chung MST với Công ty Cha (<strong className="font-mono">{parent.code}</strong> — {parent.name})</span>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })()}
                                        {duplicateWarnings.find(w => w.type === 'TAX_ID') && (
                                            <p className="text-xs mt-1 font-medium flex items-center gap-1 text-[#B91C1C]">
                                                <AlertCircle size={12} /> {duplicateWarnings.find(w => w.type === 'TAX_ID')?.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                            Email Nhận Hóa Đơn VAT
                                        </label>
                                        <input className={inputCls} style={inputStyle} value={form.vatEmail ?? ''} 
                                            placeholder={form.parentId ? "Tự động dùng Email Công ty Cha" : "ketoan@company.com"}
                                            onChange={e => set('vatEmail', e.target.value || null)}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                        Địa Chỉ Đăng Ký Thuế VAT
                                    </label>
                                    <input className={inputCls} style={inputStyle} value={form.vatAddress ?? ''} 
                                        placeholder={form.parentId ? (parentCandidates.find(p => p.id === form.parentId)?.vatAddress ? `Địa chỉ Cty Cha: ${parentCandidates.find(p => p.id === form.parentId)?.vatAddress}` : "Tự động dùng Địa chỉ Công ty Cha nếu để trống...") : "Số 123 Đường ABC, Phường X, Quận Y, TP..."}
                                        onChange={e => set('vatAddress', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Liên Hệ & Địa Chỉ</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Người liên hệ</label>
                                    <input className={inputCls} style={inputStyle} value={form.contactName ?? ''} placeholder="Nguyễn Văn A"
                                        onChange={e => set('contactName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Số điện thoại</label>
                                    <input className={inputCls} style={inputStyle} value={form.phone ?? ''} placeholder="0901234567"
                                        onChange={e => set('phone', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                    {duplicateWarnings.find(w => w.type === 'PHONE') && (
                                        <p className="text-xs mt-1 font-medium flex items-center gap-1 text-[#D4963A]">
                                            <AlertCircle size={12} /> {duplicateWarnings.find(w => w.type === 'PHONE')?.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Email</label>
                                <input type="email" className={inputCls} style={inputStyle} value={form.email ?? ''} placeholder="contact@hotel.com"
                                    onChange={e => set('email', e.target.value || null)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Địa chỉ</label>
                                <input className={inputCls} style={inputStyle} value={form.address ?? ''} placeholder="123 Đường Lê Lai, Quận 1"
                                    onChange={e => set('address', e.target.value || null)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Phường/Xã</label>
                                    <input className={inputCls} style={inputStyle} value={form.ward ?? ''} placeholder="Phường Bến Nghé"
                                        onChange={e => set('ward', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Quận/Huyện</label>
                                    <input className={inputCls} style={inputStyle} value={form.district ?? ''} placeholder="Quận 1"
                                        onChange={e => set('district', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Thành phố</label>
                                    <select className={inputCls} style={inputStyle} value={form.city ?? ''}
                                        onChange={e => set('city', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                        <option value="">— Chọn —</option>
                                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Thông Tin Thu Mua & Kênh Nhận Order</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tên người thu mua</label>
                                    <input className={inputCls} style={inputStyle} value={form.purchasingName ?? ''} placeholder="Ví dụ: Anh Nam Thu Mua"
                                        onChange={e => set('purchasingName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>SĐT thu mua</label>
                                    <input className={inputCls} style={inputStyle} value={form.purchasingPhone ?? ''} placeholder="0912345678"
                                        onChange={e => set('purchasingPhone', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Kênh nhận order</label>
                                    <select className={inputCls} style={inputStyle} value={form.orderChannel ?? 'ZALO'}
                                        onChange={e => set('orderChannel', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                        <option value="ZALO">💬 Zalo</option>
                                        <option value="EMAIL">📧 Email</option>
                                        <option value="WHATSAPP">📱 WhatsApp</option>
                                        <option value="PHONE">📞 Điện thoại</option>
                                        <option value="DIRECT">🏢 Trực tiếp</option>
                                        <option value="OTHER">❓ Khác</option>
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Thông Tin Giao Hàng & Lưu Ý</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Người nhận hàng</label>
                                    <input className={inputCls} style={inputStyle} value={form.receiverName ?? ''} placeholder="Ví dụ: Quản lý nhà hàng / Thủ kho"
                                        onChange={e => set('receiverName', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>SĐT người nhận</label>
                                    <input className={inputCls} style={inputStyle} value={form.receiverPhone ?? ''} placeholder="0987654321"
                                        onChange={e => set('receiverPhone', e.target.value || null)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Lưu ý về giao hàng</label>
                                <textarea className={`${inputCls} h-20 resize-none`} style={inputStyle} value={form.deliveryNotes ?? ''} placeholder="Ví dụ: Giao sau 14h, báo trước 30 phút, giao tầng hầm B2..."
                                    onChange={e => set('deliveryNotes', e.target.value || null)}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>

                            {/* CƠ CHẾ GIÁ & CHIẾT KHẤU MẶC ĐỊNH */}
                            <div className="p-3.5 rounded-lg space-y-3.5" style={{ background: 'rgba(8,145,178,0.06)', border: '1px solid rgba(8,145,178,0.25)' }}>
                                <div className="flex items-center justify-between flex-wrap gap-1">
                                    <p className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                        <Tag size={14} /> Cơ Chế Giá & Chiết Khấu Mặc Định (Toàn Kho)
                                    </p>
                                    {isEdit && (
                                        <Link href="/dashboard/price-list" className="text-[11px] text-lys-teal-strong hover:underline flex items-center gap-1 font-semibold">
                                            Trung tâm giá <ArrowUpRight size={12} />
                                        </Link>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                            Bảng giá gốc áp dụng
                                        </label>
                                        <select
                                            className={inputCls}
                                            style={inputStyle}
                                            value={form.basePriceType ?? 'BY_CHANNEL'}
                                            onChange={e => set('basePriceType', e.target.value)}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                            onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                                        >
                                            <option value="BY_CHANNEL">Theo kênh bán hàng ({form.channel || 'HORECA'})</option>
                                            <option value="WHOLESALE">Bảng giá Buôn (Wholesale)</option>
                                            <option value="RETAIL">Bảng giá Lẻ (Retail)</option>
                                            <option value="HORECA">Bảng giá HORECA</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>
                                            Chiết khấu mặc định toàn kho (%)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.5}
                                            className={inputCls}
                                            style={inputStyle}
                                            value={form.defaultDiscountPct ?? 0}
                                            placeholder="Ví dụ: 10 (nghĩa là -10%)"
                                            onChange={e => set('defaultDiscountPct', Number(e.target.value))}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                            onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                                        />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    💡 <em>Tự động áp dụng cho mọi sản phẩm trong kho & hàng mới về: [Bảng giá gốc] - [X% chiết khấu].</em>
                                </p>
                            </div>

                            <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Tín Dụng & Thanh Toán</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Điều khoản</label>
                                    <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET30'}
                                        onChange={e => set('paymentTerm', e.target.value)}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                        <option value="COD">COD</option>
                                        <option value="NET15">NET 15</option>
                                        <option value="NET30">NET 30</option>
                                        <option value="NET45">NET 45</option>
                                        <option value="NET60">NET 60</option>
                                        <option value="EOM_10">EOM 10</option>
                                        <option value="EOM_15">EOM 15</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Hạn mức (VND)</label>
                                    <input type="number" className={inputCls} style={inputStyle} value={form.creditLimit ?? 0}
                                        onChange={e => set('creditLimit', Number(e.target.value))} step={50000000}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Trạng thái</label>
                                    {isSalesRep || form.status === 'PENDING_APPROVAL' || form.status === 'REJECTED' ? (
                                        <div className="py-2.5 px-3 rounded-lg text-sm font-semibold text-slate-900 border border-slate-200 bg-white flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: { PENDING_APPROVAL: '#E0A96D', REJECTED: '#B91C1C', ACTIVE: '#15803D', INACTIVE: '#64748B', CREDIT_HOLD: '#D4963A' }[form.status ?? 'ACTIVE'] }} />
                                            {{ PENDING_APPROVAL: 'Chờ duyệt', REJECTED: 'Bị từ chối', ACTIVE: 'Hoạt động', INACTIVE: 'Tạm dừng', CREDIT_HOLD: 'Giữ tín dụng' }[form.status ?? 'ACTIVE']}
                                        </div>
                                    ) : (
                                        <select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'}
                                            onChange={e => set('status', e.target.value as any)}
                                            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')} onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                            <option value="ACTIVE">Hoạt động</option>
                                            <option value="CREDIT_HOLD">Giữ tín dụng</option>
                                            <option value="INACTIVE">Tạm dừng</option>
                                        </select>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
        </Drawer>
    )
}

// ════════════════════════════════════════════════════════
// MAIN CLIENT COMPONENT
// ════════════════════════════════════════════════════════

type CustomersPageResult = { rows: CustomerRow[]; total: number; stats: CustomerStats; channels: { channel: string; count: number }[]; salesReps: { id: string; name: string }[] }

interface CustomersClientProps {
    initialData?: CustomersPageResult
    currentUser?: any
}

export function CustomersClient({ initialData, currentUser }: CustomersClientProps) {
    const qc = useQueryClient()
    const isSalesAdmin = currentUser?.roles?.includes('Sales Admin') || currentUser?.roles?.includes('SALES_ADMIN') || currentUser?.roles?.includes('ADMIN') || currentUser?.roles?.includes('CEO') || currentUser?.roles?.includes('Sales Manager') || currentUser?.roles?.includes('SALES_MGR')
    const isSalesRep = currentUser?.roles?.includes('Sales Rep') || currentUser?.roles?.includes('SALES_REP')

    const [filters, setFilters] = useState<CustomerFilters>({ page: 1, pageSize: 25 })
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [showStats, setShowStats] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [channelFilter, setChannelFilter] = useState('')
    const [exporting, setExporting] = useState(false)
    const [legalEntities, setLegalEntities] = useState<LegalEntityRow[]>([])

    const queryClient = useQueryClient()

    const reload = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['customers'] })
    }, [queryClient])

    // TanStack Query — cache customers page data
    const { data: queryData, isLoading, isFetching } = useQuery({
        queryKey: ['customers', filters],
        queryFn: async () => {
            const [data, stats, channels, salesReps] = await Promise.all([
                getCustomers(filters),
                getCustomerStats(),
                getCustomerChannels(),
                getSalesRepList(),
            ])
            return { rows: data.rows, total: data.total, stats, channels, salesReps }
        },
        initialData: filters.page === 1 && !filters.search && !filters.type && !filters.status && !filters.channel
            ? initialData
            : undefined,
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    })
    const loading = isLoading || isFetching

    const rows = queryData?.rows ?? []
    const total = queryData?.total ?? 0
    const stats = queryData?.stats ?? { total: 0, active: 0, withCredit: 0, totalCreditLimit: 0, topTypes: [] }
    const channels = queryData?.channels ?? []
    const salesReps = queryData?.salesReps ?? []

    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        getLegalEntities().then(setLegalEntities).catch(() => { })
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    const applyFilter = useCallback((newFilters: Partial<CustomerFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }))
    }, [])

    const handleSearchChange = (value: string) => {
        setSearch(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!value) {
            applyFilter({ search: undefined })
        } else {
            debounceRef.current = setTimeout(() => {
                applyFilter({ search: value || undefined })
            }, 300)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa khách hàng "${name}"?\n\nKH sẽ bị đánh dấu Tạm dừng (soft delete). Nếu KH đang có đơn hàng chưa hoàn tất sẽ không xóa được.`)) return
        try {
            const result = await deleteCustomer(id)
            if (result.success) {
                toast.success(`Đã xóa "${name}"`)
                reload()
            } else {
                toast.error(result.error ?? 'Không thể xóa')
            }
        } catch {
            toast.error('Lỗi khi xóa khách hàng')
        }
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportCustomersData()
            if (data.length === 0) { toast.error('Chưa có KH để xuất'); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = String((row as any)[h] ?? '')
                        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                    }).join(',')
                ),
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `danh_sach_khach_hang_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`Đã xuất ${data.length} khách hàng`)
        } catch {
            toast.error('Lỗi xuất dữ liệu')
        } finally {
            setExporting(false)
        }
    }

    const handleSort = (sortBy: CustomerFilters['sortBy']) => {
        const newDir = filters.sortBy === sortBy && filters.sortDir === 'asc' ? 'desc' : 'asc'
        applyFilter({ sortBy, sortDir: newDir })
    }

    const handleSyncTax = (id: string) => {
        toast.promise(syncCustomerTaxInfoFromGDT(id), {
            loading: 'Đang tra cứu Cục Thuế...',
            success: (res) => {
                if (!res.success) throw new Error(res.error)
                queryClient.invalidateQueries({ queryKey: ['customers'] })
                return `✅ Đã đồng bộ: ${res.updatedInfo?.vatCompanyName}`
            },
            error: (err) => `Lỗi tra cứu: ${err.message}`
        })
    }

    const openEdit = (id: string) => { setEditingId(id); setDrawerOpen(true) }
    const sortFor = (key: CustomerFilters['sortBy']) => (filters.sortBy === key ? filters.sortDir ?? 'asc' : false)
    const refetching = loading && rows.length > 0
    const hasFilters = !!(search || typeFilter || statusFilter || channelFilter)
    const COL_COUNT = 11

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption">
                        <span>Tổng KH: <strong className="type-number text-sm ml-1 text-lys-teal-strong">{stats.total}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>Hoạt động: <strong className="type-number text-sm ml-1 text-tone-success-fg">{stats.active}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>Chờ duyệt: <strong className="type-number text-sm ml-1 text-tone-warning-fg">{stats.pendingApproval ?? 0}</strong></span>
                        <span className="hidden xl:inline text-lys-border-strong">|</span>
                        {isSalesRep ? (
                            <span className="hidden xl:inline">Từ chối: <strong className="type-number text-sm ml-1 text-tone-danger-fg">{stats.rejected ?? 0}</strong></span>
                        ) : (
                            <span className="hidden xl:inline">Tổng hạn mức: <strong className="type-number text-sm ml-1 text-lys-teal-strong">{formatVND(stats.totalCreditLimit)}</strong></span>
                        )}
                    </div>
                }
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setShowStats(!showStats)}
                            aria-pressed={showStats}
                            className={showStats ? 'border-lys-teal text-lys-teal-strong bg-lys-teal-soft hover:bg-lys-teal-soft' : undefined}
                        >
                            <BarChart3 size={14} aria-hidden /> Thống Kê
                        </Button>
                        <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={exporting}>
                            {!exporting && <Download size={14} aria-hidden />} {exporting ? 'Đang xuất...' : 'Export CSV'}
                        </Button>
                        <Button variant="secondary" onClick={() => setImportOpen(true)}>
                            <Upload size={14} aria-hidden /> Import Excel
                        </Button>
                        <Button onClick={() => { setEditingId(null); setDrawerOpen(true) }}>
                            <Plus size={16} aria-hidden /> Thêm Khách Hàng
                        </Button>
                    </>
                }
            />

            {showStats && (
                <StatGrid className="grid-cols-2 lg:grid-cols-4 animate-fade-in">
                    <StatCard icon={Users} tone="brand" label="Tổng KH" value={stats.total} />
                    <StatCard icon={Building2} tone="success" label="Hoạt động" value={stats.active} />
                    <StatCard icon={ShoppingBag} tone="warning" label="Chờ duyệt" value={stats.pendingApproval ?? 0} />
                    {isSalesRep ? (
                        <StatCard icon={X} tone="danger" label="Bị từ chối" value={stats.rejected ?? 0} />
                    ) : (
                        <StatCard icon={CreditCard} tone="brand" label="Tổng hạn mức" value={formatVND(stats.totalCreditLimit)} />
                    )}
                </StatGrid>
            )}

            <Toolbar
                left={
                    <SearchInput
                        placeholder="Tìm theo tên, mã, MST, email, SĐT..."
                        value={search}
                        onChange={e => handleSearchChange(e.target.value)}
                        className="sm:w-80"
                    />
                }
                right={
                    <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full md:w-auto">
                        <Select
                            aria-label="Loại khách hàng"
                            value={typeFilter}
                            onChange={e => { setTypeFilter(e.target.value); applyFilter({ type: e.target.value || undefined }) }}
                            className="md:w-36"
                        >
                            <option value="">Tất cả loại</option>
                            <option value="HORECA">HORECA</option>
                            <option value="WHOLESALE_DISTRIBUTOR">Phân Phối</option>
                            <option value="VIP_RETAIL">VIP Retail</option>
                            <option value="INDIVIDUAL">Cá Nhân</option>
                        </Select>
                        <Select
                            aria-label="Trạng thái"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); applyFilter({ status: e.target.value || undefined }) }}
                            className="md:w-36"
                        >
                            <option value="">Trạng thái</option>
                            <option value="ACTIVE">Hoạt động</option>
                            <option value="PENDING_APPROVAL">Chờ duyệt</option>
                            <option value="REJECTED">Bị từ chối</option>
                            <option value="CREDIT_HOLD">Giữ tín dụng</option>
                            <option value="INACTIVE">Tạm dừng</option>
                        </Select>
                        <Select
                            aria-label="Kênh"
                            value={channelFilter}
                            onChange={e => { setChannelFilter(e.target.value); applyFilter({ channel: e.target.value || undefined }) }}
                            className="md:w-48"
                        >
                            <option value="">Tất cả kênh</option>
                            {channels.map(c => (
                                <option key={c.channel} value={c.channel}>{CHANNEL_LABEL[c.channel] ?? c.channel} ({c.count})</option>
                            ))}
                        </Select>
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    if (debounceRef.current) clearTimeout(debounceRef.current)
                                    setSearch(''); setTypeFilter(''); setStatusFilter(''); setChannelFilter('')
                                    applyFilter({ search: undefined, type: undefined, status: undefined, channel: undefined })
                                }}
                            >
                                <X size={14} aria-hidden /> Xóa lọc
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Mobile cards (< md) */}
            <div className={cn('md:hidden flex flex-col gap-3', refetching && 'opacity-50 pointer-events-none')}>
                {loading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-lg border border-lys-border bg-lys-card space-y-3">
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                            <Skeleton className="h-5 w-3/4" />
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        </div>
                    ))
                ) : rows.length === 0 ? (
                    <div className="bg-lys-card border border-lys-border rounded-lg">
                        <EmptyState icon={Users} title="Chưa có khách hàng nào" />
                    </div>
                ) : (
                    rows.map(row => (
                        <CustomerMobileCard
                            key={row.id}
                            row={row}
                            onEdit={() => openEdit(row.id)}
                            onDelete={() => handleDelete(row.id, row.name)}
                            onSyncTax={() => handleSyncTax(row.id)}
                        />
                    ))
                )}
            </div>

            {/* Desktop table (md+) */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th className="w-[90px]">Loại</Th>
                            <Th className="w-[90px]">Mã KH</Th>
                            <Th className="w-[260px]" sort={sortFor('name')} onSort={() => handleSort('name')}>Khách Hàng</Th>
                            <Th className="w-[80px]">Mã cha</Th>
                            <Th className="w-[110px]">MST</Th>
                            <Th className="w-[110px]">Sales Rep</Th>
                            <Th className="w-[80px]">Thanh Toán</Th>
                            <Th className="w-[110px]" align="right" sort={sortFor('creditLimit')} onSort={() => handleSort('creditLimit')}>Hạn Mức</Th>
                            <Th className="w-[80px]" align="center" sort={sortFor('orderCount')} onSort={() => handleSort('orderCount')}>Đơn Hàng</Th>
                            <Th className="w-[110px]">Trạng Thái</Th>
                            <Th className="w-[70px]"><span className="sr-only">Thao tác</span></Th>
                        </tr>
                    </THead>
                    <TBody className={cn('transition-opacity duration-200', refetching && 'opacity-50 pointer-events-none')}>
                        {loading && rows.length === 0 ? (
                            <TableMessageRow colSpan={COL_COUNT}><TableSkeleton rows={6} cols={COL_COUNT} /></TableMessageRow>
                        ) : rows.length === 0 ? (
                            <TableMessageRow colSpan={COL_COUNT}><EmptyState icon={Users} title="Chưa có khách hàng nào" /></TableMessageRow>
                        ) : rows.map(row => (
                            <Tr key={row.id} className="group">
                                <Td className="whitespace-nowrap"><TypeBadge type={row.channel} /></Td>
                                <Td className="whitespace-nowrap type-number font-semibold">{row.code}</Td>
                                <Td>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(row.id)}
                                            className="font-semibold truncate max-w-[220px] text-left text-lys-primary hover:text-lys-teal-strong hover:underline cursor-pointer"
                                            title={row.name}
                                        >
                                            {row.name}
                                        </button>
                                        {row.entityType === 'COMPANY' ? (
                                            <Badge>
                                                Công ty{row.allowDirectSO && ' (Bán trực tiếp)'}{row.childrenCount > 0 && ` • ${row.childrenCount} chi nhánh`}
                                            </Badge>
                                        ) : (
                                            <Badge tone="success">Nhà hàng</Badge>
                                        )}
                                        {row.brandGroup && <Badge tone="info">{row.brandGroup}</Badge>}
                                    </div>
                                </Td>
                                <Td className="whitespace-nowrap type-number text-[12px] text-lys-secondary">{row.parentCode ?? <span className="text-lys-dim">—</span>}</Td>
                                <Td className="whitespace-nowrap type-number text-[12px] text-lys-muted">
                                    <div className="flex items-center gap-1">
                                        {row.taxId ? (
                                            <span>{row.taxId}</span>
                                        ) : row.resolvedVatInfo?.taxId ? (
                                            <Badge tone="warning" title={`Kế thừa MST từ công ty cha ${row.parentName || ''}`}>
                                                {row.resolvedVatInfo.taxId} (Cha)
                                            </Badge>
                                        ) : '—'}
                                        {(row.taxId || row.resolvedVatInfo?.taxId) && (
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => handleSyncTax(row.id)}
                                                title="Tự động tra cứu & đồng bộ Tên công ty / Địa chỉ từ Cục Thuế"
                                                aria-label="Tra cứu Cục Thuế"
                                            >
                                                <Search size={12} />
                                            </Button>
                                        )}
                                    </div>
                                </Td>
                                <Td className={cn('whitespace-nowrap', row.salesRepName ? 'text-lys-secondary' : 'text-lys-dim')}>{row.salesRepName ?? '—'}</Td>
                                <Td className="whitespace-nowrap type-number text-[12px] font-semibold text-lys-secondary">{row.paymentTerm}</Td>
                                <Td align="right" className={cn('whitespace-nowrap', row.creditLimit > 0 ? 'text-lys-primary' : 'text-lys-dim')}>
                                    {row.creditLimit > 0 ? formatVND(row.creditLimit) : '—'}
                                </Td>
                                <Td align="center" className={cn('whitespace-nowrap type-number font-semibold', row.orderCount > 0 ? 'text-tone-success-fg' : 'text-lys-dim')}>
                                    {row.orderCount}
                                </Td>
                                <Td className="whitespace-nowrap"><StatusDot status={row.status} /></Td>
                                <Td>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity whitespace-nowrap">
                                        <Button variant="ghost" size="icon-sm" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={() => openEdit(row.id)}>
                                            <Edit2 size={14} />
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" title="Xóa" aria-label="Xóa" className="hover:text-tone-danger-fg hover:bg-tone-danger-bg" onClick={() => handleDelete(row.id, row.name)}>
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            <Pagination
                page={filters.page ?? 1}
                pageSize={filters.pageSize ?? 25}
                total={total}
                onPageChange={p => applyFilter({ page: p })}
                itemLabel="khách hàng"
            />

            <CustomerDrawer
                open={drawerOpen} editingId={editingId}
                salesReps={salesReps}
                legalEntities={legalEntities}
                onClose={() => setDrawerOpen(false)}
                onSaved={() => { setDrawerOpen(false); reload() }}
                currentUser={currentUser}
            />

            <ExcelImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title="Import Khách Hàng"
                templateFileName="template_khach_hang.xlsx"
                templateColumns={[
                    { header: 'Mã KH', sample: 'CUS-PARKHYATT', required: true },
                    { header: 'Tên KH', sample: 'Park Hyatt Saigon', required: true },
                    { header: 'Tên Viết Tắt', sample: 'PH Saigon' },
                    { header: 'Loại KH', sample: 'HORECA', required: true },
                    { header: 'Kênh', sample: 'HORECA' },
                    { header: 'MST', sample: '0302012345' },
                    { header: 'Thanh Toán', sample: 'NET30' },
                    { header: 'Hạn Mức', sample: '500000000' },
                    { header: 'Người Liên Hệ', sample: 'Nguyễn Văn A' },
                    { header: 'Email', sample: 'contact@parkhyatt.com' },
                    { header: 'SĐT', sample: '0281234567' },
                    { header: 'Địa Chỉ', sample: '2 Công Trường Lam Sơn, Q.1' },
                    { header: 'Thành Phố', sample: 'Hồ Chí Minh' },
                ]}
                onImport={bulkImportCustomers}
                onComplete={() => reload()}
            />
        </div>
    )
}
