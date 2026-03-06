'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, CheckCircle2, Loader2, Filter, ChevronDown } from 'lucide-react'
import { getComplaintTickets, resolveComplaintTicket, COMPLAINT_TYPES, COMPLAINT_SEVERITY, type ComplaintRow } from './actions'

const SEVERITY_CFG: Record<string, { label: string; color: string; bg: string }> = {
    CRITICAL: { label: '🔴 Critical', color: '#E05252', bg: 'rgba(224,82,82,0.12)' },
    HIGH: { label: '🟠 High', color: '#C07434', bg: 'rgba(192,116,52,0.12)' },
    MEDIUM: { label: '🟡 Medium', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
    LOW: { label: '🟢 Low', color: '#5BA88A', bg: 'rgba(91,168,138,0.12)' },
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Mở', color: '#D4A853', bg: 'rgba(212,168,83,0.12)' },
    IN_PROGRESS: { label: 'Đang xử lý', color: '#4A8FAB', bg: 'rgba(74,143,171,0.12)' },
    RESOLVED: { label: 'Đã giải quyết', color: '#5BA88A', bg: 'rgba(91,168,138,0.12)' },
    CLOSED: { label: 'Đã đóng', color: '#4A6A7A', bg: 'rgba(74,106,122,0.12)' },
}

const TYPE_LABEL: Record<string, string> = {
    QUALITY: 'Chất lượng',
    DELIVERY: 'Giao hàng',
    BILLING: 'Thanh toán',
    SERVICE: 'Dịch vụ',
    PACKAGING: 'Đóng gói',
    OTHER: 'Khác',
}

export function ComplaintTicketsPanel() {
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
        await resolveComplaintTicket(id, resolutionText)
        setResolutionText('')
        setExpandedId(null)
        await load()
        setResolving(null)
    }

    const openCount = tickets?.filter(t => t.status === 'OPEN').length ?? 0
    const overSLACount = tickets?.filter(t => t.isOverSLA).length ?? 0

    if (loading || !tickets) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#D4A853' }} />
                <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải tickets...</span>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} style={{ color: '#D4A853' }} />
                    <h3 className="text-lg font-semibold" style={{ color: '#E8F1F2', fontFamily: '"Cormorant Garamond", serif' }}>
                        Phiếu Khiếu Nại
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>{tickets.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    {overSLACount > 0 && (
                        <span className="text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1"
                            style={{ color: '#E05252', background: 'rgba(224,82,82,0.12)' }}>
                            <Clock size={11} /> {overSLACount} vượt SLA
                        </span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-full font-semibold"
                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)' }}>
                        {openCount} mở
                    </span>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                <select className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); load(e.target.value, severityFilter) }}>
                    <option value="">Tất cả trạng thái</option>
                    <option value="OPEN">Mở</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="RESOLVED">Đã giải quyết</option>
                    <option value="CLOSED">Đã đóng</option>
                </select>
                <select className="px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    value={severityFilter}
                    onChange={e => { setSeverityFilter(e.target.value); load(statusFilter, e.target.value) }}>
                    <option value="">Tất cả mức độ</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                </select>
            </div>

            {/* Tickets */}
            {tickets.length === 0 ? (
                <div className="text-center py-16 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                    <CheckCircle2 size={28} style={{ color: '#5BA88A', margin: '0 auto' }} />
                    <p className="text-sm mt-3" style={{ color: '#5BA88A' }}>Không có phiếu khiếu nại</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {tickets.map(t => {
                        const sevCfg = SEVERITY_CFG[t.severity] ?? SEVERITY_CFG.MEDIUM
                        const stCfg = STATUS_CFG[t.status] ?? STATUS_CFG.OPEN
                        const isExpanded = expandedId === t.id
                        return (
                            <div key={t.id} className="rounded-lg overflow-hidden"
                                style={{
                                    background: '#1B2E3D',
                                    border: `1px solid ${t.isOverSLA ? 'rgba(224,82,82,0.4)' : '#2A4355'}`,
                                    borderLeft: `3px solid ${t.isOverSLA ? '#E05252' : sevCfg.color}`,
                                }}>
                                <button onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                    className="w-full text-left p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-xs font-bold flex-shrink-0" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>
                                            {t.ticketNo}
                                        </span>
                                        <span className="text-sm font-medium truncate" style={{ color: '#E8F1F2' }}>
                                            {t.subject}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: sevCfg.color, background: sevCfg.bg }}>
                                            {sevCfg.label}
                                        </span>
                                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: stCfg.color, background: stCfg.bg }}>
                                            {stCfg.label}
                                        </span>
                                        {t.isOverSLA && (
                                            <span className="text-xs px-1.5 py-0.5 rounded font-bold"
                                                style={{ color: '#E05252', background: 'rgba(224,82,82,0.12)' }}>⏰ SLA</span>
                                        )}
                                        <ChevronDown size={14} style={{
                                            color: '#4A6A7A',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                            transition: 'transform 0.2s'
                                        }} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #2A4355' }}>
                                        <div className="grid grid-cols-3 gap-3 pt-3">
                                            <div>
                                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Khách hàng</p>
                                                <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{t.customerName}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Loại</p>
                                                <p className="text-sm font-medium" style={{ color: '#8AAEBB' }}>
                                                    {TYPE_LABEL[t.type] ?? t.type}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Ngày tạo</p>
                                                <p className="text-xs font-medium" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                                    {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs mb-1" style={{ color: '#4A6A7A' }}>Mô tả</p>
                                            <p className="text-sm" style={{ color: '#E8F1F2' }}>{t.description}</p>
                                        </div>
                                        {t.resolution && (
                                            <div className="p-3 rounded" style={{ background: 'rgba(91,168,138,0.08)', border: '1px solid rgba(91,168,138,0.2)' }}>
                                                <p className="text-xs font-semibold mb-1" style={{ color: '#5BA88A' }}>✅ Giải quyết</p>
                                                <p className="text-sm" style={{ color: '#E8F1F2' }}>{t.resolution}</p>
                                            </div>
                                        )}
                                        {t.status !== 'RESOLVED' && t.status !== 'CLOSED' && (
                                            <div className="flex items-center gap-2">
                                                <input className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                    placeholder="Nhập giải pháp..."
                                                    value={resolving === t.id ? resolutionText : resolutionText}
                                                    onChange={e => setResolutionText(e.target.value)} />
                                                <button onClick={() => handleResolve(t.id)}
                                                    disabled={resolving === t.id || !resolutionText.trim()}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                                                    style={{ background: '#5BA88A', color: '#0A1926' }}>
                                                    {resolving === t.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                    Giải quyết
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
