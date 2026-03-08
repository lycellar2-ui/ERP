'use client'

import { useState } from 'react'
import { Key, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Zap, FileText, Activity } from 'lucide-react'
import { type ApiKeyRow, type PromptTemplateRow, saveApiKey, toggleApiKey, deleteApiKey, testApiKey, createPromptTemplate, deletePromptTemplate } from './vault-actions'

const PROVIDERS = [
    { value: 'gemini', label: 'Google Gemini', color: '#87CBB9' },
    { value: 'vision', label: 'Google Vision', color: '#4A8FAB' },
    { value: 'anthropic', label: 'Anthropic Claude', color: '#D4A853' },
    { value: 'openai', label: 'OpenAI GPT', color: '#5BA88A' },
]

export function ApiKeyVault({ initialKeys }: { initialKeys: ApiKeyRow[] }) {
    const [keys, setKeys] = useState(initialKeys)
    const [showAdd, setShowAdd] = useState(false)
    const [loading, setLoading] = useState('')
    const [form, setForm] = useState({ provider: 'gemini', label: '', apiKey: '', monthlyBudget: '' })
    const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg?: string } | null>(null)
    const [saveError, setSaveError] = useState('')

    const refresh = () => window.location.reload()

    const handleSave = async () => {
        setLoading('save')
        setSaveError('')
        const res = await saveApiKey({
            provider: form.provider,
            label: form.label || PROVIDERS.find(p => p.value === form.provider)?.label || form.provider,
            apiKey: form.apiKey,
            monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : undefined,
        })
        setLoading('')
        if (!res.success) {
            setSaveError(res.error || 'Lỗi không xác định khi lưu key')
            return
        }
        setForm({ provider: 'gemini', label: '', apiKey: '', monthlyBudget: '' })
        setShowAdd(false)
        refresh()
    }

    const handleToggle = async (id: string) => { await toggleApiKey(id); refresh() }
    const handleDelete = async (id: string) => { if (confirm('Xóa API Key?')) { await deleteApiKey(id); refresh() } }
    const handleTest = async (id: string) => {
        setLoading(id)
        setTestResult(null)
        const res = await testApiKey(id)
        setTestResult({ id, ok: res.success, msg: res.error })
        setLoading('')
        if (res.success) refresh()
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                    <Key size={16} style={{ color: '#D4A853' }} /> API Key Vault
                </h3>
                <button onClick={() => { setShowAdd(!showAdd); setSaveError('') }}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={12} /> Thêm Key
                </button>
            </div>

            {/* Add Form */}
            {showAdd && (
                <div className="p-4 rounded-md mb-4 space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Provider</label>
                            <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Budget/tháng (USD)</label>
                            <input type="number" value={form.monthlyBudget} onChange={e => setForm({ ...form, monthlyBudget: e.target.value })}
                                placeholder="10.00"
                                className="w-full px-3 py-2 text-xs rounded outline-none"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>API Key</label>
                        <input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
                            placeholder="AIza... hoặc sk-..."
                            className="w-full px-3 py-2 text-xs rounded outline-none font-mono"
                            style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                    {saveError && (
                        <div className="text-xs p-2 rounded" style={{
                            background: 'rgba(224,82,82,0.1)', color: '#E05252',
                            border: '1px solid rgba(224,82,82,0.3)',
                        }}>
                            ❌ {saveError}
                        </div>
                    )}
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAdd(false)} className="text-xs px-4 py-2" style={{ color: '#4A6A7A' }}>Hủy</button>
                        <button onClick={handleSave} disabled={!form.apiKey || loading === 'save'}
                            className="text-xs px-4 py-2 rounded font-semibold"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {loading === 'save' ? <Loader2 size={12} className="animate-spin" /> : '🔒 Mã hóa & Lưu'}
                        </button>
                    </div>
                </div>
            )}

            {/* Keys List */}
            {keys.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: '#4A6A7A' }}>Chưa có API Key. Nhấn "Thêm Key" để bắt đầu.</p>
            ) : (
                <div className="space-y-2">
                    {keys.map(k => {
                        const prov = PROVIDERS.find(p => p.value === k.provider)
                        return (
                            <div key={k.id} className="rounded-md"
                                style={{ background: '#142433', border: '1px solid #2A4355', opacity: k.isActive ? 1 : 0.5 }}>
                                <div className="flex items-center gap-3 p-3">
                                    <div className="w-2 h-2 rounded-full" style={{ background: k.isActive ? '#5BA88A' : '#E05252' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold" style={{ color: prov?.color || '#E8F1F2' }}>{k.label}</p>
                                        <p className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{k.maskedKey}</p>
                                    </div>
                                    {k.monthlyBudget && (
                                        <div className="text-right">
                                            <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Budget</p>
                                            <p className="text-[10px] font-mono" style={{ color: k.usedThisMonth > k.monthlyBudget * 0.8 ? '#E05252' : '#87CBB9' }}>
                                                ${k.usedThisMonth.toFixed(2)} / ${k.monthlyBudget}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex gap-1">
                                        <button onClick={() => handleTest(k.id)} title="Test API Key" disabled={loading === k.id}
                                            className="p-1.5 rounded" style={{ color: '#87CBB9' }}>
                                            {loading === k.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                        </button>
                                        <button onClick={() => handleToggle(k.id)} title="Toggle"
                                            className="p-1.5 rounded" style={{ color: k.isActive ? '#5BA88A' : '#4A6A7A' }}>
                                            {k.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                        </button>
                                        <button onClick={() => handleDelete(k.id)} title="Delete"
                                            className="p-1.5 rounded" style={{ color: '#E05252' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                {testResult && testResult.id === k.id && (
                                    <div className="px-3 pb-2">
                                        <p className="text-[10px] px-2 py-1 rounded" style={{
                                            background: testResult.ok ? 'rgba(91,168,138,0.1)' : 'rgba(224,82,82,0.1)',
                                            color: testResult.ok ? '#5BA88A' : '#E05252',
                                            border: `1px solid ${testResult.ok ? 'rgba(91,168,138,0.3)' : 'rgba(224,82,82,0.3)'}`,
                                        }}>
                                            {testResult.ok ? '✅ API Key hoạt động!' : `❌ ${testResult.msg}`}
                                        </p>
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

export function PromptLibrary({ initialTemplates }: { initialTemplates: PromptTemplateRow[] }) {
    const [templates, setTemplates] = useState(initialTemplates)
    const [showCreate, setShowCreate] = useState(false)
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        slug: '', name: '', description: '', systemPrompt: '', userTemplate: '',
        variables: '', temperature: '0.7', maxTokens: '1024',
    })

    const refresh = () => window.location.reload()

    const handleCreate = async () => {
        setLoading(true)
        await createPromptTemplate({
            slug: form.slug,
            name: form.name,
            description: form.description || undefined,
            systemPrompt: form.systemPrompt,
            userTemplate: form.userTemplate,
            variables: form.variables ? form.variables.split(',').map(v => v.trim()) : [],
            temperature: Number(form.temperature),
            maxTokens: Number(form.maxTokens),
        })
        setShowCreate(false)
        setLoading(false)
        refresh()
    }

    const handleDelete = async (id: string) => {
        if (confirm('Xóa Prompt Template?')) { await deletePromptTemplate(id); refresh() }
    }

    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                    <FileText size={16} style={{ color: '#4A8FAB' }} /> Prompt Library
                </h3>
                <button onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Plus size={12} /> Tạo Prompt
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div className="p-4 rounded-md mb-4 space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Slug *</label>
                            <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
                                placeholder="product-description"
                                className="w-full px-3 py-2 text-xs rounded outline-none font-mono"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Tên *</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="Mô tả sản phẩm"
                                className="w-full px-3 py-2 text-xs rounded outline-none"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>System Prompt</label>
                        <textarea value={form.systemPrompt} onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
                            rows={3} placeholder="Bạn là chuyên gia rượu vang..."
                            className="w-full px-3 py-2 text-xs rounded outline-none resize-none"
                            style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                    <div>
                        <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>User Template (dùng {'{{biến}}'} )</label>
                        <textarea value={form.userTemplate} onChange={e => setForm({ ...form, userTemplate: e.target.value })}
                            rows={2} placeholder={'Hãy tạo mô tả cho {{product_name}} vintage {{vintage}}'}
                            className="w-full px-3 py-2 text-xs rounded outline-none resize-none font-mono"
                            style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Biến (phẩy cách)</label>
                            <input value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })}
                                placeholder="product_name, vintage"
                                className="w-full px-3 py-2 text-xs rounded outline-none font-mono"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Temperature</label>
                            <input type="number" step="0.1" value={form.temperature} onChange={e => setForm({ ...form, temperature: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded outline-none"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Max Tokens</label>
                            <input type="number" value={form.maxTokens} onChange={e => setForm({ ...form, maxTokens: e.target.value })}
                                className="w-full px-3 py-2 text-xs rounded outline-none"
                                style={{ background: '#0A1926', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowCreate(false)} className="text-xs px-4 py-2" style={{ color: '#4A6A7A' }}>Hủy</button>
                        <button onClick={handleCreate} disabled={!form.slug || !form.name || loading}
                            className="text-xs px-4 py-2 rounded font-semibold"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {loading ? <Loader2 size={12} className="animate-spin" /> : 'Tạo'}
                        </button>
                    </div>
                </div>
            )}

            {/* Templates List */}
            {templates.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: '#4A6A7A' }}>Chưa có Prompt Template. Nhấn "Tạo Prompt" để bắt đầu.</p>
            ) : (
                <div className="space-y-2">
                    {templates.map(t => (
                        <div key={t.id} className="p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-bold" style={{ color: '#E8F1F2' }}>{t.name}</p>
                                    <p className="text-[10px] font-mono" style={{ color: '#4A8FAB' }}>{t.slug}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                        {t.runCount} runs
                                    </span>
                                    <button onClick={() => handleDelete(t.id)} className="p-1" style={{ color: '#E05252' }}>
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                            {t.variables.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    {t.variables.map(v => (
                                        <span key={v} className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                                            style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB' }}>
                                            {`{{${v}}}`}
                                        </span>
                                    ))}
                                    <span className="text-[9px] px-1.5 py-0.5 rounded"
                                        style={{ color: '#4A6A7A' }}>
                                        T={t.temperature} | {t.maxTokens} tokens
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export function AiUsageCard({ stats }: { stats: { totalRuns: number; monthRuns: number; failedRuns: number; monthTokens: number; monthCostUsd: number; avgDurationMs: number } }) {
    return (
        <div className="p-5 rounded-md" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: '#E8F1F2' }}>
                <Activity size={16} style={{ color: '#87CBB9' }} /> AI Usage This Month
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                    { label: 'Total Runs', value: stats.totalRuns.toLocaleString(), color: '#E8F1F2' },
                    { label: 'This Month', value: stats.monthRuns.toLocaleString(), color: '#87CBB9' },
                    { label: 'Failed', value: stats.failedRuns.toLocaleString(), color: stats.failedRuns > 0 ? '#E05252' : '#5BA88A' },
                    { label: 'Tokens', value: stats.monthTokens.toLocaleString(), color: '#D4A853' },
                    { label: 'Cost', value: `$${stats.monthCostUsd.toFixed(2)}`, color: '#4A8FAB' },
                    { label: 'Avg Speed', value: `${stats.avgDurationMs}ms`, color: '#A5DED0' },
                ].map(s => (
                    <div key={s.label} className="p-3 rounded-md text-center" style={{ background: '#142433' }}>
                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{s.label}</p>
                        <p className="text-sm font-bold" style={{ color: s.color, fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
