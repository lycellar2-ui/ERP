'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera, X, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck, VideoOff } from 'lucide-react'

interface Props {
    title: string
    subtitle?: string
    onCapture: (photoBase64: string) => void
    onClose: () => void
}

export function LiveCameraModal({ title, subtitle, onCapture, onClose }: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)

    const [stream, setStream] = useState<MediaStream | null>(null)
    const [capturedImage, setCapturedImage] = useState<string | null>(null)
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [starting, setStarting] = useState(true)

    const startCamera = useCallback(async (mode: 'environment' | 'user') => {
        setStarting(true)
        setCameraError(null)
        try {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }

            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false
            }

            const newStream = await navigator.mediaDevices.getUserMedia(constraints)
            setStream(newStream)

            if (videoRef.current) {
                videoRef.current.srcObject = newStream
                await videoRef.current.play()
            }
        } catch (e: any) {
            console.error('Camera access error:', e)
            if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
                setCameraError('Trình duyệt chưa được cấp quyền mở Camera. Vui lòng nhấn "Cho Phép" (Allow) quyền Camera trên thiết bị!')
            } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
                setCameraError('Không tìm thấy thiết bị Camera khả dụng trên máy của bạn!')
            } else {
                setCameraError('Không thể mở luồng Camera: ' + (e.message || 'Lỗi thiết bị'))
            }
        }
        setStarting(false)
    }, [stream])

    useEffect(() => {
        startCamera(facingMode)
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [facingMode]) // eslint-disable-line

    const takeSnapshot = () => {
        if (!videoRef.current || !canvasRef.current) return

        const video = videoRef.current
        const canvas = canvasRef.current

        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Draw image frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Add Timestamp watermark to photo
        const nowStr = new Date().toLocaleString('vi-VN')
        ctx.font = 'bold 16px sans-serif'
        ctx.fillStyle = '#87CBB9'
        ctx.shadowColor = 'black'
        ctx.shadowBlur = 4
        ctx.fillText(`LYS CELLARS ERP | Check-in Photo: ${nowStr}`, 16, canvas.height - 20)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setCapturedImage(dataUrl)
    }

    const handleConfirm = () => {
        if (!capturedImage) return
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
        }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(10,5,2,0.85)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col shadow-2xl" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #2A4355', background: '#142433' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#87CBB9]/10 text-[#87CBB9]">
                            <Camera size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#E8F1F2]">{title}</h3>
                            <p className="text-[11px] text-[#4A6A7A]">{subtitle || 'Bắt buộc chụp ảnh trực tiếp từ Camera'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-[#1B2E3D] hover:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                {/* Viewport Area */}
                <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
                    {/* Live Stream Video */}
                    {!capturedImage && (
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

                    {/* Error Banner */}
                    {cameraError && (
                        <div className="absolute inset-0 bg-[#0D1E2B] p-6 flex flex-col items-center justify-center text-center space-y-3 z-10">
                            <VideoOff size={36} className="text-[#E11D48]" />
                            <h4 className="text-sm font-bold text-white">Không Thể Bật Camera</h4>
                            <p className="text-xs text-[#8AAEBB] max-w-xs">{cameraError}</p>
                            <button
                                type="button"
                                onClick={() => startCamera(facingMode)}
                                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#87CBB9] text-[#0A1926]"
                            >
                                Thử Lại Cấp Quyền Camera
                            </button>
                        </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* Live Watermark Notice */}
                <div className="px-4 py-2 bg-[#142433] flex items-center justify-between text-[10px] text-[#8AAEBB] border-t border-[#2A4355]">
                    <span className="flex items-center gap-1">
                        <ShieldCheck size={12} className="text-[#87CBB9]" /> Bắt buộc chụp thực tế (Anti-fraud)
                    </span>
                    <span>Tự động chèn Thời Gian & Tọa Độ</span>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-[#0D1E2B] flex items-center justify-between gap-3 border-t border-[#2A4355]">
                    {!capturedImage ? (
                        <>
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2.5 text-xs font-medium rounded-xl text-[#8AAEBB] hover:bg-[#1B2E3D]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={takeSnapshot}
                                disabled={starting || !!cameraError}
                                className="flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                                style={{ background: '#87CBB9', color: '#0A1926' }}
                            >
                                <Camera size={16} /> Chụp Ảnh Điểm Bán
                            </button>
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
