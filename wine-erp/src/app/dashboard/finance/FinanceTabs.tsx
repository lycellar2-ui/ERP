'use client'

import { useState, useCallback } from 'react'
import { BookOpen, Loader2, TrendingUp, TrendingDown, Filter, Plus, CheckCircle2, XCircle, Lock, AlertTriangle, CircleCheck, Download } from 'lucide-react'
import {
    JournalEntryRow, getJournalEntries,
    PLRow, getProfitLoss, getProfitLossComparison, exportProfitLossExcel,
    getAccountingPeriods, closeAccountingPeriod,
    ExpenseRow, getExpenses, createExpense, approveExpense, rejectExpense,
    PeriodCloseCheckItem, getPeriodCloseChecklist,
    BSLineItem, getBalanceSheet,
    BadDebtCandidate, getBadDebtCandidates, writeOffBadDebt,
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'

const card: React.CSSProperties = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }

const DOC_TYPE_LABEL: Record<string, string> = {
    GOODS_RECEIPT: 'Nhập kho',
    SALES_INVOICE: 'Bán hàng',
    PAYMENT_IN: 'Thu tiền',
    PAYMENT_OUT: 'Chi tiền',
    COGS: 'Giá vốn',
    EXPENSE: 'Chi phí',
    ADJUSTMENT: 'Điều chỉnh',
}

const DOC_TYPE_COLOR: Record<string, string> = {
    GOODS_RECEIPT: '#4A8FAB',
    SALES_INVOICE: '#5BA88A',
    PAYMENT_IN: '#87CBB9',
    PAYMENT_OUT: '#D4A853',
    COGS: '#E05252',
    EXPENSE: '#8B1A2E',
}

// ── Journal Entry Tab ─────────────────────────
export function JournalEntryTab() {
    const [entries, setEntries] = useState<JournalEntryRow[]>([])
    const [total, setTotal] = useState(0)
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [docFilter, setDocFilter] = useState('')

    const loadEntries = useCallback(async (docType?: string) => {
        setLoading(true)
        const data = await getJournalEntries({ docType: docType || undefined, pageSize: 100 })
        setEntries(data.rows)
        setTotal(data.total)
        setLoaded(true)
        setLoading(false)
    }, [])

    if (!loaded && !loading) loadEntries()

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#8AAEBB' }}>
                    <BookOpen size={14} className="inline mr-1.5" />
                    {total} bút toán
                </p>
                <div className="flex gap-2">
                    <select value={docFilter} onChange={e => { setDocFilter(e.target.value); loadEntries(e.target.value) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: docFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả loại</option>
                        {Object.entries(DOC_TYPE_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : entries.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <BookOpen size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có bút toán nào</p>
                    <p className="text-xs mt-1" style={{ color: '#2A4355' }}>Bút toán sẽ tự động sinh khi confirm GR, DO, AR/AP Payment</p>
                </div>
            ) : (
                <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Mã', 'Loại', 'Diễn giải', 'Kỳ', 'Nợ (Debit)', 'Có (Credit)', 'Dòng', 'Ngày'].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => {
                                const typeColor = DOC_TYPE_COLOR[e.docType] ?? '#8AAEBB'
                                return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{e.entryNo}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                style={{ color: typeColor, background: `${typeColor}20` }}>
                                                {DOC_TYPE_LABEL[e.docType] ?? e.docType}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs max-w-[200px] truncate" style={{ color: '#E8F1F2' }}>
                                            {e.description ?? '—'}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                            {e.periodLabel}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-xs font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>
                                                {e.totalDebit > 0 ? formatVND(e.totalDebit) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-xs font-bold" style={{ color: '#E05252', fontFamily: '"DM Mono"' }}>
                                                {e.totalCredit > 0 ? formatVND(e.totalCredit) : '—'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center text-xs" style={{ color: '#8AAEBB' }}>{e.lineCount}</td>
                                        <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>{formatDate(e.postedAt)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ── P&L Tab ─────────────────────────────────
export function ProfitLossTab() {
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
            case 'summary': return { background: 'rgba(135,203,185,0.08)', fontWeight: 700 }
            case 'revenue': return { color: '#5BA88A' }
            case 'cogs': return { color: '#E05252' }
            case 'expense': return { color: '#D4A853' }
            default: return {}
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                    Báo Cáo Lãi / Lỗ (P&L)
                </h3>
                <div className="flex gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={loadPL} className="text-xs px-3 py-1.5 rounded font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        Xem
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
                            style={{ border: '1px solid #2A4355', color: '#87CBB9' }}>
                            <Download size={12} /> {exporting ? '...' : 'Excel'}
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : !data ? null : (
                <div className="space-y-4">
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Doanh thu', value: data.revenue, color: '#5BA88A', icon: TrendingUp },
                            { label: 'Giá vốn (COGS)', value: data.cogs, color: '#E05252', icon: TrendingDown },
                            { label: 'Lãi gộp', value: data.grossProfit, color: data.grossProfit >= 0 ? '#87CBB9' : '#8B1A2E', icon: TrendingUp },
                            { label: 'Lãi ròng', value: data.netProfit, color: data.netProfit >= 0 ? '#5BA88A' : '#8B1A2E', icon: TrendingUp },
                        ].map(s => (
                            <div key={s.label} className="p-3 rounded-md" style={card}>
                                <p className="text-xs uppercase mb-1" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-lg font-bold" style={{ color: s.color, fontFamily: '"DM Mono"' }}>
                                    {formatVND(s.value)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* P&L Table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#4A6A7A' }}>Khoản mục</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-right" style={{ color: '#4A6A7A' }}>
                                        Số tiền — T{month}/{year}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', ...rowStyle(row.type) }}>
                                        <td className="px-4 py-2.5 text-sm" style={{ color: row.type === 'summary' ? '#E8F1F2' : '#8AAEBB' }}>
                                            {row.type === 'expense' && <span className="ml-4">↳ </span>}
                                            {row.label}
                                        </td>
                                        <td className="px-4 py-2.5 text-right" style={{ fontFamily: '"DM Mono"' }}>
                                            <span className="text-sm" style={{
                                                color: row.amount > 0 ? '#5BA88A' : row.amount < 0 ? '#E05252' : '#4A6A7A',
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
                        <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                            <div className="px-4 py-3" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D4A853' }}>So Sánh</p>
                            </div>
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                        <th className="px-4 py-2.5 text-xs text-left" style={{ color: '#4A6A7A' }}>Khoản mục</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#4A6A7A' }}>T{month}/{year}</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#4A6A7A' }}>vs {comparison.vsPrevMonth.period}</th>
                                        <th className="px-4 py-2.5 text-xs text-right" style={{ color: '#4A6A7A' }}>vs {comparison.vsLastYear.period}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: 'Doanh thu', curr: data.revenue, prevChg: comparison.vsPrevMonth.revenueChg, lyChg: comparison.vsLastYear.revenueChg },
                                        { label: 'Giá vốn', curr: data.cogs, prevChg: comparison.vsPrevMonth.cogsChg, lyChg: comparison.vsLastYear.cogsChg },
                                        { label: 'Lãi gộp', curr: data.grossProfit, prevChg: comparison.vsPrevMonth.grossProfitChg, lyChg: comparison.vsLastYear.grossProfitChg },
                                        { label: 'Chi phí', curr: data.expenses, prevChg: comparison.vsPrevMonth.expensesChg, lyChg: comparison.vsLastYear.expensesChg },
                                        { label: 'Lãi ròng', curr: data.netProfit, prevChg: comparison.vsPrevMonth.netProfitChg, lyChg: comparison.vsLastYear.netProfitChg },
                                    ].map(r => {
                                        const chgBadge = (val: number | null) => {
                                            if (val === null) return <span className="text-xs" style={{ color: '#4A6A7A' }}>—</span>
                                            const positive = val >= 0
                                            return (
                                                <span className="text-xs font-bold" style={{ color: positive ? '#5BA88A' : '#E05252', fontFamily: '"DM Mono"' }}>
                                                    {positive ? '↑' : '↓'}{Math.abs(val)}%
                                                </span>
                                            )
                                        }
                                        return (
                                            <tr key={r.label} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                                <td className="px-4 py-2 text-xs font-semibold" style={{ color: '#8AAEBB' }}>{r.label}</td>
                                                <td className="px-4 py-2 text-right text-xs" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{formatVND(r.curr)}</td>
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
    { value: 'SALARY', label: 'Lương & BHXH', account: '642' },
    { value: 'RENT', label: 'Thuê mặt bằng', account: '642' },
    { value: 'UTILITIES', label: 'Điện nước, Internet', account: '642' },
    { value: 'LOGISTICS', label: 'Vận chuyển', account: '641' },
    { value: 'MARKETING', label: 'Quảng cáo', account: '641' },
    { value: 'INSURANCE', label: 'Bảo hiểm', account: '635' },
    { value: 'BANK_FEE', label: 'Phí ngân hàng', account: '635' },
    { value: 'OTHER_EXPENSE', label: 'Chi phí khác', account: '811' },
]

const EXP_STATUS: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#4A6A7A' },
    PENDING_APPROVAL: { label: 'Chờ duyệt', color: '#D4A853' },
    APPROVED: { label: 'Đã duyệt', color: '#5BA88A' },
    REJECTED: { label: 'Từ chối', color: '#8B1A2E' },
}

const input: React.CSSProperties = { background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }

// ── Expense Tab ───────────────────────────────
export function ExpenseTab({ userId }: { userId: string }) {
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
        await createExpense({ category: cat, amount: Number(amount), description: desc })
        setCat('SALARY'); setAmount(''); setDesc(''); setShowCreate(false)
        await load()
        setSaving(false)
    }

    const handleApprove = async (id: string) => {
        await approveExpense(id)
        load()
    }
    const handleReject = async (id: string) => {
        await rejectExpense(id)
        load()
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: '#8AAEBB' }}>{expenses.length} chi phí</p>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={14} /> Thêm Chi Phí
                </button>
            </div>

            {showCreate && (
                <div className="p-4 rounded-md space-y-3" style={card}>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Danh mục</label>
                            <select value={cat} onChange={e => setCat(e.target.value)}
                                className="w-full px-3 py-2 text-sm outline-none" style={input}>
                                {EXPENSE_CATS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label} (TK {c.account})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Số tiền (VND)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                placeholder="5000000" className="w-full px-3 py-2 text-sm outline-none" style={input} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#4A6A7A' }}>Mô tả</label>
                            <input value={desc} onChange={e => setDesc(e.target.value)}
                                placeholder="Tiền thuê VP tháng 3..." className="w-full px-3 py-2 text-sm outline-none" style={input} />
                        </div>
                    </div>
                    {Number(amount) > 5_000_000 && (
                        <p className="text-xs flex items-center gap-1" style={{ color: '#D4A853' }}>
                            <AlertTriangle size={12} /> Chi phí {'>'} 5.000.000₫ cần CEO phê duyệt
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs"
                            style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}>Huỷ</button>
                        <button onClick={handleCreate} disabled={saving || !amount || !desc}
                            className="px-4 py-1.5 text-xs font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? 'Đang lưu...' : 'Tạo Chi Phí'}
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : expenses.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có chi phí nào</p>
                </div>
            ) : (
                <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Mã', 'Danh mục', 'TK', 'Số tiền', 'Mô tả', 'Kỳ', 'Trạng thái', 'Người tạo', ''].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map(e => {
                                const st = EXP_STATUS[e.status] ?? EXP_STATUS.DRAFT
                                return (
                                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                                        <td className="px-3 py-2 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{e.expenseNo}</td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#E8F1F2' }}>{e.categoryLabel}</td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{e.account.split(' - ')[0]}</td>
                                        <td className="px-3 py-2 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{formatVND(e.amount)}</td>
                                        <td className="px-3 py-2 text-xs max-w-[180px] truncate" style={{ color: '#8AAEBB' }}>{e.description}</td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{e.periodLabel}</td>
                                        <td className="px-3 py-2">
                                            <span className="text-xs px-2 py-0.5 rounded font-semibold"
                                                style={{ color: st.color, background: `${st.color}18` }}>{st.label}</span>
                                        </td>
                                        <td className="px-3 py-2 text-xs" style={{ color: '#8AAEBB' }}>{e.creatorName}</td>
                                        <td className="px-3 py-2">
                                            {e.status === 'PENDING_APPROVAL' && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleApprove(e.id)} title="Duyệt"
                                                        className="p-1 rounded" style={{ color: '#5BA88A', background: 'rgba(91,168,138,0.15)' }}>
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleReject(e.id)} title="Từ chối"
                                                        className="p-1 rounded" style={{ color: '#8B1A2E', background: 'rgba(139,26,46,0.15)' }}>
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
            )}
        </div>
    )
}

// ── Period Close Tab ──────────────────────────
export function PeriodCloseTab({ userId }: { userId: string }) {
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
        await closeAccountingPeriod(currentPeriod.id, userId)
        await load()
        setClosing(false)
    }

    const statusIcon = (s: string) => {
        if (s === 'ok') return <CircleCheck size={16} style={{ color: '#5BA88A' }} />
        if (s === 'warning') return <AlertTriangle size={16} style={{ color: '#D4A853' }} />
        return <XCircle size={16} style={{ color: '#E05252' }} />
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Đóng Kỳ Kế Toán</h3>
                <div className="flex gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setChecklist(null) }}
                        className="text-xs px-3 py-1.5 rounded" style={{ ...input, width: 'auto' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setChecklist(null) }}
                        className="text-xs px-3 py-1.5 rounded" style={{ ...input, width: 'auto' }}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={load} className="text-xs px-3 py-1.5 rounded font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>Kiểm Tra</button>
                </div>
            </div>

            {isClosed && (
                <div className="p-3 rounded-md flex items-center gap-2"
                    style={{ background: 'rgba(91,168,138,0.1)', border: '1px solid rgba(91,168,138,0.3)' }}>
                    <Lock size={16} style={{ color: '#5BA88A' }} />
                    <span className="text-sm font-semibold" style={{ color: '#5BA88A' }}>
                        Kỳ T{month}/{year} đã đóng — Không thể tạo chứng từ mới trong kỳ này
                    </span>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : checklist ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        {checklist.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-md" style={card}>
                                <div className="flex items-center gap-3">
                                    {statusIcon(item.status)}
                                    <span className="text-sm" style={{ color: '#E8F1F2' }}>{item.label}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    {item.amount > 0 && (
                                        <span className="text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                            {formatVND(item.amount)}
                                        </span>
                                    )}
                                    <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                        color: item.status === 'ok' ? '#5BA88A' : item.status === 'warning' ? '#D4A853' : '#E05252',
                                        background: item.status === 'ok' ? 'rgba(91,168,138,0.15)' : item.status === 'warning' ? 'rgba(212,168,83,0.15)' : 'rgba(224,82,82,0.15)',
                                    }}>
                                        {item.count > 0 ? `${item.count} mục` : 'OK'}
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
                                    background: hasDanger ? '#2A4355' : '#87CBB9',
                                    color: hasDanger ? '#4A6A7A' : '#0A1926',
                                    cursor: hasDanger ? 'not-allowed' : 'pointer',
                                }}>
                                <Lock size={14} />
                                {closing ? 'Đang đóng kỳ...' : hasDanger ? 'Cần xử lý mục đỏ trước khi đóng' : `Đóng Kỳ T${month}/${year}`}
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
            case 'asset': return '#87CBB9'
            case 'liability': return '#D4A853'
            case 'equity': return '#5BA88A'
            default: return '#E8F1F2'
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                    Bảng Cân Đối Kế Toán (VAS)
                </h3>
                <div className="flex gap-2">
                    <select value={month} onChange={e => { setMonth(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => { setYear(Number(e.target.value)); setData(null) }}
                        className="text-xs px-3 py-1.5 rounded"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button onClick={loadBS} className="text-xs px-3 py-1.5 rounded font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        Xem
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : !data ? null : (
                <div className="space-y-4">
                    {/* Balance check */}
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold"
                        style={{
                            background: data.isBalanced ? 'rgba(91,168,138,0.1)' : 'rgba(224,82,82,0.1)',
                            border: `1px solid ${data.isBalanced ? 'rgba(91,168,138,0.3)' : 'rgba(224,82,82,0.3)'}`,
                            color: data.isBalanced ? '#5BA88A' : '#E05252',
                        }}>
                        {data.isBalanced ? <CircleCheck size={14} /> : <XCircle size={14} />}
                        {data.isBalanced
                            ? `Cân đối ✔ — Tài Sản = Nợ + Vốn CSH (tại ${month}/${year})`
                            : `⚠️ Bảng không cân đối! Tài sản: ${formatVND(data.totalAssets)} ≠ Nợ+Vốn: ${formatVND(data.totalLiabilities + data.totalEquity)}`
                        }
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Tài Sản', value: data.totalAssets, color: '#87CBB9', prefix: 'A' },
                            { label: 'Nợ Phải Trả', value: data.totalLiabilities, color: '#D4A853', prefix: 'L' },
                            { label: 'Vốn CSH', value: data.totalEquity, color: '#5BA88A', prefix: 'E' },
                        ].map(s => (
                            <div key={s.prefix} className="p-4 rounded-md" style={card}>
                                <p className="text-xs uppercase mb-1 font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ color: s.color, fontFamily: '"DM Mono"' }}>
                                    {formatVND(s.value)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Detail table */}
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#4A6A7A' }}>Mã TK</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-left" style={{ color: '#4A6A7A' }}>Khoản mục</th>
                                    <th className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-right" style={{ color: '#4A6A7A' }}>
                                        Số dư cuối kỳ T{month}/{year}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.lines.map((line, i) => {
                                    const isSummary = line.category === 'summary'
                                    return (
                                        <tr key={i} style={{
                                            borderBottom: '1px solid rgba(42,67,85,0.5)',
                                            background: isSummary ? 'rgba(135,203,185,0.06)' : 'transparent',
                                        }}>
                                            <td className="px-4 py-2.5 text-xs" style={{
                                                color: isSummary ? '#E8F1F2' : '#4A6A7A',
                                                fontFamily: '"DM Mono"',
                                                paddingLeft: `${16 + (line.indent ?? 0) * 20}px`,
                                                fontWeight: isSummary ? 700 : 400,
                                            }}>
                                                {line.code}
                                            </td>
                                            <td className="px-4 py-2.5 text-sm" style={{
                                                color: isSummary ? '#E8F1F2' : '#8AAEBB',
                                                fontWeight: isSummary ? 700 : 400,
                                                paddingLeft: `${16 + (line.indent ?? 0) * 20}px`,
                                            }}>
                                                {line.label}
                                            </td>
                                            <td className="px-4 py-2.5 text-right" style={{ fontFamily: '"DM Mono"' }}>
                                                <span className="text-sm" style={{
                                                    color: isSummary ? '#E8F1F2' : categoryColor(line.category),
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
                    <div className="flex items-center justify-center gap-4 py-3 rounded-md text-sm" style={card}>
                        <span style={{ color: '#87CBB9', fontWeight: 700 }}>
                            Tài sản <span style={{ fontFamily: '"DM Mono"' }}>{formatVND(data.totalAssets)}</span>
                        </span>
                        <span style={{ color: '#4A6A7A', fontSize: 18 }}>=</span>
                        <span style={{ color: '#D4A853', fontWeight: 700 }}>
                            Nợ <span style={{ fontFamily: '"DM Mono"' }}>{formatVND(data.totalLiabilities)}</span>
                        </span>
                        <span style={{ color: '#4A6A7A', fontSize: 18 }}>+</span>
                        <span style={{ color: '#5BA88A', fontWeight: 700 }}>
                            Vốn <span style={{ fontFamily: '"DM Mono"' }}>{formatVND(data.totalEquity)}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Bad Debt Write-off Tab ────────────────────────
export function BadDebtTab({ userId }: { userId: string }) {
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
        const res = await writeOffBadDebt({ invoiceId, reason: reason.trim(), approvedBy: userId })
        if (res.success) {
            setCandidates(prev => prev.filter(c => c.invoiceId !== invoiceId))
            setWritingOff(null)
            setReason('')
        } else {
            alert(res.error ?? 'Lỗi xóa nợ')
        }
        setProcessing(false)
    }

    const severityColor = (days: number) => days > 270 ? '#8B1A2E' : days > 180 ? '#C45A2A' : '#D4A853'
    const totalOutstanding = candidates.reduce((s, c) => s + c.outstanding, 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                        Nợ Khó Đòi — Bad Debt Write-off
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                        Hóa đơn quá hạn &gt; 180 ngày. Xóa nợ sẽ ghi DR 642 / CR 131
                    </p>
                </div>
                {candidates.length > 0 && (
                    <div className="text-right">
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{candidates.length} hóa đơn</p>
                        <p className="text-sm font-bold" style={{ color: '#8B1A2E', fontFamily: '"DM Mono"' }}>
                            {formatVND(totalOutstanding)}
                        </p>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
            ) : candidates.length === 0 ? (
                <div className="text-center py-16 rounded-md" style={{ ...card, borderStyle: 'dashed' }}>
                    <CircleCheck size={32} className="mx-auto mb-3" style={{ color: '#5BA88A' }} />
                    <p className="text-sm font-semibold" style={{ color: '#5BA88A' }}>Không có nợ khó đòi</p>
                    <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>Tất cả AR đều trong vòng 180 ngày</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {candidates.map(c => {
                        const sColor = severityColor(c.daysOverdue)
                        const isExpanded = writingOff === c.invoiceId
                        return (
                            <div key={c.invoiceId} className="rounded-md overflow-hidden" style={card}>
                                <div className="flex items-center justify-between p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold"
                                            style={{ background: `${sColor}18`, color: sColor }}>
                                            +{c.daysOverdue}d
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                                    {c.invoiceNo}
                                                </span>
                                                <span className="text-sm font-medium" style={{ color: '#E8F1F2' }}>
                                                    {c.customerName}
                                                </span>
                                            </div>
                                            <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                                Hạn TT: {formatDate(c.dueDate)} · Gốc: {formatVND(c.amount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-sm font-bold" style={{ color: sColor, fontFamily: '"DM Mono"' }}>
                                                {formatVND(c.outstanding)}
                                            </p>
                                            <p className="text-[10px]" style={{ color: '#4A6A7A' }}>còn lại</p>
                                        </div>
                                        <button
                                            onClick={() => setWritingOff(isExpanded ? null : c.invoiceId)}
                                            className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                            style={{
                                                background: isExpanded ? 'rgba(139,26,46,0.2)' : 'rgba(139,26,46,0.1)',
                                                color: '#8B1A2E',
                                                border: '1px solid rgba(139,26,46,0.3)',
                                            }}>
                                            {isExpanded ? 'Hủy' : 'Xóa Nợ'}
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        <div>
                                            <label className="text-xs font-semibold uppercase block mb-1" style={{ color: '#4A6A7A' }}>
                                                Lý do xóa nợ <span style={{ color: '#8B1A2E' }}>*</span>
                                            </label>
                                            <input
                                                value={reason}
                                                onChange={e => setReason(e.target.value)}
                                                placeholder="VD: Khách phá sản, không liên lạc được..."
                                                className="w-full px-3 py-2 text-sm outline-none"
                                                style={{ ...input }} />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                                Bút toán: DR 642 (CP quản lý) {formatVND(c.outstanding)} / CR 131 (Phải thu) {formatVND(c.outstanding)}
                                            </p>
                                            <button
                                                onClick={() => handleWriteOff(c.invoiceId)}
                                                disabled={processing || !reason.trim()}
                                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-md disabled:opacity-50"
                                                style={{ background: '#8B1A2E', color: '#E8F1F2' }}>
                                                {processing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                                Xác Nhận Xóa Nợ
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
