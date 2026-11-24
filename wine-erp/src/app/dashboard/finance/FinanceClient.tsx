'use client'

import { useState, useCallback, useEffect } from 'react'
import { TrendingDown, AlertCircle, Clock, ReceiptText, ArrowUpRight, ArrowDownRight, BookOpen, BarChart3, Wallet, Lock, Skull, Banknote, Table2, Search, FileCheck2, Building2, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ARRow, APRow, getARInvoices, getAPInvoices, recordARPayment, recordAPPayment } from './actions'
import { syncKnbsTaPaymentsAction } from './actions-knbs-sync'
import { formatVND, formatDate } from '@/lib/utils'
import { JournalEntryTab, ProfitLossTab, ExpenseTab, PeriodCloseTab, BalanceSheetTab, BadDebtTab, CashFlowTab, TrialBalanceTab, AccountLedgerTab } from './FinanceTabs'
import { InvoiceReconciliationTab } from './InvoiceReconciliationTab'
import { BankReconciliationTab } from './BankReconciliationTab'
import { ParentPaymentImportTab } from './ParentPaymentImportTab'
import {
    PageContainer, PageHeader, StatGrid, StatCard, Card, Badge, StatusBadge, StatusTabs,
    Button, Toolbar, SearchInput, Select, Modal, Field, Input,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow, EmptyState, Pagination,
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getFinanceLabels } from './i18n'

type Tab = 'ar' | 'ap' | 'aging' | 'invoice-reconcile' | 'bank-reconcile' | 'parent-payment' | 'journal' | 'pnl' | 'bs' | 'trialbalance' | 'ledger' | 'expense' | 'period' | 'baddebt' | 'cashflow'

const AR_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
    UNPAID: { label: 'Chưa Thu', labelEn: 'Unpaid', color: '#B45309' },
    PARTIALLY_PAID: { label: 'Đã Thu 1 Phần', labelEn: 'Partially Paid', color: '#1D4ED8' },
    PAID: { label: 'Đã Thu Đủ', labelEn: 'Paid', color: '#15803D' },
    OVERDUE: { label: 'Quá Hạn', labelEn: 'Overdue', color: '#B91C1C' },
    CANCELLED: { label: 'Huỷ', labelEn: 'Cancelled', color: '#64748B' },
}

function AgingBars({ buckets, isEn }: { buckets: Record<string, number>; isEn?: boolean }) {
    const total = Object.values(buckets).reduce((a, b) => a + b, 0)
    const bars = [
        { label: isEn ? 'Current' : 'Chưa Đến Hạn', key: 'current', barClass: 'bg-tone-success-fg', textClass: 'text-tone-success-fg' },
        { label: isEn ? '1–30 Days' : '1–30 Ngày', key: 'd30', barClass: 'bg-tone-warning-fg', textClass: 'text-tone-warning-fg' },
        { label: isEn ? '31–60 Days' : '31–60 Ngày', key: 'd60', barClass: 'bg-amber-600', textClass: 'text-tone-warning-fg' },
        { label: isEn ? '61–90 Days' : '61–90 Ngày', key: 'd90', barClass: 'bg-orange-600', textClass: 'text-tone-warning-fg' },
        { label: isEn ? '> 90 Days' : '> 90 Ngày', key: 'over90', barClass: 'bg-tone-danger-fg', textClass: 'text-tone-danger-fg' },
    ]

    return (
        <Card className="p-5">
            <h3 className="text-sm font-semibold text-lys-primary mb-4">
                {isEn ? 'AR Aging Report – Receivables Aging Analysis' : 'AR Aging Report – Phân Tầng Công Nợ'}
            </h3>
            <div className="space-y-3">
                {bars.map(b => {
                    const val = (buckets as any)[b.key] ?? 0
                    const pct = total > 0 ? (val / total) * 100 : 0
                    return (
                        <div key={b.key}>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs text-lys-secondary">{b.label}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold font-mono text-lys-primary">
                                        {formatVND(val)}
                                    </span>
                                    <span className={`text-xs font-mono w-12 text-right ${b.textClass}`}>{pct.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-lys-border">
                                <div className={`h-full rounded-full transition-all duration-500 ${b.barClass}`}
                                    style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between pt-4 mt-4 border-t border-lys-border">
                <span className="text-sm font-semibold text-lys-secondary">
                    {isEn ? 'Total AR Outstanding' : 'Tổng AR Outstanding'}
                </span>
                <span className="text-sm font-bold font-mono text-lys-teal-strong">
                    {formatVND(total)}
                </span>
            </div>
        </Card>
    )
}

function ARMobileCard({ row, onPayment, isEn }: { row: ARRow; onPayment: (id: string) => void; isEn?: boolean }) {
    const st = AR_STATUS[row.status]
    return (
        <Card className={`p-3.5 space-y-2.5 ${row.isOverdue ? 'border-tone-danger-border' : ''}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        {row.isOverdue && <AlertCircle size={13} className="text-tone-danger-fg shrink-0" />}
                        <span className="font-mono font-bold text-xs text-lys-teal-strong">{row.invoiceNo}</span>
                        {row.soNo && <span className="text-[11px] text-lys-muted">• SO: {row.soNo}</span>}
                    </div>
                    <p className="font-semibold text-xs text-lys-primary mt-0.5">{row.customerName}</p>
                    <p className="text-[11px] text-lys-muted">{row.customerCode}</p>
                </div>
                {st && (
                    <StatusBadge
                        status={row.status}
                        label={isEn ? st.labelEn : st.label}
                        toneOverrides={{ UNPAID: 'warning', OVERDUE: 'danger' }}
                    />
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-lys-border">
                <div>
                    <span className="text-lys-muted block text-[11px]">{isEn ? 'Total' : 'Tổng HĐ'}</span>
                    <span className="font-bold text-lys-primary text-xs font-mono">{formatVND(row.amount)}</span>
                </div>
                <div>
                    <span className="text-lys-muted block text-[11px]">{isEn ? 'Collected' : 'Đã thu'}</span>
                    <span className="font-medium text-tone-success-fg text-xs font-mono">{formatVND(row.paidAmount)}</span>
                </div>
                <div>
                    <span className="text-lys-muted block text-[11px]">{isEn ? 'Remaining' : 'Còn lại'}</span>
                    <span className={`font-bold text-xs font-mono ${row.outstanding > 0 ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                        {formatVND(row.outstanding)}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border text-xs">
                <div className="text-[11px]">
                    <span className="text-lys-muted">{isEn ? 'Due: ' : 'Hạn TT: '}</span>
                    <span className={row.isOverdue ? 'font-bold text-tone-danger-fg' : 'text-lys-secondary'}>
                        {formatDate(row.dueDate)}
                        {row.isOverdue && row.daysOverdue > 0 && ` (+${row.daysOverdue}d)`}
                    </span>
                </div>
                {row.outstanding > 0 && row.status !== 'CANCELLED' && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onPayment(row.id)}>
                        {isEn ? 'Collect' : 'Ghi Thu'}
                    </Button>
                )}
            </div>
        </Card>
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
                    <Card><EmptyState title={isEn ? 'No AR invoices found' : 'Không có hóa đơn nào'} /></Card>
                ) : (
                    rows.map(row => (
                        <ARMobileCard key={row.id} row={row} onPayment={onPayment} isEn={isEn} />
                    ))
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block [&>div]:max-h-[calc(100vh-420px)]">
                <Table>
                    <THead>
                        <tr>
                            {headers.map((h, i) => (
                                <Th key={h || 'actions'} align={i >= 3 && i <= 5 ? 'right' : i === 8 ? 'right' : 'left'}>{h}</Th>
                            ))}
                        </tr>
                    </THead>
                    <TBody>
                        {rows.length === 0 ? (
                            <TableMessageRow colSpan={9}>
                                <EmptyState title={isEn ? 'No AR invoices found' : 'Không có hóa đơn nào'} />
                            </TableMessageRow>
                        ) : rows.map(row => (
                            <Tr key={row.id} className={row.isOverdue ? 'bg-tone-danger-bg/40' : undefined}>
                                <Td>
                                    <div className="flex items-center gap-1.5">
                                        {row.isOverdue && <AlertCircle size={13} className="text-tone-danger-fg shrink-0" />}
                                        <span className="text-xs font-bold font-mono text-lys-teal-strong">{row.invoiceNo}</span>
                                    </div>
                                </Td>
                                <Td>
                                    <p className="text-[13px] font-medium text-lys-primary">{row.customerName}</p>
                                    <p className="text-[11px] text-lys-muted">{row.customerCode}</p>
                                </Td>
                                <Td className="text-xs text-lys-secondary font-mono">{row.soNo ?? '–'}</Td>
                                <Td align="right" className="font-bold text-lys-primary">{formatVND(row.amount)}</Td>
                                <Td align="right" className="text-tone-success-fg">{formatVND(row.paidAmount)}</Td>
                                <Td align="right" className={`font-bold ${row.outstanding > 0 ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                                    {formatVND(row.outstanding)}
                                </Td>
                                <Td className={`text-xs ${row.isOverdue ? 'text-tone-danger-fg' : 'text-lys-secondary'}`}>
                                    {formatDate(row.dueDate)}
                                    {row.isOverdue && row.daysOverdue > 0 && (
                                        <p className="text-[11px] font-bold text-tone-danger-fg">+{row.daysOverdue}d</p>
                                    )}
                                </Td>
                                <Td>
                                    {AR_STATUS[row.status] && (
                                        <StatusBadge
                                            status={row.status}
                                            label={isEn ? AR_STATUS[row.status].labelEn : AR_STATUS[row.status].label}
                                            toneOverrides={{ UNPAID: 'warning', OVERDUE: 'danger' }}
                                        />
                                    )}
                                </Td>
                                <Td align="right">
                                    {row.outstanding > 0 && row.status !== 'CANCELLED' && (
                                        <button type="button" onClick={() => onPayment(row.id)}
                                            className="px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer rounded-md bg-tone-success-bg hover:bg-emerald-100 text-tone-success-fg border border-tone-success-border"
                                        >
                                            {isEn ? 'Collect' : 'Ghi Thu'}
                                        </button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>
        </div>
    )
}

function APMobileCard({ row, onPayment, isEn }: { row: APRow; onPayment: (id: string, outstanding: number) => void; isEn?: boolean }) {
    const isMultiCurrency = row.currency !== 'VND'
    const fmtFx = (val: number) => `${row.currency === 'USD' ? '$' : row.currency === 'EUR' ? '€' : row.currency + ' '}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    const apTone = row.status === 'PAID' ? 'success' : row.status === 'PARTIALLY_PAID' ? 'info' : row.isOverdue ? 'danger' : 'warning'
    const apLabel = row.status === 'PAID'
        ? (isEn ? 'Paid' : 'Đã Trả')
        : row.status === 'PARTIALLY_PAID'
        ? (isEn ? 'Partially Paid' : 'Trả 1 Phần')
        : row.isOverdue
        ? (isEn ? 'Overdue' : 'Quá Hạn')
        : (isEn ? 'Unpaid' : 'Chưa Trả')

    return (
        <Card className={`p-3.5 space-y-2.5 ${row.isOverdue ? 'border-tone-danger-border' : ''}`}>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex items-center gap-1.5">
                        {row.isOverdue && <AlertCircle size={13} className="text-tone-danger-fg shrink-0" />}
                        <span className="font-mono font-bold text-xs text-lys-teal-strong">{row.invoiceNo}</span>
                        {row.poNo && <span className="text-[11px] text-lys-muted">• PO: {row.poNo}</span>}
                    </div>
                    <p className="font-semibold text-xs text-lys-primary mt-0.5">{row.supplierName}</p>
                    <p className="text-[11px] text-lys-muted">{row.supplierCode}</p>
                </div>
                <Badge tone={apTone}>{apLabel}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-lys-border">
                <div>
                    <span className="text-lys-muted block text-[11px]">{isEn ? 'Invoice Amount' : 'Giá trị hóa đơn'}</span>
                    <p className="font-bold text-lys-primary text-xs font-mono">{isMultiCurrency ? fmtFx(row.amount) : formatVND(row.amount)}</p>
                    {isMultiCurrency && <p className="text-[11px] text-lys-muted font-mono">≈ {formatVND(row.amountVND)}</p>}
                </div>
                <div>
                    <span className="text-lys-muted block text-[11px]">{isEn ? 'Remaining Payable' : 'Còn phải trả'}</span>
                    <p className={`font-bold text-xs font-mono ${row.outstanding > 0 ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                        {isMultiCurrency ? fmtFx(row.outstanding) : formatVND(row.outstanding)}
                    </p>
                    {isMultiCurrency && row.outstanding > 0 && (
                        <p className="text-[11px] text-lys-muted font-mono">≈ {formatVND(row.outstandingVND)}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border text-xs">
                <div className="text-[11px]">
                    <span className="text-lys-muted">{isEn ? 'Due: ' : 'Hạn TT: '}</span>
                    <span className={row.isOverdue ? 'font-bold text-tone-danger-fg' : 'text-lys-secondary'}>
                        {formatDate(row.dueDate)}
                    </span>
                </div>
                {row.outstanding > 0 && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onPayment(row.id, row.outstanding)}>
                        {isEn ? 'Pay' : 'Ghi Trả'}
                    </Button>
                )}
            </div>
        </Card>
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
            if (urlTab && ['ar', 'ap', 'aging', 'invoice-reconcile', 'bank-reconcile', 'parent-payment', 'journal', 'pnl', 'bs', 'trialbalance', 'ledger', 'expense', 'period', 'baddebt', 'cashflow'].includes(urlTab)) {
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

    const [knbsSyncing, setKnbsSyncing] = useState(false)

    const handleKnbsSync = async () => {
        if (knbsSyncing) return
        setKnbsSyncing(true)
        try {
            const res = await syncKnbsTaPaymentsAction()
            if (!res.success || !res.data) {
                toast.error(res.error || 'Đồng bộ KNBS thất bại')
                return
            }
            const d = res.data
            if (d.syncedCount > 0) {
                await reloadAR()
                toast.success(
                    `Đã đồng bộ ${d.syncedCount} chứng từ thu tiền Thắng Ân (${formatVND(d.totalSyncedAmount)}). Bỏ qua: ${d.skippedCount}, trùng: ${d.alreadySyncedCount}.`
                )
            } else {
                toast.info(
                    `KNBS Thắng Ân: không có chứng từ thu tiền mới (tổng quét: ${d.totalFetched}, trùng: ${d.alreadySyncedCount}, bỏ qua MST: ${d.skippedCount}).`
                )
            }
        } catch (err: any) {
            toast.error(`Lỗi đồng bộ KNBS: ${err?.message || 'Không xác định'}`)
        } finally {
            setKnbsSyncing(false)
        }
    }

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
        { key: 'parent-payment', label: L.tabParentPayment, icon: FileSpreadsheet, group: 'ops' },
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

    const opsTabs = tabs.filter(t => t.group === 'ops')
    const acctTabs = tabs.filter(t => t.group === 'acct')
    const activeGroup: 'ops' | 'acct' = tabs.find(t => t.key === tab)?.group ?? 'ops'

    const apHeaders = isEn
        ? ['Invoice No.', 'Supplier', 'PO', 'Amount', 'FX Rate', 'Remaining', 'Due Date', 'Status', '']
        : ['Số HĐ', 'Nhà Cung Cấp', 'PO', 'Giá Trị', 'Tỷ Giá', 'Còn Lại', 'Hạn TT', 'Trạng Thái', '']

    return (
        <PageContainer>
            {/* Header */}
            <PageHeader
                description={L.headerSubtitle}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            tone="warning"
                            title={isEn ? 'Export GL entries → Accounting SW' : 'Xuất bút toán → Phần mềm kế toán'}
                        >
                            Export-Only
                        </Badge>
                        <Button
                            variant="primary"
                            size="sm"
                            loading={knbsSyncing}
                            onClick={handleKnbsSync}
                        >
                            {!knbsSyncing && <RefreshCw size={14} />}
                            {knbsSyncing
                                ? (isEn ? 'Syncing KNBS...' : 'Đang đồng bộ KNBS...')
                                : (isEn ? 'Sync KNBS (Thang An)' : 'Đồng bộ KNBS (Thắng Ân)')}
                        </Button>
                    </div>
                }
            />

            {/* KPIs */}
            <StatGrid cols={5}>
                <StatCard label={L.tabAr} value={`₫${(stats.arTotal / 1e9).toFixed(2)}T`} tone="brand" icon={ArrowUpRight} />
                <StatCard label={isEn ? 'AR Overdue' : 'AR Quá Hạn'} value={`₫${(stats.arOverdue / 1e6).toFixed(0)}M`} sub={`${stats.arOverdueCount} ${isEn ? 'invoices' : 'hóa đơn'}`} tone="danger" icon={AlertCircle} />
                <StatCard label={L.tabAp} value={`₫${(stats.apTotal / 1e9).toFixed(2)}T`} tone="warning" icon={ArrowDownRight} />
                <StatCard label={isEn ? 'AP Overdue' : 'AP Quá Hạn'} value={`₫${(stats.apOverdue / 1e6).toFixed(0)}M`} sub={`${stats.apOverdueCount} ${isEn ? 'invoices' : 'hóa đơn'}`} tone="warning" icon={AlertCircle} />
                <StatCard label={isEn ? 'Monthly Revenue' : 'Doanh Thu Tháng'} value={`₫${(stats.monthRevenue / 1e9).toFixed(2)}T`} tone="success" icon={TrendingDown} />
            </StatGrid>

            {/* 2-Tier Navigation: Domain Switch + Group Tabs */}
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center p-0.5 rounded-lg bg-lys-subtle border border-lys-border">
                        <button
                            type="button"
                            onClick={() => { if (activeGroup !== 'ops') setTab('ar') }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                                activeGroup === 'ops'
                                    ? 'bg-white text-lys-teal-strong font-semibold shadow-xs'
                                    : 'text-lys-muted hover:text-lys-primary font-medium'
                            }`}
                        >
                            <span>{isEn ? 'Operations & AR/AP' : 'Vận hành & Công nợ'}</span>
                            <span className="text-[11px] opacity-75">({opsTabs.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { if (activeGroup !== 'acct') setTab('journal') }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all cursor-pointer ${
                                activeGroup === 'acct'
                                    ? 'bg-white text-lys-teal-strong font-semibold shadow-xs'
                                    : 'text-lys-muted hover:text-lys-primary font-medium'
                            }`}
                        >
                            <span>{isEn ? 'Accounting & Reports' : 'Kế toán & Báo cáo'}</span>
                            <span className="text-[11px] opacity-75">({acctTabs.length})</span>
                        </button>
                    </div>
                </div>
                <StatusTabs
                    items={(activeGroup === 'ops' ? opsTabs : acctTabs).map(t => ({ value: t.key, label: t.label, icon: t.icon }))}
                    value={tab}
                    onChange={setTab}
                />
            </div>

            {/* Content */}
            {tab === 'ar' && (
                <div className="space-y-3">
                    <Toolbar
                        left={
                            <div className="flex flex-wrap items-center gap-2">
                                <SearchInput
                                    value={arSearch}
                                    onChange={e => { const v = e.target.value; setArSearch(v); setArPage(1); reloadAR(v, undefined, 1) }}
                                    placeholder={L.searchArPlaceholder}
                                    className="w-full sm:w-72"
                                />
                                <Select
                                    value={arStatus}
                                    onChange={e => { const v = e.target.value; setArStatus(v); setArPage(1); reloadAR(undefined, v, 1) }}
                                    className="w-full sm:w-44"
                                >
                                    <option value="">{L.allStatuses}</option>
                                    {Object.entries(AR_STATUS).map(([k, v]) => (
                                        <option key={k} value={k}>{isEn ? v.labelEn : v.label}</option>
                                    ))}
                                </Select>
                            </div>
                        }
                        right={(arSearch || arStatus) ? (
                            <Button variant="ghost" size="sm" onClick={() => { setArSearch(''); setArStatus(''); setArPage(1); reloadAR('', '', 1) }}>
                                {isEn ? 'Clear' : 'Xóa lọc'}
                            </Button>
                        ) : undefined}
                    />
                    <ARTable rows={arRows} onPayment={setPaymentModal} isEn={isEn} />
                    <Pagination page={arPage} pageSize={25} total={arTotal}
                        onPageChange={p => { setArPage(p); reloadAR(undefined, undefined, p) }} />
                </div>
            )}

            {tab === 'ap' && (
                <div className="space-y-3">
                    <Toolbar
                        left={
                            <div className="flex flex-wrap items-center gap-2">
                                <SearchInput
                                    value={apSearch}
                                    onChange={e => { const v = e.target.value; setApSearch(v); setApPage(1); reloadAP(v, undefined, 1) }}
                                    placeholder={L.searchApPlaceholder}
                                    className="w-full sm:w-72"
                                />
                                <Select
                                    value={apStatus}
                                    onChange={e => { const v = e.target.value; setApStatus(v); setApPage(1); reloadAP(undefined, v, 1) }}
                                    className="w-full sm:w-44"
                                >
                                    <option value="">{L.allStatuses}</option>
                                    <option value="UNPAID">{L.apStatusUnpaid}</option>
                                    <option value="PARTIALLY_PAID">{L.apStatusPartial}</option>
                                    <option value="PAID">{L.apStatusPaid}</option>
                                </Select>
                            </div>
                        }
                        right={(apSearch || apStatus) ? (
                            <Button variant="ghost" size="sm" onClick={() => { setApSearch(''); setApStatus(''); setApPage(1); reloadAP('', '', 1) }}>
                                {isEn ? 'Clear' : 'Xóa lọc'}
                            </Button>
                        ) : undefined}
                    />
                    {/* Mobile AP Cards */}
                    <div className="block md:hidden space-y-3">
                        {apRows.length === 0 ? (
                            <Card><EmptyState title={L.emptyApTitle} /></Card>
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
                    <div className="hidden md:block [&>div]:max-h-[calc(100vh-420px)]">
                        <Table>
                            <THead>
                                <tr>
                                    {apHeaders.map((h, i) => (
                                        <Th key={h || 'actions'} align={i === 3 || i === 5 || i === 8 ? 'right' : 'left'}>{h}</Th>
                                    ))}
                                </tr>
                            </THead>
                            <TBody>
                                {apRows.length === 0 ? (
                                    <TableMessageRow colSpan={9}>
                                        <EmptyState title={L.emptyApTitle} />
                                    </TableMessageRow>
                                ) : apRows.map(row => {
                                    const isMultiCurrency = row.currency !== 'VND'
                                    const fmtFx = (val: number) => `${row.currency === 'USD' ? '$' : row.currency === 'EUR' ? '€' : row.currency + ' '}${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                                    const apTone = row.status === 'PAID' ? 'success' : row.status === 'PARTIALLY_PAID' ? 'info' : row.isOverdue ? 'danger' : 'warning'
                                    const apLabel = row.status === 'PAID'
                                        ? L.apStatusPaid
                                        : row.status === 'PARTIALLY_PAID'
                                        ? L.apStatusPartial
                                        : row.isOverdue
                                        ? L.apStatusOverdue
                                        : L.apStatusUnpaid
                                    return (
                                        <Tr key={row.id} className={row.isOverdue ? 'bg-tone-danger-bg/40' : undefined}>
                                            <Td className="text-xs font-bold font-mono text-lys-teal-strong">{row.invoiceNo}</Td>
                                            <Td>
                                                <p className="text-[13px] font-medium text-lys-primary">{row.supplierName}</p>
                                                <p className="text-[11px] text-lys-muted">{row.supplierCode}</p>
                                            </Td>
                                            <Td className="text-xs text-lys-secondary font-mono">{row.poNo ?? '–'}</Td>
                                            <Td align="right">
                                                <p className="text-[13px] font-bold text-lys-primary font-mono">
                                                    {isMultiCurrency ? fmtFx(row.amount) : formatVND(row.amount)}
                                                </p>
                                                {isMultiCurrency && (
                                                    <p className="text-[11px] text-lys-muted font-mono">
                                                        ≈ {formatVND(row.amountVND)}
                                                    </p>
                                                )}
                                            </Td>
                                            <Td>
                                                <span className="text-xs font-bold text-tone-warning-fg">{row.currency}</span>
                                                {isMultiCurrency && (
                                                    <p className="text-[11px] text-lys-muted font-mono">
                                                        ×{row.exchangeRate.toLocaleString('vi-VN')}
                                                    </p>
                                                )}
                                            </Td>
                                            <Td align="right">
                                                <p className={`text-[13px] font-bold font-mono ${row.outstanding > 0 ? 'text-tone-warning-fg' : 'text-tone-success-fg'}`}>
                                                    {isMultiCurrency ? fmtFx(row.outstanding) : formatVND(row.outstanding)}
                                                </p>
                                                {isMultiCurrency && row.outstanding > 0 && (
                                                    <p className="text-[11px] text-lys-muted font-mono">
                                                        ≈ {formatVND(row.outstandingVND)}
                                                    </p>
                                                )}
                                            </Td>
                                            <Td className={`text-xs ${row.isOverdue ? 'text-tone-danger-fg font-semibold' : 'text-lys-secondary'}`}>
                                                {formatDate(row.dueDate)}
                                            </Td>
                                            <Td><Badge tone={apTone}>{apLabel}</Badge></Td>
                                            <Td align="right">
                                                {row.outstanding > 0 && (
                                                    <button type="button" onClick={() => { setApPaymentModal(row.id); setPayAmount(String(Math.round(row.outstanding))); }}
                                                        className="px-2.5 py-1 text-xs font-semibold cursor-pointer rounded-md bg-tone-warning-bg hover:bg-amber-100 text-tone-warning-fg border border-tone-warning-border">
                                                        {isEn ? 'Pay' : 'Ghi Trả'}
                                                    </button>
                                                )}
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>
                    <Pagination page={apPage} pageSize={25} total={apTotal}
                        onPageChange={p => { setApPage(p); reloadAP(undefined, undefined, p) }} />
                </div>
            )}

            {tab === 'aging' && (
                <div className="space-y-3">
                    <div className="flex justify-end">
                        <Button variant="secondary" size="sm" onClick={async () => {
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
                        }}>
                            <ArrowDownRight size={13} /> Export AR Aging Excel
                        </Button>
                    </div>
                    <AgingBars buckets={agingBuckets} isEn={isEn} />
                </div>
            )}

            {tab === 'invoice-reconcile' && <InvoiceReconciliationTab />}

            {tab === 'bank-reconcile' && <BankReconciliationTab />}

            {tab === 'parent-payment' && <ParentPaymentImportTab onDataChanged={() => reloadAR()} />}

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
            <Modal
                open={Boolean(paymentModal)}
                onClose={() => { setPaymentModal(null); setPayReference(''); setPayDate(new Date().toISOString().slice(0, 10)) }}
                title={L.modalArPaymentTitle}
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setPaymentModal(null); setPayReference(''); setPayDate(new Date().toISOString().slice(0, 10)) }}>
                            {L.cancelBtn}
                        </Button>
                        <Button variant="primary" loading={payLoading} disabled={!payAmount} onClick={handlePayment}>
                            {payLoading ? L.processingText : L.confirmCollectBtn}
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <Field label={L.fieldCollectAmount}>
                        {id => <Input id={id} type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />}
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.fieldPaymentMethod}>
                            {id => (
                                <Select id={id} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                    <option value="BANK_TRANSFER">{L.methodBankTransfer}</option>
                                    <option value="CASH">{L.methodCash}</option>
                                    <option value="COD">COD</option>
                                </Select>
                            )}
                        </Field>
                        <Field label={isEn ? 'Payment Date' : 'Ngày Thanh Toán'}>
                            {id => <Input id={id} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />}
                        </Field>
                    </div>
                    <Field label={L.fieldReference}>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                value={payReference}
                                onChange={e => setPayReference(e.target.value)}
                                placeholder={isEn ? 'Bank reference, Tx ID...' : 'Số chứng từ NH, mã GD...'}
                            />
                        )}
                    </Field>
                </div>
            </Modal>

            {/* AP Payment modal */}
            <Modal
                open={Boolean(apPaymentModal)}
                onClose={() => setApPaymentModal(null)}
                title={L.modalApPaymentTitle}
                size="sm"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setApPaymentModal(null)}>{L.cancelBtn}</Button>
                        <Button variant="primary" loading={payLoading} disabled={!payAmount} onClick={handleAPPayment}>
                            {payLoading ? L.processingText : L.confirmPayBtn}
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <Field label={L.fieldPayAmount}>
                        {id => <Input id={id} type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />}
                    </Field>
                    <Field label={L.fieldPaymentMethod}>
                        {id => (
                            <Select id={id} value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                <option value="BANK_TRANSFER">{L.methodBankTransfer}</option>
                                <option value="CASH">{L.methodCash}</option>
                                <option value="CHECK">{L.methodCheck}</option>
                            </Select>
                        )}
                    </Field>
                    <Field label={L.fieldReference}>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                value={payReference}
                                onChange={e => setPayReference(e.target.value)}
                                placeholder={isEn ? 'Document no., Tx ID...' : 'Số chứng từ, mã GD...'}
                            />
                        )}
                    </Field>
                </div>
            </Modal>
        </PageContainer>
    )
}
