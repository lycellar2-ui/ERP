'use client'

import React, { useState, useCallback } from 'react'
import {
    FileText, Plus, X, Search, Send, CheckCircle2, XCircle, RotateCcw,
    Clock, AlertCircle, Loader2, MessageSquare, Paperclip, ChevronDown,
    Filter, Eye, ArrowRight, ClipboardCheck, Printer,
} from 'lucide-react'
import {
    createProposal, submitProposal, processProposalApproval, addProposalComment,
    getProposalDetail, updateProposalStatus,
} from './actions'
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './constants'
import { formatVND } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { getCustomersForSO, getProductsWithStock } from '../sales/actions'

function formatCompactVND(amount: number): string {
    if (amount >= 1_000_000_000) {
        const val = amount / 1_000_000_000
        return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} tỷ`
    }
    return formatVND(amount)
}

type Proposal = Awaited<ReturnType<typeof import('./actions').getProposals>>[number]
type ProposalDetail = NonNullable<Awaited<ReturnType<typeof import('./actions').getProposalDetail>>>

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2',
    fontSize: '14px', outline: 'none',
}

interface Props {
    initialProposals: Proposal[]
    stats: { total: number; pending: number; approved: number; rejected: number; draft: number }
    userId: string
    userName: string
    userRoles: string[]
}

export default function ProposalsClient({ initialProposals, stats, userId, userName, userRoles }: Props) {
    const [proposals, setProposals] = useState(initialProposals)
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DRAFT' | 'APPROVED' | 'REJECTED'>('ALL')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ProposalDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const isCEO = userRoles.includes('CEO')

    const filtered = proposals.filter(p => {
        if (filter === 'PENDING' && !['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)) return false
        if (filter === 'DRAFT' && p.status !== 'DRAFT') return false
        if (filter === 'APPROVED' && !['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(p.status)) return false
        if (filter === 'REJECTED' && p.status !== 'REJECTED') return false
        if (search) {
            const s = search.toLowerCase()
            return p.proposalNo.toLowerCase().includes(s) ||
                p.title.toLowerCase().includes(s) ||
                p.creatorName.toLowerCase().includes(s)
        }
        return true
    })

    const refreshList = useCallback(async () => {
        const { getProposals } = await import('./actions')
        const data = await getProposals()
        setProposals(data)
    }, [])

    const openDetail = useCallback(async (id: string) => {
        setDetailId(id)
        setLoading(true)
        const d = await getProposalDetail(id)
        setDetail(d)
        setLoading(false)
    }, [])

    const handleApproval = useCallback(async (proposalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => {
        setActionLoading(proposalId)
        const result = await processProposalApproval({
            proposalId,
            action,
            approverId: userId,
            comment,
        })
        if (result.success) {
            await refreshList()
            if (detailId === proposalId) await openDetail(proposalId)
        }
        setActionLoading(null)
    }, [userId, refreshList, detailId, openDetail])

    const handlePrint = useCallback(() => {
        if (!detail) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return alert('Hãy cấp quyền mở popup trên trình duyệt của bạn')

        const scopeText = 
            detail.scope === 'ENTIRE_PORTFOLIO' ? 'Chiết khấu toàn bộ danh mục sản phẩm' :
            detail.scope === 'SPECIFIC_PRODUCTS' ? 'Áp dụng cho một số sản phẩm cụ thể' :
            detail.scope === 'MIXED' ? 'Kết hợp chiết khấu danh mục và giá riêng cho một số sản phẩm' : 'N/A'

        const dateStr = `Hà Nội, ngày ${new Date(detail.createdAt).getDate()} tháng ${new Date(detail.createdAt).getMonth() + 1} năm ${new Date(detail.createdAt).getFullYear()}`

        let tableRows = ''
        if (detail.priceItems && detail.priceItems.length > 0) {
            tableRows = detail.priceItems.map((item: any, i: number) => {
                const originalPrice = item.product?.wholesalePrice || 0
                const diff = originalPrice > 0 
                    ? ((item.proposedPrice - originalPrice) / originalPrice) * 100 
                    : 0
                return `
                    <tr>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center;">${i + 1}</td>
                        <td style="border: 1px solid #000; padding: 8px; font-family: monospace;">${item.product?.skuCode || ''}</td>
                        <td style="border: 1px solid #000; padding: 8px;">${item.product?.productName || ''}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: right;">${formatVND(originalPrice)}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: right; font-weight: bold;">${formatVND(item.proposedPrice)}</td>
                        <td style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">
                            ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%
                        </td>
                    </tr>
                `
            }).join('')
        }

        const htmlContent = `
            <html>
            <head>
                <title>To_trinh_${detail.proposalNo || 'Co_che_gia'}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #000; margin: 40px; font-size: 14px; line-height: 1.6; }
                    .header-table { width: 100%; border: none; margin-bottom: 20px; }
                    .header-table td { border: none; padding: 0; vertical-align: top; }
                    .title { font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 20px; margin-bottom: 5px; }
                    .subtitle { text-align: center; font-size: 14px; margin-bottom: 30px; font-style: italic; }
                    .info-section { margin-bottom: 20px; }
                    .info-section p { margin: 4px 0; }
                    .content-section { margin-top: 25px; margin-bottom: 25px; }
                    .content-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 10px; }
                    .content-body { padding-left: 15px; white-space: pre-wrap; word-break: break-word; }
                    .price-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 13px; }
                    .signatures-table { width: 100%; margin-top: 50px; border-collapse: collapse; page-break-inside: avoid; }
                    .signatures-table td { text-align: center; width: 25%; vertical-align: top; border: none; padding: 5px; }
                    .sign-title { font-weight: bold; text-transform: uppercase; margin-bottom: 70px; font-size: 12px; }
                    @media print {
                        body { margin: 20px; }
                    }
                </style>
            </head>
            <body>
                <table class="header-table">
                    <tr>
                        <td style="text-align: center; font-weight: bold; width: 35%;">
                            <p style="margin: 0; font-size: 13px; text-transform: uppercase; tracking-wide;">LY'S CELLARS</p>
                            <p style="margin: 5px 0 0 0; font-size: 11px; font-family: monospace; font-weight: normal;">Số: ${detail.proposalNo}</p>
                        </td>
                        <td style="text-align: center; width: 65%;">
                            <p style="margin: 0; font-weight: bold; font-size: 13px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 11px;">Độc lập - Tự do - Hạnh phúc</p>
                            <div style="width: 120px; height: 1px; background: #000; margin: 5px auto 0 auto;"></div>
                        </td>
                    </tr>
                </table>

                <div style="text-align: right; font-size: 12px; font-style: italic; margin-bottom: 20px;">
                    ${dateStr}
                </div>

                <div class="title">TỜ TRÌNH CƠ CHẾ GIÁ</div>
                <div class="subtitle">(V/v: ${detail.title})</div>

                <div class="info-section">
                    <p><strong>Kính gửi:</strong></p>
                    <p style="padding-left: 20px;">- Trưởng bộ phận Bán hàng</p>
                    <p style="padding-left: 20px;">- Kế toán trưởng</p>
                    <p style="padding-left: 20px;">- Tổng Giám đốc (CEO)</p>
                </div>

                <div class="info-section" style="margin-top: 15px;">
                    <p><strong>Người trình:</strong> ${detail.creator?.name || ''} (${detail.creator?.email || ''})</p>
                    <p><strong>Bộ phận:</strong> ${detail.department?.name || 'Kinh doanh'}</p>
                </div>

                <div class="content-section">
                    <div class="content-title">I. Chi tiết đề xuất giá</div>
                    <div style="padding-left: 15px;">
                        <p style="margin: 4px 0;"><strong>Khách hàng áp dụng:</strong> ${detail.customer?.name || ''} (${detail.customer?.code || 'N/A'})</p>
                        <p style="margin: 4px 0;"><strong>Phạm vi áp dụng:</strong> ${scopeText}</p>
                        ${detail.discountPct !== null && detail.discountPct !== undefined ? `<p style="margin: 4px 0;"><strong>Mức chiết khấu toàn danh mục:</strong> <span style="font-weight: bold; font-size: 16px;">${detail.discountPct}%</span></p>` : ''}
                    </div>

                    ${tableRows ? `
                        <div style="margin-top: 15px; padding-left: 15px;">
                            <p style="font-weight: bold; margin-bottom: 10px;">Danh sách sản phẩm áp dụng giá riêng:</p>
                            <table class="price-table">
                                <thead>
                                    <tr style="background-color: #f2f2f2;">
                                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 40px;">STT</th>
                                        <th style="border: 1px solid #000; padding: 8px; text-align: left;">Mã sản phẩm</th>
                                        <th style="border: 1px solid #000; padding: 8px; text-align: left;">Tên sản phẩm</th>
                                        <th style="border: 1px solid #000; padding: 8px; text-align: right;">Giá gốc (Wholesale)</th>
                                        <th style="border: 1px solid #000; padding: 8px; text-align: right;">Giá đề xuất đặc biệt</th>
                                        <th style="border: 1px solid #000; padding: 8px; text-align: center; font-weight: bold;">Chênh lệch (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>

                <div class="content-section">
                    <div class="content-title">II. Nội dung tờ trình</div>
                    <div class="content-body">${detail.content}</div>
                </div>

                ${detail.justification ? `
                    <div class="content-section">
                        <div class="content-title">III. Lý do & căn cứ đề xuất</div>
                        <div class="content-body">${detail.justification}</div>
                    </div>
                ` : ''}

                ${detail.expectedOutcome ? `
                    <div class="content-section">
                        <div class="content-title">IV. Kết quả kỳ vọng</div>
                        <div class="content-body">${detail.expectedOutcome}</div>
                    </div>
                ` : ''}

                <table class="signatures-table">
                    <tr>
                        <td>
                            <div class="sign-title">Người trình duyệt</div>
                            <div style="font-size: 11px; color: #555; font-style: italic; margin-bottom: 50px;">(Ký, ghi rõ họ tên)</div>
                            <div style="font-weight: bold; margin-top: 10px;">${detail.creator?.name || ''}</div>
                        </td>
                        <td>
                            <div class="sign-title">Trưởng bộ phận</div>
                            <div style="font-size: 11px; color: #555; font-style: italic; margin-bottom: 50px;">(Ý kiến & Ký tên)</div>
                            <div style="color: #777; margin-top: 10px;">...........................</div>
                        </td>
                        <td>
                            <div class="sign-title">Kế toán trưởng</div>
                            <div style="font-size: 11px; color: #555; font-style: italic; margin-bottom: 50px;">(Ý kiến & Ký tên)</div>
                            <div style="color: #777; margin-top: 10px;">...........................</div>
                        </td>
                        <td>
                            <div class="sign-title">Tổng giám đốc</div>
                            <div style="font-size: 11px; color: #555; font-style: italic; margin-bottom: 50px;">(Phê duyệt & Ký tên)</div>
                            <div style="color: #777; margin-top: 10px;">...........................</div>
                        </td>
                    </tr>
                </table>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent)
        printWindow.document.close()
    }, [detail])

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#E8F1F2' }}>
                        Tờ Trình & Đề Xuất
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý tờ trình phê duyệt — Proposals & Submissions
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-md transition-all"
                    style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                >
                    <Plus size={16} /> Tạo Tờ Trình
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { label: 'Tổng', value: stats.total, accent: '#8AAEBB' },
                    { label: 'Chờ Duyệt', value: stats.pending, accent: '#D4A853' },
                    { label: 'Bản Nháp', value: stats.draft, accent: '#4A6A7A' },
                    { label: 'Đã Duyệt', value: stats.approved, accent: '#5BA88A' },
                    { label: 'Từ Chối', value: stats.rejected, accent: '#8B1A2E' },
                ].map(s => (
                    <div key={s.label} className="rounded-md p-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.accent}` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#E8F1F2' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter + Search Bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    {(['ALL', 'PENDING', 'DRAFT', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="px-4 py-2 text-xs font-semibold transition-all"
                            style={{
                                background: filter === f ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                color: filter === f ? '#87CBB9' : '#4A6A7A',
                                borderRight: '1px solid #2A4355',
                            }}
                        >
                            {f === 'ALL' ? 'Tất cả' : f === 'PENDING' ? 'Chờ duyệt' : f === 'DRAFT' ? 'Nháp' : f === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'}
                        </button>
                    ))}
                </div>
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm theo mã, tiêu đề, người trình..."
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Proposals Table */}
            <div className="rounded-md overflow-hidden" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="overflow-x-auto">
                    <table style={{ width: '100%', minWidth: '1440px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: '115px' }} />
                            <col />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '125px' }} />
                            <col style={{ width: '95px' }} />
                            <col style={{ width: '260px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #2A4355' }}>
                                {[
                                    { label: 'Mã', align: 'left' as const },
                                    { label: 'Tiêu đề', align: 'left' as const },
                                    { label: 'Loại', align: 'left' as const },
                                    { label: 'Ưu tiên', align: 'left' as const },
                                    { label: 'Giá trị', align: 'right' as const },
                                    { label: 'Người trình', align: 'left' as const },
                                    { label: 'Trạng thái', align: 'left' as const },
                                    { label: 'Ngày trình', align: 'left' as const },
                                    { label: 'Thao tác', align: 'right' as const },
                                ].map(col => (
                                    <th key={col.label}
                                        className="px-3 py-3 text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: '#4A6A7A', textAlign: col.align, whiteSpace: 'nowrap' }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="flex flex-col items-center py-12 gap-2">
                                            <FileText size={32} style={{ color: '#2A4355' }} />
                                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tờ trình nào</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(p => {
                                    const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.DRAFT
                                    const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                                    const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                                    const isCEOLevel = p.currentLevel === 3

                                    return (
                                        <tr key={p.id}
                                            className="transition-all"
                                            style={{
                                                borderBottom: '1px solid #2A4355',
                                                background: isPending && isCEOLevel ? 'rgba(212,168,83,0.03)' : 'transparent',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = isPending && isCEOLevel ? 'rgba(212,168,83,0.03)' : 'transparent'}
                                        >
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9', whiteSpace: 'nowrap' }}>
                                                    {p.proposalNo}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle', maxWidth: '280px' }}>
                                                <p className="text-sm font-medium truncate" style={{ color: '#E8F1F2' }}>{p.title}</p>
                                                {p.attachmentCount > 0 && (
                                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                        <Paperclip size={10} className="inline mr-1" />{p.attachmentCount} file
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs px-2 py-0.5 rounded-full inline-block truncate"
                                                    style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB', maxWidth: '100%', display: 'block' }}>
                                                    {CATEGORY_LABELS[p.category] ?? p.category}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs px-2 py-0.5 rounded-full font-bold inline-block whitespace-nowrap"
                                                    style={{ background: prioCfg.bg, color: prioCfg.color }}>
                                                    {prioCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right" style={{ verticalAlign: 'middle', overflow: 'hidden' }}>
                                                <span className="text-sm font-bold block truncate" style={{ color: '#E8F1F2' }}>
                                                    {p.estimatedAmount ? formatCompactVND(p.estimatedAmount) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle', overflow: 'hidden' }}>
                                                <span className="text-xs truncate block" style={{ color: '#8AAEBB' }}>{p.creatorName}</span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs px-2 py-0.5 rounded-full font-medium inline-block whitespace-nowrap"
                                                    style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs whitespace-nowrap" style={{ color: '#4A6A7A' }}>
                                                    {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('vi-VN') : '—'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3" style={{ verticalAlign: 'middle' }}>
                                                <div className="flex justify-end gap-1.5 flex-nowrap">
                                                    <button onClick={() => openDetail(p.id)}
                                                        className="px-2 py-1.5 text-xs font-medium rounded transition-all whitespace-nowrap"
                                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                                        <Eye size={12} className="inline mr-1" />Chi tiết
                                                    </button>
                                                    {isPending && isCEOLevel && isCEO && (
                                                        <>
                                                            <button
                                                                onClick={() => handleApproval(p.id, 'APPROVE')}
                                                                disabled={actionLoading === p.id}
                                                                className="px-2 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap"
                                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                                Duyệt
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const reason = prompt('Lý do từ chối:')
                                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                                }}
                                                                className="px-2 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap"
                                                                style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                                                <XCircle size={12} className="inline mr-1" />Từ chối
                                                            </button>
                                                        </>
                                                    )}
                                                    {p.status === 'DRAFT' && p.creatorName && (
                                                        <button
                                                            onClick={async () => {
                                                                setActionLoading(p.id)
                                                                await submitProposal(p.id, userId)
                                                                await refreshList()
                                                                setActionLoading(null)
                                                            }}
                                                            disabled={actionLoading === p.id}
                                                            className="px-2 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap"
                                                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}>
                                                            {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} className="inline mr-1" />}
                                                            Trình
                                                        </button>
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
            </div>

            {/* Create Proposal Drawer */}
            {showCreate && <CreateDrawer onClose={() => setShowCreate(false)} userId={userId} onCreated={async () => { await refreshList(); setShowCreate(false) }} />}

            {/* Detail Drawer */}
            {detailId && (
                <DetailDrawer
                    detail={detail}
                    loading={loading}
                    onClose={() => { setDetailId(null); setDetail(null) }}
                    userId={userId}
                    isCEO={isCEO}
                    onApproval={async (action, comment) => { await handleApproval(detailId, action, comment); }}
                    onRefresh={async () => { await refreshList(); await openDetail(detailId) }}
                    onPrint={handlePrint}
                />
            )}
        </div>
    )
}

// ─── Create Drawer ───────────────────────────────
function CreateDrawer({ onClose, userId, onCreated }: {
    onClose: () => void
    userId: string
    onCreated: () => void
}) {
    const { data: refData } = useQuery({
        queryKey: ['proposal_reference_data'],
        queryFn: async () => {
            const [c, p] = await Promise.all([getCustomersForSO(), getProductsWithStock()])
            return { customers: c, products: p }
        },
        staleTime: 5 * 60_000,
    })

    const customers = refData?.customers ?? []
    const products = refData?.products ?? []

    const [form, setForm] = useState({
        category: 'BUDGET_REQUEST',
        priority: 'NORMAL',
        title: '',
        content: '',
        justification: '',
        expectedOutcome: '',
        estimatedAmount: '',
        deadline: '',
        customerId: '',
        scope: 'ENTIRE_PORTFOLIO',
        discountPct: '',
    })
    const [priceLines, setPriceLines] = useState<{ productId: string; proposedPrice: number }[]>([])
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!form.title || !form.content) return alert('Vui lòng nhập tiêu đề và nội dung')
        if (form.category === 'PRICE_ADJUSTMENT') {
            if (!form.customerId) return alert('Vui lòng chọn khách hàng áp dụng')
            if ((form.scope === 'ENTIRE_PORTFOLIO' || form.scope === 'MIXED') && !form.discountPct) {
                return alert('Vui lòng nhập % chiết khấu toàn danh mục')
            }
            if ((form.scope === 'SPECIFIC_PRODUCTS' || form.scope === 'MIXED') && priceLines.length === 0) {
                return alert('Vui lòng thêm sản phẩm đề xuất giá')
            }
            if (priceLines.some(line => !line.productId)) {
                return alert('Vui lòng chọn đầy đủ sản phẩm cho các dòng đề xuất')
            }
        }

        setSaving(true)
        const result = await createProposal({
            ...form,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            discountPct: form.discountPct ? parseFloat(form.discountPct) : undefined,
            priceItems: form.category === 'PRICE_ADJUSTMENT' && (form.scope === 'SPECIFIC_PRODUCTS' || form.scope === 'MIXED') 
                ? priceLines 
                : undefined,
            createdBy: userId,
        })
        if (result.success) onCreated()
        else alert(result.error)
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-xl h-full overflow-y-auto" style={{ background: '#142433', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                        <FileText size={18} className="inline mr-2" style={{ color: '#87CBB9' }} />
                        Tạo Tờ Trình Mới
                    </h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Category */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Loại tờ trình *</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>

                    {/* Price adjustment custom fields */}
                    {form.category === 'PRICE_ADJUSTMENT' && (
                        <div className="space-y-4 p-4 rounded-md border border-[#2A4355] bg-[#1B2E3D]">
                            <div>
                                <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#8AAEBB' }}>Khách hàng áp dụng *</label>
                                <select 
                                    value={form.customerId} 
                                    onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} 
                                    style={{ ...inputStyle, background: '#142433' }}
                                >
                                    <option value="">Chọn khách hàng...</option>
                                    {customers.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#8AAEBB' }}>Phạm vi áp dụng *</label>
                                <select 
                                    value={form.scope} 
                                    onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} 
                                    style={{ ...inputStyle, background: '#142433' }}
                                >
                                    <option value="ENTIRE_PORTFOLIO">Toàn bộ danh mục (% chiết khấu)</option>
                                    <option value="SPECIFIC_PRODUCTS">Một số sản phẩm cụ thể (gõ giá riêng)</option>
                                    <option value="MIXED">Kết hợp cả hai (chiết khấu danh mục + giá riêng một số chai)</option>
                                </select>
                            </div>

                            {(form.scope === 'ENTIRE_PORTFOLIO' || form.scope === 'MIXED') && (
                                <div>
                                    <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#8AAEBB' }}>% Chiết khấu toàn danh mục *</label>
                                    <input 
                                        type="number" 
                                        placeholder="VD: 15" 
                                        value={form.discountPct} 
                                        onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))} 
                                        style={{ ...inputStyle, background: '#142433' }} 
                                    />
                                </div>
                            )}

                            {(form.scope === 'SPECIFIC_PRODUCTS' || form.scope === 'MIXED') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase block" style={{ color: '#8AAEBB' }}>Đề xuất giá theo chai *</label>
                                        <button 
                                            type="button" 
                                            onClick={() => setPriceLines([...priceLines, { productId: '', proposedPrice: 0 }])}
                                            className="text-xs flex items-center gap-1 text-[#87CBB9] hover:underline"
                                        >
                                            <Plus size={12} /> Thêm dòng
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                        {priceLines.map((line, idx) => {
                                            const selectedProd = products.find(p => p.id === line.productId)
                                            const wholesale = selectedProd ? selectedProd.wholesalePrice : 0
                                            
                                            return (
                                                <div key={idx} className="flex gap-2 items-end p-2 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                    <div className="flex-1 min-w-0">
                                                        <label className="text-[9px]" style={{ color: '#4A6A7A' }}>Sản phẩm</label>
                                                        <select 
                                                            value={line.productId} 
                                                            onChange={e => {
                                                                const copy = [...priceLines]
                                                                copy[idx].productId = e.target.value
                                                                const found = products.find(p => p.id === e.target.value)
                                                                copy[idx].proposedPrice = found ? found.wholesalePrice : 0
                                                                setPriceLines(copy)
                                                            }}
                                                            style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#1B2E3D' }}
                                                        >
                                                            <option value="">Chọn sản phẩm...</option>
                                                            {products.map(p => (
                                                                <option key={p.id} value={p.id}>{p.productName} ({p.skuCode})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    <div className="w-24">
                                                        <label className="text-[9px]" style={{ color: '#4A6A7A' }}>Giá đề xuất</label>
                                                        <input 
                                                            type="number"
                                                            value={line.proposedPrice || ''}
                                                            onChange={e => {
                                                                const copy = [...priceLines]
                                                                copy[idx].proposedPrice = parseFloat(e.target.value) || 0
                                                                setPriceLines(copy)
                                                            }}
                                                            style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#1B2E3D' }}
                                                        />
                                                    </div>
                                                    
                                                    <div className="text-right flex flex-col justify-end pb-1 pr-1 min-w-[70px]">
                                                        <span className="text-[9px] block text-gray-500">Gốc</span>
                                                        <span className="text-[11px] block font-mono font-semibold" style={{ color: '#E8F1F2' }}>{formatVND(wholesale)}</span>
                                                    </div>

                                                    <button 
                                                        type="button" 
                                                        onClick={() => setPriceLines(priceLines.filter((_, i) => i !== idx))}
                                                        className="p-1 rounded text-red-400 hover:bg-red-500/10 mb-0.5"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                        {priceLines.length === 0 && (
                                            <p className="text-center text-xs py-3 text-gray-500">Bấm nút "Thêm dòng" để chọn chai đề xuất.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Priority */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Mức ưu tiên</label>
                        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Tiêu đề *</label>
                        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="VD: Đề xuất nhập NCC mới — Château Latour"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Nội dung chi tiết *</label>
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            rows={5} placeholder="Mô tả chi tiết đề xuất..."
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Justification */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Lý do & phân tích</label>
                        <textarea value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                            rows={3} placeholder="Căn cứ và phân tích chi phí/lợi ích..."
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Expected Outcome */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Kết quả kỳ vọng</label>
                        <input value={form.expectedOutcome} onChange={e => setForm(f => ({ ...f, expectedOutcome: e.target.value }))}
                            placeholder="VD: Mở rộng danh mục 15 SKU mới, tăng doanh thu 20%"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#87CBB9'}
                            onBlur={e => e.target.style.borderColor = '#2A4355'} />
                    </div>

                    {/* Amount + Deadline row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Giá trị ước tính (VND)</label>
                            <input type="number" value={form.estimatedAmount}
                                onChange={e => setForm(f => ({ ...f, estimatedAmount: e.target.value }))}
                                placeholder="0" style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                onBlur={e => e.target.style.borderColor = '#2A4355'} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#4A6A7A' }}>Hạn xử lý</label>
                            <input type="date" value={form.deadline}
                                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                onBlur={e => e.target.style.borderColor = '#2A4355'} />
                        </div>
                    </div>

                    {/* Submit buttons */}
                    <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #2A4355' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                            Lưu Bản Nháp
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-3 text-sm font-medium rounded-md"
                            style={{ background: '#1B2E3D', color: '#4A6A7A', border: '1px solid #2A4355' }}
                        >
                            Huỷ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Detail Drawer ───────────────────────────────
function DetailDrawer({ detail, loading, onClose, userId, isCEO, onApproval, onRefresh, onPrint }: {
    detail: ProposalDetail | null
    loading: boolean
    onClose: () => void
    userId: string
    isCEO: boolean
    onApproval: (action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => void
    onRefresh: () => void
    onPrint: () => void
}) {
    const [comment, setComment] = useState('')
    const [sendingComment, setSendingComment] = useState(false)

    const handleComment = async () => {
        if (!comment.trim() || !detail) return
        setSendingComment(true)
        await addProposalComment({
            proposalId: detail.id,
            authorId: userId,
            content: comment,
        })
        setComment('')
        setSendingComment(false)
        onRefresh()
    }

    const isPending = detail && ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(detail.status)
    const isCEOLevel = detail?.currentLevel === 3

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-2xl h-full overflow-y-auto" style={{ background: '#142433', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                        <ClipboardCheck size={18} className="inline mr-2" style={{ color: '#87CBB9' }} />
                        Chi Tiết Tờ Trình
                    </h3>
                    <div className="flex items-center gap-3">
                        {detail && detail.category === 'PRICE_ADJUSTMENT' && (
                            <button 
                                onClick={onPrint}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded flex items-center gap-1 transition-all"
                                style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}
                            >
                                <Printer size={13} /> In Tờ Trình
                            </button>
                        )}
                        <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                    </div>
                </div>

                {loading || !detail ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : (
                    <div className="p-5 space-y-5">
                        {/* Title + Meta */}
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold" style={{ color: '#87CBB9' }}>
                                    {detail.proposalNo}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{ ...PRIORITY_LABELS[detail.priority] ? { background: PRIORITY_LABELS[detail.priority].bg, color: PRIORITY_LABELS[detail.priority].color } : {} }}>
                                    {PRIORITY_LABELS[detail.priority]?.label}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: STATUS_LABELS[detail.status]?.bg, color: STATUS_LABELS[detail.status]?.color }}>
                                    {STATUS_LABELS[detail.status]?.label}
                                </span>
                            </div>
                            <h4 className="text-xl font-bold mb-1" style={{ color: '#E8F1F2' }}>{detail.title}</h4>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {detail.creator.name} · {CATEGORY_LABELS[detail.category]} ·
                                {detail.estimatedAmount ? ` ${formatVND(detail.estimatedAmount)}` : ' Không có giá trị'} ·
                                {detail.submittedAt ? ` Trình ${new Date(detail.submittedAt).toLocaleDateString('vi-VN')}` : ' Chưa trình'}
                            </p>
                        </div>

                        {/* Approval Progress */}
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>Tiến Trình Phê Duyệt</p>
                            <div className="flex items-center gap-2">
                                {detail.requiredLevels.map((level, i) => {
                                    const log = detail.approvalLogs.find(l => l.level === level)
                                    const isCurrent = detail.currentLevel === level && isPending
                                    const isDone = log?.action === 'APPROVE'
                                    const isRejected = log?.action === 'REJECT'
                                    const levelLabel = level === 1 ? 'TP Bộ phận' : level === 2 ? 'KT Trưởng' : 'CEO'

                                    return (
                                        <React.Fragment key={level}>
                                            {i > 0 && <div className="flex-1 h-0.5 rounded" style={{ background: isDone ? '#5BA88A' : '#2A4355' }} />}
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                                    style={{
                                                        background: isDone ? 'rgba(91,168,138,0.2)' : isRejected ? 'rgba(139,26,46,0.2)' : isCurrent ? 'rgba(212,168,83,0.2)' : '#1B2E3D',
                                                        border: `2px solid ${isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#2A4355'}`,
                                                        color: isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#4A6A7A',
                                                    }}>
                                                    {isDone ? '✓' : isRejected ? '✗' : level}
                                                </div>
                                                <span className="text-xs font-medium" style={{ color: isCurrent ? '#D4A853' : '#4A6A7A' }}>
                                                    {levelLabel}
                                                </span>
                                                {log && (
                                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                        {log.approver.name}
                                                    </span>
                                                )}
                                            </div>
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Special pricing details */}
                        {detail.category === 'PRICE_ADJUSTMENT' && (
                            <div className="p-4 rounded-md space-y-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#87CBB9' }}>Thông Tin Áp Dụng Cơ Chế Giá</p>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-2.5 rounded" style={{ background: '#142433' }}>
                                        <p style={{ color: '#4A6A7A' }}>Khách hàng áp dụng</p>
                                        <p className="font-bold mt-0.5" style={{ color: '#E8F1F2' }}>{detail.customer?.name} ({detail.customer?.code || 'N/A'})</p>
                                    </div>
                                    <div className="p-2.5 rounded" style={{ background: '#142433' }}>
                                        <p style={{ color: '#4A6A7A' }}>Phạm vi áp dụng</p>
                                        <p className="font-bold mt-0.5" style={{ color: '#E8F1F2' }}>
                                            {detail.scope === 'ENTIRE_PORTFOLIO' ? 'Toàn danh mục' : 
                                             detail.scope === 'SPECIFIC_PRODUCTS' ? 'Một số sản phẩm' : 
                                             detail.scope === 'MIXED' ? 'Kết hợp' : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                
                                {detail.discountPct !== null && detail.discountPct !== undefined && (
                                    <div className="p-2.5 rounded" style={{ background: '#142433' }}>
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Chiết khấu toàn danh mục</p>
                                        <p className="text-lg font-bold" style={{ color: '#D4A853' }}>{detail.discountPct}%</p>
                                    </div>
                                )}

                                {detail.priceItems && detail.priceItems.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Danh sách sản phẩm đề xuất giá:</p>
                                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                            {detail.priceItems.map((item: any) => {
                                                const originalPrice = item.product?.wholesalePrice || 0
                                                const diff = originalPrice > 0 
                                                    ? ((item.proposedPrice - originalPrice) / originalPrice) * 100 
                                                    : 0
                                                return (
                                                    <div key={item.id} className="flex justify-between items-center p-2 rounded text-xs" style={{ background: '#142433' }}>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium truncate" style={{ color: '#E8F1F2' }}>{item.product?.productName}</p>
                                                            <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{item.product?.skuCode}</p>
                                                        </div>
                                                        <div className="text-right pl-3 flex items-center gap-2">
                                                            <div>
                                                                <p className="font-bold" style={{ color: '#87CBB9' }}>{formatVND(item.proposedPrice)}</p>
                                                                <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>Gốc: {formatVND(originalPrice)}</p>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${diff < 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Content sections */}
                        <div className="space-y-3">
                            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#87CBB9' }}>Nội dung</p>
                                <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F1F2', lineHeight: 1.6 }}>{detail.content}</p>
                            </div>
                            {detail.justification && (
                                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#D4A853' }}>Lý do & Phân tích</p>
                                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#E8F1F2', lineHeight: 1.6 }}>{detail.justification}</p>
                                </div>
                            )}
                            {detail.expectedOutcome && (
                                <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#5BA88A' }}>Kết quả kỳ vọng</p>
                                    <p className="text-sm" style={{ color: '#E8F1F2' }}>{detail.expectedOutcome}</p>
                                </div>
                            )}
                        </div>

                        {/* Approval Logs */}
                        {detail.approvalLogs.length > 0 && (
                            <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>Lịch Sử Phê Duyệt</p>
                                <div className="space-y-2">
                                    {detail.approvalLogs.map(log => (
                                        <div key={log.id} className="flex items-start gap-3 p-2 rounded" style={{ background: '#142433' }}>
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{
                                                    background: log.action === 'APPROVE' ? 'rgba(91,168,138,0.2)' : 'rgba(139,26,46,0.2)',
                                                    color: log.action === 'APPROVE' ? '#5BA88A' : '#8B1A2E',
                                                }}>
                                                {log.action === 'APPROVE' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs">
                                                    <span className="font-semibold" style={{ color: '#E8F1F2' }}>{log.approver.name}</span>
                                                    <span style={{ color: log.action === 'APPROVE' ? '#5BA88A' : '#8B1A2E' }}> đã {log.action === 'APPROVE' ? 'duyệt' : 'từ chối'}</span>
                                                    <span style={{ color: '#4A6A7A' }}> · Cấp {log.level === 1 ? 'TP' : log.level === 2 ? 'KT' : 'CEO'}</span>
                                                </p>
                                                {log.comment && <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>"{log.comment}"</p>}
                                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>{new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comments */}
                        <div className="p-4 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#4A6A7A' }}>
                                <MessageSquare size={12} className="inline mr-1" />
                                Thảo Luận ({detail.comments.length})
                            </p>
                            <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                                {detail.comments.map(c => (
                                    <div key={c.id} className="p-2.5 rounded" style={{ background: '#142433' }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold" style={{ color: '#87CBB9' }}>{c.author.name}</span>
                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>{new Date(c.createdAt).toLocaleString('vi-VN')}</span>
                                        </div>
                                        <p className="text-sm" style={{ color: '#E8F1F2' }}>{c.content}</p>
                                    </div>
                                ))}
                                {detail.comments.length === 0 && (
                                    <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Chưa có thảo luận</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder="Nhập bình luận..."
                                    className="flex-1 px-3 py-2 text-sm rounded-md"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', outline: 'none' }}
                                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                                    onFocus={e => e.target.style.borderColor = '#87CBB9'}
                                    onBlur={e => e.target.style.borderColor = '#2A4355'} />
                                <button onClick={handleComment} disabled={sendingComment}
                                    className="px-3 py-2 rounded-md transition-all"
                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                    {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* CEO Action Bar */}
                        {isPending && isCEOLevel && isCEO && (
                            <div className="flex gap-3 p-4 rounded-md" style={{ background: 'rgba(212,168,83,0.05)', border: '2px solid rgba(212,168,83,0.2)' }}>
                                <button
                                    onClick={() => onApproval('APPROVE')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-md transition-all"
                                    style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)' }}>
                                    <CheckCircle2 size={16} /> Duyệt Tờ Trình
                                </button>
                                <button
                                    onClick={() => {
                                        const reason = prompt('Ghi chú khi trả lại:')
                                        if (reason) onApproval('RETURN', reason)
                                    }}
                                    className="px-5 py-3 text-sm font-medium rounded-md transition-all"
                                    style={{ background: 'rgba(196,90,42,0.1)', color: '#C45A2A', border: '1px solid rgba(196,90,42,0.2)' }}>
                                    <RotateCcw size={14} className="inline mr-1" /> Trả Lại
                                </button>
                                <button
                                    onClick={() => {
                                        const reason = prompt('Lý do từ chối:')
                                        if (reason) onApproval('REJECT', reason)
                                    }}
                                    className="px-5 py-3 text-sm font-medium rounded-md transition-all"
                                    style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                    <XCircle size={14} className="inline mr-1" /> Từ Chối
                                </button>
                            </div>
                        )}

                        {/* Post-approval actions */}
                        {detail.status === 'APPROVED' && isCEO && (
                            <div className="flex gap-3">
                                <button onClick={async () => { await updateProposalStatus(detail.id, 'IN_PROGRESS', userId); onRefresh() }}
                                    className="flex-1 py-2.5 text-sm font-semibold rounded-md"
                                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                    <ArrowRight size={14} className="inline mr-1" /> Chuyển "Đang thực hiện"
                                </button>
                            </div>
                        )}
                        {detail.status === 'IN_PROGRESS' && isCEO && (
                            <button onClick={async () => { await updateProposalStatus(detail.id, 'CLOSED', userId); onRefresh() }}
                                className="w-full py-2.5 text-sm font-semibold rounded-md"
                                style={{ background: 'rgba(74,106,122,0.15)', color: '#4A6A7A', border: '1px solid rgba(74,106,122,0.3)' }}>
                                <CheckCircle2 size={14} className="inline mr-1" /> Đánh dấu Hoàn tất
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
