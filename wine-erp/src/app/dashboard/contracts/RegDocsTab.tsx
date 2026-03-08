'use client'

import React, { useState, useCallback } from 'react'
import {
    Shield, Search, Plus, X, Save, Loader2, UploadCloud, FileText,
    AlertTriangle, CheckCircle2, Clock, Building2, Ship, Package,
    Factory, Users, ChevronDown, RefreshCw, Flame, Warehouse,
} from 'lucide-react'
import {
    RegDocRow, getRegulatedDocs, createRegulatedDoc, uploadRegDocFile,
    getRegDocFiles, renewRegulatedDoc, deleteRegulatedDoc, getRegDocLinkOptions,
} from './reg-doc-actions'
import {
    REG_DOC_CATEGORY_LABELS, REG_DOC_TYPE_LABELS, REG_DOC_SCOPE_LABELS,
    CATEGORY_TYPE_MAP,
} from './reg-doc-constants'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

// ═══════════════════════════════════════════════════
// Status & Scope Config
// ═══════════════════════════════════════════════════

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    ACTIVE: { label: 'Hiệu Lực', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    EXPIRING: { label: 'Sắp Hết Hạn', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    EXPIRED: { label: 'Đã Hết Hạn', color: '#E05252', bg: 'rgba(224,82,82,0.12)' },
    RENEWED: { label: 'Đã Gia Hạn', color: '#4A8FAB', bg: 'rgba(74,143,171,0.12)' },
    REVOKED: { label: 'Bị Thu Hồi', color: '#8B1A2E', bg: 'rgba(139,26,46,0.12)' },
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    COMPANY_LICENSE: <Building2 size={14} />,
    IMPORT_DOCUMENT: <Ship size={14} />,
    PRODUCT_CERTIFICATION: <Package size={14} />,
    FACILITY_COMPLIANCE: <Flame size={14} />,
    TRADE_AGREEMENT: <FileText size={14} />,
}

const SCOPE_ICONS: Record<string, React.ReactNode> = {
    COMPANY: <Building2 size={12} />,
    SUPPLIER: <Factory size={12} />,
    CUSTOMER: <Users size={12} />,
    PRODUCT: <Package size={12} />,
    SHIPMENT: <Ship size={12} />,
    LOT: <Warehouse size={12} />,
}

function getDaysColor(days: number | null): string {
    if (days === null) return '#5BA88A'
    if (days <= 0) return '#E05252'
    if (days <= 30) return '#E05252'
    if (days <= 60) return '#D4A853'
    if (days <= 90) return '#D4A853'
    return '#5BA88A'
}

function getDaysLabel(days: number | null): string {
    if (days === null) return 'Vô hạn'
    if (days <= 0) return `Quá hạn ${Math.abs(days)} ngày`
    return `${days} ngày`
}

// ═══════════════════════════════════════════════════
// Create/Renew Drawer
// ═══════════════════════════════════════════════════

type LinkOptions = Awaited<ReturnType<typeof getRegDocLinkOptions>>

function CreateRegDocDrawer({ open, onClose, onCreated, renewFrom }: {
    open: boolean; onClose: () => void; onCreated: () => void
    renewFrom?: RegDocRow | null
}) {
    const isRenew = !!renewFrom

    const [form, setForm] = useState({
        docNo: isRenew ? `${renewFrom.docNo}-R${renewFrom.version + 1}` : `RD-${Date.now().toString().slice(-6)}`,
        category: isRenew ? renewFrom.category : 'COMPANY_LICENSE',
        type: isRenew ? renewFrom.type : 'DISTRIBUTION_LICENSE',
        name: isRenew ? renewFrom.name : '',
        description: '',
        issueDate: new Date().toISOString().slice(0, 10),
        effectiveDate: '',
        expiryDate: '',
        issuingAuthority: '',
        referenceNo: '',
        scope: isRenew ? renewFrom.scope : 'COMPANY',
        supplierId: '',
        customerId: '',
        productId: '',
        shipmentId: '',
        assignedToId: '',
        keepHistory: true,
    })
    const [linkOptions, setLinkOptions] = useState<LinkOptions | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && !linkOptions) {
        getRegDocLinkOptions().then(setLinkOptions)
    }

    if (!open) return null

    const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'
    const baseStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }
    const focusStyle = { borderColor: '#87CBB9' }

    const availableTypes = CATEGORY_TYPE_MAP[form.category] ?? []

    const handleSave = async () => {
        if (!form.name) return setError('Nhập tên giấy tờ')

        setSaving(true)
        setError('')

        if (isRenew) {
            const result = await renewRegulatedDoc({
                originalDocId: renewFrom.id,
                newDocNo: form.docNo,
                issueDate: form.issueDate,
                expiryDate: form.expiryDate || undefined,
                issuingAuthority: form.issuingAuthority || undefined,
                keepHistory: form.keepHistory,
            })
            setSaving(false)
            if (result.success) { toast.success('Gia hạn thành công!'); onCreated(); onClose() }
            else { setError(result.error ?? 'Lỗi gia hạn'); toast.error(result.error ?? 'Lỗi gia hạn') }
        } else {
            const result = await createRegulatedDoc({
                docNo: form.docNo,
                category: form.category,
                type: form.type,
                name: form.name,
                description: form.description || undefined,
                issueDate: form.issueDate,
                effectiveDate: form.effectiveDate || undefined,
                expiryDate: form.expiryDate || undefined,
                issuingAuthority: form.issuingAuthority || undefined,
                referenceNo: form.referenceNo || undefined,
                scope: form.scope,
                supplierId: form.supplierId || undefined,
                customerId: form.customerId || undefined,
                productId: form.productId || undefined,
                shipmentId: form.shipmentId || undefined,
                assignedToId: form.assignedToId || undefined,
            })
            setSaving(false)
            if (result.success) { toast.success('Tạo giấy tờ thành công!'); onCreated(); onClose() }
            else { setError(result.error ?? 'Lỗi tạo giấy tờ'); toast.error(result.error ?? 'Lỗi') }
        }
    }

    const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>{label}</label>
            {children}
        </div>
    )

    return (
        <>
            <div className="fixed inset-0 z-40" style={{ background: 'rgba(10,5,2,0.7)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(560px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: isRenew ? 'rgba(74,143,171,0.15)' : 'rgba(135,203,185,0.15)' }}>
                            {isRenew ? <RefreshCw size={16} style={{ color: '#4A8FAB' }} /> : <Shield size={16} style={{ color: '#87CBB9' }} />}
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>
                                {isRenew ? `Gia Hạn: ${renewFrom.name}` : 'Thêm Giấy Tờ Pháp Lý'}
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                {isRenew ? `Version ${renewFrom.version} → ${renewFrom.version + 1}` : 'Tạo mới chứng từ / giấy phép'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                            style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                            <AlertTriangle size={14} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Row label="Mã Giấy Tờ *">
                            <input className={inputCls} style={baseStyle} value={form.docNo}
                                onChange={e => setForm(f => ({ ...f, docNo: e.target.value }))}
                                onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </Row>
                        <Row label="Tên Giấy Tờ *">
                            <input className={inputCls} style={baseStyle} value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                                placeholder="VD: GP Phân phối rượu 2026" />
                        </Row>
                    </div>

                    {!isRenew && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Row label="Nhóm">
                                    <select className={inputCls} style={baseStyle} value={form.category}
                                        onChange={e => {
                                            const cat = e.target.value
                                            const types = CATEGORY_TYPE_MAP[cat] ?? []
                                            setForm(f => ({ ...f, category: cat, type: types[0] ?? 'OTHER' }))
                                        }}>
                                        {Object.entries(REG_DOC_CATEGORY_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </Row>
                                <Row label="Loại Chi Tiết">
                                    <select className={inputCls} style={baseStyle} value={form.type}
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                        {availableTypes.map(t => (
                                            <option key={t} value={t}>{REG_DOC_TYPE_LABELS[t] ?? t}</option>
                                        ))}
                                        <option value="OTHER">Khác</option>
                                    </select>
                                </Row>
                            </div>

                            <Row label="Phạm Vi Áp Dụng">
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(REG_DOC_SCOPE_LABELS).map(([k, v]) => (
                                        <button key={k} onClick={() => setForm(f => ({ ...f, scope: k }))}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                                            style={{
                                                background: form.scope === k ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                                border: `1px solid ${form.scope === k ? '#87CBB9' : '#2A4355'}`,
                                                color: form.scope === k ? '#87CBB9' : '#4A6A7A',
                                            }}>
                                            {SCOPE_ICONS[k]} {v}
                                        </button>
                                    ))}
                                </div>
                            </Row>

                            {/* Linked entity based on scope */}
                            {form.scope === 'SUPPLIER' && linkOptions && (
                                <Row label="Nhà Cung Cấp">
                                    <select className={inputCls} style={baseStyle} value={form.supplierId}
                                        onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                                        <option value="">— Chọn NCC —</option>
                                        {linkOptions.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'CUSTOMER' && linkOptions && (
                                <Row label="Khách Hàng">
                                    <select className={inputCls} style={baseStyle} value={form.customerId}
                                        onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                                        <option value="">— Chọn KH —</option>
                                        {linkOptions.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'PRODUCT' && linkOptions && (
                                <Row label="Sản Phẩm">
                                    <select className={inputCls} style={baseStyle} value={form.productId}
                                        onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                                        <option value="">— Chọn SP —</option>
                                        {linkOptions.products.map(p => <option key={p.id} value={p.id}>{p.skuCode} — {p.productName}</option>)}
                                    </select>
                                </Row>
                            )}
                            {form.scope === 'SHIPMENT' && linkOptions && (
                                <Row label="Lô Hàng (B/L)">
                                    <select className={inputCls} style={baseStyle} value={form.shipmentId}
                                        onChange={e => setForm(f => ({ ...f, shipmentId: e.target.value }))}>
                                        <option value="">— Chọn Shipment —</option>
                                        {linkOptions.shipments.map(s => <option key={s.id} value={s.id}>{s.billOfLading} {s.containerNo ? `(${s.containerNo})` : ''}</option>)}
                                    </select>
                                </Row>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Row label="Ngày Cấp *">
                            <input type="date" className={inputCls} style={baseStyle} value={form.issueDate}
                                onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
                        </Row>
                        <Row label="Ngày Hết Hạn">
                            <input type="date" className={inputCls} style={baseStyle} value={form.expiryDate}
                                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                        </Row>
                    </div>

                    <Row label="Cơ Quan Cấp">
                        <input className={inputCls} style={baseStyle} value={form.issuingAuthority}
                            onChange={e => setForm(f => ({ ...f, issuingAuthority: e.target.value }))}
                            placeholder="VD: Sở Công Thương HCM, Cảnh sát PCCC..."
                            onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </Row>

                    {!isRenew && (
                        <Row label="Mô Tả / Ghi Chú">
                            <textarea className={inputCls} style={{ ...baseStyle, minHeight: 60 }} value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Ghi chú thêm về giấy tờ..."
                                onFocus={e => Object.assign(e.currentTarget.style, focusStyle)}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </Row>
                    )}

                    {isRenew && (
                        <Row label="Giữ Lịch Sử Phiên Bản Cũ?">
                            <div className="flex gap-3">
                                {[true, false].map(v => (
                                    <button key={String(v)} onClick={() => setForm(f => ({ ...f, keepHistory: v }))}
                                        className="flex-1 py-2 text-sm font-semibold rounded-lg"
                                        style={{
                                            background: form.keepHistory === v ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                            border: `1px solid ${form.keepHistory === v ? '#87CBB9' : '#2A4355'}`,
                                            color: form.keepHistory === v ? '#87CBB9' : '#4A6A7A',
                                        }}>
                                        {v ? '✅ Giữ lịch sử (RENEWED)' : '🗑️ Xóa bản cũ'}
                                    </button>
                                ))}
                            </div>
                        </Row>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: isRenew ? '#4A8FAB' : '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : isRenew ? <RefreshCw size={14} /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : isRenew ? 'Gia Hạn' : 'Tạo Giấy Tờ'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ═══════════════════════════════════════════════════
// Detail Row (expand)
// ═══════════════════════════════════════════════════

function RegDocDetailRow({ doc, onUpload, onRenew, onDelete }: {
    doc: RegDocRow
    onUpload: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
    onRenew: (doc: RegDocRow) => void
    onDelete: (id: string) => void
}) {
    const [files, setFiles] = useState<any[] | null>(null)
    const [loadingFiles, setLoadingFiles] = useState(true)

    React.useEffect(() => {
        getRegDocFiles(doc.id).then(f => { setFiles(f); setLoadingFiles(false) })
    }, [doc.id])

    return (
        <tr style={{ background: '#142433' }}>
            <td colSpan={10} className="px-6 py-4">
                <div className="space-y-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Cơ Quan Cấp</p>
                            <p className="text-sm" style={{ color: '#E8F1F2' }}>{doc.issuingAuthority || '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Phạm Vi</p>
                            <p className="text-sm flex items-center gap-1" style={{ color: '#E8F1F2' }}>
                                {SCOPE_ICONS[doc.scope]} {REG_DOC_SCOPE_LABELS[doc.scope] ?? doc.scope}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Liên Kết</p>
                            <p className="text-sm" style={{ color: '#87CBB9' }}>{doc.linkedEntity || 'Không'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>Version</p>
                            <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>v{doc.version}</p>
                        </div>
                    </div>

                    {/* Files */}
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#87CBB9' }}>
                                File Đính Kèm ({files?.length ?? 0})
                            </p>
                            <label className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                                style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                <UploadCloud size={12} /> Upload
                                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                                    onChange={(e) => onUpload(doc.id, e)} />
                            </label>
                        </div>
                        {loadingFiles ? (
                            <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                                <Loader2 size={12} className="animate-spin" /> Đang tải...
                            </div>
                        ) : files && files.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {files.map((f: any) => (
                                    <a key={f.id} href={f.fileUrl} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-3 p-2.5 rounded transition-colors"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#2A4355')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '#1B2E3D')}>
                                        <FileText size={16} style={{ color: '#8AAEBB' }} />
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-medium truncate" style={{ color: '#E8F1F2' }}>{f.name}</p>
                                            <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{formatDate(f.uploadedAt)}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs italic" style={{ color: '#4A6A7A' }}>Chưa có file đính kèm.</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-3" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                        {doc.status !== 'RENEWED' && doc.status !== 'REVOKED' && (
                            <button onClick={() => onRenew(doc)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                                style={{ background: 'rgba(74,143,171,0.15)', color: '#4A8FAB', border: '1px solid rgba(74,143,171,0.3)' }}>
                                <RefreshCw size={12} /> Gia Hạn
                            </button>
                        )}
                        <button onClick={() => { if (confirm('Xác nhận xóa giấy tờ này?')) onDelete(doc.id) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                            style={{ background: 'rgba(139,26,46,0.1)', color: '#E05252', border: '1px solid rgba(139,26,46,0.3)' }}>
                            <X size={12} /> Xóa
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    )
}

// ═══════════════════════════════════════════════════
// Main Tab Component
// ═══════════════════════════════════════════════════

interface Props {
    initialRows: RegDocRow[]
    initialTotal: number
    stats: {
        total: number; active: number; expiringSoon: number; expired: number
        categoryBreakdown: Record<string, number>
    }
}

export function RegDocsTab({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [renewTarget, setRenewTarget] = useState<RegDocRow | null>(null)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [uploadingDoc, setUploadingDoc] = useState(false)

    const reload = useCallback(async (s?: string, cat?: string, st?: string) => {
        setLoading(true)
        const { rows } = await getRegulatedDocs({
            search: (s ?? search) || undefined,
            category: (cat ?? categoryFilter) || undefined,
            status: (st ?? statusFilter) || undefined,
            pageSize: 20,
        })
        setRows(rows)
        setLoading(false)
    }, [search, categoryFilter, statusFilter])

    const handleUpload = async (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadRegDocFile(docId, formData)
        setUploadingDoc(false)
        if (res.success) {
            toast.success('Upload file thành công!')
            // Force re-expand to reload files
            setSelectedId(null)
            setTimeout(() => setSelectedId(docId), 100)
        } else {
            toast.error(`Lỗi upload: ${res.error || ''}`)
        }
    }

    const handleDelete = async (id: string) => {
        const res = await deleteRegulatedDoc(id)
        if (res.success) { toast.success('Đã xóa'); reload() }
        else toast.error(res.error ?? 'Lỗi xóa')
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                    { label: 'Tổng Giấy Tờ', value: stats.total, icon: Shield, accent: '#87CBB9' },
                    { label: 'Đang Hiệu Lực', value: stats.active, icon: CheckCircle2, accent: '#5BA88A' },
                    { label: 'Sắp Hết Hạn', value: stats.expiringSoon, icon: AlertTriangle, accent: '#D4A853' },
                    { label: 'Đã Hết Hạn', value: stats.expired, icon: Clock, accent: '#E05252' },
                    { label: 'PCCC & Kho', value: stats.categoryBreakdown?.FACILITY_COMPLIANCE ?? 0, icon: Flame, accent: '#D4A853' },
                ].map(s => {
                    const Icon = s.icon
                    return (
                        <div key={s.label} className="p-4 rounded-md flex items-center gap-3"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', borderLeft: `3px solid ${s.accent}` }}>
                            <Icon size={20} style={{ color: s.accent }} />
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-xl font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>{s.value}</p>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Filters + Create */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input type="text" placeholder="Tìm mã / tên giấy tờ..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                        className="w-full pl-9 pr-3 py-2 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                </div>
                <select value={categoryFilter}
                    onChange={e => { setCategoryFilter(e.target.value); reload(undefined, e.target.value) }}
                    className="px-3 py-2 text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: categoryFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">Tất cả nhóm</option>
                    {Object.entries(REG_DOC_CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                    ))}
                </select>
                <select value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); reload(undefined, undefined, e.target.value) }}
                    className="px-3 py-2 text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
                <button onClick={() => { setRenewTarget(null); setDrawerOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ml-auto"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Thêm Giấy Tờ
                </button>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Mã GT', 'Nhóm', 'Loại', 'Tên', 'Ngày Cấp', 'Hết Hạn', 'Còn Lại', 'Liên Kết', 'Files', 'Trạng Thái'].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={10} className="text-center py-10 text-sm" style={{ color: '#4A6A7A' }}>Đang tải...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                <Shield size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                <p>Chưa có giấy tờ nào</p>
                            </td></tr>
                        ) : rows.map(row => {
                            const cfg = STATUS_CFG[row.status] ?? { label: row.status, color: '#8AAEBB', bg: 'transparent' }
                            const isExpanded = selectedId === row.id
                            return (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className="cursor-pointer"
                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onClick={() => setSelectedId(isExpanded ? null : row.id)}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.docNo}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                                style={{ background: 'rgba(135,203,185,0.08)', color: '#87CBB9' }}>
                                                {CATEGORY_ICONS[row.category]} {REG_DOC_CATEGORY_LABELS[row.category] ?? row.category}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{REG_DOC_TYPE_LABELS[row.type] ?? row.type}</span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <p className="text-sm font-medium truncate max-w-[180px]" style={{ color: '#E8F1F2' }}>{row.name}</p>
                                        </td>
                                        <td className="px-3 py-3 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(row.issueDate)}</td>
                                        <td className="px-3 py-3 text-xs" style={{ color: row.expiryDate ? getDaysColor(row.daysRemaining) : '#4A6A7A' }}>
                                            {row.expiryDate ? formatDate(row.expiryDate) : 'Vô hạn'}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs font-bold" style={{ color: getDaysColor(row.daysRemaining), fontFamily: '"DM Mono"' }}>
                                                {getDaysLabel(row.daysRemaining)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            {row.linkedEntity ? (
                                                <span className="flex items-center gap-1 text-xs" style={{ color: '#8AAEBB' }}>
                                                    {SCOPE_ICONS[row.scope]} <span className="truncate max-w-[120px]">{row.linkedEntity}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs" style={{ color: '#4A6A7A' }}>—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}>
                                                {row.fileCount}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <RegDocDetailRow
                                            doc={row}
                                            onUpload={handleUpload}
                                            onRenew={(d) => { setRenewTarget(d); setDrawerOpen(true) }}
                                            onDelete={handleDelete}
                                        />
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Drawer */}
            <CreateRegDocDrawer
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setRenewTarget(null) }}
                onCreated={() => { setDrawerOpen(false); setRenewTarget(null); reload() }}
                renewFrom={renewTarget}
            />
        </div>
    )
}
