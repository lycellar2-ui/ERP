'use client'

import React, { useState, useCallback } from 'react'
import {
    FileText, Plus, X, Search, Send, CheckCircle2, XCircle, RotateCcw,
    Clock, AlertCircle, Loader2, MessageSquare, Paperclip, ChevronDown,
    Filter, Eye, ArrowRight, ClipboardCheck, Printer, Trash2,
} from 'lucide-react'
import {
    createProposal, submitProposal, processProposalApproval, addProposalComment,
    getProposalDetail, updateProposalStatus,
} from './actions'
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './constants'
import { formatVND } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getCustomersForSO, getProductsWithStock } from '../sales/actions'
import { toast } from 'sonner'

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

function canApproveAtLevel(level: number, roles: string[] = []): boolean {
    if (!roles || roles.length === 0) return false
    const upperRoles = roles.map(r => r.toUpperCase())

    if (upperRoles.includes('ADMIN') || upperRoles.includes('CEO') || upperRoles.includes('BOD') || upperRoles.includes('DIRECTOR')) {
        return true
    }

    if (level === 1) {
        return upperRoles.some(r => ['SALES_MGR', 'SALES_ADMIN', 'MANAGER', 'TP', 'TRUONG_PHONG'].includes(r))
    }
    if (level === 2) {
        return upperRoles.some(r => ['KE_TOAN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'ACCOUNTING', 'KT', 'KE_TOAN_TRUONG'].includes(r))
    }
    if (level === 3) {
        return upperRoles.some(r => ['CEO', 'BOD', 'DIRECTOR', 'GIAM_DOC'].includes(r))
    }
    return false
}

export default function ProposalsClient({ initialProposals, stats, userId, userName, userRoles }: Props) {
    const [proposals, setProposals] = useState(initialProposals)
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DRAFT' | 'APPROVED' | 'REJECTED'>('ALL')
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ProposalDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const searchParams = useSearchParams()
    const isCEO = userRoles.includes('CEO')

    React.useEffect(() => {
        if (searchParams?.get('action') === 'create') {
            setShowCreate(true)
        }
    }, [searchParams])

    const formatDateTime = useCallback((d: Date | string | null | undefined) => {
        if (!d) return '—'
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return '—'
        const hours = String(dt.getHours()).padStart(2, '0')
        const minutes = String(dt.getMinutes()).padStart(2, '0')
        const day = String(dt.getDate()).padStart(2, '0')
        const month = String(dt.getMonth() + 1).padStart(2, '0')
        const year = dt.getFullYear()
        return `${hours}:${minutes} · ${day}/${month}/${year}`
    }, [])

    const getCategoryBadge = useCallback((cat: string) => {
        switch (cat) {
            case 'TASTING':
                return { label: '🍷 Tasting (Thử Rượu)', bg: 'rgba(212,168,83,0.15)', color: '#D4A853', border: 'rgba(212,168,83,0.3)' }
            case 'SPECIAL_EVENT':
                return { label: '🎪 Sự Kiện / Event', bg: 'rgba(180,140,210,0.15)', color: '#B48CD2', border: 'rgba(180,140,210,0.3)' }
            case 'PRICE_ADJUSTMENT':
                return { label: '🏷️ Cơ Chế Giá & Giá Đặc Biệt', bg: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: 'rgba(74,143,171,0.3)' }
            case 'BUDGET_REQUEST':
                return { label: '💰 Xin Ngân Sách', bg: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: 'rgba(135,203,185,0.3)' }
            case 'CAPITAL_EXPENDITURE':
                return { label: '🏢 Mua Sắm TSCĐ', bg: 'rgba(180,140,210,0.15)', color: '#B48CD2', border: 'rgba(180,140,210,0.3)' }
            case 'NEW_SUPPLIER':
                return { label: '🤝 NCC Mới', bg: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: 'rgba(91,168,138,0.3)' }
            case 'NEW_PRODUCT':
                return { label: '📦 Sản Phẩm Mới', bg: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: 'rgba(91,168,138,0.3)' }
            case 'POLICY_CHANGE':
                return { label: '📋 Đổi Quy Trình', bg: 'rgba(224,140,80,0.15)', color: '#E08C50', border: 'rgba(224,140,80,0.3)' }
            case 'PAYMENT_SCHEDULE':
                return { label: '📅 Lịch Thanh Toán', bg: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: 'rgba(74,143,171,0.3)' }
            case 'PROMOTION_CAMPAIGN':
                return { label: '🎁 Khuyến Mãi', bg: 'rgba(212,168,83,0.15)', color: '#D4A853', border: 'rgba(212,168,83,0.3)' }
            default:
                return { label: CATEGORY_LABELS[cat] || cat, bg: 'rgba(74,106,122,0.15)', color: '#8AAEBB', border: 'rgba(74,106,122,0.3)' }
        }
    }, [])

    const filtered = proposals.filter(p => {
        if (filter === 'PENDING' && !['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)) return false
        if (filter === 'DRAFT' && p.status !== 'DRAFT') return false
        if (filter === 'APPROVED' && !['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(p.status)) return false
        if (filter === 'REJECTED' && p.status !== 'REJECTED') return false
        
        if (categoryFilter !== 'ALL') {
            if (categoryFilter === 'TASTING') {
                if (p.category !== 'TASTING' && p.category !== 'SPECIAL_EVENT') return false
            } else if (p.category !== categoryFilter) {
                return false
            }
        }

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

    const handleSubmitProposal = useCallback(async (proposalId: string) => {
        setActionLoading(proposalId)
        try {
            const res = await submitProposal(proposalId, userId)
            if (res.success) {
                toast.success('Đã trình tờ trình phê duyệt thành công!')
                await refreshList()
                if (detailId === proposalId) await openDetail(proposalId)
            } else {
                toast.error(res.error || 'Không thể trình tờ trình')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi hệ thống khi trình tờ trình')
        } finally {
            setActionLoading(null)
        }
    }, [userId, refreshList, detailId, openDetail])

    const handleApproval = useCallback(async (proposalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => {
        setActionLoading(proposalId)
        try {
            const result = await processProposalApproval({
                proposalId,
                action,
                approverId: userId,
                comment,
            })
            if (result.success) {
                toast.success(
                    action === 'APPROVE' ? 'Đã duyệt tờ trình thành công!' :
                    action === 'RETURN' ? 'Đã trả lại tờ trình' : 'Đã từ chối tờ trình'
                )
                await refreshList()
                if (detailId === proposalId) await openDetail(proposalId)
            } else {
                toast.error(result.error || 'Lỗi khi xử lý phê duyệt')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi hệ thống')
        } finally {
            setActionLoading(null)
        }
    }, [userId, refreshList, detailId, openDetail])

    const handlePrint = useCallback(() => {
        if (!detail) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return alert('Hãy cấp quyền mở popup trên trình duyệt của bạn')

        const isTasting = detail.category === 'TASTING' || detail.category === 'SPECIAL_EVENT'

        const scopeText = 
            detail.scope === 'ENTIRE_PORTFOLIO' ? 'Chiết khấu toàn bộ danh mục sản phẩm' :
            detail.scope === 'SPECIFIC_PRODUCTS' ? 'Áp dụng cho một số sản phẩm cụ thể' :
            detail.scope === 'MIXED' ? 'Kết hợp chiết khấu danh mục và giá riêng cho một số sản phẩm' : 'N/A'

        const formatPrintDateTime = (d: Date | string | null | undefined) => {
            if (!d) return ''
            const dt = new Date(d)
            const hours = String(dt.getHours()).padStart(2, '0')
            const minutes = String(dt.getMinutes()).padStart(2, '0')
            const day = String(dt.getDate()).padStart(2, '0')
            const month = String(dt.getMonth() + 1).padStart(2, '0')
            const year = dt.getFullYear()
            return `${hours}:${minutes} - ${day}/${month}/${year}`
        }

        const l1Log = detail.approvalLogs?.find((l: any) => l.level === 1 && (l.action === 'APPROVE' || l.action === 'CONFIRM'))
        const l2Log = detail.approvalLogs?.find((l: any) => l.level === 2 && (l.action === 'APPROVE' || l.action === 'CONFIRM'))
        const l3Log = detail.approvalLogs?.find((l: any) => l.level === 3 && (l.action === 'APPROVE' || l.action === 'CONFIRM'))

        const creatorSignedAt = formatPrintDateTime(detail.submittedAt || detail.createdAt)
        const l1SignedAt = l1Log ? formatPrintDateTime(l1Log.createdAt) : null
        const l2SignedAt = l2Log ? formatPrintDateTime(l2Log.createdAt) : null
        const l3SignedAt = l3Log ? formatPrintDateTime(l3Log.createdAt) : null

        const dateObj = new Date(detail.submittedAt || detail.createdAt || Date.now())
        const dateStr = `Hà Nội, ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`
        const exportDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

        let tableRows = ''
        let totalRefValue = 0

        const formatVNDPrint = (amount: number) => {
            return new Intl.NumberFormat('vi-VN').format(amount) + ' đ'
        }

        if (detail.priceItems && detail.priceItems.length > 0) {
            tableRows = detail.priceItems.map((item: any, i: number) => {
                const wholesale = item.product?.wholesalePrice || 0
                const qty = item.quantity ? Number(item.quantity) : 1
                const lineTotal = wholesale * qty
                totalRefValue += lineTotal

                if (isTasting) {
                    const customerAndDateTd = i === 0 ? `
                        <td rowspan="${detail.priceItems.length}" style="border: 1px solid #000; padding: 6px 8px; text-align: center; vertical-align: middle; background-color: #ffffff;">
                            <div style="font-weight: bold; font-size: 10pt; color: #000;">${detail.customer?.name || 'Khách hàng'}</div>
                            <div style="font-size: 9pt; color: #333; margin-top: 4px; white-space: nowrap;">Ngày xuất: ${exportDateStr}</div>
                        </td>
                    ` : ''

                    return `
                        <tr>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; white-space: nowrap;">${i + 1}</td>
                            ${customerAndDateTd}
                            <td style="border: 1px solid #000; padding: 5px 3px; font-family: monospace; font-weight: bold; text-align: center; white-space: nowrap;">${item.product?.skuCode || ''}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold; word-break: normal; overflow-wrap: break-word;">${item.product?.productName || ''}</td>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; white-space: nowrap;">Chai</td>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; font-weight: bold; white-space: nowrap;">${qty}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; text-align: right; white-space: nowrap;">${formatVNDPrint(wholesale)}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatVNDPrint(lineTotal)}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; font-size: 9.5pt; word-break: normal; overflow-wrap: break-word;">Xuất hàng dùng thử cho khách hàng</td>
                        </tr>
                    `
                }

                const diff = wholesale > 0 
                    ? ((item.proposedPrice - wholesale) / wholesale) * 100 
                    : 0
                return `
                    <tr>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; white-space: nowrap;">${i + 1}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; font-family: monospace; text-align: center; white-space: nowrap;">${item.product?.skuCode || ''}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; word-break: normal; overflow-wrap: break-word;">${item.product?.productName || ''}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; white-space: nowrap;">${qty}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; white-space: nowrap;">${formatVNDPrint(wholesale)}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatVNDPrint(item.proposedPrice)}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; white-space: nowrap;">
                            ${diff > 0 ? '+' : ''}${diff.toFixed(1)}%
                        </td>
                    </tr>
                `
            }).join('')
        }

        const htmlContent = isTasting ? `
            <html>
            <head>
                <title>To_Trinh_Hang_Mau_Tasting_${detail.proposalNo}</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm 10mm 12mm 10mm; }
                    body { font-family: Calibri, Arial, sans-serif; color: #000; margin: 0; padding: 0; font-size: 11pt; line-height: 1.35; }
                    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                    .header-table td { vertical-align: top; border: none; padding: 0; }
                    .doc-title { font-size: 17pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 15px; margin-bottom: 2px; }
                    .doc-subtitle { font-size: 11pt; font-weight: normal; text-align: center; margin-bottom: 18px; line-height: 1.3; }
                    .kinh-gui { font-size: 11pt; margin-bottom: 6px; }
                    .can-cu { font-size: 11pt; margin-bottom: 10px; line-height: 1.4; }
                    .can-cu p { margin: 2px 0; }
                    .trinh-bay { font-size: 11pt; margin-bottom: 8px; line-height: 1.4; }
                    .ghi-chu { font-size: 11pt; font-style: italic; margin-bottom: 12px; line-height: 1.4; }
                    
                    /* Exact Excel Table Layout */
                    .excel-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 10px; font-size: 9.5pt; table-layout: fixed; }
                    .excel-table th { border: 1px solid #000; padding: 5px 2px; background-color: #ffffff; text-align: center; font-weight: bold; vertical-align: middle; word-break: keep-all; }
                    .excel-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: middle; word-break: normal; overflow-wrap: break-word; }
                    
                    .summary-section { font-size: 10pt; margin-top: 8px; margin-bottom: 12px; line-height: 1.5; }
                    .summary-row-bold { font-weight: bold; }
                    
                    .legal-box { font-size: 9pt; font-style: italic; margin-top: 10px; margin-bottom: 15px; line-height: 1.35; text-align: justify; }
                    .legal-box p { margin: 4px 0; }
                    
                    .date-line { text-align: right; font-size: 10pt; margin-bottom: 15px; }
                    
                    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid; table-layout: fixed; }
                    .signatures-table td { text-align: center; vertical-align: top; border: none; padding: 2px; }
                    .sign-title { font-weight: bold; font-size: 10pt; }
                    .sign-sub { font-size: 9pt; font-style: italic; color: #333; margin-bottom: 45px; }
                    .sign-name { font-size: 9pt; font-style: italic; }
                    .sign-status { font-size: 8.5pt; color: #1b5e20; font-weight: bold; margin-top: 2px; }

                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <!-- Header: Company & Proposal Number -->
                <table class="header-table">
                    <tr>
                        <td style="width: 55%;">
                            <p style="margin: 0; font-weight: bold; font-size: 10pt;">Công ty Cổ phần Thương mại Thắng Ân</p>
                            <p style="margin: 2px 0 0 0; font-size: 10pt;">10/52 Giang Văn Minh - P.Ba Đình - TP.Hà Nội</p>
                            <p style="margin: 2px 0 0 0; font-size: 10pt;">Tel: 0813239933</p>
                        </td>
                        <td style="width: 45%; text-align: right; vertical-align: top;">
                            <p style="margin: 0; font-size: 10pt; font-style: italic;">Số/No.: ${detail.proposalNo} /TT-KD-TA</p>
                        </td>
                    </tr>
                </table>

                <!-- Main Title -->
                <div class="doc-title">TỜ TRÌNH</div>
                <div class="doc-subtitle">
                    (V/v: Phê duyệt xuất hàng mẫu rượu không thu tiền cho khách hàng HoReCa /<br/>
                    Approval for issuing free wine-tasting samples to HoReCa customer)
                </div>

                <!-- Recipient & Basis -->
                <div class="kinh-gui">
                    <strong>Kính gửi: </strong><strong>Ban Lãnh Đạo / Board of Directors</strong>
                </div>

                <div class="can-cu">
                    <p>- Căn cứ: Quyền hạn và trách nhiệm của Phòng Kinh doanh/ Based on: the authority and responsibility of the Sales Department</p>
                    <p>- Căn cứ nhu cầu giới thiệu, cho khách hàng dùng thử sản phẩm /Based on the need to introduce products</p>
                    <p>- Căn cứ Ngân sách hàng mẫu đã được phê duyệt theo kỳ của Công ty (nếu có)/ Based on the Company's approved sample budget for the period (if any)</p>
                </div>

                <!-- Statement -->
                <div class="trinh-bay">
                    <p style="margin: 0;">Phòng Kinh doanh kính trình Ban Lãnh đạo phê duyệt xuất hàng mẫu không thu tiền cho khách hàng, cụ thể như sau:</p>
                    <p style="margin: 2px 0 0 0;">The Sales Department respectfully submits to the Board of Directors for approval of free wine-tasting samples for the customer, as follows:</p>
                </div>

                <!-- Note -->
                <div class="ghi-chu">
                    Ghi chú: Giá bán cho khách hàng = 0 đồng (hàng mẫu không thu tiền). "Đơn giá tham khảo" dưới đây chỉ phục vụ mục đích quản lý nội bộ (theo dõi giá vốn/ngân sách hàng mẫu), không phải giá tính thuế GTGT.
                </div>

                <!-- Product Table with Exact Excel Widths -->
                <table class="excel-table">
                    <thead>
                        <tr>
                            <th style="width: 4%; white-space: nowrap;">STT<br/>No.</th>
                            <th style="width: 22%;">Khách hàng & Ngày xuất<br/>Customer & Date</th>
                            <th style="width: 9%; white-space: nowrap;">Mã hàng<br/>Item Code</th>
                            <th style="width: 23%;">Tên hàng<br/>Product Name</th>
                            <th style="width: 5%; white-space: nowrap;">ĐVT<br/>Unit</th>
                            <th style="width: 4%; white-space: nowrap;">SL<br/>Qty</th>
                            <th style="width: 11%; white-space: nowrap;">Đơn giá tham khảo<br/>Ref. unit cost</th>
                            <th style="width: 11%; white-space: nowrap;">Thành tiền tham khảo<br/>Ref. total value</th>
                            <th style="width: 11%;">Mục đích / Lý do<br/>Purpose / Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <!-- Summary Section -->
                <div class="summary-section">
                    <p class="summary-row-bold" style="margin: 3px 0;">
                        Tổng giá trị tham khảo hàng mẫu (kỳ này) / Total reference value (this period): 
                        <span style="float: right; margin-right: 2%; white-space: nowrap;">${formatVNDPrint(totalRefValue)}</span>
                    </p>
                    <p style="margin: 3px 0;">Ngân sách hàng mẫu đã duyệt cho kỳ này / Approved sample budget for this period:</p>
                    <p class="summary-row-bold" style="margin: 3px 0;">Ngân sách còn lại sau đề nghị này / Remaining budget after this request:</p>
                </div>

                <!-- Legal Box -->
                <div class="legal-box">
                    <p><strong>Thẩm quyền phê duyệt / Approval authority</strong> (đề nghị điền theo Quy chế phân cấp phê duyệt nội bộ hiện hành):<br/>
                    - Giá trị tham khảo ≤ ____ VNĐ/lần hoặc ≤ ____ VNĐ/tháng cho một khách hàng: Quản lý Kinh doanh (CBO - Sales Manager) phê duyệt.<br/>
                    - Vượt mức trên, hoặc vượt ngân sách hàng mẫu đã duyệt: trình Ban Lãnh đạo phê duyệt.</p>
                    
                    <p><strong>Lưu ý pháp lý / Legal note:</strong> (1) Hàng mẫu để khách hàng dùng thử không thu tiền có giá tính thuế GTGT = 0 theo Khoản 2 Điều 6 Nghị định 181/2025/NĐ-CP, nhưng vẫn bắt buộc phải lập hóa đơn điện tử ghi rõ dòng chữ "Hàng mẫu không thu tiền" theo Khoản 1 Điều 4 (được sửa đổi bởi Nghị định 70/2025/NĐ-CP) và Điều 10 Nghị định 123/2020/NĐ-CP; không xuất hóa đơn có thể bị xử phạt theo Nghị định 125/2020/NĐ-CP. (2) "Đơn giá tham khảo" trong bảng trên chỉ phục vụ quản lý nội bộ (giá vốn/ngân sách), không phải giá tính thuế. (3) Để chi phí hàng mẫu được ghi nhận là chi phí hợp lý, hợp lệ khi xác định thu nhập chịu thuế TNDN, cần lưu đầy đủ: tờ trình đã duyệt, hóa đơn xuất hàng mẫu, và xác nhận đã giao hàng cho khách hàng (mục ký nhận bên dưới).</p>
                </div>

                <!-- Date Line -->
                <div class="date-line">
                    Hà Nội, ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}
                </div>

                <!-- Signatures Grid -->
                <table class="signatures-table">
                    <tr>
                        <td style="width: 30%;">
                            <div class="sign-title">Vận hành</div>
                            <div style="font-size: 9.5pt;">Operation</div>
                            <div style="margin-bottom: 45px;"></div>
                            <div class="sign-name" style="font-weight: bold;">Trần Hữu Chiến</div>
                        </td>
                        <td style="width: 35%;">
                            <div class="sign-title">Quản lý Kinh doanh</div>
                            <div style="font-size: 9.5pt;">CBO - Sales Manager</div>
                            <div style="margin-bottom: 45px;"></div>
                            <div class="sign-name" style="font-weight: bold;">${l1Log?.approver?.name || 'Jeremie Courivault'}</div>
                        </td>
                        <td style="width: 35%;">
                            <div class="sign-title">Nhân Viên Kinh doanh</div>
                            <div style="font-size: 9.5pt;">Sales Executive</div>
                            <div class="sign-sub">(Họ và tên / Full name)</div>
                            <div style="margin-bottom: 35px;"></div>
                            <div class="sign-name" style="font-style: normal; font-weight: bold;">${detail.creator?.name || ''}</div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding-top: 25px;">
                            <div class="sign-title">Ban Lãnh đạo / Board of Directors</div>
                            <div style="font-size: 9pt; font-style: italic;">(Trường hợp vượt thẩm quyền Quản lý Kinh doanh hoặc vượt ngân sách / In case beyond the Sales Manager's authority or budget)</div>
                            <div style="color: #999; margin-top: 35px;">............................................................</div>
                            <div class="sign-name" style="margin-top: 5px; font-weight: bold;">${l3Log?.approver?.name || ''}</div>
                        </td>
                    </tr>
                </table>

                <!-- Digital Approval Audit Trail Table Below -->
                <div style="margin-top: 25px; page-break-inside: avoid;">
                    <div style="font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px;">
                        Tiến Trình Phê Duyệt Hệ Thống (Digital Audit Trail)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 40px;">STT</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left; width: 140px;">Cấp Duyệt / Vai Trò</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">Người Thực Hiện</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 120px;">Trạng Thái</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 140px;">Thời Gian</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">Ghi Chú / Ý Kiến</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">1</td>
                                <td style="border: 1px solid #000; padding: 5px;">Người lập tờ trình</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${detail.creator?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: #1b5e20;">✓ Đã lập & trình</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">Khởi tạo tờ trình</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">2</td>
                                <td style="border: 1px solid #000; padding: 5px;">Quản lý Kinh doanh</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${l1Log?.approver?.name || 'Jeremie Courivault'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: ${l1Log ? (l1Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l1Log ? (l1Log.action === 'APPROVE' ? '✓ Đã duyệt' : '✗ Từ chối') : '⏳ Chưa duyệt'}
                                </td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${l1SignedAt || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">${l1Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">3</td>
                                <td style="border: 1px solid #000; padding: 5px;">Vận hành</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">Trần Hữu Chiến</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: #1b5e20;">✓ Đã xác nhận</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">Xác nhận vận hành</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">4</td>
                                <td style="border: 1px solid #000; padding: 5px;">Ban Lãnh đạo</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${l3Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: ${l3Log ? (l3Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l3Log ? (l3Log.action === 'APPROVE' ? '✓ Đã phê duyệt' : '✗ Từ chối') : '⏳ Chưa phê duyệt'}
                                </td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${l3SignedAt || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">${l3Log?.comment || '—'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        ` : `
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
                    .signatures-table { width: 100%; margin-top: 40px; border-collapse: collapse; page-break-inside: avoid; }
                    .signatures-table td { text-align: center; width: 25%; vertical-align: top; border: none; padding: 5px; }
                    .sign-title { font-weight: bold; text-transform: uppercase; margin-bottom: 3px; font-size: 12px; }
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
                            <p style="margin: 5px 0 0 0; font-size: 11px; font-family: Arial, sans-serif; font-weight: normal;">Số: ${detail.proposalNo}</p>
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

                <div class="title">TỜ TRÌNH CƠ CHẾ GIÁ & GIÁ ĐẶC BIỆT</div>
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
                                        <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 60px;">Số lượng</th>
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
                            <div class="sign-title">NGƯỜI LẬP TỜ TRÌNH</div>
                            <div style="font-size: 10px; color: #555; font-style: italic; margin-bottom: 45px;">(Ký, ghi rõ họ tên)</div>
                            <div style="font-weight: bold; font-size: 13px;">${detail.creator?.name || ''}</div>
                        </td>
                        <td>
                            <div class="sign-title">TRƯỞNG BỘ PHẬN</div>
                            <div style="font-size: 10px; color: #555; font-style: italic; margin-bottom: 45px;">(Xác nhận & Ký tên)</div>
                            <div style="font-weight: bold; font-size: 13px; min-height: 18px;">${l1Log?.approver?.name || ''}</div>
                        </td>
                        <td>
                            <div class="sign-title">KẾ TOÁN TRƯỞNG</div>
                            <div style="font-size: 10px; color: #555; font-style: italic; margin-bottom: 45px;">(Kểm tra & Ký tên)</div>
                            <div style="font-weight: bold; font-size: 13px; min-height: 18px;">${l2Log?.approver?.name || ''}</div>
                        </td>
                        <td>
                            <div class="sign-title">TỔNG GIÁM ĐỐC</div>
                            <div style="font-size: 10px; color: #555; font-style: italic; margin-bottom: 45px;">(Phê duyệt & Đóng dấu)</div>
                            <div style="font-weight: bold; font-size: 13px; min-height: 18px;">${l3Log?.approver?.name || ''}</div>
                        </td>
                    </tr>
                </table>

                {/* Digital Approval Audit Trail Table Below */}
                <div style="margin-top: 30px; page-break-inside: avoid;">
                    <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 10px;">
                        V. Bảng Tiến Trình Phê Duyệt Hệ Thống (Digital Audit Trail)
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">STT</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left; width: 140px;">Cấp Duyệt / Vai Trò</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left;">Người Thực Hiện</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 110px;">Trạng Thái</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 140px;">Thời Gian</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left;">Ghi Chú / Ý Kiến</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">1</td>
                                <td style="border: 1px solid #000; padding: 6px;">Người lập tờ trình</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${detail.creator?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: #1b5e20;">✓ Đã lập & trình</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">Khởi tạo tờ trình</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">2</td>
                                <td style="border: 1px solid #000; padding: 6px;">Cấp 1: Trưởng Bộ Phận</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l1Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l1Log ? (l1Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l1Log ? (l1Log.action === 'APPROVE' ? '✓ Đã duyệt' : '✗ Từ chối') : '⏳ Chưa duyệt'}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l1SignedAt}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${l1Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">3</td>
                                <td style="border: 1px solid #000; padding: 6px;">Cấp 2: Kế Toán Trưởng</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l2Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l2Log ? (l2Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l2Log ? (l2Log.action === 'APPROVE' ? '✓ Đã duyệt' : '✗ Từ chối') : '⏳ Chưa duyệt'}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l2SignedAt}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${l2Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">4</td>
                                <td style="border: 1px solid #000; padding: 6px;">Cấp 3: Tổng Giám Đốc (CEO)</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l3Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l3Log ? (l3Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l3Log ? (l3Log.action === 'APPROVE' ? '✓ Đã duyệt' : '✗ Từ chối') : '⏳ Chưa duyệt'}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l3SignedAt}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${l3Log?.comment || '—'}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

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

    const currentStats = React.useMemo(() => {
        const total = proposals.length
        const pending = proposals.filter(p => ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)).length
        const approved = proposals.filter(p => ['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(p.status)).length
        const rejected = proposals.filter(p => p.status === 'REJECTED').length
        const draft = proposals.filter(p => p.status === 'DRAFT' || p.status === 'RETURNED').length
        return { total, pending, approved, rejected, draft }
    }, [proposals])

    return (
        <div className="space-y-6 w-full max-w-none px-2 sm:px-4">
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
                    { label: 'Tổng', value: currentStats.total, accent: '#8AAEBB' },
                    { label: 'Chờ Duyệt', value: currentStats.pending, accent: '#D4A853' },
                    { label: 'Bản Nháp', value: currentStats.draft, accent: '#4A6A7A' },
                    { label: 'Đã Duyệt', value: currentStats.approved, accent: '#5BA88A' },
                    { label: 'Từ Chối', value: currentStats.rejected, accent: '#8B1A2E' },
                ].map(s => (
                    <div key={s.label} className="rounded-md p-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.accent}` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: '#E8F1F2' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter + Search Bar */}
            <div className="flex items-center gap-3 flex-wrap w-full">
                <div className="max-w-full overflow-x-auto scrollbar-none flex rounded-md flex-shrink-0" style={{ border: '1px solid #2A4355' }}>
                    {(['ALL', 'PENDING', 'DRAFT', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap"
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

                {/* Category Dropdown Filter */}
                <div className="flex-shrink-0">
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 text-xs font-semibold rounded-md outline-none cursor-pointer"
                        style={{
                            background: categoryFilter === 'ALL' ? '#1B2E3D' : 'rgba(135,203,185,0.15)',
                            border: '1px solid #2A4355',
                            color: categoryFilter === 'ALL' ? '#8AAEBB' : '#87CBB9',
                        }}
                    >
                        <option value="ALL">All Categories (Tất cả loại)</option>
                        <option value="TASTING">🍷 Tờ Trình Tasting (Thử Rượu)</option>
                        <option value="SPECIAL_EVENT">🎪 Sự Kiện / Event</option>
                        <option value="PRICE_ADJUSTMENT">🏷️ Tờ Trình Cơ Chế Giá & Giá Đặc Biệt</option>
                        <option value="BUDGET_REQUEST">💰 Xin Ngân Sách</option>
                        <option value="CAPITAL_EXPENDITURE">🏢 Mua Sắm TSCĐ</option>
                        <option value="NEW_SUPPLIER">🤝 Nhà Cung Cấp Mới</option>
                        <option value="NEW_PRODUCT">📦 Sản Phẩm Mới</option>
                        <option value="POLICY_CHANGE">📋 Thay Đổi Quy Trình</option>
                        <option value="PAYMENT_SCHEDULE">📅 Lịch Thanh Toán</option>
                        <option value="PROMOTION_CAMPAIGN">🎁 Chương Trình KM</option>
                        <option value="OTHER"> Khác</option>
                    </select>
                </div>

                <div className="flex-1 relative min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm theo mã, tiêu đề, người trình..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Mobile View - Cards for small screens */}
            <div className="block md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2" style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '6px' }}>
                        <FileText size={32} style={{ color: '#2A4355' }} />
                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tờ trình nào</p>
                    </div>
                ) : (
                    filtered.map(p => {
                        const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.DRAFT
                        const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                        const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                        const canApproveThis = isPending && canApproveAtLevel(p.currentLevel, userRoles)

                        return (
                            <div
                                key={p.id}
                                className="p-4 rounded-lg space-y-3 transition-all cursor-pointer"
                                style={{
                                    background: '#1B2E3D',
                                    border: canApproveThis ? '1px solid #D4A853' : '1px solid #2A4355',
                                }}
                                onClick={() => openDetail(p.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold font-mono" style={{ color: '#87CBB9' }}>
                                        {p.proposalNo}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        {statusCfg.label}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                        {p.title}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                        {CATEGORY_LABELS[p.category] ?? p.category}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                        style={{ background: prioCfg.bg, color: prioCfg.color }}>
                                        {prioCfg.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2" style={{ borderTop: '1px solid rgba(42,67,85,0.2)', color: '#8AAEBB' }}>
                                    <div>
                                        <p style={{ color: '#4A6A7A' }} className="text-[10px] uppercase font-semibold">Người trình</p>
                                        <p className="font-medium mt-0.5">{p.creatorName}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: '#4A6A7A' }} className="text-[10px] uppercase font-semibold">Ngày trình</p>
                                        <p className="font-medium mt-0.5">
                                            {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString('vi-VN') : '—'}
                                        </p>
                                    </div>
                                    {p.estimatedAmount !== null && (
                                        <div className="col-span-2">
                                            <p style={{ color: '#4A6A7A' }} className="text-[10px] uppercase font-semibold">Giá trị dự kiến</p>
                                            <p className="font-bold text-sm mt-0.5" style={{ color: '#E8F1F2' }}>
                                                {formatCompactVND(p.estimatedAmount)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openDetail(p.id)}
                                        className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.2)' }}>
                                        <Eye size={12} className="inline mr-1" />Chi tiết
                                    </button>
                                    {canApproveThis && (
                                        <>
                                            <button
                                                onClick={() => handleApproval(p.id, 'APPROVE')}
                                                disabled={actionLoading === p.id}
                                                className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                Duyệt
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const reason = prompt('Lý do từ chối:')
                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                                <XCircle size={12} className="inline mr-1" />Từ chối
                                            </button>
                                        </>
                                    )}
                                    {(p.status === 'DRAFT' || p.status === 'RETURNED') && (
                                        <button
                                            onClick={() => handleSubmitProposal(p.id)}
                                            disabled={actionLoading === p.id}
                                            className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}>
                                            {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} className="inline mr-1" />}
                                            Trình
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-xl overflow-x-auto w-full shadow-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="w-full min-w-[1100px]">
                    <table className="w-full min-w-[1100px]" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '120px' }} />
                            <col style={{ minWidth: '180px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '85px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '160px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #2A4355' }}>
                                {[
                                    { label: 'Mã Tờ Trình', align: 'left' as const },
                                    { label: 'Tiêu Đề', align: 'left' as const },
                                    { label: 'Loại Tờ Trình', align: 'left' as const },
                                    { label: 'Ưu Tiên', align: 'left' as const },
                                    { label: 'Giá Trị', align: 'right' as const },
                                    { label: 'Người Trình', align: 'left' as const },
                                    { label: 'Trạng Thái', align: 'left' as const },
                                    { label: 'Ngày Giờ Trình', align: 'left' as const },
                                    { label: 'Duyệt Final', align: 'left' as const },
                                    { label: 'Thao Tác', align: 'right' as const },
                                ].map(col => (
                                    <th key={col.label}
                                        className="px-3 py-3 text-xs font-bold uppercase tracking-wider"
                                        style={{ color: '#4A6A7A', textAlign: col.align, whiteSpace: 'nowrap' }}>
                                        {col.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10}>
                                        <div className="flex flex-col items-center py-12 gap-2">
                                            <FileText size={32} style={{ color: '#2A4355' }} />
                                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tờ trình nào khớp với bộ lọc</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(p => {
                                    const statusCfg = STATUS_LABELS[p.status] ?? STATUS_LABELS.DRAFT
                                    const prioCfg = PRIORITY_LABELS[p.priority] ?? PRIORITY_LABELS.NORMAL
                                    const catBadge = getCategoryBadge(p.category)
                                    const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                                    const canApproveThis = isPending && canApproveAtLevel(p.currentLevel, userRoles)

                                    return (
                                        <tr key={p.id}
                                            onClick={() => openDetail(p.id)}
                                            className="transition-all cursor-pointer hover:brightness-110"
                                            style={{
                                                borderBottom: '1px solid #2A4355',
                                                background: canApproveThis ? 'rgba(212,168,83,0.03)' : 'transparent',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = canApproveThis ? 'rgba(212,168,83,0.03)' : 'transparent'}
                                        >
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs font-bold font-mono text-[#87CBB9] whitespace-nowrap block truncate" title={p.proposalNo}>
                                                    {p.proposalNo}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <p className="text-sm font-medium text-[#E8F1F2] line-clamp-2" title={p.title}>{p.title}</p>
                                                {p.attachmentCount > 0 && (
                                                    <span className="text-[11px] text-[#4A6A7A]">
                                                        <Paperclip size={10} className="inline mr-1" />{p.attachmentCount} file
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold inline-block truncate max-w-full"
                                                    style={{ background: catBadge.bg, color: catBadge.color, border: `1px solid ${catBadge.border}` }}
                                                    title={CATEGORY_LABELS[p.category] || p.category}>
                                                    {catBadge.label}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold inline-block whitespace-nowrap"
                                                    style={{ background: prioCfg.bg, color: prioCfg.color }}>
                                                    {prioCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3 text-right" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs font-bold block truncate text-[#E8F1F2]">
                                                    {p.estimatedAmount ? formatCompactVND(p.estimatedAmount) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs truncate block text-[#8AAEBB]" title={p.creatorName}>{p.creatorName}</span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block whitespace-nowrap"
                                                    style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] whitespace-nowrap text-[#8AAEBB]">
                                                    {formatDateTime(p.submittedAt || p.createdAt)}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                {(p.status === 'APPROVED' || p.status === 'IN_PROGRESS' || p.status === 'CLOSED') ? (
                                                    <span className="text-[11px] font-bold whitespace-nowrap text-[#5BA88A]" title="Thời gian CEO phê duyệt hoàn tất">
                                                        {formatDateTime(p.resolvedAt)}
                                                    </span>
                                                ) : p.status === 'REJECTED' ? (
                                                    <span className="text-[11px] font-medium whitespace-nowrap text-[#8B1A2E]" title="Thời gian từ chối">
                                                        {formatDateTime(p.resolvedAt)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs whitespace-nowrap text-[#4A6A7A]" title="Đang chờ duyệt">
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1.5 flex-nowrap">
                                                    <button onClick={() => openDetail(p.id)}
                                                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap"
                                                        style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                                        <Eye size={12} className="inline mr-1" />Chi tiết
                                                    </button>
                                                    {canApproveThis && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApproval(p.id, 'APPROVE') }}
                                                                disabled={actionLoading === p.id}
                                                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap hover:scale-105"
                                                                style={{ background: '#5BA88A', color: '#0A1926' }}>
                                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                                Duyệt
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    const reason = prompt('Lý do từ chối:')
                                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                                }}
                                                                className="px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap hover:bg-rose-900/30"
                                                                style={{ background: 'rgba(139,26,46,0.15)', color: '#FF6B6B', border: '1px solid rgba(139,26,46,0.4)' }}>
                                                                <XCircle size={12} className="inline mr-1" />Từ chối
                                                            </button>
                                                        </>
                                                    )}
                                                    {(p.status === 'DRAFT' || p.status === 'RETURNED') && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleSubmitProposal(p.id) }}
                                                            disabled={actionLoading === p.id}
                                                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap"
                                                            style={{ background: 'rgba(74,143,171,0.2)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.4)' }}>
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
                    userRoles={userRoles}
                    onApproval={async (action, comment) => { await handleApproval(detailId, action, comment); }}
                    onRefresh={async () => { await refreshList(); await openDetail(detailId) }}
                    onPrint={handlePrint}
                />
            )}
        </div>
    )
}

// ─── Searchable Customer Combobox ───────────────────────────
function SearchableCustomerCombobox({
    customers,
    selectedCustomerId,
    onSelect,
}: {
    customers: any[]
    selectedCustomerId: string
    onSelect: (customer: any) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 300 })

    const selectedCust = React.useMemo(() => {
        return customers.find((c: any) => c.id === selectedCustomerId)
    }, [customers, selectedCustomerId])

    const handleOpen = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            })
        }
        setOpen(true)
        setQuery('')
    }

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return customers.slice(0, 40)
        return customers.filter((c: any) => 
            (c.name && c.name.toLowerCase().includes(q)) || 
            (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 40)
    }, [customers, query])

    const displayValue = selectedCust ? `[${selectedCust.code}] ${selectedCust.name}` : query

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={open ? query : displayValue}
                    onFocus={handleOpen}
                    onChange={e => {
                        setQuery(e.target.value)
                        if (!open) handleOpen()
                    }}
                    placeholder="Gõ mã (VD: HR10084) hoặc tên khách hàng để tìm..."
                    style={{ ...inputStyle, padding: '9px 36px 9px 32px', fontSize: '13px', background: '#142433' }}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                {selectedCust ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelect({ id: '', name: '', code: '' })
                            setQuery('')
                            setOpen(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50"
                        title="Xóa lựa chọn"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                )}
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-50 max-h-64 overflow-y-auto rounded-md shadow-2xl"
                        style={{
                            top: `${coords.top}px`,
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            background: '#142433',
                            border: '1px solid #2A4355',
                        }}
                    >
                        {filtered.length === 0 ? (
                            <div className="p-3 text-xs text-center text-gray-400">
                                {query ? `Không tìm thấy khách hàng khớp với "${query}"` : 'Chưa có dữ liệu khách hàng'}
                            </div>
                        ) : (
                            filtered.map((c: any) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(c)
                                        setOpen(false)
                                    }}
                                    className={`w-full text-left p-2.5 hover:bg-[#1B2E3D] transition flex items-center justify-between border-b border-[#2A4355]/40 text-xs ${c.id === selectedCustomerId ? 'bg-[#1B2E3D]' : ''}`}
                                >
                                    <div className="min-w-0 flex-1 pr-2">
                                        <span className="font-mono font-bold text-[#D4A853] mr-2 text-xs">[{c.code}]</span>
                                        <span className="text-[#E8F1F2] font-medium">{c.name}</span>
                                    </div>
                                    {c.channel && (
                                        <span className="text-[10px] text-[#8AAEBB] bg-[#1B2E3D] px-1.5 py-0.5 rounded whitespace-nowrap border border-[#2A4355]">
                                            {c.channel}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Searchable Product Combobox ───────────────────────────
function SearchableProductCombobox({
    products,
    selectedProductId,
    onSelect,
}: {
    products: any[]
    selectedProductId: string
    onSelect: (product: any) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 380 })

    const selectedProd = products.find(p => p.id === selectedProductId)

    const handleOpen = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect()
            setCoords({
                top: rect.bottom + 4,
                left: rect.left,
                width: Math.max(rect.width, 360)
            })
        }
        setOpen(true)
        setQuery('')
    }

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return products.slice(0, 30)
        return products.filter(p => 
            p.productName.toLowerCase().includes(q) || 
            p.skuCode.toLowerCase().includes(q)
        ).slice(0, 30)
    }, [products, query])

    const displayValue = selectedProd ? `[${selectedProd.skuCode}] ${selectedProd.productName}` : query

    return (
        <div ref={containerRef} className="relative flex-1 min-w-0">
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#8AAEBB' }}>Sản phẩm (Gõ SKU hoặc tên để tìm)</label>
            <div className="relative">
                <input
                    type="text"
                    value={open ? query : displayValue}
                    onFocus={handleOpen}
                    onChange={e => {
                        setQuery(e.target.value)
                        if (!open) handleOpen()
                    }}
                    placeholder="Gõ mã SKU hoặc tên sản phẩm..."
                    style={{ ...inputStyle, padding: '7px 32px 7px 10px', fontSize: '13px', background: '#1B2E3D' }}
                />
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="fixed z-50 max-h-72 overflow-y-auto rounded-md shadow-2xl"
                        style={{
                            top: `${coords.top}px`,
                            left: `${coords.left}px`,
                            width: `${coords.width}px`,
                            background: '#142433',
                            border: '1px solid #2A4355',
                        }}
                    >
                        {filtered.length === 0 ? (
                            <div className="p-3 text-xs text-center text-gray-500">Không tìm thấy sản phẩm khớp "{query}"</div>
                        ) : (
                            filtered.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                        onSelect(p)
                                        setOpen(false)
                                    }}
                                    className="w-full text-left p-2.5 hover:bg-[#1B2E3D] transition flex items-center justify-between border-b border-[#2A4355]/40 text-xs"
                                >
                                    <div className="min-w-0 flex-1 pr-3">
                                        <span className="font-mono font-bold text-[#87CBB9] mr-2 text-xs">{p.skuCode}</span>
                                        <span className="text-[#E8F1F2] font-medium">{p.productName}</span>
                                    </div>
                                    <span className="font-mono text-xs text-gray-400 font-medium whitespace-nowrap bg-[#1B2E3D] px-2 py-1 rounded">
                                        {formatVND(p.wholesalePrice)}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Batch Product Picker Modal ───────────────────────────
function BatchProductPickerModal({
    products,
    onAddItems,
    onClose,
}: {
    products: any[]
    onAddItems: (items: { productId: string; proposedPrice: number; quantity: number }[]) => void
    onClose: () => void
}) {
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Record<string, { proposedPrice: number; quantity: number }>>({})

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return products.slice(0, 50)
        return products.filter(p => 
            p.productName.toLowerCase().includes(q) || 
            p.skuCode.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [products, search])

    const handleApplyDiscountAll = (pct: number) => {
        const next = { ...selected }
        filtered.forEach(p => {
            if (next[p.id]) {
                const discounted = p.wholesalePrice * (1 - pct / 100)
                next[p.id].proposedPrice = Math.round(discounted / 1000) * 1000
            }
        })
        setSelected(next)
    }

    const toggleSelect = (p: any) => {
        const next = { ...selected }
        if (next[p.id]) {
            delete next[p.id]
        } else {
            next[p.id] = { proposedPrice: p.wholesalePrice, quantity: 1 }
        }
        setSelected(next)
    }

    const handleConfirm = () => {
        const items = Object.entries(selected).map(([productId, val]) => ({
            productId,
            proposedPrice: val.proposedPrice,
            quantity: val.quantity || 1
        }))
        if (items.length > 0) {
            onAddItems(items)
        }
        onClose()
    }

    const selectedCount = Object.keys(selected).length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
            <div className="w-full max-w-4xl max-h-[90vh] rounded-xl flex flex-col shadow-2xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between p-5 border-b border-[#2A4355]">
                    <h4 className="text-base font-bold text-[#E8F1F2]">Chọn Nhanh Sản Phẩm Đề Xuất Giá (Batch Product Picker)</h4>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[#1B2E3D]"><X size={20} className="text-gray-400" /></button>
                </div>

                <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm SKU hoặc tên sản phẩm..."
                            className="w-full pl-9 pr-3 py-2 text-xs outline-none rounded-md"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>Đã chọn: <strong className="text-[#87CBB9]">{selectedCount}</strong> chai</span>
                        <div className="flex items-center gap-2">
                            <span>Áp dụng giảm nhanh:</span>
                            <button type="button" onClick={() => handleApplyDiscountAll(5)} className="px-2 py-0.5 rounded bg-[#1B2E3D] hover:bg-[#2A4355] text-[10px] text-[#D4A853]">-5%</button>
                            <button type="button" onClick={() => handleApplyDiscountAll(10)} className="px-2 py-0.5 rounded bg-[#1B2E3D] hover:bg-[#2A4355] text-[10px] text-[#D4A853]">-10%</button>
                            <button type="button" onClick={() => handleApplyDiscountAll(15)} className="px-2 py-0.5 rounded bg-[#1B2E3D] hover:bg-[#2A4355] text-[10px] text-[#D4A853]">-15%</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-[#2A4355]/40 rounded p-2">
                        {filtered.map(p => {
                            const isChecked = !!selected[p.id]
                            const currentPrice = selected[p.id]?.proposedPrice ?? p.wholesalePrice
                            const diffPct = p.wholesalePrice > 0 ? ((currentPrice - p.wholesalePrice) / p.wholesalePrice) * 100 : 0

                            return (
                                <div key={p.id} className="flex items-center justify-between p-2 rounded hover:bg-[#1B2E3D] transition border-b border-[#2A4355]/30 text-xs">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleSelect(p)}
                                            className="w-4 h-4 accent-[#87CBB9] cursor-pointer"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="font-mono font-bold text-[#87CBB9] mr-2">{p.skuCode}</span>
                                            <span className="text-[#E8F1F2] font-medium">{p.productName}</span>
                                            <span className="text-[10px] text-gray-500 block">Giá niêm yết: {formatVND(p.wholesalePrice)}</span>
                                        </div>
                                    </div>

                                    {isChecked && (
                                        <div className="flex items-center gap-2 pl-3">
                                            <div className="text-right">
                                                <label className="text-[9px] block text-amber-400 font-bold">Số lượng (chai)</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={selected[p.id]?.quantity ?? 1}
                                                    onChange={e => {
                                                        const qty = Math.max(1, parseInt(e.target.value) || 1)
                                                        setSelected(prev => ({
                                                            ...prev,
                                                            [p.id]: { ...(prev[p.id] || { proposedPrice: p.wholesalePrice }), quantity: qty }
                                                        }))
                                                    }}
                                                    className="w-16 px-2 py-1 text-xs font-bold font-mono outline-none rounded text-center"
                                                    style={{ background: '#142433', border: '1px solid #D4A853', color: '#D4A853' }}
                                                />
                                            </div>

                                            <div className="text-right">
                                                <label className="text-[9px] block text-gray-400">Giá đề xuất</label>
                                                <input
                                                    type="number"
                                                    value={currentPrice}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value) || 0
                                                        setSelected(prev => ({
                                                            ...prev,
                                                            [p.id]: { ...(prev[p.id] || { quantity: 1 }), proposedPrice: val }
                                                        }))
                                                    }}
                                                    className="w-24 px-2 py-1 text-xs font-bold font-mono outline-none rounded"
                                                    style={{ background: '#142433', border: '1px solid #87CBB9', color: '#87CBB9' }}
                                                />
                                            </div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${diffPct < 0 ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                                                {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-[#2A4355] flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium rounded text-gray-400 hover:bg-[#1B2E3D]">Huỷ</button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedCount === 0}
                        className="px-5 py-2 text-xs font-semibold rounded disabled:opacity-40"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                    >
                        Thêm {selectedCount} Sản Phẩm Vào Tờ Trình
                    </button>
                </div>
            </div>
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

    const searchParams = useSearchParams()
    const initialCategory = searchParams?.get('category') || 'BUDGET_REQUEST'

    const [form, setForm] = useState({
        category: initialCategory,
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
    const [priceLines, setPriceLines] = useState<{ productId: string; proposedPrice: number; quantity: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [batchPickerOpen, setBatchPickerOpen] = useState(false)

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
        const isTastingCategory = form.category === 'TASTING' || form.category === 'SPECIAL_EVENT'
        if (isTastingCategory) {
            if (priceLines.length === 0) {
                return alert('Vui lòng chọn ít nhất 1 mã sản phẩm nếm thử (Tasting)')
            }
            if (priceLines.some(line => !line.productId)) {
                return alert('Vui lòng chọn đầy đủ mã sản phẩm cho các dòng tasting')
            }
        }
        setSaving(true)
        const result = await createProposal({
            ...form,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            discountPct: form.discountPct ? parseFloat(form.discountPct) : undefined,
            priceItems: (isTastingCategory || form.category === 'PRICE_ADJUSTMENT') && priceLines.length > 0
                ? priceLines 
                : undefined,
            createdBy: userId,
        })
        if (result.success) onCreated()
        else alert(result.error)
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-4xl h-full overflow-y-auto shadow-2xl" style={{ background: '#142433', borderLeft: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-6" style={{ borderBottom: '1px solid #2A4355' }}>
                    <h3 className="text-xl font-bold" style={{ color: '#E8F1F2' }}>
                        <FileText size={22} className="inline mr-2 text-[#87CBB9]" />
                        Tạo Tờ Trình Đề Xuất Mới
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-[#1B2E3D]"><X size={20} style={{ color: '#4A6A7A' }} /></button>
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

                    {/* Tasting Custom Fields */}
                    {(form.category === 'TASTING' || form.category === 'SPECIAL_EVENT') && (
                        <div className="space-y-4 p-4 rounded-xl border-2 border-[#D4A853]/60 bg-[#1B2B3A] shadow-lg">
                            <div>
                                <label className="text-xs font-extrabold uppercase mb-1.5 block tracking-wider text-[#D4A853]">
                                    👤 Khách Hàng Áp Dụng Tasting (Tùy Chọn)
                                </label>
                                <SearchableCustomerCombobox
                                    customers={customers}
                                    selectedCustomerId={form.customerId}
                                    onSelect={(cust: any) => {
                                        setForm(f => ({
                                            ...f,
                                            customerId: cust.id,
                                            title: !f.title && cust.name ? `Tờ trình Tasting thử rượu cho khách hàng ${cust.name}` : f.title
                                        }))
                                    }}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-xs font-extrabold uppercase tracking-wider text-[#D4A853]">
                                        🍷 Mã Sản Phẩm & Số Lượng Thử Vang (Tasting) *
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setBatchPickerOpen(true)}
                                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer hover:opacity-90"
                                            style={{ background: 'rgba(212,168,83,0.2)', color: '#FCD34D', border: '1px solid rgba(212,168,83,0.6)' }}
                                        >
                                            <Search size={13} /> Chọn nhanh hàng loạt
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setPriceLines([...priceLines, { productId: '', proposedPrice: 0, quantity: 1 }])}
                                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer hover:opacity-90"
                                            style={{ background: 'rgba(135,203,185,0.2)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.6)' }}
                                        >
                                            <Plus size={13} /> Thêm dòng
                                        </button>
                                    </div>
                                </div>
                                {priceLines.length === 0 ? (
                                    <div className="p-4 text-center rounded-lg border-2 border-dashed border-[#D4A853]/40 bg-[#142230]">
                                        <p className="text-xs font-medium text-[#E8F1F2]">
                                            Chưa chọn mã hàng tasting nào. Bấm nút <strong className="text-[#87CBB9]">"Thêm dòng"</strong> hoặc <strong className="text-[#FCD34D]">"Chọn nhanh hàng loạt"</strong> ở trên để thêm sản phẩm.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                        {priceLines.map((line, idx) => {
                                            const selectedProd = products.find(p => p.id === line.productId)
                                            const wholesale = selectedProd ? selectedProd.wholesalePrice : 0
                                            
                                            return (
                                                <div key={idx} className="flex gap-2.5 items-center p-3 rounded-lg bg-[#111F2C] border border-[#2A4355] shadow-sm">
                                                    <div className="flex-1 min-w-0">
                                                        <SearchableProductCombobox
                                                            products={products}
                                                            selectedProductId={line.productId}
                                                            onSelect={p => {
                                                                const copy = [...priceLines]
                                                                copy[idx].productId = p.id
                                                                copy[idx].proposedPrice = 0
                                                                setPriceLines(copy)
                                                            }}
                                                        />
                                                    </div>
                                                    
                                                    <div className="w-28 text-center flex-shrink-0">
                                                        <label className="text-[10px] block text-[#D4A853] font-bold mb-1">Số lượng (chai)</label>
                                                        <input 
                                                            type="number"
                                                            min={1}
                                                            value={line.quantity || 1}
                                                            onChange={e => {
                                                                const copy = [...priceLines]
                                                                copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1)
                                                                setPriceLines(copy)
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                padding: '6px 8px',
                                                                fontSize: '13px',
                                                                background: '#1B2E3D',
                                                                border: '1px solid #D4A853',
                                                                fontWeight: 'bold',
                                                                color: '#FCD34D',
                                                                textAlign: 'center',
                                                                borderRadius: '6px',
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="text-right flex flex-col justify-center px-2 min-w-[95px] flex-shrink-0">
                                                        <span className="text-[10px] block text-[#4A6A7A] font-medium">Giá niêm yết</span>
                                                        <span className="text-xs block font-mono font-bold text-[#E8F1F2]">{formatVND(wholesale)}</span>
                                                    </div>

                                                    <button 
                                                        type="button" 
                                                        onClick={() => setPriceLines(priceLines.filter((_, i) => i !== idx))}
                                                        className="p-1.5 rounded text-rose-400 hover:bg-rose-500/20 transition-all flex-shrink-0"
                                                        title="Xóa dòng"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Price adjustment custom fields */}
                    {form.category === 'PRICE_ADJUSTMENT' && (
                        <div className="space-y-4 p-4 rounded-md border border-[#2A4355] bg-[#1B2E3D]">
                            <div>
                                <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#8AAEBB' }}>Khách hàng áp dụng *</label>
                                <SearchableCustomerCombobox
                                    customers={customers}
                                    selectedCustomerId={form.customerId}
                                    onSelect={(cust: any) => {
                                        setForm(f => ({
                                            ...f,
                                            customerId: cust.id,
                                            title: !f.title && cust.name ? `Đề xuất cơ chế giá & giá đặc biệt cho khách hàng ${cust.name}` : f.title
                                        }))
                                    }}
                                />
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
                                        <div className="flex items-center gap-3">
                                            <button 
                                                type="button" 
                                                onClick={() => setBatchPickerOpen(true)}
                                                className="text-xs flex items-center gap-1 text-[#D4A853] font-semibold hover:underline"
                                            >
                                                <Search size={12} /> Chọn nhanh hàng loạt
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => setPriceLines([...priceLines, { productId: '', proposedPrice: 0, quantity: 1 }])}
                                                className="text-xs flex items-center gap-1 text-[#87CBB9] font-semibold hover:underline"
                                            >
                                                <Plus size={12} /> Thêm dòng
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                        {priceLines.map((line, idx) => {
                                            const selectedProd = products.find(p => p.id === line.productId)
                                            const wholesale = selectedProd ? selectedProd.wholesalePrice : 0
                                            const diffPct = wholesale > 0 && line.proposedPrice > 0 ? ((line.proposedPrice - wholesale) / wholesale) * 100 : 0
                                            
                                            return (
                                                <div key={idx} className="flex gap-2 items-end p-2.5 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                    <SearchableProductCombobox
                                                        products={products}
                                                        selectedProductId={line.productId}
                                                        onSelect={p => {
                                                            const copy = [...priceLines]
                                                            copy[idx].productId = p.id
                                                            copy[idx].proposedPrice = p.wholesalePrice
                                                            setPriceLines(copy)
                                                        }}
                                                    />
                                                    
                                                    <div className="w-20">
                                                        <label className="text-[9px] block text-[#8AAEBB]">Số lượng</label>
                                                        <input 
                                                            type="number"
                                                            min={1}
                                                            value={line.quantity || 1}
                                                            onChange={e => {
                                                                const copy = [...priceLines]
                                                                copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1)
                                                                setPriceLines(copy)
                                                            }}
                                                            style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#1B2E3D', fontWeight: 'bold', color: '#D4A853', textAlign: 'center' }}
                                                        />
                                                    </div>

                                                    <div className="w-28">
                                                        <div className="flex items-center justify-between mb-0.5">
                                                            <label className="text-[9px]" style={{ color: '#4A6A7A' }}>Giá đề xuất</label>
                                                            {line.proposedPrice > 0 && wholesale > 0 && (
                                                                <span className={`text-[9px] font-bold ${diffPct < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                                    {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                        <input 
                                                            type="number"
                                                            value={line.proposedPrice || ''}
                                                            onChange={e => {
                                                                const copy = [...priceLines]
                                                                copy[idx].proposedPrice = parseFloat(e.target.value) || 0
                                                                setPriceLines(copy)
                                                            }}
                                                            placeholder="0"
                                                            style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#1B2E3D', fontWeight: 'bold', color: '#87CBB9' }}
                                                        />
                                                    </div>
                                                    
                                                    <div className="text-right flex flex-col justify-end pb-1 pr-1 min-w-[75px]">
                                                        <span className="text-[9px] block text-gray-500">Gốc (WS)</span>
                                                        <span className="text-[11px] block font-mono font-semibold" style={{ color: '#E8F1F2' }}>{formatVND(wholesale)}</span>
                                                    </div>

                                                    <button 
                                                        type="button" 
                                                        onClick={() => setPriceLines(priceLines.filter((_, i) => i !== idx))}
                                                        className="p-1 rounded text-red-400 hover:bg-red-500/10 mb-0.5"
                                                        title="Xóa dòng"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                        {priceLines.length === 0 && (
                                            <p className="text-center text-xs py-4 text-gray-400 border border-dashed border-[#2A4355] rounded-md">
                                                Bấm nút <strong className="text-[#87CBB9]">"Thêm dòng"</strong> hoặc <strong className="text-[#D4A853]">"Chọn nhanh hàng loạt"</strong> để chọn sản phẩm đề xuất.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {batchPickerOpen && (
                                <BatchProductPickerModal
                                    products={products}
                                    onClose={() => setBatchPickerOpen(false)}
                                    onAddItems={newItems => {
                                        // Merge new items avoiding duplicates
                                        const existingIds = new Set(priceLines.filter(l => l.productId).map(l => l.productId))
                                        const filteredNew = newItems.filter(item => !existingIds.has(item.productId))
                                        const validLines = priceLines.filter(l => l.productId)
                                        setPriceLines([...validLines, ...filteredNew])
                                    }}
                                />
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
function DetailDrawer({ detail, loading, onClose, userId, isCEO, userRoles, onApproval, onRefresh, onPrint }: {
    detail: ProposalDetail | null
    loading: boolean
    onClose: () => void
    userId: string
    isCEO: boolean
    userRoles: string[]
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
    const canApproveDetail = Boolean(isPending && detail && canApproveAtLevel(detail.currentLevel, userRoles))

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
                        {detail && (detail.category === 'PRICE_ADJUSTMENT' || detail.category === 'TASTING' || (detail.priceItems && detail.priceItems.length > 0)) && (
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
                                <p className="text-xs font-semibold uppercase" style={{ color: '#87CBB9' }}>Thông Tin Áp Dụng Cơ Chế Giá & Giá Đặc Biệt</p>
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
                            {/* Tasting Proposal Quick Action & Linked SOs */}
                            {(detail.category === 'TASTING' || detail.category === 'SPECIAL_EVENT') && (
                                <div className="p-4 rounded-xl space-y-2.5 shadow-sm transition-all" style={{
                                    background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                                    border: '1.5px solid #F59E0B',
                                }}>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-extrabold uppercase flex items-center gap-1.5 tracking-wide" style={{ color: '#92400E' }}>
                                            🍷 TỜ TRÌNH TASTING & THỬ VANG
                                        </p>
                                        {['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(detail.status) && (
                                            <a
                                                href={`/dashboard/sales?action=createTasting&proposalId=${detail.id}&customerId=${detail.customerId || ''}`}
                                                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                                            >
                                                🍷 + Lên Đơn Tasting Ngay
                                            </a>
                                        )}
                                    </div>
                                    {detail.customer && (
                                        <p className="text-xs font-medium" style={{ color: '#78350F' }}>
                                            Khách hàng áp dụng: <strong style={{ color: '#451A03', fontWeight: 700 }}>{detail.customer.name}</strong> ({detail.customer.code})
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Linked Sales Orders List */}
                            {(detail as any).salesOrders && (detail as any).salesOrders.length > 0 && (
                                <div className="p-4 rounded-md space-y-2.5 bg-[#1B2E3D] border border-[#2A4355]">
                                    <p className="text-xs font-bold uppercase text-[#87CBB9] flex items-center justify-between">
                                        <span>📦 Các Đơn Hàng Đã Lên Theo Tờ Trình Này ({(detail as any).salesOrders.length})</span>
                                    </p>
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                        {(detail as any).salesOrders.map((so: any) => (
                                            <div key={so.id} className="flex justify-between items-center p-2 rounded bg-[#142433] text-xs border border-[#2A4355]/40">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-[#87CBB9]">{so.soNo}</span>
                                                    {so.orderType === 'TASTING' && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-950 text-amber-300 border border-amber-500/40">🍷 Tasting</span>
                                                    )}
                                                    <span className="text-[10px] text-gray-400">{new Date(so.createdAt).toLocaleDateString('vi-VN')}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold text-slate-200">{formatVND(Number(so.totalAmount))}</span>
                                                    <a href={`/dashboard/sales?search=${so.soNo}`} className="text-[11px] text-[#87CBB9] hover:underline font-semibold">
                                                        Xem SO →
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

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

                        {/* Approval Audit Trail Table */}
                        <div className="p-4 rounded-xl border border-[#2A4355] bg-[#1B2E3D] space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#87CBB9] flex items-center justify-between">
                                <span>📋 Tiến Trình Duyệt Hệ Thống (Digital Audit Trail)</span>
                                <span className="text-[10px] font-mono text-[#8AAEBB] bg-[#142433] px-2 py-0.5 rounded border border-[#2A4355]">3 Cấp Phê Duyệt</span>
                            </p>
                            
                            <div className="overflow-x-auto rounded-lg border border-[#2A4355]">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-[#142433] text-[#8AAEBB] uppercase text-[10px] font-bold border-b border-[#2A4355]">
                                        <tr>
                                            <th className="p-2.5 text-center w-10">STT</th>
                                            <th className="p-2.5">Cấp Duyệt / Vai Trò</th>
                                            <th className="p-2.5">Người Thực Hiện</th>
                                            <th className="p-2.5 text-center">Trạng Thái</th>
                                            <th className="p-2.5 text-center">Thời Gian</th>
                                            <th className="p-2.5">Ghi Chú / Ý Kiến</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#2A4355]/60 text-[#E8F1F2]">
                                        {/* Step 0: Creator */}
                                        <tr className="hover:bg-[#142433]/50">
                                            <td className="p-2.5 text-center font-mono text-gray-400">1</td>
                                            <td className="p-2.5 font-medium text-[#8AAEBB] whitespace-nowrap">Người Lập Tờ Trình</td>
                                            <td className="p-2.5 font-bold text-[#E8F1F2] whitespace-nowrap">{detail.creator?.name || '—'}</td>
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                    ✓ Đã lập & trình
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-center text-gray-400 font-mono text-[11px] whitespace-nowrap">
                                                {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString('vi-VN') : (detail.createdAt ? new Date(detail.createdAt).toLocaleString('vi-VN') : '—')}
                                            </td>
                                            <td className="p-2.5 italic text-gray-400 text-[11px]">Khởi tạo tờ trình</td>
                                        </tr>

                                        {/* Steps 1-3 */}
                                        {[
                                            { level: 1, label: 'Cấp 1: Trưởng Bộ Phận' },
                                            { level: 2, label: 'Cấp 2: Kế Toán Trưởng' },
                                            { level: 3, label: 'Cấp 3: Tổng Giám Đốc (CEO)' },
                                        ].map((step, idx) => {
                                            const log = detail.approvalLogs.find(l => l.level === step.level)
                                            return (
                                                <tr key={step.level} className="hover:bg-[#142433]/50">
                                                    <td className="p-2.5 text-center font-mono text-gray-400">{idx + 2}</td>
                                                    <td className="p-2.5 font-medium text-[#8AAEBB] whitespace-nowrap">{step.label}</td>
                                                    <td className="p-2.5 font-bold text-[#E8F1F2] whitespace-nowrap">{log?.approver?.name || '—'}</td>
                                                    <td className="p-2.5 text-center whitespace-nowrap">
                                                        {log ? (
                                                            log.action === 'APPROVE' ? (
                                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                                    ✓ Đã duyệt
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                                                    ✗ Từ chối
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/40 text-gray-400 border border-gray-600/30 whitespace-nowrap">
                                                                ⏳ Chưa duyệt
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-center text-gray-400 font-mono text-[11px] whitespace-nowrap">
                                                        {log ? new Date(log.createdAt).toLocaleString('vi-VN') : '—'}
                                                    </td>
                                                    <td className="p-2.5 italic text-gray-300 text-[11px]">
                                                        {log?.comment ? `"${log.comment}"` : '—'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

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

                        {/* Action Bar */}
                        {canApproveDetail && (
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
