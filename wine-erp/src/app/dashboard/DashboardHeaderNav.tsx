'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { BarChart3, Users, Wine, Download, Sparkles, RefreshCw, X, Loader2 } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'

interface DashboardHeaderNavProps {
    userName?: string | null
    roles: string[]
    currentTab: 'overview' | 'customers' | 'skus'
    currentPreset?: string
    currentEntity?: string
    exportAction: () => Promise<string>
}

export function DashboardHeaderNav({
    roles,
    currentTab,
    currentPreset,
    currentEntity,
    exportAction,
}: DashboardHeaderNavProps) {
    const { locale } = useAppLocale()
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
        <div className="space-y-3">
            {/* Unified Tab Bar + Executive Actions */}
            <div className="flex flex-wrap xl:flex-nowrap items-end justify-between gap-3 border-b border-lys-border">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap -mb-px min-w-0">
                    <Link
                        href={`/dashboard?tab=overview${queryString}`}
                        className={`relative flex items-center gap-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
                            currentTab === 'overview'
                                ? 'border-lys-teal text-lys-teal-strong'
                                : 'border-transparent text-lys-muted hover:text-lys-primary'
                        }`}
                    >
                        <BarChart3 size={15} className={currentTab === 'overview' ? 'text-lys-teal-strong' : 'text-lys-dim'} />
                        <span>{t.executiveOverview}</span>
                    </Link>
                    <Link
                        href={`/dashboard?tab=customers${queryString}`}
                        className={`relative flex items-center gap-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
                            currentTab === 'customers'
                                ? 'border-lys-teal text-lys-teal-strong'
                                : 'border-transparent text-lys-muted hover:text-lys-primary'
                        }`}
                    >
                        <Users size={15} className={currentTab === 'customers' ? 'text-lys-teal-strong' : 'text-lys-dim'} />
                        <span>{t.customerAnalytics}</span>
                        <span className="hidden 2xl:inline-flex">
                            <Badge tone={currentTab === 'customers' ? 'brand' : 'neutral'}>{t.customerAnalyticsBadge}</Badge>
                        </span>
                    </Link>
                    <Link
                        href={`/dashboard?tab=skus${queryString}`}
                        className={`relative flex items-center gap-2 px-3 pb-2.5 pt-1 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
                            currentTab === 'skus'
                                ? 'border-lys-teal text-lys-teal-strong'
                                : 'border-transparent text-lys-muted hover:text-lys-primary'
                        }`}
                    >
                        <Wine size={15} className={currentTab === 'skus' ? 'text-lys-teal-strong' : 'text-lys-dim'} />
                        <span>{t.skuAnalytics}</span>
                        <span className="hidden 2xl:inline-flex">
                            <Badge tone={currentTab === 'skus' ? 'brand' : 'neutral'}>{t.skuAnalyticsBadge}</Badge>
                        </span>
                    </Link>
                </div>

                <div className="flex items-center gap-2 pb-2 shrink-0">
                    {isExecutive && (
                        <Button
                            size="sm"
                            variant={aiOpen ? 'primary' : 'secondary'}
                            onClick={() => handleFetchAiBriefing(false)}
                            loading={aiLoading}
                        >
                            {!aiLoading && <Sparkles size={14} className={aiOpen ? 'text-white' : 'text-lys-teal-strong'} aria-hidden />}
                            <span>{t.aiBriefing.buttonLabel}</span>
                        </Button>
                    )}
                    {currentTab !== 'customers' && (
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-md bg-tone-success-bg text-tone-success-fg border border-tone-success-border hover:bg-emerald-100/70 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            <span>{isExporting ? t.exportingExcel : t.exportExcel}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* AI Executive Briefing Collapsible Panel */}
            {aiOpen && (
                <div className="bg-lys-card border border-tone-brand-border border-l-[3px] border-l-lys-teal-strong rounded-lg shadow-xs p-4 transition-all">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-lys-teal-strong" aria-hidden />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-lys-primary">
                                {t.aiBriefing.panelTitle}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleFetchAiBriefing(true)}
                                disabled={aiLoading}
                                className="h-7 px-2 text-[11px]"
                            >
                                <RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} />
                                <span>{t.aiBriefing.refresh}</span>
                            </Button>
                            <button
                                type="button"
                                onClick={() => setAiOpen(false)}
                                aria-label={t.aiBriefing.close}
                                className="p-1.5 rounded-md text-lys-muted hover:text-lys-primary hover:bg-lys-subtle transition-colors cursor-pointer"
                                title={t.aiBriefing.close}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                    {aiLoading ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-lys-secondary">
                            <Loader2 size={14} className="animate-spin text-lys-teal-strong" />
                            <span>{t.aiBriefing.loading}</span>
                        </div>
                    ) : aiError ? (
                        <p className="text-xs py-2 text-tone-danger-fg">{aiError}</p>
                    ) : (
                        <div className="text-xs leading-relaxed whitespace-pre-line text-lys-primary">
                            {aiSummary}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
