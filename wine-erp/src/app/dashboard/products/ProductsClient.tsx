'use client'

import { useState, useCallback } from 'react'
import { Search, Plus, Wine, Package, AlertCircle, TrendingUp, Upload, Download, Trash2 } from 'lucide-react'
import { ProductRow, ProductFilters, ProductStats, bulkImportProducts, deleteProduct, exportProductsData } from './actions'
import { ProductTable } from './ProductTable'
import { ProductDrawer } from './ProductDrawer'
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
    stats: ProductStats
    countries: { code: string; count: number }[]
    vintages: number[]
}

export function ProductsClient({ initialRows, initialTotal, stats, countries, vintages }: ProductsClientProps) {
    const [rows, setRows] = useState<ProductRow[]>(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState<ProductFilters>({ page: 1, pageSize: 20 })
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [countryFilter, setCountryFilter] = useState('')
    const [vintageFilter, setVintageFilter] = useState('')
    const [exporting, setExporting] = useState(false)

    // Use server-aggregated stats (counts all products, not just current page)
    const topTypeLabel = stats.topTypes.map(t => `${t.count} ${t.label}`).join(' / ') || 'N/A'

    const applyFilter = useCallback(async (newFilters: Partial<ProductFilters>) => {
        const merged = { ...filters, ...newFilters, page: newFilters.page ?? 1 }
        setFilters(merged)
        setLoading(true)
        try {
            const { getProducts } = await import('./actions')
            const result = await getProducts(merged)
            setRows(result.rows)
            setTotal(result.total)
        } finally {
            setLoading(false)
        }
    }, [filters])

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Xóa sản phẩm "${name}"?\n\nSản phẩm sẽ bị ẩn khỏi danh sách (soft delete).`)) return
        try {
            await deleteProduct(id)
            toast.success(`Đã xóa "${name}"`)
            applyFilter({})
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

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Danh Mục Sản Phẩm
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Master Data — Quản lý toàn bộ danh mục rượu vang nhập khẩu
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                        style={{ background: '#1B2E3D', color: '#5BA88A', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#5BA88A' } }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}
                    >
                        <Download size={16} /> {exporting ? 'Đang xuất...' : 'Export CSV'}
                    </button>
                    <button
                        onClick={() => setImportOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#142433'; e.currentTarget.style.borderColor = '#4A8FAB' }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#1B2E3D'; e.currentTarget.style.borderColor = '#2A4355' }}
                    >
                        <Upload size={16} /> Import Excel
                    </button>
                    <button
                        onClick={() => { setEditingId(null); setDrawerOpen(true) }}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                    >
                        <Plus size={16} /> Thêm Sản Phẩm
                    </button>
                </div>
            </div>

            {/* Stats — aggregated from all products (server) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label="Tổng sản phẩm" value={stats.total} icon={Wine} accent="#87CBB9" />
                <StatCard label="Đang kinh doanh" value={stats.active} icon={Package} accent="#5BA88A" />
                <StatCard label="Hết hàng (cần nhập)" value={stats.outOfStock} icon={AlertCircle} accent="#8B1A2E" />
                <StatCard label="Loại nổi bật" value={topTypeLabel} icon={TrendingUp} accent="#4A8FAB" />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, SKU, barcode, nhà SX..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); applyFilter({ search: e.target.value || undefined }) }}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    />
                </div>
                <select value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); applyFilter({ wineType: e.target.value || undefined }) }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
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
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả trạng thái</option>
                    <option value="ACTIVE">Đang bán</option>
                    <option value="DISCONTINUED">Ngừng KD</option>
                    <option value="ALLOCATION_ONLY">Allocation</option>
                </select>
                {/* Country filter — dynamic from DB */}
                <select value={countryFilter}
                    onChange={e => { setCountryFilter(e.target.value); applyFilter({ country: e.target.value || undefined }) }}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
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
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: vintageFilter ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Tất cả vintage</option>
                    {vintages.map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
                {(search || typeFilter || statusFilter || countryFilter || vintageFilter) && (
                    <button onClick={() => {
                        setSearch(''); setTypeFilter(''); setStatusFilter(''); setCountryFilter(''); setVintageFilter('')
                        applyFilter({ search: undefined, wineType: undefined, status: undefined, country: undefined, vintage: undefined })
                    }} className="px-3 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>
                        Xóa filter
                    </button>
                )}
            </div>

            <ProductTable
                rows={rows} total={total} loading={loading}
                page={filters.page ?? 1} pageSize={filters.pageSize ?? 20}
                sortBy={filters.sortBy} sortDir={filters.sortDir}
                onPageChange={p => applyFilter({ page: p })}
                onSort={handleSort}
                onEdit={id => { setEditingId(id); setDrawerOpen(true) }}
                onDelete={handleDelete}
                onRefresh={() => applyFilter({})}
            />

            <ProductDrawer
                open={drawerOpen} editingId={editingId}
                onClose={() => setDrawerOpen(false)}
                onSaved={() => { setDrawerOpen(false); applyFilter({}) }}
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
                onComplete={() => applyFilter({})}
            />
        </div>
    )
}
