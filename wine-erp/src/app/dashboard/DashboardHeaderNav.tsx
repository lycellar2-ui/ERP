'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Users, Download, Sparkles, RefreshCw, X, Loader2 } from 'lucide-react'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'

interface DashboardHeaderNavProps {
    userName?: string | null
    roles: string[]
    currentTab: 'overview' | 'customers'
    currentPreset?: string
    currentEntity?: string
    exportAction: () => Promise<string>
}

export function DashboardHeaderNav({
    userName,
    roles,
    currentTab,
    currentPreset,
    currentEntity,
    exportAction,
}: DashboardHeaderNavProps) {
    const { locale, isEn } = useAppLocale()
    const t = getDashboardDictionary(locale)

    const [isExporting, setIsExporting] = useState(false)
    const [aiOpen, setAiOpen] = useState(false)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiSummary, setAiSummary] = useState<string | null>(null)
    const [aiError, setAiError] = useState<string | null>(null)

    const isExecutive = roles.some(r => ['CEO', 'ADMIN'].includes(r))

    const queryParams = new URLSearchParams()
    if (currentPreset) queryParams.set('preset', currentPreset)
    if (currentEntity) queryParams.set('entity', currentEntity)
    const queryString = queryParams.toString() ? `&${queryParams.toString()}` : ''

    const handleExportExcel = async () => {
        if (isExporting) return
        setIsExporting(true)
        try {
            const base64 = await exportAction()
            if (!base64) return
            const binaryString = window.atob(base64)
            const bytes = new Uint8Array(binaryString.length)
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i)
            }
            const blob = new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const dateStr = new Date().toISOString().slice(0, 10)
            a.download = `LYs_Cellars_CEO_Report_${dateStr}.xlsx`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Excel export failed:', err)
        } finally {
            setIsExporting(false)
        }
    }

    const handleFetchAiBriefing = async (forceRefresh = false) => {
        if (!forceRefresh && aiSummary) {
            setAiOpen(!aiOpen)
            return
        }
        setAiOpen(true)
        setAiLoading(true)
        setAiError(null)
        try {
            const res = await fetch('/api/ceo-summary', { method: 'POST' })
            const data = await res.json()
            if (data.success && data.summary) {
                setAiSummary(data.summary)
            } else {
                setAiError(data.error || t.aiBriefing.error)
            }
        } catch {
            setAiError(t.aiBriefing.error)
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {/* Top Title & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                        {t.dashboardTitle}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {userName ?? 'Dashboard'} &middot; {roles.join(', ')} &bull; {new Date().toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isExecutive && (
                        <button
                            type="button"
                            onClick={() => handleFetchAiBriefing(false)}
                            disabled={aiLoading}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-60"
                            style={{
                                background: aiOpen ? '#0891B2' : 'rgba(8,145,178,0.1)',
                                color: aiOpen ? '#FFFFFF' : '#0891B2',
                                border: '1px solid rgba(8,145,178,0.28)',
                            }}
                        >
                            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            <span>{t.aiBriefing.buttonLabel}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-60"
                        style={{ background: 'rgba(21,128,61,0.12)', color: '#15803D', border: '1px solid rgba(21,128,61,0.3)' }}
                    >
                        {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        <span>{isExporting ? t.exportingExcel : t.exportExcel}</span>
                    </button>
                </div>
            </div>

            {/* AI Executive Briefing Collapsible Panel */}
            {aiOpen && (
                <div
                    className="rounded-md p-4 transition-all"
                    style={{ background: '#F8FAFC', border: '1px solid #BAE6FD', borderLeft: '3px solid #0891B2' }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} style={{ color: '#0891B2' }} />
                            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0F172A' }}>
                                {t.aiBriefing.panelTitle}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handleFetchAiBriefing(true)}
                                disabled={aiLoading}
                                className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded cursor-pointer disabled:opacity-50"
                                style={{ background: '#FFFFFF', color: '#0891B2', border: '1px solid #E2E8F0' }}
                            >
                                <RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} />
                                <span>{t.aiBriefing.refresh}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAiOpen(false)}
                                className="p-1 rounded cursor-pointer hover:bg-slate-200/60"
                                style={{ color: '#64748B' }}
                                title={t.aiBriefing.close}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    {aiLoading ? (
                        <div className="flex items-center gap-2 py-4 text-xs" style={{ color: '#475569' }}>
                            <Loader2 size={14} className="animate-spin" style={{ color: '#0891B2' }} />
                            <span>{t.aiBriefing.loading}</span>
                        </div>
                    ) : aiError ? (
                        <p className="text-xs py-2" style={{ color: '#B91C1C' }}>{aiError}</p>
                    ) : (
                        <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: '#1E293B' }}>
                            {aiSummary}
                        </div>
                    )}
                </div>
            )}

            {/* Tab Navigation - Sleek Underline Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto no-scrollbar whitespace-nowrap">
                <Link
                    href={`/dashboard?tab=overview${queryString}`}
                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                        currentTab === 'overview'
                            ? 'border-slate-900 text-slate-900 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <BarChart3 size={15} className={currentTab === 'overview' ? 'text-slate-900' : 'text-slate-400'} />
                    <span>{t.executiveOverview}</span>
                </Link>
                <Link
                    href={`/dashboard?tab=customers${queryString}`}
                    className={`flex items-center gap-2 pb-2.5 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
                        currentTab === 'customers'
                            ? 'border-slate-900 text-slate-900 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Users size={15} className={currentTab === 'customers' ? 'text-slate-900' : 'text-slate-400'} />
                    <span>{t.customerAnalytics}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-normal">
                        {t.customerAnalyticsBadge}
                    </span>
                </Link>
            </div>
        </div>
    )
}
