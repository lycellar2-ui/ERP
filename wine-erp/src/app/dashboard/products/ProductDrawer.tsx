'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader2, AlertCircle, Wine, UploadCloud, Trash2, Star, Image as ImageIcon, Award, Plus, FileText, ExternalLink, Paperclip, CheckCircle2, Eye, Download } from 'lucide-react'
import { Button, Drawer, useConfirmDialog } from '@/components/ui'
import { compressImage } from '@/lib/compress-image'
import { uploadProductAsset } from '@/lib/storage-r2'
import { toast } from 'sonner'
import {
    ProductInput, createProduct, updateProduct, getProducers, getAppellations, getSuppliers,
    getProductMedia, uploadProductMedia, deleteProductMedia, setPrimaryMedia,
    saveProductMediaUrl, uploadProductTastingNote, deleteProductTastingNote,
    getProductAwards, addProductAward, deleteProductAward,
    getProductById, createProducerInline, getProductEditDetails,
    type ProductMediaRow, type ProductAwardRow, type ProductRow,
} from './actions'
import { useAppLocale } from '@/lib/i18n'
import { PRODUCTS_I18N } from './i18n'

// ── Form field ─────────────────────────────────────
function Field({ label, required, error, children }: {
    label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>
                {label}{required && <span style={{ color: '#B91C1C' }}> *</span>}
            </label>
            {children}
            {error && (
                <p className="flex items-center gap-1 text-xs" style={{ color: '#B91C1C' }}>
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
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
            {...props}
        />
    )
}

function Select({ children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={`w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 cursor-pointer ${className}`}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
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
    initialData?: ProductRow | null
    onClose: () => void
    onSaved: () => void
}

// Local form state — uses friendly field names that are different from Prisma schema
interface ProductFormState {
    sku?: string          // → skuCode
    name?: string         // → productName
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
    vatRate?: number
    selfDeclarationUrl?: string | null
    tastingNoteUrl?: string | null
}

function formToInput(f: ProductFormState): ProductInput {
    return {
        skuCode: f.sku ?? '',
        productName: f.name ?? '',
        producerId: f.producerId ?? '',
        supplierId: f.supplierId ?? null,
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
        vatRate: f.vatRate ?? 10,
        selfDeclarationUrl: f.selfDeclarationUrl ?? null,
        tastingNoteUrl: f.tastingNoteUrl ?? null,
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
export function ProductDrawer({ open, editingId, initialData, onClose, onSaved }: ProductDrawerProps) {
    const { locale } = useAppLocale()
    const L = PRODUCTS_I18N[locale]
    const D = L.drawer
    const isEdit = !!editingId
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [producers, setProducers] = useState<{ id: string; name: string }[]>([])
    const [appellations, setAppellations] = useState<{ id: string; name: string; regionId: string; region?: { country: string; name: string } | null }[]>([])
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


    // Inline producer creation
    const [showNewProducer, setShowNewProducer] = useState(false)
    const [newProducerName, setNewProducerName] = useState('')
    const [newProducerCountry, setNewProducerCountry] = useState('FR')
    const [creatingProducer, setCreatingProducer] = useState(false)
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null)

    const [form, setForm] = useState<ProductFormState>({
        status: 'ACTIVE',
        format: 'STANDARD',
        packagingType: 'CARTON',
        bottlesPerCase: 12,
        volumeMl: 750,
        hsCode: '2204211000',
        isAllocationEligible: false,
    })

    // Reset/Initialize form state immediately when open state changes
    useEffect(() => {
        if (!open) return

        setErrors({})
        setMediaList([])
        setAwards([])

        if (editingId && initialData) {
            // Populate form immediately with data we already have on the client (0ms lag!)
            setForm({
                sku: initialData.skuCode,
                name: initialData.productName,
                abv: initialData.abvPercent,
                wineType: initialData.wineType,
                volumeMl: initialData.volumeMl ?? 750,
                format: initialData.format,
                packagingType: initialData.packagingType,
                bottlesPerCase: initialData.unitsPerCase,
                countryCode: initialData.country,
                producerId: null,
                supplierId: null,
                regionId: null,
                classification: initialData.classification ?? null,
                status: initialData.status,
                vatRate: (initialData as any).vatRate ?? 10,
                selfDeclarationUrl: initialData.selfDeclarationUrl ?? null,
                tastingNoteUrl: initialData.tastingNoteUrl ?? null,
            })
        } else if (!editingId) {
            // New product mode
            setForm({
                status: 'ACTIVE',
                format: 'STANDARD',
                packagingType: 'CARTON',
                bottlesPerCase: 12,
                volumeMl: 750,
                vatRate: 10,
            })
        }
    }, [open, editingId, initialData])

    // Load reference data once per drawer lifecycle
    useEffect(() => {
        if (!open) return

        if (producers.length === 0 || appellations.length === 0 || suppliers.length === 0) {
            Promise.all([getProducers(), getAppellations(), getSuppliers()]).then(([p, a, s]) => {
                setProducers(p)
                setAppellations(a as any)
                setSuppliers(s)
            })
        }
    }, [open, producers.length, appellations.length, suppliers.length])

    // Fetch full product edit details in background
    useEffect(() => {
        if (!open || !editingId) return

        // Only show spinner if we don't have initialData to display
        if (!initialData) {
            setLoading(true)
        }

        getProductEditDetails(editingId).then(details => {
            if (!details) {
                setLoading(false)
                return
            }
            
            const { product: data, media, awards: aw } = details
            setMediaList(media)
            setAwards(aw)

            setForm(f => ({
                ...f,
                sku: data.skuCode,
                name: data.productName,
                abv: data.abvPercent,
                wineType: data.wineType,
                volumeMl: data.volumeMl,
                format: data.format,
                packagingType: data.packagingType,
                bottlesPerCase: data.unitsPerCase,
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
                status: data.status,
                vatRate: data.vatRate ? Number(data.vatRate) : 10,
                selfDeclarationUrl: (data as any).selfDeclarationUrl ?? f.selfDeclarationUrl ?? initialData?.selfDeclarationUrl ?? null,
                tastingNoteUrl: (data as any).tastingNoteUrl ?? f.tastingNoteUrl ?? initialData?.tastingNoteUrl ?? null,
            }))
            setLoading(false)
        }).catch(() => {
            setLoading(false)
        })
    }, [open, editingId, initialData])

    const set = (key: keyof ProductFormState, val: any) =>
        setForm(f => ({ ...f, [key]: val }))

    const [uploadingTastingNote, setUploadingTastingNote] = useState(false)
    const [uploadingSelfDecl, setUploadingSelfDecl] = useState(false)

    const handleUploadTastingNote = async (file: File) => {
        if (!file) return
        setUploadingTastingNote(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            if (editingId) {
                const res = await uploadProductTastingNote(editingId, fd)
                if (res.success && res.url) {
                    set('tastingNoteUrl', res.url)
                    toast.success(D.toastUploadTnSuccess)
                } else {
                    toast.error(res.error || D.toastUploadTnError)
                }
            } else {
                const res = await uploadProductAsset(fd, 'tasting-notes')
                if (res.success && res.url) {
                    set('tastingNoteUrl', res.url)
                    toast.success(D.toastUploadTnSuccess)
                } else {
                    toast.error(res.error || D.toastUploadTnError)
                }
            }
        } catch (err: any) {
            toast.error(`Error: ${err.message}`)
        } finally {
            setUploadingTastingNote(false)
        }
    }

    const handleDeleteTastingNote = async () => {
        if (!form.tastingNoteUrl) return
        if (editingId) {
            const res = await deleteProductTastingNote(editingId)
            if (res.success) {
                set('tastingNoteUrl', null)
                toast.success(D.toastDeleteTnSuccess)
            } else {
                toast.error(res.error || D.toastDeleteTnError)
            }
        } else {
            set('tastingNoteUrl', null)
        }
    }

    const handleUploadSelfDecl = async (file: File) => {
        if (!file) return
        setUploadingSelfDecl(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await uploadProductAsset(fd, 'documents')
            if (res.success && res.url) {
                set('selfDeclarationUrl', res.url)
                toast.success(D.toastUploadTcbSuccess)
            } else {
                toast.error(res.error || D.toastUploadTcbError)
            }
        } catch (err: any) {
            toast.error(`Error: ${err.message}`)
        } finally {
            setUploadingSelfDecl(false)
        }
    }

    const validate = (): boolean => {
        const e: Record<string, string> = {}
        if (!form.sku?.trim()) e.sku = D.errSkuRequired
        if (!form.name?.trim()) e.name = D.errNameRequired
        if (!form.producerId?.trim()) e.producerId = D.errProducerRequired
        setErrors(e)
        return Object.keys(e).length === 0
    }

    const handleSave = async () => {
        if (!validate()) return
        setSaving(true)

        const input = formToInput(form)
        const savePromise = (async () => {
            const res = isEdit ? await updateProduct(editingId!, input) : await createProduct(input)
            if (!res.success) {
                throw new Error((res as any).error ?? D.errSaveProduct)
            }
            return res
        })()

        toast.promise(savePromise, {
            loading: isEdit ? D.toastUpdating : D.toastCreating,
            success: () => {
                onSaved()
                return isEdit ? D.toastUpdated : D.toastCreated
            },
            error: (err: any) => {
                setErrors({ _global: err.message ?? D.errSaveProduct })
                return `${err.message}`
            },
            finally: () => setSaving(false)
        })
    }

    return (
        <>
            <Drawer
            open={open}
            onClose={() => { if (previewDoc) setPreviewDoc(null); else onClose() }}
            size="md"
            className="bg-lys-bg"
            title={isEdit ? D.editTitle : D.createTitle}
            description={D.description}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>{D.cancelBtn}</Button>
                    <Button onClick={handleSave} loading={saving} disabled={saving}>
                        {!saving && <Save size={14} aria-hidden />}
                        {saving ? D.savingBtn : isEdit ? D.saveChangesBtn : D.createBtn}
                    </Button>
                </>
            }
        >
                <div className="space-y-5 relative min-h-full">
                    {loading && (
                        <div className="absolute inset-0 bg-slate-50/80 flex flex-col items-center justify-center gap-3 z-30">
                            <Loader2 size={32} className="animate-spin text-lys-teal" />
                            <p className="text-xs" style={{ color: '#64748B' }}>{D.loadingInfo}</p>
                        </div>
                    )}

                    {/* Global error */}
                    {errors._global && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.4)', color: '#B91C1C' }}>
                            <AlertCircle size={14} />
                            {errors._global}
                        </div>
                    )}

                    {/* Section: Thông tin cơ bản */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secBasic}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldSku} required error={errors.sku}>
                                <Input
                                    value={form.sku ?? ''}
                                    onChange={e => set('sku', e.target.value.toUpperCase())}
                                    placeholder="CHATEAU-PETRUS-750"
                                />
                            </Field>
                        </div>

                        <Field label={D.fieldName} required error={errors.name}>
                            <Input
                                value={form.name ?? ''}
                                onChange={e => set('name', e.target.value)}
                                placeholder="Château Pétrus 2018"
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldWineType}>
                                <Select value={form.wineType ?? ''} onChange={e => set('wineType', e.target.value || null)}>
                                    <option value="">{D.selectTypePlaceholder}</option>
                                    <option value="WHITE">{L.wineTypes.WHITE}</option>
                                    <option value="RED">{L.wineTypes.RED}</option>
                                    <option value="SPARKLING">{L.wineTypes.SPARKLING}</option>
                                    <option value="ROSE">{L.wineTypes.ROSE}</option>
                                </Select>
                            </Field>
                            <Field label={D.fieldAbv}>
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
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secPackaging}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field label={D.fieldVolume}>
                                <Select value={form.volumeMl ?? 750} onChange={e => set('volumeMl', Number(e.target.value))}>
                                    <option value={375}>{D.volHalf}</option>
                                    <option value={750}>{D.volStandard}</option>
                                    <option value={1500}>{D.volMagnum}</option>
                                    <option value={3000}>{D.volDouble}</option>
                                </Select>
                            </Field>
                            <Field label={D.fieldPackaging}>
                                <Select value={form.packagingType ?? 'CARTON'} onChange={e => set('packagingType', e.target.value as any)}>
                                    <option value="CARTON">Carton</option>
                                    <option value="OWC">{D.pkgOwc}</option>
                                </Select>
                            </Field>
                            <Field label={D.fieldUnitsPerCase}>
                                <Select value={form.bottlesPerCase ?? 12} onChange={e => set('bottlesPerCase', Number(e.target.value))}>
                                    <option value={1}>1</option>
                                    <option value={3}>3</option>
                                    <option value={6}>6</option>
                                    <option value={12}>12</option>
                                    <option value={24}>24</option>
                                </Select>
                            </Field>
                            <Field label={D.fieldVat}>
                                <Select value={form.vatRate ?? 10} onChange={e => set('vatRate', Number(e.target.value))}>
                                    <option value={10}>{D.vat10}</option>
                                    <option value={8}>{D.vat8}</option>
                                </Select>
                            </Field>
                        </div>
                    </div>

                    {/* Section: Xuất xứ */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secOrigin}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label={D.fieldCountry}>
                                <Select value={form.countryCode ?? ''} onChange={e => set('countryCode', e.target.value || null)}>
                                    <option value="">{D.selectCountryPlaceholder}</option>
                                    {Object.entries(L.countriesFull).map(([code, label]) => (
                                        <option key={code} value={code}>{label}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label={D.fieldProducer} required error={errors.producerId}>
                                <div className="flex gap-1.5">
                                    <Select className="flex-1" value={form.producerId ?? ''} onChange={e => set('producerId', e.target.value || null)}>
                                        <option value="">{D.selectProducerPlaceholder}</option>
                                        {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </Select>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewProducer(true)}
                                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-colors bg-white border border-[#E2E8F0] hover:border-[#0891B2] text-[#0891B2]"
                                        title={D.createProducerTitle}>
                                        +
                                    </button>
                                </div>
                            </Field>
                            <Field label={D.fieldSupplier}>
                                <Select value={form.supplierId ?? ''} onChange={e => set('supplierId', e.target.value || null)}>
                                    <option value="">{D.selectSupplierPlaceholder}</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </Select>
                            </Field>
                        </div>

                        {/* Inline producer creation */}
                        {showNewProducer && (
                            <div className="p-3 rounded-lg space-y-2" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <p className="text-xs font-bold" style={{ color: '#0891B2' }}>{D.createProducerTitle}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <Input
                                        value={newProducerName}
                                        onChange={e => setNewProducerName(e.target.value)}
                                        placeholder={D.newProducerPlaceholder}
                                    />
                                    <Select value={newProducerCountry} onChange={e => setNewProducerCountry(e.target.value)}>
                                        <option value="FR">{L.countries.FR}</option>
                                        <option value="IT">{L.countries.IT}</option>
                                        <option value="ES">{L.countries.ES}</option>
                                        <option value="US">{L.countries.US}</option>
                                        <option value="AU">{L.countries.AU}</option>
                                        <option value="CL">{L.countries.CL}</option>
                                        <option value="AR">{L.countries.AR}</option>
                                    </Select>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowNewProducer(false)} className="text-xs px-2 py-1" style={{ color: '#64748B' }}>{D.cancelBtn}</button>
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
                                                toast.success(D.toastProducerCreated(p.name))
                                            } catch {
                                                toast.error(D.toastProducerError)
                                            }
                                            setCreatingProducer(false)
                                        }}
                                        className="text-xs px-3 py-1 rounded font-semibold disabled:opacity-50"
                                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                                        {creatingProducer ? D.creatingProducer : D.createProducerBtn}
                                    </button>
                                </div>
                            </div>
                        )}

                        <Field label={D.fieldAppellation}>
                            <Select value={form.regionId ?? ''} onChange={e => set('regionId', e.target.value || null)}>
                                <option value="">{D.selectAppellationPlaceholder}</option>
                                {appellations.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}{a.region?.name ? ` (${a.region.name})` : ''}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>

                    {/* Section: HS Code, Giá & Trạng thái */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secPricingStatus}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldRetailPrice}>
                                <Input
                                    type="number"
                                    value={form.retailPriceVnd ?? ''}
                                    onChange={e => set('retailPriceVnd', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="5200000"
                                    step={50000}
                                />
                            </Field>
                            <Field label={D.fieldStatus}>
                                <Select value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value as any)}>
                                    <option value="ACTIVE">{L.detailStatuses.ACTIVE}</option>
                                    <option value="ALLOCATION_ONLY">{L.detailStatuses.ALLOCATION_ONLY}</option>
                                    <option value="DISCONTINUED">{L.detailStatuses.DISCONTINUED}</option>
                                </Select>
                            </Field>
                        </div>
                    </div>

                    {/* Section: Drinking window */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secDrinkingWindow}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldDrinkStart}>
                                <Input
                                    type="number"
                                    value={form.peakDrinkStart ?? ''}
                                    onChange={e => set('peakDrinkStart', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="2025"
                                />
                            </Field>
                            <Field label={D.fieldDrinkEnd}>
                                <Input
                                    type="number"
                                    value={form.peakDrinkEnd ?? ''}
                                    onChange={e => set('peakDrinkEnd', e.target.value ? Number(e.target.value) : null)}
                                    placeholder="2045"
                                />
                            </Field>
                        </div>
                    </div>

                    {/* Section: Tài liệu & Tasting Note (Cloudflare R2) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <FileText size={13} /> {D.secDocs}
                            </p>
                            <span className="text-[10px] text-slate-500 font-medium">{D.r2SecurityNote}</span>
                        </div>

                        {/* Tasting Note */}
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                                    <Wine size={13} className="text-cyan-700" /> {D.tnCardTitle}
                                </span>
                                {form.tastingNoteUrl && (
                                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 size={11} /> {D.docAttachedBadge}
                                    </span>
                                )}
                            </div>

                            {form.tastingNoteUrl ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200/80">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded bg-cyan-100 flex items-center justify-center shrink-0 text-cyan-800">
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-900 truncate max-w-[280px]">
                                                {form.tastingNoteUrl.split('/').pop() || 'Tasting Note'}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[280px]">
                                                {form.tastingNoteUrl}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDoc({
                                                url: form.tastingNoteUrl!,
                                                title: `Tasting Note — ${form.name || form.sku || 'SKU'}`,
                                            })}
                                            className="px-2.5 py-1.5 rounded text-xs font-medium bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <Eye size={12} /> {D.viewDirectBtn}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDeleteTastingNote}
                                            className="px-2.5 py-1.5 rounded text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                                            title={D.deleteTnTitle}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-4 rounded-lg border-2 border-dashed border-slate-200 hover:border-cyan-600 cursor-pointer bg-slate-50/50 hover:bg-cyan-50/20 transition-all text-center">
                                    {uploadingTastingNote ? (
                                        <div className="flex items-center gap-2 text-xs text-cyan-700">
                                            <Loader2 size={16} className="animate-spin" /> {D.uploadingR2}
                                        </div>
                                    ) : (
                                        <>
                                            <UploadCloud size={20} className="text-cyan-700" />
                                            <span className="text-xs font-medium text-slate-700">{D.uploadTnLabel}</span>
                                            <span className="text-[10px] text-slate-500">{D.uploadTnHint}</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                                        disabled={uploadingTastingNote}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleUploadTastingNote(file)
                                            e.target.value = ''
                                        }}
                                    />
                                </label>
                            )}

                            <div className="pt-1">
                                <details className="text-[11px] text-slate-500">
                                    <summary className="cursor-pointer hover:text-cyan-800 select-none">{D.directUrlLabel}</summary>
                                    <div className="pt-2">
                                        <Input
                                            type="url"
                                            value={form.tastingNoteUrl ?? ''}
                                            onChange={e => set('tastingNoteUrl', e.target.value || null)}
                                            placeholder="https://..."
                                            className="text-xs py-1.5"
                                        />
                                    </div>
                                </details>
                            </div>
                        </div>

                        {/* Self-declaration */}
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                                    <Paperclip size={13} className="text-cyan-700" /> {D.tcbCardTitle}
                                </span>
                                {form.selfDeclarationUrl && (
                                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle2 size={11} /> {D.docAttachedBadge}
                                    </span>
                                )}
                            </div>

                            {form.selfDeclarationUrl ? (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-md bg-slate-50 border border-slate-200/80">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded bg-cyan-100 flex items-center justify-center shrink-0 text-cyan-800">
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-slate-900 truncate max-w-[280px]">
                                                {form.selfDeclarationUrl.split('/').pop() || 'TCB'}
                                            </p>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[280px]">
                                                {form.selfDeclarationUrl}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDoc({
                                                url: form.selfDeclarationUrl!,
                                                title: `TCB — ${form.name || form.sku || 'SKU'}`,
                                            })}
                                            className="px-2.5 py-1.5 rounded text-xs font-medium bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                            <Eye size={12} /> {D.viewDirectBtn}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => set('selfDeclarationUrl', null)}
                                            className="px-2.5 py-1.5 rounded text-xs font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                                            title={D.deleteTcbTitle}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-lg border-2 border-dashed border-slate-200 hover:border-cyan-600 cursor-pointer bg-slate-50/50 hover:bg-cyan-50/20 transition-all text-center">
                                    {uploadingSelfDecl ? (
                                        <div className="flex items-center gap-2 text-xs text-cyan-700">
                                            <Loader2 size={16} className="animate-spin" /> {D.uploadingR2}
                                        </div>
                                    ) : (
                                        <>
                                            <UploadCloud size={16} className="text-cyan-700" />
                                            <span className="text-xs font-medium text-slate-700">{D.uploadTcbLabel}</span>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="application/pdf,image/*"
                                        disabled={uploadingSelfDecl}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0]
                                            if (file) handleUploadSelfDecl(file)
                                            e.target.value = ''
                                        }}
                                    />
                                </label>
                            )}

                            <div className="pt-1">
                                <details className="text-[11px] text-slate-500">
                                    <summary className="cursor-pointer hover:text-cyan-800 select-none">{D.directUrlLabel}</summary>
                                    <div className="pt-2">
                                        <Input
                                            type="url"
                                            value={form.selfDeclarationUrl ?? ''}
                                            onChange={e => set('selfDeclarationUrl', e.target.value || null)}
                                            placeholder="https://..."
                                            className="text-xs py-1.5"
                                        />
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>

                    {/* Section: Đặc tính sản phẩm (Wine Profile) */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secProfile}
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldGrapes}>
                                <Input
                                    value={form.grapes ?? ''}
                                    onChange={e => set('grapes', e.target.value || null)}
                                    placeholder="Corvina, Rondinella, Corvinone..."
                                />
                            </Field>
                            <Field label={D.fieldServingTemp}>
                                <Input
                                    value={form.servingTemp ?? ''}
                                    onChange={e => set('servingTemp', e.target.value || null)}
                                    placeholder="16°C - 18°C"
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldOriginDetail}>
                                <Input
                                    value={form.originDetail ?? ''}
                                    onChange={e => set('originDetail', e.target.value || null)}
                                    placeholder="Veneto, Italy"
                                />
                            </Field>
                            <Field label={D.fieldCertification}>
                                <Input
                                    value={form.certification ?? ''}
                                    onChange={e => set('certification', e.target.value || null)}
                                    placeholder="Sustainable practices / Organic..."
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldColor}>
                                <Input
                                    value={form.color ?? ''}
                                    onChange={e => set('color', e.target.value || null)}
                                    placeholder="Deep ruby red..."
                                />
                            </Field>
                            <Field label={D.fieldStyle}>
                                <Input
                                    value={form.style ?? ''}
                                    onChange={e => set('style', e.target.value || null)}
                                    placeholder="Dry, full-bodied..."
                                />
                            </Field>
                        </div>

                        <Field label={D.fieldAromas}>
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 resize-y min-h-[60px]"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                value={form.aromas ?? ''}
                                onChange={e => set('aromas', e.target.value || null)}
                                placeholder="Dried fig, cherry jam, blackberry, dried herbs..."
                                rows={2}
                            />
                        </Field>

                        <Field label={D.fieldPalate}>
                            <textarea
                                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all duration-150 resize-y min-h-[60px]"
                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                value={form.palate ?? ''}
                                onChange={e => set('palate', e.target.value || null)}
                                placeholder="Velvety, full-bodied, silky tannins..."
                                rows={2}
                            />
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={D.fieldFoodPairings}>
                                <Input
                                    value={form.foodPairings ?? ''}
                                    onChange={e => set('foodPairings', e.target.value || null)}
                                    placeholder="Grilled beef, roast lamb, aged cheese..."
                                />
                            </Field>
                            <Field label={D.fieldBestSuited}>
                                <Input
                                    value={form.bestSuitedFor ?? ''}
                                    onChange={e => set('bestSuitedFor', e.target.value || null)}
                                    placeholder="Amarone & full-bodied red wine lovers..."
                                />
                            </Field>
                        </div>


                    </div>

                    {/* Section: Hình ảnh sản phẩm */}
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>
                            {D.secMedia}
                        </p>

                        {isEdit ? (
                            <>
                                {/* Upload button */}
                                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg cursor-pointer transition-all bg-white border-2 border-dashed border-[#E2E8F0] text-[#64748B] hover:border-[#0891B2] hover:text-[#0891B2]">
                                    {uploadingMedia
                                        ? <><Loader2 size={16} className="animate-spin" /> {D.uploadingMedia}</>
                                        : <><UploadCloud size={16} /> {D.addMediaBtn}</>
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
                                                    if (savedPct > 5) toast.info(D.toastCompressed((file.size / 1024 / 1024).toFixed(1), (compressed.size / 1024 / 1024).toFixed(1), savedPct))
                                                }

                                                // Direct upload to Cloudflare R2
                                                const fd = new FormData()
                                                fd.append('file', compressed)
                                                const res = await uploadProductMedia(editingId, fd)
                                                if (res.success && res.media) {
                                                    setMediaList(prev => [res.media!, ...prev])
                                                    toast.success(D.toastMediaUploaded)
                                                } else {
                                                    toast.error(`${D.toastMediaError}: ${res.error}`)
                                                }
                                            } catch (err: any) {
                                                toast.error(`${D.toastMediaError}: ${err.message ?? err}`)
                                            } finally {
                                                setUploadingMedia(false)
                                                e.target.value = ''
                                            }
                                        }}
                                    />
                                </label>

                                {/* Media grid */}
                                {mediaList.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {mediaList.map(m => (
                                            <div key={m.id} className="relative group rounded-lg overflow-hidden"
                                                style={{ border: m.isPrimary ? '2px solid #0E7490' : '1px solid #E2E8F0', aspectRatio: '3/4', background: '#FFFFFF' }}>
                                                <img src={m.url} alt="Product" className="w-full h-full object-contain p-1" />

                                                {/* Primary badge */}
                                                {m.isPrimary && (
                                                    <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap shrink-0"
                                                        style={{ background: 'rgba(8,145,178,0.9)', color: '#0F172A' }}>
                                                        <Star size={8} /> {D.primaryImageBadge}
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
                                                            style={{ background: 'rgba(8, 145, 178, 0.15)', color: '#0891B2' }}
                                                            title={D.setPrimaryTooltip}>
                                                            <Star size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            confirm({
                                                                title: D.deleteMediaTitle,
                                                                message: D.deleteMediaMsg,
                                                                confirmLabel: L.table.deleteBtn,
                                                                cancelLabel: D.cancelBtn,
                                                                danger: true,
                                                                onConfirm: async () => {
                                                                    const res = await deleteProductMedia(m.id)
                                                                    if (res.success) {
                                                                        setMediaList(prev => prev.filter(x => x.id !== m.id))
                                                                        toast.success(D.toastMediaDeleted)
                                                                    } else {
                                                                        toast.error(res.error || D.toastMediaError)
                                                                    }
                                                                }
                                                            })
                                                        }}
                                                        className="p-2 rounded-lg transition-colors"
                                                        style={{ background: 'rgba(185,28,28,0.2)', color: '#B91C1C' }}
                                                        title={L.table.deleteBtn}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0' }}>
                                        <ImageIcon size={24} style={{ color: '#94A3B8' }} />
                                        <p className="text-xs" style={{ color: '#64748B' }}>{D.emptyMedia}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#FFFFFF', border: '1px dashed #E2E8F0' }}>
                                <UploadCloud size={24} style={{ color: '#E2E8F0' }} />
                                <p className="text-xs text-center" style={{ color: '#64748B' }}>
                                    {D.saveBeforeMediaHint}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Section: Awards & Scores */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#B45309' }}>
                                {D.secAwards}
                            </p>
                            {isEdit && (
                                <button
                                    onClick={() => setShowAwardForm(v => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                                    style={{ background: 'rgba(180,83,9,0.12)', color: '#B45309', border: '1px solid rgba(180,83,9,0.25)' }}>
                                    <Plus size={10} /> {D.addAwardBtn}
                                </button>
                            )}
                        </div>

                        {isEdit ? (
                            <>
                                {/* Add form */}
                                {showAwardForm && (
                                    <div className="p-4 rounded-lg space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <Field label={D.fieldAwardSource}>
                                                <Select value={awardSource} onChange={e => setAwardSource(e.target.value)}>
                                                    <option>Robert Parker</option>
                                                    <option>Wine Spectator</option>
                                                    <option>Decanter</option>
                                                    <option>James Suckling</option>
                                                    <option>Jancis Robinson</option>
                                                    <option>Vivino</option>
                                                </Select>
                                            </Field>
                                            <Field label={D.fieldAwardScore}>
                                                <Input type="number" value={awardScore}
                                                    onChange={e => setAwardScore(e.target.value)}
                                                    placeholder="95" min={0} max={100} />
                                            </Field>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <Field label={D.fieldAwardMedal}>
                                                <Select value={awardMedal} onChange={e => setAwardMedal(e.target.value)}>
                                                    <option value="">{D.noMedalOption}</option>
                                                    <option value="DOUBLE_GOLD">Double Gold</option>
                                                    <option value="GOLD">Gold</option>
                                                    <option value="SILVER">Silver</option>
                                                    <option value="BRONZE">Bronze</option>
                                                </Select>
                                            </Field>
                                            <Field label={D.fieldAwardVintage}>
                                                <Input type="number" value={awardVintage}
                                                    onChange={e => setAwardVintage(e.target.value)}
                                                    placeholder="2018" />
                                            </Field>
                                            <Field label={D.fieldAwardYear}>
                                                <Input type="number" value={awardYear}
                                                    onChange={e => setAwardYear(e.target.value)}
                                                    placeholder="2022" />
                                            </Field>
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => setShowAwardForm(false)}
                                                className="px-3 py-1.5 text-xs rounded" style={{ color: '#64748B' }}>{D.cancelBtn}</button>
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
                                                        loading: D.toastSavingAward,
                                                        success: () => {
                                                            getProductAwards(editingId).then(setAwards)
                                                            setShowAwardForm(false)
                                                            setAwardScore(''); setAwardMedal(''); setAwardVintage(''); setAwardYear('')
                                                            return D.toastAwardSaved
                                                        },
                                                        error: D.toastAwardError,
                                                        finally: () => setSavingAward(false)
                                                    })
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                                                style={{ background: '#D97706', color: '#FFFFFF' }}>
                                                {savingAward ? <Loader2 size={10} className="animate-spin" /> : <Award size={10} />} {D.saveAwardBtn}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Awards list */}
                                {awards.length > 0 ? (
                                    <div className="space-y-2">
                                        {awards.map(aw => (
                                            <div key={aw.id} className="flex items-center gap-3 p-3 rounded-lg group"
                                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                                    style={{ background: 'rgba(180,83,9,0.12)' }}>
                                                    <Award size={14} className="text-amber-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold" style={{ color: '#B45309' }}>{aw.source}</span>
                                                        {aw.score && (
                                                            <span className="text-sm font-bold" style={{ color: '#0F172A' }}>
                                                                {aw.score}/100
                                                            </span>
                                                        )}
                                                        {aw.medalLabel && (
                                                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309' }}>
                                                                {aw.medalLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px]" style={{ color: '#64748B' }}>
                                                        {aw.vintage && `Vintage ${aw.vintage} `}
                                                        {aw.vintage && aw.awardedYear && ' · '}
                                                        {aw.awardedYear && `${D.awardYearPrefix} ${aw.awardedYear} `}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        confirm({
                                                            title: D.deleteAwardTitle,
                                                            message: D.deleteAwardMsg,
                                                            confirmLabel: L.table.deleteBtn,
                                                            cancelLabel: D.cancelBtn,
                                                            danger: true,
                                                            onConfirm: async () => {
                                                                await deleteProductAward(aw.id)
                                                                setAwards(prev => prev.filter(a => a.id !== aw.id))
                                                                toast.success(D.toastAwardDeleted)
                                                            }
                                                        })
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all"
                                                    style={{ color: '#B91C1C' }}
                                                    title={L.table.deleteBtn}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : !showAwardForm && (
                                    <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#F8FAFC', border: '1px dashed #E2E8F0' }}>
                                        <Award size={24} style={{ color: '#94A3B8' }} />
                                        <p className="text-xs" style={{ color: '#64748B' }}>{D.emptyAwards}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 rounded-lg" style={{ background: '#FFFFFF', border: '1px dashed #E2E8F0' }}>
                                <Award size={24} style={{ color: '#E2E8F0' }} />
                                <p className="text-xs text-center" style={{ color: '#64748B' }}>
                                    {D.saveBeforeAwardsHint}
                                </p>
                            </div>
                        )}
                    </div>

                </div>
            </Drawer>
            {previewDoc && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6"
                    onClick={() => setPreviewDoc(null)}
                >
                    <div
                        className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText size={16} className="text-cyan-700 shrink-0" />
                                <h3 className="text-sm font-bold text-slate-900 truncate">{previewDoc.title}</h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={previewDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                                    title={L.detailDrawer.openNewTab}
                                >
                                    <ExternalLink size={12} />
                                    <span className="hidden sm:inline">{L.detailDrawer.openNewTab}</span>
                                </a>
                                <a
                                    href={`${previewDoc.url}${previewDoc.url.includes('?') ? '&' : '?'}download=true`}
                                    download
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 transition-colors"
                                    title={L.detailDrawer.downloadTooltip}
                                >
                                    <Download size={12} />
                                    <span className="hidden sm:inline">{L.detailDrawer.downloadBtn}</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                    aria-label={L.detailDrawer.closePreview}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                            {/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(previewDoc.url) ? (
                                <img
                                    src={previewDoc.url}
                                    alt={previewDoc.title}
                                    className="max-w-full max-h-full object-contain p-4"
                                />
                            ) : (
                                <iframe
                                    src={previewDoc.url}
                                    title={previewDoc.title}
                                    className="w-full h-full border-0 bg-white"
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body,
            )}
            {confirmDialog}
        </>
    )
}
