'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, AlertCircle, Wine } from 'lucide-react'
import { ProductInput, createProduct, updateProduct, getProducers, getRegions } from './actions'

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
    }, [open])

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
        try {
            const input = formToInput(form)
            if (isEdit) {
                await updateProduct(editingId!, input)
            } else {
                await createProduct(input)
            }
            onSaved()
        } catch (err: any) {
            setErrors({ _global: err.message ?? 'Lỗi không xác định' })
        } finally {
            setSaving(false)
        }
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
