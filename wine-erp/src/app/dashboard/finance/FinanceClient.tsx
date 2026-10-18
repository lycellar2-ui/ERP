'use client'

import { useState, useCallback, useEffect } from 'react'
import { DollarSign, TrendingDown, AlertCircle, Clock, CheckCircle2, ReceiptText, ArrowUpRight, ArrowDownRight, BookOpen, BarChart3, Wallet, Lock, Skull, Banknote, Table2, Search, FileCheck2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { ARRow, APRow, getARInvoices, getAPInvoices, recordARPayment, recordAPPayment } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { JournalEntryTab, ProfitLossTab, ExpenseTab, PeriodCloseTab, BalanceSheetTab, BadDebtTab, CashFlowTab, TrialBalanceTab, AccountLedgerTab } from './FinanceTabs'
import { InvoiceReconciliationTab } from './InvoiceReconciliationTab'
import { BankReconciliationTab } from './BankReconciliationTab'
import { FilterBar } from '@/components/FilterBar'
import { PageHeader, Pagination } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getFinanceLabels } from './i18n'

type Tab = 'ar' | 'ap' | 'aging' | 'invoice-reconcile' | 'bank-reconcile' | 'journal' | 'pnl' | 'bs' | 'trialbalance' | 'ledger' | 'expense' | 'period' | 'baddebt' | 'cashflow'

const AR_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
    UNPAID: { label: 'Chưa Thu', labelEn: 'Unpaid', color: '#B45309' },
    PARTIALLY_PAID: { label: 'Đã Thu 1 Phần', labelEn: 'Partially Paid', color: '#1D4ED8' },
    PAID: { label: 'Đã Thu Đủ', labelEn: 'Paid', color: '#15803D' },
    OVERDUE: { label: 'Quá Hạn', labelEn: 'Overdue', color: '#B91C1C' },
    CANCELLED: { label: 'Huỷ', labelEn: 'Cancelled', color: '#64748B' },
}

function FinKpiCard({ label, value, sub, accent, icon: Icon }: {
    label: string; value: string; sub?: string; accent: string; icon: React.FC<any>
}) {
    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `3px solid ${accent}` }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>{label}</p>
                    <p className="text-2xl font-bold font-mono" style={{ color: '#0F172A' }}>{value}</p>
                    {sub && <p className="text-xs mt-1" style={{ color: accent }}>{sub}</p>}
                </div>
                <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <Icon size={20} style={{ color: accent }} />
                </div>
            </div>
        </div>
    )
}

function AgingBars({ buckets, isEn }: { buckets: Record<string, number>; isEn?: boolean }) {
    const total = Object.values(buckets).reduce((a, b) => a + b, 0)
    const bars = [
        { label: isEn ? 'Current' : 'Chưa Đến Hạn', key: 'current', color: '#15803D' },
        { label: isEn ? '1–30 Days' : '1–30 Ngày', key: 'd30', color: '#B45309' },
        { label: isEn ? '31–60 Days' : '31–60 Ngày', key: 'd60', color: '#D4833A' },
        { label: isEn ? '61–90 Days' : '61–90 Ngày', key: 'd90', color: '#B45309' },
        { label: isEn ? '> 90 Days' : '> 90 Ngày', key: 'over90', color: '#B91C1C' },
    ]

    return (
        <div className="p-5 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#0F172A' }}>
                {isEn ? 'AR Aging Report – Receivables Aging Analysis' : 'AR Aging Report – Phân Tầng Công Nợ'}
            </h3>
            <div className="space-y-3">
                {bars.map(b => {
                    const val = (buckets as any)[b.key] ?? 0
                    const pct = total > 0 ? (val / total) * 100 : 0
                    return (
                        <div key={b.key}>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs" style={{ color: '#475569' }}>{b.label}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold" style={{ color: '#0F172A' }}>
                                        {formatVND(val)}
                                    </span>
                                    <span className="text-xs w-12 text-right" style={{ color: b.color }}>{pct.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: b.color }} />
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between pt-4 mt-4" style={{ borderTop: '1px solid #E2E8F0' }}>
                <span className="text-sm font-semibold" style={{ color: '#475569' }}>
                    {isEn ? 'Total AR Outstanding' : 'Tổng AR Outstanding'}
                </span>
                <span className="text-sm font-bold" style={{ color: '#0891B2' }}>
                    {formatVND(total)}
                </span>
            </div>
        </div>
    )
}

function ARMobileCard({ row, onPayment, isEn }: { row: ARRow; onPayment: (id: string) => void; isEn?: boolean }) {
    const st = AR_STATUS[row.status]
    return (
        <div className={`p-3.5 rounded-lg border bg-white shadow-xs space-y-2.5 ${row.isOverdue ? 'border-rose-300' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        {row.isOverdue && <AlertCircle size={13} className="text-rose-600 shrink-0" />}
                        <span className="font-mono font-bold text-xs text-[#0891B2]">{row.invoiceNo}</span>
                        {row.soNo && <span className="text-[11px] text-slate-500">• SO: {row.soNo}</span>}
                    </div>
                    <p className="font-semibold text-xs text-slate-900 mt-0.5">{row.customerName}</p>
                    <p className="text-[10px] text-slate-500">{row.customerCode}</p>
                </div>
                {st && (
                    <span
                        className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
                        style={{ color: st.color, background: `${st.color}18` }}
                    >
                        {isEn ? st.labelEn : st.label}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                    <span className="text-slate-400 block text-[10px]">{isEn ? 'Total' : 'Tổng HĐ'}</span>
                    <span className="font-bold text-slate-900 text-xs">{formatVND(row.amount)}</span>
                </div>
                <div>
                    <span className="text-slate-400 block text-[10px]">{isEn ? 'Collected' : 'Đã thu'}</span>
                    <span className="font-medium text-emerald-700 text-xs">{formatVND(row.paidAmount)}</span>
                </div>
                <div>
                    <span className="text-slate-400 block text-[10px]">{isEn ? 'Remaining' : 'Còn lại'}</span>
                    <span className={`font-bold text-xs ${row.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {formatVND(row.outstanding)}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div className="text-[11px]">
                    <span className="text-slate-500">{isEn ? 'Due: ' : 'Hạn TT: '}</span>
                    <span className={row.isOverdue ? 'font-bold text-rose-600' : 'text-slate-700'}>
                        {formatDate(row.dueDate)}
                        {row.isOverdue && row.daysOverdue > 0 && ` (+${row.daysOverdue}d)`}
                    </span>
                </div>
                {row.outstanding > 0 && row.status !== 'CANCELLED' && (
                    <button
                        onClick={() => onPayment(row.id)}
                        className="px-3 py-1 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 transition-colors cursor-pointer"
                    >
                        {isEn ? 'Collect' : 'Ghi Thu'}
                    </button>
                )}
            </div>
        </div>
    )
}

function ARTable({ rows, onPayment, isEn }: { rows: ARRow[]; onPayment: (id: string) => void; isEn?: boolean }) {
    const headers = isEn
        ? ['Invoice No.', 'Customer', 'SO', 'Amount', 'Collected', 'Remaining', 'Due Date', 'Status', '']
        : ['Số HĐ', 'Khách Hàng', 'SO', 'Giá Trị', 'Đã Thu', 'Còn Lại', 'Hạn TT', 'Trạng Thái', '']
    return (
        <div>
            {/* Mobile View */}
            <div className="block md:hidden space-y-3">
                {rows.length === 0 ? (
                    <div className="text-center py-12 text-sm bg-white rounded-md border border-slate-200" style={{ color: '#64748B' }}>
                        {isEn ? 'No AR invoices found' : 'Không có hóa đơn nào'}
                    </div>
                ) : (
                    rows.map(row => (
                        <ARMobileCard key={row.id} row={row} onPayment={onPayment} isEn={isEn} />
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                {headers.map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>
                                    {isEn ? 'No AR invoices found' : 'Không có hóa đơn nào'}
                                </td></tr>
                            ) : rows.map(row => (
                                <tr key={row.id}
                                    className={`transition-colors hover:bg-[#0891B2]/4 ${row.isOverdue ? 'bg-[#B91C1C]/4' : ''}`}
                                    style={{ borderBottom: '1px solid #E2E8F0' }}
                                >
                                    <td className="px-3 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {row.isOverdue && <AlertCircle size={12} style={{ color: '#B91C1C' }} />}
                                            <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{row.invoiceNo}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3">
                                        <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{row.customerName}</p>
                                        <p className="text-xs" style={{ color: '#64748B' }}>{row.customerCode}</p>
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#475569' }}>{row.soNo ?? '–'}</td>
                                    <td className="px-3 py-3 text-sm font-bold" style={{ color: '#0F172A' }}>{formatVND(row.amount)}</td>
                                    <td className="px-3 py-3 text-sm" style={{ color: '#15803D' }}>{formatVND(row.paidAmount)}</td>
                                    <td className="px-3 py-3 text-sm font-bold" style={{ color: row.outstanding > 0 ? '#B45309' : '#15803D' }}>
                                        {formatVND(row.outstanding)}
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: row.isOverdue ? '#B91C1C' : '#475569' }}>
                                        {formatDate(row.dueDate)}
                                        {row.isOverdue && row.daysOverdue > 0 && (
                                            <p className="font-bold" style={{ color: '#B91C1C' }}>+{row.daysOverdue}d</p>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {AR_STATUS[row.status] && (
                                            <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
                                                style={{ color: AR_STATUS[row.status].color, background: `${AR_STATUS[row.status].color}18` }}>
                                                {isEn ? AR_STATUS[row.status].labelEn : AR_STATUS[row.status].label}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3">
                                        {row.outstanding > 0 && row.status !== 'CANCELLED' && (
                                            <button onClick={() => onPayment(row.id)}
                                                className="px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer rounded bg-[#15803D]/15 hover:bg-[#15803D]/25 text-[#15803D] border border-[#15803D]/30"
                                            >
                                                {isEn ? 'Collect' : 'Ghi Thu'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function APMobileCard({ row, onPayment, isEn }: { row: APRow; onPayment: (id: string, outstanding: number) => void; isEn?: boolean }) {
    const isMultiCurrency = row.currency !== 'VND'
    const fmtFx = (val: number) => `${row.currency === 'USD' ? '$' : row.currency === 'EUR' ? '€' : row.currency + ' '}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

    return (
        <div className={`p-3.5 rounded-lg border bg-white shadow-xs space-y-2.5 ${row.isOverdue ? 'border-rose-300' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        {row.isOverdue && <AlertCircle size={13} className="text-rose-600 shrink-0" />}
                        <span className="font-mono font-bold text-xs text-[#0891B2]">{row.invoiceNo}</span>
                        {row.poNo && <span className="text-[11px] text-slate-500">• PO: {row.poNo}</span>}
                    </div>
                    <p className="font-semibold text-xs text-slate-900 mt-0.5">{row.supplierName}</p>
                    <p className="text-[10px] text-slate-500">{row.supplierCode}</p>
                </div>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0 ${
                    row.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                    row.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-800' :
                    row.isOverdue ? 'bg-rose-100 text-rose-800' :
                    'bg-amber-100 text-amber-800'
                }`}>
                    {row.status === 'PAID'
                        ? (isEn ? 'Paid' : 'Đã Trả')
                        : row.status === 'PARTIALLY_PAID'
                        ? (isEn ? 'Partially Paid' : 'Trả 1 Phần')
                        : row.isOverdue
                        ? (isEn ? 'Overdue' : 'Quá Hạn')
                        : (isEn ? 'Unpaid' : 'Chưa Trả')}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                <div>
                    <span className="text-slate-400 block text-[10px]">{isEn ? 'Invoice Amount' : 'Giá trị hóa đơn'}</span>
                    <p className="font-bold text-slate-900 text-xs">{isMultiCurrency ? fmtFx(row.amount) : formatVND(row.amount)}</p>
                    {isMultiCurrency && <p className="text-[10px] text-slate-500">≈ {formatVND(row.amountVND)}</p>}
                </div>
                <div>
                    <span className="text-slate-400 block text-[10px]">{isEn ? 'Remaining Payable' : 'Còn phải trả'}</span>
                    <p className={`font-bold text-xs ${row.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {isMultiCurrency ? fmtFx(row.outstanding) : formatVND(row.outstanding)}
                    </p>
                    {isMultiCurrency && row.outstanding > 0 && (
                        <p className="text-[10px] text-slate-500">≈ {formatVND(row.outstandingVND)}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div className="text-[11px]">
                    <span className="text-slate-500">{isEn ? 'Due: ' : 'Hạn TT: '}</span>
                    <span className={row.isOverdue ? 'font-bold text-rose-600' : 'text-slate-700'}>
                        {formatDate(row.dueDate)}
                    </span>
                </div>
                {row.outstanding > 0 && (
                    <button
                        onClick={() => onPayment(row.id, row.outstanding)}
                        className="px-3 py-1 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer"
                    >
                        {isEn ? 'Pay' : 'Ghi Trả'}
                    </button>
                )}
            </div>
        </div>
    )
}

interface Props {
    initialAR: ARRow[]
    initialARTotal: number
    initialAP: APRow[]
    initialAPTotal: number
    stats: { arTotal: number; arOverdue: number; apTotal: number; apOverdue: number; monthRevenue: number; arOverdueCount: number; apOverdueCount: number }
    agingBuckets: Record<string, number>
    userId: string
}

export function FinanceClient({ initialAR, initialARTotal, initialAP, initialAPTotal, stats, agingBuckets, userId }: Props) {
    const { locale, isEn } = useAppLocale()
    const L = getFinanceLabels(locale)
    const [tab, setTab] = useState<Tab>('ar')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const urlTab = params.get('tab') as Tab
            if (urlTab && ['ar', 'ap', 'aging', 'invoice-reconcile', 'journal', 'pnl', 'bs', 'trialbalance', 'ledger', 'expense', 'period', 'baddebt', 'cashflow'].includes(urlTab)) {
                setTab(urlTab)
            }
        }
    }, [])
    const [arRows, setArRows] = useState(initialAR)
    const [arTotal, setArTotal] = useState(initialARTotal)
    const [apRows, setApRows] = useState(initialAP)
    const [apTotal, setApTotal] = useState(initialAPTotal)
    const [arSearch, setArSearch] = useState('')
    const [arStatus, setArStatus] = useState('')
    const [arPage, setArPage] = useState(1)
    const [apSearch, setApSearch] = useState('')
    const [apStatus, setApStatus] = useState('')
    const [apPage, setApPage] = useState(1)
    const [paymentModal, setPaymentModal] = useState<string | null>(null)
    const [apPaymentModal, setApPaymentModal] = useState<string | null>(null)
    const [payAmount, setPayAmount] = useState('')
    const [payMethod, setPayMethod] = useState('BANK_TRANSFER')
    const [payReference, setPayReference] = useState('')
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
    const [payLoading, setPayLoading] = useState(false)

    const reloadAR = useCallback(async (search?: string, status?: string, page?: number) => {
        const result = await getARInvoices({
            search: (search ?? arSearch) || undefined,
            status: (status ?? arStatus) || undefined,
            page: page ?? arPage,
            pageSize: 25,
        })
        setArRows(result.rows)
        setArTotal(result.total)
    }, [arSearch, arStatus, arPage])

    const reloadAP = useCallback(async (search?: string, status?: string, page?: number) => {
        const result = await getAPInvoices({
            search: (search ?? apSearch) || undefined,
            status: (status ?? apStatus) || undefined,
            page: page ?? apPage,
            pageSize: 25,
        })
        setApRows(result.rows)
        setApTotal(result.total)
    }, [apSearch, apStatus, apPage])

    const handlePayment = async () => {
        if (!paymentModal || !payAmount) return
        setPayLoading(true)
        toast.promise(
            recordARPayment(paymentModal, Number(payAmount), payMethod).then(async (result: any) => {
                if (!result.success) throw new Error(result.error || (isEn ? 'Payment failed' : 'Thanh toán thất bại'))
                const { rows } = await getARInvoices({ pageSize: 25 })
                setArRows(rows)
                setPaymentModal(null)
                setPayAmount('')
                return result
            }),
            {
                loading: isEn ? 'Recording AR payment...' : 'Đang ghi nhận AR...',
                success: isEn ? 'AR payment recorded!' : 'Đã ghi nhận thanh toán AR!',
                error: (err: any) => `${isEn ? 'Error' : 'Lỗi'}: ${err.message}`,
                finally: () => setPayLoading(false)
            }
        )
    }

    const handleAPPayment = async () => {
        if (!apPaymentModal || !payAmount) return
        setPayLoading(true)
        toast.promise(
            recordAPPayment(apPaymentModal, Number(payAmount), payMethod, payReference || undefined).then(async (result: any) => {
                if (!result.success) throw new Error(result.error || (isEn ? 'Recording failed' : 'Ghi nhận thất bại'))
                const { rows } = await getAPInvoices({ pageSize: 25 })
                setApRows(rows)
                setApPaymentModal(null)
                setPayAmount('')
                setPayReference('')
                return result
            }),
            {
                loading: isEn ? 'Recording AP payment...' : 'Đang ghi nhận AP...',
                success: isEn ? 'AP payment recorded!' : 'Đã ghi nhận thanh toán AP!',
                error: (err: any) => `${isEn ? 'Error' : 'Lỗi'}: ${err.message}`,
                finally: () => setPayLoading(false)
            }
        )
    }

    // Tab groups: Operational (AR/AP) | Accounting (Journal/Reports)
    const tabs: { key: Tab; label: string; icon: React.FC<any>; group: 'ops' | 'acct' }[] = [
        // Operational — Quản lý công nợ
        { key: 'ar', label: L.tabAr, icon: ArrowUpRight, group: 'ops' },
        { key: 'ap', label: L.tabAp, icon: ArrowDownRight, group: 'ops' },
        { key: 'aging', label: 'AR Aging', icon: Clock, group: 'ops' },
        { key: 'invoice-reconcile', label: L.tabInvoiceRecon, icon: FileCheck2, group: 'ops' },
        { key: 'bank-reconcile', label: L.tabBankRecon, icon: Building2, group: 'ops' },
        // Accounting — Kế toán (export to external SW)
        { key: 'journal', label: L.tabJournal, icon: BookOpen, group: 'acct' },
        { key: 'pnl', label: 'P&L', icon: BarChart3, group: 'acct' },
        { key: 'bs', label: L.tabBalanceSheet, icon: ReceiptText, group: 'acct' },
        { key: 'trialbalance', label: L.tabTrialBalance, icon: Table2, group: 'acct' },
        { key: 'ledger', label: L.tabLedger, icon: Search, group: 'acct' },
        { key: 'expense', label: L.tabExpenses, icon: Wallet, group: 'acct' },
        { key: 'period', label: L.tabClosing, icon: Lock, group: 'acct' },
        { key: 'cashflow', label: L.tabCashFlow, icon: Banknote, group: 'acct' },
        { key: 'baddebt', label: L.tabBadDebt, icon: Skull, group: 'acct' },
    ]

    const apHeaders = isEn
        ? ['Invoice No.', 'Supplier', 'PO', 'Amount', 'FX Rate', 'Remaining', 'Due Date', 'Status', '']
        : ['Số HĐ', 'Nhà Cung Cấp', 'PO', 'Giá Trị', 'Tỷ Giá', 'Còn Lại', 'Hạn TT', 'Trạng Thái', '']

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title={L.headerTitle}
                description={L.headerSubtitle}
                actions={
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                        <div className="w-2 h-2 rounded-full bg-amber-600" />
                        <div>
                            <p className="text-xs font-bold text-amber-800">Export-Only</p>
                            <p className="text-[10px] text-slate-500">
                                {isEn ? 'Export GL entries → Accounting SW' : 'Xuất bút toán → PM kế toán'}
                            </p>
                        </div>
                    </div>
                }
            />

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <FinKpiCard label={L.tabAr} value={`₫${(stats.arTotal / 1e9).toFixed(2)}T`} accent="#0E7490" icon={ArrowUpRight} />
                <FinKpiCard label={isEn ? 'AR Overdue' : 'AR Quá Hạn'} value={`₫${(stats.arOverdue / 1e6).toFixed(0)}M`} sub={`${stats.arOverdueCount} ${isEn ? 'invoices' : 'hóa đơn'}`} accent="#B91C1C" icon={AlertCircle} />
                <FinKpiCard label={L.tabAp} value={`₫${(stats.apTotal / 1e9).toFixed(2)}T`} accent="#B45309" icon={ArrowDownRight} />
                <FinKpiCard label={isEn ? 'AP Overdue' : 'AP Quá Hạn'} value={`₫${(stats.apOverdue / 1e6).toFixed(0)}M`} sub={`${stats.apOverdueCount} ${isEn ? 'invoices' : 'hóa đơn'}`} accent="#B45309" icon={AlertCircle} />
                <FinKpiCard label={isEn ? 'Monthly Revenue' : 'Doanh Thu Tháng'} value={`₫${(stats.monthRevenue / 1e9).toFixed(2)}T`} accent="#15803D" icon={TrendingDown} />
            </div>

            {/* Tabs — 2 groups: Operational | Accounting */}
            <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#E2E8F0 transparent' }}>
                <div className="flex items-center gap-1 p-1 rounded-md" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', width: 'max-content', minWidth: '100%' }}>
                    {/* Group: Operational */}
                    <span className="text-xs font-bold uppercase tracking-wider px-2" style={{ color: '#64748B' }}>
                        {isEn ? 'Operations' : 'Vận hành'}
                    </span>
                    {tabs.filter(t => t.group === 'ops').map(t => {
                        const Icon = t.icon
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all rounded whitespace-nowrap"
                                style={{
                                    background: tab === t.key ? '#FFFFFF' : 'transparent',
                                    color: tab === t.key ? '#0E7490' : '#64748B',
                                }}>
                                <Icon size={13} />
                                {t.label}
                            </button>
                        )
                    })}
                    {/* Divider */}
                    <div className="w-px h-6 mx-1" style={{ background: '#E2E8F0' }} />
                    {/* Group: Accounting */}
                    <span className="text-xs font-bold uppercase tracking-wider px-2" style={{ color: '#64748B' }}>
                        {isEn ? 'Accounting' : 'Kế toán'}
                    </span>
                    {tabs.filter(t => t.group === 'acct').map(t => {
                        const Icon = t.icon
                        return (
                            <button key={t.key} onClick={() => setTab(t.key)}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all rounded whitespace-nowrap"
                                style={{
                                    background: tab === t.key ? '#FFFFFF' : 'transparent',
                                    color: tab === t.key ? '#B45309' : '#64748B',
                                }}>
                                <Icon size={13} />
                                {t.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content */}
            {tab === 'ar' && (
                <div className="space-y-3">
                    <FilterBar
                        searchValue={arSearch}
                        searchPlaceholder={L.searchArPlaceholder}
                        onSearchChange={v => { setArSearch(v); setArPage(1); reloadAR(v, undefined, 1) }}
                        filters={[{
                            key: 'arStatus', label: L.allStatuses,
                            options: Object.entries(AR_STATUS).map(([k, v]) => ({ value: k, label: isEn ? v.labelEn : v.label })),
                            value: arStatus,
                            onChange: v => { setArStatus(v); setArPage(1); reloadAR(undefined, v, 1) },
                        }]}
                        onClearAll={() => { setArSearch(''); setArStatus(''); setArPage(1); reloadAR('', '', 1) }}
                    />
                    <ARTable rows={arRows} onPayment={setPaymentModal} isEn={isEn} />
                    <Pagination page={arPage} pageSize={25} total={arTotal}
                        onPageChange={p => { setArPage(p); reloadAR(undefined, undefined, p) }} />
                </div>
            )}

            {tab === 'ap' && (
                <div className="space-y-3">
                    <FilterBar
                        searchValue={apSearch}
                        searchPlaceholder={L.searchApPlaceholder}
                        onSearchChange={v => { setApSearch(v); setApPage(1); reloadAP(v, undefined, 1) }}
                        filters={[{
                            key: 'apStatus', label: L.allStatuses,
                            options: [
                                { value: 'UNPAID', label: L.apStatusUnpaid },
                                { value: 'PARTIALLY_PAID', label: L.apStatusPartial },
                                { value: 'PAID', label: L.apStatusPaid },
                            ],
                            value: apStatus,
                            onChange: v => { setApStatus(v); setApPage(1); reloadAP(undefined, v, 1) },
                        }]}
                        onClearAll={() => { setApSearch(''); setApStatus(''); setApPage(1); reloadAP('', '', 1) }}
                    />
                    {/* Mobile AP Cards */}
                    <div className="block md:hidden space-y-3">
                        {apRows.length === 0 ? (
                            <div className="text-center py-12 text-sm bg-white rounded-md border border-slate-200" style={{ color: '#64748B' }}>
                                {L.emptyApTitle}
                            </div>
                        ) : (
                            apRows.map(row => (
                                <APMobileCard
                                    key={row.id}
                                    row={row}
                                    isEn={isEn}
                                    onPayment={(id, outstanding) => {
                                        setApPaymentModal(id)
                                        setPayAmount(String(Math.round(outstanding)))
                                    }}
                                />
                            ))
                        )}
                    </div>

                    {/* Desktop AP Table */}
                    <div className="hidden md:block rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                        <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                        {apHeaders.map(h => (
                                            <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {apRows.length === 0 ? (
                                        <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>{L.emptyApTitle}</td></tr>
                                    ) : apRows.map(row => {
                                        const isMultiCurrency = row.currency !== 'VND'
                                        const fmtFx = (val: number) => `${row.currency === 'USD' ? '$' : row.currency === 'EUR' ? '€' : row.currency + ' '}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                                        return (
                                            <tr key={row.id}
                                                className={`transition-colors hover:bg-[#0891B2]/4 ${row.isOverdue ? 'bg-[#B91C1C]/4' : ''}`}
                                                style={{ borderBottom: '1px solid #E2E8F0' }}
                                            >
                                                <td className="px-3 py-3 text-xs font-bold" style={{ color: '#0891B2' }}>{row.invoiceNo}</td>
                                                <td className="px-3 py-3">
                                                    <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{row.supplierName}</p>
                                                    <p className="text-xs" style={{ color: '#64748B' }}>{row.supplierCode}</p>
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: '#475569' }}>{row.poNo ?? '–'}</td>
                                                <td className="px-3 py-3">
                                                    <p className="text-sm font-bold" style={{ color: '#0F172A' }}>
                                                        {isMultiCurrency ? fmtFx(row.amount) : formatVND(row.amount)}
                                                    </p>
                                                    {isMultiCurrency && (
                                                        <p className="text-xs" style={{ color: '#64748B' }}>
                                                             ≈ {formatVND(row.amountVND)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className="text-xs font-bold" style={{ color: '#B45309' }}>{row.currency}</span>
                                                    {isMultiCurrency && (
                                                        <p className="text-xs" style={{ color: '#64748B' }}>
                                                            ×{row.exchangeRate.toLocaleString()}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <p className="text-sm font-bold" style={{ color: row.outstanding > 0 ? '#B45309' : '#15803D' }}>
                                                        {isMultiCurrency ? fmtFx(row.outstanding) : formatVND(row.outstanding)}
                                                    </p>
                                                    {isMultiCurrency && row.outstanding > 0 && (
                                                        <p className="text-xs" style={{ color: '#64748B' }}>
                                                             ≈ {formatVND(row.outstandingVND)}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-xs" style={{ color: row.isOverdue ? '#B91C1C' : '#475569' }}>{formatDate(row.dueDate)}</td>
                                                <td className="px-3 py-3">
                                                    <span className="inline-block text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"
                                                        style={{
                                                            background: row.status === 'PAID' ? 'rgba(21,128,61,0.15)' : row.isOverdue ? 'rgba(185,28,28,0.15)' : 'rgba(180,83,9,0.15)',
                                                            color: row.status === 'PAID' ? '#15803D' : row.isOverdue ? '#B91C1C' : '#B45309',
                                                        }}>
                                                        {row.status === 'PAID'
                                                            ? L.apStatusPaid
                                                            : row.status === 'PARTIALLY_PAID'
                                                            ? L.apStatusPartial
                                                            : row.isOverdue
                                                            ? L.apStatusOverdue
                                                            : L.apStatusUnpaid}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {row.outstanding > 0 && (
                                                        <button onClick={() => { setApPaymentModal(row.id); setPayAmount(String(Math.round(row.outstanding))); }}
                                                            className="px-2.5 py-1 text-xs font-semibold cursor-pointer rounded bg-[#B45309]/15 hover:bg-[#B45309]/25 text-[#B45309] border border-[#B45309]/30">
                                                            {isEn ? 'Pay' : 'Ghi Trả'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <Pagination page={apPage} pageSize={25} total={apTotal}
                        onPageChange={p => { setApPage(p); reloadAP(undefined, undefined, p) }} />
                </div>
            )}

            {tab === 'aging' && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <button onClick={async () => {
                            try {
                                const { exportARAgingExcel } = await import('./actions')
                                const base64 = await exportARAgingExcel()
                                const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
                                    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url; a.download = `AR_Aging_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
                                URL.revokeObjectURL(url)
                                toast.success(isEn ? 'Exported AR Aging Excel' : 'Đã xuất AR Aging Excel')
                            } catch { toast.error(isEn ? 'Failed to export Excel' : 'Lỗi xuất Excel') }
                        }} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-md font-semibold"
                            style={{ border: '1px solid #E2E8F0', color: '#B45309' }}>
                            <ArrowDownRight size={13} /> Export AR Aging Excel
                        </button>
                    </div>
                    <AgingBars buckets={agingBuckets} isEn={isEn} />
                </div>
            )}

            {tab === 'invoice-reconcile' && <InvoiceReconciliationTab />}

            {tab === 'bank-reconcile' && <BankReconciliationTab />}

            {tab === 'journal' && <JournalEntryTab />}

            {tab === 'pnl' && <ProfitLossTab />}

            {tab === 'bs' && <BalanceSheetTab />}

            {tab === 'expense' && <ExpenseTab userId={userId} />}

            {tab === 'period' && <PeriodCloseTab userId={userId} />}

            {tab === 'baddebt' && <BadDebtTab userId={userId} />}

            {tab === 'cashflow' && <CashFlowTab />}

            {tab === 'trialbalance' && <TrialBalanceTab />}

            {tab === 'ledger' && <AccountLedgerTab />}

            {/* AR Payment modal */}
            {paymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
                    <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-md"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 24px 64px rgba(15, 23, 42, 0.45)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#0F172A' }}>{L.modalArPaymentTitle}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldCollectAmount}</label>
                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldPaymentMethod}</label>
                                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}>
                                        <option value="BANK_TRANSFER">{L.methodBankTransfer}</option>
                                        <option value="CASH">{L.methodCash}</option>
                                        <option value="COD">COD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{isEn ? 'Payment Date' : 'Ngày Thanh Toán'}</label>
                                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                                        className="w-full px-3 py-2.5 text-sm outline-none"
                                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }} />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldReference}</label>
                                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                                    placeholder={isEn ? 'Bank reference, Tx ID...' : 'Số chứng từ NH, mã GD...'}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => { setPaymentModal(null); setPayReference(''); setPayDate(new Date().toISOString().slice(0, 10)) }} className="px-4 py-2 text-sm"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '6px' }}>{L.cancelBtn}</button>
                            <button onClick={handlePayment} disabled={payLoading || !payAmount}
                                className="px-5 py-2 text-sm font-semibold transition-all"
                                style={{ background: '#0E7490', color: '#FFFFFF', borderRadius: '6px' }}>
                                {payLoading ? L.processingText : L.confirmCollectBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AP Payment modal */}
            {apPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
                    <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-md"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 24px 64px rgba(15, 23, 42, 0.45)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#0F172A' }}>{L.modalApPaymentTitle}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldPayAmount}</label>
                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldPaymentMethod}</label>
                                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}>
                                    <option value="BANK_TRANSFER">{L.methodBankTransfer}</option>
                                    <option value="CASH">{L.methodCash}</option>
                                    <option value="CHECK">{L.methodCheck}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{L.fieldReference}</label>
                                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                                    placeholder={isEn ? 'Document no., Tx ID...' : 'Số chứng từ, mã GD...'}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => setApPaymentModal(null)} className="px-4 py-2 text-sm"
                                style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '6px' }}>{L.cancelBtn}</button>
                            <button onClick={handleAPPayment} disabled={payLoading || !payAmount}
                                className="px-5 py-2 text-sm font-semibold"
                                style={{ background: '#D97706', color: '#FFFFFF', borderRadius: '6px' }}>
                                {payLoading ? L.processingText : L.confirmPayBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
