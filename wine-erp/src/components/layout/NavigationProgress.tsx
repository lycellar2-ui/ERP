'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
    const pathname = usePathname()
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState(0)
    const prevPathRef = useRef(pathname)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const progressRef = useRef<NodeJS.Timeout | null>(null)

    const stopProgress = useCallback(() => {
        setProgress(100)
        if (progressRef.current) clearInterval(progressRef.current)
        // Fade out after completing
        setTimeout(() => {
            setLoading(false)
            setProgress(0)
        }, 300)
    }, [])

    const startProgress = useCallback(() => {
        setLoading(true)
        setProgress(10)
        // Incrementally increase progress to simulate loading
        if (progressRef.current) clearInterval(progressRef.current)
        progressRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) {
                    if (progressRef.current) clearInterval(progressRef.current)
                    return 90
                }
                return prev + (90 - prev) * 0.15
            })
        }, 200)
    }, [])

    useEffect(() => {
        if (pathname !== prevPathRef.current) {
            stopProgress()
            prevPathRef.current = pathname
        }
    }, [pathname, stopProgress])

    // Listen for route change start via click on links
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const link = (e.target as HTMLElement).closest('a')
            if (link?.href && link.href.startsWith(window.location.origin) && !link.href.includes('#')) {
                const url = new URL(link.href)
                if (url.pathname !== pathname) {
                    // Small delay to avoid flicker on fast nav
                    timerRef.current = setTimeout(() => {
                        startProgress()
                    }, 50)
                }
            }
        }
        document.addEventListener('click', handleClick, true)
        return () => {
            document.removeEventListener('click', handleClick, true)
            if (timerRef.current) clearTimeout(timerRef.current)
            if (progressRef.current) clearInterval(progressRef.current)
        }
    }, [pathname, startProgress])

    if (!loading) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
            <div
                className="h-full rounded-r-full"
                style={{
                    background: 'linear-gradient(90deg, #87CBB9, #5BA88A, #87CBB9)',
                    width: `${progress}%`,
                    transition: progress === 100 ? 'width 200ms ease-out, opacity 300ms' : 'width 200ms ease-out',
                    opacity: progress === 100 ? 0 : 1,
                    boxShadow: '0 0 10px rgba(135,203,185,0.5), 0 0 5px rgba(135,203,185,0.3)',
                }}
            />
        </div>
    )
}

