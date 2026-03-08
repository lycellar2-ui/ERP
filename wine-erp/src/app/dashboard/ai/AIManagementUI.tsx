'use client'

import { useState } from 'react'
import {
    Power, Shield, Sparkles, FileText, Pin, Archive, Trash2, Eye,
    ChevronDown, ChevronUp, Loader2, CheckCircle, ToggleLeft, ToggleRight,
    Clock, BarChart3, MessageSquare, Wine, Users, TrendingUp
} from 'lucide-react'

const MODULE_OPTIONS = [
    { key: 'pipeline', label: 'Pipeline Analysis', icon: '📊', desc: 'Sales pipeline & velocity' },
    { key: 'crm', label: 'CRM Analysis', icon: '👥', desc: 'Customer health & churning' },
    { key: 'catalog', label: 'Catalog Intelligence', icon: '🍷', desc: 'Product & supplier research' },
    { key: 'ceo', label: 'CEO Briefing', icon: '📈', desc: 'Monthly executive summary' },
    { key: 'product-desc', label: 'Product Description', icon: '💬', desc: 'Auto product descriptions' },
]

const MODULE_ICONS: Record<string, any> = {
    pipeline: TrendingUp,
    crm: Users,
    catalog: Wine,
    ceo: BarChart3,
    'product-desc': MessageSquare,
}

// ═══════════════════════════════════════════════════
// 1. AI SYSTEM TOGGLE — Enable/Disable + Module Whitelist
// ═══════════════════════════════════════════════════

interface AiConfig {
    aiEnabled: boolean
    allowedModules: string[]
    defaultTemperature: number
    defaultMaxTokens: number
}

export function AiTogglePanel({ initialConfig }: { initialConfig: AiConfig }) {
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
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: config.aiEnabled ? 'rgba(91,168,138,0.15)' : 'rgba(224,82,82,0.1)' }}>
                        <Power size={16} style={{ color: config.aiEnabled ? '#5BA88A' : '#E05252' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>AI System Control</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Bật/tắt toàn bộ AI features cho CEO & users</p>
                    </div>
                </div>
                <button onClick={handleToggle} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all"
                    style={{
                        background: config.aiEnabled ? 'rgba(91,168,138,0.1)' : 'rgba(224,82,82,0.08)',
                        color: config.aiEnabled ? '#5BA88A' : '#E05252',
                        border: `1px solid ${config.aiEnabled ? 'rgba(91,168,138,0.3)' : 'rgba(224,82,82,0.3)'}`,
                    }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> :
                        config.aiEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {config.aiEnabled ? 'AI ĐANG BẬT' : 'AI ĐÃ TẮT'}
                    {saved && <CheckCircle size={12} />}
                </button>
            </div>

            {/* Module Whitelist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                {MODULE_OPTIONS.map(mod => {
                    const active = config.allowedModules.includes(mod.key)
                    return (
                        <button key={mod.key}
                            onClick={() => handleModuleToggle(mod.key)}
                            disabled={!config.aiEnabled}
                            className="p-3 rounded-md text-left transition-all hover:scale-[1.01]"
                            style={{
                                background: active ? 'rgba(91,168,138,0.06)' : '#142433',
                                border: `1px solid ${active ? 'rgba(91,168,138,0.2)' : '#1E3545'}`,
                                opacity: config.aiEnabled ? 1 : 0.4,
                            }}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-lg">{mod.icon}</span>
                                <div className="w-3 h-3 rounded-full" style={{
                                    background: active ? '#5BA88A' : '#2A4355',
                                    boxShadow: active ? '0 0 6px rgba(91,168,138,0.5)' : 'none',
                                }} />
                            </div>
                            <p className="text-[11px] font-semibold" style={{ color: active ? '#E8F1F2' : '#4A6A7A' }}>{mod.label}</p>
                            <p className="text-[9px]" style={{ color: '#4A6A7A' }}>{mod.desc}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// 2. AI REPORTS HISTORY — View, Pin, Archive, Delete
// ═══════════════════════════════════════════════════

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
        if (!confirm('Xóa báo cáo này?')) return
        await fetch(`/api/ai/reports/${id}`, { method: 'DELETE' })
        setReports(prev => prev.filter(r => r.id !== id))
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(212,168,83,0.15)' }}>
                        <FileText size={16} style={{ color: '#D4A853' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Báo Cáo AI Đã Lưu</h3>
                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{reports.length} báo cáo · ghim {reports.filter(r => r.isPinned).length}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setFilter('all')}
                        className="px-2 py-1 rounded text-[10px] font-semibold"
                        style={{ background: filter === 'all' ? 'rgba(138,174,187,0.15)' : 'transparent', color: filter === 'all' ? '#E8F1F2' : '#4A6A7A' }}>
                        Tất cả
                    </button>
                    {modules.map(m => (
                        <button key={m} onClick={() => setFilter(m)}
                            className="px-2 py-1 rounded text-[10px] font-semibold capitalize"
                            style={{ background: filter === m ? 'rgba(138,174,187,0.15)' : 'transparent', color: filter === m ? '#E8F1F2' : '#4A6A7A' }}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="py-6 text-center">
                    <FileText size={24} className="mx-auto mb-2" style={{ color: '#2A4355' }} />
                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có báo cáo. Sử dụng AI Analysis trên Pipeline, CRM hoặc Products để tạo.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)).map(report => {
                        const ModIcon = MODULE_ICONS[report.module] ?? FileText
                        const isExpanded = expandedId === report.id
                        return (
                            <div key={report.id} className="rounded-md overflow-hidden"
                                style={{ background: '#142433', border: `1px solid ${report.isPinned ? 'rgba(212,168,83,0.2)' : '#1E3545'}` }}>
                                <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                    onClick={() => setExpandedId(isExpanded ? null : report.id)}>
                                    <div className="flex items-center gap-2 min-w-0">
                                        {report.isPinned && <Pin size={10} style={{ color: '#D4A853' }} />}
                                        <ModIcon size={13} style={{ color: '#87CBB9' }} />
                                        <span className="text-xs font-semibold truncate" style={{ color: '#E8F1F2' }}>{report.title}</span>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded capitalize"
                                            style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>{report.module}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <span className="text-[9px]" style={{ color: '#4A6A7A' }}>
                                            <Clock size={9} className="inline mr-0.5" />
                                            {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                                        </span>
                                        <button onClick={e => { e.stopPropagation(); handlePin(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title="Ghim">
                                            <Pin size={11} style={{ color: report.isPinned ? '#D4A853' : '#4A6A7A' }} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); handleArchive(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title="Lưu trữ">
                                            <Archive size={11} style={{ color: '#4A6A7A' }} />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); handleDelete(report.id) }}
                                            className="p-1 rounded transition-all hover:scale-110" title="Xóa">
                                            <Trash2 size={11} style={{ color: '#E05252' }} />
                                        </button>
                                        {isExpanded ? <ChevronUp size={12} style={{ color: '#4A6A7A' }} /> : <ChevronDown size={12} style={{ color: '#4A6A7A' }} />}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="px-3 pb-3 border-t" style={{ borderColor: '#1E3545' }}>
                                        <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto pr-1">
                                            {report.analysis.split('\n').filter(Boolean).map((line, i) => {
                                                const isH = line.startsWith('#') || line.startsWith('**')
                                                return (
                                                    <p key={i} className="text-[12px] leading-relaxed" style={{
                                                        color: isH ? '#E8F1F2' : '#8AAEBB',
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
        </div>
    )
}
