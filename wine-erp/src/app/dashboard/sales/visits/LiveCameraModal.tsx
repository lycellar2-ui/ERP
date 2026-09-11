'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, CheckCircle2, ShieldCheck, VideoOff, Upload } from 'lucide-react'

interface Props {
    title: string
    subtitle?: string
    customerName?: string
    salespersonName?: string
    locationInfo?: string
    onCapture: (photoBase64: string) => void
    onClose: () => void
}

export function LiveCameraModal({ title, subtitle, customerName, salespersonName, locationInfo, onCapture, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const [capturedImage, setCapturedImage] = useState<string | null>(null)
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

        if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError('Trình duyệt chưa mở Camera trực tiếp. Bạn bấm nút bên dưới để chụp bằng Camera của máy!')
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
                setCameraError('Trình duyệt chưa được cấp quyền mở Camera. Bạn hãy bấm nút bên dưới để mở Camera máy!')
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                setCameraError('Không tìm thấy luồng Camera trực tiếp. Bấm nút bên dưới để dùng Camera thiết bị!')
            } else {
                setCameraError('Chưa thể mở Camera trực tiếp. Bấm nút bên dưới để dùng Camera thiết bị chụp ảnh!')
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

        const nowStr = new Date().toLocaleString('vi-VN')
        const bannerHeight = 46
        
        // Semi-transparent bottom banner
        ctx.fillStyle = 'rgba(10, 25, 38, 0.82)'
        ctx.fillRect(0, canvas.height - bannerHeight, canvas.width, bannerHeight)

        // Line 1: Brand & Customer & Time
        ctx.fillStyle = '#87CBB9'
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const line1 = `LYS CELLARS ERP | ${customerName ? customerName + ' | ' : ''}${nowStr}`
        ctx.fillText(line1, 14, canvas.height - 25)

        // Line 2: Sale name & Location/GPS
        ctx.fillStyle = '#E2E8F0'
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const parts = []
        if (salespersonName) parts.push(`Sale: ${salespersonName}`)
        if (locationInfo) parts.push(locationInfo)
        const line2 = parts.join(' • ') || 'Ảnh chụp thực địa thị trường'
        ctx.fillText(line2, 14, canvas.height - 10)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setCapturedImage(dataUrl)
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
        onCapture(capturedImage)
    }

    const retakePhoto = () => {
        setCapturedImage(null)
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
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle || 'Bắt buộc chụp ảnh trực tiếp từ Camera'}</p>
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
                                title="Đổi camera trước/sau"
                            >
                                <RefreshCw size={16} />
                            </button>
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
                            <h4 className="text-sm font-bold text-white">Chụp Ảnh Qua Camera Thiết Bị</h4>
                            <p className="text-xs text-[#8AAEBB] max-w-xs">{cameraError}</p>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-5 py-3 text-xs font-bold rounded-xl bg-[#87CBB9] text-[#0A1926] flex items-center gap-2 shadow-lg"
                            >
                                <Camera size={16} /> Bật App Camera Chụp Thực Tế
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
                        <ShieldCheck size={12} className="text-[#87CBB9]" /> Bắt buộc chụp thực tế tại điểm bán
                    </span>
                    <span>Tự động đóng dấu Thời gian</span>
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
                                Hủy
                            </button>
                            
                            {!cameraError ? (
                                <button
                                    type="button"
                                    onClick={takeSnapshot}
                                    disabled={starting}
                                    className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}
                                >
                                    <Camera size={16} /> Chụp Ảnh Điểm Bán
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 bg-[#87CBB9] text-[#0A1926]"
                                >
                                    <Camera size={16} /> Mở Camera Chụp Ngay
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
                                <RefreshCw size={14} className="inline mr-1" /> Chụp Lại
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 bg-[#87CBB9] text-[#0A1926]"
                            >
                                <CheckCircle2 size={16} /> Xác Nhận Ảnh Này
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
