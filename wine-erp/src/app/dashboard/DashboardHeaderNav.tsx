'use client'

import React from 'react'
import Link from 'next/link'
import { BarChart3, Users, Download } from 'lucide-react'
import { useAppLocale } from '@/lib/i18n'
import { getDashboardDictionary } from './i18n'

interface DashboardHeaderNavProps {
    userName?: string | null
    roles: string[]
    currentTab: 'overview' | 'customers'
    currentPreset?: string
    currentEntity?: string
    exportAction: () => Promise<void>
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

    const queryParams = new URLSearchParams()
    if (currentPreset) queryParams.set('preset', currentPreset)
    if (currentEntity) queryParams.set('entity', currentEntity)
    const queryString = queryParams.toString() ? `&${queryParams.toString()}` : ''

    return (
        <div className="space-y-4">
            {/* Top Title & Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                        {t.dashboardTitle}
                    </h2>
                    <p className="text-xs text-slate-500">
                        {userName ?? 'Dashboard'} · {roles.join(', ')} &bull; {new Date().toLocaleDateString(isEn ? 'en-US' : 'vi-VN')}
                    </p>
                </div>
                <form action={exportAction}>
                    <button
                        type="submit"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-colors"
                        style={{ background: 'rgba(21,128,61,0.12)', color: '#15803D', border: '1px solid rgba(21,128,61,0.3)' }}
                    >
                        <Download size={14} /> {t.exportExcel}
                    </button>
                </form>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                <Link
                    href={`/dashboard?tab=overview${queryString}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        currentTab === 'overview'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <BarChart3 size={15} className={currentTab === 'overview' ? 'text-cyan-700' : 'text-slate-400'} />
                    <span>{t.executiveOverview}</span>
                </Link>
                <Link
                    href={`/dashboard?tab=customers${queryString}`}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        currentTab === 'customers'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                >
                    <Users size={15} className={currentTab === 'customers' ? 'text-amber-700' : 'text-slate-400'} />
                    <span>{t.customerAnalytics}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        currentTab === 'customers' ? 'bg-amber-400/20 text-amber-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                        {t.customerAnalyticsBadge}
                    </span>
                </Link>
            </div>
        </div>
    )
}
