'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import {
    Building2, Upload, CheckCircle2, AlertCircle, RefreshCw,
    Search, Filter, ArrowUpRight, ArrowDownRight, Sparkles,
    Undo2, Check, X, ShieldAlert, Plus, BookOpen, Layers,
    ChevronRight, Info, HelpCircle, FileSpreadsheet
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getBankAccounts,
    getBankTransactions,
    uploadBankStatementAction,
    approveBankTransactionMatch,
    revertBankTransactionMatch,
    toggleIgnoreBankTransaction,
    getOpenInvoicesForCustomer,
    searchCustomers,
    getReconciliationRules,
    deleteReconciliationRule,
    createBankAccount
} from './actions-bank-reconciliation'
import { formatVND, formatDate } from '@/lib/utils'

interface BankAccountItem {
    id: string
    bankCode: string
    bankName: string
    accountNumber: string
    accountHolder: string
    branch?: string | null
    currency: string
    _count?: { transactions: number }
}

interface BankTransactionItem {
    id: string
    batchId: string
    bankAccountId: string
    txnDate: string
    txnRef: string | null
    txnType: 'CREDIT' | 'DEBIT'
    amount: number
    balanceAfter: number | null
    rawNarrative: string
    status: 'UNMATCHED' | 'SUGGESTED' | 'POSTED' | 'IGNORED'
    confidenceScore: number | null
    suggestedReason: string | null
    matchedCustomerId: string | null
    bankAccount: {
        id: string
        bankCode: string
        bankName: string
        accountNumber: string
    }
    matchedCustomer?: {
        id: string
        code: string
        name: string
        purchasingPhone?: string | null
    } | null
    paymentMatches?: {
        id: string
        allocatedAmount: number
        feeDifference: number
        invoice: {
            id: string
            invoiceNo: string
            amount: number
            totalAmount: number
            paidAmount: number
            status: string
            so?: { id: string; soNo: string } | null
        }
        arPayment?: {
            id: string
            paymentNo: string | null
            amount: number
            paidAt: string
        } | null
    }[]
    postedBy?: { id: string; name: string } | null
    postedAt?: string | null
}

export function BankReconciliationTab() {
    const [accounts, setAccounts] = useState<BankAccountItem[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUGGESTED' | 'UNMATCHED' | 'POSTED' | 'IGNORED'>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)

    const [transactions, setTransactions] = useState<BankTransactionItem[]>([])
    const [kpis, setKpis] = useState({
        totalCount: 0,
        totalCreditAmount: 0,
        suggestedCount: 0,
        unmatchedCount: 0,
        postedCount: 0,
        ignoredCount: 0
    })
    const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Modals
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [showNewAccountModal, setShowNewAccountModal] = useState(false)
    const [showRulesModal, setShowRulesModal] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploadAccountId, setUploadAccountId] = useState('')

    // Allocation Drawer / Manual Match
    const [allocatingTxn, setAllocatingTxn] = useState<BankTransactionItem | null>(null)
    const [custSearch, setCustSearch] = useState('')
    const [custResults, setCustResults] = useState<any[]>([])
    const [selectedCustId, setSelectedCustId] = useState<string>('')
    const [custInvoices, setCustInvoices] = useState<any[]>([])
    const [selectedInvoices, setSelectedInvoices] = useState<{ [invId: string]: number }>({})
    const [rememberKeyword, setRememberKeyword] = useState('')
    const [feeDiffTolerance, setFeeDiffTolerance] = useState(0)

    // Rules state
    const [rules, setRules] = useState<any[]>([])

    // Load initial accounts
    const loadAccounts = useCallback(async () => {
        const res = await getBankAccounts()
        if (res.success && res.data) {
            setAccounts(res.data)
            if (res.data.length > 0 && !uploadAccountId) {
                setUploadAccountId(res.data[0].id)
            }
        }
    }, [uploadAccountId])

    // Load transactions
    const loadTransactions = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getBankTransactions({
                bankAccountId: selectedAccountId,
                status: statusFilter,
                search: searchQuery,
                page,
                pageSize: 25
            })
            if (res.success && res.data) {
                setTransactions(res.data.transactions)
                setKpis(res.data.kpis)
                setPagination(res.data.pagination)
            } else {
                toast.error(res.error || 'Lỗi khi tải dữ liệu sao kê.')
            }
        } catch {
            toast.error('Không thể kết nối đến máy chủ.')
        } finally {
            setLoading(false)
        }
    }, [selectedAccountId, statusFilter, searchQuery, page])

    useEffect(() => {
        loadAccounts()
    }, [loadAccounts])

    useEffect(() => {
        loadTransactions()
    }, [loadTransactions])

    // Handle Upload Statement
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!uploadFile) {
            toast.warning('Vui lòng chọn file sao kê (Excel/CSV).')
            return
        }
        if (!uploadAccountId) {
            toast.warning('Vui lòng chọn tài khoản ngân hàng.')
            return
        }

        const formData = new FormData()
        formData.append('file', uploadFile)
        formData.append('bankAccountId', uploadAccountId)

        setLoading(true)
        try {
            const res = await uploadBankStatementAction(formData)
            if (res.success && res.data) {
                toast.success(
                    `Nạp sao kê thành công! Đọc ${res.data.totalParsed} dòng, ${res.data.insertedCount} giao dịch mới, ${res.data.autoSuggestedCount} gợi ý khớp.`
                )
                setShowUploadModal(false)
                setUploadFile(null)
                loadTransactions()
            } else {
                toast.error(res.error || 'Lỗi xử lý file sao kê.')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi hệ thống khi nạp file.')
        } finally {
            setLoading(false)
        }
    }

    // 1-Click Approve from inline button
    const handleInlineApprove = async (txn: BankTransactionItem) => {
        if (!txn.matchedCustomerId) {
            // Open drawer for assignment
            handleOpenAllocationDrawer(txn)
            return
        }

        // Fetch candidate invoices for this customer
        startTransition(async () => {
            const invRes = await getOpenInvoicesForCustomer(txn.matchedCustomerId!)
            if (!invRes.success || !invRes.data || invRes.data.length === 0) {
                toast.warning('Khách hàng không còn hóa đơn nào chưa thanh toán. Vui lòng mở bảng phân bổ để kiểm tra.')
                handleOpenAllocationDrawer(txn)
                return
            }

            const openInvs = invRes.data
            // Auto match 1 invoice if amount matches or single invoice exists
            const exact = openInvs.find((i: any) => Math.abs(Number(i.totalAmount) - Number(i.paidAmount) - txn.amount) <= 10000)
            const targetInv = exact || openInvs[0]

            const remaining = Number(targetInv.totalAmount) - Number(targetInv.paidAmount)
            const alloc = Math.min(txn.amount, remaining)
            const feeDiff = (Math.abs(remaining - txn.amount) <= 10000 && remaining > txn.amount)
                ? (remaining - txn.amount)
                : 0

            const res = await approveBankTransactionMatch({
                bankTxnId: txn.id,
                customerId: txn.matchedCustomerId!,
                allocations: [{
                    invoiceId: targetInv.id,
                    allocatedAmount: alloc,
                    feeDifference: feeDiff
                }]
            })

            if (res.success) {
                toast.success(`Đã hạch toán thanh toán thành công cho hóa đơn ${targetInv.invoiceNo}!`)
                loadTransactions()
            } else {
                toast.error(res.error || 'Lỗi khi hạch toán.')
            }
        })
    }

    // Rollback / Unmatch
    const handleRevert = async (txn: BankTransactionItem) => {
        if (!confirm('Bạn có chắc muốn HỦY KHỚP giao dịch này? Phiếu thu ARPayment sẽ bị xóa và công nợ hóa đơn sẽ được phục hồi.')) {
            return
        }

        startTransition(async () => {
            const res = await revertBankTransactionMatch(txn.id)
            if (res.success) {
                toast.success('Đã hoàn tác giao dịch sao kê thành công!')
                loadTransactions()
            } else {
                toast.error(res.error || 'Lỗi khi hoàn tác.')
            }
        })
    }

    // Toggle Ignore
    const handleToggleIgnore = async (txn: BankTransactionItem, ignore: boolean) => {
        startTransition(async () => {
            const res = await toggleIgnoreBankTransaction(txn.id, ignore)
            if (res.success) {
                toast.success(ignore ? 'Đã bỏ qua giao dịch.' : 'Đã khôi phục giao dịch.')
                loadTransactions()
            } else {
                toast.error(res.error || 'Lỗi cập nhật.')
            }
        })
    }

    // Open Allocation Drawer
    const handleOpenAllocationDrawer = async (txn: BankTransactionItem) => {
        setAllocatingTxn(txn)
        setSelectedInvoices({})
        setFeeDiffTolerance(0)

        // Pre-fill suggested keyword from narrative
        const cleanKeyword = txn.rawNarrative.replace(/[0-9]/g, '').trim().slice(0, 30)
        setRememberKeyword(cleanKeyword)

        if (txn.matchedCustomerId) {
            setSelectedCustId(txn.matchedCustomerId)
            const invRes = await getOpenInvoicesForCustomer(txn.matchedCustomerId)
            if (invRes.success && invRes.data) {
                setCustInvoices(invRes.data)
                // Auto allocate if amount fits
                const initialMap: { [id: string]: number } = {}
                let remainingAmountToAlloc = txn.amount

                for (const inv of invRes.data) {
                    const invRemain = Number(inv.totalAmount) - Number(inv.paidAmount)
                    if (remainingAmountToAlloc <= 0) break

                    const alloc = Math.min(remainingAmountToAlloc, invRemain)
                    initialMap[inv.id] = alloc
                    remainingAmountToAlloc -= alloc
                }
                setSelectedInvoices(initialMap)
            }
        } else {
            setSelectedCustId('')
            setCustInvoices([])
        }
    }

    // Search Customers for drawer
    const handleCustomerSearch = async (val: string) => {
        setCustSearch(val)
        if (!val.trim()) {
            setCustResults([])
            return
        }
        const res = await searchCustomers(val)
        if (res.success && res.data) {
            setCustResults(res.data)
        }
    }

    // Select Customer in drawer
    const handleSelectCustomer = async (cust: any) => {
        setSelectedCustId(cust.id)
        setCustSearch(cust.name)
        setCustResults([])
        const invRes = await getOpenInvoicesForCustomer(cust.id)
        if (invRes.success && invRes.data) {
            setCustInvoices(invRes.data)
            // Pre-select first invoice
            if (invRes.data.length > 0 && allocatingTxn) {
                const inv = invRes.data[0]
                const invRemain = Number(inv.totalAmount) - Number(inv.paidAmount)
                setSelectedInvoices({ [inv.id]: Math.min(allocatingTxn.amount, invRemain) })
            }
        }
    }

    // Submit Allocation
    const handleConfirmAllocation = async () => {
        if (!allocatingTxn) return

        const allocations = Object.entries(selectedInvoices)
            .filter(([_, amt]) => amt > 0)
            .map(([invId, amt]) => ({
                invoiceId: invId,
                allocatedAmount: amt,
                feeDifference: feeDiffTolerance
            }))

        if (allocations.length === 0) {
            toast.warning('Vui lòng nhập số tiền phân bổ cho ít nhất một hóa đơn.')
            return
        }

        startTransition(async () => {
            const res = await approveBankTransactionMatch({
                bankTxnId: allocatingTxn.id,
                customerId: selectedCustId,
                allocations,
                rememberRuleKeyword: rememberKeyword
            })

            if (res.success) {
                toast.success('Hạch toán phân bổ thanh toán thành công!')
                setAllocatingTxn(null)
                loadTransactions()
            } else {
                toast.error(res.error || 'Lỗi khi hạch toán.')
            }
        })
    }

    // Open Rules Modal
    const handleOpenRulesModal = async () => {
        setShowRulesModal(true)
        const res = await getReconciliationRules()
        if (res.success && res.data) {
            setRules(res.data)
        }
    }

    const handleDeleteRule = async (ruleId: string) => {
        const res = await deleteReconciliationRule(ruleId)
        if (res.success) {
            toast.success('Đã xóa quy tắc ghi nhớ.')
            setRules(prev => prev.filter(r => r.id !== ruleId))
        } else {
            toast.error(res.error || 'Lỗi khi xóa quy tắc.')
        }
    }

    return (
        <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900">Đối Soát Sao Kê Ngân Hàng & Thu Nợ Khách Hàng</h2>
                        <p className="text-xs text-slate-500">
                            Upload file sao kê Excel/CSV • Gợi ý thông minh (Heuristic & AI) • Duyệt 1-Click ghi nhận ARPayment
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleOpenRulesModal}
                        className="px-3 py-2 text-xs font-medium rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <BookOpen size={14} className="text-slate-500" />
                        Quy Tắc Nhớ
                    </button>

                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="px-3.5 py-2 text-xs font-semibold rounded-md bg-emerald-700 text-white hover:bg-emerald-800 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                        <Upload size={14} />
                        Nạp File Sao Kê (Excel/CSV)
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-slate-700">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng Thu Vào</p>
                    <p className="text-lg font-bold text-slate-900 mt-1 font-mono">{formatVND(kpis.totalCreditAmount)}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{kpis.totalCount} giao dịch đã nạp</p>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-amber-500">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Chờ Duyệt (Gợi Ý)</p>
                        <Sparkles size={14} className="text-amber-500" />
                    </div>
                    <p className="text-lg font-bold text-amber-600 mt-1 font-mono">{kpis.suggestedCount}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5 font-medium">Khớp SO/HĐ & Khách hàng</p>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-emerald-600">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Đã Ghi Sổ (AR)</p>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                    </div>
                    <p className="text-lg font-bold text-emerald-700 mt-1 font-mono">{kpis.postedCount}</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Đã sinh phiếu thu ARPayment</p>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-rose-500">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Chưa Rõ</p>
                        <AlertCircle size={14} className="text-rose-500" />
                    </div>
                    <p className="text-lg font-bold text-rose-600 mt-1 font-mono">{kpis.unmatchedCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cần kế toán chỉ định tay</p>
                </div>

                <div className="p-3.5 rounded-lg bg-white border border-slate-200 border-l-4 border-l-slate-400">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Bỏ Qua</p>
                        <X size={14} className="text-slate-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-600 mt-1 font-mono">{kpis.ignoredCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Lãi / GD nội bộ / Chi phí</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Bank Account Selector */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 font-medium">Tài khoản:</span>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => { setSelectedAccountId(e.target.value); setPage(1) }}
                            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 font-medium cursor-pointer"
                        >
                            <option value="ALL">Tất cả tài khoản</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.bankCode} - {acc.accountNumber} ({acc.bankName})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {[
                            { key: 'ALL', label: 'Tất cả' },
                            { key: 'SUGGESTED', label: `Gợi ý (${kpis.suggestedCount})` },
                            { key: 'UNMATCHED', label: `Chưa rõ (${kpis.unmatchedCount})` },
                            { key: 'POSTED', label: `Đã duyệt (${kpis.postedCount})` },
                            { key: 'IGNORED', label: 'Bỏ qua' },
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => { setStatusFilter(t.key as any); setPage(1) }}
                                className={`text-xs px-2.5 py-1 rounded font-medium transition-all cursor-pointer ${statusFilter === t.key
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search */}
                <div className="relative min-w-[240px]">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm nội dung, mã đơn, KH..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md border border-slate-200 focus:outline-none focus:border-emerald-600"
                    />
                </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                                <th className="px-3.5 py-3 font-semibold text-slate-600">Ngày / Mã GD</th>
                                <th className="px-3.5 py-3 font-semibold text-slate-600">Tài Khoản</th>
                                <th className="px-3.5 py-3 font-semibold text-slate-600">Số Tiền (VND)</th>
                                <th className="px-3.5 py-3 font-semibold text-slate-600">Nội Dung Chuyển Khoản</th>
                                <th className="px-3.5 py-3 font-semibold text-slate-600">Nhận Diện & Gợi Ý Khớp</th>
                                <th className="px-3.5 py-3 font-semibold text-slate-600 text-right">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw size={16} className="animate-spin text-emerald-600" />
                                            Đang tải dữ liệu sao kê...
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-500">
                                        <div className="max-w-md mx-auto space-y-2">
                                            <FileSpreadsheet size={36} className="mx-auto text-slate-300" />
                                            <p className="font-semibold text-slate-700">Chưa có giao dịch sao kê nào</p>
                                            <p className="text-[11px] text-slate-400">
                                                Bấm nút "Nạp File Sao Kê (Excel/CSV)" ở góc trên để tải lên sao kê ngân hàng và bắt đầu đối soát.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map(txn => {
                                    const isCredit = txn.txnType === 'CREDIT'
                                    const isPosted = txn.status === 'POSTED'
                                    const isIgnored = txn.status === 'IGNORED'
                                    const isSuggested = txn.status === 'SUGGESTED'
                                    const score = txn.confidenceScore || 0

                                    // Badge color by score
                                    let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200'
                                    if (score >= 95) badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    else if (score >= 80) badgeColor = 'bg-blue-50 text-blue-700 border-blue-200'
                                    else if (score >= 65) badgeColor = 'bg-amber-50 text-amber-800 border-amber-200'

                                    return (
                                        <tr
                                            key={txn.id}
                                            className={`hover:bg-slate-50/80 transition-colors ${isPosted ? 'bg-emerald-50/30' : isIgnored ? 'opacity-50 bg-slate-50/50' : ''
                                                }`}
                                        >
                                            {/* Date & Ref */}
                                            <td className="px-3.5 py-3 whitespace-nowrap">
                                                <p className="font-semibold text-slate-800">{formatDate(txn.txnDate)}</p>
                                                <p className="text-[10px] font-mono text-slate-400">
                                                    {txn.txnRef ? `Ref: ${txn.txnRef}` : '–'}
                                                </p>
                                            </td>

                                            {/* Bank Account */}
                                            <td className="px-3.5 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 whitespace-nowrap shrink-0">
                                                    {txn.bankAccount.bankCode}
                                                </span>
                                                <p className="text-[10px] text-slate-500 mt-0.5">{txn.bankAccount.accountNumber}</p>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-3.5 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    {isCredit ? (
                                                        <ArrowDownRight size={14} className="text-emerald-600" />
                                                    ) : (
                                                        <ArrowUpRight size={14} className="text-rose-600" />
                                                    )}
                                                    <span className={`font-mono font-bold ${isCredit ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                        {isCredit ? '+' : '-'}{formatVND(txn.amount)}
                                                    </span>
                                                </div>
                                                {txn.balanceAfter !== null && (
                                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                        Dư: {formatVND(txn.balanceAfter)}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Narrative */}
                                            <td className="px-3.5 py-3 max-w-sm">
                                                <p className="text-slate-800 line-clamp-2 leading-relaxed font-mono text-[11px]">
                                                    {txn.rawNarrative}
                                                </p>
                                            </td>

                                            {/* Smart Match Info */}
                                            <td className="px-3.5 py-3 min-w-[200px]">
                                                {isPosted ? (
                                                    <div className="space-y-1">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
                                                            <CheckCircle2 size={12} /> Đã Hạch Toán
                                                        </span>
                                                        {txn.paymentMatches && txn.paymentMatches.length > 0 && (
                                                            <div className="text-[11px] text-slate-600">
                                                                {txn.paymentMatches.map(m => (
                                                                    <div key={m.id} className="flex items-center gap-1 font-medium">
                                                                        <span>HĐ: {m.invoice.invoiceNo}</span>
                                                                        {m.invoice.so && <span className="text-slate-400">({m.invoice.so.soNo})</span>}
                                                                        <span className="text-emerald-700">+{formatVND(m.allocatedAmount)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : isIgnored ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600 whitespace-nowrap shrink-0">
                                                        Đã bỏ qua
                                                    </span>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {score > 0 && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor} whitespace-nowrap shrink-0`}>
                                                                    {score}% Khớp
                                                                </span>
                                                                {txn.matchedCustomer && (
                                                                    <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                                                                        {txn.matchedCustomer.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-[11px] text-slate-600 leading-tight">
                                                            {txn.suggestedReason || 'Chưa nhận diện được'}
                                                        </p>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Action Buttons */}
                                            <td className="px-3.5 py-3 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {isPosted ? (
                                                        <button
                                                            onClick={() => handleRevert(txn)}
                                                            disabled={isPending}
                                                            className="px-2.5 py-1 text-[11px] font-medium rounded border border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer"
                                                        >
                                                            <Undo2 size={12} /> Hủy Khớp
                                                        </button>
                                                    ) : isIgnored ? (
                                                        <button
                                                            onClick={() => handleToggleIgnore(txn, false)}
                                                            className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                                        >
                                                            Khôi phục
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {/* 1-Click Approve if high confidence */}
                                                            {isCredit && score >= 80 && (
                                                                <button
                                                                    onClick={() => handleInlineApprove(txn)}
                                                                    disabled={isPending}
                                                                    className="px-3 py-1.5 text-xs font-semibold rounded bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                                                                >
                                                                    <Check size={13} /> 1-Click Duyệt
                                                                </button>
                                                            )}

                                                            {/* Manual Allocation Drawer */}
                                                            {isCredit && (
                                                                <button
                                                                    onClick={() => handleOpenAllocationDrawer(txn)}
                                                                    className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                                                >
                                                                    {score >= 80 ? 'Xem & Gộp' : 'Chỉ định đơn'}
                                                                </button>
                                                            )}

                                                            {/* Ignore button */}
                                                            <button
                                                                onClick={() => handleToggleIgnore(txn, true)}
                                                                title="Bỏ qua giao dịch này"
                                                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
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

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-3 border-t border-slate-200 text-xs text-slate-600">
                        <span>Hiển thị trang {page} / {pagination.totalPages} ({pagination.total} giao dịch)</span>
                        <div className="flex items-center gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-50 cursor-pointer"
                            >
                                Trước
                            </button>
                            <button
                                disabled={page >= pagination.totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-2.5 py-1 rounded border border-slate-200 disabled:opacity-50 cursor-pointer"
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: UPLOAD BANK STATEMENT */}
            {showUploadModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2 text-emerald-800">
                                <FileSpreadsheet size={20} />
                                <h3 className="font-bold text-base text-slate-900">Nạp File Sao Kê Ngân Hàng</h3>
                            </div>
                            <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Tài khoản ngân hàng nhận tiền *
                                </label>
                                <select
                                    value={uploadAccountId}
                                    onChange={(e) => setUploadAccountId(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-md border border-slate-200 bg-white"
                                    required
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.bankCode} - {acc.accountNumber} ({acc.bankName})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Chọn file sao kê (Excel .xlsx, .xls hoặc .csv) *
                                </label>
                                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-emerald-600 transition-colors">
                                    <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                                        required
                                    />
                                    {uploadFile && (
                                        <p className="text-xs font-medium text-emerald-700 mt-2">
                                            Đã chọn: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                                <p className="font-semibold text-slate-800 flex items-center gap-1">
                                    <Info size={13} className="text-emerald-600" /> Hệ thống tự động nhận diện:
                                </p>
                                <p>• Các ngân hàng: Vietcombank, Techcombank, ACB, BIDV, MBBank, VPBank...</p>
                                <p>• Tự động chống nạp trùng lặp các giao dịch đã import trước đó.</p>
                                <p>• Chạy bộ não AI/Heuristic chấm điểm khớp với các hóa đơn mở.</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUploadModal(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                                >
                                    Đóng
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs flex items-center gap-1.5"
                                >
                                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                                    Tải Lên & Phân Tích
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DRAWER: PHÂN BỔ THỦ CÔNG & GỘP ĐƠN (MANUAL ALLOCATION DRAWER) */}
            {allocatingTxn && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
                    <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 flex flex-col p-6 overflow-y-auto space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div>
                                <h3 className="font-bold text-base text-slate-900">Phân Bổ & Ghi Nhận Thanh Toán</h3>
                                <p className="text-xs text-slate-500">Đối soát giao dịch sao kê vào công nợ hóa đơn</p>
                            </div>
                            <button onClick={() => setAllocatingTxn(null)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Transaction Card */}
                        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-500">Số tiền chuyển khoản</span>
                                <span className="text-lg font-bold font-mono text-emerald-700">+{formatVND(allocatingTxn.amount)}</span>
                            </div>
                            <div className="text-xs text-slate-700">
                                <span className="text-slate-400">Nội dung gốc: </span>
                                <span className="font-mono text-slate-900 font-medium">{allocatingTxn.rawNarrative}</span>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                                <span>Ngày: {formatDate(allocatingTxn.txnDate)}</span>
                                <span>Ngân hàng: {allocatingTxn.bankAccount.bankCode}</span>
                                {allocatingTxn.txnRef && <span>Mã GD: {allocatingTxn.txnRef}</span>}
                            </div>
                        </div>

                        {/* Customer Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-800">Khách Hàng Nộp Tiền</label>
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo tên KH, mã KH, SĐT..."
                                    value={custSearch}
                                    onChange={(e) => handleCustomerSearch(e.target.value)}
                                    className="w-full text-xs pl-8 pr-3 py-2 rounded-md border border-slate-200 focus:outline-none focus:border-emerald-600"
                                />
                                {custResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                                        {custResults.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectCustomer(c)}
                                                className="w-full text-left p-2.5 hover:bg-slate-50 text-xs flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-900">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400">{c.code} {c.purchasingPhone ? `• ${c.purchasingPhone}` : ''}</p>
                                                </div>
                                                <ChevronRight size={14} className="text-slate-400" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Open Invoices Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-800">
                                    Danh Sách Hóa Đơn Đang Nợ ({custInvoices.length})
                                </label>
                                <span className="text-[11px] text-slate-500">
                                    Tick chọn để phân bổ số tiền
                                </span>
                            </div>

                            {custInvoices.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-lg">
                                    {selectedCustId ? 'Khách hàng này hiện không có hóa đơn nợ nào.' : 'Vui lòng chọn khách hàng để tải hóa đơn nợ.'}
                                </p>
                            ) : (
                                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
                                    {custInvoices.map((inv: any) => {
                                        const remaining = Number(inv.totalAmount) - Number(inv.paidAmount)
                                        const isChecked = Boolean(selectedInvoices[inv.id])
                                        const currentAlloc = selectedInvoices[inv.id] || 0

                                        return (
                                            <div key={inv.id} className={`p-3 text-xs space-y-2 ${isChecked ? 'bg-emerald-50/40' : ''}`}>
                                                <div className="flex items-start justify-between">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedInvoices(prev => ({
                                                                        ...prev,
                                                                        [inv.id]: remaining
                                                                    }))
                                                                } else {
                                                                    setSelectedInvoices(prev => {
                                                                        const copy = { ...prev }
                                                                        delete copy[inv.id]
                                                                        return copy
                                                                    })
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                                        />
                                                        <div>
                                                            <p className="font-bold text-slate-900">{inv.invoiceNo}</p>
                                                            <p className="text-[10px] text-slate-500">
                                                                {inv.so ? `Đơn hàng: ${inv.so.soNo}` : ''} • Hạn TT: {formatDate(inv.dueDate)}
                                                            </p>
                                                        </div>
                                                    </label>

                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-800 font-mono">{formatVND(remaining)}</p>
                                                        <p className="text-[10px] text-slate-400">Tổng: {formatVND(inv.totalAmount)}</p>
                                                    </div>
                                                </div>

                                                {isChecked && (
                                                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                                        <span className="text-[11px] text-slate-500 font-medium">Số tiền phân bổ:</span>
                                                        <input
                                                            type="number"
                                                            value={currentAlloc}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0
                                                                setSelectedInvoices(prev => ({ ...prev, [inv.id]: val }))
                                                            }}
                                                            className="w-32 text-xs font-mono font-bold px-2 py-1 border border-slate-200 rounded text-right focus:outline-none focus:border-emerald-600"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Edge Case: Bank Fee Difference */}
                        <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-amber-900">Dung sai cấn trừ phí ngân hàng (nếu có):</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={feeDiffTolerance || ''}
                                    onChange={(e) => setFeeDiffTolerance(parseFloat(e.target.value) || 0)}
                                    className="w-28 text-xs font-mono px-2 py-1 bg-white border border-amber-300 rounded text-right focus:outline-none"
                                />
                            </div>
                            <p className="text-[11px] text-amber-700">
                                Ví dụ khách chuyển thiếu 5.500đ do trừ phí ngân hàng, nhập 5.500đ để hóa đơn vẫn chuyển thành Đã Thu Đủ (PAID).
                            </p>
                        </div>

                        {/* Edge Case: Remember Rule */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                                <input
                                    type="checkbox"
                                    checked={Boolean(rememberKeyword)}
                                    onChange={(e) => {
                                        if (!e.target.checked) setRememberKeyword('')
                                        else setRememberKeyword(allocatingTxn.rawNarrative.slice(0, 25))
                                    }}
                                    className="rounded border-slate-300 text-emerald-700"
                                />
                                Ghi nhớ quy tắc học cho các lần sau
                            </label>
                            {rememberKeyword && (
                                <input
                                    type="text"
                                    placeholder="Từ khóa nhận diện (VD: Lê Thị Thảo, 0903123456...)"
                                    value={rememberKeyword}
                                    onChange={(e) => setRememberKeyword(e.target.value)}
                                    className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                                />
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-auto">
                            <button
                                type="button"
                                onClick={() => setAllocatingTxn(null)}
                                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAllocation}
                                disabled={isPending}
                                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-xs flex items-center gap-1.5"
                            >
                                {isPending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                Xác Nhận Ghi Sổ AR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: RULES MANAGEMENT */}
            {showRulesModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2 text-slate-800">
                                <BookOpen size={20} className="text-emerald-700" />
                                <h3 className="font-bold text-base text-slate-900">Quy Tắc Nhận Diện Tự Động Đã Học</h3>
                            </div>
                            <button onClick={() => setShowRulesModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-slate-500">
                            Các từ khóa hoặc tên cá nhân/tài khoản do kế toán gán nhớ, hệ thống sẽ tự động gán vào khách hàng tương ứng khi đọc sao kê.
                        </p>

                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                            {rules.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-8">Chưa có quy tắc nhớ nào.</p>
                            ) : (
                                rules.map((r: any) => (
                                    <div key={r.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                                        <div>
                                            <p className="font-bold text-slate-800 font-mono">"{r.keyword}"</p>
                                            <p className="text-[11px] text-emerald-700 font-medium">
                                                ➔ {r.customer?.name} ({r.customer?.code})
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteRule(r.id)}
                                            className="text-slate-400 hover:text-rose-600 p-1"
                                            title="Xóa quy tắc"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowRulesModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
