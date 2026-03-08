'use client'

import { useState } from 'react'
import {
    Sparkles, Save, CheckCircle, Loader2, RotateCcw,
    TrendingUp, Users, Wine, BarChart3, MessageSquare,
    ChevronDown, ChevronUp, Thermometer, Hash, Zap
} from 'lucide-react'

interface PromptTemplate {
    slug: string
    name: string
    systemPrompt: string
    userTemplate: string
    temperature: number
    maxTokens: number
    updatedAt: string
    _count?: { runs: number }
}

const PROMPT_META: Record<string, { icon: any; label: string; desc: string; color: string }> = {
    'pipeline-analysis': {
        icon: TrendingUp,
        label: 'Pipeline Analysis',
        desc: 'Prompt cho phân tích Sales Pipeline — CEO nhận báo cáo velocity, coaching, dự báo',
        color: '#87CBB9',
    },
    'crm-analysis': {
        icon: Users,
        label: 'CRM Analysis',
        desc: 'Prompt cho phân tích CRM — sức khỏe KH, churning, AR, chiến lược',
        color: '#D4A853',
    },
    'catalog-analysis': {
        icon: Wine,
        label: 'Catalog Intelligence',
        desc: 'Prompt cho phân tích danh mục SP + NCC + nghiên cứu thị trường',
        color: '#4A8FAB',
    },
}

export function ActivePromptEditor({ prompts }: { prompts: PromptTemplate[] }) {
    const [editingSlug, setEditingSlug] = useState<string | null>(null)
    const [form, setForm] = useState<Record<string, any>>({})
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState<string | null>(null)

    function startEdit(p: PromptTemplate) {
        setEditingSlug(p.slug)
        setForm({
            systemPrompt: p.systemPrompt,
            userTemplate: p.userTemplate,
            temperature: p.temperature,
            maxTokens: p.maxTokens,
        })
    }

    async function handleSave(slug: string) {
        setSaving(true)
        await fetch('/api/ai/prompts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, ...form }),
        })
        setSaving(false)
        setSaved(slug)
        setEditingSlug(null)
        setTimeout(() => setSaved(null), 3000)
    }

    const displayed = ['pipeline-analysis', 'crm-analysis', 'catalog-analysis']
    const templateMap = new Map(prompts.map(p => [p.slug, p]))

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-md flex items-center justify-center"
                    style={{ background: 'rgba(135,203,185,0.15)' }}>
                    <Sparkles size={16} style={{ color: '#87CBB9' }} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>Prompt Editor — AI Features</h3>
                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>
                        Chỉnh sửa prompt cho từng tính năng AI. Dùng <code style={{ color: '#D4A853' }}>{'{{data}}'}</code> cho dữ liệu tự động.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {displayed.map(slug => {
                    const meta = PROMPT_META[slug]
                    const template = templateMap.get(slug)
                    const Icon = meta?.icon ?? BarChart3
                    const isEditing = editingSlug === slug
                    const isSaved = saved === slug

                    if (!template) {
                        return (
                            <div key={slug} className="p-3 rounded-md flex items-center justify-between"
                                style={{ background: '#142433', border: '1px solid #1E3545' }}>
                                <div className="flex items-center gap-2">
                                    <Icon size={14} style={{ color: '#4A6A7A' }} />
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {meta?.label ?? slug} — <span style={{ color: '#E05252' }}>Chưa cấu hình</span>
                                    </span>
                                </div>
                                <button onClick={async () => {
                                    await fetch('/api/ai/seed-prompts', { method: 'POST' })
                                    window.location.reload()
                                }} className="text-[10px] px-2 py-1 rounded" style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.08)', border: '1px solid rgba(135,203,185,0.2)' }}>
                                    Tạo mặc định
                                </button>
                            </div>
                        )
                    }

                    return (
                        <div key={slug} className="rounded-md overflow-hidden"
                            style={{ background: '#142433', border: `1px solid ${isEditing ? 'rgba(135,203,185,0.3)' : isSaved ? 'rgba(91,168,138,0.3)' : '#1E3545'}` }}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                onClick={() => isEditing ? setEditingSlug(null) : startEdit(template)}>
                                <div className="flex items-center gap-2">
                                    <Icon size={14} style={{ color: meta.color }} />
                                    <span className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{meta.label}</span>
                                    {template._count && template._count.runs > 0 && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded"
                                            style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                            <Zap size={8} className="inline mr-0.5" />{template._count.runs} runs
                                        </span>
                                    )}
                                    {isSaved && (
                                        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: '#5BA88A' }}>
                                            <CheckCircle size={10} /> Đã lưu!
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px]" style={{ color: '#4A6A7A' }}>
                                        <Thermometer size={9} className="inline mr-0.5" />t={template.temperature}
                                        <Hash size={9} className="inline ml-1.5 mr-0.5" />{template.maxTokens}
                                    </span>
                                    {isEditing ? <ChevronUp size={12} style={{ color: '#87CBB9' }} /> : <ChevronDown size={12} style={{ color: '#4A6A7A' }} />}
                                </div>
                            </div>

                            {/* Edit Form */}
                            {isEditing && (
                                <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: '#1E3545' }}>
                                    <p className="text-[10px] pt-2" style={{ color: '#4A6A7A' }}>{meta.desc}</p>

                                    {/* System Prompt */}
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#8AAEBB' }}>
                                            System Prompt (vai trò AI)
                                        </label>
                                        <textarea value={form.systemPrompt} rows={3}
                                            onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                                            className="w-full text-xs p-2.5 rounded-md resize-vertical font-mono"
                                            style={{ background: '#0F1D29', color: '#E8F1F2', border: '1px solid #2A4355', minHeight: '60px' }}
                                        />
                                    </div>

                                    {/* User Template */}
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#8AAEBB' }}>
                                            User Prompt Template <span style={{ color: '#D4A853' }}>{'(dùng {{data}} cho dữ liệu tự động)'}</span>
                                        </label>
                                        <textarea value={form.userTemplate} rows={12}
                                            onChange={e => setForm(f => ({ ...f, userTemplate: e.target.value }))}
                                            className="w-full text-xs p-2.5 rounded-md resize-vertical font-mono"
                                            style={{ background: '#0F1D29', color: '#E8F1F2', border: '1px solid #2A4355', minHeight: '200px' }}
                                        />
                                    </div>

                                    {/* Settings Row */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-semibold" style={{ color: '#8AAEBB' }}>
                                                <Thermometer size={10} className="inline mr-0.5" />Temperature:
                                            </label>
                                            <input type="number" step="0.1" min="0" max="2" value={form.temperature}
                                                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.5 }))}
                                                className="w-16 text-xs px-2 py-1 rounded font-mono text-center"
                                                style={{ background: '#0F1D29', color: '#E8F1F2', border: '1px solid #2A4355' }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-semibold" style={{ color: '#8AAEBB' }}>
                                                <Hash size={10} className="inline mr-0.5" />Max Tokens:
                                            </label>
                                            <input type="number" step="1024" min="1024" max="65536" value={form.maxTokens}
                                                onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) || 8192 }))}
                                                className="w-20 text-xs px-2 py-1 rounded font-mono text-center"
                                                style={{ background: '#0F1D29', color: '#E8F1F2', border: '1px solid #2A4355' }}
                                            />
                                        </div>
                                        <div className="flex-1" />
                                        <button onClick={() => handleSave(slug)} disabled={saving}
                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all hover:scale-[1.02]"
                                            style={{ background: 'linear-gradient(135deg, rgba(91,168,138,0.2), rgba(135,203,185,0.15))', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                            Lưu Prompt
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
