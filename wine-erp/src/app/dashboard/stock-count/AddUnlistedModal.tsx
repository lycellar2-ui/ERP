'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Search, MapPin, Package, AlertCircle, Save, RefreshCw, X } from 'lucide-react'
import { searchProductsForAddition, addUnlistedProductToStockCountSession } from './actions'

type Props = {
    sessionId: string
    sessionNo: string
    zones: string[]
    onClose: () => void
    onSuccess: () => void
}

export function AddUnlistedModal({ sessionId, sessionNo, zones, onClose, onSuccess }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const [products, setProducts] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)

    // Form inputs
    const [vintage, setVintage] = useState<string>('')
    const [locationCode, setLocationCode] = useState<string>(zones[0] || 'Khu vực chung')
    const [cases, setCases] = useState<number>(0)
    const [loose, setLoose] = useState<number>(0)
    const [varianceReason, setVarianceReason] = useState<string>('UNRECORDED_GR')
    const [notes, setNotes] = useState<string>('Mã chèn thêm ngoài danh sách kiểm kê')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    // Fetch initial products
    useEffect(() => {
        handleSearchProducts('')
    }, [])

    const handleSearchProducts = async (q: string) => {
        setIsSearching(true)
        try {
            const list = await searchProductsForAddition(q)
            setProducts(list)
        } catch (err) {
            console.error(err)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) {
            setErrorMsg('Vui lòng chọn 1 sản phẩm từ danh sách')
            return
        }

        const upc = selectedProduct.unitsPerCase || 6
        const qtyActual = (Number(cases) || 0) * upc + (Number(loose) || 0)

        if (qtyActual <= 0) {
            setErrorMsg('Số lượng đếm thực tế phải lớn hơn 0')
            return
        }

        setIsSubmitting(true)
        setErrorMsg('')

        const res = await addUnlistedProductToStockCountSession({
            sessionId,
            productId: selectedProduct.id,
            locationCode: locationCode || 'CHÈN_THÊM',
            vintage: vintage ? parseInt(vintage, 10) : undefined,
            qtyActual,
            varianceReason,
            notes
        })

        setIsSubmitting(false)

        if (res.success) {
            onSuccess()
            onClose()
        } else {
            setErrorMsg(res.error || 'Không thể chèn thêm sản phẩm vào kiểm kê')
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 text-slate-900 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {sessionNo}
                            </span>
                            <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                + Chèn Mã Bổ Sung
                            </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">Chèn Mã / Vintage Ngoài Danh Sách</h3>
                        <p className="text-xs text-slate-500">Ghi nhận sản phẩm thực tế có trong kho nhưng chưa được tạo dòng kiểm kê</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    {/* Step 1: Product Selector */}
                    <div>
                        <label className="text-slate-700 font-bold block mb-1">1. CHỌN SẢN PHẨM KHỔNG TỒN TẠI TRONG DANH SÁCH:</label>
                        <div className="relative mb-2">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Gõ SKU, mã vạch hoặc tên rượu để tìm..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    handleSearchProducts(e.target.value)
                                }}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#87CBB9] focus:ring-2 focus:ring-[#87CBB9]/20 font-semibold"
                            />
                        </div>

                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                            {isSearching ? (
                                <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-1">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tìm sản phẩm...
                                </div>
                            ) : products.length === 0 ? (
                                <div className="p-3 text-center text-slate-400">Không tìm thấy sản phẩm phù hợp</div>
                            ) : (
                                products.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedProduct(p)}
                                        className={`p-2.5 cursor-pointer transition flex items-center justify-between ${selectedProduct?.id === p.id ? 'bg-amber-50 text-amber-900 font-bold border-l-4 border-amber-500' : 'hover:bg-slate-50 text-slate-800'}`}
                                    >
                                        <div>
                                            <div className="font-mono text-[11px] font-extrabold text-amber-900">{p.skuCode}</div>
                                            <div className="font-bold text-xs mt-0.5">{p.productName}</div>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                            {p.unitsPerCase || 6} chai/thùng
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        {selectedProduct && (
                            <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-extrabold flex items-center justify-between">
                                <span>✓ Đã chọn: {selectedProduct.productName} ({selectedProduct.skuCode})</span>
                                <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded text-emerald-900">UPC: {selectedProduct.unitsPerCase || 6}</span>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Vintage & Zone/Location */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-slate-700 font-bold block mb-1">2. VINTAGE (NĂM SX):</label>
                            <input
                                type="number"
                                placeholder="VD: 2020 (Bỏ trống nếu NV)"
                                value={vintage}
                                onChange={e => setVintage(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-[#87CBB9] font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="text-slate-700 font-bold block mb-1">3. VỊ TRÍ / KỆ KHO:</label>
                            <input
                                type="text"
                                placeholder="VD: Khu A - Kệ 02"
                                value={locationCode}
                                onChange={e => setLocationCode(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2.5 text-xs outline-none focus:border-[#87CBB9] font-extrabold"
                            />
                        </div>
                    </div>

                    {/* Step 3: Quantity found */}
                    <div>
                        <label className="text-slate-700 font-bold block mb-1">4. SỐ LƯỢNG ĐẾM THỰC TẾ TRÊN KỆ:</label>
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                            <div className="bg-white border border-slate-300 rounded-xl p-2 text-center">
                                <span className="text-[10px] font-extrabold text-slate-500 block mb-1">📦 SỐ THÙNG</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={cases}
                                    onChange={e => setCases(parseInt(e.target.value, 10) || 0)}
                                    className="w-full text-center text-xl font-black font-mono text-emerald-800 outline-none"
                                />
                            </div>

                            <div className="bg-white border border-slate-300 rounded-xl p-2 text-center">
                                <span className="text-[10px] font-extrabold text-slate-500 block mb-1">🍾 CHAI LẺ</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={loose}
                                    onChange={e => setLoose(parseInt(e.target.value, 10) || 0)}
                                    className="w-full text-center text-xl font-black font-mono text-emerald-800 outline-none"
                                />
                            </div>
                        </div>
                        <div className="mt-1 text-right text-[11px] font-mono text-emerald-700 font-extrabold">
                            Tổng thực tế chèn: {(Number(cases) || 0) * (selectedProduct?.unitsPerCase || 6) + (Number(loose) || 0)} chai
                        </div>
                    </div>

                    {/* Step 4: Variance Reason & Notes */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-slate-700 font-bold block mb-1">5. LÝ DO NGUYÊN NHÂN:</label>
                            <select
                                value={varianceReason}
                                onChange={e => setVarianceReason(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2 text-xs outline-none font-semibold cursor-pointer"
                            >
                                <option value="UNRECORDED_GR">Chưa ghi nhận phiếu nhập GR</option>
                                <option value="WRONG_LOCATION">Xếp sai vị trí kệ kho</option>
                                <option value="SAMPLE_STOCK">Hàng mẫu trưng bày</option>
                                <option value="OTHER">Lý do khác</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-slate-700 font-bold block mb-1">6. GHI CHÚ:</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-xl p-2 text-xs outline-none font-semibold"
                            />
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border border-slate-200 cursor-pointer"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedProduct}
                            className="px-5 py-2.5 bg-[#87CBB9] hover:bg-[#76BAA8] text-[#0A1926] font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Chèn Vào Phiếu Kiểm Kê
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
