'use client'

import React, { useState, useCallback } from 'react'
import { FileSignature, AlertCircle, CheckCircle2, Clock, Search, Plus, Save, Loader2, UploadCloud, FileText } from 'lucide-react'
import { ContractRow, getContracts, createContract, getCounterparties, getContractUtilization, uploadContractDocument, signContract } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { SignaturePad } from '@/components/SignaturePad'
import { toast } from 'sonner'
import {
    Button,
    Badge,
    Drawer,
    Toolbar,
    StatGrid,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Td,
    TableMessageRow,
    EmptyState,
} from '@/components/ui'

const STATUS_CFG: Record<string, { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }> = {
    DRAFT: { label: 'Nháp', tone: 'neutral' },
    PENDING_SIGN: { label: 'Chờ Ký', tone: 'warning' },
    ACTIVE: { label: 'Đang Hiệu Lực', tone: 'success' },
    EXPIRED: { label: 'Hết Hạn', tone: 'neutral' },
    TERMINATED: { label: 'Đã Chấm Dứt', tone: 'danger' },
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
        priceTerm: '',
        discountTerms: '',
        marketingBudget: '',
        stampVerification: '',
        archiveStatus: '',
    })
    const [counterparties, setCounterparties] = useState<Counterparties | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (open && !counterparties) {
        getCounterparties().then(setCounterparties)
    }

    const inputCls = 'w-full px-3 py-2 rounded-md text-xs bg-white border border-lys-border text-lys-title focus:border-lys-primary focus:outline-none transition-colors'

    const handleSave = async () => {
        if (!form.value || Number(form.value) <= 0) return setError('Nhập giá trị hợp đồng')
        if (form.counterpartyType === 'supplier' && !form.supplierId) return setError('Chọn nhà cung cấp')
        if (form.counterpartyType === 'customer' && !form.customerId) return setError('Chọn khách hàng')

        setSaving(true)
        setError('')
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
            priceTerm: form.priceTerm || undefined,
            discountTerms: form.discountTerms || undefined,
            marketingBudget: form.marketingBudget || undefined,
            stampVerification: form.stampVerification || undefined,
            archiveStatus: form.archiveStatus || undefined,
        })
        setSaving(false)

        if (result.success) {
            toast.success('Tạo hợp đồng thành công')
            onCreated()
            onClose()
        } else {
            setError(result.error ?? 'Lỗi tạo hợp đồng')
        }
    }

    const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-lys-muted block mb-1.5">{label}</label>
            {children}
        </div>
    )

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title="Tạo Hợp Đồng Mới"
            description="Nhập thông tin hợp đồng pháp lý & thương mại"
            size="md"
            footer={
                <div className="flex items-center justify-end gap-2 w-full">
                    <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>Hủy</Button>
                    <Button variant="primary" size="sm" onClick={handleSave} disabled={saving} loading={saving}>
                        <Save size={14} />
                        {saving ? 'Đang tạo...' : 'Tạo Hợp Đồng'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs bg-red-50 border border-red-200 text-red-700">
                        <AlertCircle size={14} className="shrink-0" /> {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Row label="Số Hợp Đồng *">
                        <input
                            className={inputCls}
                            value={form.contractNo}
                            onChange={e => setForm(f => ({ ...f, contractNo: e.target.value }))}
                        />
                    </Row>
                    <Row label="Loại Hợp Đồng">
                        <select
                            className={inputCls}
                            value={form.type}
                            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                        >
                            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Row>
                </div>

                <Row label="Loại Đối Tác *">
                    <div className="flex gap-2">
                        {(['supplier', 'customer'] as const).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, counterpartyType: t, supplierId: '', customerId: '' }))}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                                    form.counterpartyType === t
                                        ? 'bg-lys-primary/10 border-lys-primary text-lys-primary'
                                        : 'bg-white border-lys-border text-lys-muted hover:border-lys-primary/40'
                                }`}
                            >
                                {t === 'supplier' ? '🏭 Nhà Cung Cấp' : '🏨 Khách Hàng'}
                            </button>
                        ))}
                    </div>
                </Row>

                {!counterparties ? (
                    <div className="flex items-center gap-2 text-xs text-lys-muted py-2">
                        <Loader2 size={12} className="animate-spin text-lys-primary" /> Đang tải danh sách đối tác...
                    </div>
                ) : form.counterpartyType === 'supplier' ? (
                    <Row label="Nhà Cung Cấp *">
                        <select
                            className={inputCls}
                            value={form.supplierId}
                            onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                        >
                            <option value="">— Chọn NCC —</option>
                            {counterparties.suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                        </select>
                    </Row>
                ) : (
                    <Row label="Khách Hàng *">
                        <select
                            className={inputCls}
                            value={form.customerId}
                            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                        >
                            <option value="">— Chọn KH —</option>
                            {counterparties.customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>
                    </Row>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Row label="Giá Trị *">
                        <input
                            type="number"
                            className={inputCls}
                            value={form.value}
                            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                            placeholder="0"
                        />
                    </Row>
                    <Row label="Tiền Tệ">
                        <select
                            className={inputCls}
                            value={form.currency}
                            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="VND">VND</option>
                        </select>
                    </Row>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Row label="Ngày Bắt Đầu">
                        <input
                            type="date"
                            className={inputCls}
                            value={form.startDate}
                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        />
                    </Row>
                    <Row label="Ngày Hết Hạn">
                        <input
                            type="date"
                            className={inputCls}
                            value={form.endDate}
                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        />
                    </Row>
                </div>

                <Row label="Điều Khoản Thanh Toán">
                    <input
                        className={inputCls}
                        value={form.paymentTerm}
                        onChange={e => setForm(f => ({ ...f, paymentTerm: e.target.value }))}
                        placeholder="VD: Net 30, 50% TT sau 60 ngày..."
                    />
                </Row>

                <Row label="Điều Khoản Giá Cả (Price Term)">
                    <input
                        className={inputCls}
                        value={form.priceTerm}
                        onChange={e => setForm(f => ({ ...f, priceTerm: e.target.value }))}
                        placeholder="VD: Giá CIF Hồ Chí Minh cố định..."
                    />
                </Row>

                <Row label="Quy Định Giảm Giá (Discount)">
                    <input
                        className={inputCls}
                        value={form.discountTerms}
                        onChange={e => setForm(f => ({ ...f, discountTerms: e.target.value }))}
                        placeholder="VD: Giảm 5% khi mua trên 500 chai..."
                    />
                </Row>

                <Row label="Ngân Sách Marketing">
                    <input
                        className={inputCls}
                        value={form.marketingBudget}
                        onChange={e => setForm(f => ({ ...f, marketingBudget: e.target.value }))}
                        placeholder="VD: NCC hỗ trợ $2,000 ngân sách chạy thử..."
                    />
                </Row>

                <Row label="Kiểm Tra Khớp Dấu & Tên Hợp Đồng">
                    <input
                        className={inputCls}
                        value={form.stampVerification}
                        onChange={e => setForm(f => ({ ...f, stampVerification: e.target.value }))}
                        placeholder="VD: Đã kiểm tra khớp 100%..."
                    />
                </Row>

                <Row label="Tình Trạng Lưu Trữ Bản Cứng / Bản Mềm">
                    <input
                        className={inputCls}
                        value={form.archiveStatus}
                        onChange={e => setForm(f => ({ ...f, archiveStatus: e.target.value }))}
                        placeholder="VD: Bản mềm đã upload, bản cứng lưu tại Tủ 2..."
                    />
                </Row>
            </div>
        </Drawer>
    )
}

interface Props {
    initialRows: ContractRow[]
    initialTotal: number
    stats: { total: number; active: number; expiringSoon: number; expired: number }
}

export function ContractsClient({ initialRows, initialTotal: _initialTotal, stats }: Props) {
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

    const reload = useCallback(async (s?: string, st?: string) => {
        setLoading(true)
        const { rows: updatedRows } = await getContracts({
            search: (s ?? search) || undefined,
            status: (st ?? statusFilter) || undefined,
            pageSize: 20,
        })
        setRows(updatedRows)
        setLoading(false)
    }, [search, statusFilter])

    const showUtilization = async (id: string, forceReload = false) => {
        if (selectedId === id && !forceReload) { setSelectedId(null); return }
        setSelectedId(id)
        setUtilLoading(true)
        setCurrentSignatureUrl('')
        const data = await getContractUtilization(id)
        setUtilization(data)
        setUtilLoading(false)
    }

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

    return (
        <div className="space-y-4">
            {/* Stats */}
            <StatGrid>
                <StatCard
                    label="Tổng Hợp Đồng"
                    value={stats.total}
                    icon={FileSignature}
                    tone="brand"
                />
                <StatCard
                    label="Đang Hiệu Lực"
                    value={stats.active}
                    icon={CheckCircle2}
                    tone="success"
                />
                <StatCard
                    label="Sắp Hết Hạn (30d)"
                    value={stats.expiringSoon}
                    icon={AlertCircle}
                    tone="warning"
                />
                <StatCard
                    label="Đã Hết Hạn"
                    value={stats.expired}
                    icon={Clock}
                    tone="neutral"
                />
            </StatGrid>

            {/* Filters & Actions */}
            <Toolbar
                left={
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" />
                            <input
                                type="text"
                                placeholder="Tìm số hợp đồng..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); reload(e.target.value) }}
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-lys-border rounded-md text-lys-title focus:border-lys-primary focus:outline-none"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); reload(undefined, e.target.value) }}
                            className="px-2.5 py-1.5 text-xs bg-white border border-lys-border rounded-md text-lys-title focus:border-lys-primary focus:outline-none"
                        >
                            <option value="">Tất cả trạng thái</option>
                            {Object.entries(STATUS_CFG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                    </div>
                }
                right={
                    <Button variant="primary" size="sm" onClick={() => setDrawerOpen(true)}>
                        <Plus size={15} />
                        Tạo Hợp Đồng
                    </Button>
                }
            />

            {/* Table */}
            <Table>
                <THead>
                    <Tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Số Hợp Đồng</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Loại</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Đối Tác</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Giá Trị</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Sử Dụng</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Hiệu Lực</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Hết Hạn</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-lys-muted">Trạng Thái</th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        <TableMessageRow colSpan={8}>
                            <div className="py-12 flex items-center justify-center text-xs text-lys-muted gap-2">
                                <Loader2 size={16} className="animate-spin text-lys-primary" /> Đang tải hợp đồng...
                            </div>
                        </TableMessageRow>
                    ) : rows.length === 0 ? (
                        <TableMessageRow colSpan={8}>
                            <EmptyState
                                title="Chưa có hợp đồng nào"
                                description="Tạo hợp đồng mới để bắt đầu theo dõi hiệu lực và đối soát ngân sách."
                                action={
                                    <Button variant="secondary" size="sm" onClick={() => setDrawerOpen(true)}>
                                        <Plus size={14} />
                                        Tạo Hợp Đồng Mới
                                    </Button>
                                }
                            />
                        </TableMessageRow>
                    ) : rows.map(row => {
                        const cfg = STATUS_CFG[row.status] ?? { label: row.status, tone: 'neutral' as const }
                        const isExpanded = selectedId === row.id
                        return (
                            <React.Fragment key={row.id}>
                                <Tr className={`cursor-pointer transition-colors ${isExpanded ? 'bg-lys-primary/5' : ''}`}>
                                    <Td className="font-semibold text-lys-primary">
                                        <div className="flex items-center gap-2">
                                            {row.isExpiringSoon && <AlertCircle size={14} className="text-amber-600 shrink-0" />}
                                            <span>{row.contractNo}</span>
                                        </div>
                                    </Td>
                                    <Td>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-medium bg-lys-primary/10 text-lys-primary whitespace-nowrap shrink-0">
                                            {TYPE_LABEL[row.type] ?? row.type}
                                        </span>
                                    </Td>
                                    <Td>
                                        <p className="text-xs font-semibold text-lys-title">{row.counterpartyName}</p>
                                        <p className="text-[10px] text-lys-muted">
                                            {row.counterpartyType === 'supplier' ? '🏭 NCC' : '🏨 KH'}
                                        </p>
                                    </Td>
                                    <Td align="right" className="font-semibold text-lys-title">
                                        {row.currency === 'VND' ? formatVND(row.value) : `$${row.value.toLocaleString()} ${row.currency}`}
                                    </Td>
                                    <Td align="center">
                                        <Button
                                            variant={isExpanded ? 'primary' : 'ghost'}
                                            size="sm"
                                            onClick={() => showUtilization(row.id)}
                                        >
                                            {isExpanded ? 'Đóng' : 'Xem'}
                                        </Button>
                                    </Td>
                                    <Td className="text-lys-muted text-xs">{formatDate(row.startDate)}</Td>
                                    <Td className={`text-xs ${row.isExpiringSoon ? 'text-amber-700 font-semibold' : 'text-lys-muted'}`}>
                                        {formatDate(row.endDate)}
                                        {row.isExpiringSoon && <span className="block text-[10px] text-amber-600 font-medium">Sắp hết hạn!</span>}
                                    </Td>
                                    <Td align="center">
                                        <Badge tone={cfg.tone}>{cfg.label}</Badge>
                                    </Td>
                                </Tr>

                                {/* Utilization detail row */}
                                {isExpanded && (
                                    <Tr className="bg-lys-bg/50">
                                        <Td colSpan={8} className="p-4">
                                            {utilLoading ? (
                                                <div className="flex items-center justify-center gap-2 text-xs text-lys-muted py-6">
                                                    <Loader2 size={16} className="animate-spin text-lys-primary" /> Đang tải chi tiết hợp đồng...
                                                </div>
                                            ) : utilization ? (
                                                <div className="space-y-4 bg-white p-4 rounded-lg border border-lys-border">
                                                    <div className="flex items-center justify-between border-b border-lys-border pb-3">
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-lys-primary">
                                                            Mức Độ Sử Dụng & Đối Soát Hợp Đồng
                                                        </h4>
                                                        <div className="flex gap-4 text-xs text-lys-muted font-medium">
                                                            <span>PO: <strong className="text-lys-title">{utilization.poCount}</strong> ({formatVND(utilization.poTotal)})</span>
                                                            <span>SO: <strong className="text-lys-title">{utilization.soCount}</strong> ({formatVND(utilization.soTotal)})</span>
                                                        </div>
                                                    </div>

                                                    {/* Utilization Stats */}
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {[
                                                            { l: 'Giá Trị HĐ', v: formatVND(utilization.contractValue) },
                                                            { l: 'Đã Sử Dụng', v: formatVND(utilization.utilizedValue) },
                                                            { l: 'Còn Lại', v: formatVND(utilization.remaining) },
                                                            { l: '% Sử Dụng', v: `${utilization.utilizationPct.toFixed(1)}%` },
                                                        ].map(x => (
                                                            <div key={x.l} className="bg-lys-bg/50 p-2.5 rounded-md border border-lys-border">
                                                                <p className="text-[10px] uppercase font-semibold text-lys-muted">{x.l}</p>
                                                                <p className="text-sm font-bold text-lys-title mt-0.5">{x.v}</p>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div>
                                                        <div className="h-2 w-full bg-lys-border rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all"
                                                                style={{
                                                                    width: `${Math.min(utilization.utilizationPct, 100)}%`,
                                                                    background: utilization.utilizationPct > 90 ? '#B91C1C' : utilization.utilizationPct > 60 ? '#D97706' : '#0891B2',
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Custom Fields Section */}
                                                    <div className="pt-2">
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted mb-2.5">
                                                            Thông Tin Điều Khoản & Lưu Trữ
                                                        </p>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                            <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                <p className="text-[10px] uppercase font-bold text-lys-muted">Quy Định Giảm Giá (Discount)</p>
                                                                <p className="mt-1 font-medium text-lys-title">{utilization.discountTerms || 'Chưa quy định chi tiết'}</p>
                                                            </div>
                                                            <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                <p className="text-[10px] uppercase font-bold text-lys-muted">Ngân Sách Marketing</p>
                                                                <p className="mt-1 font-medium text-lys-title">{utilization.marketingBudget || 'Chưa quy định chi tiết'}</p>
                                                            </div>
                                                            <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                <p className="text-[10px] uppercase font-bold text-lys-muted">Điều Khoản Giá Cả (Price Term)</p>
                                                                <p className="mt-1 font-medium text-lys-title">{utilization.priceTerm || 'Chưa quy định chi tiết'}</p>
                                                            </div>
                                                            <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border">
                                                                <p className="text-[10px] uppercase font-bold text-lys-muted">Kiểm Tra Khớp Dấu & Tên Hợp Đồng</p>
                                                                <p className="mt-1 font-medium text-lys-title">{utilization.stampVerification || 'Chưa có ghi chú kiểm tra'}</p>
                                                            </div>
                                                            <div className="p-3 rounded-md bg-lys-bg/40 border border-lys-border md:col-span-2">
                                                                <p className="text-[10px] uppercase font-bold text-lys-muted">Tình Trạng Lưu Trữ Bản Cứng / Bản Mềm</p>
                                                                <p className="mt-1 font-medium text-lys-title">{utilization.archiveStatus || 'Chưa có ghi chú lưu trữ'}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Documents Section */}
                                                    <div className="pt-2 border-t border-lys-border">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted">
                                                                Tài liệu đính kèm ({utilization.documents?.length || 0})
                                                            </p>
                                                            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer bg-lys-primary/10 text-lys-primary border border-lys-primary/30 hover:bg-lys-primary/15 transition-colors whitespace-nowrap shrink-0">
                                                                {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                                                                <span>{uploadingDoc ? 'Đang tải...' : 'Upload File'}</span>
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    accept=".pdf,.doc,.docx,.jpg,.png"
                                                                    onChange={(e) => handleUpload(row.id, e)}
                                                                    disabled={uploadingDoc}
                                                                />
                                                            </label>
                                                        </div>

                                                        {utilization.documents?.length > 0 ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                {utilization.documents.map((doc: any) => (
                                                                    <a
                                                                        key={doc.id}
                                                                        href={doc.fileUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="flex items-center gap-2.5 p-2.5 rounded-md bg-lys-bg/40 hover:bg-lys-primary/5 border border-lys-border transition-colors"
                                                                    >
                                                                        <FileText size={18} className="text-lys-primary shrink-0" />
                                                                        <div className="overflow-hidden min-w-0">
                                                                            <p className="text-xs font-semibold truncate text-lys-title">{doc.name}</p>
                                                                            <p className="text-[10px] text-lys-muted">{formatDate(doc.uploadedAt)}</p>
                                                                        </div>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs italic text-lys-muted">Chưa có file đính kèm nào.</p>
                                                        )}
                                                    </div>

                                                    {/* Signature Section */}
                                                    <div className="pt-2 border-t border-lys-border">
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-lys-muted mb-2">
                                                            Ký Điện Tử Phê Duyệt Nhanh
                                                        </p>
                                                        {utilization.signatureUrl ? (
                                                            <div className="p-3 rounded-md bg-emerald-50/50 border border-emerald-200 inline-block">
                                                                <p className="text-xs text-emerald-700 font-semibold mb-1.5 flex items-center gap-1">
                                                                    <CheckCircle2 size={13} /> Đã Ký Duyệt
                                                                </p>
                                                                <img src={utilization.signatureUrl} alt="Signature" className="h-16 object-contain bg-white rounded border border-emerald-100 p-1" />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {row.status === 'DRAFT' ? (
                                                                    <>
                                                                        <SignaturePad onEnd={setCurrentSignatureUrl} />
                                                                        <div className="flex justify-end">
                                                                            <Button
                                                                                variant="primary"
                                                                                size="sm"
                                                                                onClick={() => handleSign(row.id)}
                                                                                disabled={!currentSignatureUrl || savingSignature}
                                                                                loading={savingSignature}
                                                                            >
                                                                                <Save size={13} />
                                                                                Lưu Chữ Ký & Hiệu Lực Hoá Hợp Đồng
                                                                            </Button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <p className="text-xs italic text-lys-muted">Chỉ hợp đồng ở trạng thái nháp mới cần ký duyệt.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-lys-muted">Không tìm thấy dữ liệu chi tiết.</p>
                                            )}
                                        </Td>
                                    </Tr>
                                )}
                            </React.Fragment>
                        )
                    })}
                </TBody>
            </Table>

            <CreateContractDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={() => { setDrawerOpen(false); reload() }}
            />
        </div>
    )
}
