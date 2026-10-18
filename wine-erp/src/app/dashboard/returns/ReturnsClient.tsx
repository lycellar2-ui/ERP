'use client'

import { useState } from 'react'
import { RotateCcw, Plus, Save, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
    type ReturnOrderRow,
    getReturnOrders, createReturnOrder, approveReturnOrder,
    getSOOptionsForReturn, getSOLinesForReturn
} from './actions'
import {
    Button, PageHeader, StatCard, StatGrid, StatusBadge, Drawer, EmptyState,
    Field, Input, Select, Textarea,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    useConfirmDialog,
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { RETURNS_I18N } from './i18n'

const STATUS_TONES = { PENDING_INSPECTION: 'warning' } as const

export function ReturnsClient({ initialRows, stats }: {
    initialRows: ReturnOrderRow[]
    stats: { total: number; pending: number; approved: number; totalCredited: number }
}) {
    const { locale, formatCurrency, formatDate } = useAppLocale()
    const L = RETURNS_I18N[locale]

    const [rows, setRows] = useState(initialRows)
    const [createOpen, setCreateOpen] = useState(false)
    const [soOptions, setSoOptions] = useState<any[]>([])
    const [selectedSo, setSelectedSo] = useState('')
    const [soLines, setSoLines] = useState<any[]>([])
    const [reason, setReason] = useState('')
    const [returnLines, setReturnLines] = useState<{ productId: string; qtyReturned: number; unitPrice: number; reason: string; condition: string }[]>([])
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

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
            toast.error(L.toast.missingFields)
            return
        }
        toast.promise(
            createReturnOrder({ soId: selectedSo, reason, lines: validLines }).then((res: any) => {
                if (!res.success) throw new Error(res.error || L.toast.createError)
                setCreateOpen(false); setSelectedSo(''); setReason(''); setReturnLines([]); setSoLines([])
                reload()
                return res
            }),
            {
                loading: L.toast.creating,
                success: L.toast.createSuccess,
                error: (err: any) => `${err.message}`,
            }
        )
    }

    const handleApprove = (id: string) => {
        confirm({
            title: L.confirmApprove.title,
            message: L.confirmApprove.message,
            confirmLabel: L.confirmApprove.confirmLabel,
            cancelLabel: L.confirmApprove.cancelLabel,
            onConfirm: async () => {
                const res = await approveReturnOrder(id)
                if (!res.success) {
                    toast.error(res.error || L.toast.approveError)
                    return
                }
                toast.success(L.toast.approveSuccess)
                reload()
            },
        })
    }

    const updateLine = (i: number, patch: Partial<(typeof returnLines)[number]>) => {
        const v = [...returnLines]; v[i] = { ...v[i], ...patch }; setReturnLines(v)
    }
    const returnTotal = returnLines.filter(l => l.qtyReturned > 0).reduce((s, l) => s + l.qtyReturned * l.unitPrice, 0)

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description}
                actions={
                    <Button onClick={openCreate}>
                        <Plus size={16} aria-hidden /> {L.header.createBtn}
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard icon={RotateCcw} tone="brand" label={L.stats.total} value={stats.total} />
                <StatCard icon={Clock} tone="warning" label={L.stats.pending} value={stats.pending} />
                <StatCard icon={CheckCircle2} tone="success" label={L.stats.approved} value={stats.approved} />
                <StatCard icon={AlertCircle} tone="info" label={L.stats.totalCredited} value={formatCurrency(stats.totalCredited)} />
            </StatGrid>

            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th>{L.table.returnNo}</Th>
                            <Th>{L.table.soNo}</Th>
                            <Th>{L.table.customer}</Th>
                            <Th>{L.table.reason}</Th>
                            <Th>{L.table.status}</Th>
                            <Th align="right">{L.table.amount}</Th>
                            <Th>{L.table.creditNote}</Th>
                            <Th>{L.table.date}</Th>
                            <Th aria-label={L.table.actions} />
                        </tr>
                    </THead>
                    <TBody>
                        {rows.length === 0 ? (
                            <TableMessageRow colSpan={9}><EmptyState icon={RotateCcw} title={L.table.emptyTitle} /></TableMessageRow>
                        ) : rows.map((r: any) => (
                            <Tr key={r.id}>
                                <Td className="type-number font-semibold text-lys-teal-strong">{r.returnNo}</Td>
                                <Td className="type-number text-lys-secondary">{r.soNo}</Td>
                                <Td className="font-semibold text-lys-primary">{r.customerName}</Td>
                                <Td className="text-lys-secondary">{r.reason}</Td>
                                <Td>
                                    <StatusBadge
                                        status={r.status}
                                        label={(L.status as Record<string, string>)[r.status] ?? r.status}
                                        toneOverrides={STATUS_TONES}
                                    />
                                </Td>
                                <Td align="right" className="type-number font-semibold text-lys-primary">{formatCurrency(r.totalAmount)}</Td>
                                <Td className={r.creditNoteNo ? 'type-number text-tone-success-fg' : 'text-lys-muted'}>
                                    {r.creditNoteNo ?? '—'}
                                </Td>
                                <Td className="text-lys-secondary">{formatDate(r.createdAt)}</Td>
                                <Td align="right">
                                    {(r.status === 'DRAFT' || r.status === 'PENDING_INSPECTION') && (
                                        <Button size="sm" variant="secondary" onClick={() => handleApprove(r.id)}>
                                            <CheckCircle2 size={13} aria-hidden /> {L.table.approveBtn}
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
                {rows.length === 0 ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6 text-center">
                        <EmptyState icon={RotateCcw} title={L.table.emptyTitle} />
                    </div>
                ) : (
                    rows.map((r: any) => (
                        <div key={r.id} className="rounded-lg border border-lys-border bg-white p-4 shadow-xs space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="type-number font-semibold text-lys-teal-strong">{r.returnNo}</span>
                                        <StatusBadge
                                            status={r.status}
                                            label={(L.status as Record<string, string>)[r.status] ?? r.status}
                                            toneOverrides={STATUS_TONES}
                                        />
                                    </div>
                                    <div className="text-xs text-lys-muted mt-1">
                                        SO: <span className="type-number text-lys-secondary font-medium">{r.soNo}</span> • {formatDate(r.createdAt)}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="type-number text-sm font-bold text-lys-primary block">
                                        {formatCurrency(r.totalAmount)}
                                    </span>
                                    {r.creditNoteNo && (
                                        <span className="text-[11px] type-number text-tone-success-fg">
                                            CN: {r.creditNoteNo}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-xs text-lys-primary font-medium border-t border-lys-border/50 pt-2">
                                <span className="text-lys-muted">{L.table.customerLabel}</span>
                                {r.customerName}
                            </div>

                            {r.reason && (
                                <div className="text-xs text-lys-secondary bg-lys-subtle rounded-md p-2 border border-lys-border/40">
                                    <span className="text-lys-muted">{L.table.reasonLabel}</span>{r.reason}
                                </div>
                            )}

                            {(r.status === 'DRAFT' || r.status === 'PENDING_INSPECTION') && (
                                <div className="pt-1 flex justify-end">
                                    <Button size="sm" variant="secondary" className="w-full" onClick={() => handleApprove(r.id)}>
                                        <CheckCircle2 size={13} aria-hidden /> {L.table.approveMobileBtn}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title={L.drawer.title}
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>{L.drawer.cancelBtn}</Button>
                        <Button onClick={handleCreate}>
                            <Save size={14} aria-hidden /> {L.drawer.saveBtn}
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label={L.drawer.soLabel} required>
                        {id => (
                            <Select id={id} value={selectedSo} onChange={e => handleSelectSO(e.target.value)}>
                                <option value="">{L.drawer.soPlaceholder}</option>
                                {soOptions.map((s: any) => <option key={s.id} value={s.id}>{s.soNo} — {s.customer.name}</option>)}
                            </Select>
                        )}
                    </Field>
                    <Field label={L.drawer.reasonLabel} required>
                        {id => (
                            <Textarea id={id} value={reason} onChange={e => setReason(e.target.value)} rows={2}
                                className="resize-none" placeholder={L.drawer.reasonPlaceholder} />
                        )}
                    </Field>

                    {soLines.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h3 className="type-section-title text-lys-secondary">{L.drawer.linesTitle}</h3>
                            {soLines.map((l: any, i: number) => (
                                <div key={l.productId} className="p-3 rounded-md border border-lys-border bg-white">
                                    <div className="flex items-center justify-between mb-2 text-xs">
                                        <div>
                                            <span className="type-number font-semibold text-lys-teal-strong">{l.product.skuCode}</span>
                                            <span className="ml-2 text-lys-secondary">{l.product.productName}</span>
                                        </div>
                                        <span className="text-lys-muted">{L.drawer.purchasedPrefix} {Number(l.qtyOrdered)}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <Field label={L.drawer.qtyReturnedLabel}>
                                            {id => (
                                                <Input id={id} type="number" min={0} max={Number(l.qtyOrdered)}
                                                    value={returnLines[i]?.qtyReturned ?? 0}
                                                    onChange={e => updateLine(i, { qtyReturned: Number(e.target.value) })} />
                                            )}
                                        </Field>
                                        <Field label={L.drawer.conditionLabel}>
                                            {id => (
                                                <Select id={id} value={returnLines[i]?.condition ?? 'GOOD'}
                                                    onChange={e => updateLine(i, { condition: e.target.value })}>
                                                    <option value="GOOD">{L.drawer.condGood}</option>
                                                    <option value="DAMAGED">{L.drawer.condDamaged}</option>
                                                    <option value="EXPIRED">{L.drawer.condExpired}</option>
                                                </Select>
                                            )}
                                        </Field>
                                        <Field label={L.drawer.noteLabel}>
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
                                    <span className="text-xs">{L.drawer.totalReturnLabel}</span>
                                    <span className="type-number text-sm font-semibold">{formatCurrency(returnTotal)}</span>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </Drawer>
            {confirmDialog}
        </div>
    )
}
