'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, AlertCircle, Wine, UploadCloud, Trash2, Star, Image as ImageIcon, Award, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
    ProductInput, createProduct, updateProduct, getProducers, getRegions,
    getProductMedia, uploadProductMedia, deleteProductMedia, setPrimaryMedia,
    getProductAwards, addProductAward, deleteProductAward,
    type ProductMediaRow, type ProductAwardRow,
} from './actions'

// ── Form field ─────────────────────────────────────
function Field({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>
                {label}{required && <span style={{ color: '#8B1A2E' }}> *</span>}
            </label>
            {children}
            {error && (
                <p className="flex items-center gap-1 text-xs" style={{ color: '#8B1A2E' }}>
                    <AlertCircle size={11} /> {error}
                </p>
            )}
        </div>
    )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 ${className}`}
            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
            {...props}
        />
    )
}

function Select({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 cursor-pointer ${className}`}
            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
            {...props}
        >
            {children}
        </select>
    )
}

// ── Types ──────────────────────────────────────────
interface ProductDrawerProps {
    open: boolean
    editingId: string | null
    onClose: () => void
    onSaved: () => void
}

// Local form state — uses friendly field names that are different from Prisma schema
interface ProductFormState {
    sku?: string          // → skuCode
    name?: string         // → productName
    vintage?: number | null
    abv?: number | null   // → abvPercent
    wineType?: string
    volumeMl?: number
    format?: string
    packagingType?: string
    bottlesPerCase?: number  // → unitsPerCase
    barcodeEan?: string | null
    countryCode?: string | null  // → country
    producerId?: string | null
    regionId?: string | null   // → appellationId
    retailPriceVnd?: number | null
    peakDrinkStart?: number | null
    peakDrinkEnd?: number | null
    classification?: string | null
    tastingNotes?: string | null
    status?: string
}

function formToInput(f: ProductFormState): ProductInput {
    return {
        skuCode: f.sku ?? '',
        productName: f.name ?? '',
        producerId: f.producerId ?? '',
        vintage: f.vintage ?? null,
        appellationId: f.regionId ?? null,
        country: f.countryCode ?? 'FR',
        abvPercent: f.abv ?? null,
        volumeMl: f.volumeMl ?? 750,
        format: (f.format ?? 'STANDARD') as any,
        packagingType: (f.packagingType ?? 'CARTON') as any,
        unitsPerCase: f.bottlesPerCase ?? 12,
        hsCode: '2204211000',
        barcodeEan: f.barcodeEan ?? null,
        wineType: (f.wineType ?? 'RED') as any,
        classification: f.classification ?? null,
        tastingNotes: f.tastingNotes ?? null,
        status: (f.status ?? 'ACTIVE') as any,
    }
}

// ── Drawer ─────────────────────────────────────────
export function ProductDrawer({ open, editingId, onClose, onSaved }: ProductDrawerProps) {
    const isEdit = !!editingId
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [producers, setProducers] = useState<{ id: string; name: string }[]>([])
    const [regions, setRegions] = useState<{ id: string; name: string; country: string }[]>([])

    // Media state
    const [mediaList, setMediaList] = useState<ProductMediaRow[]>([])
    const [uploadingMedia, setUploadingMedia] = useState(false)

    // Awards state
    const [awards, setAwards] = useState<ProductAwardRow[]>([])
    const [showAwardForm, setShowAwardForm] = useState(false)
    const [awardSource, setAwardSource] = useState('Robert Parker')
    const [awardScore, setAwardScore] = useState('')
    const [awardMedal, setAwardMedal] = useState('')
    const [awardVintage, setAwardVintage] = useState('')
    const [awardYear, setAwardYear] = useState('')
    const [savingAward, setSavingAward] = useState(false)

    // AI description state
    const [generatingAI, setGeneratingAI] = useState(false)
    const [aiDescription, setAiDescription] = useState<{ vi: string; en: string } | null>(null)

    const [form, setForm] = useState<ProductFormState>({
        status: 'ACTIVE',
        format: 'STANDARD',
        packagingType: 'CARTON',
        bottlesPerCase: 12,
        volumeMl: 750,
    })

    // Load reference data once
    useEffect(() => {
        if (!open) return
        Promise.all([getProducers(), getRegions()]).then(([p, r]) => {
            setProducers(p)
            setRegions(r)
        })
        if (editingId) {
            getProductMedia(editingId).then(setMediaList)
            getProductAwards(editingId).then(setAwards)
        } else {
            setMediaList([])
            setAwards([])
        }
    }, [open, editingId])

    // Reset form when opening for new
    useEffect(() => {
        if (open && !editingId) {
            setForm({ status: 'ACTIVE', format: 'STANDARD', packagingType: 'CARTON', bottlesPerCase: 12, volumeMl: 750 })
            setErrors({})
        }
    }, [open, editingId])

    const set = (key: keyof ProductFormState, val: any) =>
        setForm(f => ({ ...f, [key]: val }))

    const validate = (): boolean => {
        const e: Record<string, string> = {}
        if (!form.sku?.trim()) e.sku = 'SKU bắt buộc'
        if (!form.name?.trim()) e.name = 'Tên sản phẩm bắt buộc'
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSave = async () => {
        if (!validate()) return
        setSaving(true)

        const input = formToInput(form)
        const savePromise = isEdit ? updateProduct(editingId!, input) : createProduct(input)

        toast.promise(savePromise, {
            loading: isEdit ? 'Đang cập nhật sản phẩm...' : 'Đang tạo sản phẩm...',
            success: () => {
                onSaved()
                return isEdit ? 'Đã cập nhật thành công!' : 'Tạo sản phẩm mới thành công!'
            },
            error: (err: any) => {
                setErrors({ _global: err.message ?? 'Lỗi không xác định' })
                return `Lỗi: ${err.message}`
            },
            finally: () => setSaving(false)
        })
    }

    // Overlay + slide-in animation
    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-300"
                style={{
                    width: 'min(560px, 95vw)',
                    background: '#0D1E2B',
                    borderLeft: '1px solid #2A4355',
                    transform: open ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Wine size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2', fontSize: 18 }}>
                                {isEdit ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Điền thông tin đầy đủ về chai rượu</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Global error */}
                    {errors._global && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                            <AlertCircle size={14} />
                            {errors._global}
                        </div>
                    )}

                    {/* Section: Thông tin cơ bản */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Thông Tin Cơ Bản
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="SKU" required error={errors.sku}>
                                <Input
                                    value={form.sku ?? ''}
                                    onChange={e => set('sku', e.target.value.toUpperCase())}
                                    placeholder="CHATEAU-PETRUS-2018-750"
                                    style={{ fontFamily: '"DM Mono", monospace' }}
                                />
                            </Field>
                            <Field label="Vintage (Năm)">
                                <Input
                                    type="number"
                                    value={form.vintage ?? ''}
                                    onChange={e => set('vintage', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="2018"
                                    min={1800} max={2030}
                                />
                            </Field>
                        </div>

                        <Field label="Tên sản phẩm" required error={errors.name}>
                            <Input
                                value={form.name ?? ''}
                                onChange={e => set('name', e.target.value)}
                                placeholder="Château Pétrus 2018"
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Loại rượu">
                                <Select value={form.wineType ?? ''} onChange={e => set('wineType', e.target.value || null)}>
                                    <option value="">Chọn loại...</option>
                                    <option value="RED">🔴 Vang Đỏ</option>
                                    <option value="WHITE">🟡 Vang Trắng</option>
                                    <option value="ROSE">🌸 Rosé</option>
                                    <option value="SPARKLING">🥂 Sâm panh</option>
                                    <option value="FORTIFIED">🍯 Fortified</option>
                                    <option value="DESSERT">🍰 Dessert</option>
                                </Select>
                            </Field>
                            <Field label="Độ cồn ABV (°)">
                                <Input
                                    type="number"
                                    value={form.abv ?? ''}
                                    onChange={e => set('abv', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="13.5"
                                    step="0.5" min={0} max={100}
                                />
                            </Field>
                        </div>
                    </div>

                    {/* Section: Đóng gói */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Quy Cách Đóng Gói
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                            <Field label="Dung tích (ml)">
                                <Select value={form.volumeMl ?? 750} onChange={e => set('volumeMl', Number(e.target.value))}>
                                    <option value={375}>375 ml (Nửa)  </option>
                                    <option value={750}>750 ml (Chuẩn)</option>
                                    <option value={1500}>1500 ml (Magnum)</option>
                                    <option value={3000}>3000 ml (Double)</option>
                                </Select>
                            </Field>
                            <Field label="Đóng gói">
                                <Select value={form.packagingType ?? 'CARTON'} onChange={e => set('packagingType', e.target.value as any)}>
                                    <option value="CARTON">Carton</option>
                                    <option value="OWC">OWC (Gỗ)</option>
                                </Select>
                            </Field>
                            <Field label="Chai/thùng">
                                <Select value={form.bottlesPerCase ?? 12} onChange={e => set('bottlesPerCase', Number(e.target.value))}>
                                    <option value={1}>1</option>
                                    <option value={3}>3</option>
                                    <option value={6}>6</option>
                                    <option value={12}>12</option>
                                    <option value={24}>24</option>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Barcode EAN-13">
                            <Input
                                value={form.barcodeEan ?? ''}
                                onChange={e => set('barcodeEan', e.target.value || null)}
                                placeholder="3760076009012"
                                style={{ fontFamily: '"DM Mono", monospace' }}
                            />
                        </Field>
                    </div>

                    {/* Section: Xuất xứ */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Xuất Xứ & Nhà Sản Xuất
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Quốc gia">
                                <Select value={form.countryCode ?? ''} onChange={e => set('countryCode', e.target.value || null)}>
                                    <option value="">Chọn quốc gia...</option>
                                    <option value="FR">🇫🇷 Pháp</option>
                                    <option value="IT">🇮🇹 Ý</option>
                                    <option value="ES">🇪🇸 Tây Ban Nha</option>
                                    <option value="PT">🇵🇹 Bồ Đào Nha</option>
                                    <option value="DE">🇩🇪 Đức</option>
                                    <option value="US">🇺🇸 Mỹ</option>
                                    <option value="AU">🇦🇺 Úc</option>
                                    <option value="NZ">🇳🇿 New Zealand</option>
                                    <option value="AR">🇦🇷 Argentina</option>
                                    <option value="CL">🇨🇱 Chile</option>
                                    <option value="ZA">🇿🇦 Nam Phi</option>
                                </Select>
                            </Field>
                            <Field label="Nhà sản xuất">
                                <Select value={form.producerId ?? ''} onChange={e => set('producerId', e.target.value || null)}>
                                    <option value="">— Chọn hoặc nhập thủ công —</option>
                                    {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </Select>
                            </Field>
                        </div>
                        <Field label="Vùng / Appellation">
                            <Select value={form.regionId ?? ''} onChange={e => set('regionId', e.target.value || null)}>
                                <option value="">— Chọn vùng —</option>
                                {regions.map(r => (
                                    <option key={r.id} value={r.id}>
                                        {COUNTRY_FLAGS_MINI[r.country] ?? ''} {r.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    {/* Section: Giá & Trạng thái */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Giá & Trạng Thái
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Giá bán lẻ (VND)">
                                <Input
                                    type="number"
                                    value={form.retailPriceVnd ?? ''}
                                    onChange={e => set('retailPriceVnd', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="5200000"
                                    step={50000}
                                />
                            </Field>
                            <Field label="Trạng thái">
                                <Select value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value as any)}>
                                    <option value="ACTIVE">Đang kinh doanh</option>
                                    <option value="ALLOCATION_ONLY">Allocation Only</option>
                                    <option value="DISCONTINUED">Ngừng kinh doanh</option>
                                </Select>
                            </Field>
                        </div>
                    </div>

                    {/* Section: Drinking window */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Best Drinking Window
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Uống từ năm">
                                <Input
                                    type="number"
                                    value={form.peakDrinkStart ?? ''}
                                    onChange={e => set('peakDrinkStart', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="2025"
                                />
                            </Field>
                            <Field label="Uống đến năm">
                                <Input
                                    type="number"
                                    value={form.peakDrinkEnd ?? ''}
                                    onChange={e => set('peakDrinkEnd', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="2045"
                                />
                            </Field>
                        </div>
                    </div>

                    {/* Section: Tasting Notes + AI */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Tasting Notes
                        </p>
                        <Field label="Ghi chú nếm rượu">
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 resize-y min-h-[80px]"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={form.tastingNotes ?? ''}
                                onChange={e => set('tastingNotes', e.target.value || null)}
                                placeholder="Deep ruby color, notes of blackcurrant, cedar, and vanilla..."
                                rows={3}
                            />
                        </Field>
                        {isEdit && (
                            <>
                                <button
                                    onClick={async () => {
                                        if (!editingId) return
                                        setGeneratingAI(true)
                                        setAiDescription(null)
                                        const { generateProductDescription } = await import('@/lib/ai-service')
                                        const res = await generateProductDescription(editingId)
                                        setGeneratingAI(false)
                                        if (res.success) {
                                            setAiDescription({ vi: res.descriptionVI ?? '', en: res.descriptionEN ?? '' })
                                        } else {
                                            alert(`AI Error: ${res.error} `)
                                        }
                                    }}
                                    disabled={generatingAI}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all w-full justify-center disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                                    {generatingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {generatingAI ? 'AI đang viết mô tả...' : '✨ AI Tạo Mô Tả (Gemini)'}
                                </button>
                                {aiDescription && (
                                    <div className="space-y-3 p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold" style={{ color: '#667eea' }}>🤖 Mô tả AI</span>
                                            <button
                                                onClick={() => { set('tastingNotes', aiDescription.vi); setAiDescription(null) }}
                                                className="text-[10px] px-2 py-1 rounded font-semibold"
                                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                                Áp dụng bản Tiếng Việt
                                            </button>
                                        </div>
                                        <div className="text-xs leading-relaxed" style={{ color: '#8AAEBB' }}>
                                            <p className="font-bold mb-1" style={{ color: '#E8F1F2' }}>🇻🇳 Tiếng Việt:</p>
                                            <p className="whitespace-pre-wrap mb-3">{aiDescription.vi}</p>
                                            <p className="font-bold mb-1" style={{ color: '#E8F1F2' }}>🇬🇧 English:</p>
                                            <p className="whitespace-pre-wrap">{aiDescription.en}</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Section: Hình ảnh sản phẩm (chỉ khi edit) */}
                    {isEdit && (
                        <div className="space-y-4">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                                ── Hình Ảnh Sản Phẩm
                            </p>

                            {/* Upload button */}
                            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-all"
                                style={{ background: '#1B2E3D', border: '2px dashed #2A4355', color: '#4A6A7A' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#87CBB9'; e.currentTarget.style.color = '#87CBB9' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2A4355'; e.currentTarget.style.color = '#4A6A7A' }}>
                                {uploadingMedia
                                    ? <><Loader2 size={16} className="animate-spin" /> Đang upload...</>
                                    : <><UploadCloud size={16} /> Thêm hình ảnh (JPG, PNG, WEBP)</>
                                }
                                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                                    disabled={uploadingMedia}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file || !editingId) return
                                        setUploadingMedia(true)
                                        const fd = new FormData()
                                        fd.append('file', file)
                                        const res = await uploadProductMedia(editingId, fd)
                                        setUploadingMedia(false)
                                        if (res.success && res.media) {
                                            setMediaList(prev => [res.media!, ...prev])
                                        } else {
                                            alert(`Lỗi upload: ${res.error} `)
                                        }
                                        e.target.value = ''
                                    }}
                                />
                            </label>

                            {/* Media grid */}
                            {mediaList.length > 0 ? (
                                <div className="grid grid-cols-3 gap-3">
                                    {mediaList.map(m => (
                                        <div key={m.id} className="relative group rounded-lg overflow-hidden"
                                            style={{ border: m.isPrimary ? '2px solid #87CBB9' : '1px solid #2A4355', aspectRatio: '1' }}>
                                            <img src={m.url} alt="Product" className="w-full h-full object-cover" />

                                            {/* Primary badge */}
                                            {m.isPrimary && (
                                                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                                    style={{ background: 'rgba(135,203,185,0.9)', color: '#0A1926' }}>
                                                    <Star size={8} /> Ảnh chính
                                                </div>
                                            )}

                                            {/* Action overlay */}
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                {!m.isPrimary && (
                                                    <button
                                                        onClick={async () => {
                                                            const res = await setPrimaryMedia(m.id, editingId!)
                                                            if (res.success) {
                                                                setMediaList(prev => prev.map(x => ({ ...x, isPrimary: x.id === m.id })))
                                                            }
                                                        }}
                                                        className="p-2 rounded-lg transition-colors"
                                                        style={{ background: 'rgba(135,203,185,0.2)', color: '#87CBB9' }}
                                                        title="Đặt làm ảnh chính">
                                                        <Star size={14} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Xóa hình này?')) return
                                                        const res = await deleteProductMedia(m.id)
                                                        if (res.success) {
                                                            setMediaList(prev => prev.filter(x => x.id !== m.id))
                                                        }
                                                    }}
                                                    className="p-2 rounded-lg transition-colors"
                                                    style={{ background: 'rgba(139,26,46,0.2)', color: '#E05252' }}
                                                    title="Xóa">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#142433' }}>
                                    <ImageIcon size={24} style={{ color: '#2A4355' }} />
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có hình ảnh nào</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section: Awards & Scores (chỉ khi edit) */}
                    {isEdit && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#D4A853' }}>
                                    ── Giải Thưởng & Điểm Số
                                </p>
                                <button
                                    onClick={() => setShowAwardForm(v => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.25)' }}>
                                    <Plus size={10} /> Thêm
                                </button>
                            </div>

                            {/* Add form */}
                            {showAwardForm && (
                                <div className="p-4 rounded-lg space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Nguồn">
                                            <Select value={awardSource} onChange={e => setAwardSource(e.target.value)}>
                                                <option>Robert Parker</option>
                                                <option>Wine Spectator</option>
                                                <option>Decanter</option>
                                                <option>James Suckling</option>
                                                <option>Jancis Robinson</option>
                                                <option>Vivino</option>
                                            </Select>
                                        </Field>
                                        <Field label="Điểm">
                                            <Input type="number" value={awardScore}
                                                onChange={e => setAwardScore(e.target.value)}
                                                placeholder="95" min={0} max={100} />
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Field label="Huy chương">
                                            <Select value={awardMedal} onChange={e => setAwardMedal(e.target.value)}>
                                                <option value="">— Không —</option>
                                                <option value="DOUBLE_GOLD">🏆 Double Gold</option>
                                                <option value="GOLD">🥇 Gold</option>
                                                <option value="SILVER">🥈 Silver</option>
                                                <option value="BRONZE">🥉 Bronze</option>
                                            </Select>
                                        </Field>
                                        <Field label="Vintage">
                                            <Input type="number" value={awardVintage}
                                                onChange={e => setAwardVintage(e.target.value)}
                                                placeholder="2018" />
                                        </Field>
                                        <Field label="Năm trao">
                                            <Input type="number" value={awardYear}
                                                onChange={e => setAwardYear(e.target.value)}
                                                placeholder="2022" />
                                        </Field>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setShowAwardForm(false)}
                                            className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Hủy</button>
                                        <button
                                            disabled={savingAward || !awardSource}
                                            onClick={async () => {
                                                if (!editingId) return
                                                setSavingAward(true)
                                                toast.promise(addProductAward({
                                                    productId: editingId,
                                                    source: awardSource,
                                                    score: awardScore ? Number(awardScore) : undefined,
                                                    medal: awardMedal || undefined,
                                                    vintage: awardVintage ? Number(awardVintage) : undefined,
                                                    awardedYear: awardYear ? Number(awardYear) : undefined,
                                                }), {
                                                    loading: 'Đang lưu giải thưởng...',
                                                    success: () => {
                                                        getProductAwards(editingId).then(setAwards)
                                                        setShowAwardForm(false)
                                                        setAwardScore(''); setAwardMedal(''); setAwardVintage(''); setAwardYear('')
                                                        return 'Đã lưu giải thưởng'
                                                    },
                                                    error: 'Không thể lưu giải thưởng',
                                                    finally: () => setSavingAward(false)
                                                })
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                                            style={{ background: '#D4A853', color: '#0A1926' }}>
                                            {savingAward ? <Loader2 size={10} className="animate-spin" /> : <Award size={10} />} Lưu
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Awards list */}
                            {awards.length > 0 ? (
                                <div className="space-y-2">
                                    {awards.map(aw => (
                                        <div key={aw.id} className="flex items-center gap-3 p-3 rounded-lg group"
                                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0"
                                                style={{ background: 'rgba(212,168,83,0.12)' }}>
                                                {aw.medalLabel?.charAt(0) ?? '🏅'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold" style={{ color: '#D4A853' }}>{aw.source}</span>
                                                    {aw.score && (
                                                        <span className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                                            {aw.score}/100
                                                        </span>
                                                    )}
                                                    {aw.medalLabel && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#D4A853' }}>
                                                            {aw.medalLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                                    {aw.vintage && `Vintage ${aw.vintage} `}
                                                    {aw.vintage && aw.awardedYear && ' · '}
                                                    {aw.awardedYear && `Năm ${aw.awardedYear} `}
                                                </p>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm('Xóa giải thưởng này?')) return
                                                    await deleteProductAward(aw.id)
                                                    setAwards(prev => prev.filter(a => a.id !== aw.id))
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all"
                                                style={{ color: '#E05252' }}
                                                title="Xóa">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : !showAwardForm && (
                                <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#142433' }}>
                                    <Award size={24} style={{ color: '#2A4355' }} />
                                    <p className="text-xs" style={{ color: '#4A6A7A' }}>Chưa có giải thưởng nào</p>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
                    style={{ borderTop: '1px solid #2A4355' }}>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-lg text-sm transition-colors duration-150"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                        onMouseEnter={e => !saving && (e.currentTarget.style.background = '#A5DED0')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                    </button>
                </div>
            </div>
        </>
    )
}

const COUNTRY_FLAGS_MINI: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
}
