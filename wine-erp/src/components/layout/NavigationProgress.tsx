'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
    const pathname = usePathname()
    const [loading, setLoading] = useState(false)
    const [prevPath, setPrevPath] = useState(pathname)

    useEffect(() => {
        if (pathname !== prevPath) {
            setLoading(false)
            setPrevPath(pathname)
        }
    }, [pathname, prevPath])

    // Listen for route change start via click on links
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const link = (e.target as HTMLElement).closest('a')
            if (link?.href && link.href.startsWith(window.location.origin) && !link.href.includes('#')) {
                const url = new URL(link.href)
                if (url.pathname !== pathname) {
                    setLoading(true)
                }
            }
        }
        document.addEventListener('click', handleClick, true)
        return () => document.removeEventListener('click', handleClick, true)
    }, [pathname])

    if (!loading) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px]">
            <div
                className="h-full rounded-r-full"
                style={{
                    background: 'linear-gradient(90deg, #87CBB9, #5BA88A)',
                    animation: 'nprogress 2s ease-in-out infinite',
                    width: '100%',
                    transformOrigin: 'left',
                }}
            />
            <style>{`
                @keyframes nprogress {
                    0% { transform: scaleX(0); }
                    50% { transform: scaleX(0.7); }
                    100% { transform: scaleX(1); }
                }
            `}</style>
        </div>
    )
}
