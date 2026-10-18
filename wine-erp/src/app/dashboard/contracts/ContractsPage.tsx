'use client'

import React, { useState } from 'react'
import { FileSignature, Shield, Scale, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getContractsDict } from './i18n'
import { ContractsClient } from './ContractsClient'
import { RegDocsTab } from './RegDocsTab'
import { ContractTemplatesTab } from './ContractTemplatesTab'
import { CreateFromTemplateDrawer } from './CreateFromTemplateDrawer'
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

type TabKey = 'contracts' | 'templates' | 'regdocs'

export function ContractsPage({
    contractRows, contractTotal, contractStats,
    regDocRows, regDocTotal, regDocStats,
}: Props) {
    const { locale } = useAppLocale()
    const t = getContractsDict(locale)

    const [activeTab, setActiveTab] = useState<TabKey>('contracts')
    const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
    const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | undefined>()
    const [refreshKey, setRefreshKey] = useState(0)

    const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
        { key: 'contracts', label: t.page.tabs.contracts, icon: FileSignature },
        { key: 'templates', label: t.page.tabs.templates, icon: BookOpen },
        { key: 'regdocs', label: t.page.tabs.regdocs, icon: Shield },
    ]

    // Badge counts for tabs
    const contractBadge = contractStats.expiringSoon > 0 ? contractStats.expiringSoon : null
    const regDocBadge = (regDocStats.expiringSoon + regDocStats.expired) > 0
        ? regDocStats.expiringSoon + regDocStats.expired
        : null

    const handleOpenTemplateDrawer = (code?: string) => {
        setSelectedTemplateCode(code)
        setTemplateDrawerOpen(true)
    }

    const handleTemplateCreated = () => {
        setTemplateDrawerOpen(false)
        setActiveTab('contracts')
        setRefreshKey(k => k + 1)
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title={t.page.title}
                description={t.page.description}
                actions={
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-lys-primary/10 text-lys-primary border border-lys-primary/20 whitespace-nowrap shrink-0">
                        <Scale size={14} /> {t.page.badge}
                    </span>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white rounded-lg border border-lys-border w-fit max-w-full overflow-x-auto">
                {tabs.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.key
                    const badge = tab.key === 'contracts' ? contractBadge : tab.key === 'regdocs' ? regDocBadge : null
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
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
                    key={refreshKey}
                    initialRows={contractRows}
                    initialTotal={contractTotal}
                    stats={contractStats}
                    onOpenTemplateDrawer={handleOpenTemplateDrawer}
                />
            )}
            {activeTab === 'templates' && (
                <ContractTemplatesTab
                    onSelectTemplateToCreate={handleOpenTemplateDrawer}
                />
            )}
            {activeTab === 'regdocs' && (
                <RegDocsTab
                    initialRows={regDocRows}
                    initialTotal={regDocTotal}
                    stats={regDocStats}
                />
            )}

            {/* Global Template Drawer */}
            <CreateFromTemplateDrawer
                open={templateDrawerOpen}
                initialTemplateCode={selectedTemplateCode}
                onClose={() => setTemplateDrawerOpen(false)}
                onSuccess={handleTemplateCreated}
            />
        </div>
    )
}
