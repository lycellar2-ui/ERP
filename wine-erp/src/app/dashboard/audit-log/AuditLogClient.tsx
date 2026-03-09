'use client'

import { useState, useTransition } from 'react'
import {
    ScrollText, Search, Filter, ChevronLeft, ChevronRight,
    Calendar, User, Shield, Clock, Activity, AlertTriangle,
    Plus, Edit, Trash2, CheckCircle2, XCircle, RefreshCw,
    Eye, Send, ArrowRight, FileSignature, BarChart3
} from 'lucide-react'
import { getAuditLogsDashboard, type AuditLogRow, type AuditStats, type AuditFilters } from './actions'

// ═══════════════════════════════════════════════════
// ACTION DISPLAY CONFIG
// ═══════════════════════════════════════════════════

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; bgColor: string; label: string }> = {
    CREATE: { icon: Plus, color: '#22C55E', bgColor: 'rgba(34,197,94,0.12)', label: 'Tạo mới' },
    UPDATE: { icon: Edit, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)', label: 'Cập nhật' },
    DELETE: { icon: Trash2, color: '#EF4444', bgColor: 'rgba(239,68,68,0.12)', label: 'Xóa' },
    APPROVE: { icon: CheckCircle2, color: '#22C55E', bgColor: 'rgba(34,197,94,0.12)', label: 'Duyệt' },
    REJECT: { icon: XCircle, color: '#EF4444', bgColor: 'rgba(239,68,68,0.12)', label: 'Từ chối' },
    STATUS_CHANGE: { icon: RefreshCw, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.12)', label: 'Đổi trạng thái' },
    CONFIRM: { icon: CheckCircle2, color: '#06B6D4', bgColor: 'rgba(6,182,212,0.12)', label: 'Xác nhận' },
    LOGIN: { icon: User, color: '#64748B', bgColor: 'rgba(100,116,139,0.12)', label: 'Đăng nhập' },
    EXPORT: { icon: ArrowRight, color: '#64748B', bgColor: 'rgba(100,116,139,0.12)', label: 'Xuất dữ liệu' },
    SIGN: { icon: FileSignature, color: '#87CBB9', bgColor: 'rgba(135,203,185,0.12)', label: 'Ký duyệt' },
    RETURN: { icon: RefreshCw, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.12)', label: 'Trả lại' },
}

const ENTITY_LABELS: Record<string, string> = {
    Product: 'Sản phẩm', Customer: 'Khách hàng', Supplier: 'Nhà cung cấp',
    SalesOrder: 'Đơn bán hàng', PurchaseOrder: 'Đơn mua hàng',
    PriceList: 'Bảng giá', PriceListLine: 'Dòng bảng giá', PriceList_BulkUpdate: 'Điều chỉnh giá hàng loạt',
    GoodsReceipt: 'Nhập kho', DeliveryOrder: 'Xuất kho',
    Quotation: 'Báo giá', StockLot: 'Lô hàng', Contract: 'Hợp đồng',
    User: 'Người dùng', Role: 'Vai trò', UserRole: 'Gán vai trò', RolePermission: 'Phân quyền',
    Proposal: 'Tờ trình', ApprovalRequest: 'Yêu cầu duyệt',
    POSOrder: 'Đơn POS', Transfer: 'Chuyển kho',
}

function getActionConfig(action: string) {
    return ACTION_CONFIG[action] ?? { icon: Activity, color: '#64748B', bgColor: 'rgba(100,116,139,0.12)', label: action }
}

function formatEntityType(type: string) {
    return ENTITY_LABELS[type] ?? type.replace(/_/g, ' ')
}

function formatTimeAgo(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} giờ trước`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} ngày trước`
    return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
}

// ═══════════════════════════════════════════════════
// FIELD DIFF VIEWER
// ═══════════════════════════════════════════════════

function FieldDiffViewer({ oldValue, newValue, action }: { oldValue: any; newValue: any; action: string }) {
    if (action === 'CREATE' && newValue) {
        const entries = Object.entries(newValue).filter(([k]) => !k.startsWith('_'))
        if (entries.length === 0) return null
        return (
            <div className="mt-2 space-y-1">
                {entries.slice(0, 6).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span style={{ color: '#4A6A7A' }}>{key}:</span>
                        <span style={{ color: '#22C55E' }}>{formatFieldValue(val)}</span>
                    </div>
                ))}
                {entries.length > 6 && <span className="text-xs" style={{ color: '#4A6A7A' }}>+{entries.length - 6} trường khác</span>}
            </div>
        )
    }

    if (action === 'DELETE' && oldValue) {
        const entries = Object.entries(oldValue).filter(([k]) => !k.startsWith('_'))
        if (entries.length === 0) return null
        return (
            <div className="mt-2 space-y-1">
                {entries.slice(0, 4).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span style={{ color: '#4A6A7A' }}>{key}:</span>
                        <span style={{ color: '#EF4444', textDecoration: 'line-through' }}>{formatFieldValue(val)}</span>
                    </div>
                ))}
            </div>
        )
    }

    // UPDATE — show field changes
    if ((action === 'UPDATE' || action === 'STATUS_CHANGE') && oldValue) {
        const fieldChanges = (oldValue as any)?._fieldChanges
        if (Array.isArray(fieldChanges) && fieldChanges.length > 0) {
            return (
                <div className="mt-2 space-y-1.5">
                    {fieldChanges.slice(0, 5).map((fc: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                            <span className="font-medium" style={{ color: '#8AAEBB' }}>{fc.field}:</span>
                            <span style={{ color: '#EF4444' }}>{formatFieldValue(fc.from)}</span>
                            <ArrowRight size={10} style={{ color: '#4A6A7A' }} />
                            <span style={{ color: '#22C55E' }}>{formatFieldValue(fc.to)}</span>
                        </div>
                    ))}
                    {fieldChanges.length > 5 && <span className="text-xs" style={{ color: '#4A6A7A' }}>+{fieldChanges.length - 5} trường khác</span>}
                </div>
            )
        }

        // Fallback: show old vs new summary
        if (newValue && oldValue) {
            const oldEntries = Object.entries(oldValue).filter(([k]) => !k.startsWith('_'))
            const newEntries = Object.entries(newValue).filter(([k]) => !k.startsWith('_'))
            const changes = newEntries.filter(([k, v]) => {
                const oldV = (oldValue as any)[k]
                return JSON.stringify(oldV) !== JSON.stringify(v) && k !== '_fieldChanges'
            })
            if (changes.length === 0) return null
            return (
                <div className="mt-2 space-y-1.5">
                    {changes.slice(0, 5).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs flex-wrap">
                            <span className="font-medium" style={{ color: '#8AAEBB' }}>{key}:</span>
                            <span style={{ color: '#EF4444' }}>{formatFieldValue((oldValue as any)[key])}</span>
                            <ArrowRight size={10} style={{ color: '#4A6A7A' }} />
                            <span style={{ color: '#22C55E' }}>{formatFieldValue(val)}</span>
                        </div>
                    ))}
                </div>
            )
        }
    }

    // For STATUS_CHANGE with newValue only
    if (newValue && !oldValue) {
        const entries = Object.entries(newValue).filter(([k]) => !k.startsWith('_'))
        if (entries.length === 0) return null
        return (
            <div className="mt-2 space-y-1">
                {entries.slice(0, 4).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span style={{ color: '#4A6A7A' }}>{key}:</span>
                        <span style={{ color: '#87CBB9' }}>{formatFieldValue(val)}</span>
                    </div>
                ))}
            </div>
        )
    }

    return null
}

function formatFieldValue(val: unknown): string {
    if (val === null || val === undefined) return '(trống)'
    if (typeof val === 'boolean') return val ? 'Có' : 'Không'
    if (typeof val === 'number') return val.toLocaleString('vi-VN')
    if (Array.isArray(val)) return val.join(', ')
    if (typeof val === 'object') return JSON.stringify(val).slice(0, 60)
    const str = String(val)
    return str.length > 60 ? str.slice(0, 57) + '...' : str
}

// ═══════════════════════════════════════════════════
// STAT CARDS
// ═══════════════════════════════════════════════════

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof Activity; color: string }) {
    return (
        <div
            className="p-4 rounded-lg"
            style={{ background: '#142433', border: '1px solid #2A4355' }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{label}</span>
                <div className="p-1.5 rounded-md" style={{ background: `${color}18` }}>
                    <Icon size={14} style={{ color }} />
                </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#E8F1F2' }}>
                {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
            </p>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

interface AuditLogClientProps {
    initialRows: AuditLogRow[]
    initialTotal: number
    stats: AuditStats
    filterOptions: { entityTypes: string[]; actions: string[]; users: { id: string; name: string }[] }
}

export function AuditLogClient({ initialRows, initialTotal, stats, filterOptions }: AuditLogClientProps) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [page, setPage] = useState(1)
    const [filters, setFilters] = useState<AuditFilters>({})
    const [search, setSearch] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const pageSize = 30
    const totalPages = Math.ceil(total / pageSize)

    async function fetchLogs(newFilters: AuditFilters, newPage: number) {
        startTransition(async () => {
            const result = await getAuditLogsDashboard({ ...newFilters, page: newPage, pageSize })
            setRows(result.rows)
            setTotal(result.total)
        })
    }

    function handleFilterChange(key: keyof AuditFilters, value: string) {
        const newFilters = { ...filters, [key]: value || undefined }
        setFilters(newFilters)
        setPage(1)
        fetchLogs(newFilters, 1)
    }

    function handleSearch() {
        const newFilters = { ...filters, search: search || undefined }
        setFilters(newFilters)
        setPage(1)
        fetchLogs(newFilters, 1)
    }

    function handlePageChange(newPage: number) {
        setPage(newPage)
        fetchLogs(filters, newPage)
    }

    function handleClearFilters() {
        setFilters({})
        setSearch('')
        setPage(1)
        fetchLogs({}, 1)
    }

    const hasActiveFilters = Object.values(filters).some(v => v)

    return (
        <div className="space-y-5 max-w-screen-2xl" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 150ms' }}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: '#E8F1F2' }}>
                        <ScrollText size={26} style={{ color: '#87CBB9' }} />
                        Nhật Ký Hệ Thống
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#4A6A7A' }}>
                        Theo dõi mọi thay đổi quan trọng trong hệ thống ERP
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Tổng sự kiện</p>
                    <p className="text-xl font-bold" style={{ color: '#87CBB9' }}>{stats.total.toLocaleString('vi-VN')}</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Hôm nay" value={stats.today} icon={Calendar} color="#22C55E" />
                <StatCard label="7 ngày qua" value={stats.thisWeek} icon={Activity} color="#06B6D4" />
                <StatCard label="Users hoạt động" value={stats.uniqueUsers} icon={User} color="#8B5CF6" />
                <StatCard label="Tổng sự kiện" value={stats.total} icon={Shield} color="#87CBB9" />
            </div>

            {/* Top Actions & Modules Mini Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Top Actions */}
                <div className="p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                        Loại Hành Động
                    </p>
                    <div className="space-y-2">
                        {stats.topActions.slice(0, 6).map(a => {
                            const config = getActionConfig(a.action)
                            const pct = stats.total > 0 ? (a.count / stats.total * 100) : 0
                            return (
                                <div key={a.action} className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 w-28">
                                        <config.icon size={12} style={{ color: config.color }} />
                                        <span className="text-xs truncate" style={{ color: '#8AAEBB' }}>{config.label}</span>
                                    </div>
                                    <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1B2E3D' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(pct, 2)}%`, background: config.color }}
                                        />
                                    </div>
                                    <span className="text-xs w-12 text-right tabular-nums" style={{ color: '#4A6A7A' }}>{a.count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Top Modules */}
                <div className="p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#4A6A7A' }}>
                        Module Hoạt Động
                    </p>
                    <div className="space-y-2">
                        {stats.topModules.slice(0, 6).map(m => {
                            const maxCount = stats.topModules[0]?.count ?? 1
                            const pct = (m.count / maxCount * 100)
                            return (
                                <div key={m.entityType} className="flex items-center gap-3">
                                    <span className="text-xs w-32 truncate" style={{ color: '#8AAEBB' }}>{formatEntityType(m.entityType)}</span>
                                    <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1B2E3D' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(pct, 2)}%`, background: '#87CBB9' }}
                                        />
                                    </div>
                                    <span className="text-xs w-12 text-right tabular-nums" style={{ color: '#4A6A7A' }}>{m.count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 rounded-lg space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Search */}
                    <div className="flex items-center flex-1 min-w-[200px] gap-2 px-3 py-2 rounded-md" style={{ background: '#0A1926', border: '1px solid #2A4355' }}>
                        <Search size={14} style={{ color: '#4A6A7A' }} />
                        <input
                            type="text"
                            placeholder="Tìm theo user, module, entity ID..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1 bg-transparent text-sm outline-none"
                            style={{ color: '#E8F1F2' }}
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 text-sm font-medium rounded-md transition-all"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                    >
                        Tìm kiếm
                    </button>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-all"
                        style={{
                            background: showFilters ? 'rgba(135,203,185,0.12)' : 'transparent',
                            border: '1px solid #2A4355',
                            color: showFilters ? '#87CBB9' : '#8AAEBB',
                        }}
                    >
                        <Filter size={14} />
                        Lọc nâng cao
                        {hasActiveFilters && (
                            <span className="w-2 h-2 rounded-full" style={{ background: '#87CBB9' }} />
                        )}
                    </button>

                    {hasActiveFilters && (
                        <button
                            onClick={handleClearFilters}
                            className="px-3 py-2 text-xs rounded-md transition-all"
                            style={{ border: '1px solid #2A4355', color: '#EF4444' }}
                        >
                            Xóa bộ lọc
                        </button>
                    )}
                </div>

                {/* Filter Row */}
                {showFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2" style={{ borderTop: '1px solid #1B2E3D' }}>
                        <div>
                            <label className="block text-xs mb-1" style={{ color: '#4A6A7A' }}>Module</label>
                            <select
                                value={filters.entityType ?? ''}
                                onChange={e => handleFilterChange('entityType', e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-sm"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            >
                                <option value="">Tất cả</option>
                                {filterOptions.entityTypes.map(t => (
                                    <option key={t} value={t}>{formatEntityType(t)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs mb-1" style={{ color: '#4A6A7A' }}>Hành động</label>
                            <select
                                value={filters.action ?? ''}
                                onChange={e => handleFilterChange('action', e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-sm"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            >
                                <option value="">Tất cả</option>
                                {filterOptions.actions.map(a => (
                                    <option key={a} value={a}>{getActionConfig(a).label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs mb-1" style={{ color: '#4A6A7A' }}>Từ ngày</label>
                            <input
                                type="date"
                                value={filters.dateFrom ?? ''}
                                onChange={e => handleFilterChange('dateFrom', e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-sm"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs mb-1" style={{ color: '#4A6A7A' }}>Đến ngày</label>
                            <input
                                type="date"
                                value={filters.dateTo ?? ''}
                                onChange={e => handleFilterChange('dateTo', e.target.value)}
                                className="w-full px-2 py-1.5 rounded text-sm"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="rounded-lg overflow-hidden" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #1B2E3D' }}>
                    <span className="text-sm font-medium" style={{ color: '#8AAEBB' }}>
                        {total.toLocaleString('vi-VN')} sự kiện
                    </span>
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                        Trang {page}/{totalPages || 1}
                    </span>
                </div>

                {/* Timeline Entries */}
                {rows.length === 0 ? (
                    <div className="py-16 text-center">
                        <ScrollText size={40} style={{ color: '#2A4355', margin: '0 auto 12px' }} />
                        <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có sự kiện nào</p>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: '#1B2E3D' }}>
                        {rows.map((row) => {
                            const config = getActionConfig(row.action)
                            const Icon = config.icon
                            const isExpanded = expandedRow === row.id
                            const isDangerous = row.action === 'DELETE' || row.entityType === 'PriceList_BulkUpdate'

                            return (
                                <div
                                    key={row.id}
                                    className="px-4 py-3 transition-all duration-150 cursor-pointer"
                                    style={{
                                        background: isExpanded ? '#1B2E3D' : 'transparent',
                                        borderLeft: isDangerous ? '3px solid #EF4444' : '3px solid transparent',
                                    }}
                                    onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Action Icon */}
                                        <div
                                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                                            style={{ background: config.bgColor }}
                                        >
                                            <Icon size={14} style={{ color: config.color }} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                                                    style={{ background: config.bgColor, color: config.color }}
                                                >
                                                    {config.label}
                                                </span>
                                                <span className="font-medium text-sm" style={{ color: '#E8F1F2' }}>
                                                    {formatEntityType(row.entityType)}
                                                </span>
                                                {row.entityId && (
                                                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#0A1926', color: '#4A6A7A' }}>
                                                        {row.entityId.length > 12 ? `...${row.entityId.slice(-8)}` : row.entityId}
                                                    </span>
                                                )}
                                                {isDangerous && (
                                                    <AlertTriangle size={12} style={{ color: '#EF4444' }} />
                                                )}
                                            </div>

                                            {/* Field Diff — shown when expanded */}
                                            {isExpanded && (
                                                <FieldDiffViewer
                                                    oldValue={row.oldValue}
                                                    newValue={row.newValue}
                                                    action={row.action}
                                                />
                                            )}
                                        </div>

                                        {/* Meta */}
                                        <div className="flex-shrink-0 text-right">
                                            <div className="flex items-center gap-1.5">
                                                <User size={10} style={{ color: '#4A6A7A' }} />
                                                <span className="text-xs" style={{ color: '#8AAEBB' }}>
                                                    {row.userName ?? 'Hệ thống'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                <Clock size={10} style={{ color: '#4A6A7A' }} />
                                                <span className="text-xs" style={{ color: '#4A6A7A' }} title={formatDateTime(row.createdAt)}>
                                                    {formatTimeAgo(row.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #1B2E3D' }}>
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all disabled:opacity-30"
                            style={{ border: '1px solid #2A4355', color: '#8AAEBB' }}
                        >
                            <ChevronLeft size={12} /> Trước
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                let pageNum: number
                                if (totalPages <= 7) {
                                    pageNum = i + 1
                                } else if (page <= 4) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 3) {
                                    pageNum = totalPages - 6 + i
                                } else {
                                    pageNum = page - 3 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className="w-8 h-8 text-xs rounded-md transition-all"
                                        style={{
                                            background: page === pageNum ? '#87CBB9' : 'transparent',
                                            color: page === pageNum ? '#0A1926' : '#4A6A7A',
                                            fontWeight: page === pageNum ? 600 : 400,
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md transition-all disabled:opacity-30"
                            style={{ border: '1px solid #2A4355', color: '#8AAEBB' }}
                        >
                            Sau <ChevronRight size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
