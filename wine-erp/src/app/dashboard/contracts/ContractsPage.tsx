'use client'

import React, { useState } from 'react'
import { FileSignature, Shield, Scale } from 'lucide-react'
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
        <div className="space-y-5 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        <Scale size={24} style={{ color: '#87CBB9' }} />
                        Trung Tâm Pháp Lý & Tuân Thủ
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý hợp đồng, giấy phép, chứng nhận và chứng từ có thời hạn
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    const badge = tab.key === 'contracts' ? contractBadge : regDocBadge
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-all relative"
                            style={{
                                background: isActive ? 'rgba(135,203,185,0.12)' : 'transparent',
                                color: isActive ? '#87CBB9' : '#4A6A7A',
                                borderBottom: isActive ? '2px solid #87CBB9' : '2px solid transparent',
                            }}
                            onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.color = '#8AAEBB'
                            }}
                            onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.color = '#4A6A7A'
                            }}>
                            <Icon size={16} />
                            {tab.label}
                            {badge !== null && badge > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                                    style={{
                                        background: tab.key === 'regdocs' ? 'rgba(224,82,82,0.2)' : 'rgba(212,168,83,0.2)',
                                        color: tab.key === 'regdocs' ? '#E05252' : '#D4A853',
                                    }}>
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
