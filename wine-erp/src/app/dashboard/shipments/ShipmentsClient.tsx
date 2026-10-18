'use client'

import React, { useState, useEffect } from 'react'
import {
    Plus, Ship, Anchor, MapPin, FileCheck, CheckCircle2,
    Loader2, Package, Truck, BarChart3, Eye,
} from 'lucide-react'
import {
    getShipments, createShipment, getLandedCostBreakdown,
    type ShipmentRow,
} from '../procurement/shipment-actions'
import { ShipmentDetailDrawer } from '../procurement/ShipmentDetailDrawer'
import { getPurchaseOrders } from '../procurement/actions'
import { getForwardersAndBrokers } from '../procurement/shipment-actions'
import {
    PageHeader, StatGrid, StatCard, Button, StatusBadge,
    Toolbar, SearchInput, Select, Input, Field, Drawer,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow, EmptyState,
} from '@/components/ui'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { SHIPMENTS_I18N } from './i18n'

const STATUS_TONES = {
    BOOKED: 'info',
    DOCS_READY: 'info',
    LOADED: 'brand',
    ON_VESSEL: 'success',
    ARRIVED_PORT: 'warning',
    CUSTOMS_FILING: 'warning',
    CUSTOMS_INSPECTING: 'warning',
    CUSTOMS_CLEARED: 'success',
    STAMPING: 'brand',
    DELIVERED_TO_WAREHOUSE: 'success',
} as const

function CreateShipmentDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const { locale } = useAppLocale()
    const L = SHIPMENTS_I18N[locale]

    const [pos, setPos] = useState<{ id: string; poNo: string; supplierName: string; incoterms: string | null }[]>([])
    const [fwBk, setFwBk] = useState<{ forwarders: any[]; brokers: any[] }>({ forwarders: [], brokers: [] })
    const [form, setForm] = useState({
        poId: '', billOfLading: '', vesselName: '', voyageNo: '',
        containerNo: '', containerType: '20FT', portOfLoading: '', portOfDischarge: 'VNSGN',
        etd: '', eta: '', cifAmount: 0, cifCurrency: 'USD', incoterms: 'EXW',
        forwarderId: '', customsBrokerId: '',
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!open) return
        Promise.all([
            getPurchaseOrders({ status: 'APPROVED', pageSize: 100 }).then(r =>
                setPos(r.rows.map(p => ({ id: p.id, poNo: p.poNo, supplierName: p.supplierName, incoterms: null })))),
            getForwardersAndBrokers().then(setFwBk),
        ])
    }, [open])

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

    const handleSave = async () => {
        if (!form.poId || !form.billOfLading) { toast.error(L.toast.missingPoBl); return }
        setSaving(true)
        try {
            const res = await createShipment({
                ...form, cifAmount: form.cifAmount,
                forwarderId: form.forwarderId || undefined,
                customsBrokerId: form.customsBrokerId || undefined,
            })
            if (res.success) { toast.success(L.toast.createSuccess); onCreated(); onClose() }
            else toast.error(res.error ?? L.toast.createError)
        } finally { setSaving(false) }
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={L.createDrawer.title}
            size="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>{L.createDrawer.cancelBtn}</Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        <Ship size={14} aria-hidden /> {saving ? L.createDrawer.savingBtn : L.createDrawer.saveBtn}
                    </Button>
                </>
            }
        >
            <div className="space-y-5">
                <section className="space-y-3">
                    <p className="type-caption uppercase tracking-wider font-semibold text-lys-teal-strong">
                        {L.createDrawer.basicSection}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                            <Field label={L.createDrawer.poLabel} required>
                                {id => (
                                    <Select id={id} value={form.poId} onChange={e => set('poId', e.target.value)}>
                                        <option value="">{L.createDrawer.poPlaceholder}</option>
                                        {pos.map(p => <option key={p.id} value={p.id}>{p.poNo} — {p.supplierName}</option>)}
                                    </Select>
                                )}
                            </Field>
                        </div>
                        <Field label={L.createDrawer.blLabel} required>
                            {id => (
                                <Input id={id} value={form.billOfLading} onChange={e => set('billOfLading', e.target.value)} placeholder={L.createDrawer.blPlaceholder} />
                            )}
                        </Field>
                        <Field label={L.createDrawer.incotermsLabel}>
                            {id => (
                                <Select id={id} value={form.incoterms} onChange={e => set('incoterms', e.target.value)}>
                                    <option value="EXW">EXW — Ex Works</option>
                                    <option value="FOB">FOB — Free On Board</option>
                                    <option value="CIF">CIF — Cost Insurance Freight</option>
                                </Select>
                            )}
                        </Field>
                    </div>
                </section>

                <section className="space-y-3">
                    <p className="type-caption uppercase tracking-wider font-semibold text-lys-teal-strong">
                        {L.createDrawer.transportSection}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.createDrawer.vesselLabel}>
                            {id => <Input id={id} value={form.vesselName} onChange={e => set('vesselName', e.target.value)} placeholder="MSC ROMA" />}
                        </Field>
                        <Field label={L.createDrawer.voyageLabel}>
                            {id => <Input id={id} value={form.voyageNo} onChange={e => set('voyageNo', e.target.value)} placeholder="VA523W" />}
                        </Field>
                        <Field label={L.createDrawer.containerNoLabel}>
                            {id => <Input id={id} value={form.containerNo} onChange={e => set('containerNo', e.target.value)} placeholder="MSKU1234567" />}
                        </Field>
                        <Field label={L.createDrawer.containerTypeLabel}>
                            {id => (
                                <Select id={id} value={form.containerType} onChange={e => set('containerType', e.target.value)}>
                                    <option value="20FT">20FT Dry</option>
                                    <option value="40FT">40FT Dry</option>
                                    <option value="40HC">40HC High Cube</option>
                                    <option value="REEFER">Reefer</option>
                                    <option value="LCL">LCL</option>
                                </Select>
                            )}
                        </Field>
                        <Field label={L.createDrawer.portLoadingLabel}>
                            {id => <Input id={id} value={form.portOfLoading} onChange={e => set('portOfLoading', e.target.value)} placeholder="FRMRS (Marseille)" />}
                        </Field>
                        <Field label={L.createDrawer.portDischargeLabel}>
                            {id => <Input id={id} value={form.portOfDischarge} onChange={e => set('portOfDischarge', e.target.value)} />}
                        </Field>
                        <Field label={L.createDrawer.etdLabel}>
                            {id => <Input id={id} type="date" value={form.etd} onChange={e => set('etd', e.target.value)} />}
                        </Field>
                        <Field label={L.createDrawer.etaLabel}>
                            {id => <Input id={id} type="date" value={form.eta} onChange={e => set('eta', e.target.value)} />}
                        </Field>
                    </div>
                </section>

                <section className="space-y-3">
                    <p className="type-caption uppercase tracking-wider font-semibold text-lys-teal-strong">
                        {L.createDrawer.valueSection}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.createDrawer.cifAmountLabel} required>
                            {id => <Input id={id} type="number" value={form.cifAmount || ''} onChange={e => set('cifAmount', Number(e.target.value))} />}
                        </Field>
                        <Field label={L.createDrawer.currencyLabel}>
                            {id => (
                                <Select id={id} value={form.cifCurrency} onChange={e => set('cifCurrency', e.target.value)}>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="NZD">NZD</option>
                                    <option value="AUD">AUD</option>
                                </Select>
                            )}
                        </Field>
                        <Field label={L.createDrawer.forwarderLabel}>
                            {id => (
                                <Select id={id} value={form.forwarderId} onChange={e => set('forwarderId', e.target.value)}>
                                    <option value="">{L.createDrawer.selectPlaceholder}</option>
                                    {fwBk.forwarders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </Select>
                            )}
                        </Field>
                        <Field label={L.createDrawer.brokerLabel}>
                            {id => (
                                <Select id={id} value={form.customsBrokerId} onChange={e => set('customsBrokerId', e.target.value)}>
                                    <option value="">{L.createDrawer.selectPlaceholder}</option>
                                    {fwBk.brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </Select>
                            )}
                        </Field>
                    </div>
                </section>
            </div>
        </Drawer>
    )
}

function LandedCostDrawer({ shipmentId, onClose }: { shipmentId: string; onClose: () => void }) {
    const { locale, formatCurrency, formatNumber } = useAppLocale()
    const L = SHIPMENTS_I18N[locale]

    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getLandedCostBreakdown(shipmentId).then(d => { setData(d); setLoading(false) })
    }, [shipmentId])

    return (
        <Drawer
            open={!!shipmentId}
            onClose={onClose}
            title={L.landedCostModal.title}
            size="lg"
            footer={
                <Button variant="secondary" onClick={onClose}>{L.landedCostModal.closeBtn}</Button>
            }
        >
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-lys-teal-strong" />
                </div>
            ) : !data ? (
                <p className="text-center py-8 text-sm text-lys-muted">{L.landedCostModal.noData}</p>
            ) : (
                <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg text-center bg-lys-subtle border border-lys-border">
                            <p className="text-[11px] uppercase text-lys-muted">{L.landedCostModal.cifVnd}</p>
                            <p className="type-number text-sm font-bold text-lys-teal-strong mt-1">{formatCurrency(data.cifVND)}</p>
                        </div>
                        <div className="p-3 rounded-lg text-center bg-lys-subtle border border-lys-border">
                            <p className="text-[11px] uppercase text-lys-muted">{L.landedCostModal.totalCosts}</p>
                            <p className="type-number text-sm font-bold text-tone-warning-fg mt-1">{formatCurrency(data.totalCosts)}</p>
                        </div>
                        <div className="p-3 rounded-lg text-center bg-lys-subtle border border-lys-border">
                            <p className="text-[11px] uppercase text-lys-muted">{L.landedCostModal.grandTotal}</p>
                            <p className="type-number text-sm font-bold text-lys-primary mt-1">{formatCurrency(data.grandTotal)}</p>
                        </div>
                    </div>

                    <div>
                        <p className="type-caption font-bold uppercase tracking-wide text-tone-warning-fg mb-2">
                            {L.landedCostModal.costByCategory}
                        </p>
                        <div className="space-y-1.5">
                            {data.costsByCategory.map((c: any) => (
                                <div key={c.category} className="flex items-center justify-between px-3 py-2 rounded-md bg-lys-subtle border border-lys-border">
                                    <span className="text-xs text-lys-secondary">{c.label}</span>
                                    <span className="type-number text-xs font-bold text-lys-primary">{formatCurrency(c.totalVND)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="type-caption font-bold uppercase tracking-wide text-tone-warning-fg mb-2">
                            {L.landedCostModal.taxSection}
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            {[
                                { label: L.landedCostModal.importTax, value: data.taxBreakdown.importTax },
                                { label: L.landedCostModal.sctTax, value: data.taxBreakdown.sct },
                                { label: L.landedCostModal.vatTax, value: data.taxBreakdown.vat },
                                { label: L.landedCostModal.totalTax, value: data.taxBreakdown.total },
                            ].map(t => (
                                <div key={t.label} className="p-2.5 rounded-md bg-tone-warning-bg border border-tone-warning-border">
                                    <p className="text-[11px] text-tone-warning-fg">{t.label}</p>
                                    <p className="type-number text-xs font-bold text-lys-primary mt-0.5">{formatCurrency(t.value)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="type-caption font-bold uppercase tracking-wide text-lys-teal-strong mb-2">
                            {L.landedCostModal.perSkuSection}
                        </p>
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{L.landedCostModal.colSku}</Th>
                                    <Th>{L.landedCostModal.colName}</Th>
                                    <Th align="right">{L.landedCostModal.colQty}</Th>
                                    <Th align="right">{L.landedCostModal.colUnitCif}</Th>
                                    <Th align="right">{L.landedCostModal.colLandedCost}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {data.productBreakdown.map((p: any) => (
                                    <Tr key={p.skuCode}>
                                        <Td className="type-number font-semibold text-lys-teal-strong">{p.skuCode}</Td>
                                        <Td className="truncate max-w-[160px] text-lys-primary">{p.productName}</Td>
                                        <Td align="right" className="type-number text-lys-secondary">{formatNumber(p.qty)}</Td>
                                        <Td align="right" className="type-number text-lys-secondary">{formatCurrency(p.unitCIF)}</Td>
                                        <Td align="right" className="type-number font-bold text-tone-warning-fg">{formatCurrency(p.estimatedLandedCost)}</Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </div>

                    <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-lys-teal-soft border border-lys-border">
                        <span className="text-sm font-semibold text-lys-teal-strong">{L.landedCostModal.avgPerBottle}</span>
                        <span className="type-number text-lg font-bold text-lys-primary">{formatCurrency(data.avgLandedCostPerUnit)}</span>
                    </div>
                </div>
            )}
        </Drawer>
    )
}

interface Props {
    initialRows: ShipmentRow[]; initialTotal: number
    stats: { total: number; booked: number; onVessel: number; atPort: number; customsFiling: number; cleared: number; delivered: number }
}

export function ShipmentsClient({ initialRows, initialTotal, stats }: Props) {
    const { locale, formatDate } = useAppLocale()
    const L = SHIPMENTS_I18N[locale]

    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [detailOpen, setDetailOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [landedCostId, setLandedCostId] = useState<string | null>(null)

    const refresh = async (s?: string, st?: string) => {
        setLoading(true)
        try {
            const qSearch = s !== undefined ? s : search
            const qStatus = st !== undefined ? st : statusFilter
            const r = await getShipments({ search: qSearch || undefined, status: qStatus || undefined })
            setRows(r.rows); setTotal(r.total)
        } finally { setLoading(false) }
    }

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

            <StatGrid className="grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                <StatCard label={L.stats.total} value={stats.total} icon={Ship} tone="brand" />
                <StatCard label={L.stats.booked} value={stats.booked} icon={Package} tone="info" />
                <StatCard label={L.stats.onVessel} value={stats.onVessel} icon={Anchor} tone="success" />
                <StatCard label={L.stats.atPort} value={stats.atPort} icon={MapPin} tone="warning" />
                <StatCard label={L.stats.customsFiling} value={stats.customsFiling} icon={FileCheck} tone="warning" />
                <StatCard label={L.stats.cleared} value={stats.cleared} icon={CheckCircle2} tone="success" />
                <StatCard label={L.stats.delivered} value={stats.delivered} icon={Truck} tone="brand" />
            </StatGrid>

            <Toolbar
                right={
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <SearchInput
                            placeholder={L.filters.searchPlaceholder}
                            value={search}
                            onChange={e => { setSearch(e.target.value); refresh(e.target.value, statusFilter) }}
                            className="w-full sm:w-72"
                        />
                        <Select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); refresh(search, e.target.value) }}
                            className="w-full sm:w-48"
                        >
                            <option value="">{L.filters.allStatuses}</option>
                            {Object.entries(L.status).map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </Select>
                    </div>
                }
            />

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th>{L.table.bl}</Th>
                            <Th>{L.table.po}</Th>
                            <Th>{L.table.supplier}</Th>
                            <Th>{L.table.vessel}</Th>
                            <Th>{L.table.container}</Th>
                            <Th>{L.table.ports}</Th>
                            <Th>{L.table.eta}</Th>
                            <Th>{L.table.progress}</Th>
                            <Th>{L.table.status}</Th>
                            <Th aria-label={L.table.actions} />
                        </tr>
                    </THead>
                    <TBody>
                        {rows.length === 0 ? (
                            <TableMessageRow colSpan={10}>
                                <EmptyState icon={Ship} title={L.table.emptyTitle} />
                            </TableMessageRow>
                        ) : rows.map(row => (
                            <Tr key={row.id}>
                                <Td>
                                    <button
                                        onClick={() => { setSelectedId(row.id); setDetailOpen(true) }}
                                        className="type-number text-xs font-semibold text-lys-teal-strong hover:underline cursor-pointer"
                                    >
                                        {row.billOfLading}
                                    </button>
                                </Td>
                                <Td className="type-number text-lys-secondary">{row.poNo}</Td>
                                <Td className="font-medium text-lys-primary">{row.supplierName}</Td>
                                <Td className="text-lys-secondary">{row.vesselName ?? '—'}</Td>
                                <Td className="type-number text-lys-muted">{row.containerNo ?? '—'}</Td>
                                <Td>
                                    <div className="text-[11px] text-lys-muted">{row.portOfLoading ?? '—'}</div>
                                    <div className="text-[11px] font-medium text-lys-secondary">→ {row.portOfDischarge ?? '—'}</div>
                                </Td>
                                <Td className="type-number text-lys-teal-strong">{row.eta ? formatDate(row.eta) : '—'}</Td>
                                <Td>
                                    <div className="flex items-center gap-2">
                                        <div className="w-14 h-1.5 rounded-full bg-lys-border overflow-hidden">
                                            <div className="h-full rounded-full bg-tone-success-fg transition-all" style={{ width: `${row.milestoneProgress}%` }} />
                                        </div>
                                        <span className="type-number text-[11px] font-semibold text-tone-success-fg">{row.milestoneProgress}%</span>
                                    </div>
                                </Td>
                                <Td>
                                    <StatusBadge
                                        status={row.status}
                                        label={(L.status as Record<string, string>)[row.status] ?? row.status}
                                        toneOverrides={STATUS_TONES}
                                    />
                                </Td>
                                <Td align="right">
                                    <div className="inline-flex items-center gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => setLandedCostId(row.id)} title={L.table.costBtn}>
                                            <BarChart3 size={14} className="text-tone-warning-fg" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedId(row.id); setDetailOpen(true) }} title={L.table.detailBtn}>
                                            <Eye size={14} className="text-lys-teal-strong" />
                                        </Button>
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            {/* Mobile Cards List View */}
            <div className="block md:hidden space-y-3">
                {rows.length === 0 ? (
                    <div className="p-6 text-center bg-white rounded-lg border border-lys-border">
                        <EmptyState icon={Ship} title={L.table.emptyTitle} />
                    </div>
                ) : (
                    rows.map(row => (
                        <div
                            key={row.id}
                            onClick={() => { setSelectedId(row.id); setDetailOpen(true) }}
                            className="p-4 rounded-lg border border-lys-border bg-white shadow-xs space-y-2.5 cursor-pointer hover:border-lys-teal-strong transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <span className="type-number font-semibold text-xs text-lys-teal-strong">{row.billOfLading}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-lys-muted">
                                        <span>PO: <strong className="type-number text-lys-secondary">{row.poNo}</strong></span>
                                        <span>•</span>
                                        <span className="font-medium text-lys-primary truncate max-w-[150px]">{row.supplierName}</span>
                                    </div>
                                </div>
                                <StatusBadge
                                    status={row.status}
                                    label={(L.status as Record<string, string>)[row.status] ?? row.status}
                                    toneOverrides={STATUS_TONES}
                                />
                            </div>

                            <div className="p-2.5 rounded-md bg-lys-subtle border border-lys-border grid grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-[10px] text-lys-muted block uppercase font-medium">{L.table.routeLabel}</span>
                                    <p className="font-medium text-lys-primary truncate">
                                        {row.portOfLoading ?? '—'} → {row.portOfDischarge ?? '—'}
                                    </p>
                                    <p className="text-[11px] text-lys-muted mt-0.5">ETA: {row.eta ? formatDate(row.eta) : '—'}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-lys-muted block uppercase font-medium">{L.table.vesselLabel}</span>
                                    <p className="font-medium text-lys-primary truncate">{row.vesselName ?? L.table.unknownVessel}</p>
                                    <p className="type-number text-[11px] text-lys-muted mt-0.5">{row.containerNo ?? L.table.unassignedCont}</p>
                                </div>
                            </div>

                            <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-lys-secondary font-medium">{L.table.progressLabel}</span>
                                    <span className="type-number font-semibold text-tone-success-fg">{row.milestoneProgress}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden bg-lys-border">
                                    <div className="h-full rounded-full bg-tone-success-fg transition-all" style={{ width: `${row.milestoneProgress}%` }} />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-lys-border/60" onClick={e => e.stopPropagation()}>
                                <Button size="sm" variant="secondary" onClick={() => setLandedCostId(row.id)}>
                                    <BarChart3 size={13} aria-hidden /> {L.table.costBtn}
                                </Button>
                                <Button size="sm" variant="primary" onClick={() => { setSelectedId(row.id); setDetailOpen(true) }}>
                                    <Eye size={13} aria-hidden /> {L.table.detailBtn}
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {total > 0 && (
                <p className="type-caption text-right text-lys-muted">
                    {L.table.showingCount(rows.length, total)}
                </p>
            )}

            <CreateShipmentDrawer open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => refresh()} />
            <ShipmentDetailDrawer open={detailOpen} shipmentId={selectedId} onClose={() => { setDetailOpen(false); setSelectedId(null) }} />
            {landedCostId && <LandedCostDrawer shipmentId={landedCostId} onClose={() => setLandedCostId(null)} />}
        </div>
    )
}
