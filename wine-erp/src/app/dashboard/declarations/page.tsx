'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Plus, X, Clock, CheckCircle2, Send, Filter, ChevronRight, UploadCloud, Save, Loader2 } from 'lucide-react'
import {
    getDeclarations, getDeclarationStats, createDeclaration,
    getDeclarationData, updateDeclarationStatus,
    uploadTaxDocument, signTaxDeclaration,
    getSCTDetailedReport,
    type DeclarationRow, type SCTDetailedReport,
} from './actions'
import { SignaturePad } from '@/components/SignaturePad'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
    IMPORT_CUSTOMS: { label: 'Tờ Khai NK', color: '#0891B2', icon: '📋' },
    SCT_MONTHLY: { label: 'TTĐB Tháng', color: '#D4A853', icon: '🧾' },
    SCT_QUARTERLY: { label: 'TTĐB Quý', color: '#D4A853', icon: '🧾' },
    VAT_MONTHLY: { label: 'VAT Tháng', color: '#4A8FAB', icon: '📁' },
    VAT_QUARTERLY: { label: 'VAT Quý', color: '#4A8FAB', icon: '📁' },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: 'rgba(138,174,187,0.15)' },
    APPROVED: { label: 'Đã Duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    SUBMITTED: { label: 'Đã Nộp', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
}

export default function DeclarationsPage() {
    const [rows, setRows] = useState<DeclarationRow[]>([])
    const [stats, setStats] = useState({ total: 0, draft: 0, submitted: 0, approved: 0 })
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailRow, setDetailRow] = useState<DeclarationRow | null>(null)
    const [detailData, setDetailData] = useState<any>(null)
    const [filterType, setFilterType] = useState('')

    // Upload & Sign states
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [savingSignature, setSavingSignature] = useState(false)
    const [sctReport, setSctReport] = useState<SCTDetailedReport | null>(null)
    const [sctLoading, setSctLoading] = useState(false)
    const [signatureUrl, setSignatureUrl] = useState('')

    const reload = async () => {
        const [d, s] = await Promise.all([
            getDeclarations(filterType ? { type: filterType } : {}),
            getDeclarationStats(),
        ])
        setRows(d.rows)
        setStats(s)
        setLoading(false)
    }

    useEffect(() => { reload() }, [filterType])

    const handleCreate = async (type: string, year: number, month?: number) => {
        const res = await createDeclaration({ type: type as any, periodYear: year, periodMonth: month, createdBy: 'system' })
        if (res.success) { setCreateOpen(false); reload() }
        else toast.error(res.error || 'Lỗi tạo tờ khai')
    }

    const handleViewDetail = async (row: DeclarationRow) => {
        setDetailRow(row)
        setSctReport(null)
        const data = await getDeclarationData({ type: row.type, year: row.periodYear, month: row.periodMonth ?? undefined })
        setDetailData(data)
        // Auto-load SCT detailed report for SCT declarations
        if (row.type.startsWith('SCT')) {
            setSctLoading(true)
            const report = await getSCTDetailedReport({ year: row.periodYear, month: row.periodMonth ?? undefined })
            setSctReport(report)
            setSctLoading(false)
        }
    }

    const handleStatusChange = async (id: string, status: 'APPROVED' | 'SUBMITTED') => {
        const res = await updateDeclarationStatus(id, status)
        if (res.success) { reload(); setDetailRow(null) }
        else toast.error(res.error || 'Lỗi cập nhật trạng thái')
    }

    const handleUpload = async (taxId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadTaxDocument(taxId, formData)
        setUploadingDoc(false)
        if (res.success && res.document) {
            reload()
            // reload detail row to show newly added doc
            setDetailRow(prev => prev ? { ...prev, documents: [...(prev.documents || []), res.document as any] } : prev)
        } else {
            toast.error(`Lỗi upload: ${res.error}`)
        }
    }

    const handleSign = async (taxId: string) => {
        if (!signatureUrl) return
        setSavingSignature(true)
        const res = await signTaxDeclaration(taxId, signatureUrl)
        setSavingSignature(false)
        if (res.success) {
            reload()
            setDetailRow(null)
            setDetailData(null)
        } else {
            toast.error(`Lỗi ký duyệt: ${res.error}`)
        }
    }

    const statCards = [
        { label: 'Tổng Tờ Khai', value: stats.total, icon: FileText, accent: '#87CBB9' },
        { label: 'Nháp', value: stats.draft, icon: Clock, accent: '#475569' },
        { label: 'Đã Duyệt', value: stats.approved, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Đã Nộp', value: stats.submitted, icon: Send, accent: '#D4A853' },
    ]

    const now = new Date()

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                        Tờ Khai Thuế & Hải Quan (DCL)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                        Quản lý tờ khai NK, thuế TTĐB, VAT — Xuất Excel chuẩn Bộ Tài Chính
                    </p>
                </div>
                <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all"
                    style={{ background: '#0891B2', color: '#FFFFFF', borderRadius: '6px' }}>
                    <Plus size={16} /> Tạo Tờ Khai
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {statCards.map(c => {
                    const Icon = c.icon
                    return (
                        <div key={c.label} className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} style={{ color: c.accent }} />
                                <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>{c.label}</span>
                            </div>
                            <p className="text-xl font-bold font-mono" style={{ color: c.accent }}>{c.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { title: 'Tờ Khai NK Tháng Này', desc: 'Tổng hợp thuế NK + TTĐB từ các lô nhập', icon: '📋', color: '#0891B2', type: 'IMPORT_CUSTOMS' },
                    { title: 'Báo Cáo Thuế GTGT', desc: 'VAT đầu vào/đầu ra theo kỳ khai', icon: '🧾', color: '#D4A853', type: 'VAT_MONTHLY' },
                    { title: 'Báo Cáo TTĐB Quý', desc: 'Thuế TTĐB theo quý cho cơ quan thuế', icon: '📁', color: '#4A8FAB', type: 'SCT_QUARTERLY' },
                ].map(item => (
                    <div key={item.title} className="p-5 rounded-md cursor-pointer transition-all"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        onClick={() => handleCreate(item.type, now.getFullYear(), now.getMonth() + 1)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = item.color)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                        <p className="text-3xl mb-3">{item.icon}</p>
                        <h3 className="font-semibold mb-1" style={{ color: '#0F172A' }}>{item.title}</h3>
                        <p className="text-xs" style={{ color: '#64748B' }}>{item.desc}</p>
                        <button className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
                            style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}40` }}>
                            Tạo Nhanh →
                        </button>
                    </div>
                ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
                <Filter size={14} style={{ color: '#64748B' }} />
                {[{ k: '', l: 'Tất cả' }, { k: 'IMPORT_CUSTOMS', l: 'NK' }, { k: 'SCT_MONTHLY', l: 'TTĐB' }, { k: 'VAT_MONTHLY', l: 'VAT' }].map(f => (
                    <button key={f.k} onClick={() => setFilterType(f.k)}
                        className="text-xs px-3 py-1 rounded font-semibold transition-all"
                        style={{
                            background: filterType === f.k ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                            color: filterType === f.k ? '#87CBB9' : '#64748B',
                            border: `1px solid ${filterType === f.k ? '#87CBB940' : '#E2E8F0'}`,
                        }}>
                        {f.l}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                            {['Loại', 'Kỳ', 'Trạng Thái', 'Ngày Tạo', 'Ngày Nộp', ''].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} className="text-center py-16 text-sm" style={{ color: '#64748B' }}>Đang tải...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-16 text-sm" style={{ color: '#64748B' }}>
                                Chưa có tờ khai nào — Sử dụng Quick Actions phía trên
                            </td></tr>
                        ) : rows.map(row => {
                            const tp = TYPE_MAP[row.type] ?? { label: row.type, color: '#475569', icon: '📄' }
                            const st = STATUS_MAP[row.status] ?? STATUS_MAP.DRAFT
                            return (
                                <tr key={row.id} className="cursor-pointer" style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                    onClick={() => handleViewDetail(row)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs font-bold" style={{ color: tp.color }}>{tp.icon} {tp.label}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#0F172A' }}>
                                        {row.periodMonth ? `T${row.periodMonth}/${row.periodYear}` : row.periodYear}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: st.bg, color: st.color }}>
                                            {st.label}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>
                                        {new Date(row.createdAt).toLocaleDateString('vi-VN')}
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>
                                        {row.submittedAt ? new Date(row.submittedAt).toLocaleDateString('vi-VN') : '—'}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <ChevronRight size={14} style={{ color: '#64748B' }} />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Detail Drawer */}
            {detailRow && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[600px] h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                    {TYPE_MAP[detailRow.type]?.label ?? detailRow.type}
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                                    Kỳ: {detailRow.periodMonth ? `T${detailRow.periodMonth}/${detailRow.periodYear}` : detailRow.periodYear}
                                </p>
                            </div>
                            <button onClick={() => { setDetailRow(null); setDetailData(null) }} style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Status Actions */}
                            {detailRow.status === 'DRAFT' && (
                                <div className="flex gap-2">
                                    <button onClick={() => handleStatusChange(detailRow.id, 'APPROVED')}
                                        className="flex-1 py-2 text-xs font-bold rounded"
                                        style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A' }}>
                                        ✓ Duyệt Tờ Khai
                                    </button>
                                </div>
                            )}
                            {detailRow.status === 'APPROVED' && (
                                <button onClick={() => handleStatusChange(detailRow.id, 'SUBMITTED')}
                                    className="w-full py-2 text-xs font-bold rounded"
                                    style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                    📤 Đánh Dấu Đã Nộp
                                </button>
                            )}

                            {/* Detail Data */}
                            {detailData?.type === 'VAT' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-3 rounded" style={{ background: '#FFFFFF' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Số HĐ</p>
                                            <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{detailData.invoiceCount}</p>
                                        </div>
                                        <div className="p-3 rounded" style={{ background: '#FFFFFF' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>Tổng Tiền</p>
                                            <p className="text-sm font-bold" style={{ color: '#D4A853' }}>
                                                {detailData.totalAmount?.toLocaleString('vi-VN')} ₫
                                            </p>
                                        </div>
                                        <div className="p-3 rounded" style={{ background: '#FFFFFF' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#64748B' }}>VAT</p>
                                            <p className="text-sm font-bold" style={{ color: '#0891B2' }}>
                                                {detailData.totalVat?.toLocaleString('vi-VN')} ₫
                                            </p>
                                        </div>
                                    </div>
                                    {detailData.invoices?.map((inv: any) => (
                                        <div key={inv.invoiceNo} className="flex justify-between text-xs p-2 rounded"
                                            style={{ background: '#FFFFFF' }}>
                                            <span style={{ color: '#0891B2' }}>{inv.invoiceNo}</span>
                                            <span style={{ color: '#D4A853' }}>{inv.amount?.toLocaleString('vi-VN')} ₫</span>
                                            <span style={{ color: '#5BA88A' }}>VAT: {inv.vatAmount?.toLocaleString('vi-VN')} ₫</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {detailData?.type === 'SCT' && (
                                <div className="space-y-4">
                                    <p className="text-xs font-bold" style={{ color: '#D4A853' }}>
                                        {detailData.lotCount} lô hàng chịu TTĐB
                                    </p>

                                    {/* TTĐB Bảng Kê Chi Tiết */}
                                    {sctLoading ? (
                                        <div className="flex items-center gap-2 py-4 justify-center text-xs" style={{ color: '#64748B' }}>
                                            <Loader2 size={14} className="animate-spin" /> Đang tính toán bảng kê TTĐB...
                                        </div>
                                    ) : sctReport ? (
                                        <div className="space-y-4">
                                            {/* Header */}
                                            <div className="p-3 rounded-lg" style={{ background: 'linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(135,203,185,0.05) 100%)', border: '1px solid rgba(212,168,83,0.2)' }}>
                                                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#D4A853' }}>
                                                    📊 Bảng Kê Thuế TTĐB — Kỳ {sctReport.period.month ? `T${sctReport.period.month}/${sctReport.period.year}` : sctReport.period.year}
                                                </p>

                                                {/* 3-column summary: Input | Output | Net */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="p-3 rounded-lg" style={{ background: '#FFFFFF' }}>
                                                        <p className="text-[10px] uppercase tracking-wide mb-1 font-bold" style={{ color: '#4A8FAB' }}>⬇ Đầu Vào (Nhập)</p>
                                                        <p className="text-xs" style={{ color: '#475569' }}>SL: <b>{sctReport.inputSummary.totalQty.toLocaleString('vi-VN')}</b></p>
                                                        <p className="text-xs" style={{ color: '#475569' }}>GT: <b>{sctReport.inputSummary.totalValue.toLocaleString('vi-VN')} ₫</b></p>
                                                        <p className="text-sm font-bold mt-1" style={{ color: '#4A8FAB' }}>
                                                            TTĐB: {sctReport.inputSummary.totalSCT.toLocaleString('vi-VN')} ₫
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg" style={{ background: '#FFFFFF' }}>
                                                        <p className="text-[10px] uppercase tracking-wide mb-1 font-bold" style={{ color: '#D4A853' }}>⬆ Đầu Ra (Bán)</p>
                                                        <p className="text-xs" style={{ color: '#475569' }}>SL: <b>{sctReport.outputSummary.totalQty.toLocaleString('vi-VN')}</b></p>
                                                        <p className="text-xs" style={{ color: '#475569' }}>DT: <b>{sctReport.outputSummary.totalRevenue.toLocaleString('vi-VN')} ₫</b></p>
                                                        <p className="text-sm font-bold mt-1" style={{ color: '#D4A853' }}>
                                                            TTĐB: {sctReport.outputSummary.totalSCT.toLocaleString('vi-VN')} ₫
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg" style={{ background: sctReport.netSCTPayable > 0 ? 'rgba(139,26,46,0.08)' : 'rgba(91,168,138,0.08)', border: `1px solid ${sctReport.netSCTPayable > 0 ? 'rgba(139,26,46,0.3)' : 'rgba(91,168,138,0.3)'}` }}>
                                                        <p className="text-[10px] uppercase tracking-wide mb-1 font-bold" style={{ color: sctReport.netSCTPayable > 0 ? '#C04E65' : '#5BA88A' }}>💰 Thuế Phải Nộp</p>
                                                        <p className="text-lg font-bold mt-2 font-mono" style={{ color: sctReport.netSCTPayable > 0 ? '#C04E65' : '#5BA88A' }}>
                                                            {sctReport.netSCTPayable.toLocaleString('vi-VN')} ₫
                                                        </p>
                                                        <p className="text-xs mt-1" style={{ color: '#64748B' }}>= Đầu ra − Đầu vào</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Product-level breakdown table */}
                                            <div>
                                                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#475569' }}>
                                                    Chi Tiết Theo Sản Phẩm ({sctReport.lines.length})
                                                </p>
                                                <div className="rounded-md overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ background: '#FFFFFF' }}>
                                                                {['SKU', 'Sản Phẩm', 'ABV', 'TTĐB%', 'Nhập (SL)', 'TTĐB Nhập', 'Bán (SL)', 'TTĐB Bán', 'Nộp'].map(h => (
                                                                    <th key={h} className="px-2 py-2 text-xs uppercase tracking-wider font-bold" style={{ color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {sctReport.lines.map(line => (
                                                                <tr key={line.skuCode} style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }}>
                                                                    <td className="px-2 py-1.5 text-[10px] font-bold" style={{ color: '#0891B2' }}>{line.skuCode}</td>
                                                                    <td className="px-2 py-1.5 text-[10px] truncate max-w-[100px]" style={{ color: '#0F172A' }}>{line.productName}</td>
                                                                    <td className="px-2 py-1.5 text-[10px] font-bold" style={{ color: '#475569' }}>{line.abvPercent}%</td>
                                                                    <td className="px-2 py-1.5">
                                                                        <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{
                                                                            background: line.sctRate === 65 ? 'rgba(139,26,46,0.2)' : 'rgba(212,168,83,0.2)',
                                                                            color: line.sctRate === 65 ? '#C04E65' : '#D4A853',
                                                                        }}>{line.sctRate}%</span>
                                                                    </td>
                                                                    <td className="px-2 py-1.5 text-[10px]" style={{ color: '#4A8FAB' }}>{line.inputQty}</td>
                                                                    <td className="px-2 py-1.5 text-[10px]" style={{ color: '#4A8FAB' }}>{line.inputSCT.toLocaleString('vi-VN')}</td>
                                                                    <td className="px-2 py-1.5 text-[10px]" style={{ color: '#D4A853' }}>{line.outputQty}</td>
                                                                    <td className="px-2 py-1.5 text-[10px]" style={{ color: '#D4A853' }}>{line.outputSCT.toLocaleString('vi-VN')}</td>
                                                                    <td className="px-2 py-1.5 text-[10px] font-bold" style={{ color: line.netSCT > 0 ? '#C04E65' : '#5BA88A' }}>{line.netSCT.toLocaleString('vi-VN')}</td>
                                                                </tr>
                                                            ))}
                                                            {sctReport.lines.length === 0 && (
                                                                <tr><td colSpan={9} className="text-center py-6 text-xs" style={{ color: '#64748B' }}>Không có dữ liệu TTĐB trong kỳ này</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Legacy lot list (compact fallback) */}
                                    {!sctReport && detailData.lots?.length > 0 && (
                                        <div className="space-y-1">
                                            {detailData.lots.map((lot: any) => (
                                                <div key={lot.lotNo} className="p-2 rounded text-xs" style={{ background: '#FFFFFF' }}>
                                                    <div className="flex justify-between">
                                                        <span style={{ color: '#0891B2' }}>{lot.lotNo}</span>
                                                        <span className="px-2 py-0.5 rounded" style={{
                                                            background: lot.sctRate === 65 ? 'rgba(139,26,46,0.2)' : 'rgba(212,168,83,0.2)',
                                                            color: lot.sctRate === 65 ? '#C04E65' : '#D4A853',
                                                        }}>TTĐB {lot.sctRate}%</span>
                                                    </div>
                                                    <div className="mt-1" style={{ color: '#475569' }}>
                                                        {lot.skuCode} — {lot.productName} | ABV: {lot.abvPercent}% | SL: {lot.qty}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Documents & Signature (Shared for all declaration types) */}
                            {detailData && (
                                <div className="space-y-6 pt-6 border-t border-slate-200">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Tài Liệu Tờ Khai</p>
                                            <label className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer font-bold"
                                                style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }}>
                                                {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                Upload PDF
                                                <input type="file" className="hidden" accept=".pdf,.png,.jpg" onChange={e => handleUpload(detailRow.id, e)} disabled={uploadingDoc} />
                                            </label>
                                        </div>
                                        {detailRow.documents && detailRow.documents.length > 0 ? (
                                            <div className="space-y-2">
                                                {detailRow.documents.map((d: any) => (
                                                    <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer"
                                                        className="flex items-center gap-2 p-2 rounded bg-white text-xs hover:bg-[#E2E8F0]" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                                        <FileText size={14} style={{ color: '#475569' }} />
                                                        <span className="truncate flex-1">{d.name}</span>
                                                        <span style={{ color: '#64748B', fontSize: 10 }}>{formatDate(d.uploadedAt)}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs italic" style={{ color: '#64748B' }}>Chưa upload tờ khai.</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#475569' }}>Ký Điện Tử Phê Duyệt</p>
                                        {detailRow.signatureUrl ? (
                                            <div className="p-3 rounded bg-white" style={{ border: '1px solid rgba(91,168,138,0.3)' }}>
                                                <p className="text-xs text-[#5BA88A] mb-2 flex items-center gap-1"><CheckCircle2 size={12} /> Đã Ký Duyệt</p>
                                                <img src={detailRow.signatureUrl} alt="Signature" className="h-[80px] object-contain bg-white rounded" />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {detailRow.status === 'DRAFT' ? (
                                                    <>
                                                        <SignaturePad onEnd={setSignatureUrl} />
                                                        <div className="flex justify-end">
                                                            <button onClick={() => handleSign(detailRow.id)} disabled={!signatureUrl || savingSignature}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50"
                                                                style={{ background: '#0891B2', color: '#FFFFFF' }}>
                                                                {savingSignature ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                Lưu Chữ Ký & Duyệt
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="text-xs italic" style={{ color: '#64748B' }}>Không yêu cầu ký điện tử.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!detailData && (
                                <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>Đang tải dữ liệu...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create Drawer */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
                    <div className="w-[420px] h-full overflow-y-auto" style={{ background: '#F8FAFC' }}>
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                Tạo Tờ Khai Mới
                            </h3>
                            <button onClick={() => setCreateOpen(false)} style={{ color: '#64748B' }}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            {Object.entries(TYPE_MAP).map(([type, info]) => (
                                <button key={type}
                                    onClick={() => handleCreate(type, now.getFullYear(), now.getMonth() + 1)}
                                    className="w-full p-4 rounded text-left transition-all"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = info.color)}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#E2E8F0')}>
                                    <span className="text-lg mr-2">{info.icon}</span>
                                    <span className="text-sm font-bold" style={{ color: info.color }}>{info.label}</span>
                                    <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                                        Kỳ: T{now.getMonth() + 1}/{now.getFullYear()}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
