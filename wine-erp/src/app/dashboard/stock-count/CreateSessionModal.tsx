'use client'

import React, { useState, useEffect } from 'react'
import {
    X, Warehouse, Layers, CheckSquare, Square,
    EyeOff, ArrowRight, Loader2, Sparkles, Filter, Check
} from 'lucide-react'
import { getWarehouseLocationOptions, createStockCountSessionExtended } from './actions'
import { toast } from 'sonner'

type WarehouseOption = {
    id: string
    name: string
    code: string
}

type LocationOption = {
    id: string
    locationCode: string
    zone: string
    displayName: string
}

type Props = {
    isOpen: boolean
    onClose: () => void
    warehouses: WarehouseOption[]
    onCreated: (sessionId: string) => void
}

export function CreateSessionModal({ isOpen, onClose, warehouses, onCreated }: Props) {
    const [selectedWhId, setSelectedWhId] = useState<string>(warehouses[0]?.id || '')
    const [title, setTitle] = useState<string>('')
    const [scopeType, setScopeType] = useState<'FULL_WAREHOUSE' | 'CYCLE_COUNT'>('FULL_WAREHOUSE')
    const [isBlind, setIsBlind] = useState<boolean>(false)
    const [locations, setLocations] = useState<LocationOption[]>([])
    const [selectedLocIds, setSelectedLocIds] = useState<Set<string>>(new Set())
    const [selectedWineType, setSelectedWineType] = useState<string>('')
    const [loadingLocations, setLoadingLocations] = useState<boolean>(false)
    const [submitting, setSubmitting] = useState<boolean>(false)

    // Set default warehouse if none selected
    useEffect(() => {
        if (!selectedWhId && warehouses.length > 0) {
            setSelectedWhId(warehouses[0].id)
        }
    }, [warehouses, selectedWhId])

    // Update title placeholder when warehouse changes
    useEffect(() => {
        const wh = warehouses.find(w => w.id === selectedWhId)
        if (wh) {
            const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            const scopeLabel = scopeType === 'FULL_WAREHOUSE' ? 'Toàn phần' : 'Một phần'
            setTitle(`Kiểm kê ${scopeLabel} - ${wh.name} (${today})`)
        }
    }, [selectedWhId, scopeType, warehouses])

    // Load locations when warehouse changes or scope switches to partial
    useEffect(() => {
        if (!selectedWhId || scopeType !== 'CYCLE_COUNT') return
        let cancelled = false
        setLoadingLocations(true)
        getWarehouseLocationOptions(selectedWhId)
            .then((data: any) => {
                if (cancelled) return
                const list = (data || []).map((loc: any) => ({
                    id: loc.id,
                    locationCode: loc.locationCode,
                    zone: loc.zone,
                    displayName: loc.displayName || loc.zone || loc.locationCode
                }))
                setLocations(list)
                // Default: all locations selected
                setSelectedLocIds(new Set(list.map((l: LocationOption) => l.id)))
            })
            .catch(err => {
                console.error('[CreateSessionModal] getWarehouseLocationOptions error:', err)
                toast.error('Không thể tải danh sách vị trí kho')
            })
            .finally(() => {
                if (!cancelled) setLoadingLocations(false)
            })

        return () => {
            cancelled = true
        }
    }, [selectedWhId, scopeType])

    if (!isOpen) return null

    const toggleLocation = (id: string) => {
        setSelectedLocIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const selectAllLocations = () => {
        setSelectedLocIds(new Set(locations.map(l => l.id)))
    }

    const clearAllLocations = () => {
        setSelectedLocIds(new Set())
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedWhId) {
            toast.error('Vui lòng chọn kho kiểm kê')
            return
        }

        if (scopeType === 'CYCLE_COUNT' && selectedLocIds.size === 0) {
            toast.error('Vui lòng chọn ít nhất 1 vị trí để kiểm kê một phần')
            return
        }

        setSubmitting(true)
        try {
            const res = await createStockCountSessionExtended({
                warehouseId: selectedWhId,
                title: title.trim(),
                scopeType: scopeType,
                isBlindCount: isBlind,
                selectedLocationIds: scopeType === 'CYCLE_COUNT' ? Array.from(selectedLocIds) : undefined,
                selectedWineType: selectedWineType || undefined
            })

            if (!res.success || !res.sessionId) {
                toast.error(res.error || 'Không thể tạo đợt kiểm kê')
                setSubmitting(false)
                return
            }

            toast.success('Đã tạo đợt kiểm kê thành công!')
            onCreated(res.sessionId)
            onClose()
        } catch (err: any) {
            console.error('[CreateSessionModal] submit error:', err)
            toast.error(err.message || 'Lỗi khi tạo đợt kiểm kê')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in-50 duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                            <Layers size={18} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">Tạo đợt kiểm kê mới</h2>
                            <p className="text-xs text-slate-500">Thiết lập phạm vi và các vị trí cần kiểm đếm</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* 1. Chọn Kho */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            1. Chọn Kho Hàng
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {warehouses.map(wh => {
                                const active = selectedWhId === wh.id
                                return (
                                    <button
                                        key={wh.id}
                                        type="button"
                                        onClick={() => setSelectedWhId(wh.id)}
                                        className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                                            active
                                                ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                                                {wh.code}
                                            </span>
                                            {active && <Check size={14} className="text-teal-700 font-bold" />}
                                        </div>
                                        <div className="font-semibold text-xs text-slate-900 leading-snug">
                                            {wh.name}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* 2. Chọn Phạm vi kiểm kê */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            2. Phạm Vi Kiểm Kê
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setScopeType('FULL_WAREHOUSE')}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    scopeType === 'FULL_WAREHOUSE'
                                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                            >
                                <div className="font-bold text-xs text-slate-900 mb-1 flex items-center justify-between">
                                    <span>Kiểm kê Toàn phần</span>
                                    {scopeType === 'FULL_WAREHOUSE' && <Check size={14} className="text-teal-700" />}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Kiểm kê toàn bộ danh mục sản phẩm và toàn bộ các vị trí kệ trong kho.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setScopeType('CYCLE_COUNT')}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                    scopeType === 'CYCLE_COUNT'
                                        ? 'border-teal-600 bg-teal-50/50 shadow-xs ring-1 ring-teal-600'
                                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                            >
                                <div className="font-bold text-xs text-slate-900 mb-1 flex items-center justify-between">
                                    <span>Kiểm kê Một phần</span>
                                    {scopeType === 'CYCLE_COUNT' && <Check size={14} className="text-teal-700" />}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    Chọn danh sách các vị trí/kệ cụ thể hoặc lọc theo nhóm hàng cần kiểm tra.
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* Vùng cấu hình khi chọn Kiểm kê một phần */}
                    {scopeType === 'CYCLE_COUNT' && (
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-3 animate-in fade-in-50 duration-150">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <Filter size={14} className="text-teal-600" />
                                    <span>Chọn các vị trí kho cần kiểm ({selectedLocIds.size}/{locations.length})</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllLocations}
                                        className="text-[11px] font-medium text-teal-700 hover:underline"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button
                                        type="button"
                                        onClick={clearAllLocations}
                                        className="text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:underline"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>
                            </div>

                            {loadingLocations ? (
                                <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                                    <Loader2 size={16} className="animate-spin text-teal-600" />
                                    <span>Đang nạp danh sách vị trí kho...</span>
                                </div>
                            ) : locations.length === 0 ? (
                                <div className="py-4 text-center text-xs text-slate-500">
                                    Kho này chưa cấu hình danh mục vị trí chi tiết.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                                    {locations.map(loc => {
                                        const checked = selectedLocIds.has(loc.id)
                                        return (
                                            <div
                                                key={loc.id}
                                                onClick={() => toggleLocation(loc.id)}
                                                className={`flex items-center gap-2.5 p-2 rounded-md border text-xs cursor-pointer select-none transition-all ${
                                                    checked
                                                        ? 'bg-white border-teal-500 text-slate-900 shadow-2xs font-semibold'
                                                        : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                                                }`}
                                            >
                                                {checked ? (
                                                    <CheckSquare size={16} className="text-teal-600 shrink-0" />
                                                ) : (
                                                    <Square size={16} className="text-slate-300 shrink-0" />
                                                )}
                                                <span className="truncate">{loc.displayName}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Lọc loại rượu nếu cần */}
                            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                                <label className="text-[11px] font-medium text-slate-600">
                                    Lọc theo phân loại hàng:
                                </label>
                                <select
                                    value={selectedWineType}
                                    onChange={e => setSelectedWineType(e.target.value)}
                                    className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:border-teal-500"
                                >
                                    <option value="">Tất cả các loại hàng</option>
                                    <option value="RED">Vang đỏ (Red Wine)</option>
                                    <option value="WHITE">Vang trắng (White Wine)</option>
                                    <option value="SPARKLING">Vang nổ / Champagne</option>
                                    <option value="FORTIFIED">Vang cường hóa / Khác</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* 3. Tiêu đề đợt kiểm kê */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            3. Tên đợt kiểm kê
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nhập tên gợi nhớ đợt kiểm kê..."
                            required
                            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                        />
                    </div>

                    {/* 4. Tùy chọn Blind Count */}
                    <div
                        onClick={() => setIsBlind(!isBlind)}
                        className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                    >
                        <div className="pt-0.5">
                            {isBlind ? (
                                <CheckSquare size={16} className="text-teal-600" />
                            ) : (
                                <Square size={16} className="text-slate-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <EyeOff size={14} className="text-slate-500" />
                                <span>Ẩn số tồn sổ sách khi nhân viên đếm (Blind Count)</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Nhân viên chỉ tập trung đếm số lượng thực tế tại kệ mà không nhìn thấy số tồn trên máy tính, tránh thiên vị hoặc bỏ qua bước đếm.
                            </p>
                        </div>
                    </div>
                </form>

                {/* Footer Buttons */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || !selectedWhId}
                        className="px-5 py-2 rounded-lg text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Đang khởi tạo...</span>
                            </>
                        ) : (
                            <>
                                <span>Bắt đầu kiểm kê</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
