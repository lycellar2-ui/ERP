'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Plus, Building2, Globe, Clock, X, Save, Loader2, AlertCircle, Award, Copy, Upload,
    Download, Search, Edit2, Trash2, Eye, Factory, CheckCircle2, User, CreditCard, Package, Flag,
} from 'lucide-react'
import {
    SupplierRow, SupplierInput, SupplierStats, SupplierFilters,
    createSupplier, updateSupplier, getSuppliers, getSupplierById,
    deleteSupplier, exportSuppliersData, bulkImportSuppliers,
    getAllSupplierScorecards, detectDuplicates,
    type SupplierScorecard, type DuplicateCandidate,
} from './actions'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { SupplierDetailDrawer } from './SupplierDetailDrawer'
import { PageHeader, StatGrid, StatCard, Button, useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { SUPPLIERS_I18N } from './i18n'
import { toast } from 'sonner'

const SUPPLIER_TYPE_STYLE: Record<string, { color: string; bg: string }> = {
    WINERY: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    NEGOCIANT: { color: '#0D9488', bg: 'rgba(13, 148, 136, 0.12)' },
    DISTRIBUTOR: { color: '#15803D', bg: 'rgba(21, 128, 61, 0.12)' },
    LOGISTICS: { color: '#B45309', bg: 'rgba(180, 83, 9, 0.12)' },
    FORWARDER: { color: '#1D4ED8', bg: 'rgba(29, 78, 216, 0.12)' },
    CUSTOMS_BROKER: { color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' },
    PACKAGING: { color: '#C2410C', bg: 'rgba(194, 65, 12, 0.12)' },
    POSM: { color: '#047857', bg: 'rgba(4, 120, 87, 0.12)' },
    MARKETING_EVENT: { color: '#E11D48', bg: 'rgba(225, 29, 72, 0.12)' },
    OFFICE_SERVICE: { color: '#0284C7', bg: 'rgba(2, 132, 199, 0.12)' },
    OTHER_SERVICE: { color: '#4B5563', bg: 'rgba(75, 85, 99, 0.12)' },
}

function TypeBadge({ type }: { type: string }) {
    const { locale } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const style = SUPPLIER_TYPE_STYLE[type] ?? { color: '#475569', bg: 'rgba(168,152,128,0.12)' }
    const label = i18n.types[type] ?? type
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0" style={{ color: style.color, background: style.bg }}>{label}</span>
}

function StatusDot({ status }: { status: string }) {
    const { locale } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const color = status === 'ACTIVE' ? '#15803D' : status === 'BLACKLISTED' ? '#B91C1C' : '#64748B'
    const label = status === 'ACTIVE' ? i18n.statusActive : status === 'BLACKLISTED' ? i18n.statusBlacklisted : i18n.statusInactive
    return <span className="flex items-center gap-1.5 text-xs" style={{ color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}</span>
}

// ── Supplier Drawer (Create + Edit) ────────────────────
function SupplierDrawer({ open, editingId, onClose, onSaved }: {
    open: boolean; editingId: string | null; onClose: () => void; onSaved: () => void
}) {
    const { locale } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const [form, setForm] = useState<Partial<SupplierInput>>({
        defaultCurrency: 'VND', leadTimeDays: 7, status: 'ACTIVE', type: 'LOGISTICS', country: 'VN',
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const isEdit = !!editingId

    useEffect(() => {
        if (!open) return
        if (editingId) {
            setLoading(true)
            getSupplierById(editingId).then(data => {
                if (data) setForm({
                    code: data.code, name: data.name, type: data.type as any,
                    country: data.country, taxId: data.taxId, tradeAgreement: data.tradeAgreement,
                    coFormType: data.coFormType, paymentTerm: data.paymentTerm,
                    defaultCurrency: data.defaultCurrency, incoterms: data.incoterms,
                    leadTimeDays: data.leadTimeDays, status: data.status as any,
                    website: data.website, notes: data.notes,
                    pickupInfo: (data as any).pickupInfo, bankAccountInfo: (data as any).bankAccountInfo,
                    contactName: data.contactName, contactTitle: data.contactTitle,
                    contactEmail: data.contactEmail, contactPhone: data.contactPhone,
                    address: data.address, city: data.city, region: data.region,
                })
            }).finally(() => setLoading(false))
        } else {
            setForm({ defaultCurrency: 'VND', leadTimeDays: 7, status: 'ACTIVE', type: 'LOGISTICS', country: 'VN' })
        }
        setErrors({})
    }, [open, editingId])

    const set = (k: keyof SupplierInput, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3 py-2 rounded-md text-sm outline-none transition-colors focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
    const inputStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }

    const handleCountryChange = (val: string) => {
        set('country', val)
        if (!isEdit) {
            if (val === 'VN') {
                setForm(prev => ({
                    ...prev,
                    country: 'VN',
                    defaultCurrency: 'VND',
                    leadTimeDays: prev.leadTimeDays === 45 ? 3 : (prev.leadTimeDays ?? 3),
                    tradeAgreement: null,
                    coFormType: null,
                }))
            } else if (val) {
                setForm(prev => ({
                    ...prev,
                    country: val,
                    defaultCurrency: ['FR', 'IT', 'ES', 'DE', 'PT'].includes(val) ? 'EUR' : 'USD',
                    leadTimeDays: prev.leadTimeDays === 3 || prev.leadTimeDays === 7 ? 45 : (prev.leadTimeDays ?? 45),
                }))
            }
        }
    }

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!form.code) e.code = i18n.requiredField
        if (!form.name) e.name = i18n.requiredField
        if (!form.country) e.country = i18n.requiredField
        setErrors(e)
        if (Object.keys(e).length) return

        setSaving(true)
        try {
            if (isEdit) {
                const res = await updateSupplier(editingId!, form as SupplierInput)
                if (res.success) {
                    toast.success(i18n.updatedToast)
                    onSaved()
                } else {
                    toast.error(res.error ?? i18n.updateErrorToast)
                    setErrors({ _global: res.error ?? i18n.updateErrorToast })
                }
            } else {
                const res = await createSupplier(form as SupplierInput)
                if (res.success) {
                    toast.success(i18n.createdToast)
                    onSaved()
                } else {
                    toast.error(res.error ?? i18n.createErrorToast)
                    setErrors({ _global: res.error ?? i18n.createErrorToast })
                }
            }
        } catch (err: any) {
            setErrors({ _global: err.message })
            toast.error(err.message ?? i18n.genericErrorToast)
        } finally { setSaving(false) }
    }

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div
                className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ width: 'min(580px, 95vw)' }}
            >
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-600/10 border border-cyan-600/20 text-cyan-700 font-bold">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">
                                {isEdit ? i18n.drawerEditTitle : i18n.drawerCreateTitle}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isEdit ? i18n.drawerEditDesc : i18n.drawerCreateDesc}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
                    ) : (<>
                        {errors._global && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                                style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.4)', color: '#B91C1C' }}>
                                <AlertCircle size={14} /> {errors._global}
                            </div>
                        )}

                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secBasicInfo}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelCode} <span style={{ color: '#B91C1C' }}>*</span></label>
                                <input className={inputCls} style={inputStyle} value={form.code ?? ''} disabled={isEdit}
                                    onChange={e => set('code', e.target.value.toUpperCase())} placeholder={form.country === 'VN' ? 'NCC-LOG-01' : 'SUP-LVMH'} />
                                {errors.code && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.code}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelType}</label>
                                <select className={inputCls} style={inputStyle} value={form.type ?? 'LOGISTICS'} onChange={e => set('type', e.target.value)}>
                                    <optgroup label={i18n.groupDomesticServices}>
                                        <option value="LOGISTICS">{i18n.typeDescriptions.LOGISTICS}</option>
                                        <option value="PACKAGING">{i18n.typeDescriptions.PACKAGING}</option>
                                        <option value="POSM">{i18n.typeDescriptions.POSM}</option>
                                        <option value="MARKETING_EVENT">{i18n.typeDescriptions.MARKETING_EVENT}</option>
                                        <option value="OFFICE_SERVICE">{i18n.typeDescriptions.OFFICE_SERVICE}</option>
                                        <option value="OTHER_SERVICE">{i18n.typeDescriptions.OTHER_SERVICE}</option>
                                    </optgroup>
                                    <optgroup label={i18n.groupInternationalImport}>
                                        <option value="WINERY">{i18n.typeDescriptions.WINERY}</option>
                                        <option value="NEGOCIANT">{i18n.typeDescriptions.NEGOCIANT}</option>
                                        <option value="DISTRIBUTOR">{i18n.typeDescriptions.DISTRIBUTOR}</option>
                                        <option value="FORWARDER">{i18n.typeDescriptions.FORWARDER}</option>
                                        <option value="CUSTOMS_BROKER">{i18n.typeDescriptions.CUSTOMS_BROKER}</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelName} <span style={{ color: '#B91C1C' }}>*</span></label>
                            <input className={inputCls} style={inputStyle} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder={form.country === 'VN' ? i18n.placeholderNameVN : i18n.placeholderNameIntl} />
                            {errors.name && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.name}</p>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelCountry} <span style={{ color: '#B91C1C' }}>*</span></label>
                                <select className={inputCls} style={inputStyle} value={form.country ?? 'VN'} onChange={e => handleCountryChange(e.target.value)}>
                                    <option value="">{i18n.selectCountry}</option>
                                    <optgroup label={i18n.groupDomestic}>
                                        <option value="VN">{i18n.vietnamLabel}</option>
                                    </optgroup>
                                    <optgroup label={i18n.groupInternational}>
                                        <option value="FR">{i18n.countries.FR}</option>
                                        <option value="IT">{i18n.countries.IT}</option>
                                        <option value="ES">{i18n.countries.ES}</option>
                                        <option value="CL">{i18n.countries.CL}</option>
                                        <option value="AU">{i18n.countries.AU}</option>
                                        <option value="NZ">{i18n.countries.NZ}</option>
                                        <option value="US">{i18n.countries.US}</option>
                                        <option value="DE">{i18n.countries.DE}</option>
                                        <option value="PT">{i18n.countries.PT}</option>
                                        <option value="AR">{i18n.countries.AR}</option>
                                        <option value="ZA">{i18n.countries.ZA}</option>
                                        <option value="SG">{i18n.countries.SG}</option>
                                        <option value="JP">{i18n.countries.JP}</option>
                                        <option value="CN">{i18n.countries.CN}</option>
                                        <option value="GB">{i18n.countries.GB}</option>
                                    </optgroup>
                                </select>
                                {errors.country && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.country}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelTaxId}</label>
                                <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} onChange={e => set('taxId', e.target.value || null)} placeholder={form.country === 'VN' ? '0312345678' : 'FR12345678901'} />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>{i18n.secPrimaryContact}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelContactName}</label>
                                <input className={inputCls} style={inputStyle} value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value || null)} placeholder={form.country === 'VN' ? 'Nguyễn Văn A' : 'Jean-Pierre Dupont'} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelContactTitle}</label>
                                <input className={inputCls} style={inputStyle} value={form.contactTitle ?? ''} onChange={e => set('contactTitle', e.target.value || null)} placeholder={form.country === 'VN' ? i18n.placeholderContactTitleVN : i18n.placeholderContactTitleIntl} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelEmail}</label>
                                <input className={inputCls} style={inputStyle} value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value || null)} placeholder="lienhe@doitac.vn" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelPhone}</label>
                                <input className={inputCls} style={inputStyle} value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value || null)} placeholder="0903 123 456" />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>{i18n.secTradePayment}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelTradeAgreement}</label>
                                <select className={inputCls} style={inputStyle} value={form.tradeAgreement ?? ''} onChange={e => set('tradeAgreement', e.target.value || null)}>
                                    <option value="">{form.country === 'VN' ? i18n.tradeDomesticNone : i18n.tradeIntlNone}</option>
                                    <option value="EVFTA">EVFTA (EU - VN)</option>
                                    <option value="AANZFTA">AANZFTA (AU/NZ - VN)</option>
                                    <option value="CPTPP">CPTPP</option>
                                    <option value="UKVFTA">UKVFTA (UK - VN)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelCoForm}</label>
                                <input className={inputCls} style={inputStyle} value={form.coFormType ?? ''} onChange={e => set('coFormType', e.target.value || null)} placeholder={form.country === 'VN' ? i18n.coDomesticPlaceholder : 'EUR.1 / Form AANZ'} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelPaymentTerm}</label>
                                <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET30'} onChange={e => set('paymentTerm', e.target.value)}>
                                    <option value="COD">{i18n.payCOD}</option>
                                    <option value="NET15">{i18n.payNET15}</option>
                                    <option value="NET30">{i18n.payNET30}</option>
                                    <option value="NET45">{i18n.payNET45}</option>
                                    <option value="NET60">{i18n.payNET60}</option>
                                    <option value="NET90">{i18n.payNET90}</option>
                                    <option value="TT_ADVANCE">{i18n.payTT}</option>
                                    <option value="LC">{i18n.payLC}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelDefaultCurrency}</label>
                                <select 
                                    className={inputCls} 
                                    style={inputStyle} 
                                    value={form.defaultCurrency ?? 'VND'} 
                                    onChange={e => set('defaultCurrency', e.target.value)}
                                >
                                    <option value="VND">{i18n.currVND}</option>
                                    <option value="USD">{i18n.currUSD}</option>
                                    <option value="EUR">{i18n.currEUR}</option>
                                    <option value="GBP">{i18n.currGBP}</option>
                                    <option value="AUD">{i18n.currAUD}</option>
                                    <option value="NZD">{i18n.currNZD}</option>
                                    <option value="SGD">{i18n.currSGD}</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelLeadTimeDays}</label>
                                <input type="number" className={inputCls} style={inputStyle} value={form.leadTimeDays ?? (form.country === 'VN' ? 3 : 45)} onChange={e => set('leadTimeDays', Number(e.target.value))} min={1} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelIncoterms}</label>
                                <input className={inputCls} style={inputStyle} value={form.incoterms ?? ''} onChange={e => set('incoterms', e.target.value || null)} placeholder={form.country === 'VN' ? i18n.placeholderIncotermsVN : i18n.placeholderIncotermsIntl} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelWebsite}</label>
                                <input className={inputCls} style={inputStyle} value={form.website ?? ''} onChange={e => set('website', e.target.value || null)} placeholder="https://..." />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>{i18n.secPickupBank}</p>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelBankAccount}</label>
                                <input className={inputCls} style={inputStyle} value={form.bankAccountInfo ?? ''} onChange={e => set('bankAccountInfo', e.target.value || null)} placeholder={i18n.placeholderBankAccount} />
                                <p className="text-[11px] text-slate-400 mt-1">{i18n.hintBankAccount}</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelPickupInfo}</label>
                                <input className={inputCls} style={inputStyle} value={form.pickupInfo ?? ''} onChange={e => set('pickupInfo', e.target.value || null)} placeholder={i18n.placeholderPickupInfo} />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>{i18n.secAddressStatus}</p>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelAddress}</label>
                            <input className={inputCls} style={inputStyle} value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} placeholder="33 Rue du Commerce, Bordeaux" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelCity}</label>
                                <input className={inputCls} style={inputStyle} value={form.city ?? ''} onChange={e => set('city', e.target.value || null)} placeholder="Bordeaux" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelRegion}</label>
                                <input className={inputCls} style={inputStyle} value={form.region ?? ''} onChange={e => set('region', e.target.value || null)} placeholder="Nouvelle-Aquitaine" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelStatus}</label>
                                <select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value as any)}>
                                    <option value="ACTIVE">{i18n.statusActive}</option><option value="INACTIVE">{i18n.statusInactive}</option><option value="BLACKLISTED">{i18n.statusBlacklisted}</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>{i18n.labelInternalNotes}</label>
                            <textarea className={inputCls + ' resize-none'} style={{ ...inputStyle, minHeight: 60 }} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} placeholder={i18n.placeholderNotes} />
                        </div>
                    </>)}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm" style={{ color: '#475569', border: '1px solid #E2E8F0' }}>{i18n.btnCancel}</button>
                    <button onClick={handleSave} disabled={saving || loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? i18n.btnSaving : isEdit ? i18n.btnSaveChanges : i18n.btnCreateSupplier}
                    </button>
                </div>
            </div>
        </>
    )
}

function SupplierMobileCard({
    row,
    onViewDetail,
    onEdit,
    onDelete,
}: {
    row: SupplierRow
    onViewDetail: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const { locale } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const isDomestic = row.country === 'VN' || row.country === 'Việt Nam' || row.country === 'Vietnam'
    return (
        <div 
            onClick={onViewDetail}
            className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2.5 active:bg-slate-50 transition-colors cursor-pointer"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-cyan-700">{row.code}</span>
                        <TypeBadge type={row.type} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-1 truncate">{row.name}</h4>
                </div>
                <StatusDot status={row.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 text-slate-600">
                <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.cardCountry}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 mt-0.5">
                        <Globe size={12} className="text-slate-400 shrink-0" />
                        <span>{isDomestic ? i18n.vietnamLabel : (i18n.countries[row.country] ?? row.country)}</span>
                    </span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.cardPoOrders}</span>
                    <span className="font-mono font-bold text-slate-800 mt-0.5 block">{i18n.poCountUnit(row.poCount)}</span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.cardLeadTimeCurrency}</span>
                    <span className="font-medium text-slate-800 mt-0.5 block">{row.leadTimeDays} {i18n.daysUnit} · {row.defaultCurrency}</span>
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.cardPayment}</span>
                    <span className="font-mono font-medium text-slate-800 mt-0.5 block">{row.paymentTerm ?? 'NET30'}</span>
                </div>
            </div>

            {(row.contactName || row.contactEmail) && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded flex items-center justify-between">
                    <span className="truncate flex items-center gap-1">
                        <User size={12} className="text-slate-400 shrink-0" />
                        {row.contactName || i18n.defaultContactLabel}
                    </span>
                    {row.contactEmail && (
                        <a 
                            href={`mailto:${row.contactEmail}`} 
                            onClick={e => e.stopPropagation()} 
                            className="text-cyan-700 font-semibold underline shrink-0 ml-2"
                        >
                            {row.contactEmail}
                        </a>
                    )}
                </div>
            )}

            <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                <button
                    onClick={onViewDetail}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-blue-700 hover:bg-blue-50 transition-colors"
                >
                    <Eye size={13} /> {i18n.btnDetail}
                </button>
                <button
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-slate-700 hover:bg-slate-100 transition-colors"
                >
                    <Edit2 size={13} /> {i18n.btnEdit}
                </button>
                <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded text-red-600 hover:bg-red-50 transition-colors"
                >
                    <Trash2 size={13} /> {i18n.btnDelete}
                </button>
            </div>
        </div>
    )
}

// ── Main ───────────────────────────────────────────────────
export function SuppliersClient({ initialRows, initialTotal, stats }: { initialRows: SupplierRow[]; initialTotal: number; stats: SupplierStats }) {
    const { locale } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [regionScope, setRegionScope] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL')
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'scorecard' | 'duplicates'>('list')
    const [scorecards, setScorecards] = useState<SupplierScorecard[] | null>(null)
    const [scoreLoading, setScoreLoading] = useState(false)
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
    const [dupLoading, setDupLoading] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const reload = useCallback(async (s?: string, t?: string, st?: string, p?: number, r?: 'ALL' | 'DOMESTIC' | 'INTERNATIONAL') => {
        setLoading(true)
        try {
            const currentRegion = r !== undefined ? r : regionScope
            const result = await getSuppliers({
                search: (s ?? search) || undefined, 
                type: (t ?? typeFilter) || undefined,
                status: (st ?? statusFilter) || undefined, 
                regionScope: currentRegion === 'ALL' ? undefined : currentRegion,
                page: p ?? page, 
                pageSize: 25,
            })
            setRows(result.rows); setTotal(result.total)
        } finally { setLoading(false) }
    }, [search, typeFilter, statusFilter, page, regionScope])

    const handleDelete = (id: string, name: string) => {
        confirm({
            title: i18n.deleteConfirmTitle(name),
            message: (
                <div className="space-y-1">
                    <p>{i18n.deleteConfirmMsg1(name)}</p>
                    <p className="text-xs text-slate-500">{i18n.deleteConfirmMsg2}</p>
                </div>
            ),
            confirmLabel: i18n.deleteConfirmBtn,
            cancelLabel: i18n.cancelBtn,
            danger: true,
            onConfirm: async () => {
                try {
                    const result = await deleteSupplier(id)
                    if (result.success) { toast.success(i18n.deletedToast(name)); reload() }
                    else toast.error(result.error ?? i18n.cannotDeleteToast)
                } catch { toast.error(i18n.deleteErrorToast) }
            }
        })
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportSuppliersData()
            if (data.length === 0) { toast.error(i18n.noSuppliersToExport); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(h => {
                    const val = String((row as any)[h] ?? '')
                    return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                }).join(',')),
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `nha_cung_cap_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success(i18n.exportedToast(data.length))
        } catch { toast.error(i18n.exportErrorToast) }
        finally { setExporting(false) }
    }

    const loadScorecards = async () => {
        setActiveTab('scorecard')
        if (scorecards) return
        setScoreLoading(true)
        setScorecards(await getAllSupplierScorecards())
        setScoreLoading(false)
    }

    const loadDuplicates = async () => {
        setActiveTab('duplicates')
        if (duplicates) return
        setDupLoading(true)
        setDuplicates(await detectDuplicates())
        setDupLoading(false)
    }

    const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
        A: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' }, B: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
        C: { color: '#B45309', bg: 'rgba(180,83,9,0.15)' }, D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
        F: { color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title={i18n.pageTitle}
                description={i18n.pageDesc(stats.total)}
                actions={
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting} className="text-xs px-2.5 py-1 sm:px-3 sm:py-1.5">
                            <Download size={13} /> <span className="hidden xs:inline">{exporting ? i18n.exporting : i18n.exportCsv}</span><span className="xs:hidden">CSV</span>
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)} className="text-xs px-2.5 py-1 sm:px-3 sm:py-1.5">
                            <Upload size={13} /> <span className="hidden xs:inline">{i18n.importExcel}</span><span className="xs:hidden">{i18n.importShort}</span>
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => { setEditingId(null); setDrawerOpen(true) }} className="text-xs px-2.5 py-1 sm:px-3 sm:py-1.5">
                            <Plus size={13} /> <span>{i18n.addSupplier}</span>
                        </Button>
                    </div>
                }
            />

            {/* Stats */}
            <StatGrid>
                <StatCard 
                    label={i18n.statTotal} 
                    value={stats.total} 
                    icon={Building2} 
                    sub={i18n.statActiveSub(stats.active)} 
                />
                <StatCard 
                    label={i18n.statDomestic} 
                    value={stats.domesticCount ?? 0} 
                    icon={Building2} 
                    tone="success" 
                    sub={i18n.statDomesticSub} 
                />
                <StatCard 
                    label={i18n.statInternational} 
                    value={stats.internationalCount ?? 0} 
                    icon={Globe} 
                    tone="brand" 
                    sub={i18n.statInternationalSub(stats.countries)} 
                />
                <StatCard 
                    label={i18n.statAvgLeadTime} 
                    value={`${stats.avgLeadTime} ${i18n.daysUnit}`} 
                    icon={Clock} 
                />
            </StatGrid>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0' }}>
                {([
                    { key: 'list', label: i18n.tabList, icon: Building2 },
                    { key: 'scorecard', label: i18n.tabScorecard, icon: Award },
                    { key: 'duplicates', label: i18n.tabDuplicates, icon: Copy },
                ] as const).map(tab => (
                    <button key={tab.key}
                        onClick={() => tab.key === 'scorecard' ? loadScorecards() : tab.key === 'duplicates' ? loadDuplicates() : setActiveTab('list')}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer"
                        style={{
                            background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                            color: activeTab === tab.key ? '#0E7490' : '#64748B',
                            border: activeTab === tab.key ? '1px solid #E2E8F0' : '1px solid transparent',
                        }}>
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: NCC List */}
            {activeTab === 'list' && (<>
                {/* Segmented Region Switcher & Filters */}
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('ALL')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'ALL')
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'ALL'
                                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                {i18n.scopeAll(stats.total)}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('DOMESTIC')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'DOMESTIC')
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'DOMESTIC'
                                        ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Flag size={13} className="text-emerald-600 shrink-0" /> {i18n.scopeDomestic(stats.domesticCount ?? 0)}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('INTERNATIONAL')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'INTERNATIONAL')
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'INTERNATIONAL'
                                        ? 'bg-white text-cyan-700 shadow-2xs border border-cyan-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Globe size={13} className="text-cyan-600 shrink-0" /> {i18n.scopeInternational(stats.internationalCount ?? 0)}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 w-full sm:w-auto sm:min-w-[200px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder={i18n.searchPlaceholder}
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); reload(e.target.value, undefined, undefined, 1) }}
                                className="w-full pl-9 pr-4 py-2 rounded-md text-sm outline-none transition-colors border border-slate-200 bg-white text-slate-900 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" />
                        </div>
                        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); reload(undefined, e.target.value, undefined, 1) }}
                            className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer border border-slate-200 bg-white text-slate-900 focus:border-cyan-600">
                            <option value="">{i18n.allTypes(Object.keys(SUPPLIER_TYPE_STYLE).length)}</option>
                            <optgroup label={i18n.groupDomesticServices}>
                                <option value="LOGISTICS">{i18n.types.LOGISTICS}</option>
                                <option value="PACKAGING">{i18n.types.PACKAGING}</option>
                                <option value="POSM">{i18n.types.POSM}</option>
                                <option value="MARKETING_EVENT">{i18n.types.MARKETING_EVENT}</option>
                                <option value="OFFICE_SERVICE">{i18n.types.OFFICE_SERVICE}</option>
                                <option value="OTHER_SERVICE">{i18n.types.OTHER_SERVICE}</option>
                            </optgroup>
                            <optgroup label={i18n.groupInternationalImport}>
                                <option value="WINERY">{i18n.types.WINERY}</option>
                                <option value="NEGOCIANT">{i18n.types.NEGOCIANT}</option>
                                <option value="DISTRIBUTOR">{i18n.types.DISTRIBUTOR}</option>
                                <option value="FORWARDER">{i18n.types.FORWARDER}</option>
                                <option value="CUSTOMS_BROKER">{i18n.types.CUSTOMS_BROKER}</option>
                            </optgroup>
                        </select>
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); reload(undefined, undefined, e.target.value, 1) }}
                            className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer border border-slate-200 bg-white text-slate-900 focus:border-cyan-600">
                            <option value="">{i18n.allStatuses}</option>
                            <option value="ACTIVE">{i18n.statusActive}</option><option value="INACTIVE">{i18n.statusInactive}</option><option value="BLACKLISTED">{i18n.statusBlacklisted}</option>
                        </select>
                        {(search || typeFilter || statusFilter || regionScope !== 'ALL') && (
                            <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setRegionScope('ALL'); setPage(1); reload('', '', '', 1, 'ALL') }}
                                className="px-3 py-2 rounded-md text-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">{i18n.clearFilter}</button>
                        )}
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                    {[i18n.colSupplier, i18n.colType, i18n.colCountry, i18n.colTradeCo, i18n.colPayment, i18n.colLeadTime, i18n.colOrders, i18n.colStatus, ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded animate-pulse" style={{ background: '#E2E8F0', width: j === 0 ? '80%' : '55%' }} /></td>)}
                                    </tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className="flex flex-col items-center py-16 gap-3">
                                            <Factory className="w-10 h-10 text-slate-300" />
                                            <p style={{ color: '#64748B' }} className="text-sm">{i18n.emptySuppliers}</p>
                                        </div>
                                    </td></tr>
                                ) : rows.map(row => {
                                    const isDomestic = row.country === 'VN' || row.country === 'Việt Nam' || row.country === 'Vietnam'
                                    return (
                                        <tr key={row.id} className="group transition-colors duration-100 cursor-pointer hover:bg-[#F8FAFC]"
                                            style={{ borderBottom: '1px solid #E2E8F0' }}
                                            onClick={() => { setDetailId(row.id); setDetailOpen(true) }}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{row.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-mono font-bold" style={{ color: '#0E7490' }}>{row.code}</span>
                                                    {row.taxId && <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600 whitespace-nowrap shrink-0">{i18n.taxIdPrefix} {row.taxId}</span>}
                                                </div>
                                                {row.bankAccountInfo && (
                                                    <p className="text-[11px] mt-1 text-slate-500 truncate max-w-xs font-mono flex items-center gap-1" title={row.bankAccountInfo}>
                                                        <CreditCard size={11} className="text-slate-400 shrink-0" />
                                                        <span>{row.bankAccountInfo}</span>
                                                    </p>
                                                )}
                                                {row.contactName && (
                                                    <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#1D4ED8' }}>
                                                        <User size={10} className="text-blue-600 shrink-0" />
                                                        <span>{row.contactName}</span>
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
                                            <td className="px-4 py-3 text-sm" style={{ color: '#475569' }}>
                                                <span className="inline-flex items-center gap-1.5 font-medium">
                                                    <Globe size={13} className="text-slate-400 shrink-0" />
                                                    <span>{isDomestic ? i18n.vietnamLabel : (i18n.countries[row.country] ?? row.country)}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isDomestic ? (
                                                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap shrink-0">
                                                        {i18n.domesticBadge}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <p className="text-xs font-semibold" style={{ color: row.tradeAgreement ? '#15803D' : '#64748B' }}>{row.tradeAgreement ?? 'MFN'}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{row.coFormType ?? '—'}</p>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-mono font-semibold" style={{ color: '#334155' }}>{row.paymentTerm ?? 'NET30'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{row.defaultCurrency}</p>
                                            </td>
                                            <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: '#475569' }}><Clock size={12} /> {row.leadTimeDays} {i18n.daysUnit}</span></td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm font-bold font-mono" style={{ color: row.poCount > 0 ? '#0E7490' : '#E2E8F0' }}>{row.poCount}</span>
                                            </td>
                                            <td className="px-4 py-3"><StatusDot status={row.status} /></td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => { setDetailId(row.id); setDetailOpen(true) }}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#1D4ED8' }} title={i18n.view360Title}>
                                                        <Eye size={14} />
                                                    </button>
                                                    <button onClick={() => { setEditingId(row.id); setDrawerOpen(true) }}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#475569' }} title={i18n.editTitle}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id, row.name)}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#64748B' }} title={i18n.deleteTitle}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden space-y-2.5">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-4 rounded-lg bg-white border border-slate-200 animate-pulse space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-2/3" />
                                <div className="h-3 bg-slate-100 rounded w-1/2" />
                            </div>
                        ))
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center py-12 gap-3 bg-white rounded-lg border border-slate-200">
                            <Factory className="w-10 h-10 text-slate-300" />
                            <p style={{ color: '#64748B' }} className="text-sm">{i18n.emptySuppliers}</p>
                        </div>
                    ) : (
                        rows.map(row => (
                            <SupplierMobileCard
                                key={row.id}
                                row={row}
                                onViewDetail={() => { setDetailId(row.id); setDetailOpen(true) }}
                                onEdit={() => { setEditingId(row.id); setDrawerOpen(true) }}
                                onDelete={() => handleDelete(row.id, row.name)}
                            />
                        ))
                    )}
                </div>

                {total > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-lg border border-slate-200 bg-white">
                        <p className="text-xs" style={{ color: '#64748B' }}>
                            {i18n.showingRange((page - 1) * 25 + 1, Math.min(page * 25, total), total)}
                        </p>
                        <div className="flex items-center gap-1 flex-wrap justify-center">
                            {Array.from({ length: Math.ceil(total / 25) }).map((_, i) => (
                                <button key={i} onClick={() => { setPage(i + 1); reload(undefined, undefined, undefined, i + 1) }}
                                    className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium cursor-pointer"
                                    style={{ background: page === i + 1 ? '#0E7490' : 'transparent', color: page === i + 1 ? '#F8FAFC' : '#475569' }}>
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </>)}

            {/* Tab: Scorecard */}
            {activeTab === 'scorecard' && (
                <div>
                    {scoreLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2 rounded-lg border border-slate-200 bg-slate-50"><Loader2 size={16} className="animate-spin" style={{ color: '#0891B2' }} /><span className="text-sm" style={{ color: '#64748B' }}>{i18n.loadingScorecard}</span></div>
                    ) : scorecards && scorecards.length > 0 ? (
                        <>
                            {/* Desktop Scorecard Table */}
                            <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                                {[i18n.scColSupplier, i18n.scColOnTime, i18n.scColQuality, i18n.scColAvgLeadTime, i18n.scColTotalPo, i18n.scColGrade].map(h => (
                                                    <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: '#64748B' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {scorecards.map(sc => {
                                                const gc = GRADE_COLOR[sc.grade] ?? GRADE_COLOR.C
                                                return (
                                                    <tr key={sc.supplierId} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                        <td className="px-4 py-3 whitespace-nowrap"><p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{sc.supplierName}</p></td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1.5 rounded-full" style={{ background: '#E2E8F0' }}>
                                                                    <div className="h-full rounded-full" style={{ background: sc.onTimeRate >= 90 ? '#15803D' : sc.onTimeRate >= 70 ? '#B45309' : '#B91C1C', width: `${Math.min(sc.onTimeRate, 100)}%` }} />
                                                                </div>
                                                                <span className="text-xs font-bold" style={{ color: sc.onTimeRate >= 90 ? '#15803D' : sc.onTimeRate >= 70 ? '#B45309' : '#B91C1C' }}>{sc.onTimeRate.toFixed(0)}%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap"><span className="text-xs font-bold" style={{ color: sc.qualityScore >= 90 ? '#15803D' : '#B45309' }}>{sc.qualityScore.toFixed(0)}/100</span></td>
                                                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#475569' }}>{sc.avgLeadTimeDays.toFixed(0)} {i18n.daysUnit}</td>
                                                        <td className="px-4 py-3 text-xs text-center whitespace-nowrap" style={{ color: '#0891B2' }}>{sc.totalPOs}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold" style={{ background: gc.bg, color: gc.color }}>{sc.grade}</span></td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Scorecard Cards */}
                            <div className="block md:hidden space-y-2.5">
                                {scorecards.map(sc => {
                                    const gc = GRADE_COLOR[sc.grade] ?? GRADE_COLOR.C
                                    return (
                                        <div key={sc.supplierId} className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-sm font-bold text-slate-900 truncate">{sc.supplierName}</h4>
                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0" style={{ background: gc.bg, color: gc.color }}>{sc.grade}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.scColOnTime}</span>
                                                    <span className="font-mono font-bold mt-0.5 block" style={{ color: sc.onTimeRate >= 90 ? '#15803D' : sc.onTimeRate >= 70 ? '#B45309' : '#B91C1C' }}>{sc.onTimeRate.toFixed(0)}%</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.scColQuality}</span>
                                                    <span className="font-mono font-bold mt-0.5 block" style={{ color: sc.qualityScore >= 90 ? '#15803D' : '#B45309' }}>{sc.qualityScore.toFixed(0)}/100</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.scColAvgLeadTime}</span>
                                                    <span className="font-medium text-slate-800 mt-0.5 block">{sc.avgLeadTimeDays.toFixed(0)} {i18n.daysUnit}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-medium">{i18n.scColTotalPo}</span>
                                                    <span className="font-mono font-bold text-cyan-700 mt-0.5 block">{sc.totalPOs}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    ) : <div className="text-center py-16 text-sm rounded-lg border border-slate-200 bg-slate-50" style={{ color: '#64748B' }}>{i18n.emptyScorecard}</div>}
                </div>
            )}

            {/* Tab: Duplicate Detection */}
            {activeTab === 'duplicates' && (
                <div className="space-y-3">
                    {dupLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2"><Loader2 size={16} className="animate-spin" style={{ color: '#B45309' }} /><span className="text-sm" style={{ color: '#64748B' }}>{i18n.scanningDuplicates}</span></div>
                    ) : duplicates && duplicates.length > 0 ? (
                        duplicates.map((dup, i) => (
                            <div key={i} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid rgba(180,83,9,0.3)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="inline-block text-xs font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#B45309', background: 'rgba(180,83,9,0.12)' }}>
                                        {dup.type === 'PRODUCT' ? i18n.dupTypeProduct : dup.type === 'CUSTOMER' ? i18n.dupTypeCustomer : i18n.dupTypeSupplier}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: '#B45309' }}>{i18n.dupSimilarity(dup.similarity)}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                        <p className="text-xs" style={{ color: '#64748B' }}>{i18n.dupItem1}</p>
                                        <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{dup.itemA.name}</p>
                                    </div>
                                    <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                        <p className="text-xs" style={{ color: '#64748B' }}>{i18n.dupItem2}</p>
                                        <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{dup.itemB.name}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                            <p className="text-sm mt-3" style={{ color: '#15803D' }}>{i18n.noDuplicates}</p>
                        </div>
                    )}
                </div>
            )}

            <SupplierDrawer open={drawerOpen} editingId={editingId}
                onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); reload() }} />

            <SupplierDetailDrawer open={detailOpen} supplierId={detailId}
                onClose={() => setDetailOpen(false)} />

            <ExcelImportDialog open={importOpen} onClose={() => setImportOpen(false)}
                title={i18n.importDialogTitle} templateFileName="template_nha_cung_cap.xlsx"
                templateColumns={[
                    { header: 'Mã NCC', sample: 'SUP-MOUTON', required: true },
                    { header: 'Tên NCC', sample: 'Château Mouton Rothschild', required: true },
                    { header: 'Loại', sample: 'WINERY', required: true },
                    { header: 'Quốc Gia', sample: 'FR', required: true },
                    { header: 'MST', sample: 'FR123456789' },
                    { header: 'Hiệp Định', sample: 'EVFTA' },
                    { header: 'Thanh Toán', sample: 'NET30' },
                    { header: 'Tiền Tệ', sample: 'EUR' },
                    { header: 'Incoterms', sample: 'CIF' },
                    { header: 'Lead Time', sample: '45' },
                    { header: 'Website', sample: 'https://mouton.com' },
                    { header: 'Người Liên Hệ', sample: 'Jean-Pierre' },
                    { header: 'Email', sample: 'jp@mouton.com' },
                    { header: 'SĐT', sample: '+33 1 2345 6789' },
                ]}
                onImport={bulkImportSuppliers} onComplete={() => reload()} />
            {confirmDialog}
        </div>
    )
}
