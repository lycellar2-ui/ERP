'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    X, Ship, Anchor, MapPin, Calendar, Clock, Shield, FileCheck, DollarSign,
    ChevronRight, CheckCircle2, Circle, Plus, Trash2, Loader2, Globe, Package,
    AlertTriangle, Truck, ClipboardCheck, Check,
} from 'lucide-react'
import {
    getShipmentDetail, completeMilestone, uncompleteMilestone, addCustomMilestone,
    addCostItem, deleteCostItem, upsertCustomsDeclaration, upsertInsurancePolicy,
    type ShipmentDetail, type CostItemRow, type MilestoneRow,
} from './shipment-actions'
import { COST_CATEGORIES } from './shipment-constants'
import { getShipmentDocChecklist, toggleShipmentDocRequired, activateShipmentDoc } from '../contracts/reg-doc-xmodule'
import { REG_DOC_TYPE_LABELS } from '../contracts/reg-doc-constants'
import { useConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { getProcurementDict } from './i18n'

const STATUS_CFG: Record<string, { labelVi: string; labelEn: string; color: string }> = {
    DRAFT: { labelVi: 'Nháp', labelEn: 'Draft', color: '#64748B' },
    BOOKED: { labelVi: 'Đã book', labelEn: 'Booked', color: '#1D4ED8' },
    DOCS_READY: { labelVi: 'Docs sẵn', labelEn: 'Docs Ready', color: '#0891B2' },
    LOADED: { labelVi: 'Đã xếp hàng', labelEn: 'Loaded', color: '#0891B2' },
    ON_VESSEL: { labelVi: 'Trên tàu', labelEn: 'On Vessel', color: '#15803D' },
    ARRIVED_PORT: { labelVi: 'Cập cảng', labelEn: 'Arrived Port', color: '#B45309' },
    CUSTOMS_FILING: { labelVi: 'Khai HQ', labelEn: 'Customs Filing', color: '#C07434' },
    CUSTOMS_INSPECTING: { labelVi: 'Giám định', labelEn: 'Inspecting', color: '#B45309' },
    CUSTOMS_CLEARED: { labelVi: 'Thông quan', labelEn: 'Customs Cleared', color: '#15803D' },
    STAMPING: { labelVi: 'Dán tem', labelEn: 'Stamping', color: '#0891B2' },
    DELIVERED_TO_WAREHOUSE: { labelVi: 'Nhập kho', labelEn: 'Delivered to WH', color: '#15803D' },
    COMPLETED: { labelVi: 'Hoàn tất', labelEn: 'Completed', color: '#15803D' },
    CANCELLED: { labelVi: 'Đã huỷ', labelEn: 'Cancelled', color: '#B91C1C' },
}

// ═══════════════════════════════════════════════════
// MILESTONE TIMELINE
// ═══════════════════════════════════════════════════
function MilestoneTimeline({ milestones, onComplete, onUncomplete, onAddCustom }: {
    milestones: MilestoneRow[]
    onComplete: (id: string) => void
    onUncomplete: (id: string) => void
    onAddCustom: (label: string) => void
}) {
    const { locale, formatDate } = useAppLocale()
    const [adding, setAdding] = useState(false)
    const [newLabel, setNewLabel] = useState('')

    return (
        <div className="space-y-1">
            {milestones.map((m, i) => {
                const done = !!m.completedAt
                const isNext = !done && (i === 0 || milestones[i - 1]?.completedAt)
                return (
                    <div key={m.id} className="flex items-start gap-3 group" style={{ opacity: done ? 1 : isNext ? 1 : 0.5 }}>
                        <div className="flex flex-col items-center flex-shrink-0">
                            <button
                                onClick={() => done ? onUncomplete(m.id) : onComplete(m.id)}
                                className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                                style={{
                                    background: done ? '#15803D' : isNext ? 'rgba(8, 145, 178, 0.15)' : '#FFFFFF',
                                    border: `2px solid ${done ? '#15803D' : isNext ? '#0E7490' : '#E2E8F0'}`,
                                }}
                                title={done ? (locale === 'en' ? 'Mark incomplete' : 'Bỏ hoàn thành') : (locale === 'en' ? 'Mark complete' : 'Đánh dấu hoàn thành')}
                            >
                                {done ? <CheckCircle2 size={14} style={{ color: '#fff' }} /> : <Circle size={10} style={{ color: isNext ? '#0E7490' : '#64748B' }} />}
                            </button>
                            {i < milestones.length - 1 && (
                                <div className="w-0.5 h-6" style={{ background: done ? '#15803D' : '#E2E8F0' }} />
                            )}
                        </div>
                        <div className="flex-1 pb-2">
                            <p className="text-sm font-medium" style={{ color: done ? '#0E7490' : isNext ? '#0F172A' : '#64748B' }}>
                                {m.label}
                            </p>
                            {done && m.completedAt && (
                                <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: '#64748B' }}>
                                    <Check size={11} className="text-emerald-600 shrink-0" />
                                    <span>{formatDate(m.completedAt)} {m.notes && `— ${m.notes}`}</span>
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
            {adding ? (
                <div className="flex items-center gap-2 pl-9">
                    <input autoFocus className="flex-1 px-2 py-1 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"
                        value={newLabel} onChange={e => setNewLabel(e.target.value)}
                        placeholder={locale === 'en' ? 'Milestone name...' : 'Tên milestone...'}
                        onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) { onAddCustom(newLabel.trim()); setNewLabel(''); setAdding(false) } }} />
                    <button onClick={() => setAdding(false)} className="text-xs text-slate-600">
                        {locale === 'en' ? 'Cancel' : 'Huỷ'}
                    </button>
                </div>
            ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 pl-9 text-xs text-blue-700 font-medium">
                    <Plus size={12} /> {locale === 'en' ? 'Add milestone' : 'Thêm milestone'}
                </button>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// COST ITEMS TABLE
// ═══════════════════════════════════════════════════
function CostItemsSection({ items, shipmentId, onRefresh }: {
    items: CostItemRow[]; shipmentId: string; onRefresh: () => void
}) {
    const { locale, formatNumber } = useAppLocale()
    const dict = getProcurementDict(locale)
    const [adding, setAdding] = useState(false)
    const [form, setForm] = useState({ category: 'FREIGHT', description: '', amount: 0, currency: 'VND', exchangeRate: 1, paidTo: '', invoiceNo: '' })
    const [saving, setSaving] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const totalVND = items.reduce((s, c) => s + c.amountVND, 0)

    const handleAdd = async () => {
        if (!form.description || form.amount <= 0) {
            toast.error(locale === 'en' ? 'Please enter description and amount' : 'Nhập mô tả và số tiền')
            return
        }
        setSaving(true)
        try {
            await addCostItem({ shipmentId, ...form })
            toast.success(locale === 'en' ? 'Cost item added' : 'Đã thêm chi phí')
            setAdding(false)
            setForm({ category: 'FREIGHT', description: '', amount: 0, currency: 'VND', exchangeRate: 1, paidTo: '', invoiceNo: '' })
            onRefresh()
        } catch {
            toast.error(locale === 'en' ? 'Failed to add cost' : 'Lỗi')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = (id: string) => {
        confirm({
            title: locale === 'en' ? 'Delete Cost Item' : 'Xóa Chi Phí',
            message: locale === 'en' ? 'Are you sure you want to delete this cost item?' : 'Bạn có chắc chắn muốn xóa mục chi phí này không?',
            confirmLabel: locale === 'en' ? 'Delete' : 'Xóa',
            cancelLabel: locale === 'en' ? 'Cancel' : 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                await deleteCostItem(id)
                toast.success(locale === 'en' ? 'Cost item deleted' : 'Đã xoá chi phí')
                onRefresh()
            }
        })
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest font-bold text-[#0891B2]">
                    ── {dict.shipmentDrawer.tabs.COSTS} ({items.length})
                </p>
                <p className="text-sm font-bold text-slate-900">Σ {formatNumber(totalVND)} ₫</p>
            </div>
            {items.length > 0 && (
                <div className="space-y-1">
                    {items.map(c => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg group bg-slate-50 border border-slate-200">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="inline-block text-[10px] uppercase px-1.5 py-0.5 rounded font-bold whitespace-nowrap shrink-0 text-[#0891B2] bg-cyan-50">
                                        {dict.shipmentDrawer.costCategories[c.category] ?? COST_CATEGORIES.find(cc => cc.key === c.category)?.label ?? c.category}
                                    </span>
                                    {c.paidTo && <span className="text-[10px] text-slate-600">→ {c.paidTo}</span>}
                                </div>
                                <p className="text-xs mt-0.5 truncate text-slate-700">{c.description}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-900">
                                        {c.currency === 'VND' ? `${formatNumber(c.amount)} ₫` : `${c.currency} ${formatNumber(c.amount)}`}
                                    </p>
                                    {c.currency !== 'VND' && <p className="text-[10px] text-slate-600">≈ {formatNumber(c.amountVND)} ₫</p>}
                                </div>
                                <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-700"><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {adding ? (
                <div className="p-3 rounded-lg space-y-2 bg-white border border-slate-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900">
                            {COST_CATEGORIES.map(c => <option key={c.key} value={c.key}>{dict.shipmentDrawer.costCategories[c.key] ?? c.label}</option>)}
                        </select>
                        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900">
                            <option value="VND">VND</option><option value="USD">USD</option><option value="EUR">EUR</option>
                        </select>
                    </div>
                    <input placeholder={dict.shipmentDrawer.costs.description} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input type="number" placeholder={dict.shipmentDrawer.costs.amount} value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                            className="px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900" />
                        <input placeholder={dict.shipmentDrawer.costs.paidTo} value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900" />
                        <input placeholder="Invoice No." value={form.invoiceNo} onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs bg-white border border-slate-200 text-slate-900" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setAdding(false)} className="inline-block px-3 py-1.5 text-xs rounded whitespace-nowrap shrink-0 text-slate-600">{dict.shipmentDrawer.costs.cancelBtn}</button>
                        <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs rounded font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 bg-[#0E7490] text-white">
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {dict.shipmentDrawer.costs.saveBtn}
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                    <Plus size={12} /> {dict.shipmentDrawer.costs.addBtn}
                </button>
            )}
            {confirmDialog}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// CUSTOMS DECLARATION SECTION
// ═══════════════════════════════════════════════════
function CustomsSection({ customs, shipmentId, onRefresh }: {
    customs: ShipmentDetail['customs']; shipmentId: string; onRefresh: () => void
}) {
    const { locale, formatDate, formatNumber } = useAppLocale()
    const dict = getProcurementDict(locale)
    const t = dict.shipmentDrawer.customs

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(customs ?? {} as any)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setForm(customs ?? {} as any) }, [customs])

    const handleSave = async () => {
        setSaving(true)
        try {
            await upsertCustomsDeclaration(shipmentId, form)
            toast.success(locale === 'en' ? 'Customs declaration updated' : 'Đã cập nhật HQ')
            setEditing(false); onRefresh()
        } catch { toast.error(locale === 'en' ? 'Error saving customs' : 'Lỗi') }
        finally { setSaving(false) }
    }

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
    const inputCls = "w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"

    if (!editing) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-bold text-amber-700">── {t.title}</p>
                    <button onClick={() => setEditing(true)} className="text-xs font-semibold text-blue-700">
                        {customs ? (locale === 'en' ? 'Edit' : 'Chỉnh sửa') : (locale === 'en' ? '+ Enter Customs Data' : '+ Nhập dữ liệu HQ')}
                    </button>
                </div>
                {customs ? (
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: t.declarationNo, value: customs.declarationNo },
                            { label: locale === 'en' ? 'Type' : 'Loại', value: customs.declarationType },
                            { label: t.customsOffice, value: customs.customsOffice },
                            { label: 'C/O', value: customs.coFormType ? `${customs.coFormType} — ${customs.coNumber ?? ''}` : null },
                            { label: 'HS Code', value: customs.hsCode },
                            { label: t.status, value: customs.status },
                        ].filter(r => r.value).map(r => (
                            <div key={r.label} className="p-2 rounded bg-slate-50 border border-slate-200">
                                <p className="text-[10px] uppercase text-slate-600">{r.label}</p>
                                <p className="text-xs font-semibold text-slate-900">{r.value}</p>
                            </div>
                        ))}
                        {customs.totalTax != null && (
                            <div className="col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    {[
                                        { label: t.importTaxRate, value: customs.importTaxAmount, rate: customs.importTaxRate },
                                        { label: t.sctRate, value: customs.sctAmount, rate: customs.sctRate },
                                        { label: t.vatRate, value: customs.vatAmount, rate: customs.vatRate },
                                        { label: t.totalTax, value: customs.totalTax },
                                    ].map(taxItem => (
                                        <div key={taxItem.label}>
                                            <p className="text-[10px] uppercase text-amber-800">{taxItem.label}{(taxItem as any).rate != null ? ` (${(taxItem as any).rate}%)` : ''}</p>
                                            <p className="text-sm font-bold text-slate-900">{taxItem.value != null ? formatNumber(taxItem.value) : '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {customs.inspectionBody && (
                            <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded" style={{ background: customs.inspectionResult === 'PASSED' ? 'rgba(21,128,61,0.1)' : 'rgba(180,83,9,0.1)' }}>
                                <ClipboardCheck size={14} style={{ color: customs.inspectionResult === 'PASSED' ? '#15803D' : '#B45309' }} />
                                <span className="text-xs text-slate-900">
                                    {customs.inspectionBody} — {customs.inspectionResult === 'PASSED' ? (locale === 'en' ? 'Passed' : 'Đạt tiêu chuẩn') : customs.inspectionResult === 'FAILED' ? (locale === 'en' ? 'Failed' : 'Không đạt') : (locale === 'en' ? 'Inspecting' : 'Đang giám định')}
                                    {customs.inspectionDate && ` (${formatDate(customs.inspectionDate)})`}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-center py-4 text-slate-600">
                        {locale === 'en' ? 'No customs declaration data yet — click "+ Enter Customs Data" to start' : 'Chưa có dữ liệu HQ — nhấn "+ Nhập dữ liệu HQ" để bắt đầu'}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold text-amber-700">── {t.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">{t.declarationNo}</label><input className={inputCls} value={form.declarationNo ?? ''} onChange={e => set('declarationNo', e.target.value)} placeholder="305xxxxx/NKD/HQ" /></div>
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">{locale === 'en' ? 'Regime Code' : 'Loại hình'}</label><select className={inputCls} value={form.declarationType ?? ''} onChange={e => set('declarationType', e.target.value)}>
                    <option value="">{locale === 'en' ? 'Select...' : 'Chọn...'}</option><option value="C31">C31 — Kinh doanh</option><option value="A11">A11 — Gia công</option><option value="A12">A12 — Tạm nhập</option><option value="E31">E31 — GC xuất khẩu</option>
                </select></div>
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">{t.customsOffice}</label><input className={inputCls} value={form.customsOffice ?? ''} onChange={e => set('customsOffice', e.target.value)} placeholder="Cát Lái, Tân Cảng..." /></div>
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">HS Code</label><input className={inputCls} value={form.hsCode ?? ''} onChange={e => set('hsCode', e.target.value)} placeholder="2204.21" /></div>
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">{t.coFormType}</label><select className={inputCls} value={form.coFormType ?? ''} onChange={e => set('coFormType', e.target.value)}>
                    <option value="">{locale === 'en' ? 'None' : 'Không'}</option><option value="EUR.1">EUR.1 (EVFTA)</option><option value="AANZ">Form AANZ (AANZFTA)</option><option value="D">Form D (ATIGA)</option><option value="CPTPP">CPTPP</option>
                </select></div>
                <div><label className="text-[10px] uppercase block mb-1 text-slate-600">{t.coNumber}</label><input className={inputCls} value={form.coNumber ?? ''} onChange={e => set('coNumber', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.importTaxRate}</label><input type="number" className={inputCls} value={form.importTaxRate ?? ''} onChange={e => set('importTaxRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.importTaxAmount}</label><input type="number" className={inputCls} value={form.importTaxAmount ?? ''} onChange={e => set('importTaxAmount', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.sctRate}</label><input type="number" className={inputCls} value={form.sctRate ?? ''} onChange={e => set('sctRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.sctAmount}</label><input type="number" className={inputCls} value={form.sctAmount ?? ''} onChange={e => set('sctAmount', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.vatRate}</label><input type="number" className={inputCls} value={form.vatRate ?? 10} onChange={e => set('vatRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.vatAmount}</label><input type="number" className={inputCls} value={form.vatAmount ?? ''} onChange={e => set('vatAmount', Number(e.target.value))} /></div>
            </div>
            <div><label className="text-[10px] block mb-1 text-slate-600">{t.totalTax}</label><input type="number" className={inputCls} value={form.totalTax ?? ''} onChange={e => set('totalTax', Number(e.target.value))} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div><label className="text-[10px] block mb-1 text-slate-600">{dict.shipmentDrawer.insurance.inspectionAgency}</label><select className={inputCls} value={form.inspectionBody ?? ''} onChange={e => set('inspectionBody', e.target.value)}>
                    <option value="">{locale === 'en' ? 'Select' : 'Chưa chọn'}</option><option value="VNATEST">VNATEST</option><option value="Quatest 3">Quatest 3</option><option value="Vinacontrol">Vinacontrol</option><option value="SGS">SGS</option>
                </select></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{dict.shipmentDrawer.insurance.inspectionResult}</label><select className={inputCls} value={form.inspectionResult ?? ''} onChange={e => set('inspectionResult', e.target.value)}>
                    <option value="">—</option><option value="PENDING">{locale === 'en' ? 'Inspecting' : 'Đang giám định'}</option><option value="PASSED">{locale === 'en' ? 'Passed' : 'Đạt'}</option><option value="FAILED">{locale === 'en' ? 'Failed' : 'Không đạt'}</option>
                </select></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{dict.shipmentDrawer.insurance.inspectionDate}</label><input type="date" className={inputCls} value={form.inspectionDate ? new Date(form.inspectionDate).toISOString().slice(0, 10) : ''} onChange={e => set('inspectionDate', e.target.value)} /></div>
            </div>
            <div><label className="text-[10px] block mb-1 text-slate-600">{t.status}</label><select className={inputCls} value={form.status ?? 'DRAFT'} onChange={e => set('status', e.target.value)}>
                <option value="DRAFT">{locale === 'en' ? 'Draft' : 'Nháp'}</option><option value="REGISTERED">{locale === 'en' ? 'Registered' : 'Đã đăng ký'}</option><option value="INSPECTING">{locale === 'en' ? 'Inspecting' : 'Đang giám định'}</option><option value="CLEARED">{locale === 'en' ? 'Cleared' : 'Thông quan'}</option><option value="RELEASED">{locale === 'en' ? 'Released' : 'Giải phóng'}</option>
            </select></div>
            <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="inline-block px-3 py-1.5 text-xs rounded whitespace-nowrap shrink-0 text-slate-600">{dict.shipmentDrawer.costs.cancelBtn}</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs rounded font-semibold flex items-center gap-1 bg-amber-600 text-white">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <FileCheck size={12} />} {t.saveBtn}
                </button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// INSURANCE SECTION
// ═══════════════════════════════════════════════════
function InsuranceSection({ insurance, shipmentId, onRefresh }: {
    insurance: ShipmentDetail['insurance']; shipmentId: string; onRefresh: () => void
}) {
    const { locale, formatNumber } = useAppLocale()
    const dict = getProcurementDict(locale)
    const t = dict.shipmentDrawer.insurance

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(insurance ?? {} as any)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setForm(insurance ?? {} as any) }, [insurance])

    const handleSave = async () => {
        setSaving(true)
        try {
            await upsertInsurancePolicy(shipmentId, form)
            toast.success(locale === 'en' ? 'Insurance policy updated' : 'Đã cập nhật bảo hiểm')
            setEditing(false); onRefresh()
        } catch { toast.error(locale === 'en' ? 'Error' : 'Lỗi') }
        finally { setSaving(false) }
    }

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
    const inputCls = "w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"

    if (!editing) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-bold text-blue-700">── {t.policySection}</p>
                    <button onClick={() => setEditing(true)} className="text-xs font-semibold text-blue-700">
                        {insurance ? (locale === 'en' ? 'Edit' : 'Chỉnh sửa') : (locale === 'en' ? '+ Add Insurance' : '+ Thêm bảo hiểm')}
                    </button>
                </div>
                {insurance ? (
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: t.policyNo, value: insurance.policyNo },
                            { label: t.insurer, value: insurance.insurer },
                            { label: t.insuredValue, value: insurance.insuredValue ? `${insurance.currency} ${formatNumber(insurance.insuredValue)}` : null },
                            { label: t.premium, value: insurance.premium ? `${insurance.currency} ${formatNumber(insurance.premium)}` : null },
                            { label: locale === 'en' ? 'Coverage' : 'Loại', value: insurance.coverageType },
                            { label: t.claimStatus, value: insurance.status },
                        ].filter(r => r.value).map(r => (
                            <div key={r.label} className="p-2 rounded bg-slate-50 border border-slate-200">
                                <p className="text-[10px] uppercase text-slate-600">{r.label}</p>
                                <p className="text-xs font-semibold text-slate-900">{r.value}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-center py-4 text-slate-600">
                        {locale === 'en' ? 'No cargo insurance policy yet — click "+ Add Insurance" to start' : 'Chưa mua bảo hiểm — nhấn "+ Thêm bảo hiểm" để bắt đầu'}
                    </p>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold text-blue-700">── {t.policySection}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.policyNo}</label><input className={inputCls} value={form.policyNo ?? ''} onChange={e => set('policyNo', e.target.value)} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.insurer}</label><select className={inputCls} value={form.insurer ?? ''} onChange={e => set('insurer', e.target.value)}>
                    <option value="">{locale === 'en' ? 'Select...' : 'Chọn...'}</option><option value="Bảo Việt">Bảo Việt</option><option value="PVI">PVI</option><option value="Bảo Minh">Bảo Minh</option><option value="Liberty">Liberty</option><option value="Khác">{locale === 'en' ? 'Other' : 'Khác'}</option>
                </select></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.insuredValue}</label><input type="number" className={inputCls} value={form.insuredValue ?? ''} onChange={e => set('insuredValue', Number(e.target.value))} placeholder="110% CIF" /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.premium}</label><input type="number" className={inputCls} value={form.premium ?? ''} onChange={e => set('premium', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{locale === 'en' ? 'Coverage Type' : 'Loại bảo hiểm'}</label><select className={inputCls} value={form.coverageType ?? ''} onChange={e => set('coverageType', e.target.value)}>
                    <option value="">{locale === 'en' ? 'Select...' : 'Chọn...'}</option><option value="ALL_RISKS">All Risks</option><option value="WA">WA</option><option value="FPA">FPA</option>
                </select></div>
                <div><label className="text-[10px] block mb-1 text-slate-600">{t.claimStatus}</label><select className={inputCls} value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value)}>
                    <option value="ACTIVE">Active</option><option value="EXPIRED">{locale === 'en' ? 'Expired' : 'Hết hạn'}</option><option value="CLAIMED">{locale === 'en' ? 'Claimed' : 'Đã claim'}</option>
                </select></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="inline-block px-3 py-1.5 text-xs rounded whitespace-nowrap shrink-0 text-slate-600">{dict.shipmentDrawer.costs.cancelBtn}</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs rounded font-semibold flex items-center gap-1 bg-blue-700 text-white">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />} {t.saveInsuranceBtn}
                </button>
            </div>
        </div>
    )
}

// ═════════════════════════════════════════════════════
// DOC CHECKLIST SECTION (In-context for Shipment)
// ═════════════════════════════════════════════════════
function DocChecklistSection({ shipmentId }: { shipmentId: string }) {
    const { locale } = useAppLocale()
    const [items, setItems] = useState<any[] | null>(null)
    const [editingDoc, setEditingDoc] = useState<string | null>(null)
    const [form, setForm] = useState<any>({})
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setItems(await getShipmentDocChecklist(shipmentId))
    }, [shipmentId])

    useEffect(() => { load() }, [load])

    const handleToggle = async (docType: string, checked: boolean) => {
        await toggleShipmentDocRequired(shipmentId, docType, checked)
        load()
    }

    const handleActivate = async (docId: string) => {
        if (!form.name?.trim()) {
            toast.error(locale === 'en' ? 'Please enter document name' : 'Nhập tên giấy tờ')
            return
        }
        setSaving(true)
        try {
            await activateShipmentDoc(docId, form)
            toast.success(locale === 'en' ? 'Document activated' : 'Đã kích hoạt giấy tờ')
            setEditingDoc(null); setForm({})
            load()
        } catch { toast.error(locale === 'en' ? 'Error' : 'Lỗi') }
        finally { setSaving(false) }
    }

    if (!items) return <Loader2 size={16} className="animate-spin mx-auto text-[#0891B2]" />

    const uploaded = items.filter(i => i.status === 'ACTIVE').length
    const required = items.filter(i => i.checked).length

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest font-bold text-[#0891B2]">
                    ── {locale === 'en' ? 'Import Document Checklist' : 'Bộ Chứng Từ NK'}
                </p>
                <span className="text-xs font-bold" style={{ color: uploaded === required && required > 0 ? '#15803D' : '#B45309' }}>
                    {uploaded}/{required} {locale === 'en' ? 'completed' : 'hoàn tất'}
                </span>
            </div>
            <p className="text-[10px] text-slate-600">
                {locale === 'en'
                    ? 'Check required documents for this shipment. Fill in details → Activate.'
                    : 'Tích chọn loại giấy tờ cần cho lô hàng này. Điền thông tin → Kích hoạt.'}
            </p>
            {/* Progress bar */}
            {required > 0 && (
                <div className="h-1.5 rounded-full bg-slate-200">
                    <div className="h-full rounded-full transition-all" style={{ background: uploaded === required ? '#15803D' : '#B45309', width: `${(uploaded / required) * 100}%` }} />
                </div>
            )}
            <div className="space-y-2">
                {items.map(item => {
                    const label = REG_DOC_TYPE_LABELS[item.type] ?? item.type
                    const isActive = item.status === 'ACTIVE'
                    const isDraft = item.status === 'DRAFT'
                    const isEditing = editingDoc === item.docId

                    return (
                        <div key={item.type} className="rounded-lg bg-white" style={{ border: `1px solid ${isActive ? '#5BA88A30' : item.checked ? '#E2E8F0' : '#FFFFFF'}` }}>
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <button onClick={() => handleToggle(item.type, !item.checked)} disabled={isActive}
                                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                        background: isActive ? '#15803D' : item.checked ? 'rgba(8, 145, 178, 0.15)' : '#FFFFFF',
                                        border: `2px solid ${isActive ? '#15803D' : item.checked ? '#0E7490' : '#E2E8F0'}`,
                                        cursor: isActive ? 'default' : 'pointer',
                                    }}>
                                    {isActive && <CheckCircle2 size={12} style={{ color: '#fff' }} />}
                                    {isDraft && <div className="w-2 h-2 rounded-sm" style={{ background: '#0E7490' }} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm" style={{ color: item.checked ? '#0F172A' : '#64748B' }}>{label}</p>
                                    {isActive && item.name && (
                                        <p className="text-[10px] mt-0.5 flex items-center gap-1 text-emerald-700">
                                            <Check size={11} className="shrink-0" />
                                            <span>{item.name} {item.docNo && `— ${item.docNo}`}</span>
                                        </p>
                                    )}
                                </div>
                                {isDraft && !isEditing && (
                                    <button onClick={() => { setEditingDoc(item.docId); setForm({ name: label }) }}
                                        className="text-[10px] px-2 py-1 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                        {locale === 'en' ? 'Fill details' : 'Điền thông tin'}
                                    </button>
                                )}
                                {isActive && item.latestFile && (
                                    <a href={item.latestFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] px-2 py-1 rounded bg-blue-50 text-blue-700">
                                        {locale === 'en' ? 'View file' : 'Xem tệp'}
                                    </a>
                                )}
                            </div>
                            {isEditing && (
                                <div className="px-3 pb-3 space-y-2 border-t border-slate-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                                        <div>
                                            <label className="text-[10px] block mb-1 text-slate-600">{locale === 'en' ? 'Document Name *' : 'Tên giấy tờ *'}</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"
                                                value={form.name ?? ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1 text-slate-600">{locale === 'en' ? 'Document No.' : 'Số giấy tờ'}</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"
                                                value={form.docNo ?? ''} onChange={e => setForm((f: any) => ({ ...f, docNo: e.target.value }))} placeholder="VD: EUR.1-2024-001" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1 text-slate-600">{locale === 'en' ? 'Issuing Authority' : 'Cơ quan cấp'}</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"
                                                value={form.issuingAuthority ?? ''} onChange={e => setForm((f: any) => ({ ...f, issuingAuthority: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1 text-slate-600">{locale === 'en' ? 'Expiry Date' : 'Ngày hết hạn'}</label>
                                            <input type="date" className="w-full px-2 py-1.5 rounded text-xs outline-none bg-white border border-slate-200 text-slate-900"
                                                value={form.expiryDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setEditingDoc(null); setForm({}) }} className="inline-block px-3 py-1.5 text-xs rounded whitespace-nowrap shrink-0 text-slate-600">{locale === 'en' ? 'Cancel' : 'Huỷ'}</button>
                                        <button onClick={() => handleActivate(item.docId!)} disabled={saving}
                                            className="px-3 py-1.5 text-xs rounded font-semibold flex items-center gap-1 bg-emerald-700 text-white">
                                            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} {locale === 'en' ? 'Activate' : 'Kích hoạt'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// MAIN DRAWER
// ═══════════════════════════════════════════════════
export function ShipmentDetailDrawer({ open, shipmentId, onClose }: {
    open: boolean; shipmentId: string | null; onClose: () => void
}) {
    const { locale, formatDate, formatNumber } = useAppLocale()
    const dict = getProcurementDict(locale)
    const [data, setData] = useState<ShipmentDetail | null>(null)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'overview' | 'costs' | 'customs' | 'insurance' | 'docs'>('overview')

    const load = useCallback(async () => {
        if (!shipmentId) return
        setLoading(true)
        try { setData(await getShipmentDetail(shipmentId)) }
        finally { setLoading(false) }
    }, [shipmentId])

    useEffect(() => { if (open && shipmentId) { load(); setTab('overview') } }, [open, shipmentId, load])

    const handleCompleteMilestone = async (id: string) => {
        await completeMilestone(id); load()
    }
    const handleUncompleteMilestone = async (id: string) => {
        await uncompleteMilestone(id); load()
    }
    const handleAddMilestone = async (label: string) => {
        if (!shipmentId) return
        await addCustomMilestone(shipmentId, label); load()
    }

    const statusCfg = data ? STATUS_CFG[data.status] ?? { labelVi: data.status, labelEn: data.status, color: '#64748B' } : null

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(15,23,42,0.4)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 bg-slate-50 border-l border-slate-200"
                style={{ width: 'min(620px, 95vw)', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50">
                            <Ship size={18} className="text-blue-700" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-lg">
                                {data?.billOfLading ?? dict.shipmentDrawer.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-600">{data?.poNo}</span>
                                {statusCfg && (
                                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: statusCfg.color, background: `${statusCfg.color}20` }}>
                                        {locale === 'en' ? statusCfg.labelEn : statusCfg.labelVi}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 px-4 pt-3 flex-shrink-0 bg-white border-b border-slate-200">
                    {([
                        { key: 'overview', label: dict.shipmentDrawer.tabs.MILESTONES, icon: Anchor },
                        { key: 'costs', label: dict.shipmentDrawer.tabs.COSTS, icon: DollarSign },
                        { key: 'customs', label: dict.shipmentDrawer.tabs.CUSTOMS, icon: FileCheck },
                        { key: 'insurance', label: dict.shipmentDrawer.tabs.INSURANCE, icon: Shield },
                        { key: 'docs', label: locale === 'en' ? 'Documents' : 'Chứng Từ', icon: ClipboardCheck },
                    ] as const).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all"
                            style={{
                                background: tab === t.key ? '#F8FAFC' : 'transparent',
                                color: tab === t.key ? '#0E7490' : '#64748B',
                                borderBottom: tab === t.key ? '2px solid #0E7490' : '2px solid transparent',
                            }}>
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
                    ) : !data ? (
                        <p className="text-center py-20 text-sm text-slate-600">{locale === 'en' ? 'Shipment not found' : 'Không tìm thấy dữ liệu'}</p>
                    ) : (<>
                        {tab === 'overview' && (
                            <>
                                {/* Shipment info cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {[
                                        { icon: Ship, label: locale === 'en' ? 'Vessel' : 'Tàu', value: data.vesselName ?? '—' },
                                        { icon: Package, label: 'Container', value: data.containerNo ? `${data.containerNo} (${data.containerType ?? ''})` : '—' },
                                        { icon: Globe, label: 'Incoterms', value: data.incoterms ?? '—' },
                                    ].map(c => (
                                        <div key={c.label} className="p-3 rounded-lg bg-white border border-slate-200">
                                            <c.icon size={14} className="text-blue-700" />
                                            <p className="text-[10px] uppercase mt-1 text-slate-600">{c.label}</p>
                                            <p className="text-xs font-semibold text-slate-900">{c.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { label: locale === 'en' ? 'Port of Loading' : 'Cảng xuất', value: data.portOfLoading ?? '—' },
                                        { label: locale === 'en' ? 'Port of Discharge' : 'Cảng đến', value: data.portOfDischarge ?? '—' },
                                        { label: 'ETD', value: data.etd ? formatDate(data.etd) : '—' },
                                        { label: 'ETA', value: data.eta ? formatDate(data.eta) : '—' },
                                    ].map(c => (
                                        <div key={c.label} className="p-2 rounded text-center bg-white border border-slate-200">
                                            <p className="text-[10px] uppercase text-slate-600">{c.label}</p>
                                            <p className="text-xs font-bold text-[#0891B2]">{c.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                                        <p className="text-[10px] uppercase text-slate-600">CIF</p>
                                        <p className="text-lg font-bold text-slate-900">{data.cifCurrency} {formatNumber(data.cifAmount)}</p>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white border border-slate-200">
                                        <p className="text-[10px] uppercase text-slate-600">{dict.shipmentDrawer.progressLabel}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-2 rounded-full bg-slate-200">
                                                <div className="h-full rounded-full transition-all" style={{ background: '#15803D', width: `${data.milestoneProgress}%` }} />
                                            </div>
                                            <span className="text-sm font-bold text-emerald-700">{data.milestoneProgress}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone timeline */}
                                <p className="text-xs uppercase tracking-widest font-bold text-[#0891B2]">── {dict.shipmentDrawer.tabs.MILESTONES}</p>
                                <MilestoneTimeline milestones={data.milestones} onComplete={handleCompleteMilestone}
                                    onUncomplete={handleUncompleteMilestone} onAddCustom={handleAddMilestone} />
                            </>
                        )}

                        {tab === 'costs' && (
                            <CostItemsSection items={data.costItems} shipmentId={data.id} onRefresh={load} />
                        )}

                        {tab === 'customs' && (
                            <CustomsSection customs={data.customs} shipmentId={data.id} onRefresh={load} />
                        )}

                        {tab === 'insurance' && (
                            <InsuranceSection insurance={data.insurance} shipmentId={data.id} onRefresh={load} />
                        )}

                        {tab === 'docs' && (
                            <DocChecklistSection shipmentId={data.id} />
                        )}
                    </>)}
                </div>
            </div>
        </>
    )
}
