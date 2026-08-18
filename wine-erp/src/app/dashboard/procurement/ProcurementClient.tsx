'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Search, Plus, ShoppingCart, Truck, CheckCircle2, Clock,
    FileText, ChevronDown, X, Trash2, Loader2, Save, AlertCircle,
    Package, Globe, ArrowRight, Eye, UploadCloud, Ship, Anchor,
    Filter, RefreshCw, Printer, Calendar, ArrowUpDown, ChevronRight,
    Building2, FileCheck, Layers, ExternalLink, Box, Send, CheckSquare, XCircle, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import {
    PORow, PODetail, CreatePOInput, createPurchaseOrder, updatePOStatus,
    getPurchaseOrders, getPODetail, uploadPODocument, convertPOToVND,
    getExchangeRateSummary, getLegalEntitiesForProcurement,
    submitPOForApproval, approvePO, rejectPO, POApprovalLog
} from './actions'
import type { POCurrencyBreakdown } from './actions'
import { getShipments, type ShipmentRow } from './shipment-actions'
import { ShipmentDetailDrawer } from './ShipmentDetailDrawer'
import { formatVND, formatDate, formatDateTime } from '@/lib/utils'
import { getSuppliers } from '@/app/dashboard/suppliers/actions'
import { getProducts } from '@/app/dashboard/products/actions'
import Link from 'next/link'

// ── Country Flag Mapping ───────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    AT: '🇦🇹', GR: '🇬🇷', HU: '🇭🇺', GE: '🇬🇪', RO: '🇷🇴',
    IL: '🇮🇱', LB: '🇱🇧', UY: '🇺🇾', BR: '🇧🇷', MX: '🇲🇽',
    CN: '🇨🇳', JP: '🇯🇵', GB: '🇬🇧', CH: '🇨🇭', HR: '🇭🇷',
    VN: '🇻🇳',
}

// ── Incoterms Config ───────────────────────────────
const INCOTERMS_CFG: Record<string, { label: string; bg: string; color: string; border: string }> = {
    EXW: { label: 'EXW', bg: 'rgba(212,168,83,0.15)', color: '#D4A853', border: 'rgba(212,168,83,0.3)' },
    FOB: { label: 'FOB', bg: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: 'rgba(74,143,171,0.3)' },
    CIF: { label: 'CIF', bg: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: 'rgba(91,168,138,0.3)' },
    DDP: { label: 'DDP', bg: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: 'rgba(135,203,185,0.3)' },
}

// ── Status config ─────────────────────────────────
const PO_STATUS: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)', icon: FileText },
    PENDING_APPROVAL: { label: 'Chờ duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', icon: Clock },
    APPROVED: { label: 'Đã duyệt', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)', icon: CheckCircle2 },
    IN_TRANSIT: { label: 'Đang vận chuyển', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)', icon: Truck },
    PARTIALLY_RECEIVED: { label: 'Nhận một phần', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)', icon: Package },
    RECEIVED: { label: 'Đã nhận đủ', color: '#5BA88A', bg: 'rgba(91,168,138,0.25)', icon: CheckCircle2 },
    CANCELLED: { label: 'Đã huỷ', color: '#E85D5D', bg: 'rgba(232,93,93,0.12)', icon: X },
}

const TAB_ORDER = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const
const TAB_LABELS: Record<string, string> = {
    ALL: 'Tất cả',
    DRAFT: 'Nháp',
    PENDING_APPROVAL: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    IN_TRANSIT: 'Đang trên tàu',
    PARTIALLY_RECEIVED: 'Nhận 1 phần',
    RECEIVED: 'Đã nhận đủ',
    CANCELLED: 'Đã huỷ',
}

function POStatusBadge({ status }: { status: string }) {
    const cfg = PO_STATUS[status] ?? { label: status, color: '#8AAEBB', bg: 'rgba(168,152,128,0.15)', icon: FileText }
    const Icon = cfg.icon
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
            style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}>
            <Icon size={11} />{cfg.label}
        </span>
    )
}

// ── Status Stepper Action Component ────────────────
function StatusStepper({ current, poId, onUpdate }: { current: string; poId: string; onUpdate: () => void }) {
    const [updating, setUpdating] = useState(false)
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [reason, setReason] = useState('')

    const handleSubmit = async () => {
        setUpdating(true)
        toast.promise(
            submitPOForApproval(poId).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi gửi duyệt PO')
                onUpdate()
                return res
            }),
            {
                loading: 'Đang gửi trình duyệt...',
                success: 'Đã gửi duyệt đơn mua hàng thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setUpdating(false)
            }
        )
    }

    const handleApprove = async () => {
        setUpdating(true)
        toast.promise(
            approvePO(poId).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi duyệt PO')
                onUpdate()
                return res
            }),
            {
                loading: 'Đang phê duyệt...',
                success: 'Đã phê duyệt PO thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setUpdating(false)
            }
        )
    }

    const handleReject = async () => {
        if (!reason.trim()) {
            return toast.error('Vui lòng nhập lý do từ chối')
        }
        setUpdating(true)
        toast.promise(
            rejectPO(poId, reason).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi từ chối PO')
                setRejectDialogOpen(false)
                setReason('')
                onUpdate()
                return res
            }),
            {
                loading: 'Đang xử lý...',
                success: 'Đã từ chối PO và trả về Nháp!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setUpdating(false)
            }
        )
    }

    const handleCancel = async () => {
        if (!confirm('Bạn có chắc chắn muốn huỷ PO này không?')) return
        setUpdating(true)
        toast.promise(
            updatePOStatus(poId, 'CANCELLED').then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi huỷ PO')
                onUpdate()
                return res
            }),
            {
                loading: 'Đang huỷ...',
                success: 'Đã huỷ PO',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setUpdating(false)
            }
        )
    }

    if (current === 'DRAFT') {
        return (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={handleSubmit} disabled={updating}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-all"
                    style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}
                    title="Gửi duyệt PO">
                    {updating ? <Loader2 size={10} className="animate-spin" /> : <><Send size={11} /> Gửi Duyệt</>}
                </button>
                <button onClick={handleCancel} disabled={updating}
                    className="px-1.5 py-1 rounded text-[11px] font-semibold transition-all"
                    style={{ background: 'rgba(139,26,46,0.1)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.25)' }}
                    title="Huỷ PO">
                    Huỷ
                </button>
            </div>
        )
    }

    if (current === 'PENDING_APPROVAL') {
        return (
            <div className="flex items-center gap-1 relative" onClick={e => e.stopPropagation()}>
                <button onClick={handleApprove} disabled={updating}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition-all"
                    style={{ background: 'rgba(91,168,138,0.2)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.4)' }}
                    title="Duyệt PO">
                    {updating ? <Loader2 size={10} className="animate-spin" /> : <><CheckCircle2 size={11} /> Duyệt</>}
                </button>
                <button onClick={() => setRejectDialogOpen(true)} disabled={updating}
                    className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[11px] font-semibold transition-all"
                    style={{ background: 'rgba(139,26,46,0.15)', color: '#E85D5D', border: '1px solid rgba(139,26,46,0.35)' }}
                    title="Từ chối PO">
                    {updating ? <Loader2 size={10} className="animate-spin" /> : <><X size={11} /> Từ Chối</>}
                </button>

                {rejectDialogOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" onClick={() => setRejectDialogOpen(false)}>
                        <div className="w-full max-w-sm p-4 rounded-2xl bg-[#142433] border border-[#2A4355] space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h4 className="text-sm font-bold text-[#E8F1F2]">Từ Chối Phê Duyệt PO</h4>
                            <p className="text-xs text-[#8AAEBB]">Nhập lý do từ chối để gửi trả lại nhân viên tạo đơn điều chỉnh:</p>
                            <textarea
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="Nhập lý do từ chối (bắt buộc)..."
                                rows={3}
                                className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-[#1B2E3D] border border-[#2A4355] text-[#E8F1F2]"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setRejectDialogOpen(false)} className="px-3 py-1.5 text-xs text-[#8AAEBB] hover:bg-[#1B2E3D] rounded-lg">
                                    Đóng
                                </button>
                                <button onClick={handleReject} disabled={updating || !reason.trim()}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#E85D5D] rounded-lg disabled:opacity-50">
                                    Xác Nhận Từ Chối
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return null
}

// ── Types for Draft PO Line ────────────────────────
interface DraftPOLine {
    productId: string
    packType: 'CASE_6' | 'CASE_12' | 'CASE_3' | 'CASE_1' | 'BOTTLE'
    pricingMode: 'PER_CASE' | 'PER_BOTTLE'
    qtyInput: number
    priceInput: number
}

const getPackMultiplier = (packType: string) => {
    switch (packType) {
        case 'CASE_12': return 12
        case 'CASE_6': return 6
        case 'CASE_3': return 3
        case 'CASE_1': return 1
        default: return 1
    }
}

const getLineCalculations = (line: DraftPOLine) => {
    const multiplier = getPackMultiplier(line.packType)
    const isCase = line.packType !== 'BOTTLE'
    const totalBottles = line.qtyInput * multiplier
    
    // Đơn giá tính theo 1 chai
    const unitPricePerBottle = isCase && line.pricingMode === 'PER_CASE'
        ? (multiplier > 0 ? line.priceInput / multiplier : line.priceInput)
        : line.priceInput
        
    // Đơn giá tính theo thùng
    const unitPricePerCase = isCase && line.pricingMode === 'PER_BOTTLE'
        ? line.priceInput * multiplier
        : line.priceInput

    const lineTotal = totalBottles * unitPricePerBottle

    return {
        multiplier,
        isCase,
        totalBottles,
        unitPricePerBottle,
        unitPricePerCase,
        lineTotal,
    }
}

// ── Create PO Drawer ───────────────────────────────
function CreatePODrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: (poNo: string) => void
}) {
    const [suppliers, setSuppliers] = useState<{ id: string; name: string; defaultCurrency: string; country: string; incoterms?: string | null }[]>([])
    const [products, setProducts] = useState<{ id: string; productName: string; skuCode: string; country?: string }[]>([])
    const [legalEntities, setLegalEntities] = useState<{ id: string; code: string; name: string }[]>([])
    const [supplierId, setSupplierId] = useState('')
    const [legalEntityId, setLegalEntityId] = useState('')
    const [incoterms, setIncoterms] = useState('EXW')
    const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'NZD' | 'AUD'>('USD')
    const [exchangeRate, setExchangeRate] = useState(25500)
    const [lines, setLines] = useState<DraftPOLine[]>([
        { productId: '', packType: 'CASE_6', pricingMode: 'PER_CASE', qtyInput: 10, priceInput: 0 }
    ])
    const [searchQueries, setSearchQueries] = useState<Record<number, string>>({})
    const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (currency === 'EUR') setExchangeRate(27500)
        else if (currency === 'GBP') setExchangeRate(32500)
        else if (currency === 'NZD') setExchangeRate(15500)
        else if (currency === 'AUD') setExchangeRate(16500)
        else setExchangeRate(25500)
    }, [currency])

    const handleSupplierChange = (id: string) => {
        setSupplierId(id)
        if (id) {
            const selectedSup = suppliers.find(s => s.id === id)
            if (selectedSup) {
                if (selectedSup.defaultCurrency) setCurrency(selectedSup.defaultCurrency as any)
                if (selectedSup.incoterms) setIncoterms(selectedSup.incoterms)
            }
        } else {
            setCurrency('USD')
        }
    }

    useEffect(() => {
        if (!open) return
        Promise.all([
            getSuppliers({ pageSize: 200 }).then(r => setSuppliers(r.rows.map(x => ({ id: x.id, name: x.name, defaultCurrency: x.defaultCurrency, country: x.country, incoterms: x.incoterms })))),
            getProducts({ pageSize: 500 }).then(r => setProducts(r.rows.map(p => ({ id: p.id, productName: p.productName, skuCode: p.skuCode, country: p.country })))),
            getLegalEntitiesForProcurement().then(r => {
                setLegalEntities(r)
                if (r.length > 0 && !legalEntityId) {
                    const defaultTA = r.find(e => e.code === 'TA') || r[0]
                    setLegalEntityId(defaultTA.id)
                }
            }),
        ])
    }, [open, legalEntityId])

    const getFilteredProducts = (query: string) => {
        let q = query.trim().toLowerCase()
        if (!q) return products.slice(0, 20)
        
        // If query starts with [SKU], handle search appropriately
        if (q.startsWith('[')) {
            const closeIdx = q.indexOf(']')
            if (closeIdx !== -1) {
                const afterClose = q.substring(closeIdx + 1).trim()
                if (afterClose) {
                    q = afterClose
                } else {
                    return products.slice(0, 20)
                }
            }
        }

        const results = []
        for (const p of products) {
            if (p.productName.toLowerCase().includes(q) || p.skuCode.toLowerCase().includes(q)) {
                results.push(p)
                if (results.length >= 25) break
            }
        }
        return results
    }

    const totalFOB = lines.reduce((s, l) => {
        const calc = getLineCalculations(l)
        return s + calc.lineTotal
    }, 0)
    const totalVND = totalFOB * exchangeRate

    const addLine = () => setLines(ls => [...ls, { productId: '', packType: 'CASE_6', pricingMode: 'PER_CASE', qtyInput: 10, priceInput: 0 }])
    const removeLine = (i: number) => {
        setLines(ls => ls.filter((_, idx) => idx !== i))
        setSearchQueries(prev => {
            const next: Record<number, string> = {}
            const oldKeys = Object.keys(prev).map(Number).sort((a, b) => a - b)
            let newIdx = 0
            for (const k of oldKeys) {
                if (k === i) continue
                next[newIdx] = prev[k]
                newIdx++
            }
            return next
        })
    }
    const setLine = (i: number, key: keyof DraftPOLine, val: any) =>
        setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: val } : l))

    const handleSave = async () => {
        if (!supplierId) return toast.error('Vui lòng chọn nhà cung cấp')
        if (lines.some(l => !l.productId || l.priceInput <= 0)) return toast.error('Điền đầy đủ thông tin tất cả dòng sản phẩm')
        setSaving(true)

        const formattedLines = lines.map(l => {
            const calc = getLineCalculations(l)
            return {
                productId: l.productId,
                qtyOrdered: calc.totalBottles,
                unitPrice: Number(calc.unitPricePerBottle.toFixed(4)),
                uom: l.packType,
            }
        })

        toast.promise(
            createPurchaseOrder({ supplierId, currency, exchangeRate, lines: formattedLines }).then(res => {
                if (!res.success || !res.poNo) throw new Error(res.error || 'Lỗi không xác định')
                onCreated(res.poNo)
                return res
            }),
            {
                loading: 'Đang tạo Purchase Order...',
                success: 'Tạo PO thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setSaving(false)
            }
        )
    }

    const inputCls = "w-full px-3 py-2 rounded-lg text-xs outline-none transition-all"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
            <div className="w-full sm:w-[720px] max-w-full h-full overflow-y-auto flex flex-col"
                style={{ background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}
                onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-[#2A4355]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <ShoppingCart size={18} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base" style={{ color: '#E8F1F2' }}>Tạo Đơn Mua Hàng (PO)</h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Đặt hàng từ Winery / Négociant / Nhà cung cấp (Hỗ trợ giá theo Thùng / Chai)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-[#8AAEBB] hover:bg-[#1B2E3D]"><X size={18} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-[#87CBB9]">── Thông Tin Chung</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1 text-[#8AAEBB]">Nhà Cung Cấp *</label>
                            <select className={inputCls} style={inputStyle} value={supplierId} onChange={e => handleSupplierChange(e.target.value)}>
                                <option value="">— Chọn Nhà Cung Cấp —</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {COUNTRY_FLAGS[s.country] || '🌐'} {s.name} ({s.defaultCurrency})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1 text-[#8AAEBB]">Pháp Nhân Nhập Khẩu</label>
                            <select className={inputCls} style={inputStyle} value={legalEntityId} onChange={e => setLegalEntityId(e.target.value)}>
                                {legalEntities.map(e => (
                                    <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1 text-[#8AAEBB]">Incoterms</label>
                            <select className={inputCls} style={inputStyle} value={incoterms} onChange={e => setIncoterms(e.target.value)}>
                                <option value="EXW">EXW (Tại xưởng)</option>
                                <option value="FOB">FOB (Giao lên tàu)</option>
                                <option value="CIF">CIF (Cước + BH + Hàng)</option>
                                <option value="DDP">DDP (Giao tại kho)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1 text-[#8AAEBB]">Tiền Tệ</label>
                            <select 
                                className={inputCls} 
                                style={{ ...inputStyle, opacity: supplierId ? 0.7 : 1 }} 
                                value={currency} 
                                onChange={e => setCurrency(e.target.value as any)}
                                disabled={!!supplierId}
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="AUD">AUD (A$)</option>
                                <option value="NZD">NZD (NZ$)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase block mb-1 text-[#8AAEBB]">Tỷ Giá (VND/{currency})</label>
                            <input type="number" className={inputCls} style={inputStyle} value={exchangeRate}
                                onChange={e => setExchangeRate(Number(e.target.value))} step={100} />
                        </div>
                    </div>

                    {/* Product Lines */}
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-[#87CBB9]">── Danh Sách Sản Phẩm</p>
                        <button onClick={addLine} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{ color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)', background: 'rgba(135,203,185,0.1)' }}>
                            <Plus size={12} /> Thêm Sản Phẩm
                        </button>
                    </div>

                    <div className="space-y-3">
                        {lines.map((line, i) => {
                            const calc = getLineCalculations(line)

                            return (
                                <div key={i} className="p-3.5 rounded-xl space-y-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-[#8AAEBB]">Dòng #{i + 1}</span>
                                            {line.productId && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-[#87CBB9] border border-emerald-500/30">
                                                    {calc.totalBottles} chai
                                                </span>
                                            )}
                                        </div>
                                        {lines.length > 1 && (
                                            <button onClick={() => removeLine(i)} className="p-1 rounded text-[#E85D5D] hover:bg-[#1B2E3D]">
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Searchable Product Autocomplete Input */}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="🔍 Gõ SKU hoặc tên sản phẩm / rượu vang..."
                                            value={searchQueries[i] ?? ''}
                                            onFocus={e => {
                                                setActiveDropdownIndex(i)
                                                e.target.select()
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setActiveDropdownIndex(null)
                                                    const currentProduct = products.find(p => p.id === line.productId)
                                                    if (currentProduct) {
                                                        setSearchQueries(prev => ({
                                                            ...prev,
                                                            [i]: `[${currentProduct.skuCode}] ${currentProduct.productName}`
                                                        }))
                                                    } else if (!line.productId) {
                                                        setSearchQueries(prev => ({ ...prev, [i]: '' }))
                                                    }
                                                }, 200)
                                            }}
                                            onChange={e => {
                                                const val = e.target.value
                                                setSearchQueries(prev => ({ ...prev, [i]: val }))
                                                setActiveDropdownIndex(i)
                                            }}
                                            className={inputCls}
                                            style={inputStyle}
                                        />

                                        {activeDropdownIndex === i && (
                                            <div className="absolute left-0 top-full mt-1 max-h-60 overflow-y-auto z-50 rounded-xl bg-[#142433] border border-[#2A4355] w-full shadow-2xl p-1">
                                                {getFilteredProducts(searchQueries[i] ?? '').length === 0 ? (
                                                    <div className="px-3 py-2 text-xs text-[#4A6A7A] italic text-center">
                                                        Không tìm thấy sản phẩm nào
                                                    </div>
                                                ) : (
                                                    getFilteredProducts(searchQueries[i] ?? '').map(p => (
                                                        <div
                                                            key={p.id}
                                                            onMouseDown={() => {
                                                                setLine(i, 'productId', p.id)
                                                                setSearchQueries(prev => ({
                                                                    ...prev,
                                                                    [i]: `[${p.skuCode}] ${p.productName}`
                                                                }))
                                                                setActiveDropdownIndex(null)
                                                            }}
                                                            className="px-3 py-2 text-xs cursor-pointer rounded-lg hover:bg-[#1B2E3D] transition-colors flex items-center justify-between gap-2 border-b border-[#2A4355]/20 last:border-b-0"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <span className="font-mono font-bold text-[#87CBB9] shrink-0">[{p.skuCode}]</span>
                                                                <span className="font-semibold text-[#E8F1F2] truncate">{p.productName}</span>
                                                            </div>
                                                            {p.country && (
                                                                <span className="text-[11px] shrink-0">{COUNTRY_FLAGS[p.country] || '🌐'}</span>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Row Controls: Quy cách đóng gói, Chế độ giá, Số lượng, Đơn giá */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {/* Pack Type / UOM */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-[#4A6A7A] block mb-0.5">Quy cách đóng gói</label>
                                            <select
                                                className={inputCls}
                                                style={inputStyle}
                                                value={line.packType}
                                                onChange={e => {
                                                    const val = e.target.value as any
                                                    setLine(i, 'packType', val)
                                                    if (val === 'BOTTLE') {
                                                        setLine(i, 'pricingMode', 'PER_BOTTLE')
                                                    }
                                                }}
                                            >
                                                <option value="CASE_6">📦 Thùng 6 chai</option>
                                                <option value="CASE_12">📦 Thùng 12 chai</option>
                                                <option value="CASE_3">📦 Thùng 3 chai</option>
                                                <option value="CASE_1">📦 Thùng 1 chai</option>
                                                <option value="BOTTLE">🍾 Chai lẻ (1 chai)</option>
                                            </select>
                                        </div>

                                        {/* Pricing Mode */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-[#4A6A7A] block mb-0.5">Hình thức nhập giá</label>
                                            <select
                                                className={inputCls}
                                                style={{ ...inputStyle, opacity: line.packType === 'BOTTLE' ? 0.6 : 1 }}
                                                value={line.pricingMode}
                                                disabled={line.packType === 'BOTTLE'}
                                                onChange={e => setLine(i, 'pricingMode', e.target.value as any)}
                                            >
                                                <option value="PER_CASE">Giá theo Thùng</option>
                                                <option value="PER_BOTTLE">Giá theo Chai</option>
                                            </select>
                                        </div>

                                        {/* Quantity */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-[#4A6A7A] block mb-0.5">
                                                Số lượng ({line.packType === 'BOTTLE' ? 'chai' : 'thùng'})
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                className={inputCls}
                                                style={inputStyle}
                                                value={line.qtyInput}
                                                onChange={e => setLine(i, 'qtyInput', Math.max(1, Number(e.target.value)))}
                                            />
                                            {calc.isCase && (
                                                <span className="text-[10px] font-mono text-[#87CBB9] block mt-0.5">
                                                    = {calc.totalBottles} chai
                                                </span>
                                            )}
                                        </div>

                                        {/* Unit Price */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-[#4A6A7A] block mb-0.5">
                                                {line.pricingMode === 'PER_CASE' && calc.isCase
                                                    ? `Đơn giá thùng (${currency})`
                                                    : `Đơn giá chai (${currency})`}
                                            </label>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                className={inputCls}
                                                style={inputStyle}
                                                value={line.priceInput}
                                                onChange={e => setLine(i, 'priceInput', Number(e.target.value))}
                                            />
                                            {calc.isCase && (
                                                <span className="text-[10px] font-mono text-[#8AAEBB] block mt-0.5">
                                                    {line.pricingMode === 'PER_CASE'
                                                        ? `(≈ ${calc.unitPricePerBottle.toFixed(2)} ${currency}/chai)`
                                                        : `(≈ ${calc.unitPricePerCase.toFixed(2)} ${currency}/thùng)`}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Line Total preview */}
                                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#2A4355]/40">
                                        <span className="text-[#4A6A7A]">
                                            Thành tiền dòng:
                                            <span className="ml-1 text-[11px] text-[#8AAEBB]">
                                                ({calc.totalBottles} chai × {calc.unitPricePerBottle.toFixed(2)} {currency})
                                            </span>
                                        </span>
                                        <span className="font-mono font-bold text-[#E8F1F2]">
                                            {calc.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                            <span className="text-[10px] ml-1.5 text-[#87CBB9]">
                                                (≈ {formatVND(calc.lineTotal * exchangeRate)})
                                            </span>
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#2A4355] flex-shrink-0 space-y-3" style={{ background: '#142433' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-[#8AAEBB]">Tổng giá trị đơn hàng ({currency}):</p>
                            <p className="text-lg font-bold font-mono text-[#E8F1F2]">
                                {totalFOB.toLocaleString('en-US', { minimumFractionDigits: 2 })} {currency}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-[#8AAEBB]">Quy đổi VNĐ:</p>
                            <p className="text-lg font-bold font-mono text-[#87CBB9]">
                                {formatVND(totalVND)}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all shadow-sm"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Tạo Đơn Mua Hàng
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Props & Main Component ─────────────────────────
interface Props {
    initialRows: PORow[]
    initialTotal: number
    stats: { total: number; draft: number; approved: number; inTransit: number }
}

export function ProcurementClient({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [legalEntityFilter, setLegalEntityFilter] = useState('')
    const [currencyFilter, setCurrencyFilter] = useState('')
    const [incotermsFilter, setIncotermsFilter] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    const [legalEntities, setLegalEntities] = useState<{ id: string; code: string; name: string }[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [successMsg, setSuccessMsg] = useState('')

    // Detail Drawer state
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [poDetail, setPoDetail] = useState<PODetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailTab, setDetailTab] = useState<'LINES' | 'SHIPMENTS' | 'DOCS' | 'APPROVAL'>('LINES')

    // Document & Approval state
    const [uploadingDoc, setUploadingDoc] = useState(false)
    const [approving, setApproving] = useState(false)
    const [approvalComment, setApprovalComment] = useState('')
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectForm, setShowRejectForm] = useState(false)

    // FX Summary & Shipments
    const [showFxPanel, setShowFxPanel] = useState(false)
    const [fxSummary, setFxSummary] = useState<{ currency: string; avgRate: number; minRate: number; maxRate: number; poCount: number; totalForeignValue: number; totalVNDValue: number }[]>([])
    const [fxLoading, setFxLoading] = useState(false)
    const [vndBreakdown, setVndBreakdown] = useState<POCurrencyBreakdown | null>(null)
    const [shipmentDrawerOpen, setShipmentDrawerOpen] = useState(false)
    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null)
    const [poShipments, setPoShipments] = useState<ShipmentRow[]>([])
    const [shipmentsLoading, setShipmentsLoading] = useState(false)

    // Load filter entities
    useEffect(() => {
        getLegalEntitiesForProcurement().then(setLegalEntities).catch(() => {})
        refresh()
    }, [])

    const refresh = async (overrides?: { 
        search?: string; status?: string; legalEntityId?: string; currency?: string; incoterms?: string; dateFrom?: string; dateTo?: string 
    }) => {
        const s = overrides?.search !== undefined ? overrides.search : search
        const st = overrides?.status !== undefined ? overrides.status : statusFilter
        const le = overrides?.legalEntityId !== undefined ? overrides.legalEntityId : legalEntityFilter
        const cur = overrides?.currency !== undefined ? overrides.currency : currencyFilter
        const inco = overrides?.incoterms !== undefined ? overrides.incoterms : incotermsFilter
        const df = overrides?.dateFrom !== undefined ? overrides.dateFrom : dateFrom
        const dt = overrides?.dateTo !== undefined ? overrides.dateTo : dateTo

        setLoading(true)
        try {
            const result = await getPurchaseOrders({ 
                search: s || undefined, 
                status: st || undefined,
                legalEntityId: le || undefined,
                currency: cur || undefined,
                incoterms: inco || undefined,
                dateFrom: df || undefined,
                dateTo: dt || undefined,
            })
            setRows(result.rows)
            setTotal(result.total)
            if (result.statusCounts) setStatusCounts(result.statusCounts)
        } finally {
            setLoading(false)
        }
    }

    const handleClearFilters = () => {
        setSearch('')
        setStatusFilter('')
        setLegalEntityFilter('')
        setCurrencyFilter('')
        setIncotermsFilter('')
        setDateFrom('')
        setDateTo('')
        refresh({ search: '', status: '', legalEntityId: '', currency: '', incoterms: '', dateFrom: '', dateTo: '' })
    }

    const hasActiveFilters = !!(search || statusFilter || legalEntityFilter || currencyFilter || incotermsFilter || dateFrom || dateTo)

    const showDetail = async (id: string, force = false) => {
        if (selectedId === id && !force) { setSelectedId(null); return }
        setSelectedId(id)
        setDetailLoading(true)
        setDetailTab('LINES')
        setApprovalComment('')
        setRejectReason('')
        setShowRejectForm(false)
        try {
            const data = await getPODetail(id)
            setPoDetail(data)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleUpload = async (poId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        toast.promise(
            uploadPODocument(poId, formData).then((res: any) => {
                if (!res.success) throw new Error(res.error)
                if (selectedId === poId) showDetail(poId, true)
                refresh()
                return res
            }),
            {
                loading: 'Đang tải lên tài liệu...',
                success: 'Tải lên tài liệu PO thành công!',
                error: (err: any) => `Lỗi tải lên: ${err.message}`,
                finally: () => setUploadingDoc(false)
            }
        )
    }

    const handleDrawerSubmit = async (poId: string) => {
        setApproving(true)
        toast.promise(
            submitPOForApproval(poId).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi gửi duyệt PO')
                refresh()
                if (selectedId === poId) showDetail(poId, true)
                return res
            }),
            {
                loading: 'Đang gửi trình duyệt...',
                success: 'Đã gửi duyệt đơn mua hàng!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setApproving(false)
            }
        )
    }

    const handleDrawerApprove = async (poId: string) => {
        setApproving(true)
        toast.promise(
            approvePO(poId, approvalComment).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi phê duyệt PO')
                refresh()
                if (selectedId === poId) showDetail(poId, true)
                return res
            }),
            {
                loading: 'Đang phê duyệt đơn hàng...',
                success: 'Đã phê duyệt PO thành công!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setApproving(false)
            }
        )
    }

    const handleDrawerReject = async (poId: string) => {
        if (!rejectReason.trim()) return toast.error('Vui lòng nhập lý do từ chối')
        setApproving(true)
        toast.promise(
            rejectPO(poId, rejectReason).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi từ chối PO')
                setShowRejectForm(false)
                setRejectReason('')
                refresh()
                if (selectedId === poId) showDetail(poId, true)
                return res
            }),
            {
                loading: 'Đang xử lý từ chối...',
                success: 'Đã từ chối PO và trả về Nháp!',
                error: (err: any) => `Lỗi: ${err.message}`,
                finally: () => setApproving(false)
            }
        )
    }

    const statCards = [
        { label: 'Tổng PO', value: stats.total, icon: ShoppingCart, accent: '#87CBB9' },
        { label: 'Nháp / Chờ duyệt', value: stats.draft, icon: Clock, accent: '#D4A853' },
        { label: 'Đã duyệt', value: stats.approved, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Đang vận chuyển', value: stats.inTransit, icon: Ship, accent: '#4A8FAB' },
    ]

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold" style={{ color: '#E8F1F2' }}>
                        Quản Lý Đơn Mua Hàng (PO)
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>
                        Theo dõi đơn mua từ Winery, Vận tải quốc tế (Shipments / B/L), Incoterms và Tiến độ nhập kho
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={async () => { 
                        setShowFxPanel(!showFxPanel); 
                        if (!showFxPanel) { 
                            setFxLoading(true); 
                            const r = await getExchangeRateSummary(); 
                            setFxSummary(r.currencies); 
                            setFxLoading(false) 
                        } 
                    }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ color: '#D4A853', background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.3)' }}>
                        <Globe size={14} /> Tỷ Giá Ngoại Tệ
                    </button>
                    <button onClick={() => setDrawerOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        <Plus size={15} /> Tạo PO Mới
                    </button>
                </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(s => (
                    <div key={s.label} className="flex items-center gap-3.5 p-3.5 rounded-2xl"
                        style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${s.accent}20` }}>
                            <s.icon size={18} style={{ color: s.accent }} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-lg font-extrabold mt-0.5 font-mono" style={{ color: '#E8F1F2' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {TAB_ORDER.map(tab => {
                    const isActive = (tab === 'ALL' && statusFilter === '') || tab === statusFilter
                    const count = tab === 'ALL' ? (statusCounts.ALL ?? total) : (statusCounts[tab] ?? 0)
                    return (
                        <button key={tab} onClick={() => {
                            const next = tab === 'ALL' ? '' : tab
                            setStatusFilter(next)
                            refresh({ status: next })
                        }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all"
                            style={{
                                background: isActive ? 'rgba(135,203,185,0.15)' : 'transparent',
                                color: isActive ? '#87CBB9' : '#8AAEBB',
                                border: `1px solid ${isActive ? 'rgba(135,203,185,0.3)' : 'transparent'}`,
                            }}>
                            {TAB_LABELS[tab]}
                            <span className="px-1.5 py-0.2 text-[10px] rounded-full font-bold"
                                style={{ background: isActive ? 'rgba(135,203,185,0.25)' : 'rgba(74,106,122,0.15)', color: isActive ? '#87CBB9' : '#4A6A7A' }}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Filter Search Bar & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl"
                style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex flex-1 items-center gap-2 min-w-[280px]">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A6A7A]" />
                        <input
                            placeholder="Tìm Số PO, Nhà Cung Cấp, Số B/L, Tàu, Container..."
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value)
                                refresh({ search: e.target.value })
                            }}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none font-medium"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style={{
                            background: showFilters || hasActiveFilters ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                            color: showFilters || hasActiveFilters ? '#87CBB9' : '#8AAEBB',
                            border: `1px solid ${showFilters || hasActiveFilters ? 'rgba(135,203,185,0.3)' : '#2A4355'}`,
                        }}>
                        <Filter size={13} />
                        Bộ lọc
                        {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[#87CBB9]" />}
                    </button>

                    {hasActiveFilters && (
                        <button onClick={handleClearFilters}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-[#E85D5D] hover:bg-[#1B2E3D]">
                            Xoá lọc
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsible Advanced Filters */}
            {showFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 p-3.5 rounded-xl animate-in slide-in-from-top-2 duration-150"
                    style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-[#4A6A7A]">Pháp Nhân Nhập Khẩu</label>
                        <select value={legalEntityFilter}
                            onChange={e => { setLegalEntityFilter(e.target.value); refresh({ legalEntityId: e.target.value }) }}
                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="">Tất cả pháp nhân</option>
                            {legalEntities.map(e => (
                                <option key={e.id} value={e.id}>{e.code} — {e.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-[#4A6A7A]">Incoterms</label>
                        <select value={incotermsFilter}
                            onChange={e => { setIncotermsFilter(e.target.value); refresh({ incoterms: e.target.value }) }}
                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="">Tất cả Incoterms</option>
                            <option value="EXW">EXW (Tại xưởng)</option>
                            <option value="FOB">FOB (Giao lên tàu)</option>
                            <option value="CIF">CIF (Cước + BH + Hàng)</option>
                            <option value="DDP">DDP (Giao tại kho)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-[#4A6A7A]">Tiền Tệ</label>
                        <select value={currencyFilter}
                            onChange={e => { setCurrencyFilter(e.target.value); refresh({ currency: e.target.value }) }}
                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                            <option value="">Tất cả tiền tệ</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="AUD">AUD (A$)</option>
                            <option value="NZD">NZD (NZ$)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-[#4A6A7A]">Từ Ngày</label>
                        <input type="date" value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); refresh({ dateFrom: e.target.value }) }}
                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }} />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase block mb-1 text-[#4A6A7A]">Đến Ngày</label>
                        <input type="date" value={dateTo}
                            onChange={e => { setDateTo(e.target.value); refresh({ dateTo: e.target.value }) }}
                            className="w-full px-2.5 py-1.5 text-xs outline-none rounded"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }} />
                    </div>
                </div>
            )}

            {/* Desktop Table — Multi-Line Compact ERP Layout */}
            <div className="hidden md:block rounded-2xl overflow-hidden shadow-sm"
                style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full text-left border-collapse" style={{ minWidth: 1080 }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB]" style={{ width: '22%' }}>
                                    Mã PO & Vận Tải (Shipment)
                                </th>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB]" style={{ width: '22%' }}>
                                    Nhà Cung Cấp & Pháp Nhân
                                </th>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB]" style={{ width: '16%' }}>
                                    Quy Mô & Nhập Kho
                                </th>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB]" style={{ width: '16%' }}>
                                    Giá Trị & Quy Đổi
                                </th>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB]" style={{ width: '14%' }}>
                                    Trạng Thái & Hồ Sơ
                                </th>
                                <th className="px-4 py-3 text-[11px] uppercase tracking-wider font-extrabold text-[#8AAEBB] text-right" style={{ width: '10%' }}>
                                    Thao Tác
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A4355]/40">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3.5">
                                                <div className="h-4 rounded bg-[#1B2E3D] w-3/4 mb-1.5" />
                                                <div className="h-3 rounded bg-[#1B2E3D]/60 w-1/2" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-16 text-[#4A6A7A]">
                                        <FileText size={32} className="mx-auto mb-2 opacity-40 text-[#8AAEBB]" />
                                        <p className="text-sm font-semibold">
                                            {hasActiveFilters ? 'Không tìm thấy đơn mua hàng phù hợp bộ lọc' : 'Hệ thống chưa có đơn mua hàng nào'}
                                        </p>
                                        {hasActiveFilters && (
                                            <button onClick={handleClearFilters}
                                                className="mt-2.5 px-3 py-1 text-xs font-bold rounded-lg text-[#0A1926] bg-[#87CBB9]">
                                                Xoá Bộ Lọc
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : rows.map(row => {
                                const incoCfg = INCOTERMS_CFG[row.incoterms || 'EXW'] || INCOTERMS_CFG.EXW
                                const flag = COUNTRY_FLAGS[row.supplierCountry || 'FR'] || '🌐'
                                const isSelected = selectedId === row.id
                                const isReadyForGR = ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(row.status)

                                return (
                                    <tr key={row.id}
                                        onClick={() => showDetail(row.id)}
                                        className="transition-colors cursor-pointer group"
                                        style={{ background: isSelected ? 'rgba(135,203,185,0.06)' : 'transparent' }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(135,203,185,0.03)' }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                                        
                                        {/* Col 1: PO No & Shipping info */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-extrabold font-mono text-[#87CBB9]">
                                                    {row.poNo}
                                                </span>
                                                {row.incoterms && (
                                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded"
                                                        style={{ background: incoCfg.bg, color: incoCfg.color, border: `1px solid ${incoCfg.border}` }}>
                                                        {incoCfg.label}
                                                    </span>
                                                )}
                                            </div>
                                            {row.latestShipment ? (
                                                <div className="mt-1 space-y-0.5">
                                                    <div className="flex items-center gap-1.5 text-xs text-[#E8F1F2]">
                                                        <Ship size={11} className="text-[#4A8FAB] shrink-0" />
                                                        <span className="font-mono font-bold text-[#4A8FAB] text-[11px] truncate max-w-[170px]"
                                                            title={`Vận đơn B/L: ${row.latestShipment.billOfLading}`}>
                                                            {row.latestShipment.billOfLading}
                                                        </span>
                                                        {row.latestShipment.vesselName && (
                                                            <span className="text-[10px] text-[#8AAEBB] truncate max-w-[100px]" title={row.latestShipment.vesselName}>
                                                                · {row.latestShipment.vesselName}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {row.latestShipment.containerNo && (
                                                        <p className="text-[10px] text-[#4A6A7A] font-mono">
                                                            Cont: {row.latestShipment.containerNo} {row.latestShipment.containerType ? `(${row.latestShipment.containerType})` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] mt-1 text-[#4A6A7A] italic">Chưa có lô vận chuyển B/L</p>
                                            )}
                                        </td>

                                        {/* Col 2: Supplier & Legal Entity */}
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-extrabold text-[#E8F1F2] truncate max-w-[230px]" title={row.supplierName}>
                                                <span className="mr-1">{flag}</span>
                                                {row.supplierName}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                {row.legalEntityCode && (
                                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded"
                                                        style={{ 
                                                            background: row.legalEntityCode === 'TA' ? 'rgba(212,168,83,0.15)' : 'rgba(135,203,185,0.15)', 
                                                            color: row.legalEntityCode === 'TA' ? '#D4A853' : '#87CBB9' 
                                                        }}>
                                                        {row.legalEntityCode}
                                                    </span>
                                                )}
                                                {row.paymentTerm && (
                                                    <span className="text-[10px] text-[#8AAEBB] font-mono">
                                                        {row.paymentTerm}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Col 3: Quantity & Goods Receipt */}
                                        <td className="px-4 py-3">
                                            <div className="text-xs font-bold text-[#E8F1F2]">
                                                <span className="text-[#8AAEBB] font-mono">{row.lineCount} SKU</span> · <span className="font-mono text-[#E8F1F2]">{row.totalQty.toLocaleString()}</span> chai
                                            </div>
                                            <div className="mt-1 space-y-0.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-[#4A6A7A]">Đã nhập kho:</span>
                                                    <span className="font-mono font-bold text-[#87CBB9]">
                                                        {row.totalQtyReceived.toLocaleString()}/{row.totalQty.toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-[#1B2E3D] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all"
                                                        style={{ 
                                                            width: `${row.receivedPercentage}%`, 
                                                            background: row.receivedPercentage >= 100 ? '#5BA88A' : (row.receivedPercentage > 0 ? '#87CBB9' : '#2A4355') 
                                                        }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Col 4: Foreign Value & VND Conversion */}
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-bold font-mono text-[#E8F1F2]">
                                                {row.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {row.currency}
                                            </p>
                                            <p className="text-[11px] font-bold font-mono text-[#87CBB9] mt-0.5">
                                                ≈ {formatVND(row.totalAmount * row.exchangeRate)}
                                            </p>
                                            <p className="text-[10px] text-[#4A6A7A] font-mono">
                                                Tỷ giá: {row.exchangeRate.toLocaleString()}
                                            </p>
                                        </td>

                                        {/* Col 5: Status, Creator & Docs */}
                                        <td className="px-4 py-3">
                                            <div>
                                                <POStatusBadge status={row.status} />
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] flex-wrap">
                                                {row.creatorName && (
                                                    <span className="text-[#8AAEBB] font-medium">
                                                        👤 {row.creatorName}
                                                    </span>
                                                )}
                                                {row.docCount && row.docCount > 0 ? (
                                                    <span className="text-[#87CBB9] flex items-center gap-0.5 font-mono">
                                                        📎 {row.docCount} file
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-[10px] text-[#4A6A7A] mt-0.5">
                                                {formatDate(row.createdAt)}
                                                {row.estimatedDelivery && ` · ETA: ${formatDate(row.estimatedDelivery)}`}
                                            </p>
                                        </td>

                                        {/* Col 6: Actions */}
                                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                <button onClick={() => showDetail(row.id)}
                                                    className="p-1.5 rounded-lg text-[#87CBB9] hover:bg-[#1B2E3D] border border-emerald-500/20"
                                                    title="Xem chi tiết PO">
                                                    <Eye size={13} />
                                                </button>

                                                {/* Status Stepper */}
                                                <StatusStepper current={row.status} poId={row.id} onUpdate={refresh} />

                                                {/* Direct Warehouse Receipt shortcut */}
                                                {isReadyForGR && (
                                                    <Link href="/dashboard/warehouse"
                                                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[#87CBB9] bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20"
                                                        title="Nhập kho hàng cho PO này">
                                                        <Box size={11} /> Nhập Kho
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile View — Multi-Line Cards */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="text-center py-12 text-xs text-[#8AAEBB]">
                        <Loader2 size={20} className="animate-spin inline text-[#87CBB9] mr-2" /> Đang tải PO...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-12 text-xs text-[#4A6A7A] rounded-2xl border border-[#2A4355] bg-[#0D1E2B]">
                        Chưa có đơn mua hàng nào
                    </div>
                ) : rows.map(row => {
                    const incoCfg = INCOTERMS_CFG[row.incoterms || 'EXW'] || INCOTERMS_CFG.EXW
                    const flag = COUNTRY_FLAGS[row.supplierCountry || 'FR'] || '🌐'

                    return (
                        <div key={row.id} onClick={() => showDetail(row.id)}
                            className="p-3.5 rounded-2xl space-y-2.5 cursor-pointer transition-all active:scale-[0.99]"
                            style={{ background: '#142433', border: '1px solid #2A4355' }}>
                            
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold font-mono text-[#87CBB9]">{row.poNo}</span>
                                    {row.incoterms && (
                                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded"
                                            style={{ background: incoCfg.bg, color: incoCfg.color, border: `1px solid ${incoCfg.border}` }}>
                                            {incoCfg.label}
                                        </span>
                                    )}
                                </div>
                                <POStatusBadge status={row.status} />
                            </div>

                            <div className="text-xs">
                                <p className="font-extrabold text-[#E8F1F2]">
                                    <span className="mr-1">{flag}</span>{row.supplierName}
                                </p>
                                {row.latestShipment && (
                                    <p className="text-[11px] text-[#4A8FAB] font-mono mt-0.5 flex items-center gap-1">
                                        <Ship size={10} /> B/L: {row.latestShipment.billOfLading} {row.latestShipment.vesselName ? `· ${row.latestShipment.vesselName}` : ''}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2A4355]/40 text-xs">
                                <div>
                                    <span className="text-[10px] text-[#4A6A7A] block">Số lượng & Tiến độ:</span>
                                    <span className="font-mono text-[#E8F1F2] font-bold">{row.totalQty.toLocaleString()} chai</span>
                                    <span className="text-[10px] text-[#87CBB9] ml-1">({row.receivedPercentage}% kho)</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-[#4A6A7A] block">Giá trị:</span>
                                    <span className="font-mono text-[#87CBB9] font-bold">{formatVND(row.totalAmount * row.exchangeRate)}</span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#2A4355]/40 text-xs" onClick={e => e.stopPropagation()}>
                                <StatusStepper current={row.status} poId={row.id} onUpdate={refresh} />
                                <button onClick={() => showDetail(row.id)}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg text-[#87CBB9] bg-[#1B2E3D] border border-emerald-500/20">
                                    Chi Tiết
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* PO Detail Drawer (Slide-Over with Rich Tabs) */}
            {selectedId && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedId(null)}>
                    <div className="w-full sm:w-[620px] max-w-full h-full overflow-y-auto flex flex-col"
                        style={{ background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}
                        onClick={e => e.stopPropagation()}>

                        {/* Drawer Header */}
                        <div className="flex items-center justify-between p-5 border-b border-[#2A4355] flex-shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-extrabold text-[#E8F1F2]">
                                        {poDetail?.poNo ?? 'Chi Tiết Đơn Mua Hàng'}
                                    </h3>
                                    {poDetail && <POStatusBadge status={poDetail.status} />}
                                </div>
                                {poDetail && (
                                    <p className="text-xs text-[#8AAEBB] mt-0.5">
                                        {poDetail.supplierName} · {poDetail.currency} (Tỷ giá: {poDetail.exchangeRate.toLocaleString()})
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg text-[#8AAEBB] hover:bg-[#1B2E3D]">
                                <X size={18} />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="flex-1 flex items-center justify-center py-16 text-[#87CBB9]">
                                <Loader2 size={24} className="animate-spin mr-2" /> Đang tải chi tiết PO...
                            </div>
                        ) : poDetail ? (
                            <>
                                {/* Quick Meta Bar */}
                                <div className="grid grid-cols-3 gap-2 p-4 bg-[#142433] border-b border-[#2A4355] text-xs">
                                    <div>
                                        <span className="text-[10px] text-[#4A6A7A] block font-bold uppercase">Tổng Số Lượng</span>
                                        <span className="font-mono font-bold text-[#E8F1F2]">{poDetail.totalQty.toLocaleString()} chai</span>
                                        <span className="text-[10px] text-[#87CBB9] ml-1">({poDetail.totalQtyReceived} đã nhận)</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-[#4A6A7A] block font-bold uppercase">Giá Ngoại Tệ</span>
                                        <span className="font-mono font-bold text-[#E8F1F2]">{poDetail.totalAmount.toLocaleString()} {poDetail.currency}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-[#4A6A7A] block font-bold uppercase">Quy Đổi VNĐ</span>
                                        <span className="font-mono font-bold text-[#87CBB9]">{formatVND(poDetail.totalAmount * poDetail.exchangeRate)}</span>
                                    </div>
                                </div>

                                {/* Drawer Tabs */}
                                <div className="flex border-b border-[#2A4355] bg-[#142433] px-4 gap-1">
                                    {[
                                        { key: 'LINES', label: `Sản Phẩm (${poDetail.lines.length})` },
                                        { key: 'SHIPMENTS', label: `Lô Vận Tải (${poDetail.shipments.length})` },
                                        { key: 'DOCS', label: `Chứng Từ (${poDetail.documents?.length || 0})` },
                                        { key: 'APPROVAL', label: `Luồng Duyệt (${poDetail.approvalHistory?.length || 0})` },
                                    ].map(t => (
                                        <button key={t.key} onClick={() => setDetailTab(t.key as any)}
                                            className="px-3 py-2.5 text-xs font-bold border-b-2 transition-all"
                                            style={{
                                                borderColor: detailTab === t.key ? '#87CBB9' : 'transparent',
                                                color: detailTab === t.key ? '#87CBB9' : '#4A6A7A',
                                            }}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                                    {detailTab === 'LINES' && (
                                        <div className="space-y-2">
                                            {poDetail.lines.map(line => {
                                                const isCase6 = line.uom === 'CASE_6'
                                                const isCase12 = line.uom === 'CASE_12'
                                                const isCase3 = line.uom === 'CASE_3'
                                                const isCase1 = line.uom === 'CASE_1'
                                                const uomLabel = isCase6 ? `${line.qtyOrdered / 6} Thùng 6 (${line.qtyOrdered} chai)`
                                                    : isCase12 ? `${line.qtyOrdered / 12} Thùng 12 (${line.qtyOrdered} chai)`
                                                    : isCase3 ? `${line.qtyOrdered / 3} Thùng 3 (${line.qtyOrdered} chai)`
                                                    : isCase1 ? `${line.qtyOrdered} Hộp 1 chai`
                                                    : `${line.qtyOrdered} chai`

                                                return (
                                                    <div key={line.id} className="p-3 rounded-xl bg-[#142433] border border-[#2A4355] flex justify-between items-center text-xs">
                                                        <div>
                                                            <p className="font-extrabold text-[#E8F1F2]">{line.productName}</p>
                                                            <p className="text-[10px] text-[#4A6A7A] font-mono">{line.skuCode}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-mono font-bold text-[#87CBB9]">{uomLabel}</p>
                                                            <p className="text-[10px] text-[#8AAEBB] font-mono">
                                                                {line.unitPrice.toFixed(2)} {poDetail.currency} / chai
                                                            </p>
                                                            <p className="text-[10px] text-[#4A6A7A] font-mono">
                                                                ≈ {formatVND(line.lineTotal * poDetail.exchangeRate)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {detailTab === 'SHIPMENTS' && (
                                        <div className="space-y-2.5">
                                            {poDetail.shipments.length === 0 ? (
                                                <p className="text-xs text-[#4A6A7A] italic py-8 text-center">Chưa có lô hàng vận chuyển nào được tạo cho PO này.</p>
                                            ) : (
                                                poDetail.shipments.map(s => (
                                                    <div key={s.id} onClick={() => { setSelectedShipmentId(s.id); setShipmentDrawerOpen(true) }}
                                                        className="p-3.5 rounded-xl bg-[#142433] border border-[#2A4355] cursor-pointer hover:border-emerald-500/40 transition-all space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold font-mono text-[#87CBB9]">B/L: {s.billOfLading}</span>
                                                            <span className="text-[10px] font-extrabold text-[#5BA88A]">{s.milestoneProgress}%</span>
                                                        </div>
                                                        <div className="text-xs text-[#8AAEBB]">
                                                            <p>Tàu: {s.vesselName || 'TBC'} {s.voyageNo ? `(${s.voyageNo})` : ''}</p>
                                                            <p className="text-[10px] text-[#4A6A7A]">Cont: {s.containerNo || '—'} · ETA: {s.eta ? formatDate(s.eta) : '—'}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {detailTab === 'DOCS' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold text-[#8AAEBB] uppercase">Tài liệu đính kèm (Invoice / Packing List / C/O)</p>
                                                <label className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold cursor-pointer text-[#87CBB9] bg-emerald-500/10 border border-emerald-500/30">
                                                    {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                    Upload
                                                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.xlsx" onChange={e => handleUpload(poDetail.id, e)} disabled={uploadingDoc} />
                                                </label>
                                            </div>
                                            {poDetail.documents && poDetail.documents.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    {poDetail.documents.map(d => (
                                                        <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer"
                                                            className="flex items-center gap-2 p-2.5 rounded-lg bg-[#142433] border border-[#2A4355] text-xs hover:bg-[#1B2E3D] text-[#E8F1F2]">
                                                            <FileText size={14} className="text-[#87CBB9]" />
                                                            <span className="truncate flex-1 font-medium">{d.name}</span>
                                                            <span className="text-[10px] text-[#4A6A7A]">{formatDate(d.uploadedAt)}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-[#4A6A7A] italic py-4">Chưa có chứng từ đính kèm.</p>
                                            )}
                                        </div>
                                    )}

                                    {detailTab === 'APPROVAL' && (
                                        <div className="space-y-4">
                                            {/* Step-by-step Visual Workflow Banner */}
                                            <div className="p-4 rounded-xl bg-[#142433] border border-[#2A4355] space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-[#8AAEBB] flex items-center gap-1.5">
                                                        <ShieldCheck size={14} className="text-[#87CBB9]" /> Quy Trình Phê Duyệt PO
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <a href="/dashboard/settings/approval-matrix" target="_blank" rel="noreferrer"
                                                            className="text-[10px] text-[#87CBB9] hover:underline flex items-center gap-1 font-mono">
                                                            ⚙️ Ma trận duyệt
                                                        </a>
                                                        <POStatusBadge status={poDetail.status} />
                                                    </div>
                                                </div>

                                                {/* Visual Dynamic Steps Stepper */}
                                                <div className="grid gap-2 text-center text-[11px] pt-1"
                                                    style={{ gridTemplateColumns: `repeat(${1 + (poDetail.approvalSteps?.length || 3)}, minmax(0, 1fr))` }}>
                                                    {/* Step 0: Khởi Tạo */}
                                                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[#87CBB9] font-bold">
                                                        <div className="flex items-center justify-center gap-1 mb-0.5"><CheckCircle2 size={12} /> Khởi Tạo</div>
                                                        <span className="text-[9px] text-[#8AAEBB] font-normal block truncate">{poDetail.creatorName || 'Purchaser'}</span>
                                                    </div>

                                                    {/* Configured Multi-level Approval Steps */}
                                                    {(poDetail.approvalSteps || [
                                                        { level: 1, role: 'THU_MUA', label: 'Trưởng Mua Hàng' },
                                                        { level: 2, role: 'KE_TOAN', label: 'Kế Toán Trưởng' },
                                                        { level: 3, role: 'CEO', label: 'Tổng Giám Đốc' },
                                                    ]).map((st, sIdx) => {
                                                        const isApprovedPO = ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(poDetail.status)
                                                        const isPendingPO = poDetail.status === 'PENDING_APPROVAL'
                                                        const isCancelled = poDetail.status === 'CANCELLED'
                                                        
                                                        const isCompletedStep = isApprovedPO || (isPendingPO && (poDetail.currentApprovalStep || 1) > st.level)
                                                        const isActiveStep = isPendingPO && (poDetail.currentApprovalStep || 1) === st.level
                                                        
                                                        let bgClass = 'bg-[#1B2E3D] border-[#2A4355] text-[#4A6A7A]'
                                                        if (isCompletedStep) {
                                                            bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-[#5BA88A]'
                                                        } else if (isActiveStep) {
                                                            bgClass = 'bg-amber-500/10 border-amber-500/30 text-[#D4A853] animate-pulse font-bold'
                                                        } else if (isCancelled) {
                                                            bgClass = 'bg-red-500/10 border-red-500/30 text-[#E85D5D]'
                                                        }

                                                        return (
                                                            <div key={st.level || sIdx} className={`p-2 rounded-lg border text-[11px] ${bgClass}`}>
                                                                <div className="flex items-center justify-center gap-1 mb-0.5 font-bold">
                                                                    {isCompletedStep ? <CheckCircle2 size={12} /> : isActiveStep ? <Clock size={12} /> : <div className="w-3 h-3 rounded-full border border-current text-[8px] flex items-center justify-center">{st.level}</div>}
                                                                    Cấp {st.level}
                                                                </div>
                                                                <span className="text-[9px] block truncate font-medium">
                                                                    {st.label || st.role}
                                                                </span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Action Boxes depending on status */}
                                            {poDetail.status === 'DRAFT' && (
                                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                                                    <div className="flex items-start gap-2">
                                                        <AlertCircle size={16} className="text-[#D4A853] flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <h4 className="text-xs font-bold text-[#E8F1F2]">Đơn hàng đang ở trạng thái Nháp (DRAFT)</h4>
                                                            <p className="text-[11px] text-[#8AAEBB] mt-0.5">
                                                                Sau khi kiểm tra đầy đủ danh mục sản phẩm, quy cách đóng gói và đơn giá, hãy gửi trình duyệt để chuyển tới Cấp 1 ({(poDetail.approvalSteps?.[0]?.label) || 'Trưởng Phòng Mua Hàng'}).
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleDrawerSubmit(poDetail.id)} disabled={approving}
                                                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-[#0A1926] bg-[#87CBB9] hover:bg-[#72b6a5] transition-all disabled:opacity-50">
                                                        {approving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                                        Gửi Trình Phê Duyệt PO (Bắt đầu Cấp 1)
                                                    </button>
                                                </div>
                                            )}

                                            {poDetail.status === 'PENDING_APPROVAL' && (
                                                <div className="p-4 rounded-xl bg-[#142433] border border-[#2A4355] space-y-3">
                                                    <div className="flex items-center justify-between text-xs font-bold text-[#D4A853]">
                                                        <span className="flex items-center gap-2">
                                                            <Clock size={15} /> Đang Chờ Duyệt Cấp {poDetail.currentApprovalStep || 1} / {poDetail.totalApprovalSteps || 3}
                                                        </span>
                                                        <span className="text-[11px] text-[#87CBB9] font-normal">
                                                            {(poDetail.approvalSteps?.find(s => s.level === (poDetail.currentApprovalStep || 1))?.label) || 'Cấp Thẩm Quyền'}
                                                        </span>
                                                    </div>

                                                    {!showRejectForm ? (
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="text-[11px] text-[#8AAEBB] block mb-1">Ghi chú phê duyệt (tuỳ chọn):</label>
                                                                <input
                                                                    type="text"
                                                                    value={approvalComment}
                                                                    onChange={e => setApprovalComment(e.target.value)}
                                                                    placeholder="VD: Đồng ý duyệt giá và số lượng theo hợp đồng..."
                                                                    className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-[#1B2E3D] border border-[#2A4355] text-[#E8F1F2] placeholder-[#4A6A7A]"
                                                                />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setShowRejectForm(true)} disabled={approving}
                                                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold text-[#E85D5D] bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all disabled:opacity-50">
                                                                    <XCircle size={13} /> Từ Chối PO
                                                                </button>
                                                                <button onClick={() => handleDrawerApprove(poDetail.id)} disabled={approving}
                                                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold text-[#0A1926] bg-[#5BA88A] hover:bg-[#4d977b] transition-all disabled:opacity-50">
                                                                    {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Phê Duyệt PO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                                            <label className="text-[11px] text-[#E85D5D] font-bold block">Nhập lý do từ chối (bắt buộc):</label>
                                                            <textarea
                                                                value={rejectReason}
                                                                onChange={e => setRejectReason(e.target.value)}
                                                                placeholder="Lý do từ chối để nhân viên tạo đơn điều chỉnh..."
                                                                rows={3}
                                                                className="w-full px-3 py-2 text-xs rounded-lg outline-none bg-[#142433] border border-red-500/40 text-[#E8F1F2] placeholder-[#4A6A7A]"
                                                            />
                                                            <div className="flex justify-end gap-2">
                                                                <button onClick={() => setShowRejectForm(false)} className="px-3 py-1.5 text-xs text-[#8AAEBB] hover:bg-[#1B2E3D] rounded-lg">
                                                                    Huỷ
                                                                </button>
                                                                <button onClick={() => handleDrawerReject(poDetail.id)} disabled={approving || !rejectReason.trim()}
                                                                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#E85D5D] rounded-lg disabled:opacity-50 flex items-center gap-1">
                                                                    {approving ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />} Xác Nhận Từ Chối
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {poDetail.status === 'APPROVED' && (
                                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                                                    <CheckCircle2 size={24} className="text-[#5BA88A] flex-shrink-0" />
                                                    <div className="text-xs">
                                                        <p className="font-bold text-[#5BA88A]">Đơn mua hàng đã được Phê Duyệt chính thức</p>
                                                        <p className="text-[#8AAEBB] text-[11px] mt-0.5">
                                                            PO đã sẵn sàng để tạo lô vận tải quốc tế (Shipment / B/L) hoặc thực hiện nhận hàng vào kho.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Approval History Timeline */}
                                            <div className="space-y-2.5">
                                                <h4 className="text-xs font-bold text-[#8AAEBB] uppercase tracking-wider flex items-center gap-1">
                                                    <Clock size={13} className="text-[#87CBB9]" /> Lịch Sử Phê Duyệt & Audit Logs
                                                </h4>
                                                {poDetail.approvalHistory && poDetail.approvalHistory.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {poDetail.approvalHistory.map((item, idx) => {
                                                            const isApprove = item.action === 'APPROVE'
                                                            const isReject = item.action === 'REJECT'
                                                            const isSubmit = item.action === 'SUBMIT_APPROVAL' || item.action === 'CREATE'
                                                            
                                                            return (
                                                                <div key={item.id || idx} className="p-3 rounded-xl bg-[#142433] border border-[#2A4355] text-xs space-y-1">
                                                                    <div className="flex justify-between items-center">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                                isApprove ? 'bg-emerald-500/20 text-[#5BA88A]' : (isReject ? 'bg-red-500/20 text-[#E85D5D]' : 'bg-blue-500/20 text-[#4A8FAB]')
                                                                            }`}>
                                                                                {isApprove ? '✅ Đã Phê Duyệt' : (isReject ? '❌ Đã Từ Chối' : (isSubmit ? '🚀 Gửi Duyệt' : item.action))}
                                                                            </span>
                                                                            <span className="font-bold text-[#E8F1F2]">{item.actorName}</span>
                                                                        </div>
                                                                        <span className="text-[10px] text-[#4A6A7A] font-mono">{formatDateTime(item.createdAt)}</span>
                                                                    </div>
                                                                    {item.comment && (
                                                                        <p className="text-[11px] text-[#8AAEBB] pl-1 border-l-2 border-[#2A4355] mt-1 italic">
                                                                            "{item.comment}"
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 rounded-xl bg-[#142433] border border-[#2A4355] text-center text-xs text-[#4A6A7A] italic">
                                                        Chưa có nhật ký phê duyệt được ghi nhận cho đơn hàng này.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Create PO Drawer */}
            <CreatePODrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={poNo => {
                    setDrawerOpen(false)
                    toast.success(`Đã tạo thành công đơn mua hàng ${poNo}!`)
                    refresh()
                }}
            />

            {/* FX Summary Panel */}
            {showFxPanel && (
                <div className="rounded-2xl p-5 space-y-4" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Globe size={18} style={{ color: '#D4A853' }} />
                            <h3 className="font-bold text-sm" style={{ color: '#E8F1F2' }}>Tổng Quan Tỷ Giá Ngoại Tệ & Quy Đổi VNĐ</h3>
                        </div>
                        <button onClick={() => setShowFxPanel(false)} className="text-[#8AAEBB] hover:text-white"><X size={16} /></button>
                    </div>
                    {fxLoading ? (
                        <div className="flex items-center gap-2 py-4 text-xs text-[#87CBB9]"><Loader2 size={14} className="animate-spin" /> Đang tải tỷ giá...</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {fxSummary.map(fx => (
                                <div key={fx.currency} className="p-3.5 rounded-xl bg-[#1B2E3D] border border-[#2A4355] text-xs space-y-1.5">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-[#E8F1F2]">{fx.currency}</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-[#D4A853]">{fx.poCount} PO</span>
                                    </div>
                                    <div className="flex justify-between text-[#4A6A7A]"><span>Trung bình:</span><strong className="text-[#87CBB9] font-mono">{fx.avgRate.toLocaleString()}</strong></div>
                                    <div className="flex justify-between text-[#4A6A7A]"><span>Tổng ngoại tệ:</span><strong className="text-[#E8F1F2] font-mono">{fx.totalForeignValue.toLocaleString()} {fx.currency}</strong></div>
                                    <div className="flex justify-between text-[#4A6A7A] pt-1 border-t border-[#2A4355]"><span>Quy VNĐ:</span><strong className="text-[#87CBB9] font-mono">{formatVND(fx.totalVNDValue)}</strong></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Shipment Detail Drawer */}
            <ShipmentDetailDrawer
                open={shipmentDrawerOpen}
                shipmentId={selectedShipmentId}
                onClose={() => { setShipmentDrawerOpen(false); setSelectedShipmentId(null) }}
            />
        </div>
    )
}
