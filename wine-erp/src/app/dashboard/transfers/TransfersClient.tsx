'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, Plus, Eye, RefreshCw, Search, Ban, Zap, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import { type TransferOrderRow, getTransferOrders, cancelTransferOrder, accountingApproveTransfer } from './actions'
import { CreateTransferDrawer } from './CreateTransferDrawer'
import { TransferDetailDrawer } from './TransferDetailDrawer'
import { formatDate } from '@/lib/utils'
import {
    PageHeader,
    Button,
    Badge,
    Toolbar,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    TableMessageRow,
    EmptyState,
} from '@/components/ui'

type SortField =
    | 'transferNo'
    | 'fromWarehouse'
    | 'toWarehouse'
    | 'requesterName'
    | 'transferDate'
    | 'lineCount'
    | 'totalQty'
    | 'status'

const STATUS_CFG: Record<string, { label: string; tone: 'neutral' | 'warning' | 'info' | 'brand' | 'success' | 'danger' }> = {
    DRAFT: { label: 'Nháp', tone: 'neutral' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', tone: 'warning' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt', tone: 'info' },
    IN_TRANSIT: { label: 'Đang Chuyển', tone: 'brand' },
    RECEIVED: { label: 'Đã Nhận Hàng', tone: 'success' },
    CANCELLED: { label: 'Đã Hủy', tone: 'danger' },
}

export function TransfersClient({ initialRows, currentUserRoles = [] }: {
    initialRows: TransferOrderRow[]
    stats?: { total: number; inTransit: number; completed: number }
    currentUserRoles?: string[]
}) {
    const [rows, setRows] = useState<TransferOrderRow[]>(initialRows)
    const [loading, setLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [statusTab, setStatusTab] = useState<string>('ALL')
    const [search, setSearch] = useState('')

    // Sắp xếp mặc định: ngày chuyển giảm dần (mới nhất lên đầu)
    const [sortField, setSortField] = useState<SortField>('transferDate')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            const defaultDesc = field === 'transferDate' || field === 'totalQty' || field === 'lineCount'
            setSortOrder(defaultDesc ? 'desc' : 'asc')
        }
    }

    const reload = async () => {
        setLoading(true)
        try {
            const data = await getTransferOrders()
            setRows(data)
        } catch (err: any) {
            toast.error('Lỗi tải danh sách phiếu chuyển kho: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleQuickApprove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Bạn có chắc chắn muốn phê duyệt Phiếu Chuyển Kho này?')) return
        try {
            const res = await accountingApproveTransfer(id)
            if (!res.success) throw new Error(res.error)
            toast.success('✅ Đã phê duyệt phiếu chuyển kho thành công!')
            reload()
        } catch (err: any) {
            toast.error('Lỗi duyệt phiếu: ' + err.message)
        }
    }

    const handleCancel = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Bạn có chắc chắn muốn hủy Phiếu Chuyển Kho này?')) return
        try {
            const res = await cancelTransferOrder(id)
            if (!res.success) throw new Error(res.error)
            toast.success('Đã hủy phiếu chuyển kho thành công')
            reload()
        } catch (err: any) {
            toast.error('Lỗi hủy phiếu: ' + err.message)
        }
    }

    const filteredRows = rows.filter(r => {
        const matchesStatus = statusTab === 'ALL' || r.status === statusTab
        const matchesSearch = !search ||
            r.transferNo.toLowerCase().includes(search.toLowerCase()) ||
            r.fromWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            r.toWarehouse.toLowerCase().includes(search.toLowerCase()) ||
            r.requesterName.toLowerCase().includes(search.toLowerCase())
        return matchesStatus && matchesSearch
    })

    const sortedRows = [...filteredRows].sort((a, b) => {
        const dir = sortOrder === 'asc' ? 1 : -1

        switch (sortField) {
            case 'transferDate': {
                const timeA = a.transferDate ? new Date(a.transferDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
                const timeB = b.transferDate ? new Date(b.transferDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
                if (timeA !== timeB) return (timeA - timeB) * dir
                return a.transferNo.localeCompare(b.transferNo, undefined, { numeric: true }) * dir
            }
            case 'transferNo':
                return a.transferNo.localeCompare(b.transferNo, undefined, { numeric: true }) * dir
            case 'fromWarehouse':
                return a.fromWarehouse.localeCompare(b.fromWarehouse, 'vi') * dir
            case 'toWarehouse':
                return a.toWarehouse.localeCompare(b.toWarehouse, 'vi') * dir
            case 'requesterName':
                return a.requesterName.localeCompare(b.requesterName, 'vi') * dir
            case 'lineCount':
                return (a.lineCount - b.lineCount) * dir
            case 'totalQty':
                return (a.totalQty - b.totalQty) * dir
            case 'status':
                return a.status.localeCompare(b.status) * dir
            default:
                return 0
        }
    })

    const renderSortHeader = (field: SortField, label: string, align: 'left' | 'center' | 'right' = 'left') => {
        const isActive = sortField === field
        return (
            <th
                onClick={() => handleSort(field)}
                className={`px-3 py-2.5 font-semibold text-[11px] uppercase tracking-wider text-lys-muted cursor-pointer hover:text-lys-title select-none transition-colors ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
            >
                <div className={`inline-flex items-center gap-1.5 ${align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'}`}>
                    <span>{label}</span>
                    {isActive ? (
                        sortOrder === 'asc' ? (
                            <ArrowUp size={13} className="text-lys-primary font-bold shrink-0" />
                        ) : (
                            <ArrowDown size={13} className="text-lys-primary font-bold shrink-0" />
                        )
                    ) : (
                        <ArrowUpDown size={12} className="text-lys-muted opacity-40 hover:opacity-100 transition-opacity shrink-0" />
                    )}
                </div>
            </th>
        )
    }

    const statusCounts = {
        ALL: rows.length,
        PENDING_ACCOUNTING: rows.filter(r => r.status === 'PENDING_ACCOUNTING').length,
        CONFIRMED: rows.filter(r => r.status === 'CONFIRMED').length,
        IN_TRANSIT: rows.filter(r => r.status === 'IN_TRANSIT').length,
        RECEIVED: rows.filter(r => r.status === 'RECEIVED').length,
    }

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title="Chuyển Kho Nội Bộ (Phiếu Chuyển Kho)"
                description="Quản lý phiếu luân chuyển hàng hóa giữa các kho, duyệt Kế toán & In chứng từ A4 ký 4 bên"
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/warehouse">
                            <Button variant="secondary" size="sm">
                                <Zap size={14} className="text-amber-600" />
                                Gợi Ý Điều Chuyển
                            </Button>
                        </Link>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={reload}
                            disabled={loading}
                            loading={loading}
                            title="Tải lại danh sách"
                        >
                            <RefreshCw size={14} />
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus size={15} />
                            Lập Phiếu Chuyển Kho Mới
                        </Button>
                    </div>
                }
            />

            {/* Filter Tabs & Search */}
            <Toolbar
                left={
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        {[
                            { key: 'ALL', label: 'Tất Cả', count: statusCounts.ALL },
                            { key: 'PENDING_ACCOUNTING', label: 'Chờ Kế Toán Duyệt', count: statusCounts.PENDING_ACCOUNTING },
                            { key: 'CONFIRMED', label: 'Đã Duyệt', count: statusCounts.CONFIRMED },
                            { key: 'IN_TRANSIT', label: 'Đang Chuyển', count: statusCounts.IN_TRANSIT },
                            { key: 'RECEIVED', label: 'Hoàn Tất', count: statusCounts.RECEIVED },
                        ].map(t => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setStatusTab(t.key)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                                    statusTab === t.key
                                        ? 'bg-lys-primary/10 text-lys-primary border-b-2 border-lys-primary font-bold'
                                        : 'bg-white text-lys-muted hover:text-lys-title hover:bg-lys-bg border border-lys-border'
                                }`}
                            >
                                <span>{t.label}</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                    statusTab === t.key ? 'bg-lys-primary/15 text-lys-primary' : 'bg-slate-100 text-slate-700'
                                }`}>
                                    {t.count}
                                </span>
                            </button>
                        ))}
                    </div>
                }
                right={
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lys-muted" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm mã phiếu, kho xuất, kho nhận..."
                            className="w-full pl-9 pr-3 py-1.5 rounded-md bg-white border border-lys-border text-xs text-lys-title outline-none focus:border-lys-primary"
                        />
                    </div>
                }
            />

            {/* List Table */}
            <Table>
                <THead>
                    <Tr>
                        {renderSortHeader('transferNo', 'Mã Phiếu')}
                        {renderSortHeader('fromWarehouse', '🔴 Kho Xuất (Đi)')}
                        {renderSortHeader('toWarehouse', '🟢 Kho Nhận (Đến)')}
                        {renderSortHeader('requesterName', 'Người Lập')}
                        {renderSortHeader('transferDate', 'Ngày Chuyển')}
                        {renderSortHeader('lineCount', 'Số Mặt Hàng', 'center')}
                        {renderSortHeader('totalQty', 'Tổng Chai', 'center')}
                        {renderSortHeader('status', 'Trạng Thái', 'center')}
                        <th className="px-3 py-2.5 font-semibold uppercase text-[11px] text-right whitespace-nowrap text-lys-muted">Thao Tác</th>
                    </Tr>
                </THead>
                <TBody>
                    {sortedRows.length === 0 ? (
                        <TableMessageRow colSpan={9}>
                            <EmptyState
                                icon={ArrowRightLeft}
                                title="Không tìm thấy phiếu chuyển kho nào"
                                description="Lập phiếu chuyển kho mới để điều phối và cân bằng lượng tồn kho giữa các chi nhánh."
                                action={
                                    <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
                                        <Plus size={14} /> Lập Phiếu Chuyển Kho
                                    </Button>
                                }
                            />
                        </TableMessageRow>
                    ) : (
                        sortedRows.map(r => {
                            const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                            return (
                                <Tr
                                    key={r.id}
                                    onClick={() => setSelectedId(r.id)}
                                    className="cursor-pointer"
                                >
                                    <Td className="font-mono font-bold text-lys-primary whitespace-nowrap">
                                        {r.transferNo}
                                    </Td>
                                    <Td className="font-semibold text-lys-title whitespace-nowrap">
                                        <span className="text-lys-muted mr-1">[{r.fromWarehouseCode}]</span> {r.fromWarehouse}
                                    </Td>
                                    <Td className="font-semibold text-lys-title whitespace-nowrap">
                                        <span className="text-lys-muted mr-1">[{r.toWarehouseCode}]</span> {r.toWarehouse}
                                    </Td>
                                    <Td className="text-lys-title font-medium whitespace-nowrap">
                                        {r.requesterName}
                                    </Td>
                                    <Td className="font-mono text-lys-muted whitespace-nowrap">
                                        {formatDate(r.transferDate)}
                                    </Td>
                                    <Td align="center" className="font-mono font-bold text-lys-title whitespace-nowrap">
                                        {r.lineCount} mã
                                    </Td>
                                    <Td align="center" className="font-mono font-bold text-emerald-700 whitespace-nowrap">
                                        {r.totalQty.toLocaleString()} chai
                                    </Td>
                                    <Td align="center" className="whitespace-nowrap">
                                        <Badge tone={st.tone}>{st.label}</Badge>
                                    </Td>
                                    <Td align="right" className="whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                                            {r.status === 'PENDING_ACCOUNTING' && (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={e => handleQuickApprove(r.id, e)}
                                                    title="Kế toán duyệt ngay phiếu chuyển kho này"
                                                >
                                                    Duyệt
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setSelectedId(r.id)}
                                            >
                                                <Eye size={13} /> Xem
                                            </Button>
                                            {(r.status === 'DRAFT' || r.status === 'PENDING_ACCOUNTING') && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={e => handleCancel(r.id, e)}
                                                    title="Hủy phiếu này"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                    <Ban size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    </Td>
                                </Tr>
                            )
                        })
                    )}
                </TBody>
            </Table>

            {/* Create Drawer */}
            <CreateTransferDrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={reload}
            />

            {/* Detail & Print Drawer */}
            <TransferDetailDrawer
                transferId={selectedId}
                onClose={() => setSelectedId(null)}
                onRefresh={reload}
                currentUserRoles={currentUserRoles}
            />
        </div>
    )
}
