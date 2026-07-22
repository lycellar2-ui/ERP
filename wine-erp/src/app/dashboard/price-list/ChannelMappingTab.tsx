'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getChannelPriceMapping, saveChannelPriceMapping } from './customer-rules-actions'

interface Props {
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
}

export function ChannelMappingTab({ currentUser }: Props) {
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
            setTimeout(() => setSavedSuccess(false), 3000)
        } else {
            alert('Lỗi: ' + res.error)
        }
        setSaving(false)
    }

    if (loading) {
        return (
            <div className="p-8 text-center" style={{ color: '#8AAEBB' }}>
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                Đang tải cấu hình ánh xạ kênh giá...
            </div>
        )
    }

    return (
        <div className="max-w-4xl space-y-6">
            <div className="p-6 rounded-lg space-y-6" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3 pb-3 border-b border-[#2A4355]">
                    <div className="p-2 rounded-md bg-[#87CBB9]/10 text-[#87CBB9]">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: '#E8F1F2' }}>Ánh Xạ Kênh Giá Mặc Định</h3>
                        <p className="text-xs mt-0.5" style={{ color: '#8AAEBB' }}>
                            Cấu hình phân bổ Bảng Giá Niêm Yết mặc định cho từng nhóm đối tượng khách hàng khi không có Chính Sách Giá Đặc Biệt.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* HORECA */}
                    <div className="p-4 rounded-md space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: '#D4A853' }}>
                            1. Kênh HORECA (Nhà Hàng / Khách Sạn)
                        </label>
                        <p className="text-[11px] style={{ color: '#4A6A7A' }}">Bảng giá áp dụng mặc định cho nhóm nhà hàng, khách sạn, bar</p>
                        <select
                            value={mapHoreca}
                            onChange={e => setMapHoreca(e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        >
                            <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                            <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                            <option value="VIP_RETAIL">Giá VIP Retail</option>
                        </select>
                    </div>

                    {/* Wholesale / Distributors */}
                    <div className="p-4 rounded-md space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: '#87CBB9' }}>
                            2. Kênh Đại Lý (Bán Buôn / Distributors)
                        </label>
                        <p className="text-[11px] style={{ color: '#4A6A7A' }}">Bảng giá áp dụng mặc định cho đại lý cấp 1, nhà phân phối</p>
                        <select
                            value={mapWholesale}
                            onChange={e => setMapWholesale(e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        >
                            <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                            <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                            <option value="VIP_RETAIL">Giá VIP Retail</option>
                        </select>
                    </div>

                    {/* VIP Retail */}
                    <div className="p-4 rounded-md space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: '#A78BFA' }}>
                            3. Kênh VIP Retail (Khách VIP Lẻ)
                        </label>
                        <p className="text-[11px] style={{ color: '#4A6A7A' }}">Bảng giá áp dụng cho khách hàng cá nhân thân thiết VIP</p>
                        <select
                            value={mapVip}
                            onChange={e => setMapVip(e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        >
                            <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                            <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                            <option value="VIP_RETAIL">Giá VIP Retail</option>
                        </select>
                    </div>

                    {/* Direct Individual */}
                    <div className="p-4 rounded-md space-y-2" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        <label className="text-xs font-semibold uppercase tracking-wider block" style={{ color: '#8AAEBB' }}>
                            4. Kênh Mua Trực Tiếp (Khách Vãng Lai)
                        </label>
                        <p className="text-[11px] style={{ color: '#4A6A7A' }}">Bảng giá niêm yết bán lẻ cho khách vãng lai, mua lẻ</p>
                        <select
                            value={mapDirect}
                            onChange={e => setMapDirect(e.target.value)}
                            className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '6px' }}
                        >
                            <option value="WHOLESALE_DISTRIBUTOR">Giá Bán Buôn (Wholesale)</option>
                            <option value="DIRECT_INDIVIDUAL">Giá Bán Lẻ (Retail)</option>
                            <option value="VIP_RETAIL">Giá VIP Retail</option>
                        </select>
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                    <div>
                        {savedSuccess && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#87CBB9] font-medium">
                                <CheckCircle2 size={14} /> Đã lưu cấu hình thành công!
                            </span>
                        )}
                        {!canApprove && (
                            <p className="text-xs text-[#E11D48]">
                                <AlertCircle size={12} className="inline mr-1" />
                                Chỉ có Quản Lý hoặc CEO mới có quyền lưu thay đổi cấu hình này.
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleSaveMapping}
                        disabled={saving || !canApprove}
                        className="px-6 py-2.5 text-xs font-semibold transition-all disabled:opacity-40"
                        style={{ background: '#87CBB9', color: '#0A1926', borderRadius: '6px' }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Cập Nhật Cấu Hình Kênh Giá'}
                    </button>
                </div>
            </div>
        </div>
    )
}
