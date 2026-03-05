'use client'

import React, { useRef, useState, useEffect } from 'react'

interface SignaturePadProps {
    onEnd: (dataUrl: string) => void
}

export function SignaturePad({ onEnd }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        // Prevent scrolling on touch devices while drawing
        const preventScroll = (e: TouchEvent) => {
            if (e.target === canvas) e.preventDefault()
        }
        document.addEventListener('touchmove', preventScroll, { passive: false })
        return () => document.removeEventListener('touchmove', preventScroll)
    }, [])

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x, y
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        }

        ctx.beginPath()
        ctx.moveTo(x, y)
        setIsDrawing(true)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        let x, y
        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left
            y = e.touches[0].clientY - rect.top
        } else {
            x = e.clientX - rect.left
            y = e.clientY - rect.top
        }

        ctx.lineTo(x, y)
        ctx.strokeStyle = '#87CBB9'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.stroke()
    }

    const stopDrawing = () => {
        if (!isDrawing) return
        setIsDrawing(false)
        if (canvasRef.current) {
            onEnd(canvasRef.current.toDataURL('image/png'))
        }
    }

    const clear = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        onEnd('')
    }

    return (
        <div className="space-y-2">
            <div className="relative rounded-md overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <div className="flex justify-end">
                <button type="button" onClick={clear} className="text-xs px-2 py-1 rounded hover:bg-white/10" style={{ color: '#4A6A7A' }}>
                    Xóa Chữ Ký
                </button>
            </div>
        </div>
    )
}
