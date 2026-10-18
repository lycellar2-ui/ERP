'use client'

import { useState, useEffect } from 'react'
import { Target, Plus, Save, BarChart3, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import {
    type AllocationCampaignRow, type AllocationQuotaRow,
    getAllocCampaigns, getAllocQuotas, getAllocStats,
    createAllocCampaign, addAllocQuota, getAllocOptions,
} from './actions'
import {
    PageHeader, StatGrid, StatCard, Button, StatusBadge, Badge,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    Drawer, Field, Input, Select, EmptyState,
} from '@/components/ui'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { ALLOCATION_I18N } from './i18n'

const STATUS_TONES = {
    PAUSED: 'warning',
    COMPLETED: 'info',
} as const

export function AllocationClient({ initialCampaigns, stats }: {
    initialCampaigns: AllocationCampaignRow[]
    stats: { total: number; active: number }
}) {
    const { locale, formatDate } = useAppLocale()
    const L = ALLOCATION_I18N[locale]

    const [campaigns, setCampaigns] = useState(initialCampaigns)
    const [selected, setSelected] = useState<AllocationCampaignRow | null>(initialCampaigns[0] ?? null)
    const [quotas, setQuotas] = useState<AllocationQuotaRow[]>([])
    const [createOpen, setCreateOpen] = useState(false)
    const [addQuotaOpen, setAddQuotaOpen] = useState(false)
    const [options, setOptions] = useState<{ products: any[]; users: any[]; customers: any[] }>({ products: [], users: [], customers: [] })
    const [form, setForm] = useState({ name: '', productId: '', totalQty: '', unit: 'CASE', startDate: '', endDate: '' })
    const [quotaForm, setQuotaForm] = useState({ targetType: 'SALES_REP', targetId: '', qtyAllocated: '' })

    const reload = async () => {
        const [c] = await Promise.all([getAllocCampaigns(), getAllocStats()])
        setCampaigns(c)
    }

    const loadOptions = async () => {
        const opts = await getAllocOptions()
        setOptions(opts)
    }

    const handleSelectCampaign = async (c: AllocationCampaignRow) => {
        setSelected(c)
        const q = await getAllocQuotas(c.id)
        setQuotas(q)
    }

    const handleCreateCampaign = async () => {
        if (!form.name || !form.productId || !form.totalQty) return toast.error(L.toast.missingFields)
        const res = await createAllocCampaign({
            name: form.name, productId: form.productId,
            totalQty: Number(form.totalQty), unit: form.unit,
            startDate: form.startDate, endDate: form.endDate,
        })
        if (res.success) {
            toast.success(L.toast.createSuccess)
            setCreateOpen(false)
            setForm({ name: '', productId: '', totalQty: '', unit: 'CASE', startDate: '', endDate: '' })
            reload()
        } else {
            toast.error(res.error || L.toast.createError)
        }
    }

    const handleAddQuota = async () => {
        if (!selected || !quotaForm.targetId || !quotaForm.qtyAllocated) return toast.error(L.toast.missingFields)
        const res = await addAllocQuota({
            campaignId: selected.id, targetType: quotaForm.targetType,
            targetId: quotaForm.targetId, qtyAllocated: Number(quotaForm.qtyAllocated),
        })
        if (res.success) {
            toast.success(L.toast.quotaSuccess)
            setAddQuotaOpen(false)
            setQuotaForm({ targetType: 'SALES_REP', targetId: '', qtyAllocated: '' })
            const q = await getAllocQuotas(selected.id)
            setQuotas(q)
            reload()
        } else {
            toast.error(res.error || L.toast.quotaError)
        }
    }

    useEffect(() => {
        loadOptions()
        if (initialCampaigns[0]) {
            getAllocQuotas(initialCampaigns[0].id).then(setQuotas)
        }
    }, [])

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

            <StatGrid className="grid-cols-1 sm:grid-cols-3">
                <StatCard label={L.stats.total} value={stats.total} icon={Target} tone="brand" />
                <StatCard label={L.stats.active} value={stats.active} icon={BarChart3} tone="success" />
                <StatCard label={L.stats.listed} value={campaigns.length} icon={Target} tone="info" />
            </StatGrid>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left: Campaign list */}
                <div className="lg:col-span-5 space-y-2">
                    <p className="type-caption uppercase tracking-wider font-semibold text-lys-muted">
                        {L.campaigns.sectionTitle}
                    </p>
                    <div className="space-y-2 max-h-[540px] overflow-y-auto pr-0.5">
                        {campaigns.length === 0 ? (
                            <div className="rounded-lg border border-lys-border bg-white p-8 text-center">
                                <EmptyState icon={Target} title={L.campaigns.empty} />
                            </div>
                        ) : campaigns.map(c => {
                            const isSelected = selected?.id === c.id
                            const pct = c.totalQty > 0 ? (c.soldQty / c.totalQty) * 100 : 0
                            const barClass = pct >= 90 ? 'bg-tone-danger-fg' : pct >= 70 ? 'bg-tone-warning-fg' : 'bg-lys-teal-strong'
                            const statusLabel = pct >= 100 ? L.campaigns.exhausted : pct >= 90 ? L.campaigns.nearlyOut : pct >= 70 ? L.campaigns.runningLow : L.campaigns.abundant
                            const statusToneClass = pct >= 90 ? 'text-tone-danger-fg' : pct >= 70 ? 'text-tone-warning-fg' : 'text-tone-success-fg'

                            return (
                                <button
                                    key={c.id}
                                    onClick={() => handleSelectCampaign(c)}
                                    className={`w-full text-left p-4 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-lys-teal-soft border-lys-teal-strong border-l-4'
                                            : 'bg-white border-lys-border hover:border-lys-border-strong'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-lys-primary truncate">{c.name}</p>
                                            <p className="type-number text-xs font-medium text-lys-teal-strong">{c.skuCode}</p>
                                        </div>
                                        <StatusBadge
                                            status={c.status}
                                            label={(L.status as Record<string, string>)[c.status] ?? c.status}
                                            toneOverrides={STATUS_TONES}
                                        />
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden mb-1.5 bg-lys-border">
                                        <div
                                            className={`h-full rounded-full transition-all ${barClass}`}
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-lys-muted">
                                        <span className="type-number">{L.campaigns.soldProgress(c.soldQty, c.totalQty, c.unit)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-semibold ${statusToneClass}`}>{statusLabel}</span>
                                            <span className="type-number font-semibold text-lys-primary">{pct.toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Right: Quota Matrix */}
                <div className="lg:col-span-7 space-y-4">
                    {!selected ? (
                        <div className="rounded-lg border border-dashed border-lys-border bg-white py-20 px-4">
                            <EmptyState icon={Target} title={L.quotaPanel.emptySelect} />
                        </div>
                    ) : (
                        <>
                            <div className="p-4 rounded-lg bg-white border border-lys-border border-l-4 border-l-lys-teal-strong space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="type-section-title text-lys-primary">{selected.name}</h3>
                                        <p className="text-xs text-lys-muted mt-0.5">
                                            <span className="type-number font-semibold text-lys-teal-strong">{selected.skuCode}</span>
                                            {' — '}
                                            {selected.productName} | {formatDate(selected.startDate)} → {formatDate(selected.endDate)}
                                        </p>
                                    </div>
                                    <Button variant="primary" size="sm" onClick={() => setAddQuotaOpen(true)}>
                                        <Plus size={14} aria-hidden /> {L.quotaPanel.addQuotaBtn}
                                    </Button>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center p-2.5 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="type-number text-sm font-bold text-lys-teal-strong">{selected.totalQty}</p>
                                        <p className="text-[11px] text-lys-muted">{L.quotaPanel.totalUnit(selected.unit)}</p>
                                    </div>
                                    <div className="text-center p-2.5 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="type-number text-sm font-bold text-tone-warning-fg">{selected.allocatedQty}</p>
                                        <p className="text-[11px] text-lys-muted">{L.quotaPanel.allocated}</p>
                                    </div>
                                    <div className="text-center p-2.5 rounded-md bg-lys-subtle border border-lys-border">
                                        <p className="type-number text-sm font-bold text-tone-success-fg">{selected.soldQty}</p>
                                        <p className="text-[11px] text-lys-muted">{L.quotaPanel.sold}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Desktop Quota Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <THead>
                                        <tr>
                                            <Th>{L.quotaPanel.table.target}</Th>
                                            <Th>{L.quotaPanel.table.type}</Th>
                                            <Th align="right">{L.quotaPanel.table.allocated}</Th>
                                            <Th align="right">{L.quotaPanel.table.sold}</Th>
                                            <Th align="right">{L.quotaPanel.table.remaining}</Th>
                                            <Th>{L.quotaPanel.table.usagePct}</Th>
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {quotas.length === 0 ? (
                                            <TableMessageRow colSpan={6}>
                                                <EmptyState icon={Target} title={L.quotaPanel.table.empty} />
                                            </TableMessageRow>
                                        ) : quotas.map(q => (
                                            <Tr key={q.id}>
                                                <Td className="font-semibold text-lys-primary">{q.targetName}</Td>
                                                <Td>
                                                    <Badge tone={q.targetType === 'SALES_REP' ? 'info' : 'brand'}>
                                                        {(L.quotaPanel.targetTypes as Record<string, string>)[q.targetType] ?? q.targetType}
                                                    </Badge>
                                                </Td>
                                                <Td align="right" className="type-number font-semibold text-tone-warning-fg">
                                                    {q.qtyAllocated}
                                                </Td>
                                                <Td align="right" className="type-number font-semibold text-tone-success-fg">
                                                    {q.qtySold}
                                                </Td>
                                                <Td align="right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span className={`type-number font-semibold ${
                                                            q.remaining <= 0 ? 'text-tone-danger-fg' : q.pctUsed > 70 ? 'text-tone-warning-fg' : 'text-tone-success-fg'
                                                        }`}>
                                                            {q.remaining}
                                                        </span>
                                                        {q.remaining <= 0 ? (
                                                            <Badge tone="danger"><XCircle size={10} className="mr-1" />{L.quotaPanel.badgeOut}</Badge>
                                                        ) : q.pctUsed > 70 ? (
                                                            <Badge tone="warning"><AlertTriangle size={10} className="mr-1" />{L.quotaPanel.badgeLow}</Badge>
                                                        ) : (
                                                            <Badge tone="success"><CheckCircle2 size={10} className="mr-1" />{L.quotaPanel.badgeAvailable}</Badge>
                                                        )}
                                                    </div>
                                                </Td>
                                                <Td>
                                                    <div className="flex items-center gap-2 min-w-[110px]">
                                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-lys-border">
                                                            <div
                                                                className={`h-full rounded-full ${
                                                                    q.pctUsed > 90 ? 'bg-tone-danger-fg' : q.pctUsed > 70 ? 'bg-tone-warning-fg' : 'bg-lys-teal-strong'
                                                                }`}
                                                                style={{ width: `${Math.min(q.pctUsed, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="type-number text-xs font-semibold text-lys-secondary">
                                                            {q.pctUsed.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </Td>
                                            </Tr>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>

                            {/* Mobile Quota Cards */}
                            <div className="block md:hidden space-y-2.5">
                                {quotas.length === 0 ? (
                                    <div className="rounded-lg border border-lys-border bg-white p-6">
                                        <EmptyState icon={Target} title={L.quotaPanel.table.empty} />
                                    </div>
                                ) : quotas.map(q => (
                                    <div key={q.id} className="rounded-lg border border-lys-border bg-white p-3.5 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-lys-primary">{q.targetName}</span>
                                            <Badge tone={q.targetType === 'SALES_REP' ? 'info' : 'brand'}>
                                                {(L.quotaPanel.targetTypes as Record<string, string>)[q.targetType] ?? q.targetType}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs bg-lys-subtle p-2 rounded-md">
                                            <div>
                                                <span className="text-[10px] text-lys-muted block">{L.quotaPanel.table.allocated}</span>
                                                <span className="type-number font-semibold text-tone-warning-fg">{q.qtyAllocated}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-lys-muted block">{L.quotaPanel.table.sold}</span>
                                                <span className="type-number font-semibold text-tone-success-fg">{q.qtySold}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-lys-muted block">{L.quotaPanel.table.remaining}</span>
                                                <span className="type-number font-semibold text-lys-primary">{q.remaining}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Create Campaign Drawer */}
            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title={L.createDrawer.title}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>{L.createDrawer.cancelBtn}</Button>
                        <Button variant="primary" onClick={handleCreateCampaign}>
                            <Save size={14} aria-hidden /> {L.createDrawer.saveBtn}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label={L.createDrawer.nameLabel} required>
                        {id => (
                            <Input
                                id={id}
                                value={form.name}
                                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={L.createDrawer.namePlaceholder}
                            />
                        )}
                    </Field>
                    <Field label={L.createDrawer.productLabel} required>
                        {id => (
                            <Select id={id} value={form.productId} onChange={e => setForm(prev => ({ ...prev, productId: e.target.value }))}>
                                <option value="">{L.createDrawer.productPlaceholder}</option>
                                {options.products.map(p => (
                                    <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.createDrawer.totalQtyLabel} required>
                            {id => (
                                <Input
                                    id={id}
                                    type="number"
                                    value={form.totalQty}
                                    onChange={e => setForm(prev => ({ ...prev, totalQty: e.target.value }))}
                                />
                            )}
                        </Field>
                        <Field label={L.createDrawer.unitLabel}>
                            {id => (
                                <Select id={id} value={form.unit} onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}>
                                    <option value="CASE">{L.createDrawer.unitCase}</option>
                                    <option value="BOTTLE">{L.createDrawer.unitBottle}</option>
                                </Select>
                            )}
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.createDrawer.startDateLabel}>
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={form.startDate}
                                    onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                                />
                            )}
                        </Field>
                        <Field label={L.createDrawer.endDateLabel}>
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={form.endDate}
                                    onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                                />
                            )}
                        </Field>
                    </div>
                </div>
            </Drawer>

            {/* Add Quota Drawer */}
            <Drawer
                open={addQuotaOpen && !!selected}
                onClose={() => setAddQuotaOpen(false)}
                title={L.quotaDrawer.title}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAddQuotaOpen(false)}>{L.quotaDrawer.cancelBtn}</Button>
                        <Button variant="primary" onClick={handleAddQuota}>
                            <Save size={14} aria-hidden /> {L.quotaDrawer.saveBtn}
                        </Button>
                    </>
                }
            >
                {selected && (
                    <div className="flex flex-col gap-4">
                        <p className="text-xs text-lys-muted">
                            {L.quotaDrawer.campaignPrefix}{' '}
                            <strong className="text-lys-teal-strong">{selected.name}</strong>
                        </p>
                        <Field label={L.quotaDrawer.targetTypeLabel}>
                            {id => (
                                <Select
                                    id={id}
                                    value={quotaForm.targetType}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, targetType: e.target.value, targetId: '' }))}
                                >
                                    <option value="SALES_REP">{L.quotaPanel.targetTypes.SALES_REP}</option>
                                    <option value="CUSTOMER">{L.quotaPanel.targetTypes.CUSTOMER}</option>
                                    <option value="CHANNEL">{L.quotaPanel.targetTypes.CHANNEL}</option>
                                </Select>
                            )}
                        </Field>
                        <Field label={L.quotaDrawer.targetLabel} required>
                            {id => (
                                <Select
                                    id={id}
                                    value={quotaForm.targetId}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, targetId: e.target.value }))}
                                >
                                    <option value="">{L.quotaDrawer.targetPlaceholder}</option>
                                    {quotaForm.targetType === 'SALES_REP' && options.users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                    {quotaForm.targetType === 'CUSTOMER' && options.customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                                    ))}
                                    {quotaForm.targetType === 'CHANNEL' && ['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'DIRECT_INDIVIDUAL'].map(ch => (
                                        <option key={ch} value={ch}>{ch}</option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label={L.quotaDrawer.qtyLabel(selected.unit)} required>
                            {id => (
                                <Input
                                    id={id}
                                    type="number"
                                    value={quotaForm.qtyAllocated}
                                    onChange={e => setQuotaForm(prev => ({ ...prev, qtyAllocated: e.target.value }))}
                                />
                            )}
                        </Field>
                    </div>
                )}
            </Drawer>
        </div>
    )
}
