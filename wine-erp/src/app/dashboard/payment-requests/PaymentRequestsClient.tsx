'use client'

import { useState, useTransition } from 'react'
import {
    CreditCard, Plus, Search, Filter, Calendar, FileText, CheckCircle2,
    Clock, AlertTriangle, XCircle, ArrowUpRight, DollarSign, Settings2,
    PieChart, Building2, Tag, ChevronRight, Edit3, Trash2, Eye, RefreshCw,
    FolderKanban, AlertCircle, X, Printer
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND, formatDate } from '@/lib/utils'
import {
    PaymentRequestRow, ExpenseCategoryRow, ExpenseBudgetRow,
    getPaymentRequests, getPaymentRequestDetail, deletePaymentRequest,
    saveExpenseCategory, deleteExpenseCategory, saveExpenseBudget,
    getExpenseBudgets, getExpenseCategories
} from './actions'
import { PaymentRequestDetailModal } from './PaymentRequestDetailModal'
import { CreatePaymentRequestDrawer } from './CreatePaymentRequestDrawer'
import { PrintablePaymentRequest } from './PrintablePaymentRequest'

interface PaymentRequestsClientProps {
    initialRequests: PaymentRequestRow[]
    initialTotal: number
    stats: {
        totalCount: number
        pendingCount: number
        approvedCount: number
        paidCount: number
        totalPendingVND: number
        totalPaidVND: number
    }
    categories: ExpenseCategoryRow[]
    budgets: ExpenseBudgetRow[]
    legalEntities: { id: string; name: string; code: string }[]
    suppliers: { id: string; name: string; code: string }[]
    departments: { id: string; name: string }[]
    currentUser: any
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
    VENDOR_PAYMENT: 'Tiền hàng NCC',
    IMPORT_TAX_LOGISTICS: 'Thuế NK & Logistics',
    OPERATIONS_OFFICE: 'Vận hành & Kho bãi',
    TASTING_MARKETING: 'Tasting & Marketing',
    EMPLOYEE_ADVANCE: 'Tạm ứng / Hoàn ứng',
    OTHER: 'Chi phí khác',
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    DRAFT: { label: 'Bản Nháp', bg: '#F1F5F9', color: '#475569' },
    SUBMITTED: { label: 'Chờ TP Duyệt (C1)', bg: '#EFF6FF', color: '#1D4ED8' },
    REVIEWING_L1: { label: 'Chờ Kế Toán (C2)', bg: '#FEF3C7', color: '#B45309' },
    REVIEWING_L2: { label: 'Chờ CEO (C3)', bg: '#FDF4FF', color: '#9333EA' },
    APPROVED: { label: 'Đã Duyệt (Chờ Chi)', bg: '#ECFDF5', color: '#047857' },
    PAID: { label: 'Đã Giải Ngân', bg: '#F0FDF4', color: '#15803D' },
    REJECTED: { label: 'Bị Từ Chối', bg: '#FEF2F2', color: '#B91C1C' },
    CANCELLED: { label: 'Đã Hủy', bg: '#F8FAFC', color: '#64748B' },
}

const GROUP_LABELS: Record<string, string> = {
    COST_OF_SALES: 'Tiền Hàng & Nhập Khẩu',
    OPERATING: 'Vận Hành & Kho Bãi',
    MARKETING: 'Tiếp Thị & Bán Hàng',
    ADMINISTRATIVE: 'Hành Chính & Nhân Sự',
    CAPEX: 'Đầu Tư Tài Sản (CAPEX)',
}

export function PaymentRequestsClient({
    initialRequests,
    initialTotal,
    stats,
    categories: initialCategories,
    budgets: initialBudgets,
    legalEntities,
    suppliers,
    departments,
    currentUser,
}: PaymentRequestsClientProps) {
    const [activeTab, setActiveTab] = useState<'REQUESTS' | 'CATEGORIES' | 'BUDGETS'>('REQUESTS')
    const [isPending, startTransition] = useTransition()

    // ── Requests state ──
    const [requests, setRequests] = useState<PaymentRequestRow[]>(initialRequests)
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [categoryFilter, setCategoryFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [selectedDetail, setSelectedDetail] = useState<any>(null)
    const [showCreateDrawer, setShowCreateDrawer] = useState(false)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [showBlankPrint, setShowBlankPrint] = useState(false)
    const [printDetail, setPrintDetail] = useState<any>(null)

    // ── Categories state ──
    const [categories, setCategories] = useState<ExpenseCategoryRow[]>(initialCategories)
    const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL')
    const [categoryModalData, setCategoryModalData] = useState<{
        open: boolean
        isEdit: boolean
        id?: string
        code: string
        name: string
        group: string
        defaultAccount: string
        description: string
    }>({
        open: false,
        isEdit: false,
        code: '',
        name: '',
        group: 'OPERATING',
        defaultAccount: '642',
        description: '',
    })

    // ── Budgets state ──
    const [budgets, setBudgets] = useState<ExpenseBudgetRow[]>(initialBudgets)
    const [budgetModalData, setBudgetModalData] = useState<{
        open: boolean
        categoryId: string
        categoryName: string
        year: number
        allocatedAmount: number
        warningThresholdPct: number
        notes: string
    }>({
        open: false,
        categoryId: '',
        categoryName: '',
        year: new Date().getFullYear(),
        allocatedAmount: 0,
        warningThresholdPct: 85,
        notes: '',
    })

    // Refresh data
    async function refreshRequests() {
        startTransition(async () => {
            const res = await getPaymentRequests({
                status: statusFilter,
                category: categoryFilter,
                search: search.trim() || undefined,
            })
            setRequests(res.rows)
        })
    }

    async function handleFilterChange(newStatus?: string, newCat?: string) {
        const s = newStatus !== undefined ? newStatus : statusFilter
        const c = newCat !== undefined ? newCat : categoryFilter
        if (newStatus !== undefined) setStatusFilter(s)
        if (newCat !== undefined) setCategoryFilter(c)

        startTransition(async () => {
            const res = await getPaymentRequests({
                status: s,
                category: c,
                search: search.trim() || undefined,
            })
            setRequests(res.rows)
        })
    }

    async function openDetail(id: string) {
        setLoadingDetail(true)
        try {
            const detail = await getPaymentRequestDetail(id)
            if (detail) {
                setSelectedDetail(detail)
            } else {
                toast.error('Không tìm thấy thông tin phiếu')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi tải chi tiết')
        } finally {
            setLoadingDetail(false)
        }
    }

    async function handleDeleteRequest(id: string, requestNo: string) {
        if (!confirm(`Bạn có chắc chắn muốn xóa phiếu ${requestNo}?`)) return
        try {
            const res = await deletePaymentRequest(id)
            if (res.success) {
                toast.success('Đã xóa phiếu thành công')
                refreshRequests()
            } else {
                toast.error(res.error || 'Lỗi khi xóa phiếu')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối')
        }
    }

    // Category actions
    async function handleSaveCategory(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await saveExpenseCategory({
                id: categoryModalData.id,
                code: categoryModalData.code,
                name: categoryModalData.name,
                group: categoryModalData.group,
                defaultAccount: categoryModalData.defaultAccount,
                description: categoryModalData.description,
            })

            if (res.success) {
                toast.success('Lưu hạng mục chi phí thành công!')
                setCategoryModalData(prev => ({ ...prev, open: false }))
                const updated = await getExpenseCategories(true)
                setCategories(updated)
            } else {
                toast.error(res.error || 'Lỗi khi lưu hạng mục')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi xử lý')
        }
    }

    async function handleDeleteCategory(id: string, name: string) {
        if (!confirm(`Bạn có chắc muốn xóa hoặc ẩn hạng mục "${name}"?`)) return
        try {
            const res = await deleteExpenseCategory(id)
            if (res.success) {
                toast.success('Đã cập nhật trạng thái hạng mục')
                const updated = await getExpenseCategories(true)
                setCategories(updated)
            } else {
                toast.error(res.error || 'Lỗi xóa')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi')
        }
    }

    // Budget actions
    async function handleSaveBudget(e: React.FormEvent) {
        e.preventDefault()
        try {
            const res = await saveExpenseBudget({
                categoryId: budgetModalData.categoryId,
                year: budgetModalData.year,
                periodType: 'YEARLY',
                allocatedAmount: Number(budgetModalData.allocatedAmount),
                warningThresholdPct: Number(budgetModalData.warningThresholdPct),
                notes: budgetModalData.notes,
            })

            if (res.success) {
                toast.success('Đã lưu hạn mức ngân sách!')
                setBudgetModalData(prev => ({ ...prev, open: false }))
                const updated = await getExpenseBudgets({ year: budgetModalData.year })
                setBudgets(updated)
            } else {
                toast.error(res.error || 'Lỗi khi lưu ngân sách')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi')
        }
    }

    return (
        <div className="space-y-6">
            {/* ═══ Page Header ═══ */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <CreditCard className="h-7 w-7 text-[#8B1A2E]" />
                        Đề Nghị Thanh Toán & Quản Lý Ngân Sách
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Hệ thống phê duyệt đa cấp theo hạn mức, lưu trữ chứng từ scan Cloudflare R2 và kiểm soát ngân sách chi phí
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => setShowBlankPrint(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition"
                        title="In mẫu phôi tờ trình / đề nghị thanh toán trắng để ký tay"
                    >
                        <Printer className="h-4 w-4 text-burgundy" /> In Phôi Mẫu Trắng
                    </button>
                    <button
                        onClick={() => setShowCreateDrawer(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#8B1A2E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#721526] transition"
                    >
                        <Plus className="h-4 w-4" /> Lập Đề Nghị Mới
                    </button>
                </div>
            </div>

            {/* ═══ Main Tab Navigation ═══ */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-6">
                    <button
                        onClick={() => setActiveTab('REQUESTS')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'REQUESTS'
                                ? 'border-[#8B1A2E] text-[#8B1A2E]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <CreditCard className="h-4 w-4" />
                        Phiếu Đề Nghị Thanh Toán
                        <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {stats.totalCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('CATEGORIES')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'CATEGORIES'
                                ? 'border-[#8B1A2E] text-[#8B1A2E]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <FolderKanban className="h-4 w-4" />
                        Cấu Hình Hạng Mục Chi Phí
                        <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {categories.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('BUDGETS')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'BUDGETS'
                                ? 'border-[#8B1A2E] text-[#8B1A2E]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <PieChart className="h-4 w-4" />
                        Quản Lý & Theo Dõi Ngân Sách
                    </button>
                </nav>
            </div>

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 1: PHIẾU ĐỀ NGHỊ THANH TOÁN                        */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'REQUESTS' && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">Tổng Đề Nghị Năm Nay</span>
                                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                                    <FileText className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalCount}</div>
                            <p className="mt-1 text-xs text-slate-400">Tất cả các khoản chi đã khởi tạo</p>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-amber-800">Đang Chờ Duyệt</span>
                                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-amber-900">{formatVND(stats.totalPendingVND)}</div>
                            <p className="mt-1 text-xs text-amber-700">{stats.pendingCount} phiếu đang trong luồng phê duyệt</p>
                        </div>

                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-blue-800">Đã Duyệt (Chờ Chi)</span>
                                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-blue-900">{stats.approvedCount} phiếu</div>
                            <p className="mt-1 text-xs text-blue-700">Chờ Kế toán xuất quỹ / chuyển khoản</p>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-emerald-800">Đã Giải Ngân (UNC)</span>
                                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-emerald-900">{formatVND(stats.totalPaidVND)}</div>
                            <p className="mt-1 text-xs text-emerald-700">{stats.paidCount} phiếu đã hoàn tất thanh toán</p>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                        {/* Status Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            {[
                                { key: 'ALL', label: 'Tất Cả' },
                                { key: 'SUBMITTED', label: 'Chờ TP Duyệt' },
                                { key: 'REVIEWING_L1', label: 'Chờ Kế Toán' },
                                { key: 'REVIEWING_L2', label: 'Chờ CEO' },
                                { key: 'APPROVED', label: 'Chờ Chi Tiền' },
                                { key: 'PAID', label: 'Đã Chi (UNC)' },
                                { key: 'REJECTED', label: 'Từ Chối' },
                            ].map(pill => (
                                <button
                                    key={pill.key}
                                    onClick={() => handleFilterChange(pill.key, undefined)}
                                    className={`rounded-full px-3 py-1 font-semibold transition ${
                                        statusFilter === pill.key
                                            ? 'bg-[#8B1A2E] text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>

                        {/* Search & Category Filter */}
                        <div className="flex items-center gap-2">
                            <select
                                value={categoryFilter}
                                onChange={e => handleFilterChange(undefined, e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#8B1A2E] focus:outline-none"
                            >
                                <option value="ALL">-- Tất cả nhóm chi --</option>
                                <option value="VENDOR_PAYMENT">Tiền hàng Nhà cung cấp</option>
                                <option value="IMPORT_TAX_LOGISTICS">Thuế NK & Logistics</option>
                                <option value="OPERATIONS_OFFICE">Vận hành & Kho bãi</option>
                                <option value="TASTING_MARKETING">Tasting & Marketing</option>
                                <option value="EMPLOYEE_ADVANCE">Tạm ứng / Hoàn ứng</option>
                                <option value="OTHER">Chi phí khác</option>
                            </select>

                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm mã phiếu, người nhận..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && refreshRequests()}
                                    className="rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                    <tr>
                                        <th className="p-3.5">Mã Phiếu</th>
                                        <th className="p-3.5">Nội Dung Đề Nghị</th>
                                        <th className="p-3.5">Nhóm Chi Phí</th>
                                        <th className="p-3.5">Người Thụ Hưởng</th>
                                        <th className="p-3.5 text-right">Tổng Tiền (VND)</th>
                                        <th className="p-3.5">Người Lập</th>
                                        <th className="p-3.5">Trạng Thái</th>
                                        <th className="p-3.5">Hạn Chi</th>
                                        <th className="p-3.5 text-center">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {requests.length > 0 ? (
                                        requests.map(r => {
                                            const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="p-3.5 font-mono font-bold text-[#8B1A2E]">
                                                        {r.requestNo}
                                                    </td>
                                                    <td className="p-3.5 max-w-[260px]">
                                                        <div className="font-semibold text-slate-800 truncate" title={r.title}>
                                                            {r.title}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                            <span>{r.itemCount} khoản mục</span>
                                                            <span>•</span>
                                                            <span className="text-slate-500 font-medium">{r.attachmentCount} chứng từ scan</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-slate-600">
                                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                            {CATEGORY_LABEL_MAP[r.category] || r.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-medium text-slate-800 truncate max-w-[170px]" title={r.beneficiaryName}>
                                                            {r.beneficiaryName}
                                                        </div>
                                                        {r.beneficiaryAccount && (
                                                            <div className="text-[10px] font-mono text-slate-400 truncate max-w-[170px]">
                                                                STK: {r.beneficiaryAccount} ({r.beneficiaryBank || 'CK'})
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                                                        {formatVND(r.totalAmountVND)}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-medium text-slate-700">{r.creatorName}</div>
                                                        <div className="text-[10px] text-slate-400">{r.departmentName || 'N/A'}</div>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <span
                                                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold inline-block whitespace-nowrap"
                                                            style={{ backgroundColor: status.bg, color: status.color }}
                                                        >
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-slate-500">
                                                        {r.dueDate ? formatDate(r.dueDate) : '—'}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => openDetail(r.id)}
                                                                className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-[#8B1A2E] hover:text-white transition"
                                                                title="Xem chi tiết & Chứng từ scan"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    setLoadingDetail(true)
                                                                    try {
                                                                        const d = await getPaymentRequestDetail(r.id)
                                                                        if (d) setPrintDetail(d)
                                                                    } finally {
                                                                        setLoadingDetail(false)
                                                                    }
                                                                }}
                                                                className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
                                                                title="In Tờ trình / Giấy đề nghị thanh toán"
                                                            >
                                                                <Printer className="h-3.5 w-3.5 text-burgundy" />
                                                            </button>
                                                            {['DRAFT', 'REJECTED'].includes(r.status) && (
                                                                <button
                                                                    onClick={() => handleDeleteRequest(r.id, r.requestNo)}
                                                                    className="rounded-md p-1.5 text-slate-400 hover:text-red-600 transition"
                                                                    title="Xóa phiếu"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-slate-400">
                                                Không có đề nghị thanh toán nào phù hợp với bộ lọc
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: CẤU HÌNH HẠNG MỤC CHI PHÍ                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'CATEGORIES' && (
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Nhóm:</span>
                            {['ALL', 'COST_OF_SALES', 'OPERATING', 'MARKETING', 'ADMINISTRATIVE', 'CAPEX'].map(grp => (
                                <button
                                    key={grp}
                                    onClick={() => setSelectedGroupFilter(grp)}
                                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                        selectedGroupFilter === grp
                                            ? 'bg-slate-800 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {grp === 'ALL' ? 'Tất Cả' : GROUP_LABELS[grp] || grp}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCategoryModalData({
                                open: true,
                                isEdit: false,
                                code: '',
                                name: '',
                                group: 'OPERATING',
                                defaultAccount: '642',
                                description: '',
                            })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-900 transition"
                        >
                            <Plus className="h-3.5 w-3.5" /> Thêm Hạng Mục
                        </button>
                    </div>

                    {/* Categories Table */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                <tr>
                                    <th className="p-3.5">Mã Hạng Mục</th>
                                    <th className="p-3.5">Tên Hạng Mục Chi Phí</th>
                                    <th className="p-3.5">Nhóm Chi Phí</th>
                                    <th className="p-3.5">Tài Khoản VAS Mặc Định</th>
                                    <th className="p-3.5">Diễn Giải Nghiệp Vụ</th>
                                    <th className="p-3.5 text-center">Trạng Thái</th>
                                    <th className="p-3.5 text-center">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories
                                    .filter(c => selectedGroupFilter === 'ALL' || c.group === selectedGroupFilter)
                                    .map(cat => (
                                        <tr key={cat.id} className="hover:bg-slate-50/80">
                                            <td className="p-3.5 font-mono font-bold text-slate-800">
                                                {cat.code}
                                            </td>
                                            <td className="p-3.5 font-semibold text-slate-900">
                                                {cat.name}
                                            </td>
                                            <td className="p-3.5 text-slate-600">
                                                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                                    {GROUP_LABELS[cat.group] || cat.group}
                                                </span>
                                            </td>
                                            <td className="p-3.5 font-mono font-medium text-slate-700">
                                                {cat.defaultAccount || '—'}
                                            </td>
                                            <td className="p-3.5 text-slate-500 max-w-xs truncate" title={cat.description || ''}>
                                                {cat.description || '—'}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                    cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {cat.isActive ? 'Đang Sử Dụng' : 'Tạm Ẩn'}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => setCategoryModalData({
                                                            open: true,
                                                            isEdit: true,
                                                            id: cat.id,
                                                            code: cat.code,
                                                            name: cat.name,
                                                            group: cat.group,
                                                            defaultAccount: cat.defaultAccount || '',
                                                            description: cat.description || '',
                                                        })}
                                                        className="rounded p-1 text-slate-400 hover:text-slate-700"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                        className="rounded p-1 text-slate-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 3: QUẢN LÝ & THEO DÕI NGÂN SÁCH                    */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'BUDGETS' && (
                <div className="space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Tiến Độ Tiêu Thụ Ngân Sách Năm 2026</h3>
                                <p className="text-xs text-slate-500">So sánh số tiền thực chi & chờ duyệt với định mức ngân sách của từng hạng mục</p>
                            </div>
                            <span className="text-xs text-slate-400">Đơn vị tính: VNĐ</span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                    <tr>
                                        <th className="p-3">Hạng Mục Chi Phí</th>
                                        <th className="p-3">Nhóm</th>
                                        <th className="p-3 text-right">Ngân Sách Được Duyệt</th>
                                        <th className="p-3 text-right">Đã Giải Ngân</th>
                                        <th className="p-3 text-right">Đang Chờ Duyệt</th>
                                        <th className="p-3 text-right">Còn Lại</th>
                                        <th className="p-3 w-[22%]">Tiến Độ Tiêu Thụ</th>
                                        <th className="p-3 text-center">Thao Tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {budgets.map(b => {
                                        const isOver = b.isOverBudget
                                        const isAlert = b.isAlert
                                        const barColor = isOver ? 'bg-red-600' : isAlert ? 'bg-amber-500' : b.utilizationPct > 60 ? 'bg-blue-600' : 'bg-emerald-600'

                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50/80">
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800">{b.categoryName}</div>
                                                    <div className="font-mono text-[10px] text-slate-400">{b.categoryCode}</div>
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                                        {GROUP_LABELS[b.categoryGroup] || b.categoryGroup}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                                    {b.allocatedAmount > 0 ? formatVND(b.allocatedAmount) : <span className="text-slate-400 italic">Chưa cài đặt</span>}
                                                </td>
                                                <td className="p-3 text-right font-mono text-emerald-700 font-semibold">
                                                    {formatVND(b.spentAmount)}
                                                </td>
                                                <td className="p-3 text-right font-mono text-amber-700">
                                                    {formatVND(b.pendingAmount)}
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold">
                                                    <span className={b.remainingAmount < 0 ? 'text-red-600' : 'text-slate-700'}>
                                                        {formatVND(b.remainingAmount)}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[11px]">
                                                            <span className="font-semibold text-slate-700">{b.utilizationPct}%</span>
                                                            {isOver ? (
                                                                <span className="text-[10px] font-bold text-red-600">VƯỢT HẠN MỨC</span>
                                                            ) : isAlert ? (
                                                                <span className="text-[10px] font-bold text-amber-600">SẮP CHẠM NGƯỠNG</span>
                                                            ) : null}
                                                        </div>
                                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                                style={{ width: `${Math.min(100, b.utilizationPct)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => setBudgetModalData({
                                                            open: true,
                                                            categoryId: b.categoryId,
                                                            categoryName: b.categoryName,
                                                            year: b.year,
                                                            allocatedAmount: b.allocatedAmount,
                                                            warningThresholdPct: b.warningThresholdPct,
                                                            notes: b.notes || '',
                                                        })}
                                                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-[#8B1A2E] hover:text-white transition"
                                                    >
                                                        Cài Hạn Mức
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Drawer Lập Đề Nghị Mới ═══ */}
            {showCreateDrawer && (
                <CreatePaymentRequestDrawer
                    categories={categories}
                    legalEntities={legalEntities}
                    suppliers={suppliers}
                    departments={departments}
                    onClose={() => setShowCreateDrawer(false)}
                    onSuccess={() => {
                        setShowCreateDrawer(false)
                        refreshRequests()
                    }}
                />
            )}

            {/* ═══ Modal Chi Tiết & Duyệt Đề Nghị (Split-View) ═══ */}
            {selectedDetail && (
                <PaymentRequestDetailModal
                    detail={selectedDetail}
                    currentUser={currentUser}
                    onClose={() => setSelectedDetail(null)}
                    onRefresh={() => {
                        setSelectedDetail(null)
                        refreshRequests()
                    }}
                />
            )}

            {/* ═══ Modal Cấu Hình Hạng Mục Chi Phí ═══ */}
            {categoryModalData.open && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900">
                                {categoryModalData.isEdit ? 'Chỉnh Sửa Hạng Mục Chi Phí' : 'Thêm Hạng Mục Chi Phí Mới'}
                            </h3>
                            <button
                                onClick={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Mã Hạng Mục *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Vd: MKT_TASTING"
                                        value={categoryModalData.code}
                                        onChange={e => setCategoryModalData(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 font-mono uppercase text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Nhóm Chi Phí</label>
                                    <select
                                        value={categoryModalData.group}
                                        onChange={e => setCategoryModalData(prev => ({ ...prev, group: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        <option value="COST_OF_SALES">Tiền Hàng & Nhập Khẩu</option>
                                        <option value="OPERATING">Vận Hành & Kho Bãi</option>
                                        <option value="MARKETING">Tiếp Thị & Bán Hàng</option>
                                        <option value="ADMINISTRATIVE">Hành Chính & Nhân Sự</option>
                                        <option value="CAPEX">Đầu Tư Tài Sản (CAPEX)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Tên Hạng Mục *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Vd: Chi phí Thử nếm rượu (Wine Tasting) & Tiếp khách"
                                    value={categoryModalData.name}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Tài Khoản Kế Toán Mặc Định (VAS)</label>
                                <input
                                    type="text"
                                    placeholder="Vd: 641 - Chi phí bán hàng / 642 - Chi phí quản lý"
                                    value={categoryModalData.defaultAccount}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, defaultAccount: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Diễn Giải Nghiệp Vụ</label>
                                <textarea
                                    rows={2}
                                    placeholder="Mô tả mục đích sử dụng khoản chi này..."
                                    value={categoryModalData.description}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-[#8B1A2E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526]"
                                >
                                    Lưu Hạng Mục
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Modal Thiết Lập Ngân Sách ═══ */}
            {budgetModalData.open && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Thiết Lập Hạn Mức Ngân Sách</h3>
                                <p className="text-xs text-slate-500 font-semibold text-[#8B1A2E]">{budgetModalData.categoryName}</p>
                            </div>
                            <button
                                onClick={() => setBudgetModalData(prev => ({ ...prev, open: false }))}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Năm Ngân Sách</label>
                                <input
                                    type="number"
                                    required
                                    value={budgetModalData.year}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, year: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Hạn Mức Ngân Sách Được Duyệt (VNĐ) *</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={budgetModalData.allocatedAmount}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, allocatedAmount: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-sm font-bold text-slate-900 focus:border-[#8B1A2E] focus:outline-none"
                                />
                                <p className="mt-1 text-[11px] text-slate-500">
                                    Thành tiền: <span className="font-bold text-[#8B1A2E]">{formatVND(budgetModalData.allocatedAmount)}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">Ngưỡng Báo Động Vàng (%)</label>
                                <input
                                    type="number"
                                    min="50"
                                    max="100"
                                    value={budgetModalData.warningThresholdPct}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, warningThresholdPct: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                />
                                <p className="mt-1 text-[11px] text-slate-400">Hệ thống sẽ hiển thị cảnh báo vàng khi chi tiêu đạt mức này</p>
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBudgetModalData(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-[#8B1A2E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526]"
                                >
                                    Lưu Hạn Mức
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Printable Proposal / Payment Request Form */}
            {showBlankPrint && (
                <PrintablePaymentRequest
                    detail={{
                        legalEntity: legalEntities[0] || null,
                        items: [],
                        attachments: [],
                    }}
                    isBlankTemplate={true}
                    onClose={() => setShowBlankPrint(false)}
                />
            )}

            {printDetail && (
                <PrintablePaymentRequest
                    detail={printDetail}
                    onClose={() => setPrintDetail(null)}
                />
            )}
        </div>
    )
}
