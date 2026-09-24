'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, CheckCircle2, ShieldCheck, VideoOff, Upload, AlertCircle } from 'lucide-react'
import { type VisitLocale, VISIT_I18N } from './i18n'

interface Props {
    title: string
    subtitle?: string
    customerName?: string
    salespersonName?: string
    locationInfo?: string
    onCapture: (photoBase64: string, thumbnailBase64?: string) => void
    onClose: () => void
    onOpenGpsGuide?: () => void
    gpsError?: string | null
    locale?: VisitLocale
}

export function LiveCameraModal({
    title,
    subtitle,
    customerName,
    salespersonName,
    locationInfo,
    onCapture,
    onClose,
    onOpenGpsGuide,
    gpsError,
    locale = 'vi',
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [thumbnailImage, setThumbnailImage] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [starting, setStarting] = useState(true)

    const stopActiveStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }

    const startCamera = useCallback(async (mode: 'environment' | 'user') => {
        setStarting(true)
        setCameraError(null)
        stopActiveStream()

        const tCam = VISIT_I18N[locale].camera
        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError(tCam.browserNotSupported)
            setStarting(false)
            return
        }

        try {
            let newStream: MediaStream | null = null
            try {
                // Primary: Try HD camera with specified facing mode
                const constraints: MediaStreamConstraints = {
                    video: {
                        facingMode: { ideal: mode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false
                }
                newStream = await navigator.mediaDevices.getUserMedia(constraints)
            } catch (err1) {
                console.warn('HD Camera constraint failed, trying basic video:', err1)
                newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            }

            streamRef.current = newStream

            if (videoRef.current && newStream) {
                videoRef.current.srcObject = newStream
                await videoRef.current.play().catch(() => {})
            }
        } catch (e: any) {
            console.warn('Camera access warning:', e)
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setCameraError(tCam.permDenied)
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                setCameraError(tCam.notFound)
            } else {
                setCameraError(tCam.unknownError)
            }
        }
        setStarting(false)
    }, [])

    useEffect(() => {
        startCamera(facingMode)
        return () => {
            stopActiveStream()
        }
    }, [facingMode, startCamera])

    const drawWatermarkAndSetImage = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Proportional scale factor based on image width for razor sharp readability
        const scale = Math.max(1.15, Math.min(2.8, canvas.width / 580))
        const bannerHeight = Math.round(108 * scale)
        const padX = Math.round(18 * scale)

        // Semi-transparent dark overlay
        ctx.fillStyle = 'rgba(10, 25, 38, 0.92)'
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight)

        // Teal accent line on top of banner
        ctx.fillStyle = '#87CBB9'
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, Math.max(3, Math.round(3.5 * scale)))

        // Format date & time based on locale
        const tDays = VISIT_I18N[locale].days
        const now = new Date()
        const dayNames = [tDays.sunday, tDays.monday, tDays.tuesday, tDays.wednesday, tDays.thursday, tDays.friday, tDays.saturday]
        const dayName = dayNames[now.getDay()]
        const timeStr = now.toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const dateStr = locale === 'en'
            ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            : `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
        const fullTimeStr = `⏱️ ${timeStr} - ${dayName}, ${dateStr}`

        // LINE 1: THỜI GIAN (LÀM TO & RÕ RÀNG - MÀU VÀNG NỔI BẬT)
        const fontTimeSize = Math.round(19 * scale)
        ctx.font = `bold ${fontTimeSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#FFD166'
        ctx.fillText(fullTimeStr, padX, canvas.height - bannerHeight + Math.round(32 * scale))

        // LINE 2: ĐỊA CHỈ & TOẠ ĐỘ GPS (LÀM TO & RÕ RÀNG - MÀU TRẮNG SÁNG)
        const fontLocSize = Math.round(17 * scale)
        ctx.font = `bold ${fontLocSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#FFFFFF'
        const locText = locationInfo ? `📍 ${locationInfo}` : (locale === 'en' ? '📍 Acquiring field GPS coordinates...' : '📍 Đang dò tìm toạ độ GPS thực địa...')
        
        // Auto-truncate if location text exceeds canvas width
        let displayLoc = locText
        const maxTextWidth = canvas.width - (padX * 2)
        while (ctx.measureText(displayLoc).width > maxTextWidth && displayLoc.length > 20) {
            displayLoc = displayLoc.slice(0, -4) + '...'
        }
        ctx.fillText(displayLoc, padX, canvas.height - bannerHeight + Math.round(65 * scale))

        // LINE 3: KHÁCH HÀNG & SALE & BRAND
        const fontMetaSize = Math.round(13 * scale)
        ctx.font = `bold ${fontMetaSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#87CBB9'
        const metaParts = ['LYS CELLARS ERP']
        if (customerName) metaParts.push(`${locale === 'en' ? 'Client' : 'Khách'}: ${customerName}`)
        if (salespersonName) metaParts.push(`${locale === 'en' ? 'Staff' : 'Sale'}: ${salespersonName}`)
        ctx.fillText(metaParts.join(' • '), padX, canvas.height - bannerHeight + Math.round(94 * scale))

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(dataUrl)

        // Crisp thumbnail generation (~480px wide, ~25-35KB) for sharp mobile cards while saving 90%+ DB & network bandwidth
        try {
            const thumbCanvas = document.createElement('canvas')
            const thumbW = 480
            const thumbH = Math.round((canvas.height * thumbW) / canvas.width)
            thumbCanvas.width = thumbW
            thumbCanvas.height = thumbH
            const tCtx = thumbCanvas.getContext('2d')
            if (tCtx) {
                tCtx.drawImage(canvas, 0, 0, thumbW, thumbH)
                const thumbDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7)
                setThumbnailImage(thumbDataUrl)
            }
        } catch (e) {
            console.warn('Could not generate thumbnail', e)
        }
    }

    const takeSnapshot = () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current

        let w = video.videoWidth || 640
        let h = video.videoHeight || 480
        const maxDim = 1280
        if (w > maxDim || h > maxDim) {
            if (w > h) {
                h = Math.round((h * maxDim) / w)
                w = maxDim
            } else {
                w = Math.round((w * maxDim) / h)
                h = maxDim
            }
        }

        canvas.width = w
        canvas.height = h

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.drawImage(video, 0, 0, w, h)
        drawWatermarkAndSetImage(canvas)
        stopActiveStream()
    }

    // Native Camera File Input fallback (for iOS/Android native camera trigger)
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = canvasRef.current || document.createElement('canvas')
                let w = img.width || 800
                let h = img.height || 600
                const maxDim = 1280
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w)
                        w = maxDim
                    } else {
                        w = Math.round((w * maxDim) / h)
                        h = maxDim
                    }
                }
                canvas.width = w
                canvas.height = h
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h)
                    drawWatermarkAndSetImage(canvas)
                }
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const handleConfirm = () => {
        if (!capturedImage) return
        stopActiveStream()
        onCapture(capturedImage, thumbnailImage || undefined)
    }

    const retakePhoto = () => {
        setCapturedImage(null)
        setThumbnailImage(null)
        startCamera(facingMode)
    }

    const toggleCameraMode = () => {
        const nextMode = facingMode === 'environment' ? 'user' : 'environment'
        setFacingMode(nextMode)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col shadow-2xl bg-white dark:bg-[#111C24] border border-slate-200 dark:border-[#223645] animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#223645] bg-slate-50/50 dark:bg-[#16232F]/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                            <Camera size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {subtitle || (locale === 'en' ? 'Capture verified field photo' : 'Chụp ảnh xác nhận từ camera')}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => { stopActiveStream(); onClose(); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Viewport Area */}
                <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                    {/* Live Stream Video */}
                    {!capturedImage && !cameraError && (
                        <>
                            <video
                                ref={videoRef}
                                playsInline
                                autoPlay
                                muted
                                className="w-full h-full object-cover"
                            />
                            
                            {/* Live Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-[10px] font-semibold text-[#87CBB9] border border-[#87CBB9]/30">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                                LIVE CAMERA
                            </div>

                            {/* Camera Switcher Button */}
                            <button
                                type="button"
                                onClick={toggleCameraMode}
                                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition"
                                title={locale === 'en' ? 'Switch front/back camera' : 'Đổi camera trước/sau'}
                            >
                                <RefreshCw size={16} />
                            </button>

                            {/* GPS Guidance Overlay Button if missing or errored */}
                            {(!locationInfo || gpsError) && onOpenGpsGuide && (
                                <button
                                    type="button"
                                    onClick={onOpenGpsGuide}
                                    className="absolute bottom-3 left-3 right-3 py-1.5 px-3 rounded-xl bg-amber-500/90 hover:bg-amber-600 text-white backdrop-blur text-xs font-semibold flex items-center justify-between shadow-lg border border-amber-400/60 transition z-20 cursor-pointer animate-pulse"
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <AlertCircle size={14} className="shrink-0 text-amber-100" />
                                        <span className="truncate">
                                            {locale === 'en' ? `GPS missing (${gpsError || 'disabled'})` : `Chưa có GPS (${gpsError || 'bị tắt hoặc từ chối'})`}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-[11px] underline font-bold ml-1 bg-amber-700/60 px-2 py-0.5 rounded-md">
                                        {locale === 'en' ? 'How to enable ➔' : 'Xem cách bật ➔'}
                                    </span>
                                </button>
                            )}
                        </>
                    )}

                    {/* Captured Image Preview */}
                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Captured Photo"
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Error / Native Camera Trigger Fallback */}
                    {cameraError && !capturedImage && (
                        <div className="absolute inset-0 bg-[#0D1E2B] p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                            <VideoOff size={36} className="text-[#D4A853]" />
                            <h4 className="text-sm font-bold text-white">
                                {locale === 'en' ? 'Open Device Camera' : 'Chụp Ảnh Qua Camera Thiết Bị'}
                            </h4>
                            <p className="text-xs text-[#8AAEBB] max-w-xs">{cameraError}</p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-5 py-3 text-xs font-bold rounded-xl bg-[#87CBB9] text-[#0A1926] flex items-center gap-2 shadow-lg"
                            >
                                <Camera size={16} /> {locale === 'en' ? 'Open device camera' : 'Mở camera thiết bị'}
                            </button>
                        </div>
                    )}

                    {/* Hidden Native File Input with capture="environment" for 100% OS Camera trigger */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileInputChange}
                        className="hidden"
                    />

                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Live Watermark Notice */}
                <div className="px-4 py-2 bg-[#142433] flex items-center justify-between text-[10px] text-[#8AAEBB] border-t border-[#2A4355]">
                    <span className="flex items-center gap-1">
                        <ShieldCheck size={12} className="text-[#87CBB9]" /> 
                        {locale === 'en' ? 'Field photo at destination' : 'Ảnh chụp tại điểm đến'}
                    </span>
                    <span>{locale === 'en' ? 'Auto-recorded timestamp' : 'Tự động ghi nhận thời gian'}</span>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-[#0D1E2B] flex items-center justify-between gap-3 border-t border-[#2A4355]">
                    {!capturedImage ? (
                        <>
                            <button
                                type="button"
                                onClick={() => { stopActiveStream(); onClose(); }}
                                className="px-4 py-2.5 text-xs font-medium rounded-xl text-[#8AAEBB] hover:bg-[#1B2E3D]"
                            >
                                {locale === 'en' ? 'Cancel' : 'Hủy'}
                            </button>
                            
                            {!cameraError ? (
                                <button
                                    type="button"
                                    onClick={takeSnapshot}
                                    disabled={starting}
                                    className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}
                                >
                                    <Camera size={16} /> {locale === 'en' ? 'Take Field Photo' : 'Chụp Ảnh Điểm Bán'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 bg-[#87CBB9] text-[#0A1926]"
                                >
                                    <Camera size={16} /> {locale === 'en' ? 'Open Camera Now' : 'Mở Camera Chụp Ngay'}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={retakePhoto}
                                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#1B2E3D] text-[#8AAEBB] hover:bg-[#2A4355] border border-[#2A4355]"
                            >
                                <RefreshCw size={14} className="inline mr-1" /> {locale === 'en' ? 'Retake' : 'Chụp Lại'}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 bg-[#87CBB9] text-[#0A1926]"
                            >
                                <CheckCircle2 size={16} /> {locale === 'en' ? 'Confirm Photo' : 'Xác Nhận Ảnh Này'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
