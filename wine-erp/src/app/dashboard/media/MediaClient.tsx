'use client'

import { useState, useCallback, useRef } from 'react'
import {
    Upload, Trash2, Image as ImageIcon, Package, Star,
    X, Loader2, CheckSquare, Square, ExternalLink, LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { compressImage } from '@/lib/compress-image'
import { uploadToImgBBDirect } from '@/lib/imgbb-client'
import {
    MediaItem, MediaStats, MediaFilters,
    getAllMedia, deleteMedia, bulkDeleteMedia,
    uploadMediaToProduct, saveMediaUrl, getProductsForUpload,
} from './actions'
import {
    PageHeader, StatGrid, StatCard, Button, Toolbar, SearchInput,
    Select, Field, Drawer, EmptyState, Badge, Pagination, useConfirmDialog,
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { MEDIA_I18N } from './i18n'

interface MediaClientProps {
    initialItems: MediaItem[]
    initialTotal: number
    stats: MediaStats
}

export function MediaClient({ initialItems, initialTotal, stats }: MediaClientProps) {
    const { locale } = useAppLocale()
    const L = MEDIA_I18N[locale]

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [items, setItems] = useState<MediaItem[]>(initialItems)
    const [total, setTotal] = useState(initialTotal)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [lightbox, setLightbox] = useState<MediaItem | null>(null)
    const [showUpload, setShowUpload] = useState(false)
    const pageSize = 24

    const fetchMedia = useCallback(async (p: number, s: string, t: string) => {
        setLoading(true)
        try {
            const filters: MediaFilters = { page: p, pageSize, search: s || undefined, mediaType: t || undefined }
            const result = await getAllMedia(filters)
            setItems(result.items)
            setTotal(result.total)
        } catch { /* ignore */ }
        setLoading(false)
    }, [])

    const handleSearch = (s?: string) => {
        const q = s !== undefined ? s : search
        setPage(1)
        fetchMedia(1, q, typeFilter)
    }
    const handleTypeFilter = (t: string) => { setTypeFilter(t); setPage(1); fetchMedia(1, search, t) }
    const handlePage = (p: number) => { setPage(p); fetchMedia(p, search, typeFilter) }

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const selectAll = () => {
        if (selected.size === items.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(items.map(i => i.id)))
        }
    }

    const handleDelete = async (id: string) => {
        const ok = await confirm({
            title: L.confirmDelete.singleTitle,
            message: L.confirmDelete.singleMsg,
            confirmLabel: L.confirmDelete.singleConfirm,
            variant: 'danger',
        })
        if (!ok) return
        const res = await deleteMedia(id)
        if (res.success) {
            setItems(prev => prev.filter(i => i.id !== id))
            setTotal(t => t - 1)
            toast.success(L.toast.deletedSingle)
        } else {
            toast.error(res.error ?? L.toast.deleteError)
        }
    }

    const handleBulkDelete = async () => {
        if (selected.size === 0) return
        const ok = await confirm({
            title: L.confirmDelete.bulkTitle,
            message: L.confirmDelete.bulkMsg(selected.size),
            confirmLabel: L.confirmDelete.bulkConfirm(selected.size),
            variant: 'danger',
        })
        if (!ok) return
        const res = await bulkDeleteMedia(Array.from(selected))
        if (res.success) {
            setItems(prev => prev.filter(i => !selected.has(i.id)))
            setTotal(t => t - res.deleted)
            setSelected(new Set())
            toast.success(L.toast.deletedBulk(res.deleted))
        } else {
            toast.error(res.error ?? L.toast.deleteError)
        }
    }

    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description}
                actions={
                    <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
                        <Upload size={14} aria-hidden /> {L.header.uploadBtn}
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard label={L.stats.total} value={stats.total} icon={ImageIcon} tone="brand" />
                <StatCard label={L.stats.withMedia} value={stats.productsWithMedia} icon={Package} tone="success" />
                <StatCard label={L.stats.withoutMedia} value={stats.productsWithoutMedia} icon={Package} tone={stats.productsWithoutMedia > 0 ? 'danger' : undefined} />
                <StatCard label={L.stats.types} value={Object.keys(stats.byType).length} icon={LayoutGrid} tone="info" />
            </StatGrid>

            <Toolbar
                left={
                    items.length > 0 ? (
                        <div className="flex items-center gap-3 text-xs text-lys-muted">
                            <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-lys-teal-strong transition-colors cursor-pointer">
                                {selected.size === items.length ? <CheckSquare size={14} /> : <Square size={14} />}
                                {selected.size === items.length ? L.filters.deselectAll : L.filters.selectAll}
                            </button>
                            {selected.size > 0 && <span>{L.filters.selectedCount(selected.size)}</span>}
                            {selected.size > 0 && (
                                <Button variant="danger" size="sm" onClick={handleBulkDelete}>
                                    <Trash2 size={13} aria-hidden /> {L.filters.bulkDeleteBtn(selected.size)}
                                </Button>
                            )}
                        </div>
                    ) : undefined
                }
                right={
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                        <SearchInput
                            value={search}
                            onChange={e => {
                                const val = e.target.value
                                setSearch(val)
                                if (!val) handleSearch('')
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={L.filters.searchPlaceholder}
                            className="w-full sm:w-72"
                        />
                        <Select
                            value={typeFilter}
                            onChange={e => handleTypeFilter(e.target.value)}
                            className="w-full sm:w-48"
                        >
                            <option value="">{L.filters.allTypes}</option>
                            {Object.entries(L.mediaTypes).map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </Select>
                    </div>
                }
            />

            {/* Media Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 size={24} className="animate-spin text-lys-teal-strong" />
                </div>
            ) : items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.map(item => {
                        const typeLabel = (L.mediaTypes as Record<string, string>)[item.mediaType] ?? item.mediaType
                        return (
                            <div
                                key={item.id}
                                className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all bg-white aspect-square ${
                                    selected.has(item.id) ? 'border-2 border-lys-teal-strong' : 'border border-lys-border'
                                }`}
                            >
                                <img
                                    src={item.thumbnailUrl || item.url}
                                    alt={item.product.productName}
                                    className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105"
                                    onClick={() => setLightbox(item)}
                                />

                                {item.isPrimary && (
                                    <div className="absolute top-2 left-2">
                                        <Badge tone="brand">
                                            <Star size={10} className="mr-1" /> {L.grid.primaryBadge}
                                        </Badge>
                                    </div>
                                )}

                                <div className="absolute top-2 right-2">
                                    <Badge tone="neutral">{typeLabel}</Badge>
                                </div>

                                <button
                                    onClick={e => { e.stopPropagation(); toggleSelect(item.id) }}
                                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-lys-secondary"
                                >
                                    {!item.isPrimary && (selected.has(item.id) ? <CheckSquare size={16} className="text-lys-teal-strong" /> : <Square size={16} />)}
                                </button>

                                <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 border-t border-lys-border">
                                    <p className="text-xs font-semibold truncate text-lys-primary">
                                        {item.product.productName}
                                    </p>
                                    <p className="type-number text-[11px] text-lys-muted">
                                        {item.product.skuCode}
                                    </p>
                                </div>

                                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <div className="pointer-events-auto flex gap-1.5 bg-white/90 p-1.5 rounded-lg border border-lys-border shadow-xs">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={e => { e.stopPropagation(); setLightbox(item) }}
                                            title={L.grid.viewLarge}
                                        >
                                            <ExternalLink size={14} className="text-lys-teal-strong" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                                            title={L.grid.deleteTitle}
                                        >
                                            <Trash2 size={14} className="text-tone-danger-fg" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="rounded-lg bg-white border border-dashed border-lys-border py-16">
                    <EmptyState
                        icon={ImageIcon}
                        title={L.grid.emptyTitle}
                        action={
                            <Button variant="primary" size="sm" onClick={() => setShowUpload(true)}>
                                <Upload size={14} aria-hidden /> {L.grid.uploadFirstBtn}
                            </Button>
                        }
                    />
                </div>
            )}

            <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={handlePage}
            />

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
                    onClick={() => setLightbox(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white p-4 rounded-lg border border-lys-border shadow-lg" onClick={e => e.stopPropagation()}>
                        <img
                            src={lightbox.url}
                            alt={lightbox.product.productName}
                            className="max-w-full max-h-[75vh] rounded-md object-contain mx-auto"
                        />
                        <div className="mt-3 pt-3 border-t border-lys-border flex items-center justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold text-lys-primary">
                                    {lightbox.product.productName}
                                </p>
                                <p className="text-xs mt-0.5 flex items-center gap-1.5 text-lys-muted">
                                    <span className="type-number">{lightbox.product.skuCode}</span>
                                    <span>·</span>
                                    <span>{(L.mediaTypes as Record<string, string>)[lightbox.mediaType] ?? lightbox.mediaType}</span>
                                    {lightbox.isPrimary && (
                                        <Badge tone="brand">
                                            <Star size={10} className="mr-1" /> {L.lightbox.primaryLabel}
                                        </Badge>
                                    )}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={lightbox.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-md border border-lys-border text-lys-teal-strong hover:bg-lys-subtle"
                                >
                                    <ExternalLink size={16} />
                                </a>
                                <Button variant="secondary" size="sm" onClick={() => setLightbox(null)}>
                                    <X size={16} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showUpload && (
                <UploadDrawer
                    open={showUpload}
                    onClose={() => { setShowUpload(false); fetchMedia(page, search, typeFilter) }}
                />
            )}
            {confirmDialog}
        </div>
    )
}

function UploadDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { locale } = useAppLocale()
    const L = MEDIA_I18N[locale]

    const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([])
    const [selectedProduct, setSelectedProduct] = useState('')
    const [mediaType, setMediaType] = useState('PRODUCT_MAIN')
    const [uploading, setUploading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    if (!loaded) {
        getProductsForUpload().then(p => { setProducts(p); setLoaded(true) })
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0 || !selectedProduct) return

        setUploading(true)
        let success = 0
        let failed = 0

        for (const file of Array.from(files)) {
            try {
                const compressed = await compressImage(file)
                const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY
                if (apiKey) {
                    const imgResult = await uploadToImgBBDirect(compressed, apiKey, compressed.name.replace(/\.[^.]+$/, ''))
                    if (imgResult.success && imgResult.url) {
                        const res = await saveMediaUrl(selectedProduct, {
                            url: imgResult.url,
                            thumbUrl: imgResult.thumbUrl,
                            mediumUrl: imgResult.mediumUrl,
                        }, mediaType)
                        if (res.success) success++
                        else failed++
                    } else { failed++ }
                } else {
                    const fd = new FormData()
                    fd.append('file', compressed)
                    const res = await uploadMediaToProduct(selectedProduct, fd, mediaType)
                    if (res.success) success++
                    else failed++
                }
            } catch {
                failed++
            }
        }

        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''

        if (success > 0) toast.success(L.toast.uploadResult(success, failed))
        else toast.error(L.toast.uploadFailed)

        if (success > 0) onClose()
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={L.uploadDrawer.title}
            size="sm"
            footer={
                <Button variant="secondary" onClick={onClose}>{L.uploadDrawer.closeBtn}</Button>
            }
        >
            <div className="space-y-4">
                <Field label={L.uploadDrawer.productLabel} required>
                    {id => (
                        <Select id={id} value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
                            <option value="">{L.uploadDrawer.productPlaceholder}</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                        </Select>
                    )}
                </Field>

                <Field label={L.uploadDrawer.typeLabel}>
                    {id => (
                        <Select id={id} value={mediaType} onChange={e => setMediaType(e.target.value)}>
                            {Object.entries(L.mediaTypes).map(([k, label]) => (
                                <option key={k} value={k}>{label}</option>
                            ))}
                        </Select>
                    )}
                </Field>

                <label
                    className={`flex flex-col items-center justify-center gap-3 py-10 rounded-lg cursor-pointer transition-all bg-white border-2 border-dashed border-lys-border hover:border-lys-teal-strong ${
                        !selectedProduct ? 'opacity-50 pointer-events-none' : ''
                    }`}
                >
                    {uploading ? (
                        <>
                            <Loader2 size={28} className="animate-spin text-lys-teal-strong" />
                            <span className="text-xs text-lys-teal-strong">{L.uploadDrawer.uploadingText}</span>
                        </>
                    ) : (
                        <>
                            <Upload size={28} className="text-lys-muted" />
                            <span className="text-xs font-medium text-lys-secondary">{L.uploadDrawer.dropzoneTitle}</span>
                            <span className="text-[11px] text-lys-muted">{L.uploadDrawer.dropzoneHint}</span>
                        </>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                        disabled={!selectedProduct || uploading}
                    />
                </label>
            </div>
        </Drawer>
    )
}
