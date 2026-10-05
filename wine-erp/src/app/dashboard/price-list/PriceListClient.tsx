'use client'

import { useState, useCallback } from 'react'
import { Plus, Tag, Search, Trash2, DollarSign, Package } from 'lucide-react'
import { PriceListRow, getPriceLists, getPriceListDetail, createPriceList, upsertPriceListLine, removePriceListLine, getProductsForPriceList, deletePriceList } from './actions'
import { formatVND, cn } from '@/lib/utils'
import type { Tone } from '@/lib/ui/status'
import {
    Badge, Button, PageHeader, StatCard, StatGrid, StatusTabs, Drawer, Modal, EmptyState, Skeleton,
    Field, Input, Select, Table, THead, TBody, Tr, Th, Td, TableMessageRow, useConfirmDialog,
} from '@/components/ui'

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
    general: 'Quản lý bảng giá theo kênh bán hàng — HORECA, Đại Lý, VIP, Trực Tiếp',
    customer: 'Cơ chế giá mặc định (Wholesale -X%, Retail -Y%) và giá đặc biệt riêng của từng khách hàng',
    mapping: 'Phân bổ bảng giá niêm yết mặc định cho từng nhóm khách hàng khi không có giá đặc biệt',
} as const

import { CustomerRulesTab } from './CustomerRulesTab'
import { ChannelMappingTab } from './ChannelMappingTab'

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
    const [activeTab, setActiveTab] = useState<'general' | 'customer' | 'mapping'>('general')
    const [lists, setLists] = useState(initialLists)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<Awaited<ReturnType<typeof getPriceListDetail>>>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [addProductOpen, setAddProductOpen] = useState(false)
    const [products, setProducts] = useState<{ id: string; skuCode: string; productName: string }[]>([])

    // Form state
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
        const data = await getPriceListDetail(id)
        setDetail(data)
        setDetailLoading(false)
    }, [])

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
            await reload()
            if (res.id) loadDetail(res.id)
        }
        setSaving(false)
    }

    const handleAddProduct = async () => {
        if (!addProductId || !addPrice || !selectedId) return
        setSaving(true)
        await upsertPriceListLine({
            priceListId: selectedId,
            productId: addProductId,
            unitPrice: Number(addPrice),
        })
        setAddProductId('')
        setAddPrice('')
        setAddSearch('')
        setAddProductOpen(false)
        await loadDetail(selectedId)
        setSaving(false)
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
                if (selectedId === id) { setSelectedId(null); setDetail(null) }
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

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={TAB_DESCRIPTION[activeTab]}
                actions={activeTab === 'general' && (
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus size={16} aria-hidden /> Tạo Bảng Giá
                    </Button>
                )}
            />

            <StatusTabs
                value={activeTab}
                onChange={setActiveTab}
                items={[
                    { value: 'general', label: 'Bảng Giá Chung', count: lists.length },
                    { value: 'customer', label: 'Cơ Chế & Giá Khách Hàng' },
                    { value: 'mapping', label: 'Cấu Hình Ánh Xạ Kênh' },
                ]}
            />

            {activeTab === 'customer' ? (
                <CustomerRulesTab currentUser={currentUser} />
            ) : activeTab === 'mapping' ? (
                <ChannelMappingTab currentUser={currentUser} />
            ) : (
                <>
                    <StatGrid className="grid-cols-2 lg:grid-cols-4">
                        {Object.entries(CHANNEL_CFG).map(([key, cfg]) => (
                            <StatCard key={key} icon={Tag} tone={cfg.tone} label={cfg.label}
                                value={lists.filter(l => l.channel === key).length} sub="bảng giá" />
                        ))}
                    </StatGrid>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Left: price lists */}
                        <section className="lg:col-span-1 flex flex-col gap-2">
                            <h3 className="type-section-title text-lys-secondary">Danh sách bảng giá</h3>
                            {lists.length === 0 ? (
                                <EmptyState icon={Tag} title="Chưa có bảng giá nào" className="bg-white border border-lys-border rounded-md" />
                            ) : lists.map(pl => (
                                <div
                                    key={pl.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => loadDetail(pl.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') loadDetail(pl.id) }}
                                    className={cn(
                                        'p-3 rounded-md border cursor-pointer transition-colors',
                                        selectedId === pl.id
                                            ? 'bg-lys-teal-soft border-lys-teal'
                                            : 'bg-white border-lys-border hover:bg-lys-subtle',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <p className="text-sm font-semibold text-lys-primary">{pl.name}</p>
                                        <ChannelBadge channel={pl.channel} />
                                    </div>
                                    <div className="flex items-center justify-between type-caption">
                                        <span>{pl.itemCount} sản phẩm · {new Date(pl.effectiveDate).toLocaleDateString('vi-VN')}</span>
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
                            ))}
                        </section>

                        {/* Right: detail */}
                        <section className="lg:col-span-2">
                            {detailLoading ? (
                                <div className="flex flex-col gap-3">
                                    <Skeleton className="h-20" />
                                    <Skeleton className="h-64" />
                                </div>
                            ) : !selectedId ? (
                                <EmptyState icon={DollarSign} title="Chọn bảng giá bên trái để xem chi tiết" className="bg-white border border-lys-border rounded-md py-20" />
                            ) : detail ? (
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between gap-3 p-4 rounded-md bg-white border border-lys-border">
                                        <div>
                                            <h3 className="text-base font-semibold text-lys-primary">{detail.name}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <ChannelBadge channel={detail.channel} />
                                                <span className="type-caption">
                                                    Hiệu lực: {new Date(detail.effectiveDate).toLocaleDateString('vi-VN')}
                                                    {detail.expiryDate && ` → ${new Date(detail.expiryDate).toLocaleDateString('vi-VN')}`}
                                                </span>
                                            </div>
                                        </div>
                                        <Button variant="secondary" onClick={openAddProduct}>
                                            <Plus size={14} aria-hidden /> Thêm Sản Phẩm
                                        </Button>
                                    </div>

                                    <Table>
                                        <THead>
                                            <tr>
                                                <Th>SKU</Th>
                                                <Th>Sản Phẩm</Th>
                                                <Th align="right">Giá Bán</Th>
                                                <Th>Tiền Tệ</Th>
                                                <Th aria-label="Thao tác" />
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {detail.lines.length === 0 ? (
                                                <TableMessageRow colSpan={5}>
                                                    <EmptyState icon={Package} title="Chưa có sản phẩm" description='Bấm "Thêm Sản Phẩm" để bắt đầu.' />
                                                </TableMessageRow>
                                            ) : detail.lines.map(line => (
                                                <Tr key={line.id}>
                                                    <Td className="type-number font-semibold text-lys-teal-strong">{line.skuCode}</Td>
                                                    <Td className="text-lys-primary">{line.productName}</Td>
                                                    <Td align="right" className="type-number font-semibold text-lys-primary">{formatVND(line.unitPrice)}</Td>
                                                    <Td className="text-lys-muted">{line.currency}</Td>
                                                    <Td align="right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
                                                            onClick={() => handleRemoveLine(line.id)}
                                                            aria-label="Xóa dòng giá"
                                                        >
                                                            <Trash2 size={13} aria-hidden />
                                                        </Button>
                                                    </Td>
                                                </Tr>
                                            ))}
                                        </TBody>
                                    </Table>
                                </div>
                            ) : null}
                        </section>
                    </div>
                </>
            )}

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
                    <div className="grid grid-cols-2 gap-3">
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
                        <Button onClick={handleAddProduct} loading={saving} disabled={saving || !addProductId || !addPrice}>Thêm Giá</Button>
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
