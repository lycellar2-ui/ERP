'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, Tag, Search, Trash2, DollarSign, Package, Settings, Pencil, Check, X } from 'lucide-react'
import { PriceListRow, getPriceLists, getPriceListDetail, createPriceList, upsertPriceListLine, removePriceListLine, getProductsForPriceList, deletePriceList } from './actions'
import { formatVND, cn } from '@/lib/utils'
import type { Tone } from '@/lib/ui/status'
import {
    Badge, Button, PageHeader, StatusTabs, Drawer, Modal, EmptyState, Skeleton,
    Field, Input, Select, Table, THead, TBody, Tr, Th, Td, TableMessageRow, useConfirmDialog,
} from '@/components/ui'
import { toast } from 'sonner'
import { CustomerRulesTab } from './CustomerRulesTab'
import { ChannelMappingTab } from './ChannelMappingTab'

const CHANNEL_CFG: Record<string, { label: string; tone: Tone }> = {
    HORECA: { label: 'HORECA', tone: 'warning' },
    WHOLESALE_DISTRIBUTOR: { label: 'Đại Lý', tone: 'brand' },
    VIP_RETAIL: { label: 'VIP Retail', tone: 'info' },
    DIRECT_INDIVIDUAL: { label: 'Trực Tiếp', tone: 'neutral' },
}

function ChannelBadge({ channel }: { channel: string }) {
    const cfg = CHANNEL_CFG[channel] ?? { label: channel, tone: 'neutral' as Tone }
    return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

const TAB_DESCRIPTION = {
    general: 'Quản lý bảng giá niêm yết theo kênh bán hàng (HORECA, Đại Lý, VIP, Trực Tiếp)',
    customer: 'Quản lý chiết khấu mặc định toàn kho và danh mục giá thỏa thuận riêng của từng khách hàng',
} as const

interface Props {
    initialLists: PriceListRow[]
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
}

export function PriceListClient({ initialLists, currentUser }: Props) {
    const [activeTab, setActiveTab] = useState<'general' | 'customer'>('general')
    const [lists, setLists] = useState(initialLists)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getPriceListDetail>>>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [addProductOpen, setAddProductOpen] = useState(false)
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])

    // Filter & inline edit inside Price List detail
    const [lineSearch, setLineSearch] = useState('')
    const [editingLineId, setEditingLineId] = useState<string | null>(null)
    const [editingPrice, setEditingPrice] = useState<string>('')
    const [inlineSaving, setInlineSaving] = useState(false)

    // Create Price List form state
    const [formName, setFormName] = useState('')
    const [formChannel, setFormChannel] = useState('HORECA')
    const [formEffective, setFormEffective] = useState(new Date().toISOString().slice(0, 10))
    const [formExpiry, setFormExpiry] = useState('')
    const [saving, setSaving] = useState(false)

    // Add product form
    const [addProductId, setAddProductId] = useState('')
    const [addPrice, setAddPrice] = useState('')
    const [addSearch, setAddSearch] = useState('')

    const reload = useCallback(async () => {
        const data = await getPriceLists()
        setLists(data)
    }, [])

    const loadDetail = useCallback(async (id: string) => {
        setDetailLoading(true)
        setSelectedId(id)
        setEditingLineId(null)
        const data = await getPriceListDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }, [])

    // Auto-select first price list on initial load so right panel is immediately useful
    useEffect(() => {
        if (initialLists.length > 0 && !selectedId) {
            loadDetail(initialLists[0].id)
        }
    }, [initialLists, selectedId, loadDetail])

    const handleCreate = async () => {
        if (!formName.trim()) return
        setSaving(true)
        const res = await createPriceList({
            name: formName,
            channel: formChannel,
            effectiveDate: formEffective,
            expiryDate: formExpiry || undefined,
        })
        if (res.success) {
            setCreateOpen(false)
            setFormName('')
            setFormExpiry('')
            toast.success('Đã tạo bảng giá mới')
            await reload()
            if (res.id) loadDetail(res.id)
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    const handleAddProduct = async () => {
        if (!addProductId || !addPrice || !selectedId) return
        setSaving(true)
        const res = await upsertPriceListLine({
            priceListId: selectedId,
            productId: addProductId,
            unitPrice: Number(addPrice),
        })
        if (res.success) {
            toast.success('Đã cập nhật giá sản phẩm')
            setAddProductId('')
            setAddPrice('')
            setAddSearch('')
            setAddProductOpen(false)
            await loadDetail(selectedId)
            await reload()
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    const handleSaveInlinePrice = async (productId: string) => {
        if (!selectedId || !editingPrice || Number(editingPrice) <= 0) return
        setInlineSaving(true)
        const res = await upsertPriceListLine({
            priceListId: selectedId,
            productId,
            unitPrice: Number(editingPrice),
        })
        if (res.success) {
            toast.success('Đã lưu giá bán mới')
            setEditingLineId(null)
            await loadDetail(selectedId)
        } else {
            toast.error('Lỗi cập nhật giá: ' + res.error)
        }
        setInlineSaving(false)
    }

    const handleRemoveLine = (lineId: string) => {
        if (!selectedId) return
        confirm({
            title: 'Xóa Dòng Giá',
            message: 'Bạn có chắc chắn muốn xóa dòng giá sản phẩm này khỏi bảng giá không?',
            confirmLabel: 'Xóa Dòng',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                await removePriceListLine(lineId)
                await loadDetail(selectedId)
                await reload()
            }
        })
    }

    const handleDelete = (id: string) => {
        confirm({
            title: 'Xóa Bảng Giá',
            message: 'Bạn có chắc chắn muốn xóa bảng giá này và tất cả các dòng giá bên trong? Thao tác không thể hoàn tác.',
            confirmLabel: 'Xóa Bảng Giá',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                await deletePriceList(id)
                const remaining = lists.filter(l => l.id !== id)
                if (selectedId === id) {
                    setSelectedId(null)
                    setDetail(null)
                    if (remaining.length > 0) loadDetail(remaining[0].id)
                }
                await reload()
            }
        })
    }

    const openAddProduct = async () => {
        if (products.length === 0) {
            const data = await getProductsForPriceList()
            setProducts(data)
        }
        setAddProductOpen(true)
    }

    const filteredProducts = addSearch
        ? products.filter(p => p.productName.toLowerCase().includes(addSearch.toLowerCase()) || p.skuCode.toLowerCase().includes(addSearch.toLowerCase()))
        : products

    const filteredDetailLines = useMemo(() => {
        if (!detail?.lines) return []
        const q = lineSearch.trim().toLowerCase()
        if (!q) return detail.lines
        return detail.lines.filter(l =>
            l.skuCode.toLowerCase().includes(q) ||
            l.productName.toLowerCase().includes(q)
        )
    }, [detail?.lines, lineSearch])

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={TAB_DESCRIPTION[activeTab]}
                actions={activeTab === 'general' && (
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setMappingOpen(true)}>
                            <Settings size={15} aria-hidden /> Cấu Hình Kênh Giá
                        </Button>
                        <Button onClick={() => setCreateOpen(true)}>
                            <Plus size={16} aria-hidden /> Tạo Bảng Giá
                        </Button>
                    </div>
                )}
            />

            <StatusTabs
                value={activeTab}
                onChange={setActiveTab}
                items={[
                    { value: 'general', label: 'Bảng Giá Niêm Yết (Theo Kênh)', count: lists.length },
                    { value: 'customer', label: 'Giá & Chiết Khấu Theo Khách Hàng' },
                ]}
            />

            {activeTab === 'customer' ? (
                <CustomerRulesTab currentUser={currentUser} />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Left: price lists (4 cols) */}
                    <section className="lg:col-span-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-lys-secondary">
                                Danh sách bảng giá ({lists.length})
                            </h3>
                        </div>
                        {lists.length === 0 ? (
                            <EmptyState icon={Tag} title="Chưa có bảng giá nào" className="bg-white border border-lys-border rounded-md" />
                        ) : lists.map(pl => {
                            const isSelected = selectedId === pl.id
                            return (
                                <div
                                    key={pl.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => loadDetail(pl.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') loadDetail(pl.id) }}
                                    className={cn(
                                        'p-3.5 rounded-lg border cursor-pointer transition-all',
                                        isSelected
                                            ? 'bg-lys-teal-soft border-lys-teal shadow-xs'
                                            : 'bg-white border-lys-border hover:bg-lys-subtle',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <p className={cn('text-sm font-semibold', isSelected ? 'text-lys-teal-strong' : 'text-lys-primary')}>
                                            {pl.name}
                                        </p>
                                        <ChannelBadge channel={pl.channel} />
                                    </div>
                                    <div className="flex items-center justify-between type-caption">
                                        <span>
                                            <strong className="text-lys-primary">{pl.itemCount}</strong> SKU · Từ {new Date(pl.effectiveDate).toLocaleDateString('vi-VN')}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
                                            onClick={e => { e.stopPropagation(); handleDelete(pl.id) }}
                                            aria-label="Xóa bảng giá"
                                            title="Xóa bảng giá"
                                        >
                                            <Trash2 size={13} aria-hidden />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </section>

                    {/* Right: detail (8 cols) */}
                    <section className="lg:col-span-8">
                        {detailLoading ? (
                            <div className="flex flex-col gap-3">
                                <Skeleton className="h-16" />
                                <Skeleton className="h-72" />
                            </div>
                        ) : !selectedId ? (
                            <EmptyState icon={DollarSign} title="Chọn bảng giá bên trái để xem chi tiết" className="bg-white border border-lys-border rounded-lg py-20" />
                        ) : detail ? (
                            <div className="flex flex-col gap-3 bg-white border border-lys-border rounded-lg overflow-hidden shadow-xs">
                                {/* Detail Header & Toolbar */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-lys-border bg-slate-50/60">
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="text-base font-bold text-lys-primary">{detail.name}</h3>
                                            <ChannelBadge channel={detail.channel} />
                                        </div>
                                        <p className="type-caption mt-1">
                                            Hiệu lực: {new Date(detail.effectiveDate).toLocaleDateString('vi-VN')}
                                            {detail.expiryDate ? ` → ${new Date(detail.expiryDate).toLocaleDateString('vi-VN')}` : ' (Không thời hạn)'}
                                            {' · '}Tổng cộng <strong>{detail.lines.length}</strong> sản phẩm
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="relative w-full sm:w-56">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" aria-hidden />
                                            <Input
                                                value={lineSearch}
                                                onChange={e => setLineSearch(e.target.value)}
                                                placeholder="Tìm SKU hoặc tên rượu..."
                                                className="pl-8 h-8 text-xs"
                                                aria-label="Tìm sản phẩm trong bảng giá"
                                            />
                                        </div>
                                        <Button size="sm" onClick={openAddProduct} className="shrink-0">
                                            <Plus size={14} aria-hidden /> Thêm SKU
                                        </Button>
                                    </div>
                                </div>

                                {/* SKU Table */}
                                <div className="overflow-x-auto">
                                    <Table>
                                        <THead>
                                            <tr>
                                                <Th className="w-36">Mã SKU</Th>
                                                <Th>Tên Sản Phẩm</Th>
                                                <Th align="right" className="w-48">Giá Niêm Yết (VND)</Th>
                                                <Th align="right" className="w-24">Thao Tác</Th>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {filteredDetailLines.length === 0 ? (
                                                <TableMessageRow colSpan={4}>
                                                    <EmptyState
                                                        icon={Package}
                                                        title={lineSearch ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có sản phẩm trong bảng giá'}
                                                        description={lineSearch ? 'Thử từ khóa SKU hoặc tên rượu khác.' : 'Bấm "Thêm SKU" ở góc phải để thêm sản phẩm vào bảng giá.'}
                                                    />
                                                </TableMessageRow>
                                            ) : filteredDetailLines.map(line => {
                                                const isEditing = editingLineId === line.id
                                                return (
                                                    <Tr key={line.id} className="group">
                                                        <Td className="type-number font-semibold text-lys-teal-strong">{line.skuCode}</Td>
                                                        <Td className="text-lys-primary font-medium">{line.productName}</Td>
                                                        <Td align="right">
                                                            {isEditing ? (
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <input
                                                                        type="number"
                                                                        value={editingPrice}
                                                                        onChange={e => setEditingPrice(e.target.value)}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter') handleSaveInlinePrice(line.productId)
                                                                            if (e.key === 'Escape') setEditingLineId(null)
                                                                        }}
                                                                        autoFocus
                                                                        className="w-28 px-2 py-1 text-right text-xs font-mono font-bold border border-[#0891B2] rounded bg-white text-slate-900 outline-none"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        disabled={inlineSaving}
                                                                        onClick={() => handleSaveInlinePrice(line.productId)}
                                                                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                                        title="Lưu giá"
                                                                    >
                                                                        <Check size={13} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingLineId(null)}
                                                                        className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                                        title="Hủy"
                                                                    >
                                                                        <X size={13} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingLineId(line.id)
                                                                        setEditingPrice(String(line.unitPrice))
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 type-number font-bold text-lys-primary hover:text-[#0891B2] transition-colors"
                                                                    title="Bấm để sửa nhanh giá bán"
                                                                >
                                                                    <span>{formatVND(line.unitPrice)}</span>
                                                                    <Pencil size={12} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-[#0891B2] transition-opacity" />
                                                                </button>
                                                            )}
                                                        </Td>
                                                        <Td align="right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                {!isEditing && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 text-slate-500 hover:text-[#0891B2]"
                                                                        onClick={() => {
                                                                            setEditingLineId(line.id)
                                                                            setEditingPrice(String(line.unitPrice))
                                                                        }}
                                                                        aria-label="Sửa giá"
                                                                        title="Sửa giá"
                                                                    >
                                                                        <Pencil size={13} aria-hidden />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
                                                                    onClick={() => handleRemoveLine(line.id)}
                                                                    aria-label="Xóa dòng giá"
                                                                    title="Xóa khỏi bảng giá"
                                                                >
                                                                    <Trash2 size={13} aria-hidden />
                                                                </Button>
                                                            </div>
                                                        </Td>
                                                    </Tr>
                                                )
                                            })}
                                        </TBody>
                                    </Table>
                                </div>
                            </div>
                        ) : null}
                    </section>
                </div>
            )}

            {/* Modal: Cấu Hình Ánh Xạ Kênh Giá Mặc Định */}
            <Modal
                open={mappingOpen}
                onClose={() => setMappingOpen(false)}
                title="Cấu Hình Ánh Xạ Kênh Giá Mặc Định"
            >
                <ChannelMappingTab currentUser={currentUser} onSaved={() => setMappingOpen(false)} />
            </Modal>

            <Drawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Tạo Bảng Giá Mới"
                size="sm"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)}>Hủy</Button>
                        <Button onClick={handleCreate} loading={saving} disabled={saving || !formName.trim()}>Tạo Bảng Giá</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    <Field label="Tên Bảng Giá" required>
                        {id => <Input id={id} value={formName} onChange={e => setFormName(e.target.value)} placeholder="VD: Bảng giá HORECA Q1/2026" />}
                    </Field>
                    <Field label="Kênh Bán Hàng">
                        {id => (
                            <Select id={id} value={formChannel} onChange={e => setFormChannel(e.target.value)}>
                                {Object.entries(CHANNEL_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </Select>
                        )}
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Ngày Hiệu Lực">
                            {id => <Input id={id} type="date" value={formEffective} onChange={e => setFormEffective(e.target.value)} />}
                        </Field>
                        <Field label="Ngày Hết Hạn">
                            {id => <Input id={id} type="date" value={formExpiry} onChange={e => setFormExpiry(e.target.value)} />}
                        </Field>
                    </div>
                </div>
            </Drawer>

            <Modal
                open={addProductOpen}
                onClose={() => setAddProductOpen(false)}
                title="Thêm Sản Phẩm vào Bảng Giá"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setAddProductOpen(false)}>Hủy</Button>
                        <Button onClick={handleAddProduct} loading={saving} disabled={saving || !addProductId || !addPrice}>Lưu Giá</Button>
                    </>
                }
            >
                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" aria-hidden />
                        <Input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Tìm SKU hoặc tên sản phẩm..." className="pl-9" aria-label="Tìm sản phẩm" />
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-md p-1 bg-white border border-lys-border">
                        {filteredProducts.slice(0, 20).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setAddProductId(p.id)}
                                className={cn(
                                    'w-full flex items-center gap-2 px-3 py-2 rounded text-left text-xs transition-colors',
                                    addProductId === p.id ? 'bg-lys-teal-soft text-lys-teal-strong' : 'text-lys-secondary hover:bg-lys-subtle',
                                )}
                            >
                                <span className="type-number font-semibold">{p.skuCode}</span>
                                <span className="truncate text-lys-primary">{p.productName}</span>
                            </button>
                        ))}
                        {filteredProducts.length === 0 && (
                            <p className="text-center py-4 type-caption">Không tìm thấy sản phẩm</p>
                        )}
                    </div>
                    <Field label="Giá Bán (VND)" required>
                        {id => <Input id={id} type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="VD: 1500000" className="type-number" />}
                    </Field>
                </div>
            </Modal>
            {confirmDialog}
        </div>
    )
}

