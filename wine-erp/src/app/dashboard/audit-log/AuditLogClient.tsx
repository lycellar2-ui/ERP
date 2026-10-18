'use client'

import { useState, useTransition } from 'react'
import {
    ScrollText, Filter, Calendar, User, Shield, Clock, Activity, AlertTriangle,
    Plus, Edit, Trash2, CheckCircle2, XCircle, RefreshCw,
    ArrowRight, FileSignature
} from 'lucide-react'
import { getAuditLogsDashboard, type AuditLogRow, type AuditStats, type AuditFilters } from './actions'
import {
    PageHeader, StatGrid, StatCard, Toolbar, SearchInput,
    Button, Select, Input, Field, Pagination, Badge, EmptyState
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'
import { useAppLocale } from '@/lib/i18n'
import { AUDIT_LOG_I18N } from './i18n'
import { cn } from '@/lib/utils'

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; tone: Tone }> = {
    CREATE: { icon: Plus, color: '#22C55E', tone: 'success' },
    UPDATE: { icon: Edit, color: '#F59E0B', tone: 'warning' },
    DELETE: { icon: Trash2, color: '#B91C1C', tone: 'danger' },
    APPROVE: { icon: CheckCircle2, color: '#22C55E', tone: 'success' },
    REJECT: { icon: XCircle, color: '#B91C1C', tone: 'danger' },
    STATUS_CHANGE: { icon: RefreshCw, color: '#0891B2', tone: 'brand' },
    CONFIRM: { icon: CheckCircle2, color: '#06B6D4', tone: 'info' },
    LOGIN: { icon: User, color: '#64748B', tone: 'neutral' },
    EXPORT: { icon: ArrowRight, color: '#64748B', tone: 'neutral' },
    SIGN: { icon: FileSignature, color: '#0891B2', tone: 'brand' },
    RETURN: { icon: RefreshCw, color: '#F59E0B', tone: 'warning' },
}

function getActionConfig(action: string, i18n: typeof AUDIT_LOG_I18N['vi']) {
    const cfg = ACTION_CONFIG[action] ?? { icon: Activity, color: '#64748B', tone: 'neutral' as Tone }
    const label = (i18n.actions as Record<string, string>)[action] ?? action
    return { ...cfg, label }
}

function formatEntityType(type: string, i18n: typeof AUDIT_LOG_I18N['vi']) {
    return (i18n.entities as Record<string, string>)[type] ?? type.replace(/_/g, ' ')
}

function FieldDiffViewer({
    oldValue,
    newValue,
    action,
    i18n,
    formatNumber,
}: {
    oldValue: any
    newValue: any
    action: string
    i18n: typeof AUDIT_LOG_I18N['vi']
    formatNumber: (v: number) => string
}) {
    const formatFieldValue = (val: unknown): string => {
        if (val === null || val === undefined) return i18n.emptyVal
        if (typeof val === 'boolean') return val ? i18n.yes : i18n.no
        if (typeof val === 'number') return formatNumber(val)
        if (Array.isArray(val)) return val.join(', ')
        if (typeof val === 'object') return JSON.stringify(val).slice(0, 60)
        const str = String(val)
        return str.length > 60 ? str.slice(0, 57) + '...' : str
    }

    if (action === 'CREATE' && newValue) {
        const entries = Object.entries(newValue).filter(([k]) => !k.startsWith('_'))
        if (entries.length === 0) return null
        return (
            <div className="mt-2 space-y-1">
                {entries.slice(0, 6).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-lys-muted">{key}:</span>
                        <span className="text-tone-success-fg font-medium">{formatFieldValue(val)}</span>
                    </div>
                ))}
                {entries.length > 6 && (
                    <span className="text-xs text-lys-muted">+{entries.length - 6} {i18n.moreFields}</span>
                )}
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
                        <span className="text-lys-muted">{key}:</span>
                        <span className="text-tone-danger-fg line-through">{formatFieldValue(val)}</span>
                    </div>
                ))}
            </div>
        )
    }

    if ((action === 'UPDATE' || action === 'STATUS_CHANGE') && oldValue) {
        const fieldChanges = (oldValue as any)?._fieldChanges
        if (Array.isArray(fieldChanges) && fieldChanges.length > 0) {
            return (
                <div className="mt-2 space-y-1.5">
                    {fieldChanges.slice(0, 5).map((fc: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs flex-wrap">
                            <span className="font-medium text-lys-secondary">{fc.field}:</span>
                            <span className="text-tone-danger-fg">{formatFieldValue(fc.from)}</span>
                            <ArrowRight size={10} className="text-lys-muted" />
                            <span className="text-tone-success-fg font-medium">{formatFieldValue(fc.to)}</span>
                        </div>
                    ))}
                    {fieldChanges.length > 5 && (
                        <span className="text-xs text-lys-muted">+{fieldChanges.length - 5} {i18n.moreFields}</span>
                    )}
                </div>
            )
        }

        if (newValue && oldValue) {
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
                            <span className="font-medium text-lys-secondary">{key}:</span>
                            <span className="text-tone-danger-fg">{formatFieldValue((oldValue as any)[key])}</span>
                            <ArrowRight size={10} className="text-lys-muted" />
                            <span className="text-tone-success-fg font-medium">{formatFieldValue(val)}</span>
                        </div>
                    ))}
                </div>
            )
        }
    }

    if (newValue && !oldValue) {
        const entries = Object.entries(newValue).filter(([k]) => !k.startsWith('_'))
        if (entries.length === 0) return null
        return (
            <div className="mt-2 space-y-1">
                {entries.slice(0, 4).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                        <span className="text-lys-muted">{key}:</span>
                        <span className="text-lys-teal-strong font-medium">{formatFieldValue(val)}</span>
                    </div>
                ))}
            </div>
        )
    }

    return null
}

interface AuditLogClientProps {
    initialRows: AuditLogRow[]
    initialTotal: number
    stats: AuditStats
    filterOptions: { entityTypes: string[]; actions: string[]; users: { id: string; name: string }[] }
}

export function AuditLogClient({ initialRows, initialTotal, stats, filterOptions }: AuditLogClientProps) {
    const { locale, formatDate, formatNumber } = useAppLocale()
    const i18n = AUDIT_LOG_I18N[locale]

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

    const formatTimeAgo = (date: Date): string => {
        const now = new Date()
        const diff = now.getTime() - new Date(date).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return i18n.justNow
        if (mins < 60) return `${mins} ${i18n.minsAgo}`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours} ${i18n.hoursAgo}`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days} ${i18n.daysAgo}`
        return formatDate(date)
    }

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
        <div className={cn('space-y-5 max-w-screen-2xl transition-opacity duration-150', isPending && 'opacity-70')}>
            {/* Header */}
            <PageHeader
                description={i18n.description}
                actions={
                    <div className="text-right">
                        <p className="type-caption text-lys-muted font-medium">{i18n.totalEvents}</p>
                        <p className="text-lg font-bold text-lys-teal-strong font-mono">{formatNumber(stats.total)}</p>
                    </div>
                }
            />

            {/* Stats Cards */}
            <StatGrid>
                <StatCard label={i18n.today} value={formatNumber(stats.today)} icon={Calendar} tone="success" />
                <StatCard label={i18n.last7Days} value={formatNumber(stats.thisWeek)} icon={Activity} tone="info" />
                <StatCard label={i18n.activeUsers} value={formatNumber(stats.uniqueUsers)} icon={User} />
                <StatCard label={i18n.totalEvents} value={formatNumber(stats.total)} icon={Shield} tone="brand" />
            </StatGrid>

            {/* Top Actions & Modules Mini Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-lys-muted mb-3">
                        {i18n.actionTypes}
                    </p>
                    <div className="space-y-2">
                        {stats.topActions.slice(0, 6).map(a => {
                            const config = getActionConfig(a.action, i18n as any)
                            const pct = stats.total > 0 ? (a.count / stats.total * 100) : 0
                            return (
                                <div key={a.action} className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 w-32 shrink-0">
                                        <config.icon size={12} style={{ color: config.color }} />
                                        <span className="text-xs truncate text-lys-secondary">{config.label}</span>
                                    </div>
                                    <div className="flex-1 h-1.5 rounded-full bg-lys-subtle">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${Math.max(pct, 2)}%`, background: config.color }}
                                        />
                                    </div>
                                    <span className="text-xs w-12 text-right font-mono text-lys-muted">{formatNumber(a.count)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-lys-muted mb-3">
                        {i18n.activeModules}
                    </p>
                    <div className="space-y-2">
                        {stats.topModules.slice(0, 6).map(m => {
                            const maxCount = stats.topModules[0]?.count ?? 1
                            const pct = (m.count / maxCount * 100)
                            return (
                                <div key={m.entityType} className="flex items-center gap-3">
                                    <span className="text-xs w-36 truncate text-lys-secondary shrink-0">
                                        {formatEntityType(m.entityType, i18n as any)}
                                    </span>
                                    <div className="flex-1 h-1.5 rounded-full bg-lys-subtle">
                                        <div
                                            className="h-full rounded-full transition-all duration-500 bg-lys-teal-strong"
                                            style={{ width: `${Math.max(pct, 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs w-12 text-right font-mono text-lys-muted">{formatNumber(m.count)}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs space-y-3">
                <Toolbar
                    left={
                        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                            <SearchInput
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder={i18n.searchPlaceholder}
                                className="flex-1"
                            />
                            <Button onClick={handleSearch}>
                                {i18n.searchBtn}
                            </Button>
                        </div>
                    }
                    right={
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                onClick={() => setShowFilters(!showFilters)}
                                className={showFilters || hasActiveFilters ? 'border-lys-teal text-lys-teal-strong bg-lys-teal-soft' : undefined}
                            >
                                <Filter size={14} aria-hidden />
                                {i18n.advancedFilters}
                                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-lys-teal-strong" />}
                            </Button>
                            {hasActiveFilters && (
                                <Button variant="danger-outline" size="sm" onClick={handleClearFilters}>
                                    {i18n.clearFilters}
                                </Button>
                            )}
                        </div>
                    }
                />

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-lys-border">
                        <Field label={i18n.module}>
                            {id => (
                                <Select
                                    id={id}
                                    value={filters.entityType ?? ''}
                                    onChange={e => handleFilterChange('entityType', e.target.value)}
                                >
                                    <option value="">{i18n.all}</option>
                                    {filterOptions.entityTypes.map(t => (
                                        <option key={t} value={t}>{formatEntityType(t, i18n as any)}</option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label={i18n.action}>
                            {id => (
                                <Select
                                    id={id}
                                    value={filters.action ?? ''}
                                    onChange={e => handleFilterChange('action', e.target.value)}
                                >
                                    <option value="">{i18n.all}</option>
                                    {filterOptions.actions.map(a => (
                                        <option key={a} value={a}>{getActionConfig(a, i18n as any).label}</option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label={i18n.fromDate}>
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={filters.dateFrom ?? ''}
                                    onChange={e => handleFilterChange('dateFrom', e.target.value)}
                                />
                            )}
                        </Field>
                        <Field label={i18n.toDate}>
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={filters.dateTo ?? ''}
                                    onChange={e => handleFilterChange('dateTo', e.target.value)}
                                />
                            )}
                        </Field>
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div className="rounded-lg overflow-hidden bg-white border border-lys-border shadow-2xs">
                <div className="px-4 py-3 flex items-center justify-between border-b border-lys-border bg-lys-subtle/50">
                    <span className="text-sm font-semibold text-lys-secondary">
                        {formatNumber(total)} {i18n.eventsSuffix}
                    </span>
                    <span className="type-caption text-lys-muted">
                        {i18n.pagePrefix} {page}/{totalPages || 1}
                    </span>
                </div>

                {rows.length === 0 ? (
                    <div className="p-8">
                        <EmptyState icon={ScrollText} title={i18n.emptyEvents} />
                    </div>
                ) : (
                    <div className="divide-y divide-lys-border">
                        {rows.map(row => {
                            const config = getActionConfig(row.action, i18n as any)
                            const Icon = config.icon
                            const isExpanded = expandedRow === row.id
                            const isDangerous = row.action === 'DELETE' || row.entityType === 'PriceList_BulkUpdate'

                            return (
                                <div
                                    key={row.id}
                                    className={cn(
                                        'px-4 py-3 transition-colors cursor-pointer border-l-[3px] hover:bg-lys-subtle/50',
                                        isDangerous ? 'border-l-tone-danger-fg' : 'border-l-transparent',
                                        isExpanded && 'bg-lys-subtle/30'
                                    )}
                                    onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                                            style={{ background: `${config.color}18` }}
                                        >
                                            <Icon size={14} style={{ color: config.color }} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge tone={config.tone}>
                                                    {config.label}
                                                </Badge>
                                                <span className="font-semibold text-sm text-lys-primary">
                                                    {formatEntityType(row.entityType, i18n as any)}
                                                </span>
                                                {row.entityId && (
                                                    <span className="inline-block text-xs font-mono px-1.5 py-0.5 rounded bg-lys-subtle text-lys-muted border border-lys-border whitespace-nowrap shrink-0">
                                                        {row.entityId.length > 12 ? `...${row.entityId.slice(-8)}` : row.entityId}
                                                    </span>
                                                )}
                                                {isDangerous && (
                                                    <AlertTriangle size={12} className="text-tone-danger-fg" />
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <FieldDiffViewer
                                                    oldValue={row.oldValue}
                                                    newValue={row.newValue}
                                                    action={row.action}
                                                    i18n={i18n as any}
                                                    formatNumber={formatNumber}
                                                />
                                            )}
                                        </div>

                                        <div className="flex-shrink-0 text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                <User size={11} className="text-lys-muted" />
                                                <span className="text-xs font-medium text-lys-secondary">
                                                    {row.userName ?? i18n.systemUser}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                <Clock size={11} className="text-lys-muted" />
                                                <span className="text-xs text-lys-muted">
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

                {totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-lys-border bg-lys-subtle/30">
                        <Pagination
                            page={page}
                            pageSize={pageSize}
                            total={total}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
