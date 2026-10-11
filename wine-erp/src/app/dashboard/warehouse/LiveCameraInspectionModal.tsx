'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, CheckCircle2, ShieldCheck, VideoOff, Upload, AlertCircle } from 'lucide-react'

interface Props {
    title: string
    warehouseName: string
    inspectorName?: string
    category: 'THERMOMETER' | 'AC_COOLING' | 'CORNER' | 'INCIDENT' | 'GENERAL'
    categoryLabel: string
    onCapture: (photoBase64: string, thumbnailBase64?: string, watermarkText?: string) => void
    onClose: () => void
}

export function LiveCameraInspectionModal({
    title,
    warehouseName,
    inspectorName = 'Thủ kho',
    category,
    categoryLabel,
    onCapture,
    onClose,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [thumbnailImage, setThumbnailImage] = useState<string | null>(null)
    const [watermarkStr, setWatermarkStr] = useState<string>('')
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [starting, setStarting] = useState(true)
    const [locationInfo, setLocationInfo] = useState<string>('Đang định vị...')

    // GPS location acquisition
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude.toFixed(5)
                    const lng = pos.coords.longitude.toFixed(5)
                    setLocationInfo(`GPS: ${lat}, ${lng}`)
                },
                () => {
                    setLocationInfo(`KHO: ${warehouseName}`)
                },
                { enableHighAccuracy: true, timeout: 5000 }
            )
        } else {
            setLocationInfo(`KHO: ${warehouseName}`)
        }
    }, [warehouseName])

    const stopActiveStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
    }, [])

    const startCamera = useCallback(async (mode: 'environment' | 'user') => {
        setStarting(true)
        setCameraError(null)
        stopActiveStream()

        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Trình duyệt không hỗ trợ truy cập Camera trực tiếp. Vui lòng sử dụng tính năng tải ảnh.')
            setStarting(false)
            return
        }

        try {
            let newStream: MediaStream | null = null
            try {
                const constraints: MediaStreamConstraints = {
                    video: {
                        facingMode: { ideal: mode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                }
                newStream = await navigator.mediaDevices.getUserMedia(constraints)
            } catch (err1) {
                console.warn('HD camera constraint failed, trying basic video:', err1)
                newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            }

            streamRef.current = newStream

            if (videoRef.current && newStream) {
                videoRef.current.srcObject = newStream
                await videoRef.current.play().catch(() => {})
            }
        } catch (e: any) {
            console.warn('Camera access error:', e)
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setCameraError('Quyền truy cập Camera bị từ chối. Vui lòng bật cấp quyền camera trong cài đặt trình duyệt hoặc chọn tải ảnh từ máy.')
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                setCameraError('Không tìm thấy thiết bị camera trên máy.')
            } else {
                setCameraError('Không thể mở camera. Vui lòng sử dụng nút tải ảnh từ thư viện.')
            }
        }
        setStarting(false)
    }, [stopActiveStream])

    useEffect(() => {
        startCamera(facingMode)
        return () => {
            stopActiveStream()
        }
    }, [facingMode, startCamera, stopActiveStream])

    const drawWatermarkAndSetImage = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const scale = Math.max(1.15, Math.min(2.5, canvas.width / 580))
        const bannerHeight = Math.round(96 * scale)
        const padX = Math.round(18 * scale)

        // Semi-transparent dark overlay
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)'
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight)

        // Slate accent line on top of banner
        ctx.fillStyle = '#0891B2'
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, Math.max(3, Math.round(3 * scale)))

        const now = new Date()
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
        const fullTimeStr = `[THỜI GIAN] ${timeStr} - ${dateStr}`

        // LINE 1: TIME (BOLD YELLOW)
        const fontTimeSize = Math.round(18 * scale)
        ctx.font = `bold ${fontTimeSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#FBBF24'
        ctx.fillText(fullTimeStr, padX, canvas.height - bannerHeight + Math.round(28 * scale))

        // LINE 2: WAREHOUSE & LOCATION
        const fontLocSize = Math.round(15 * scale)
        ctx.font = `bold ${fontLocSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#FFFFFF'
        const line2Text = `KHO: ${warehouseName.toUpperCase()} | ${locationInfo}`
        ctx.fillText(line2Text, padX, canvas.height - bannerHeight + Math.round(56 * scale))

        // LINE 3: BRAND & INSPECTOR & CATEGORY
        const fontMetaSize = Math.round(13 * scale)
        ctx.font = `bold ${fontMetaSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
        ctx.fillStyle = '#38BDF8'
        const metaText = `LYS CELLARS ERP • NV: ${inspectorName} • HẠNG MỤC: ${categoryLabel.toUpperCase()}`
        ctx.fillText(metaText, padX, canvas.height - bannerHeight + Math.round(82 * scale))

        const finalWatermark = `${warehouseName} • ${dateStr} ${timeStr} • ${inspectorName} • ${categoryLabel}`
        setWatermarkStr(finalWatermark)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(dataUrl)

        // Thumbnail (~480px width, ~25KB)
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
        stopActiveStream()
        drawWatermarkAndSetImage(canvas)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !canvasRef.current) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            const img = new Image()
            img.onload = () => {
                const canvas = canvasRef.current!
                let w = img.width
                let h = img.height
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
                    stopActiveStream()
                    drawWatermarkAndSetImage(canvas)
                }
            }
            img.src = ev.target?.result as string
        }
        reader.readAsDataURL(file)
    }

    const handleConfirm = () => {
        if (!capturedImage) return
        stopActiveStream()
        onCapture(capturedImage, thumbnailImage || undefined, watermarkStr)
        onClose()
    }

    const handleRetake = () => {
        setCapturedImage(null)
        setThumbnailImage(null)
        startCamera(facingMode)
    }

    const toggleFacingMode = () => {
        const nextMode = facingMode === 'environment' ? 'user' : 'environment'
        setFacingMode(nextMode)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm">
            <div className="relative flex flex-col w-full max-w-xl max-h-[95vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-400 font-mono font-medium border border-cyan-800/50">
                                {categoryLabel}
                            </span>
                            <h3 className="text-sm font-semibold truncate text-slate-100">{title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                            Kho: <span className="text-slate-200 font-medium">{warehouseName}</span> • NV: <span className="text-slate-200">{inspectorName}</span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            stopActiveStream()
                            onClose()
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Viewport Area */}
                <div className="relative flex-1 bg-black flex items-center justify-center min-h-[360px] sm:min-h-[420px] overflow-hidden">
                    {/* Live Video */}
                    {!capturedImage && !cameraError && (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-contain"
                        />
                    )}

                    {/* Captured Image Preview */}
                    {capturedImage && (
                        <img
                            src={capturedImage}
                            alt="Ảnh kiểm tra kho đã chụp"
                            className="w-full h-full object-contain"
                        />
                    )}

                    {/* Camera Loading Spinner */}
                    {starting && !capturedImage && !cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-slate-300 gap-2">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs">Đang mở camera...</span>
                        </div>
                    )}

                    {/* Camera Error / Fallback */}
                    {cameraError && !capturedImage && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-slate-300">
                            <VideoOff className="w-12 h-12 text-amber-500 mb-3" />
                            <h4 className="text-sm font-semibold text-white mb-1">Không thể khởi động Camera</h4>
                            <p className="text-xs text-slate-400 max-w-sm mb-4">{cameraError}</p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition shadow"
                            >
                                <Upload className="w-4 h-4" />
                                Tải ảnh từ thư viện thiết bị
                            </button>
                        </div>
                    )}

                    {/* Viewfinder crosshairs when live */}
                    {!capturedImage && !cameraError && !starting && (
                        <div className="absolute inset-6 pointer-events-none border border-white/20 rounded-xl flex flex-col justify-between p-3">
                            <div className="flex justify-between items-start">
                                <span className="text-[11px] font-mono text-cyan-300 bg-slate-950/70 px-2 py-0.5 rounded border border-cyan-500/30">
                                    {categoryLabel}
                                </span>
                                <span className="text-[11px] font-mono text-amber-300 bg-slate-950/70 px-2 py-0.5 rounded border border-amber-500/30">
                                    [LIVE VIEW]
                                </span>
                            </div>
                            <div className="text-center text-[11px] text-slate-300/80 bg-slate-950/60 px-3 py-1 rounded max-w-xs mx-auto">
                                Giữ thiết bị chắc tay, đảm bảo đủ ánh sáng
                            </div>
                        </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-3 bg-slate-900 border-t border-slate-800">
                    {!capturedImage ? (
                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                                title="Tải ảnh từ máy"
                            >
                                <Upload className="w-4 h-4" />
                                <span className="hidden sm:inline">Tải ảnh</span>
                            </button>

                            <button
                                type="button"
                                onClick={takeSnapshot}
                                disabled={starting || !!cameraError}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-cyan-600 hover:bg-cyan-500 active:scale-98 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-cyan-950/50"
                            >
                                <Camera className="w-5 h-5" />
                                <span>Chụp ảnh kiểm tra kho</span>
                            </button>

                            <button
                                type="button"
                                onClick={toggleFacingMode}
                                disabled={starting || !!cameraError}
                                className="flex items-center justify-center p-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                                title="Đổi camera trước/sau"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={handleRetake}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition border border-slate-700"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span>Chụp lại</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-950/40"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Xác nhận ảnh này</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
