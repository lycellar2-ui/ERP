'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    FileText, Plus, X, Search, Send, CheckCircle2, XCircle, RotateCcw,
    Clock, AlertCircle, Loader2, MessageSquare, Paperclip, ChevronDown,
    Filter, Eye, ArrowRight, ClipboardCheck, Printer, Trash2, Check,
} from 'lucide-react'
import {
    createProposal, submitProposal, processProposalApproval, addProposalComment,
    getProposalDetail, updateProposalStatus, getProposals,
} from './actions'
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, getCategoryLabel, getPriorityLabel, getStatusLabel } from './constants'
import { PROPOSALS_I18N, formatBilingualTitle } from './i18n'
import { useAppLocale, type AppLocale } from '@/lib/i18n'
import { formatVND } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getCustomersForSO, getProductsWithStock } from '../sales/actions'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

function formatCompactVND(amount: number, locale: AppLocale = 'vi'): string {
    if (amount >= 1_000_000_000) {
        const val = amount / 1_000_000_000
        return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} ${locale === 'en' ? 'B' : 'tỷ'}`
    }
    if (locale === 'en' && amount >= 1_000_000) {
        const val = amount / 1_000_000
        return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} M`
    }
    return formatVND(amount)
}

type Proposal = Awaited<ReturnType<typeof import('./actions').getProposals>>[number]
type ProposalDetail = NonNullable<Awaited<ReturnType<typeof import('./actions').getProposalDetail>>>

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#0F172A',
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
    const { locale } = useAppLocale()
    const t = PROPOSALS_I18N[locale] || PROPOSALS_I18N.vi

    const [proposals, setProposals] = useState(initialProposals)
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'DRAFT' | 'APPROVED' | 'REJECTED'>('ALL')
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
    const [priorityFilter, setPriorityFilter] = useState<string>('ALL')
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detail, setDetail] = useState<ProposalDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // Sync state if server initialProposals updates
    useEffect(() => {
        setProposals(initialProposals)
    }, [initialProposals])

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
        const isEn = locale === 'en'
        switch (cat) {
            case 'TASTING':
                return { label: isEn ? '🍷 Tasting (Sample)' : '🍷 Tasting (Thử Rượu)', bg: 'rgba(212,168,83,0.15)', color: '#D4A853', border: 'rgba(212,168,83,0.3)' }
            case 'SPECIAL_EVENT':
                return { label: isEn ? '🎪 Special Event' : '🎪 Sự Kiện / Event', bg: 'rgba(180,140,210,0.15)', color: '#B48CD2', border: 'rgba(180,140,210,0.3)' }
            case 'PRICE_ADJUSTMENT':
                return { label: isEn ? '🏷️ Special Pricing' : '🏷️ Cơ Chế Giá & Giá Đặc Biệt', bg: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: 'rgba(74,143,171,0.3)' }
            case 'BUDGET_REQUEST':
                return { label: isEn ? '💰 Budget Request' : '💰 Xin Ngân Sách', bg: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: 'rgba(8, 145, 178, 0.25)' }
            case 'CAPITAL_EXPENDITURE':
                return { label: isEn ? '🏢 CAPEX' : '🏢 Mua Sắm TSCĐ', bg: 'rgba(180,140,210,0.15)', color: '#B48CD2', border: 'rgba(180,140,210,0.3)' }
            case 'NEW_SUPPLIER':
                return { label: isEn ? '🤝 New Supplier' : '🤝 NCC Mới', bg: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: 'rgba(91,168,138,0.3)' }
            case 'NEW_PRODUCT':
                return { label: isEn ? '📦 New Product' : '📦 Sản Phẩm Mới', bg: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: 'rgba(91,168,138,0.3)' }
            case 'POLICY_CHANGE':
                return { label: isEn ? '📋 Policy Change' : '📋 Đổi Quy Trình', bg: 'rgba(224,140,80,0.15)', color: '#E08C50', border: 'rgba(224,140,80,0.3)' }
            case 'PAYMENT_SCHEDULE':
                return { label: isEn ? '📅 Payment Schedule' : '📅 Lịch Thanh Toán', bg: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: 'rgba(74,143,171,0.3)' }
            case 'PROMOTION_CAMPAIGN':
                return { label: isEn ? '🎁 Promotion' : '🎁 Khuyến Mãi', bg: 'rgba(212,168,83,0.15)', color: '#D4A853', border: 'rgba(212,168,83,0.3)' }
            default:
                return { label: getCategoryLabel(cat, locale), bg: 'rgba(74,106,122,0.15)', color: '#475569', border: 'rgba(74,106,122,0.3)' }
        }
    }, [locale])

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

        if (priorityFilter !== 'ALL' && p.priority !== priorityFilter) return false

        if (search) {
            const s = search.toLowerCase()
            return p.proposalNo.toLowerCase().includes(s) ||
                p.title.toLowerCase().includes(s) ||
                p.creatorName.toLowerCase().includes(s)
        }
        return true
    })

    const refreshList = useCallback(async () => {
        try {
            const data = await getProposals()
            setProposals(data)
        } catch (err) {
            console.error('Failed to refresh proposals:', err)
        }
    }, [])

    // Realtime Supabase Database Listener for live proposals updates
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel('realtime_proposals_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'proposals',
                },
                () => {
                    refreshList().catch(() => {})
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [refreshList])

    const openDetail = useCallback(async (id: string) => {
        setDetailId(id)
        setLoading(true)
        const d = await getProposalDetail(id)
        setDetail(d)
        setLoading(false)
    }, [])

    const handleSubmitProposal = useCallback(async (proposalId: string) => {
        setActionLoading(proposalId)
        const prevProposals = proposals
        const prevDetail = detail

        // Optimistic UI update immediately
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'SUBMITTED' } : p))
        if (detail && detail.id === proposalId) {
            setDetail(prev => prev ? { ...prev, status: 'SUBMITTED' } : null)
        }

        try {
            const res = await submitProposal(proposalId, userId)
            if (res.success) {
                toast.success('Đã trình tờ trình phê duyệt thành công!')
                await refreshList()
                if (detailId === proposalId) {
                    await openDetail(proposalId)
                }
            } else {
                setProposals(prevProposals)
                setDetail(prevDetail)
                toast.error(res.error || 'Không thể trình tờ trình')
            }
        } catch (err: any) {
            setProposals(prevProposals)
            setDetail(prevDetail)
            toast.error(err.message || 'Lỗi hệ thống khi trình tờ trình')
        } finally {
            setActionLoading(null)
        }
    }, [userId, proposals, detail, detailId, refreshList, openDetail])

    const handleApproval = useCallback(async (proposalId: string, action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => {
        setActionLoading(proposalId)
        const prevProposals = proposals
        const prevDetail = detail

        // Determine optimistic target status
        const targetProposal = proposals.find(p => p.id === proposalId)
        let optimisticStatus: any = 'APPROVED'
        if (action === 'REJECT') optimisticStatus = 'REJECTED'
        else if (action === 'RETURN') optimisticStatus = 'RETURNED'
        else {
            if (isCEO || (targetProposal && targetProposal.currentLevel >= 3)) {
                optimisticStatus = 'APPROVED'
            } else if (targetProposal) {
                optimisticStatus = `APPROVED_L${targetProposal.currentLevel}`
            }
        }

        // 1. Optimistically update UI immediately (0ms delay)
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: optimisticStatus as Proposal['status'] } : p))
        if (detail && detail.id === proposalId) {
            setDetail(prev => prev ? { ...prev, status: optimisticStatus as ProposalDetail['status'] } : null)
        }

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

                if (result.newStatus) {
                    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: result.newStatus as Proposal['status'] } : p))
                    if (detailId === proposalId) {
                        setDetail(prev => prev ? { ...prev, status: result.newStatus as ProposalDetail['status'] } : null)
                    }
                }

                await refreshList()
                if (detailId === proposalId) {
                    await openDetail(proposalId)
                }
            } else {
                // Rollback on error
                setProposals(prevProposals)
                setDetail(prevDetail)
                toast.error(result.error || 'Lỗi khi xử lý phê duyệt')
            }
        } catch (err: any) {
            // Rollback on error
            setProposals(prevProposals)
            setDetail(prevDetail)
            toast.error(err.message || 'Lỗi hệ thống')
        } finally {
            setActionLoading(null)
        }
    }, [userId, isCEO, proposals, detail, detailId, refreshList, openDetail])

    const handlePrint = useCallback((lang: 'BILINGUAL' | 'VI' | 'EN' = 'BILINGUAL') => {
        if (!detail) return
        const printWindow = window.open('', '_blank')
        if (!printWindow) return alert('Hãy cấp quyền mở popup trên trình duyệt của bạn')

        const isTasting = detail.category === 'TASTING' || detail.category === 'SPECIAL_EVENT'
        const isPriceAdjustment = detail.category === 'PRICE_ADJUSTMENT'

        let titleVi = detail.title || ''
        let titleEn = ''
        if (detail.title && detail.title.includes(' / ')) {
            const parts = detail.title.split(' / ')
            titleVi = parts[0].trim()
            titleEn = parts.slice(1).join(' / ').trim()
        }

        const catRaw = CATEGORY_LABELS[detail.category] || detail.category
        const catClean = catRaw.replace(/^[^\w\s\u00C0-\u1EF9]+/, '').trim().toUpperCase()
        const docTitleVi = isPriceAdjustment ? 'TỜ TRÌNH CƠ CHẾ GIÁ & GIÁ ĐẶC BIỆT' : `TỜ TRÌNH ${catClean}`
        const docTitleEn = isPriceAdjustment ? 'PROPOSAL FOR SPECIAL PRICING MECHANISM & COMMERCIAL POLICY'
            : detail.category === 'BUDGET_REQUEST' ? 'BUDGET ALLOCATION PROPOSAL'
            : detail.category === 'CAPITAL_EXPENDITURE' ? 'CAPITAL EXPENDITURE PROPOSAL'
            : detail.category === 'NEW_SUPPLIER' ? 'NEW SUPPLIER PROPOSAL'
            : detail.category === 'NEW_PRODUCT' ? 'NEW PRODUCT PROPOSAL'
            : detail.category === 'POLICY_CHANGE' ? 'POLICY CHANGE PROPOSAL'
            : detail.category === 'STAFF_REQUISITION' ? 'STAFF REQUISITION PROPOSAL'
            : detail.category === 'PAYMENT_SCHEDULE' ? 'PAYMENT SCHEDULE PROPOSAL'
            : detail.category === 'PROMOTION_CAMPAIGN' ? 'MARKETING & PROMOTION PROPOSAL'
            : detail.category === 'CONTRACT_SIGNING' ? 'CONTRACT EXECUTION PROPOSAL'
            : `OFFICIAL SUBMISSION PROPOSAL — ${detail.category.replace(/_/g, ' ')}`

        const scopeTextVi = 
            detail.scope?.startsWith('ENTIRE_PORTFOLIO') ? 'Chiết khấu toàn bộ danh mục sản phẩm' :
            detail.scope?.startsWith('SPECIFIC_PRODUCTS') ? 'Áp dụng cho một số sản phẩm cụ thể' :
            detail.scope?.startsWith('MIXED') ? 'Kết hợp chiết khấu danh mục và giá riêng cho một số sản phẩm' : 'N/A'

        const scopeTextEn = 
            detail.scope?.startsWith('ENTIRE_PORTFOLIO') ? 'Overall discount across entire portfolio' :
            detail.scope?.startsWith('SPECIFIC_PRODUCTS') ? 'Special pricing on specific SKUs' :
            detail.scope?.startsWith('MIXED') ? 'Mixed (Portfolio discount + Specific SKU pricing)' : 'N/A'

        const scopeText = lang === 'VI' ? scopeTextVi : lang === 'EN' ? scopeTextEn : `${scopeTextVi} / ${scopeTextEn}`

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
        const dateVi = `Hà Nội, ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`
        const dateEn = `Hanoi, ${dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}`
        const dateStr = lang === 'VI' ? dateVi : lang === 'EN' ? dateEn : `${dateVi} | ${dateEn}`
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
                            <div style="font-size: 9pt; color: #333; margin-top: 4px; white-space: nowrap;">
                                ${lang === 'VI' ? `Ngày xuất: ${exportDateStr}` : lang === 'EN' ? `Issue Date: ${exportDateStr}` : `Ngày xuất / Date: ${exportDateStr}`}
                            </div>
                        </td>
                    ` : ''

                    const unitText = lang === 'VI' ? 'Chai' : lang === 'EN' ? 'Bottle' : 'Chai/Btl'
                    const purposeText = lang === 'VI' 
                        ? 'Xuất hàng dùng thử cho khách hàng' 
                        : lang === 'EN' 
                        ? 'Free tasting sample for customer' 
                        : 'Xuất hàng dùng thử cho KH / Free tasting sample'

                    return `
                        <tr>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; white-space: nowrap;">${i + 1}</td>
                            ${customerAndDateTd}
                            <td style="border: 1px solid #000; padding: 5px 3px; font-family: monospace; font-weight: bold; text-align: center; white-space: nowrap;">${item.product?.skuCode || ''}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; font-weight: bold; word-break: normal; overflow-wrap: break-word;">${item.product?.productName || ''}</td>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; white-space: nowrap;">${unitText}</td>
                            <td style="border: 1px solid #000; padding: 5px 3px; text-align: center; font-weight: bold; white-space: nowrap;">${qty}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; text-align: right; white-space: nowrap;">${formatVNDPrint(wholesale)}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; text-align: right; font-weight: bold; white-space: nowrap;">${formatVNDPrint(lineTotal)}</td>
                            <td style="border: 1px solid #000; padding: 5px 4px; font-size: 9pt; word-break: normal; overflow-wrap: break-word;">${purposeText}</td>
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
                        <td style="border: 1px solid #000; padding: 6px 4px; word-break: normal; overflow-wrap: break-word; font-weight: 500;">${item.product?.productName || ''}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; white-space: nowrap;">${qty}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; white-space: nowrap;">${formatVNDPrint(wholesale)}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: right; font-weight: bold; white-space: nowrap; color: #0891B2;">${formatVNDPrint(item.proposedPrice)}</td>
                        <td style="border: 1px solid #000; padding: 6px 4px; text-align: center; font-weight: bold; white-space: nowrap; color: ${diff < 0 ? '#b91c1c' : '#15803d'};">
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
                    .doc-subtitle { font-size: 10.5pt; font-weight: normal; text-align: center; margin-bottom: 18px; line-height: 1.3; }
                    .kinh-gui { font-size: 11pt; margin-bottom: 6px; }
                    .can-cu { font-size: 10.5pt; margin-bottom: 10px; line-height: 1.4; }
                    .can-cu p { margin: 2px 0; }
                    .trinh-bay { font-size: 10.5pt; margin-bottom: 8px; line-height: 1.4; }
                    .ghi-chu { font-size: 10pt; font-style: italic; margin-bottom: 12px; line-height: 1.4; color: #333; }
                    
                    /* Exact Excel Table Layout */
                    .excel-table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 10px; font-size: 9.5pt; table-layout: fixed; }
                    .excel-table th { border: 1px solid #000; padding: 5px 2px; background-color: #ffffff; text-align: center; font-weight: bold; vertical-align: middle; word-break: keep-all; }
                    .excel-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: middle; word-break: normal; overflow-wrap: break-word; }
                    
                    .summary-section { font-size: 10pt; margin-top: 8px; margin-bottom: 12px; line-height: 1.5; }
                    .summary-row-bold { font-weight: bold; }
                    
                    .legal-box { font-size: 8.5pt; font-style: italic; margin-top: 10px; margin-bottom: 15px; line-height: 1.35; text-align: justify; }
                    .legal-box p { margin: 4px 0; }
                    
                    .date-line { text-align: right; font-size: 10pt; margin-bottom: 15px; }
                    
                    .signatures-table { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid; table-layout: fixed; }
                    .signatures-table td { text-align: center; vertical-align: top; border: none; padding: 2px; }
                    .sign-title { font-weight: bold; font-size: 10pt; }
                    .sign-sub { font-size: 8.5pt; font-style: italic; color: #333; margin-bottom: 45px; }
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
                            <p style="margin: 0; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN</p>
                            ${lang !== 'VI' ? '<p style="margin: 1px 0 0 0; font-size: 9pt; font-weight: 600; color: #334155;">THANG AN TRADING JOINT STOCK COMPANY</p>' : ''}
                            <p style="margin: 2px 0 0 0; font-size: 9pt; color: #475569;">10/52 Giang Văn Minh - P.Ba Đình - TP.Hà Nội</p>
                            <p style="margin: 1px 0 0 0; font-size: 9pt; color: #475569;">Tel: 0813239933</p>
                        </td>
                        <td style="width: 45%; text-align: right; vertical-align: top;">
                            <p style="margin: 0; font-size: 10pt; font-style: italic;">
                                ${lang === 'VI' ? `Số: ${detail.proposalNo}/TT-KD-TA` : lang === 'EN' ? `Ref. No.: ${detail.proposalNo}/TT-KD-TA` : `Số / Ref. No.: ${detail.proposalNo}/TT-KD-TA`}
                            </p>
                            <p style="margin: 3px 0 0 0; font-size: 9pt; color: #475569;">${dateStr}</p>
                        </td>
                    </tr>
                </table>

                <!-- Main Title -->
                <div class="doc-title">${lang === 'EN' ? 'SUBMISSION FOR FREE WINE-TASTING SAMPLES' : 'TỜ TRÌNH XUẤT HÀNG MẪU RƯỢU'}</div>
                ${lang === 'BILINGUAL' ? '<div style="font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; color: #334155; margin-bottom: 3px;">SUBMISSION FOR FREE WINE-TASTING SAMPLES</div>' : ''}
                <div class="doc-subtitle">
                    ${lang === 'VI' ? `(V/v: Phê duyệt xuất hàng mẫu rượu không thu tiền cho khách hàng HoReCa${titleVi ? ` — ${titleVi}` : ''})` :
                      lang === 'EN' ? `(Re: Approval for issuing free wine-tasting samples to HoReCa customer${titleEn || titleVi ? ` — ${titleEn || titleVi}` : ''})` :
                      `(V/v: Phê duyệt xuất hàng mẫu rượu không thu tiền cho khách hàng HoReCa${titleVi ? ` — ${titleVi}` : ''} /<br/>Approval for issuing free wine-tasting samples to HoReCa customer${titleEn ? ` — ${titleEn}` : ''})`}
                </div>

                <!-- Recipient & Basis -->
                <div class="kinh-gui">
                    <strong>${lang === 'VI' ? 'Kính gửi:' : lang === 'EN' ? 'To:' : 'Kính gửi / To:'} </strong>
                    <strong>${lang === 'VI' ? 'Ban Lãnh Đạo' : lang === 'EN' ? 'The Board of Directors' : 'Ban Lãnh Đạo / The Board of Directors'}</strong>
                </div>

                <div class="can-cu">
                    ${lang === 'VI' ? `
                        <p>- Căn cứ: Quyền hạn và trách nhiệm của Phòng Kinh doanh</p>
                        <p>- Căn cứ nhu cầu giới thiệu, cho khách hàng dùng thử sản phẩm</p>
                        <p>- Căn cứ Ngân sách hàng mẫu đã được phê duyệt theo kỳ của Công ty (nếu có)</p>
                    ` : lang === 'EN' ? `
                        <p>- Based on: Authority and responsibilities of the Sales Department</p>
                        <p>- Based on: Customer wine-tasting demand and product presentation requirements</p>
                        <p>- Based on: Approved corporate tasting sample budget for the period (if any)</p>
                    ` : `
                        <p>- Căn cứ: Quyền hạn và trách nhiệm của Phòng Kinh doanh / Based on: Authority and responsibilities of the Sales Department</p>
                        <p>- Căn cứ nhu cầu giới thiệu, cho khách hàng dùng thử sản phẩm / Based on: Customer wine-tasting demand and product presentation</p>
                        <p>- Căn cứ Ngân sách hàng mẫu đã được phê duyệt theo kỳ của Công ty (nếu có) / Based on: Approved company sample budget for the period (if any)</p>
                    `}
                </div>

                <!-- Statement -->
                <div class="trinh-bay">
                    ${lang === 'VI' ? `
                        <p style="margin: 0;">Phòng Kinh doanh kính trình Ban Lãnh đạo phê duyệt xuất hàng mẫu không thu tiền cho khách hàng, cụ thể như sau:</p>
                    ` : lang === 'EN' ? `
                        <p style="margin: 0;">The Sales Department respectfully submits to the Board of Directors for approval of issuing free wine-tasting samples to the customer, as follows:</p>
                    ` : `
                        <p style="margin: 0;">Phòng Kinh doanh kính trình Ban Lãnh đạo phê duyệt xuất hàng mẫu không thu tiền cho khách hàng, cụ thể như sau:</p>
                        <p style="margin: 2px 0 0 0; color: #334155;">The Sales Department respectfully submits to the Board of Directors for approval of free wine-tasting samples for the customer, as follows:</p>
                    `}
                </div>

                <!-- Note -->
                <div class="ghi-chu">
                    ${lang === 'VI' ? `
                        Ghi chú: Giá bán cho khách hàng = 0 đồng (hàng mẫu không thu tiền). "Đơn giá tham khảo" dưới đây chỉ phục vụ mục đích quản lý nội bộ (theo dõi giá vốn/ngân sách hàng mẫu), không phải giá tính thuế GTGT.
                    ` : lang === 'EN' ? `
                        Note: Selling price to customer = 0 VND (free tasting samples). "Ref. unit cost" below is for internal management only (tracking COGS/budget), not VAT taxable value.
                    ` : `
                        Ghi chú / Note: Giá bán cho khách hàng = 0 đồng (hàng mẫu không thu tiền) / Selling price to customer = 0 VND. "Đơn giá tham khảo" dưới đây chỉ phục vụ mục đích quản lý nội bộ (theo dõi giá vốn/ngân sách), không phải giá tính thuế GTGT / "Ref. unit cost" is for internal tracking only, not VAT taxable price.
                    `}
                </div>

                <!-- Product Table with Exact Excel Widths -->
                <table class="excel-table">
                    <thead>
                        <tr>
                            <th style="width: 4%; white-space: nowrap;">${lang === 'VI' ? 'STT' : lang === 'EN' ? 'No.' : 'STT<br/>No.'}</th>
                            <th style="width: 22%;">${lang === 'VI' ? 'Khách hàng & Ngày xuất' : lang === 'EN' ? 'Customer & Date' : 'Khách hàng & Ngày xuất<br/>Customer & Date'}</th>
                            <th style="width: 9%; white-space: nowrap;">${lang === 'VI' ? 'Mã hàng' : lang === 'EN' ? 'Item Code' : 'Mã hàng<br/>Item Code'}</th>
                            <th style="width: 23%;">${lang === 'VI' ? 'Tên hàng' : lang === 'EN' ? 'Product Name' : 'Tên hàng<br/>Product Name'}</th>
                            <th style="width: 5%; white-space: nowrap;">${lang === 'VI' ? 'ĐVT' : lang === 'EN' ? 'Unit' : 'ĐVT<br/>Unit'}</th>
                            <th style="width: 4%; white-space: nowrap;">${lang === 'VI' ? 'SL' : lang === 'EN' ? 'Qty' : 'SL<br/>Qty'}</th>
                            <th style="width: 11%;">${lang === 'VI' ? 'Đơn giá<br/>tham khảo' : lang === 'EN' ? 'Ref. unit<br/>cost' : 'Đơn giá tham khảo<br/><span style="font-size: 8pt; font-weight: normal;">Ref. unit cost</span>'}</th>
                            <th style="width: 11%;">${lang === 'VI' ? 'Thành tiền<br/>tham khảo' : lang === 'EN' ? 'Ref. total<br/>value' : 'Thành tiền tham khảo<br/><span style="font-size: 8pt; font-weight: normal;">Ref. total value</span>'}</th>
                            <th style="width: 11%;">${lang === 'VI' ? 'Mục đích / Lý do' : lang === 'EN' ? 'Purpose / Reason' : 'Mục đích / Lý do<br/>Purpose / Reason'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>

                <!-- Summary Section -->
                <div class="summary-section">
                    <p class="summary-row-bold" style="margin: 3px 0;">
                        ${lang === 'VI' ? 'Tổng giá trị tham khảo hàng mẫu (kỳ này):' : lang === 'EN' ? 'Total reference sample value (this period):' : 'Tổng giá trị tham khảo hàng mẫu (kỳ này) / Total reference value (this period):'}
                        <span style="float: right; margin-right: 2%; white-space: nowrap;">${formatVNDPrint(totalRefValue)}</span>
                    </p>
                    <p style="margin: 3px 0;">
                        ${lang === 'VI' ? 'Ngân sách hàng mẫu đã duyệt cho kỳ này:' : lang === 'EN' ? 'Approved sample budget for this period:' : 'Ngân sách hàng mẫu đã duyệt cho kỳ này / Approved sample budget for this period:'}
                    </p>
                    <p class="summary-row-bold" style="margin: 3px 0;">
                        ${lang === 'VI' ? 'Ngân sách còn lại sau đề nghị này:' : lang === 'EN' ? 'Remaining budget after this request:' : 'Ngân sách còn lại sau đề nghị này / Remaining budget after this request:'}
                    </p>
                </div>

                <!-- Legal Box -->
                <div class="legal-box">
                    <p><strong>${lang === 'VI' ? 'Thẩm quyền phê duyệt' : lang === 'EN' ? 'Approval Authority' : 'Thẩm quyền phê duyệt / Approval authority'}:</strong><br/>
                    ${lang === 'VI' ? 
                        '- Giá trị tham khảo ≤ hạn mức quy định: Quản lý Kinh doanh (CBO - Sales Manager) phê duyệt.<br/>- Vượt hạn mức hoặc vượt ngân sách: Trình Ban Lãnh đạo phê duyệt.' :
                        lang === 'EN' ?
                        '- Reference value within threshold: Approved by CBO - Sales Manager.<br/>- Exceeding threshold or budget: Submitted to Board of Directors for approval.' :
                        '- Giá trị tham khảo ≤ hạn mức / Within threshold: Quản lý Kinh doanh (CBO - Sales Manager) phê duyệt.<br/>- Vượt hạn mức hoặc ngân sách / Beyond threshold or budget: Trình Ban Lãnh đạo phê duyệt / Board of Directors.'}
                    </p>
                    
                    <p><strong>${lang === 'VI' ? 'Lưu ý pháp lý' : lang === 'EN' ? 'Legal Notes' : 'Lưu ý pháp lý / Legal note'}:</strong> (1) Hàng mẫu để khách hàng dùng thử không thu tiền có giá tính thuế GTGT = 0 theo Khoản 2 Điều 6 Nghị định 181/2025/NĐ-CP, nhưng vẫn bắt buộc phải lập hóa đơn điện tử ghi rõ dòng chữ "Hàng mẫu không thu tiền" theo Khoản 1 Điều 4 (được sửa đổi bởi Nghị định 70/2025/NĐ-CP) và Điều 10 Nghị định 123/2020/NĐ-CP; không xuất hóa đơn có thể bị xử phạt theo Nghị định 125/2020/NĐ-CP. (2) "Đơn giá tham khảo" trong bảng trên chỉ phục vụ quản lý nội bộ (giá vốn/ngân sách), không phải giá tính thuế. (3) Để chi phí hàng mẫu được ghi nhận là chi phí hợp lý, hợp lệ khi xác định thu nhập chịu thuế TNDN, cần lưu đầy đủ: tờ trình đã duyệt, hóa đơn xuất hàng mẫu, và xác nhận đã giao hàng cho khách hàng (mục ký nhận bên dưới).<br/>
                    ${lang !== 'VI' ? '<span style="font-size: 8pt; color: #475569;"><em>(English summary: Free tasting samples carry zero VAT output tax under Art. 6.2 Decree 181/2025/ND-CP, but e-invoice stating "Free samples" is mandatory per Decree 70/2025/ND-CP & Decree 123/2020/ND-CP. Keep approved proposal, e-invoice, and handover confirmation for corporate income tax deductibility).</em></span>' : ''}
                    </p>
                </div>

                <!-- Signatures Grid -->
                <table class="signatures-table">
                    <tr>
                        <td style="width: 30%;">
                            <div class="sign-title">${lang === 'VI' ? 'Vận hành' : lang === 'EN' ? 'Operations' : 'Vận hành / Operations'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Ký, ghi rõ họ tên)' : lang === 'EN' ? '(Signature & full name)' : '(Ký & họ tên / Full name)'}</div>
                            <div style="margin-bottom: 45px;"></div>
                        </td>
                        <td style="width: 35%;">
                            <div class="sign-title">${lang === 'VI' ? 'Quản lý Kinh doanh' : lang === 'EN' ? 'CBO - Sales Manager' : 'Quản lý Kinh doanh / CBO - Sales Manager'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Xác nhận & Ký tên)' : lang === 'EN' ? '(Reviewed & signed)' : '(Xác nhận & ký tên / Reviewed & signed)'}</div>
                            <div style="margin-bottom: 45px;"></div>
                        </td>
                        <td style="width: 35%;">
                            <div class="sign-title">${lang === 'VI' ? 'Nhân Viên Kinh doanh' : lang === 'EN' ? 'Sales Executive' : 'Nhân Viên Kinh doanh / Sales Executive'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Người lập tờ trình)' : lang === 'EN' ? '(Submitter)' : '(Người lập / Submitter)'}</div>
                            <div style="margin-bottom: 45px;"></div>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3" style="padding-top: 20px;">
                            <div class="sign-title">${lang === 'VI' ? 'Ban Lãnh đạo' : lang === 'EN' ? 'Board of Directors' : 'Ban Lãnh đạo / Board of Directors'}</div>
                            <div style="font-size: 8.5pt; font-style: italic; color: #475569;">
                                ${lang === 'VI' ? '(Trường hợp vượt thẩm quyền Quản lý Kinh doanh hoặc vượt ngân sách)' :
                                  lang === 'EN' ? '(In case beyond the Sales Manager authority or budget)' :
                                  '(Trường hợp vượt thẩm quyền Quản lý Kinh doanh hoặc vượt ngân sách / In case beyond Sales Manager authority or budget)'}
                            </div>
                            <div style="margin-bottom: 40px;"></div>
                        </td>
                    </tr>
                </table>

                <!-- Digital Approval Audit Trail Table Below -->
                <div style="margin-top: 25px; page-break-inside: avoid;">
                    <div style="font-size: 11pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <span style="text-transform: uppercase;">
                            ${lang === 'VI' ? 'V. Tiến Trình Phê Duyệt Hệ Thống' : lang === 'EN' ? 'V. Digital Approval Audit Trail' : 'V. Tiến Trình Phê Duyệt Hệ Thống (Digital Audit Trail)'}
                        </span>
                        <span style="font-size: 9pt; font-weight: normal; color: #222;">
                            <strong>${lang === 'VI' ? 'Số Tờ Trình:' : lang === 'EN' ? 'Ref. No.:' : 'Số Tờ Trình / No.:'}</strong> <span style="font-family: monospace; font-weight: bold;">${detail.proposalNo}</span>
                            &nbsp;|&nbsp;
                            <strong>${lang === 'VI' ? 'Loại:' : lang === 'EN' ? 'Category:' : 'Loại / Category:'}</strong> ${CATEGORY_LABELS[detail.category] || detail.category}
                        </span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
                        <thead>
                            <tr style="background-color: #f8f9fa;">
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 40px;">${lang === 'VI' ? 'STT' : lang === 'EN' ? 'No.' : 'STT<br/>No.'}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left; width: 150px;">${lang === 'VI' ? 'Cấp Duyệt / Vai Trò' : lang === 'EN' ? 'Level / Role' : 'Cấp Duyệt / Vai Trò<br/>Level & Role'}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${lang === 'VI' ? 'Người Thực Hiện' : lang === 'EN' ? 'Performed By' : 'Người Thực Hiện / Performed By'}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 120px;">${lang === 'VI' ? 'Trạng Thái' : lang === 'EN' ? 'Status' : 'Trạng Thái / Status'}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: center; width: 140px;">${lang === 'VI' ? 'Thời Gian' : lang === 'EN' ? 'Timestamp' : 'Thời Gian / Timestamp'}</th>
                                <th style="border: 1px solid #000; padding: 5px; text-align: left;">${lang === 'VI' ? 'Ghi Chú / Ý Kiến' : lang === 'EN' ? 'Comments' : 'Ghi Chú / Comments'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">1</td>
                                <td style="border: 1px solid #000; padding: 5px;">${lang === 'VI' ? 'Người lập tờ trình' : lang === 'EN' ? 'Proposal Submitter' : 'Người lập tờ trình / Submitter'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${detail.creator?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: #1b5e20;">${lang === 'VI' ? '✓ Đã lập & trình' : lang === 'EN' ? '✓ Submitted' : '✓ Đã lập & trình / Submitted'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">${lang === 'VI' ? 'Khởi tạo tờ trình' : lang === 'EN' ? 'Initial submission' : 'Khởi tạo tờ trình / Initial submission'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">2</td>
                                <td style="border: 1px solid #000; padding: 5px;">${lang === 'VI' ? 'Quản lý Kinh doanh' : lang === 'EN' ? 'Sales Manager (CBO)' : 'Quản lý Kinh doanh / Sales Manager'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${l1Log?.approver?.name || 'Jeremie Courivault'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: ${l1Log ? (l1Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l1Log ? (l1Log.action === 'APPROVE' ? (lang === 'VI' ? '✓ Đã duyệt' : lang === 'EN' ? '✓ Approved' : '✓ Đã duyệt / Approved') : (lang === 'VI' ? '✗ Từ chối' : lang === 'EN' ? '✗ Rejected' : '✗ Từ chối / Rejected')) : (lang === 'VI' ? '⏳ Chưa duyệt' : lang === 'EN' ? '⏳ Pending' : '⏳ Chưa duyệt / Pending')}
                                </td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${l1SignedAt || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">${l1Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">3</td>
                                <td style="border: 1px solid #000; padding: 5px;">${lang === 'VI' ? 'Vận hành' : lang === 'EN' ? 'Operations' : 'Vận hành / Operations'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">Trần Hữu Chiến</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: #1b5e20;">${lang === 'VI' ? '✓ Đã xác nhận' : lang === 'EN' ? '✓ Confirmed' : '✓ Đã xác nhận / Confirmed'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-style: italic;">${lang === 'VI' ? 'Xác nhận vận hành' : lang === 'EN' ? 'Operation verification' : 'Xác nhận vận hành / Operation verification'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center;">4</td>
                                <td style="border: 1px solid #000; padding: 5px;">${lang === 'VI' ? 'Ban Lãnh đạo' : lang === 'EN' ? 'Board of Directors' : 'Ban Lãnh đạo / Board of Directors'}</td>
                                <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${l3Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; color: ${l3Log ? (l3Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l3Log ? (l3Log.action === 'APPROVE' ? (lang === 'VI' ? '✓ Đã phê duyệt' : lang === 'EN' ? '✓ Approved' : '✓ Đã phê duyệt / Approved') : (lang === 'VI' ? '✗ Từ chối' : lang === 'EN' ? '✗ Rejected' : '✗ Từ chối / Rejected')) : (lang === 'VI' ? '⏳ Chưa phê duyệt' : lang === 'EN' ? '⏳ Pending' : '⏳ Chưa phê duyệt / Pending')}
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
                    @page { size: A4 portrait; margin: 12mm 10mm 12mm 10mm; }
                    body { font-family: Calibri, Arial, sans-serif; color: #000; margin: 0; padding: 0; font-size: 11pt; line-height: 1.4; }
                    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                    .header-table td { border: none; padding: 0; vertical-align: top; }
                    .title { font-size: 16pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 15px; margin-bottom: 2px; }
                    .subtitle { text-align: center; font-size: 10.5pt; margin-bottom: 18px; font-style: italic; }
                    .info-section { margin-bottom: 12px; }
                    .info-section p { margin: 3px 0; }
                    .content-section { margin-top: 15px; margin-bottom: 15px; }
                    .content-title { font-weight: bold; font-size: 11.5pt; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
                    .content-body { padding-left: 12px; white-space: pre-wrap; word-break: break-word; line-height: 1.45; }
                    .price-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; font-size: 9.5pt; table-layout: fixed; }
                    .price-table th { border: 1px solid #000; padding: 6px 3px; background-color: #f8fafc; text-align: center; font-weight: bold; vertical-align: middle; }
                    .price-table td { border: 1px solid #000; padding: 5px 4px; vertical-align: middle; word-break: normal; overflow-wrap: break-word; }
                    .signatures-table { width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid; table-layout: fixed; }
                    .signatures-table td { text-align: center; width: 25%; vertical-align: top; border: none; padding: 2px; }
                    .sign-title { font-weight: bold; text-transform: uppercase; margin-bottom: 3px; font-size: 10pt; }
                    .sign-sub { font-size: 8.5pt; font-style: italic; color: #475569; margin-bottom: 45px; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <table class="header-table">
                    <tr>
                        <td style="width: 55%;">
                            <p style="margin: 0; font-weight: bold; font-size: 10.5pt; text-transform: uppercase;">CÔNG TY CỔ PHẦN THƯƠNG MẠI THẮNG ÂN</p>
                            ${lang !== 'VI' ? '<p style="margin: 1px 0 0 0; font-size: 9pt; font-weight: 600; color: #334155;">THANG AN TRADING JOINT STOCK COMPANY</p>' : ''}
                            <p style="margin: 2px 0 0 0; font-size: 9pt; color: #475569;">10/52 Giang Văn Minh - P.Ba Đình - TP.Hà Nội</p>
                            <p style="margin: 1px 0 0 0; font-size: 9pt; color: #475569;">Tel: 0813239933</p>
                        </td>
                        <td style="width: 45%; text-align: right; vertical-align: top;">
                            <p style="margin: 0; font-size: 10pt; font-style: italic;">
                                ${lang === 'VI' ? `Số: ${detail.proposalNo}/TT-KD-TA` : lang === 'EN' ? `Ref. No.: ${detail.proposalNo}/TT-KD-TA` : `Số / Ref. No.: ${detail.proposalNo}/TT-KD-TA`}
                            </p>
                            <p style="margin: 3px 0 0 0; font-size: 9pt; color: #475569;">${dateStr}</p>
                        </td>
                    </tr>
                </table>

                <div class="title">
                    ${lang === 'EN' ? docTitleEn : docTitleVi}
                </div>
                ${lang === 'BILINGUAL' ? `<div style="font-size: 11pt; font-weight: bold; text-align: center; text-transform: uppercase; color: #334155; margin-bottom: 4px;">${docTitleEn}</div>` : ''}
                <div class="subtitle">
                    ${lang === 'VI' ? `(V/v: ${titleVi || detail.title})` :
                      lang === 'EN' ? `(Re: ${titleEn || titleVi || detail.title})` :
                      `(V/v: ${titleVi}${titleEn ? ` / Re: ${titleEn}` : ''})`}
                </div>

                <div class="info-section">
                    <p><strong>${lang === 'VI' ? 'Kính gửi:' : lang === 'EN' ? 'To:' : 'Kính gửi / To:'}</strong></p>
                    <p style="padding-left: 15px;">- ${lang === 'VI' ? 'Trưởng bộ phận Bán hàng' : lang === 'EN' ? 'Head of Sales' : 'Trưởng bộ phận Bán hàng / Head of Sales'}</p>
                    <p style="padding-left: 15px;">- ${lang === 'VI' ? 'Kế toán trưởng' : lang === 'EN' ? 'Chief Accountant' : 'Kế toán trưởng / Chief Accountant'}</p>
                    <p style="padding-left: 15px;">- ${lang === 'VI' ? 'Tổng Giám đốc (CEO)' : lang === 'EN' ? 'Chief Executive Officer (CEO)' : 'Tổng Giám đốc (CEO) / Chief Executive Officer'}</p>
                </div>

                <div class="info-section" style="margin-top: 10px;">
                    <p><strong>${lang === 'VI' ? 'Người trình:' : lang === 'EN' ? 'Submitted by:' : 'Người trình / Submitted by:'}</strong> ${detail.creator?.name || ''} (${detail.creator?.email || ''})</p>
                    <p><strong>${lang === 'VI' ? 'Bộ phận:' : lang === 'EN' ? 'Department:' : 'Bộ phận / Department:'}</strong> ${detail.department?.name || (lang === 'EN' ? 'Sales Department' : 'Phòng Kinh doanh / Sales Dept')}</p>
                </div>

                ${isPriceAdjustment ? `
                <div class="content-section">
                    <div class="content-title">
                        ${lang === 'VI' ? 'I. Chi tiết đề xuất giá' : lang === 'EN' ? 'I. Pricing Proposal Details' : 'I. Chi tiết đề xuất giá / Pricing Proposal Details'}
                    </div>
                    <div style="padding-left: 12px;">
                        <p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Khách hàng áp dụng:' : lang === 'EN' ? 'Applicable Customer:' : 'Khách hàng áp dụng / Applicable Customer:'}</strong> ${detail.customer?.name || ''} (${detail.customer?.code || 'N/A'})</p>
                        <p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Phạm vi áp dụng:' : lang === 'EN' ? 'Scope of Application:' : 'Phạm vi áp dụng / Scope:'}</strong> ${scopeText}</p>
                        <p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Thời hạn hiệu lực:' : lang === 'EN' ? 'Validity Period:' : 'Thời hạn hiệu lực / Validity Period:'}</strong> ${detail.startDate ? new Date(detail.startDate).toLocaleDateString('vi-VN') : (lang === 'EN' ? 'From approval date' : 'Từ ngày phê duyệt')} ${lang === 'EN' ? 'to' : 'đến'} ${detail.endDate ? new Date(detail.endDate).toLocaleDateString('vi-VN') : (lang === 'EN' ? 'further notice' : 'khi có thông báo mới')}</p>
                        ${detail.discountPct !== null && detail.discountPct !== undefined ? `<p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Mức chiết khấu toàn danh mục:' : lang === 'EN' ? 'Overall Portfolio Discount Rate:' : 'Mức chiết khấu toàn danh mục / Overall Portfolio Discount:'}</strong> <span style="font-weight: bold; font-size: 15px; color: #0891B2;">${detail.discountPct}%</span></p>` : ''}
                    </div>

                    ${tableRows ? `
                        <div style="margin-top: 12px; padding-left: 12px;">
                            <p style="font-weight: bold; margin-bottom: 6px;">
                                ${lang === 'VI' ? 'Danh sách sản phẩm áp dụng giá riêng:' : lang === 'EN' ? 'List of SKUs with Special Pricing:' : 'Danh sách sản phẩm áp dụng giá riêng / List of SKUs with Special Pricing:'}
                            </p>
                            <table class="price-table">
                                <thead>
                                    <tr>
                                        <th style="width: 5%;">${lang === 'VI' ? 'STT' : lang === 'EN' ? 'No.' : 'STT<br/>No.'}</th>
                                        <th style="width: 14%;">${lang === 'VI' ? 'Mã SP' : lang === 'EN' ? 'Item Code' : 'Mã SP<br/>Item Code'}</th>
                                        <th style="width: 32%; text-align: left;">${lang === 'VI' ? 'Tên sản phẩm' : lang === 'EN' ? 'Product Name' : 'Tên sản phẩm<br/>Product Name'}</th>
                                        <th style="width: 7%;">${lang === 'VI' ? 'SL' : lang === 'EN' ? 'Qty' : 'SL<br/>Qty'}</th>
                                        <th style="width: 14%; text-align: right;">${lang === 'VI' ? 'Giá gốc (Wholesale)' : lang === 'EN' ? 'Wholesale Price' : 'Giá gốc (Wholesale)<br/><span style="font-size: 8pt; font-weight: normal;">Wholesale Price</span>'}</th>
                                        <th style="width: 14%; text-align: right;">${lang === 'VI' ? 'Giá đề xuất đặc biệt' : lang === 'EN' ? 'Proposed Price' : 'Giá đề xuất đặc biệt<br/><span style="font-size: 8pt; font-weight: normal;">Proposed Price</span>'}</th>
                                        <th style="width: 14%;">${lang === 'VI' ? 'Chênh lệch' : lang === 'EN' ? 'Variance' : 'Chênh lệch<br/>Variance'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
                ` : (detail.estimatedAmount || detail.customer || tableRows) ? `
                <div class="content-section">
                    <div class="content-title">
                        ${lang === 'VI' ? 'I. Thông tin kinh phí & quy mô' : lang === 'EN' ? 'I. Budget & Scope Details' : 'I. Thông tin kinh phí & quy mô / Budget & Scope'}
                    </div>
                    <div style="padding-left: 12px;">
                        ${detail.customer ? `<p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Đối tác / Khách hàng liên quan:' : lang === 'EN' ? 'Related Customer / Partner:' : 'Đối tác / Khách hàng / Related Customer:'}</strong> ${detail.customer?.name} (${detail.customer?.code || 'N/A'})</p>` : ''}
                        ${detail.estimatedAmount ? `<p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Kinh phí / Giá trị dự toán đề xuất:' : lang === 'EN' ? 'Estimated Budget / Amount:' : 'Kinh phí dự toán / Estimated Budget:'}</strong> <span style="font-weight: bold; font-size: 15px; color: #0891B2;">${formatVNDPrint(detail.estimatedAmount)}</span></p>` : ''}
                        ${detail.deadline ? `<p style="margin: 4px 0;"><strong>${lang === 'VI' ? 'Thời hạn thực hiện / hoàn thành:' : lang === 'EN' ? 'Target Completion Deadline:' : 'Thời hạn hoàn thành / Target Deadline:'}</strong> ${new Date(detail.deadline).toLocaleDateString('vi-VN')}</p>` : ''}
                    </div>
                    ${tableRows ? `
                        <div style="margin-top: 12px; padding-left: 12px;">
                            <table class="price-table">
                                <thead>
                                    <tr>
                                        <th style="width: 5%;">${lang === 'VI' ? 'STT' : lang === 'EN' ? 'No.' : 'STT<br/>No.'}</th>
                                        <th style="width: 14%;">${lang === 'VI' ? 'Mã SP' : lang === 'EN' ? 'Item Code' : 'Mã SP<br/>Item Code'}</th>
                                        <th style="width: 32%; text-align: left;">${lang === 'VI' ? 'Tên sản phẩm' : lang === 'EN' ? 'Product Name' : 'Tên sản phẩm<br/>Product Name'}</th>
                                        <th style="width: 7%;">${lang === 'VI' ? 'SL' : lang === 'EN' ? 'Qty' : 'SL<br/>Qty'}</th>
                                        <th style="width: 14%; text-align: right;">${lang === 'VI' ? 'Giá gốc' : lang === 'EN' ? 'Wholesale Price' : 'Giá gốc / Wholesale'}</th>
                                        <th style="width: 14%; text-align: right;">${lang === 'VI' ? 'Giá đề xuất' : lang === 'EN' ? 'Proposed Price' : 'Giá đề xuất / Proposed'}</th>
                                        <th style="width: 14%;">${lang === 'VI' ? 'Chênh lệch' : lang === 'EN' ? 'Variance' : 'Chênh lệch<br/>Variance'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                </div>
                ` : ''}

                <div class="content-section">
                    <div class="content-title">
                        ${isPriceAdjustment ? (
                            lang === 'VI' ? 'II. Nội dung tờ trình' : lang === 'EN' ? 'II. Detailed Proposal & Commercial Terms' : 'II. Nội dung tờ trình / Detailed Proposal'
                        ) : (
                            lang === 'VI' ? 'Nội dung tờ trình & phương án thực hiện' : lang === 'EN' ? 'Proposal Details & Execution Plan' : 'Nội dung tờ trình & phương án / Proposal Details & Execution Plan'
                        )}
                    </div>
                    <div class="content-body">${detail.content}</div>
                </div>

                ${detail.justification ? `
                    <div class="content-section">
                        <div class="content-title">
                            ${lang === 'VI' ? 'III. Căn cứ & lý do đề xuất' : lang === 'EN' ? 'III. Commercial Rationale & Basis' : 'III. Căn cứ & lý do đề xuất / Commercial Rationale'}
                        </div>
                        <div class="content-body">${detail.justification}</div>
                    </div>
                ` : ''}

                ${detail.expectedOutcome ? `
                    <div class="content-section">
                        <div class="content-title">
                            ${lang === 'VI' ? 'IV. Kết quả kinh doanh kỳ vọng' : lang === 'EN' ? 'IV. Expected Business Outcomes' : 'IV. Kết quả kinh doanh kỳ vọng / Expected Outcomes'}
                        </div>
                        <div class="content-body">${detail.expectedOutcome}</div>
                    </div>
                ` : ''}

                <table class="signatures-table">
                    <tr>
                        <td>
                            <div class="sign-title">${lang === 'VI' ? 'NGƯỜI LẬP TỜ TRÌNH' : lang === 'EN' ? 'PREPARED BY' : 'NGƯỜI LẬP TỜ TRÌNH<br/><span style="font-size: 8pt; font-weight: normal;">PREPARED BY</span>'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Ký, ghi rõ họ tên)' : lang === 'EN' ? '(Signature & full name)' : '(Ký & họ tên / Full name)'}</div>
                        </td>
                        <td>
                            <div class="sign-title">${lang === 'VI' ? 'TRƯỞNG BỘ PHẬN' : lang === 'EN' ? 'DEPARTMENT HEAD' : 'TRƯỞNG BỘ PHẬN<br/><span style="font-size: 8pt; font-weight: normal;">DEPARTMENT HEAD</span>'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Xác nhận & Ký tên)' : lang === 'EN' ? '(Reviewed & signed)' : '(Xác nhận & ký / Reviewed)'}</div>
                        </td>
                        <td>
                            <div class="sign-title">${lang === 'VI' ? 'KẾ TOÁN TRƯỞNG' : lang === 'EN' ? 'CHIEF ACCOUNTANT' : 'KẾ TOÁN TRƯỞNG<br/><span style="font-size: 8pt; font-weight: normal;">CHIEF ACCOUNTANT</span>'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Kiểm tra & Ký tên)' : lang === 'EN' ? '(Verified & signed)' : '(Kiểm tra & ký / Verified)'}</div>
                        </td>
                        <td>
                            <div class="sign-title">${lang === 'VI' ? 'TỔNG GIÁM ĐỐC' : lang === 'EN' ? 'CHIEF EXECUTIVE OFFICER' : 'TỔNG GIÁM ĐỐC<br/><span style="font-size: 8pt; font-weight: normal;">CHIEF EXECUTIVE OFFICER</span>'}</div>
                            <div class="sign-sub">${lang === 'VI' ? '(Phê duyệt & Đóng dấu)' : lang === 'EN' ? '(Approved & sealed)' : '(Phê duyệt & đóng dấu / Approved)'}</div>
                        </td>
                    </tr>
                </table>

                <!-- Digital Approval Audit Trail Table Below -->
                <div style="margin-top: 25px; page-break-inside: avoid;">
                    <div style="font-size: 11pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <span style="text-transform: uppercase;">
                            ${lang === 'VI' ? 'V. Tiến Trình Phê Duyệt Hệ Thống' : lang === 'EN' ? 'V. Digital Approval Audit Trail' : 'V. Tiến Trình Phê Duyệt Hệ Thống (Digital Audit Trail)'}
                        </span>
                        <span style="font-size: 9pt; font-weight: normal; color: #222;">
                            <strong>${lang === 'VI' ? 'Số Tờ Trình:' : lang === 'EN' ? 'Ref. No.:' : 'Số Tờ Trình / No.:'}</strong> <span style="font-family: monospace; font-weight: bold;">${detail.proposalNo}</span>
                            &nbsp;|&nbsp;
                            <strong>${lang === 'VI' ? 'Loại:' : lang === 'EN' ? 'Category:' : 'Loại / Category:'}</strong> ${CATEGORY_LABELS[detail.category] || detail.category}
                        </span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt;">
                        <thead>
                            <tr style="background-color: #f8fafc;">
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 40px;">${lang === 'VI' ? 'STT' : lang === 'EN' ? 'No.' : 'STT<br/>No.'}</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left; width: 150px;">${lang === 'VI' ? 'Cấp Duyệt / Vai Trò' : lang === 'EN' ? 'Level / Role' : 'Cấp Duyệt / Vai Trò<br/>Level & Role'}</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left;">${lang === 'VI' ? 'Người Thực Hiện' : lang === 'EN' ? 'Performed By' : 'Người Thực Hiện / Performed By'}</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 120px;">${lang === 'VI' ? 'Trạng Thái' : lang === 'EN' ? 'Status' : 'Trạng Thái / Status'}</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 140px;">${lang === 'VI' ? 'Thời Gian' : lang === 'EN' ? 'Timestamp' : 'Thời Gian / Timestamp'}</th>
                                <th style="border: 1px solid #000; padding: 6px; text-align: left;">${lang === 'VI' ? 'Ghi Chú / Ý Kiến' : lang === 'EN' ? 'Comments' : 'Ghi Chú / Comments'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">1</td>
                                <td style="border: 1px solid #000; padding: 6px;">${lang === 'VI' ? 'Người lập tờ trình' : lang === 'EN' ? 'Proposal Submitter' : 'Người lập tờ trình / Submitter'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${detail.creator?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: #1b5e20;">${lang === 'VI' ? '✓ Đã lập & trình' : lang === 'EN' ? '✓ Submitted' : '✓ Đã lập & trình / Submitted'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${creatorSignedAt}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${lang === 'VI' ? 'Khởi tạo tờ trình' : lang === 'EN' ? 'Initial submission' : 'Khởi tạo tờ trình / Initial submission'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">2</td>
                                <td style="border: 1px solid #000; padding: 6px;">${lang === 'VI' ? 'Cấp 1: Trưởng Bộ Phận' : lang === 'EN' ? 'Level 1: Dept Head' : 'Cấp 1: Trưởng Bộ Phận / Level 1: Dept Head'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l1Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l1Log ? (l1Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l1Log ? (l1Log.action === 'APPROVE' ? (lang === 'VI' ? '✓ Đã duyệt' : lang === 'EN' ? '✓ Approved' : '✓ Đã duyệt / Approved') : (lang === 'VI' ? '✗ Từ chối' : lang === 'EN' ? '✗ Rejected' : '✗ Từ chối / Rejected')) : (lang === 'VI' ? '⏳ Chưa duyệt' : lang === 'EN' ? '⏳ Pending' : '⏳ Chưa duyệt / Pending')}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l1SignedAt || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${l1Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">3</td>
                                <td style="border: 1px solid #000; padding: 6px;">${lang === 'VI' ? 'Cấp 2: Kế Toán Trưởng' : lang === 'EN' ? 'Level 2: Chief Accountant' : 'Cấp 2: Kế Toán Trưởng / Level 2: Chief Accountant'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l2Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l2Log ? (l2Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l2Log ? (l2Log.action === 'APPROVE' ? (lang === 'VI' ? '✓ Đã duyệt' : lang === 'EN' ? '✓ Approved' : '✓ Đã duyệt / Approved') : (lang === 'VI' ? '✗ Từ chối' : lang === 'EN' ? '✗ Rejected' : '✗ Từ chối / Rejected')) : (lang === 'VI' ? '⏳ Chưa duyệt' : lang === 'EN' ? '⏳ Pending' : '⏳ Chưa duyệt / Pending')}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l2SignedAt || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-style: italic;">${l2Log?.comment || '—'}</td>
                            </tr>
                            <tr>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">4</td>
                                <td style="border: 1px solid #000; padding: 6px;">${lang === 'VI' ? 'Cấp 3: Tổng Giám Đốc (CEO)' : lang === 'EN' ? 'Level 3: CEO' : 'Cấp 3: Tổng Giám Đốc / Level 3: CEO'}</td>
                                <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">${l3Log?.approver?.name || '—'}</td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: ${l3Log ? (l3Log.action === 'APPROVE' ? '#1b5e20' : '#b71c1c') : '#777'};">
                                    ${l3Log ? (l3Log.action === 'APPROVE' ? (lang === 'VI' ? '✓ Đã duyệt' : lang === 'EN' ? '✓ Approved' : '✓ Đã duyệt / Approved') : (lang === 'VI' ? '✗ Từ chối' : lang === 'EN' ? '✗ Rejected' : '✗ Từ chối / Rejected')) : (lang === 'VI' ? '⏳ Chưa duyệt' : lang === 'EN' ? '⏳ Pending' : '⏳ Chưa duyệt / Pending')}
                                </td>
                                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${l3SignedAt || '—'}</td>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold" style={{ color: '#0F172A' }}>
                        {t.header.title}
                    </h2>
                    <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#64748B' }}>
                        {t.header.subtitle}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-md transition-all w-full sm:w-auto cursor-pointer hover:opacity-90 shadow-xs"
                    style={{ background: 'rgba(91,168,138,0.18)', color: '#2E7D5B', border: '1px solid rgba(91,168,138,0.4)' }}
                >
                    <Plus size={16} /> {t.header.createBtn}
                </button>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
                {[
                    { label: t.stats.total, value: currentStats.total, accent: '#475569' },
                    { label: t.stats.pending, value: currentStats.pending, accent: '#D4A853' },
                    { label: t.stats.draft, value: currentStats.draft, accent: '#64748B' },
                    { label: t.stats.approved, value: currentStats.approved, accent: '#5BA88A' },
                    { label: t.stats.rejected, value: currentStats.rejected, accent: '#8B1A2E' },
                ].map((s, idx) => (
                    <div 
                        key={s.label} 
                        className={`rounded-md p-3 sm:p-4 shadow-2xs ${idx === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderLeft: `3px solid ${s.accent}` }}
                    >
                        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>{s.label}</p>
                        <p className="text-xl sm:text-2xl font-bold mt-1" style={{ color: '#0F172A' }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter + Search Bar */}
            <div className="flex items-center gap-3 flex-wrap w-full">
                <div className="max-w-full overflow-x-auto scrollbar-none flex rounded-md flex-shrink-0" style={{ border: '1px solid #E2E8F0' }}>
                    {(['ALL', 'PENDING', 'DRAFT', 'APPROVED', 'REJECTED'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className="px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap"
                            style={{
                                background: filter === f ? 'rgba(8, 145, 178, 0.08)' : '#FFFFFF',
                                color: filter === f ? '#87CBB9' : '#64748B',
                                borderRight: '1px solid #E2E8F0',
                            }}
                        >
                            {f === 'ALL' ? t.tabs.all : f === 'PENDING' ? t.tabs.pending : f === 'DRAFT' ? t.tabs.draft : f === 'APPROVED' ? t.tabs.approved : t.tabs.rejected}
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
                            background: categoryFilter === 'ALL' ? '#FFFFFF' : 'rgba(8, 145, 178, 0.08)',
                            border: '1px solid #E2E8F0',
                            color: categoryFilter === 'ALL' ? '#475569' : '#87CBB9',
                        }}
                    >
                        <option value="ALL">{t.filters.allCategories}</option>
                        <option value="TASTING">{locale === 'en' ? '🍷 Wine Tasting & Sample' : '🍷 Tờ Trình Tasting (Thử Rượu)'}</option>
                        <option value="SPECIAL_EVENT">{locale === 'en' ? '🎪 Special Event' : '🎪 Sự Kiện / Event'}</option>
                        <option value="PRICE_ADJUSTMENT">{locale === 'en' ? '🏷️ Special Pricing Mechanism' : '🏷️ Tờ Trình Cơ Chế Giá & Giá Đặc Biệt'}</option>
                        <option value="BUDGET_REQUEST">{locale === 'en' ? '💰 Budget Request' : '💰 Xin Ngân Sách'}</option>
                        <option value="CAPITAL_EXPENDITURE">{locale === 'en' ? '🏢 CAPEX' : '🏢 Mua Sắm TSCĐ'}</option>
                        <option value="NEW_SUPPLIER">{locale === 'en' ? '🤝 New Supplier' : '🤝 Nhà Cung Cấp Mới'}</option>
                        <option value="NEW_PRODUCT">{locale === 'en' ? '📦 New Product' : '📦 Sản Phẩm Mới'}</option>
                        <option value="POLICY_CHANGE">{locale === 'en' ? '📋 Policy Change' : '📋 Thay Đổi Quy Trình'}</option>
                        <option value="PAYMENT_SCHEDULE">{locale === 'en' ? '📅 Payment Schedule' : '📅 Lịch Thanh Toán'}</option>
                        <option value="PROMOTION_CAMPAIGN">{locale === 'en' ? '🎁 Promotion' : '🎁 Chương Trình KM'}</option>
                        <option value="OTHER">{locale === 'en' ? 'Other' : 'Khác'}</option>
                    </select>
                </div>

                {/* Priority Dropdown Filter */}
                <div className="flex-shrink-0">
                    <select
                        value={priorityFilter}
                        onChange={e => setPriorityFilter(e.target.value)}
                        className="px-3 py-2 text-xs font-semibold rounded-md outline-none cursor-pointer"
                        style={{
                            background: priorityFilter === 'ALL' ? '#FFFFFF' : 'rgba(212,168,83,0.15)',
                            border: '1px solid #E2E8F0',
                            color: priorityFilter === 'ALL' ? '#475569' : '#D4A853',
                        }}
                    >
                        <option value="ALL">{t.filters.allPriorities}</option>
                        <option value="URGENT">🔥 {locale === 'en' ? 'Urgent' : 'Khẩn cấp (Urgent)'}</option>
                        <option value="HIGH">⚡ {locale === 'en' ? 'High' : 'Cao (High)'}</option>
                        <option value="NORMAL">🔹 {locale === 'en' ? 'Normal' : 'Bình thường (Normal)'}</option>
                        <option value="LOW">◽ {locale === 'en' ? 'Low' : 'Thấp (Low)'}</option>
                    </select>
                </div>

                <div className="flex-1 relative min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t.filters.searchPlaceholder}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-md"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Mobile View - Cards for small screens */}
            <div className="block md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center py-12 gap-2" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                        <FileText size={32} style={{ color: '#E2E8F0' }} />
                        <p className="text-sm" style={{ color: '#64748B' }}>{t.table.empty}</p>
                    </div>
                ) : (
                    filtered.map(p => {
                        const statusCfg = getStatusLabel(p.status, locale)
                        const prioCfg = getPriorityLabel(p.priority, locale)
                        const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                        const canApproveThis = isPending && canApproveAtLevel(p.currentLevel, userRoles)
                        const { main, sub } = formatBilingualTitle(p.title, locale)

                        return (
                            <div
                                key={p.id}
                                className="p-4 rounded-lg space-y-3 transition-all cursor-pointer"
                                style={{
                                    background: '#FFFFFF',
                                    border: canApproveThis ? '1px solid #D4A853' : '1px solid #E2E8F0',
                                }}
                                onClick={() => openDetail(p.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold font-mono" style={{ color: '#0891B2' }}>
                                        {p.proposalNo}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        {statusCfg.label}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-sm font-bold leading-snug" style={{ color: '#0F172A' }}>
                                        {main}
                                    </p>
                                    {sub && (
                                        <p className="text-xs font-medium italic mt-0.5 text-slate-500">
                                            {sub}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                        {getCategoryBadge(p.category).label}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                        style={{ background: prioCfg.bg, color: prioCfg.color }}>
                                        {prioCfg.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2" style={{ borderTop: '1px solid rgba(42,67,85,0.2)', color: '#475569' }}>
                                    <div>
                                        <p style={{ color: '#64748B' }} className="text-[10px] uppercase font-semibold">{locale === 'en' ? 'Submitter' : 'Người trình'}</p>
                                        <p className="font-medium mt-0.5">{p.creatorName}</p>
                                    </div>
                                    <div>
                                        <p style={{ color: '#64748B' }} className="text-[10px] uppercase font-semibold">{locale === 'en' ? 'Submitted' : 'Ngày trình'}</p>
                                        <p className="font-medium mt-0.5">
                                            {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN') : '—'}
                                        </p>
                                    </div>
                                    {p.estimatedAmount !== null && (
                                        <div className="col-span-2">
                                            <p style={{ color: '#64748B' }} className="text-[10px] uppercase font-semibold">{locale === 'en' ? 'Estimated Amount' : 'Giá trị dự kiến'}</p>
                                            <p className="font-bold text-sm mt-0.5" style={{ color: '#0F172A' }}>
                                                {formatCompactVND(p.estimatedAmount, locale)}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => openDetail(p.id)}
                                        className="px-3 py-1.5 text-xs font-medium rounded transition-all"
                                        style={{ background: 'rgba(135,203,185,0.1)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                                        <Eye size={12} className="inline mr-1" />{t.actions.detail}
                                    </button>
                                    {canApproveThis && (
                                        <>
                                            <button
                                                onClick={() => handleApproval(p.id, 'APPROVE')}
                                                disabled={actionLoading === p.id}
                                                className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                {t.actions.approve}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const reason = prompt(locale === 'en' ? 'Reason for rejection:' : 'Lý do từ chối:')
                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                                <XCircle size={12} className="inline mr-1" />{t.actions.reject}
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
                                            {t.actions.submit}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-xl overflow-x-auto w-full shadow-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
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
                            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                                {[
                                    { label: t.table.proposalNo, align: 'left' as const },
                                    { label: t.table.title, align: 'left' as const },
                                    { label: t.table.category, align: 'left' as const },
                                    { label: t.table.priority, align: 'left' as const },
                                    { label: t.table.value, align: 'right' as const },
                                    { label: t.table.submitter, align: 'left' as const },
                                    { label: t.table.status, align: 'left' as const },
                                    { label: t.table.submissionTime, align: 'left' as const },
                                    { label: t.table.finalApproval, align: 'left' as const },
                                    { label: t.table.actions, align: 'right' as const },
                                ].map(col => (
                                    <th key={col.label}
                                        className="px-3 py-3 text-xs font-bold uppercase tracking-wider"
                                        style={{ color: '#64748B', textAlign: col.align, whiteSpace: 'nowrap' }}>
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
                                            <FileText size={32} style={{ color: '#E2E8F0' }} />
                                            <p className="text-sm" style={{ color: '#64748B' }}>{t.table.empty}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(p => {
                                    const statusCfg = getStatusLabel(p.status, locale)
                                    const prioCfg = getPriorityLabel(p.priority, locale)
                                    const catBadge = getCategoryBadge(p.category)
                                    const isPending = ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(p.status)
                                    const canApproveThis = isPending && canApproveAtLevel(p.currentLevel, userRoles)
                                    const { main, sub } = formatBilingualTitle(p.title, locale)

                                    return (
                                        <tr key={p.id}
                                            onClick={() => openDetail(p.id)}
                                            className="transition-all cursor-pointer hover:brightness-110"
                                            style={{
                                                borderBottom: '1px solid #E2E8F0',
                                                background: canApproveThis ? 'rgba(212,168,83,0.03)' : 'transparent',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = canApproveThis ? 'rgba(212,168,83,0.03)' : 'transparent'}
                                        >
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs font-bold font-mono text-[#0891B2] whitespace-nowrap block truncate" title={p.proposalNo}>
                                                    {p.proposalNo}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 leading-tight" title={main}>
                                                        {main}
                                                    </p>
                                                    {sub && (
                                                        <p className="text-[11px] font-normal text-slate-500 italic mt-0.5 line-clamp-1" title={sub}>
                                                            {sub}
                                                        </p>
                                                    )}
                                                </div>
                                                {p.attachmentCount > 0 && (
                                                    <span className="text-[11px] text-slate-500 block mt-0.5">
                                                        <Paperclip size={10} className="inline mr-1" />{p.attachmentCount} file{p.attachmentCount > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold inline-block truncate max-w-full"
                                                    style={{ background: catBadge.bg, color: catBadge.color, border: `1px solid ${catBadge.border}` }}
                                                    title={getCategoryLabel(p.category, locale)}>
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
                                                <span className="text-xs font-bold block truncate text-slate-900">
                                                    {p.estimatedAmount ? formatCompactVND(p.estimatedAmount, locale) : '—'}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-xs truncate block text-slate-600" title={p.creatorName}>{p.creatorName}</span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold inline-block whitespace-nowrap"
                                                    style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                                    {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                <span className="text-[11px] whitespace-nowrap text-slate-600">
                                                    {formatDateTime(p.submittedAt || p.createdAt)}
                                                </span>
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }}>
                                                {(p.status === 'APPROVED' || p.status === 'IN_PROGRESS' || p.status === 'CLOSED') ? (
                                                    <span className="text-[11px] font-bold whitespace-nowrap text-[#5BA88A]" title={locale === 'en' ? 'Final CEO Approval Time' : 'Thời gian CEO phê duyệt hoàn tất'}>
                                                        {formatDateTime(p.resolvedAt)}
                                                    </span>
                                                ) : p.status === 'REJECTED' ? (
                                                    <span className="text-[11px] font-medium whitespace-nowrap text-[#8B1A2E]" title={locale === 'en' ? 'Rejection Time' : 'Thời gian từ chối'}>
                                                        {formatDateTime(p.resolvedAt)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs whitespace-nowrap text-slate-500" title={locale === 'en' ? 'Pending Approval' : 'Đang chờ duyệt'}>
                                                        —
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-3" style={{ verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1.5 flex-nowrap">
                                                    <button onClick={() => openDetail(p.id)}
                                                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap"
                                                        style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }}>
                                                        <Eye size={12} className="inline mr-1" />{t.actions.detail}
                                                    </button>
                                                    {canApproveThis && (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApproval(p.id, 'APPROVE') }}
                                                                disabled={actionLoading === p.id}
                                                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap hover:scale-105"
                                                                style={{ background: '#5BA88A', color: '#0F172A' }}>
                                                                {actionLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} className="inline mr-1" />}
                                                                {t.actions.approve}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    const reason = prompt(locale === 'en' ? 'Reason for rejection:' : 'Lý do từ chối:')
                                                                    if (reason) handleApproval(p.id, 'REJECT', reason)
                                                                }}
                                                                className="px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap hover:bg-rose-900/30"
                                                                style={{ background: 'rgba(139,26,46,0.15)', color: '#FF6B6B', border: '1px solid rgba(139,26,46,0.4)' }}>
                                                                <XCircle size={12} className="inline mr-1" />{t.actions.reject}
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
                                                            {t.actions.submit}
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
                    actionLoading={actionLoading}
                    onClose={() => { setDetailId(null); setDetail(null) }}
                    userId={userId}
                    isCEO={isCEO}
                    userRoles={userRoles}
                    onApproval={async (action, comment) => { if (detailId) await handleApproval(detailId, action, comment); }}
                    onRefresh={async () => { await refreshList(); if (detailId) await openDetail(detailId) }}
                    onPrint={handlePrint}
                />
            )}
        </div>
    )
}

// Helper check if customer is a parent/holding entity ("Mã cha")
function isParentCustomer(c: any): boolean {
    if (!c) return false
    return (
        c.entityType === 'COMPANY' ||
        (c.code && (c.code.endsWith('-M') || c.code.endsWith('-CHA') || c.code.endsWith('-ME'))) ||
        (c.name && (c.name.includes('(Mẹ)') || c.name.includes('(Cha)') || c.name.includes('(Chung)')))
    )
}

// ─── Searchable Customer Combobox ───────────────────────────
function SearchableCustomerCombobox({
    customers,
    selectedCustomerId,
    onSelect,
    filterParent = true,
}: {
    customers: any[]
    selectedCustomerId: string
    onSelect: (customer: any) => void
    filterParent?: boolean
}) {
    const [open, setOpen] = useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const selectedCust = React.useMemo(() => {
        return customers.find((c: any) => c.id === selectedCustomerId)
    }, [customers, selectedCustomerId])

    const [inputValue, setInputValue] = useState('')

    useEffect(() => {
        if (selectedCust) {
            setInputValue(`[${selectedCust.code}] ${selectedCust.name}`)
        } else if (!open) {
            setInputValue('')
        }
    }, [selectedCust, open])

    const filtered = React.useMemo(() => {
        const q = inputValue.trim().toLowerCase()
        const baseList = filterParent ? customers.filter(c => !isParentCustomer(c)) : customers
        if (!q) return baseList.slice(0, 40)
        return baseList.filter((c: any) => 
            (c.name && c.name.toLowerCase().includes(q)) || 
            (c.code && c.code.toLowerCase().includes(q))
        ).slice(0, 40)
    }, [customers, inputValue, filterParent])

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onFocus={e => {
                        setOpen(true)
                        e.target.select()
                    }}
                    onChange={e => {
                        setInputValue(e.target.value)
                        setOpen(true)
                    }}
                    onBlur={() => {
                        setTimeout(() => {
                            setOpen(false)
                            if (selectedCust) {
                                setInputValue(`[${selectedCust.code}] ${selectedCust.name}`)
                            }
                        }, 250)
                    }}
                    placeholder="Gõ mã (VD: HR10084) hoặc tên khách hàng để tìm..."
                    style={{ ...inputStyle, padding: '9px 36px 9px 32px', fontSize: '13px', background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                {selectedCust ? (
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault()
                            onSelect({ id: '', name: '', code: '' })
                            setInputValue('')
                            setOpen(false)
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"
                        title="Xóa lựa chọn"
                    >
                        <X size={13} />
                    </button>
                ) : (
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                )}
            </div>

            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-md shadow-2xl divide-y divide-slate-100 bg-white border border-slate-200"
                >
                    {filtered.length === 0 ? (
                        <div className="p-3 text-xs text-center text-slate-400">
                            {inputValue ? `Không tìm thấy khách hàng khớp với "${inputValue}"` : 'Chưa có dữ liệu khách hàng'}
                        </div>
                    ) : (
                        filtered.map((c: any) => (
                            <div
                                key={c.id}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    onSelect(c)
                                    setInputValue(`[${c.code}] ${c.name}`)
                                    setOpen(false)
                                }}
                                className={`w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs cursor-pointer ${c.id === selectedCustomerId ? 'bg-amber-50' : ''}`}
                            >
                                <div className="min-w-0 flex-1 pr-2">
                                    <span className="font-mono font-bold text-amber-700 mr-2 text-xs">[{c.code}]</span>
                                    <span className="text-slate-900 font-medium">{c.name}</span>
                                </div>
                                {c.channel && (
                                    <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded whitespace-nowrap border border-slate-200">
                                        {c.channel}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
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
    const [dropUp, setDropUp] = useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    const selectedProd = React.useMemo(() => {
        return products.find(p => p.id === selectedProductId)
    }, [products, selectedProductId])

    const selectedProdTitle = selectedProd ? `[${selectedProd.skuCode}] ${selectedProd.productName}` : ''
    const [inputValue, setInputValue] = useState('')

    useEffect(() => {
        if (selectedProd) {
            setInputValue(selectedProdTitle)
        } else if (!open) {
            setInputValue('')
        }
    }, [selectedProd, selectedProdTitle, open])

    // Close when clicking outside container
    useEffect(() => {
        if (!open) return
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
                if (selectedProd) {
                    setInputValue(selectedProdTitle)
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [open, selectedProd, selectedProdTitle])

    const filtered = React.useMemo(() => {
        const q = inputValue.trim().toLowerCase()
        if (!q || (selectedProd && inputValue === selectedProdTitle)) {
            return products.slice(0, 50)
        }
        return products.filter(p => 
            (p.productName && p.productName.toLowerCase().includes(q)) || 
            (p.skuCode && p.skuCode.toLowerCase().includes(q))
        ).slice(0, 50)
    }, [products, inputValue, selectedProd, selectedProdTitle])

    return (
        <div ref={containerRef} className={`relative flex-1 min-w-0 ${open ? 'z-50' : 'z-10'}`}>
            <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: '#475569' }}>Sản phẩm (Gõ SKU hoặc tên để tìm)</label>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onFocus={e => {
                        setOpen(true)
                        e.target.select()
                    }}
                    onChange={e => {
                        setInputValue(e.target.value)
                        setOpen(true)
                    }}
                    placeholder="Gõ mã SKU hoặc tên sản phẩm..."
                    style={{ ...inputStyle, padding: '7px 32px 7px 10px', fontSize: '13px', background: '#FFFFFF', color: '#0F172A', border: '1px solid #CBD5E1' }}
                />
                {selectedProd ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelect({ id: '', skuCode: '', productName: '', wholesalePrice: 0 })
                            setInputValue('')
                            setOpen(true)
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-1 transition cursor-pointer"
                        title="Bỏ chọn sản phẩm"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                )}
            </div>

            {open && (
                <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 overflow-y-auto rounded-lg shadow-2xl divide-y divide-slate-100 bg-white border border-slate-200"
                    style={{ minWidth: '320px' }}
                >
                    {filtered.length === 0 ? (
                        <div className="p-3 text-xs text-center text-slate-400">Không tìm thấy sản phẩm khớp &quot;{inputValue}&quot;</div>
                    ) : (
                        filtered.map(p => (
                            <div
                                key={p.id}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    onSelect(p)
                                    setInputValue(`[${p.skuCode}] ${p.productName}`)
                                    setOpen(false)
                                }}
                                className="w-full text-left p-2.5 hover:bg-slate-50 transition flex items-center justify-between text-xs cursor-pointer group"
                            >
                                <div className="min-w-0 flex-1 pr-3">
                                    <span className="font-mono font-bold text-[#0891B2] mr-2 text-xs">[{p.skuCode}]</span>
                                    <span className="text-slate-900 font-medium group-hover:text-amber-600 transition-colors">{p.productName}</span>
                                </div>
                                <span className="font-mono text-xs text-slate-700 font-semibold whitespace-nowrap bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                    {formatVND(p.wholesalePrice)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl bg-white dark:bg-slate-50 border border-slate-200 dark:border-slate-200 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-slate-200">
                    <h4 className="text-sm sm:text-base font-bold text-slate-900">Chọn Nhanh Sản Phẩm Đề Xuất Giá (Batch Picker)</h4>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><X size={20} className="text-slate-400" /></button>
                </div>

                <div className="p-3 sm:p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm SKU hoặc tên sản phẩm..."
                            className="w-full pl-9 pr-3 py-2 text-xs outline-none rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                        <span>Đã chọn: <strong className="text-[#0891B2]">{selectedCount}</strong> chai</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px]">Giảm nhanh:</span>
                            <button type="button" onClick={() => handleApplyDiscountAll(5)} className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-700 border border-amber-200 cursor-pointer">-5%</button>
                            <button type="button" onClick={() => handleApplyDiscountAll(10)} className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-700 border border-amber-200 cursor-pointer">-10%</button>
                            <button type="button" onClick={() => handleApplyDiscountAll(15)} className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-700 border border-amber-200 cursor-pointer">-15%</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 border border-slate-200/40 rounded p-2">
                        {filtered.map(p => {
                            const isChecked = !!selected[p.id]
                            const currentPrice = selected[p.id]?.proposedPrice ?? p.wholesalePrice
                            const diffPct = p.wholesalePrice > 0 ? ((currentPrice - p.wholesalePrice) / p.wholesalePrice) * 100 : 0

                            return (
                                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 sm:p-2.5 rounded hover:bg-white transition border-b border-slate-200/30 text-xs">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleSelect(p)}
                                            className="w-4 h-4 accent-[#87CBB9] cursor-pointer flex-shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <span className="font-mono font-bold text-[#0891B2] mr-2">{p.skuCode}</span>
                                            <span className="text-slate-900 font-medium">{p.productName}</span>
                                            <span className="text-[10px] text-gray-500 block">Giá niêm yết: {formatVND(p.wholesalePrice)}</span>
                                        </div>
                                    </div>

                                    {isChecked && (
                                        <div className="flex items-center justify-end gap-2 w-full sm:w-auto pl-7 sm:pl-3 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-200/40">
                                            <div className="text-right">
                                                <label className="text-[9px] block text-amber-600 font-bold">Số lượng (chai)</label>
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
                                                    style={{ background: '#FFFFFF', border: '1px solid #D4A853', color: '#D4A853' }}
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
                                                    style={{ background: '#FFFFFF', border: '1px solid #87CBB9', color: '#0891B2' }}
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

                <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium rounded text-gray-400 hover:bg-white">Huỷ</button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={selectedCount === 0}
                        className="px-5 py-2 text-xs font-semibold rounded disabled:opacity-40"
                        style={{ background: '#0891B2', color: '#FFFFFF' }}
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
    const { locale } = useAppLocale()
    const t = PROPOSALS_I18N[locale] || PROPOSALS_I18N.vi

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
        titleEn: '',
        content: '',
        justification: '',
        expectedOutcome: '',
        estimatedAmount: '',
        deadline: '',
        startDate: '',
        endDate: '',
        customerId: '',
        scope: 'ENTIRE_PORTFOLIO',
        discountPct: '',
    })
    const [additionalBranches, setAdditionalBranches] = useState<string[]>([])
    const [priceLines, setPriceLines] = useState<{ productId: string; proposedPrice: number; quantity: number }[]>([])
    const [saving, setSaving] = useState(false)
    const [batchPickerOpen, setBatchPickerOpen] = useState(false)

    const usableCustomers = useMemo(() => {
        return customers.filter(c => !isParentCustomer(c))
    }, [customers])

    const selectedCustForProposal = useMemo(() => {
        return usableCustomers.find((c: any) => c.id === form.customerId)
    }, [usableCustomers, form.customerId])

    const relatedBranchesForProposal = useMemo(() => {
        if (!selectedCustForProposal) return []
        const parentId = (selectedCustForProposal as any).parentId
        const brandGroup = (selectedCustForProposal as any).brandGroup
        return usableCustomers.filter((c: any) => {
            if (c.id === selectedCustForProposal.id) return false
            if (parentId && c.id === parentId) return false
            const sameParent = parentId && c.parentId === parentId
            const sameBrand = brandGroup && c.brandGroup && c.brandGroup.toLowerCase() === brandGroup.toLowerCase()
            return sameParent || sameBrand
        })
    }, [usableCustomers, selectedCustForProposal])

    const handleSave = async () => {
        if (!form.title || !form.content) return alert(locale === 'en' ? 'Please enter title and content' : 'Vui lòng nhập tiêu đề và nội dung')
        if (form.category === 'PRICE_ADJUSTMENT') {
            if (!form.customerId) return alert(locale === 'en' ? 'Please select applicable customer' : 'Vui lòng chọn khách hàng áp dụng')
            if ((form.scope === 'ENTIRE_PORTFOLIO' || form.scope === 'MIXED') && !form.discountPct) {
                return alert(locale === 'en' ? 'Please enter portfolio discount percentage' : 'Vui lòng nhập % chiết khấu toàn danh mục')
            }
            if ((form.scope === 'SPECIFIC_PRODUCTS' || form.scope === 'MIXED') && priceLines.length === 0) {
                return alert(locale === 'en' ? 'Please add proposed pricing products' : 'Vui lòng thêm sản phẩm đề xuất giá')
            }
            if (priceLines.some(line => !line.productId)) {
                return alert(locale === 'en' ? 'Please select products for all lines' : 'Vui lòng chọn đầy đủ sản phẩm cho các dòng đề xuất')
            }
        }
        const isTastingCategory = form.category === 'TASTING' || form.category === 'SPECIAL_EVENT'
        if (isTastingCategory) {
            if (priceLines.length === 0) {
                return alert(locale === 'en' ? 'Please select at least 1 tasting product' : 'Vui lòng chọn ít nhất 1 mã sản phẩm nếm thử (Tasting)')
            }
            if (priceLines.some(line => !line.productId)) {
                return alert(locale === 'en' ? 'Please select products for all tasting lines' : 'Vui lòng chọn đầy đủ mã sản phẩm cho các dòng tasting')
            }
        }
        setSaving(true)
        const finalScope = (form.category === 'PRICE_ADJUSTMENT' && additionalBranches.length > 0)
            ? `${form.scope} | BRANCHES:${additionalBranches.join(',')}`
            : form.scope

        const finalTitle = form.titleEn?.trim()
            ? `${form.title.trim()} / ${form.titleEn.trim()}`
            : form.title.trim()

        const result = await createProposal({
            ...form,
            title: finalTitle,
            scope: finalScope,
            estimatedAmount: form.estimatedAmount ? parseFloat(form.estimatedAmount) : undefined,
            discountPct: form.discountPct ? parseFloat(form.discountPct) : undefined,
            startDate: form.startDate || undefined,
            endDate: form.endDate || undefined,
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
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-4xl h-full overflow-y-auto shadow-2xl bg-white dark:bg-slate-50 border-l border-slate-200 dark:border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-200 bg-slate-50/50 dark:bg-white/50">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={22} className="text-amber-500" />
                        {t.createDrawer.title}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-white"><X size={20} style={{ color: '#64748B' }} /></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Category */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{t.createDrawer.categoryLabel}</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                            {Object.entries(CATEGORY_LABELS).map(([k]) => (
                                <option key={k} value={k}>{getCategoryLabel(k, locale)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tasting Custom Fields */}
                    {(form.category === 'TASTING' || form.category === 'SPECIAL_EVENT') && (
                        <div className="space-y-4 p-4 rounded-xl border border-amber-200/90 bg-amber-50/30 shadow-xs">
                            <div>
                                <label className="text-xs font-bold uppercase mb-1.5 block tracking-wider text-amber-900">
                                    👤 Khách Hàng Áp Dụng Tasting (Tùy Chọn)
                                </label>
                                <SearchableCustomerCombobox
                                    customers={usableCustomers}
                                    selectedCustomerId={form.customerId}
                                    onSelect={(cust: any) => {
                                        setForm(f => ({
                                            ...f,
                                            customerId: cust.id,
                                            title: !f.title && cust.name ? `Tờ trình Tasting thử rượu cho khách hàng ${cust.name}` : f.title,
                                            titleEn: !f.titleEn && cust.name ? `Tasting wine sample proposal for ${cust.name}` : f.titleEn,
                                        }))
                                    }}
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-amber-900">
                                        🍷 Mã Sản Phẩm & Số Lượng Thử Vang (Tasting) *
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => setBatchPickerOpen(true)}
                                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer hover:opacity-90"
                                            style={{ background: 'rgba(212,168,83,0.18)', color: '#B45309', border: '1px solid rgba(212,168,83,0.45)' }}
                                        >
                                            <Search size={13} /> Chọn nhanh hàng loạt
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setPriceLines([...priceLines, { productId: '', proposedPrice: 0, quantity: 1 }])}
                                            className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer hover:opacity-90"
                                            style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }}
                                        >
                                            <Plus size={13} /> Thêm dòng
                                        </button>
                                    </div>
                                </div>
                                {priceLines.length === 0 ? (
                                    <div className="p-4 text-center rounded-lg border-2 border-dashed border-amber-300/80 bg-white">
                                        <p className="text-xs font-medium text-slate-600">
                                            Chưa chọn mã hàng tasting nào. Bấm nút <strong className="text-[#0891B2]">"Thêm dòng"</strong> hoặc <strong className="text-amber-700">"Chọn nhanh hàng loạt"</strong> ở trên để thêm sản phẩm.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {priceLines.map((line, idx) => {
                                            const selectedProd = products.find(p => p.id === line.productId)
                                            const wholesale = selectedProd ? selectedProd.wholesalePrice : 0
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className="flex flex-col sm:flex-row gap-2.5 sm:items-center p-3 rounded-lg bg-white border border-slate-200 shadow-2xs relative"
                                                    style={{ zIndex: priceLines.length - idx + 10 }}
                                                >
                                                    <div className="flex-1 min-w-0 w-full">
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
                                                    
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                                        <div className="w-24 sm:w-28 text-center flex-shrink-0">
                                                            <label className="text-[10px] block text-amber-800 font-bold mb-1">Số lượng (chai)</label>
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
                                                                    background: '#FFFFFF',
                                                                    border: '1px solid #D4A853',
                                                                    fontWeight: 'bold',
                                                                    color: '#B45309',
                                                                    textAlign: 'center',
                                                                    borderRadius: '6px',
                                                                    outline: 'none',
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="text-right flex flex-col justify-center px-2 min-w-[85px] sm:min-w-[95px] flex-shrink-0">
                                                            <span className="text-[10px] block text-slate-500 font-medium">Giá niêm yết</span>
                                                            <span className="text-xs block font-mono font-bold text-slate-900">{formatVND(wholesale)}</span>
                                                        </div>

                                                        <button 
                                                            type="button" 
                                                            onClick={() => setPriceLines(priceLines.filter((_, i) => i !== idx))}
                                                            className="p-1.5 rounded text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0 cursor-pointer"
                                                            title="Xóa dòng"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
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
                        <div className="space-y-4 p-4 rounded-md border border-slate-200 bg-white">
                            <div>
                                <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#475569' }}>Khách hàng chính áp dụng *</label>
                                <SearchableCustomerCombobox
                                    customers={usableCustomers}
                                    selectedCustomerId={form.customerId}
                                    onSelect={(cust: any) => {
                                        setForm(f => ({
                                            ...f,
                                            customerId: cust.id,
                                            title: !f.title && cust.name ? `Đề xuất cơ chế giá & giá đặc biệt cho khách hàng ${cust.name}` : f.title,
                                            titleEn: !f.titleEn && cust.name ? `Special pricing & commercial policy proposal for ${cust.name}` : f.titleEn,
                                        }))
                                        setAdditionalBranches([])
                                    }}
                                />
                            </div>

                            {/* Additional branches selection */}
                            {form.customerId && (
                                <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-[#0891B2] flex items-center gap-1.5">
                                            🏢 Áp dụng đồng thời cho các cơ sở khác ({additionalBranches.length} cơ sở đã chọn)
                                        </label>
                                    </div>

                                    {relatedBranchesForProposal.length > 0 && (
                                        <div className="p-2.5 rounded bg-[#D4A853]/10 border border-[#D4A853]/30 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px]">
                                                <span className="text-[#D4A853] font-semibold">Gợi ý cùng chuỗi / thương hiệu ({relatedBranchesForProposal.length} cơ sở):</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allRelIds = relatedBranchesForProposal.map((b: any) => b.id)
                                                        setAdditionalBranches(prev => Array.from(new Set([...prev, ...allRelIds])))
                                                    }}
                                                    className="text-[#D4A853] hover:underline font-bold"
                                                >
                                                    + Chọn tất cả
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {relatedBranchesForProposal.map((rb: any) => {
                                                    const isSelected = additionalBranches.includes(rb.id)
                                                    return (
                                                        <button
                                                            key={rb.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setAdditionalBranches(prev =>
                                                                    prev.includes(rb.id) ? prev.filter(x => x !== rb.id) : [...prev, rb.id]
                                                                )
                                                            }}
                                                            className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                                                                isSelected ? 'bg-[#0891B2] text-white font-bold' : 'bg-white text-slate-900 border border-slate-200 hover:border-[#87CBB9]'
                                                            }`}
                                                        >
                                                            {isSelected ? <Check size={11} /> : <Plus size={11} />}
                                                            [{rb.code}] {rb.name}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Effective Validity Period (Start & End Date) */}
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block text-[#0891B2]">
                                        📅 Ngày bắt đầu hiệu lực
                                    </label>
                                    <input 
                                        type="date"
                                        value={form.startDate}
                                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                        style={{ ...inputStyle, background: '#FFFFFF', borderColor: '#E2E8F0' }}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase mb-1 block text-[#D4A853]">
                                        📅 Ngày kết thúc hiệu lực
                                    </label>
                                    <input 
                                        type="date"
                                        value={form.endDate}
                                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                        style={{ ...inputStyle, background: '#FFFFFF', borderColor: '#E2E8F0' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#475569' }}>Phạm vi áp dụng *</label>
                                <select 
                                    value={form.scope} 
                                    onChange={e => setForm(f => ({ ...f, scope: e.target.value }))} 
                                    style={{ ...inputStyle, background: '#FFFFFF' }}
                                >
                                    <option value="ENTIRE_PORTFOLIO">Toàn bộ danh mục (% chiết khấu)</option>
                                    <option value="SPECIFIC_PRODUCTS">Một số sản phẩm cụ thể (gõ giá riêng)</option>
                                    <option value="MIXED">Kết hợp cả hai (chiết khấu danh mục + giá riêng một số chai)</option>
                                </select>
                            </div>

                            {(form.scope === 'ENTIRE_PORTFOLIO' || form.scope === 'MIXED') && (
                                <div>
                                    <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#475569' }}>% Chiết khấu toàn danh mục *</label>
                                    <input 
                                        type="number" 
                                        placeholder="VD: 15" 
                                        value={form.discountPct} 
                                        onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))} 
                                        style={{ ...inputStyle, background: '#FFFFFF' }} 
                                    />
                                </div>
                            )}

                            {(form.scope === 'SPECIFIC_PRODUCTS' || form.scope === 'MIXED') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase block" style={{ color: '#475569' }}>Đề xuất giá theo chai *</label>
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
                                                className="text-xs flex items-center gap-1 text-[#0891B2] font-semibold hover:underline"
                                            >
                                                <Plus size={12} /> Thêm dòng
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2.5">
                                        {priceLines.map((line, idx) => {
                                            const selectedProd = products.find(p => p.id === line.productId)
                                            const wholesale = selectedProd ? selectedProd.wholesalePrice : 0
                                            const diffPct = wholesale > 0 && line.proposedPrice > 0 ? ((line.proposedPrice - wholesale) / wholesale) * 100 : 0
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className="flex flex-col sm:flex-row gap-2.5 sm:items-end p-2.5 rounded-md relative shadow-2xs" 
                                                    style={{ 
                                                        background: '#FFFFFF', 
                                                        border: '1px solid #E2E8F0',
                                                        zIndex: priceLines.length - idx + 10
                                                    }}
                                                >
                                                    <div className="flex-1 min-w-0 w-full">
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
                                                    </div>
                                                    
                                                    <div className="flex items-end justify-between sm:justify-end gap-2.5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                                        <div className="w-20 flex-shrink-0">
                                                            <label className="text-[9px] block text-slate-600">Số lượng</label>
                                                            <input 
                                                                type="number"
                                                                min={1}
                                                                value={line.quantity || 1}
                                                                onChange={e => {
                                                                    const copy = [...priceLines]
                                                                    copy[idx].quantity = Math.max(1, parseInt(e.target.value) || 1)
                                                                    setPriceLines(copy)
                                                                }}
                                                                style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#FFFFFF', fontWeight: 'bold', color: '#D4A853', textAlign: 'center' }}
                                                            />
                                                        </div>

                                                        <div className="w-28 flex-shrink-0">
                                                            <div className="flex items-center justify-between mb-0.5">
                                                                <label className="text-[9px]" style={{ color: '#64748B' }}>Giá đề xuất</label>
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
                                                                style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', background: '#FFFFFF', fontWeight: 'bold', color: '#0891B2' }}
                                                            />
                                                        </div>
                                                        
                                                        <div className="text-right flex flex-col justify-end pb-1 pr-1 min-w-[70px] sm:min-w-[75px] flex-shrink-0">
                                                            <span className="text-[9px] block text-gray-500">Gốc (WS)</span>
                                                            <span className="text-[11px] block font-mono font-semibold" style={{ color: '#0F172A' }}>{formatVND(wholesale)}</span>
                                                        </div>

                                                        <button 
                                                            type="button" 
                                                            onClick={() => setPriceLines(priceLines.filter((_, i) => i !== idx))}
                                                            className="p-1.5 rounded text-red-400 hover:bg-red-500/10 mb-0.5 cursor-pointer flex-shrink-0"
                                                            title="Xóa dòng"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {priceLines.length === 0 && (
                                            <p className="text-center text-xs py-4 text-gray-400 border border-dashed border-slate-200 rounded-md">
                                                Bấm nút <strong className="text-[#0891B2]">"Thêm dòng"</strong> hoặc <strong className="text-[#D4A853]">"Chọn nhanh hàng loạt"</strong> để chọn sản phẩm đề xuất.
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
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{t.createDrawer.priorityLabel}</label>
                        <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
                            {Object.entries(PRIORITY_LABELS).map(([k]) => (
                                <option key={k} value={k}>{getPriorityLabel(k, locale).label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Title & English Title */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>
                                {locale === 'en' ? 'Title (Vietnamese) *' : 'Tiêu đề (Tiếng Việt) *'}
                            </label>
                            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                placeholder={locale === 'en' ? 'e.g. Special pricing proposal for Daewoo Hotel' : 'VD: Đề xuất giá đặc biệt cho Khách sạn Daewoo'}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#0891B2'}
                                onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 flex items-center justify-between" style={{ color: '#64748B' }}>
                                <span>{locale === 'en' ? 'Title (English)' : 'Tiêu đề tiếng Anh / English Title'}</span>
                                <span className="text-[10px] lowercase font-normal text-slate-400">{locale === 'en' ? '(Bilingual option)' : '(Tùy chọn song ngữ)'}</span>
                            </label>
                            <input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))}
                                placeholder="e.g. Special pricing proposal for Daewoo Hotel"
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#0891B2'}
                                onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                        </div>
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{t.createDrawer.contentLabel}</label>
                        <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            rows={5} placeholder={t.createDrawer.contentPlaceholder}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#0891B2'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    </div>

                    {/* Justification */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{locale === 'en' ? 'Justification & Analysis' : 'Lý do & phân tích'}</label>
                        <textarea value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                            rows={3} placeholder={locale === 'en' ? 'Provide background, rationale, and cost-benefit analysis...' : 'Căn cứ và phân tích chi phí/lợi ích...'}
                            style={{ ...inputStyle, resize: 'vertical' }}
                            onFocus={e => e.target.style.borderColor = '#0891B2'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    </div>

                    {/* Expected Outcome */}
                    <div>
                        <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{locale === 'en' ? 'Expected Outcome' : 'Kết quả kỳ vọng'}</label>
                        <input value={form.expectedOutcome} onChange={e => setForm(f => ({ ...f, expectedOutcome: e.target.value }))}
                            placeholder={locale === 'en' ? 'e.g. Expand 15 new SKUs, increase revenue by 20%' : 'VD: Mở rộng danh mục 15 SKU mới, tăng doanh thu 20%'}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#0891B2'}
                            onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                    </div>

                    {/* Amount + Deadline row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{t.createDrawer.valueLabel}</label>
                            <input type="number" value={form.estimatedAmount}
                                onChange={e => setForm(f => ({ ...f, estimatedAmount: e.target.value }))}
                                placeholder="0" style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#0891B2'}
                                onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase mb-1.5 block" style={{ color: '#64748B' }}>{locale === 'en' ? 'Deadline' : 'Hạn xử lý'}</label>
                            <input type="date" value={form.deadline}
                                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                                style={inputStyle}
                                onFocus={e => e.target.style.borderColor = '#0891B2'}
                                onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                        </div>
                    </div>

                    {/* Submit buttons */}
                    <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid #E2E8F0' }}>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                            style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                            {t.actions.saveDraft}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-3 text-sm font-medium rounded-md"
                            style={{ background: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0' }}
                        >
                            {t.actions.cancel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Detail Drawer ───────────────────────────────
function DetailDrawer({ detail, loading, actionLoading, onClose, userId, isCEO, userRoles, onApproval, onRefresh, onPrint }: {
    detail: ProposalDetail | null
    loading: boolean
    actionLoading?: string | null
    onClose: () => void
    userId: string
    isCEO: boolean
    userRoles: string[]
    onApproval: (action: 'APPROVE' | 'REJECT' | 'RETURN', comment?: string) => void
    onRefresh: () => void
    onPrint: (lang?: 'BILINGUAL' | 'VI' | 'EN') => void
}) {
    const { locale } = useAppLocale()
    const t = PROPOSALS_I18N[locale] || PROPOSALS_I18N.vi
    const [comment, setComment] = useState('')
    const [sendingComment, setSendingComment] = useState(false)
    const [printMenuOpen, setPrintMenuOpen] = useState(false)

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
    const bilingualTitle = formatBilingualTitle(detail?.title, locale)

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-2xl h-full overflow-y-auto" style={{ background: '#FFFFFF', borderLeft: '1px solid #E2E8F0' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <h3 className="text-base sm:text-lg font-bold truncate max-w-[150px] sm:max-w-none flex items-center gap-1.5" style={{ color: '#0F172A' }}>
                        <ClipboardCheck size={18} className="flex-shrink-0" style={{ color: '#0891B2' }} />
                        <span className="truncate">{t.detailDrawer.title}</span>
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {detail && (
                            <div className="relative flex items-center">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setPrintMenuOpen(false)
                                        onPrint('BILINGUAL')
                                    }}
                                    className="px-2 sm:px-2.5 py-1.5 text-xs font-semibold rounded-l flex items-center gap-1 transition-all cursor-pointer hover:opacity-90 whitespace-nowrap"
                                    style={{ background: 'rgba(212,168,83,0.18)', color: '#B45309', border: '1px solid rgba(212,168,83,0.4)', borderRight: 'none' }}
                                    title={locale === 'en' ? 'Print Bilingual (Default)' : 'In bản Song Ngữ (Mặc định)'}
                                >
                                    <Printer size={13} />
                                    <span className="hidden sm:inline">{locale === 'en' ? 'Print Bilingual (VI - EN)' : 'In Song Ngữ (VI - EN)'}</span>
                                    <span className="inline sm:hidden">{locale === 'en' ? 'Print Bilingual' : 'In Song Ngữ'}</span>
                                </button>
                                <div className="relative">
                                    <button 
                                        type="button"
                                        onClick={() => setPrintMenuOpen(prev => !prev)}
                                        className="px-1.5 py-1.5 text-xs font-semibold rounded-r flex items-center transition-all cursor-pointer hover:opacity-90"
                                        style={{ background: 'rgba(212,168,83,0.18)', color: '#B45309', border: '1px solid rgba(212,168,83,0.4)' }}
                                        title={locale === 'en' ? 'Print language options' : 'Tùy chọn ngôn ngữ in'}
                                    >
                                        <ChevronDown size={13} />
                                    </button>
                                    {printMenuOpen && (
                                        <>
                                            <div 
                                                className="fixed inset-0 z-40" 
                                                onClick={() => setPrintMenuOpen(false)} 
                                            />
                                            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg shadow-xl border border-slate-200 bg-white py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setPrintMenuOpen(false)
                                                        onPrint('BILINGUAL')
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="text-sm">🌐</span> {locale === 'en' ? 'Print Bilingual (Default)' : 'In Song Ngữ (Mặc định)'}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setPrintMenuOpen(false)
                                                        onPrint('VI')
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="text-sm">🇻🇳</span> {locale === 'en' ? 'Print Vietnamese' : 'In Tiếng Việt'}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setPrintMenuOpen(false)
                                                        onPrint('EN')
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="text-sm">🇬🇧</span> {locale === 'en' ? 'Print English' : 'Print in English'}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 cursor-pointer"><X size={18} style={{ color: '#64748B' }} /></button>
                    </div>
                </div>

                {loading || !detail ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin" style={{ color: '#0891B2' }} />
                    </div>
                ) : (
                    <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
                        {/* Title + Meta */}
                        <div>
                            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold" style={{ color: '#0891B2' }}>
                                    {detail.proposalNo}
                                </span>
                                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold"
                                    style={{ background: getPriorityLabel(detail.priority, locale)?.bg, color: getPriorityLabel(detail.priority, locale)?.color }}>
                                    {getPriorityLabel(detail.priority, locale)?.label}
                                </span>
                                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ background: getStatusLabel(detail.status, locale)?.bg, color: getStatusLabel(detail.status, locale)?.color }}>
                                    {getStatusLabel(detail.status, locale)?.label}
                                </span>
                            </div>
                            <div className="mb-1.5">
                                <h4 className="text-lg sm:text-xl font-bold leading-snug" style={{ color: '#0F172A' }}>
                                    {bilingualTitle.main}
                                </h4>
                                {bilingualTitle.sub && (
                                    <p className="text-xs sm:text-sm font-medium italic mt-0.5 text-slate-500">
                                        {bilingualTitle.sub}
                                    </p>
                                )}
                            </div>
                            <p className="text-xs" style={{ color: '#64748B' }}>
                                {detail.creator.name} · {getCategoryLabel(detail.category, locale)} ·
                                {detail.estimatedAmount ? ` ${formatVND(detail.estimatedAmount)}` : (locale === 'en' ? ' No value' : ' Không có giá trị')} ·
                                {detail.submittedAt 
                                    ? ` ${locale === 'en' ? 'Submitted' : 'Trình'} ${new Date(detail.submittedAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}` 
                                    : (locale === 'en' ? ' Not submitted' : ' Chưa trình')}
                            </p>
                        </div>

                        {/* Approval Progress */}
                        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#64748B' }}>{t.detailDrawer.approvalMatrix}</p>
                            <div className="flex items-center gap-2">
                                {detail.requiredLevels.map((level, i) => {
                                    const log = detail.approvalLogs.find(l => l.level === level)
                                    const isCurrent = detail.currentLevel === level && isPending
                                    const isDone = log?.action === 'APPROVE'
                                    const isRejected = log?.action === 'REJECT'
                                    const levelLabel = level === 1 
                                        ? (locale === 'en' ? 'Dept Mgr' : 'TP Bộ phận') 
                                        : level === 2 
                                            ? (locale === 'en' ? 'Chief Acc' : 'KT Trưởng') 
                                            : 'CEO'

                                    return (
                                        <React.Fragment key={level}>
                                            {i > 0 && <div className="flex-1 h-0.5 rounded" style={{ background: isDone ? '#5BA88A' : '#E2E8F0' }} />}
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                                    style={{
                                                        background: isDone ? 'rgba(91,168,138,0.2)' : isRejected ? 'rgba(139,26,46,0.2)' : isCurrent ? 'rgba(212,168,83,0.2)' : '#FFFFFF',
                                                        border: `2px solid ${isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#E2E8F0'}`,
                                                        color: isDone ? '#5BA88A' : isRejected ? '#8B1A2E' : isCurrent ? '#D4A853' : '#64748B',
                                                    }}>
                                                        {isDone ? '✓' : isRejected ? '✗' : level}
                                                </div>
                                                <span className="text-xs font-medium" style={{ color: isCurrent ? '#D4A853' : '#64748B' }}>
                                                    {levelLabel}
                                                </span>
                                                {log && (
                                                    <span className="text-[10px]" style={{ color: '#64748B' }}>
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
                            <div className="p-4 rounded-md space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <p className="text-xs font-semibold uppercase" style={{ color: '#0891B2' }}>
                                    {locale === 'en' ? 'Special Pricing & Mechanism Information' : 'Thông Tin Áp Dụng Cơ Chế Giá & Giá Đặc Biệt'}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                        <p style={{ color: '#64748B' }}>{locale === 'en' ? 'Applicable Customer' : 'Khách hàng áp dụng'}</p>
                                        <p className="font-bold mt-0.5" style={{ color: '#0F172A' }}>{detail.customer?.name} ({detail.customer?.code || 'N/A'})</p>
                                    </div>
                                    <div className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                        <p style={{ color: '#64748B' }}>{locale === 'en' ? 'Scope of Application' : 'Phạm vi áp dụng'}</p>
                                        <p className="font-bold mt-0.5" style={{ color: '#0F172A' }}>
                                            {detail.scope === 'ENTIRE_PORTFOLIO' ? (locale === 'en' ? 'Entire Portfolio' : 'Toàn danh mục') : 
                                             detail.scope === 'SPECIFIC_PRODUCTS' ? (locale === 'en' ? 'Specific Products' : 'Một số sản phẩm') : 
                                             detail.scope === 'MIXED' ? (locale === 'en' ? 'Mixed' : 'Kết hợp') : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded text-xs" style={{ background: '#FFFFFF' }}>
                                    <p style={{ color: '#64748B' }}>{locale === 'en' ? 'Validity Period (Start & End Date)' : 'Thời hạn hiệu lực (Ngày bắt đầu & Kết thúc)'}</p>
                                    <p className="font-bold mt-0.5" style={{ color: '#0891B2' }}>
                                        📅 {detail.startDate ? new Date(detail.startDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN') : (locale === 'en' ? 'From approval date' : 'Từ ngày phê duyệt')} 
                                        {' ➔ '} 
                                        {detail.endDate ? new Date(detail.endDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN') : (locale === 'en' ? 'Until further notice (Indefinite)' : 'Khi có thông báo mới (không thời hạn)')}
                                    </p>
                                </div>
                                
                                {detail.discountPct !== null && detail.discountPct !== undefined && (
                                    <div className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                        <p className="text-xs" style={{ color: '#64748B' }}>{locale === 'en' ? 'Entire portfolio discount' : 'Chiết khấu toàn danh mục'}</p>
                                        <p className="text-lg font-bold" style={{ color: '#D4A853' }}>{detail.discountPct}%</p>
                                    </div>
                                )}

                                {detail.priceItems && detail.priceItems.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-xs" style={{ color: '#64748B' }}>{locale === 'en' ? 'Proposed price item list:' : 'Danh sách sản phẩm đề xuất giá:'}</p>
                                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                            {detail.priceItems.map((item: any) => {
                                                const originalPrice = item.product?.wholesalePrice || 0
                                                const diff = originalPrice > 0 
                                                    ? ((item.proposedPrice - originalPrice) / originalPrice) * 100 
                                                    : 0
                                                return (
                                                    <div key={item.id} className="flex justify-between items-center p-2 rounded text-xs" style={{ background: '#FFFFFF' }}>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium truncate" style={{ color: '#0F172A' }}>{item.product?.productName}</p>
                                                            <p className="text-[10px] font-mono" style={{ color: '#64748B' }}>{item.product?.skuCode}</p>
                                                        </div>
                                                        <div className="text-right pl-3 flex items-center gap-2">
                                                            <div>
                                                                <p className="font-bold" style={{ color: '#0891B2' }}>{formatVND(item.proposedPrice)}</p>
                                                                <p className="text-[10px] font-mono" style={{ color: '#64748B' }}>{locale === 'en' ? 'Orig: ' : 'Gốc: '}{formatVND(originalPrice)}</p>
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
                                            {locale === 'en' ? '🍷 TASTING & SAMPLE PROPOSAL' : '🍷 TỜ TRÌNH TASTING & THỬ VANG'}
                                        </p>
                                        {['APPROVED', 'IN_PROGRESS', 'CLOSED'].includes(detail.status) && (
                                            <a
                                                href={`/dashboard/sales?action=createTasting&proposalId=${detail.id}&customerId=${detail.customerId || ''}`}
                                                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                                            >
                                                {locale === 'en' ? '🍷 + Create Tasting Order' : '🍷 + Lên Đơn Tasting Ngay'}
                                            </a>
                                        )}
                                    </div>
                                    {detail.customer && (
                                        <p className="text-xs font-medium" style={{ color: '#78350F' }}>
                                            {locale === 'en' ? 'Applicable customer: ' : 'Khách hàng áp dụng: '}<strong style={{ color: '#451A03', fontWeight: 700 }}>{detail.customer.name}</strong> ({detail.customer.code})
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Linked Sales Orders List */}
                            {(detail as any).salesOrders && (detail as any).salesOrders.length > 0 && (
                                <div className="p-4 rounded-md space-y-2.5 bg-white border border-slate-200">
                                    <p className="text-xs font-bold uppercase text-[#0891B2] flex items-center justify-between">
                                        <span>📦 {locale === 'en' ? `Orders Created Under This Proposal (${(detail as any).salesOrders.length})` : `Các Đơn Hàng Đã Lên Theo Tờ Trình Này (${(detail as any).salesOrders.length})`}</span>
                                    </p>
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                        {(detail as any).salesOrders.map((so: any) => (
                                            <div key={so.id} className="flex justify-between items-center p-2 rounded bg-white text-xs border border-slate-200/40">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-[#0891B2]">{so.soNo}</span>
                                                    {so.orderType === 'TASTING' && (
                                                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-amber-950 text-amber-300 border border-amber-500/40">🍷 Tasting</span>
                                                    )}
                                                    <span className="text-[10px] text-gray-400">{new Date(so.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'vi-VN')}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-slate-900">{formatVND(Number(so.totalAmount))}</span>
                                                    <a href={`/dashboard/sales?search=${so.soNo}`} className="text-[11px] text-[#0891B2] hover:underline font-semibold">
                                                        {locale === 'en' ? 'View SO →' : 'Xem SO →'}
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#0891B2' }}>
                                    {locale === 'en' ? 'Content' : 'Nội dung'}
                                </p>
                                <p className="text-sm whitespace-pre-wrap" style={{ color: '#0F172A', lineHeight: 1.6 }}>{detail.content}</p>
                            </div>
                            {detail.justification && (
                                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#D4A853' }}>
                                        {locale === 'en' ? 'Justification & Analysis' : 'Lý do & Phân tích'}
                                    </p>
                                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#0F172A', lineHeight: 1.6 }}>{detail.justification}</p>
                                </div>
                            )}
                            {detail.expectedOutcome && (
                                <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#5BA88A' }}>
                                        {locale === 'en' ? 'Expected Outcome' : 'Kết quả kỳ vọng'}
                                    </p>
                                    <p className="text-sm" style={{ color: '#0F172A' }}>{detail.expectedOutcome}</p>
                                </div>
                            )}
                        </div>

                        {/* Approval Audit Trail Table */}
                        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-[#0891B2] flex items-center justify-between">
                                <span>📋 {locale === 'en' ? 'Digital Audit Trail' : 'Tiến Trình Duyệt Hệ Thống (Digital Audit Trail)'}</span>
                                <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {locale === 'en' ? '3 Approval Levels' : '3 Cấp Phê Duyệt'}
                                </span>
                            </p>
                            
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-white text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="p-2.5 text-center w-10">#</th>
                                            <th className="p-2.5">{locale === 'en' ? 'Level / Role' : 'Cấp Duyệt / Vai Trò'}</th>
                                            <th className="p-2.5">{locale === 'en' ? 'Action By' : 'Người Thực Hiện'}</th>
                                            <th className="p-2.5 text-center">{locale === 'en' ? 'Status' : 'Trạng Thái'}</th>
                                            <th className="p-2.5 text-center">{locale === 'en' ? 'Timestamp' : 'Thời Gian'}</th>
                                            <th className="p-2.5">{locale === 'en' ? 'Comments / Feedback' : 'Ghi Chú / Ý Kiến'}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/60 text-slate-900">
                                        {/* Step 0: Creator */}
                                        <tr className="hover:bg-white/50">
                                            <td className="p-2.5 text-center font-mono text-gray-400">1</td>
                                            <td className="p-2.5 font-medium text-slate-600 whitespace-nowrap">
                                                {locale === 'en' ? 'Proposal Creator' : 'Người Lập Tờ Trình'}
                                            </td>
                                            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{detail.creator?.name || '—'}</td>
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                    ✓ {locale === 'en' ? 'Created & Submitted' : 'Đã lập & trình'}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-center text-gray-400 font-mono text-[11px] whitespace-nowrap">
                                                {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') : (detail.createdAt ? new Date(detail.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') : '—')}
                                            </td>
                                            <td className="p-2.5 italic text-gray-400 text-[11px]">
                                                {locale === 'en' ? 'Initiated proposal' : 'Khởi tạo tờ trình'}
                                            </td>
                                        </tr>

                                        {/* Steps 1-3 */}
                                        {[
                                            { level: 1, label: locale === 'en' ? 'Level 1: Dept Manager' : 'Cấp 1: Trưởng Bộ Phận' },
                                            { level: 2, label: locale === 'en' ? 'Level 2: Chief Accountant' : 'Cấp 2: Kế Toán Trưởng' },
                                            { level: 3, label: locale === 'en' ? 'Level 3: Executive Board (CEO)' : 'Cấp 3: Tổng Giám Đốc (CEO)' },
                                        ].map((step, idx) => {
                                            const log = detail.approvalLogs.find(l => l.level === step.level)
                                            return (
                                                <tr key={step.level} className="hover:bg-white/50">
                                                    <td className="p-2.5 text-center font-mono text-gray-400">{idx + 2}</td>
                                                    <td className="p-2.5 font-medium text-slate-600 whitespace-nowrap">{step.label}</td>
                                                    <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{log?.approver?.name || '—'}</td>
                                                    <td className="p-2.5 text-center whitespace-nowrap">
                                                        {log ? (
                                                            log.action === 'APPROVE' ? (
                                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                                    ✓ {locale === 'en' ? 'Approved' : 'Đã duyệt'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                                                    ✗ {locale === 'en' ? 'Rejected' : 'Từ chối'}
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/40 text-gray-400 border border-gray-600/30 whitespace-nowrap">
                                                                ⏳ {locale === 'en' ? 'Pending' : 'Chưa duyệt'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2.5 text-center text-gray-400 font-mono text-[11px] whitespace-nowrap">
                                                        {log ? new Date(log.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN') : '—'}
                                                    </td>
                                                    <td className="p-2.5 italic text-gray-400 text-[11px]">
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
                        <div className="p-4 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <p className="text-xs font-semibold uppercase mb-3" style={{ color: '#64748B' }}>
                                <MessageSquare size={12} className="inline mr-1" />
                                {locale === 'en' ? `Discussion (${detail.comments.length})` : `Thảo Luận (${detail.comments.length})`}
                            </p>
                            <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                                {detail.comments.map(c => (
                                    <div key={c.id} className="p-2.5 rounded" style={{ background: '#FFFFFF' }}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-semibold" style={{ color: '#0891B2' }}>{c.author.name}</span>
                                            <span className="text-xs" style={{ color: '#64748B' }}>{new Date(c.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}</span>
                                        </div>
                                        <p className="text-sm" style={{ color: '#0F172A' }}>{c.content}</p>
                                    </div>
                                ))}
                                {detail.comments.length === 0 && (
                                    <p className="text-xs text-center py-4" style={{ color: '#64748B' }}>
                                        {locale === 'en' ? 'No comments yet' : 'Chưa có thảo luận'}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder={locale === 'en' ? 'Type a comment...' : 'Nhập bình luận...'}
                                    className="flex-1 px-3 py-2 text-sm rounded-md"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', outline: 'none' }}
                                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                                    onFocus={e => e.target.style.borderColor = '#0891B2'}
                                    onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                                <button onClick={handleComment} disabled={sendingComment}
                                    className="px-3 py-2 rounded-md transition-all cursor-pointer"
                                    style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                                    {sendingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Action Bar */}
                        {canApproveDetail && (
                            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-md shadow-2xs" style={{ background: 'rgba(212,168,83,0.05)', border: '2px solid rgba(212,168,83,0.2)' }}>
                                <button
                                    onClick={() => onApproval('APPROVE')}
                                    disabled={Boolean(actionLoading)}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:opacity-95"
                                    style={{ background: 'rgba(91,168,138,0.25)', color: '#2E7D5B', border: '1px solid rgba(91,168,138,0.5)' }}>
                                    {actionLoading === detail.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} 
                                    {locale === 'en' ? 'Approve Proposal' : 'Duyệt Tờ Trình'}
                                </button>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => {
                                            const reason = prompt(locale === 'en' ? 'Notes for return:' : 'Ghi chú khi trả lại:')
                                            if (reason) onApproval('RETURN', reason)
                                        }}
                                        disabled={Boolean(actionLoading)}
                                        className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                                        style={{ background: 'rgba(196,90,42,0.1)', color: '#C45A2A', border: '1px solid rgba(196,90,42,0.2)' }}>
                                        <RotateCcw size={14} className="inline mr-1" /> {locale === 'en' ? 'Return' : 'Trả Lại'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            const reason = prompt(locale === 'en' ? 'Reason for rejection:' : 'Lý do từ chối:')
                                            if (reason) onApproval('REJECT', reason)
                                        }}
                                        disabled={Boolean(actionLoading)}
                                        className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:opacity-90"
                                        style={{ background: 'rgba(139,26,46,0.1)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.2)' }}>
                                        <XCircle size={14} className="inline mr-1" /> {locale === 'en' ? 'Reject' : 'Từ Chối'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Post-approval actions */}
                        {detail.status === 'APPROVED' && isCEO && (
                            <div className="flex gap-3">
                                <button onClick={async () => { await updateProposalStatus(detail.id, 'IN_PROGRESS', userId); onRefresh() }}
                                    className="flex-1 py-2.5 text-sm font-semibold rounded-md cursor-pointer"
                                    style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.25)' }}>
                                    <ArrowRight size={14} className="inline mr-1" /> {locale === 'en' ? 'Mark In Progress' : 'Chuyển "Đang thực hiện"'}
                                </button>
                            </div>
                        )}
                        {detail.status === 'IN_PROGRESS' && isCEO && (
                            <button onClick={async () => { await updateProposalStatus(detail.id, 'CLOSED', userId); onRefresh() }}
                                className="w-full py-2.5 text-sm font-semibold rounded-md cursor-pointer"
                                style={{ background: 'rgba(74,106,122,0.15)', color: '#64748B', border: '1px solid rgba(74,106,122,0.3)' }}>
                                <CheckCircle2 size={14} className="inline mr-1" /> {locale === 'en' ? 'Mark Completed' : 'Đánh dấu Hoàn tất'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
