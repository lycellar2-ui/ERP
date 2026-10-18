'use client'

import { useState, useCallback } from 'react'
import { BookOpen, Loader2, TrendingUp, TrendingDown, Filter, Plus, CheckCircle2, XCircle, Lock, AlertTriangle, CircleCheck, Download } from 'lucide-react'
import { toast } from 'sonner'
import {
    JournalEntryRow, getJournalEntries,
    PLRow, getProfitLoss, getProfitLossComparison, exportProfitLossExcel,
    getAccountingPeriods, closeAccountingPeriod,
    ExpenseRow, getExpenses, createExpense, approveExpense, rejectExpense,
    PeriodCloseCheckItem, getPeriodCloseChecklist,
    BSLineItem, getBalanceSheet, exportBalanceSheetExcel,
    BadDebtCandidate, getBadDebtCandidates, writeOffBadDebt,
    CashPositionData, getCashPosition,
    CashFlowBucket, CashFlowForecastData, getCashFlowForecast,
    CreditHoldResult, autoCheckCreditHold,
    exportARAgingExcel,
    exportVATDeclarationExcel,
    exportSCTDeclarationExcel,
    TrialBalanceData, getTrialBalance,
    AccountLedgerData, getAccountLedger,
    createManualJournal,
} from './actions'
import { VAS_ACCOUNTS } from '@/lib/finance-integration'
import { formatVND, formatDate } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'

const card: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }

const DOC_TYPE_LABEL: Record<string, string> = {
    GOODS_RECEIPT: 'Nhập kho',
    SALES_INVOICE: 'Bán hàng',
    PAYMENT_IN: 'Thu tiền',
    PAYMENT_OUT: 'Chi tiền',
    COGS: 'Giá vốn',
    EXPENSE: 'Chi phí',
    ADJUSTMENT: 'Điều chỉnh',
}

const DOC_TYPE_LABEL_EN: Record<string, string> = {
    GOODS_RECEIPT: 'Goods Receipt',
    SALES_INVOICE: 'Sales Invoice',
    PAYMENT_IN: 'Cash In',
    PAYMENT_OUT: 'Cash Out',
    COGS: 'COGS',
    EXPENSE: 'Expense',
    ADJUSTMENT: 'Adjustment',
}

const DOC_TYPE_COLOR: Record<string, string> = {
    GOODS_RECEIPT: '#1D4ED8',
    SALES_INVOICE: '#15803D',
    PAYMENT_IN: '#0E7490',
    PAYMENT_OUT: '#B45309',
    COGS: '#B91C1C',
    EXPENSE: '#B91C1C',
}

// ── Journal Entry Tab ─────────────────────────
export function JournalEntryTab() {
    const { isEn } = useAppLocale()
    const [entries, setEntries] = useState<JournalEntryRow[]>([])
    const [total, setTotal] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [docFilter, setDocFilter] = useState('')

    // Export panel state
    const [showExport, setShowExport] = useState(false)
    const now = new Date()
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const today = now.toISOString().slice(0, 10)
    const [exportFrom, setExportFrom] = useState(firstOfMonth)
    const [exportTo, setExportTo] = useState(today)
    const [exportStats, setExportStats] = useState<any>(null)
    const [statsLoading, setStatsLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    const loadEntries = useCallback(async (docType?: string) => {
        setLoading(true)
        const data = await getJournalEntries({ docType: docType || undefined, pageSize: 100 })
        setEntries(data.rows)
        setTotal(data.total)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) loadEntries()

    const loadExportStats = async () => {
        setStatsLoading(true)
        const { getJournalExportStats } = await import('./actions')
        const stats = await getJournalExportStats(new Date(exportFrom), new Date(exportTo + 'T23:59:59'))
        setExportStats(stats)
        setStatsLoading(false)
    }

    const handleExportExcel = async () => {
        setExporting(true)
        try {
            const { exportJournalsForAccounting } = await import('./actions')
            const base64 = await exportJournalsForAccounting(new Date(exportFrom), new Date(exportTo + 'T23:59:59'))
            const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
                { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `ButToan_${exportFrom}_${exportTo}.xlsx`; a.click()
            URL.revokeObjectURL(url)
            toast.success(`Đã xuất ${exportStats?.count ?? 0} bút toán Excel`)
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally { setExporting(false) }
    }

    const handleExportJSON = async () => {
        setExporting(true)
        try {
            const { exportJournalsJSON } = await import('./actions')
            const json = await exportJournalsJSON(new Date(exportFrom), new Date(exportTo + 'T23:59:59'))
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `ButToan_${exportFrom}_${exportTo}.json`; a.click()
            URL.revokeObjectURL(url)
            toast.success('Đã xuất JSON')
        } catch (err: any) {
            toast.error(`Lỗi: ${err.message}`)
        } finally { setExporting(false) }
    }

    const docLabelMap = isEn ? DOC_TYPE_LABEL_EN : DOC_TYPE_LABEL

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#475569' }}>
                    <BookOpen size={14} className="inline mr-1.5" />
                    {total} {isEn ? 'journal entries' : 'bút toán'}
                </p>
                <div className="flex gap-2">
                    <select value={docFilter} onChange={e => { setDocFilter(e.target.value); loadEntries(e.target.value) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: docFilter ? '#0F172A' : '#64748B' }}>
                        <option value="">{isEn ? 'All types' : 'Tất cả loại'}</option>
                        {Object.entries(docLabelMap).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                    <button onClick={() => { setShowExport(!showExport); if (!showExport && !exportStats) loadExportStats() }}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded font-semibold transition-all"
                        style={{
                            background: showExport ? 'rgba(180,83,9,0.15)' : 'transparent',
                            border: '1px solid #E2E8F0', color: '#B45309',
                        }}>
                        <Download size={12} />
                        {isEn ? 'Export Accounting' : 'Xuất Kế Toán'}
                    </button>
                </div>
            </div>

            {/* Export Panel */}
            {showExport && (
                <div className="p-4 rounded-md space-y-4" style={{ background: '#FFFFFF', border: '1px solid rgba(180,83,9,0.3)' }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-sm font-bold" style={{ color: '#B45309' }}>
                                {isEn ? 'Export Journal Entries for Accounting Software' : 'Xuất Bút Toán cho PM Kế Toán'}
                            </h4>
                            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                                {isEn ? 'Export Excel/JSON to import into MISA, Fast, Bravo or other accounting software' : 'Xuất file Excel/JSON để import vào MISA, Fast, Bravo hoặc PM kế toán khác'}
                            </p>
                        </div>
                        <span className="inline-block text-xs px-2 py-1 rounded whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.15)', color: '#B45309' }}>
                            Export-Only Mode
                        </span>
                    </div>

                    {/* Date range */}
                    <div className="flex items-end gap-3 flex-wrap">
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'From Date' : 'Từ ngày'}</label>
                            <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                                className="px-3 py-2 text-sm outline-none rounded"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'To Date' : 'Đến ngày'}</label>
                            <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                                className="px-3 py-2 text-sm outline-none rounded"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
                        </div>
                        <button onClick={loadExportStats} disabled={statsLoading}
                            className="px-3 py-2 text-xs font-semibold rounded"
                            style={{ background: '#0E7490', color: '#FFFFFF' }}>
                            {statsLoading ? '...' : (isEn ? 'Preview' : 'Xem Trước')}
                        </button>
                    </div>

                    {/* Stats preview */}
                    {exportStats && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3 rounded" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs uppercase font-semibold" style={{ color: '#64748B' }}>{isEn ? 'Entries Count' : 'Số bút toán'}</p>
                                    <p className="text-xl font-bold" style={{ color: '#0F172A' }}>
                                        {exportStats.count}
                                    </p>
                                </div>
                                <div className="p-3 rounded" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs uppercase font-semibold" style={{ color: '#64748B' }}>{isEn ? 'Total Debit' : 'Tổng Nợ (Debit)'}</p>
                                    <p className="text-lg font-bold" style={{ color: '#15803D' }}>
                                        {formatVND(exportStats.totalDebit)}
                                    </p>
                                </div>
                                <div className="p-3 rounded" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs uppercase font-semibold" style={{ color: '#64748B' }}>{isEn ? 'Total Credit' : 'Tổng Có (Credit)'}</p>
                                    <p className="text-lg font-bold" style={{ color: '#B91C1C' }}>
                                        {formatVND(exportStats.totalCredit)}
                                    </p>
                                </div>
                            </div>

                            {/* Doc type breakdown */}
                            {Object.keys(exportStats.docTypes).length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(exportStats.docTypes as Record<string, number>).map(([type, count]) => (
                                        <span key={type} className="inline-block text-xs px-2 py-1 rounded whitespace-nowrap shrink-0"
                                            style={{ background: `${DOC_TYPE_COLOR[type] ?? '#64748B'}20`, color: DOC_TYPE_COLOR[type] ?? '#475569' }}>
                                            {docLabelMap[type] ?? type}: {count}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Balance check */}
                            {Math.abs(exportStats.totalDebit - exportStats.totalCredit) > 1 && (
                                <div className="flex items-center gap-2 p-2 rounded text-xs"
                                    style={{ background: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)', color: '#B91C1C' }}>
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>{isEn ? 'Debit ≠ Credit — Variance' : 'Nợ ≠ Có — Chênh lệch'} {formatVND(Math.abs(exportStats.totalDebit - exportStats.totalCredit))}</span>
                                </div>
                            )}

                            {/* Export buttons */}
                            <div className="flex flex-wrap gap-3 pt-2">
                                <button onClick={handleExportExcel} disabled={exporting || exportStats.count === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-md transition-all"
                                    style={{
                                        background: exportStats.count > 0 ? '#B45309' : '#E2E8F0',
                                        color: exportStats.count > 0 ? '#F8FAFC' : '#64748B',
                                        cursor: exportStats.count > 0 ? 'pointer' : 'not-allowed',
                                    }}>
                                    <Download size={14} />
                                    {exporting ? (isEn ? 'Exporting...' : 'Đang xuất...') : (isEn ? `Export Excel (${exportStats.count} entries)` : `Xuất Excel (${exportStats.count} bút toán)`)}
                                </button>
                                <button onClick={handleExportJSON} disabled={exporting || exportStats.count === 0}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md"
                                    style={{ border: '1px solid #E2E8F0', color: '#475569', cursor: exportStats.count > 0 ? 'pointer' : 'not-allowed' }}>
                                    <Download size={14} />
                                    {exporting ? '...' : 'JSON (API-ready)'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : entries.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <BookOpen size={32} className="mx-auto mb-3" style={{ color: '#94A3B8' }} />
                    <p className="text-sm" style={{ color: '#64748B' }}>{isEn ? 'No journal entries found' : 'Chưa có bút toán nào'}</p>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{isEn ? 'Journal entries are auto-generated on confirming GR, DO, or AR/AP Payment' : 'Bút toán sẽ tự động sinh khi confirm GR, DO, AR/AP Payment'}</p>
                </div>
            ) : (
                <>
                    <div className="hidden md:block rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {(isEn ? ['Entry No', 'Type', 'Description', 'Period', 'Debit', 'Credit', 'Lines', 'Date'] : ['Mã', 'Loại', 'Diễn giải', 'Kỳ', 'Nợ (Debit)', 'Có (Credit)', 'Dòng', 'Ngày']).map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(e => {
                                    const typeColor = DOC_TYPE_COLOR[e.docType] ?? '#475569'
                                    return (
                                        <tr key={e.id} className="hover:bg-[#0891B2]/4 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{e.entryNo}</span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0"
                                                    style={{ color: typeColor, background: `${typeColor}20` }}>
                                                    {docLabelMap[e.docType] ?? e.docType}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs max-w-[200px] truncate" style={{ color: '#0F172A' }}>
                                                {e.description ?? '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>
                                                {e.periodLabel}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-xs font-bold" style={{ color: '#15803D' }}>
                                                    {e.totalDebit > 0 ? formatVND(e.totalDebit) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-xs font-bold" style={{ color: '#B91C1C' }}>
                                                    {e.totalCredit > 0 ? formatVND(e.totalCredit) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-xs" style={{ color: '#475569' }}>{e.lineCount}</td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>{formatDate(e.postedAt)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards for JournalEntryTab */}
                    <div className="block md:hidden space-y-2.5">
                        {entries.map(e => {
                            const typeColor = DOC_TYPE_COLOR[e.docType] ?? '#475569'
                            return (
                                <div key={e.id} className="p-3.5 rounded-md space-y-2" style={card}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>{e.entryNo}</span>
                                        <span className="inline-block text-xs px-2 py-0.5 rounded font-semibold" style={{ color: typeColor, background: `${typeColor}20` }}>
                                            {docLabelMap[e.docType] ?? e.docType}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-900">{e.description ?? '—'}</p>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                        <span className="text-slate-500">{formatDate(e.postedAt)} ({e.periodLabel})</span>
                                        <span className="font-mono font-bold text-emerald-700">{formatVND(e.totalDebit)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

// ── P&L Tab ─────────────────────────────────
export function ProfitLossTab() {
    const { isEn } = useAppLocale()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [data, setData] = useState<{ rows: PLRow[]; revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number } | null>(null)
    const [comparison, setComparison] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)

    const loadPL = useCallback(async () => {
        setLoading(true)
        const [result, comp] = await Promise.all([
            getProfitLoss({ year, month }),
            getProfitLossComparison(year, month),
        ])
        setData(result)
        setComparison(comp)
        setLoading(false)
    }, [year, month])

    if (!data && !loading) loadPL()

    const rowStyle = (type: PLRow['type']): React.CSSProperties => {
        switch (type) {
            case 'summary': return { background: 'rgba(8,145,178,0.08)', fontWeight: 700 }
            case 'revenue': return { color: '#15803D' }
            case 'cogs': return { color: '#B91C1C' }
            case 'expense': return { color: '#B45309' }
            default: return {}
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Profit & Loss Statement (P&L)' : 'Báo Cáo Lãi / Lỗ (P&L)'}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309', border: '1px solid rgba(180,83,9,0.2)' }}>
                        {isEn ? 'operational estimate' : 'ước tính vận hành'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{isEn ? `Month ${i + 1}` : `Tháng ${i + 1}`}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={loadPL} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {isEn ? 'View' : 'Xem'}
                    </button>
                    {data && (
                        <button
                            disabled={exporting}
                            onClick={async () => {
                                setExporting(true)
                                try {
                                    const base64 = await exportProfitLossExcel(year, month)
                                    const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `PL_T${month}_${year}.xlsx`
                                    a.click()
                                    URL.revokeObjectURL(url)
                                } finally { setExporting(false) }
                            }}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                            style={{ border: '1px solid #E2E8F0', color: '#0891B2' }}>
                            <Download size={12} /> {exporting ? '...' : 'Excel'}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : !data ? null : (
                <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: isEn ? 'Revenue' : 'Doanh thu', value: data.revenue, color: '#15803D', icon: TrendingUp },
                            { label: isEn ? 'COGS' : 'Giá vốn (COGS)', value: data.cogs, color: '#B91C1C', icon: TrendingDown },
                            { label: isEn ? 'Gross Profit' : 'Lãi gộp', value: data.grossProfit, color: data.grossProfit >= 0 ? '#0E7490' : '#B91C1C', icon: TrendingUp },
                            { label: isEn ? 'Net Profit' : 'Lãi ròng', value: data.netProfit, color: data.netProfit >= 0 ? '#15803D' : '#B91C1C', icon: TrendingUp },
                        ].map(s => (
                            <div key={s.label} className="p-3 rounded-md" style={card}>
                                <p className="text-xs uppercase mb-1" style={{ color: '#64748B' }}>{s.label}</p>
                                <p className="text-lg font-bold" style={{ color: s.color }}>
                                    {formatVND(s.value)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* P&L Table */}
                    <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#64748B' }}>{isEn ? 'Line Item' : 'Khoản mục'}</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-right" style={{ color: '#64748B' }}>
                                        {isEn ? `Amount — M${month}/${year}` : `Số tiền — T${month}/{year}`}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #E2E8F0', ...rowStyle(row.type) }}>
                                        <td className="px-4 py-2.5 text-sm" style={{ color: row.type === 'summary' ? '#0F172A' : '#475569' }}>
                                            {row.type === 'expense' && <span className="ml-4">↳ </span>}
                                            {row.label}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <span className="text-sm" style={{
                                                color: row.amount > 0 ? '#15803D' : row.amount < 0 ? '#B91C1C' : '#64748B',
                                            }}>
                                                {row.amount !== 0 ? formatVND(row.amount) : '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Comparison Section */}
                    {comparison && (
                        <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                            <div className="px-4 py-3" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>{isEn ? 'Comparison' : 'So Sánh'}</p>
                            </div>
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                        <th className="px-4 py-2.5 text-xs text-left" style={{ color: '#64748B' }}>{isEn ? 'Line Item' : 'Khoản mục'}</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#64748B' }}>T{month}/{year}</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#64748B' }}>vs {comparison.vsPrevMonth.period}</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#64748B' }}>vs {comparison.vsLastYear.period}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: isEn ? 'Revenue' : 'Doanh thu', curr: data.revenue, prevChg: comparison.vsPrevMonth.revenueChg, lyChg: comparison.vsLastYear.revenueChg },
                                        { label: isEn ? 'COGS' : 'Giá vốn', curr: data.cogs, prevChg: comparison.vsPrevMonth.cogsChg, lyChg: comparison.vsLastYear.cogsChg },
                                        { label: isEn ? 'Gross Profit' : 'Lãi gộp', curr: data.grossProfit, prevChg: comparison.vsPrevMonth.grossProfitChg, lyChg: comparison.vsLastYear.grossProfitChg },
                                        { label: isEn ? 'Expenses' : 'Chi phí', curr: data.expenses, prevChg: comparison.vsPrevMonth.expensesChg, lyChg: comparison.vsLastYear.expensesChg },
                                        { label: isEn ? 'Net Profit' : 'Lãi ròng', curr: data.netProfit, prevChg: comparison.vsPrevMonth.netProfitChg, lyChg: comparison.vsLastYear.netProfitChg },
                                    ].map(r => {
                                        const chgBadge = (val: number | null) => {
                                            if (val === null) return <span className="text-xs" style={{ color: '#64748B' }}>—</span>
                                            const positive = val >= 0
                                            return (
                                                <span className="text-xs font-bold font-mono" style={{ color: positive ? '#15803D' : '#B91C1C' }}>
                                                    {positive ? '↑' : '↓'}{Math.abs(val)}%
                                                </span>
                                            )
                                        }
                                        return (
                                            <tr key={r.label} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                <td className="px-4 py-2 text-xs font-semibold" style={{ color: '#475569' }}>{r.label}</td>
                                                <td className="px-4 py-2 text-right text-xs" style={{ color: '#0F172A' }}>{formatVND(r.curr)}</td>
                                                <td className="px-4 py-2 text-right">{chgBadge(r.prevChg)}</td>
                                                <td className="px-4 py-2 text-right">{chgBadge(r.lyChg)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const EXPENSE_CATS = [
    { value: 'SALARY', label: 'Lương & BHXH', labelEn: 'Salary & Social Ins', account: '642' },
    { value: 'RENT', label: 'Thuê mặt bằng', labelEn: 'Office Rent', account: '642' },
    { value: 'UTILITIES', label: 'Điện nước, Internet', labelEn: 'Utilities & Internet', account: '642' },
    { value: 'LOGISTICS', label: 'Vận chuyển', labelEn: 'Logistics', account: '641' },
    { value: 'MARKETING', label: 'Quảng cáo', labelEn: 'Marketing', account: '641' },
    { value: 'INSURANCE', label: 'Bảo hiểm', labelEn: 'Insurance', account: '635' },
    { value: 'BANK_FEE', label: 'Phí ngân hàng', labelEn: 'Bank Fees', account: '635' },
    { value: 'OTHER_EXPENSE', label: 'Chi phí khác', labelEn: 'Other Expenses', account: '811' },
]

const EXP_STATUS: Record<string, { label: string; labelEn: string; color: string }> = {
    DRAFT: { label: 'Nháp', labelEn: 'Draft', color: '#64748B' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', labelEn: 'Pending', color: '#B45309' },
    APPROVED: { label: 'Đã duyệt', labelEn: 'Approved', color: '#15803D' },
    REJECTED: { label: 'Từ chối', labelEn: 'Rejected', color: '#B91C1C' },
}

const input: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', borderRadius: '6px' }

// ── Expense Tab ───────────────────────────────
export function ExpenseTab({ userId }: { userId: string }) {
    const { isEn } = useAppLocale()
    const [expenses, setExpenses] = useState<ExpenseRow[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [cat, setCat] = useState('SALARY')
    const [amount, setAmount] = useState('')
    const [desc, setDesc] = useState('')
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const data = await getExpenses()
        setExpenses(data.rows)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) load()

    const handleCreate = async () => {
        if (!amount || !desc) return
        setSaving(true)
        toast.promise(
            createExpense({ category: cat, amount: Number(amount), description: desc }).then(async (res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo chi phí')
                setCat('SALARY'); setAmount(''); setDesc(''); setShowCreate(false)
                await load()
                return res
            }),
            {
                loading: 'Đang tạo chi phí...',
                success: 'Đã tạo phiếu chi!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setSaving(false)
            }
        )
    }

    const handleApprove = async (id: string) => {
        toast.promise(
            approveExpense(id).then(async (res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi duyệt')
                await load()
                return res
            }),
            { loading: 'Đang duyệt...', success: 'Đã duyệt!', error: (err: any) => `Lỗi: ${err.message}` }
        )
    }
    const handleReject = async (id: string) => {
        toast.promise(
            rejectExpense(id).then(async (res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi từ chối')
                await load()
                return res
            }),
            { loading: 'Đang từ chối...', success: 'Đã từ chối!', error: (err: any) => `Lỗi: ${err.message}` }
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#475569' }}>{expenses.length} {isEn ? 'expenses' : 'chi phí'}</p>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    <Plus size={14} /> {isEn ? 'Add Expense' : 'Thêm Chi Phí'}
                </button>
            </div>

            {showCreate && (
                <div className="p-4 rounded-md space-y-3" style={card}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'Category' : 'Danh mục'}</label>
                            <select value={cat} onChange={e => setCat(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={input}>
                                {EXPENSE_CATS.map(c => (
                                    <option key={c.value} value={c.value}>{isEn ? c.labelEn : c.label} (TK {c.account})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'Amount (VND)' : 'Số tiền (VND)'}</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                placeholder="5000000" className="w-full px-3 py-2 text-sm outline-none" style={input} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'Description' : 'Mô tả'}</label>
                            <input value={desc} onChange={e => setDesc(e.target.value)}
                                placeholder={isEn ? 'March office rent...' : 'Tiền thuê VP tháng 3...'} className="w-full px-3 py-2 text-sm outline-none" style={input} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>{isEn ? 'Supporting Document Link (optional)' : 'Link chứng từ / Hóa đơn (tùy chọn)'}</label>
                        <input type="url" placeholder="https://drive.google.com/..."
                            className="w-full px-3 py-2 text-sm outline-none" style={input} />
                    </div>
                    {Number(amount) > 5_000_000 && (
                        <p className="text-xs flex items-center gap-1" style={{ color: '#B45309' }}>
                            <AlertTriangle size={12} /> {isEn ? 'Expenses > 5,000,000₫ require CEO approval' : 'Chi phí > 5.000.000₫ cần CEO phê duyệt'}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs"
                            style={{ color: '#475569', border: '1px solid #E2E8F0', borderRadius: '6px' }}>{isEn ? 'Cancel' : 'Huỷ'}</button>
                        <button onClick={handleCreate} disabled={saving || !amount || !desc}
                            className="px-4 py-1.5 text-xs font-semibold rounded-md"
                            style={{ background: '#0E7490', color: '#FFFFFF' }}>
                            {saving ? (isEn ? 'Saving...' : 'Đang lưu...') : (isEn ? 'Create Expense' : 'Tạo Chi Phí')}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : expenses.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <p className="text-sm" style={{ color: '#64748B' }}>{isEn ? 'No expenses recorded' : 'Chưa có chi phí nào'}</p>
                </div>
            ) : (
                <>
                    <div className="hidden md:block rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {(isEn ? ['Code', 'Category', 'Account', 'Amount', 'Description', 'Period', 'Status', 'Created By', ''] : ['Mã', 'Danh mục', 'TK', 'Số tiền', 'Mô tả', 'Kỳ', 'Trạng thái', 'Người tạo', '']).map(h => (
                                        <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map(e => {
                                    const st = EXP_STATUS[e.status] ?? EXP_STATUS.DRAFT
                                    return (
                                        <tr key={e.id} className="hover:bg-[#0891B2]/4 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-3 py-2 text-xs font-bold" style={{ color: '#0891B2' }}>{e.expenseNo}</td>
                                            <td className="px-3 py-2 text-xs" style={{ color: '#0F172A' }}>{e.categoryLabel}</td>
                                            <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{e.account.split(' - ')[0]}</td>
                                            <td className="px-3 py-2 text-sm font-bold" style={{ color: '#0F172A' }}>{formatVND(e.amount)}</td>
                                            <td className="px-3 py-2 text-xs max-w-[180px] truncate" style={{ color: '#475569' }}>{e.description}</td>
                                            <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{e.periodLabel}</td>
                                            <td className="px-3 py-2">
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0"
                                                    style={{ color: st.color, background: `${st.color}18` }}>{isEn ? st.labelEn : st.label}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs" style={{ color: '#475569' }}>{e.creatorName}</td>
                                            <td className="px-3 py-2">
                                                {e.status === 'PENDING_APPROVAL' && (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleApprove(e.id)} title={isEn ? 'Approve' : 'Duyệt'}
                                                            className="p-1 rounded" style={{ color: '#15803D', background: 'rgba(21,128,61,0.15)' }}>
                                                            <CheckCircle2 size={14} />
                                                        </button>
                                                        <button onClick={() => handleReject(e.id)} title={isEn ? 'Reject' : 'Từ chối'}
                                                            className="p-1 rounded" style={{ color: '#B91C1C', background: 'rgba(185,28,28,0.15)' }}>
                                                            <XCircle size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards for ExpenseTab */}
                    <div className="block md:hidden space-y-2.5">
                        {expenses.map(e => {
                            const st = EXP_STATUS[e.status] ?? EXP_STATUS.DRAFT
                            return (
                                <div key={e.id} className="p-3.5 rounded-md space-y-2" style={card}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>{e.expenseNo}</span>
                                        <span className="inline-block text-xs px-2 py-0.5 rounded font-semibold" style={{ color: st.color, background: `${st.color}18` }}>
                                            {isEn ? st.labelEn : st.label}
                                        </span>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-900">{e.categoryLabel} • {e.description}</p>
                                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                        <span className="text-slate-500">{e.creatorName} ({e.periodLabel})</span>
                                        <span className="font-mono font-bold text-slate-900">{formatVND(e.amount)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

// ── Period Close Tab ──────────────────────────
export function PeriodCloseTab({ userId }: { userId: string }) {
    const { isEn } = useAppLocale()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [checklist, setChecklist] = useState<PeriodCloseCheckItem[] | null>(null)
    const [periods, setPeriods] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [closing, setClosing] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [items, p] = await Promise.all([
            getPeriodCloseChecklist(year, month),
            getAccountingPeriods(),
        ])
        setChecklist(items)
        setPeriods(p)
        setLoading(false)
    }, [year, month])

    if (!checklist && !loading) load()

    const currentPeriod = periods.find((p: any) => p.year === year && p.month === month)
    const isClosed = currentPeriod?.isClosed ?? false
    const hasDanger = checklist?.some(c => c.status === 'danger') ?? false

    const handleClose = async () => {
        if (!currentPeriod || hasDanger) return
        setClosing(true)
        toast.promise(
            closeAccountingPeriod(currentPeriod.id, userId).then(async (res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi đóng kỳ')
                await load()
                return res
            }),
            {
                loading: 'Đang xử lý đóng kỳ...',
                success: 'Đã đóng kỳ kế toán thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setClosing(false)
            }
        )
    }

    const statusIcon = (s: string) => {
        if (s === 'ok') return <CircleCheck size={16} style={{ color: '#15803D' }} />
        if (s === 'warning') return <AlertTriangle size={16} style={{ color: '#B45309' }} />
        return <XCircle size={16} style={{ color: '#B91C1C' }} />
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{isEn ? 'Accounting Period Close' : 'Đóng Kỳ Kế Toán'}</h3>
                <div className="flex flex-wrap gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setChecklist(null) }}
                        className="text-xs px-3 py-1.5 rounded" style={{ ...input, width: 'auto' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{isEn ? `Month ${i + 1}` : `Tháng ${i + 1}`}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setChecklist(null) }}
                        className="text-xs px-3 py-1.5 rounded" style={{ ...input, width: 'auto' }}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={load} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>{isEn ? 'Check' : 'Kiểm Tra'}</button>
                </div>
            </div>

            {isClosed && (
                <div className="p-3 rounded-md flex items-center gap-2"
                    style={{ background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.3)' }}>
                    <Lock size={16} style={{ color: '#15803D' }} />
                    <span className="text-sm font-semibold" style={{ color: '#15803D' }}>
                        {isEn ? `Period M${month}/${year} is closed — No new vouchers can be posted in this period` : `Kỳ T${month}/${year} đã đóng — Không thể tạo chứng từ mới trong kỳ này`}
                    </span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : checklist ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        {checklist.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-md" style={card}>
                                <div className="flex items-center gap-3">
                                    {statusIcon(item.status)}
                                    <span className="text-sm" style={{ color: '#0F172A' }}>{item.label}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {item.amount > 0 && (
                                        <span className="text-xs font-bold" style={{ color: '#B45309' }}>
                                            {formatVND(item.amount)}
                                        </span>
                                    )}
                                    <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0" style={{
                                        color: item.status === 'ok' ? '#15803D' : item.status === 'warning' ? '#B45309' : '#B91C1C',
                                        background: item.status === 'ok' ? 'rgba(21,128,61,0.15)' : item.status === 'warning' ? 'rgba(180,83,9,0.15)' : 'rgba(185,28,28,0.15)',
                                    }}>
                                        {item.count > 0 ? `${item.count} ${isEn ? 'items' : 'mục'}` : 'OK'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!isClosed && (
                        <div className="flex justify-end">
                            <button onClick={handleClose} disabled={closing || hasDanger}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-md transition-all"
                                style={{
                                    background: hasDanger ? '#E2E8F0' : '#0E7490',
                                    color: hasDanger ? '#64748B' : '#F8FAFC',
                                    cursor: hasDanger ? 'not-allowed' : 'pointer',
                                }}>
                                <Lock size={14} />
                                {closing ? (isEn ? 'Closing period...' : 'Đang đóng kỳ...') : hasDanger ? (isEn ? 'Resolve red items before closing' : 'Cần xử lý mục đỏ trước khi đóng') : (isEn ? `Close Period M${month}/${year}` : `Đóng Kỳ T${month}/${year}`)}
                            </button>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    )
}

// ── Balance Sheet Tab ────────────────────────────────
export function BalanceSheetTab() {
    const { isEn } = useAppLocale()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [data, setData] = useState<{
        totalAssets: number; totalLiabilities: number; totalEquity: number;
        isBalanced: boolean; lines: BSLineItem[]; asOf: Date
    } | null>(null)
    const [loading, setLoading] = useState(false)

    const loadBS = useCallback(async () => {
        setLoading(true)
        const result = await getBalanceSheet({ year, month })
        setData(result)
        setLoading(false)
    }, [year, month])

    if (!data && !loading) loadBS()

    const categoryColor = (cat: string) => {
        switch (cat) {
            case 'asset': return '#0E7490'
            case 'liability': return '#B45309'
            case 'equity': return '#15803D'
            default: return '#0F172A'
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Balance Sheet (VAS)' : 'Bảng Cân Đối Kế Toán (VAS)'}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309', border: '1px solid rgba(180,83,9,0.2)' }}>
                        {isEn ? 'operational estimate' : 'ước tính vận hành'}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{isEn ? `Month ${i + 1}` : `Tháng ${i + 1}`}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={loadBS} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {isEn ? 'View' : 'Xem'}
                    </button>
                    {data && (
                        <button onClick={async () => {
                            try {
                                const base64 = await exportBalanceSheetExcel()
                                const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
                                    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url; a.download = `CDKT_T${month}_${year}.xlsx`; a.click()
                                URL.revokeObjectURL(url)
                                toast.success('Đã xuất CĐKT Excel')
                            } catch { toast.error('Lỗi xuất Excel') }
                        }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium"
                            style={{ border: '1px solid #E2E8F0', color: '#0891B2' }}>
                            <Download size={12} /> {isEn ? 'BS Excel' : 'CĐKT Excel'}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : !data ? null : (
                <div className="space-y-4">
                    {/* Balance check */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold"
                        style={{
                            background: data.isBalanced ? 'rgba(21,128,61,0.1)' : 'rgba(185,28,28,0.1)',
                            border: `1px solid ${data.isBalanced ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)'}`,
                            color: data.isBalanced ? '#15803D' : '#B91C1C',
                        }}>
                        {data.isBalanced ? <CircleCheck size={14} /> : <XCircle size={14} />}
                        {data.isBalanced
                            ? (isEn ? `Balanced — Assets = Liabilities + Equity (as of ${month}/${year})` : `Cân đối — Tài Sản = Nợ + Vốn CSH (tại ${month}/${year})`)
                            : (isEn ? `Unbalanced! Assets: ${formatVND(data.totalAssets)} ≠ Liabilities+Equity: ${formatVND(data.totalLiabilities + data.totalEquity)}` : `Bảng không cân đối! Tài sản: ${formatVND(data.totalAssets)} ≠ Nợ+Vốn: ${formatVND(data.totalLiabilities + data.totalEquity)}`)
                        }
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { label: isEn ? 'Assets' : 'Tài Sản', value: data.totalAssets, color: '#0891B2', prefix: 'A' },
                            { label: isEn ? 'Liabilities' : 'Nợ Phải Trả', value: data.totalLiabilities, color: '#B45309', prefix: 'L' },
                            { label: isEn ? 'Equity' : 'Vốn CSH', value: data.totalEquity, color: '#15803D', prefix: 'E' },
                        ].map(s => (
                            <div key={s.prefix} className="p-4 rounded-md" style={card}>
                                <p className="text-xs uppercase mb-1 font-semibold" style={{ color: '#64748B' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ color: s.color }}>
                                    {formatVND(s.value)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Detail table */}
                    <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#64748B' }}>{isEn ? 'Account Code' : 'Mã TK'}</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#64748B' }}>{isEn ? 'Line Item' : 'Khoản mục'}</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-right" style={{ color: '#64748B' }}>
                                        {isEn ? `Closing Balance M${month}/${year}` : `Số dư cuối kỳ T${month}/{year}`}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.lines.map((line, i) => {
                                    const isSummary = line.category === 'summary'
                                    return (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid #E2E8F0',
                                            background: isSummary ? 'rgba(8,145,178,0.06)' : 'transparent',
                                        }}>
                                            <td className="px-4 py-2.5 text-xs" style={{
                                                color: isSummary ? '#0F172A' : '#64748B',
                                                paddingLeft: `${16 + (line.indent ?? 0) * 20}px`,
                                                fontWeight: isSummary ? 700 : 400,
                                            }}>
                                                {line.code}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm" style={{
                                                color: isSummary ? '#0F172A' : '#475569',
                                                fontWeight: isSummary ? 700 : 400,
                                                paddingLeft: `${16 + (line.indent ?? 0) * 20}px`,
                                            }}>
                                                {line.label}
                                            </td>
                                            <td className="px-4 py-2.5 text-right">
                                                <span className="text-sm" style={{
                                                    color: isSummary ? '#0F172A' : categoryColor(line.category),
                                                    fontWeight: isSummary ? 700 : 500,
                                                }}>
                                                    {line.amount !== 0 ? formatVND(line.amount) : '—'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Equation */}
                    <div className="flex items-center justify-center gap-4 py-3 rounded-md text-sm flex-wrap" style={card}>
                        <span style={{ color: '#0891B2', fontWeight: 700 }}>
                            {isEn ? 'Assets' : 'Tài sản'} <span>{formatVND(data.totalAssets)}</span>
                        </span>
                        <span style={{ color: '#64748B', fontSize: 18 }}>=</span>
                        <span style={{ color: '#B45309', fontWeight: 700 }}>
                            {isEn ? 'Liabilities' : 'Nợ'} <span>{formatVND(data.totalLiabilities)}</span>
                        </span>
                        <span style={{ color: '#64748B', fontSize: 18 }}>+</span>
                        <span style={{ color: '#15803D', fontWeight: 700 }}>
                            {isEn ? 'Equity' : 'Vốn'} <span>{formatVND(data.totalEquity)}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Bad Debt Write-off Tab ────────────────────────
export function BadDebtTab({ userId }: { userId: string }) {
    const { isEn } = useAppLocale()
    const [candidates, setCandidates] = useState<BadDebtCandidate[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [writingOff, setWritingOff] = useState<string | null>(null) // invoiceId
    const [reason, setReason] = useState('')
    const [processing, setProcessing] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const data = await getBadDebtCandidates(180)
        setCandidates(data)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) load()

    const handleWriteOff = async (invoiceId: string) => {
        if (!reason.trim()) return
        setProcessing(true)
        toast.promise(
            writeOffBadDebt({ invoiceId, reason: reason.trim(), approvedBy: userId }).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi xóa nợ')
                setCandidates(prev => prev.filter(c => c.invoiceId !== invoiceId))
                setWritingOff(null)
                setReason('')
                return res
            }),
            {
                loading: 'Đang xóa nợ...',
                success: 'Đã xóa nợ khó đòi thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setProcessing(false)
            }
        )
    }

    const severityColor = (days: number) => days > 270 ? '#B91C1C' : days > 180 ? '#B45309' : '#B45309'
    const totalOutstanding = candidates.reduce((s, c) => s + c.outstanding, 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Bad Debt Write-off' : 'Nợ Khó Đòi — Bad Debt Write-off'}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                        {isEn ? 'Invoices overdue > 180 days. Write-off posts DR 642 / CR 131' : 'Hóa đơn quá hạn > 180 ngày. Xóa nợ sẽ ghi DR 642 / CR 131'}
                    </p>
                </div>
                {candidates.length > 0 && (
                    <div className="text-right">
                        <p className="text-xs" style={{ color: '#64748B' }}>{candidates.length} {isEn ? 'invoices' : 'hóa đơn'}</p>
                        <p className="text-sm font-bold" style={{ color: '#B91C1C' }}>
                            {formatVND(totalOutstanding)}
                        </p>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : candidates.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <CircleCheck size={32} className="mx-auto mb-3" style={{ color: '#15803D' }} />
                    <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{isEn ? 'No bad debt candidates' : 'Không có nợ khó đòi'}</p>
                    <p className="text-xs mt-1" style={{ color: '#64748B' }}>{isEn ? 'All AR receivables are within 180 days' : 'Tất cả AR đều trong vòng 180 ngày'}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {candidates.map(c => {
                        const sColor = severityColor(c.daysOverdue)
                        const isExpanded = writingOff === c.invoiceId
                        return (
                            <div key={c.invoiceId} className="rounded-md overflow-hidden" style={card}>
                                <div className="flex items-center justify-between p-4 flex-wrap gap-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold"
                                            style={{ background: `${sColor}18`, color: sColor }}>
                                            +{c.daysOverdue}d
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold" style={{ color: '#0891B2' }}>
                                                    {c.invoiceNo}
                                                </span>
                                                <span className="text-sm font-medium" style={{ color: '#0F172A' }}>
                                                    {c.customerName}
                                                </span>
                                            </div>
                                            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                                                {isEn ? 'Due:' : 'Hạn TT:'} {formatDate(c.dueDate)} · {isEn ? 'Original:' : 'Gốc:'} {formatVND(c.amount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-sm font-bold" style={{ color: sColor }}>
                                                {formatVND(c.outstanding)}
                                            </p>
                                            <p className="text-[10px]" style={{ color: '#64748B' }}>{isEn ? 'remaining' : 'còn lại'}</p>
                                        </div>
                                        <button
                                            onClick={() => setWritingOff(isExpanded ? null : c.invoiceId)}
                                            className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                            style={{
                                                background: isExpanded ? 'rgba(185,28,28,0.2)' : 'rgba(185,28,28,0.1)',
                                                color: '#B91C1C',
                                                border: '1px solid rgba(185,28,28,0.3)',
                                            }}>
                                            {isExpanded ? (isEn ? 'Cancel' : 'Hủy') : (isEn ? 'Write Off' : 'Xóa Nợ')}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                                        <div>
                                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#64748B' }}>
                                                {isEn ? 'Write-off Reason' : 'Lý do xóa nợ'} <span style={{ color: '#B91C1C' }}>*</span>
                                            </label>
                                            <input
                                                value={reason}
                                                onChange={e => setReason(e.target.value)}
                                                placeholder={isEn ? 'e.g. Customer bankruptcy, unreachable...' : 'VD: Khách phá sản, không liên lạc được...'}
                                                className="w-full px-3 py-2 text-sm outline-none"
                                                style={{ ...input }} />
                                        </div>
                                        <div className="flex items-center justify-between flex-wrap gap-2">
                                            <p className="text-xs" style={{ color: '#64748B' }}>
                                                {isEn ? 'Journal:' : 'Bút toán:'} DR 642 {formatVND(c.outstanding)} / CR 131 {formatVND(c.outstanding)}
                                            </p>
                                            <button
                                                onClick={() => handleWriteOff(c.invoiceId)}
                                                disabled={processing || !reason.trim()}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md disabled:opacity-50"
                                                style={{ background: '#B91C1C', color: '#FFFFFF' }}>
                                                {processing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                                {isEn ? 'Confirm Write-off' : 'Xác Nhận Xóa Nợ'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// CASH FLOW TAB — Dòng tiền & Credit Hold
// ═══════════════════════════════════════════════════

export function CashFlowTab() {
    const { isEn } = useAppLocale()
    const [cashPos, setCashPos] = useState<CashPositionData | null>(null)
    const [forecast, setForecast] = useState<CashFlowForecastData | null>(null)
    const [loading, setLoading] = useState(false)
    const [creditResults, setCreditResults] = useState<CreditHoldResult[] | null>(null)
    const [creditRunning, setCreditRunning] = useState(false)
    const [creditStats, setCreditStats] = useState<{ checked: number; held: number; released: number } | null>(null)
    const [bsExporting, setBsExporting] = useState(false)
    const [arExporting, setArExporting] = useState(false)
    const [vatExporting, setVatExporting] = useState(false)
    const [sctExporting, setSctExporting] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const [pos, fc] = await Promise.all([getCashPosition(), getCashFlowForecast()])
        setCashPos(pos)
        setForecast(fc)
        setLoading(false)
    }, [])

    if (!cashPos && !loading) load()

    const trendArrow = (val: number) => {
        if (val > 0) return <span style={{ color: '#15803D' }}>↑ {formatVND(Math.abs(val))}</span>
        if (val < 0) return <span style={{ color: '#B91C1C' }}>↓ {formatVND(Math.abs(val))}</span>
        return <span style={{ color: '#64748B' }}>—</span>
    }

    const handleCreditCheck = async () => {
        setCreditRunning(true)
        try {
            const result = await autoCheckCreditHold()
            if (result.success) {
                setCreditResults(result.results)
                setCreditStats({ checked: result.checked, held: result.held, released: result.released })
                toast.success(`Đã kiểm tra ${result.checked} KH — Hold: ${result.held}, Thả: ${result.released}`)
            } else {
                toast.error(result.error || 'Lỗi kiểm tra credit')
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setCreditRunning(false)
        }
    }

    const downloadExcel = async (base64: string, filename: string) => {
        const blob = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : cashPos && forecast ? (
                <>
                    {/* ── Cash Position Section ── */}
                    <div>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>{isEn ? 'Cash Position' : 'Vị Thế Tiền Mặt'}</h3>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={load} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                                    style={{ background: '#0E7490', color: '#FFFFFF' }}>{isEn ? 'Refresh' : 'Làm Mới'}</button>
                                <button onClick={async () => {
                                    setVatExporting(true)
                                    try {
                                        const base64 = await exportVATDeclarationExcel()
                                        await downloadExcel(base64, `VAT_BanRa_${new Date().toISOString().slice(0, 7)}.xlsx`)
                                    } finally { setVatExporting(false) }
                                }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium"
                                    style={{ border: '1px solid #E2E8F0', color: '#15803D' }}>
                                    <Download size={12} /> {vatExporting ? '...' : 'VAT Excel'}
                                </button>
                                <button onClick={async () => {
                                    setSctExporting(true)
                                    try {
                                        const base64 = await exportSCTDeclarationExcel()
                                        await downloadExcel(base64, `TTDB_${new Date().toISOString().slice(0, 7)}.xlsx`)
                                    } finally { setSctExporting(false) }
                                }} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium"
                                    style={{ border: '1px solid #E2E8F0', color: '#B45309' }}>
                                    <Download size={12} /> {sctExporting ? '...' : 'SCT Excel'}
                                </button>
                            </div>
                        </div>

                        {/* Safety Alert */}
                        {cashPos.isBelowSafety && (
                            <div className="flex items-center gap-2 p-3 rounded-md mb-3"
                                style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.3)' }}>
                                <AlertTriangle size={16} style={{ color: '#B91C1C' }} />
                                <span className="text-sm font-semibold" style={{ color: '#B91C1C' }}>
                                    {isEn ? `Cash (${formatVND(cashPos.totalCash)}) is below safety threshold (${formatVND(cashPos.safetyThreshold)})` : `Tiền mặt (${formatVND(cashPos.totalCash)}) dưới ngưỡng an toàn (${formatVND(cashPos.safetyThreshold)})`}
                                </span>
                            </div>
                        )}

                        {/* Cash cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                                { label: isEn ? 'Bank Cash (Acc 112)' : 'Tiền Gửi NH (TK 112)', value: cashPos.bankBalance, trend: cashPos.cashChange30d, color: '#0891B2' },
                                { label: isEn ? 'Receivables (AR)' : 'Phải Thu (AR)', value: cashPos.arReceivable, trend: cashPos.arChange30d, color: '#15803D' },
                                { label: isEn ? 'Payables (AP)' : 'Phải Trả (AP)', value: cashPos.apPayable, trend: cashPos.apChange30d, color: '#B45309' },
                                { label: isEn ? 'Net Working Capital' : 'Vốn Lưu Động Ròng', value: cashPos.netWorkingCapital, trend: null, color: cashPos.netWorkingCapital >= 0 ? '#0E7490' : '#B91C1C' },
                            ].map(c => (
                                <div key={c.label} className="p-4 rounded-md" style={card}>
                                    <p className="text-xs uppercase mb-1.5 font-semibold" style={{ color: '#64748B' }}>{c.label}</p>
                                    <p className="text-xl font-bold" style={{ color: c.color }}>
                                        {formatVND(c.value)}
                                    </p>
                                    {c.trend !== null && (
                                        <p className="text-xs mt-1">
                                            <span style={{ color: '#64748B' }}>30d: </span>{trendArrow(c.trend as number)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Petty cash + total */}
                        {cashPos.pettyCash > 0 && (
                            <div className="flex items-center gap-4 px-4 py-2.5 mt-3 rounded-md flex-wrap" style={card}>
                                <span className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Petty Cash (Acc 111):' : 'Quỹ tiền mặt (TK 111):'}</span>
                                <span className="text-sm font-bold" style={{ color: '#0891B2' }}>
                                    {formatVND(cashPos.pettyCash)}
                                </span>
                                <span className="text-xs" style={{ color: '#64748B' }}>|</span>
                                <span className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Total Available Cash:' : 'Tổng tiền sẵn sàng:'}</span>
                                <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                                    {formatVND(cashPos.totalCash)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ── Cash Flow Forecast ── */}
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: '#B45309' }}>{isEn ? '90-Day Cash Flow Forecast' : 'Dự Báo Dòng Tiền 90 Ngày'}</h3>

                        {/* Risk alerts */}
                        {(forecast.isRisk30 || forecast.isRisk60 || forecast.isRisk90) && (
                            <div className="flex items-center gap-2 p-3 rounded-md mb-3"
                                style={{ background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.3)' }}>
                                <AlertTriangle size={16} style={{ color: '#B91C1C' }} />
                                <span className="text-sm font-semibold" style={{ color: '#B91C1C' }}>
                                    {isEn ? `Cash shortfall projected in next ${forecast.isRisk30 ? '30' : forecast.isRisk60 ? '60' : '90'} days!` : `Dự báo thiếu tiền trong ${forecast.isRisk30 ? '30' : forecast.isRisk60 ? '60' : '90'} ngày tới!`}
                                </span>
                            </div>
                        )}

                        {/* Forecast table */}
                        <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                            <table className="w-full min-w-[550px]" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                        {(isEn ? ['Horizon', 'Expected AR In', 'AP Due Out', 'Est. Expenses', 'Net Cash Flow', 'Cumulative'] : ['Khoảng TG', 'AR Kỳ Vọng Thu', 'AP Phải Trả', 'Chi Phí ƯT', 'Dòng Tiền Ròng', 'Lũy Kế']).map(h => (
                                            <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-right first:text-left"
                                                style={{ color: '#64748B' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Current cash row */}
                                    <tr style={{ borderBottom: '1px solid #E2E8F0', background: 'rgba(8,145,178,0.06)' }}>
                                        <td className="px-4 py-2.5 text-sm font-bold" style={{ color: '#0F172A' }}>{isEn ? 'Current Cash' : 'Tiền hiện tại'}</td>
                                        <td className="px-4 py-2.5 text-right" colSpan={4}></td>
                                        <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: '#0891B2' }}>
                                            {formatVND(forecast.currentCash)}
                                        </td>
                                    </tr>
                                    {forecast.buckets.map((b, i) => {
                                        const riskColor = b.cumulative < 0 ? '#B91C1C' : b.netCashFlow < 0 ? '#B45309' : '#15803D'
                                        return (
                                            <tr key={i} className="hover:bg-[#0891B2]/4 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: '#0F172A' }}>{b.period}</td>
                                                <td className="px-4 py-2.5 text-right text-sm" style={{ color: '#15803D' }}>+{formatVND(b.arExpected)}</td>
                                                <td className="px-4 py-2.5 text-right text-sm" style={{ color: '#B45309' }}>-{formatVND(b.apDue)}</td>
                                                <td className="px-4 py-2.5 text-right text-sm" style={{ color: '#475569' }}>-{formatVND(b.expenseEstimate)}</td>
                                                <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: b.netCashFlow >= 0 ? '#15803D' : '#B91C1C' }}>
                                                    {b.netCashFlow >= 0 ? '+' : ''}{formatVND(b.netCashFlow)}
                                                </td>
                                                <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: riskColor }}>
                                                    {formatVND(b.cumulative)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Visual bars */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            {[
                                { label: isEn ? '30 days' : '30 ngày', value: forecast.endingCash30, risk: forecast.isRisk30 },
                                { label: isEn ? '60 days' : '60 ngày', value: forecast.endingCash60, risk: forecast.isRisk60 },
                                { label: isEn ? '90 days' : '90 ngày', value: forecast.endingCash90, risk: forecast.isRisk90 },
                            ].map(p => (
                                <div key={p.label} className="p-3 rounded-md" style={{
                                    ...card,
                                    borderLeft: `3px solid ${p.risk ? '#B91C1C' : p.value > 500_000_000 ? '#15803D' : '#B45309'}`,
                                }}>
                                    <p className="text-xs uppercase mb-1" style={{ color: '#64748B' }}>{isEn ? `Balance ${p.label}` : `Số dư ${p.label}`}</p>
                                    <p className="text-lg font-bold" style={{ color: p.risk ? '#B91C1C' : '#0F172A' }}>
                                        {formatVND(p.value)}
                                    </p>
                                    {p.risk && (
                                        <p className="text-xs mt-1 font-semibold flex items-center gap-1" style={{ color: '#B91C1C' }}>
                                            <AlertTriangle size={11} className="shrink-0" /> {isEn ? 'Shortfall risk' : 'Rủi ro thiếu tiền'}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Credit Hold ── */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>{isEn ? 'Credit Hold — Credit Limit Control' : 'Credit Hold — Kiểm Soát Hạn Mức'}</h3>
                            <button onClick={handleCreditCheck} disabled={creditRunning}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                                style={{ background: '#0E7490', color: '#FFFFFF' }}>
                                {creditRunning ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                                {creditRunning ? (isEn ? 'Checking...' : 'Đang kiểm tra...') : (isEn ? 'Run Credit Check' : 'Chạy Credit Check')}
                            </button>
                        </div>

                        {creditStats && (
                            <div className="flex gap-3 mb-3 flex-wrap">
                                <span className="inline-block text-xs px-3 py-1.5 rounded-md whitespace-nowrap shrink-0" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569' }}>
                                    {isEn ? 'Checked:' : 'Đã kiểm tra:'} <b>{creditStats.checked}</b> {isEn ? 'customers' : 'KH'}
                                </span>
                                {creditStats.held > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-bold whitespace-nowrap shrink-0" style={{ background: 'rgba(185,28,28,0.1)', border: '1px solid rgba(185,28,28,0.3)', color: '#B91C1C' }}>
                                        <Lock size={11} /> {isEn ? 'Newly HELD:' : 'Mới HOLD:'} {creditStats.held}
                                    </span>
                                )}
                                {creditStats.released > 0 && (
                                    <span className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-bold whitespace-nowrap shrink-0" style={{ background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.3)', color: '#15803D' }}>
                                        <CheckCircle2 size={11} /> {isEn ? 'Released:' : 'Đã thả:'} {creditStats.released}
                                    </span>
                                )}
                            </div>
                        )}

                        {creditResults && creditResults.length > 0 ? (
                            <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                                <table className="w-full min-w-[500px]" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                            {(isEn ? ['Customer', 'Credit Limit', 'Current AR', 'Over Limit', 'Status'] : ['Khách Hàng', 'Credit Limit', 'AR Hiện Tại', 'Vượt', 'Trạng Thái']).map(h => (
                                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#64748B' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creditResults.map(r => (
                                            <tr key={r.customerId} style={{ borderBottom: '1px solid #E2E8F0', background: r.wasHeld ? 'rgba(185,28,28,0.04)' : 'transparent' }}>
                                                <td className="px-4 py-2.5 text-sm font-medium" style={{ color: '#0F172A' }}>{r.customerName}</td>
                                                <td className="px-4 py-2.5 text-sm" style={{ color: '#475569' }}>{formatVND(r.creditLimit)}</td>
                                                <td className="px-4 py-2.5 text-sm font-bold font-mono" style={{ color: r.isOverLimit ? '#B91C1C' : '#15803D' }}>
                                                    {formatVND(r.currentAR)}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    {r.overAmount > 0 && (
                                                        <span className="inline-block text-xs px-2 py-0.5 rounded font-bold font-mono whitespace-nowrap shrink-0" style={{ color: '#B91C1C', background: 'rgba(185,28,28,0.15)' }}>
                                                            +{formatVND(r.overAmount)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap shrink-0" style={{
                                                        color: r.isOverLimit ? '#B91C1C' : '#15803D',
                                                        background: r.isOverLimit ? 'rgba(185,28,28,0.15)' : 'rgba(21,128,61,0.15)',
                                                    }}>
                                                        {r.wasHeld ? <><Lock size={10} /> {isEn ? 'NEW HOLD' : 'MỚI HOLD'}</> : r.isOverLimit ? <><Lock size={10} /> HOLD</> : <><CheckCircle2 size={10} /> OK</>}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : creditResults && creditResults.length === 0 ? (
                            <div className="text-center py-8 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                                <CircleCheck size={28} className="mx-auto mb-2" style={{ color: '#15803D' }} />
                                <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{isEn ? 'All customers are within credit limits' : 'Tất cả khách hàng trong hạn mức'}</p>
                            </div>
                        ) : (
                            <div className="text-center py-8 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                                <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: '#94A3B8' }} />
                                <p className="text-sm" style={{ color: '#64748B' }}>{isEn ? 'Click "Run Credit Check" to inspect credit limits' : 'Nhấn "Chạy Credit Check" để kiểm tra hạn mức tín dụng'}</p>
                                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{isEn ? 'Automatically locks customers whose AR exceeds credit limit' : 'Sẽ auto lock KH có AR vượt credit limit'}</p>
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    )
}

// ── Trial Balance Tab — Bảng Cân Đối Phát Sinh ──
export function TrialBalanceTab() {
    const { isEn } = useAppLocale()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [data, setData] = useState<TrialBalanceData | null>(null)
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const result = await getTrialBalance({ year, month })
        setData(result)
        setLoading(false)
    }, [year, month])

    if (!data && !loading) load()

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Trial Balance' : 'Bảng Cân Đối Phát Sinh (CĐPS)'}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309', border: '1px solid rgba(180,83,9,0.2)' }}>
                        {isEn ? 'operational estimate' : 'ước tính vận hành'}
                    </span>
                </div>
                <div className="flex gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{isEn ? `Month ${i + 1}` : `Tháng ${i + 1}`}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={load} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>{isEn ? 'Reload' : 'Tải lại'}</button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : data ? (
                <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                <th rowSpan={2} className="px-3 py-2 text-xs uppercase font-semibold" style={{ color: '#64748B', borderRight: '1px solid #E2E8F0' }}>{isEn ? 'Account' : 'Tài Khoản'}</th>
                                <th colSpan={2} className="px-3 py-1.5 text-xs uppercase font-semibold text-center" style={{ color: '#64748B', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>{isEn ? 'Opening Balance' : 'Số Dư Đầu Kỳ'}</th>
                                <th colSpan={2} className="px-3 py-1.5 text-xs uppercase font-semibold text-center" style={{ color: '#64748B', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>{isEn ? 'Period Movement' : 'Phát Sinh Trong Kỳ'}</th>
                                <th colSpan={2} className="px-3 py-1.5 text-xs uppercase font-semibold text-center" style={{ color: '#64748B' }}>{isEn ? 'Closing Balance' : 'Số Dư Cuối Kỳ'}</th>
                            </tr>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#15803D' }}>{isEn ? 'Debit' : 'Nợ'}</th>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{isEn ? 'Credit' : 'Có'}</th>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#15803D' }}>{isEn ? 'Debit' : 'Nợ'}</th>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{isEn ? 'Credit' : 'Có'}</th>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#15803D' }}>{isEn ? 'Debit' : 'Nợ'}</th>
                                <th className="px-2 py-1.5 text-xs text-center font-semibold" style={{ color: '#B91C1C' }}>{isEn ? 'Credit' : 'Có'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map(r => (
                                <tr key={r.accountCode} className="hover:bg-[#0891B2]/4 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                    <td className="px-3 py-2" style={{ borderRight: '1px solid #E2E8F0' }}>
                                        <span className="text-xs font-bold" style={{ color: '#0891B2' }}>{r.accountCode}</span>
                                        <span className="text-xs ml-2" style={{ color: '#475569' }}>{r.accountName}</span>
                                    </td>
                                    <td className="px-2 py-2 text-right text-xs" style={{ color: '#15803D' }}>{r.openingDebit > 0 ? formatVND(r.openingDebit) : ''}</td>
                                    <td className="px-2 py-2 text-right text-xs font-mono" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{r.openingCredit > 0 ? formatVND(r.openingCredit) : ''}</td>
                                    <td className="px-2 py-2 text-right text-xs font-bold" style={{ color: '#15803D' }}>{r.periodDebit > 0 ? formatVND(r.periodDebit) : ''}</td>
                                    <td className="px-2 py-2 text-right text-xs font-bold font-mono" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{r.periodCredit > 0 ? formatVND(r.periodCredit) : ''}</td>
                                    <td className="px-2 py-2 text-right text-xs font-bold" style={{ color: '#15803D' }}>{r.closingDebit > 0 ? formatVND(r.closingDebit) : ''}</td>
                                    <td className="px-2 py-2 text-right text-xs font-bold" style={{ color: '#B91C1C' }}>{r.closingCredit > 0 ? formatVND(r.closingCredit) : ''}</td>
                                </tr>
                            ))}
                            {/* Totals row */}
                            <tr style={{ background: 'rgba(8,145,178,0.08)', borderTop: '2px solid #E2E8F0' }}>
                                <td className="px-3 py-2.5 text-xs font-bold uppercase" style={{ color: '#0F172A', borderRight: '1px solid #E2E8F0' }}>{isEn ? 'Total' : 'Tổng Cộng'}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold" style={{ color: '#15803D' }}>{formatVND(data.totals.openingDebit)}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold font-mono" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{formatVND(data.totals.openingCredit)}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold" style={{ color: '#15803D' }}>{formatVND(data.totals.periodDebit)}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold font-mono" style={{ color: '#B91C1C', borderRight: '1px solid #E2E8F0' }}>{formatVND(data.totals.periodCredit)}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold" style={{ color: '#15803D' }}>{formatVND(data.totals.closingDebit)}</td>
                                <td className="px-2 py-2.5 text-right text-xs font-bold" style={{ color: '#B91C1C' }}>{formatVND(data.totals.closingCredit)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    )
}

// ── Account Ledger Tab — Sổ Chi Tiết Tài Khoản ──
export function AccountLedgerTab() {
    const { isEn } = useAppLocale()
    const now = new Date()
    const [year, setYear] = useState(now.getFullYear())
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [accountCode, setAccountCode] = useState('131')
    const [data, setData] = useState<AccountLedgerData | null>(null)
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        const result = await getAccountLedger(accountCode, { year, month })
        setData(result)
        setLoading(false)
    }, [accountCode, year, month])

    if (!data && !loading) load()

    const accountOptions = Object.entries(VAS_ACCOUNTS).sort(([a], [b]) => a.localeCompare(b))
    const docLabelMap = isEn ? DOC_TYPE_LABEL_EN : DOC_TYPE_LABEL

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                    {isEn ? 'Account Sub-ledger' : 'Sổ Chi Tiết Tài Khoản'}
                </h3>
                <div className="flex gap-2 flex-wrap">
                    <select value={accountCode} onChange={e => { setAccountCode(e.target.value); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0891B2' }}>
                        {accountOptions.map(([code, name]) => (
                            <option key={code} value={code}>{code} - {name}</option>
                        ))}
                    </select>
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{isEn ? `Month ${i + 1}` : `Tháng ${i + 1}`}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={load} className="inline-block text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap shrink-0"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>{isEn ? 'View' : 'Xem'}</button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
            ) : data ? (
                <div className="space-y-3">
                    {/* Account info */}
                    <div className="flex items-center gap-4 p-3 rounded-md flex-wrap" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div>
                            <span className="text-lg font-bold" style={{ color: '#0891B2' }}>{data.accountCode}</span>
                            <span className="text-sm ml-2" style={{ color: '#475569' }}>{data.accountName}</span>
                        </div>
                        <div className="ml-auto flex gap-6">
                            <div className="text-right">
                                <p className="text-xs uppercase" style={{ color: '#64748B' }}>{isEn ? 'Opening Balance' : 'Dư đầu kỳ'}</p>
                                <p className="text-sm font-bold" style={{ color: data.openingBalance >= 0 ? '#15803D' : '#B91C1C' }}>
                                    {formatVND(Math.abs(data.openingBalance))} {data.openingBalance >= 0 ? (isEn ? 'DR' : 'Nợ') : (isEn ? 'CR' : 'Có')}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase" style={{ color: '#64748B' }}>{isEn ? 'Closing Balance' : 'Dư cuối kỳ'}</p>
                                <p className="text-sm font-bold" style={{ color: data.closingBalance >= 0 ? '#15803D' : '#B91C1C' }}>
                                    {formatVND(Math.abs(data.closingBalance))} {data.closingBalance >= 0 ? (isEn ? 'DR' : 'Nợ') : (isEn ? 'CR' : 'Có')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ledger table */}
                    {data.entries.length === 0 ? (
                        <div className="text-center py-12 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                            <p className="text-sm" style={{ color: '#64748B' }}>{isEn ? `No transactions in period ${month}/${year}` : `Không có phát sinh trong kỳ ${month}/${year}`}</p>
                        </div>
                    ) : (
                        <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                        {(isEn ? ['Date', 'Doc No', 'Type', 'Description', 'Debit', 'Credit', 'Balance'] : ['Ngày', 'Số CT', 'Loại', 'Diễn giải', 'Nợ', 'Có', 'Số Dư']).map(h => (
                                            <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Opening balance row */}
                                    <tr style={{ background: 'rgba(8,145,178,0.05)', borderBottom: '1px solid #E2E8F0' }}>
                                        <td colSpan={4} className="px-3 py-2 text-xs font-bold italic" style={{ color: '#64748B' }}>
                                            {isEn ? 'Opening balance' : 'Số dư đầu kỳ'}
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs" style={{ color: '#15803D' }}></td>
                                        <td className="px-3 py-2 text-right text-xs" style={{ color: '#B91C1C' }}></td>
                                        <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: data.openingBalance >= 0 ? '#15803D' : '#B91C1C' }}>
                                            {formatVND(Math.abs(data.openingBalance))}
                                        </td>
                                    </tr>
                                    {data.entries.map((e, i) => (
                                        <tr key={i} className="hover:bg-[#0891B2]/4 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-3 py-2 text-xs" style={{ color: '#475569' }}>{formatDate(e.date)}</td>
                                            <td className="px-3 py-2 text-xs font-bold" style={{ color: '#0891B2' }}>{e.entryNo}</td>
                                            <td className="px-3 py-2">
                                                <span className="inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap shrink-0" style={{ color: '#B45309', background: 'rgba(180,83,9,0.15)' }}>
                                                    {docLabelMap[e.docType] ?? e.docType}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs max-w-[250px] truncate" style={{ color: '#0F172A' }}>{e.description || '—'}</td>
                                            <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: '#15803D' }}>
                                                {e.debit > 0 ? formatVND(e.debit) : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: '#B91C1C' }}>
                                                {e.credit > 0 ? formatVND(e.credit) : ''}
                                            </td>
                                            <td className="px-3 py-2 text-right text-xs font-bold" style={{ color: e.balance >= 0 ? '#15803D' : '#B91C1C' }}>
                                                {formatVND(Math.abs(e.balance))}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Closing balance */}
                                    <tr style={{ background: 'rgba(8,145,178,0.08)', borderTop: '2px solid #E2E8F0' }}>
                                        <td colSpan={4} className="px-3 py-2.5 text-xs font-bold uppercase" style={{ color: '#0F172A' }}>
                                            {isEn ? 'Closing balance' : 'Số dư cuối kỳ'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: '#15803D' }}>
                                            {formatVND(data.entries.reduce((s, e) => s + e.debit, 0))}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: '#B91C1C' }}>
                                            {formatVND(data.entries.reduce((s, e) => s + e.credit, 0))}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-xs font-bold" style={{ color: data.closingBalance >= 0 ? '#15803D' : '#B91C1C' }}>
                                            {formatVND(Math.abs(data.closingBalance))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    )
}
