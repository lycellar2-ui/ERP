'use client'

import { useState } from 'react'
import { QrCode, Search, ExternalLink, ShieldCheck, ShieldAlert, Printer } from 'lucide-react'
import { getQRCodes } from './actions'

interface QRRow {
    id: string; code: string; lotNo: string; skuCode: string; productName: string
    scanCount: number; firstScannedAt: Date | null; lastScannedAt: Date | null
    createdAt: Date; lotData: any
}

export function QRCodeClient({ initialData, stats }: {
    initialData: { rows: QRRow[]; total: number }
    stats: { total: number; scanned: number; unscanned: number }
}) {
    const [data, setData] = useState(initialData)
    const [search, setSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const handleSearch = async () => {
        const result = await getQRCodes({ search })
        setData(result)
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                        QR Code Truy Xuất
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                        Quản lý mã QR truy xuất nguồn gốc — Auto-sinh khi Confirm GR
                    </p>
                </div>
                {selectedIds.size > 0 && (
                    <button onClick={async () => {
                        const res = await fetch('/api/qr-print', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ids: Array.from(selectedIds) }),
                        })
                        const html = await res.text()
                        const w = window.open('', '_blank')
                        if (w) { w.document.write(html); w.document.close() }
                    }}
                        className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold"
                        style={{ background: '#0891B2', color: '#FFFFFF' }}>
                        <Printer size={14} /> In {selectedIds.size} Nhãn
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Tổng QR', value: stats.total, color: '#0891B2', icon: QrCode },
                    { label: 'Đã Quét', value: stats.scanned, color: '#5BA88A', icon: ShieldCheck },
                    { label: 'Chưa Quét', value: stats.unscanned, color: '#D4A853', icon: ShieldAlert },
                ].map(s => (
                    <div key={s.label} className="p-4 rounded-md flex items-center gap-3"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <s.icon size={20} style={{ color: s.color }} />
                        <div>
                            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#64748B' }}>{s.label}</p>
                            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Tìm theo Lot No hoặc QR Code..."
                        className="w-full pl-9 pr-3 py-2 rounded-md text-sm outline-none"
                        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
                <button onClick={handleSearch} className="px-4 py-2 text-xs font-semibold rounded-md"
                    style={{ background: '#0891B2', color: '#FFFFFF' }}>Tìm</button>
            </div>

            {/* Table */}
            <div className="rounded-md overflow-x-auto" style={{ border: '1px solid #E2E8F0' }}>
                <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                            <th className="px-3 py-3 w-8">
                                <input type="checkbox"
                                    checked={selectedIds.size === data.rows.length && data.rows.length > 0}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedIds(new Set(data.rows.map(r => r.id)))
                                        else setSelectedIds(new Set())
                                    }}
                                    className="w-3.5 h-3.5 accent-emerald-500" />
                            </th>
                            {['QR Code', 'Lot No', 'SKU', 'Sản Phẩm', 'Lần Quét', 'Trạng Thái', 'Link'].map(h => (
                                <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                    style={{ color: '#64748B' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.length === 0 ? (
                            <tr><td colSpan={8} className="text-center py-16 text-sm" style={{ color: '#64748B' }}>
                                Chưa có QR Code — Confirm GR để auto-sinh
                            </td></tr>
                        ) : data.rows.map(qr => (
                            <tr key={qr.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <td className="px-3 py-2.5">
                                    <input type="checkbox" checked={selectedIds.has(qr.id)}
                                        onChange={e => {
                                            const next = new Set(selectedIds)
                                            e.target.checked ? next.add(qr.id) : next.delete(qr.id)
                                            setSelectedIds(next)
                                        }}
                                        className="w-3.5 h-3.5 accent-emerald-500" />
                                </td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#0891B2' }}>
                                    {qr.code.split('-')[0]}...
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D4A853' }}>
                                    {qr.lotNo}
                                </td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#475569' }}>
                                    {qr.skuCode}
                                </td>
                                <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>
                                    {qr.productName}
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold" style={{ color: qr.scanCount === 0 ? '#64748B' : qr.scanCount === 1 ? '#5BA88A' : '#D4A853' }}>
                                    {qr.scanCount}
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                                        ...(qr.scanCount === 0
                                            ? { color: '#64748B', background: 'rgba(74,106,122,0.15)' }
                                            : qr.scanCount === 1
                                                ? { color: '#5BA88A', background: 'rgba(91,168,138,0.15)' }
                                                : { color: '#D4A853', background: 'rgba(212,168,83,0.15)' }),
                                    }}>
                                        {qr.scanCount === 0 ? 'Chưa quét' : qr.scanCount === 1 ? '✅ Chính hãng' : `⚠ ${qr.scanCount} lần`}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5">
                                    <a href={`${baseUrl}/verify/${qr.code}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs transition-colors"
                                        style={{ color: '#0891B2' }}>
                                        <ExternalLink size={11} /> Mở
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs" style={{ color: '#E2E8F0' }}>
                Hiển thị {data.rows.length}/{data.total} — QR Code tự động sinh khi Confirm Goods Receipt
            </p>
        </div>
    )
}
