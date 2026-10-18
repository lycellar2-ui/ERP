'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Building2, Package, DollarSign, FileText, Ship, MessageSquare, Clock, TrendingUp, Award, Globe, Phone, Mail, MapPin, ExternalLink, Shield, AlertTriangle, Plus, Trash2, CreditCard, Users } from 'lucide-react'
import {
    getSupplierDetail, getSupplierPOs, getSupplierAPInvoices, getSupplierContracts,
    getSupplierShipments, getSupplierProducts, getSupplierPricingHistory,
    getSupplierActivities, createSupplierActivity, getSupplierScorecard,
    createSupplierContact, deleteSupplierContact,
    createSupplierAddress, deleteSupplierAddress,
    type SupplierDetail, type SupplierPO, type SupplierAPInvoice, type SupplierContract,
    type SupplierShipment, type SupplierProduct, type PricingPoint, type SupplierScorecard,
} from './actions'
import { getSupplierRegDocs } from '../contracts/reg-doc-xmodule'
import { REG_DOC_TYPE_LABELS, REG_DOC_STATUS_LABELS } from '../contracts/reg-doc-constants'
import { useAppLocale } from '@/lib/i18n'
import { SUPPLIERS_I18N } from './i18n'
import { useConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'

const PO_STATUS_COLOR: Record<string, { color: string; bg: string }> = {
    DRAFT: { color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
    CONFIRMED: { color: '#1D4ED8', bg: 'rgba(29,78,216,0.15)' },
    SHIPPED: { color: '#B45309', bg: 'rgba(180,83,9,0.15)' },
    RECEIVED: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' },
    CANCELLED: { color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
}

const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
    A: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' },
    B: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    C: { color: '#B45309', bg: 'rgba(180,83,9,0.15)' },
    D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
    F: { color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
}

function ActivityIcon({ type }: { type: string }) {
    switch (type) {
        case 'CALL': return <Phone size={14} className="text-blue-600" />
        case 'EMAIL': return <Mail size={14} className="text-amber-600" />
        case 'VISIT': return <Users size={14} className="text-emerald-600" />
        case 'PO_CREATED': return <Package size={14} className="text-cyan-600" />
        case 'CONTRACT_SIGNED': return <FileText size={14} className="text-lys-teal-strong" />
        case 'NOTE':
        default: return <FileText size={14} className="text-slate-500" />
    }
}

type Tab = 'overview' | 'orders' | 'finance' | 'contracts' | 'shipments' | 'docs' | 'notes'

function InfoRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
    return (
        <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
            <span className="text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</span>
            <span className="text-sm font-semibold" style={{ color: accent ?? '#0F172A' }}>{value}</span>
        </div>
    )
}

function MiniCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
    return (
        <div className="p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#64748B' }}>{label}</p>
            <p className="text-lg font-bold mt-0.5 font-mono" style={{ color: accent }}>{value}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const cfg = PO_STATUS_COLOR[status] ?? { color: '#64748B', bg: 'rgba(100,116,139,0.15)' }
    return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{status}</span>
}

export function SupplierDetailDrawer({ open, supplierId, onClose }: {
    open: boolean; supplierId: string | null; onClose: () => void
}) {
    const { locale, formatCurrency, formatDate, formatNumber } = useAppLocale()
    const i18n = SUPPLIERS_I18N[locale]
    const [tab, setTab] = useState<Tab>('overview')
    const [detail, setDetail] = useState<SupplierDetail | null>(null)
    const [scorecard, setScorecard] = useState<SupplierScorecard | null>(null)
    const [loading, setLoading] = useState(false)
    const [pos, setPOs] = useState<SupplierPO[] | null>(null)
    const [invoices, setInvoices] = useState<SupplierAPInvoice[] | null>(null)
    const [contracts, setContracts] = useState<SupplierContract[] | null>(null)
    const [shipments, setShipments] = useState<SupplierShipment[] | null>(null)
    const [products, setProducts] = useState<SupplierProduct[] | null>(null)
    const [pricing, setPricing] = useState<PricingPoint[] | null>(null)
    const [activities, setActivities] = useState<any[] | null>(null)
    const [newNote, setNewNote] = useState('')
    const [noteType, setNoteType] = useState('NOTE')
    const [savingNote, setSavingNote] = useState(false)
    const [regDocs, setRegDocs] = useState<any[] | null>(null)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // Secondary contacts state
    const [showContactForm, setShowContactForm] = useState(false)
    const [contactName, setContactName] = useState('')
    const [contactTitle, setContactTitle] = useState('')
    const [contactEmail, setContactEmail] = useState('')
    const [contactPhone, setContactPhone] = useState('')
    const [contactIsPrimary, setContactIsPrimary] = useState(false)
    const [savingContact, setSavingContact] = useState(false)

    const handleAddContact = async () => {
        if (!supplierId || !contactName.trim()) return
        setSavingContact(true)
        try {
            const res = await createSupplierContact({
                supplierId,
                name: contactName.trim(),
                title: contactTitle.trim() || null,
                email: contactEmail.trim() || null,
                phone: contactPhone.trim() || null,
                isPrimary: contactIsPrimary,
            })
            if (res.success) {
                toast.success(i18n.contactAddedToast)
                // Reset form
                setContactName('')
                setContactTitle('')
                setContactEmail('')
                setContactPhone('')
                setContactIsPrimary(false)
                setShowContactForm(false)
                // Reload details
                const freshDetail = await getSupplierDetail(supplierId)
                setDetail(freshDetail)
            } else {
                toast.error(res.error ?? i18n.contactAddErrorToast)
            }
        } catch (err: any) {
            toast.error(err.message ?? i18n.genericErrorToast)
        } finally {
            setSavingContact(false)
        }
    }

    const handleDeleteContact = (contactId: string, name: string) => {
        confirm({
            title: i18n.deleteContactTitle,
            message: i18n.deleteContactMsg(name),
            confirmLabel: i18n.btnDelete,
            cancelLabel: i18n.cancelBtn,
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await deleteSupplierContact(contactId)
                    if (res.success) {
                        toast.success(i18n.contactDeletedToast(name))
                        if (supplierId) {
                            const freshDetail = await getSupplierDetail(supplierId)
                            setDetail(freshDetail)
                        }
                    } else {
                        toast.error(res.error ?? i18n.contactDeleteErrorToast)
                    }
                } catch (err: any) {
                    toast.error(err.message ?? i18n.genericErrorToast)
                }
            }
        })
    }

    // Secondary addresses state
    const [showAddressForm, setShowAddressForm] = useState(false)
    const [addressLabel, setAddressLabel] = useState('Warehouse')
    const [addressVal, setAddressVal] = useState('')
    const [addressCity, setAddressCity] = useState('')
    const [addressRegion, setAddressRegion] = useState('')
    const [addressCountry, setAddressCountry] = useState('')
    const [addressIsDefault, setAddressIsDefault] = useState(false)
    const [savingAddress, setSavingAddress] = useState(false)

    const handleAddAddress = async () => {
        if (!supplierId || !addressVal.trim()) return
        setSavingAddress(true)
        try {
            const res = await createSupplierAddress({
                supplierId,
                label: addressLabel,
                address: addressVal.trim(),
                city: addressCity.trim() || null,
                region: addressRegion.trim() || null,
                country: addressCountry.trim() || detail?.supplier.country || 'VN',
                isDefault: addressIsDefault,
            })
            if (res.success) {
                toast.success(i18n.addressAddedToast)
                setAddressVal('')
                setAddressCity('')
                setAddressRegion('')
                setAddressCountry('')
                setAddressIsDefault(false)
                setShowAddressForm(false)
                const freshDetail = await getSupplierDetail(supplierId)
                setDetail(freshDetail)
            } else {
                toast.error(res.error ?? i18n.addressAddErrorToast)
            }
        } catch (err: any) {
            toast.error(err.message ?? i18n.genericErrorToast)
        } finally {
            setSavingAddress(false)
        }
    }

    const handleDeleteAddress = (addressId: string, label: string) => {
        confirm({
            title: i18n.deleteAddressTitle,
            message: i18n.deleteAddressMsg(label),
            confirmLabel: i18n.btnDelete,
            cancelLabel: i18n.cancelBtn,
            danger: true,
            onConfirm: async () => {
                try {
                    const res = await deleteSupplierAddress(addressId)
                    if (res.success) {
                        toast.success(i18n.addressDeletedToast(label))
                        if (supplierId) {
                            const freshDetail = await getSupplierDetail(supplierId)
                            setDetail(freshDetail)
                        }
                    } else {
                        toast.error(res.error ?? i18n.addressDeleteErrorToast)
                    }
                } catch (err: any) {
                    toast.error(err.message ?? i18n.genericErrorToast)
                }
            }
        })
    }

    useEffect(() => {
        if (!open || !supplierId) { setDetail(null); setTab('overview'); return }
        setLoading(true)
        setPOs(null); setInvoices(null); setContracts(null); setShipments(null); setProducts(null); setPricing(null); setActivities(null); setRegDocs(null)
        Promise.all([
            getSupplierDetail(supplierId),
            getSupplierScorecard(supplierId),
        ]).then(([d, sc]) => { setDetail(d); setScorecard(sc) }).finally(() => setLoading(false))
    }, [open, supplierId])

    const loadTab = async (t: Tab) => {
        setTab(t)
        if (!supplierId) return
        if (t === 'orders' && !pos) { setPOs(await getSupplierPOs(supplierId)); setProducts(await getSupplierProducts(supplierId)); setPricing(await getSupplierPricingHistory(supplierId)) }
        if (t === 'finance' && !invoices) setInvoices(await getSupplierAPInvoices(supplierId))
        if (t === 'contracts' && !contracts) setContracts(await getSupplierContracts(supplierId))
        if (t === 'shipments' && !shipments) setShipments(await getSupplierShipments(supplierId))
        if (t === 'docs' && !regDocs) setRegDocs(await getSupplierRegDocs(supplierId))
        if (t === 'notes' && !activities) setActivities(await getSupplierActivities(supplierId))
    }

    const handleAddNote = async () => {
        if (!supplierId || !newNote.trim()) return
        setSavingNote(true)
        await createSupplierActivity({ supplierId, type: noteType, description: newNote.trim() })
        setActivities(await getSupplierActivities(supplierId))
        setNewNote('')
        setSavingNote(false)
    }

    const fmtDate = (d: Date | null) => d ? formatDate(d) : '—'
    const fmtCurrency = (v: number, c?: string) => c === 'VND' ? formatCurrency(v) : `${c ?? 'USD'} ${formatNumber(v)}`

    const TABS: { key: Tab; label: string; icon: any }[] = [
        { key: 'overview', label: i18n.dtTabOverview, icon: Building2 },
        { key: 'orders', label: i18n.dtTabOrders, icon: Package },
        { key: 'finance', label: i18n.dtTabFinance, icon: DollarSign },
        { key: 'contracts', label: i18n.dtTabContracts, icon: FileText },
        { key: 'shipments', label: i18n.dtTabShipments, icon: Ship },
        { key: 'docs', label: i18n.dtTabDocs, icon: Shield },
        { key: 'notes', label: i18n.dtTabNotes, icon: MessageSquare },
    ]

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div
                className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ width: 'min(720px, 97vw)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900">
                                {detail?.supplier.name ?? i18n.loadingText}
                            </h3>
                            <p className="text-xs font-mono text-slate-500">
                                {detail?.supplier.code ?? ''}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 px-4 pt-3 pb-0 flex-shrink-0 overflow-x-auto no-scrollbar">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => loadTab(t.key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg transition-all whitespace-nowrap"
                            style={{
                                background: tab === t.key ? '#FFFFFF' : 'transparent',
                                color: tab === t.key ? '#0E7490' : '#64748B',
                                borderBottom: tab === t.key ? '2px solid #0E7490' : '2px solid transparent',
                            }}>
                            <t.icon size={12} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
                    ) : !detail ? (
                        <div className="text-center py-20 text-sm" style={{ color: '#64748B' }}>{i18n.notFoundSupplier}</div>
                    ) : (
                        <>
                            {/* ── OVERVIEW ── */}
                            {tab === 'overview' && (
                                <div className="space-y-5">
                                    {/* Scorecard badge */}
                                    {scorecard && (
                                        <div className="flex items-center gap-4 p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold"
                                                style={{ background: GRADE_COLOR[scorecard.grade]?.bg, color: GRADE_COLOR[scorecard.grade]?.color }}>
                                                {scorecard.grade}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#64748B' }}>{i18n.scTitle}</p>
                                                <div className="flex gap-4 mt-1">
                                                    <span className="text-xs" style={{ color: '#475569' }}>{i18n.scScore} <b style={{ color: '#0F172A' }}>{scorecard.overallScore}/100</b></span>
                                                    <span className="text-xs" style={{ color: '#475569' }}>{i18n.scOnTime} <b style={{ color: '#15803D' }}>{scorecard.onTimeRate}%</b></span>
                                                    <span className="text-xs" style={{ color: '#475569' }}>{i18n.scQuality} <b style={{ color: '#0891B2' }}>{scorecard.qualityScore}/100</b></span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                                        <MiniCard label={i18n.miniPoOrders} value={detail.poSummary.total} accent="#0E7490" />
                                        <MiniCard label={i18n.miniTotalPo} value={fmtCurrency(detail.poSummary.totalValue, detail.supplier.defaultCurrency)} accent="#15803D" />
                                        <MiniCard label={i18n.miniApUnpaid} value={fmtCurrency(detail.apSummary.unpaidAmount, detail.supplier.defaultCurrency)} accent={detail.apSummary.unpaidAmount > 0 ? '#B45309' : '#15803D'} />
                                        <MiniCard label={i18n.miniProducts} value={detail.productCount} accent="#1D4ED8" />
                                    </div>

                                    {/* Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-0">
                                            <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#0891B2' }}>{i18n.secTradeLegal}</p>
                                            <InfoRow label={i18n.infoPartnerType} value={i18n.types[detail.supplier.type] ?? detail.supplier.type} />
                                            <InfoRow label={i18n.infoCountry} value={detail.supplier.country === 'VN' || detail.supplier.country === 'Việt Nam' ? i18n.vietnamDomesticLabel : (i18n.countries[detail.supplier.country] ?? detail.supplier.country)} />
                                            <InfoRow 
                                                label={i18n.infoAgreement} 
                                                value={detail.supplier.country === 'VN' || detail.supplier.country === 'Việt Nam' ? i18n.domesticBadge : (detail.supplier.tradeAgreement ?? 'MFN')} 
                                                accent={detail.supplier.country === 'VN' || detail.supplier.country === 'Việt Nam' ? '#15803D' : detail.supplier.tradeAgreement ? '#15803D' : '#64748B'} 
                                            />
                                            <InfoRow label={i18n.infoCoForm} value={detail.supplier.country === 'VN' || detail.supplier.country === 'Việt Nam' ? i18n.coDomesticPlaceholder : (detail.supplier.coFormType ?? '—')} />
                                            <InfoRow label={i18n.infoIncoterms} value={detail.supplier.incoterms ?? '—'} />
                                            <InfoRow label={i18n.infoPaymentTerm} value={detail.supplier.paymentTerm ?? '—'} />
                                            <InfoRow label={i18n.infoDefaultCurrency} value={detail.supplier.defaultCurrency} />
                                            <InfoRow label={i18n.infoLeadTime} value={`${detail.supplier.leadTimeDays} ${i18n.daysUnit}`} />
                                            <InfoRow label={i18n.infoTaxId} value={detail.supplier.taxId ?? '—'} />
                                            {detail.supplier.bankAccountInfo && (
                                                <InfoRow label={i18n.infoBankAccount} value={<span className="font-mono text-xs">{detail.supplier.bankAccountInfo}</span>} />
                                            )}
                                        </div>
                                        <div className="space-y-4">
                                            {/* Contacts */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secContacts}</p>
                                                    <button onClick={() => setShowContactForm(!showContactForm)}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                                                        style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                                                        <Plus size={10} /> {i18n.btnAdd}
                                                    </button>
                                                </div>

                                                {/* Add contact inline form */}
                                                {showContactForm && (
                                                    <div className="p-3 rounded-lg mb-3 space-y-2.5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0891B2' }}>{i18n.addSecondaryContact}</p>
                                                        <div>
                                                            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)}
                                                                placeholder={i18n.placeholderContactNameReq} className="w-full px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input type="text" value={contactTitle} onChange={e => setContactTitle(e.target.value)}
                                                                placeholder={i18n.placeholderPosition} className="px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                            <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                                                                placeholder={i18n.placeholderPhone} className="px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>
                                                        <div>
                                                            <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                                                                placeholder="Email" className="w-full px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>
                                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                                            <input type="checkbox" checked={contactIsPrimary} onChange={e => setContactIsPrimary(e.target.checked)} className="w-3.5 h-3.5 accent-[#0E7490]" />
                                                            <span className="text-[10px]" style={{ color: '#475569' }}>{i18n.setAsPrimaryContact}</span>
                                                        </label>
                                                        <div className="flex justify-end gap-2 pt-1">
                                                            <button onClick={() => setShowContactForm(false)} className="text-[10px] px-2 py-1" style={{ color: '#64748B' }}>{i18n.btnCancel}</button>
                                                            <button onClick={handleAddContact} disabled={!contactName.trim() || savingContact}
                                                                className="text-[10px] px-3 py-1 rounded font-semibold disabled:opacity-50"
                                                                style={{ background: '#0E7490', color: '#FFFFFF' }}>
                                                                {savingContact ? i18n.btnCreating : i18n.btnSave}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {detail.contacts.length > 0 ? detail.contacts.map(c => (
                                                    <div key={c.id} className="p-3 rounded-lg mb-2 relative group" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{c.name}</span>
                                                                {c.isPrimary && <span className="inline-block text-xs px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0" style={{ color: '#15803D', background: 'rgba(21,128,61,0.15)' }}>{i18n.primaryBadge}</span>}
                                                            </div>
                                                            {!c.isPrimary && (
                                                                <button onClick={() => handleDeleteContact(c.id, c.name)}
                                                                    className="p-1 rounded transition-all opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-[#B91C1C] hover:bg-[#B91C1C]/12"
                                                                    title={i18n.deleteContactTitle}>
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {c.title && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{c.title}</p>}
                                                        {c.phone && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#475569' }}><Phone size={10} /> {c.phone}</p>}
                                                        {c.email && <p className="text-xs flex items-center gap-1" style={{ color: '#475569' }}><Mail size={10} /> {c.email}</p>}
                                                    </div>
                                                )) : <p className="text-xs" style={{ color: '#64748B' }}>{i18n.noContacts}</p>}
                                            </div>
                                            {/* Addresses */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secAddresses}</p>
                                                    <button onClick={() => setShowAddressForm(!showAddressForm)}
                                                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
                                                        style={{ background: 'rgba(8, 145, 178, 0.08)', color: '#0891B2', border: '1px solid rgba(8, 145, 178, 0.15)' }}>
                                                        <Plus size={10} /> {i18n.btnAdd}
                                                    </button>
                                                </div>

                                                {/* Add address inline form */}
                                                {showAddressForm && (
                                                    <div className="p-3 rounded-lg mb-3 space-y-2.5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0891B2' }}>{i18n.addNewAddress}</p>
                                                        
                                                        {/* Label Select Dropdown */}
                                                        <div>
                                                            <label className="block text-xs uppercase tracking-wider font-bold mb-1" style={{ color: '#64748B' }}>{i18n.labelAddressType}</label>
                                                            <select value={addressLabel} onChange={e => setAddressLabel(e.target.value)}
                                                                className="w-full px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none cursor-pointer">
                                                                <option value="Warehouse">{i18n.addrWarehouse}</option>
                                                                <option value="Pickup Point">{i18n.addrPickup}</option>
                                                                <option value="Office">{i18n.addrOffice}</option>
                                                                <option value="Port of Loading">{i18n.addrPort}</option>
                                                                <option value="Headquarter">{i18n.addrHq}</option>
                                                            </select>
                                                        </div>

                                                        {/* Address Input */}
                                                        <div>
                                                            <input type="text" value={addressVal} onChange={e => setAddressVal(e.target.value)}
                                                                placeholder={i18n.placeholderAddressReq} className="w-full px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>

                                                        {/* City & Region */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input type="text" value={addressCity} onChange={e => setAddressCity(e.target.value)}
                                                                placeholder={i18n.placeholderCity} className="px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                            <input type="text" value={addressRegion} onChange={e => setAddressRegion(e.target.value)}
                                                                placeholder={i18n.placeholderRegion} className="px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>

                                                        {/* Country */}
                                                        <div>
                                                            <input type="text" value={addressCountry} onChange={e => setAddressCountry(e.target.value)}
                                                                placeholder={i18n.placeholderCountryCode(detail.supplier.country)} className="w-full px-2 py-1.5 rounded bg-white border border-slate-200 text-xs text-slate-900 outline-none" />
                                                        </div>

                                                        {/* Default checkbox */}
                                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                                            <input type="checkbox" checked={addressIsDefault} onChange={e => setAddressIsDefault(e.target.checked)} className="w-3.5 h-3.5 accent-[#0E7490]" />
                                                            <span className="text-[10px]" style={{ color: '#475569' }}>{i18n.setAsDefaultAddress}</span>
                                                        </label>

                                                        {/* Buttons */}
                                                        <div className="flex justify-end gap-2 pt-1">
                                                            <button onClick={() => setShowAddressForm(false)} className="text-[10px] px-2 py-1" style={{ color: '#64748B' }}>{i18n.btnCancel}</button>
                                                            <button onClick={handleAddAddress} disabled={!addressVal.trim() || savingAddress}
                                                                className="text-[10px] px-3 py-1 rounded font-semibold disabled:opacity-50"
                                                                style={{ background: '#0E7490', color: '#FFFFFF' }}>
                                                                {savingAddress ? i18n.btnCreating : i18n.btnSave}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {detail.addresses.length > 0 ? detail.addresses.map(a => (
                                                    <div key={a.id} className="p-3 rounded-lg mb-2 relative group" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold" style={{ color: '#475569' }}>{a.label}</span>
                                                                {a.isDefault && <span className="inline-block text-xs px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0" style={{ color: '#15803D', background: 'rgba(21,128,61,0.15)' }}>{i18n.defaultBadge}</span>}
                                                            </div>
                                                            {!a.isDefault && (
                                                                <button onClick={() => handleDeleteAddress(a.id, a.label)}
                                                                    className="p-1 rounded transition-all opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-[#B91C1C] hover:bg-[#B91C1C]/12"
                                                                    title={i18n.deleteAddressTitle}>
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#0F172A' }}><MapPin size={10} /> {a.address}</p>
                                                        {(a.city || a.region || a.country) && <p className="text-xs" style={{ color: '#64748B' }}>{[a.city, a.region, a.country].filter(Boolean).join(', ')}</p>}
                                                    </div>
                                                )) : <p className="text-xs" style={{ color: '#64748B' }}>{i18n.noAddresses}</p>}
                                            </div>
                                            {detail.supplier.website && (
                                                <a href={detail.supplier.website} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-1.5 text-xs" style={{ color: '#1D4ED8' }}>
                                                    <ExternalLink size={11} /> {detail.supplier.website}
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {(detail.supplier.pickupInfo || detail.supplier.bankAccountInfo) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {detail.supplier.pickupInfo && (
                                                <div className="p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                    <p className="text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                                        <MapPin size={12} className="shrink-0" /> {i18n.boxPickupInfo}
                                                    </p>
                                                    <p className="text-xs whitespace-pre-wrap" style={{ color: '#475569' }}>{detail.supplier.pickupInfo}</p>
                                                </div>
                                            )}
                                            {detail.supplier.bankAccountInfo && (
                                                <div className="p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                    <p className="text-[10px] uppercase tracking-wider font-bold mb-1 flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                                        <CreditCard size={12} className="shrink-0" /> {i18n.boxBankAccount}
                                                    </p>
                                                    <p className="text-xs whitespace-pre-wrap" style={{ color: '#475569' }}>{detail.supplier.bankAccountInfo}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {detail.supplier.notes && (
                                        <div className="p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#64748B' }}>{i18n.boxNotes}</p>
                                            <p className="text-xs whitespace-pre-wrap" style={{ color: '#475569' }}>{detail.supplier.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── ORDERS ── */}
                            {tab === 'orders' && (
                                <div className="space-y-5">
                                    {/* PO list */}
                                    <div>
                                        <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#0891B2' }}>{i18n.secPoHistory}</p>
                                        {!pos ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                            pos.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>{i18n.noPo}</p> : (
                                                <div className="space-y-2">
                                                    {pos.map(po => (
                                                        <div key={po.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                            <div>
                                                                <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{po.poNo}</span>
                                                                <span className="text-xs ml-3" style={{ color: '#64748B' }}>{fmtDate(po.createdAt)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-semibold" style={{ color: '#0891B2' }}>
                                                                    {fmtCurrency(po.totalValue, po.currency)}
                                                                </span>
                                                                <StatusBadge status={po.status} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                    </div>

                                    {/* Products */}
                                    {products && products.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#0891B2' }}>{i18n.secProductCatalog(products.length)}</p>
                                            <div className="space-y-1.5">
                                                {products.slice(0, 15).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                                        <div>
                                                            <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{p.productName}</span>
                                                            <span className="text-[10px] ml-2" style={{ color: '#64748B' }}>{p.skuCode}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px]">
                                                            <span style={{ color: '#475569' }}>{formatNumber(p.totalQty)} {i18n.bottlesUnit}</span>
                                                            <span style={{ color: '#0891B2' }}>~${p.avgUnitPrice}</span>
                                                            <span style={{ color: '#64748B' }}>{p.orderCount} PO</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Pricing trend */}
                                    {pricing && pricing.length > 0 && (
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: '#0891B2' }}>
                                                <TrendingUp size={11} className="inline mr-1" /> {i18n.secPriceHistory}
                                            </p>
                                            <div className="space-y-1">
                                                {pricing.slice(0, 20).map((p, i) => (
                                                    <div key={i} className="inline-flex items-center justify-between text-xs py-1.5 px-3 rounded whitespace-nowrap shrink-0" style={{ background: i % 2 === 0 ? '#FFFFFF' : 'transparent' }}>
                                                        <span style={{ color: '#64748B' }}>{fmtDate(p.date)}</span>
                                                        <span style={{ color: '#475569' }}>{p.productName.slice(0, 30)}</span>
                                                        <span style={{ color: '#0891B2' }}>{p.currency} {p.unitPrice}</span>
                                                        <span style={{ color: '#64748B' }}>×{p.qty}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── FINANCE ── */}
                            {tab === 'finance' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <MiniCard label={i18n.miniTotalInvoices} value={detail.apSummary.totalInvoices} accent="#1D4ED8" />
                                        <MiniCard label={i18n.miniTotalValue} value={fmtCurrency(detail.apSummary.totalAmount, detail.supplier.defaultCurrency)} accent="#0E7490" />
                                        <MiniCard label={i18n.miniUnpaid} value={fmtCurrency(detail.apSummary.unpaidAmount, detail.supplier.defaultCurrency)} accent={detail.apSummary.unpaidAmount > 0 ? '#B45309' : '#15803D'} />
                                    </div>
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secApInvoiceList}</p>
                                    {!invoices ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                        invoices.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>{i18n.noInvoices}</p> : (
                                            <div className="space-y-2">
                                                {invoices.map(inv => (
                                                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                        <div>
                                                            <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{inv.invoiceNo}</span>
                                                            <span className="text-xs ml-2" style={{ color: '#64748B' }}>PO: {inv.poNo}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-xs" style={{ color: '#64748B' }}>{i18n.duePrefix} {fmtDate(inv.dueDate)}</span>
                                                            <span className="text-xs font-semibold" style={{ color: '#0891B2' }}>
                                                                {fmtCurrency(inv.amount, inv.currency)}
                                                            </span>
                                                            <StatusBadge status={inv.status} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* ── CONTRACTS ── */}
                            {tab === 'contracts' && (
                                <div className="space-y-3">
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secContracts(detail.contractCount)}</p>
                                    {!contracts ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                        contracts.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>{i18n.noContracts}</p> : (
                                            contracts.map(c => (
                                                <div key={c.id} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{c.contractNo}</span>
                                                        <StatusBadge status={c.status} />
                                                    </div>
                                                    <div className="flex gap-4 text-xs" style={{ color: '#475569' }}>
                                                        <span>{i18n.contractTypeLabel} <b>{c.type}</b></span>
                                                        <span>{i18n.contractValueLabel} <b style={{ color: '#0891B2' }}>{fmtCurrency(c.value, c.currency)}</b></span>
                                                        <span>{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                </div>
                            )}

                            {/* ── SHIPMENTS ── */}
                            {tab === 'shipments' && (
                                <div className="space-y-3">
                                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secShipments(detail.shipmentCount)}</p>
                                    {!shipments ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                        shipments.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>{i18n.noShipments}</p> : (
                                            shipments.map(s => (
                                                <div key={s.id} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div>
                                                            <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#0F172A' }}>
                                                                <Ship size={14} className="text-cyan-700 shrink-0" />
                                                                {s.billOfLading}
                                                            </span>
                                                            <span className="text-xs ml-2" style={{ color: '#64748B' }}>PO: {s.poNo}</span>
                                                        </div>
                                                        <StatusBadge status={s.status} />
                                                    </div>
                                                    <div className="flex gap-4 text-xs" style={{ color: '#475569' }}>
                                                        {s.vesselName && <span>{i18n.vesselPrefix} {s.vesselName}</span>}
                                                        <span>ETA: {fmtDate(s.eta)}</span>
                                                        <span>CIF: <b style={{ color: '#0891B2' }}>${formatNumber(s.cifAmount)}</b></span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                </div>
                            )}

                            {/* ── REGULATED DOCS ── */}
                            {tab === 'docs' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>{i18n.secLegalDocs}</p>
                                        <a href={`/dashboard/contracts`} className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                            {i18n.manageDocsLink}
                                        </a>
                                    </div>
                                    {!regDocs ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                        regDocs.length === 0 ? (
                                            <div className="text-center py-10">
                                                <Shield size={28} className="mx-auto mb-2" style={{ color: '#E2E8F0' }} />
                                                <p className="text-xs" style={{ color: '#64748B' }}>{i18n.noLegalDocs}</p>
                                                <p className="text-[10px] mt-1" style={{ color: '#64748B' }}>{i18n.noLegalDocsHint}</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {regDocs.map((d: any) => {
                                                    const isExpired = d.status === 'EXPIRED' || d.status === 'REVOKED'
                                                    const isExpiring = d.daysRemaining !== null && d.daysRemaining <= 30 && d.daysRemaining > 0
                                                    const borderColor = isExpired ? '#B91C1C' : isExpiring ? '#B45309' : '#E2E8F0'
                                                    const statusColor = isExpired ? '#B91C1C' : isExpiring ? '#B45309' : d.status === 'ACTIVE' ? '#15803D' : '#64748B'
                                                    return (
                                                        <div key={d.id} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: `1px solid ${borderColor}` }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    {(isExpired || isExpiring) && <AlertTriangle size={12} style={{ color: borderColor }} />}
                                                                    <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{d.name}</span>
                                                                </div>
                                                                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0" style={{ color: statusColor, background: `${statusColor}18` }}>
                                                                    {REG_DOC_STATUS_LABELS[d.status] ?? d.status}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-4 text-xs" style={{ color: '#475569' }}>
                                                                <span>{REG_DOC_TYPE_LABELS[d.type] ?? d.type}</span>
                                                                <span style={{ color: '#64748B' }}>{d.docNo}</span>
                                                                {d.expiryDate && (
                                                                    <span style={{ color: statusColor }}>
                                                                        {d.daysRemaining !== null && d.daysRemaining <= 0
                                                                            ? i18n.overdueDays(Math.abs(d.daysRemaining))
                                                                            : d.daysRemaining !== null
                                                                                ? i18n.remainingDays(d.daysRemaining)
                                                                                : fmtDate(d.expiryDate)}
                                                                    </span>
                                                                )}
                                                                {d.issuingAuthority && <span style={{ color: '#64748B' }}>{d.issuingAuthority}</span>}
                                                            </div>
                                                            {d.latestFile && (
                                                                <div className="mt-2">
                                                                    <a href={d.latestFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                                                        className="text-[10px] flex items-center gap-1" style={{ color: '#1D4ED8' }}>
                                                                        <ExternalLink size={10} /> {d.latestFile.name}
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* ── NOTES ── */}
                            {tab === 'notes' && (
                                <div className="space-y-4">
                                    {/* Add note form */}
                                    <div className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <select value={noteType} onChange={e => setNoteType(e.target.value)}
                                                className="px-2 py-1.5 rounded-md text-xs outline-none"
                                                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                                <option value="NOTE">{i18n.noteTypeNote}</option>
                                                <option value="CALL">{i18n.noteTypeCall}</option>
                                                <option value="EMAIL">{i18n.noteTypeEmail}</option>
                                                <option value="VISIT">{i18n.noteTypeVisit}</option>
                                            </select>
                                        </div>
                                        <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-md text-sm outline-none resize-none"
                                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', minHeight: 80 }}
                                            placeholder={i18n.placeholderNewNote} />
                                        <div className="flex justify-end mt-2">
                                            <button onClick={handleAddNote} disabled={!newNote.trim() || savingNote}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                                                style={{ background: '#0E7490', color: '#FFFFFF' }}>
                                                {savingNote ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                                                {savingNote ? i18n.btnSaving : i18n.btnAddNote}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Activity timeline */}
                                    {!activities ? <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#0891B2' }} /> :
                                        activities.length === 0 ? <p className="text-xs text-center py-8" style={{ color: '#64748B' }}>{i18n.noActivities}</p> : (
                                            <div className="space-y-2">
                                                {activities.map((a: any) => (
                                                    <div key={a.id} className="flex gap-3 p-3 rounded-lg border border-slate-100 items-start" style={{ background: '#FFFFFF' }}>
                                                        <div className="p-1.5 rounded-md bg-slate-100 h-fit shrink-0">
                                                            <ActivityIcon type={a.type} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs" style={{ color: '#0F172A' }}>{a.description}</p>
                                                            <div className="flex gap-3 mt-1">
                                                                <span className="text-[10px]" style={{ color: '#64748B' }}>{fmtDate(a.occurredAt)}</span>
                                                                {a.performedBy && <span className="text-[10px]" style={{ color: '#64748B' }}>{i18n.byPrefix} {a.performedBy}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {confirmDialog}
        </>
    )
}
