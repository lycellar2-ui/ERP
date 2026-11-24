'use client'

import React, { useState } from 'react'
import { FileSignature, Shield, Scale, BookOpen } from 'lucide-react'
import { PageContainer, PageHeader, Badge, StatusTabs } from '@/components/ui'
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

    const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }> }> = [
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
        <PageContainer>
            {/* Header */}
            <PageHeader
                description={t.page.description}
                actions={
                    <Badge tone="brand" className="gap-1.5 py-1 px-2.5 whitespace-nowrap shrink-0">
                        <Scale size={13} aria-hidden /> {t.page.badge}
                    </Badge>
                }
            />

            {/* Tab Navigation */}
            <StatusTabs
                items={tabs.map(tab => {
                    const badge = tab.key === 'contracts' ? contractBadge : tab.key === 'regdocs' ? regDocBadge : null
                    return {
                        value: tab.key,
                        label: tab.label,
                        icon: tab.icon,
                        count: (badge !== null && badge > 0) ? badge : undefined,
                    }
                })}
                value={activeTab}
                onChange={setActiveTab}
            />

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
        </PageContainer>
    )
}
