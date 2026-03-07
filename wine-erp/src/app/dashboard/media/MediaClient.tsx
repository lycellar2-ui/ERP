'use client'

import { useState, useCallback, useRef } from 'react'
import {
    Search, Upload, Trash2, Image as ImageIcon, Package, Star,
    X, Loader2, CheckSquare, Square, Filter, ExternalLink, LayoutGrid
} from 'lucide-react'
import { toast } from 'sonner'
import {
    MediaItem, MediaStats, MediaFilters,
    getAllMedia, deleteMedia, bulkDeleteMedia,
    uploadMediaToProduct, getProductsForUpload
} from './actions'

const MEDIA_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
    PRODUCT_MAIN: { label: 'Ảnh chính', emoji: '🍷' },
    LABEL_FRONT: { label: 'Nhãn trước', emoji: '🏷️' },
    LABEL_BACK: { label: 'Nhãn sau', emoji: '🔖' },
    LIFESTYLE: { label: 'Lifestyle', emoji: '📸' },
    BOTTLE_GROUP: { label: 'Nhóm chai', emoji: '🍾' },
    CASE_OWC: { label: 'Hộp gỗ', emoji: '📦' },
    AWARD_CERTIFICATE: { label: 'Chứng nhận', emoji: '🏆' },
    PRODUCER_WINERY: { label: 'Nhà máy', emoji: '🏰' },
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

interface MediaClientProps {
    initialItems: MediaItem[]
    initialTotal: number
    stats: MediaStats
}

export function MediaClient({ initialItems, initialTotal, stats }: MediaClientProps) {
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

    const handleSearch = () => { setPage(1); fetchMedia(1, search, typeFilter) }
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
        if (!confirm('Xóa ảnh này?')) return
        const res = await deleteMedia(id)
        if (res.success) {
            setItems(prev => prev.filter(i => i.id !== id))
            setTotal(t => t - 1)
            toast.success('Đã xóa ảnh')
        } else {
            toast.error(res.error ?? 'Lỗi xóa')
        }
    }

    const handleBulkDelete = async () => {
        if (selected.size === 0) return
        if (!confirm(`Xóa ${selected.size} ảnh đã chọn?`)) return
        const res = await bulkDeleteMedia(Array.from(selected))
        if (res.success) {
            setItems(prev => prev.filter(i => !selected.has(i.id)))
            setTotal(t => t - res.deleted)
            setSelected(new Set())
            toast.success(`Đã xóa ${res.deleted} ảnh`)
        } else {
            toast.error(res.error ?? 'Lỗi xóa')
        }
    }

    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Thư Viện Ảnh
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#4A6A7A' }}>
                        Quản lý tất cả hình ảnh sản phẩm — Marketing Module
                    </p>
                </div>
                <button onClick={() => setShowUpload(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    <Upload size={16} /> Upload ảnh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard label="Tổng ảnh" value={stats.total} icon={ImageIcon} accent="#87CBB9" />
                <StatCard label="SP có ảnh" value={stats.productsWithMedia} icon={Package} accent="#5BA88A" />
                <StatCard label="SP chưa có ảnh" value={stats.productsWithoutMedia} icon={Package} accent="#E05252" />
                <StatCard label="Loại ảnh" value={Object.keys(stats.byType).length} icon={LayoutGrid} accent="#D4A853" />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[250px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Tìm theo tên SP hoặc SKU..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    />
                </div>

                <select value={typeFilter} onChange={e => handleTypeFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                    <option value="">Tất cả loại</option>
                    {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                </select>

                {selected.size > 0 && (
                    <button onClick={handleBulkDelete}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                        style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.3)', color: '#E05252' }}>
                        <Trash2 size={14} /> Xóa {selected.size} ảnh
                    </button>
                )}

                <span className="text-xs ml-auto" style={{ color: '#4A6A7A' }}>
                    {total} ảnh · Trang {page}/{totalPages || 1}
                </span>
            </div>

            {/* Select all bar */}
            {items.length > 0 && (
                <div className="flex items-center gap-3 text-xs" style={{ color: '#4A6A7A' }}>
                    <button onClick={selectAll} className="flex items-center gap-1.5 hover:text-[#87CBB9] transition-colors">
                        {selected.size === items.length ? <CheckSquare size={14} /> : <Square size={14} />}
                        {selected.size === items.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                    {selected.size > 0 && <span>Đã chọn {selected.size}</span>}
                </div>
            )}

            {/* Media Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                </div>
            ) : items.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {items.map(item => (
                        <div key={item.id}
                            className="group relative rounded-xl overflow-hidden cursor-pointer transition-all"
                            style={{
                                border: selected.has(item.id) ? '2px solid #87CBB9' : '1px solid #2A4355',
                                background: '#1B2E3D',
                                aspectRatio: '1',
                            }}>
                            <img src={item.thumbnailUrl || item.url} alt={item.product.productName}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onClick={() => setLightbox(item)} />

                            {/* Primary badge */}
                            {item.isPrimary && (
                                <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                    style={{ background: 'rgba(135,203,185,0.9)', color: '#0A1926' }}>
                                    <Star size={8} /> Chính
                                </div>
                            )}

                            {/* Type badge */}
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                                style={{ background: 'rgba(10,25,38,0.8)', color: '#8AAEBB' }}>
                                {MEDIA_TYPE_LABELS[item.mediaType]?.emoji ?? '📸'}
                            </div>

                            {/* Select checkbox */}
                            <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                                className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: selected.has(item.id) ? '#87CBB9' : '#8AAEBB' }}>
                                {!item.isPrimary && (selected.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />)}
                            </button>

                            {/* Product name overlay */}
                            <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: 'linear-gradient(transparent, rgba(10,25,38,0.9))' }}>
                                <p className="text-[10px] font-semibold truncate" style={{ color: '#E8F1F2' }}>
                                    {item.product.productName}
                                </p>
                                <p className="text-[9px]" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                    {item.product.skuCode}
                                </p>
                            </div>

                            {/* Action overlay */}
                            <div className="absolute inset-0 flex items-center justify-center gap-2
                                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="pointer-events-auto flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); setLightbox(item) }}
                                        className="p-2 rounded-lg" title="Xem lớn"
                                        style={{ background: 'rgba(135,203,185,0.2)', color: '#87CBB9' }}>
                                        <ExternalLink size={14} />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                                        className="p-2 rounded-lg" title="Xóa"
                                        style={{ background: 'rgba(139,26,46,0.2)', color: '#E05252' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center gap-3 py-16 rounded-xl"
                    style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                    <ImageIcon size={48} style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có hình ảnh nào</p>
                    <button onClick={() => setShowUpload(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold mt-2"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        <Upload size={14} /> Upload ảnh đầu tiên
                    </button>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                        Math.max(0, page - 3), Math.min(totalPages, page + 2)
                    ).map(p => (
                        <button key={p} onClick={() => handlePage(p)}
                            className="w-8 h-8 rounded-lg text-xs font-bold transition-all"
                            style={{
                                background: p === page ? '#87CBB9' : '#1B2E3D',
                                color: p === page ? '#0A1926' : '#4A6A7A',
                                border: `1px solid ${p === page ? '#87CBB9' : '#2A4355'}`,
                            }}>
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightbox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(10,5,2,0.9)' }}
                    onClick={() => setLightbox(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={e => e.stopPropagation()}>
                        <img src={lightbox.url} alt={lightbox.product.productName}
                            className="max-w-full max-h-[80vh] rounded-xl object-contain" />
                        <div className="mt-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                    {lightbox.product.productName}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>
                                    {lightbox.product.skuCode} · {MEDIA_TYPE_LABELS[lightbox.mediaType]?.label ?? lightbox.mediaType}
                                    {lightbox.isPrimary && ' · ⭐ Ảnh chính'}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <a href={lightbox.url} target="_blank" rel="noopener noreferrer"
                                    className="p-2 rounded-lg" style={{ background: 'rgba(135,203,185,0.2)', color: '#87CBB9' }}>
                                    <ExternalLink size={16} />
                                </a>
                                <button onClick={() => setLightbox(null)}
                                    className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)', color: '#E8F1F2' }}>
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && <UploadModal onClose={() => { setShowUpload(false); fetchMedia(page, search, typeFilter) }} />}
        </div>
    )
}

// ─── Upload Modal ─────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
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
            const fd = new FormData()
            fd.append('file', file)
            const res = await uploadMediaToProduct(selectedProduct, fd, mediaType)
            if (res.success) success++
            else failed++
        }

        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''

        if (success > 0) toast.success(`Đã upload ${success} ảnh` + (failed > 0 ? `, ${failed} thất bại` : ''))
        else toast.error('Upload thất bại')

        if (success > 0) onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(10,5,2,0.8)' }} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
                style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                        Upload Ảnh Sản Phẩm
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#4A6A7A' }}>
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5"
                            style={{ color: '#4A6A7A' }}>Sản phẩm *</label>
                        <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="">— Chọn sản phẩm —</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5"
                            style={{ color: '#4A6A7A' }}>Loại ảnh</label>
                        <select value={mediaType} onChange={e => setMediaType(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            {Object.entries(MEDIA_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v.emoji} {v.label}</option>
                            ))}
                        </select>
                    </div>

                    <label className={`flex flex-col items-center justify-center gap-3 py-8 rounded-xl cursor-pointer transition-all
                        ${!selectedProduct ? 'opacity-50 pointer-events-none' : ''}`}
                        style={{ background: '#1B2E3D', border: '2px dashed #2A4355' }}>
                        {uploading ? (
                            <><Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
                                <span className="text-xs" style={{ color: '#87CBB9' }}>Đang upload...</span></>
                        ) : (
                            <><Upload size={28} style={{ color: '#4A6A7A' }} />
                                <span className="text-xs" style={{ color: '#4A6A7A' }}>Click hoặc kéo thả ảnh vào đây</span>
                                <span className="text-[10px]" style={{ color: '#2A4355' }}>Hỗ trợ nhiều file · JPG, PNG, WebP · Max 10MB</span></>
                        )}
                        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
                            multiple className="hidden" onChange={handleUpload} disabled={!selectedProduct || uploading} />
                    </label>
                </div>
            </div>
        </div>
    )
}
