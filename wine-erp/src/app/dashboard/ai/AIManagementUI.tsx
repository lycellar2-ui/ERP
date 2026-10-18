'use client'

import { useState } from 'react'
import {
    Power, Sparkles, FileText, Pin, Archive, Trash2,
    ChevronDown, ChevronUp, Loader2, CheckCircle, ToggleLeft, ToggleRight,
    Clock, BarChart3, MessageSquare, Wine, Users, TrendingUp
} from 'lucide-react'
import { useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getAiI18n } from './i18n'

const MODULE_KEYS = ['pipeline', 'crm', 'catalog', 'ceo', 'product-desc'] as const

const MODULE_ICONS: Record<string, any> = {
    pipeline: TrendingUp,
    crm: Users,
    catalog: Wine,
    ceo: BarChart3,
    'product-desc': MessageSquare,
}

interface AiConfig {
    aiEnabled: boolean
    allowedModules: string[]
    defaultTemperature: number
    defaultMaxTokens: number
}

export function AiTogglePanel({ initialConfig }: { initialConfig: AiConfig }) {
    const { locale } = useAppLocale()
    const L = getAiI18n(locale).toggle

    const [config, setConfig] = useState(initialConfig)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    async function handleToggle() {
        setSaving(true)
        const newEnabled = !config.aiEnabled
        await fetch('/api/ai/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aiEnabled: newEnabled }),
        })
        setConfig(c => ({ ...c, aiEnabled: newEnabled }))
        setSaving(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    async function handleModuleToggle(module: string) {
        const newModules = config.allowedModules.includes(module)
            ? config.allowedModules.filter(m => m !== module)
            : [...config.allowedModules, module]
        setConfig(c => ({ ...c, allowedModules: newModules }))
        await fetch('/api/ai/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ allowedModules: newModules }),
        })
    }

    return (
        <div className="p-5 rounded-md bg-white border border-lys-border">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: config.aiEnabled ? 'rgba(21,128,61,0.15)' : 'rgba(185,28,28,0.1)' }}>
                        <Power size={16} style={{ color: config.aiEnabled ? '#15803D' : '#B91C1C' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-lys-primary">{L.title}</h3>
                        <p className="text-[10px] text-lys-muted">{L.subtitle}</p>
                    </div>
                </div>
                <button onClick={handleToggle} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all"
                    style={{
                        background: config.aiEnabled ? 'rgba(21,128,61,0.1)' : 'rgba(185,28,28,0.08)',
                        color: config.aiEnabled ? '#15803D' : '#B91C1C',
                        border: `1px solid ${config.aiEnabled ? 'rgba(21,128,61,0.3)' : 'rgba(185,28,28,0.3)'}`,
                    }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> :
                        config.aiEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {config.aiEnabled ? L.enabledBadge : L.disabledBadge}
                    {saved && <CheckCircle size={12} />}
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                {MODULE_KEYS.map(key => {
                    const mod = L.modules[key]
                    const active = config.allowedModules.includes(key)
                    return (
                        <button key={key}
                            onClick={() => handleModuleToggle(key)}
                            disabled={!config.aiEnabled}
                            className="p-3 rounded-md text-left transition-all hover:scale-[1.01]"
                            style={{
                                background: active ? 'rgba(21,128,61,0.06)' : '#FFFFFF',
                                border: `1px solid ${active ? 'rgba(21,128,61,0.2)' : '#E2E8F0'}`,
                                opacity: config.aiEnabled ? 1 : 0.4,
                            }}>
                            <div className="flex items-center justify-between mb-1.5">
                                {(() => {
                                    const IconComp = MODULE_ICONS[key] || Sparkles
                                    return (
                                        <div className="w-6 h-6 rounded flex items-center justify-center"
                                            style={{ background: active ? 'rgba(21,128,61,0.15)' : 'rgba(100,116,139,0.1)', color: active ? '#15803D' : '#64748B' }}>
                                            <IconComp size={13} />
                                        </div>
                                    )
                                })()}
                                <div className="w-3 h-3 rounded-full" style={{
                                    background: active ? '#15803D' : '#E2E8F0',
                                    boxShadow: active ? '0 0 6px rgba(21,128,61,0.5)' : 'none',
                                }} />
                            </div>
                            <p className="text-[11px] font-semibold" style={{ color: active ? '#0F172A' : '#64748B' }}>{mod.label}</p>
                            <p className="text-xs text-lys-muted">{mod.desc}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

interface AiReport {
    id: string
    module: string
    title: string
    analysis: string
    stats: any
    isPinned: boolean
    isArchived: boolean
    createdAt: string
}

export function AiReportsPanel({ initialReports }: { initialReports: AiReport[] }) {
    const { locale, formatDate } = useAppLocale()
    const L = getAiI18n(locale).reports

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [reports, setReports] = useState(initialReports)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('all')

    const filtered = filter === 'all' ? reports : reports.filter(r => r.module === filter)
    const modules = [...new Set(reports.map(r => r.module))]

    async function handlePin(id: string) {
        await fetch(`/api/ai/reports/${id}/pin`, { method: 'PUT' })
        setReports(prev => prev.map(r => r.id === id ? { ...r, isPinned: !r.isPinned } : r))
    }

    async function handleArchive(id: string) {
        await fetch(`/api/ai/reports/${id}/archive`, { method: 'PUT' })
        setReports(prev => prev.filter(r => r.id !== id))
    }

    async function handleDelete(id: string) {
        const ok = await confirm({
            title: L.confirmDeleteTitle,
            message: L.confirmDeleteMsg,
            confirmLabel: L.confirmDeleteBtn,
            variant: 'danger',
        })
        if (!ok) return
        await fetch(`/api/ai/reports/${id}`, { method: 'DELETE' })
        setReports(prev => prev.filter(r => r.id !== id))
    }

    return (
        <div className="p-5 rounded-md bg-white border border-lys-border">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(180,83,9,0.15)' }}>
                        <FileText size={16} style={{ color: '#B45309' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-lys-primary">{L.title}</h3>
                        <p className="text-[10px] text-lys-muted">{L.countSummary(reports.length, reports.filter(r => r.isPinned).length)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setFilter('all')}
                        className="px-2 py-1 rounded text-[10px] font-semibold"
                        style={{ background: filter === 'all' ? 'rgba(100,116,139,0.15)' : 'transparent', color: filter === 'all' ? '#0F172A' : '#64748B' }}>
                        {L.filterAll}
                    </button>
                    {modules.map(m => (
                        <button key={m} onClick={() => setFilter(m)}
                            className="px-2 py-1 rounded text-[10px] font-semibold capitalize"
                            style={{ background: filter === m ? 'rgba(100,116,139,0.15)' : 'transparent', color: filter === m ? '#0F172A' : '#64748B' }}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="py-6 text-center">
                    <FileText size={24} className="mx-auto mb-2 text-lys-border" />
                    <p className="text-xs text-lys-muted">{L.empty}</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)).map(report => {
                        const ModIcon = MODULE_ICONS[report.module] ?? FileText
                        const isExpanded = expandedId === report.id
                        return (
                            <div key={report.id} className="rounded-md overflow-hidden bg-white border border-lys-border">
                                <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {report.isPinned && <Pin size={10} style={{ color: '#B45309' }} />}
                                        <ModIcon size={13} style={{ color: '#0891B2' }} />
                                        <span className="text-xs font-semibold truncate text-lys-primary">{report.title}</span>
                                        <span className="inline-block text-xs px-1.5 py-0.5 rounded capitalize whitespace-nowrap shrink-0"
                                            style={{ background: 'rgba(29,78,216,0.1)', color: '#1D4ED8' }}>{report.module}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-xs text-lys-muted">
                                            <Clock size={9} className="inline mr-0.5" />
                                            {formatDate(report.createdAt)}
                                        </span>
                                        <button onClick={e => { e.stopPropagation(); handlePin(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title={L.pinTitle}>
                                            <Pin size={11} style={{ color: report.isPinned ? '#B45309' : '#64748B' }} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); handleArchive(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title={L.archiveTitle}>
                                            <Archive size={11} style={{ color: '#64748B' }} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title={L.deleteTitle}>
                                            <Trash2 size={11} style={{ color: '#B91C1C' }} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={12} style={{ color: '#64748B' }} /> : <ChevronDown size={12} style={{ color: '#64748B' }} />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-3 pb-3 border-t border-lys-border">
                                        <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto pr-1">
                                            {report.analysis.split('\n').filter(Boolean).map((line, i) => {
                                                const isH = line.startsWith('#') || line.startsWith('**')
                                                return (
                                                    <p key={i} className="text-[12px] leading-relaxed" style={{
                                                        color: isH ? '#0F172A' : '#475569',
                                                        fontWeight: isH ? 700 : 400,
                                                        paddingTop: isH ? '6px' : '0',
                                                    }}>
                                                        {line.replace(/^#+\s*/, '').replace(/\*\*/g, '')}
                                                    </p>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
            {confirmDialog}
        </div>
    )
}
