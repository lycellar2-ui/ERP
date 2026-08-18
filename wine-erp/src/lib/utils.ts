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

// ─── Date formatting & parsing ──────────────────────
export function getLocalDateString(date: Date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

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

/**
 * Parse an input date (e.g. "YYYY-MM-DD" from <input type="date">)
 * and attach the current real-time (hours, minutes, seconds, milliseconds)
 * so that document creation/update timestamp reflects real-time instead of 00:00:00 UTC (07:00 AM VN).
 */
export function parseDateWithCurrentTime(inputDate?: string | Date | null): Date {
    const now = new Date()
    if (!inputDate) return now
    if (inputDate instanceof Date) return inputDate

    const str = String(inputDate).trim()
    if (!str) return now

    // Check if it's date-only string like "YYYY-MM-DD"
    const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateMatch) {
        const year = parseInt(dateMatch[1], 10)
        const month = parseInt(dateMatch[2], 10) - 1
        const day = parseInt(dateMatch[3], 10)

        return new Date(year, month, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds())
    }

    const parsed = new Date(str)
    return isNaN(parsed.getTime()) ? now : parsed
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

// ─── Wine Case & Loose Bottle Conversion ─────────────
export function formatCasesAndBottles(totalBottles: number | null | undefined, unitsPerCase: number = 6): string {
    if (totalBottles === null || totalBottles === undefined || isNaN(totalBottles)) {
        return '—'
    }
    const upc = unitsPerCase > 0 ? unitsPerCase : 6
    const absVal = Math.abs(totalBottles)
    const cases = Math.floor(absVal / upc)
    const loose = absVal % upc
    const sign = totalBottles < 0 ? '-' : ''

    if (cases > 0 && loose > 0) {
        return `${sign}${cases} thùng ${loose} lẻ (${totalBottles} chai)`
    } else if (cases > 0) {
        return `${sign}${cases} thùng (${totalBottles} chai)`
    } else {
        return `${sign}${loose} chai`
    }
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

// ─── Due date calculator ───────────────────────────
export function calculateDueDate(invoiceDate: Date | string, paymentTerm: string): Date {
    const baseDate = new Date(invoiceDate)
    const term = (paymentTerm || '').toUpperCase()

    if (term === 'EOM_10' || term === 'EOM_15') {
        const dueDay = term === 'EOM_10' ? 10 : 15
        const year = baseDate.getFullYear()
        const month = baseDate.getMonth() + 1
        return new Date(year, month, dueDay, 12, 0, 0, 0)
    }

    if (term.startsWith('NET')) {
        const days = parseInt(term.replace('NET', ''), 10)
        if (!isNaN(days)) {
            const result = new Date(baseDate)
            result.setDate(result.getDate() + days)
            return result
        }
    }

    return baseDate
}

