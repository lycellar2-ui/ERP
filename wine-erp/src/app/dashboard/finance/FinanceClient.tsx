'use client'

import { useState } from 'react'
import { DollarSign, TrendingDown, AlertCircle, Clock, CheckCircle2, ReceiptText, ArrowUpRight, ArrowDownRight, BookOpen, BarChart3, Wallet, Lock, Skull } from 'lucide-react'
import { ARRow, APRow, getARInvoices, getAPInvoices, recordARPayment, recordAPPayment } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { JournalEntryTab, ProfitLossTab, ExpenseTab, PeriodCloseTab, BalanceSheetTab, BadDebtTab } from './FinanceTabs'

type Tab = 'ar' | 'ap' | 'aging' | 'journal' | 'pnl' | 'bs' | 'expense' | 'period' | 'baddebt'

const AR_STATUS: Record<string, { label: string; color: string }> = {
    ISSUED: { label: 'Chưa Thu', color: '#D4A853' },
    PARTIALLY_PAID: { label: 'Đã Thu 1 Phần', color: '#4A8FAB' },
    PAID: { label: 'Đã Thu Đủ', color: '#5BA88A' },
    OVERDUE: { label: 'Quá Hạn', color: '#8B1A2E' },
    CANCELLED: { label: 'Huỷ', color: '#4A6A7A' },
}

function FinKpiCard({ label, value, sub, accent, icon: Icon }: {
    label: string; value: string; sub?: string; accent: string; icon: React.FC<any>
}) {
    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${accent}` }}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#4A6A7A' }}>{label}</p>
                    <p className="text-2xl font-bold" style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{value}</p>
                    {sub && <p className="text-xs mt-1" style={{ color: accent }}>{sub}</p>}
                </div>
                <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <Icon size={20} style={{ color: accent }} />
                </div>
            </div>
        </div>
    )
}

function AgingBars({ buckets }: { buckets: Record<string, number> }) {
    const total = Object.values(buckets).reduce((a, b) => a + b, 0)
    const bars = [
        { label: 'Chưa Đến Hạn', key: 'current', color: '#5BA88A' },
        { label: '1–30 Ngày', key: 'd30', color: '#D4A853' },
        { label: '31–60 Ngày', key: 'd60', color: '#D4833A' },
        { label: '61–90 Ngày', key: 'd90', color: '#C45A2A' },
        { label: '> 90 Ngày', key: 'over90', color: '#8B1A2E' },
    ]

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#E8F1F2' }}>AR Aging Report – Phân Tầng Công Nợ</h3>
            <div className="space-y-3">
                {bars.map(b => {
                    const val = (buckets as any)[b.key] ?? 0
                    const pct = total > 0 ? (val / total) * 100 : 0
                    return (
                        <div key={b.key}>
                            <div className="flex justify-between mb-1">
                                <span className="text-xs" style={{ color: '#8AAEBB' }}>{b.label}</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                        {formatVND(val)}
                                    </span>
                                    <span className="text-xs w-12 text-right" style={{ color: b.color }}>{pct.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: b.color }} />
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between pt-4 mt-4" style={{ borderTop: '1px solid #2A4355' }}>
                <span className="text-sm font-semibold" style={{ color: '#8AAEBB' }}>Tổng AR Outstanding</span>
                <span className="text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#87CBB9' }}>
                    {formatVND(total)}
                </span>
            </div>
        </div>
    )
}

function ARTable({ rows, onPayment }: { rows: ARRow[]; onPayment: (id: string) => void }) {
    return (
        <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                        {['Số HĐ', 'Khách Hàng', 'SO', 'Giá Trị', 'Đã Thu', 'Còn Lại', 'Hạn TT', 'Trạng Thái', ''].map(h => (
                            <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                            Không có hóa đơn nào
                        </td></tr>
                    ) : rows.map(row => (
                        <tr key={row.id}
                            style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: row.isOverdue ? 'rgba(139,26,46,0.04)' : 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = row.isOverdue ? 'rgba(139,26,46,0.04)' : 'transparent')}
                        >
                            <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5">
                                    {row.isOverdue && <AlertCircle size={12} style={{ color: '#8B1A2E' }} />}
                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.invoiceNo}</span>
                                </div>
                            </td>
                            <td className="px-3 py-3">
                                <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.customerName}</p>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>{row.customerCode}</p>
                            </td>
                            <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{row.soNo ?? '–'}</td>
                            <td className="px-3 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{formatVND(row.amount)}</td>
                            <td className="px-3 py-3 text-sm" style={{ fontFamily: '"DM Mono"', color: '#5BA88A' }}>{formatVND(row.paidAmount)}</td>
                            <td className="px-3 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: row.outstanding > 0 ? '#D4A853' : '#5BA88A' }}>
                                {formatVND(row.outstanding)}
                            </td>
                            <td className="px-3 py-3 text-xs" style={{ color: row.isOverdue ? '#8B1A2E' : '#8AAEBB' }}>
                                {formatDate(row.dueDate)}
                                {row.isOverdue && row.daysOverdue > 0 && (
                                    <p className="font-bold" style={{ color: '#8B1A2E' }}>+{row.daysOverdue}d</p>
                                )}
                            </td>
                            <td className="px-3 py-3">
                                {AR_STATUS[row.status] && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ color: AR_STATUS[row.status].color, background: `${AR_STATUS[row.status].color}18` }}>
                                        {AR_STATUS[row.status].label}
                                    </span>
                                )}
                            </td>
                            <td className="px-3 py-3">
                                {row.outstanding > 0 && row.status !== 'CANCELLED' && (
                                    <button onClick={() => onPayment(row.id)}
                                        className="px-2.5 py-1 text-xs font-semibold transition-all"
                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)', borderRadius: '4px' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.25)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(91,168,138,0.15)')}
                                    >
                                        Ghi Thu
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

interface Props {
    initialAR: ARRow[]
    initialAP: APRow[]
    stats: { arTotal: number; arOverdue: number; apTotal: number; apOverdue: number; monthRevenue: number; arOverdueCount: number; apOverdueCount: number }
    agingBuckets: Record<string, number>
    userId: string
}

export function FinanceClient({ initialAR, initialAP, stats, agingBuckets, userId }: Props) {
    const [tab, setTab] = useState<Tab>('ar')
    const [arRows, setArRows] = useState(initialAR)
    const [apRows, setApRows] = useState(initialAP)
    const [paymentModal, setPaymentModal] = useState<string | null>(null)   // AR invoice ID
    const [apPaymentModal, setApPaymentModal] = useState<string | null>(null) // AP invoice ID
    const [payAmount, setPayAmount] = useState('')
    const [payMethod, setPayMethod] = useState('BANK_TRANSFER')
    const [payReference, setPayReference] = useState('')
    const [payLoading, setPayLoading] = useState(false)

    const handlePayment = async () => {
        if (!paymentModal || !payAmount) return
        setPayLoading(true)
        const result = await recordARPayment(paymentModal, Number(payAmount), payMethod)
        if (result.success) {
            const { rows } = await getARInvoices({ pageSize: 25 })
            setArRows(rows)
            setPaymentModal(null)
            setPayAmount('')
        }
        setPayLoading(false)
    }

    const handleAPPayment = async () => {
        if (!apPaymentModal || !payAmount) return
        setPayLoading(true)
        const result = await recordAPPayment(apPaymentModal, Number(payAmount), payMethod, payReference || undefined)
        if (result.success) {
            const { rows } = await getAPInvoices({ pageSize: 25 })
            setApRows(rows)
            setApPaymentModal(null)
            setPayAmount('')
            setPayReference('')
        }
        setPayLoading(false)
    }

    const tabs: { key: Tab; label: string; icon: React.FC<any> }[] = [
        { key: 'ar', label: 'AR – Phải Thu', icon: ArrowUpRight },
        { key: 'ap', label: 'AP – Phải Trả', icon: ArrowDownRight },
        { key: 'aging', label: 'AR Aging', icon: Clock },
        { key: 'journal', label: 'Sổ Nhật Ký', icon: BookOpen },
        { key: 'pnl', label: 'P&L', icon: BarChart3 },
        { key: 'bs', label: 'CĐKT', icon: ReceiptText },
        { key: 'expense', label: 'Chi Phí', icon: Wallet },
        { key: 'period', label: 'Đóng Kỳ', icon: Lock },
        { key: 'baddebt', label: 'Nợ Khó Đòi', icon: Skull },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                    Tài Chính & Kế Toán (FIN)
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                    AR/AP, Aging Report, Dòng Tiền – Tuân thủ pháp lý Việt Nam
                </p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <FinKpiCard label="Phải Thu (AR)" value={`₫${(stats.arTotal / 1e9).toFixed(2)}T`} accent="#87CBB9" icon={ArrowUpRight} />
                <FinKpiCard label="AR Quá Hạn" value={`₫${(stats.arOverdue / 1e6).toFixed(0)}M`} sub={`${stats.arOverdueCount} hóa đơn`} accent="#8B1A2E" icon={AlertCircle} />
                <FinKpiCard label="Phải Trả (AP)" value={`₫${(stats.apTotal / 1e9).toFixed(2)}T`} accent="#D4A853" icon={ArrowDownRight} />
                <FinKpiCard label="AP Quá Hạn" value={`₫${(stats.apOverdue / 1e6).toFixed(0)}M`} sub={`${stats.apOverdueCount} hóa đơn`} accent="#C45A2A" icon={AlertCircle} />
                <FinKpiCard label="Doanh Thu Tháng" value={`₫${(stats.monthRevenue / 1e9).toFixed(2)}T`} accent="#5BA88A" icon={TrendingDown} />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-md" style={{ background: '#142433', width: 'fit-content' }}>
                {tabs.map(t => {
                    const Icon = t.icon
                    return (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded"
                            style={{
                                background: tab === t.key ? '#1B2E3D' : 'transparent',
                                color: tab === t.key ? '#87CBB9' : '#4A6A7A',
                            }}>
                            <Icon size={14} />
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            {tab === 'ar' && <ARTable rows={arRows} onPayment={setPaymentModal} />}

            {tab === 'ap' && (
                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Số HĐ', 'Nhà Cung Cấp', 'PO', 'Giá Trị', 'Tiền Tệ', 'Còn Lại', 'Hạn TT', 'Trạng Thái', ''].map(h => (
                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {apRows.length === 0 ? (
                                <tr><td colSpan={9} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>Không có AP nào</td></tr>
                            ) : apRows.map(row => (
                                <tr key={row.id}
                                    style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', background: row.isOverdue ? 'rgba(139,26,46,0.04)' : 'transparent' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = row.isOverdue ? 'rgba(139,26,46,0.04)' : 'transparent')}
                                >
                                    <td className="px-3 py-3 text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.invoiceNo}</td>
                                    <td className="px-3 py-3">
                                        <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.supplierName}</p>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{row.supplierCode}</p>
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{row.poNo ?? '–'}</td>
                                    <td className="px-3 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                        {row.currency === 'VND' ? formatVND(row.amount) : `$${row.amount.toLocaleString()}`}
                                    </td>
                                    <td className="px-3 py-3 text-xs font-bold" style={{ color: '#D4A853' }}>{row.currency}</td>
                                    <td className="px-3 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: row.outstanding > 0 ? '#D4A853' : '#5BA88A' }}>
                                        {row.currency === 'VND' ? formatVND(row.outstanding) : `$${row.outstanding.toLocaleString()}`}
                                    </td>
                                    <td className="px-3 py-3 text-xs" style={{ color: row.isOverdue ? '#8B1A2E' : '#8AAEBB' }}>{formatDate(row.dueDate)}</td>
                                    <td className="px-3 py-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full"
                                            style={{ background: row.isOverdue ? 'rgba(139,26,46,0.15)' : 'rgba(212,168,83,0.15)', color: row.isOverdue ? '#8B1A2E' : '#D4A853' }}>
                                            {row.isOverdue ? 'Quá Hạn' : 'Chưa Trả'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3">
                                        {row.outstanding > 0 && (
                                            <button onClick={() => { setApPaymentModal(row.id); setPayAmount(String(Math.round(row.outstanding))); }}
                                                className="px-2.5 py-1 text-xs font-semibold"
                                                style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)', borderRadius: '4px' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.25)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,168,83,0.15)')}>
                                                Ghi Trả
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'aging' && <AgingBars buckets={agingBuckets} />}

            {tab === 'journal' && <JournalEntryTab />}

            {tab === 'pnl' && <ProfitLossTab />}

            {tab === 'bs' && <BalanceSheetTab />}

            {tab === 'expense' && <ExpenseTab userId={userId} />}

            {tab === 'period' && <PeriodCloseTab userId={userId} />}

            {tab === 'baddebt' && <BadDebtTab userId={userId} />}

            {/* Payment modal */}
            {paymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,25,38,0.8)' }}>
                    <div className="w-full max-w-sm p-6 rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', boxShadow: '0 24px 64px rgba(10,25,38,0.7)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#E8F1F2' }}>Ghi Nhận Thanh Toán</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Số Tiền Thu (VND)</label>
                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Phương Thức</label>
                                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}>
                                    <option value="BANK_TRANSFER">Chuyển Khoản</option>
                                    <option value="CASH">Tiền Mặt</option>
                                    <option value="COD">COD</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => setPaymentModal(null)} className="px-4 py-2 text-sm"
                                style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}>Huỷ</button>
                            <button onClick={handlePayment} disabled={payLoading || !payAmount}
                                className="px-5 py-2 text-sm font-semibold transition-all"
                                style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}>
                                {payLoading ? 'Đang lưu...' : 'Xác Nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AP Payment modal */}
            {apPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,25,38,0.8)' }}>
                    <div className="w-full max-w-sm p-6 rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', boxShadow: '0 24px 64px rgba(10,25,38,0.7)' }}>
                        <h3 className="text-lg font-bold mb-4" style={{ color: '#E8F1F2' }}>Ghi Nhận Thanh Toán AP</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Số Tiền Thanh Toán</label>
                                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Phương Thức</label>
                                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}>
                                    <option value="BANK_TRANSFER">Chuyển Khoản</option>
                                    <option value="CASH">Tiền Mặt</option>
                                    <option value="CHECK">Séc</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>Số Tham Chiếu (tùy chọn)</label>
                                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)}
                                    placeholder="Số chứng từ, mã GD..."
                                    className="w-full px-3 py-2.5 text-sm outline-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                    onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                    onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-5">
                            <button onClick={() => setApPaymentModal(null)} className="px-4 py-2 text-sm"
                                style={{ color: '#8AAEBB', border: '1px solid #2A4355', borderRadius: '6px' }}>Huỷ</button>
                            <button onClick={handleAPPayment} disabled={payLoading || !payAmount}
                                className="px-5 py-2 text-sm font-semibold"
                                style={{ background: '#D4A853', color: '#0A1926', borderRadius: '6px' }}>
                                {payLoading ? 'Đang lưu...' : 'Xác Nhận Thanh Toán'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
