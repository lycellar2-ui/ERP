'use client'

import { useState } from 'react'
import { ArrowRightLeft, Plus, Eye, RefreshCw, Search, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { type TransferOrderRow, getTransferOrders, cancelTransferOrder, accountingApproveTransfer } from './actions'
import { CreateTransferDrawer } from './CreateTransferDrawer'
import { TransferDetailDrawer } from './TransferDetailDrawer'
import { formatDate } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp', color: '#8AAEBB', bg: 'rgba(138,174,187,0.12)', border: '#2A4355' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', border: 'rgba(212,168,83,0.4)' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt', color: '#38BDF8', bg: 'rgba(2,132,199,0.12)', border: 'rgba(56,189,248,0.4)' },
    IN_TRANSIT: { label: 'Đang Chuyển', color: '#60A5FA', bg: 'rgba(37,99,235,0.12)', border: 'rgba(96,165,250,0.4)' },
    RECEIVED: { label: 'Đã Nhận Hàng', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)', border: 'rgba(135,203,185,0.4)' },
    CANCELLED: { label: 'Đã Hủy', color: '#F87171', bg: 'rgba(220,38,38,0.12)', border: 'rgba(248,113,113,0.4)' },
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

    const statusCounts = {
        ALL: rows.length,
        PENDING_ACCOUNTING: rows.filter(r => r.status === 'PENDING_ACCOUNTING').length,
        CONFIRMED: rows.filter(r => r.status === 'CONFIRMED').length,
        IN_TRANSIT: rows.filter(r => r.status === 'IN_TRANSIT').length,
        RECEIVED: rows.filter(r => r.status === 'RECEIVED').length,
    }

    return (
        <div className="space-y-6 max-w-screen-2xl min-h-screen p-1" style={{ background: '#0A1926' }}>
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                        <ArrowRightLeft size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: '#E8F1F2' }}>
                            Chuyển Kho Nội Bộ (Phiếu Chuyển Kho)
                        </h2>
                        <p className="text-xs" style={{ color: '#8AAEBB' }}>
                            Quản lý phiếu luân chuyển hàng hóa giữa các kho, duyệt Kế toán & In chứng từ A4 ký 4 bên
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={reload}
                        className="p-2 rounded-xl transition-colors cursor-pointer"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }}
                        title="Tải lại danh sách"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={() => setCreateOpen(true)}
                        className="px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer hover:opacity-90"
                        style={{ background: '#87CBB9', color: '#0A1926' }}
                    >
                        <Plus size={16} /> Lập Phiếu Chuyển Kho Mới
                    </button>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { key: 'ALL', label: 'Tất Cả', count: statusCounts.ALL },
                        { key: 'PENDING_ACCOUNTING', label: 'Chờ Kế Toán Duyệt', count: statusCounts.PENDING_ACCOUNTING },
                        { key: 'CONFIRMED', label: 'Đã Duyệt', count: statusCounts.CONFIRMED },
                        { key: 'IN_TRANSIT', label: 'Đang Chuyển', count: statusCounts.IN_TRANSIT },
                        { key: 'RECEIVED', label: 'Hoàn Tất', count: statusCounts.RECEIVED },
                    ].map(t => {
                        const isActive = statusTab === t.key
                        return (
                            <button
                                key={t.key}
                                onClick={() => setStatusTab(t.key)}
                                className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5"
                                style={{
                                    background: isActive ? 'rgba(135,203,185,0.15)' : '#142433',
                                    color: isActive ? '#87CBB9' : '#8AAEBB',
                                    border: `1px solid ${isActive ? 'rgba(135,203,185,0.3)' : '#2A4355'}`,
                                }}
                            >
                                <span>{t.label}</span>
                                <span
                                    className="px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold"
                                    style={{
                                        background: isActive ? 'rgba(135,203,185,0.2)' : '#1B2E3D',
                                        color: isActive ? '#87CBB9' : '#8AAEBB',
                                    }}
                                >
                                    {t.count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm mã phiếu, kho xuất, kho nhận..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs outline-none transition-all shadow-xs"
                        style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                    />
                </div>
            </div>

            {/* List Table */}
            <div className="rounded-xl overflow-hidden shadow-xs" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr style={{ background: '#1B2E3D', borderBottom: '1px solid #2A4355', color: '#8AAEBB' }}>
                                <th className="p-3 font-extrabold uppercase text-[11px] whitespace-nowrap">Mã Phiếu</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] whitespace-nowrap">🔴 Kho Xuất (Đi)</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] whitespace-nowrap">🟢 Kho Nhận (Đến)</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] whitespace-nowrap">Người Lập</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] whitespace-nowrap">Ngày Chuyển</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] text-center whitespace-nowrap">Số Mặt Hàng</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] text-center whitespace-nowrap">Tổng Chai</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] text-center whitespace-nowrap">Trạng Thái</th>
                                <th className="p-3 font-extrabold uppercase text-[11px] text-right whitespace-nowrap">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2A4355]" style={{ background: '#142433' }}>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center" style={{ color: '#4A6A7A' }}>
                                        Không tìm thấy phiếu chuyển kho nào
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map(r => {
                                    const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                                    return (
                                        <tr
                                            key={r.id}
                                            onClick={() => setSelectedId(r.id)}
                                            className="hover:bg-[#1B2E3D] transition-colors cursor-pointer"
                                        >
                                            <td className="p-3 font-mono font-extrabold whitespace-nowrap" style={{ color: '#D4A853' }}>
                                                {r.transferNo}
                                            </td>
                                            <td className="p-3 font-bold whitespace-nowrap" style={{ color: '#E8F1F2' }}>
                                                [{r.fromWarehouseCode}] {r.fromWarehouse}
                                            </td>
                                            <td className="p-3 font-bold whitespace-nowrap" style={{ color: '#E8F1F2' }}>
                                                [{r.toWarehouseCode}] {r.toWarehouse}
                                            </td>
                                            <td className="p-3 font-medium whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                                {r.requesterName}
                                            </td>
                                            <td className="p-3 font-mono whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                                {formatDate(r.transferDate)}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold whitespace-nowrap" style={{ color: '#E8F1F2' }}>
                                                {r.lineCount} mã
                                            </td>
                                            <td className="p-3 text-center font-mono font-extrabold whitespace-nowrap" style={{ color: '#87CBB9' }}>
                                                {r.totalQty.toLocaleString()} chai
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                                                    style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    {r.status === 'PENDING_ACCOUNTING' && (
                                                        <button
                                                            onClick={e => handleQuickApprove(r.id, e)}
                                                            className="px-2.5 py-1 rounded-lg text-emerald-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs hover:opacity-90"
                                                            style={{ background: '#87CBB9' }}
                                                            title="Kế toán duyệt ngay phiếu chuyển kho này"
                                                        >
                                                            ✓ Duyệt
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setSelectedId(r.id) }}
                                                        className="px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer hover:bg-[#2A4355]"
                                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                    >
                                                        <Eye size={12} /> Xem Phiếu
                                                    </button>
                                                    {(r.status === 'DRAFT' || r.status === 'PENDING_ACCOUNTING') && (
                                                        <button
                                                            onClick={e => handleCancel(r.id, e)}
                                                            className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                                            title="Hủy phiếu này"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
