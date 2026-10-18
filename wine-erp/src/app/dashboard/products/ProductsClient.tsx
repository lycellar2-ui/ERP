'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Upload, Download, SlidersHorizontal, X, Package, FileText } from 'lucide-react'
import { Button, PageHeader, SearchInput, Select, StatusBadge, Toolbar, useConfirmDialog } from '@/components/ui'
import { ProductRow, ProductFilters, ProductStats, bulkImportProducts, deleteProduct, exportProductsData, getProducts, getProductViewDetails, getProductsPageData, getProductStats, getProductCountries, getProducers, getProductEditDetails, getAppellations, getSuppliers } from './actions'
import { ProductTable } from './ProductTable'
import { TastingNotesCatalog } from './TastingNotesCatalog'
import dynamic from 'next/dynamic'
const ProductDrawer = dynamic(() => import('./ProductDrawer').then(m => m.ProductDrawer), { loading: () => null, ssr: false })
const ProductDetailDrawer = dynamic(() => import('./ProductDetailDrawer').then(m => m.ProductDetailDrawer), { loading: () => null, ssr: false })
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { PRODUCTS_I18N } from './i18n'

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Đang bán',
    DISCONTINUED: 'Ngừng KD',
    ALLOCATION_ONLY: 'Allocation',
}

const PRODUCT_TONE_OVERRIDES = { ALLOCATION_ONLY: 'info' } as const

export function ProductStatusBadge({ status }: { status: string }) {
    const { locale } = useAppLocale()
    const L = PRODUCTS_I18N[locale]
    return <StatusBadge status={status} label={L.statuses[status] ?? PRODUCT_STATUS_LABEL[status]} toneOverrides={PRODUCT_TONE_OVERRIDES} />
}

type ProductsPageResult = { rows: ProductRow[]; total: number; stats: ProductStats; countries: { code: string; count: number }[]; producers: { id: string; name: string }[]; canEdit: boolean }

interface ProductsClientProps {
    canEdit?: boolean
    initialData?: ProductsPageResult
}

export function ProductsClient({ 
    canEdit = false,
    initialData,
}: ProductsClientProps) {
    const { locale, formatNumber } = useAppLocale()
    const L = PRODUCTS_I18N[locale]
    const qc = useQueryClient()
    const [activeTab, setActiveTab] = useState<'CATALOG' | 'TASTING_NOTES'>('CATALOG')
    const [filters, setFilters] = useState<ProductFilters>({ page: 1, pageSize: 20 })
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [viewOpen, setViewOpen] = useState(false)
    const [viewId, setViewId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [countryFilter, setCountryFilter] = useState('')
    const [producerFilter, setProducerFilter] = useState('')
    const [exporting, setExporting] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // TanStack Query — cache products page data, survive tab switches
    const { data: queryData, isLoading, isFetching } = useQuery({
        queryKey: ['products', filters],
        queryFn: () => getProductsPageData(filters),
        initialData: filters.page === 1 && !filters.search && !filters.wineType && !filters.status && !filters.country && !filters.producerId
            ? initialData
            : undefined,
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    })
    const loading = isLoading || isFetching

    const rows = queryData?.rows ?? []
    const total = queryData?.total ?? 0
    const stats = queryData?.stats ?? { total: 0, active: 0, outOfStock: 0, topTypes: [] }
    const countries = queryData?.countries ?? []
    const producers = queryData?.producers ?? []

    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const detailCache = useRef<Record<string, any>>({})

    const prefetchProductDetails = useCallback((id: string) => {
        if (detailCache.current[id]) return
        const promise = getProductViewDetails(id)
            .then(data => {
                if (data) {
                    detailCache.current[id] = data
                }
                return data
            })
            .catch(() => {
                delete detailCache.current[id]
                return null
            })
        detailCache.current[id] = promise
    }, [])

    const handleSearchChange = (value: string) => {
        setSearch(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!value) {
            applyFilter({ search: undefined })
        } else {
            debounceRef.current = setTimeout(() => {
                applyFilter({ search: value || undefined })
            }, 300)
        }
    }

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    // Use server-aggregated stats (counts all products, not just current page)
    const topTypeLabel = stats.topTypes.map(t => `${t.count} ${t.label}`).join(' / ') || 'N/A'

    const applyFilter = useCallback((newFilters: Partial<ProductFilters>) => {
        // Update filters → queryKey changes → TanStack auto refetch
        setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }))
    }, [])

    const reloadPageData = useCallback(() => {
        qc.invalidateQueries({ queryKey: ['products'] })
        qc.invalidateQueries({ queryKey: ['products-tasting-note-catalog'] })
    }, [qc])

    const handleDelete = (id: string, name: string) => {
        confirm({
            title: L.deleteConfirm.title(name),
            message: (
                <div className="space-y-1">
                    <p>{L.deleteConfirm.message1} <strong>"{name}"</strong>?</p>
                    <p className="text-xs text-slate-500">{L.deleteConfirm.message2}</p>
                </div>
            ),
            confirmLabel: L.deleteConfirm.confirmLabel,
            cancelLabel: L.deleteConfirm.cancelLabel,
            danger: true,
            onConfirm: async () => {
                try {
                    await deleteProduct(id)
                    toast.success(L.deleteConfirm.deletedSuccess(name))
                    reloadPageData()
                } catch {
                    toast.error(L.deleteConfirm.deleteFailed)
                }
            }
        })
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportProductsData()
            // Convert to CSV
            if (data.length === 0) { toast.error(L.exportMsg.empty); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row =>
                    headers.map(h => {
                        const val = String((row as any)[h] ?? '')
                        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                    }).join(',')
                )
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `danh_muc_san_pham_${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(L.exportMsg.success(data.length))
        } catch {
            toast.error(L.exportMsg.failed)
        } finally {
            setExporting(false)
        }
    }

    const handleSort = (sortBy: ProductFilters['sortBy']) => {
        const newDir = filters.sortBy === sortBy && filters.sortDir === 'asc' ? 'desc' : 'asc'
        applyFilter({ sortBy, sortDir: newDir })
    }

    const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const prefetchPage = useCallback((p: number) => {
        if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current)
        prefetchTimeoutRef.current = setTimeout(() => {
            const merged = { ...filters, page: p }
            getProducts(merged).catch(() => {})
        }, 150) // 150ms dwell time (intent-based prefetching)
    }, [filters])

    useEffect(() => {
        return () => {
            if (prefetchTimeoutRef.current) clearTimeout(prefetchTimeoutRef.current)
        }
    }, [])

    const activeFiltersCount = [
        typeFilter,
        statusFilter,
        countryFilter,
        producerFilter,
    ].filter(Boolean).length

    const hasFilters = !!(search || typeFilter || statusFilter || countryFilter || producerFilter)

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption">
                        <span>{L.header.total} <strong className="type-number text-sm ml-1 text-lys-teal-strong">{formatNumber(stats.total)}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>{L.header.active} <strong className="type-number text-sm ml-1 text-tone-success-fg">{formatNumber(stats.active)}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>{L.header.outOfStock} <strong className="type-number text-sm ml-1 text-tone-danger-fg">{formatNumber(stats.outOfStock)}</strong></span>
                        <span className="hidden xl:inline text-lys-border-strong">|</span>
                        <span className="hidden xl:inline">{L.header.featured} <strong className="type-number text-sm ml-1 text-lys-primary">{topTypeLabel}</strong></span>
                    </div>
                }
                actions={
                    <>
                        <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={exporting}>
                            {!exporting && <Download size={14} aria-hidden />} {exporting ? L.header.exporting : L.header.exportBtn}
                        </Button>
                        {canEdit && (
                            <>
                                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                                    <Upload size={14} aria-hidden /> {L.header.importBtn}
                                </Button>
                                <Button onClick={() => { setEditingId(null); setDrawerOpen(true) }}>
                                    <Plus size={16} aria-hidden /> {L.header.addBtn}
                                </Button>
                            </>
                        )}
                    </>
                }
            />

            {/* Clean View Switcher Tabs */}
            <div className="flex items-center gap-1 border-b border-lys-border">
                <button
                    type="button"
                    onClick={() => setActiveTab('CATALOG')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'CATALOG'
                            ? 'border-lys-teal-strong text-lys-teal-strong bg-white rounded-t-md'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Package size={14} />
                    {L.tabs.catalog}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('TASTING_NOTES')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'TASTING_NOTES'
                            ? 'border-lys-teal-strong text-lys-teal-strong bg-white rounded-t-md'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FileText size={14} />
                    {L.tabs.tastingNotes}
                </button>
            </div>

            {activeTab === 'CATALOG' ? (
                <>
                    <Toolbar
                        left={
                            <div className="flex gap-2">
                                <SearchInput
                                    placeholder={L.filters.searchPlaceholder}
                                    value={search}
                                    onChange={e => handleSearchChange(e.target.value)}
                                    className="sm:w-72"
                                />
                                <Button
                                    variant="secondary"
                                    className="md:hidden"
                                    aria-expanded={showMobileFilters}
                                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                                >
                                    <SlidersHorizontal size={14} aria-hidden />
                                    {L.filters.filterBtn}{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                                </Button>
                            </div>
                        }
                        right={
                            <div className={`${showMobileFilters ? 'grid grid-cols-2' : 'hidden'} md:flex md:flex-wrap items-center gap-2 w-full md:w-auto`}>
                                <Select
                                    aria-label={L.filters.wineTypeLabel}
                                    value={typeFilter}
                                    onChange={e => { setTypeFilter(e.target.value); applyFilter({ wineType: e.target.value || undefined }) }}
                                    className="md:w-36"
                                >
                                    <option value="">{L.filters.allTypes}</option>
                                    <option value="WHITE">{L.wineTypes.WHITE}</option>
                                    <option value="RED">{L.wineTypes.RED}</option>
                                    <option value="SPARKLING">{L.wineTypes.SPARKLING}</option>
                                    <option value="ROSE">{L.wineTypes.ROSE}</option>
                                </Select>
                                <Select
                                    aria-label={L.filters.statusLabel}
                                    value={statusFilter}
                                    onChange={e => { setStatusFilter(e.target.value); applyFilter({ status: e.target.value || undefined }) }}
                                    className="md:w-40"
                                >
                                    <option value="">{L.filters.allStatuses}</option>
                                    <option value="ACTIVE">{L.statuses.ACTIVE}</option>
                                    <option value="DISCONTINUED">{L.statuses.DISCONTINUED}</option>
                                    <option value="ALLOCATION_ONLY">{L.statuses.ALLOCATION_ONLY}</option>
                                </Select>
                                <Select
                                    aria-label={L.filters.countryLabel}
                                    value={countryFilter}
                                    onChange={e => { setCountryFilter(e.target.value); applyFilter({ country: e.target.value || undefined }) }}
                                    className="md:w-40"
                                >
                                    <option value="">{L.filters.allCountries}</option>
                                    {countries.map(c => (
                                        <option key={c.code} value={c.code}>
                                            {L.countries[c.code] ?? c.code} [{c.code}] ({c.count})
                                        </option>
                                    ))}
                                </Select>
                                <Select
                                    aria-label={L.filters.producerLabel}
                                    value={producerFilter}
                                    onChange={e => { setProducerFilter(e.target.value); applyFilter({ producerId: e.target.value || undefined }) }}
                                    className="md:w-44"
                                >
                                    <option value="">{L.filters.allProducers}</option>
                                    {producers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </Select>
                                {hasFilters && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setSearch(''); setTypeFilter(''); setStatusFilter(''); setCountryFilter(''); setProducerFilter('')
                                            applyFilter({ search: undefined, wineType: undefined, status: undefined, country: undefined, producerId: undefined })
                                        }}
                                    >
                                        <X size={14} aria-hidden /> {L.filters.clearFilters}
                                    </Button>
                                )}
                            </div>
                        }
                    />

                    <ProductTable
                        rows={rows} total={total} loading={loading}
                        page={filters.page ?? 1} pageSize={filters.pageSize ?? 20}
                        sortBy={filters.sortBy} sortDir={filters.sortDir}
                        onPageChange={p => applyFilter({ page: p })}
                        onSort={handleSort}
                        onEdit={id => { setEditingId(id); setDrawerOpen(true) }}
                        onDelete={handleDelete}
                        onView={id => { setViewId(id); setViewOpen(true) }}
                        onPrefetchDetails={prefetchProductDetails}
                        canEdit={canEdit}
                        onRefresh={reloadPageData}
                        onPrefetch={prefetchPage}
                    />
                </>
            ) : (
                <TastingNotesCatalog
                    canEdit={canEdit}
                    onViewProduct={id => { setViewId(id); setViewOpen(true) }}
                    onEditProduct={id => { setEditingId(id); setDrawerOpen(true) }}
                />
            )}

            <ProductDrawer
                open={drawerOpen} editingId={editingId}
                initialData={rows.find(r => r.id === editingId) || null}
                onClose={() => setDrawerOpen(false)}
                onSaved={() => { setDrawerOpen(false); reloadPageData() }}
            />

            <ProductDetailDrawer
                open={viewOpen}
                productId={viewId}
                initialData={rows.find(r => r.id === viewId) || null}
                cachedData={viewId ? detailCache.current[viewId] : null}
                onClose={() => setViewOpen(false)}
                canEdit={canEdit}
                onEditTrigger={id => { setEditingId(id); setDrawerOpen(true) }}
            />

            <ExcelImportDialog
                open={importOpen}
                onClose={() => setImportOpen(false)}
                title={L.importDialog.title}
                templateFileName="template_san_pham.xlsx"
                templateColumns={[
                    { header: 'SKU', sample: 'MOUTON-2018-750', required: true },
                    { header: L.importDialog.colName, sample: 'Château Mouton Rothschild 2018', required: true },
                    { header: L.importDialog.colProducer, sample: 'Château Mouton Rothschild', required: true },

                    { header: L.importDialog.colType, sample: 'RED', required: true },
                    { header: L.importDialog.colCountry, sample: 'FR', required: true },
                    { header: 'ABV', sample: '13.5' },
                    { header: L.importDialog.colVolume, sample: '750' },
                    { header: 'Format', sample: 'STANDARD' },
                    { header: L.importDialog.colPackaging, sample: 'OWC' },
                    { header: L.importDialog.colUnitsPerCase, sample: '6' },
                    { header: 'Classification', sample: 'Premier Cru Classé' },
                ]}
                onImport={bulkImportProducts}
                onComplete={reloadPageData}
            />
            {confirmDialog}
        </div>
    )
}
