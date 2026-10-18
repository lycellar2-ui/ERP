'use client'

import React, { useState, useCallback } from 'react'
import {
    Shield, Search, Plus, X, Save, Loader2, UploadCloud, FileText,
    AlertTriangle, CheckCircle2, Clock, Building2, Ship, Package,
    Factory, Users, RefreshCw, Flame, Warehouse,
} from 'lucide-react'
import {
    RegDocRow, getRegulatedDocs, createRegulatedDoc, uploadRegDocFile,
    getRegDocFiles, renewRegulatedDoc, deleteRegulatedDoc, getRegDocLinkOptions,
} from './reg-doc-actions'
import { CATEGORY_TYPE_MAP } from './reg-doc-constants'
import { useAppLocale } from '@/lib/i18n'
import { getContractsDict, ContractsDict } from './i18n'
import { useConfirmDialog, Badge, Button } from '@/components/ui'
import { toast } from 'sonner'

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    DRAFT: { color: '#475569', bg: 'rgba(100,116,139,0.12)' },
    ACTIVE: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' },
    EXPIRING: { color: '#B45309', bg: 'rgba(180,83,9,0.15)' },
    EXPIRED: { color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
    RENEWED: { color: '#1D4ED8', bg: 'rgba(29,78,216,0.12)' },
    REVOKED: { color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    COMPANY_LICENSE: <Building2 size={14} />,
    IMPORT_DOCUMENT: <Ship size={14} />,
    PRODUCT_CERTIFICATION: <Package size={14} />,
    FACILITY_COMPLIANCE: <Flame size={14} />,
    TRADE_AGREEMENT: <FileText size={14} />,
}

const SCOPE_ICONS: Record<string, React.ReactNode> = {
    COMPANY: <Building2 size={12} />,
    SUPPLIER: <Factory size={12} />,
    CUSTOMER: <Users size={12} />,
    PRODUCT: <Package size={12} />,
    SHIPMENT: <Ship size={12} />,
    LOT: <Warehouse size={12} />,
}

function getDaysColor(days: number | null): string {
    if (days === null) return '#15803D'
    if (days <= 0) return '#B91C1C'
    if (days <= 30) return '#B91C1C'
    if (days <= 60) return '#B45309'
    if (days <= 90) return '#B45309'
    return '#15803D'
}

function getDaysLabel(days: number | null, r: ContractsDict['regDocs']): string {
    if (days === null) return r.table.unlimited
    if (days <= 0) return r.table.overdueDays(Math.abs(days))
    return r.table.remainingDays(days)
}

type LinkOptions = Awaited<ReturnType<typeof getRegDocLinkOptions>>

function CreateRegDocDrawer({ open, onClose, onCreated, renewFrom, r }: {
    open: boolean; onClose: () => void; onCreated: () => void
    renewFrom?: RegDocRow | null
    r: ContractsDict['regDocs']
}) {
    const isRenew = !!renewFrom

    const [form, setForm] = useState({
        docNo: isRenew ? `${renewFrom.docNo}-R${renewFrom.version + 1}` : `RD-${Date.now().toString().slice(-6)}`,
        category: isRenew ? renewFrom.category : 'COMPANY_LICENSE',
        type: isRenew ? renewFrom.type : 'DISTRIBUTION_LICENSE',
        name: isRenew ? renewFrom.name : '',
        description: '',
        issueDate: new Date().toISOString().slice(0, 10),
        effectiveDate: '',
        expiryDate: '',
        issuingAuthority: '',
        referenceNo: '',
        scope: isRenew ? renewFrom.scope : 'COMPANY',
        supplierId: '',
        customerId: '',
        productId: '',
        shipmentId: '',
        assignedToId: '',
        keepHistory: true,
    })
    const [linkOptions, setLinkOptions] = useState<LinkOptions | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && !linkOptions) {
        getRegDocLinkOptions().then(setLinkOptions)
    }

    if (!open) return null

    const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none bg-white border border-slate-200 text-slate-900 focus:border-cyan-600'

    const availableTypes = CATEGORY_TYPE_MAP[form.category] ?? []

    const handleSave = async () => {
        if (!form.name) return setError(r.drawer.errEnterName)

        setSaving(true)
        setError('')

        if (isRenew) {
            const result = await renewRegulatedDoc({
                originalDocId: renewFrom.id,
                newDocNo: form.docNo,
                issueDate: form.issueDate,
                expiryDate: form.expiryDate || undefined,
                issuingAuthority: form.issuingAuthority || undefined,
                keepHistory: form.keepHistory,
            })
            setSaving(false)
            if (result.success) { toast.success(r.drawer.renewSuccess); onCreated(); onClose() }
            else { setError(result.error ?? r.drawer.renewError); toast.error(result.error ?? r.drawer.renewError) }
        } else {
            const result = await createRegulatedDoc({
                docNo: form.docNo,
                category: form.category,
                type: form.type,
                name: form.name,
                description: form.description || undefined,
                issueDate: form.issueDate,
                effectiveDate: form.effectiveDate || undefined,
                expiryDate: form.expiryDate || undefined,
                issuingAuthority: form.issuingAuthority || undefined,
                referenceNo: form.referenceNo || undefined,
                scope: form.scope,
                supplierId: form.supplierId || undefined,
                customerId: form.customerId || undefined,
                productId: form.productId || undefined,
                shipmentId: form.shipmentId || undefined,
                assignedToId: form.assignedToId || undefined,
            })
            setSaving(false)
            if (result.success) { toast.success(r.drawer.createSuccess); onCreated(); onClose() }
            else { setError(result.error ?? r.drawer.createError); toast.error(result.error ?? r.drawer.createError) }
        }
    }

    const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5 text-slate-500">{label}</label>
            {children}
        </div>
    )

    return (
        <>
            <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col bg-slate-50 border-l border-slate-200" style={{ width: 'min(560px,95vw)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isRenew ? 'bg-blue-50 text-blue-700' : 'bg-cyan-50 text-cyan-700'}`}>
                            {isRenew ? <RefreshCw size={16} /> : <Shield size={16} />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg">
                                {isRenew ? r.drawer.renewTitle(renewFrom.name) : r.drawer.createTitle}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isRenew ? r.drawer.renewSubtitle(renewFrom.version) : r.drawer.createSubtitle}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Row label={r.drawer.docNoRequired}>
                            <input className={inputCls} value={form.docNo}
                                onChange={e => setForm(f => ({ ...f, docNo: e.target.value }))} />
                        </Row>
                        <Row label={r.drawer.nameRequired}>
                            <input className={inputCls} value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder={r.drawer.namePlaceholder} />
                        </Row>
                    </div>

                    {!isRenew && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Row label={r.drawer.categoryLabel}>
                                    <select className={inputCls} value={form.category}
                                        onChange={e => {
                                            const cat = e.target.value
                                            const types = CATEGORY_TYPE_MAP[cat] ?? []
                                            setForm(f => ({ ...f, category: cat, type: types[0] ?? 'OTHER' }))
                                        }}>
                                        {Object.entries(r.category).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </Row>
                                <Row label={r.drawer.typeLabel}>
                                    <select className={inputCls} value={form.type}
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                        {availableTypes.map(tp => (
                                            <option key={tp} value={tp}>{r.type[tp] ?? tp}</option>
                                        ))}
                                        <option value="OTHER">{r.drawer.otherType}</option>
                                    </select>
                                </Row>
                            </div>

                            <Row label={r.drawer.scopeLabel}>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(r.scope).map(([k, v]) => (
                                        <button key={k} type="button" onClick={() => setForm(f => ({ ...f, scope: k }))}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                                form.scope === k
                                                    ? 'bg-cyan-50 border-cyan-700 text-cyan-800'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                            }`}>
                                            {SCOPE_ICONS[k]} {v}
                                        </button>
                                    ))}
                                </div>
                            </Row>

                            {/* Linked entity based on scope */}
                            {form.scope === 'SUPPLIER' && linkOptions && (
                                <Row label={r.drawer.supplierLabel}>
                                    <select className={inputCls} value={form.supplierId}
                                        onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                                        <option value="">{r.drawer.selectSupplier}</option>
                                        {linkOptions.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'CUSTOMER' && linkOptions && (
                                <Row label={r.drawer.customerLabel}>
                                    <select className={inputCls} value={form.customerId}
                                        onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                                        <option value="">{r.drawer.selectCustomer}</option>
                                        {linkOptions.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'PRODUCT' && linkOptions && (
                                <Row label={r.drawer.productLabel}>
                                    <select className={inputCls} value={form.productId}
                                        onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                                        <option value="">{r.drawer.selectProduct}</option>
                                        {linkOptions.products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'SHIPMENT' && linkOptions && (
                                <Row label={r.drawer.shipmentLabel}>
                                    <select className={inputCls} value={form.shipmentId}
                                        onChange={e => setForm(f => ({ ...f, shipmentId: e.target.value }))}>
                                        <option value="">{r.drawer.selectShipment}</option>
                                        {linkOptions.shipments.map(s => <option key={s.id} value={s.id}>{s.billOfLading} {s.containerNo ? `(${s.containerNo})` : ''}</option>)}
                                    </select>
                                </Row>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Row label={r.drawer.issueDateRequired}>
                            <input type="date" className={inputCls} value={form.issueDate}
                                onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
                        </Row>
                        <Row label={r.drawer.expiryDateLabel}>
                            <input type="date" className={inputCls} value={form.expiryDate}
                                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        </Row>
                    </div>

                    <Row label={r.drawer.issuingAuthorityLabel}>
                        <input className={inputCls} value={form.issuingAuthority}
                            onChange={e => setForm(f => ({ ...f, issuingAuthority: e.target.value }))}
                            placeholder={r.drawer.issuingAuthorityPlaceholder} />
                    </Row>

                    {!isRenew && (
                        <Row label={r.drawer.descriptionLabel}>
                            <textarea className={inputCls} style={{ minHeight: 60 }} value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder={r.drawer.descriptionPlaceholder} />
                        </Row>
                    )}

                    {isRenew && (
                        <Row label={r.drawer.keepHistoryLabel}>
                            <div className="flex gap-3">
                                {[true, false].map(v => (
                                    <button key={String(v)} type="button" onClick={() => setForm(f => ({ ...f, keepHistory: v }))}
                                        className={`flex-1 py-2 text-sm font-semibold rounded-lg border ${
                                            form.keepHistory === v
                                                ? 'bg-cyan-50 border-cyan-700 text-cyan-800'
                                                : 'bg-white border-slate-200 text-slate-500'
                                        }`}>
                                        {v ? r.drawer.keepHistoryYes : r.drawer.keepHistoryNo}
                                    </button>
                                ))}
                            </div>
                        </Row>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-white">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50">
                        {r.drawer.cancel}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${
                            isRenew ? 'bg-blue-700 hover:bg-blue-800' : 'bg-cyan-700 hover:bg-cyan-800'
                        }`}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : isRenew ? <RefreshCw size={14} /> : <Save size={14} />}
                        {saving ? r.drawer.saving : isRenew ? r.drawer.renewBtn : r.drawer.createBtn}
                    </button>
                </div>
            </div>
        </>
    )
}

function RegDocDetailContent({ doc, onUpload, onRenew, onDelete, r, formatDate }: {
    doc: RegDocRow
    onUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
    onRenew: (doc: RegDocRow) => void
    onDelete: (id: string) => void
    r: ContractsDict['regDocs']
    formatDate: (v: Date | string | null | undefined) => string
}) {
    const [files, setFiles] = useState<any[] | null>(null)
    const [loadingFiles, setLoadingFiles] = useState(true)

    React.useEffect(() => {
        getRegDocFiles(doc.id).then(f => { setFiles(f); setLoadingFiles(false) })
    }, [doc.id])

    return (
        <div className="space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p className="text-[10px] uppercase text-slate-500">{r.detail.issuingAuthority}</p>
                    <p className="text-sm text-slate-900">{doc.issuingAuthority || '—'}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase text-slate-500">{r.detail.scope}</p>
                    <p className="text-sm flex items-center gap-1 text-slate-900">
                        {SCOPE_ICONS[doc.scope]} {r.scope[doc.scope] ?? doc.scope}
                    </p>
                </div>
                <div>
                    <p className="text-[10px] uppercase text-slate-500">{r.detail.linked}</p>
                    <p className="text-sm text-cyan-700">{doc.linkedEntity || r.detail.none}</p>
                </div>
                <div>
                    <p className="text-[10px] uppercase text-slate-500">{r.detail.version}</p>
                    <p className="text-sm font-bold text-slate-900">v{doc.version}</p>
                </div>
            </div>

            {/* Files */}
            <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                        {r.detail.attachedFiles(files?.length ?? 0)}
                    </p>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100">
                        <UploadCloud size={12} /> {r.detail.upload}
                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                            onChange={(e) => onUpload(doc.id, e)} />
                    </label>
                </div>
                {loadingFiles ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 size={12} className="animate-spin" /> {r.detail.loadingFiles}
                    </div>
                ) : files && files.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {files.map((f: any) => (
                            <a key={f.id} href={f.fileUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-3 p-2.5 rounded transition-colors bg-white hover:bg-slate-100 border border-slate-200">
                                <FileText size={16} className="text-slate-600 shrink-0" />
                                <div className="overflow-hidden">
                                    <p className="text-xs font-medium truncate text-slate-900">{f.name}</p>
                                    <p className="text-[10px] text-slate-500">{formatDate(f.uploadedAt)}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs italic text-slate-500">{r.detail.noFiles}</p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-200">
                {doc.status !== 'RENEWED' && doc.status !== 'REVOKED' && (
                    <button onClick={() => onRenew(doc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                        <RefreshCw size={12} /> {r.detail.renew}
                    </button>
                )}
                <button onClick={() => onDelete(doc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                    <X size={12} /> {r.detail.delete}
                </button>
            </div>
        </div>
    )
}

interface Props {
    initialRows: RegDocRow[]
    initialTotal: number
    stats: {
        total: number; active: number; expiringSoon: number; expired: number
        categoryBreakdown: Record<string, number>
    }
}

export function RegDocsTab({ initialRows, stats }: Props) {
    const { locale, formatDate } = useAppLocale()
    const t = getContractsDict(locale)
    const r = t.regDocs

    const [rows, setRows] = useState(initialRows)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [renewTarget, setRenewTarget] = useState<RegDocRow | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [, setUploadingDoc] = useState(false)

    const reload = useCallback(async (s?: string, cat?: string, st?: string) => {
        setLoading(true)
        const { rows: updated } = await getRegulatedDocs({
            search: (s ?? search) || undefined,
            category: (cat ?? categoryFilter) || undefined,
            status: (st ?? statusFilter) || undefined,
            pageSize: 20,
        })
        setRows(updated)
        setLoading(false)
    }, [search, categoryFilter, statusFilter])

    const handleUpload = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadRegDocFile(docId, formData)
        setUploadingDoc(false)
        if (res.success) {
            toast.success(r.detail.uploadSuccess)
            setSelectedId(null)
            setTimeout(() => setSelectedId(docId), 100)
        } else {
            toast.error(`${r.detail.uploadError}: ${res.error || ''}`)
        }
    }

    const handleDelete = (id: string) => {
        confirm({
            title: r.detail.deleteConfirmTitle,
            message: r.detail.deleteConfirmMessage,
            confirmLabel: r.detail.deleteConfirmBtn,
            cancelLabel: r.detail.deleteCancelBtn,
            danger: true,
            onConfirm: async () => {
                const res = await deleteRegulatedDoc(id)
                if (res.success) { toast.success(r.detail.deletedToast); reload() }
                else toast.error(res.error ?? r.detail.deleteError)
            }
        })
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: r.stats.total, value: stats.total, icon: Shield, accent: '#0E7490' },
                    { label: r.stats.active, value: stats.active, icon: CheckCircle2, accent: '#15803D' },
                    { label: r.stats.expiringSoon, value: stats.expiringSoon, icon: AlertTriangle, accent: '#B45309' },
                    { label: r.stats.expired, value: stats.expired, icon: Clock, accent: '#B91C1C' },
                    { label: r.stats.fireAndWarehouse, value: stats.categoryBreakdown?.FACILITY_COMPLIANCE ?? 0, icon: Flame, accent: '#B45309' },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-3 bg-white border border-slate-200"
                            style={{ borderLeft: `3px solid ${s.accent}` }}>
                            <Icon size={20} style={{ color: s.accent }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filters + Create */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="text" placeholder={r.filters.searchPlaceholder}
                        value={search}
                        onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                        className="w-full pl-9 pr-3 py-2 text-sm outline-none bg-white border border-slate-200 text-slate-900 rounded-md focus:border-cyan-600" />
                </div>
                <select value={categoryFilter}
                    onChange={e => { setCategoryFilter(e.target.value); reload(undefined, e.target.value) }}
                    className="px-3 py-2 text-sm outline-none bg-white border border-slate-200 rounded-md text-slate-700">
                    <option value="">{r.filters.allCategories}</option>
                    {Object.entries(r.category).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <select value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); reload(undefined, undefined, e.target.value) }}
                    className="px-3 py-2 text-sm outline-none bg-white border border-slate-200 rounded-md text-slate-700">
                    <option value="">{r.filters.allStatuses}</option>
                    {Object.entries(r.status).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <button onClick={() => { setRenewTarget(null); setDrawerOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ml-auto bg-[#0E7490] hover:bg-[#155E75] text-white transition-colors">
                    <Plus size={16} /> {r.filters.addDoc}
                </button>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block rounded-md overflow-x-auto bg-white border border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-slate-200">
                            {[
                                r.table.docNo, r.table.category, r.table.type, r.table.name,
                                r.table.issueDate, r.table.expiryDate, r.table.remaining,
                                r.table.linked, r.table.files, r.table.status,
                            ].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold text-slate-500">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="text-center py-10 text-sm text-slate-500">{r.table.loading}</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-16 text-slate-500">
                                <Shield size={32} className="mx-auto mb-3 text-slate-200" />
                                <p>{r.table.empty}</p>
                            </td></tr>
                        ) : rows.map(row => {
                            const stStyle = STATUS_STYLE[row.status] ?? { color: '#475569', bg: 'transparent' }
                            const stLabel = r.status[row.status] ?? row.status
                            const isExpanded = selectedId === row.id
                            return (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className="cursor-pointer hover:bg-[#0891B2]/4 border-b border-slate-200"
                                        onClick={() => setSelectedId(isExpanded ? null : row.id)}>
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-bold text-cyan-600">{row.docNo}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 bg-cyan-50 text-cyan-700">
                                                {CATEGORY_ICONS[row.category]} {r.category[row.category] ?? row.category}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs text-slate-600">{r.type[row.type] ?? row.type}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="text-sm font-medium truncate max-w-[180px] text-slate-900">{row.name}</p>
                                        </td>
                                        <td className="px-3 py-3 text-xs text-slate-600">{formatDate(row.issueDate)}</td>
                                        <td className="px-3 py-3 text-xs" style={{ color: row.expiryDate ? getDaysColor(row.daysRemaining) : '#64748B' }}>
                                            {row.expiryDate ? formatDate(row.expiryDate) : r.table.unlimited}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-bold" style={{ color: getDaysColor(row.daysRemaining) }}>
                                                {getDaysLabel(row.daysRemaining, r)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.linkedEntity ? (
                                                <span className="flex items-center gap-1 text-xs text-slate-600">
                                                    {SCOPE_ICONS[row.scope]} <span className="truncate max-w-[120px]">{row.linkedEntity}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="inline-block text-xs px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 bg-blue-50 text-blue-700">
                                                {row.fileCount}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="inline-block text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0"
                                                style={{ color: stStyle.color, background: stStyle.bg }}>{stLabel}</span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-slate-50">
                                            <td colSpan={10} className="px-6 py-4">
                                                <RegDocDetailContent
                                                    doc={row}
                                                    onUpload={handleUpload}
                                                    onRenew={(d) => { setRenewTarget(d); setDrawerOpen(true) }}
                                                    onDelete={handleDelete}
                                                    r={r}
                                                    formatDate={formatDate}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View (<768px) */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                        {r.table.loading}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200">
                        <Shield size={28} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-xs">{r.table.empty}</p>
                    </div>
                ) : rows.map(row => {
                    const stStyle = STATUS_STYLE[row.status] ?? { color: '#475569', bg: 'transparent' }
                    const stLabel = r.status[row.status] ?? row.status
                    const isExpanded = selectedId === row.id
                    return (
                        <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-cyan-700 font-mono">{row.docNo}</span>
                                <span className="inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ color: stStyle.color, background: stStyle.bg }}>
                                    {stLabel}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Badge tone="brand">
                                        {r.category[row.category] ?? row.category}
                                    </Badge>
                                    <span className="text-[11px] text-slate-500 truncate">{r.type[row.type] ?? row.type}</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-900">{row.name}</p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                <div>
                                    <span className="text-[10px] uppercase text-slate-400 block">{r.table.expiryDate}</span>
                                    <span className="font-medium text-slate-700">
                                        {row.expiryDate ? formatDate(row.expiryDate) : r.table.unlimited}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] uppercase text-slate-400 block">{r.table.remaining}</span>
                                    <span className="font-bold" style={{ color: getDaysColor(row.daysRemaining) }}>
                                        {getDaysLabel(row.daysRemaining, r)}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">
                                    {r.table.files}: <strong>{row.fileCount}</strong>
                                </span>
                                <Button
                                    variant={isExpanded ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => setSelectedId(isExpanded ? null : row.id)}
                                >
                                    {isExpanded ? t.table.close : t.table.viewDetails}
                                </Button>
                            </div>
                            {isExpanded && (
                                <div className="pt-3 border-t border-slate-200">
                                    <RegDocDetailContent
                                        doc={row}
                                        onUpload={handleUpload}
                                        onRenew={(d) => { setRenewTarget(d); setDrawerOpen(true) }}
                                        onDelete={handleDelete}
                                        r={r}
                                        formatDate={formatDate}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Drawer */}
            <CreateRegDocDrawer
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setRenewTarget(null) }}
                onCreated={() => { setDrawerOpen(false); setRenewTarget(null); reload() }}
                renewFrom={renewTarget}
                r={r}
            />
            {confirmDialog}
        </div>
    )
}
