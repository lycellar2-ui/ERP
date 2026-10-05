'use client'

import React, { useState } from 'react'
import { FileSignature, Shield, Scale } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { ContractsClient } from './ContractsClient'
import { RegDocsTab } from './RegDocsTab'
import type { ContractRow } from './actions'
import type { RegDocRow } from './reg-doc-actions'

interface Props {
    contractRows: ContractRow[]
    contractTotal: number
    contractStats: { total: number; active: number; expiringSoon: number; expired: number }
    regDocRows: RegDocRow[]
    regDocTotal: number
    regDocStats: {
        total: number; active: number; expiringSoon: number; expired: number
        categoryBreakdown: Record<string, number>
    }
}

const TABS = [
    { key: 'contracts', label: 'Hợp Đồng', icon: FileSignature },
    { key: 'regdocs', label: 'Giấy Tờ Có Hạn', icon: Shield },
] as const

type TabKey = typeof TABS[number]['key']

export function ContractsPage({
    contractRows, contractTotal, contractStats,
    regDocRows, regDocTotal, regDocStats,
}: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>('contracts')

    // Badge counts for tabs
    const contractBadge = contractStats.expiringSoon > 0 ? contractStats.expiringSoon : null
    const regDocBadge = (regDocStats.expiringSoon + regDocStats.expired) > 0
        ? regDocStats.expiringSoon + regDocStats.expired
        : null

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title="Trung Tâm Pháp Lý & Tuân Thủ"
                description="Quản lý hợp đồng, giấy phép, chứng nhận và chứng từ có thời hạn"
                actions={
                    <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-lys-primary/10 text-lys-primary border border-lys-primary/20">
                        <Scale size={14} /> Pháp lý & Tuân thủ
                    </span>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white rounded-lg border border-lys-border w-fit">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    const badge = tab.key === 'contracts' ? contractBadge : regDocBadge
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                                isActive
                                    ? 'bg-lys-primary/10 text-lys-primary border-b-2 border-lys-primary'
                                    : 'text-lys-muted hover:text-lys-title hover:bg-lys-bg'
                            }`}
                        >
                            <Icon size={15} />
                            {tab.label}
                            {badge !== null && badge > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                                    tab.key === 'regdocs' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {badge}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'contracts' && (
                <ContractsClient
                    initialRows={contractRows}
                    initialTotal={contractTotal}
                    stats={contractStats}
                />
            )}
            {activeTab === 'regdocs' && (
                <RegDocsTab
                    initialRows={regDocRows}
                    initialTotal={regDocTotal}
                    stats={regDocStats}
                />
            )}
        </div>
    )
}
