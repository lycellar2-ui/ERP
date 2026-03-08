'use client'

import React, { useState, useCallback } from 'react'
import { FileSignature, AlertCircle, CheckCircle2, Clock, Search, Plus, X, Save, Loader2, UploadCloud, FileText } from 'lucide-react'
import { ContractRow, getContracts, createContract, getCounterparties, getContractUtilization, uploadContractDocument, signContract } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { SignaturePad } from '@/components/SignaturePad'
import { toast } from 'sonner'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)' },
    PENDING_SIGN: { label: 'Chờ Ký', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    ACTIVE: { label: 'Đang Hiệu Lực', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    EXPIRED: { label: 'Hết Hạn', color: '#4A6A7A', bg: 'rgba(74,106,122,0.12)' },
    TERMINATED: { label: 'Đã Chấm Dứt', color: '#8B1A2E', bg: 'rgba(139,26,46,0.12)' },
}

const TYPE_LABEL: Record<string, string> = {
    PURCHASE: 'Mua Hàng',
    SALES: 'Bán Hàng',
    CONSIGNMENT: 'Ký Gửi',
    LOGISTICS: 'Logistics',
    WAREHOUSE_RENTAL: 'Thuê Kho',
}

// ── Create Contract Drawer ────────────────────────
type Counterparties = Awaited<ReturnType<typeof getCounterparties>>

function CreateContractDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const today = new Date().toISOString().slice(0, 10)
    const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    const [form, setForm] = useState({
        contractNo: `CNT-${Date.now().toString().slice(-6)}`,
        type: 'PURCHASE',
        counterpartyType: 'supplier' as 'supplier' | 'customer',
        supplierId: '',
        customerId: '',
        value: '',
        currency: 'USD',
        startDate: today,
        endDate: nextYear,
        paymentTerm: '',
    })
    const [counterparties, setCounterparties] = useState<Counterparties | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && !counterparties) {
        getCounterparties().then(setCounterparties)
    }

    if (!open) return null

    const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'
    const baseStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    const handleSave = async () => {
        if (!form.value || Number(form.value) <= 0) return setError('Nhập giá trị hợp đồng')
        if (form.counterpartyType === 'supplier' && !form.supplierId) return setError('Chọn nhà cung cấp')
        if (form.counterpartyType === 'customer' && !form.customerId) return setError('Chọn khách hàng')

        setSaving(true)
        const result = await createContract({
            contractNo: form.contractNo,
            type: form.type,
            supplierId: form.counterpartyType === 'supplier' ? form.supplierId : undefined,
            customerId: form.counterpartyType === 'customer' ? form.customerId : undefined,
            value: Number(form.value),
            currency: form.currency,
            startDate: form.startDate,
            endDate: form.endDate,
            paymentTerm: form.paymentTerm || undefined,
        })
        setSaving(false)

        if (result.success) { onCreated(); onClose() }
        else setError(result.error ?? 'Lỗi tạo hợp đồng')
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
            <div className="fixed top-0 right-0 h-full z-50 flex flex-col" style={{ width: 'min(500px,95vw)', background: '#0D1E2B', borderLeft: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <FileSignature size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2', fontSize: 18 }}>Tạo Hợp Đồng Mới</h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Nhập thông tin hợp đồng</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                            style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.4)', color: '#E05252' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Row label="Số Hợp Đồng *">
                            <input className={inputCls} style={baseStyle} value={form.contractNo}
                                onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                        </Row>
                        <Row label="Loại Hợp Đồng">
                            <select className={inputCls} style={baseStyle} value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}>
                                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </Row>
                    </div>

                    <Row label="Loại Đối Tác *">
                        <div className="flex gap-2">
                            {(['supplier', 'customer'] as const).map(t => (
                                <button key={t} onClick={() => setForm(f => ({ ...f, counterpartyType: t, supplierId: '', customerId: '' }))}
                                    className="flex-1 py-2 text-sm font-semibold rounded-lg"
                                    style={{
                                        background: form.counterpartyType === t ? 'rgba(135,203,185,0.15)' : '#1B2E3D',
                                        border: `1px solid ${form.counterpartyType === t ? '#87CBB9' : '#2A4355'}`,
                                        color: form.counterpartyType === t ? '#87CBB9' : '#4A6A7A',
                                    }}>
                                    {t === 'supplier' ? '🏭 Nhà Cung Cấp' : '🏨 Khách Hàng'}
                                </button>
                            ))}
                        </div>
                    </Row>

                    {!counterparties ? (
                        <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                            <Loader2 size={12} className="animate-spin" /> Đang tải...
                        </div>
                    ) : form.counterpartyType === 'supplier' ? (
                        <Row label="Nhà Cung Cấp *">
                            <select className={inputCls} style={baseStyle} value={form.supplierId}
                                onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                                <option value="">— Chọn NCC —</option>
                                {counterparties.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                            </select>
                        </Row>
                    ) : (
                        <Row label="Khách Hàng *">
                            <select className={inputCls} style={baseStyle} value={form.customerId}
                                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                                <option value="">— Chọn KH —</option>
                                {counterparties.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                            </select>
                        </Row>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <Row label="Giá Trị *">
                            <input type="number" className={inputCls} style={baseStyle} value={form.value}
                                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                                onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} placeholder="0" />
                        </Row>
                        <Row label="Tiền Tệ">
                            <select className={inputCls} style={baseStyle} value={form.currency}
                                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="VND">VND</option>
                            </select>
                        </Row>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Row label="Ngày Bắt Đầu">
                            <input type="date" className={inputCls} style={baseStyle} value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                        </Row>
                        <Row label="Ngày Hết Hạn">
                            <input type="date" className={inputCls} style={baseStyle} value={form.endDate}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                        </Row>
                    </div>

                    <Row label="Điều Khoản Thanh Toán">
                        <input className={inputCls} style={baseStyle} value={form.paymentTerm}
                            onChange={e => setForm(f => ({ ...f, paymentTerm: e.target.value }))}
                            placeholder="VD: Net 30, 50% TT sau 60 ngày..."
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </Row>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #2A4355' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang tạo...' : 'Tạo Hợp Đồng'}
                    </button>
                </div>
            </div>
        </>
    )
}

interface Props {
    initialRows: ContractRow[]
    initialTotal: number
    stats: { total: number; active: number; expiringSoon: number; expired: number }
}

export function ContractsClient({ initialRows, initialTotal, stats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [utilization, setUtilization] = useState<any>(null)
    const [utilLoading, setUtilLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState(false)

    // Signature
    const [savingSignature, setSavingSignature] = useState(false)
    const [currentSignatureUrl, setCurrentSignatureUrl] = useState('')

    const handleSign = async (contractId: string) => {
        if (!currentSignatureUrl) return
        setSavingSignature(true)
        const res = await signContract(contractId, currentSignatureUrl)
        setSavingSignature(false)
        if (res.success) {
            toast.success('Ký duyệt hợp đồng thành công!')
            if (selectedId === contractId) showUtilization(contractId, true)
            reload()
        } else {
            toast.error(`Lỗi ký duyệt: ${res.error || ''}`)
        }
    }

    const handleUpload = async (contractId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingDoc(true)
        const formData = new FormData()
        formData.append('file', file)
        const res = await uploadContractDocument(contractId, formData)
        setUploadingDoc(false)
        if (res.success) {
            toast.success('Tải file lên thành công!')
            if (selectedId === contractId) {
                showUtilization(contractId, true)
            }
        } else {
            toast.error(`Lỗi tải file: ${res.error || ''}`)
        }
    }

    const reload = useCallback(async (s?: string, st?: string) => {
        setLoading(true)
        const { rows } = await getContracts({
            search: (s ?? search) || undefined,
            status: (st ?? statusFilter) || undefined,
            pageSize: 20,
        })
        setRows(rows)
        setLoading(false)
    }, [search, statusFilter])

    const showUtilization = async (id: string, forceReload = false) => {
        if (selectedId === id && !forceReload) { setSelectedId(null); return }
        setSelectedId(id); setUtilLoading(true)
        setCurrentSignatureUrl('')
        const data = await getContractUtilization(id)
        setUtilization(data); setUtilLoading(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-end">
                <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo Hợp Đồng
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: 'Tổng Hợp Đồng', value: stats.total, icon: FileSignature, accent: '#87CBB9' },
                    { label: 'Đang Hiệu Lực', value: stats.active, icon: CheckCircle2, accent: '#5BA88A' },
                    { label: 'Sắp Hết Hạn (30d)', value: stats.expiringSoon, icon: AlertCircle, accent: '#D4A853' },
                    { label: 'Đã Hết Hạn', value: stats.expired, icon: Clock, accent: '#4A6A7A' },
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

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input type="text" placeholder="Tìm số hợp đồng..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                        className="w-full pl-9 pr-3 py-2 text-sm outline-none"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                    />
                </div>
                <select value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); reload(undefined, e.target.value) }}
                    className="px-3 py-2 text-sm outline-none"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: statusFilter ? '#E8F1F2' : '#4A6A7A', borderRadius: '6px' }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS_CFG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                            {['Số Hợp Đồng', 'Loại', 'Đối Tác', 'Giá Trị', 'Sử Dụng', 'Hiệu Lực', 'Hết Hạn', 'Trạng Thái'].map(h => (
                                <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#4A6A7A' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={8} className="text-center py-10 text-sm" style={{ color: '#4A6A7A' }}>Đang tải...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-16" style={{ color: '#4A6A7A' }}>
                                <FileSignature size={32} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                                <p>Chưa có hợp đồng nào</p>
                            </td></tr>
                        ) : rows.map(row => {
                            const cfg = STATUS_CFG[row.status] ?? { label: row.status, color: '#8AAEBB', bg: 'transparent' }
                            return (
                                <React.Fragment key={row.id}>
                                    <tr key={row.id}
                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = row.isExpiringSoon ? 'rgba(212,168,83,0.04)' : 'rgba(135,203,185,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {row.isExpiringSoon && <AlertCircle size={12} style={{ color: '#D4A853' }} />}
                                                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono"' }}>{row.contractNo}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full"
                                                style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                                {TYPE_LABEL[row.type] ?? row.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium" style={{ color: '#E8F1F2' }}>{row.counterpartyName}</p>
                                            <p className="text-xs" style={{ color: '#4A6A7A' }}>
                                                {row.counterpartyType === 'supplier' ? '🏭 NCC' : '🏨 KH'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold" style={{ fontFamily: '"DM Mono"', color: '#E8F1F2' }}>
                                            {row.currency === 'VND' ? formatVND(row.value) : `$${row.value.toLocaleString()} ${row.currency}`}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button onClick={() => showUtilization(row.id)} className="text-xs px-2 py-1 rounded"
                                                style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}>Xem</button>
                                        </td>
                                        <td className="px-4 py-3 text-xs" style={{ color: '#8AAEBB' }}>{formatDate(row.startDate)}</td>
                                        <td className="px-4 py-3 text-xs" style={{ color: row.isExpiringSoon ? '#D4A853' : '#8AAEBB' }}>
                                            {formatDate(row.endDate)}
                                            {row.isExpiringSoon && <p className="text-xs font-bold" style={{ color: '#D4A853' }}>Sắp hết hạn!</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                                style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                                        </td>
                                    </tr>
                                    {/* Utilization detail row */}
                                    {
                                        selectedId === row.id && (
                                            <tr style={{ background: '#142433' }}>
                                                <td colSpan={8} className="px-6 py-4">
                                                    {utilLoading ? (
                                                        <div className="flex items-center gap-2 text-xs" style={{ color: '#4A6A7A' }}>
                                                            <Loader2 size={12} className="animate-spin" /> Đang tải...
                                                        </div>
                                                    ) : utilization ? (
                                                        <div className="space-y-3">
                                                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#D4A853' }}>Utilization — Mức Sử Dụng</p>
                                                            <div className="grid grid-cols-4 gap-3">
                                                                {[
                                                                    { l: 'Giá Trị HĐ', v: formatVND(utilization.contractValue) },
                                                                    { l: 'Đã Sử Dụng', v: formatVND(utilization.utilizedValue) },
                                                                    { l: 'Còn Lại', v: formatVND(utilization.remaining) },
                                                                    { l: '% Sử Dụng', v: `${utilization.utilizationPct.toFixed(1)}%` },
                                                                ].map(x => (
                                                                    <div key={x.l}>
                                                                        <p className="text-[10px] uppercase" style={{ color: '#4A6A7A' }}>{x.l}</p>
                                                                        <p className="text-sm font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>{x.v}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1B2E3D' }}>
                                                                <div className="h-full rounded-full" style={{
                                                                    width: `${utilization.utilizationPct}%`,
                                                                    background: utilization.utilizationPct > 90 ? '#8B1A2E' : utilization.utilizationPct > 60 ? '#D4A853' : '#87CBB9',
                                                                }} />
                                                            </div>
                                                            <div className="flex gap-4 text-xs" style={{ color: '#8AAEBB' }}>
                                                                <span>PO: {utilization.poCount} ({formatVND(utilization.poTotal)})</span>
                                                                <span>SO: {utilization.soCount} ({formatVND(utilization.soTotal)})</span>
                                                            </div>

                                                            {/* Documents Section */}
                                                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#87CBB9' }}>Tài liệu đính kèm ({utilization.documents?.length || 0})</p>
                                                                    <label className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer"
                                                                        style={{ background: 'rgba(135,203,185,0.15)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                                                        {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                                        {uploadingDoc ? 'Đang tải...' : 'Upload PDF'}
                                                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                                                                            onChange={(e) => handleUpload(row.id, e)} disabled={uploadingDoc} />
                                                                    </label>
                                                                </div>

                                                                {utilization.documents?.length > 0 ? (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                        {utilization.documents.map((doc: any) => (
                                                                            <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noreferrer"
                                                                                className="flex items-center gap-3 p-3 rounded bg-[#1B2E3D] hover:bg-[#2A4355] transition-colors"
                                                                                style={{ border: '1px solid #2A4355' }}>
                                                                                <FileText size={20} style={{ color: '#8AAEBB' }} />
                                                                                <div className="overflow-hidden">
                                                                                    <p className="text-sm font-medium truncate" style={{ color: '#E8F1F2' }}>{doc.name}</p>
                                                                                    <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{formatDate(doc.uploadedAt)}</p>
                                                                                </div>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs italic" style={{ color: '#4A6A7A' }}>Chưa có file đính kèm nào.</p>
                                                                )}
                                                            </div>

                                                            {/* Signature Section */}
                                                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(42,67,85,0.5)' }}>
                                                                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#87CBB9' }}>
                                                                    Ký Điện Tử Khê Duyệt Nhanh
                                                                </p>
                                                                {utilization.signatureUrl ? (
                                                                    <div className="p-3 rounded bg-[#1B2E3D]" style={{ border: '1px solid rgba(91,168,138,0.3)' }}>
                                                                        <p className="text-xs text-[#5BA88A] mb-2 flex items-center gap-1"><CheckCircle2 size={12} /> Đã Ký Duyệt</p>
                                                                        <img src={utilization.signatureUrl} alt="Signature" className="h-[80px] object-contain bg-white rounded" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        {row.status === 'DRAFT' ? (
                                                                            <>
                                                                                <SignaturePad onEnd={setCurrentSignatureUrl} />
                                                                                <div className="flex justify-end">
                                                                                    <button onClick={() => handleSign(row.id)} disabled={!currentSignatureUrl || savingSignature}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50 transition-colors"
                                                                                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                                                                                        {savingSignature ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                                                        Lưu Chữ Ký & Hiệu Lực Hoá Hợp Đồng
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        ) : (
                                                                            <p className="text-xs italic" style={{ color: '#4A6A7A' }}>Chỉ hợp đồng nháp mới cần ký.</p>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                        </div>
                                                    ) : (
                                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Không tìm thấy dữ liệu</p>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <CreateContractDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={() => { setDrawerOpen(false); reload() }}
            />
        </div>
    )
}
