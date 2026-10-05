'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Upload, Download, SlidersHorizontal, X } from 'lucide-react'
import { Button, PageHeader, SearchInput, Select, StatusBadge, Toolbar, useConfirmDialog } from '@/components/ui'
import { ProductRow, ProductFilters, ProductStats, bulkImportProducts, deleteProduct, exportProductsData, getProducts, getProductViewDetails, getProductsPageData, getProductStats, getProductCountries, getProducers, getProductEditDetails, getAppellations, getSuppliers } from './actions'
import { ProductTable } from './ProductTable'
import dynamic from 'next/dynamic'
const ProductDrawer = dynamic(() => import('./ProductDrawer').then(m => m.ProductDrawer), { loading: () => null, ssr: false })
const ProductDetailDrawer = dynamic(() => import('./ProductDetailDrawer').then(m => m.ProductDetailDrawer), { loading: () => null, ssr: false })
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { toast } from 'sonner'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}

const COUNTRY_NAMES: Record<string, string> = {
    FR: 'Pháp', IT: 'Ý', ES: 'TBN', PT: 'BĐN', DE: 'Đức',
    US: 'Mỹ', AU: 'Úc', NZ: 'NZ', AR: 'Argentina', CL: 'Chile', ZA: 'Nam Phi',
    GE: 'Georgia', HU: 'Hungary', GR: 'Hy Lạp', AT: 'Áo', RO: 'Romania', MX: 'Mexico', JP: 'Nhật',
}

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Đang bán',
    DISCONTINUED: 'Ngừng KD',
    ALLOCATION_ONLY: 'Allocation',
}

const PRODUCT_TONE_OVERRIDES = { ALLOCATION_ONLY: 'info' } as const

export function ProductStatusBadge({ status }: { status: string }) {
    return <StatusBadge status={status} label={PRODUCT_STATUS_LABEL[status]} toneOverrides={PRODUCT_TONE_OVERRIDES} />
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
    const qc = useQueryClient()
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

    // Warm reference data cache for drawers
    useEffect(() => {
        getAppellations().catch(() => [])
        getSuppliers().catch(() => [])
    }, [])

    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const detailCache = useRef<Record<string, any>>({})

    const prefetchProductDetails = useCallback((id: string, isEager = false) => {
        if (detailCache.current[id]) return
        const promise = getProductViewDetails(id)
            .then(data => {
                if (data) {
                    detailCache.current[id] = data
                }
                return data
            })
            .catch(err => {
                delete detailCache.current[id]
                return null
            })
        detailCache.current[id] = promise

        // Warm server cache for edit details ONLY on active hover (not during eager page-load prefetch)
        if (!isEager) {
            getProductEditDetails(id).catch(() => {})
        }
    }, [])

    // Eager prefetch: batch-load details for all visible rows on page render
    useEffect(() => {
        if (rows.length === 0) return
        const uncachedIds = rows
            .map(r => r.id)
            .filter(id => !detailCache.current[id])
        if (uncachedIds.length === 0) return

        // Stagger prefetch in small batches to avoid overwhelming the server
        const BATCH_SIZE = 5
        let cancelled = false
        const runBatches = async () => {
            for (let i = 0; i < uncachedIds.length; i += BATCH_SIZE) {
                if (cancelled) break
                const batch = uncachedIds.slice(i, i + BATCH_SIZE)
                batch.forEach(id => prefetchProductDetails(id, true))
                if (i + BATCH_SIZE < uncachedIds.length) {
                    await new Promise(r => setTimeout(r, 100))
                }
            }
        }
        runBatches()
        return () => { cancelled = true }
    }, [rows, prefetchProductDetails])

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
    }, [qc])

    const handleDelete = (id: string, name: string) => {
        confirm({
            title: `Xóa Sản Phẩm "${name}"`,
            message: (
                <div className="space-y-1">
                    <p>Bạn có chắc chắn muốn xóa sản phẩm <strong>"{name}"</strong>?</p>
                    <p className="text-xs text-slate-500">Sản phẩm sẽ bị ẩn khỏi danh sách (soft delete).</p>
                </div>
            ),
            confirmLabel: 'Xác Nhận Xóa',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                try {
                    await deleteProduct(id)
                    toast.success(`Đã xóa "${name}"`)
                    reloadPageData()
                } catch {
                    toast.error('Không thể xóa sản phẩm')
                }
            }
        })
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportProductsData()
            // Convert to CSV
            if (data.length === 0) { toast.error('Chưa có sản phẩm để xuất'); return }
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
            toast.success(`Đã xuất ${data.length} sản phẩm`)
        } catch {
            toast.error('Lỗi xuất Excel')
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
                        <span>Tổng: <strong className="type-number text-sm ml-1 text-lys-teal-strong">{stats.total}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>Đang bán: <strong className="type-number text-sm ml-1 text-tone-success-fg">{stats.active}</strong></span>
                        <span className="text-lys-border-strong">|</span>
                        <span>Hết hàng: <strong className="type-number text-sm ml-1 text-tone-danger-fg">{stats.outOfStock}</strong></span>
                        <span className="hidden xl:inline text-lys-border-strong">|</span>
                        <span className="hidden xl:inline">Nổi bật: <strong className="type-number text-sm ml-1 text-lys-primary">{topTypeLabel}</strong></span>
                    </div>
                }
                actions={
                    <>
                        <Button variant="secondary" onClick={handleExport} loading={exporting} disabled={exporting}>
                            {!exporting && <Download size={14} aria-hidden />} {exporting ? 'Đang xuất...' : 'Export'}
                        </Button>
                        {canEdit && (
                            <>
                                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                                    <Upload size={14} aria-hidden /> Import
                                </Button>
                                <Button onClick={() => { setEditingId(null); setDrawerOpen(true) }}>
                                    <Plus size={16} aria-hidden /> Thêm Sản Phẩm
                                </Button>
                            </>
                        )}
                    </>
                }
            />

            <Toolbar
                left={
                    <div className="flex gap-2">
                        <SearchInput
                            placeholder="Tìm theo tên, SKU, nhà SX..."
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
                            Lọc{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                        </Button>
                    </div>
                }
                right={
                    <div className={`${showMobileFilters ? 'grid grid-cols-2' : 'hidden'} md:flex md:flex-wrap items-center gap-2 w-full md:w-auto`}>
                        <Select
                            aria-label="Loại vang"
                            value={typeFilter}
                            onChange={e => { setTypeFilter(e.target.value); applyFilter({ wineType: e.target.value || undefined }) }}
                            className="md:w-36"
                        >
                            <option value="">Tất cả loại</option>
                            <option value="WHITE">Vang trắng</option>
                            <option value="RED">Vang đỏ</option>
                            <option value="SPARKLING">Vang nổ</option>
                            <option value="ROSE">Vang hồng</option>
                        </Select>
                        <Select
                            aria-label="Trạng thái"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); applyFilter({ status: e.target.value || undefined }) }}
                            className="md:w-40"
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="ACTIVE">Đang bán</option>
                            <option value="DISCONTINUED">Ngừng KD</option>
                            <option value="ALLOCATION_ONLY">Allocation</option>
                        </Select>
                        <Select
                            aria-label="Quốc gia"
                            value={countryFilter}
                            onChange={e => { setCountryFilter(e.target.value); applyFilter({ country: e.target.value || undefined }) }}
                            className="md:w-40"
                        >
                            <option value="">Tất cả quốc gia</option>
                            {countries.map(c => (
                                <option key={c.code} value={c.code}>
                                    {COUNTRY_FLAGS[c.code] ?? '🌍'} {COUNTRY_NAMES[c.code] ?? c.code} ({c.count})
                                </option>
                            ))}
                        </Select>
                        <Select
                            aria-label="NCC / Nhà SX"
                            value={producerFilter}
                            onChange={e => { setProducerFilter(e.target.value); applyFilter({ producerId: e.target.value || undefined }) }}
                            className="md:w-44"
                        >
                            <option value="">Tất cả NCC / Nhà SX</option>
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
                                <X size={14} aria-hidden /> Xóa bộ lọc
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
                title="Import Sản Phẩm"
                templateFileName="template_san_pham.xlsx"
                templateColumns={[
                    { header: 'SKU', sample: 'MOUTON-2018-750', required: true },
                    { header: 'Tên SP', sample: 'Château Mouton Rothschild 2018', required: true },
                    { header: 'Nhà SX', sample: 'Château Mouton Rothschild', required: true },

                    { header: 'Loại', sample: 'RED', required: true },
                    { header: 'Quốc Gia', sample: 'FR', required: true },
                    { header: 'ABV', sample: '13.5' },
                    { header: 'Dung Tích', sample: '750' },
                    { header: 'Format', sample: 'STANDARD' },
                    { header: 'Đóng Gói', sample: 'OWC' },
                    { header: 'Chai/Thùng', sample: '6' },
                    { header: 'Classification', sample: 'Premier Cru Classé' },
                ]}
                onImport={bulkImportProducts}
                onComplete={reloadPageData}
            />
            {confirmDialog}
        </div>
    )
}
