import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─── Tailwind class merger ──────────────────────────
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// ─── Currency formatting ────────────────────────────
export function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
    }).format(amount)
}

export function formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(amount)
}

// ─── Number formatting ──────────────────────────────
export function formatNumber(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(n)
}

export function formatPercent(n: number, decimals = 1): string {
    return `${n.toFixed(decimals)}%`
}

// ─── Date formatting ────────────────────────────────
export function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(date))
}

// ─── ID generators ─────────────────────────────────
export function generatePoNo(sequence: number): string {
    const year = new Date().getFullYear().toString().slice(-2)
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    return `PO-${year}${month}-${String(sequence).padStart(4, '0')}`
}

export function generateSoNo(sequence: number): string {
    const year = new Date().getFullYear().toString().slice(-2)
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    return `SO-${year}${month}-${String(sequence).padStart(4, '0')}`
}

// ─── API key masking (display only) ────────────────
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '***'
    return `${key.slice(0, 4)}***${key.slice(-4)}`
}

// ─── Location code generator ───────────────────────
export function generateLocationCode(zone: string, rack: string, bin: string): string {
    return `${zone}-${rack}-${bin}`.toUpperCase()
}
