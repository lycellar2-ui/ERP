'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    MapPin, Camera, Clock, CheckCircle2, AlertCircle, Search, Filter,
    Building2, User, ChevronRight, Eye, RefreshCw, FileText, Navigation, ExternalLink, Calendar, Plus, X, Download
} from 'lucide-react'
import { checkInSalesVisit, checkOutSalesVisit, getSalesVisits, getActiveVisit } from './actions'
import { LiveCameraModal } from './LiveCameraModal'

interface Props {
    initialVisits: any[]
    customers: { id: string; code: string; name: string; channel: string | null }[]
    users?: { id: string; name: string; email: string }[]
    currentUserId: string
    currentUserName: string
    isManager: boolean
}

// ─── Searchable Customer Combobox ───────�function SearchableCustomerCombobox({
    customers,
    selectedCustomerId,
    onSelect
}: {
    customers: { id: string; code: string; name: string; channel: string | null }[]
    selectedCustomerId: string
    onSelect: (customer: any) => void
}) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')

    const selectedCust = customers.find(c => c.id === selectedCustomerId)

    const filtered = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return customers.slice(0, 50)
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
        ).slice(0, 50)
    }, [customers, query])

    return (
        <div className="relative">
            {/* Display Input Button Trigger */}
            <div
                onClick={() => setOpen(true)}
                className="w-full p-3 text-xs outline-none rounded-xl bg-[#142433] border border-[#2A4355] text-white hover:border-[#87CBB9] cursor-pointer flex items-center justify-between transition group"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Search size={14} className="text-[#87CBB9] shrink-0" />
                    {selectedCust ? (
                        <span className="font-semibold text-white truncate">
                            <strong className="text-[#87CBB9] font-mono mr-1.5">[{selectedCust.code}]</strong>
                            {selectedCust.name}
                        </span>
                    ) : (
                        <span className="text-gray-400 font-medium truncate">Gõ mã hoặc tên nhà hàng / khách hàng để chọn...</span>
                    )}
                </div>
                {selectedCust ? (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSelect({ id: '' }); }}
                        className="p-1 text-gray-400 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                ) : (
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-white transition rotate-90 shrink-0" />
                )}
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl shadow-2xl p-2 space-y-2 border border-[#2A4355] bg-[#142433]">
                        <div className="relative">
                            <input
                                type="text"
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Gõ tên hoặc mã khách hàng..."
                                className="w-full pl-8 pr-3 py-2 text-xs outline-none rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:border-[#87CBB9]"
                            />
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-1">
                            {filtered.length === 0 ? (
                                <div className="p-3 text-xs text-center text-gray-500">Không tìm thấy khách hàng khớp "{query}"</div>
                            ) : (
                                filtered.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(c)
                                            setOpen(false)
                                            setQuery('')
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg transition flex items-center justify-between text-xs ${selectedCustomerId === c.id ? 'bg-[#87CBB9]/20 text-[#87CBB9] font-bold' : 'hover:bg-[#1B2E3D] text-gray-200'}`}
                                    >
                                        <div className="min-w-0 flex-1 pr-2">
                                            <span className="font-mono font-bold text-[#87CBB9] mr-2">[{c.code}]</span>
                                            <span className="font-semibold text-white">{c.name}</span>
                                        </div>
                                        {c.channel && (
                                            <span className="text-[10px] text-[#4A6A7A] uppercase bg-[#1B2E3D] px-2 py-0.5 rounded font-mono">
                                                {c.channel}
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}             </div>
                </>
            )}
        </div>
    )
}

export function SalesVisitsClient({ initialVisits, customers, users, currentUserId, currentUserName, isManager }: Props) {
    const [activeTab, setActiveTab] = useState<'CHECKIN' | 'HISTORY'>('CHECKIN')
    const [visits, setVisits] = useState(initialVisits)
    const [selectedSalespersonId, setSelectedSalespersonId] = useState(currentUserId)
    const [activeVisit, setActiveVisit] = useState<any | null>(null)
    const [loadingActive, setLoadingActive] = useState(true)

    // Checkin Form
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [customerSearch, setCustomerSearch] = useState('')
    const [purpose, setPurpose] = useState('Viếng thăm & Chăm sóc định kỳ')
    const [submitting, setSubmitting] = useState(false)

    // Checkout Form
    const [checkoutNotes, setCheckoutNotes] = useState('')

    // Camera Modal
    const [cameraMode, setCameraMode] = useState<'CHECKIN' | 'CHECKOUT' | null>(null)

    // Location State
    const [coords, setCoords] = useState<{ lat?: number; lng?: number; address?: string }>({})
    const [gettingLocation, setGettingLocation] = useState(false)

    // Filters
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10))
    const [filterStatus, setFilterStatus] = useState('ALL')
    const [filterSearch, setFilterSearch] = useState('')

    // Detail drawer photo modal
    const [viewPhoto, setViewPhoto] = useState<{ title: string; url: string } | null>(null)

    const fetchActive = useCallback(async () => {
        setLoadingActive(true)
        const active = await getActiveVisit(selectedSalespersonId)
        setActiveVisit(active)
        setLoadingActive(false)
    }, [selectedSalespersonId])

    const fetchVisitsList = useCallback(async () => {
        const data = await getSalesVisits({ date: filterDate, status: filterStatus })
        setVisits(data)
    }, [filterDate, filterStatus])

    const [gpsError, setGpsError] = useState<string | null>(null)

    // Reverse Geocoding (Convert lat/lng -> Street address)
    const fetchAddressFromCoords = async (lat: number, lng: number): Promise<string | undefined> => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`, {
                headers: { 'User-Agent': 'WineERP/1.0' }
            })
            if (res.ok) {
                const data = await res.json()
                if (data && data.display_name) {
                    return data.display_name
                }
            }
        } catch (e) {
            console.warn('Reverse geocode error:', e)
        }
        return undefined
    }

    // Robust multi-tier GPS capture
    const captureGPSLocation = useCallback((): Promise<{ lat?: number; lng?: number; address?: string }> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                setGpsError('Trình duyệt không hỗ trợ định vị GPS')
                resolve({})
                return
            }

            setGettingLocation(true)
            setGpsError(null)

            const handleSuccess = async (pos: GeolocationPosition) => {
                const lat = pos.coords.latitude
                const lng = pos.coords.longitude
                setCoords({ lat, lng })
                const address = await fetchAddressFromCoords(lat, lng)
                const res = { lat, lng, address }
                setCoords(res)
                setGettingLocation(false)
                setGpsError(null)
                resolve(res)
            }

            // Strategy 1: High Accuracy with 6s timeout
            navigator.geolocation.getCurrentPosition(
                handleSuccess,
                (err1) => {
                    console.warn('GPS High Accuracy failed, falling back to standard:', err1)
                    // Strategy 2: Low Accuracy fallback with 10s timeout
                    navigator.geolocation.getCurrentPosition(
                        handleSuccess,
                        (err2) => {
                            console.warn('GPS Low Accuracy failed:', err2)
                            setGettingLocation(false)
                            let msg = 'Chưa thể lấy vị trí GPS. Vui lòng kiểm tra quyền Vị Trí (Location) trên trình duyệt!'
                            if (err2.code === 1) msg = 'Bạn đã từ chối quyền GPS. Vui lòng bấm "Cho phép vị trí" trên thanh địa chỉ!'
                            else if (err2.code === 2) msg = 'Không thể xác định vị trí thiết bị. Vui lòng bật GPS trên điện thoại!'
                            else if (err2.code === 3) msg = 'Hết thời gian chờ phản hồi GPS. Vui lòng bấm "Lấy Tọa Độ GPS"!'
                            setGpsError(msg)
                            resolve({})
                        },
                        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
                    )
                },
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
            )
        })
    }, [])

    useEffect(() => {
        fetchActive()
    }, [fetchActive])

    useEffect(() => {
        fetchVisitsList()
    }, [fetchVisitsList])

    // Auto-request GPS location on page mount
    useEffect(() => {
        captureGPSLocation()
    }, [captureGPSLocation])

    // Filtered customers for select
    const filteredCustomers = React.useMemo(() => {
        const q = customerSearch.trim().toLowerCase()
        if (!q) return customers.slice(0, 100)
        return customers.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)).slice(0, 100)
    }, [customers, customerSearch])

    // Handle Check-in photo capture confirmation
    const handleConfirmCheckInPhoto = async (photoBase64: string) => {
        setCameraMode(null)
        setSubmitting(true)
        const gps = await captureGPSLocation()

        const res = await checkInSalesVisit({
            customerId: selectedCustomerId,
            salespersonId: selectedSalespersonId,
            purpose,
            lat: gps.lat || coords.lat,
            lng: gps.lng || coords.lng,
            address: gps.address || coords.address,
            photoBase64,
        })

        if (res.success) {
            setSelectedCustomerId('')
            setCustomerSearch('')
            await fetchActive()
            await fetchVisitsList()
        } else {
            alert('Lỗi Check-in: ' + res.error)
        }
        setSubmitting(false)
    }

    // Handle Check-out photo capture confirmation
    const handleConfirmCheckOutPhoto = async (photoBase64: string) => {
        if (!activeVisit) return
        setCameraMode(null)
        setSubmitting(true)
        const gps = await captureGPSLocation()

        const res = await checkOutSalesVisit({
            visitId: activeVisit.id,
            salespersonId: selectedSalespersonId,
            notes: checkoutNotes,
            lat: gps.lat || coords.lat,
            lng: gps.lng || coords.lng,
            address: gps.address || coords.address,
            photoBase64,
        })

        if (res.success) {
            setCheckoutNotes('')
            await fetchActive()
            await fetchVisitsList()
        } else {
            alert('Lỗi Check-out: ' + res.error)
        }
        setSubmitting(false)
    }

    // Live timer for active visit
    const [elapsedMinutes, setElapsedMinutes] = useState(0)

    useEffect(() => {
        if (!activeVisit) return
        const checkInDate = new Date(activeVisit.checkInTime).getTime()
        const updateTimer = () => {
            const now = new Date().getTime()
            const diff = Math.max(1, Math.round((now - checkInDate) / (1000 * 60)))
            setElapsedMinutes(diff)
        }
        updateTimer()
        const interval = setInterval(updateTimer, 30_000)
        return () => clearInterval(interval)
    }, [activeVisit])

    // Filtered visits list for history view
    const filteredVisits = visits.filter(v => {
        if (!filterSearch) return true
        const q = filterSearch.toLowerCase()
        return v.customerName.toLowerCase().includes(q) ||
            v.customerCode.toLowerCase().includes(q) ||
            v.salespersonName.toLowerCase().includes(q) ||
            v.visitNo.toLowerCase().includes(q)
    })

    return (
        <div className="space-y-6 max-w-screen-xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#E8F1F2] flex items-center gap-2">
                        <MapPin className="text-[#87CBB9]" size={24} />
                        Check-in Đi Thị Trường (Sales Visit)
                    </h2>
                    <p className="text-sm text-[#4A6A7A] mt-0.5">
                        Ghi nhận thời gian viếng thăm, tọa độ GPS & ảnh chụp trực tiếp từ camera tại điểm bán
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-[#142433] p-1 rounded-xl border border-[#2A4355]">
                    <button
                        onClick={() => setActiveTab('CHECKIN')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${activeTab === 'CHECKIN' ? 'bg-[#87CBB9] text-[#0A1926] shadow-sm' : 'text-[#8AAEBB] hover:text-white'}`}
                    >
                        📸 Check-in Điểm Bán
                    </button>
                    <button
                        onClick={() => setActiveTab('HISTORY')}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] ${activeTab === 'HISTORY' ? 'bg-[#87CBB9] text-[#0A1926] shadow-sm' : 'text-[#8AAEBB] hover:text-white'}`}
                    >
                        📋 Lịch Sử Viếng Thăm ({visits.length})
                    </button>
                </div>
            </div>

            {/* TAB 1: CHECKIN / CHECKOUT FOR SALES */}
            {activeTab === 'CHECKIN' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Active Status & Main Action Panel */}
                    <div className="lg:col-span-7 space-y-6">
                        {loadingActive ? (
                            <div className="p-8 rounded-2xl bg-[#1B2E3D] border border-[#2A4355] text-center text-xs text-[#4A6A7A]">
                                <RefreshCw className="animate-spin mx-auto mb-2 text-[#87CBB9]" size={24} />
                                Đang tải trạng thái viếng thăm...
                            </div>
                        ) : activeVisit ? (
                            /* IN-PROGRESS ACTIVE VISIT CARD */
                            <div className="p-6 rounded-2xl space-y-5 bg-[#1B2E3D] border-2 border-[#87CBB9] shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-[#87CBB9] text-[#0A1926] px-4 py-1 text-[11px] font-bold rounded-bl-xl uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                                    Đang Ở Tại Điểm Bán
                                </div>

                                <div>
                                    <span className="text-xs font-mono text-[#87CBB9] font-semibold">{activeVisit.visitNo}</span>
                                    <h3 className="text-xl font-bold text-white mt-1">
                                        {activeVisit.customer?.name}
                                    </h3>
                                    <p className="text-xs text-[#8AAEBB] font-mono mt-0.5">
                                        Mã KH: {activeVisit.customer?.code} • Kênh: {activeVisit.customer?.channel || 'HORECA'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-[#142433] p-4 rounded-xl border border-[#2A4355]">
                                    <div>
                                        <span className="text-[10px] text-[#4A6A7A] uppercase font-semibold block">Thời Gian Check-in</span>
                                        <span className="text-sm font-bold text-[#E8F1F2]">
                                            {new Date(activeVisit.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-[#4A6A7A] uppercase font-semibold block">Thời Gian Lưu Lại</span>
                                        <span className="text-sm font-bold text-[#D4A853] flex items-center gap-1">
                                            <Clock size={14} /> {elapsedMinutes} Phút
                                        </span>
                                    </div>
                                </div>

                                {/* Checkin Photo Thumbnail */}
                                {activeVisit.checkInPhoto && (
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-[#4A6A7A] uppercase font-semibold block">Ảnh Chụp Thực Tế Check-in</span>
                                        <div className="flex items-center gap-3 bg-[#142433] p-2 rounded-xl border border-[#2A4355]">
                                            <img
                                                src={activeVisit.checkInPhoto}
                                                alt="Checkin Photo"
                                                className="w-16 h-16 object-cover rounded-lg border border-[#2A4355] cursor-pointer"
                                                onClick={() => setViewPhoto({ title: `Ảnh Check-in: ${activeVisit.customer?.name}`, url: activeVisit.checkInPhoto })}
                                            />
                                            <div className="text-xs text-[#8AAEBB]">
                                                <p className="font-semibold text-white">Xác nhận camera thành công</p>
                                                <p className="text-[10px] text-[#4A6A7A] mt-0.5">Bắt buộc chụp tại chỗ</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Notes Input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-[#8AAEBB] uppercase tracking-wider block">
                                        Ghi Chú Kết Quả Buổi Làm Việc *
                                    </label>
                                    <textarea
                                        value={checkoutNotes}
                                        onChange={e => setCheckoutNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Nhập ghi chú kết quả (VD: Khách lấy 2 thùng Amarone, đề xuất giảm 5%, hẹn quay lại vào tuần sau...)"
                                        className="w-full p-3 text-xs outline-none rounded-xl bg-[#142433] border border-[#2A4355] text-white focus:border-[#87CBB9] transition"
                                    />
                                </div>

                                {/* Checkout Button */}
                                <button
                                    onClick={() => setCameraMode('CHECKOUT')}
                                    disabled={submitting}
                                    className="w-full py-3.5 rounded-xl text-xs font-bold text-[#0A1926] bg-[#87CBB9] hover:bg-[#A5DED0] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Camera size={16} /> 📸 Bật Camera Chụp Ảnh & Check-out Kết Thúc
                                </button>
                            </div>
                        ) : (
                            /* NEW CHECK-IN FORM */
                            <div className="p-6 rounded-2xl space-y-5 bg-[#1B2E3D] border border-[#2A4355]">
                                <div className="flex items-center gap-2 border-b border-[#2A4355] pb-3">
                                    <Building2 className="text-[#87CBB9]" size={20} />
                                    <h3 className="text-base font-bold text-white">Tạo Lượt Check-in Viếng Thăm Mới</h3>
                                </div>

                                {/* Salesperson Picker (For Admin / Manager) */}
                                {users && users.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[#8AAEBB] uppercase tracking-wider block">
                                            1. Nhân Viên Kinh Doanh Thực Hiện *
                                        </label>
                                        <select
                                            value={selectedSalespersonId}
                                            onChange={e => setSelectedSalespersonId(e.target.value)}
                                            className="w-full p-3 text-xs outline-none cursor-pointer rounded-xl bg-[#142433] border border-[#2A4355] text-[#87CBB9] font-bold hover:border-[#87CBB9] transition"
                                        >
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>
                                                    👤 {u.name} ({u.email}) {u.id === currentUserId ? ' - (Tài khoản hiện tại)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Customer Combobox Picker */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-[#8AAEBB] uppercase tracking-wider block">
                                        2. Chọn Khách Hàng Viếng Thăm *
                                    </label>

                                    <SearchableCustomerCombobox
                                        customers={customers}
                                        selectedCustomerId={selectedCustomerId}
                                        onSelect={c => setSelectedCustomerId(c.id)}
                                    />
                                </div>

                                {/* Purpose Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-[#8AAEBB] uppercase tracking-wider block">
                                        3. Mục Đích Viếng Thăm
                                    </label>
                                    <select
                                        value={purpose}
                                        onChange={e => setPurpose(e.target.value)}
                                        className="w-full p-3 text-xs outline-none cursor-pointer rounded-xl bg-[#142433] border border-[#2A4355] text-white font-medium hover:border-[#87CBB9] transition"
                                    >
                                        <option value="Viếng thăm & Chăm sóc định kỳ">Viếng thăm & Chăm sóc định kỳ</option>
                                        <option value="Thử mẫu rượu (Wine Tasting)">Thử mẫu rượu (Wine Tasting)</option>
                                        <option value="Đề xuất cơ chế giá đặc biệt">Đề xuất cơ chế giá đặc biệt</option>
                                        <option value="Thu hồi công nợ / Hóa đơn">Thu hồi công nợ / Hóa đơn</option>
                                        <option value="Giao hợp đồng & Hồ sơ TCB">Giao hợp đồng & Hồ sơ TCB</option>
                                    </select>
                                </div>

                                {/* GPS Location Status Card */}
                                <div className="p-3.5 rounded-xl bg-[#142433] border border-[#2A4355] flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <MapPin size={18} className={coords.lat && coords.lng ? 'text-[#87CBB9] shrink-0' : 'text-[#D4A853] shrink-0'} />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[10px] text-[#4A6A7A] uppercase font-semibold block">Trạng Thái Định Vị & Địa Chỉ GPS</span>
                                            {gettingLocation ? (
                                                <span className="text-[#87CBB9] animate-pulse flex items-center gap-1 text-xs">
                                                    <RefreshCw size={12} className="animate-spin inline" /> Đang quét tọa độ & tra địa chỉ...
                                                </span>
                                            ) : coords.lat && coords.lng ? (
                                                <div>
                                                    <span className="font-mono font-bold text-[#87CBB9] text-xs block">
                                                        {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} ✅
                                                    </span>
                                                    {coords.address && (
                                                        <span className="text-[11px] text-[#E8F1F2] block font-medium mt-0.5 truncate max-w-sm" title={coords.address}>
                                                            🏠 {coords.address}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-red-400 text-[11px] block font-medium">
                                                    {gpsError || 'Chưa định vị được GPS. Hãy bấm nút thử lại!'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => captureGPSLocation()}
                                        disabled={gettingLocation}
                                        className="px-2.5 py-1.5 rounded-lg bg-[#1B2E3D] hover:bg-[#2A4355] text-xs font-semibold text-[#87CBB9] border border-[#2A4355] whitespace-nowrap flex items-center gap-1 shrink-0"
                                    >
                                        <RefreshCw size={12} className={gettingLocation ? 'animate-spin' : ''} /> {coords.lat ? 'Cập Nhật GPS' : '📍 Lấy GPS'}
                                    </button>
                                </div>

                                {/* Rules Notice */}
                                <div className="p-3 rounded-xl bg-[#142433] border border-[#2A4355] text-xs text-[#8AAEBB] space-y-1">
                                    <p className="font-semibold text-[#87CBB9] flex items-center gap-1">
                                        <AlertCircle size={14} /> Bắt buộc khi Check-in:
                                    </p>
                                    <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-gray-300">
                                        <li>Cấp quyền định vị GPS thời gian thực.</li>
                                        <li>Bắt buộc bật ống kính Camera chụp ảnh thực tế điểm bán.</li>
                                    </ul>
                                </div>

                                {/* Checkin Trigger Button */}
                                <button
                                    onClick={() => {
                                        if (!selectedCustomerId) {
                                            alert('Vui lòng chọn Khách Hàng viếng thăm trước khi Check-in!')
                                            return
                                        }
                                        setCameraMode('CHECKIN')
                                    }}
                                    disabled={submitting || !selectedCustomerId}
                                    className="w-full py-3.5 rounded-xl text-xs font-bold text-[#0A1926] bg-[#87CBB9] hover:bg-[#A5DED0] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                                >
                                    <Camera size={16} /> 📸 Bật Camera Chụp Ảnh & Check-in Viếng Thăm
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Info & Quick History Column */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="p-5 rounded-2xl bg-[#1B2E3D] border border-[#2A4355] space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#87CBB9]">Quy Định Check-in Thị Trường</h4>
                            <p className="text-xs text-[#8AAEBB] leading-relaxed">
                                Hệ thống ERP bắt buộc chụp ảnh camera trực tiếp tại chỗ để bảo đảm tính chính xác của hoạt động thị trường.
                            </p>
                        </div>

                        {/* Recent Visit Logs */}
                        <div className="p-5 rounded-2xl bg-[#1B2E3D] border border-[#2A4355] space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Lượt Viếng Thăm Mới Nhất</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                {visits.slice(0, 5).map(v => (
                                    <div key={v.id} className="p-3 rounded-xl bg-[#142433] border border-[#2A4355] space-y-1 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-white">{v.customerName}</span>
                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${v.status === 'COMPLETED' ? 'bg-[#87CBB9]/20 text-[#87CBB9]' : 'bg-[#D4A853]/20 text-[#D4A853]'}`}>
                                                {v.status === 'COMPLETED' ? `${v.durationMinutes} phút` : 'Đang ở tại chỗ'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[#4A6A7A]">{v.salespersonName} • {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: VISIT HISTORY & AUDIT LOG FOR MANAGERS */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-4">
                    {/* Filters bar */}
                    <div className="p-4 rounded-2xl bg-[#1B2E3D] border border-[#2A4355] flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={filterSearch}
                                    onChange={e => setFilterSearch(e.target.value)}
                                    placeholder="Tìm khách hàng hoặc Salesman..."
                                    className="w-full pl-9 pr-3 py-2 text-xs outline-none rounded-xl bg-[#142433] border border-[#2A4355] text-white"
                                />
                            </div>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                                className="px-3 py-2 text-xs outline-none cursor-pointer rounded-xl bg-[#142433] border border-[#2A4355] text-white"
                            />
                            <select
                                value={filterStatus}
                                onChange={e => setFilterStatus(e.target.value)}
                                className="px-3 py-2 text-xs outline-none cursor-pointer rounded-xl bg-[#142433] border border-[#2A4355] text-white"
                            >
                                <option value="ALL">Tất cả Trạng Thái</option>
                                <option value="IN_PROGRESS">Đang Viếng Thăm</option>
                                <option value="COMPLETED">Đã Kết Thúc</option>
                            </select>
                        </div>
                    </div>

                    {/* Mobile View: Card List (sm:hidden) */}
                    <div className="block md:hidden space-y-3">
                        {filteredVisits.length === 0 ? (
                            <div className="p-8 text-center text-xs text-gray-500 bg-[#1B2E3D] rounded-2xl border border-[#2A4355]">
                                Chưa có lượt viếng thăm nào khớp bộ lọc.
                            </div>
                        ) : filteredVisits.map(v => (
                            <div key={v.id} className="p-4 rounded-2xl bg-[#1B2E3D] border border-[#2A4355] space-y-3 shadow-md">
                                <div className="flex items-start justify-between gap-2 border-b border-[#2A4355] pb-2.5">
                                    <div>
                                        <span className="font-mono text-[11px] font-bold text-[#87CBB9] block">{v.visitNo}</span>
                                        <h4 className="text-sm font-bold text-white mt-0.5">{v.customerName}</h4>
                                        <p className="text-[10px] text-[#4A6A7A]">KH: {v.customerCode} • Sales: <strong className="text-gray-300">{v.salespersonName}</strong></p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full whitespace-nowrap ${v.status === 'COMPLETED' ? 'bg-[#87CBB9]/20 text-[#87CBB9] border border-[#87CBB9]/40' : 'bg-[#D4A853]/20 text-[#D4A853] border border-[#D4A853]/40'}`}>
                                        {v.status === 'COMPLETED' ? 'Hoàn Thành' : 'Đang Tại Chỗ'}
                                    </span>
                                </div>

                                {/* 3 Time Badges */}
                                <div className="grid grid-cols-3 gap-2 bg-[#142433] p-2.5 rounded-xl border border-[#2A4355] text-center">
                                    <div>
                                        <span className="text-[9px] text-[#4A6A7A] uppercase font-bold block">🟢 Giờ Đến</span>
                                        <span className="text-xs font-bold text-[#87CBB9]">
                                            {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-[#4A6A7A] uppercase font-bold block">🔴 Giờ Đi</span>
                                        <span className="text-xs font-bold text-[#E8F1F2]">
                                            {v.checkOutTime ? new Date(v.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] text-[#4A6A7A] uppercase font-bold block">⏱️ Ở Lại</span>
                                        <span className="text-xs font-bold text-[#D4A853]">
                                            {v.status === 'COMPLETED' ? `${v.durationMinutes} phút` : 'Đang ở'}
                                        </span>
                                    </div>
                                </div>

                                {/* Photos */}
                                <div className="flex items-center gap-3 bg-[#142433] p-2 rounded-xl border border-[#2A4355]">
                                    <div className="flex-1 text-center">
                                        <span className="text-[9px] text-[#4A6A7A] block mb-1">Ảnh Check-in</span>
                                        {v.checkInPhoto ? (
                                            <img
                                                src={v.checkInPhoto}
                                                alt="Checkin"
                                                className="w-14 h-14 object-cover rounded-lg mx-auto border border-[#2A4355]"
                                                onClick={() => setViewPhoto({ title: `Check-in: ${v.customerName}`, url: v.checkInPhoto })}
                                            />
                                        ) : <span className="text-gray-500 text-[10px]">Chưa chụp</span>}
                                    </div>
                                    <div className="w-[1px] h-10 bg-[#2A4355]" />
                                    <div className="flex-1 text-center">
                                        <span className="text-[9px] text-[#4A6A7A] block mb-1">Ảnh Check-out</span>
                                        {v.checkOutPhoto ? (
                                            <img
                                                src={v.checkOutPhoto}
                                                alt="Checkout"
                                                className="w-14 h-14 object-cover rounded-lg mx-auto border border-[#2A4355]"
                                                onClick={() => setViewPhoto({ title: `Check-out: ${v.customerName}`, url: v.checkOutPhoto })}
                                            />
                                        ) : <span className="text-gray-500 text-[10px]">Chưa Check-out</span>}
                                    </div>
                                </div>

                                {/* Address & GPS */}
                                {v.checkInLat && v.checkInLng && (
                                    <div className="text-xs space-y-0.5 pt-1">
                                        <a
                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-[#87CBB9] font-mono text-[11px] font-semibold"
                                        >
                                            <Navigation size={12} /> Google Maps ({v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)})
                                        </a>
                                        {v.checkInAddress && (
                                            <p className="text-[10px] text-gray-300">🏠 {v.checkInAddress}</p>
                                        )}
                                    </div>
                                )}

                                {v.notes && (
                                    <p className="text-xs text-gray-300 bg-[#142433] p-2 rounded-lg border border-[#2A4355]/50">
                                        💬 {v.notes}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop View: 9-Column Table (hidden md:block) */}
                    <div className="hidden md:block rounded-2xl overflow-hidden border border-[#2A4355] bg-[#1B2E3D]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                                <thead>
                                    <tr className="bg-[#142433] text-[#4A6A7A]">
                                        <th className="p-3.5 font-semibold">Mã Viếng Thăm</th>
                                        <th className="p-3.5 font-semibold">Khách Hàng & Salesman</th>
                                        <th className="p-3.5 font-semibold text-center">Ảnh Check-in</th>
                                        <th className="p-3.5 font-semibold text-center">Ảnh Check-out</th>
                                        <th className="p-3.5 font-semibold text-center">🟢 Giờ Đến</th>
                                        <th className="p-3.5 font-semibold text-center">🔴 Giờ Đi</th>
                                        <th className="p-3.5 font-semibold text-center">⏱️ Tổng Thời Gian</th>
                                        <th className="p-3.5 font-semibold">Định Vị GPS & Địa Chỉ</th>
                                        <th className="p-3.5 font-semibold">Ghi Chú Kết Quả</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVisits.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-12 text-gray-500">
                                                Chưa có lượt viếng thăm nào khớp bộ lọc.
                                            </td>
                                        </tr>
                                    ) : filteredVisits.map(v => (
                                        <tr key={v.id} className="border-t border-[#2A4355] hover:bg-[#1f3445] transition">
                                            <td className="p-3.5 font-mono font-bold text-[#87CBB9]">{v.visitNo}</td>
                                            <td className="p-3.5">
                                                <div className="font-semibold text-white">{v.customerName}</div>
                                                <div className="text-[10px] text-[#4A6A7A] font-mono">KH: {v.customerCode} • Sales: {v.salespersonName}</div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {v.checkInPhoto ? (
                                                    <img
                                                        src={v.checkInPhoto}
                                                        alt="Checkin"
                                                        className="w-12 h-12 object-cover rounded-lg border border-[#2A4355] cursor-pointer mx-auto"
                                                        onClick={() => setViewPhoto({ title: `Check-in: ${v.customerName}`, url: v.checkInPhoto })}
                                                    />
                                                ) : <span className="text-gray-500">N/A</span>}
                                            </td>
                                            <td className="p-3.5 text-center">
                                                {v.checkOutPhoto ? (
                                                    <img
                                                        src={v.checkOutPhoto}
                                                        alt="Checkout"
                                                        className="w-12 h-12 object-cover rounded-lg border border-[#2A4355] cursor-pointer mx-auto"
                                                        onClick={() => setViewPhoto({ title: `Check-out: ${v.customerName}`, url: v.checkOutPhoto })}
                                                    />
                                                ) : <span className="text-gray-500">—</span>}
                                            </td>
                                            
                                            {/* 🟢 Giờ Đến */}
                                            <td className="p-3.5 text-center font-bold text-[#87CBB9] whitespace-nowrap">
                                                {new Date(v.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            </td>

                                            {/* 🔴 Giờ Đi */}
                                            <td className="p-3.5 text-center font-bold text-[#E8F1F2] whitespace-nowrap">
                                                {v.checkOutTime ? new Date(v.checkOutTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-500">—</span>}
                                            </td>

                                            {/* ⏱️ Tổng Thời Gian */}
                                            <td className="p-3.5 text-center whitespace-nowrap">
                                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${v.status === 'COMPLETED' ? 'bg-[#D4A853]/20 text-[#D4A853]' : 'bg-[#87CBB9]/20 text-[#87CBB9]'}`}>
                                                    {v.status === 'COMPLETED' ? `${v.durationMinutes} phút` : 'Đang ở tại chỗ'}
                                                </span>
                                            </td>

                                            <td className="p-3.5 max-w-xs">
                                                {v.checkInLat && v.checkInLng ? (
                                                    <div className="space-y-1">
                                                        <a
                                                            href={`https://www.google.com/maps?q=${v.checkInLat},${v.checkInLng}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 text-[#87CBB9] hover:underline font-mono text-[11px]"
                                                        >
                                                            <Navigation size={12} /> Google Maps ({v.checkInLat.toFixed(4)}, {v.checkInLng.toFixed(4)})
                                                        </a>
                                                        {v.checkInAddress && (
                                                            <p className="text-[10px] text-gray-300 truncate" title={v.checkInAddress}>
                                                                🏠 {v.checkInAddress}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : <span className="text-gray-500">Không có GPS</span>}
                                            </td>
                                            <td className="p-3.5 max-w-xs truncate text-gray-300 text-xs" title={v.notes}>
                                                {v.notes || 'Chưa có ghi chú'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Camera Modal */}
            {cameraMode && (
                <LiveCameraModal
                    title={cameraMode === 'CHECKIN' ? 'Check-in Viếng Thăm Điểm Bán' : 'Check-out Kết Thúc Viếng Thăm'}
                    subtitle={cameraMode === 'CHECKIN' ? 'Chụp ảnh thực tế mặt tiền hoặc bảng hiệu nhà hàng' : 'Chụp ảnh thực tế xác nhận kết thúc công việc'}
                    onCapture={photo => {
                        if (cameraMode === 'CHECKIN') handleConfirmCheckInPhoto(photo)
                        else handleConfirmCheckOutPhoto(photo)
                    }}
                    onClose={() => setCameraMode(null)}
                />
            )}

            {/* Photo Zoom & Download Modal */}
            {viewPhoto && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur" onClick={() => setViewPhoto(null)}>
                    <div className="w-full max-w-3xl max-h-[92vh] bg-[#142433] p-5 rounded-2xl border border-[#2A4355] space-y-4 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#2A4355] pb-3">
                            <div>
                                <h4 className="text-base font-bold text-white flex items-center gap-2">
                                    <Camera size={18} className="text-[#87CBB9]" />
                                    {viewPhoto.title}
                                </h4>
                                <p className="text-[11px] text-[#4A6A7A] mt-0.5">Ảnh chụp camera thực tế tại điểm bán</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <a
                                    href={viewPhoto.url}
                                    download={`Checkin_Photo_${Date.now()}.jpg`}
                                    className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-[#87CBB9] text-[#0A1926] hover:bg-[#A5DED0] flex items-center gap-1.5 transition shadow"
                                    title="Tải ảnh gốc về máy"
                                >
                                    <Download size={14} /> Tải Ảnh Về Máy
                                </a>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const win = window.open('')
                                        if (win) {
                                            win.document.write(`<title>${viewPhoto.title}</title><img src="${viewPhoto.url}" style="max-width:100%;height:auto;"/>`)
                                        }
                                    }}
                                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#1B2E3D] text-[#8AAEBB] hover:bg-[#2A4355] border border-[#2A4355] flex items-center gap-1.5 transition"
                                    title="Mở ảnh trong cửa sổ trình duyệt mới"
                                >
                                    <ExternalLink size={14} /> Mở Thẻ Mới
                                </button>

                                <button onClick={() => setViewPhoto(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-[#1B2E3D] hover:text-white transition">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex items-center justify-center bg-black/60 rounded-xl p-2 border border-[#2A4355]">
                            <img src={viewPhoto.url} alt="Enlarged" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
