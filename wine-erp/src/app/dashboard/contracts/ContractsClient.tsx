'use client'

import React, { useState, useCallback } from 'react'
import { FileSignature, AlertCircle, CheckCircle2, Clock, Plus, Save, Loader2, UploadCloud, FileText } from 'lucide-react'
import { ContractRow, getContracts, createContract, getCounterparties, getContractUtilization, uploadContractDocument, signContract } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getContractsDict, ContractsDict } from './i18n'
import { SignaturePad } from '@/components/SignaturePad'
import { toast } from 'sonner'
import {
    Button,
    Badge,
    Drawer,
    Toolbar,
    SearchInput,
    StatGrid,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    TableMessageRow,
    EmptyState,
} from '@/components/ui'

const STATUS_TONE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
    DRAFT: 'neutral',
    PENDING_SIGN: 'warning',
    ACTIVE: 'success',
    EXPIRED: 'neutral',
    TERMINATED: 'danger',
}

// ── Create Contract Drawer ────────────────────────
type Counterparties = Awaited<ReturnType<typeof getCounterparties>>

function CreateContractDrawer({ open, onClose, onCreated, t }: {
    open: boolean; onClose: () => void; onCreated: () => void; t: ContractsDict
}) {
    const today = new Date().toISOString().slice(0, 10)
    const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const [form, setForm] = useState({
        contractNo: `CNT-${Date.now().toString().slice(-6)}`,
        type: 'PURCHASE',
        counterpartyType: 'supplier' as 'supplier' | 'customer',
        supplierId: '',
        customerId: '',
        value: '',
        currency: 'USD',
        startDate: today,
        endDate: nextYear,
        paymentTerm: '',
        priceTerm: '',
        discountTerms: '',
        marketingBudget: '',
        stampVerification: '',
        archiveStatus: '',
    })
    const [counterparties, setCounterparties] = useState<Counterparties | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && !counterparties) {
        getCounterparties().then(setCounterparties)
    }

    const inputCls = 'w-full px-3 py-2 rounded-md text-xs bg-white border border-lys-border text-lys-title focus:border-lys-primary focus:outline-none transition-colors'

    const handleSave = async () => {
        if (!form.value || Number(form.value) <= 0) return setError(t.createDrawer.errValue)
        if (form.counterpartyType === 'supplier' && !form.supplierId) return setError(t.createDrawer.errSupplier)
        if (form.counterpartyType === 'customer' && !form.customerId) return setError(t.createDrawer.errCustomer)

        setSaving(true)
        setError('')
        const result = await createContract({
            contractNo: form.contractNo,
            type: form.type,
            supplierId: form.counterpartyType === 'supplier' ? form.supplierId : undefined,
            customerId: form.counterpartyType === 'customer' ? form.customerId : undefined,
            value: Number(form.value),
            currency: form.currency,
            startDate: form.startDate,
            endDate: form.endDate,
            paymentTerm: form.paymentTerm || undefined,
            priceTerm: form.priceTerm || undefined,
            discountTerms: form.discountTerms || undefined,
            marketingBudget: form.marketingBudget || undefined,
            stampVerification: form.stampVerification || undefined,
            archiveStatus: form.archiveStatus || undefined,
        })
        setSaving(false)

        if (result.success) {
            toast.success(t.createDrawer.toastSuccess)
            onCreated()
            onClose()
        } else {
            setError(result.error ?? t.createDrawer.errCreate)
        }
    }

    const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-lys-muted block mb-1.5">{label}</label>
            {children}
        </div>
    )

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={t.createDrawer.title}
            description={t.createDrawer.description}
            size="md"
            footer={
                <div className="flex items-center justify-end gap-2 w-full">
                    <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t.createDrawer.cancel}</Button>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} loading={saving}>
                        <Save size={14} />
                        {saving ? t.createDrawer.saving : t.createDrawer.save}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs bg-red-50 border border-red-200 text-red-700">
                        <AlertCircle size={14} className="shrink-0" /> {error}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Row label={t.createDrawer.contractNo}>
                        <input
                            className={inputCls}
                            value={form.contractNo}
                            onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                        />
                    </Row>
                    <Row label={t.createDrawer.contractType}>
                        <select
                            className={inputCls}
                            value={form.type}
                            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                        >
                            {Object.entries(t.type).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Row>
                </div>

                <Row label={t.createDrawer.counterpartyType}>
                    <div className="flex gap-2">
                        {(['supplier', 'customer'] as const).map(ct => (
                            <button
                                key={ct}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, counterpartyType: ct, supplierId: '', customerId: '' }))}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                                    form.counterpartyType === ct
                                        ? 'bg-lys-primary/10 border-lys-primary text-lys-primary'
                                        : 'bg-white border-lys-border text-lys-muted hover:border-lys-primary/40'
                                }`}
                            >
                                {ct === 'supplier' ? t.createDrawer.supplier : t.createDrawer.customer}
                            </button>
                        ))}
                    </div>
                </Row>

                {!counterparties ? (
                    <div className="flex items-center gap-2 text-xs text-lys-muted py-2">
                        <Loader2 size={12} className="animate-spin text-lys-primary" /> {t.createDrawer.loadingCounterparties}
                    </div>
                ) : form.counterpartyType === 'supplier' ? (
                    <Row label={t.createDrawer.supplierRequired}>
                        <select
                            className={inputCls}
                            value={form.supplierId}
                            onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                        >
                            <option value="">{t.createDrawer.selectSupplier}</option>
                            {counterparties.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        </select>
                    </Row>
                ) : (
                    <Row label={t.createDrawer.customerRequired}>
                        <select
                            className={inputCls}
                            value={form.customerId}
                            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                        >
                            <option value="">{t.createDrawer.selectCustomer}</option>
                            {counterparties.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>
                    </Row>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Row label={t.createDrawer.valueRequired}>
                        <input
                            type="number"
                            className={inputCls}
                            value={form.value}
                            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                            placeholder="0"
                        />
                    </Row>
                    <Row label={t.createDrawer.currency}>
                        <select
                            className={inputCls}
                            value={form.currency}
                            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="VND">VND</option>
                        </select>
                    </Row>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Row label={t.createDrawer.startDate}>
                        <input
                            type="date"
                            className={inputCls}
                            value={form.startDate}
                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        />
                    </Row>
                    <Row label={t.createDrawer.endDate}>
                        <input
                            type="date"
                            className={inputCls}
                            value={form.endDate}
                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        />
                    </Row>
                </div>

                <Row label={t.createDrawer.paymentTerm}>
                    <input
                        className={inputCls}
                        value={form.paymentTerm}
                        onChange={e => setForm(f => ({ ...f, paymentTerm: e.target.value }))}
                        placeholder={t.createDrawer.paymentTermPlaceholder}
                    />
                </Row>

                <Row label={t.createDrawer.priceTerm}>
                    <input
                        className={inputCls}
                        value={form.priceTerm}
                        onChange={e => setForm(f => ({ ...f, priceTerm: e.target.value }))}
                        placeholder={t.createDrawer.priceTermPlaceholder}
                    />
                </Row>

                <Row label={t.createDrawer.discountTerms}>
                    <input
                        className={inputCls}
                        value={form.discountTerms}
                        onChange={e => setForm(f => ({ ...f, discountTerms: e.target.value }))}
                        placeholder={t.createDrawer.discountTermsPlaceholder}
                    />
                </Row>

                <Row label={t.createDrawer.marketingBudget}>
                    <input
                        className={inputCls}
                        value={form.marketingBudget}
                        onChange={e => setForm(f => ({ ...f, marketingBudget: e.target.value }))}
                        placeholder={t.createDrawer.marketingBudgetPlaceholder}
                    />
                </Row>

                <Row label={t.createDrawer.stampVerification}>
                    <input
                        className={inputCls}
                        value={form.stampVerification}
                        onChange={e => setForm(f => ({ ...f, stampVerification: e.target.value }))}
                        placeholder={t.createDrawer.stampVerificationPlaceholder}
                    />
                </Row>

                <Row label={t.createDrawer.archiveStatus}>
                    <input
                        className={inputCls}
                        value={form.archiveStatus}
                        onChange={e => setForm(f => ({ ...f, archiveStatus: e.target.value }))}
                        placeholder={t.createDrawer.archiveStatusPlaceholder}
                    />
                </Row>
            </div>
        </Drawer>
    )
}

function ContractMobileCard({
    row,
    isExpanded,
    onToggleExpand,
    t,
    formatCurrency,
    formatDate,
}: {
    row: ContractRow
    isExpanded: boolean
    onToggleExpand: () => void
    t: ContractsDict
    formatCurrency: (v: number) => string
    formatDate: (v: Date | string | null | undefined) => string
}) {
    const label = t.status[row.status] ?? row.status
    const tone = STATUS_TONE[row.status] ?? 'neutral'

    return (
        <div className="rounded-lg border border-lys-border bg-white p-3.5 shadow-2xs space-y-2.5 transition hover:border-lys-primary/40">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    {row.isExpiringSoon && <AlertCircle size={14} className="text-amber-600 shrink-0" />}
                    <span className="font-semibold text-xs text-lys-primary font-mono truncate">{row.contractNo}</span>
                </div>
                <Badge tone={tone}>{label}</Badge>
            </div>

            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block text-[11px] px-2 py-0.5 rounded font-medium bg-lys-primary/10 text-lys-primary whitespace-nowrap shrink-0">
                        {t.type[row.type] ?? row.type}
                    </span>
                    <span className="text-[10px] text-lys-muted font-medium">
                        {row.counterpartyType === 'supplier' ? t.table.supplierFull : t.table.customerFull}
                    </span>
                </div>
                <p className="text-xs font-semibold text-lys-title line-clamp-1">{row.counterpartyName}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-lys-border/70 text-xs">
                <div>
                    <span className="text-[10px] uppercase font-semibold text-lys-muted block">{t.table.contractValueLabel}</span>
                    <span className="font-bold text-lys-title">
                        {row.currency === 'VND' ? formatCurrency(row.value) : `$${row.value.toLocaleString()} ${row.currency}`}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-lys-muted block">{t.table.expiryLabel}</span>
                    <span className={`text-xs ${row.isExpiringSoon ? 'text-amber-700 font-semibold' : 'text-lys-muted'}`}>
                        {formatDate(row.endDate)}
                    </span>
                </div>
            </div>

            <div className="pt-2 border-t border-lys-border/70 flex items-center justify-between">
                <span className="text-[11px] text-lys-muted">
                    {t.table.effectivePrefix} {formatDate(row.startDate)}
                </span>
                <Button
                    variant={isExpanded ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={onToggleExpand}
                >
                    {isExpanded ? t.table.close : t.table.viewDetails}
                </Button>
            </div>
        </div>
    )
}

interface Props {
    initialRows: ContractRow[]
    initialTotal: number
    stats: { total: number; active: number; expiringSoon: number; expired: number }
    onOpenTemplateDrawer?: (code?: string) => void
}

export function ContractsClient({ initialRows, initialTotal: _initialTotal, stats, onOpenTemplateDrawer }: Props) {
    const { locale, formatCurrency, formatDate } = useAppLocale()
    const t = getContractsDict(locale)

    const [rows, setRows] = useState(initialRows)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [utilization, setUtilization] = useState<any>(null)
    const [utilLoading, setUtilLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState(false)

    // Signature
    const [savingSignature, setSavingSignature] = useState(false)
    const [currentSignatureUrl, setCurrentSignatureUrl] = useState('')

    const reload = useCallback(async (s?: string, st?: string) => {
        setLoading(true)
        const { rows: updatedRows } = await getContracts({
            search: (s ?? search) || undefined,
            status: (st ?? statusFilter) || undefined,
            pageSize: 20,
        })
        setRows(updatedRows)
        setLoading(false)
    }, [search, statusFilter])

    const showUtilization = async (id: string, forceReload = false) => {
        if (selectedId === id && !forceReload) { setSelectedId(null); return }
        setSelectedId(id)
        setUtilLoading(true)
        setCurrentSignatureUrl('')
        const data = await getContractUtilization(id)
        setUtilization(data)
        setUtilLoading(false)
    }

    const handleSign = async (contractId: string) => {
        if (!currentSignatureUrl) return
        setSavingSignature(true)
        const res = await signContract(contractId, currentSignatureUrl)
        setSavingSignature(false)
        if (res.success) {
            toast.success(t.utilization.signSuccess)
            if (selectedId === contractId) showUtilization(contractId, true)
            reload()
        } else {
            toast.error(`${t.utilization.signError}: ${res.error || ''}`)
        }
    }

    const handleUpload = async (contractId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadContractDocument(contractId, formData)
        setUploadingDoc(false)
        if (res.success) {
            toast.success(t.utilization.uploadSuccess)
            if (selectedId === contractId) {
                showUtilization(contractId, true)
            }
        } else {
            toast.error(`${t.utilization.uploadError}: ${res.error || ''}`)
        }
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <StatGrid>
                <StatCard
                    label={t.stats.total}
                    value={stats.total}
                    icon={FileSignature}
                    tone="brand"
                />
                <StatCard
                    label={t.stats.active}
                    value={stats.active}
                    icon={CheckCircle2}
                    tone="success"
                />
                <StatCard
                    label={t.stats.expiringSoon}
                    value={stats.expiringSoon}
                    icon={AlertCircle}
                    tone="warning"
                />
                <StatCard
                    label={t.stats.expired}
                    value={stats.expired}
                    icon={Clock}
                    tone="neutral"
                />
            </StatGrid>

            {/* Filters & Actions */}
            <Toolbar
                left={
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-full sm:w-64">
                            <SearchInput
                                placeholder={t.toolbar.searchPlaceholder}
                                value={search}
                                onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); reload(undefined, e.target.value) }}
                            className="px-2.5 py-1.5 text-xs bg-white border border-lys-border rounded-md text-lys-title focus:border-lys-primary focus:outline-none"
                        >
                            <option value="">{t.toolbar.allStatuses}</option>
                            {Object.entries(t.status).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                }
                right={
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onOpenTemplateDrawer?.()}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                        >
                            <FileText size={14} className="text-lys-primary mr-1" />
                            {t.toolbar.createFromTemplate}
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => setDrawerOpen(true)}>
                            <Plus size={15} />
                            {t.toolbar.createContract}
                        </Button>
                    </div>
                }
            />

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <Tr>
                            <Th>{t.table.contractNo}</Th>
                            <Th>{t.table.type}</Th>
                            <Th>{t.table.counterparty}</Th>
                            <Th className="text-right">{t.table.value}</Th>
                            <Th className="text-center">{t.table.utilization}</Th>
                            <Th>{t.table.startDate}</Th>
                            <Th>{t.table.endDate}</Th>
                            <Th className="text-center">{t.table.status}</Th>
                        </Tr>
                    </THead>
                    <TBody>
                        {loading ? (
                            <TableMessageRow colSpan={8}>
                                <div className="py-12 flex items-center justify-center text-xs text-lys-muted gap-2">
                                    <Loader2 size={16} className="animate-spin text-lys-primary" /> {t.table.loading}
                                </div>
                            </TableMessageRow>
                        ) : rows.length === 0 ? (
                            <TableMessageRow colSpan={8}>
                                <EmptyState
                                    title={t.table.emptyTitle}
                                    description={t.table.emptyDesc}
                                    action={
                                        <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
                                            <Plus size={14} />
                                            {t.table.createNew}
                                        </Button>
                                    }
                                />
                            </TableMessageRow>
                        ) : rows.map(row => {
                            const statusLabel = t.status[row.status] ?? row.status
                            const statusTone = STATUS_TONE[row.status] ?? 'neutral'
                            const isExpanded = selectedId === row.id
                            return (
                                <React.Fragment key={row.id}>
                                    <Tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-lys-primary/5' : ''}`}>
                                        <Td className="font-semibold text-lys-primary">
                                            <div className="flex items-center gap-2">
                                                {row.isExpiringSoon && <AlertCircle size={14} className="text-amber-600 shrink-0" />}
                                                <span>{row.contractNo}</span>
                                            </div>
                                        </Td>
                                        <Td>
                                            <span className="inline-block text-[11px] px-2 py-0.5 rounded font-medium bg-lys-primary/10 text-lys-primary whitespace-nowrap shrink-0">
                                                {t.type[row.type] ?? row.type}
                                            </span>
                                        </Td>
                                        <Td>
                                            <p className="text-xs font-semibold text-lys-title">{row.counterpartyName}</p>
                                            <p className="text-[10px] text-lys-muted">
                                                {row.counterpartyType === 'supplier' ? t.table.supplierShort : t.table.customerFull}
                                            </p>
                                        </Td>
                                        <Td align="right" className="font-semibold text-lys-title">
                                            {row.currency === 'VND' ? formatCurrency(row.value) : `$${row.value.toLocaleString()} ${row.currency}`}
                                        </Td>
                                        <Td align="center">
                                            <Button
                                                variant={isExpanded ? 'primary' : 'ghost'}
                                                size="sm"
                                                onClick={() => showUtilization(row.id)}
                                            >
                                                {isExpanded ? t.table.close : t.table.view}
                                            </Button>
                                        </Td>
                                        <Td className="text-lys-muted text-xs">{formatDate(row.startDate)}</Td>
                                        <Td className={`text-xs ${row.isExpiringSoon ? 'text-amber-700 font-semibold' : 'text-lys-muted'}`}>
                                            {formatDate(row.endDate)}
                                            {row.isExpiringSoon && <span className="block text-[10px] text-amber-600 font-medium">{t.table.expiringWarn}</span>}
                                        </Td>
                                        <Td align="center">
                                            <Badge tone={statusTone}>{statusLabel}</Badge>
                                        </Td>
                                    </Tr>

                                    {/* Utilization detail row */}
                                    {isExpanded && (
                                        <Tr className="bg-lys-bg/50">
                                            <Td colSpan={8} className="p-4">
                                                {utilLoading ? (
                                                    <div className="flex items-center justify-center gap-2 text-xs text-lys-muted py-6">
                                                        <Loader2 size={16} className="animate-spin text-lys-primary" /> {t.utilization.loading}
                                                    </div>
                                                ) : utilization ? (
                                                    <div className="space-y-4 bg-white p-4 rounded-lg border border-lys-border">
                                                        <div className="flex items-center justify-between border-b border-lys-border pb-3">
                                                            <h4 className="text-xs font-bold uppercase tracking-wider text-lys-primary">
                                                                {t.utilization.title}
                                                            </h4>
                                                            <div className="flex gap-4 text-xs text-lys-muted font-medium">
                                                                <span>PO: <strong className="text-lys-title">{utilization.poCount}</strong> ({formatCurrency(utilization.poTotal)})</span>
                                                                <span>SO: <strong className="text-lys-title">{utilization.soCount}</strong> ({formatCurrency(utilization.soTotal)})</span>
                                                            </div>
                                                        </div>

                                                        {/* Utilization Stats */}
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            {[
                                                                { l: t.utilization.contractValue, v: formatCurrency(utilization.contractValue) },
                                                                { l: t.utilization.utilizedValue, v: formatCurrency(utilization.utilizedValue) },
                                                                { l: t.utilization.remaining, v: formatCurrency(utilization.remaining) },
                                                                { l: t.utilization.utilizationPct, v: `${utilization.utilizationPct.toFixed(1)}%` },
                                                            ].map(x => (
                                                                <div key={x.l} className="bg-lys-bg/50 p-2.5 rounded-md border border-lys-border">
                                                                    <p className="text-[10px] uppercase font-semibold text-lys-muted">{x.l}</p>
                                                                    <p className="text-sm font-bold text-lys-title mt-0.5">{x.v}</p>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Progress bar */}
                                                        <div>
                                                            <div className="h-2 w-full bg-lys-border rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: `${Math.min(utilization.utilizationPct, 100)}%`,
                                                                        background: utilization.utilizationPct > 90 ? '#B91C1C' : utilization.utilizationPct > 60 ? '#D97706' : '#0891B2',
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Custom Fields Section */}
                                                        <div className="pt-2">
                                                            <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted mb-2.5">
                                                                {t.utilization.termsAndStorageTitle}
                                                            </p>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                                <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                    <p className="text-[10px] uppercase font-bold text-lys-muted">{t.utilization.discountTerms}</p>
                                                                    <p className="mt-1 font-medium text-lys-title">{utilization.discountTerms || t.utilization.notSpecified}</p>
                                                                </div>
                                                                <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                    <p className="text-[10px] uppercase font-bold text-lys-muted">{t.utilization.marketingBudget}</p>
                                                                    <p className="mt-1 font-medium text-lys-title">{utilization.marketingBudget || t.utilization.notSpecified}</p>
                                                                </div>
                                                                <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                    <p className="text-[10px] uppercase font-bold text-lys-muted">{t.utilization.priceTerm}</p>
                                                                    <p className="mt-1 font-medium text-lys-title">{utilization.priceTerm || t.utilization.notSpecified}</p>
                                                                </div>
                                                                <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                    <p className="text-[10px] uppercase font-bold text-lys-muted">{t.utilization.stampVerification}</p>
                                                                    <p className="mt-1 font-medium text-lys-title">{utilization.stampVerification || t.utilization.noVerificationNote}</p>
                                                                </div>
                                                                <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border md:col-span-2">
                                                                    <p className="text-[10px] uppercase font-bold text-lys-muted">{t.utilization.archiveStatus}</p>
                                                                    <p className="mt-1 font-medium text-lys-title">{utilization.archiveStatus || t.utilization.noArchiveNote}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Documents Section */}
                                                        <div className="pt-2 border-t border-lys-border">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted">
                                                                    {t.utilization.attachedDocs} ({utilization.documents?.length || 0})
                                                                </p>
                                                                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer bg-lys-primary/10 text-lys-primary border border-lys-primary/30 hover:bg-lys-primary/15 transition-colors whitespace-nowrap shrink-0">
                                                                    {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                                    <span>{uploadingDoc ? t.utilization.uploading : t.utilization.uploadFile}</span>
                                                                    <input
                                                                        type="file"
                                                                        className="hidden"
                                                                        accept=".pdf,.doc,.docx,.jpg,.png"
                                                                        onChange={(e) => handleUpload(row.id, e)}
                                                                        disabled={uploadingDoc}
                                                                    />
                                                                </label>
                                                            </div>

                                                            {utilization.documents?.length > 0 ? (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                    {utilization.documents.map((doc: any) => (
                                                                        <a
                                                                            key={doc.id}
                                                                            href={doc.fileUrl}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="flex items-center gap-2.5 p-2.5 rounded-md bg-lys-bg/40 hover:bg-lys-primary/5 border border-lys-border transition-colors"
                                                                        >
                                                                            <FileText size={18} className="text-lys-primary shrink-0" />
                                                                            <div className="overflow-hidden min-w-0">
                                                                                <p className="text-xs font-semibold truncate text-lys-title">{doc.name}</p>
                                                                                <p className="text-[10px] text-lys-muted">{formatDate(doc.uploadedAt)}</p>
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs italic text-lys-muted">{t.utilization.noDocs}</p>
                                                            )}
                                                        </div>

                                                        {/* Signature Section */}
                                                        <div className="pt-2 border-t border-lys-border">
                                                            <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted mb-2">
                                                                {t.utilization.eSignatureTitle}
                                                            </p>
                                                            {utilization.signatureUrl ? (
                                                                <div className="p-3 rounded-md bg-emerald-50/50 border border-emerald-200 inline-block">
                                                                    <p className="text-xs text-emerald-700 font-semibold mb-1.5 flex items-center gap-1">
                                                                        <CheckCircle2 size={13} /> {t.utilization.signed}
                                                                    </p>
                                                                    <img src={utilization.signatureUrl} alt="Signature" className="h-16 object-contain bg-white rounded border border-emerald-100 p-1" />
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {row.status === 'DRAFT' ? (
                                                                        <>
                                                                            <SignaturePad onEnd={setCurrentSignatureUrl} />
                                                                            <div className="flex justify-end">
                                                                                <Button
                                                                                    variant="primary"
                                                                                    size="sm"
                                                                                    onClick={() => handleSign(row.id)}
                                                                                    disabled={!currentSignatureUrl || savingSignature}
                                                                                    loading={savingSignature}
                                                                                >
                                                                                    <Save size={13} />
                                                                                    {t.utilization.saveAndActivate}
                                                                                </Button>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <p className="text-xs italic text-lys-muted">{t.utilization.draftOnlySign}</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-lys-muted">{t.utilization.noDetailData}</p>
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

            {/* Mobile Cards List */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="py-12 flex items-center justify-center text-xs text-lys-muted gap-2 rounded-lg border border-lys-border bg-white">
                        <Loader2 size={16} className="animate-spin text-lys-primary" /> {t.table.loading}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6 text-center">
                        <EmptyState
                            title={t.table.emptyTitle}
                            description={t.table.emptyDesc}
                            action={
                                <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
                                    <Plus size={14} />
                                    {t.table.createNew}
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    rows.map(row => {
                        const isExpanded = selectedId === row.id
                        return (
                            <div key={row.id} className="space-y-2">
                                <ContractMobileCard
                                    row={row}
                                    isExpanded={isExpanded}
                                    onToggleExpand={() => showUtilization(row.id)}
                                    t={t}
                                    formatCurrency={formatCurrency}
                                    formatDate={formatDate}
                                />
                                {isExpanded && (
                                    <div className="rounded-lg border border-lys-border bg-white p-4 shadow-2xs space-y-4">
                                        {utilLoading ? (
                                            <div className="flex items-center justify-center gap-2 text-xs text-lys-muted py-6">
                                                <Loader2 size={16} className="animate-spin text-lys-primary" /> {t.utilization.loading}
                                            </div>
                                        ) : utilization ? (
                                            <div className="space-y-4">
                                                <div className="border-b border-lys-border pb-2.5">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-lys-primary">
                                                        {t.utilization.titleShort}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-3 text-xs text-lys-muted font-medium mt-1">
                                                        <span>PO: <strong className="text-lys-title">{utilization.poCount}</strong> ({formatCurrency(utilization.poTotal)})</span>
                                                        <span>SO: <strong className="text-lys-title">{utilization.soCount}</strong> ({formatCurrency(utilization.soTotal)})</span>
                                                    </div>
                                                </div>

                                                {/* Utilization Stats */}
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {[
                                                        { l: t.utilization.contractValue, v: formatCurrency(utilization.contractValue) },
                                                        { l: t.utilization.utilizedValue, v: formatCurrency(utilization.utilizedValue) },
                                                        { l: t.utilization.remaining, v: formatCurrency(utilization.remaining) },
                                                        { l: t.utilization.utilizationPct, v: `${utilization.utilizationPct.toFixed(1)}%` },
                                                    ].map(x => (
                                                        <div key={x.l} className="bg-lys-bg/50 p-2 rounded-md border border-lys-border">
                                                            <p className="text-[10px] uppercase font-semibold text-lys-muted">{x.l}</p>
                                                            <p className="text-xs font-bold text-lys-title mt-0.5">{x.v}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Progress bar */}
                                                <div>
                                                    <div className="h-2 w-full bg-lys-border rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${Math.min(utilization.utilizationPct, 100)}%`,
                                                                background: utilization.utilizationPct > 90 ? '#B91C1C' : utilization.utilizationPct > 60 ? '#D97706' : '#0891B2',
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Documents */}
                                                <div className="pt-2 border-t border-lys-border">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted">
                                                            {t.utilization.docsShort} ({utilization.documents?.length || 0})
                                                        </p>
                                                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer bg-lys-primary/10 text-lys-primary border border-lys-primary/30">
                                                            {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                            <span>{uploadingDoc ? t.utilization.uploading : t.utilization.uploadShort}</span>
                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                accept=".pdf,.doc,.docx,.jpg,.png"
                                                                onChange={(e) => handleUpload(row.id, e)}
                                                                disabled={uploadingDoc}
                                                            />
                                                        </label>
                                                    </div>
                                                    {utilization.documents?.length > 0 && (
                                                        <div className="space-y-1.5">
                                                            {utilization.documents.map((doc: any) => (
                                                                <a
                                                                    key={doc.id}
                                                                    href={doc.fileUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-2 p-2 rounded-md bg-lys-bg/40 border border-lys-border text-xs"
                                                                >
                                                                    <FileText size={14} className="text-lys-primary shrink-0" />
                                                                    <span className="truncate flex-1 font-medium">{doc.name}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Signature Section */}
                                                <div className="pt-2 border-t border-lys-border">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted mb-2">
                                                        {t.utilization.eSignatureMobileTitle}
                                                    </p>
                                                    {utilization.signatureUrl ? (
                                                        <div className="p-3 bg-lys-bg/30 rounded-md border border-lys-border text-center space-y-1.5">
                                                            <img src={utilization.signatureUrl} alt="Signature" className="max-h-20 mx-auto object-contain" />
                                                            <p className="text-[10px] text-lys-muted">{t.utilization.signed}</p>
                                                        </div>
                                                    ) : row.status === 'DRAFT' ? (
                                                        <div className="space-y-2">
                                                            <SignaturePad onEnd={setCurrentSignatureUrl} />
                                                            <div className="flex justify-end">
                                                                <Button
                                                                    variant="primary"
                                                                    size="sm"
                                                                    onClick={() => handleSign(row.id)}
                                                                    disabled={!currentSignatureUrl || savingSignature}
                                                                    loading={savingSignature}
                                                                >
                                                                    <Save size={13} />
                                                                    {t.utilization.saveAndActivate}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs italic text-lys-muted">{t.utilization.draftOnlySign}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            <CreateContractDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={() => { setDrawerOpen(false); reload() }}
                t={t}
            />
        </div>
    )
}
