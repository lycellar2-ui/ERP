'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, AlertCircle, Wine, UploadCloud, Trash2, Star, Image as ImageIcon, Award, Plus, Sparkles } from 'lucide-react'
import { compressImage } from '@/lib/compress-image'
import { uploadToImgBBDirect } from '@/lib/imgbb-client'
import { toast } from 'sonner'
import {
    ProductInput, createProduct, updateProduct, getProducers, getRegions, getSuppliers,
    getProductMedia, uploadProductMedia, deleteProductMedia, setPrimaryMedia,
    saveProductMediaUrl,
    getProductAwards, addProductAward, deleteProductAward,
    getProductById, createProducerInline, getProductEditDetails,
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
    supplierId?: string | null   // → supplierId
    regionId?: string | null   // → appellationId
    retailPriceVnd?: number | null
    peakDrinkStart?: number | null
    peakDrinkEnd?: number | null
    classification?: string | null
    originDetail?: string | null
    certification?: string | null
    color?: string | null
    aromas?: string | null
    palate?: string | null
    style?: string | null
    servingTemp?: string | null
    foodPairings?: string | null
    bestSuitedFor?: string | null
    grapes?: string | null
    hsCode?: string
    isAllocationEligible?: boolean
    status?: string
}

function formToInput(f: ProductFormState): ProductInput {
    return {
        skuCode: f.sku ?? '',
        productName: f.name ?? '',
        producerId: f.producerId ?? '',
        supplierId: f.supplierId ?? null,
        vintage: f.vintage ?? null,
        appellationId: f.regionId ?? null,
        country: f.countryCode ?? 'FR',
        abvPercent: f.abv ?? null,
        volumeMl: f.volumeMl ?? 750,
        format: (f.format ?? 'STANDARD') as any,
        packagingType: (f.packagingType ?? 'CARTON') as any,
        unitsPerCase: f.bottlesPerCase ?? 12,
        hsCode: f.hsCode ?? '2204211000',
        barcodeEan: f.barcodeEan ?? null,
        wineType: (f.wineType ?? 'RED') as any,
        classification: f.classification ?? null,
        isAllocationEligible: f.isAllocationEligible ?? false,
        status: (f.status ?? 'ACTIVE') as any,
        profile: {
            originDetail: f.originDetail ?? null,
            certification: f.certification ?? null,
            color: f.color ?? null,
            aromas: f.aromas ?? null,
            palate: f.palate ?? null,
            style: f.style ?? null,
            servingTemp: f.servingTemp ?? null,
            foodPairings: f.foodPairings ?? null,
            bestSuitedFor: f.bestSuitedFor ?? null,
            grapes: f.grapes ?? null,
        }
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
    const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])

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
    const [aiProfile, setAiProfile] = useState<any | null>(null)

    // Inline producer creation
    const [showNewProducer, setShowNewProducer] = useState(false)
    const [newProducerName, setNewProducerName] = useState('')
    const [newProducerCountry, setNewProducerCountry] = useState('FR')
    const [creatingProducer, setCreatingProducer] = useState(false)

    const [form, setForm] = useState<ProductFormState>({
        status: 'ACTIVE',
        format: 'STANDARD',
        packagingType: 'CARTON',
        bottlesPerCase: 12,
        volumeMl: 750,
        hsCode: '2204211000',
        isAllocationEligible: false,
    })

    // Load reference data + product data for edit
    useEffect(() => {
        if (!open) return

        // ⚡ Optimization 1: Only fetch reference lists once per page lifecycle, rather than on every single drawer open
        if (producers.length === 0 || regions.length === 0 || suppliers.length === 0) {
            Promise.all([getProducers(), getRegions(), getSuppliers()]).then(([p, r, s]) => {
                setProducers(p)
                setRegions(r)
                setSuppliers(s)
            })
        }

        if (editingId) {
            setLoading(true)
            // ⚡ Optimization 2: Use the new consolidated server action to load everything (Product, Media, Awards) in ONE single network roundtrip!
            getProductEditDetails(editingId).then(details => {
                if (!details) {
                    setLoading(false)
                    return
                }
                
                const { product: data, media, awards: aw } = details
                setMediaList(media)
                setAwards(aw)

                setForm({
                    sku: data.skuCode,
                    name: data.productName,
                    vintage: data.vintage,
                    abv: data.abvPercent,
                    wineType: data.wineType,
                    volumeMl: data.volumeMl,
                    format: data.format,
                    packagingType: data.packagingType,
                    bottlesPerCase: data.unitsPerCase,
                    barcodeEan: data.barcodeEan,
                    countryCode: data.country,
                    producerId: data.producerId,
                    supplierId: data.supplierId,
                    regionId: data.appellationId,
                    classification: data.classification,
                    originDetail: data.profile?.originDetail ?? null,
                    certification: data.profile?.certification ?? null,
                    color: data.profile?.color ?? null,
                    aromas: data.profile?.aromas ?? null,
                    palate: data.profile?.palate ?? null,
                    style: data.profile?.style ?? null,
                    servingTemp: data.profile?.servingTemp ?? null,
                    foodPairings: data.profile?.foodPairings ?? null,
                    bestSuitedFor: data.profile?.bestSuitedFor ?? null,
                    grapes: data.profile?.grapes ?? null,
                    hsCode: data.hsCode,
                    isAllocationEligible: data.isAllocationEligible,
                    status: data.status,
                })
                setLoading(false)
            }).catch(() => {
                setLoading(false)
            })
        } else {
            setMediaList([])
            setAwards([])
        }
    }, [open, editingId, producers.length, regions.length])

    // Reset form when opening for new
    useEffect(() => {
        if (open && !editingId) {
            setForm({ status: 'ACTIVE', format: 'STANDARD', packagingType: 'CARTON', bottlesPerCase: 12, volumeMl: 750, hsCode: '2204211000', isAllocationEligible: false })
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
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-[#0D1E2B]/80 flex flex-col items-center justify-center gap-3 z-30">
                            <Loader2 size={32} className="animate-spin text-[#87CBB9]" />
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Đang tải thông tin sản phẩm...</p>
                        </div>
                    )}

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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                    <option value="GE">🇬🇪 Georgia</option>
                                    <option value="HU">🇭🇺 Hungary</option>
                                    <option value="GR">🇬🇷 Hy Lạp</option>
                                    <option value="AT">🇦🇹 Áo</option>
                                    <option value="RO">🇷🇴 Romania</option>
                                    <option value="MX">🇲🇽 Mexico</option>
                                    <option value="JP">🇯🇵 Nhật Bản</option>
                                </Select>
                            </Field>
                            <Field label="Nhà sản xuất">
                                <div className="flex gap-1.5">
                                    <Select className="flex-1" value={form.producerId ?? ''} onChange={e => set('producerId', e.target.value || null)}>
                                        <option value="">— Chọn nhà SX —</option>
                                        {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </Select>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewProducer(true)}
                                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-colors"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#87CBB9' }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}
                                        title="Tạo nhà SX mới">
                                        +
                                    </button>
                                </div>
                            </Field>
                            <Field label="Nhà cung cấp (NCC)">
                                <Select value={form.supplierId ?? ''} onChange={e => set('supplierId', e.target.value || null)}>
                                    <option value="">— Chọn nhà cung cấp —</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </Select>
                            </Field>
                        </div>

                        {/* Inline producer creation */}
                        {showNewProducer && (
                            <div className="p-3 rounded-lg space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <p className="text-xs font-bold" style={{ color: '#87CBB9' }}>Tạo Nhà SX Mới</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        value={newProducerName}
                                        onChange={e => setNewProducerName(e.target.value)}
                                        placeholder="Tên nhà sản xuất"
                                    />
                                    <Select value={newProducerCountry} onChange={e => setNewProducerCountry(e.target.value)}>
                                        <option value="FR">🇫🇷 Pháp</option>
                                        <option value="IT">🇮🇹 Ý</option>
                                        <option value="ES">🇪🇸 TBN</option>
                                        <option value="US">🇺🇸 Mỹ</option>
                                        <option value="AU">🇦🇺 Úc</option>
                                        <option value="CL">🇨🇱 Chile</option>
                                        <option value="AR">🇦🇷 Argentina</option>
                                    </Select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowNewProducer(false)} className="text-xs px-2 py-1" style={{ color: '#4A6A7A' }}>Hủy</button>
                                    <button
                                        disabled={!newProducerName.trim() || creatingProducer}
                                        onClick={async () => {
                                            setCreatingProducer(true)
                                            try {
                                                const p = await createProducerInline(newProducerName.trim(), newProducerCountry)
                                                setProducers(prev => [...prev, p])
                                                set('producerId', p.id)
                                                setShowNewProducer(false)
                                                setNewProducerName('')
                                                toast.success(`Đã tạo nhà SX "${p.name}"`)
                                            } catch {
                                                toast.error('Không thể tạo nhà SX')
                                            }
                                            setCreatingProducer(false)
                                        }}
                                        className="text-xs px-3 py-1 rounded font-semibold disabled:opacity-50"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                                        {creatingProducer ? 'Đang tạo...' : 'Tạo'}
                                    </button>
                                </div>
                            </div>
                        )}

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

                    {/* Section: HS Code, Giá & Trạng thái */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Giá, Phân Loại & Trạng Thái
                        </p>
                        <Field label="HS Code (Mã thuế hải quan)">
                            <Input
                                value={form.hsCode ?? '2204211000'}
                                onChange={e => set('hsCode', e.target.value)}
                                placeholder="2204211000"
                                style={{ fontFamily: '"DM Mono", monospace' }}
                            />
                        </Field>
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
                        {/* Allocation Eligible checkbox */}
                        <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                            <input
                                type="checkbox"
                                checked={form.isAllocationEligible ?? false}
                                onChange={e => set('isAllocationEligible', e.target.checked)}
                                className="w-4 h-4 rounded accent-emerald-500"
                            />
                            <div>
                                <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>Allocation Eligible</p>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Cho phép phân bổ quota cho SKU này (rượu khan hiếm)</p>
                            </div>
                        </label>
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

                    {/* Section: Đặc tính sản phẩm (Wine Profile) */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Đặc Tính Sản Phẩm (Wine Profile)
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Giống nho (Grapes)">
                                <Input
                                    value={form.grapes ?? ''}
                                    onChange={e => set('grapes', e.target.value || null)}
                                    placeholder="Corvina, Rondinella, Corvinone..."
                                />
                            </Field>
                            <Field label="Nhiệt độ phục vụ">
                                <Input
                                    value={form.servingTemp ?? ''}
                                    onChange={e => set('servingTemp', e.target.value || null)}
                                    placeholder="16°C - 18°C"
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Xuất xứ chi tiết">
                                <Input
                                    value={form.originDetail ?? ''}
                                    onChange={e => set('originDetail', e.target.value || null)}
                                    placeholder="Veneto, Ý"
                                />
                            </Field>
                            <Field label="Chứng chỉ (Certification)">
                                <Input
                                    value={form.certification ?? ''}
                                    onChange={e => set('certification', e.target.value || null)}
                                    placeholder="Sustainable practices / Organic..."
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Màu sắc (Color)">
                                <Input
                                    value={form.color ?? ''}
                                    onChange={e => set('color', e.target.value || null)}
                                    placeholder="Đỏ ruby sẫm màu với ánh tím..."
                                />
                            </Field>
                            <Field label="Phong cách (Style)">
                                <Input
                                    value={form.style ?? ''}
                                    onChange={e => set('style', e.target.value || null)}
                                    placeholder="Khô, đậm đà mạnh mẽ..."
                                />
                            </Field>
                        </div>

                        <Field label="Hương thơm (Aromas / Nose)">
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 resize-y min-h-[60px]"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={form.aromas ?? ''}
                                onChange={e => set('aromas', e.target.value || null)}
                                placeholder="Quả sung khô, mứt anh đào, quả mâm xôi đen, thảo mộc khô..."
                                rows={2}
                            />
                        </Field>

                        <Field label="Vị giác (Palate)">
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 resize-y min-h-[60px]"
                                style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={form.palate ?? ''}
                                onChange={e => set('palate', e.target.value || null)}
                                placeholder="Mềm mượt, đậm đà (full-bodied), tannin mịn màng..."
                                rows={2}
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Món ăn kèm (Food Pairings)">
                                <Input
                                    value={form.foodPairings ?? ''}
                                    onChange={e => set('foodPairings', e.target.value || null)}
                                    placeholder="Thịt bò nướng, cừu quay, phô mai lâu năm..."
                                />
                            </Field>
                            <Field label="Phù hợp với (Best Suited For)">
                                <Input
                                    value={form.bestSuitedFor ?? ''}
                                    onChange={e => set('bestSuitedFor', e.target.value || null)}
                                    placeholder="Những ai say mê dòng vang đỏ Amarone..."
                                />
                            </Field>
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                setGeneratingAI(true)
                                setAiProfile(null)
                                const { generateProductDescription } = await import('@/lib/ai-service')
                                if (editingId) {
                                    const res = await generateProductDescription(editingId)
                                    setGeneratingAI(false)
                                    if (res.success && res.profile) {
                                        setAiProfile(res.profile)
                                    } else {
                                        toast.error(`AI Error: ${res.error} `)
                                    }
                                } else {
                                    // Create mode: generate based on form data
                                    const res = await generateProductDescription(undefined, {
                                        name: form.name ?? '',
                                        wineType: form.wineType ?? '',
                                        vintage: form.vintage ?? undefined,
                                        abv: form.abv ?? undefined,
                                        countryCode: form.countryCode ?? undefined,
                                    })
                                    setGeneratingAI(false)
                                    if (res.success && res.profile) {
                                        setAiProfile(res.profile)
                                    } else {
                                        toast.error(`AI Error: ${res.error} `)
                                    }
                                }
                            }}
                            disabled={generatingAI || (!editingId && !form.name?.trim())}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all w-full justify-center disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                            {generatingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {generatingAI ? 'AI đang phân tích & gợi ý đặc tính...' : '✨ Tự Động Phân Tích Đặc Tính Bằng AI'}
                        </button>
                        {aiProfile && (
                            <div className="space-y-3 p-4 rounded-lg" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold" style={{ color: '#667eea' }}>🤖 Gợi Ý Đặc Tính Từ AI</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (aiProfile.originDetail) set('originDetail', aiProfile.originDetail)
                                            if (aiProfile.certification) set('certification', aiProfile.certification)
                                            if (aiProfile.color) set('color', aiProfile.color)
                                            if (aiProfile.aromas) set('aromas', aiProfile.aromas)
                                            if (aiProfile.palate) set('palate', aiProfile.palate)
                                            if (aiProfile.style) set('style', aiProfile.style)
                                            if (aiProfile.servingTemp) set('servingTemp', aiProfile.servingTemp)
                                            if (aiProfile.foodPairings) set('foodPairings', aiProfile.foodPairings)
                                            if (aiProfile.bestSuitedFor) set('bestSuitedFor', aiProfile.bestSuitedFor)
                                            if (aiProfile.grapes) set('grapes', aiProfile.grapes)
                                            setAiProfile(null)
                                            toast.success('Đã áp dụng các đặc tính AI gợi ý!')
                                        }}
                                        className="text-[10px] px-2.5 py-1.5 rounded font-bold"
                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9' }}>
                                        Áp dụng tất cả đặc tính
                                    </button>
                                </div>
                                <div className="text-xs leading-relaxed space-y-1.5" style={{ color: '#8AAEBB' }}>
                                    <p><strong>Xuất xứ:</strong> {aiProfile.originDetail}</p>
                                    <p><strong>Giống nho:</strong> {aiProfile.grapes}</p>
                                    <p><strong>Chứng chỉ:</strong> {aiProfile.certification}</p>
                                    <p><strong>Màu sắc:</strong> {aiProfile.color}</p>
                                    <p><strong>Hương thơm:</strong> {aiProfile.aromas}</p>
                                    <p><strong>Vị giác:</strong> {aiProfile.palate}</p>
                                    <p><strong>Phong cách:</strong> {aiProfile.style}</p>
                                    <p><strong>Món ăn kèm:</strong> {aiProfile.foodPairings}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section: Hình ảnh sản phẩm */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>
                            ── Hình Ảnh Sản Phẩm
                        </p>

                        {isEdit ? (
                            <>
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
                                            try {
                                                const compressed = await compressImage(file)
                                                if (compressed !== file) {
                                                    const savedPct = Math.round((1 - compressed.size / file.size) * 100)
                                                    if (savedPct > 5) toast.info(`Ảnh đã nén: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB (-${savedPct}%)`)
                                                }

                                                // Direct upload: Browser → ImgBB (bypass Vercel)
                                                const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY
                                                if (apiKey) {
                                                    const imgResult = await uploadToImgBBDirect(compressed, apiKey, compressed.name.replace(/\.[^.]+$/, ''))
                                                    if (!imgResult.success || !imgResult.url) {
                                                        toast.error(`Lỗi upload ImgBB: ${imgResult.error}`)
                                                        return
                                                    }
                                                    const res = await saveProductMediaUrl(editingId, {
                                                        url: imgResult.url,
                                                        thumbUrl: imgResult.thumbUrl,
                                                        mediumUrl: imgResult.mediumUrl,
                                                    })
                                                    if (res.success && res.media) {
                                                        setMediaList(prev => [res.media!, ...prev])
                                                        toast.success('Upload ảnh thành công!')
                                                    } else {
                                                        toast.error(`Lỗi lưu ảnh: ${res.error}`)
                                                    }
                                                } else {
                                                    // Fallback: upload through server action
                                                    const fd = new FormData()
                                                    fd.append('file', compressed)
                                                    const res = await uploadProductMedia(editingId, fd)
                                                    if (res.success && res.media) {
                                                        setMediaList(prev => [res.media!, ...prev])
                                                        toast.success('Upload ảnh thành công!')
                                                    } else {
                                                        toast.error(`Lỗi upload: ${res.error}`)
                                                    }
                                                }
                                            } catch (err: any) {
                                                toast.error(`Lỗi upload: ${err.message ?? err}`)
                                            } finally {
                                                setUploadingMedia(false)
                                                e.target.value = ''
                                            }
                                        }}
                                    />
                                </label>

                                {/* Media grid */}
                                {mediaList.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-3">
                                        {mediaList.map(m => (
                                            <div key={m.id} className="relative group rounded-lg overflow-hidden"
                                                style={{ border: m.isPrimary ? '2px solid #87CBB9' : '1px solid #2A4355', aspectRatio: '3/4', background: '#142433' }}>
                                                <img src={m.url} alt="Product" className="w-full h-full object-contain p-1" />

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
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                <UploadCloud size={24} style={{ color: '#2A4355' }} />
                                <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                                    Lưu sản phẩm trước, sau đó mở chỉnh sửa để thêm hình ảnh
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Section: Awards & Scores */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#D4A853' }}>
                                ── Giải Thưởng & Điểm Số
                            </p>
                            {isEdit && (
                                <button
                                    onClick={() => setShowAwardForm(v => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                                    style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.25)' }}>
                                    <Plus size={10} /> Thêm
                                </button>
                            )}
                        </div>

                        {isEdit ? (
                            <>
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
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#142433', border: '1px dashed #2A4355' }}>
                                <Award size={24} style={{ color: '#2A4355' }} />
                                <p className="text-xs text-center" style={{ color: '#4A6A7A' }}>
                                    Lưu sản phẩm trước, sau đó mở chỉnh sửa để thêm giải thưởng
                                </p>
                            </div>
                        )}
                    </div>

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
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}
