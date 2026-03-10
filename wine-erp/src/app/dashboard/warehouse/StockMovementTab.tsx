'use client'

import { useState, useCallback } from 'react'
import {
    Search, Package, ArrowDownCircle, ArrowUpCircle, Loader2,
    Calendar, Filter, Download, MapPin, BarChart3, TrendingUp, TrendingDown,
    FileText, X, ChevronDown
} from 'lucide-react'
import {
    StockMovementRow, NXTSummary, ProductOption,
    getStockMovements, getProductSearchOptions, getProductStockByLocation
} from './actions-nxt'
import { formatVND, formatDate, formatNumber } from '@/lib/utils'

interface WarehouseOption {
    id: string
    code: string
    name: string
}

const DOC_TYPE_CFG: Record<string, { label: string; color: string; icon: any }> = {
    GR: { label: 'Nhập Kho', color: '#5BA88A', icon: ArrowDownCircle },
    DO: { label: 'Xuất Kho', color: '#C74B50', icon: ArrowUpCircle },
    ADJ: { label: 'Điều Chỉnh', color: '#D4A853', icon: BarChart3 },
    TRANSFER_IN: { label: 'Chuyển Vào', color: '#4A8FAB', icon: ArrowDownCircle },
    TRANSFER_OUT: { label: 'Chuyển Ra', color: '#B87333', icon: ArrowUpCircle },
    WRITE_OFF: { label: 'Hủy', color: '#8B1A2E', icon: TrendingDown },
}

export function StockMovementTab({ warehouses }: { warehouses: WarehouseOption[] }) {
    const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
    const [productSearch, setProductSearch] = useState('')
    const [productOptions, setProductOptions] = useState<ProductOption[]>([])
    const [searchingProducts, setSearchingProducts] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const [warehouseId, setWarehouseId] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [movementType, setMovementType] = useState<'ALL' | 'IN' | 'OUT'>('ALL')

    const [movements, setMovements] = useState<StockMovementRow[]>([])
    const [summary, setSummary] = useState<NXTSummary | null>(null)
    const [stockLocations, setStockLocations] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)

    // ── Product search debounce ───────────────────
    const searchProducts = useCallback(async (term: string) => {
        if (term.length < 2) { setProductOptions([]); return }
        setSearchingProducts(true)
        try {
            const results = await getProductSearchOptions(term)
            setProductOptions(results)
        } finally {
            setSearchingProducts(false)
        }
    }, [])

    let searchTimer: any
    const handleProductSearchChange = (val: string) => {
        setProductSearch(val)
        setShowDropdown(true)
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => searchProducts(val), 300)
    }

    const selectProduct = async (product: ProductOption) => {
        setSelectedProduct(product)
        setProductSearch('')
        setShowDropdown(false)
        setProductOptions([])
        await loadReport(product.id)
    }

    // ── Load report ──────────────────────────────
    const loadReport = async (productId?: string) => {
        const pid = productId || selectedProduct?.id
        if (!pid) return
        setLoading(true)
        try {
            const [result, locs] = await Promise.all([
                getStockMovements({ productId: pid, warehouseId: warehouseId || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, movementType }),
                getProductStockByLocation(pid),
            ])
            setMovements(result.movements)
            setSummary(result.summary)
            setStockLocations(locs)
            setLoaded(true)
        } finally {
            setLoading(false)
        }
    }

    // ── Export CSV ────────────────────────────────
    const exportCSV = () => {
        if (movements.length === 0) return
        const headers = ['Ngày', 'Loại', 'Số Chứng Từ', 'Kho', 'Vị Trí', 'Lô Hàng', 'SL Nhập', 'SL Xuất', 'Tồn', 'Đơn Giá', 'Tham Chiếu']
        const rows = movements.map(m => [
            new Date(m.date).toLocaleDateString('vi-VN'),
            DOC_TYPE_CFG[m.docType]?.label || m.docType,
            m.docNo, m.warehouseName, m.locationCode, m.lotNo,
            m.qtyIn || '', m.qtyOut || '', m.balance,
            m.unitCost, m.reference,
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `nxt-${selectedProduct?.skuCode}-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const inputCls = "px-3 py-2 rounded-lg text-sm outline-none transition-colors"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-5">
            {/* Product Search */}
            <div className="p-5 rounded-2xl space-y-4" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2">
                    <FileText size={16} style={{ color: '#87CBB9' }} />
                    <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>Sổ Nhập Xuất Tồn — Tra Cứu Theo Mã Hàng</h3>
                </div>

                <div className="grid grid-cols-12 gap-3">
                    {/* Product selector */}
                    <div className="col-span-12 lg:col-span-4 relative">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1.5" style={{ color: '#4A6A7A' }}>Mã Hàng / SKU</label>
                        {selectedProduct ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(135,203,185,0.1)', border: '1px solid #87CBB9' }}>
                                <Package size={14} style={{ color: '#87CBB9' }} />
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{selectedProduct.skuCode}</span>
                                    <span className="text-xs ml-2 truncate" style={{ color: '#8AAEBB' }}>{selectedProduct.productName}</span>
                                </div>
                                <button onClick={() => { setSelectedProduct(null); setMovements([]); setSummary(null); setLoaded(false) }}
                                    className="flex-shrink-0" style={{ color: '#4A6A7A' }}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                                <input
                                    placeholder="Tìm theo SKU, tên, barcode..."
                                    value={productSearch}
                                    onChange={e => handleProductSearchChange(e.target.value)}
                                    onFocus={() => productOptions.length > 0 && setShowDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                    className={`w-full pl-9 ${inputCls}`}
                                    style={inputStyle}
                                />
                                {searchingProducts && (
                                    <Loader2 size={14} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#87CBB9' }} />
                                )}
                                {showDropdown && productOptions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-50 max-h-60 overflow-y-auto"
                                        style={{ background: '#142433', border: '1px solid #2A4355', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                        {productOptions.map(p => (
                                            <button key={p.id} onClick={() => selectProduct(p)}
                                                className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors"
                                                style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.08)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                                <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{p.skuCode}</span>
                                                <span className="text-xs truncate flex-1" style={{ color: '#E8F1F2' }}>{p.productName}</span>
                                                {p.vintage && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(212,168,83,0.1)', color: '#D4A853' }}>{p.vintage}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Warehouse filter */}
                    <div className="col-span-6 lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1.5" style={{ color: '#4A6A7A' }}>Kho</label>
                        <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
                            className={`w-full ${inputCls}`} style={{ ...inputStyle, color: warehouseId ? '#E8F1F2' : '#4A6A7A' }}>
                            <option value="">Tất cả kho</option>
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    {/* Date range */}
                    <div className="col-span-6 lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1.5" style={{ color: '#4A6A7A' }}>Từ Ngày</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className={`w-full ${inputCls}`} style={inputStyle} />
                    </div>
                    <div className="col-span-6 lg:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold block mb-1.5" style={{ color: '#4A6A7A' }}>Đến Ngày</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className={`w-full ${inputCls}`} style={inputStyle} />
                    </div>

                    {/* Movement type + Action */}
                    <div className="col-span-6 lg:col-span-2 flex flex-col justify-end gap-2">
                        <select value={movementType} onChange={e => setMovementType(e.target.value as any)}
                            className={`w-full ${inputCls}`} style={{ ...inputStyle, color: movementType !== 'ALL' ? '#E8F1F2' : '#4A6A7A' }}>
                            <option value="ALL">Tất cả</option>
                            <option value="IN">Chỉ Nhập</option>
                            <option value="OUT">Chỉ Xuất</option>
                        </select>
                        {selectedProduct && (
                            <button onClick={() => loadReport()} disabled={loading}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                                style={{ background: '#87CBB9', color: '#0A1926' }}>
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
                                Lọc
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && loaded && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                        { label: 'Tổng Nhập', value: formatNumber(summary.totalIn), accent: '#5BA88A', icon: ArrowDownCircle },
                        { label: 'Tổng Xuất', value: formatNumber(summary.totalOut), accent: '#C74B50', icon: ArrowUpCircle },
                        { label: 'Tồn Kho Hiện Tại', value: formatNumber(summary.closingBalance), accent: '#87CBB9', icon: Package },
                        { label: 'Giá Trị Tồn', value: formatVND(summary.totalValue), accent: '#D4A853', icon: TrendingUp },
                        { label: 'Số Phiếu', value: String(summary.movementCount), accent: '#4A8FAB', icon: FileText },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-3 p-3.5 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${s.accent}20` }}>
                                <s.icon size={18} style={{ color: s.accent }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-wide font-semibold truncate" style={{ color: '#4A6A7A' }}>{s.label}</p>
                                <p className="text-base font-bold leading-tight truncate" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Movement Table + Stock Locations */}
            {loaded && (
                <div className="grid grid-cols-12 gap-5">
                    {/* Movement timeline */}
                    <div className="col-span-12 lg:col-span-9">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>
                                Sổ Kho — {selectedProduct?.skuCode}
                                <span className="ml-2 text-[10px] normal-case" style={{ color: '#2A4355' }}>({movements.length} dòng)</span>
                            </p>
                            {movements.length > 0 && (
                                <button onClick={exportCSV}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                                    style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.08)', border: '1px solid rgba(135,203,185,0.2)' }}>
                                    <Download size={12} /> Export CSV
                                </button>
                            )}
                        </div>

                        {movements.length === 0 ? (
                            <div className="flex flex-col items-center py-16 gap-3 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                                <BarChart3 size={32} style={{ color: '#2A4355' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>
                                    {selectedProduct ? 'Chưa có phiếu nhập/xuất nào cho sản phẩm này' : 'Chọn sản phẩm để xem sổ kho'}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                                <div style={{ maxHeight: 'calc(100vh - 450px)', overflowY: 'auto' }}>
                                    <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                                {['Ngày', 'Loại', 'Số CT', 'Kho', 'Vị Trí', 'Lô Hàng', 'Nhập', 'Xuất', 'Tồn', 'Tham Chiếu'].map(h => (
                                                    <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {movements.map(m => {
                                                const cfg = DOC_TYPE_CFG[m.docType] || { label: m.docType, color: '#8AAEBB', icon: FileText }
                                                const Icon = cfg.icon
                                                return (
                                                    <tr key={m.id} className="group transition-colors"
                                                        style={{ borderBottom: '1px solid rgba(42,67,85,0.4)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{formatDate(m.date)}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                                                style={{ color: cfg.color, background: `${cfg.color}15` }}>
                                                                <Icon size={10} /> {cfg.label}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{m.docNo}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs" style={{ color: '#8AAEBB' }}>{m.warehouseName}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#1B2E3D', color: '#8AAEBB' }}>{m.locationCode}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs font-mono" style={{ color: '#D4A853' }}>{m.lotNo}</span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            {m.qtyIn > 0 ? (
                                                                <span className="text-sm font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono", monospace' }}>
                                                                    +{m.qtyIn.toLocaleString()}
                                                                </span>
                                                            ) : <span style={{ color: '#2A4355' }}>—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            {m.qtyOut > 0 ? (
                                                                <span className="text-sm font-bold" style={{ color: '#C74B50', fontFamily: '"DM Mono", monospace' }}>
                                                                    -{m.qtyOut.toLocaleString()}
                                                                </span>
                                                            ) : <span style={{ color: '#2A4355' }}>—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span className="text-sm font-bold" style={{
                                                                color: m.balance > 0 ? '#87CBB9' : m.balance < 0 ? '#C74B50' : '#4A6A7A',
                                                                fontFamily: '"DM Mono", monospace',
                                                            }}>
                                                                {m.balance.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>{m.reference}</span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Current stock by location */}
                    <div className="col-span-12 lg:col-span-3 space-y-3">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Vị Trí Tồn Kho Hiện Tại</p>
                        {stockLocations.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 rounded-xl" style={{ border: '1px dashed #2A4355' }}>
                                <MapPin size={20} style={{ color: '#2A4355' }} />
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>Không có tồn kho</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {stockLocations.map((loc: any, i: number) => (
                                    <div key={i} className="p-3 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg"
                                                style={{ background: '#1B2E3D', color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                                <MapPin size={10} className="inline mr-1" />{loc.locationCode}
                                            </span>
                                            <span className="text-xs font-bold" style={{
                                                color: loc.status === 'QUARANTINE' ? '#D4A853' : '#5BA88A',
                                                fontFamily: '"DM Mono", monospace',
                                            }}>
                                                {loc.qtyAvailable.toLocaleString()} chai
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px]" style={{ color: '#4A6A7A' }}>
                                            <span>{loc.warehouseName}</span>
                                            <span>Lô: {loc.lotNo}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>
                                            <span>Zone {loc.zone}{loc.rack ? ` / ${loc.rack}` : ''}{loc.bin ? ` / ${loc.bin}` : ''}</span>
                                            <span>{formatVND(loc.qtyAvailable * loc.unitCost)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty state before search */}
            {!loaded && !loading && !selectedProduct && (
                <div className="flex flex-col items-center py-20 gap-4 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.08)' }}>
                        <FileText size={28} style={{ color: '#2A4355' }} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium mb-1" style={{ color: '#4A6A7A' }}>Nhập SKU hoặc Tên sản phẩm để xem Sổ Nhập Xuất Tồn</p>
                        <p className="text-xs" style={{ color: '#2A4355' }}>Hiển thị timeline chi tiết: mỗi phiếu GR (nhập) / DO (xuất) với số dư tồn kho liên tục</p>
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
                </div>
            )}
        </div>
    )
}
