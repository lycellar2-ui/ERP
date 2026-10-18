'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { getChannelPriceMapping, saveChannelPriceMapping } from './customer-rules-actions'

interface Props {
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
    onSaved?: () => void
}

export function ChannelMappingTab({ currentUser, onSaved }: Props) {
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [savedSuccess, setSavedSuccess] = useState(false)

    // Mapping states
    const [mapHoreca, setMapHoreca] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapWholesale, setMapWholesale] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapVip, setMapVip] = useState('DIRECT_INDIVIDUAL')
    const [mapDirect, setMapDirect] = useState('DIRECT_INDIVIDUAL')

    const canApprove = currentUser?.permissions.includes('SLS:APPROVE') || currentUser?.roles.includes('CEO')

    const loadMapping = useCallback(async () => {
        setLoading(true)
        try {
            const mappingData = await getChannelPriceMapping()
            setMapHoreca(mappingData.HORECA ?? 'WHOLESALE_DISTRIBUTOR')
            setMapWholesale(mappingData.WHOLESALE_DISTRIBUTOR ?? 'WHOLESALE_DISTRIBUTOR')
            setMapVip(mappingData.VIP_RETAIL ?? 'DIRECT_INDIVIDUAL')
            setMapDirect(mappingData.DIRECT_INDIVIDUAL ?? 'DIRECT_INDIVIDUAL')
        } catch (e) {
            console.error('Failed to load mapping data', e)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadMapping()
    }, [loadMapping])

    const handleSaveMapping = async () => {
        setSaving(true)
        setSavedSuccess(false)
        const res = await saveChannelPriceMapping({
            HORECA: mapHoreca,
            WHOLESALE_DISTRIBUTOR: mapWholesale,
            VIP_RETAIL: mapVip,
            DIRECT_INDIVIDUAL: mapDirect,
        })
        if (res.success) {
            setSavedSuccess(true)
            toast.success('Đã lưu cấu hình ánh xạ kênh giá')
            setTimeout(() => {
                setSavedSuccess(false)
                onSaved?.()
            }, 600)
        } else {
            toast.error('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    if (loading) {
        return (
            <div className="py-8 text-center text-slate-600 text-xs">
                <Loader2 size={22} className="animate-spin mx-auto mb-2 text-[#0891B2]" />
                Đang tải cấu hình ánh xạ kênh giá...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
                Chọn <strong>Bảng Giá Niêm Yết mặc định</strong> áp dụng cho từng kênh khách hàng khi khách hàng không có cơ chế riêng hoặc giá đặc biệt theo chai.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* HORECA */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#B45309] block">
                        1. Kênh HORECA (Nhà Hàng / Khách Sạn)
                    </label>
                    <p className="text-[11px] text-slate-500">Áp dụng cho nhà hàng, khách sạn, bar, lounge</p>
                    <select
                        value={mapHoreca}
                        onChange={e => setMapHoreca(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                        <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                        <option value="VIP_RETAIL">Giá VIP Retail</option>
                    </select>
                </div>

                {/* Wholesale / Distributors */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#0891B2] block">
                        2. Kênh Đại Lý (Distributors)
                    </label>
                    <p className="text-[11px] text-slate-500">Áp dụng cho đại lý cấp 1, nhà phân phối</p>
                    <select
                        value={mapWholesale}
                        onChange={e => setMapWholesale(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                        <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                        <option value="VIP_RETAIL">Giá VIP Retail</option>
                    </select>
                </div>

                {/* VIP Retail */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#0D9488] block">
                        3. Kênh VIP Retail (Khách VIP Lẻ)
                    </label>
                    <p className="text-[11px] text-slate-500">Áp dụng cho khách hàng cá nhân thân thiết VIP</p>
                    <select
                        value={mapVip}
                        onChange={e => setMapVip(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                        <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                        <option value="VIP_RETAIL">Giá VIP Retail</option>
                    </select>
                </div>

                {/* Direct Individual */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                        4. Kênh Mua Trực Tiếp (Khách Lẻ)
                    </label>
                    <p className="text-[11px] text-slate-500">Áp dụng cho khách mua lẻ tiêu chuẩn</p>
                    <select
                        value={mapDirect}
                        onChange={e => setMapDirect(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                        <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                        <option value="VIP_RETAIL">Giá VIP Retail</option>
                    </select>
                </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <div>
                    {savedSuccess && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 size={14} /> Đã lưu cấu hình!
                        </span>
                    )}
                    {!canApprove && (
                        <p className="text-xs text-rose-600">
                            <AlertCircle size={12} className="inline mr-1" />
                            Chỉ Quản Lý hoặc CEO mới có quyền lưu thay đổi này.
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleSaveMapping}
                    disabled={saving || !canApprove}
                    className="px-5 py-2 text-xs font-bold rounded-md bg-[#0891B2] text-white hover:bg-[#0E7490] transition-all disabled:opacity-40"
                >
                    {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Lưu Cấu Hình'}
                </button>
            </div>
        </div>
    )
}

