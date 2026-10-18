'use client'

import { useState, useTransition } from 'react'
import {
    CreditCard, Plus, Search, Filter, Calendar, FileText, CheckCircle2,
    Clock, AlertTriangle, XCircle, ArrowUpRight, DollarSign, Settings2,
    PieChart, Building2, Tag, ChevronRight, Edit3, Trash2, Eye, RefreshCw,
    FolderKanban, AlertCircle, X, Printer, Sparkles, Package, Receipt,
    Globe, Phone, Mail, MapPin, Check, Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND, formatDate } from '@/lib/utils'
import {
    PaymentRequestRow, ExpenseCategoryRow, ExpenseBudgetRow, SupplierMasterRow,
    getPaymentRequests, getPaymentRequestDetail, deletePaymentRequest,
    saveExpenseCategory, deleteExpenseCategory, saveExpenseBudget,
    getExpenseBudgets, getExpenseCategories, getSuppliersMaster,
    quickCreateSupplier, updateSupplierPaymentInfo
} from './actions'
import { PaymentRequestDetailModal } from './PaymentRequestDetailModal'
import { CreatePaymentRequestDrawer } from './CreatePaymentRequestDrawer'
import { PrintablePaymentRequest } from './PrintablePaymentRequest'
import { useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'

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
    suppliers: SupplierMasterRow[]
    departments: { id: string; name: string }[]
    currentUser: any
}

const CATEGORY_LABEL_MAP: Record<string, { vi: string; en: string }> = {
    VENDOR_PAYMENT: { vi: 'Tiền hàng NCC', en: 'Vendor Payment' },
    IMPORT_TAX_LOGISTICS: { vi: 'Thuế NK & Logistics', en: 'Import Tax & Logistics' },
    OPERATIONS_OFFICE: { vi: 'Vận hành & Kho bãi', en: 'Operations & Warehouse' },
    TASTING_MARKETING: { vi: 'Tasting & Marketing', en: 'Tasting & Marketing' },
    EMPLOYEE_ADVANCE: { vi: 'Tạm ứng / Hoàn ứng', en: 'Employee Advance' },
    OTHER: { vi: 'Chi phí khác', en: 'Other Expenses' },
}

const STATUS_CONFIG: Record<string, { label: string; labelEn: string; bg: string; color: string }> = {
    DRAFT: { label: 'Bản Nháp', labelEn: 'Draft', bg: '#F1F5F9', color: '#475569' },
    SUBMITTED: { label: 'Chờ TP Duyệt (C1)', labelEn: 'Pending Manager (L1)', bg: '#EFF6FF', color: '#1D4ED8' },
    REVIEWING_L1: { label: 'Chờ Kế Toán (C2)', labelEn: 'Pending Accounting (L2)', bg: '#FEF3C7', color: '#B45309' },
    REVIEWING_L2: { label: 'Chờ CEO (C3)', labelEn: 'Pending CEO (L3)', bg: '#ECFEFF', color: '#0E7490' },
    APPROVED: { label: 'Đã Duyệt (Chờ Chi)', labelEn: 'Approved (Pending Payout)', bg: '#ECFDF5', color: '#047857' },
    PAID: { label: 'Đã Giải Ngân', labelEn: 'Disbursed', bg: '#F0FDF4', color: '#15803D' },
    REJECTED: { label: 'Bị Từ Chối', labelEn: 'Rejected', bg: '#FEF2F2', color: '#B91C1C' },
    CANCELLED: { label: 'Đã Hủy', labelEn: 'Cancelled', bg: '#F8FAFC', color: '#64748B' },
}

const GROUP_LABELS: Record<string, { vi: string; en: string }> = {
    COST_OF_SALES: { vi: 'Tiền Hàng & Nhập Khẩu', en: 'Cost of Sales & Imports' },
    OPERATING: { vi: 'Vận Hành & Kho Bãi', en: 'Operations & Warehousing' },
    MARKETING: { vi: 'Tiếp Thị & Bán Hàng', en: 'Marketing & Sales' },
    ADMINISTRATIVE: { vi: 'Hành Chính & Nhân Sự', en: 'Admin & HR' },
    CAPEX: { vi: 'Đầu Tư Tài Sản (CAPEX)', en: 'Capital Expenditure (CAPEX)' },
}

const SUPPLIER_TYPE_MAP: Record<string, { label: string; labelEn: string; bg: string; color: string }> = {
    DISTRIBUTOR: { label: 'Nhà Phân Phối', labelEn: 'Distributor', bg: '#EFF6FF', color: '#1D4ED8' },
    WINERY: { label: 'Hãng Rượu (Winery)', labelEn: 'Winery', bg: '#FDF2F8', color: '#9D174D' },
    FORWARDER: { label: 'Forwarder / Vận Tải', labelEn: 'Forwarder / Freight', bg: '#F0FDF4', color: '#15803D' },
    LOGISTICS: { label: 'Kho Bãi Logistics', labelEn: 'Logistics', bg: '#FEF3C7', color: '#B45309' },
    LOCAL_VENDOR: { label: 'NCC Dịch Vụ', labelEn: 'Local Vendor', bg: '#F1F5F9', color: '#475569' },
    OTHER: { label: 'Khác', labelEn: 'Other', bg: '#F8FAFC', color: '#64748B' },
}

function parseBankInfo(raw: string | null) {
    if (!raw) return null
    const nhMatch = raw.match(/(?:NH|Ngân hàng)[:\s]+([^-\n]+)/i)
    const stkMatch = raw.match(/(?:STK|Số TK)[:\s]+([^-\n]+)/i)
    const chuMatch = raw.match(/(?:Chủ TK|Tên TK)[:\s]+([^-\n]+)/i)
    return {
        bankName: nhMatch ? nhMatch[1].trim() : '',
        stk: stkMatch ? stkMatch[1].trim() : '',
        accountName: chuMatch ? chuMatch[1].trim() : '',
        raw,
    }
}

function PaymentRequestMobileCard({
    item,
    isEn,
    onOpenDetail,
    onPrint,
    onDelete,
}: {
    item: PaymentRequestRow
    isEn: boolean
    onOpenDetail: (id: string) => void
    onPrint: (id: string) => void
    onDelete: (id: string, requestNo: string) => void
}) {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.DRAFT
    const catObj = CATEGORY_LABEL_MAP[item.category]

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 transition hover:border-slate-300">
            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={() => onOpenDetail(item.id)}
                    className="font-mono font-bold text-sm text-[#B91C1C] hover:underline"
                >
                    {item.requestNo}
                </button>
                <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold inline-block whitespace-nowrap shrink-0"
                    style={{ backgroundColor: status.bg, color: status.color }}
                >
                    {isEn ? status.labelEn : status.label}
                </span>
            </div>

            <div>
                <p className="font-semibold text-slate-900 text-xs line-clamp-2" title={item.title}>
                    {item.title}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{item.beneficiaryName}</span>
                    {item.beneficiaryBank && (
                        <>
                            <span>•</span>
                            <span className="truncate max-w-[160px] text-slate-400">{item.beneficiaryBank}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    {catObj ? (isEn ? catObj.en : catObj.vi) : item.category}
                </span>
                <span className="text-slate-400">
                    {isEn ? `${item.itemCount} items • ${item.attachmentCount} docs` : `${item.itemCount} khoản • ${item.attachmentCount} chứng từ`}
                </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                    <span className="text-[10px] text-slate-400 block">{isEn ? 'Requested Amount' : 'Số tiền đề nghị'}</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatVND(item.totalAmountVND)}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{isEn ? 'Due Date' : 'Hạn TT'}</span>
                    <span className="text-xs text-slate-600 font-medium">
                        {item.dueDate ? formatDate(item.dueDate) : '—'}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="text-slate-500 truncate max-w-[45%]">
                    {item.creatorName} {item.departmentName ? `• ${item.departmentName}` : ''}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => onOpenDetail(item.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 font-medium hover:bg-[#B91C1C] hover:text-white transition"
                    >
                        <Eye className="h-3 w-3" /> {isEn ? 'Details' : 'Chi tiết'}
                    </button>
                    <button
                        onClick={() => onPrint(item.id)}
                        className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 transition"
                        title={isEn ? 'Print request' : 'In đề nghị'}
                    >
                        <Printer className="h-3.5 w-3.5 text-[#B91C1C]" />
                    </button>
                    {['DRAFT', 'REJECTED'].includes(item.status) && (
                        <button
                            onClick={() => onDelete(item.id, item.requestNo)}
                            className="rounded-md p-1 text-slate-400 hover:text-red-600 transition"
                            title={isEn ? 'Delete request' : 'Xóa phiếu'}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function SupplierPaymentMobileCard({
    supplier,
    isEn,
    onCreatePayment,
    onEditPayment,
}: {
    supplier: SupplierMasterRow
    isEn: boolean
    onCreatePayment: (id: string) => void
    onEditPayment: (s: SupplierMasterRow) => void
}) {
    const typeBadge = SUPPLIER_TYPE_MAP[supplier.type] || SUPPLIER_TYPE_MAP.OTHER
    const bankParsed = parseBankInfo(supplier.bankAccountInfo)

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5 transition hover:border-slate-300">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{supplier.code}</span>
                    <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}
                    >
                        {isEn ? typeBadge.labelEn : typeBadge.label}
                    </span>
                </div>
                {supplier.paymentTerm && (
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                        {supplier.paymentTerm}
                    </span>
                )}
            </div>

            <div>
                <p className="font-bold text-slate-900 text-xs" title={supplier.name}>
                    {supplier.name}
                </p>
                {supplier.taxId && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {isEn ? 'Tax ID' : 'MST'}: {supplier.taxId}
                    </p>
                )}
            </div>

            <div className="rounded bg-slate-50 p-2 text-[11px] text-slate-700 space-y-0.5">
                {bankParsed ? (
                    <>
                        <div className="font-mono font-bold text-slate-900">
                            {isEn ? 'Acc' : 'STK'}: {bankParsed.stk || '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                            {bankParsed.bankName} {bankParsed.accountName ? `(${bankParsed.accountName})` : ''}
                        </div>
                    </>
                ) : supplier.bankAccountInfo ? (
                    <div className="font-mono text-[10px] text-slate-700 line-clamp-2">
                        {supplier.bankAccountInfo}
                    </div>
                ) : (
                    <span className="text-slate-400 italic">{isEn ? 'No bank account info' : 'Chưa có thông tin tài khoản ngân hàng'}</span>
                )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                <div className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-medium">
                        {supplier.openPOCount} PO
                    </span>
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium">
                        {supplier.unpaidInvoiceCount} {isEn ? 'Inv' : 'HĐ'}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{isEn ? 'Total Paid' : 'Đã thanh toán'}</span>
                    <span className="font-mono font-bold text-xs text-[#B91C1C]">
                        {supplier.totalPaidVND > 0 ? formatVND(supplier.totalPaidVND) : '0 ₫'}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                    onClick={() => onEditPayment(supplier)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                    <Edit3 className="h-3 w-3" /> {isEn ? 'Edit Bank' : 'Sửa TK'}
                </button>
                <button
                    onClick={() => onCreatePayment(supplier.id)}
                    className="inline-flex items-center gap-1 rounded-md bg-[#B91C1C] px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-[#721526]"
                >
                    <Plus className="h-3 w-3" /> {isEn ? 'New Request' : 'Lập Đề Nghị'}
                </button>
            </div>
        </div>
    )
}

export function PaymentRequestsClient({
    initialRequests,
    initialTotal,
    stats,
    categories: initialCategories,
    budgets: initialBudgets,
    legalEntities,
    suppliers: initialSuppliers,
    departments,
    currentUser,
}: PaymentRequestsClientProps) {
    const { isEn } = useAppLocale()
    const [activeTab, setActiveTab] = useState<'REQUESTS' | 'CATEGORIES' | 'BUDGETS' | 'SUPPLIERS'>('REQUESTS')
    const [isPending, startTransition] = useTransition()
    const { confirm, dialog } = useConfirmDialog()

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

    // ── Suppliers Master Data state ──
    const [suppliersList, setSuppliersList] = useState<SupplierMasterRow[]>(initialSuppliers)
    const [drawerInitialSupplierId, setDrawerInitialSupplierId] = useState<string | undefined>(undefined)
    const [supplierSearchText, setSupplierSearchText] = useState('')
    const [supplierTypeFilter, setSupplierTypeFilter] = useState('ALL')

    // Quick Add Supplier state
    const [showQuickAddSupplierModal, setShowQuickAddSupplierModal] = useState(false)
    const [savingQuickSupplier, setSavingQuickSupplier] = useState(false)
    const [quickSupplierForm, setQuickSupplierForm] = useState({
        name: '',
        code: '',
        type: 'DISTRIBUTOR',
        taxId: '',
        bankName: '',
        bankAccountNo: '',
        bankAccountName: '',
        phone: '',
        email: '',
        address: '',
        paymentTerm: 'NET30',
    })

    // Edit Supplier Payment Info modal state
    const [editSupplierModal, setEditSupplierModal] = useState<{
        open: boolean
        supplier: SupplierMasterRow | null
        taxId: string
        bankName: string
        bankAccountNo: string
        bankAccountName: string
        paymentTerm: string
        notes: string
    }>({
        open: false,
        supplier: null,
        taxId: '',
        bankName: '',
        bankAccountNo: '',
        bankAccountName: '',
        paymentTerm: 'NET30',
        notes: '',
    })
    const [savingEditSupplier, setSavingEditSupplier] = useState(false)

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

    // Refresh requests
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
                toast.error(isEn ? 'Request details not found' : 'Không tìm thấy thông tin phiếu')
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Error loading details' : 'Lỗi tải chi tiết'))
        } finally {
            setLoadingDetail(false)
        }
    }

    async function handleDeleteRequest(id: string, requestNo: string) {
        const ok = await confirm({
            title: isEn ? 'Delete Payment Request' : 'Xóa phiếu đề nghị thanh toán',
            message: isEn ? `Are you sure you want to delete request ${requestNo}?` : `Bạn có chắc chắn muốn xóa phiếu ${requestNo}?`,
            confirmLabel: isEn ? 'Delete' : 'Xóa phiếu',
            variant: 'danger',
        })
        if (!ok) return
        try {
            const res = await deletePaymentRequest(id)
            if (res.success) {
                toast.success(isEn ? 'Request deleted successfully' : 'Đã xóa phiếu thành công')
                refreshRequests()
            } else {
                toast.error(res.error || (isEn ? 'Error deleting request' : 'Lỗi khi xóa phiếu'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Connection error' : 'Lỗi kết nối'))
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
                toast.success(isEn ? 'Expense category saved successfully!' : 'Lưu hạng mục chi phí thành công!')
                setCategoryModalData(prev => ({ ...prev, open: false }))
                const updated = await getExpenseCategories(true)
                setCategories(updated)
            } else {
                toast.error(res.error || (isEn ? 'Error saving category' : 'Lỗi khi lưu hạng mục'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Processing error' : 'Lỗi xử lý'))
        }
    }

    async function handleDeleteCategory(id: string, name: string) {
        const ok = await confirm({
            title: isEn ? 'Delete / Hide Expense Category' : 'Xóa / Ẩn hạng mục chi phí',
            message: isEn ? `Are you sure you want to delete or hide category "${name}"?` : `Bạn có chắc muốn xóa hoặc ẩn hạng mục "${name}"?`,
            confirmLabel: isEn ? 'Confirm' : 'Xác nhận',
            variant: 'danger',
        })
        if (!ok) return
        try {
            const res = await deleteExpenseCategory(id)
            if (res.success) {
                toast.success(isEn ? 'Category status updated' : 'Đã cập nhật trạng thái hạng mục')
                const updated = await getExpenseCategories(true)
                setCategories(updated)
            } else {
                toast.error(res.error || (isEn ? 'Delete error' : 'Lỗi xóa'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Error' : 'Lỗi'))
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
                toast.success(isEn ? 'Budget limit saved!' : 'Đã lưu hạn mức ngân sách!')
                setBudgetModalData(prev => ({ ...prev, open: false }))
                const updated = await getExpenseBudgets({ year: budgetModalData.year })
                setBudgets(updated)
            } else {
                toast.error(res.error || (isEn ? 'Error saving budget' : 'Lỗi khi lưu ngân sách'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Error' : 'Lỗi'))
        }
    }

    // Supplier Master actions
    function handleOpenEditSupplier(s: SupplierMasterRow) {
        const parsed = parseBankInfo(s.bankAccountInfo)
        setEditSupplierModal({
            open: true,
            supplier: s,
            taxId: s.taxId || '',
            bankName: parsed?.bankName || '',
            bankAccountNo: parsed?.stk || (parsed?.bankName ? '' : s.bankAccountInfo || ''),
            bankAccountName: parsed?.accountName || '',
            paymentTerm: s.paymentTerm || 'NET30',
            notes: s.notes || '',
        })
    }

    async function handleSaveEditSupplier(e: React.FormEvent) {
        e.preventDefault()
        if (!editSupplierModal.supplier) return
        setSavingEditSupplier(true)
        try {
            const res = await updateSupplierPaymentInfo({
                id: editSupplierModal.supplier.id,
                taxId: editSupplierModal.taxId,
                bankName: editSupplierModal.bankName,
                bankAccountNo: editSupplierModal.bankAccountNo,
                bankAccountName: editSupplierModal.bankAccountName,
                paymentTerm: editSupplierModal.paymentTerm,
                notes: editSupplierModal.notes,
            })

            if (res.success) {
                toast.success(isEn ? 'Supplier payment info updated!' : 'Đã cập nhật thông tin thanh toán của Nhà cung cấp!')
                setEditSupplierModal(prev => ({ ...prev, open: false }))
                const updated = await getSuppliersMaster()
                setSuppliersList(updated)
            } else {
                toast.error(res.error || (isEn ? 'Update error' : 'Lỗi cập nhật'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Connection error' : 'Lỗi kết nối'))
        } finally {
            setSavingEditSupplier(false)
        }
    }

    async function handleQuickAddSupplierSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!quickSupplierForm.name.trim()) {
            toast.error(isEn ? 'Please enter supplier name' : 'Vui lòng nhập tên nhà cung cấp')
            return
        }

        setSavingQuickSupplier(true)
        try {
            const res = await quickCreateSupplier(quickSupplierForm)
            if (res.success && res.supplier) {
                toast.success(isEn ? `Added supplier: ${res.supplier.name}` : `Đã thêm nhà cung cấp: ${res.supplier.name}`)
                setShowQuickAddSupplierModal(false)
                const updated = await getSuppliersMaster()
                setSuppliersList(updated)

                // Reset form
                setQuickSupplierForm({
                    name: '',
                    code: '',
                    type: 'DISTRIBUTOR',
                    taxId: '',
                    bankName: '',
                    bankAccountNo: '',
                    bankAccountName: '',
                    phone: '',
                    email: '',
                    address: '',
                    paymentTerm: 'NET30',
                })
            } else {
                toast.error(res.error || (isEn ? 'Error creating supplier' : 'Lỗi khi tạo nhà cung cấp'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Connection error' : 'Lỗi kết nối'))
        } finally {
            setSavingQuickSupplier(false)
        }
    }

    function handleCreatePaymentForSupplier(supplierId: string) {
        setDrawerInitialSupplierId(supplierId)
        setShowCreateDrawer(true)
    }

    // Filter suppliers in Master tab
    const filteredSuppliers = suppliersList.filter(s => {
        if (supplierTypeFilter !== 'ALL' && s.type !== supplierTypeFilter) return false
        if (!supplierSearchText.trim()) return true
        const q = supplierSearchText.toLowerCase()
        return (
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            (s.taxId && s.taxId.toLowerCase().includes(q)) ||
            (s.bankAccountInfo && s.bankAccountInfo.toLowerCase().includes(q))
        )
    })

    // Supplier KPIs
    const totalSuppliers = suppliersList.length
    const totalPaidToSuppliersVND = suppliersList.reduce((sum, s) => sum + (s.totalPaidVND || 0), 0)
    const totalOpenPOs = suppliersList.reduce((sum, s) => sum + (s.openPOCount || 0), 0)
    const totalUnpaidInvoices = suppliersList.reduce((sum, s) => sum + (s.unpaidInvoiceCount || 0), 0)

    return (
        <div className="space-y-6">
            {/* ═══ Page Header ═══ */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                        <CreditCard className="h-6 w-6 sm:h-7 sm:w-7 text-[#B91C1C] shrink-0" />
                        <span className="truncate">
                            {isEn ? 'Payment Requests & Budget Control' : 'Đề Nghị Thanh Toán & Quản Lý Ngân Sách'}
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        {isEn
                            ? 'Multi-level threshold approval workflow, Supplier master data, Cloudflare R2 document storage & expense budget control'
                            : 'Hệ thống phê duyệt đa cấp theo hạn mức, quản lý master data Nhà cung cấp, lưu trữ chứng từ Cloudflare R2 và kiểm soát ngân sách chi phí'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowBlankPrint(true)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition flex-1 sm:flex-initial"
                        title={isEn ? 'Print blank payment request form for wet signature' : 'In mẫu phôi tờ trình / đề nghị thanh toán trắng để ký tay'}
                    >
                        <Printer className="h-4 w-4 text-[#B91C1C]" /> {isEn ? 'Print Blank Form' : 'In Phôi Mẫu Trắng'}
                    </button>
                    <button
                        onClick={() => {
                            setDrawerInitialSupplierId(undefined)
                            setShowCreateDrawer(true)
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#B91C1C] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#721526] transition flex-1 sm:flex-initial"
                    >
                        <Plus className="h-4 w-4" /> {isEn ? 'New Payment Request' : 'Lập Đề Nghị Mới'}
                    </button>
                </div>
            </div>

            {/* ═══ Main Tab Navigation ═══ */}
            <div className="border-b border-slate-200 overflow-x-auto no-scrollbar">
                <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max">
                    <button
                        onClick={() => setActiveTab('REQUESTS')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'REQUESTS'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <CreditCard className="h-4 w-4" />
                        {isEn ? 'Payment Requests' : 'Phiếu Đề Nghị Thanh Toán'}
                        <span className="inline-block ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 whitespace-nowrap shrink-0">
                            {stats.totalCount}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('SUPPLIERS')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'SUPPLIERS'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <Building2 className="h-4 w-4" />
                        {isEn ? 'Supplier Directory' : 'Danh Mục Nhà Cung Cấp'}
                        <span className="inline-block ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 whitespace-nowrap shrink-0">
                            {suppliersList.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('CATEGORIES')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'CATEGORIES'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <FolderKanban className="h-4 w-4" />
                        {isEn ? 'Expense Categories' : 'Cấu Hình Hạng Mục Chi Phí'}
                        <span className="inline-block ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 whitespace-nowrap shrink-0">
                            {categories.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('BUDGETS')}
                        className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
                            activeTab === 'BUDGETS'
                                ? 'border-[#B91C1C] text-[#B91C1C]'
                                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                    >
                        <PieChart className="h-4 w-4" />
                        {isEn ? 'Budget Management & Tracking' : 'Quản Lý & Theo Dõi Ngân Sách'}
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
                        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                    {isEn ? 'Total Requests (YTD)' : 'Tổng Đề Nghị Năm Nay'}
                                </span>
                                <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                                    <FileText className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalCount}</div>
                            <p className="mt-1 text-xs text-slate-400">
                                {isEn ? 'All payment requests created' : 'Tất cả các khoản chi đã khởi tạo'}
                            </p>
                        </div>

                        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-amber-700">
                                    {isEn ? 'Pending Approval' : 'Đang Chờ Duyệt'}
                                </span>
                                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-amber-900">{stats.pendingCount}</div>
                            <p className="mt-1 text-xs font-mono font-medium text-amber-700">
                                {formatVND(stats.totalPendingVND)}
                            </p>
                        </div>

                        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-blue-700">
                                    {isEn ? 'Approved (Pending Payout)' : 'Đã Duyệt (Chờ Chi)'}
                                </span>
                                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                                    <CheckCircle2 className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-blue-900">{stats.approvedCount}</div>
                            <p className="mt-1 text-xs text-blue-600">
                                {isEn ? 'Ready for Accounting UNC payout' : 'Sẵn sàng để Kế toán lập UNC'}
                            </p>
                        </div>

                        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-emerald-700">
                                    {isEn ? 'Disbursed' : 'Đã Giải Ngân'}
                                </span>
                                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-emerald-900">{stats.paidCount}</div>
                            <p className="mt-1 text-xs font-mono font-medium text-emerald-700">
                                {formatVND(stats.totalPaidVND)}
                            </p>
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={isEn ? 'Search request no, beneficiary, description...' : 'Tìm mã phiếu, người nhận, nội dung...'}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && refreshRequests()}
                                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B91C1C] focus:outline-none"
                                />
                                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                            </div>

                            <select
                                value={statusFilter}
                                onChange={e => handleFilterChange(e.target.value, undefined)}
                                className="rounded-lg border border-slate-300 p-2 sm:p-1.5 text-xs text-slate-700 focus:border-[#B91C1C] focus:outline-none"
                            >
                                <option value="ALL">{isEn ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                                <option value="SUBMITTED">{isEn ? 'Pending Manager (L1)' : 'Chờ Trưởng phòng (Cấp 1)'}</option>
                                <option value="REVIEWING_L1">{isEn ? 'Pending Accounting (L2)' : 'Chờ Kế toán (Cấp 2)'}</option>
                                <option value="REVIEWING_L2">{isEn ? 'Pending CEO (L3)' : 'Chờ CEO (Cấp 3)'}</option>
                                <option value="APPROVED">{isEn ? 'Approved (Pending Payout)' : 'Đã duyệt (Chờ chi)'}</option>
                                <option value="PAID">{isEn ? 'Disbursed' : 'Đã giải ngân'}</option>
                                <option value="REJECTED">{isEn ? 'Rejected' : 'Bị từ chối'}</option>
                            </select>

                            <select
                                value={categoryFilter}
                                onChange={e => handleFilterChange(undefined, e.target.value)}
                                className="rounded-lg border border-slate-300 p-2 sm:p-1.5 text-xs text-slate-700 focus:border-[#B91C1C] focus:outline-none"
                            >
                                <option value="ALL">{isEn ? 'All Expense Groups' : 'Tất cả nhóm chi phí'}</option>
                                <option value="VENDOR_PAYMENT">{isEn ? 'Vendor Payment' : 'Tiền hàng Nhà cung cấp'}</option>
                                <option value="IMPORT_TAX_LOGISTICS">{isEn ? 'Import Tax & Logistics' : 'Thuế NK & Logistics'}</option>
                                <option value="OPERATIONS_OFFICE">{isEn ? 'Operations & Warehouse' : 'Vận hành & Kho bãi'}</option>
                                <option value="TASTING_MARKETING">{isEn ? 'Tasting & Marketing' : 'Tasting & Tiếp khách'}</option>
                                <option value="EMPLOYEE_ADVANCE">{isEn ? 'Employee Advance' : 'Tạm ứng / Hoàn ứng'}</option>
                                <option value="OTHER">{isEn ? 'Other Expenses' : 'Chi phí khác'}</option>
                            </select>
                        </div>

                        <button
                            onClick={refreshRequests}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition self-end sm:self-auto"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                            {isEn ? 'Refresh' : 'Làm mới'}
                        </button>
                    </div>

                    {/* Table of Requests (Desktop) */}
                    <div className="hidden md:block overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                    <tr>
                                        <th className="p-3.5">{isEn ? 'Request No' : 'Mã Phiếu'}</th>
                                        <th className="p-3.5">{isEn ? 'Description' : 'Nội Dung Đề Nghị'}</th>
                                        <th className="p-3.5">{isEn ? 'Expense Group' : 'Nhóm Chi Phí'}</th>
                                        <th className="p-3.5">{isEn ? 'Beneficiary' : 'Đơn Vị Thụ Hưởng'}</th>
                                        <th className="p-3.5 text-right">{isEn ? 'Amount (VND)' : 'Số Tiền (VNĐ)'}</th>
                                        <th className="p-3.5">{isEn ? 'Requester' : 'Người Tạo'}</th>
                                        <th className="p-3.5">{isEn ? 'Status' : 'Trạng Thái'}</th>
                                        <th className="p-3.5">{isEn ? 'Due Date' : 'Hạn TT'}</th>
                                        <th className="p-3.5 text-center">{isEn ? 'Actions' : 'Thao Tác'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {requests.length > 0 ? (
                                        requests.map(r => {
                                            const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT
                                            const catObj = CATEGORY_LABEL_MAP[r.category]
                                            return (
                                                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="p-3.5 font-mono font-bold text-slate-900">
                                                        <button
                                                            onClick={() => openDetail(r.id)}
                                                            className="hover:text-[#B91C1C] hover:underline"
                                                        >
                                                            {r.requestNo}
                                                        </button>
                                                    </td>
                                                    <td className="p-3.5 max-w-xs">
                                                        <div className="font-semibold text-slate-800 line-clamp-1" title={r.title}>
                                                            {r.title}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                                            <span>{isEn ? `${r.itemCount} items` : `${r.itemCount} khoản mục`}</span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-0.5">
                                                                <FileText className="h-3 w-3" /> {isEn ? `${r.attachmentCount} docs` : `${r.attachmentCount} chứng từ`}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-slate-600">
                                                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 inline-block whitespace-nowrap shrink-0">
                                                            {catObj ? (isEn ? catObj.en : catObj.vi) : r.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <div className="font-medium text-slate-800">{r.beneficiaryName}</div>
                                                        {r.beneficiaryBank && (
                                                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                                                {r.beneficiaryBank}
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
                                                            {isEn ? status.labelEn : status.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 text-slate-500">
                                                        {r.dueDate ? formatDate(r.dueDate) : '—'}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => openDetail(r.id)}
                                                                className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-[#B91C1C] hover:text-white transition"
                                                                title={isEn ? 'View details & Scanned docs' : 'Xem chi tiết & Chứng từ scan'}
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
                                                                title={isEn ? 'Print Payment Request Form' : 'In Tờ trình / Giấy đề nghị thanh toán'}
                                                            >
                                                                <Printer className="h-3.5 w-3.5 text-[#B91C1C]" />
                                                            </button>
                                                            {['DRAFT', 'REJECTED'].includes(r.status) && (
                                                                <button
                                                                    onClick={() => handleDeleteRequest(r.id, r.requestNo)}
                                                                    className="rounded-md p-1.5 text-slate-400 hover:text-red-600 transition"
                                                                    title={isEn ? 'Delete request' : 'Xóa phiếu'}
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
                                                {isEn ? 'No payment requests match your filters' : 'Không có đề nghị thanh toán nào phù hợp với bộ lọc'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card List for Requests */}
                    <div className="block md:hidden space-y-3">
                        {requests.length > 0 ? (
                            requests.map(r => (
                                <PaymentRequestMobileCard
                                    key={r.id}
                                    item={r}
                                    isEn={isEn}
                                    onOpenDetail={openDetail}
                                    onPrint={async (id) => {
                                        setLoadingDetail(true)
                                        try {
                                            const d = await getPaymentRequestDetail(id)
                                            if (d) setPrintDetail(d)
                                        } finally {
                                            setLoadingDetail(false)
                                        }
                                    }}
                                    onDelete={handleDeleteRequest}
                                />
                            ))
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                                {isEn ? 'No payment requests match your filters' : 'Không có đề nghị thanh toán nào phù hợp với bộ lọc'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 4: DANH MỤC NHÀ CUNG CẤP (MASTER DATA)             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'SUPPLIERS' && (
                <div className="space-y-6">
                    {/* Master Data Stats Grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-slate-500">
                                    {isEn ? 'Total Suppliers' : 'Tổng Nhà Cung Cấp'}
                                </span>
                                <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                                    <Building2 className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-slate-900">{totalSuppliers}</div>
                            <p className="mt-1 text-xs text-slate-400">
                                {isEn ? 'Active in system' : 'Đang hoạt động trong hệ thống'}
                            </p>
                        </div>

                        <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-emerald-700">
                                    {isEn ? 'Cumulative Paid' : 'Lũy Kế Đã Thanh Toán'}
                                </span>
                                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                                    <DollarSign className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-emerald-950 font-mono">
                                {formatVND(totalPaidToSuppliersVND)}
                            </div>
                            <p className="mt-1 text-xs text-emerald-600">
                                {isEn ? 'Total disbursed to suppliers' : 'Tổng tiền đã giải ngân cho NCC'}
                            </p>
                        </div>

                        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-amber-700">
                                    {isEn ? 'Open POs' : 'Đơn Hàng PO Mở'}
                                </span>
                                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                                    <Package className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-amber-900">{totalOpenPOs}</div>
                            <p className="mt-1 text-xs text-amber-700">
                                {isEn ? 'Pending or receiving purchase orders' : 'Đơn hàng đang chờ hoặc đang nhận'}
                            </p>
                        </div>

                        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase text-blue-700">
                                    {isEn ? 'Unpaid AP Invoices' : 'Hóa Đơn AP Chưa Tất Toán'}
                                </span>
                                <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                                    <Receipt className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 text-2xl font-bold text-blue-900">{totalUnpaidInvoices}</div>
                            <p className="mt-1 text-xs text-blue-600">
                                {isEn ? 'Payable invoices awaiting settlement' : 'Hóa đơn công nợ cần thanh toán'}
                            </p>
                        </div>
                    </div>

                    {/* Filter and Action Bar */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border border-slate-200 bg-white p-3 shadow-2xs">
                        <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    placeholder={isEn ? 'Search by supplier name, code, Tax ID or bank account...' : 'Tìm theo tên NCC, mã NCC, MST hoặc số tài khoản...'}
                                    value={supplierSearchText}
                                    onChange={e => setSupplierSearchText(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B91C1C] focus:outline-none"
                                />
                                <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
                            </div>

                            <select
                                value={supplierTypeFilter}
                                onChange={e => setSupplierTypeFilter(e.target.value)}
                                className="rounded-lg border border-slate-300 p-2 sm:p-1.5 text-xs text-slate-700 focus:border-[#B91C1C] focus:outline-none"
                            >
                                <option value="ALL">{isEn ? 'All Supplier Types' : 'Tất cả phân loại NCC'}</option>
                                <option value="DISTRIBUTOR">{isEn ? 'Distributor' : 'Nhà phân phối (Distributor)'}</option>
                                <option value="WINERY">{isEn ? 'Winery' : 'Hãng rượu (Winery)'}</option>
                                <option value="FORWARDER">{isEn ? 'Forwarder / Freight' : 'Forwarder / Cước tàu'}</option>
                                <option value="LOGISTICS">{isEn ? 'Warehousing & Logistics' : 'Kho bãi & Vận tải'}</option>
                                <option value="LOCAL_VENDOR">{isEn ? 'Local Service Vendor' : 'NCC Dịch vụ nội địa'}</option>
                                <option value="OTHER">{isEn ? 'Other' : 'Khác'}</option>
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowQuickAddSupplierModal(true)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#B91C1C] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#721526] transition self-start sm:self-auto"
                        >
                            <Plus className="h-4 w-4" /> {isEn ? 'Add New Supplier' : 'Thêm Nhà Cung Cấp Mới'}
                        </button>
                    </div>

                    {/* Master Data Table (Desktop) */}
                    <div className="hidden md:block overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                    <tr>
                                        <th className="p-3.5">{isEn ? 'Code & Type' : 'Mã & Loại NCC'}</th>
                                        <th className="p-3.5">{isEn ? 'Supplier Name' : 'Tên Nhà Cung Cấp'}</th>
                                        <th className="p-3.5">{isEn ? 'Tax ID' : 'Mã Số Thuế'}</th>
                                        <th className="p-3.5">{isEn ? 'Terms' : 'Điều Khoản TT'}</th>
                                        <th className="p-3.5">{isEn ? 'Beneficiary Bank Account' : 'Tài Khoản Ngân Hàng Thụ Hưởng'}</th>
                                        <th className="p-3.5 text-center">{isEn ? 'Transactions' : 'Giao Dịch'}</th>
                                        <th className="p-3.5 text-right">{isEn ? 'Cumulative Paid (VND)' : 'Lũy Kế Đã Chi (VNĐ)'}</th>
                                        <th className="p-3.5 text-center">{isEn ? 'Actions' : 'Thao Tác'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSuppliers.length > 0 ? (
                                        filteredSuppliers.map(s => {
                                            const typeBadge = SUPPLIER_TYPE_MAP[s.type] || SUPPLIER_TYPE_MAP.OTHER
                                            const bankParsed = parseBankInfo(s.bankAccountInfo)

                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50/80 transition">
                                                    <td className="p-3.5">
                                                        <div className="font-mono font-bold text-slate-900">{s.code}</div>
                                                        <span
                                                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                                            style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}
                                                        >
                                                            {isEn ? typeBadge.labelEn : typeBadge.label}
                                                        </span>
                                                    </td>
                                                    <td className="p-3.5 max-w-xs">
                                                        <div className="font-bold text-slate-900 line-clamp-1" title={s.name}>
                                                            {s.name}
                                                        </div>
                                                        {s.country && (
                                                            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-slate-400">
                                                                <Globe className="h-3 w-3" /> {s.country}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 font-mono text-slate-700 font-medium">
                                                        {s.taxId ? (
                                                            <span className="rounded bg-slate-100 px-2 py-0.5">{s.taxId}</span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">{isEn ? 'No Tax ID' : 'Chưa có MST'}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 font-semibold text-slate-800">
                                                        {s.paymentTerm ? (
                                                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-800 border border-amber-200 inline-block whitespace-nowrap shrink-0">
                                                                {s.paymentTerm}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">NET30</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 max-w-sm">
                                                        {bankParsed ? (
                                                            <div className="space-y-0.5">
                                                                <div className="font-mono font-bold text-slate-900">
                                                                    {isEn ? 'Acc' : 'STK'}: {bankParsed.stk || '—'}
                                                                </div>
                                                                <div className="text-[11px] text-slate-600 truncate">
                                                                    {bankParsed.bankName} {bankParsed.accountName ? `(${bankParsed.accountName})` : ''}
                                                                </div>
                                                            </div>
                                                        ) : s.bankAccountInfo ? (
                                                            <div className="font-mono text-[11px] text-slate-700 line-clamp-2">
                                                                {s.bankAccountInfo}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleOpenEditSupplier(s)}
                                                                className="text-[11px] text-[#B91C1C] hover:underline font-medium flex items-center gap-1"
                                                            >
                                                                <Plus className="h-3 w-3" /> {isEn ? 'Add bank account' : 'Thêm TK ngân hàng'}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 text-[11px]">
                                                            <span
                                                                className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 font-medium"
                                                                title={isEn ? 'Open PO count' : 'Số lượng đơn hàng PO'}
                                                            >
                                                                {s.openPOCount} PO
                                                            </span>
                                                            <span
                                                                className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 font-medium"
                                                                title={isEn ? 'Unpaid invoice count' : 'Số lượng hóa đơn chưa thanh toán'}
                                                            >
                                                                {s.unpaidInvoiceCount} {isEn ? 'Inv' : 'HĐ'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3.5 text-right font-mono font-bold text-slate-900 text-sm">
                                                        {s.totalPaidVND > 0 ? (
                                                            <span className="text-[#B91C1C]">{formatVND(s.totalPaidVND)}</span>
                                                        ) : (
                                                            <span className="text-slate-400">0 ₫</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleCreatePaymentForSupplier(s.id)}
                                                                className="inline-flex items-center gap-1 rounded-md bg-[#B91C1C] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-[#721526] transition"
                                                                title={isEn ? 'Create Payment Request for this Supplier' : 'Lập Đề Nghị Thanh Toán cho Nhà Cung Cấp này'}
                                                            >
                                                                <Plus className="h-3 w-3" /> {isEn ? 'New Request' : 'Lập Đề Nghị'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenEditSupplier(s)}
                                                                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                                                                title={isEn ? 'Edit bank & payment info' : 'Chỉnh sửa thông tin ngân hàng & thanh toán'}
                                                            >
                                                                <Edit3 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="p-8 text-center text-slate-400">
                                                {isEn ? 'No matching Suppliers found' : 'Không tìm thấy Nhà Cung Cấp nào phù hợp'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card List for Suppliers */}
                    <div className="block md:hidden space-y-3">
                        {filteredSuppliers.length > 0 ? (
                            filteredSuppliers.map(s => (
                                <SupplierPaymentMobileCard
                                    key={s.id}
                                    supplier={s}
                                    isEn={isEn}
                                    onCreatePayment={handleCreatePaymentForSupplier}
                                    onEditPayment={handleOpenEditSupplier}
                                />
                            ))
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
                                {isEn ? 'No matching Suppliers found' : 'Không tìm thấy Nhà Cung Cấp nào phù hợp'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: CẤU HÌNH HẠNG MỤC CHI PHÍ                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'CATEGORIES' && (
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-500">{isEn ? 'Group:' : 'Nhóm:'}</span>
                            {['ALL', 'COST_OF_SALES', 'OPERATING', 'MARKETING', 'ADMINISTRATIVE', 'CAPEX'].map(grp => {
                                const grpObj = GROUP_LABELS[grp]
                                return (
                                    <button
                                        key={grp}
                                        onClick={() => setSelectedGroupFilter(grp)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                            selectedGroupFilter === grp
                                                ? 'bg-[#0E7490] text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {grp === 'ALL' ? (isEn ? 'All' : 'Tất Cả') : grpObj ? (isEn ? grpObj.en : grpObj.vi) : grp}
                                    </button>
                                )
                            })}
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
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E7490] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#155E75] transition"
                        >
                            <Plus className="h-3.5 w-3.5" /> {isEn ? 'Add Category' : 'Thêm Hạng Mục'}
                        </button>
                    </div>

                    {/* Categories Table (Desktop) */}
                    <div className="hidden md:block overflow-x-auto rounded-md border border-slate-200 bg-white shadow-2xs">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                <tr>
                                    <th className="p-3.5">{isEn ? 'Category Code' : 'Mã Hạng Mục'}</th>
                                    <th className="p-3.5">{isEn ? 'Category Name' : 'Tên Hạng Mục Chi Phí'}</th>
                                    <th className="p-3.5">{isEn ? 'Expense Group' : 'Nhóm Chi Phí'}</th>
                                    <th className="p-3.5">{isEn ? 'Default VAS Account' : 'Tài Khoản VAS Mặc Định'}</th>
                                    <th className="p-3.5">{isEn ? 'Description' : 'Diễn Giải Nghiệp Vụ'}</th>
                                    <th className="p-3.5 text-center">{isEn ? 'Status' : 'Trạng Thái'}</th>
                                    <th className="p-3.5 text-center">{isEn ? 'Actions' : 'Thao Tác'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories
                                    .filter(c => selectedGroupFilter === 'ALL' || c.group === selectedGroupFilter)
                                    .map(cat => {
                                        const grpObj = GROUP_LABELS[cat.group]
                                        return (
                                            <tr key={cat.id} className="hover:bg-slate-50/80">
                                                <td className="p-3.5 font-mono font-bold text-slate-800">
                                                    {cat.code}
                                                </td>
                                                <td className="p-3.5 font-semibold text-slate-900">
                                                    {cat.name}
                                                </td>
                                                <td className="p-3.5 text-slate-600">
                                                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0">
                                                        {grpObj ? (isEn ? grpObj.en : grpObj.vi) : cat.group}
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
                                                        {cat.isActive ? (isEn ? 'Active' : 'Đang Sử Dụng') : (isEn ? 'Hidden' : 'Tạm Ẩn')}
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
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards for Categories */}
                    <div className="block md:hidden space-y-3">
                        {categories
                            .filter(c => selectedGroupFilter === 'ALL' || c.group === selectedGroupFilter)
                            .map(cat => {
                                const grpObj = GROUP_LABELS[cat.group]
                                return (
                                    <div key={cat.id} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono font-bold text-xs text-slate-800">{cat.code}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                cat.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {cat.isActive ? (isEn ? 'Active' : 'Đang Sử Dụng') : (isEn ? 'Hidden' : 'Tạm Ẩn')}
                                            </span>
                                        </div>
                                        <p className="font-semibold text-xs text-slate-900">{cat.name}</p>
                                        {cat.description && <p className="text-[11px] text-slate-500 line-clamp-2">{cat.description}</p>}
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                                    {grpObj ? (isEn ? grpObj.en : grpObj.vi) : cat.group}
                                                </span>
                                                <span className="font-mono text-slate-600">VAS: {cat.defaultAccount || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
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
                                                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
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
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 3: QUẢN LÝ & THEO DÕI NGÂN SÁCH                    */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'BUDGETS' && (
                <div className="space-y-6">
                    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-2xs">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    {isEn ? '2026 Budget Utilization Progress' : 'Tiến Độ Tiêu Thụ Ngân Sách Năm 2026'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {isEn
                                        ? 'Compare actual disbursed & pending amounts against approved budget limits per category'
                                        : 'So sánh số tiền thực chi & chờ duyệt với định mức ngân sách của từng hạng mục'}
                                </p>
                            </div>
                            <span className="text-xs text-slate-400">{isEn ? 'Currency: VND' : 'Đơn vị tính: VNĐ'}</span>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                                    <tr>
                                        <th className="p-3">{isEn ? 'Expense Category' : 'Hạng Mục Chi Phí'}</th>
                                        <th className="p-3">{isEn ? 'Group' : 'Nhóm'}</th>
                                        <th className="p-3 text-right">{isEn ? 'Approved Budget' : 'Ngân Sách Được Duyệt'}</th>
                                        <th className="p-3 text-right">{isEn ? 'Disbursed' : 'Đã Giải Ngân'}</th>
                                        <th className="p-3 text-right">{isEn ? 'Pending' : 'Đang Chờ Duyệt'}</th>
                                        <th className="p-3 text-right">{isEn ? 'Remaining' : 'Còn Lại'}</th>
                                        <th className="p-3 w-[22%]">{isEn ? 'Utilization' : 'Tiến Độ Tiêu Thụ'}</th>
                                        <th className="p-3 text-center">{isEn ? 'Actions' : 'Thao Tác'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {budgets.map(b => {
                                        const isOver = b.isOverBudget
                                        const isAlert = b.isAlert
                                        const barColor = isOver ? 'bg-red-600' : isAlert ? 'bg-amber-500' : b.utilizationPct > 60 ? 'bg-blue-600' : 'bg-emerald-600'
                                        const grpObj = GROUP_LABELS[b.categoryGroup]

                                        return (
                                            <tr key={b.id} className="hover:bg-slate-50/80">
                                                <td className="p-3">
                                                    <div className="font-semibold text-slate-800">{b.categoryName}</div>
                                                    <div className="font-mono text-[10px] text-slate-400">{b.categoryCode}</div>
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 whitespace-nowrap shrink-0">
                                                        {grpObj ? (isEn ? grpObj.en : grpObj.vi) : b.categoryGroup}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                                    {b.allocatedAmount > 0 ? formatVND(b.allocatedAmount) : <span className="text-slate-400 italic">{isEn ? 'Not set' : 'Chưa cài đặt'}</span>}
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
                                                                <span className="text-[10px] font-bold text-red-600">{isEn ? 'OVER BUDGET' : 'VƯỢT HẠN MỨC'}</span>
                                                            ) : isAlert ? (
                                                                <span className="text-[10px] font-bold text-amber-600">{isEn ? 'NEAR LIMIT' : 'SẮP CHẠM NGƯỠNG'}</span>
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
                                                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-[#B91C1C] hover:text-white transition"
                                                    >
                                                        {isEn ? 'Set Limit' : 'Cài Hạn Mức'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards for Budgets */}
                        <div className="block md:hidden space-y-3">
                            {budgets.map(b => {
                                const isOver = b.isOverBudget
                                const isAlert = b.isAlert
                                const barColor = isOver ? 'bg-red-600' : isAlert ? 'bg-amber-500' : b.utilizationPct > 60 ? 'bg-blue-600' : 'bg-emerald-600'
                                const grpObj = GROUP_LABELS[b.categoryGroup]
                                return (
                                    <div key={b.id} className="rounded-lg border border-slate-200 bg-slate-50/40 p-3.5 space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-xs text-slate-800">{b.categoryName}</p>
                                                <span className="font-mono text-[10px] text-slate-400">{b.categoryCode}</span>
                                            </div>
                                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                                                {grpObj ? (isEn ? grpObj.en : grpObj.vi) : b.categoryGroup}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div>
                                                <span className="text-slate-400 block">{isEn ? 'Approved Budget' : 'Ngân sách duyệt'}</span>
                                                <span className="font-mono font-bold text-slate-900">
                                                    {b.allocatedAmount > 0 ? formatVND(b.allocatedAmount) : (isEn ? 'Not set' : 'Chưa cài đặt')}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-slate-400 block">{isEn ? 'Remaining' : 'Còn lại'}</span>
                                                <span className={`font-mono font-bold ${b.remainingAmount < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                                    {formatVND(b.remainingAmount)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block">{isEn ? 'Disbursed' : 'Đã giải ngân'}</span>
                                                <span className="font-mono text-emerald-700 font-semibold">{formatVND(b.spentAmount)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-slate-400 block">{isEn ? 'Pending' : 'Đang chờ duyệt'}</span>
                                                <span className="font-mono text-amber-700">{formatVND(b.pendingAmount)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 pt-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-semibold text-slate-700">{b.utilizationPct}%</span>
                                                {isOver ? (
                                                    <span className="text-[10px] font-bold text-red-600">{isEn ? 'OVER BUDGET' : 'VƯỢT HẠN MỨC'}</span>
                                                ) : isAlert ? (
                                                    <span className="text-[10px] font-bold text-amber-600">{isEn ? 'NEAR LIMIT' : 'SẮP CHẠM NGƯỠNG'}</span>
                                                ) : null}
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                    style={{ width: `${Math.min(100, b.utilizationPct)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-1">
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
                                                className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-[#B91C1C] hover:text-white transition"
                                            >
                                                {isEn ? 'Set Limit' : 'Cài Hạn Mức'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Drawer Lập Đề Nghị Mới ═══ */}
            {showCreateDrawer && (
                <CreatePaymentRequestDrawer
                    categories={categories}
                    legalEntities={legalEntities}
                    suppliers={suppliersList}
                    departments={departments}
                    initialSupplierId={drawerInitialSupplierId}
                    onClose={() => {
                        setShowCreateDrawer(false)
                        setDrawerInitialSupplierId(undefined)
                    }}
                    onSuccess={() => {
                        setShowCreateDrawer(false)
                        setDrawerInitialSupplierId(undefined)
                        refreshRequests()
                    }}
                    onSupplierCreated={newSupp => {
                        setSuppliersList(prev => [newSupp, ...prev])
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
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-md bg-white p-5 sm:p-6 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-slate-900">
                                {categoryModalData.isEdit
                                    ? (isEn ? 'Edit Expense Category' : 'Chỉnh Sửa Hạng Mục Chi Phí')
                                    : (isEn ? 'Add New Expense Category' : 'Thêm Hạng Mục Chi Phí Mới')}
                            </h3>
                            <button
                                onClick={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Category Code *' : 'Mã Hạng Mục *'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. MKT_TASTING"
                                        value={categoryModalData.code}
                                        onChange={e => setCategoryModalData(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 font-mono uppercase text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Expense Group' : 'Nhóm Chi Phí'}
                                    </label>
                                    <select
                                        value={categoryModalData.group}
                                        onChange={e => setCategoryModalData(prev => ({ ...prev, group: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="COST_OF_SALES">{isEn ? 'Cost of Sales & Imports' : 'Tiền Hàng & Nhập Khẩu'}</option>
                                        <option value="OPERATING">{isEn ? 'Operations & Warehousing' : 'Vận Hành & Kho Bãi'}</option>
                                        <option value="MARKETING">{isEn ? 'Marketing & Sales' : 'Tiếp Thị & Bán Hàng'}</option>
                                        <option value="ADMINISTRATIVE">{isEn ? 'Admin & HR' : 'Hành Chính & Nhân Sự'}</option>
                                        <option value="CAPEX">{isEn ? 'Capital Expenditure (CAPEX)' : 'Đầu Tư Tài Sản (CAPEX)'}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Category Name *' : 'Tên Hạng Mục *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isEn ? 'e.g. Wine Tasting & Hospitality Expenses' : 'Vd: Chi phí Thử nếm rượu (Wine Tasting) & Tiếp khách'}
                                    value={categoryModalData.name}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Default Accounting Account (VAS)' : 'Tài Khoản Kế Toán Mặc Định (VAS)'}
                                </label>
                                <input
                                    type="text"
                                    placeholder={isEn ? 'e.g. 641 - Selling expenses / 642 - G&A expenses' : 'Vd: 641 - Chi phí bán hàng / 642 - Chi phí quản lý'}
                                    value={categoryModalData.defaultAccount}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, defaultAccount: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Business Description' : 'Diễn Giải Nghiệp Vụ'}
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder={isEn ? 'Describe the purpose of this expense category...' : 'Mô tả mục đích sử dụng khoản chi này...'}
                                    value={categoryModalData.description}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    {isEn ? 'Cancel' : 'Hủy'}
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526]"
                                >
                                    {isEn ? 'Save Category' : 'Lưu Hạng Mục'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Modal Thiết Lập Ngân Sách ═══ */}
            {budgetModalData.open && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-md bg-white p-5 sm:p-6 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    {isEn ? 'Set Budget Limit' : 'Thiết Lập Hạn Mức Ngân Sách'}
                                </h3>
                                <p className="text-xs font-semibold text-[#B91C1C]">{budgetModalData.categoryName}</p>
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
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Budget Year' : 'Năm Ngân Sách'}
                                </label>
                                <input
                                    type="number"
                                    required
                                    value={budgetModalData.year}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, year: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Approved Budget Limit (VND) *' : 'Hạn Mức Ngân Sách Được Duyệt (VNĐ) *'}
                                </label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={budgetModalData.allocatedAmount}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, allocatedAmount: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 font-mono text-sm font-bold text-slate-900 focus:border-[#B91C1C] focus:outline-none"
                                />
                                <p className="mt-1 text-[11px] text-slate-500">
                                    {isEn ? 'Amount: ' : 'Thành tiền: '}<span className="font-bold text-[#B91C1C]">{formatVND(budgetModalData.allocatedAmount)}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Warning Threshold (%)' : 'Ngưỡng Báo Động Vàng (%)'}
                                </label>
                                <input
                                    type="number"
                                    min="50"
                                    max="100"
                                    value={budgetModalData.warningThresholdPct}
                                    onChange={e => setBudgetModalData(prev => ({ ...prev, warningThresholdPct: Number(e.target.value) }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                                <p className="mt-1 text-[11px] text-slate-400">
                                    {isEn ? 'System will show an amber warning when spending reaches this percentage' : 'Hệ thống sẽ hiển thị cảnh báo vàng khi chi tiêu đạt mức này'}
                                </p>
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setBudgetModalData(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    {isEn ? 'Cancel' : 'Hủy'}
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526]"
                                >
                                    {isEn ? 'Save Limit' : 'Lưu Hạn Mức'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Modal Chỉnh Sửa Thông Tin Thanh Toán NCC ═══ */}
            {editSupplierModal.open && editSupplierModal.supplier && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <Edit3 className="h-4 w-4 text-[#B91C1C]" /> {isEn ? 'Update Payment & Bank Information' : 'Cập Nhật Thông Tin Thanh Toán & Ngân Hàng'}
                                </h3>
                                <p className="text-xs font-semibold text-[#B91C1C] mt-0.5">
                                    [{editSupplierModal.supplier.code}] {editSupplierModal.supplier.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditSupplierModal(prev => ({ ...prev, open: false }))}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditSupplier} className="space-y-3.5 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Tax ID (MST)' : 'Mã Số Thuế (MST)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 0312345678"
                                        value={editSupplierModal.taxId}
                                        onChange={e => setEditSupplierModal(prev => ({ ...prev, taxId: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Terms' : 'Điều Khoản Thanh Toán'}
                                    </label>
                                    <select
                                        value={editSupplierModal.paymentTerm}
                                        onChange={e => setEditSupplierModal(prev => ({ ...prev, paymentTerm: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="COD">{isEn ? 'Cash on Delivery (COD)' : 'Thanh toán ngay khi giao (COD)'}</option>
                                        <option value="NET15">{isEn ? 'Net 15 Days (NET15)' : 'Công nợ 15 ngày (NET15)'}</option>
                                        <option value="NET30">{isEn ? 'Net 30 Days (NET30)' : 'Công nợ 30 ngày (NET30)'}</option>
                                        <option value="NET45">{isEn ? 'Net 45 Days (NET45)' : 'Công nợ 45 ngày (NET45)'}</option>
                                        <option value="NET60">{isEn ? 'Net 60 Days (NET60)' : 'Công nợ 60 ngày (NET60)'}</option>
                                        <option value="ADVANCE_50">{isEn ? '50% Advance - Balance after delivery' : 'Tạm ứng 50% - Còn lại sau giao hàng'}</option>
                                        <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bank details card */}
                            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                                <span className="font-semibold text-slate-800 block text-xs">
                                    {isEn ? 'Supplier Beneficiary Bank Account' : 'Tài Khoản Ngân Hàng Thụ Hưởng Của Nhà Cung Cấp'}
                                </span>

                                <div>
                                    <label className="block text-[11px] text-slate-600 mb-0.5">
                                        {isEn ? 'Bank Name & Branch' : 'Tên Ngân Hàng & Chi Nhánh'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isEn ? 'e.g. Vietcombank Ky Dong / BIDV HCMC' : 'Vd: Vietcombank CN Kỳ Đồng / BIDV CN TP.HCM'}
                                        value={editSupplierModal.bankName}
                                        onChange={e => setEditSupplierModal(prev => ({ ...prev, bankName: e.target.value }))}
                                        className="w-full rounded border border-slate-300 p-2 text-xs bg-white focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Number' : 'Số Tài Khoản (STK)'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0071001234567"
                                            value={editSupplierModal.bankAccountNo}
                                            onChange={e => setEditSupplierModal(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-2 text-xs font-mono font-bold bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Holder Name' : 'Tên Chủ Tài Khoản'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. ABC DISTRIBUTION CO., LTD"
                                            value={editSupplierModal.bankAccountName}
                                            onChange={e => setEditSupplierModal(prev => ({ ...prev, bankAccountName: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-2 text-xs font-medium uppercase bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Operational Notes' : 'Ghi Chú Nghiệp Vụ'}
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder={isEn ? 'Additional notes on invoicing, accounting contact...' : 'Ghi chú thêm về thông tin xuất hóa đơn, đầu mối kế toán của NCC...'}
                                    value={editSupplierModal.notes}
                                    onChange={e => setEditSupplierModal(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditSupplierModal(prev => ({ ...prev, open: false }))}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    {isEn ? 'Cancel' : 'Hủy'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEditSupplier}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526] transition disabled:opacity-50"
                                >
                                    {savingEditSupplier && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isEn ? 'Save Info' : 'Lưu Thông Tin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══ Modal Thêm NCC Mới Từ Tab Master ═══ */}
            {showQuickAddSupplierModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-[#B91C1C]" /> {isEn ? 'Add New Supplier' : 'Thêm Nhà Cung Cấp Mới'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {isEn ? 'Quickly create Supplier profile & bank account for payments' : 'Khởi tạo nhanh hồ sơ Nhà Cung Cấp & tài khoản ngân hàng để phục vụ thanh toán'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowQuickAddSupplierModal(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleQuickAddSupplierSubmit} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Supplier Name *' : 'Tên Nhà Cung Cấp *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isEn ? 'e.g. Wine Import Co., Ltd A' : 'Vd: Công ty TNHH Nhập Khẩu Rượu Vang A'}
                                    value={quickSupplierForm.name}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Supplier Code (Blank for auto)' : 'Mã NCC (Để trống sẽ tự sinh)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. NCC-0088"
                                        value={quickSupplierForm.code}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs uppercase focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Supplier Type' : 'Phân loại NCC'}
                                    </label>
                                    <select
                                        value={quickSupplierForm.type}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="DISTRIBUTOR">{isEn ? 'Distributor' : 'Nhà phân phối (Distributor)'}</option>
                                        <option value="WINERY">{isEn ? 'Winery / Producer' : 'Nhà làm rượu (Winery / Hãng rượu)'}</option>
                                        <option value="FORWARDER">{isEn ? 'Freight Forwarder' : 'Hãng tàu / Giao nhận (Forwarder)'}</option>
                                        <option value="LOGISTICS">{isEn ? 'Warehousing / Domestic Logistics' : 'Kho bãi / Vận tải nội địa'}</option>
                                        <option value="LOCAL_VENDOR">{isEn ? 'Local Service Vendor' : 'Nhà cung cấp dịch vụ trong nước'}</option>
                                        <option value="OTHER">{isEn ? 'Other' : 'Khác'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Tax ID (MST)' : 'Mã số thuế (MST)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 0312345678"
                                        value={quickSupplierForm.taxId}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, taxId: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Terms' : 'Điều khoản thanh toán'}
                                    </label>
                                    <select
                                        value={quickSupplierForm.paymentTerm}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, paymentTerm: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="COD">{isEn ? 'Cash on Delivery (COD)' : 'Thanh toán ngay khi giao (COD)'}</option>
                                        <option value="NET15">{isEn ? 'Net 15 Days (NET15)' : 'Công nợ 15 ngày (NET15)'}</option>
                                        <option value="NET30">{isEn ? 'Net 30 Days (NET30)' : 'Công nợ 30 ngày (NET30)'}</option>
                                        <option value="NET45">{isEn ? 'Net 45 Days (NET45)' : 'Công nợ 45 ngày (NET45)'}</option>
                                        <option value="NET60">{isEn ? 'Net 60 Days (NET60)' : 'Công nợ 60 ngày (NET60)'}</option>
                                        <option value="ADVANCE_50">{isEn ? '50% Advance - Balance after delivery' : 'Tạm ứng 50% - Còn lại sau giao hàng'}</option>
                                        <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                                <span className="font-semibold text-slate-700 block">
                                    {isEn ? 'Beneficiary Bank Account' : 'Tài khoản ngân hàng thụ hưởng'}
                                </span>
                                
                                <div>
                                    <label className="block text-[11px] text-slate-600 mb-0.5">
                                        {isEn ? 'Bank Name & Branch' : 'Tên Ngân Hàng & Chi Nhánh'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isEn ? 'e.g. Vietcombank - Ky Dong Branch' : 'Vd: Vietcombank - CN Kỳ Đồng'}
                                        value={quickSupplierForm.bankName}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankName: e.target.value }))}
                                        className="w-full rounded border border-slate-300 p-1.5 text-xs bg-white focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Number' : 'Số Tài Khoản (STK)'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0071001234567"
                                            value={quickSupplierForm.bankAccountNo}
                                            onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono font-bold bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Holder Name' : 'Tên Chủ Tài Khoản'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. ABC CO., LTD"
                                            value={quickSupplierForm.bankAccountName}
                                            onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-1.5 text-xs font-medium uppercase bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Phone Number' : 'Số điện thoại'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 028 3822 xxxx"
                                        value={quickSupplierForm.phone}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Contact Email' : 'Email liên hệ'}
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="e.g. accounting@supplier.com"
                                        value={quickSupplierForm.email}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAddSupplierModal(false)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    {isEn ? 'Cancel' : 'Hủy'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingQuickSupplier}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526] transition disabled:opacity-50"
                                >
                                    {savingQuickSupplier && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isEn ? 'Save Supplier' : 'Lưu Nhà Cung Cấp'}
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
            {dialog}
        </div>
    )
}
