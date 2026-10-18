'use client'

import React, { useState, useCallback, useEffect } from 'react'
import {
    Globe, Package, FileText, CheckCircle2, Clock, Users, Plus, X, Loader2,
    AlertTriangle, Ship, Eye, Check, XCircle, UploadCloud, Link,
    Anchor, Warehouse, Mail
} from 'lucide-react'
import {
    AgencyPartnerRow, AgencySubmissionRow, AgencyDashboardStats, AgencyDocumentRow,
    getAgencyPartners, getAgencySubmissions, getAgencyDashboardStats,
    createAgencyPartner, createAgencySubmission, reviewAgencySubmission,
    getActiveShipments, uploadAgencyDocument, getSubmissionDocuments,
    assignShipmentToPartner,
} from './actions'
import { toast } from 'sonner'
import {
    PageHeader, StatGrid, StatCard, Button, StatusTabs, Toolbar,
    Select, Input, Field, Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    StatusBadge, Badge, EmptyState
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'
import { useAppLocale } from '@/lib/i18n'
import { AGENCY_I18N } from './i18n'
import { cn } from '@/lib/utils'

const STATUS_TONES: Record<string, Tone> = {
    PENDING_REVIEW: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    ACTIVE: 'success',
}

const PARTNER_TYPE_TONES: Record<string, Tone> = {
    CUSTOMS_BROKER: 'warning',
    FORWARDER: 'info',
    SURVEYOR: 'brand',
}

const SHIPMENT_MILESTONES = [
    { key: 'BOOKED', icon: Package },
    { key: 'ON_VESSEL', icon: Ship },
    { key: 'ARRIVED_PORT', icon: Anchor },
    { key: 'CUSTOMS_CLEARED', icon: CheckCircle2 },
    { key: 'DELIVERED_TO_WAREHOUSE', icon: Warehouse },
] as const

type TabKey = 'submissions' | 'assignments' | 'partners'

function AgencySubmissionMobileCard({
    sub,
    onToggleExpand,
    isExpanded,
    onReview,
    isReviewing,
    i18n,
    formatDate,
}: {
    sub: AgencySubmissionRow
    onToggleExpand: (id: string) => void
    isExpanded: boolean
    onReview: (id: string, action: 'APPROVED' | 'REJECTED') => void
    isReviewing: boolean
    i18n: typeof AGENCY_I18N['vi']
    formatDate: (d: string | Date) => string
}) {
    const ptLabel = (i18n.partnerType as Record<string, string>)[sub.partnerType] ?? sub.partnerType
    const ptTone = PARTNER_TYPE_TONES[sub.partnerType] ?? 'neutral'
    const stLabel = (i18n.status as Record<string, string>)[sub.status] ?? sub.status

    return (
        <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h4 className="text-sm font-bold text-lys-primary">{sub.partnerName}</h4>
                    <Badge tone={ptTone} className="mt-1">{ptLabel}</Badge>
                </div>
                <StatusBadge status={sub.status} label={stLabel} toneOverrides={STATUS_TONES} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs border-t border-lys-border pt-2 text-lys-secondary">
                <div>
                    <span className="text-lys-muted block text-[10px] uppercase font-semibold">{i18n.columns.bl}</span>
                    <span className="font-mono font-bold text-lys-teal-strong">{sub.shipmentBol || '—'}</span>
                </div>
                <div>
                    <span className="text-lys-muted block text-[10px] uppercase font-semibold">{i18n.columns.declaration}</span>
                    <span className="font-mono">{sub.declarationNo || '—'}</span>
                </div>
                <div>
                    <span className="text-lys-muted block text-[10px] uppercase font-semibold">{i18n.columns.docs}</span>
                    <span className={sub.documentCount > 0 ? 'text-tone-success-fg font-semibold' : 'text-lys-muted'}>
                        {sub.documentCount} {i18n.filesSuffix}
                    </span>
                </div>
                <div>
                    <span className="text-lys-muted block text-[10px] uppercase font-semibold">{i18n.columns.submittedAt}</span>
                    <span>{formatDate(sub.submittedAt)}</span>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-lys-border pt-2 gap-2 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => onToggleExpand(sub.id)}>
                    <Eye size={12} aria-hidden /> {isExpanded ? i18n.hideDetails : i18n.viewDetails}
                </Button>

                {sub.status === 'PENDING_REVIEW' && (
                    <div className="flex gap-1.5 ml-auto">
                        <Button
                            size="sm"
                            onClick={() => onReview(sub.id, 'APPROVED')}
                            disabled={isReviewing}
                        >
                            <Check size={12} aria-hidden /> {i18n.approve}
                        </Button>
                        <Button
                            size="sm"
                            variant="danger-outline"
                            onClick={() => onReview(sub.id, 'REJECTED')}
                            disabled={isReviewing}
                        >
                            <XCircle size={12} aria-hidden /> {i18n.reject}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export function AgencyClient() {
    const { locale, formatDate } = useAppLocale()
    const i18n = AGENCY_I18N[locale]

    const [tab, setTab] = useState<TabKey>('submissions')
    const [stats, setStats] = useState<AgencyDashboardStats | null>(null)

    const [submissions, setSubmissions] = useState<AgencySubmissionRow[]>([])
    const [subsLoading, setSubsLoading] = useState(false)
    const [subsFilter, setSubsFilter] = useState('')

    const [partners, setPartners] = useState<AgencyPartnerRow[]>([])
    const [partnersLoading, setPartnersLoading] = useState(false)

    const [showCreatePartner, setShowCreatePartner] = useState(false)
    const [partnerForm, setPartnerForm] = useState({ code: '', name: '', type: 'CUSTOMS_BROKER' as const, email: '', password: '' })
    const [creatingPartner, setCreatingPartner] = useState(false)
    const [partnerError, setPartnerError] = useState('')

    const [showCreateSub, setShowCreateSub] = useState(false)
    const [shipments, setShipments] = useState<any[]>([])
    const [shipmentsLoading, setShipmentsLoading] = useState(false)
    const [subForm, setSubForm] = useState({ partnerId: '', shipmentId: '', declarationNo: '', eta: '', additionalCosts: '', notes: '' })
    const [creatingSub, setCreatingSub] = useState(false)
    const [subError, setSubError] = useState('')

    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [reviewAction, setReviewAction] = useState<'APPROVED' | 'REJECTED' | null>(null)

    const [expandedSubId, setExpandedSubId] = useState<string | null>(null)
    const [documents, setDocuments] = useState<AgencyDocumentRow[]>([])
    const [docsLoading, setDocsLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [selectedDocType, setSelectedDocType] = useState('OTHER')

    const [assignShipments, setAssignShipments] = useState<any[]>([])
    const [assignLoading, setAssignLoading] = useState(false)
    const [assignForm, setAssignForm] = useState({ shipmentId: '', partnerId: '', role: 'FORWARDER' as 'FORWARDER' | 'CUSTOMS_BROKER' })
    const [assigning, setAssigning] = useState(false)

    const loadStats = useCallback(async () => {
        const data = await getAgencyDashboardStats()
        setStats(data)
    }, [])

    const loadSubmissions = useCallback(async (status?: string) => {
        setSubsLoading(true)
        const data = await getAgencySubmissions({ status: status || undefined })
        setSubmissions(data)
        setSubsLoading(false)
    }, [])

    const loadPartners = useCallback(async () => {
        setPartnersLoading(true)
        const data = await getAgencyPartners()
        setPartners(data)
        setPartnersLoading(false)
    }, [])

    useEffect(() => {
        loadStats()
        loadSubmissions()
        loadPartners()
    }, [loadStats, loadSubmissions, loadPartners])

    const handleCreatePartner = async () => {
        if (!partnerForm.code || !partnerForm.name || !partnerForm.email) return
        setCreatingPartner(true)
        setPartnerError('')
        const result = await createAgencyPartner({
            ...partnerForm,
            type: partnerForm.type as any,
            passwordHash: partnerForm.password || 'temp_hash',
        })
        if (result.success) {
            setShowCreatePartner(false)
            setPartnerForm({ code: '', name: '', type: 'CUSTOMS_BROKER', email: '', password: '' })
            loadPartners()
            loadStats()
        } else {
            setPartnerError(result.error || 'Error')
        }
        setCreatingPartner(false)
    }

    const openCreateSub = async () => {
        setShowCreateSub(true)
        setShipmentsLoading(true)
        setSubError('')
        const data = await getActiveShipments()
        setShipments(data)
        setShipmentsLoading(false)
    }

    const handleCreateSub = async () => {
        if (!subForm.partnerId || !subForm.shipmentId) return
        setCreatingSub(true)
        setSubError('')
        const result = await createAgencySubmission({
            partnerId: subForm.partnerId,
            shipmentId: subForm.shipmentId,
            declarationNo: subForm.declarationNo || undefined,
            eta: subForm.eta || undefined,
            additionalCosts: subForm.additionalCosts ? Number(subForm.additionalCosts) : undefined,
            notes: subForm.notes || undefined,
        })
        if (result.success) {
            setShowCreateSub(false)
            setSubForm({ partnerId: '', shipmentId: '', declarationNo: '', eta: '', additionalCosts: '', notes: '' })
            loadSubmissions()
            loadStats()
        } else {
            setSubError(result.error || 'Error')
        }
        setCreatingSub(false)
    }

    const handleReview = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
        setReviewingId(id)
        setReviewAction(decision)
        await reviewAgencySubmission(id, decision, 'system_admin')
        setReviewingId(null)
        setReviewAction(null)
        loadSubmissions(subsFilter)
        loadStats()
    }

    const toggleExpand = async (subId: string) => {
        if (expandedSubId === subId) { setExpandedSubId(null); return }
        setExpandedSubId(subId)
        setDocsLoading(true)
        const docs = await getSubmissionDocuments(subId)
        setDocuments(docs)
        setDocsLoading(false)
    }

    const handleUploadDoc = async (subId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadAgencyDocument(subId, formData, selectedDocType)
        if (res.success) {
            const docs = await getSubmissionDocuments(subId)
            setDocuments(docs)
            loadSubmissions(subsFilter)
        } else {
            toast.error(`Error: ${res.error || ''}`)
        }
        setUploadingDoc(false)
        e.target.value = ''
    }

    const tabItems = [
        { value: 'submissions' as TabKey, label: i18n.tabs.submissions, count: stats?.pendingSubmissions ?? 0 },
        { value: 'assignments' as TabKey, label: i18n.tabs.assignments },
        { value: 'partners' as TabKey, label: i18n.tabs.partners, count: partners.length },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <PageHeader
                description={i18n.description}
            />

            {/* Stats */}
            <StatGrid>
                <StatCard icon={Users} label={i18n.stats.partners} value={stats?.totalPartners ?? 0} />
                <StatCard icon={Clock} label={i18n.stats.pendingReview} value={stats?.pendingSubmissions ?? 0} tone={(stats?.pendingSubmissions ?? 0) > 0 ? 'warning' : undefined} />
                <StatCard icon={CheckCircle2} label={i18n.stats.approvedThisMonth} value={stats?.approvedThisMonth ?? 0} tone="success" />
                <StatCard icon={Ship} label={i18n.stats.activeShipments} value={stats?.activeShipments ?? 0} tone="info" />
            </StatGrid>

            {/* Tabs */}
            <StatusTabs
                items={tabItems}
                value={tab}
                onChange={v => setTab(v)}
            />

            {/* ═══ SUBMISSIONS TAB ═══ */}
            {tab === 'submissions' && (
                <div className="space-y-4">
                    <Toolbar
                        left={
                            <Select
                                value={subsFilter}
                                onChange={e => { setSubsFilter(e.target.value); loadSubmissions(e.target.value) }}
                                className="w-56"
                            >
                                <option value="">{i18n.allStatuses}</option>
                                {Object.entries(i18n.status).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </Select>
                        }
                        right={
                            <Button onClick={openCreateSub}>
                                <Plus size={14} aria-hidden /> {i18n.createSubmission}
                            </Button>
                        }
                    />

                    {/* Create Submission inline */}
                    {showCreateSub && (
                        <div className="p-5 rounded-lg bg-white border border-lys-border shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-lys-primary">{i18n.createSubTitle}</h4>
                                <Button size="sm" variant="ghost" onClick={() => setShowCreateSub(false)}><X size={16} /></Button>
                            </div>

                            {shipmentsLoading ? (
                                <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-lys-teal-strong" /></div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Field label={i18n.partnerLabel} required>
                                        {id => (
                                            <Select id={id} value={subForm.partnerId} onChange={e => setSubForm(f => ({ ...f, partnerId: e.target.value }))}>
                                                <option value="">{i18n.selectPartner}</option>
                                                {partners.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({(i18n.partnerType as Record<string, string>)[p.type] ?? p.type})
                                                    </option>
                                                ))}
                                            </Select>
                                        )}
                                    </Field>
                                    <Field label={i18n.shipmentLabel} required>
                                        {id => (
                                            <Select id={id} value={subForm.shipmentId} onChange={e => setSubForm(f => ({ ...f, shipmentId: e.target.value }))}>
                                                <option value="">{i18n.selectShipment}</option>
                                                {shipments.map(s => (
                                                    <option key={s.id} value={s.id}>{s.billOfLading} — {s.vesselName || 'N/A'}</option>
                                                ))}
                                            </Select>
                                        )}
                                    </Field>
                                    <Field label={i18n.declarationNoLabel}>
                                        {id => (
                                            <Input
                                                id={id}
                                                value={subForm.declarationNo}
                                                onChange={e => setSubForm(f => ({ ...f, declarationNo: e.target.value }))}
                                                placeholder="305-2026-0123"
                                            />
                                        )}
                                    </Field>
                                    <Field label={i18n.etaLabel}>
                                        {id => (
                                            <Input
                                                id={id}
                                                type="date"
                                                value={subForm.eta}
                                                onChange={e => setSubForm(f => ({ ...f, eta: e.target.value }))}
                                            />
                                        )}
                                    </Field>
                                    <Field label={i18n.additionalCostsLabel}>
                                        {id => (
                                            <Input
                                                id={id}
                                                type="number"
                                                value={subForm.additionalCosts}
                                                onChange={e => setSubForm(f => ({ ...f, additionalCosts: e.target.value }))}
                                                placeholder="5000000"
                                            />
                                        )}
                                    </Field>
                                    <Field label={i18n.notesLabel}>
                                        {id => (
                                            <Input
                                                id={id}
                                                value={subForm.notes}
                                                onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                                                placeholder={i18n.notesPlaceholder}
                                            />
                                        )}
                                    </Field>
                                </div>
                            )}

                            {subError && (
                                <p className="text-xs flex items-center gap-1 text-tone-danger-fg">
                                    <AlertTriangle size={12} /> {subError}
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => setShowCreateSub(false)}>{i18n.cancel}</Button>
                                <Button onClick={handleCreateSub} loading={creatingSub} disabled={creatingSub || !subForm.partnerId || !subForm.shipmentId}>
                                    {creatingSub ? i18n.creating : i18n.submitSubmission}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Submissions table (Desktop) */}
                    <div className="hidden md:block">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{i18n.columns.partner}</Th>
                                    <Th>{i18n.columns.type}</Th>
                                    <Th>{i18n.columns.bl}</Th>
                                    <Th>{i18n.columns.declaration}</Th>
                                    <Th>{i18n.columns.docs}</Th>
                                    <Th>{i18n.columns.submittedAt}</Th>
                                    <Th>{i18n.columns.status}</Th>
                                    <Th>{i18n.columns.actions}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {subsLoading ? (
                                    <Tr><Td colSpan={8} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-lys-teal-strong" /></Td></Tr>
                                ) : submissions.length === 0 ? (
                                    <TableMessageRow colSpan={8}>
                                        <EmptyState icon={Globe} title={i18n.emptySubmissions} />
                                    </TableMessageRow>
                                ) : submissions.map(sub => {
                                    const ptLabel = (i18n.partnerType as Record<string, string>)[sub.partnerType] ?? sub.partnerType
                                    const ptTone = PARTNER_TYPE_TONES[sub.partnerType] ?? 'neutral'
                                    const stLabel = (i18n.status as Record<string, string>)[sub.status] ?? sub.status
                                    const isReviewing = reviewingId === sub.id
                                    const isExpanded = expandedSubId === sub.id

                                    return (
                                        <React.Fragment key={sub.id}>
                                            <Tr onClick={() => toggleExpand(sub.id)}>
                                                <Td className="font-semibold text-lys-primary">{sub.partnerName}</Td>
                                                <Td><Badge tone={ptTone}>{ptLabel}</Badge></Td>
                                                <Td className="font-mono text-xs font-bold text-lys-teal-strong">{sub.shipmentBol || '—'}</Td>
                                                <Td className="font-mono text-xs text-lys-secondary">{sub.declarationNo || '—'}</Td>
                                                <Td className={cn('text-xs font-bold', sub.documentCount > 0 ? 'text-tone-success-fg' : 'text-lys-muted')}>
                                                    {sub.documentCount} {i18n.filesSuffix}
                                                </Td>
                                                <Td className="text-xs text-lys-secondary">{formatDate(sub.submittedAt)}</Td>
                                                <Td>
                                                    <StatusBadge status={sub.status} label={stLabel} toneOverrides={STATUS_TONES} />
                                                </Td>
                                                <Td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                                    {sub.status === 'PENDING_REVIEW' ? (
                                                        <div className="flex gap-1.5">
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleReview(sub.id, 'APPROVED')}
                                                                loading={isReviewing && reviewAction === 'APPROVED'}
                                                                disabled={isReviewing}
                                                            >
                                                                <Check size={11} aria-hidden /> {i18n.approve}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="danger-outline"
                                                                onClick={() => handleReview(sub.id, 'REJECTED')}
                                                                loading={isReviewing && reviewAction === 'REJECTED'}
                                                                disabled={isReviewing}
                                                            >
                                                                <XCircle size={11} aria-hidden /> {i18n.reject}
                                                            </Button>
                                                        </div>
                                                    ) : sub.reviewedAt ? (
                                                        <span className="text-xs text-lys-muted">{formatDate(sub.reviewedAt)}</span>
                                                    ) : null}
                                                </Td>
                                            </Tr>
                                            {isExpanded && (
                                                <Tr className="bg-lys-subtle/50">
                                                    <Td colSpan={8} className="px-6 py-4">
                                                        {docsLoading ? (
                                                            <div className="flex items-center gap-2 text-xs text-lys-muted">
                                                                <Loader2 size={12} className="animate-spin" /> {i18n.loadingDocs}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                {sub.shipmentStatus && (
                                                                    <div className="mb-4 pb-4 border-b border-lys-border">
                                                                        <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-tone-warning-fg">
                                                                            {i18n.shipmentTracking} {sub.vesselName && `— ${sub.vesselName}`}
                                                                            {sub.shipmentEta && <span className="text-lys-muted"> · ETA: {formatDate(sub.shipmentEta)}</span>}
                                                                        </p>
                                                                        <div className="flex items-center gap-0">
                                                                            {SHIPMENT_MILESTONES.map((m, i) => {
                                                                                const currentIdx = SHIPMENT_MILESTONES.findIndex(ms => ms.key === sub.shipmentStatus)
                                                                                const isDone = i <= currentIdx
                                                                                const isCurrent = i === currentIdx
                                                                                const mLabel = (i18n.milestones as Record<string, string>)[m.key] ?? m.key
                                                                                return (
                                                                                    <React.Fragment key={m.key}>
                                                                                        <div className="flex flex-col items-center min-w-[70px]">
                                                                                            <div className={cn(
                                                                                                'w-8 h-8 rounded-full flex items-center justify-center text-sm mb-1 transition-all border-2',
                                                                                                isDone
                                                                                                    ? (isCurrent ? 'bg-lys-teal-soft border-lys-teal-strong text-lys-teal-strong' : 'bg-tone-success-bg border-tone-success-fg text-tone-success-fg')
                                                                                                    : 'bg-white border-lys-border text-lys-muted'
                                                                                            )}>
                                                                                                <m.icon size={14} />
                                                                                            </div>
                                                                                            <span className={cn(
                                                                                                'text-[10px] font-semibold text-center leading-tight',
                                                                                                isDone ? (isCurrent ? 'text-lys-teal-strong' : 'text-tone-success-fg') : 'text-lys-muted'
                                                                                            )}>
                                                                                                {mLabel}
                                                                                            </span>
                                                                                        </div>
                                                                                        {i < SHIPMENT_MILESTONES.length - 1 && (
                                                                                            <div className={cn('flex-1 h-0.5 -mt-4 min-w-[16px]', i < currentIdx ? 'bg-tone-success-fg' : 'bg-lys-border')} />
                                                                                        )}
                                                                                    </React.Fragment>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-lys-teal-strong">
                                                                        {i18n.attachedDocs} ({documents.length})
                                                                    </p>
                                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                                        <Select
                                                                            value={selectedDocType}
                                                                            onChange={e => setSelectedDocType(e.target.value)}
                                                                            className="w-40 text-xs"
                                                                        >
                                                                            {Object.entries(i18n.docTypes).map(([k, v]) => (
                                                                                <option key={k} value={k}>{v}</option>
                                                                            ))}
                                                                        </Select>
                                                                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 bg-lys-teal-soft text-lys-teal-strong border border-lys-teal">
                                                                            {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                                            {uploadingDoc ? i18n.uploading : i18n.uploadFile}
                                                                            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png,.xlsx"
                                                                                onChange={e => handleUploadDoc(sub.id, e)} disabled={uploadingDoc} />
                                                                        </label>
                                                                    </div>
                                                                </div>

                                                                {documents.length > 0 ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                        {documents.map(doc => (
                                                                            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noreferrer"
                                                                                onClick={e => e.stopPropagation()}
                                                                                className="flex items-center gap-3 p-3 rounded transition-colors bg-white hover:bg-lys-subtle border border-lys-border">
                                                                                <FileText size={18} className="text-lys-secondary shrink-0" />
                                                                                <div className="overflow-hidden flex-1">
                                                                                    <p className="text-xs font-semibold text-tone-warning-fg">{doc.typeLabel}</p>
                                                                                    <p className="text-[10px] truncate text-lys-muted">{formatDate(doc.uploadedAt)}</p>
                                                                                </div>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs italic text-lys-muted">{i18n.noDocsYet}</p>
                                                                )}

                                                                {sub.notes && (
                                                                    <div className="mt-2 pt-2 border-t border-lys-border">
                                                                        <p className="text-[10px] uppercase font-semibold mb-1 text-lys-muted">{i18n.notesLabel}</p>
                                                                        <p className="text-xs text-lys-secondary">{sub.notes}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Td>
                                                </Tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Submissions Mobile Card List */}
                    <div className="block md:hidden space-y-3">
                        {subsLoading ? (
                            <div className="p-8 text-center bg-white rounded-lg border border-lys-border">
                                <Loader2 size={20} className="animate-spin mx-auto text-lys-teal-strong" />
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="p-8 bg-white rounded-lg border border-lys-border">
                                <EmptyState icon={Globe} title={i18n.emptySubmissions} />
                            </div>
                        ) : (
                            submissions.map(sub => (
                                <AgencySubmissionMobileCard
                                    key={sub.id}
                                    sub={sub}
                                    onToggleExpand={toggleExpand}
                                    isExpanded={expandedSubId === sub.id}
                                    onReview={handleReview}
                                    isReviewing={reviewingId === sub.id}
                                    i18n={i18n as any}
                                    formatDate={formatDate}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ═══ ASSIGNMENTS TAB ═══ */}
            {tab === 'assignments' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-lys-primary">{i18n.assignTitle}</p>
                            <p className="text-xs mt-0.5 text-lys-muted">{i18n.assignDesc}</p>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            loading={assignLoading}
                            onClick={async () => {
                                setAssignLoading(true)
                                const d = await getActiveShipments()
                                setAssignShipments(d)
                                setAssignLoading(false)
                            }}
                        >
                            {i18n.loadShipmentsBtn}
                        </Button>
                    </div>

                    <div className="p-5 rounded-lg bg-white border border-lys-border shadow-2xs space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label={i18n.shipmentLabel}>
                                {id => (
                                    <Select id={id} value={assignForm.shipmentId} onChange={e => setAssignForm(f => ({ ...f, shipmentId: e.target.value }))}>
                                        <option value="">{i18n.selectShipment}</option>
                                        {assignShipments.map(s => <option key={s.id} value={s.id}>{s.billOfLading} — {s.vesselName ?? 'TBC'}</option>)}
                                    </Select>
                                )}
                            </Field>
                            <Field label={i18n.partnerLabel}>
                                {id => (
                                    <Select id={id} value={assignForm.partnerId} onChange={e => setAssignForm(f => ({ ...f, partnerId: e.target.value }))}>
                                        <option value="">{i18n.selectPartner}</option>
                                        {partners.filter(p => p.status === 'ACTIVE').map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({(i18n.partnerType as Record<string, string>)[p.type] ?? p.type})
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </Field>
                            <Field label={i18n.roleLabel}>
                                {id => (
                                    <Select id={id} value={assignForm.role} onChange={e => setAssignForm(f => ({ ...f, role: e.target.value as any }))}>
                                        <option value="FORWARDER">{i18n.partnerType.FORWARDER}</option>
                                        <option value="CUSTOMS_BROKER">{i18n.partnerType.CUSTOMS_BROKER}</option>
                                    </Select>
                                )}
                            </Field>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                loading={assigning}
                                disabled={assigning || !assignForm.shipmentId || !assignForm.partnerId}
                                onClick={async () => {
                                    if (!assignForm.shipmentId || !assignForm.partnerId) {
                                        toast.error(i18n.selectShipmentAndPartnerErr)
                                        return
                                    }
                                    setAssigning(true)
                                    const res = await assignShipmentToPartner(assignForm.shipmentId, assignForm.partnerId, assignForm.role)
                                    if (res.success) {
                                        toast.success(i18n.assignSuccess)
                                        setAssignForm({ shipmentId: '', partnerId: '', role: 'FORWARDER' })
                                        loadStats()
                                    } else {
                                        toast.error(res.error ?? 'Error')
                                    }
                                    setAssigning(false)
                                }}
                            >
                                <Link size={12} aria-hidden />
                                {assigning ? i18n.assigning : i18n.assignPartnerBtn}
                            </Button>
                        </div>
                    </div>

                    {assignShipments.length > 0 && (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{i18n.columns.bl}</Th>
                                    <Th>{i18n.columns.vessel}</Th>
                                    <Th>{i18n.columns.eta}</Th>
                                    <Th>{i18n.columns.status}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {assignShipments.map(s => (
                                    <Tr key={s.id}>
                                        <Td className="font-mono text-xs font-bold text-lys-teal-strong">{s.billOfLading}</Td>
                                        <Td className="text-xs text-lys-primary">{s.vesselName ?? '—'}</Td>
                                        <Td className="text-xs text-lys-secondary">{s.eta ? formatDate(s.eta) : '—'}</Td>
                                        <Td><Badge tone="info">{s.status}</Badge></Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    )}
                </div>
            )}

            {/* ═══ PARTNERS TAB ═══ */}
            {tab === 'partners' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-lys-secondary">
                            <Users size={14} className="inline mr-1.5" />
                            {partners.length} {i18n.partnersSuffix}
                        </p>
                        <Button onClick={() => { setShowCreatePartner(true); setPartnerError('') }}>
                            <Plus size={14} aria-hidden /> {i18n.addPartnerBtn}
                        </Button>
                    </div>

                    {showCreatePartner && (
                        <div className="p-5 rounded-lg bg-white border border-lys-border shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-lys-primary">{i18n.addPartnerTitle}</h4>
                                <Button size="sm" variant="ghost" onClick={() => setShowCreatePartner(false)}><X size={16} /></Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label={i18n.codeLabel} required>
                                    {id => (
                                        <Input
                                            id={id}
                                            value={partnerForm.code}
                                            onChange={e => setPartnerForm(f => ({ ...f, code: e.target.value }))}
                                            placeholder="AGN-001"
                                        />
                                    )}
                                </Field>
                                <Field label={i18n.nameLabel} required>
                                    {id => (
                                        <Input
                                            id={id}
                                            value={partnerForm.name}
                                            onChange={e => setPartnerForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder={i18n.namePlaceholder}
                                        />
                                    )}
                                </Field>
                                <Field label={i18n.typeLabel}>
                                    {id => (
                                        <Select
                                            id={id}
                                            value={partnerForm.type}
                                            onChange={e => setPartnerForm(f => ({ ...f, type: e.target.value as any }))}
                                        >
                                            {Object.entries(i18n.partnerType).map(([k, v]) => (
                                                <option key={k} value={k}>{v}</option>
                                            ))}
                                        </Select>
                                    )}
                                </Field>
                                <Field label={i18n.emailLabel} required>
                                    {id => (
                                        <Input
                                            id={id}
                                            type="email"
                                            value={partnerForm.email}
                                            onChange={e => setPartnerForm(f => ({ ...f, email: e.target.value }))}
                                            placeholder="email@partner.com"
                                        />
                                    )}
                                </Field>
                            </div>
                            {partnerError && (
                                <p className="text-xs flex items-center gap-1 text-tone-danger-fg">
                                    <AlertTriangle size={12} /> {partnerError}
                                </p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => setShowCreatePartner(false)}>{i18n.cancel}</Button>
                                <Button onClick={handleCreatePartner} loading={creatingPartner} disabled={creatingPartner}>
                                    {creatingPartner ? i18n.creating : i18n.addPartnerBtn}
                                </Button>
                            </div>
                        </div>
                    )}

                    {partnersLoading ? (
                        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-lys-teal-strong" /></div>
                    ) : partners.length === 0 ? (
                        <div className="p-8 bg-white rounded-lg border border-lys-border">
                            <EmptyState icon={Users} title={i18n.emptyPartners} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {partners.map(p => {
                                const ptLabel = (i18n.partnerType as Record<string, string>)[p.type] ?? p.type
                                const ptTone = PARTNER_TYPE_TONES[p.type] ?? 'neutral'
                                return (
                                    <div key={p.id} className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-sm font-bold text-lys-primary">{p.name}</p>
                                                <p className="font-mono text-xs text-lys-muted">{p.code}</p>
                                            </div>
                                            <Badge tone={ptTone}>{ptLabel}</Badge>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-xs flex items-center gap-1.5 text-lys-secondary">
                                                <Mail size={12} className="shrink-0" /> {p.email}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-lys-muted">
                                                    {p.submissionCount} {i18n.submissionsCountSuffix}
                                                </span>
                                                {p.pendingCount > 0 && (
                                                    <Badge tone="warning">
                                                        {p.pendingCount} {i18n.pendingCountSuffix}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-lys-border">
                                            <StatusBadge
                                                status={p.status}
                                                label={p.status === 'ACTIVE' ? i18n.activeStatus : p.status}
                                                toneOverrides={STATUS_TONES}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
