'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, Search, X, Package, Warehouse, Calendar, Wine, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { lookupStockByBarcode, type BarcodeLookupResult } from './actions'

interface BarcodeLookupModalProps {
    isOpen: boolean
    onClose: () => void
}

export function BarcodeLookupModal({ isOpen, onClose }: BarcodeLookupModalProps) {
    const [barcode, setBarcode] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<BarcodeLookupResult | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setBarcode('')
            setResult(null)
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const trimmed = barcode.trim()
        if (!trimmed) {
            toast.error('Vui lòng nhập hoặc quét mã barcode')
            return
        }

        setLoading(true)
        try {
            const res = await lookupStockByBarcode(trimmed)
            setResult(res)
            if (res.success) {
                toast.success(`Tìm thấy: ${res.product?.productName}`)
            } else {
                toast.error(res.error || 'Không tìm thấy dữ liệu')
            }
        } catch (err: any) {
            toast.error('Lỗi khi tra cứu tồn kho')
        } finally {
            setLoading(false)
        }
    }

    const handleQuickTestSample = (sampleCode: string) => {
        setBarcode(sampleCode)
        setLoading(true)
        lookupStockByBarcode(sampleCode).then(res => {
            setResult(res)
            setLoading(false)
            if (res.success) {
                toast.success(`Tìm thấy mẫu: ${res.product?.productName}`)
            } else {
                toast.error(res.error || 'Mã mẫu không tìm thấy trong DB')
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#1A1D24] text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Tra Cứu Tồn Kho Code 128</h3>
                            <p className="text-xs text-white/60">Quét mã Code 128 (SKU + Vintage) để xem tồn kho tức thì</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Scanner Input Form */}
                    <form onSubmit={handleSearch} className="space-y-3">
                        <label className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider block">
                            Mã Barcode Code 128 (Quét hoặc Nhập tay)
                        </label>
                        <div className="relative flex items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                placeholder="Nhấp vào đây và quét mã barcode (VD: MARGAUX-2018)..."
                                className="w-full bg-[#12141A] border border-white/15 focus:border-amber-500 rounded-xl px-4 py-3.5 pl-11 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all font-mono"
                            />
                            <Search className="w-5 h-5 text-white/40 absolute left-3.5 pointer-events-none" />
                            <button
                                type="submit"
                                disabled={loading}
                                className="absolute right-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-semibold text-xs rounded-lg shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Tra Cứu'}
                            </button>
                        </div>

                        {/* Quick Sample Code Chips */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="text-[11px] text-white/40">Mã mẫu gợi ý:</span>
                            {['MARGAUX-2018', 'PINOT-2020', 'WIN-CAB-2018', 'SKU-001'].map((sample) => (
                                <button
                                    key={sample}
                                    type="button"
                                    onClick={() => handleQuickTestSample(sample)}
                                    className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-amber-500/20 hover:border-amber-500/40 text-amber-300 transition-colors"
                                >
                                    {sample}
                                </button>
                            ))}
                        </div>
                    </form>

                    {/* Lookup Results Display */}
                    {result && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {result.success && result.product ? (
                                <div className="space-y-4">
                                    {/* Product Main Card */}
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 flex flex-col md:flex-row gap-4 justify-between items-start">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                                                    SKU: {result.product.skuCode}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1">
                                                    <Package className="w-3 h-3" /> Quy cách: {result.product.unitsPerCase} chai/thùng
                                                </span>
                                                {result.parsedVintage && (
                                                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> Vintage {result.parsedVintage}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-base font-bold text-white flex items-center gap-2">
                                                <Wine className="w-4 h-4 text-amber-400 shrink-0" />
                                                {result.product.productName}
                                            </h4>
                                            <p className="text-xs text-white/60">
                                                Nhà sản xuất: <span className="text-white/80">{result.product.producerName || 'Chưa cập nhật'}</span> • Xuất xứ: <span className="text-white/80">{result.product.country}</span>
                                            </p>
                                        </div>

                                        {/* Total Stock Highlight Box */}
                                        <div className="px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-right min-w-[170px] shrink-0">
                                            <div className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400/90">
                                                Tổng Tồn Khả Dụng
                                            </div>
                                            <div className="text-xl font-extrabold text-emerald-300 font-mono mt-0.5">
                                                {result.totalCasesFormatted}
                                            </div>
                                            <div className="text-xs text-white/60 font-mono">
                                                (Tổng {result.totalStockAvailable} chai)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Multi-Vintage Overview Section */}
                                    {result.vintagesSummary && result.vintagesSummary.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                                                    Tồn Kho Theo Các Niên Vụ (Vintage) Khác
                                                </h5>
                                                <span className="text-[11px] text-purple-300/70">
                                                    Tổng {result.vintagesSummary.length} niên vụ
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {result.vintagesSummary.map((v, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`p-2.5 rounded-lg border text-xs transition-all ${
                                                            v.isScannedVintage
                                                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 shadow-sm'
                                                                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between font-semibold mb-0.5">
                                                            <span className="font-mono">
                                                                Vintage {v.vintage ?? 'NV'}
                                                            </span>
                                                            {v.isScannedVintage && (
                                                                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/30 text-amber-300 rounded font-sans">
                                                                    Đang quét
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-emerald-400 font-bold font-mono text-xs">
                                                            {v.casesFormatted}
                                                        </div>
                                                        <div className="text-[10px] text-white/50">
                                                            ({v.totalQty} chai)
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Warehouse & Location Lots Table */}
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                                            <Warehouse className="w-4 h-4 text-amber-400" />
                                            Chi Tiết Tồn Theo Kho & Vị Trí Kệ
                                        </h5>

                                        {result.lotsBreakdown.length === 0 ? (
                                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-white/50">
                                                Hiện chưa có lô hàng tồn khả dụng cho niên vụ/mặt hàng này.
                                            </div>
                                        ) : (
                                            <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-white/5 text-white/60 border-b border-white/10 font-semibold uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-2.5">Kho Hàng</th>
                                                            <th className="px-4 py-2.5">Vị Trí Kệ</th>
                                                            <th className="px-4 py-2.5 text-center">Vintage</th>
                                                            <th className="px-4 py-2.5 text-right">Tồn Chai</th>
                                                            <th className="px-4 py-2.5 text-right text-amber-300">Quy Đổi (Thùng / Lẻ)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5 font-mono">
                                                        {result.lotsBreakdown.map((lot, idx) => (
                                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-3 font-sans text-white/90 font-medium">
                                                                    {lot.warehouseName}
                                                                </td>
                                                                <td className="px-4 py-3 text-amber-300 font-semibold">
                                                                    {lot.locationCode}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-purple-300">
                                                                    {lot.vintage ?? 'NV'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-white/80">
                                                                    {lot.qtyAvailable} chai
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-emerald-400 font-bold text-xs">
                                                                    {lot.casesFormatted}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            ) : (
                                <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div>
                                        <h5 className="font-bold text-sm">Không Tìm Thấy Dữ Liệu Barcode</h5>
                                        <p className="text-xs text-red-300/80 mt-1">{result.error}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-white/10 bg-white/5 flex items-center justify-between text-xs text-white/50">
                    <span>Mẹo: Kích hoạt chế độ gõ trên máy quét để tự động bấm Tra Cứu khi quét xong.</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
