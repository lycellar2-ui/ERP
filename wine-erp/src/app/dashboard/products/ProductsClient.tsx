'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Plus, Wine, Package, AlertCircle, TrendingUp, Upload, Download, Trash2, SlidersHorizontal } from 'lucide-react'
import { ProductRow, ProductFilters, ProductStats, bulkImportProducts, deleteProduct, exportProductsData, getProducts, getProductViewDetails, getProductsPageData } from './actions'
import { ProductTable } from './ProductTable'
import { ProductDrawer } from './ProductDrawer'
import { ProductDetailDrawer } from './ProductDetailDrawer'
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

const WINE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    RED: { label: 'Đỏ', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
    WHITE: { label: 'Trắng', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    ROSE: { label: 'Rosé', color: '#D4607A', bg: 'rgba(212,96,122,0.15)' },
    SPARKLING: { label: 'Sâm panh', color: '#7AC4C4', bg: 'rgba(122,196,196,0.15)' },
    FORTIFIED: { label: 'Fortified', color: '#87CBB9', bg: 'rgba(168,130,204,0.15)' },
    DESSERT: { label: 'Dessert', color: '#D4963A', bg: 'rgba(212,150,58,0.12)' },
}

export function WineTypeBadge({ type }: { type: string }) {
    const cfg = WINE_TYPE_CONFIG[type] ?? { label: type, color: '#8AAEBB', bg: 'rgba(168,152,128,0.15)' }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
    )
}

export function StatusBadge({ status }: { status: string }) {
    const cfg = {
        ACTIVE: { label: 'Đang bán', color: '#5BA88A', bg: 'rgba(74,124,89,0.15)' },
        DISCONTINUED: { label: 'Ngừng KD', color: '#4A6A7A', bg: 'rgba(107,90,78,0.15)' },
        ALLOCATION_ONLY: { label: 'Allocation', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    }[status] ?? { label: status, color: '#8AAEBB', bg: 'rgba(168,152,128,0.15)' }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
    )
}

function StatCard({ label, value, icon: Icon, accent }: {
    label: string; value: string | number; icon: React.FC<any>; accent: string
}) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
                style={{ background: `${accent}20` }}>
                <Icon size={20} style={{ color: accent }} />
            </div>
            <div>
                <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{label}</p>
                <p className="text-xl font-bold mt-0.5"
                    style={{ fontFamily: '"DM Mono", monospace', color: '#E8F1F2' }}>{value}</p>
            </div>
        </div>
    )
}

interface ProductsClientProps {
    initialRows: ProductRow[]
    initialTotal: number
    initialStats: ProductStats
    initialCountries: { code: string; count: number }[]
    initialVintages: number[]
    initialProducers: { id: string; name: string }[]
    canEdit?: boolean
}

export function ProductsClient({ 
    initialRows, 
    initialTotal, 
    initialStats, 
    initialCountries, 
    initialVintages, 
    initialProducers, 
    canEdit = false 
}: ProductsClientProps) {
    const [rows, setRows] = useState<ProductRow[]>(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [stats, setStats] = useState<ProductStats>(initialStats)
    const [countries, setCountries] = useState(initialCountries)
    const [vintages, setVintages] = useState(initialVintages)
    const [producers, setProducers] = useState(initialProducers)
    const [loading, setLoading] = useState(false)
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
    const [vintageFilter, setVintageFilter] = useState('')
    const [producerFilter, setProducerFilter] = useState('')
    const [exporting, setExporting] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

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
            .catch(err => {
                delete detailCache.current[id]
                return null
            })
        detailCache.current[id] = promise
    }, [])

    const handleSearchChange = (value: string) => {
        setSearch(value)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            applyFilter({ search: value || undefined })
        }, 300)
    }

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    // Use server-aggregated stats (counts all products, not just current page)
    const topTypeLabel = stats.topTypes.map(t => `${t.count} ${t.label}`).join(' / ') || 'N/A'

    const applyFilter = useCallback(async (newFilters: Partial<ProductFilters>) => {
        const merged = { ...filters, ...newFilters, page: newFilters.page ?? 1 }
        setFilters(merged)
        setLoading(true)
        try {
            const result = await getProducts(merged)
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [filters])

    const reloadPageData = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getProductsPageData(filters)
            setRows(data.rows)
            setTotal(data.total)
            setStats(data.stats)
            setCountries(data.countries)
            setVintages(data.vintages)
            setProducers(data.producers)
        } finally {
            setLoading(false)
        }
    }, [filters])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa sản phẩm "${name}"?\n\nSản phẩm sẽ bị ẩn khỏi danh sách (soft delete).`)) return
        try {
            await deleteProduct(id)
            toast.success(`Đã xóa "${name}"`)
            reloadPageData()
        } catch {
            toast.error('Không thể xóa sản phẩm')
        }
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
        vintageFilter,
        producerFilter,
    ].filter(Boolean).length

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D1E2B]/40 p-3 rounded-xl border border-[#2A4355]/30">
                <div className="flex flex-wrap items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold"
                            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                            Danh Mục Sản Phẩm
                        </h2>
                    </div>
                    
                    {/* Compact Metrics Pill Row */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1B2E3D] border border-[#2A4355]/50" style={{ color: '#87CBB9' }}>
                            Tổng: &nbsp;<strong className="text-[#E8F1F2]">{stats.total}</strong>
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1B2E3D] border border-[#2A4355]/50" style={{ color: '#5BA88A' }}>
                            Đang bán: &nbsp;<strong className="text-[#E8F1F2]">{stats.active}</strong>
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#1B2E3D] border border-[#2A4355]/50" style={{ color: '#E05252' }}>
                            Hết hàng: &nbsp;<strong className="text-[#E8F1F2]">{stats.outOfStock}</strong>
                        </span>
                        <span className="hidden xl:inline-flex items-center px-2 py-0.5 rounded bg-[#1B2E3D] border border-[#2A4355]/50" style={{ color: '#4A8FAB' }}>
                            Nổi bật: &nbsp;<strong className="text-[#E8F1F2] font-mono">{topTypeLabel}</strong>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#1B2E3D', color: '#5BA88A', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#5BA88A' } }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}
                    >
                        <Download size={13} /> {exporting ? 'Đang xuất...' : 'Export'}
                    </button>
                    {canEdit && (
                        <>
                            <button
                                onClick={() => setImportOpen(true)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#4A8FAB' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}
                            >
                                <Upload size={13} /> Import
                            </button>
                            <button
                                onClick={() => { setEditingId(null); setDrawerOpen(true) }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
                                style={{ background: '#87CBB9', color: '#0A1926' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                            >
                                <Plus size={13} /> Thêm Sản Phẩm
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                        <input
                            type="text"
                            placeholder="Tìm theo tên, SKU, barcode, nhà SX..."
                            value={search}
                            onChange={e => handleSearchChange(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                        />
                    </div>
                    {/* Collapsible Trigger Button for Mobile Filters */}
                    <button
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="flex md:hidden items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        style={{ 
                            background: '#1B2E3D', 
                            color: showMobileFilters ? '#87CBB9' : '#8AAEBB', 
                            borderColor: showMobileFilters ? '#87CBB9' : '#2A4355' 
                        }}
                    >
                        <SlidersHorizontal size={13} />
                        Lọc {activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                    </button>
                </div>

                {/* Filters container: collapsible on mobile, flex row on desktop */}
                <div className={`${showMobileFilters ? 'flex flex-col sm:flex-row' : 'hidden'} md:flex flex-wrap gap-2 transition-all duration-200`}>
                    <select value={typeFilter}
                        onChange={e => { setTypeFilter(e.target.value); applyFilter({ wineType: e.target.value || undefined }) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer animate-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: typeFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả loại</option>
                        <option value="RED">🔴 Vang Đỏ</option>
                        <option value="WHITE">🟡 Vang Trắng</option>
                        <option value="ROSE">🌸 Rosé</option>
                        <option value="SPARKLING">🥂 Sâm panh</option>
                        <option value="FORTIFIED">🍯 Fortified</option>
                        <option value="DESSERT">🍰 Dessert</option>
                    </select>
                    <select value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); applyFilter({ status: e.target.value || undefined }) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả trạng thái</option>
                        <option value="ACTIVE">Đang bán</option>
                        <option value="DISCONTINUED">Ngừng KD</option>
                        <option value="ALLOCATION_ONLY">Allocation</option>
                    </select>
                    {/* Country filter — dynamic from DB */}
                    <select value={countryFilter}
                        onChange={e => { setCountryFilter(e.target.value); applyFilter({ country: e.target.value || undefined }) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: countryFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả quốc gia</option>
                        {countries.map(c => (
                            <option key={c.code} value={c.code}>
                                {COUNTRY_FLAGS[c.code] ?? '🌍'} {COUNTRY_NAMES[c.code] ?? c.code} ({c.count})
                            </option>
                        ))}
                    </select>
                    {/* Vintage filter — dynamic from DB */}
                    <select value={vintageFilter}
                        onChange={e => { setVintageFilter(e.target.value); applyFilter({ vintage: e.target.value ? Number(e.target.value) : undefined }) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: vintageFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả vintage</option>
                        {vintages.map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>
                    {/* Producer/NCC filter — dynamic from DB */}
                    <select value={producerFilter}
                        onChange={e => { setProducerFilter(e.target.value); applyFilter({ producerId: e.target.value || undefined }) }}
                        className="px-2.5 py-1.5 rounded-lg text-xs outline-none cursor-pointer md:max-w-[180px]"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: producerFilter ? '#E8F1F2' : '#4A6A7A' }}>
                        <option value="">Tất cả NCC / Nhà SX</option>
                        {producers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {(search || typeFilter || statusFilter || countryFilter || vintageFilter || producerFilter) && (
                        <button onClick={() => {
                            setSearch(''); setTypeFilter(''); setStatusFilter(''); setCountryFilter(''); setVintageFilter(''); setProducerFilter('')
                            applyFilter({ search: undefined, wineType: undefined, status: undefined, country: undefined, vintage: undefined, producerId: undefined })
                        }} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ color: '#E05252', border: '1px solid rgba(224,82,82,0.3)', background: 'rgba(224,82,82,0.05)' }}>
                            Xóa bộ lọc
                        </button>
                    )}
                </div>
            </div>

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
                    { header: 'Vintage', sample: '2018' },
                    { header: 'Loại', sample: 'RED', required: true },
                    { header: 'Quốc Gia', sample: 'FR', required: true },
                    { header: 'ABV', sample: '13.5' },
                    { header: 'Dung Tích', sample: '750' },
                    { header: 'Format', sample: 'STANDARD' },
                    { header: 'Đóng Gói', sample: 'OWC' },
                    { header: 'Chai/Thùng', sample: '6' },
                    { header: 'Barcode', sample: '3760076009012' },
                    { header: 'Classification', sample: 'Premier Cru Classé' },
                ]}
                onImport={bulkImportProducts}
                onComplete={reloadPageData}
            />
        </div>
    )
}
