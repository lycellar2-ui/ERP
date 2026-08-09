'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft, Plus, Eye, RefreshCw, Search, Clock, CheckCircle2, Truck, PackageCheck, FileText, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { type TransferOrderRow, getTransferOrders, cancelTransferOrder } from '../transfers/actions'
import { CreateTransferDrawer } from '../transfers/CreateTransferDrawer'
import { TransferDetailDrawer } from '../transfers/TransferDetailDrawer'
import { formatDate } from '@/lib/utils'

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Nháp', color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
    PENDING_ACCOUNTING: { label: 'Chờ Kế Toán Duyệt', color: '#B47816', bg: 'rgba(212,168,83,0.15)', border: '#F59E0B' },
    CONFIRMED: { label: 'Kế Toán Đã Duyệt', color: '#0284C7', bg: 'rgba(2,132,199,0.12)', border: '#38BDF8' },
    IN_TRANSIT: { label: 'Đang Chuyển', color: '#2563EB', bg: 'rgba(37,99,235,0.12)', border: '#60A5FA' },
    RECEIVED: { label: 'Đã Nhận Hàng', color: '#16A34A', bg: 'rgba(22,163,74,0.12)', border: '#4ADE80' },
    CANCELLED: { label: 'Đã Hủy', color: '#DC2626', bg: 'rgba(220,38,38,0.12)', border: '#F87171' },
}

export function TransfersTab() {
    const [rows, setRows] = useState<TransferOrderRow[]>([])
    const [loading, setLoading] = useState(true)
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

    useEffect(() => { reload() }, [])

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
        <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                        <ArrowRightLeft size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                            Quản Lý Phiếu Chuyển Kho Nội Bộ
                        </h3>
                        <p className="text-xs text-slate-500">
                            Lập phiếu chuyển kho, duyệt Kế toán & in phiếu chứng từ A4 ký 4 bên
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={reload}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={() => setCreateOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                        <Plus size={16} /> Lập Phiếu Chuyển Kho
                    </button>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { key: 'ALL', label: 'Tất Cả', count: statusCounts.ALL },
                        { key: 'PENDING_ACCOUNTING', label: 'Chờ Kế Toán Duyệt', count: statusCounts.PENDING_ACCOUNTING, badgeColor: 'bg-amber-500 text-white' },
                        { key: 'CONFIRMED', label: 'Đã Duyệt', count: statusCounts.CONFIRMED },
                        { key: 'IN_TRANSIT', label: 'Đang Chuyển', count: statusCounts.IN_TRANSIT },
                        { key: 'RECEIVED', label: 'Hoàn Tất', count: statusCounts.RECEIVED },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setStatusTab(t.key)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${statusTab === t.key ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            <span>{t.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${t.badgeColor || (statusTab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700')}`}>
                                {t.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm mã phiếu, kho xuất, kho nhận..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 outline-none focus:border-amber-500 shadow-2xs"
                    />
                </div>
            </div>

            {/* Desktop List Table */}
            <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
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
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400">
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
                                            className="hover:bg-amber-50/40 transition-colors cursor-pointer"
                                        >
                                            <td className="p-3 font-mono font-extrabold text-amber-700 whitespace-nowrap">
                                                {r.transferNo}
                                            </td>
                                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                                [{r.fromWarehouseCode}] {r.fromWarehouse}
                                            </td>
                                            <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                                                [{r.toWarehouseCode}] {r.toWarehouse}
                                            </td>
                                            <td className="p-3 text-slate-800 font-medium whitespace-nowrap">
                                                {r.requesterName}
                                            </td>
                                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                                {formatDate(r.transferDate)}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                                                {r.lineCount} mã
                                            </td>
                                            <td className="p-3 text-center font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                                                {r.totalQty.toLocaleString()} chai
                                            </td>
                                            <td className="p-3 text-center whitespace-nowrap">
                                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                                                    style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right whitespace-nowrap">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setSelectedId(r.id) }}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} /> Xem Phiếu
                                                    </button>
                                                    {(r.status === 'DRAFT' || r.status === 'PENDING_ACCOUNTING') && (
                                                        <button
                                                            onClick={e => handleCancel(r.id, e)}
                                                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
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

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden space-y-3">
                {filteredRows.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs bg-white border border-slate-200 rounded-2xl">
                        Không tìm thấy phiếu chuyển kho nào
                    </div>
                ) : (
                    filteredRows.map(r => {
                        const st = STATUS_CFG[r.status] ?? STATUS_CFG.DRAFT
                        return (
                            <div
                                key={r.id}
                                onClick={() => setSelectedId(r.id)}
                                className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 space-y-3 shadow-2xs active:scale-98 transition cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                                        {r.transferNo}
                                    </span>
                                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                                        style={{ color: st.color, background: st.bg, borderColor: st.border }}>
                                        {st.label}
                                    </span>
                                </div>

                                {/* Route indicator */}
                                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-semibold">
                                    <span className="text-rose-300 font-bold truncate">🔴 {r.fromWarehouse}</span>
                                    <span className="text-slate-500 px-1 font-bold">➔</span>
                                    <span className="text-emerald-300 font-bold truncate">🟢 {r.toWarehouse}</span>
                                </div>

                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                                    <div>
                                        <span className="text-slate-400 text-[10px] uppercase block font-bold">Tổng số chai:</span>
                                        <span className="font-mono font-black text-emerald-400 text-sm">{r.totalQty.toLocaleString()} chai</span>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); setSelectedId(r.id) }}
                                        className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 shadow-md"
                                    >
                                        <Eye size={12} /> Xem Chi Tiết
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
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
            />
        </div>
    )
}
