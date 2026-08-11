import fs from 'fs'

export interface GdtCaptcha {
    key: string
    content: string
}

export interface GdtAuthResponse {
    token?: string
    message?: string
    code?: number
}

export async function getGdtCaptcha(): Promise<GdtCaptcha> {
    const res = await fetch('https://hoadondientu.gdt.gov.vn/api/captcha', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
        },
    })
    if (!res.ok) {
        throw new Error(`Failed to fetch Captcha: ${res.statusText}`)
    }
    return await res.json()
}

export async function authenticateGdt(mst: string, pass: string, ckey: string, cvalue: string): Promise<string> {
    const res = await fetch('https://hoadondientu.gdt.gov.vn/api/security-taxpayer/authenticate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://hoadondientu.gdt.gov.vn',
            'Referer': 'https://hoadondientu.gdt.gov.vn/',
        },
        body: JSON.stringify({
            username: mst,
            password: pass,
            ckey,
            cvalue,
        }),
    })

    const body = await res.json()
    if (!res.ok || !body.token) {
        throw new Error(body.message || body.error || 'Đăng nhập Cổng Thuế thất bại. Kiểm tra lại Captcha hoặc Mật khẩu.')
    }

    return body.token
}

export async function getSoldInvoices(token: string, page = 0, size = 50) {
    const res = await fetch(`https://hoadondientu.gdt.gov.vn/api/query/invoices/sold?sort=tdlap:desc&size=${size}&page=${page}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
        },
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch sold invoices: ${res.statusText}`)
    }

    return await res.json()
}

export async function getPurchaseInvoices(token: string, page = 0, size = 50) {
    const res = await fetch(`https://hoadondientu.gdt.gov.vn/api/query/invoices/purchase?sort=tdlap:desc&size=${size}&page=${page}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
        },
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch purchase invoices: ${res.statusText}`)
    }

    return await res.json()
}
