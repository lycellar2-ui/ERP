'use client'

import { useState, useRef, useEffect } from 'react'
import { Edit2, ImageOff, Trash2, Wine } from 'lucide-react'
import { ProductRow, ProductFilters } from './actions'
import { ProductStatusBadge } from './ProductsClient'
import { WineTypeBadge } from '@/components/WineTypeBadge'
import { Button, EmptyState, Pagination, Skeleton, Table, TableMessageRow, TableSkeleton, TBody, Td, Th, THead, Tr } from '@/components/ui'
import { cn } from '@/lib/utils'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}

const COL_COUNT = 7

function stockClass(stock: number) {
    if (stock === 0) return 'text-tone-danger-fg'
    if (stock < 12) return 'text-tone-warning-fg'
    return 'text-tone-success-fg'
}

function ProductsEmpty() {
    return <EmptyState icon={Wine} title="Chưa có sản phẩm nào" description='Bấm "Thêm Sản Phẩm" để bắt đầu danh mục' />
}

interface RowProps {
    row: ProductRow
    onEdit: () => void
    onDelete: () => void
    onView: () => void
    onPrefetchDetails?: () => void
    canEdit: boolean
}

function ProductTableRow({ row, onEdit, onDelete, onView, onPrefetchDetails, canEdit }: RowProps) {
    const flag = COUNTRY_FLAGS[row.country] ?? '🌍'
    const [isVertical, setIsVertical] = useState(false)
    const imgRef = useRef<HTMLImageElement>(null)

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
                <p className="text-[11px] mt-0.5 text-lys-muted">{flag} {row.appellationName ?? row.country}</p>
            </Td>

            <Td align="center" className="type-number text-lys-secondary whitespace-nowrap">
                {row.abvPercent != null ? `${row.abvPercent}°` : '—'}
            </Td>

            <Td align="center" className="whitespace-nowrap">
                <span className={cn('font-semibold type-number', stockClass(row.totalStock))}>{row.totalStock}</span>
                <span className="text-[11px] ml-1 text-lys-muted">chai</span>
            </Td>

            <Td className="whitespace-nowrap"><ProductStatusBadge status={row.status} /></Td>

            <Td>
                {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity whitespace-nowrap">
                        <Button variant="ghost" size="icon-sm" title="Chỉnh sửa" aria-label="Chỉnh sửa" onClick={e => { e.stopPropagation(); onEdit() }}>
                            <Edit2 size={13} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Xóa" aria-label="Xóa" className="hover:text-tone-danger-fg hover:bg-tone-danger-bg" onClick={e => { e.stopPropagation(); onDelete() }}>
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

function ProductMobileCard({ row, onEdit, onDelete, onView, onPrefetchDetails, canEdit }: RowProps) {
    const flag = COUNTRY_FLAGS[row.country] ?? '🌍'
    const pkgLabel = row.packagingType === 'OWC' ? 'Thùng gỗ' : 'Carton'

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
                    <span className="mr-1">{flag}</span>
                    {row.producerName}
                    {row.appellationName ? ` • ${row.appellationName}` : ''}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 text-lys-muted">
                    <span>{formatLabel(row.format)}</span>
                    <span>•</span>
                    <span>{row.unitsPerCase} chai/{pkgLabel}</span>
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
                    Tồn: <span className={cn('font-semibold text-xs type-number', stockClass(row.totalStock))}>{row.totalStock}</span>
                </div>
                <WineTypeBadge type={row.wineType} />
                <ProductStatusBadge status={row.status} />
                {canEdit && (
                    <div className="flex items-center gap-1 mt-0.5">
                        <Button variant="secondary" size="icon-sm" aria-label="Sửa" onClick={e => { e.stopPropagation(); onEdit() }}>
                            <Edit2 size={12} />
                        </Button>
                        <Button variant="danger-outline" size="icon-sm" aria-label="Xóa" onClick={e => { e.stopPropagation(); onDelete() }}>
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
    onPrefetchDetails?: (id: string) => void
    canEdit?: boolean
    onRefresh: () => void
    onPrefetch?: (page: number) => void
}

export function ProductTable({ rows, total, loading, page, pageSize, sortBy, sortDir, onPageChange, onSort, onEdit, onDelete, onView, onPrefetchDetails, canEdit = false, onPrefetch }: ProductTableProps) {
    const [isMobile, setIsMobile] = useState<boolean | null>(null)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const showMobile = isMobile === null ? true : isMobile
    const showDesktop = isMobile === null ? true : !isMobile
    const refetching = loading && rows.length > 0
    const sortFor = (key: ProductFilters['sortBy']) => (sortBy === key ? sortDir ?? 'asc' : false)

    const rowProps = (row: ProductRow) => ({
        row,
        onEdit: () => onEdit(row.id),
        onDelete: () => onDelete(row.id, row.productName),
        onView: () => onView(row.id),
        onPrefetchDetails: () => onPrefetchDetails?.(row.id),
        canEdit,
    })

    return (
        <div className="flex flex-col gap-3">
            {showMobile && (
                <div className={cn('md:hidden bg-lys-card border border-lys-border rounded-lg divide-y divide-lys-border', refetching && 'opacity-50 pointer-events-none')}>
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
            )}

            {showDesktop && (
                <div className="hidden md:block">
                    <Table>
                        <THead>
                            <tr>
                                <Th className="w-[340px]" sort={sortFor('name')} onSort={() => onSort('name')}>Sản phẩm</Th>
                                <Th className="w-[90px]">Loại</Th>
                                <Th className="w-[220px]">Nhà SX / Vùng</Th>
                                <Th className="w-[70px]" align="center" sort={sortFor('abv')} onSort={() => onSort('abv')}>ABV</Th>
                                <Th className="w-[90px]" align="center">Tồn kho</Th>
                                <Th className="w-[125px]">Trạng thái</Th>
                                <Th className="w-[80px]"><span className="sr-only">Thao tác</span></Th>
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
            )}

            <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={onPageChange}
                onPageHover={onPrefetch}
                itemLabel="sản phẩm"
            />
        </div>
    )
}
