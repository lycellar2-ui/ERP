'use client'

import { useState, useRef, useEffect } from 'react'
import { Edit2, ImageOff, Tag, Trash2, Wine } from 'lucide-react'
import { ProductRow, ProductFilters } from './actions'
import { ProductStatusBadge } from './ProductsClient'
import { WineTypeBadge } from '@/components/WineTypeBadge'
import { Button, EmptyState, Pagination, Skeleton, Table, TableMessageRow, TableSkeleton, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useAppLocale } from '@/lib/i18n'
import { PRODUCTS_I18N } from './i18n'

const COL_COUNT = 8

function stockClass(stock: number) {
    if (stock === 0) return 'text-tone-danger-fg'
    if (stock < 12) return 'text-tone-warning-fg'
    return 'text-tone-success-fg'
}

function ProductsEmpty() {
    const { locale } = useAppLocale()
    const L = PRODUCTS_I18N[locale].table
    return <EmptyState icon={Wine} title={L.emptyTitle} description={L.emptyDesc} />
}

interface RowProps {
    row: ProductRow
    onEdit: () => void
    onDelete: () => void
    onView: () => void
    onQuickPrice?: () => void
    onPrefetchDetails?: () => void
    canEdit: boolean
}

function ProductTableRow({ row, onEdit, onDelete, onView, onQuickPrice, onPrefetchDetails, canEdit }: RowProps) {
    const { locale, formatNumber } = useAppLocale()
    const L = PRODUCTS_I18N[locale].table
    const countryCode = row.country ? `[${row.country}]` : ''
    const [isVertical, setIsVertical] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)
    const hasWholesale = row.wholesalePrice != null && row.wholesalePrice > 0
    const hasRetail = row.retailPrice != null && row.retailPrice > 0

    useEffect(() => {
        const img = imgRef.current
        if (!img) return
        const handleLoad = () => setIsVertical(img.naturalHeight > img.naturalWidth * 1.2)
        if (img.complete) {
            handleLoad()
        } else {
            setIsVertical(false)
            img.addEventListener('load', handleLoad)
            return () => img.removeEventListener('load', handleLoad)
        }
    }, [row.primaryImageUrl])

    return (
        <Tr className="group" onClick={onView} onMouseEnter={onPrefetchDetails}>
            {/* Product */}
            <Td className="py-1.5 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <div
                        className="relative group/img w-20 h-11 rounded-md shrink-0 flex items-center justify-center cursor-zoom-in bg-white border border-lys-border"
                        onClick={e => e.stopPropagation()}
                    >
                        {row.primaryImageUrl ? (
                            <>
                                <img
                                    ref={imgRef}
                                    src={row.primaryImageUrl}
                                    alt={row.productName}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={e => {
                                        const img = e.currentTarget
                                        setIsVertical(img.naturalHeight > img.naturalWidth * 1.2)
                                    }}
                                    className="object-contain transition-transform duration-200 group-hover/img:scale-105"
                                    style={isVertical ? {
                                        position: 'absolute',
                                        width: '44px',
                                        height: '80px',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%) rotate(90deg)',
                                    } : {
                                        width: '100%',
                                        height: '100%',
                                        padding: '2px',
                                    }}
                                />
                                {/* Hover preview */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-52 bg-lys-card rounded-lg p-3 border border-lys-border shadow-lg opacity-0 scale-95 pointer-events-none group-hover/img:opacity-100 group-hover/img:scale-100 transition-all duration-200 z-50 flex flex-col items-center gap-2">
                                    <div className="w-full h-64 bg-white rounded-md p-3 flex items-center justify-center border border-lys-border overflow-hidden">
                                        <img src={row.primaryImageUrl} alt={row.productName} loading="lazy" decoding="async" className="h-full object-contain" />
                                    </div>
                                    <div className="text-center w-full min-w-0">
                                        <p className="text-xs font-semibold truncate text-lys-primary">{row.productName}</p>
                                        <p className="text-[11px] mt-0.5 type-number text-lys-muted">{row.skuCode}</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <ImageOff size={16} className="text-lys-dim" aria-hidden />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold truncate max-w-[260px] text-lys-primary" title={row.productName}>
                            {row.productName}
                        </p>
                        <p className="text-[11px] mt-0.5 type-number text-lys-muted">{row.skuCode}</p>
                    </div>
                </div>
            </Td>

            <Td className="whitespace-nowrap"><WineTypeBadge type={row.wineType} /></Td>

            <Td>
                <p className="truncate max-w-[200px] text-lys-secondary" title={row.producerName}>{row.producerName}</p>
                <p className="text-[11px] mt-0.5 text-lys-muted">{countryCode && `${countryCode} `}{row.appellationName ?? row.country}</p>
            </Td>

            <Td className="whitespace-nowrap" onClick={e => { if (canEdit && onQuickPrice) { e.stopPropagation(); onQuickPrice() } }}>
                {hasWholesale || hasRetail ? (
                    <div
                        className={cn('space-y-0.5', canEdit && 'cursor-pointer group/price rounded px-1.5 py-0.5 -mx-1.5 hover:bg-slate-100 transition-colors')}
                        title={canEdit ? L.editPriceTooltip : undefined}
                    >
                        <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-[10px] font-medium text-lys-muted">{L.wholesalePrefix}</span>
                            {hasWholesale ? (
                                <span className="font-semibold type-number text-lys-teal-strong">{formatNumber(row.wholesalePrice!)} ₫</span>
                            ) : (
                                <span className="text-[11px] font-medium text-amber-600">{L.unpricedBadge}</span>
                            )}
                        </div>
                        {hasRetail && (
                            <div className="flex items-center gap-1.5 text-[11px] text-lys-secondary">
                                <span className="text-[10px] text-lys-muted">{L.retailPrefix}</span>
                                <span className="type-number">{formatNumber(row.retailPrice!)} ₫</span>
                            </div>
                        )}
                    </div>
                ) : canEdit && onQuickPrice ? (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onQuickPrice() }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                        style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}
                    >
                        <Tag size={11} />
                        {L.setPriceBtn}
                    </button>
                ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: '#FEF3C7', color: '#B45309' }}>
                        {L.unpricedBadge}
                    </span>
                )}
            </Td>

            <Td align="center" className="type-number text-lys-secondary whitespace-nowrap">
                {row.abvPercent != null ? `${row.abvPercent}°` : '—'}
            </Td>

            <Td align="center" className="whitespace-nowrap">
                <span className={cn('font-semibold type-number', stockClass(row.totalStock))}>{formatNumber(row.totalStock)}</span>
                <span className="text-[11px] ml-1 text-lys-muted">{L.bottlesUnit}</span>
            </Td>

            <Td className="whitespace-nowrap"><ProductStatusBadge status={row.status} /></Td>

            <Td>
                {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity whitespace-nowrap">
                        <Button variant="ghost" size="icon-sm" title={L.editBtn} aria-label={L.editBtn} onClick={e => { e.stopPropagation(); onEdit() }}>
                            <Edit2 size={13} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title={L.deleteBtn} aria-label={L.deleteBtn} className="hover:text-tone-danger-fg hover:bg-tone-danger-bg" onClick={e => { e.stopPropagation(); onDelete() }}>
                            <Trash2 size={13} />
                        </Button>
                    </div>
                )}
            </Td>
        </Tr>
    )
}

function formatLabel(fmt: string) {
    switch (fmt) {
        case 'STANDARD': return '750ml'
        case 'MAGNUM': return 'Magnum (1.5L)'
        case 'JEROBOAM': return 'Jeroboam (3L)'
        case 'METHUSELAH': return 'Methuselah (6L)'
        default: return fmt
    }
}

function ProductMobileCard({ row, onEdit, onDelete, onView, onQuickPrice, onPrefetchDetails, canEdit }: RowProps) {
    const { locale, formatNumber } = useAppLocale()
    const L = PRODUCTS_I18N[locale].table
    const countryCode = row.country ? `[${row.country}]` : ''
    const pkgLabel = row.packagingType === 'OWC' ? L.owcCase : L.cartonCase
    const hasWholesale = row.wholesalePrice != null && row.wholesalePrice > 0

    return (
        <div className="p-3 flex gap-3 items-center cursor-pointer active:bg-lys-subtle" onClick={onView} onTouchStart={onPrefetchDetails}>
            <div className="relative w-10 h-16 rounded-md shrink-0 flex items-center justify-center overflow-hidden bg-white border border-lys-border">
                {row.primaryImageUrl ? (
                    <img src={row.primaryImageUrl} alt={row.productName} loading="lazy" decoding="async" className="h-full object-contain p-0.5" />
                ) : (
                    <ImageOff size={12} className="text-lys-dim" aria-hidden />
                )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h4 className="text-[13px] font-semibold leading-tight truncate text-lys-primary">{row.productName}</h4>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] type-number text-lys-muted">
                    <span className="text-lys-secondary">{row.skuCode}</span>
                    {row.abvPercent != null && <span>{row.abvPercent}°</span>}
                </div>
                <p className="text-[11px] mt-0.5 truncate text-lys-secondary">
                    {countryCode && <span className="mr-1">{countryCode}</span>}
                    {row.producerName}
                    {row.appellationName ? ` • ${row.appellationName}` : ''}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 text-lys-muted">
                    <span>{formatLabel(row.format)}</span>
                    <span>•</span>
                    <span>{row.unitsPerCase} {L.bottlesUnit}/{pkgLabel}</span>
                    {row.classification && (
                        <>
                            <span>•</span>
                            <span className="text-tone-warning-fg font-medium">{row.classification}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-end justify-center gap-1 shrink-0 min-w-[85px]">
                <div className="text-[11px] text-lys-secondary">
                    {L.stockPrefix} <span className={cn('font-semibold text-xs type-number', stockClass(row.totalStock))}>{formatNumber(row.totalStock)}</span>
                </div>
                {hasWholesale ? (
                    <span className="text-[11px] font-semibold type-number text-lys-teal-strong">
                        {formatNumber(row.wholesalePrice!)} ₫
                    </span>
                ) : canEdit && onQuickPrice ? (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onQuickPrice() }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}
                    >
                        <Tag size={10} /> {L.setPriceBtn}
                    </button>
                ) : (
                    <span className="text-[10px] font-medium text-amber-700">{L.unpricedBadge}</span>
                )}
                <WineTypeBadge type={row.wineType} />
                <ProductStatusBadge status={row.status} />
                {canEdit && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <Button variant="secondary" size="icon-sm" aria-label={L.editBtn} onClick={e => { e.stopPropagation(); onEdit() }}>
                            <Edit2 size={12} />
                        </Button>
                        <Button variant="danger-outline" size="icon-sm" aria-label={L.deleteBtn} onClick={e => { e.stopPropagation(); onDelete() }}>
                            <Trash2 size={12} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

interface ProductTableProps {
    rows: ProductRow[]
    total: number
    loading: boolean
    page: number
    pageSize: number
    sortBy?: ProductFilters['sortBy']
    sortDir?: ProductFilters['sortDir']
    onPageChange: (p: number) => void
    onSort: (sortBy: ProductFilters['sortBy']) => void
    onEdit: (id: string) => void
    onDelete: (id: string, name: string) => void
    onView: (id: string) => void
    onQuickPrice?: (row: ProductRow) => void
    onPrefetchDetails?: (id: string) => void
    canEdit?: boolean
    onRefresh: () => void
    onPrefetch?: (page: number) => void
}

export function ProductTable({ rows, total, loading, page, pageSize, sortBy, sortDir, onPageChange, onSort, onEdit, onDelete, onView, onQuickPrice, onPrefetchDetails, canEdit = false, onPrefetch }: ProductTableProps) {
    const { locale } = useAppLocale()
    const L = PRODUCTS_I18N[locale].table
    const refetching = loading && rows.length > 0
    const sortFor = (key: ProductFilters['sortBy']) => (sortBy === key ? sortDir ?? 'asc' : false)

    const rowProps = (row: ProductRow) => ({
        row,
        onEdit: () => onEdit(row.id),
        onDelete: () => onDelete(row.id, row.productName),
        onView: () => onView(row.id),
        onQuickPrice: onQuickPrice ? () => onQuickPrice(row) : undefined,
        onPrefetchDetails: () => onPrefetchDetails?.(row.id),
        canEdit,
    })

    return (
        <div className="flex flex-col gap-3">
            {/* Mobile Card List */}
            <div className={cn('block md:hidden bg-lys-card border border-lys-border rounded-lg divide-y divide-lys-border', refetching && 'opacity-50 pointer-events-none')}>
                {rows.length === 0 && loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-3 flex gap-3">
                            <Skeleton className="w-10 h-16 shrink-0" />
                            <div className="flex-1 space-y-2 py-1">
                                <Skeleton className="h-3.5 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                                <Skeleton className="h-3 w-1/4" />
                            </div>
                        </div>
                    ))
                ) : rows.length === 0 ? (
                    <ProductsEmpty />
                ) : (
                    rows.map(row => <ProductMobileCard key={row.id} {...rowProps(row)} />)
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                        <THead>
                            <tr>
                                <Th className="w-[320px]" sort={sortFor('name')} onSort={() => onSort('name')}>{L.colProduct}</Th>
                                <Th className="w-[90px]">{L.colType}</Th>
                                <Th className="w-[200px]">{L.colProducerRegion}</Th>
                                <Th className="w-[160px]">{L.colPricing}</Th>
                                <Th className="w-[70px]" align="center" sort={sortFor('abv')} onSort={() => onSort('abv')}>{L.colAbv}</Th>
                                <Th className="w-[90px]" align="center">{L.colStock}</Th>
                                <Th className="w-[125px]">{L.colStatus}</Th>
                                <Th className="w-[80px]"><span className="sr-only">{L.colActions}</span></Th>
                            </tr>
                        </THead>
                        <TBody className={cn('transition-opacity duration-200', refetching && 'opacity-50 pointer-events-none')}>
                            {rows.length === 0 && loading ? (
                                <TableMessageRow colSpan={COL_COUNT}><TableSkeleton rows={6} cols={COL_COUNT} /></TableMessageRow>
                            ) : rows.length === 0 ? (
                                <TableMessageRow colSpan={COL_COUNT}><ProductsEmpty /></TableMessageRow>
                            ) : (
                                rows.map(row => <ProductTableRow key={row.id} {...rowProps(row)} />)
                            )}
                        </TBody>
                    </Table>
                </div>

            <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageHover={onPrefetch}
                itemLabel={L.paginationItem}
            />
        </div>
    )
}
