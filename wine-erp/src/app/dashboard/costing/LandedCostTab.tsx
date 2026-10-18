'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Ship, Plus, Loader2, ChevronRight, Calculator,
    CheckCircle2, Lock, AlertTriangle, X, ArrowLeft
} from 'lucide-react'
import {
    ShipmentForCampaign, LandedCostCampaignRow,
    getShipmentsForCampaign, getLandedCostCampaigns,
    createLandedCostCampaign, getLandedCostCampaignDetail,
    calculateLandedCostProration, finalizeLandedCostCampaign,
    updateLandedCostCampaign
} from './actions'
import {
    Button, Field, Input, Table, THead, TBody, Tr, Th, Td,
    StatusBadge, Badge, EmptyState
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'
import { useAppLocale } from '@/lib/i18n'
import { COSTING_I18N } from './i18n'

const CAMPAIGN_TONES: Record<string, Tone> = {
    DRAFT: 'warning',
    CONFIRMED: 'info',
    ALLOCATED: 'success',
}

const SHIPMENT_STATUS_TONES: Record<string, Tone> = {
    BOOKED: 'neutral',
    ON_VESSEL: 'info',
    ARRIVED_PORT: 'warning',
    CUSTOMS_CLEARED: 'brand',
    DELIVERED_TO_WAREHOUSE: 'success',
}

const WINE_COLORS: Record<string, string> = {
    RED: '#B91C1C', WHITE: '#B45309', ROSE: '#B45309',
    SPARKLING: '#0E7490', FORTIFIED: '#1D4ED8', DESSERT: '#0891B2',
}

export function LandedCostTab() {
    const { locale, formatCurrency, formatDate, formatNumber } = useAppLocale()
    const i18n = COSTING_I18N[locale]

    const [campaigns, setCampaigns] = useState<LandedCostCampaignRow[]>([])
    const [loading, setLoading] = useState(false)

    const [showCreate, setShowCreate] = useState(false)
    const [shipments, setShipments] = useState<ShipmentForCampaign[]>([])
    const [shipmentsLoading, setShipmentsLoading] = useState(false)
    const [selectedShipment, setSelectedShipment] = useState<ShipmentForCampaign | null>(null)
    const [createForm, setCreateForm] = useState({ importTax: '', sct: '', vat: '', other: '' })
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

    const [detail, setDetail] = useState<any>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [finalizing, setFinalizing] = useState(false)
    const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

    const [editMode, setEditMode] = useState(false)
    const [editForm, setEditForm] = useState({ importTax: '', sct: '', vat: '', other: '' })

    const loadCampaigns = useCallback(async () => {
        setLoading(true)
        const data = await getLandedCostCampaigns()
        setCampaigns(data)
        setLoading(false)
    }, [])

    useEffect(() => { loadCampaigns() }, [loadCampaigns])

    const openCreate = async () => {
        setShowCreate(true)
        setShipmentsLoading(true)
        setSelectedShipment(null)
        setCreateForm({ importTax: '', sct: '', vat: '', other: '' })
        setCreateError('')
        const data = await getShipmentsForCampaign()
        setShipments(data)
        setShipmentsLoading(false)
    }

    const handleCreate = async () => {
        if (!selectedShipment) return
        setCreating(true)
        setCreateError('')
        const result = await createLandedCostCampaign({
            shipmentId: selectedShipment.id,
            totalImportTax: Number(createForm.importTax) || 0,
            totalSct: Number(createForm.sct) || 0,
            totalVat: Number(createForm.vat) || 0,
            totalOtherCost: Number(createForm.other) || 0,
        })
        if (result.success) {
            setShowCreate(false)
            await loadCampaigns()
            if (result.id) openDetail(result.id)
        } else {
            setCreateError(result.error || 'Error')
        }
        setCreating(false)
    }

    const openDetail = async (id: string) => {
        setDetailLoading(true)
        setActionMsg(null)
        setEditMode(false)
        const data = await getLandedCostCampaignDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }

    const closeDetail = () => {
        setDetail(null)
        setActionMsg(null)
        setEditMode(false)
        loadCampaigns()
    }

    const handleCalculate = async () => {
        if (!detail) return
        setCalculating(true)
        setActionMsg(null)
        const result = await calculateLandedCostProration(detail.id)
        if (result.success) {
            setActionMsg({ type: 'ok', text: `OK! ${result.allocations?.length ?? 0} SKU.` })
            await openDetail(detail.id)
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Error' })
        }
        setCalculating(false)
    }

    const handleFinalize = async () => {
        if (!detail) return
        setFinalizing(true)
        setActionMsg(null)
        const result = await finalizeLandedCostCampaign(detail.id)
        if (result.success) {
            setActionMsg({ type: 'ok', text: i18n.campaignLockedMsg })
            await openDetail(detail.id)
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Error' })
        }
        setFinalizing(false)
    }

    const startEdit = () => {
        if (!detail || detail.status === 'ALLOCATED') return
        setEditMode(true)
        setEditForm({
            importTax: String(detail.totalImportTax),
            sct: String(detail.totalSct),
            vat: String(detail.totalVat),
            other: String(detail.totalOtherCost),
        })
    }

    const handleSaveEdit = async () => {
        if (!detail) return
        setCreating(true)
        const result = await updateLandedCostCampaign({
            id: detail.id,
            totalImportTax: Number(editForm.importTax) || 0,
            totalSct: Number(editForm.sct) || 0,
            totalVat: Number(editForm.vat) || 0,
            totalOtherCost: Number(editForm.other) || 0,
        })
        if (result.success) {
            setEditMode(false)
            await openDetail(detail.id)
        } else {
            setActionMsg({ type: 'err', text: result.error || 'Error' })
        }
        setCreating(false)
    }

    if (detailLoading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 size={28} className="animate-spin text-lys-teal-strong" />
            </div>
        )
    }

    if (detail) {
        const stLabel = (i18n.campaignStatus as Record<string, string>)[detail.status] ?? detail.status
        const isLocked = detail.status === 'ALLOCATED'
        const canCalculate = detail.status === 'DRAFT' || detail.status === 'CONFIRMED'
        const canFinalize = detail.status === 'CONFIRMED' && detail.allocations.length > 0

        return (
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button size="sm" variant="ghost" onClick={closeDetail}>
                            <ArrowLeft size={16} />
                        </Button>
                        <div>
                            <h3 className="text-base font-bold text-lys-primary">
                                B/L: {detail.shipmentBol}
                            </h3>
                            <p className="text-xs text-lys-muted">
                                {detail.supplierName} • PO {detail.poNo} • {detail.vesselName || '—'}
                            </p>
                        </div>
                    </div>
                    <StatusBadge status={detail.status} label={stLabel} toneOverrides={CAMPAIGN_TONES} />
                </div>

                {actionMsg && (
                    <div className={`flex items-center gap-2 p-3 rounded-md border ${
                        actionMsg.type === 'ok'
                            ? 'bg-tone-success-bg border-tone-success-border text-tone-success-fg'
                            : 'bg-tone-danger-bg border-tone-danger-border text-tone-danger-fg'
                    }`}>
                        {actionMsg.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                        <span className="text-xs">{actionMsg.text}</span>
                    </div>
                )}

                <div className="p-4 rounded-lg bg-white border border-lys-border shadow-2xs space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-lys-muted">
                            {i18n.containerCosts}
                        </p>
                        {!isLocked && !editMode && (
                            <Button size="sm" variant="secondary" onClick={startEdit}>
                                {i18n.editBtn}
                            </Button>
                        )}
                    </div>

                    {editMode ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { key: 'importTax', label: i18n.importTax },
                                    { key: 'sct', label: i18n.sctTax },
                                    { key: 'vat', label: i18n.vatTax },
                                    { key: 'other', label: i18n.otherCosts },
                                ].map(f => (
                                    <Field key={f.key} label={f.label}>
                                        {id => (
                                            <Input
                                                id={id}
                                                type="number"
                                                value={(editForm as any)[f.key]}
                                                onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                            />
                                        )}
                                    </Field>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => setEditMode(false)}>{i18n.cancelBtn}</Button>
                                <Button onClick={handleSaveEdit} loading={creating} disabled={creating}>
                                    {creating ? i18n.saving : i18n.saveBtn}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                {[
                                    { label: 'CIF', value: detail.cifAmount, tone: 'text-lys-secondary', suffix: ` ${detail.cifCurrency}` },
                                    { label: i18n.importTax, value: detail.totalImportTax, tone: 'text-tone-warning-fg' },
                                    { label: i18n.sctTax, value: detail.totalSct, tone: 'text-tone-danger-fg' },
                                    { label: i18n.vatTax, value: detail.totalVat, tone: 'text-tone-info-fg' },
                                    { label: i18n.otherCosts, value: detail.totalOtherCost, tone: 'text-lys-teal-strong' },
                                ].map(s => (
                                    <div key={s.label} className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="text-xs uppercase mb-0.5 text-lys-muted truncate">{s.label}</p>
                                        <p className={`font-mono text-sm font-bold ${s.tone}`}>
                                            {s.label === 'CIF' ? `${formatNumber(s.value)} ${(s as any).suffix}` : formatCurrency(s.value)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-lys-border">
                                <span className="text-xs font-semibold uppercase text-lys-muted">
                                    {i18n.totalTaxAndLogistics}
                                </span>
                                <span className="font-mono text-lg font-bold text-tone-warning-fg">
                                    {formatCurrency(detail.totalCost)}
                                </span>
                            </div>
                            {detail.exchangeRate > 0 && (
                                <p className="text-xs text-lys-muted">
                                    {i18n.poExchangeRate} 1 {detail.cifCurrency} = {formatCurrency(Number(detail.exchangeRate))}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {!isLocked && (
                    <div className="flex gap-3">
                        <Button
                            onClick={handleCalculate}
                            loading={calculating}
                            disabled={calculating || !canCalculate}
                        >
                            <Calculator size={16} aria-hidden />
                            {calculating ? i18n.calculating : i18n.calculateProrateBtn}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleFinalize}
                            loading={finalizing}
                            disabled={finalizing || !canFinalize}
                        >
                            <Lock size={16} aria-hidden />
                            {finalizing ? i18n.processing : i18n.lockAndUpdateBtn}
                        </Button>
                    </div>
                )}

                {isLocked && (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-tone-success-bg border border-tone-success-border">
                        <Lock size={14} className="text-tone-success-fg" />
                        <span className="text-xs font-medium text-tone-success-fg">
                            {i18n.campaignLockedMsg}
                        </span>
                    </div>
                )}

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-lys-muted">
                        {i18n.skuAllocationHeader} ({detail.allocations.length} {i18n.productsSuffix})
                    </p>
                    {detail.allocations.length === 0 ? (
                        <div className="p-8 bg-white rounded-lg border border-dashed border-lys-border">
                            <EmptyState icon={Calculator} title={i18n.emptyAllocationHint} />
                        </div>
                    ) : (
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{i18n.columns.sku}</Th>
                                    <Th>{i18n.columns.product}</Th>
                                    <Th align="right">{i18n.allocColumns.bottles}</Th>
                                    <Th align="right">{i18n.columns.unitCost}</Th>
                                    <Th align="right">{i18n.allocColumns.totalAlloc}</Th>
                                    <Th>{i18n.allocColumns.weightPct}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {detail.allocations.map((a: any) => {
                                    const totalQty = detail.allocations.reduce((s: number, x: any) => s + x.qty, 0)
                                    const pct = totalQty > 0 ? (a.qty / totalQty) * 100 : 0
                                    const typeColor = WINE_COLORS[a.wineType] ?? '#475569'
                                    return (
                                        <Tr key={a.id}>
                                            <Td>
                                                <span
                                                    className="inline-block text-xs px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                                    style={{ background: `${typeColor}20`, color: typeColor }}
                                                >
                                                    {a.skuCode}
                                                </span>
                                            </Td>
                                            <Td className="text-xs font-medium truncate max-w-[200px] text-lys-primary">{a.productName}</Td>
                                            <Td align="right" className="font-mono text-xs font-bold text-lys-secondary">
                                                {formatNumber(a.qty)}
                                            </Td>
                                            <Td align="right" className="font-mono text-xs font-bold text-tone-warning-fg">
                                                {formatCurrency(a.unitLandedCost)}
                                            </Td>
                                            <Td align="right" className="font-mono text-xs font-bold text-lys-primary">
                                                {formatCurrency(a.totalCost)}
                                            </Td>
                                            <Td>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full bg-lys-subtle">
                                                        <div className="h-full rounded-full bg-lys-teal-strong" style={{ width: `${Math.min(pct, 100)}%` }} />
                                                    </div>
                                                    <span className="font-mono text-xs text-lys-teal-strong">{pct.toFixed(1)}%</span>
                                                </div>
                                            </Td>
                                        </Tr>
                                    )
                                })}
                                <Tr className="bg-lys-teal-soft/40 border-t-2 border-lys-border">
                                    <Td colSpan={2} className="text-xs font-bold uppercase text-lys-teal-strong">
                                        {i18n.allocColumns.totalRow}
                                    </Td>
                                    <Td align="right" className="font-mono text-xs font-bold text-lys-teal-strong">
                                        {formatNumber(detail.allocations.reduce((s: number, a: any) => s + a.qty, 0))}
                                    </Td>
                                    <Td align="right" className="text-xs text-lys-muted">—</Td>
                                    <Td align="right" className="font-mono text-xs font-bold text-lys-teal-strong">
                                        {formatCurrency(detail.allocations.reduce((s: number, a: any) => s + a.totalCost, 0))}
                                    </Td>
                                    <Td className="font-mono text-xs font-bold text-lys-teal-strong">100%</Td>
                                </Tr>
                            </TBody>
                        </Table>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-lys-secondary">
                    <Ship size={14} className="inline mr-1.5" />
                    {campaigns.length} {i18n.campaignsSuffix}
                </p>
                <Button onClick={openCreate}>
                    <Plus size={14} aria-hidden /> {i18n.createCampaignBtn}
                </Button>
            </div>

            {showCreate && (
                <div className="p-5 rounded-lg bg-white border border-lys-border shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-lys-primary">{i18n.createCampaignTitle}</h4>
                        <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}><X size={16} /></Button>
                    </div>

                    {shipmentsLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-lys-teal-strong" />
                        </div>
                    ) : !selectedShipment ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase text-lys-muted">
                                {i18n.step1Title}
                            </p>
                            {shipments.length === 0 ? (
                                <div className="p-8 bg-white rounded-lg border border-dashed border-lys-border">
                                    <EmptyState icon={Ship} title={i18n.noShipmentsAvailable} />
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {shipments.map(s => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSelectedShipment(s)}
                                            className="w-full text-left p-3 rounded-lg flex items-center justify-between transition-all bg-white border border-lys-border hover:border-lys-teal-strong cursor-pointer"
                                        >
                                            <div>
                                                <p className="font-mono text-xs font-bold text-lys-primary">B/L: {s.billOfLading}</p>
                                                <p className="text-xs mt-0.5 text-lys-muted">
                                                    {s.supplierName} • {s.poNo} • {s.vesselName || 'No vessel'}
                                                </p>
                                                <div className="flex gap-3 mt-1">
                                                    <span className="font-mono text-xs text-lys-secondary">
                                                        CIF: {formatNumber(s.cifAmount)} {s.cifCurrency}
                                                    </span>
                                                    <span className="text-xs text-lys-muted">
                                                        {s.lotCount} {i18n.lotsSuffix}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge tone={SHIPMENT_STATUS_TONES[s.status] ?? 'neutral'}>{s.status}</Badge>
                                                <ChevronRight size={14} className="text-lys-muted" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase text-lys-muted">
                                    {i18n.step2Title}
                                </p>
                                <Button size="sm" variant="secondary" onClick={() => setSelectedShipment(null)}>
                                    {i18n.changeShipmentBtn}
                                </Button>
                            </div>

                            <div className="p-3 rounded-md bg-lys-subtle border border-lys-border">
                                <p className="font-mono text-xs font-bold text-lys-primary">
                                    B/L: {selectedShipment.billOfLading}
                                </p>
                                <p className="text-xs text-lys-muted">
                                    {selectedShipment.supplierName} • CIF: {formatNumber(selectedShipment.cifAmount)} {selectedShipment.cifCurrency}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { key: 'importTax', label: `${i18n.importTax} (VND)`, placeholder: '127500000' },
                                    { key: 'sct', label: `${i18n.sctTax} (VND)`, placeholder: '248625000' },
                                    { key: 'vat', label: `${i18n.vatTax} (VND)`, placeholder: '63112500' },
                                    { key: 'other', label: i18n.otherCosts, placeholder: '15000000' },
                                ].map(f => (
                                    <Field key={f.key} label={f.label}>
                                        {id => (
                                            <Input
                                                id={id}
                                                type="number"
                                                value={(createForm as any)[f.key]}
                                                onChange={e => setCreateForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                placeholder={f.placeholder}
                                            />
                                        )}
                                    </Field>
                                ))}
                            </div>

                            <div className="flex justify-between items-center p-3 rounded-md bg-lys-subtle border border-lys-border">
                                <span className="text-xs uppercase font-semibold text-lys-muted">
                                    {i18n.totalCostLabel}
                                </span>
                                <span className="font-mono text-base font-bold text-tone-warning-fg">
                                    {formatCurrency(
                                        (Number(createForm.importTax) || 0)
                                        + (Number(createForm.sct) || 0)
                                        + (Number(createForm.vat) || 0)
                                        + (Number(createForm.other) || 0)
                                    )}
                                </span>
                            </div>

                            {createError && (
                                <p className="text-xs flex items-center gap-1 text-tone-danger-fg">
                                    <AlertTriangle size={12} /> {createError}
                                </p>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => setShowCreate(false)}>{i18n.cancelBtn}</Button>
                                <Button onClick={handleCreate} loading={creating} disabled={creating}>
                                    {creating ? i18n.creating : i18n.createCampaignBtn}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-lys-teal-strong" />
                </div>
            ) : campaigns.length === 0 ? (
                <div className="p-8 bg-white rounded-lg border border-dashed border-lys-border">
                    <EmptyState icon={Ship} title={i18n.emptyCampaignsTitle} description={i18n.emptyCampaignsDesc} />
                </div>
            ) : (
                <Table>
                    <THead>
                        <Tr>
                            <Th>{i18n.campColumns.bl}</Th>
                            <Th>{i18n.campColumns.supplierVessel}</Th>
                            <Th align="right">{i18n.campColumns.cif}</Th>
                            <Th align="right">{i18n.campColumns.totalTaxCost}</Th>
                            <Th>{i18n.campColumns.status}</Th>
                            <Th>{i18n.campColumns.allocation}</Th>
                            <Th>{i18n.campColumns.createdAt}</Th>
                            <Th aria-label="View" />
                        </Tr>
                    </THead>
                    <TBody>
                        {campaigns.map(c => {
                            const stLabel = (i18n.campaignStatus as Record<string, string>)[c.status] ?? c.status
                            return (
                                <Tr key={c.id} onClick={() => openDetail(c.id)}>
                                    <Td className="font-mono text-xs font-bold text-lys-teal-strong">
                                        {c.shipmentBol || '—'}
                                    </Td>
                                    <Td>
                                        <p className="text-xs font-medium text-lys-primary">{c.supplierName || '—'}</p>
                                        <p className="text-xs text-lys-muted">{c.vesselName || '—'}</p>
                                    </Td>
                                    <Td align="right" className="font-mono text-xs font-bold text-lys-secondary">
                                        {c.cifAmount > 0 ? `$${formatNumber(c.cifAmount)}` : '—'}
                                    </Td>
                                    <Td align="right" className="font-mono text-sm font-bold text-tone-warning-fg">
                                        {formatCurrency(c.totalCost)}
                                    </Td>
                                    <Td>
                                        <StatusBadge status={c.status} label={stLabel} toneOverrides={CAMPAIGN_TONES} />
                                    </Td>
                                    <Td className="text-xs text-lys-secondary">
                                        {c.allocationCount > 0 ? `${c.allocationCount} SKU` : '—'}
                                    </Td>
                                    <Td className="text-xs text-lys-muted">
                                        {formatDate(c.createdAt)}
                                    </Td>
                                    <Td>
                                        <ChevronRight size={14} className="text-lys-muted" />
                                    </Td>
                                </Tr>
                            )
                        })}
                    </TBody>
                </Table>
            )}
        </div>
    )
}
