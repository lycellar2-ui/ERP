'use client'

import { useState, useEffect } from 'react'
import {
    FileText, Plus, Clock, CheckCircle2, Send,
    ChevronRight, UploadCloud, Save, Loader2, Receipt, FolderArchive,
} from 'lucide-react'
import {
    getDeclarations, getDeclarationStats, createDeclaration,
    getDeclarationData, updateDeclarationStatus,
    uploadTaxDocument, signTaxDeclaration,
    getSCTDetailedReport,
    type DeclarationRow, type SCTDetailedReport,
} from './actions'
import { SignaturePad } from '@/components/SignaturePad'
import {
    PageHeader, StatGrid, StatCard, Button, StatusBadge, Badge,
    StatusTabs, Toolbar, Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    Drawer, EmptyState,
} from '@/components/ui'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { DECLARATIONS_I18N } from './i18n'

const TYPE_TONES: Record<string, 'brand' | 'warning' | 'info'> = {
    IMPORT_CUSTOMS: 'brand',
    SCT_MONTHLY: 'warning',
    SCT_QUARTERLY: 'warning',
    VAT_MONTHLY: 'info',
    VAT_QUARTERLY: 'info',
}

export default function DeclarationsPage() {
    const { locale, formatCurrency, formatDate, formatNumber } = useAppLocale()
    const L = DECLARATIONS_I18N[locale]

    const [rows, setRows] = useState<DeclarationRow[]>([])
    const [stats, setStats] = useState({ total: 0, draft: 0, submitted: 0, approved: 0 })
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailRow, setDetailRow] = useState<DeclarationRow | null>(null)
    const [detailData, setDetailData] = useState<any>(null)
    const [filterType, setFilterType] = useState('')

    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [savingSignature, setSavingSignature] = useState(false)
    const [sctReport, setSctReport] = useState<SCTDetailedReport | null>(null)
    const [sctLoading, setSctLoading] = useState(false)
    const [signatureUrl, setSignatureUrl] = useState('')

    const reload = async () => {
        const [d, s] = await Promise.all([
            getDeclarations(filterType ? { type: filterType } : {}),
            getDeclarationStats(),
        ])
        setRows(d.rows)
        setStats(s)
        setLoading(false)
    }

    useEffect(() => { reload() }, [filterType])

    const handleCreate = async (type: string, year: number, month?: number) => {
        const res = await createDeclaration({ type: type as any, periodYear: year, periodMonth: month, createdBy: 'system' })
        if (res.success) {
            toast.success(L.toast.createSuccess)
            setCreateOpen(false)
            reload()
        } else {
            toast.error(res.error || L.toast.createError)
        }
    }

    const handleViewDetail = async (row: DeclarationRow) => {
        setDetailRow(row)
        setSctReport(null)
        const data = await getDeclarationData({ type: row.type, year: row.periodYear, month: row.periodMonth ?? undefined })
        setDetailData(data)
        if (row.type.startsWith('SCT')) {
            setSctLoading(true)
            const report = await getSCTDetailedReport({ year: row.periodYear, month: row.periodMonth ?? undefined })
            setSctReport(report)
            setSctLoading(false)
        }
    }

    const handleStatusChange = async (id: string, status: 'APPROVED' | 'SUBMITTED') => {
        const res = await updateDeclarationStatus(id, status)
        if (res.success) {
            toast.success(L.toast.statusSuccess)
            reload()
            setDetailRow(null)
        } else {
            toast.error(res.error || L.toast.statusError)
        }
    }

    const handleUpload = async (taxId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadTaxDocument(taxId, formData)
        setUploadingDoc(false)
        if (res.success && res.document) {
            reload()
            setDetailRow(prev => prev ? { ...prev, documents: [...(prev.documents || []), res.document as any] } : prev)
        } else {
            toast.error(`${L.toast.uploadError}: ${res.error}`)
        }
    }

    const handleSign = async (taxId: string) => {
        if (!signatureUrl) return
        setSavingSignature(true)
        const res = await signTaxDeclaration(taxId, signatureUrl)
        setSavingSignature(false)
        if (res.success) {
            reload()
            setDetailRow(null)
            setDetailData(null)
        } else {
            toast.error(`${L.toast.signError}: ${res.error}`)
        }
    }

    const now = new Date()
    const formatPeriod = (month?: number | null, year?: number) =>
        month ? `${locale === 'en' ? 'M' : 'T'}${month}/${year}` : `${year}`

    const filterTabs = [
        { value: '', label: L.filterTabs.all },
        { value: 'IMPORT_CUSTOMS', label: L.filterTabs.import },
        { value: 'SCT_MONTHLY', label: L.filterTabs.sct },
        { value: 'VAT_MONTHLY', label: L.filterTabs.vat },
    ]

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description}
                actions={
                    <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus size={14} aria-hidden /> {L.header.createBtn}
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard label={L.stats.total} value={stats.total} icon={FileText} tone="brand" />
                <StatCard label={L.stats.draft} value={stats.draft} icon={Clock} />
                <StatCard label={L.stats.approved} value={stats.approved} icon={CheckCircle2} tone="success" />
                <StatCard label={L.stats.submitted} value={stats.submitted} icon={Send} tone="info" />
            </StatGrid>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { title: L.quickActions.importTitle, desc: L.quickActions.importDesc, Icon: FileText, tone: 'brand' as const, type: 'IMPORT_CUSTOMS' },
                    { title: L.quickActions.vatTitle, desc: L.quickActions.vatDesc, Icon: Receipt, tone: 'warning' as const, type: 'VAT_MONTHLY' },
                    { title: L.quickActions.sctTitle, desc: L.quickActions.sctDesc, Icon: FolderArchive, tone: 'info' as const, type: 'SCT_QUARTERLY' },
                ].map(item => {
                    const ActionIcon = item.Icon
                    return (
                        <div
                            key={item.type}
                            onClick={() => handleCreate(item.type, now.getFullYear(), now.getMonth() + 1)}
                            className="p-4 rounded-lg bg-white border border-lys-border hover:border-lys-teal-strong transition-colors cursor-pointer flex flex-col justify-between gap-3 shadow-xs"
                        >
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <h3 className="type-section-title text-lys-primary">{item.title}</h3>
                                    <ActionIcon size={18} className="text-lys-teal-strong shrink-0" />
                                </div>
                                <p className="text-xs text-lys-muted">{item.desc}</p>
                            </div>
                            <div>
                                <Badge tone={item.tone}>{L.quickActions.quickBtn}</Badge>
                            </div>
                        </div>
                    )
                })}
            </div>

            <Toolbar
                left={
                    <StatusTabs
                        items={filterTabs}
                        value={filterType}
                        onChange={setFilterType}
                    />
                }
            />

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th>{L.table.type}</Th>
                            <Th>{L.table.period}</Th>
                            <Th>{L.table.status}</Th>
                            <Th>{L.table.createdAt}</Th>
                            <Th>{L.table.submittedAt}</Th>
                            <Th aria-label="Action" />
                        </tr>
                    </THead>
                    <TBody>
                        {loading ? (
                            <TableMessageRow colSpan={6}>{L.table.loading}</TableMessageRow>
                        ) : rows.length === 0 ? (
                            <TableMessageRow colSpan={6}>
                                <EmptyState
                                    icon={FileText}
                                    title={L.table.emptyTitle}
                                    description={L.table.emptyDescription}
                                />
                            </TableMessageRow>
                        ) : rows.map(row => {
                            const typeLabel = (L.types as Record<string, string>)[row.type] ?? row.type
                            const statusLabel = (L.status as Record<string, string>)[row.status] ?? row.status
                            return (
                                <Tr key={row.id} onClick={() => handleViewDetail(row)} className="cursor-pointer">
                                    <Td>
                                        <Badge tone={TYPE_TONES[row.type] ?? 'neutral'}>{typeLabel}</Badge>
                                    </Td>
                                    <Td className="type-number font-semibold text-lys-primary">
                                        {formatPeriod(row.periodMonth, row.periodYear)}
                                    </Td>
                                    <Td>
                                        <StatusBadge status={row.status} label={statusLabel} />
                                    </Td>
                                    <Td className="text-lys-secondary">{formatDate(row.createdAt)}</Td>
                                    <Td className="text-lys-muted">
                                        {row.submittedAt ? formatDate(row.submittedAt) : '—'}
                                    </Td>
                                    <Td align="right">
                                        <ChevronRight size={14} className="text-lys-muted inline" />
                                    </Td>
                                </Tr>
                            )
                        })}
                    </TBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6 text-center text-sm text-lys-muted">
                        {L.table.loading}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6">
                        <EmptyState
                            icon={FileText}
                            title={L.table.emptyTitle}
                            description={L.table.emptyDescription}
                        />
                    </div>
                ) : rows.map(row => {
                    const typeLabel = (L.types as Record<string, string>)[row.type] ?? row.type
                    const statusLabel = (L.status as Record<string, string>)[row.status] ?? row.status
                    return (
                        <div
                            key={row.id}
                            onClick={() => handleViewDetail(row)}
                            className="rounded-lg border border-lys-border bg-white p-4 shadow-xs space-y-2.5 cursor-pointer hover:border-lys-teal-strong transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <Badge tone={TYPE_TONES[row.type] ?? 'neutral'}>{typeLabel}</Badge>
                                    <p className="type-number text-sm font-bold text-lys-primary mt-1.5">
                                        {L.table.period}: {formatPeriod(row.periodMonth, row.periodYear)}
                                    </p>
                                </div>
                                <StatusBadge status={row.status} label={statusLabel} />
                            </div>
                            <div className="flex items-center justify-between text-xs text-lys-muted pt-2 border-t border-lys-border/60">
                                <span>{L.table.createdAt}: {formatDate(row.createdAt)}</span>
                                <span>{row.submittedAt ? `${L.table.submittedAt}: ${formatDate(row.submittedAt)}` : '—'}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Detail Drawer */}
            <Drawer
                open={!!detailRow}
                onClose={() => { setDetailRow(null); setDetailData(null) }}
                title={detailRow ? ((L.types as Record<string, string>)[detailRow.type] ?? detailRow.type) : ''}
                size="lg"
                footer={
                    detailRow?.status === 'DRAFT' ? (
                        <Button variant="primary" onClick={() => handleStatusChange(detailRow.id, 'APPROVED')}>
                            <CheckCircle2 size={14} aria-hidden /> {L.detailDrawer.approveBtn}
                        </Button>
                    ) : detailRow?.status === 'APPROVED' ? (
                        <Button variant="primary" onClick={() => handleStatusChange(detailRow.id, 'SUBMITTED')}>
                            <Send size={14} aria-hidden /> {L.detailDrawer.markSubmittedBtn}
                        </Button>
                    ) : undefined
                }
            >
                {detailRow && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between p-3 rounded-md bg-lys-subtle border border-lys-border">
                            <span className="text-xs text-lys-secondary">
                                {L.detailDrawer.periodPrefix}{' '}
                                <strong className="type-number text-lys-primary">
                                    {formatPeriod(detailRow.periodMonth, detailRow.periodYear)}
                                </strong>
                            </span>
                            <StatusBadge
                                status={detailRow.status}
                                label={(L.status as Record<string, string>)[detailRow.status] ?? detailRow.status}
                            />
                        </div>

                        {detailData?.type === 'VAT' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="text-[11px] uppercase text-lys-muted">{L.detailDrawer.vat.invoiceCount}</p>
                                        <p className="type-number text-sm font-bold text-lys-primary">{detailData.invoiceCount}</p>
                                    </div>
                                    <div className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="text-[11px] uppercase text-lys-muted">{L.detailDrawer.vat.totalAmount}</p>
                                        <p className="type-number text-sm font-bold text-tone-warning-fg">
                                            {formatCurrency(detailData.totalAmount)}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="text-[11px] uppercase text-lys-muted">{L.detailDrawer.vat.totalVat}</p>
                                        <p className="type-number text-sm font-bold text-lys-teal-strong">
                                            {formatCurrency(detailData.totalVat)}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    {detailData.invoices?.map((inv: any) => (
                                        <div key={inv.invoiceNo} className="flex justify-between text-xs p-2.5 rounded-md bg-white border border-lys-border">
                                            <span className="type-number font-semibold text-lys-teal-strong">{inv.invoiceNo}</span>
                                            <span className="type-number text-tone-warning-fg">{formatCurrency(inv.amount)}</span>
                                            <span className="type-number font-medium text-tone-success-fg">VAT: {formatCurrency(inv.vatAmount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {detailData?.type === 'SCT' && (
                            <div className="space-y-4">
                                <p className="text-xs font-semibold text-tone-warning-fg">
                                    {L.detailDrawer.sct.lotsCount(detailData.lotCount)}
                                </p>

                                {sctLoading ? (
                                    <div className="flex items-center gap-2 py-6 justify-center text-xs text-lys-muted">
                                        <Loader2 size={14} className="animate-spin" /> {L.detailDrawer.sct.calculating}
                                    </div>
                                ) : sctReport ? (
                                    <div className="space-y-4">
                                        <div className="p-3.5 rounded-lg bg-lys-subtle border border-lys-border space-y-3">
                                            <p className="type-caption uppercase tracking-wider font-bold text-tone-warning-fg">
                                                {L.detailDrawer.sct.reportTitle(formatPeriod(sctReport.period.month, sctReport.period.year))}
                                            </p>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-3 rounded-md bg-white border border-lys-border">
                                                    <p className="text-[11px] uppercase font-bold text-tone-info-fg mb-1">{L.detailDrawer.sct.inputTitle}</p>
                                                    <p className="text-xs text-lys-secondary">{L.detailDrawer.sct.qtyLabel} <b className="type-number">{formatNumber(sctReport.inputSummary.totalQty)}</b></p>
                                                    <p className="text-xs text-lys-secondary">{L.detailDrawer.sct.valLabel} <b className="type-number">{formatCurrency(sctReport.inputSummary.totalValue)}</b></p>
                                                    <p className="type-number text-sm font-bold text-tone-info-fg mt-1">
                                                        {L.detailDrawer.sct.sctLabel} {formatCurrency(sctReport.inputSummary.totalSCT)}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-md bg-white border border-lys-border">
                                                    <p className="text-[11px] uppercase font-bold text-tone-warning-fg mb-1">{L.detailDrawer.sct.outputTitle}</p>
                                                    <p className="text-xs text-lys-secondary">{L.detailDrawer.sct.qtyLabel} <b className="type-number">{formatNumber(sctReport.outputSummary.totalQty)}</b></p>
                                                    <p className="text-xs text-lys-secondary">{L.detailDrawer.sct.revLabel} <b className="type-number">{formatCurrency(sctReport.outputSummary.totalRevenue)}</b></p>
                                                    <p className="type-number text-sm font-bold text-tone-warning-fg mt-1">
                                                        {L.detailDrawer.sct.sctLabel} {formatCurrency(sctReport.outputSummary.totalSCT)}
                                                    </p>
                                                </div>
                                                <div className={`p-3 rounded-md border ${
                                                    sctReport.netSCTPayable > 0
                                                        ? 'bg-tone-danger-bg border-tone-danger-border'
                                                        : 'bg-tone-success-bg border-tone-success-border'
                                                }`}>
                                                    <p className={`text-[11px] uppercase font-bold mb-1 ${
                                                        sctReport.netSCTPayable > 0 ? 'text-tone-danger-fg' : 'text-tone-success-fg'
                                                    }`}>
                                                        {L.detailDrawer.sct.netPayable}
                                                    </p>
                                                    <p className={`type-number text-base font-bold mt-2 ${
                                                        sctReport.netSCTPayable > 0 ? 'text-tone-danger-fg' : 'text-tone-success-fg'
                                                    }`}>
                                                        {formatCurrency(sctReport.netSCTPayable)}
                                                    </p>
                                                    <p className="text-[11px] text-lys-muted mt-1">{L.detailDrawer.sct.netFormula}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="type-caption uppercase tracking-wider font-semibold text-lys-secondary mb-2">
                                                {L.detailDrawer.sct.productBreakdown(sctReport.lines.length)}
                                            </p>
                                            <Table>
                                                <THead>
                                                    <tr>
                                                        <Th>{L.detailDrawer.sct.colSku}</Th>
                                                        <Th>{L.detailDrawer.sct.colProduct}</Th>
                                                        <Th>{L.detailDrawer.sct.colAbv}</Th>
                                                        <Th>{L.detailDrawer.sct.colRate}</Th>
                                                        <Th align="right">{L.detailDrawer.sct.colInQty}</Th>
                                                        <Th align="right">{L.detailDrawer.sct.colInSct}</Th>
                                                        <Th align="right">{L.detailDrawer.sct.colOutQty}</Th>
                                                        <Th align="right">{L.detailDrawer.sct.colOutSct}</Th>
                                                        <Th align="right">{L.detailDrawer.sct.colNetSct}</Th>
                                                    </tr>
                                                </THead>
                                                <TBody>
                                                    {sctReport.lines.length === 0 ? (
                                                        <TableMessageRow colSpan={9}>{L.detailDrawer.sct.emptyLines}</TableMessageRow>
                                                    ) : sctReport.lines.map(line => (
                                                        <Tr key={line.skuCode}>
                                                            <Td className="type-number font-semibold text-lys-teal-strong">{line.skuCode}</Td>
                                                            <Td className="truncate max-w-[130px] text-lys-primary">{line.productName}</Td>
                                                            <Td className="type-number text-lys-secondary">{line.abvPercent}%</Td>
                                                            <Td>
                                                                <Badge tone={line.sctRate === 65 ? 'danger' : 'warning'}>{line.sctRate}%</Badge>
                                                            </Td>
                                                            <Td align="right" className="type-number text-tone-info-fg">{line.inputQty}</Td>
                                                            <Td align="right" className="type-number text-tone-info-fg">{formatNumber(line.inputSCT)}</Td>
                                                            <Td align="right" className="type-number text-tone-warning-fg">{line.outputQty}</Td>
                                                            <Td align="right" className="type-number text-tone-warning-fg">{formatNumber(line.outputSCT)}</Td>
                                                            <Td align="right" className={`type-number font-semibold ${line.netSCT > 0 ? 'text-tone-danger-fg' : 'text-tone-success-fg'}`}>
                                                                {formatNumber(line.netSCT)}
                                                            </Td>
                                                        </Tr>
                                                    ))}
                                                </TBody>
                                            </Table>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {detailData && (
                            <div className="space-y-5 pt-4 border-t border-lys-border">
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <p className="type-caption uppercase tracking-wider font-semibold text-lys-secondary">
                                            {L.detailDrawer.docs.sectionTitle}
                                        </p>
                                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer font-semibold bg-lys-teal-soft text-lys-teal-strong border border-lys-border">
                                            {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                            {L.detailDrawer.docs.uploadBtn}
                                            <input type="file" className="hidden" accept=".pdf,.png,.jpg" onChange={e => handleUpload(detailRow.id, e)} disabled={uploadingDoc} />
                                        </label>
                                    </div>
                                    {detailRow.documents && detailRow.documents.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {detailRow.documents.map((d: any) => (
                                                <a
                                                    key={d.id}
                                                    href={d.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 p-2.5 rounded-md bg-white border border-lys-border text-xs text-lys-primary hover:bg-lys-subtle"
                                                >
                                                    <FileText size={14} className="text-lys-secondary" />
                                                    <span className="truncate flex-1">{d.name}</span>
                                                    <span className="text-[11px] text-lys-muted">{formatDate(d.uploadedAt)}</span>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-lys-muted">{L.detailDrawer.docs.emptyDocs}</p>
                                    )}
                                </div>

                                <div>
                                    <p className="type-caption uppercase tracking-wider font-semibold text-lys-secondary mb-2.5">
                                        {L.detailDrawer.signature.sectionTitle}
                                    </p>
                                    {detailRow.signatureUrl ? (
                                        <div className="p-3 rounded-md bg-tone-success-bg border border-tone-success-border">
                                            <p className="text-xs text-tone-success-fg mb-2 flex items-center gap-1 font-medium">
                                                <CheckCircle2 size={12} /> {L.detailDrawer.signature.signedBadge}
                                            </p>
                                            <img src={detailRow.signatureUrl} alt="Signature" className="h-[80px] object-contain bg-white rounded-md p-1" />
                                        </div>
                                    ) : detailRow.status === 'DRAFT' ? (
                                        <div className="space-y-3">
                                            <SignaturePad onEnd={setSignatureUrl} />
                                            <div className="flex justify-end">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => handleSign(detailRow.id)}
                                                    disabled={!signatureUrl || savingSignature}
                                                    loading={savingSignature}
                                                >
                                                    <Save size={12} aria-hidden /> {L.detailDrawer.signature.saveSignBtn}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs italic text-lys-muted">{L.detailDrawer.signature.notRequired}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {!detailData && (
                            <p className="text-xs text-center py-8 text-lys-muted">{L.detailDrawer.loadingData}</p>
                        )}
                    </div>
                )}
            </Drawer>

            {/* Create Drawer */}
            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title={L.createDrawer.title}
                size="sm"
                footer={
                    <Button variant="secondary" onClick={() => setCreateOpen(false)}>
                        {L.createDrawer.closeBtn}
                    </Button>
                }
            >
                <div className="space-y-2.5">
                    {(['IMPORT_CUSTOMS', 'SCT_MONTHLY', 'SCT_QUARTERLY', 'VAT_MONTHLY', 'VAT_QUARTERLY'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => handleCreate(type, now.getFullYear(), now.getMonth() + 1)}
                            className="w-full p-4 rounded-lg text-left bg-white border border-lys-border hover:border-lys-teal-strong transition-colors cursor-pointer"
                        >
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-semibold text-lys-primary">{L.types[type]}</span>
                                <FileText size={16} className="text-lys-teal-strong" />
                            </div>
                            <p className="text-xs text-lys-muted">
                                {L.createDrawer.periodLabel(now.getMonth() + 1, now.getFullYear())}
                            </p>
                        </button>
                    ))}
                </div>
            </Drawer>
        </div>
    )
}
