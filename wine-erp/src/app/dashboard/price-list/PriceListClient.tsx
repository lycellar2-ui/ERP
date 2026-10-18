'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, Tag, Search, Trash2, DollarSign, Package, Settings, Pencil, Check, X } from 'lucide-react'
import { PriceListRow, getPriceLists, getPriceListDetail, createPriceList, upsertPriceListLine, removePriceListLine, getProductsForPriceList, deletePriceList } from './actions'
import { cn } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import { getPriceListI18n } from './i18n'
import type { Tone } from '@/lib/ui/status'
import {
    Badge, Button, PageHeader, StatusTabs, Drawer, Modal, EmptyState, Skeleton,
    Field, Input, Select, SearchInput, Table, THead, TBody, Tr, Th, Td, TableMessageRow, useConfirmDialog,
} from '@/components/ui'
import { toast } from 'sonner'
import { CustomerRulesTab } from './CustomerRulesTab'
import { ChannelMappingTab } from './ChannelMappingTab'

const CHANNEL_TONES: Record<string, Tone> = {
    HORECA: 'warning',
    WHOLESALE_DISTRIBUTOR: 'brand',
    VIP_RETAIL: 'info',
    DIRECT_INDIVIDUAL: 'neutral',
}

interface Props {
    initialLists: PriceListRow[]
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
}

export function PriceListClient({ initialLists, currentUser }: Props) {
    const { locale, formatCurrency, formatDate } = useAppLocale()
    const i18n = getPriceListI18n(locale)

    const [activeTab, setActiveTab] = useState<'general' | 'customer'>('general')
    const [lists, setLists] = useState(initialLists)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getPriceListDetail>>>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [addProductOpen, setAddProductOpen] = useState(false)
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])

    // Filter & inline edit inside Price List detail
    const [lineSearch, setLineSearch] = useState('')
    const [editingLineId, setEditingLineId] = useState<string | null>(null)
    const [editingPrice, setEditingPrice] = useState<string>('')
    const [inlineSaving, setInlineSaving] = useState(false)

    // Create Price List form state
    const [formName, setFormName] = useState('')
    const [formChannel, setFormChannel] = useState('HORECA')
    const [formEffective, setFormEffective] = useState(new Date().toISOString().slice(0, 10))
    const [formExpiry, setFormExpiry] = useState('')
    const [saving, setSaving] = useState(false)

    // Add product form
    const [addProductId, setAddProductId] = useState('')
    const [addPrice, setAddPrice] = useState('')
    const [addSearch, setAddSearch] = useState('')

    const channelOptions = useMemo(() => ([
        { key: 'HORECA', label: i18n.channels.HORECA, tone: CHANNEL_TONES.HORECA },
        { key: 'WHOLESALE_DISTRIBUTOR', label: i18n.channels.WHOLESALE_DISTRIBUTOR, tone: CHANNEL_TONES.WHOLESALE_DISTRIBUTOR },
        { key: 'VIP_RETAIL', label: i18n.channels.VIP_RETAIL, tone: CHANNEL_TONES.VIP_RETAIL },
        { key: 'DIRECT_INDIVIDUAL', label: i18n.channels.DIRECT_INDIVIDUAL, tone: CHANNEL_TONES.DIRECT_INDIVIDUAL },
    ]), [i18n])

    const renderChannelBadge = (channel: string) => {
        const label = (i18n.channels as Record<string, string>)[channel] ?? channel
        const tone = CHANNEL_TONES[channel] ?? 'neutral'
        return <Badge tone={tone}>{label}</Badge>
    }

    const reload = useCallback(async () => {
        const data = await getPriceLists()
        setLists(data)
    }, [])

    const loadDetail = useCallback(async (id: string) => {
        setDetailLoading(true)
        setSelectedId(id)
        setEditingLineId(null)
        const data = await getPriceListDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }, [])

    useEffect(() => {
        if (initialLists.length > 0 && !selectedId) {
            loadDetail(initialLists[0].id)
        }
    }, [initialLists, selectedId, loadDetail])

    const handleCreate = async () => {
        if (!formName.trim()) return
        setSaving(true)
        const res = await createPriceList({
            name: formName,
            channel: formChannel,
            effectiveDate: formEffective,
            expiryDate: formExpiry || undefined,
        })
        if (res.success) {
            setCreateOpen(false)
            setFormName('')
            setFormExpiry('')
            toast.success(i18n.general.toastCreated)
            await reload()
            if (res.id) loadDetail(res.id)
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setSaving(false)
    }

    const handleAddProduct = async () => {
        if (!addProductId || !addPrice || !selectedId) return
        setSaving(true)
        const res = await upsertPriceListLine({
            priceListId: selectedId,
            productId: addProductId,
            unitPrice: Number(addPrice),
        })
        if (res.success) {
            toast.success(i18n.general.toastUpdatedProduct)
            setAddProductId('')
            setAddPrice('')
            setAddSearch('')
            setAddProductOpen(false)
            await loadDetail(selectedId)
            await reload()
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setSaving(false)
    }

    const handleSaveInlinePrice = async (productId: string) => {
        if (!selectedId || !editingPrice || Number(editingPrice) <= 0) return
        setInlineSaving(true)
        const res = await upsertPriceListLine({
            priceListId: selectedId,
            productId,
            unitPrice: Number(editingPrice),
        })
        if (res.success) {
            toast.success(i18n.general.toastSavedInline)
            setEditingLineId(null)
            await loadDetail(selectedId)
        } else {
            toast.error(i18n.general.errorUpdatePrice + res.error)
        }
        setInlineSaving(false)
    }

    const handleRemoveLine = (lineId: string) => {
        if (!selectedId) return
        confirm({
            title: i18n.general.deleteLineTitle,
            message: i18n.general.deleteLineMsg,
            confirmLabel: i18n.general.deleteLineConfirm,
            cancelLabel: i18n.general.cancel,
            danger: true,
            onConfirm: async () => {
                await removePriceListLine(lineId)
                await loadDetail(selectedId)
                await reload()
            }
        })
    }

    const handleDelete = (id: string) => {
        confirm({
            title: i18n.general.deletePriceListTitle,
            message: i18n.general.deletePriceListMsg,
            confirmLabel: i18n.general.deletePriceListConfirm,
            cancelLabel: i18n.general.cancel,
            danger: true,
            onConfirm: async () => {
                await deletePriceList(id)
                const remaining = lists.filter(l => l.id !== id)
                if (selectedId === id) {
                    setSelectedId(null)
                    setDetail(null)
                    if (remaining.length > 0) loadDetail(remaining[0].id)
                }
                await reload()
            }
        })
    }

    const openAddProduct = async () => {
        if (products.length === 0) {
            const data = await getProductsForPriceList()
            setProducts(data)
        }
        setAddProductOpen(true)
    }

    const filteredProducts = addSearch
        ? products.filter(p => p.productName.toLowerCase().includes(addSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(addSearch.toLowerCase()))
        : products

    const filteredDetailLines = useMemo(() => {
        if (!detail?.lines) return []
        const q = lineSearch.trim().toLowerCase()
        if (!q) return detail.lines
        return detail.lines.filter(l =>
            l.skuCode.toLowerCase().includes(q) ||
            l.productName.toLowerCase().includes(q)
        )
    }, [detail?.lines, lineSearch])

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={activeTab === 'general' ? i18n.tabs.descGeneral : i18n.tabs.descCustomer}
                actions={activeTab === 'general' && (
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setMappingOpen(true)}>
                            <Settings size={15} aria-hidden /> {i18n.general.configureChannels}
                        </Button>
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus size={16} aria-hidden /> {i18n.general.createPriceList}
                        </Button>
                    </div>
                )}
            />

            <StatusTabs
                value={activeTab}
                onChange={setActiveTab}
                items={[
                    { value: 'general', label: i18n.tabs.general, count: lists.length },
                    { value: 'customer', label: i18n.tabs.customer },
                ]}
            />

            {activeTab === 'customer' ? (
                <CustomerRulesTab currentUser={currentUser} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left: price lists (4 cols) */}
                    <section className="lg:col-span-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-lys-secondary">
                                {i18n.general.listTitle} ({lists.length})
                            </h3>
                        </div>
                        {lists.length === 0 ? (
                            <EmptyState icon={Tag} title={i18n.general.emptyLists} className="bg-white border border-lys-border rounded-md" />
                        ) : lists.map(pl => {
                            const isSelected = selectedId === pl.id
                            return (
                                <div
                                    key={pl.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => loadDetail(pl.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') loadDetail(pl.id) }}
                                    className={cn(
                                        'p-3.5 rounded-lg border cursor-pointer transition-all',
                                        isSelected
                                            ? 'bg-lys-teal-soft border-lys-teal shadow-xs'
                                            : 'bg-white border-lys-border hover:bg-lys-subtle',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <p className={cn('text-sm font-semibold', isSelected ? 'text-lys-teal-strong' : 'text-lys-primary')}>
                                            {pl.name}
                                        </p>
                                        {renderChannelBadge(pl.channel)}
                                    </div>
                                    <div className="flex items-center justify-between type-caption">
                                        <span>
                                            <strong className="text-lys-primary">{pl.itemCount}</strong> {i18n.general.skuFrom} {formatDate(pl.effectiveDate)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
                                            onClick={e => { e.stopPropagation(); handleDelete(pl.id) }}
                                            aria-label={i18n.general.deletePriceListTitle}
                                            title={i18n.general.deletePriceListTitle}
                                        >
                                            <Trash2 size={13} aria-hidden />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </section>

                    {/* Right: detail (8 cols) */}
                    <section className="lg:col-span-8">
                        {detailLoading ? (
                            <div className="flex flex-col gap-3">
                                <Skeleton className="h-16" />
                                <Skeleton className="h-72" />
                            </div>
                        ) : !selectedId ? (
                            <EmptyState icon={DollarSign} title={i18n.general.selectPrompt} className="bg-white border border-lys-border rounded-lg py-20" />
                        ) : detail ? (
                            <div className="flex flex-col gap-3 bg-white border border-lys-border rounded-lg overflow-hidden shadow-xs">
                                {/* Detail Header & Toolbar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-lys-border bg-slate-50/60">
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="text-base font-bold text-lys-primary">{detail.name}</h3>
                                            {renderChannelBadge(detail.channel)}
                                        </div>
                                        <p className="type-caption mt-1">
                                            {i18n.general.effectiveLabel} {formatDate(detail.effectiveDate)}
                                            {detail.expiryDate ? ` → ${formatDate(detail.expiryDate)}` : ` ${i18n.general.noExpiry}`}
                                            {' · '}{i18n.general.totalProducts} <strong>{detail.lines.length}</strong> {i18n.general.productsUnit}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <SearchInput
                                            value={lineSearch}
                                            onChange={e => setLineSearch(e.target.value)}
                                            placeholder={i18n.general.searchSkuPlaceholder}
                                            aria-label={i18n.general.searchSkuAria}
                                            className="w-full sm:w-56"
                                        />
                                        <Button size="sm" onClick={openAddProduct} className="shrink-0">
                                            <Plus size={14} aria-hidden /> {i18n.general.addSkuBtn}
                                        </Button>
                                    </div>
                                </div>

                                {/* Desktop SKU Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <Table>
                                        <THead>
                                            <tr>
                                                <Th className="w-36">{i18n.general.colSku}</Th>
                                                <Th>{i18n.general.colProductName}</Th>
                                                <Th align="right" className="w-48">{i18n.general.colListPrice}</Th>
                                                <Th align="right" className="w-24">{i18n.general.colActions}</Th>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {filteredDetailLines.length === 0 ? (
                                                <TableMessageRow colSpan={4}>
                                                    <EmptyState
                                                        icon={Package}
                                                        title={lineSearch ? i18n.general.emptySearchTitle : i18n.general.emptyLinesTitle}
                                                        description={lineSearch ? i18n.general.emptySearchDesc : i18n.general.emptyLinesDesc}
                                                    />
                                                </TableMessageRow>
                                            ) : filteredDetailLines.map(line => {
                                                const isEditing = editingLineId === line.id
                                                return (
                                                    <Tr key={line.id} className="group">
                                                        <Td className="type-number font-semibold text-lys-teal-strong">{line.skuCode}</Td>
                                                        <Td className="text-lys-primary font-medium">{line.productName}</Td>
                                                        <Td align="right">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input
                                                                        type="number"
                                                                        value={editingPrice}
                                                                        onChange={e => setEditingPrice(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleSaveInlinePrice(line.productId)
                                                                            if (e.key === 'Escape') setEditingLineId(null)
                                                                        }}
                                                                        autoFocus
                                                                        className="w-28 px-2 py-1 text-right text-xs font-mono font-bold border border-[#0891B2] rounded bg-white text-slate-900 outline-none"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={inlineSaving}
                                                                        onClick={() => handleSaveInlinePrice(line.productId)}
                                                                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                                        title={i18n.general.savePrice}
                                                                    >
                                                                        <Check size={13} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingLineId(null)}
                                                                        className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                                        title={i18n.general.cancelBtn}
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingLineId(line.id)
                                                                        setEditingPrice(String(line.unitPrice))
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 type-number font-bold text-lys-primary hover:text-[#0891B2] transition-colors"
                                                                    title={i18n.general.clickToQuickEdit}
                                                                >
                                                                    <span>{formatCurrency(line.unitPrice)}</span>
                                                                    <Pencil size={12} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0891B2] transition-opacity" />
                                                                </button>
                                                            )}
                                                        </Td>
                                                        <Td align="right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {!isEditing && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-slate-500 hover:text-[#0891B2]"
                                                                        onClick={() => {
                                                                            setEditingLineId(line.id)
                                                                            setEditingPrice(String(line.unitPrice))
                                                                        }}
                                                                        aria-label={i18n.general.editPrice}
                                                                        title={i18n.general.editPrice}
                                                                    >
                                                                        <Pencil size={13} aria-hidden />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
                                                                    onClick={() => handleRemoveLine(line.id)}
                                                                    aria-label={i18n.general.deleteLineTitle}
                                                                    title={i18n.general.removeFromList}
                                                                >
                                                                    <Trash2 size={13} aria-hidden />
                                                                </Button>
                                                            </div>
                                                        </Td>
                                                    </Tr>
                                                )
                                            })}
                                        </TBody>
                                    </Table>
                                </div>

                                {/* Mobile Card View (<768px) */}
                                <div className="block md:hidden divide-y divide-slate-200">
                                    {filteredDetailLines.length === 0 ? (
                                        <div className="p-6">
                                            <EmptyState
                                                icon={Package}
                                                title={lineSearch ? i18n.general.emptySearchTitle : i18n.general.emptyLinesTitle}
                                                description={lineSearch ? i18n.general.emptySearchDesc : i18n.general.emptyLinesDesc}
                                            />
                                        </div>
                                    ) : filteredDetailLines.map(line => {
                                        const isEditing = editingLineId === line.id
                                        return (
                                            <div key={line.id} className="p-3.5 flex flex-col gap-2 bg-white">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <span className="font-mono text-xs font-bold text-lys-teal-strong block">{line.skuCode}</span>
                                                        <p className="text-sm font-medium text-slate-900 leading-snug">{line.productName}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {!isEditing && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-[#0891B2]"
                                                                onClick={() => {
                                                                    setEditingLineId(line.id)
                                                                    setEditingPrice(String(line.unitPrice))
                                                                }}
                                                                aria-label={i18n.general.editPrice}
                                                            >
                                                                <Pencil size={13} aria-hidden />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg"
                                                            onClick={() => handleRemoveLine(line.id)}
                                                            aria-label={i18n.general.deleteLineTitle}
                                                        >
                                                            <Trash2 size={13} aria-hidden />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                                                    <span className="text-xs text-slate-500">{i18n.general.colListPrice}</span>
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                value={editingPrice}
                                                                onChange={e => setEditingPrice(e.target.value)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') handleSaveInlinePrice(line.productId)
                                                                    if (e.key === 'Escape') setEditingLineId(null)
                                                                }}
                                                                autoFocus
                                                                className="w-28 px-2 py-1 text-right text-xs font-mono font-bold border border-[#0891B2] rounded bg-white text-slate-900 outline-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                disabled={inlineSaving}
                                                                onClick={() => handleSaveInlinePrice(line.productId)}
                                                                className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                            >
                                                                <Check size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingLineId(null)}
                                                                className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                            >
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingLineId(line.id)
                                                                setEditingPrice(String(line.unitPrice))
                                                            }}
                                                            className="type-number font-bold text-sm text-slate-900 hover:text-[#0891B2]"
                                                        >
                                                            {formatCurrency(line.unitPrice)}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </section>
                </div>
            )}

            {/* Modal: Default Channel Price List Mapping */}
            <Modal
                open={mappingOpen}
                onClose={() => setMappingOpen(false)}
                title={i18n.mapping.modalTitle}
            >
                <ChannelMappingTab currentUser={currentUser} onSaved={() => setMappingOpen(false)} />
            </Modal>

            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title={i18n.general.createModalTitle}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>{i18n.general.cancelBtn}</Button>
                        <Button onClick={handleCreate} loading={saving} disabled={saving || !formName.trim()}>{i18n.general.createPriceList}</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label={i18n.general.fieldListName} required>
                        {id => <Input id={id} value={formName} onChange={e => setFormName(e.target.value)} placeholder={i18n.general.placeholderListName} />}
                    </Field>
                    <Field label={i18n.general.fieldSalesChannel}>
                        {id => (
                            <Select id={id} value={formChannel} onChange={e => setFormChannel(e.target.value)}>
                                {channelOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                            </Select>
                        )}
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={i18n.general.fieldEffectiveDate}>
                            {id => <Input id={id} type="date" value={formEffective} onChange={e => setFormEffective(e.target.value)} />}
                        </Field>
                        <Field label={i18n.general.fieldExpiryDate}>
                            {id => <Input id={id} type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />}
                        </Field>
                    </div>
                </div>
            </Drawer>

            <Modal
                open={addProductOpen}
                onClose={() => setAddProductOpen(false)}
                title={i18n.general.addProductModalTitle}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAddProductOpen(false)}>{i18n.general.cancelBtn}</Button>
                        <Button onClick={handleAddProduct} loading={saving} disabled={saving || !addProductId || !addPrice}>{i18n.general.savePriceBtn}</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" aria-hidden />
                        <Input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder={i18n.general.searchProductPlaceholder} className="pl-9" aria-label={i18n.general.searchProductPlaceholder} />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-md p-1 bg-white border border-lys-border">
                        {filteredProducts.slice(0, 20).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setAddProductId(p.id)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors',
                                    addProductId === p.id ? 'bg-lys-teal-soft text-lys-teal-strong' : 'text-lys-secondary hover:bg-lys-subtle',
                                )}
                            >
                                <span className="type-number font-semibold">{p.skuCode}</span>
                                <span className="truncate text-lys-primary">{p.productName}</span>
                            </button>
                        ))}
                        {filteredProducts.length === 0 && (
                            <p className="text-center py-4 type-caption">{i18n.general.noProductsFound}</p>
                        )}
                    </div>
                    <Field label={i18n.general.fieldUnitPrice} required>
                        {id => <Input id={id} type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder={i18n.general.placeholderUnitPrice} className="type-number" />}
                    </Field>
                </div>
            </Modal>
            {confirmDialog}
        </div>
    )
}
