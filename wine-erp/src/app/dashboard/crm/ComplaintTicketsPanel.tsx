'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2, Loader2, Filter, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { getComplaintTickets, resolveComplaintTicket, type ComplaintRow } from './actions'
import { useAppLocale } from '@/lib/i18n'

const SEVERITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
    CRITICAL: { label: 'Critical', color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
    HIGH: { label: 'High', color: '#C07434', bg: 'rgba(192,116,52,0.12)' },
    MEDIUM: { label: 'Medium', color: '#B45309', bg: 'rgba(180,83,9,0.12)' },
    LOW: { label: 'Low', color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
}

const STATUS_CFG: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
    OPEN: { label: 'Mở', labelEn: 'Open', color: '#B45309', bg: 'rgba(180,83,9,0.12)' },
    IN_PROGRESS: { label: 'Đang xử lý', labelEn: 'In Progress', color: '#1D4ED8', bg: 'rgba(29,78,216,0.12)' },
    RESOLVED: { label: 'Đã giải quyết', labelEn: 'Resolved', color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
    CLOSED: { label: 'Đã đóng', labelEn: 'Closed', color: '#64748B', bg: 'rgba(100,116,139,0.12)' },
}

const TYPE_LABEL: Record<string, { vi: string; en: string }> = {
    QUALITY: { vi: 'Chất lượng', en: 'Quality' },
    DELIVERY: { vi: 'Giao hàng', en: 'Delivery' },
    BILLING: { vi: 'Thanh toán', en: 'Billing' },
    SERVICE: { vi: 'Dịch vụ', en: 'Service' },
    PACKAGING: { vi: 'Đóng gói', en: 'Packaging' },
    OTHER: { vi: 'Khác', en: 'Other' },
}

export function ComplaintTicketsPanel() {
    const { isEn } = useAppLocale()
    const [tickets, setTickets] = useState<ComplaintRow[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [severityFilter, setSeverityFilter] = useState('')
    const [resolving, setResolving] = useState<string | null>(null)
    const [resolutionText, setResolutionText] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const load = async (status?: string, severity?: string) => {
        setLoading(true)
        const data = await getComplaintTickets({
            status: (status ?? statusFilter) || undefined,
            severity: (severity ?? severityFilter) || undefined,
        })
        setTickets(data)
        setLoading(false)
    }

    if (!tickets && !loading) { load() }

    const handleResolve = async (id: string) => {
        if (!resolutionText.trim()) return
        setResolving(id)
        toast.promise(
            resolveComplaintTicket(id, resolutionText).then(async (res: any) => {
                if (res && res.success === false) throw new Error(res.error || (isEn ? 'An error occurred' : 'Có lỗi xảy ra'))
                setResolutionText('')
                setExpandedId(null)
                await load()
                return res
            }),
            {
                loading: isEn ? 'Saving resolution...' : 'Đang lưu giải pháp...',
                success: isEn ? 'Complaint resolved!' : 'Đã giải quyết khiếu nại!',
                error: (err: any) => `${isEn ? 'Error' : 'Lỗi'}: ${err.message}`,
                finally: () => setResolving(null)
            }
        )
    }

    const openCount = tickets?.filter(t => t.status === 'OPEN').length ?? 0
    const overSLACount = tickets?.filter(t => t.isOverSLA).length ?? 0

    if (loading || !tickets) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#B45309' }} />
                <span className="text-sm" style={{ color: '#64748B' }}>{isEn ? 'Loading tickets...' : 'Đang tải tickets...'}</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} style={{ color: '#B45309' }} />
                    <h3 className="text-lg font-semibold" style={{ color: '#0F172A' }}>
                        {isEn ? 'Complaint Tickets' : 'Phiếu Khiếu Nại'}
                    </h3>
                    <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0"
                        style={{ color: '#B45309', background: 'rgba(180,83,9,0.12)' }}>{tickets.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    {overSLACount > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            style={{ color: '#B91C1C', background: 'rgba(185,28,28,0.12)' }}>
                            <Clock size={11} /> {overSLACount} {isEn ? 'over SLA' : 'vượt SLA'}
                        </span>
                    )}
                    <span className="inline-block text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap shrink-0"
                        style={{ color: '#B45309', background: 'rgba(180,83,9,0.12)' }}>
                        {openCount} {isEn ? 'open' : 'mở'}
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <select className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); load(e.target.value, severityFilter) }}>
                    <option value="">{isEn ? 'All statuses' : 'Tất cả trạng thái'}</option>
                    <option value="OPEN">{isEn ? 'Open' : 'Mở'}</option>
                    <option value="IN_PROGRESS">{isEn ? 'In Progress' : 'Đang xử lý'}</option>
                    <option value="RESOLVED">{isEn ? 'Resolved' : 'Đã giải quyết'}</option>
                    <option value="CLOSED">{isEn ? 'Closed' : 'Đã đóng'}</option>
                </select>
                <select className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                    value={severityFilter}
                    onChange={e => { setSeverityFilter(e.target.value); load(statusFilter, e.target.value) }}>
                    <option value="">{isEn ? 'All severities' : 'Tất cả mức độ'}</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>
            </div>

            {/* Tickets */}
            {tickets.length === 0 ? (
                <div className="text-center py-16 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <CheckCircle2 size={28} style={{ color: '#15803D', margin: '0 auto' }} />
                    <p className="text-sm mt-3" style={{ color: '#15803D' }}>{isEn ? 'No complaint tickets' : 'Không có phiếu khiếu nại'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tickets.map(t => {
                        const sevCfg = SEVERITY_CFG[t.severity] ?? SEVERITY_CFG.MEDIUM
                        const stCfg = STATUS_CFG[t.status] ?? STATUS_CFG.OPEN
                        const typeObj = TYPE_LABEL[t.type]
                        const isExpanded = expandedId === t.id
                        return (
                            <div key={t.id} className="rounded-lg overflow-hidden"
                                style={{
                                    background: '#FFFFFF',
                                    border: `1px solid ${t.isOverSLA ? 'rgba(185,28,28,0.4)' : '#E2E8F0'}`,
                                    borderLeft: `3px solid ${t.isOverSLA ? '#B91C1C' : sevCfg.color}`,
                                }}>
                                <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                    className="w-full text-left p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#0891B2' }}>
                                            {t.ticketNo}
                                        </span>
                                        <span className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>
                                            {t.subject}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap shrink-0" style={{ color: sevCfg.color, background: sevCfg.bg }}>
                                            {sevCfg.label}
                                        </span>
                                        <span className="inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap shrink-0" style={{ color: stCfg.color, background: stCfg.bg }}>
                                            {isEn ? stCfg.labelEn : stCfg.label}
                                        </span>
                                        {t.isOverSLA && (
                                            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                                style={{ color: '#B91C1C', background: 'rgba(185,28,28,0.12)' }}>
                                                <Clock size={11} /> SLA
                                            </span>
                                        )}
                                        <ChevronDown size={14} style={{
                                            color: '#64748B',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                            transition: 'transform 0.2s'
                                        }} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #E2E8F0' }}>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                                            <div>
                                                <p className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Customer' : 'Khách hàng'}</p>
                                                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{t.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Type' : 'Loại'}</p>
                                                <p className="text-sm font-medium" style={{ color: '#475569' }}>
                                                    {typeObj ? (isEn ? typeObj.en : typeObj.vi) : t.type}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: '#64748B' }}>{isEn ? 'Created At' : 'Ngày tạo'}</p>
                                                <p className="text-xs font-medium" style={{ color: '#475569' }}>
                                                    {new Date(t.createdAt).toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs mb-1" style={{ color: '#64748B' }}>{isEn ? 'Description' : 'Mô tả'}</p>
                                            <p className="text-sm" style={{ color: '#0F172A' }}>{t.description}</p>
                                        </div>
                                        {t.resolution && (
                                            <div className="p-3 rounded" style={{ background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)' }}>
                                                <p className="text-xs font-semibold mb-1 flex items-center gap-1.5" style={{ color: '#15803D' }}>
                                                    <CheckCircle2 size={13} className="shrink-0" />
                                                    <span>{isEn ? 'Resolution' : 'Giải quyết'}</span>
                                                </p>
                                                <p className="text-sm" style={{ color: '#0F172A' }}>{t.resolution}</p>
                                            </div>
                                        )}
                                        {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                                            <div className="flex items-center gap-2">
                                                <input className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                                    placeholder={isEn ? 'Enter resolution...' : 'Nhập giải pháp...'}
                                                    value={resolving === t.id ? resolutionText : resolutionText}
                                                    onChange={e => setResolutionText(e.target.value)} />
                                                <button onClick={() => handleResolve(t.id)}
                                                    disabled={resolving === t.id || !resolutionText.trim()}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                                                    style={{ background: '#15803D', color: '#FFFFFF' }}>
                                                    {resolving === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                    {isEn ? 'Resolve' : 'Giải quyết'}
                                                </button>
                                            </div>
                                        )}
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
