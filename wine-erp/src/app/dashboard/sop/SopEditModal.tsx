'use client'

import React, { useState } from 'react'
import { X, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { type SopItem, type SopStep, type SopChecklistItem } from '@/data/sops'
import { saveSopAction } from './actions'

interface SopEditModalProps {
    sop: SopItem
    onClose: () => void
    onSaved: (updated: SopItem) => void
}

export function SopEditModal({ sop, onClose, onSaved }: SopEditModalProps) {
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <div>
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                            Chế độ Chỉnh Sửa Quản Trị
                        </span>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            Chỉnh Sửa: {sop.code} — {sop.title}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                    {/* Basic Meta */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Tên Quy Trình</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Phòng Ban Phụ Trách</label>
                            <input
                                type="text"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Thời Lượng Thực Hiện / SLA</label>
                            <input
                                type="text"
                                value={estimatedDuration}
                                onChange={(e) => setEstimatedDuration(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Số Hiệu Phiên Bản</label>
                            <input
                                type="text"
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Tóm Tắt Quy Trình</label>
                        <textarea
                            rows={3}
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Mục Tiêu</label>
                            <input
                                type="text"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-semibold text-slate-700 dark:text-slate-300">Phạm Vi Áp Dụng</label>
                            <input
                                type="text"
                                value={scope}
                                onChange={(e) => setScope(e.target.value)}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                            />
                        </div>
                    </div>

                    {/* Steps Management */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                Các Bước Thực Hiện Chuẩn ({steps.length} bước)
                            </h3>
                            <button
                                type="button"
                                onClick={addStep}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm Bước</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {steps.map((st, i) => (
                                <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <span className="w-6 h-6 rounded-full bg-rose-700 text-white font-bold flex items-center justify-center text-xs">
                                                {st.stepNumber}
                                            </span>
                                            <input
                                                type="text"
                                                value={st.title}
                                                onChange={(e) => updateStep(i, 'title', e.target.value)}
                                                placeholder="Tên bước..."
                                                className="flex-1 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs"
                                            />
                                        </div>
                                        <div className="w-48">
                                            <input
                                                type="text"
                                                value={st.role}
                                                onChange={(e) => updateStep(i, 'role', e.target.value)}
                                                placeholder="Vai trò thực hiện..."
                                                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeStep(i)}
                                            className="p-2 text-rose-600 hover:text-rose-800"
                                            title="Xóa bước này"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <textarea
                                        rows={2}
                                        value={st.action}
                                        onChange={(e) => updateStep(i, 'action', e.target.value)}
                                        placeholder="Mô tả chi tiết hành động..."
                                        className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Checklist Management */}
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                Tiêu Chí Kiểm Soát Chất Lượng ({checklist.length} tiêu chí)
                            </h3>
                            <button
                                type="button"
                                onClick={addChecklistItem}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm Tiêu Chí</span>
                            </button>
                        </div>

                        <div className="space-y-2">
                            {checklist.map((item, idx) => (
                                <div key={item.id || idx} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <input
                                        type="text"
                                        value={item.text}
                                        onChange={(e) => updateChecklistItem(idx, e.target.value)}
                                        className="flex-1 p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-transparent text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleCritical(idx)}
                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition ${item.critical
                                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                    >
                                        {item.critical ? 'Bắt buộc' : 'Khuyến nghị'}
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
                <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center text-xs">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium"
                    >
                        Hủy Bỏ
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Đang Lưu...' : 'Lưu Quy Trình Lên Web'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
