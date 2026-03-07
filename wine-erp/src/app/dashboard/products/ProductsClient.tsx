'use client'

import { useState, useCallback } from 'react'
import { Search, Plus, Wine, Package, AlertCircle, TrendingUp, Upload } from 'lucide-react'
import { ProductRow, ProductFilters, ProductStats, bulkImportProducts } from './actions'
import { ProductTable } from './ProductTable'
import { ProductDrawer } from './ProductDrawer'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
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
}

export function ProductsClient({ initialRows, initialTotal, stats }: ProductsClientProps) {
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

    // Use server-aggregated stats (counts all products, not just current page)
    const topTypeLabel = stats.topTypes.map(t => `${t.count} ${t.label}`).join(' / ') || 'N/A'

    const applyFilter = useCallback(async (newFilters: Partial<ProductFilters>) => {
        const merged = { ...filters, ...newFilters, page: 1 }
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
                        placeholder="Tìm theo tên hoặc SKU..."
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
                {(search || typeFilter || statusFilter) && (
                    <button onClick={() => {
                        setSearch(''); setTypeFilter(''); setStatusFilter('')
                        applyFilter({ search: undefined, wineType: undefined, status: undefined })
                    }} className="px-3 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.3)' }}>
                        Xóa filter
                    </button>
                )}
            </div>

            <ProductTable
                rows={rows} total={total} loading={loading}
                page={filters.page ?? 1} pageSize={filters.pageSize ?? 20}
                onPageChange={p => applyFilter({ page: p })}
                onEdit={id => { setEditingId(id); setDrawerOpen(true) }}
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
