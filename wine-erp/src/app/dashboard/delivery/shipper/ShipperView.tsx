'use client'

import { useState, useCallback, useRef } from 'react'
import {
    Truck, MapPin, CheckCircle2, Navigation, Camera, X, Loader2,
    Package, ChevronRight, ArrowLeft, Clock
} from 'lucide-react'
import {
    ShipperManifest, ShipperManifestStop,
    getShipperManifest, recordEPOD, uploadPODPhoto, updateRouteStatus
} from '../actions'
import { SignaturePad } from '@/components/SignaturePad'
import { formatVND } from '@/lib/utils'

const STOP_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    PENDING: { label: 'Chờ Giao', color: '#D4A853', bg: 'rgba(212,168,83,0.15)', icon: '⏳' },
    DELIVERED: { label: 'Đã Giao', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)', icon: '✅' },
    FAILED: { label: 'Thất Bại', color: '#E05252', bg: 'rgba(224,82,82,0.15)', icon: '❌' },
}

// ── Mobile Shipper View ──────────────────────────
export function ShipperView({ drivers }: { drivers: { id: string; name: string; phone: string }[] }) {
    const [selectedDriverId, setSelectedDriverId] = useState('')
    const [manifest, setManifest] = useState<ShipperManifest | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeStop, setActiveStop] = useState<ShipperManifestStop | null>(null)

    const loadManifest = useCallback(async (driverId: string) => {
        if (!driverId) return
        setLoading(true)
        const data = await getShipperManifest(driverId)
        setManifest(data)
        setLoading(false)
    }, [])

    const handleDriverSelect = (driverId: string) => {
        setSelectedDriverId(driverId)
        loadManifest(driverId)
    }

    const handleStartRoute = async () => {
        if (!manifest) return
        await updateRouteStatus(manifest.routeId, 'IN_PROGRESS')
        loadManifest(selectedDriverId)
    }

    // If no driver selected → Driver Select screen
    if (!selectedDriverId) {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: '#0A1926' }}>
                <div className="px-4 pt-6 pb-4 text-center" style={{ background: 'linear-gradient(180deg, #142433 0%, #0A1926 100%)' }}>
                    <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
                        style={{ background: 'rgba(135,203,185,0.15)' }}>
                        <Truck size={28} style={{ color: '#87CBB9' }} />
                    </div>
                    <h1 className="text-xl font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                        Giao Hàng
                    </h1>
                    <p className="text-sm mt-1" style={{ color: '#4A6A7A' }}>Chọn tài xế để xem lộ trình hôm nay</p>
                </div>

                <div className="flex-1 px-4 py-4 space-y-3">
                    {drivers.length === 0 ? (
                        <div className="text-center py-10">
                            <Truck size={40} className="mx-auto mb-3" style={{ color: '#2A4355' }} />
                            <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tài xế nào</p>
                        </div>
                    ) : drivers.map(d => (
                        <button key={d.id} onClick={() => handleDriverSelect(d.id)}
                            className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                                style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9' }}>
                                {d.name.charAt(0)}
                            </div>
                            <div className="flex-1 text-left">
                                <p className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>{d.name}</p>
                                <p className="text-xs" style={{ color: '#4A6A7A' }}>{d.phone}</p>
                            </div>
                            <ChevronRight size={18} style={{ color: '#4A6A7A' }} />
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1926' }}>
                <div className="text-center">
                    <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#87CBB9' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải lộ trình...</p>
                </div>
            </div>
        )
    }

    // If active confirmation → show ConfirmDeliveryScreen
    if (activeStop) {
        return (
            <ConfirmDeliveryScreen
                stop={activeStop}
                onBack={() => setActiveStop(null)}
                onConfirmed={() => {
                    setActiveStop(null)
                    loadManifest(selectedDriverId)
                }}
            />
        )
    }

    // No manifest for today
    if (!manifest) {
        return (
            <div className="min-h-screen flex flex-col" style={{ background: '#0A1926' }}>
                <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid #2A4355' }}>
                    <button onClick={() => setSelectedDriverId('')} className="p-2 rounded-lg"
                        style={{ background: '#1B2E3D' }}>
                        <ArrowLeft size={18} style={{ color: '#8AAEBB' }} />
                    </button>
                    <h2 className="font-semibold" style={{ color: '#E8F1F2' }}>Lộ Trình Hôm Nay</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center px-8">
                        <Clock size={48} className="mx-auto mb-4" style={{ color: '#2A4355' }} />
                        <p className="text-lg font-semibold mb-1" style={{ color: '#E8F1F2' }}>Không có lộ trình</p>
                        <p className="text-sm" style={{ color: '#4A6A7A' }}>
                            Tài xế chưa được phân công giao hàng hôm nay.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Manifest view — mobile first
    const pct = manifest.totalStops > 0
        ? Math.round((manifest.deliveredStops / manifest.totalStops) * 100)
        : 0

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#0A1926' }}>
            {/* Header */}
            <div className="px-4 pt-4 pb-3" style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3 mb-3">
                    <button onClick={() => setSelectedDriverId('')} className="p-2 rounded-lg"
                        style={{ background: '#1B2E3D' }}>
                        <ArrowLeft size={18} style={{ color: '#8AAEBB' }} />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>
                            {manifest.driverName}
                        </h2>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>
                            {manifest.vehiclePlate} • {new Date(manifest.routeDate).toLocaleDateString('vi-VN')}
                        </p>
                    </div>
                    {manifest.status === 'PLANNED' && (
                        <button onClick={handleStartRoute}
                            className="px-3 py-2 rounded-lg text-xs font-bold"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            Bắt Đầu
                        </button>
                    )}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#0D1E2B' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: pct === 100 ? '#5BA88A' : '#87CBB9' }} />
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap" style={{ color: '#87CBB9' }}>
                        {manifest.deliveredStops}/{manifest.totalStops}
                    </span>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="p-2 rounded-lg text-center" style={{ background: '#0D1E2B' }}>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Tổng Điểm</p>
                        <p className="text-lg font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                            {manifest.totalStops}
                        </p>
                    </div>
                    <div className="p-2 rounded-lg text-center" style={{ background: '#0D1E2B' }}>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Đã Giao</p>
                        <p className="text-lg font-bold" style={{ color: '#5BA88A', fontFamily: '"DM Mono"' }}>
                            {manifest.deliveredStops}
                        </p>
                    </div>
                    <div className="p-2 rounded-lg text-center" style={{ background: '#0D1E2B' }}>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>COD</p>
                        <p className="text-sm font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                            {formatVND(manifest.totalCod)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stops list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {manifest.stops.map(stop => {
                    const cfg = STOP_STATUS[stop.status] ?? STOP_STATUS.PENDING
                    const isDelivered = stop.status === 'DELIVERED'

                    return (
                        <div key={stop.id} className="rounded-xl overflow-hidden"
                            style={{ background: '#1B2E3D', border: `1px solid ${isDelivered ? 'rgba(91,168,138,0.3)' : '#2A4355'}` }}>
                            {/* Stop header */}
                            <div className="flex items-start gap-3 p-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                                    style={{ background: cfg.bg, color: cfg.color }}>
                                    {stop.sequence}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-sm truncate" style={{ color: '#E8F1F2' }}>
                                            {stop.customerName}
                                        </p>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                                            style={{ color: cfg.color, background: cfg.bg }}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#4A6A7A' }}>
                                        <MapPin size={10} className="inline mr-1" />{stop.address}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px]" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                            {stop.soNo}
                                        </span>
                                        <span className="text-[10px]" style={{ color: '#4A6A7A' }}>
                                            {stop.itemCount} SP
                                        </span>
                                        {stop.codAmount > 0 && (
                                            <span className="text-[10px] font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                                                COD: {formatVND(stop.codAmount)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            {!isDelivered && stop.status !== 'FAILED' && (
                                <div className="flex gap-2 px-4 pb-3">
                                    <a href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
                                        target="_blank" rel="noopener"
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-1 justify-center"
                                        style={{ background: 'rgba(138,174,187,0.12)', color: '#8AAEBB', border: '1px solid rgba(138,174,187,0.2)' }}>
                                        <Navigation size={12} /> Bản Đồ
                                    </a>
                                    <button onClick={() => setActiveStop(stop)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold flex-1 justify-center"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                                        <CheckCircle2 size={12} /> Giao
                                    </button>
                                </div>
                            )}

                            {/* Delivered info */}
                            {isDelivered && (
                                <div className="px-4 pb-3">
                                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(91,168,138,0.06)' }}>
                                        <CheckCircle2 size={12} style={{ color: '#5BA88A' }} />
                                        <span className="text-[11px]" style={{ color: '#5BA88A' }}>
                                            ✅ {stop.podSignedAt && new Date(stop.podSignedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                            {stop.notes && ` — ${stop.notes}`}
                                        </span>
                                    </div>
                                    {/* Show signature + photo */}
                                    {(stop.signatureUrl || stop.photoUrl) && (
                                        <div className="flex gap-2 mt-2">
                                            {stop.photoUrl && (
                                                <img src={stop.photoUrl} alt="POD" className="w-16 h-16 rounded object-cover"
                                                    style={{ border: '1px solid #2A4355' }} />
                                            )}
                                            {stop.signatureUrl && (
                                                <img src={stop.signatureUrl} alt="Ký" className="w-20 h-16 rounded object-contain"
                                                    style={{ border: '1px solid #2A4355', background: '#0D1E2B' }} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Confirm Delivery Screen (Full-screen mobile) ──────
function ConfirmDeliveryScreen({ stop, onBack, onConfirmed }: {
    stop: ShipperManifestStop
    onBack: () => void
    onConfirmed: () => void
}) {
    const [name, setName] = useState('')
    const [notes, setNotes] = useState('')
    const [signatureUrl, setSignatureUrl] = useState('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '10px' }

    const handleSave = async () => {
        if (!name.trim() || !signatureUrl) return
        setSaving(true)

        let photoUrl: string | undefined
        if (photoFile) {
            const formData = new FormData()
            formData.set('file', photoFile)
            const upload = await uploadPODPhoto(stop.id, formData)
            if (upload.success) photoUrl = upload.photoUrl
        }

        await recordEPOD({
            stopId: stop.id,
            confirmedBy: name.trim(),
            notes: notes.trim() || undefined,
            signatureUrl,
            photoUrl,
        })

        setSaving(false)
        onConfirmed()
    }

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#0A1926' }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-4" style={{ borderBottom: '1px solid #2A4355', background: '#142433' }}>
                <button onClick={onBack} className="p-2 rounded-lg" style={{ background: '#1B2E3D' }}>
                    <ArrowLeft size={18} style={{ color: '#8AAEBB' }} />
                </button>
                <div>
                    <h2 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>Xác Nhận Giao Hàng</h2>
                    <p className="text-xs" style={{ color: '#4A6A7A' }}>
                        #{stop.sequence} — {stop.customerName}
                    </p>
                </div>
            </div>

            {/* Stop info card */}
            <div className="mx-4 mt-4 p-4 rounded-xl" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#E8F1F2' }}>{stop.customerName}</p>
                <p className="text-xs mb-2" style={{ color: '#4A6A7A' }}>
                    <MapPin size={10} className="inline mr-1" />{stop.address}
                </p>
                <div className="flex gap-4">
                    <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>{stop.soNo}</span>
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>{stop.itemCount} sản phẩm</span>
                    {stop.codAmount > 0 && (
                        <span className="text-xs font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono"' }}>
                            COD: {formatVND(stop.codAmount)}
                        </span>
                    )}
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {/* Receiver name */}
                <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A6A7A' }}>
                        Người Nhận <span style={{ color: '#E05252' }}>*</span>
                    </label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                        placeholder="Tên người nhận hàng"
                        className="w-full px-4 py-3 text-sm outline-none"
                        style={inputStyle} />
                </div>

                {/* Notes */}
                <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A6A7A' }}>
                        Ghi Chú
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                        placeholder="VD: Giao tại quầy bar"
                        rows={2}
                        className="w-full px-4 py-3 text-sm outline-none resize-none"
                        style={inputStyle} />
                </div>

                {/* Signature */}
                <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A6A7A' }}>
                        Chữ Ký Khách Hàng <span style={{ color: '#E05252' }}>*</span>
                    </label>
                    <SignaturePad onEnd={url => setSignatureUrl(url)} />
                </div>

                {/* Photo */}
                <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: '#4A6A7A' }}>
                        Ảnh Bằng Chứng
                    </label>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) {
                                setPhotoFile(file)
                                const reader = new FileReader()
                                reader.onload = () => setPhotoPreview(reader.result as string)
                                reader.readAsDataURL(file)
                            }
                        }} />
                    {photoPreview ? (
                        <div className="relative rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                            <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover" />
                            <button onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                className="absolute top-2 right-2 p-1.5 rounded-full"
                                style={{ background: 'rgba(0,0,0,0.7)' }}>
                                <X size={14} style={{ color: '#E8F1F2' }} />
                            </button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center gap-2 w-full py-6 rounded-xl text-sm"
                            style={{ background: '#1B2E3D', border: '2px dashed #2A4355', color: '#4A6A7A' }}>
                            <Camera size={24} />
                            <span>Chụp ảnh hoặc chọn từ thư viện</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Bottom action */}
            <div className="px-4 pb-6 pt-3" style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                <button onClick={handleSave}
                    disabled={!name.trim() || !signatureUrl || saving}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all active:scale-[0.98]"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {saving
                        ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</>
                        : <><CheckCircle2 size={16} /> Xác Nhận Đã Giao</>}
                </button>
            </div>
        </div>
    )
}
