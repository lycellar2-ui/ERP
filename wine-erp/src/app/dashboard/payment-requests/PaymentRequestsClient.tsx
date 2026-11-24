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
import {
    Badge, Button, Card, EmptyState, Field, Input, Modal,
    PageContainer, PageHeader, SearchInput, Select, StatCard, StatGrid,
    StatusBadge, StatusTabs, Table, TableMessageRow, TBody, Td, Textarea, Th, THead, Toolbar, Tr,
    useConfirmDialog,
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'
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

const STATUS_LABEL_MAP: Record<string, { label: string; labelEn: string }> = {
    DRAFT: { label: 'Bản Nháp', labelEn: 'Draft' },
    SUBMITTED: { label: 'Chờ TP Duyệt (C1)', labelEn: 'Pending Manager (L1)' },
    REVIEWING_L1: { label: 'Chờ Kế Toán (C2)', labelEn: 'Pending Accounting (L2)' },
    REVIEWING_L2: { label: 'Chờ CEO (C3)', labelEn: 'Pending CEO (L3)' },
    APPROVED: { label: 'Đã Duyệt (Chờ Chi)', labelEn: 'Approved (Pending Payout)' },
    PAID: { label: 'Đã Giải Ngân', labelEn: 'Disbursed' },
    REJECTED: { label: 'Bị Từ Chối', labelEn: 'Rejected' },
    CANCELLED: { label: 'Đã Hủy', labelEn: 'Cancelled' },
}

const PR_TONE_OVERRIDES: Record<string, Tone> = {
    REVIEWING_L2: 'brand',
    APPROVED: 'brand',
}

const GROUP_LABELS: Record<string, { vi: string; en: string }> = {
    COST_OF_SALES: { vi: 'Tiền Hàng & Nhập Khẩu', en: 'Cost of Sales & Imports' },
    OPERATING: { vi: 'Vận Hành & Kho Bãi', en: 'Operations & Warehousing' },
    MARKETING: { vi: 'Tiếp Thị & Bán Hàng', en: 'Marketing & Sales' },
    ADMINISTRATIVE: { vi: 'Hành Chính & Nhân Sự', en: 'Admin & HR' },
    CAPEX: { vi: 'Đầu Tư Tài Sản (CAPEX)', en: 'Capital Expenditure (CAPEX)' },
}

const SUPPLIER_TYPE_MAP: Record<string, { label: string; labelEn: string; tone: Tone }> = {
    DISTRIBUTOR: { label: 'Nhà Phân Phối', labelEn: 'Distributor', tone: 'info' },
    WINERY: { label: 'Hãng Rượu (Winery)', labelEn: 'Winery', tone: 'warning' },
    FORWARDER: { label: 'Forwarder / Vận Tải', labelEn: 'Forwarder / Freight', tone: 'success' },
    LOGISTICS: { label: 'Kho Bãi Logistics', labelEn: 'Logistics', tone: 'brand' },
    LOCAL_VENDOR: { label: 'NCC Dịch Vụ', labelEn: 'Local Vendor', tone: 'neutral' },
    OTHER: { label: 'Khác', labelEn: 'Other', tone: 'neutral' },
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
    const status = STATUS_LABEL_MAP[item.status] || STATUS_LABEL_MAP.DRAFT
    const catObj = CATEGORY_LABEL_MAP[item.category]

    return (
        <Card className="p-3.5 space-y-2.5 transition-colors hover:border-lys-border-strong">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => onOpenDetail(item.id)}
                    className="font-mono font-bold text-sm text-lys-teal-strong hover:underline cursor-pointer"
                >
                    {item.requestNo}
                </button>
                <StatusBadge
                    status={item.status}
                    label={isEn ? status.labelEn : status.label}
                    toneOverrides={PR_TONE_OVERRIDES}
                />
            </div>

            <div>
                <p className="font-semibold text-lys-primary text-xs line-clamp-2" title={item.title}>
                    {item.title}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-lys-muted">
                    <span className="font-medium text-lys-secondary">{item.beneficiaryName}</span>
                    {item.beneficiaryBank && (
                        <>
                            <span>·</span>
                            <span className="truncate max-w-[160px] text-lys-dim">{item.beneficiaryBank}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <Badge tone="neutral">
                    {catObj ? (isEn ? catObj.en : catObj.vi) : item.category}
                </Badge>
                <span className="text-lys-muted">
                    {isEn ? `${item.itemCount} items · ${item.attachmentCount} docs` : `${item.itemCount} khoản · ${item.attachmentCount} chứng từ`}
                </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border">
                <div>
                    <span className="text-[11px] text-lys-muted block">{isEn ? 'Requested Amount' : 'Số tiền đề nghị'}</span>
                    <span className="type-number font-bold text-lys-primary text-sm">
                        {formatVND(item.totalAmountVND)}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[11px] text-lys-muted block">{isEn ? 'Due Date' : 'Hạn TT'}</span>
                    <span className="text-xs text-lys-secondary font-medium">
                        {item.dueDate ? formatDate(item.dueDate) : '—'}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border text-[11px]">
                <div className="text-lys-muted truncate max-w-[45%]">
                    {item.creatorName} {item.departmentName ? `· ${item.departmentName}` : ''}
                </div>
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenDetail(item.id)}
                    >
                        <Eye className="h-3.5 w-3.5" aria-hidden /> {isEn ? 'Details' : 'Chi tiết'}
                    </Button>
                    <Button
                        size="icon-sm"
                        variant="secondary"
                        onClick={() => onPrint(item.id)}
                        aria-label={isEn ? 'Print request' : 'In đề nghị'}
                        title={isEn ? 'Print request' : 'In đề nghị'}
                    >
                        <Printer className="h-3.5 w-3.5 text-lys-teal-strong" aria-hidden />
                    </Button>
                    {['DRAFT', 'REJECTED'].includes(item.status) && (
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => onDelete(item.id, item.requestNo)}
                            aria-label={isEn ? 'Delete request' : 'Xóa phiếu'}
                            title={isEn ? 'Delete request' : 'Xóa phiếu'}
                            className="text-lys-muted hover:text-tone-danger-fg hover:bg-tone-danger-bg"
                        >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                    )}
                </div>
            </div>
        </Card>
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
        <Card className="p-3.5 space-y-2.5 transition-colors hover:border-lys-border-strong">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-lys-primary">{supplier.code}</span>
                    <Badge tone={typeBadge.tone}>
                        {isEn ? typeBadge.labelEn : typeBadge.label}
                    </Badge>
                </div>
                {supplier.paymentTerm && (
                    <Badge tone="warning">{supplier.paymentTerm}</Badge>
                )}
            </div>

            <div>
                <p className="font-bold text-lys-primary text-xs" title={supplier.name}>
                    {supplier.name}
                </p>
                {supplier.taxId && (
                    <p className="text-[11px] text-lys-muted font-mono mt-0.5">
                        {isEn ? 'Tax ID' : 'MST'}: {supplier.taxId}
                    </p>
                )}
            </div>

            <div className="rounded-md bg-lys-bg border border-lys-border p-2 text-[11px] text-lys-secondary space-y-0.5">
                {bankParsed ? (
                    <>
                        <div className="font-mono font-bold text-lys-primary">
                            {isEn ? 'Acc' : 'STK'}: {bankParsed.stk || '—'}
                        </div>
                        <div className="text-[11px] text-lys-muted truncate">
                            {bankParsed.bankName} {bankParsed.accountName ? `(${bankParsed.accountName})` : ''}
                        </div>
                    </>
                ) : supplier.bankAccountInfo ? (
                    <div className="font-mono text-[11px] text-lys-secondary line-clamp-2">
                        {supplier.bankAccountInfo}
                    </div>
                ) : (
                    <span className="text-lys-dim italic">{isEn ? 'No bank account info' : 'Chưa có thông tin tài khoản ngân hàng'}</span>
                )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border text-[11px]">
                <div className="flex items-center gap-1.5">
                    <Badge tone="neutral">{supplier.openPOCount} PO</Badge>
                    <Badge tone="info">{supplier.unpaidInvoiceCount} {isEn ? 'Inv' : 'HĐ'}</Badge>
                </div>
                <div className="text-right">
                    <span className="text-[11px] text-lys-muted block">{isEn ? 'Total Paid' : 'Đã thanh toán'}</span>
                    <span className="type-number font-bold text-xs text-lys-teal-strong">
                        {supplier.totalPaidVND > 0 ? formatVND(supplier.totalPaidVND) : '0 ₫'}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-lys-border">
                <Button size="sm" variant="secondary" onClick={() => onEditPayment(supplier)}>
                    <Edit3 className="h-3 w-3" aria-hidden /> {isEn ? 'Edit Bank' : 'Sửa TK'}
                </Button>
                <Button size="sm" variant="primary" onClick={() => onCreatePayment(supplier.id)}>
                    <Plus className="h-3 w-3" aria-hidden /> {isEn ? 'New Request' : 'Lập Đề Nghị'}
                </Button>
            </div>
        </Card>
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
        <PageContainer>
            <PageHeader
                description={
                    isEn
                        ? 'Multi-level threshold approval workflow, Supplier master data, Cloudflare R2 document storage & expense budget control'
                        : 'Hệ thống phê duyệt đa cấp theo hạn mức, quản lý master data Nhà cung cấp, lưu trữ chứng từ Cloudflare R2 và kiểm soát ngân sách chi phí'
                }
                actions={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowBlankPrint(true)}
                            title={isEn ? 'Print blank payment request form for wet signature' : 'In mẫu phôi tờ trình / đề nghị thanh toán trắng để ký tay'}
                        >
                            <Printer className="h-4 w-4 text-lys-teal-strong" aria-hidden />
                            {isEn ? 'Print Blank Form' : 'In Phôi Mẫu Trắng'}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                                setDrawerInitialSupplierId(undefined)
                                setShowCreateDrawer(true)
                            }}
                        >
                            <Plus className="h-4 w-4" aria-hidden />
                            {isEn ? 'New Payment Request' : 'Lập Đề Nghị Mới'}
                        </Button>
                    </>
                }
            />

            <StatusTabs
                value={activeTab}
                onChange={setActiveTab}
                items={[
                    { value: 'REQUESTS', label: isEn ? 'Payment Requests' : 'Phiếu Đề Nghị Thanh Toán', count: stats.totalCount, icon: CreditCard },
                    { value: 'SUPPLIERS', label: isEn ? 'Supplier Directory' : 'Danh Mục Nhà Cung Cấp', count: suppliersList.length, icon: Building2 },
                    { value: 'CATEGORIES', label: isEn ? 'Expense Categories' : 'Cấu Hình Hạng Mục Chi Phí', count: categories.length, icon: FolderKanban },
                    { value: 'BUDGETS', label: isEn ? 'Budget Management & Tracking' : 'Quản Lý & Theo Dõi Ngân Sách', icon: PieChart },
                ]}
            />

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 1: PHIẾU ĐỀ NGHỊ THANH TOÁN                        */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'REQUESTS' && (
                <div className="space-y-4">
                    <StatGrid cols={4}>
                        <StatCard
                            label={isEn ? 'Total Requests (YTD)' : 'Tổng Đề Nghị Năm Nay'}
                            value={stats.totalCount}
                            sub={isEn ? 'All payment requests created' : 'Tất cả các khoản chi đã khởi tạo'}
                            icon={FileText}
                            tone="neutral"
                        />
                        <StatCard
                            label={isEn ? 'Pending Approval' : 'Đang Chờ Duyệt'}
                            value={stats.pendingCount}
                            sub={formatVND(stats.totalPendingVND)}
                            icon={Clock}
                            tone="warning"
                        />
                        <StatCard
                            label={isEn ? 'Approved (Pending Payout)' : 'Đã Duyệt (Chờ Chi)'}
                            value={stats.approvedCount}
                            sub={isEn ? 'Ready for Accounting UNC payout' : 'Sẵn sàng để Kế toán lập UNC'}
                            icon={CheckCircle2}
                            tone="brand"
                        />
                        <StatCard
                            label={isEn ? 'Disbursed' : 'Đã Giải Ngân'}
                            value={stats.paidCount}
                            sub={formatVND(stats.totalPaidVND)}
                            icon={DollarSign}
                            tone="success"
                        />
                    </StatGrid>

                    {/* Filter and Search Bar */}
                    <Card className="p-3">
                        <Toolbar
                            left={
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <SearchInput
                                        className="w-full sm:flex-1 sm:max-w-sm"
                                        placeholder={isEn ? 'Search request no, beneficiary, description...' : 'Tìm mã phiếu, người nhận, nội dung...'}
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && refreshRequests()}
                                    />

                                    <Select
                                        value={statusFilter}
                                        onChange={e => handleFilterChange(e.target.value, undefined)}
                                        className="sm:w-52"
                                    >
                                        <option value="ALL">{isEn ? 'All Statuses' : 'Tất cả trạng thái'}</option>
                                        <option value="SUBMITTED">{isEn ? 'Pending Manager (L1)' : 'Chờ Trưởng phòng (Cấp 1)'}</option>
                                        <option value="REVIEWING_L1">{isEn ? 'Pending Accounting (L2)' : 'Chờ Kế toán (Cấp 2)'}</option>
                                        <option value="REVIEWING_L2">{isEn ? 'Pending CEO (L3)' : 'Chờ CEO (Cấp 3)'}</option>
                                        <option value="APPROVED">{isEn ? 'Approved (Pending Payout)' : 'Đã duyệt (Chờ chi)'}</option>
                                        <option value="PAID">{isEn ? 'Disbursed' : 'Đã giải ngân'}</option>
                                        <option value="REJECTED">{isEn ? 'Rejected' : 'Bị từ chối'}</option>
                                    </Select>

                                    <Select
                                        value={categoryFilter}
                                        onChange={e => handleFilterChange(undefined, e.target.value)}
                                        className="sm:w-52"
                                    >
                                        <option value="ALL">{isEn ? 'All Expense Groups' : 'Tất cả nhóm chi phí'}</option>
                                        <option value="VENDOR_PAYMENT">{isEn ? 'Vendor Payment' : 'Tiền hàng Nhà cung cấp'}</option>
                                        <option value="IMPORT_TAX_LOGISTICS">{isEn ? 'Import Tax & Logistics' : 'Thuế NK & Logistics'}</option>
                                        <option value="OPERATIONS_OFFICE">{isEn ? 'Operations & Warehouse' : 'Vận hành & Kho bãi'}</option>
                                        <option value="TASTING_MARKETING">{isEn ? 'Tasting & Marketing' : 'Tasting & Tiếp khách'}</option>
                                        <option value="EMPLOYEE_ADVANCE">{isEn ? 'Employee Advance' : 'Tạm ứng / Hoàn ứng'}</option>
                                        <option value="OTHER">{isEn ? 'Other Expenses' : 'Chi phí khác'}</option>
                                    </Select>
                                </div>
                            }
                            right={
                                <Button variant="secondary" size="sm" onClick={refreshRequests} disabled={isPending}>
                                    <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} aria-hidden />
                                    {isEn ? 'Refresh' : 'Làm mới'}
                                </Button>
                            }
                        />
                    </Card>

                    {/* Table of Requests (Desktop) */}
                    <div className="hidden md:block">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{isEn ? 'Request No' : 'Mã Phiếu'}</Th>
                                    <Th>{isEn ? 'Description' : 'Nội Dung Đề Nghị'}</Th>
                                    <Th>{isEn ? 'Expense Group' : 'Nhóm Chi Phí'}</Th>
                                    <Th>{isEn ? 'Beneficiary' : 'Đơn Vị Thụ Hưởng'}</Th>
                                    <Th align="right">{isEn ? 'Amount (VND)' : 'Số Tiền (VNĐ)'}</Th>
                                    <Th>{isEn ? 'Requester' : 'Người Tạo'}</Th>
                                    <Th>{isEn ? 'Status' : 'Trạng Thái'}</Th>
                                    <Th>{isEn ? 'Due Date' : 'Hạn TT'}</Th>
                                    <Th align="center">{isEn ? 'Actions' : 'Thao Tác'}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {requests.length > 0 ? (
                                    requests.map(r => {
                                        const status = STATUS_LABEL_MAP[r.status] || STATUS_LABEL_MAP.DRAFT
                                        const catObj = CATEGORY_LABEL_MAP[r.category]
                                        return (
                                            <Tr key={r.id}>
                                                <Td className="font-mono font-bold">
                                                    <button
                                                        type="button"
                                                        onClick={() => openDetail(r.id)}
                                                        className="text-lys-teal-strong hover:underline cursor-pointer"
                                                    >
                                                        {r.requestNo}
                                                    </button>
                                                </Td>
                                                <Td className="max-w-xs">
                                                    <div className="font-semibold text-lys-primary line-clamp-1" title={r.title}>
                                                        {r.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-lys-muted">
                                                        <span>{isEn ? `${r.itemCount} items` : `${r.itemCount} khoản mục`}</span>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-0.5">
                                                            <FileText className="h-3 w-3" aria-hidden /> {isEn ? `${r.attachmentCount} docs` : `${r.attachmentCount} chứng từ`}
                                                        </span>
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <Badge tone="neutral">
                                                        {catObj ? (isEn ? catObj.en : catObj.vi) : r.category}
                                                    </Badge>
                                                </Td>
                                                <Td>
                                                    <div className="font-medium text-lys-primary">{r.beneficiaryName}</div>
                                                    {r.beneficiaryBank && (
                                                        <div className="text-[11px] text-lys-muted truncate max-w-[160px]">
                                                            {r.beneficiaryBank}
                                                        </div>
                                                    )}
                                                </Td>
                                                <Td align="right" className="font-bold text-lys-primary text-sm">
                                                    {formatVND(r.totalAmountVND)}
                                                </Td>
                                                <Td>
                                                    <div className="font-medium text-lys-secondary">{r.creatorName}</div>
                                                    <div className="text-[11px] text-lys-muted">{r.departmentName || 'N/A'}</div>
                                                </Td>
                                                <Td>
                                                    <StatusBadge
                                                        status={r.status}
                                                        label={isEn ? status.labelEn : status.label}
                                                        toneOverrides={PR_TONE_OVERRIDES}
                                                    />
                                                </Td>
                                                <Td className="text-lys-muted">
                                                    {r.dueDate ? formatDate(r.dueDate) : '—'}
                                                </Td>
                                                <Td align="center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() => openDetail(r.id)}
                                                            aria-label={isEn ? 'View details' : 'Xem chi tiết'}
                                                            title={isEn ? 'View details & Scanned docs' : 'Xem chi tiết & Chứng từ scan'}
                                                            className="text-lys-secondary hover:text-lys-teal-strong hover:bg-lys-teal-soft"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" aria-hidden />
                                                        </Button>
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={async () => {
                                                                setLoadingDetail(true)
                                                                try {
                                                                    const d = await getPaymentRequestDetail(r.id)
                                                                    if (d) setPrintDetail(d)
                                                                } finally {
                                                                    setLoadingDetail(false)
                                                                }
                                                            }}
                                                            aria-label={isEn ? 'Print Payment Request Form' : 'In Tờ trình'}
                                                            title={isEn ? 'Print Payment Request Form' : 'In Tờ trình / Giấy đề nghị thanh toán'}
                                                            className="text-lys-teal-strong hover:bg-lys-teal-soft"
                                                        >
                                                            <Printer className="h-3.5 w-3.5" aria-hidden />
                                                        </Button>
                                                        {['DRAFT', 'REJECTED'].includes(r.status) && (
                                                            <Button
                                                                size="icon-sm"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteRequest(r.id, r.requestNo)}
                                                                aria-label={isEn ? 'Delete request' : 'Xóa phiếu'}
                                                                title={isEn ? 'Delete request' : 'Xóa phiếu'}
                                                                className="text-lys-muted hover:text-tone-danger-fg hover:bg-tone-danger-bg"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Td>
                                            </Tr>
                                        )
                                    })
                                ) : (
                                    <TableMessageRow colSpan={9}>
                                        <EmptyState
                                            icon={CreditCard}
                                            title={isEn ? 'No payment requests found' : 'Không có đề nghị thanh toán nào'}
                                            description={isEn ? 'Adjust filters or create a new payment request.' : 'Thử thay đổi bộ lọc hoặc lập đề nghị thanh toán mới.'}
                                        />
                                    </TableMessageRow>
                                )}
                            </TBody>
                        </Table>
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
                            <Card>
                                <EmptyState
                                    icon={CreditCard}
                                    title={isEn ? 'No payment requests match your filters' : 'Không có đề nghị thanh toán nào phù hợp với bộ lọc'}
                                />
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 4: DANH MỤC NHÀ CUNG CẤP (MASTER DATA)             */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'SUPPLIERS' && (
                <div className="space-y-4">
                    <StatGrid cols={4}>
                        <StatCard
                            label={isEn ? 'Total Suppliers' : 'Tổng Nhà Cung Cấp'}
                            value={totalSuppliers}
                            sub={isEn ? 'Active in system' : 'Đang hoạt động trong hệ thống'}
                            icon={Building2}
                            tone="neutral"
                        />
                        <StatCard
                            label={isEn ? 'Cumulative Paid' : 'Lũy Kế Đã Thanh Toán'}
                            value={formatVND(totalPaidToSuppliersVND)}
                            sub={isEn ? 'Total disbursed to suppliers' : 'Tổng tiền đã giải ngân cho NCC'}
                            icon={DollarSign}
                            tone="success"
                        />
                        <StatCard
                            label={isEn ? 'Open POs' : 'Đơn Hàng PO Mở'}
                            value={totalOpenPOs}
                            sub={isEn ? 'Pending or receiving purchase orders' : 'Đơn hàng đang chờ hoặc đang nhận'}
                            icon={Package}
                            tone="warning"
                        />
                        <StatCard
                            label={isEn ? 'Unpaid AP Invoices' : 'Hóa Đơn AP Chưa Tất Toán'}
                            value={totalUnpaidInvoices}
                            sub={isEn ? 'Payable invoices awaiting settlement' : 'Hóa đơn công nợ cần thanh toán'}
                            icon={Receipt}
                            tone="info"
                        />
                    </StatGrid>

                    {/* Filter and Action Bar */}
                    <Card className="p-3">
                        <Toolbar
                            left={
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <SearchInput
                                        className="w-full sm:flex-1 sm:max-w-sm"
                                        placeholder={isEn ? 'Search by supplier name, code, Tax ID or bank account...' : 'Tìm theo tên NCC, mã NCC, MST hoặc số tài khoản...'}
                                        value={supplierSearchText}
                                        onChange={e => setSupplierSearchText(e.target.value)}
                                    />
                                    <Select
                                        value={supplierTypeFilter}
                                        onChange={e => setSupplierTypeFilter(e.target.value)}
                                        className="sm:w-52"
                                    >
                                        <option value="ALL">{isEn ? 'All Supplier Types' : 'Tất cả phân loại NCC'}</option>
                                        <option value="DISTRIBUTOR">{isEn ? 'Distributor' : 'Nhà phân phối (Distributor)'}</option>
                                        <option value="WINERY">{isEn ? 'Winery' : 'Hãng rượu (Winery)'}</option>
                                        <option value="FORWARDER">{isEn ? 'Forwarder / Freight' : 'Forwarder / Cước tàu'}</option>
                                        <option value="LOGISTICS">{isEn ? 'Warehousing & Logistics' : 'Kho bãi & Vận tải'}</option>
                                        <option value="LOCAL_VENDOR">{isEn ? 'Local Service Vendor' : 'NCC Dịch vụ nội địa'}</option>
                                        <option value="OTHER">{isEn ? 'Other' : 'Khác'}</option>
                                    </Select>
                                </div>
                            }
                            right={
                                <Button variant="primary" size="sm" onClick={() => setShowQuickAddSupplierModal(true)}>
                                    <Plus className="h-4 w-4" aria-hidden /> {isEn ? 'Add New Supplier' : 'Thêm Nhà Cung Cấp Mới'}
                                </Button>
                            }
                        />
                    </Card>

                    {/* Master Data Table (Desktop) */}
                    <div className="hidden md:block">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{isEn ? 'Code & Type' : 'Mã & Loại NCC'}</Th>
                                    <Th>{isEn ? 'Supplier Name' : 'Tên Nhà Cung Cấp'}</Th>
                                    <Th>{isEn ? 'Tax ID' : 'Mã Số Thuế'}</Th>
                                    <Th>{isEn ? 'Terms' : 'Điều Khoản TT'}</Th>
                                    <Th>{isEn ? 'Beneficiary Bank Account' : 'Tài Khoản Ngân Hàng Thụ Hưởng'}</Th>
                                    <Th align="center">{isEn ? 'Transactions' : 'Giao Dịch'}</Th>
                                    <Th align="right">{isEn ? 'Cumulative Paid (VND)' : 'Lũy Kế Đã Chi (VNĐ)'}</Th>
                                    <Th align="center">{isEn ? 'Actions' : 'Thao Tác'}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {filteredSuppliers.length > 0 ? (
                                    filteredSuppliers.map(s => {
                                        const typeBadge = SUPPLIER_TYPE_MAP[s.type] || SUPPLIER_TYPE_MAP.OTHER
                                        const bankParsed = parseBankInfo(s.bankAccountInfo)

                                        return (
                                            <Tr key={s.id}>
                                                <Td>
                                                    <div className="font-mono font-bold text-lys-primary">{s.code}</div>
                                                    <Badge tone={typeBadge.tone} className="mt-1">
                                                        {isEn ? typeBadge.labelEn : typeBadge.label}
                                                    </Badge>
                                                </Td>
                                                <Td className="max-w-xs">
                                                    <div className="font-bold text-lys-primary line-clamp-1" title={s.name}>
                                                        {s.name}
                                                    </div>
                                                    {s.country && (
                                                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-lys-muted">
                                                            <Globe className="h-3 w-3" aria-hidden /> {s.country}
                                                        </div>
                                                    )}
                                                </Td>
                                                <Td className="font-mono text-lys-secondary font-medium">
                                                    {s.taxId ? (
                                                        <Badge tone="neutral">{s.taxId}</Badge>
                                                    ) : (
                                                        <span className="text-lys-dim italic">{isEn ? 'No Tax ID' : 'Chưa có MST'}</span>
                                                    )}
                                                </Td>
                                                <Td className="font-semibold">
                                                    {s.paymentTerm ? (
                                                        <Badge tone="warning">{s.paymentTerm}</Badge>
                                                    ) : (
                                                        <span className="text-lys-muted">NET30</span>
                                                    )}
                                                </Td>
                                                <Td className="max-w-sm">
                                                    {bankParsed ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-mono font-bold text-lys-primary">
                                                                {isEn ? 'Acc' : 'STK'}: {bankParsed.stk || '—'}
                                                            </div>
                                                            <div className="text-[11px] text-lys-muted truncate">
                                                                {bankParsed.bankName} {bankParsed.accountName ? `(${bankParsed.accountName})` : ''}
                                                            </div>
                                                        </div>
                                                    ) : s.bankAccountInfo ? (
                                                        <div className="font-mono text-[11px] text-lys-secondary line-clamp-2">
                                                            {s.bankAccountInfo}
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditSupplier(s)}
                                                            className="text-[11px] text-lys-teal-strong hover:underline font-medium flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Plus className="h-3 w-3" aria-hidden /> {isEn ? 'Add bank account' : 'Thêm TK ngân hàng'}
                                                        </button>
                                                    )}
                                                </Td>
                                                <Td align="center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Badge tone="neutral" title={isEn ? 'Open PO count' : 'Số lượng đơn hàng PO'}>
                                                            {s.openPOCount} PO
                                                        </Badge>
                                                        <Badge tone="info" title={isEn ? 'Unpaid invoice count' : 'Số lượng hóa đơn chưa thanh toán'}>
                                                            {s.unpaidInvoiceCount} {isEn ? 'Inv' : 'HĐ'}
                                                        </Badge>
                                                    </div>
                                                </Td>
                                                <Td align="right" className="font-bold text-sm">
                                                    {s.totalPaidVND > 0 ? (
                                                        <span className="text-lys-teal-strong">{formatVND(s.totalPaidVND)}</span>
                                                    ) : (
                                                        <span className="text-lys-dim">0 ₫</span>
                                                    )}
                                                </Td>
                                                <Td align="center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="primary"
                                                            onClick={() => handleCreatePaymentForSupplier(s.id)}
                                                            title={isEn ? 'Create Payment Request for this Supplier' : 'Lập Đề Nghị Thanh Toán cho Nhà Cung Cấp này'}
                                                        >
                                                            <Plus className="h-3 w-3" aria-hidden /> {isEn ? 'New Request' : 'Lập Đề Nghị'}
                                                        </Button>
                                                        <Button
                                                            size="icon-sm"
                                                            variant="secondary"
                                                            onClick={() => handleOpenEditSupplier(s)}
                                                            aria-label={isEn ? 'Edit bank & payment info' : 'Chỉnh sửa thông tin ngân hàng & thanh toán'}
                                                            title={isEn ? 'Edit bank & payment info' : 'Chỉnh sửa thông tin ngân hàng & thanh toán'}
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" aria-hidden />
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        )
                                    })
                                ) : (
                                    <TableMessageRow colSpan={8}>
                                        <EmptyState
                                            icon={Building2}
                                            title={isEn ? 'No matching Suppliers found' : 'Không tìm thấy Nhà Cung Cấp nào phù hợp'}
                                        />
                                    </TableMessageRow>
                                )}
                            </TBody>
                        </Table>
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
                            <Card>
                                <EmptyState
                                    icon={Building2}
                                    title={isEn ? 'No matching Suppliers found' : 'Không tìm thấy Nhà Cung Cấp nào phù hợp'}
                                />
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 2: CẤU HÌNH HẠNG MỤC CHI PHÍ                       */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'CATEGORIES' && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-semibold text-lys-muted">{isEn ? 'Group:' : 'Nhóm:'}</span>
                            {['ALL', 'COST_OF_SALES', 'OPERATING', 'MARKETING', 'ADMINISTRATIVE', 'CAPEX'].map(grp => {
                                const grpObj = GROUP_LABELS[grp]
                                return (
                                    <button
                                        key={grp}
                                        type="button"
                                        onClick={() => setSelectedGroupFilter(grp)}
                                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                                            selectedGroupFilter === grp
                                                ? 'bg-lys-teal-strong text-white shadow-xs'
                                                : 'bg-white border border-lys-border text-lys-secondary hover:bg-lys-subtle'
                                        }`}
                                    >
                                        {grp === 'ALL' ? (isEn ? 'All' : 'Tất Cả') : grpObj ? (isEn ? grpObj.en : grpObj.vi) : grp}
                                    </button>
                                )
                            })}
                        </div>

                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setCategoryModalData({
                                open: true,
                                isEdit: false,
                                code: '',
                                name: '',
                                group: 'OPERATING',
                                defaultAccount: '642',
                                description: '',
                            })}
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden /> {isEn ? 'Add Category' : 'Thêm Hạng Mục'}
                        </Button>
                    </div>

                    {/* Categories Table (Desktop) */}
                    <div className="hidden md:block">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{isEn ? 'Category Code' : 'Mã Hạng Mục'}</Th>
                                    <Th>{isEn ? 'Category Name' : 'Tên Hạng Mục Chi Phí'}</Th>
                                    <Th>{isEn ? 'Expense Group' : 'Nhóm Chi Phí'}</Th>
                                    <Th>{isEn ? 'Default VAS Account' : 'Tài Khoản VAS Mặc Định'}</Th>
                                    <Th>{isEn ? 'Description' : 'Diễn Giải Nghiệp Vụ'}</Th>
                                    <Th align="center">{isEn ? 'Status' : 'Trạng Thái'}</Th>
                                    <Th align="center">{isEn ? 'Actions' : 'Thao Tác'}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {categories
                                    .filter(c => selectedGroupFilter === 'ALL' || c.group === selectedGroupFilter)
                                    .map(cat => {
                                        const grpObj = GROUP_LABELS[cat.group]
                                        return (
                                            <Tr key={cat.id}>
                                                <Td className="font-mono font-bold text-lys-primary">
                                                    {cat.code}
                                                </Td>
                                                <Td className="font-semibold text-lys-primary">
                                                    {cat.name}
                                                </Td>
                                                <Td>
                                                    <Badge tone="neutral">
                                                        {grpObj ? (isEn ? grpObj.en : grpObj.vi) : cat.group}
                                                    </Badge>
                                                </Td>
                                                <Td className="font-mono font-medium text-lys-secondary">
                                                    {cat.defaultAccount || '—'}
                                                </Td>
                                                <Td className="text-lys-muted max-w-xs truncate" title={cat.description || ''}>
                                                    {cat.description || '—'}
                                                </Td>
                                                <Td align="center">
                                                    <Badge tone={cat.isActive ? 'success' : 'neutral'}>
                                                        {cat.isActive ? (isEn ? 'Active' : 'Đang Sử Dụng') : (isEn ? 'Hidden' : 'Tạm Ẩn')}
                                                    </Badge>
                                                </Td>
                                                <Td align="center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            aria-label={isEn ? 'Edit category' : 'Sửa hạng mục'}
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
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" aria-hidden />
                                                        </Button>
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            aria-label={isEn ? 'Delete category' : 'Xóa hạng mục'}
                                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                            className="text-lys-muted hover:text-tone-danger-fg hover:bg-tone-danger-bg"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                        </Button>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        )
                                    })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards for Categories */}
                    <div className="block md:hidden space-y-3">
                        {categories
                            .filter(c => selectedGroupFilter === 'ALL' || c.group === selectedGroupFilter)
                            .map(cat => {
                                const grpObj = GROUP_LABELS[cat.group]
                                return (
                                    <Card key={cat.id} className="p-3.5 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono font-bold text-xs text-lys-primary">{cat.code}</span>
                                            <Badge tone={cat.isActive ? 'success' : 'neutral'}>
                                                {cat.isActive ? (isEn ? 'Active' : 'Đang Sử Dụng') : (isEn ? 'Hidden' : 'Tạm Ẩn')}
                                            </Badge>
                                        </div>
                                        <p className="font-semibold text-xs text-lys-primary">{cat.name}</p>
                                        {cat.description && <p className="text-[11px] text-lys-muted line-clamp-2">{cat.description}</p>}
                                        <div className="flex items-center justify-between pt-2 border-t border-lys-border text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <Badge tone="neutral">
                                                    {grpObj ? (isEn ? grpObj.en : grpObj.vi) : cat.group}
                                                </Badge>
                                                <span className="font-mono text-lys-secondary">VAS: {cat.defaultAccount || '—'}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    aria-label={isEn ? 'Edit' : 'Sửa'}
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
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" aria-hidden />
                                                </Button>
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    aria-label={isEn ? 'Delete' : 'Xóa'}
                                                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                    className="text-lys-muted hover:text-tone-danger-fg hover:bg-tone-danger-bg"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════ */}
            {/* TAB 3: QUẢN LÝ & THEO DÕI NGÂN SÁCH                    */}
            {/* ═══════════════════════════════════════════════════════ */}
            {activeTab === 'BUDGETS' && (
                <div className="space-y-4">
                    <Card className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="type-section-title text-lys-primary">
                                    {isEn ? '2026 Budget Utilization Progress' : 'Tiến Độ Tiêu Thụ Ngân Sách Năm 2026'}
                                </h3>
                                <p className="text-xs text-lys-muted">
                                    {isEn
                                        ? 'Compare actual disbursed & pending amounts against approved budget limits per category'
                                        : 'So sánh số tiền thực chi & chờ duyệt với định mức ngân sách của từng hạng mục'}
                                </p>
                            </div>
                            <span className="text-xs text-lys-muted">{isEn ? 'Currency: VND' : 'Đơn vị tính: VNĐ'}</span>
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block">
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>{isEn ? 'Expense Category' : 'Hạng Mục Chi Phí'}</Th>
                                        <Th>{isEn ? 'Group' : 'Nhóm'}</Th>
                                        <Th align="right">{isEn ? 'Approved Budget' : 'Ngân Sách Được Duyệt'}</Th>
                                        <Th align="right">{isEn ? 'Disbursed' : 'Đã Giải Ngân'}</Th>
                                        <Th align="right">{isEn ? 'Pending' : 'Đang Chờ Duyệt'}</Th>
                                        <Th align="right">{isEn ? 'Remaining' : 'Còn Lại'}</Th>
                                        <Th className="w-[22%]">{isEn ? 'Utilization' : 'Tiến Độ Tiêu Thụ'}</Th>
                                        <Th align="center">{isEn ? 'Actions' : 'Thao Tác'}</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {budgets.map(b => {
                                        const isOver = b.isOverBudget
                                        const isAlert = b.isAlert
                                        const barColor = isOver ? 'bg-tone-danger-fg' : isAlert ? 'bg-tone-warning-fg' : b.utilizationPct > 60 ? 'bg-tone-info-fg' : 'bg-tone-success-fg'
                                        const grpObj = GROUP_LABELS[b.categoryGroup]

                                        return (
                                            <Tr key={b.id}>
                                                <Td>
                                                    <div className="font-semibold text-lys-primary">{b.categoryName}</div>
                                                    <div className="font-mono text-[11px] text-lys-muted">{b.categoryCode}</div>
                                                </Td>
                                                <Td>
                                                    <Badge tone="neutral">
                                                        {grpObj ? (isEn ? grpObj.en : grpObj.vi) : b.categoryGroup}
                                                    </Badge>
                                                </Td>
                                                <Td align="right" className="font-bold text-lys-primary">
                                                    {b.allocatedAmount > 0 ? formatVND(b.allocatedAmount) : <span className="text-lys-dim italic font-normal">{isEn ? 'Not set' : 'Chưa cài đặt'}</span>}
                                                </Td>
                                                <Td align="right" className="text-tone-success-fg font-semibold">
                                                    {formatVND(b.spentAmount)}
                                                </Td>
                                                <Td align="right" className="text-tone-warning-fg">
                                                    {formatVND(b.pendingAmount)}
                                                </Td>
                                                <Td align="right" className="font-semibold">
                                                    <span className={b.remainingAmount < 0 ? 'text-tone-danger-fg' : 'text-lys-secondary'}>
                                                        {formatVND(b.remainingAmount)}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[11px]">
                                                            <span className="font-semibold text-lys-secondary type-number">{b.utilizationPct}%</span>
                                                            {isOver ? (
                                                                <span className="text-[11px] font-bold text-tone-danger-fg">{isEn ? 'OVER BUDGET' : 'VƯỢT HẠN MỨC'}</span>
                                                            ) : isAlert ? (
                                                                <span className="text-[11px] font-bold text-tone-warning-fg">{isEn ? 'NEAR LIMIT' : 'SẮP CHẠM NGƯỠNG'}</span>
                                                            ) : null}
                                                        </div>
                                                        <div className="h-2 w-full overflow-hidden rounded-full bg-lys-subtle">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                                style={{ width: `${Math.min(100, b.utilizationPct)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </Td>
                                                <Td align="center">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => setBudgetModalData({
                                                            open: true,
                                                            categoryId: b.categoryId,
                                                            categoryName: b.categoryName,
                                                            year: b.year,
                                                            allocatedAmount: b.allocatedAmount,
                                                            warningThresholdPct: b.warningThresholdPct,
                                                            notes: b.notes || '',
                                                        })}
                                                    >
                                                        {isEn ? 'Set Limit' : 'Cài Hạn Mức'}
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        )
                                    })}
                                </TBody>
                            </Table>
                        </div>

                        {/* Mobile Cards for Budgets */}
                        <div className="block md:hidden space-y-3">
                            {budgets.map(b => {
                                const isOver = b.isOverBudget
                                const isAlert = b.isAlert
                                const barColor = isOver ? 'bg-tone-danger-fg' : isAlert ? 'bg-tone-warning-fg' : b.utilizationPct > 60 ? 'bg-tone-info-fg' : 'bg-tone-success-fg'
                                const grpObj = GROUP_LABELS[b.categoryGroup]
                                return (
                                    <div key={b.id} className="rounded-lg border border-lys-border bg-lys-bg/50 p-3.5 space-y-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-xs text-lys-primary">{b.categoryName}</p>
                                                <span className="font-mono text-[11px] text-lys-muted">{b.categoryCode}</span>
                                            </div>
                                            <Badge tone="neutral">
                                                {grpObj ? (isEn ? grpObj.en : grpObj.vi) : b.categoryGroup}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div>
                                                <span className="text-lys-muted block">{isEn ? 'Approved Budget' : 'Ngân sách duyệt'}</span>
                                                <span className="type-number font-bold text-lys-primary">
                                                    {b.allocatedAmount > 0 ? formatVND(b.allocatedAmount) : (isEn ? 'Not set' : 'Chưa cài đặt')}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lys-muted block">{isEn ? 'Remaining' : 'Còn lại'}</span>
                                                <span className={`type-number font-bold ${b.remainingAmount < 0 ? 'text-tone-danger-fg' : 'text-lys-primary'}`}>
                                                    {formatVND(b.remainingAmount)}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-lys-muted block">{isEn ? 'Disbursed' : 'Đã giải ngân'}</span>
                                                <span className="type-number text-tone-success-fg font-semibold">{formatVND(b.spentAmount)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-lys-muted block">{isEn ? 'Pending' : 'Đang chờ duyệt'}</span>
                                                <span className="type-number text-tone-warning-fg">{formatVND(b.pendingAmount)}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1 pt-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="font-semibold text-lys-secondary type-number">{b.utilizationPct}%</span>
                                                {isOver ? (
                                                    <span className="text-[11px] font-bold text-tone-danger-fg">{isEn ? 'OVER BUDGET' : 'VƯỢT HẠN MỨC'}</span>
                                                ) : isAlert ? (
                                                    <span className="text-[11px] font-bold text-tone-warning-fg">{isEn ? 'NEAR LIMIT' : 'SẮP CHẠM NGƯỠNG'}</span>
                                                ) : null}
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-lys-subtle">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                                    style={{ width: `${Math.min(100, b.utilizationPct)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-1">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setBudgetModalData({
                                                    open: true,
                                                    categoryId: b.categoryId,
                                                    categoryName: b.categoryName,
                                                    year: b.year,
                                                    allocatedAmount: b.allocatedAmount,
                                                    warningThresholdPct: b.warningThresholdPct,
                                                    notes: b.notes || '',
                                                })}
                                            >
                                                {isEn ? 'Set Limit' : 'Cài Hạn Mức'}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </Card>
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
            <Modal
                open={categoryModalData.open}
                onClose={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                size="lg"
                title={
                    categoryModalData.isEdit
                        ? (isEn ? 'Edit Expense Category' : 'Chỉnh Sửa Hạng Mục Chi Phí')
                        : (isEn ? 'Add New Expense Category' : 'Thêm Hạng Mục Chi Phí Mới')
                }
                footer={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setCategoryModalData(prev => ({ ...prev, open: false }))}
                        >
                            {isEn ? 'Cancel' : 'Hủy'}
                        </Button>
                        <Button type="submit" form="pr-category-form" variant="primary" size="sm">
                            {isEn ? 'Save Category' : 'Lưu Hạng Mục'}
                        </Button>
                    </>
                }
            >
                <form id="pr-category-form" onSubmit={handleSaveCategory} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={isEn ? 'Category Code' : 'Mã Hạng Mục'} required>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    required
                                    placeholder="e.g. MKT_TASTING"
                                    value={categoryModalData.code}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, code: e.target.value }))}
                                    className="font-mono uppercase"
                                />
                            )}
                        </Field>
                        <Field label={isEn ? 'Expense Group' : 'Nhóm Chi Phí'}>
                            {id => (
                                <Select
                                    id={id}
                                    value={categoryModalData.group}
                                    onChange={e => setCategoryModalData(prev => ({ ...prev, group: e.target.value }))}
                                >
                                    <option value="COST_OF_SALES">{isEn ? 'Cost of Sales & Imports' : 'Tiền Hàng & Nhập Khẩu'}</option>
                                    <option value="OPERATING">{isEn ? 'Operations & Warehousing' : 'Vận Hành & Kho Bãi'}</option>
                                    <option value="MARKETING">{isEn ? 'Marketing & Sales' : 'Tiếp Thị & Bán Hàng'}</option>
                                    <option value="ADMINISTRATIVE">{isEn ? 'Admin & HR' : 'Hành Chính & Nhân Sự'}</option>
                                    <option value="CAPEX">{isEn ? 'Capital Expenditure (CAPEX)' : 'Đầu Tư Tài Sản (CAPEX)'}</option>
                                </Select>
                            )}
                        </Field>
                    </div>

                    <Field label={isEn ? 'Category Name' : 'Tên Hạng Mục'} required>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                required
                                placeholder={isEn ? 'e.g. Wine Tasting & Hospitality Expenses' : 'Vd: Chi phí Thử nếm rượu (Wine Tasting) & Tiếp khách'}
                                value={categoryModalData.name}
                                onChange={e => setCategoryModalData(prev => ({ ...prev, name: e.target.value }))}
                            />
                        )}
                    </Field>

                    <Field label={isEn ? 'Default Accounting Account (VAS)' : 'Tài Khoản Kế Toán Mặc Định (VAS)'}>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                placeholder={isEn ? 'e.g. 641 - Selling expenses / 642 - G&A expenses' : 'Vd: 641 - Chi phí bán hàng / 642 - Chi phí quản lý'}
                                value={categoryModalData.defaultAccount}
                                onChange={e => setCategoryModalData(prev => ({ ...prev, defaultAccount: e.target.value }))}
                            />
                        )}
                    </Field>

                    <Field label={isEn ? 'Business Description' : 'Diễn Giải Nghiệp Vụ'}>
                        {id => (
                            <Textarea
                                id={id}
                                rows={2}
                                placeholder={isEn ? 'Describe the purpose of this expense category...' : 'Mô tả mục đích sử dụng khoản chi này...'}
                                value={categoryModalData.description}
                                onChange={e => setCategoryModalData(prev => ({ ...prev, description: e.target.value }))}
                            />
                        )}
                    </Field>
                </form>
            </Modal>

            {/* ═══ Modal Thiết Lập Ngân Sách ═══ */}
            <Modal
                open={budgetModalData.open}
                onClose={() => setBudgetModalData(prev => ({ ...prev, open: false }))}
                size="md"
                title={
                    <div>
                        <span>{isEn ? 'Set Budget Limit' : 'Thiết Lập Hạn Mức Ngân Sách'}</span>
                        <span className="block text-xs font-medium text-lys-teal-strong mt-0.5">{budgetModalData.categoryName}</span>
                    </div>
                }
                footer={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setBudgetModalData(prev => ({ ...prev, open: false }))}
                        >
                            {isEn ? 'Cancel' : 'Hủy'}
                        </Button>
                        <Button type="submit" form="pr-budget-form" variant="primary" size="sm">
                            {isEn ? 'Save Limit' : 'Lưu Hạn Mức'}
                        </Button>
                    </>
                }
            >
                <form id="pr-budget-form" onSubmit={handleSaveBudget} className="space-y-4">
                    <Field label={isEn ? 'Budget Year' : 'Năm Ngân Sách'}>
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                required
                                value={budgetModalData.year}
                                onChange={e => setBudgetModalData(prev => ({ ...prev, year: Number(e.target.value) }))}
                                className="font-mono"
                            />
                        )}
                    </Field>

                    <Field
                        label={isEn ? 'Approved Budget Limit (VND)' : 'Hạn Mức Ngân Sách Được Duyệt (VNĐ)'}
                        required
                        hint={
                            <span>
                                {isEn ? 'Amount: ' : 'Thành tiền: '}
                                <strong className="text-lys-teal-strong type-number">{formatVND(budgetModalData.allocatedAmount)}</strong>
                            </span>
                        }
                    >
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                required
                                min="0"
                                value={budgetModalData.allocatedAmount}
                                onChange={e => setBudgetModalData(prev => ({ ...prev, allocatedAmount: Number(e.target.value) }))}
                                className="font-mono font-bold"
                            />
                        )}
                    </Field>

                    <Field
                        label={isEn ? 'Warning Threshold (%)' : 'Ngưỡng Báo Động Vàng (%)'}
                        hint={isEn ? 'System will show an amber warning when spending reaches this percentage' : 'Hệ thống sẽ hiển thị cảnh báo vàng khi chi tiêu đạt mức này'}
                    >
                        {id => (
                            <Input
                                id={id}
                                type="number"
                                min="50"
                                max="100"
                                value={budgetModalData.warningThresholdPct}
                                onChange={e => setBudgetModalData(prev => ({ ...prev, warningThresholdPct: Number(e.target.value) }))}
                            />
                        )}
                    </Field>
                </form>
            </Modal>

            {/* ═══ Modal Chỉnh Sửa Thông Tin Thanh Toán NCC ═══ */}
            <Modal
                open={editSupplierModal.open && !!editSupplierModal.supplier}
                onClose={() => setEditSupplierModal(prev => ({ ...prev, open: false }))}
                size="lg"
                title={
                    <div>
                        <span className="inline-flex items-center gap-2">
                            <Edit3 className="h-4 w-4 text-lys-teal-strong" aria-hidden />
                            {isEn ? 'Update Payment & Bank Information' : 'Cập Nhật Thông Tin Thanh Toán & Ngân Hàng'}
                        </span>
                        {editSupplierModal.supplier && (
                            <span className="block text-xs font-medium text-lys-teal-strong mt-0.5">
                                [{editSupplierModal.supplier.code}] {editSupplierModal.supplier.name}
                            </span>
                        )}
                    </div>
                }
                footer={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditSupplierModal(prev => ({ ...prev, open: false }))}
                        >
                            {isEn ? 'Cancel' : 'Hủy'}
                        </Button>
                        <Button type="submit" form="pr-edit-supplier-form" variant="primary" size="sm" loading={savingEditSupplier}>
                            {isEn ? 'Save Info' : 'Lưu Thông Tin'}
                        </Button>
                    </>
                }
            >
                <form id="pr-edit-supplier-form" onSubmit={handleSaveEditSupplier} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={isEn ? 'Tax ID (MST)' : 'Mã Số Thuế (MST)'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder="e.g. 0312345678"
                                    value={editSupplierModal.taxId}
                                    onChange={e => setEditSupplierModal(prev => ({ ...prev, taxId: e.target.value }))}
                                    className="font-mono"
                                />
                            )}
                        </Field>
                        <Field label={isEn ? 'Payment Terms' : 'Điều Khoản Thanh Toán'}>
                            {id => (
                                <Select
                                    id={id}
                                    value={editSupplierModal.paymentTerm}
                                    onChange={e => setEditSupplierModal(prev => ({ ...prev, paymentTerm: e.target.value }))}
                                >
                                    <option value="COD">{isEn ? 'Cash on Delivery (COD)' : 'Thanh toán ngay khi giao (COD)'}</option>
                                    <option value="NET15">{isEn ? 'Net 15 Days (NET15)' : 'Công nợ 15 ngày (NET15)'}</option>
                                    <option value="NET30">{isEn ? 'Net 30 Days (NET30)' : 'Công nợ 30 ngày (NET30)'}</option>
                                    <option value="NET45">{isEn ? 'Net 45 Days (NET45)' : 'Công nợ 45 ngày (NET45)'}</option>
                                    <option value="NET60">{isEn ? 'Net 60 Days (NET60)' : 'Công nợ 60 ngày (NET60)'}</option>
                                    <option value="ADVANCE_50">{isEn ? '50% Advance - Balance after delivery' : 'Tạm ứng 50% - Còn lại sau giao hàng'}</option>
                                    <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                </Select>
                            )}
                        </Field>
                    </div>

                    <div className="rounded-md border border-lys-border bg-lys-bg p-3.5 space-y-3">
                        <span className="font-semibold text-lys-primary block text-xs">
                            {isEn ? 'Supplier Beneficiary Bank Account' : 'Tài Khoản Ngân Hàng Thụ Hưởng Của Nhà Cung Cấp'}
                        </span>

                        <Field label={isEn ? 'Bank Name & Branch' : 'Tên Ngân Hàng & Chi Nhánh'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder={isEn ? 'e.g. Vietcombank Ky Dong / BIDV HCMC' : 'Vd: Vietcombank CN Kỳ Đồng / BIDV CN TP.HCM'}
                                    value={editSupplierModal.bankName}
                                    onChange={e => setEditSupplierModal(prev => ({ ...prev, bankName: e.target.value }))}
                                />
                            )}
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <Field label={isEn ? 'Account Number' : 'Số Tài Khoản (STK)'}>
                                {id => (
                                    <Input
                                        id={id}
                                        type="text"
                                        placeholder="e.g. 0071001234567"
                                        value={editSupplierModal.bankAccountNo}
                                        onChange={e => setEditSupplierModal(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                                        className="font-mono font-bold"
                                    />
                                )}
                            </Field>
                            <Field label={isEn ? 'Account Holder Name' : 'Tên Chủ Tài Khoản'}>
                                {id => (
                                    <Input
                                        id={id}
                                        type="text"
                                        placeholder="e.g. ABC DISTRIBUTION CO., LTD"
                                        value={editSupplierModal.bankAccountName}
                                        onChange={e => setEditSupplierModal(prev => ({ ...prev, bankAccountName: e.target.value }))}
                                        className="uppercase"
                                    />
                                )}
                            </Field>
                        </div>
                    </div>

                    <Field label={isEn ? 'Operational Notes' : 'Ghi Chú Nghiệp Vụ'}>
                        {id => (
                            <Textarea
                                id={id}
                                rows={2}
                                placeholder={isEn ? 'Additional notes on invoicing, accounting contact...' : 'Ghi chú thêm về thông tin xuất hóa đơn, đầu mối kế toán của NCC...'}
                                value={editSupplierModal.notes}
                                onChange={e => setEditSupplierModal(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        )}
                    </Field>
                </form>
            </Modal>

            {/* ═══ Modal Thêm NCC Mới Từ Tab Master ═══ */}
            <Modal
                open={showQuickAddSupplierModal}
                onClose={() => setShowQuickAddSupplierModal(false)}
                size="lg"
                title={
                    <div>
                        <span className="inline-flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-lys-teal-strong" aria-hidden />
                            {isEn ? 'Add New Supplier' : 'Thêm Nhà Cung Cấp Mới'}
                        </span>
                        <span className="block text-xs font-normal text-lys-muted mt-0.5">
                            {isEn ? 'Quickly create Supplier profile & bank account for payments' : 'Khởi tạo nhanh hồ sơ Nhà Cung Cấp & tài khoản ngân hàng để phục vụ thanh toán'}
                        </span>
                    </div>
                }
                footer={
                    <>
                        <Button variant="secondary" size="sm" onClick={() => setShowQuickAddSupplierModal(false)}>
                            {isEn ? 'Cancel' : 'Hủy'}
                        </Button>
                        <Button type="submit" form="pr-quick-add-supplier-form" variant="primary" size="sm" loading={savingQuickSupplier}>
                            {isEn ? 'Save Supplier' : 'Lưu Nhà Cung Cấp'}
                        </Button>
                    </>
                }
            >
                <form id="pr-quick-add-supplier-form" onSubmit={handleQuickAddSupplierSubmit} className="space-y-3.5">
                    <Field label={isEn ? 'Supplier Name' : 'Tên Nhà Cung Cấp'} required>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                required
                                placeholder={isEn ? 'e.g. Wine Import Co., Ltd A' : 'Vd: Công ty TNHH Nhập Khẩu Rượu Vang A'}
                                value={quickSupplierForm.name}
                                onChange={e => setQuickSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                            />
                        )}
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={isEn ? 'Supplier Code (Blank for auto)' : 'Mã NCC (Để trống sẽ tự sinh)'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder="e.g. NCC-0088"
                                    value={quickSupplierForm.code}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, code: e.target.value }))}
                                    className="uppercase"
                                />
                            )}
                        </Field>

                        <Field label={isEn ? 'Supplier Type' : 'Phân loại NCC'}>
                            {id => (
                                <Select
                                    id={id}
                                    value={quickSupplierForm.type}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, type: e.target.value }))}
                                >
                                    <option value="DISTRIBUTOR">{isEn ? 'Distributor' : 'Nhà phân phối (Distributor)'}</option>
                                    <option value="WINERY">{isEn ? 'Winery / Producer' : 'Nhà làm rượu (Winery / Hãng rượu)'}</option>
                                    <option value="FORWARDER">{isEn ? 'Freight Forwarder' : 'Hãng tàu / Giao nhận (Forwarder)'}</option>
                                    <option value="LOGISTICS">{isEn ? 'Warehousing / Domestic Logistics' : 'Kho bãi / Vận tải nội địa'}</option>
                                    <option value="LOCAL_VENDOR">{isEn ? 'Local Service Vendor' : 'Nhà cung cấp dịch vụ trong nước'}</option>
                                    <option value="OTHER">{isEn ? 'Other' : 'Khác'}</option>
                                </Select>
                            )}
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={isEn ? 'Tax ID (MST)' : 'Mã số thuế (MST)'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder="e.g. 0312345678"
                                    value={quickSupplierForm.taxId}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, taxId: e.target.value }))}
                                    className="font-mono"
                                />
                            )}
                        </Field>

                        <Field label={isEn ? 'Payment Terms' : 'Điều khoản thanh toán'}>
                            {id => (
                                <Select
                                    id={id}
                                    value={quickSupplierForm.paymentTerm}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, paymentTerm: e.target.value }))}
                                >
                                    <option value="COD">{isEn ? 'Cash on Delivery (COD)' : 'Thanh toán ngay khi giao (COD)'}</option>
                                    <option value="NET15">{isEn ? 'Net 15 Days (NET15)' : 'Công nợ 15 ngày (NET15)'}</option>
                                    <option value="NET30">{isEn ? 'Net 30 Days (NET30)' : 'Công nợ 30 ngày (NET30)'}</option>
                                    <option value="NET45">{isEn ? 'Net 45 Days (NET45)' : 'Công nợ 45 ngày (NET45)'}</option>
                                    <option value="NET60">{isEn ? 'Net 60 Days (NET60)' : 'Công nợ 60 ngày (NET60)'}</option>
                                    <option value="ADVANCE_50">{isEn ? '50% Advance - Balance after delivery' : 'Tạm ứng 50% - Còn lại sau giao hàng'}</option>
                                    <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                </Select>
                            )}
                        </Field>
                    </div>

                    <div className="rounded-md border border-lys-border bg-lys-bg p-3 space-y-2.5">
                        <span className="font-semibold text-lys-primary block text-xs">
                            {isEn ? 'Beneficiary Bank Account' : 'Tài khoản ngân hàng thụ hưởng'}
                        </span>

                        <Field label={isEn ? 'Bank Name & Branch' : 'Tên Ngân Hàng & Chi Nhánh'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder={isEn ? 'e.g. Vietcombank - Ky Dong Branch' : 'Vd: Vietcombank - CN Kỳ Đồng'}
                                    value={quickSupplierForm.bankName}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankName: e.target.value }))}
                                />
                            )}
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <Field label={isEn ? 'Account Number' : 'Số Tài Khoản (STK)'}>
                                {id => (
                                    <Input
                                        id={id}
                                        type="text"
                                        placeholder="e.g. 0071001234567"
                                        value={quickSupplierForm.bankAccountNo}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                                        className="font-mono font-bold"
                                    />
                                )}
                            </Field>
                            <Field label={isEn ? 'Account Holder Name' : 'Tên Chủ Tài Khoản'}>
                                {id => (
                                    <Input
                                        id={id}
                                        type="text"
                                        placeholder="e.g. ABC CO., LTD"
                                        value={quickSupplierForm.bankAccountName}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                                        className="uppercase"
                                    />
                                )}
                            </Field>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={isEn ? 'Phone Number' : 'Số điện thoại'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    placeholder="e.g. 028 3822 xxxx"
                                    value={quickSupplierForm.phone}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            )}
                        </Field>
                        <Field label={isEn ? 'Contact Email' : 'Email liên hệ'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="email"
                                    placeholder="e.g. accounting@supplier.com"
                                    value={quickSupplierForm.email}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                                />
                            )}
                        </Field>
                    </div>
                </form>
            </Modal>

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
        </PageContainer>
    )
}
