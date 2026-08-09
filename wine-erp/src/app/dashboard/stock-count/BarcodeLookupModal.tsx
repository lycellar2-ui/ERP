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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <QrCode className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Tra Cứu Tồn Kho Code 128</h3>
                            <p className="text-xs text-slate-500">Quét mã Code 128 (SKU + Vintage) để xem tồn kho tức thì</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Scanner Input Form */}
                    <form onSubmit={handleSearch} className="space-y-3">
                        <label className="text-xs font-bold text-amber-700 uppercase tracking-wider block">
                            Mã Barcode Code 128 (Quét hoặc Nhập tay)
                        </label>
                        <div className="relative flex items-center">
                            <input
                                ref={inputRef}
                                type="text"
                                value={barcode}
                                onChange={(e) => setBarcode(e.target.value)}
                                placeholder="Nhấp vào đây và quét mã barcode (VD: MARGAUX-2018)..."
                                className="w-full bg-white border border-slate-300 focus:border-[#87CBB9] rounded-xl px-4 py-3.5 pl-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#87CBB9]/20 transition-all font-mono shadow-2xs"
                            />
                            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
                            <button
                                type="submit"
                                disabled={loading}
                                className="absolute right-2 px-4 py-2 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-extrabold text-xs rounded-lg shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                            >
                                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Tra Cứu'}
                            </button>
                        </div>

                        {/* Quick Sample Code Chips */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="text-[11px] text-slate-500 font-medium">Mã mẫu gợi ý:</span>
                            {['MARGAUX-2018', 'PINOT-2020', 'WIN-CAB-2018', 'SKU-001'].map((sample) => (
                                <button
                                    key={sample}
                                    type="button"
                                    onClick={() => handleQuickTestSample(sample)}
                                    className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 transition-colors cursor-pointer font-bold"
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
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-start">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold">
                                                    SKU: {result.product.skuCode}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold flex items-center gap-1">
                                                    <Package className="w-3 h-3" /> Quy cách: {result.product.unitsPerCase} chai/thùng
                                                </span>
                                                {result.parsedVintage && (
                                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" /> Vintage {result.parsedVintage}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                                <Wine className="w-4 h-4 text-amber-600 shrink-0" />
                                                {result.product.productName}
                                            </h4>
                                            <p className="text-xs text-slate-500">
                                                Nhà sản xuất: <span className="text-slate-800 font-semibold">{result.product.producerName || 'Chưa cập nhật'}</span> • Xuất xứ: <span className="text-slate-800 font-semibold">{result.product.country}</span>
                                            </p>
                                        </div>

                                        {/* Total Stock Highlight Box */}
                                        <div className="px-5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-right min-w-[170px] shrink-0">
                                            <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-800">
                                                Tổng Tồn Khả Dụng
                                            </div>
                                            <div className="text-xl font-extrabold text-emerald-700 font-mono mt-0.5">
                                                {result.totalCasesFormatted}
                                            </div>
                                            <div className="text-xs text-slate-600 font-mono">
                                                (Tổng {result.totalStockAvailable} chai)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Multi-Vintage Overview Section */}
                                    {result.vintagesSummary && result.vintagesSummary.length > 0 && (
                                        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                                    Tồn Kho Theo Các Niên Vụ (Vintage) Khác
                                                </h5>
                                                <span className="text-[11px] text-purple-700">
                                                    Tổng {result.vintagesSummary.length} niên vụ
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {result.vintagesSummary.map((v, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={`p-2.5 rounded-lg border text-xs transition-all ${
                                                            v.isScannedVintage
                                                                ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs font-bold'
                                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between font-semibold mb-0.5">
                                                            <span className="font-mono">
                                                                Vintage {v.vintage ?? 'NV'}
                                                            </span>
                                                            {v.isScannedVintage && (
                                                                <span className="text-[9px] px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-sans font-bold">
                                                                    Đang quét
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-emerald-700 font-bold font-mono text-xs">
                                                            {v.casesFormatted}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            ({v.totalQty} chai)
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Warehouse & Location Lots Table */}
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                            <Warehouse className="w-4 h-4 text-amber-600" />
                                            Chi Tiết Tồn Theo Kho & Vị Trí Kệ
                                        </h5>

                                        {result.lotsBreakdown.length === 0 ? (
                                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                                                Hiện chưa có lô hàng tồn khả dụng cho niên vụ/mặt hàng này.
                                            </div>
                                        ) : (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-4 py-2.5">Kho Hàng</th>
                                                            <th className="px-4 py-2.5">Vị Trí Kệ</th>
                                                            <th className="px-4 py-2.5 text-center">Vintage</th>
                                                            <th className="px-4 py-2.5 text-right">Tồn Chai</th>
                                                            <th className="px-4 py-2.5 text-right text-amber-700">Quy Đổi (Thùng / Lẻ)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                                                        {result.lotsBreakdown.map((lot, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                                <td className="px-4 py-3 font-sans text-slate-900 font-bold">
                                                                    {lot.warehouseName}
                                                                </td>
                                                                <td className="px-4 py-3 text-amber-700 font-bold">
                                                                    {lot.locationCode}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-purple-700 font-bold">
                                                                    {lot.vintage ?? 'NV'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-slate-700">
                                                                    {lot.qtyAvailable} chai
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-emerald-700 font-bold text-xs">
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
                                <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                                    <div>
                                        <h5 className="font-bold text-sm">Không Tìm Thấy Dữ Liệu Barcode</h5>
                                        <p className="text-xs text-rose-700 mt-1">{result.error}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
                    <span>Mẹo: Kích hoạt chế độ gõ trên máy quét để tự động bấm Tra Cứu khi quét xong.</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-colors cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
