'use client'

import { useState } from 'react'
import {
    Sparkles, Save, CheckCircle, Loader2, RotateCcw,
    TrendingUp, Users, Wine, BarChart3, MessageSquare,
    ChevronDown, ChevronUp, Thermometer, Hash, Zap
} from 'lucide-react'
import { useAppLocale } from '@/lib/i18n'
import { getAiI18n } from './i18n'

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

const PROMPT_ICONS: Record<string, { icon: any; color: string }> = {
    'pipeline-analysis': { icon: TrendingUp, color: '#0891B2' },
    'crm-analysis': { icon: Users, color: '#B45309' },
    'catalog-analysis': { icon: Wine, color: '#1D4ED8' },
}

export function ActivePromptEditor({ prompts }: { prompts: PromptTemplate[] }) {
    const { locale } = useAppLocale()
    const t = getAiI18n(locale).editor
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

    const displayed = ['pipeline-analysis', 'crm-analysis', 'catalog-analysis'] as const
    const templateMap = new Map(prompts.map(p => [p.slug, p]))

    return (
        <div className="p-5 rounded-md bg-white border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-md flex items-center justify-center bg-cyan-50">
                    <Sparkles size={16} className="text-[#0891B2]" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-slate-900">{t.title}</h3>
                    <p className="text-[10px] text-slate-500">
                        {t.subtitlePrefix} <code className="text-amber-700">{'{{data}}'}</code> {t.subtitleSuffix}
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                {displayed.map(slug => {
                    const meta = t.meta[slug]
                    const iconCfg = PROMPT_ICONS[slug]
                    const template = templateMap.get(slug)
                    const Icon = iconCfg?.icon ?? BarChart3
                    const isEditing = editingSlug === slug
                    const isSaved = saved === slug

                    if (!template) {
                        return (
                            <div key={slug} className="p-3 rounded-md flex items-center justify-between bg-white border border-slate-200">
                                <div className="flex items-center gap-2">
                                    <Icon size={14} className="text-slate-500" />
                                    <span className="text-xs text-slate-500">
                                        {meta?.label ?? slug} — <span className="text-red-700">{t.notConfigured}</span>
                                    </span>
                                </div>
                                <button onClick={async () => {
                                    await fetch('/api/ai/seed-prompts', { method: 'POST' })
                                    window.location.reload()
                                }} className="text-[10px] px-2 py-1 rounded text-[#0891B2] bg-cyan-50 border border-cyan-200">
                                    {t.seedDefaultBtn}
                                </button>
                            </div>
                        )
                    }

                    return (
                        <div key={slug} className="rounded-md overflow-hidden bg-white"
                            style={{ border: `1px solid ${isEditing ? 'rgba(8, 145, 178, 0.35)' : isSaved ? 'rgba(21,128,61,0.35)' : '#E2E8F0'}` }}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                                onClick={() => isEditing ? setEditingSlug(null) : startEdit(template)}>
                                <div className="flex items-center gap-2">
                                    <Icon size={14} style={{ color: iconCfg.color }} />
                                    <span className="text-xs font-semibold text-slate-900">{meta.label}</span>
                                    {template._count && template._count.runs > 0 && (
                                        <span className="inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 bg-blue-50 text-blue-700">
                                            <Zap size={8} className="inline mr-0.5" />{template._count.runs} runs
                                        </span>
                                    )}
                                    {isSaved && (
                                        <span className="flex items-center gap-0.5 text-[10px] text-emerald-700">
                                            <CheckCircle size={10} /> {t.savedBadge}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">
                                        <Thermometer size={9} className="inline mr-0.5" />t={template.temperature}
                                        <Hash size={9} className="inline ml-1.5 mr-0.5" />{template.maxTokens}
                                    </span>
                                    {isEditing ? <ChevronUp size={12} className="text-[#0891B2]" /> : <ChevronDown size={12} className="text-slate-500" />}
                                </div>
                            </div>

                            {/* Edit Form */}
                            {isEditing && (
                                <div className="px-3 pb-3 space-y-3 border-t border-slate-200">
                                    <p className="text-[10px] pt-2 text-slate-500">{meta.desc}</p>

                                    {/* System Prompt */}
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1 text-slate-600">
                                            {t.sysPromptLabel}
                                        </label>
                                        <textarea value={form.systemPrompt} rows={3}
                                            onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                                            className="w-full text-xs p-2.5 rounded-md resize-vertical font-mono bg-slate-50 text-slate-900 border border-slate-200 min-h-[60px]"
                                        />
                                    </div>

                                    {/* User Template */}
                                    <div>
                                        <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1 text-slate-600">
                                            {t.userPromptLabel} <span className="text-amber-700">{t.userPromptHint}</span>
                                        </label>
                                        <textarea value={form.userTemplate} rows={12}
                                            onChange={e => setForm(f => ({ ...f, userTemplate: e.target.value }))}
                                            className="w-full text-xs p-2.5 rounded-md resize-vertical font-mono bg-slate-50 text-slate-900 border border-slate-200 min-h-[200px]"
                                        />
                                    </div>

                                    {/* Settings Row */}
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                <Thermometer size={10} className="inline mr-0.5" />Temperature:
                                            </label>
                                            <input type="number" step="0.1" min="0" max="2" value={form.temperature}
                                                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) || 0.5 }))}
                                                className="w-16 text-xs px-2 py-1 rounded font-mono text-center bg-slate-50 text-slate-900 border border-slate-200"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-semibold text-slate-600">
                                                <Hash size={10} className="inline mr-0.5" />Max Tokens:
                                            </label>
                                            <input type="number" step="1024" min="1024" max="65536" value={form.maxTokens}
                                                onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) || 8192 }))}
                                                className="w-20 text-xs px-2 py-1 rounded font-mono text-center bg-slate-50 text-slate-900 border border-slate-200"
                                            />
                                        </div>
                                        <div className="flex-1" />
                                        <button onClick={() => handleSave(slug)} disabled={saving}
                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                            {t.savePromptBtn}
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
