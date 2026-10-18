'use client'

import React, { useState } from 'react'
import {
    TrendingUp, TrendingDown, Plus, AlertTriangle, DollarSign,
    Tag, Globe, CheckCircle2, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    PageHeader, StatGrid, StatCard, Button, SearchInput, Toolbar,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    Drawer, Field, Input, Select, EmptyState, Badge,
} from '@/components/ui'
import { type MarketPriceRow, getMarketPrices, addMarketPrice, getProductOptions } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { MARKET_PRICE_I18N } from './i18n'

export function MarketPriceClient({ initialRows, stats }: {
    initialRows: MarketPriceRow[]
    stats: { totalEntries: number; trackedProducts: number; sourceBreakdown: { source: string; count: number }[] }
}) {
    const { locale, formatCurrency, formatDate } = useAppLocale()
    const L = MARKET_PRICE_I18N[locale]

    const [rows, setRows] = useState(initialRows)
    const [search, setSearch] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [products, setProducts] = useState<any[]>([])
    const [form, setForm] = useState({
        productId: '',
        price: '',
        source: 'Manual',
        priceDate: new Date().toISOString().slice(0, 10),
        currency: 'VND',
    })

    const reload = async () => {
        const data = await getMarketPrices()
        setRows(data)
    }

    const openDrawer = async () => {
        const prods = await getProductOptions()
        setProducts(prods)
        setDrawerOpen(true)
    }

    const handleAdd = async () => {
        if (!form.productId || !form.price) return toast.error(L.toast.missingFields)
        const res = await addMarketPrice({
            productId: form.productId,
            price: Number(form.price),
            currency: form.currency,
            source: form.source,
            priceDate: form.priceDate,
            enteredBy: 'system',
        })
        if (res.success) {
            toast.success(L.toast.saveSuccess)
            setDrawerOpen(false)
            setForm({
                productId: '',
                price: '',
                source: 'Manual',
                priceDate: new Date().toISOString().slice(0, 10),
                currency: 'VND',
            })
            reload()
        } else {
            toast.error(res.error || L.toast.saveError)
        }
    }

    const filtered = rows.filter(r =>
        !search ||
        r.skuCode.toLowerCase().includes(search.toLowerCase()) ||
        r.productName.toLowerCase().includes(search.toLowerCase())
    )

    const belowCostCount = rows.filter(r => r.isBelowCost).length

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description}
                actions={
                    <Button variant="primary" size="sm" onClick={openDrawer}>
                        <Plus size={14} aria-hidden /> {L.header.addBtn}
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard label={L.stats.totalEntries} value={stats.totalEntries} icon={Tag} tone="brand" />
                <StatCard label={L.stats.trackedProducts} value={stats.trackedProducts} icon={TrendingUp} tone="info" />
                <StatCard
                    label={L.stats.belowCost}
                    value={belowCostCount}
                    icon={belowCostCount > 0 ? AlertTriangle : CheckCircle2}
                    tone={belowCostCount > 0 ? 'danger' : 'success'}
                />
                <StatCard
                    label={L.stats.sources}
                    value={stats.sourceBreakdown.map(s => s.source).join(', ') || '—'}
                    icon={Globe}
                />
            </StatGrid>

            <Toolbar
                right={
                    <SearchInput
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={L.searchPlaceholder}
                        className="w-full sm:w-80"
                    />
                }
            />

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th>{L.table.sku}</Th>
                            <Th>{L.table.product}</Th>
                            <Th align="right">{L.table.marketPrice}</Th>
                            <Th align="right">{L.table.landedCost}</Th>
                            <Th align="right">{L.table.listPrice}</Th>
                            <Th align="right">{L.table.marginGap}</Th>
                            <Th>{L.table.source}</Th>
                            <Th>{L.table.date}</Th>
                            <Th>{L.table.alert}</Th>
                        </tr>
                    </THead>
                    <TBody>
                        {filtered.length === 0 ? (
                            <TableMessageRow colSpan={9}>
                                <EmptyState
                                    icon={DollarSign}
                                    title={L.table.emptyTitle}
                                    description={L.table.emptyDescription}
                                />
                            </TableMessageRow>
                        ) : filtered.map(r => (
                            <Tr key={r.id} className={r.isBelowCost ? 'bg-tone-danger-bg/40' : undefined}>
                                <Td className="type-number font-semibold text-lys-teal-strong">{r.skuCode}</Td>
                                <Td className="font-medium text-lys-primary">{r.productName}</Td>
                                <Td align="right" className="type-number font-semibold text-tone-warning-fg">
                                    {formatCurrency(r.marketPrice)}
                                </Td>
                                <Td align="right" className="type-number text-lys-secondary">
                                    {r.landedCost !== null ? formatCurrency(r.landedCost) : '—'}
                                </Td>
                                <Td align="right" className={`type-number font-semibold ${r.isBelowCost ? 'text-tone-danger-fg' : 'text-tone-success-fg'}`}>
                                    {r.listPrice !== null ? formatCurrency(r.listPrice) : '—'}
                                </Td>
                                <Td align="right">
                                    {r.marginGap !== null ? (
                                        <span className={`inline-flex items-center justify-end gap-1 type-number font-semibold ${
                                            r.marginGap >= 20
                                                ? 'text-tone-success-fg'
                                                : r.marginGap >= 0
                                                    ? 'text-tone-warning-fg'
                                                    : 'text-tone-danger-fg'
                                        }`}>
                                            {r.marginGap >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {r.marginGap > 0 ? '+' : ''}{r.marginGap.toFixed(1)}%
                                        </span>
                                    ) : (
                                        <span className="text-lys-muted">—</span>
                                    )}
                                </Td>
                                <Td className="text-lys-secondary">{r.source}</Td>
                                <Td className="text-lys-muted">{formatDate(r.priceDate)}</Td>
                                <Td>
                                    {r.isBelowCost ? (
                                        <Badge tone="danger">
                                            <AlertTriangle size={11} className="mr-1" /> {L.table.lossAlert}
                                        </Badge>
                                    ) : (
                                        <Badge tone="success">{L.table.safeBadge}</Badge>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
                {filtered.length === 0 ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6">
                        <EmptyState
                            icon={DollarSign}
                            title={L.table.emptyTitle}
                            description={L.table.emptyDescription}
                        />
                    </div>
                ) : filtered.map(r => (
                    <div key={r.id} className="rounded-lg border border-lys-border bg-white p-4 shadow-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <span className="type-number text-xs font-semibold text-lys-teal-strong">{r.skuCode}</span>
                                <p className="text-sm font-semibold text-lys-primary truncate">{r.productName}</p>
                            </div>
                            {r.isBelowCost ? (
                                <Badge tone="danger">
                                    <AlertTriangle size={11} className="mr-1" /> {L.table.lossAlert}
                                </Badge>
                            ) : (
                                <Badge tone="success">{L.table.safeBadge}</Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-md bg-lys-subtle p-2.5 text-xs">
                            <div>
                                <span className="text-[11px] text-lys-muted block">{L.table.marketPrice}</span>
                                <span className="type-number font-semibold text-tone-warning-fg">{formatCurrency(r.marketPrice)}</span>
                            </div>
                            <div>
                                <span className="text-[11px] text-lys-muted block">{L.table.landedCost}</span>
                                <span className="type-number font-medium text-lys-secondary">
                                    {r.landedCost !== null ? formatCurrency(r.landedCost) : '—'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[11px] text-lys-muted block">{L.table.listPrice}</span>
                                <span className={`type-number font-semibold ${r.isBelowCost ? 'text-tone-danger-fg' : 'text-tone-success-fg'}`}>
                                    {r.listPrice !== null ? formatCurrency(r.listPrice) : '—'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-lys-muted pt-1 border-t border-lys-border/60">
                            <span>{r.source} • {formatDate(r.priceDate)}</span>
                            {r.marginGap !== null && (
                                <span className={`type-number font-semibold ${r.marginGap >= 0 ? 'text-tone-success-fg' : 'text-tone-danger-fg'}`}>
                                    {L.table.marginGap}: {r.marginGap > 0 ? '+' : ''}{r.marginGap.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Drawer */}
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={L.drawer.title}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setDrawerOpen(false)}>{L.drawer.cancelBtn}</Button>
                        <Button variant="primary" onClick={handleAdd}>
                            <Save size={14} aria-hidden /> {L.drawer.saveBtn}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label={L.drawer.productLabel} required>
                        {id => (
                            <Select id={id} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                                <option value="">{L.drawer.productPlaceholder}</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>
                                ))}
                            </Select>
                        )}
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.drawer.priceLabel} required>
                            {id => (
                                <Input
                                    id={id}
                                    type="number"
                                    value={form.price}
                                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                    placeholder={L.drawer.pricePlaceholder}
                                />
                            )}
                        </Field>
                        <Field label={L.drawer.currencyLabel}>
                            {id => (
                                <Select id={id} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                                    <option value="VND">VND</option>
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                </Select>
                            )}
                        </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label={L.drawer.sourceLabel}>
                            {id => (
                                <Select id={id} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                                    {['Manual', 'Wine-Searcher', 'Competitor', 'Vivino', 'Other'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </Select>
                            )}
                        </Field>
                        <Field label={L.drawer.dateLabel}>
                            {id => (
                                <Input
                                    id={id}
                                    type="date"
                                    value={form.priceDate}
                                    onChange={e => setForm(f => ({ ...f, priceDate: e.target.value }))}
                                />
                            )}
                        </Field>
                    </div>
                </div>
            </Drawer>
        </div>
    )
}
