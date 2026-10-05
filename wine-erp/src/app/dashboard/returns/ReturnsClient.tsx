'use client'

import { useState } from 'react'
import { RotateCcw, Plus, Save, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
    type ReturnOrderRow,
    getReturnOrders, createReturnOrder, approveReturnOrder,
    getSOOptionsForReturn, getSOLinesForReturn
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import {
    Button, PageHeader, StatCard, StatGrid, StatusBadge, Drawer, EmptyState,
    Field, Input, Select, Textarea,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
} from '@/components/ui'

const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Nháp',
    PENDING_INSPECTION: 'Chờ Kiểm Tra',
    APPROVED: 'Đã Duyệt',
    REJECTED: 'Từ Chối',
    COMPLETED: 'Hoàn Thành',
}
const STATUS_TONES = { PENDING_INSPECTION: 'warning' } as const

export function ReturnsClient({ initialRows, stats }: {
    initialRows: ReturnOrderRow[]
    stats: { total: number; pending: number; approved: number; totalCredited: number }
}) {
    const [rows, setRows] = useState(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [soOptions, setSoOptions] = useState<any[]>([])
    const [selectedSo, setSelectedSo] = useState('')
    const [soLines, setSoLines] = useState<any[]>([])
    const [reason, setReason] = useState('')
    const [returnLines, setReturnLines] = useState<{ productId: string; qtyReturned: number; unitPrice: number; reason: string; condition: string }[]>([])

    const reload = async () => {
        const data = await getReturnOrders()
        setRows(data)
    }

    const openCreate = async () => {
        const opts = await getSOOptionsForReturn()
        setSoOptions(opts)
        setCreateOpen(true)
    }

    const handleSelectSO = async (soId: string) => {
        setSelectedSo(soId)
        if (!soId) { setSoLines([]); setReturnLines([]); return }
        const lines = await getSOLinesForReturn(soId)
        setSoLines(lines)
        setReturnLines(lines.map((l: any) => ({
            productId: l.productId, qtyReturned: 0,
            unitPrice: Number(l.unitPrice), reason: '', condition: 'GOOD',
        })))
    }

    const handleCreate = async () => {
        const validLines = returnLines.filter(l => l.qtyReturned > 0)
        if (!selectedSo || !reason || validLines.length === 0) {
            toast.error('Điền đủ thông tin')
            return
        }
        toast.promise(
            createReturnOrder({ soId: selectedSo, reason, lines: validLines }).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi tạo đơn trả hàng')
                setCreateOpen(false); setSelectedSo(''); setReason(''); setReturnLines([]); setSoLines([])
                reload()
                return res
            }),
            {
                loading: 'Đang tạo đơn trả hàng...',
                success: 'Đã tạo đơn trả hàng!',
                error: (err: any) => `Lỗi: ${err.message}`
            }
        )
    }

    const handleApprove = async (id: string) => {
        if (!confirm('Duyệt đơn trả hàng này? Hệ thống sẽ tự tạo Credit Note.')) return
        toast.promise(
            approveReturnOrder(id).then((res: any) => {
                if (!res.success) throw new Error(res.error || 'Lỗi duyệt đơn đổi trả')
                reload()
                return res
            }),
            {
                loading: 'Đang duyệt đơn trả hàng...',
                success: 'Đã duyệt đơn trả hàng!',
                error: (err: any) => `Lỗi: ${err.message}`
            }
        )
    }

    const updateLine = (i: number, patch: Partial<(typeof returnLines)[number]>) => {
        const v = [...returnLines]; v[i] = { ...v[i], ...patch }; setReturnLines(v)
    }
    const returnTotal = returnLines.filter(l => l.qtyReturned > 0).reduce((s, l) => s + l.qtyReturned * l.unitPrice, 0)

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description="Quản lý đơn trả hàng, kiểm tra chất lượng, sinh Credit Note"
                actions={
                    <Button onClick={openCreate}>
                        <Plus size={16} aria-hidden /> Tạo Đơn Trả
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard icon={RotateCcw} tone="brand" label="Tổng Đơn Trả" value={stats.total} />
                <StatCard icon={Clock} tone="warning" label="Chờ Xử Lý" value={stats.pending} />
                <StatCard icon={CheckCircle2} tone="success" label="Đã Duyệt" value={stats.approved} />
                <StatCard icon={AlertCircle} tone="info" label="Tổng Credit" value={`${(stats.totalCredited / 1e6).toFixed(0)}M ₫`} />
            </StatGrid>

            <Table>
                <THead>
                    <tr>
                        <Th>Mã</Th>
                        <Th>SO Gốc</Th>
                        <Th>Khách Hàng</Th>
                        <Th>Lý Do</Th>
                        <Th>Trạng Thái</Th>
                        <Th align="right">Giá Trị</Th>
                        <Th>Credit Note</Th>
                        <Th>Ngày</Th>
                        <Th aria-label="Thao tác" />
                    </tr>
                </THead>
                <TBody>
                    {rows.length === 0 ? (
                        <TableMessageRow colSpan={9}><EmptyState icon={RotateCcw} title="Chưa có đơn trả hàng" /></TableMessageRow>
                    ) : rows.map((r: any) => (
                        <Tr key={r.id}>
                            <Td className="type-number font-semibold text-lys-teal-strong">{r.returnNo}</Td>
                            <Td className="type-number text-lys-secondary">{r.soNo}</Td>
                            <Td className="font-semibold text-lys-primary">{r.customerName}</Td>
                            <Td className="text-lys-secondary">{r.reason}</Td>
                            <Td>
                                <StatusBadge status={r.status} label={STATUS_LABEL[r.status] ?? r.status} toneOverrides={STATUS_TONES} />
                            </Td>
                            <Td align="right" className="type-number font-semibold text-lys-primary">{formatVND(r.totalAmount)}</Td>
                            <Td className={r.creditNoteNo ? 'type-number text-tone-success-fg' : 'text-lys-muted'}>
                                {r.creditNoteNo ?? '—'}
                            </Td>
                            <Td className="text-lys-secondary">{formatDate(r.createdAt)}</Td>
                            <Td align="right">
                                {(r.status === 'DRAFT' || r.status === 'PENDING_INSPECTION') && (
                                    <Button size="sm" variant="secondary" onClick={() => handleApprove(r.id)}>
                                        <CheckCircle2 size={13} aria-hidden /> Duyệt
                                    </Button>
                                )}
                            </Td>
                        </Tr>
                    ))}
                </TBody>
            </Table>

            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Tạo Đơn Trả Hàng"
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
                        <Button onClick={handleCreate}>
                            <Save size={14} aria-hidden /> Tạo Đơn Trả Hàng
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Đơn Hàng Gốc (SO)" required>
                        {id => (
                            <Select id={id} value={selectedSo} onChange={e => handleSelectSO(e.target.value)}>
                                <option value="">— Chọn SO —</option>
                                {soOptions.map((s: any) => <option key={s.id} value={s.id}>{s.soNo} — {s.customer.name}</option>)}
                            </Select>
                        )}
                    </Field>
                    <Field label="Lý Do Trả Hàng" required>
                        {id => (
                            <Textarea id={id} value={reason} onChange={e => setReason(e.target.value)} rows={2}
                                className="resize-none" placeholder="Mô tả lý do trả hàng..." />
                        )}
                    </Field>

                    {soLines.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h3 className="type-section-title text-lys-secondary">Sản Phẩm Trả Lại (nhập SL {'>'} 0)</h3>
                            {soLines.map((l: any, i: number) => (
                                <div key={l.productId} className="p-3 rounded-md border border-lys-border bg-white">
                                    <div className="flex items-center justify-between mb-2 text-xs">
                                        <div>
                                            <span className="type-number font-semibold text-lys-teal-strong">{l.product.skuCode}</span>
                                            <span className="ml-2 text-lys-secondary">{l.product.productName}</span>
                                        </div>
                                        <span className="text-lys-muted">Đã mua: {Number(l.qtyOrdered)}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Field label="SL Trả">
                                            {id => (
                                                <Input id={id} type="number" min={0} max={Number(l.qtyOrdered)}
                                                    value={returnLines[i]?.qtyReturned ?? 0}
                                                    onChange={e => updateLine(i, { qtyReturned: Number(e.target.value) })} />
                                            )}
                                        </Field>
                                        <Field label="Tình Trạng">
                                            {id => (
                                                <Select id={id} value={returnLines[i]?.condition ?? 'GOOD'}
                                                    onChange={e => updateLine(i, { condition: e.target.value })}>
                                                    <option value="GOOD">Tốt</option>
                                                    <option value="DAMAGED">Hư hỏng</option>
                                                    <option value="EXPIRED">Hết hạn</option>
                                                </Select>
                                            )}
                                        </Field>
                                        <Field label="Ghi chú">
                                            {id => (
                                                <Input id={id} type="text" value={returnLines[i]?.reason ?? ''} placeholder="..."
                                                    onChange={e => updateLine(i, { reason: e.target.value })} />
                                            )}
                                        </Field>
                                    </div>
                                </div>
                            ))}
                            {returnTotal > 0 && (
                                <div className="mt-1 p-3 rounded-md flex items-center justify-between border border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg">
                                    <span className="text-xs">Tổng giá trị trả lại:</span>
                                    <span className="type-number text-sm font-semibold">{formatVND(returnTotal)}</span>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </Drawer>
        </div>
    )
}
