'use client'

import { useState, useEffect, useCallback } from 'react'
import {
    X, Ship, Anchor, MapPin, Calendar, Clock, Shield, FileCheck, DollarSign,
    ChevronRight, CheckCircle2, Circle, Plus, Trash2, Loader2, Globe, Package,
    AlertTriangle, Truck, ClipboardCheck,
} from 'lucide-react'
import {
    getShipmentDetail, completeMilestone, uncompleteMilestone, addCustomMilestone,
    addCostItem, deleteCostItem, upsertCustomsDeclaration, upsertInsurancePolicy,
    type ShipmentDetail, type CostItemRow, type MilestoneRow,
} from './shipment-actions'
import { COST_CATEGORIES } from './shipment-constants'
import { getShipmentDocChecklist, toggleShipmentDocRequired, activateShipmentDoc } from '../contracts/reg-doc-xmodule'
import { REG_DOC_TYPE_LABELS } from '../contracts/reg-doc-constants'
import { toast } from 'sonner'

const STATUS_CFG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Nháp', color: '#4A6A7A' },
    BOOKED: { label: 'Đã book', color: '#4A8FAB' },
    DOCS_READY: { label: 'Docs sẵn', color: '#7AC4C4' },
    LOADED: { label: 'Đã xếp hàng', color: '#87CBB9' },
    ON_VESSEL: { label: 'Trên tàu', color: '#5BA88A' },
    ARRIVED_PORT: { label: 'Cập cảng', color: '#D4A853' },
    CUSTOMS_FILING: { label: 'Khai HQ', color: '#C07434' },
    CUSTOMS_INSPECTING: { label: 'Giám định', color: '#D4A853' },
    CUSTOMS_CLEARED: { label: 'Thông quan', color: '#5BA88A' },
    STAMPING: { label: 'Dán tem', color: '#87CBB9' },
    DELIVERED_TO_WAREHOUSE: { label: 'Nhập kho', color: '#5BA88A' },
    COMPLETED: { label: 'Hoàn tất', color: '#5BA88A' },
    CANCELLED: { label: 'Đã huỷ', color: '#8B1A2E' },
}

const fmtDate = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const fmtNum = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n))

// ═══════════════════════════════════════════════════
// MILESTONE TIMELINE
// ═══════════════════════════════════════════════════
function MilestoneTimeline({ milestones, onComplete, onUncomplete, onAddCustom }: {
    milestones: MilestoneRow[]
    onComplete: (id: string) => void
    onUncomplete: (id: string) => void
    onAddCustom: (label: string) => void
}) {
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
                                    background: done ? '#5BA88A' : isNext ? 'rgba(135,203,185,0.2)' : '#1B2E3D',
                                    border: `2px solid ${done ? '#5BA88A' : isNext ? '#87CBB9' : '#2A4355'}`,
                                }}
                                title={done ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                            >
                                {done ? <CheckCircle2 size={14} style={{ color: '#fff' }} /> : <Circle size={10} style={{ color: isNext ? '#87CBB9' : '#4A6A7A' }} />}
                            </button>
                            {i < milestones.length - 1 && (
                                <div className="w-0.5 h-6" style={{ background: done ? '#5BA88A' : '#2A4355' }} />
                            )}
                        </div>
                        <div className="flex-1 pb-2">
                            <p className="text-sm font-medium" style={{ color: done ? '#87CBB9' : isNext ? '#E8F1F2' : '#4A6A7A', textDecoration: done ? 'none' : 'none' }}>
                                {m.label}
                            </p>
                            {done && m.completedAt && (
                                <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>
                                    ✓ {fmtDate(m.completedAt)} {m.notes && `— ${m.notes}`}
                                </p>
                            )}
                        </div>
                    </div>
                )
            })}
            {adding ? (
                <div className="flex items-center gap-2 pl-9">
                    <input autoFocus className="flex-1 px-2 py-1 rounded text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Tên milestone..."
                        onKeyDown={e => { if (e.key === 'Enter' && newLabel.trim()) { onAddCustom(newLabel.trim()); setNewLabel(''); setAdding(false) } }} />
                    <button onClick={() => setAdding(false)} className="text-xs" style={{ color: '#4A6A7A' }}>Huỷ</button>
                </div>
            ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 pl-9 text-xs" style={{ color: '#4A8FAB' }}>
                    <Plus size={12} /> Thêm milestone
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
    const [adding, setAdding] = useState(false)
    const [form, setForm] = useState({ category: 'FREIGHT', description: '', amount: 0, currency: 'VND', exchangeRate: 1, paidTo: '', invoiceNo: '' })
    const [saving, setSaving] = useState(false)
    const totalVND = items.reduce((s, c) => s + c.amountVND, 0)

    const handleAdd = async () => {
        if (!form.description || form.amount <= 0) { toast.error('Nhập mô tả và số tiền'); return }
        setSaving(true)
        try {
            await addCostItem({ shipmentId, ...form })
            toast.success('Đã thêm chi phí')
            setAdding(false); setForm({ category: 'FREIGHT', description: '', amount: 0, currency: 'VND', exchangeRate: 1, paidTo: '', invoiceNo: '' })
            onRefresh()
        } catch { toast.error('Lỗi') }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Xóa chi phí này?')) return
        await deleteCostItem(id)
        toast.success('Đã xoá')
        onRefresh()
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Chi Phí ({items.length})</p>
                <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>Σ {fmtNum(totalVND)} ₫</p>
            </div>
            {items.length > 0 && (
                <div className="space-y-1">
                    {items.map(c => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg group" style={{ background: '#142433' }}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold" style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                                        {COST_CATEGORIES.find(cc => cc.key === c.category)?.label ?? c.category}
                                    </span>
                                    {c.paidTo && <span className="text-[10px]" style={{ color: '#4A6A7A' }}>→ {c.paidTo}</span>}
                                </div>
                                <p className="text-xs mt-0.5 truncate" style={{ color: '#8AAEBB' }}>{c.description}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                    <p className="text-xs font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                        {c.currency === 'VND' ? `${fmtNum(c.amount)} ₫` : `${c.currency} ${fmtNum(c.amount)}`}
                                    </p>
                                    {c.currency !== 'VND' && <p className="text-[10px]" style={{ color: '#4A6A7A' }}>≈ {fmtNum(c.amountVND)} ₫</p>}
                                </div>
                                <button onClick={() => handleDelete(c.id)} className="opacity-0 group-hover:opacity-100 p-1" style={{ color: '#8B1A2E' }}><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {adding ? (
                <div className="p-3 rounded-lg space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div className="grid grid-cols-2 gap-2">
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            {COST_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="VND">VND</option><option value="USD">USD</option><option value="EUR">EUR</option>
                        </select>
                    </div>
                    <input placeholder="Mô tả chi phí..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" placeholder="Số tiền" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                            className="px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        <input placeholder="Thanh toán cho" value={form.paidTo} onChange={e => setForm(f => ({ ...f, paidTo: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                        <input placeholder="Số invoice" value={form.invoiceNo} onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
                            className="px-2 py-1.5 rounded text-xs" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Huỷ</button>
                        <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs rounded font-semibold flex items-center gap-1"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Thêm
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#4A8FAB' }}>
                    <Plus size={12} /> Thêm chi phí
                </button>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// CUSTOMS DECLARATION SECTION
// ═══════════════════════════════════════════════════
function CustomsSection({ customs, shipmentId, onRefresh }: {
    customs: ShipmentDetail['customs']; shipmentId: string; onRefresh: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(customs ?? {} as any)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setForm(customs ?? {} as any) }, [customs])

    const handleSave = async () => {
        setSaving(true)
        try {
            await upsertCustomsDeclaration(shipmentId, form)
            toast.success('Đã cập nhật HQ')
            setEditing(false); onRefresh()
        } catch { toast.error('Lỗi') }
        finally { setSaving(false) }
    }

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
    const inputCls = "w-full px-2 py-1.5 rounded text-xs outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    if (!editing) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#D4A853' }}>── Hải Quan</p>
                    <button onClick={() => setEditing(true)} className="text-xs font-semibold" style={{ color: '#4A8FAB' }}>
                        {customs ? 'Chỉnh sửa' : '+ Nhập dữ liệu HQ'}
                    </button>
                </div>
                {customs ? (
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Số tờ khai', value: customs.declarationNo },
                            { label: 'Loại', value: customs.declarationType },
                            { label: 'Chi cục', value: customs.customsOffice },
                            { label: 'C/O', value: customs.coFormType ? `${customs.coFormType} — ${customs.coNumber ?? ''}` : null },
                            { label: 'HS Code', value: customs.hsCode },
                            { label: 'Trạng thái', value: customs.status },
                        ].filter(r => r.value).map(r => (
                            <div key={r.label} className="p-2 rounded" style={{ background: '#142433' }}>
                                <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{r.label}</p>
                                <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{r.value}</p>
                            </div>
                        ))}
                        {customs.totalTax != null && (
                            <div className="col-span-2 p-3 rounded-lg" style={{ background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.2)' }}>
                                <div className="grid grid-cols-4 gap-3 text-center">
                                    {[
                                        { label: 'Thuế NK', value: customs.importTaxAmount, rate: customs.importTaxRate },
                                        { label: 'TTĐB', value: customs.sctAmount, rate: customs.sctRate },
                                        { label: 'VAT', value: customs.vatAmount, rate: customs.vatRate },
                                        { label: 'TỔNG THUẾ', value: customs.totalTax },
                                    ].map(t => (
                                        <div key={t.label}>
                                            <p className="text-[10px] uppercase" style={{ color: '#D4A853' }}>{t.label}{(t as any).rate != null ? ` (${(t as any).rate}%)` : ''}</p>
                                            <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{t.value != null ? fmtNum(t.value) : '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {customs.inspectionBody && (
                            <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded" style={{ background: customs.inspectionResult === 'PASSED' ? 'rgba(91,168,138,0.1)' : 'rgba(212,168,83,0.1)' }}>
                                <ClipboardCheck size={14} style={{ color: customs.inspectionResult === 'PASSED' ? '#5BA88A' : '#D4A853' }} />
                                <span className="text-xs" style={{ color: '#E8F1F2' }}>
                                    {customs.inspectionBody} — {customs.inspectionResult === 'PASSED' ? '✅ Đạt' : customs.inspectionResult === 'FAILED' ? '❌ Không đạt' : '⏳ Đang giám định'}
                                    {customs.inspectionDate && ` (${fmtDate(customs.inspectionDate)})`}
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Chưa có dữ liệu HQ — nhấn "Nhập dữ liệu HQ" để bắt đầu</p>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#D4A853' }}>── Nhập Dữ Liệu Hải Quan</p>
            <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Số tờ khai</label><input className={inputCls} style={inputStyle} value={form.declarationNo ?? ''} onChange={e => set('declarationNo', e.target.value)} placeholder="305xxxxx/NKD/HQ" /></div>
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Loại hình</label><select className={inputCls} style={inputStyle} value={form.declarationType ?? ''} onChange={e => set('declarationType', e.target.value)}>
                    <option value="">Chọn...</option><option value="C31">C31 — Kinh doanh</option><option value="A11">A11 — Gia công</option><option value="A12">A12 — Tạm nhập</option><option value="E31">E31 — GC xuất khẩu</option>
                </select></div>
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Chi cục HQ</label><input className={inputCls} style={inputStyle} value={form.customsOffice ?? ''} onChange={e => set('customsOffice', e.target.value)} placeholder="Cát Lái, Tân Cảng..." /></div>
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>HS Code</label><input className={inputCls} style={inputStyle} value={form.hsCode ?? ''} onChange={e => set('hsCode', e.target.value)} placeholder="2204.21" /></div>
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>C/O Form</label><select className={inputCls} style={inputStyle} value={form.coFormType ?? ''} onChange={e => set('coFormType', e.target.value)}>
                    <option value="">Không</option><option value="EUR.1">EUR.1 (EVFTA)</option><option value="AANZ">Form AANZ (AANZFTA)</option><option value="D">Form D (ATIGA)</option><option value="CPTPP">CPTPP</option>
                </select></div>
                <div><label className="text-[10px] uppercase block mb-1" style={{ color: '#4A6A7A' }}>Số C/O</label><input className={inputCls} style={inputStyle} value={form.coNumber ?? ''} onChange={e => set('coNumber', e.target.value)} /></div>
            </div>
            <p className="text-[10px] uppercase tracking-wide font-bold pt-1" style={{ color: '#D4A853' }}>Thuế</p>
            <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Thuế NK %</label><input type="number" className={inputCls} style={inputStyle} value={form.importTaxRate ?? ''} onChange={e => set('importTaxRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Tiền NK</label><input type="number" className={inputCls} style={inputStyle} value={form.importTaxAmount ?? ''} onChange={e => set('importTaxAmount', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>TTĐB %</label><input type="number" className={inputCls} style={inputStyle} value={form.sctRate ?? ''} onChange={e => set('sctRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Tiền TTĐB</label><input type="number" className={inputCls} style={inputStyle} value={form.sctAmount ?? ''} onChange={e => set('sctAmount', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>VAT %</label><input type="number" className={inputCls} style={inputStyle} value={form.vatRate ?? 10} onChange={e => set('vatRate', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Tiền VAT</label><input type="number" className={inputCls} style={inputStyle} value={form.vatAmount ?? ''} onChange={e => set('vatAmount', Number(e.target.value))} /></div>
            </div>
            <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Tổng thuế</label><input type="number" className={inputCls} style={inputStyle} value={form.totalTax ?? ''} onChange={e => set('totalTax', Number(e.target.value))} /></div>
            <p className="text-[10px] uppercase tracking-wide font-bold pt-1" style={{ color: '#D4A853' }}>Giám Định</p>
            <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Đơn vị</label><select className={inputCls} style={inputStyle} value={form.inspectionBody ?? ''} onChange={e => set('inspectionBody', e.target.value)}>
                    <option value="">Chưa chọn</option><option value="VNATEST">VNATEST</option><option value="Quatest 3">Quatest 3</option><option value="Vinacontrol">Vinacontrol</option><option value="SGS">SGS</option>
                </select></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Kết quả</label><select className={inputCls} style={inputStyle} value={form.inspectionResult ?? ''} onChange={e => set('inspectionResult', e.target.value)}>
                    <option value="">—</option><option value="PENDING">Đang giám định</option><option value="PASSED">Đạt</option><option value="FAILED">Không đạt</option>
                </select></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Ngày</label><input type="date" className={inputCls} style={inputStyle} value={form.inspectionDate ? new Date(form.inspectionDate).toISOString().slice(0, 10) : ''} onChange={e => set('inspectionDate', e.target.value)} /></div>
            </div>
            <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Trạng thái</label><select className={inputCls} style={inputStyle} value={form.status ?? 'DRAFT'} onChange={e => set('status', e.target.value)}>
                <option value="DRAFT">Nháp</option><option value="REGISTERED">Đã đăng ký</option><option value="INSPECTING">Đang giám định</option><option value="CLEARED">Thông quan</option><option value="RELEASED">Giải phóng</option>
            </select></div>
            <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Huỷ</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs rounded font-semibold flex items-center gap-1"
                    style={{ background: '#D4A853', color: '#0A1926' }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <FileCheck size={12} />} Lưu HQ
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
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(insurance ?? {} as any)
    const [saving, setSaving] = useState(false)

    useEffect(() => { setForm(insurance ?? {} as any) }, [insurance])

    const handleSave = async () => {
        setSaving(true)
        try { await upsertInsurancePolicy(shipmentId, form); toast.success('Đã cập nhật bảo hiểm'); setEditing(false); onRefresh() }
        catch { toast.error('Lỗi') }
        finally { setSaving(false) }
    }

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
    const inputCls = "w-full px-2 py-1.5 rounded text-xs outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    if (!editing) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A8FAB' }}>── Bảo Hiểm</p>
                    <button onClick={() => setEditing(true)} className="text-xs font-semibold" style={{ color: '#4A8FAB' }}>
                        {insurance ? 'Chỉnh sửa' : '+ Thêm bảo hiểm'}
                    </button>
                </div>
                {insurance ? (
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: 'Số HĐ', value: insurance.policyNo },
                            { label: 'Công ty BH', value: insurance.insurer },
                            { label: 'Giá trị BH', value: insurance.insuredValue ? `${insurance.currency} ${fmtNum(insurance.insuredValue)}` : null },
                            { label: 'Phí BH', value: insurance.premium ? `${insurance.currency} ${fmtNum(insurance.premium)}` : null },
                            { label: 'Loại', value: insurance.coverageType },
                            { label: 'Trạng thái', value: insurance.status },
                        ].filter(r => r.value).map(r => (
                            <div key={r.label} className="p-2 rounded" style={{ background: '#142433' }}>
                                <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{r.label}</p>
                                <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{r.value}</p>
                            </div>
                        ))}
                    </div>
                ) : <p className="text-xs text-center py-4" style={{ color: '#4A6A7A' }}>Chưa mua bảo hiểm — nhấn "Thêm bảo hiểm" để bắt đầu</p>}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A8FAB' }}>── Nhập Bảo Hiểm</p>
            <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Số HĐ</label><input className={inputCls} style={inputStyle} value={form.policyNo ?? ''} onChange={e => set('policyNo', e.target.value)} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Công ty BH</label><select className={inputCls} style={inputStyle} value={form.insurer ?? ''} onChange={e => set('insurer', e.target.value)}>
                    <option value="">Chọn...</option><option value="Bảo Việt">Bảo Việt</option><option value="PVI">PVI</option><option value="Bảo Minh">Bảo Minh</option><option value="Liberty">Liberty</option><option value="Khác">Khác</option>
                </select></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Giá trị BH</label><input type="number" className={inputCls} style={inputStyle} value={form.insuredValue ?? ''} onChange={e => set('insuredValue', Number(e.target.value))} placeholder="110% CIF" /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Phí BH</label><input type="number" className={inputCls} style={inputStyle} value={form.premium ?? ''} onChange={e => set('premium', Number(e.target.value))} /></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Loại bảo hiểm</label><select className={inputCls} style={inputStyle} value={form.coverageType ?? ''} onChange={e => set('coverageType', e.target.value)}>
                    <option value="">Chọn...</option><option value="ALL_RISKS">All Risks</option><option value="WA">WA</option><option value="FPA">FPA</option>
                </select></div>
                <div><label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Trạng thái</label><select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value)}>
                    <option value="ACTIVE">Active</option><option value="EXPIRED">Hết hạn</option><option value="CLAIMED">Đã claim</option>
                </select></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Huỷ</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs rounded font-semibold flex items-center gap-1"
                    style={{ background: '#4A8FAB', color: '#fff' }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />} Lưu BH
                </button>
            </div>
        </div>
    )
}

// ═════════════════════════════════════════════════════
// DOC CHECKLIST SECTION (In-context for Shipment)
// ═════════════════════════════════════════════════════
function DocChecklistSection({ shipmentId }: { shipmentId: string }) {
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
        if (!form.name?.trim()) { toast.error('Nhập tên giấy tờ'); return }
        setSaving(true)
        try {
            await activateShipmentDoc(docId, form)
            toast.success('Đã kích hoạt giấy tờ')
            setEditingDoc(null); setForm({})
            load()
        } catch { toast.error('Lỗi') }
        finally { setSaving(false) }
    }

    if (!items) return <Loader2 size={16} className="animate-spin mx-auto" style={{ color: '#87CBB9' }} />

    const uploaded = items.filter(i => i.status === 'ACTIVE').length
    const required = items.filter(i => i.checked).length

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Bộ Chứng Từ NK</p>
                <span className="text-xs font-bold" style={{ color: uploaded === required && required > 0 ? '#5BA88A' : '#D4A853', fontFamily: '"DM Mono"' }}>
                    {uploaded}/{required} hoàn tất
                </span>
            </div>
            <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Tích chọn loại giấy tờ cần cho lô hàng này. Điền thông tin → Kích hoạt.</p>
            {/* Progress bar */}
            {required > 0 && (
                <div className="h-1.5 rounded-full" style={{ background: '#2A4355' }}>
                    <div className="h-full rounded-full transition-all" style={{ background: uploaded === required ? '#5BA88A' : '#D4A853', width: `${(uploaded / required) * 100}%` }} />
                </div>
            )}
            <div className="space-y-2">
                {items.map(item => {
                    const label = REG_DOC_TYPE_LABELS[item.type] ?? item.type
                    const isActive = item.status === 'ACTIVE'
                    const isDraft = item.status === 'DRAFT'
                    const isEditing = editingDoc === item.docId

                    return (
                        <div key={item.type} className="rounded-lg" style={{ background: '#142433', border: `1px solid ${isActive ? '#5BA88A30' : item.checked ? '#2A4355' : '#1B2E3D'}` }}>
                            {/* Row: checkbox + label + status */}
                            <div className="flex items-center gap-3 px-3 py-2.5">
                                <button onClick={() => handleToggle(item.type, !item.checked)} disabled={isActive}
                                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{
                                        background: isActive ? '#5BA88A' : item.checked ? 'rgba(135,203,185,0.2)' : '#1B2E3D',
                                        border: `2px solid ${isActive ? '#5BA88A' : item.checked ? '#87CBB9' : '#2A4355'}`,
                                        cursor: isActive ? 'default' : 'pointer',
                                    }}>
                                    {isActive && <CheckCircle2 size={12} style={{ color: '#fff' }} />}
                                    {isDraft && <div className="w-2 h-2 rounded-sm" style={{ background: '#87CBB9' }} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm" style={{ color: item.checked ? '#E8F1F2' : '#4A6A7A' }}>{label}</p>
                                    {isActive && item.name && (
                                        <p className="text-[10px] mt-0.5" style={{ color: '#5BA88A' }}>✓ {item.name} {item.docNo && `— ${item.docNo}`}</p>
                                    )}
                                </div>
                                {isDraft && !isEditing && (
                                    <button onClick={() => { setEditingDoc(item.docId); setForm({ name: label }) }}
                                        className="text-[10px] px-2 py-1 rounded font-semibold" style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853' }}>
                                        Điền thông tin
                                    </button>
                                )}
                                {isActive && item.latestFile && (
                                    <a href={item.latestFile.fileUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(74,143,171,0.1)', color: '#4A8FAB' }}>
                                        📄 File
                                    </a>
                                )}
                            </div>
                            {/* Inline edit form when DRAFT */}
                            {isEditing && (
                                <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid #2A4355' }}>
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <div>
                                            <label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Tên giấy tờ *</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                value={form.name ?? ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Số giấy tờ</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                value={form.docNo ?? ''} onChange={e => setForm((f: any) => ({ ...f, docNo: e.target.value }))} placeholder="VD: EUR.1-2024-001" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Cơ quan cấp</label>
                                            <input className="w-full px-2 py-1.5 rounded text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                value={form.issuingAuthority ?? ''} onChange={e => setForm((f: any) => ({ ...f, issuingAuthority: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] block mb-1" style={{ color: '#4A6A7A' }}>Ngày hết hạn</label>
                                            <input type="date" className="w-full px-2 py-1.5 rounded text-xs outline-none" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                value={form.expiryDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setEditingDoc(null); setForm({}) }} className="px-3 py-1.5 text-xs rounded" style={{ color: '#4A6A7A' }}>Huỷ</button>
                                        <button onClick={() => handleActivate(item.docId!)} disabled={saving}
                                            className="px-3 py-1.5 text-xs rounded font-semibold flex items-center gap-1"
                                            style={{ background: '#5BA88A', color: '#fff' }}>
                                            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Kích hoạt
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

    const statusCfg = data ? STATUS_CFG[data.status] ?? { label: data.status, color: '#4A6A7A' } : null

    return (
        <>
            <div className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
                onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300"
                style={{ width: 'min(620px, 95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355', transform: open ? 'translateX(0)' : 'translateX(100%)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(74,143,171,0.15)' }}>
                            <Ship size={18} style={{ color: '#4A8FAB' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                {data?.billOfLading ?? 'Lô Hàng'}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>{data?.poNo}</span>
                                {statusCfg && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: statusCfg.color, background: `${statusCfg.color}20` }}>{statusCfg.label}</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg" style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                {/* Tabs */}
                <div className="flex gap-0.5 px-4 pt-3 flex-shrink-0">
                    {([
                        { key: 'overview', label: 'Tổng Quan', icon: Anchor },
                        { key: 'costs', label: 'Chi Phí', icon: DollarSign },
                        { key: 'customs', label: 'Hải Quan', icon: FileCheck },
                        { key: 'insurance', label: 'Bảo Hiểm', icon: Shield },
                        { key: 'docs', label: 'Chứng Từ', icon: ClipboardCheck },
                    ] as const).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-all"
                            style={{
                                background: tab === t.key ? '#1B2E3D' : 'transparent',
                                color: tab === t.key ? '#87CBB9' : '#4A6A7A',
                                borderBottom: tab === t.key ? '2px solid #87CBB9' : '2px solid transparent',
                            }}>
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                    ) : !data ? (
                        <p className="text-center py-20 text-sm" style={{ color: '#4A6A7A' }}>Không tìm thấy dữ liệu</p>
                    ) : (<>
                        {tab === 'overview' && (
                            <>
                                {/* Shipment info cards */}
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { icon: Ship, label: 'Tàu', value: data.vesselName ?? '—' },
                                        { icon: Package, label: 'Container', value: data.containerNo ? `${data.containerNo} (${data.containerType ?? ''})` : '—' },
                                        { icon: Globe, label: 'Incoterms', value: data.incoterms ?? '—' },
                                    ].map(c => (
                                        <div key={c.label} className="p-3 rounded-lg" style={{ background: '#142433' }}>
                                            <c.icon size={14} style={{ color: '#4A8FAB' }} />
                                            <p className="text-[10px] uppercase mt-1" style={{ color: '#4A6A7A' }}>{c.label}</p>
                                            <p className="text-xs font-semibold" style={{ color: '#E8F1F2' }}>{c.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Cảng xuất', value: data.portOfLoading ?? '—' },
                                        { label: 'Cảng đến', value: data.portOfDischarge ?? '—' },
                                        { label: 'ETD', value: fmtDate(data.etd) },
                                        { label: 'ETA', value: fmtDate(data.eta) },
                                    ].map(c => (
                                        <div key={c.label} className="p-2 rounded text-center" style={{ background: '#142433' }}>
                                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{c.label}</p>
                                            <p className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{c.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg" style={{ background: '#142433' }}>
                                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Giá trị CIF</p>
                                        <p className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{data.cifCurrency} {fmtNum(data.cifAmount)}</p>
                                    </div>
                                    <div className="p-3 rounded-lg" style={{ background: '#142433' }}>
                                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Tiến độ</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex-1 h-2 rounded-full" style={{ background: '#2A4355' }}>
                                                <div className="h-full rounded-full transition-all" style={{ background: '#5BA88A', width: `${data.milestoneProgress}%` }} />
                                            </div>
                                            <span className="text-sm font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>{data.milestoneProgress}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Milestone timeline */}
                                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#87CBB9' }}>── Tiến Trình</p>
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
