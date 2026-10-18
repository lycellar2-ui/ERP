'use client'

import React, { useState } from 'react'
import { X, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { type SopItem, type SopStep, type SopChecklistItem } from '@/data/sops'
import { saveSopAction } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getSopI18n } from './i18n'

interface SopEditModalProps {
    sop: SopItem
    onClose: () => void
    onSaved: (updated: SopItem) => void
}

export function SopEditModal({ sop, onClose, onSaved }: SopEditModalProps) {
    const { locale } = useAppLocale()
    const t = getSopI18n(locale).editModal
    const [title, setTitle] = useState(sop.title)
    const [department, setDepartment] = useState(sop.department)
    const [estimatedDuration, setEstimatedDuration] = useState(sop.estimatedDuration)
    const [version, setVersion] = useState(sop.version)
    const [summary, setSummary] = useState(sop.summary)
    const [purpose, setPurpose] = useState(sop.purpose)
    const [scope, setScope] = useState(sop.scope)
    
    const [steps, setSteps] = useState<SopStep[]>([...sop.flowSteps])
    const [checklist, setChecklist] = useState<SopChecklistItem[]>([...sop.checklist])

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Handle step change
    const updateStep = (index: number, field: keyof SopStep, value: any) => {
        setSteps(prev => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    const addStep = () => {
        setSteps(prev => [
            ...prev,
            {
                stepNumber: prev.length + 1,
                title: 'Bước mới',
                role: 'Người phụ trách',
                action: 'Mô tả chi tiết hành động cần làm...'
            }
        ])
    }

    const removeStep = (index: number) => {
        setSteps(prev => prev.filter((_, i) => i !== index).map((s, idx) => ({ ...s, stepNumber: idx + 1 })))
    }

    // Handle checklist change
    const updateChecklistItem = (index: number, text: string) => {
        setChecklist(prev => {
            const next = [...prev]
            next[index] = { ...next[index], text }
            return next
        })
    }

    const toggleCritical = (index: number) => {
        setChecklist(prev => {
            const next = [...prev]
            next[index] = { ...next[index], critical: !next[index].critical }
            return next
        })
    }

    const addChecklistItem = () => {
        setChecklist(prev => [
            ...prev,
            {
                id: `check-${Date.now()}`,
                text: 'Tiêu chí kiểm soát mới...',
                critical: false
            }
        ])
    }

    const removeChecklistItem = (index: number) => {
        setChecklist(prev => prev.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            setError(null)

            const updated: SopItem = {
                ...sop,
                title,
                department,
                estimatedDuration,
                version,
                summary,
                purpose,
                scope,
                flowSteps: steps,
                checklist
            }

            const res = await saveSopAction(updated)
            if (res.success && res.data) {
                onSaved(res.data)
                onClose()
            } else {
                setError(res.error || 'Lỗi khi lưu quy trình')
            }
        } catch (err: any) {
            setError(err?.message || 'Lỗi hệ thống')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <div>
                        <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                            {t.kicker}
                        </span>
                        <h2 className="text-xl font-bold text-slate-900">
                            {t.titlePrefix} {sop.code} — {sop.title}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form fields */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                    {/* Basic Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.sopTitleLabel}</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.deptLabel}</label>
                            <input
                                type="text"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.slaLabel}</label>
                            <input
                                type="text"
                                value={estimatedDuration}
                                onChange={(e) => setEstimatedDuration(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.versionLabel}</label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="font-semibold text-slate-700">{t.summaryLabel}</label>
                        <textarea
                            rows={3}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.purposeLabel}</label>
                            <input
                                type="text"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700">{t.scopeLabel}</label>
                            <input
                                type="text"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs"
                            />
                        </div>
                    </div>

                    {/* Steps Management */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-900">
                                {t.stepsHeader(steps.length)}
                            </h3>
                            <button
                                type="button"
                                onClick={addStep}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{t.addStepBtn}</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {steps.map((st, i) => (
                                <div key={i} className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                        <div className="flex items-center gap-2 w-full sm:flex-1">
                                            <span className="w-6 h-6 rounded-full bg-rose-700 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                                                {st.stepNumber}
                                            </span>
                                            <input
                                                type="text"
                                                value={st.title}
                                                onChange={(e) => updateStep(i, 'title', e.target.value)}
                                                placeholder={t.stepTitlePlaceholder}
                                                className="flex-1 p-2 rounded-lg border border-slate-300 bg-white text-slate-900 font-bold text-xs"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <input
                                                type="text"
                                                value={st.role}
                                                onChange={(e) => updateStep(i, 'role', e.target.value)}
                                                placeholder={t.stepRolePlaceholder}
                                                className="flex-1 sm:w-48 p-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeStep(i)}
                                                className="p-2 text-rose-600 hover:text-rose-800 flex-shrink-0"
                                                title={t.removeStepTitle}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <textarea
                                        rows={2}
                                        value={st.action}
                                        onChange={(e) => updateStep(i, 'action', e.target.value)}
                                        placeholder={t.stepActionPlaceholder}
                                        className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Checklist Management */}
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-900">
                                {t.checklistHeader(checklist.length)}
                            </h3>
                            <button
                                type="button"
                                onClick={addChecklistItem}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{t.addChecklistBtn}</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            {checklist.map((item, idx) => (
                                <div key={item.id || idx} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white">
                                    <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => updateChecklistItem(idx, e.target.value)}
                                        className="flex-1 p-1.5 rounded border border-slate-300 bg-transparent text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleCritical(idx)}
                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition ${item.critical
                                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}
                                    >
                                        {item.critical ? t.mandatoryBtn : t.optionalBtn}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeChecklistItem(idx)}
                                        className="p-1.5 text-rose-600 hover:text-rose-800"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 px-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium"
                    >
                        {t.cancelBtn}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? t.savingBtn : t.saveBtn}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
