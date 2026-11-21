export interface KnbsSession {
    accessToken: string
    clientId: string
    databaseId: string
    expiresAt: number
}

export interface KnbsReceiptVoucher {
    knbsId: string
    voucherType: 'CASH' | 'BANK_TRANSFER'
    voucherNo: string
    postingDate: Date
    totalAmount: number
    customerTaxId: string | null
    customerName: string | null
    description: string
}

const KNBS_CLIENT_URL = 'https://accounting.knbs.cloud/client'
const KNBS_API_BASE = 'https://api.knbs.cloud'
const SESSION_TTL_MS = 45 * 60 * 1000

let cachedSession: KnbsSession | null = null

function getKnbsTaCredentials(): { username: string; password: string } {
    const username = process.env.KNBS_TA_USERNAME?.trim()
    const password = process.env.KNBS_TA_PASSWORD?.trim()
    if (!username || !password) {
        throw new Error(
            'Thiếu cấu hình biến môi trường KNBS_TA_USERNAME hoặc KNBS_TA_PASSWORD cho tài khoản Thắng Ân.'
        )
    }
    return { username, password }
}

function mergeCookies(jar: Map<string, string>, headers: Headers): void {
    const setCookies = typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : [])

    for (const raw of setCookies) {
        const firstPart = raw.split(';')[0]
        const eqIdx = firstPart.indexOf('=')
        if (eqIdx > 0) {
            const name = firstPart.slice(0, eqIdx).trim()
            const val = firstPart.slice(eqIdx + 1).trim()
            jar.set(name, val)
        }
    }
}

function formatCookieHeader(jar: Map<string, string>): string {
    return Array.from(jar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
}

async function fetchWithCookies(
    url: string,
    jar: Map<string, string>,
    init: RequestInit = {},
    maxRedirects = 8
): Promise<{ url: string; status: number; body: string }> {
    let currentUrl = url
    let currentInit: RequestInit = { ...init }

    for (let i = 0; i <= maxRedirects; i++) {
        const headers = new Headers(currentInit.headers || {})
        headers.set('User-Agent', 'Mozilla/5.0 (compatible; WineERP/1.0)')
        const cookieStr = formatCookieHeader(jar)
        if (cookieStr) headers.set('Cookie', cookieStr)

        const res = await fetch(currentUrl, {
            ...currentInit,
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(20000),
        })

        mergeCookies(jar, res.headers)

        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location')
            if (!loc) break
            currentUrl = new URL(loc, currentUrl).toString()
            currentInit = { method: 'GET' }
            continue
        }

        const body = await res.text()
        return { url: currentUrl, status: res.status, body }
    }

    throw new Error('KNBS OIDC login exceeded maximum redirects')
}

export async function getKnbsTaSession(forceRefresh = false): Promise<KnbsSession> {
    if (!forceRefresh && cachedSession && Date.now() < cachedSession.expiresAt) {
        return cachedSession
    }

    const { username, password } = getKnbsTaCredentials()
    const jar = new Map<string, string>()

    const loginPage = await fetchWithCookies(KNBS_CLIENT_URL, jar)
    const actionMatch = loginPage.body.match(/"loginAction"\s*:\s*"([^"]+)"/)
    if (!actionMatch) {
        throw new Error('Không tìm thấy loginAction trên trang đăng nhập KNBS Keycloak.')
    }

    const loginAction = actionMatch[1].replace(/\\\//g, '/')
    const form = new URLSearchParams({
        username,
        password,
        credentialId: '',
    })

    const postRes = await fetchWithCookies(loginAction, jar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
    })

    if (postRes.url.includes('login-actions/authenticate')) {
        throw new Error('Đăng nhập KNBS thất bại (sai tài khoản/mật khẩu hoặc bị từ chối).')
    }

    const appMatch = postRes.body.match(/window\.App\s*=\s*(\{[\s\S]*?\});\s*<\/script>/)
    if (!appMatch) {
        throw new Error('Không đọc được window.App sau khi đăng nhập KNBS.')
    }

    const appJson = JSON.parse(appMatch[1])
    const accessToken: string | undefined = appJson?.accessToken
    const clientId: string | undefined = appJson?.state?.client?.currentClient?._id
    const databaseId: string | undefined = appJson?.state?.client?.currentDatabase?._id

    if (!accessToken || !clientId || !databaseId) {
        throw new Error('Thiếu accessToken, clientId hoặc databaseId trong phiên KNBS.')
    }

    cachedSession = {
        accessToken,
        clientId,
        databaseId,
        expiresAt: Date.now() + SESSION_TTL_MS,
    }
    return cachedSession
}

async function knbsApiGet(path: string, retryOn401 = true): Promise<any> {
    const session = await getKnbsTaSession(false)
    const url = `${KNBS_API_BASE}/api/client/${session.clientId}${path}`

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'CLIENT-CURRENT-DB': session.databaseId,
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20000),
    })

    if (res.status === 401 && retryOn401) {
        await getKnbsTaSession(true)
        return knbsApiGet(path, false)
    }

    if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`KNBS API ${path} lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`)
    }

    return res.json()
}

function extractTaxId(raw: any): string | null {
    const candidates = [
        raw?.object?.companyTaxCode,
        raw?.object?.taxCode,
        raw?.object?.code,
        raw?.customer?.companyTaxCode,
        raw?.customer?.taxCode,
        raw?.customer?.code,
        raw?.partner?.companyTaxCode,
        raw?.partner?.taxCode,
        raw?.taxCode,
        raw?.companyTaxCode,
    ]
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim().length > 0) {
            return c.trim()
        }
    }
    return null
}

function extractCustomerName(raw: any): string | null {
    const candidates = [
        raw?.object?.name,
        raw?.customer?.name,
        raw?.partner?.name,
        raw?.objectName,
        raw?.customerName,
    ]
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim().length > 0) {
            return c.trim()
        }
    }
    return null
}

function normalizeReceipt(raw: any, voucherType: 'CASH' | 'BANK_TRANSFER'): KnbsReceiptVoucher | null {
    const knbsId = String(raw?._id || '').trim()
    if (!knbsId) return null

    const details = Array.isArray(raw?.detail) ? raw.detail : Array.isArray(raw?.details) ? raw.details : []
    const detailSum = details.reduce((sum: number, d: any) => sum + Number(d?.amount ?? d?.totalAmount ?? 0), 0)
    const totalAmount = Number(raw?.totalAmount ?? raw?.amount ?? detailSum ?? 0)
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return null

    const rawDate = raw?.postingDate ?? raw?.voucherDate ?? raw?.createDate
    const postingDate = rawDate ? new Date(rawDate) : new Date()
    if (Number.isNaN(postingDate.getTime())) return null

    const voucherNo = String(
        raw?.voucherNo ?? raw?.documentNumber ?? raw?.orderNumber ?? raw?.code ?? knbsId
    ).trim()

    const firstDetail = details[0]
    const customerTaxId = extractTaxId(raw) ?? extractTaxId(firstDetail)
    const customerName = extractCustomerName(raw) ?? extractCustomerName(firstDetail)
    const description = String(
        raw?.description ?? raw?.reason ?? raw?.notes ?? `Thu tiền từ KNBS (${voucherNo})`
    ).trim()

    return {
        knbsId,
        voucherType,
        voucherNo,
        postingDate,
        totalAmount,
        customerTaxId,
        customerName,
        description,
    }
}

async function fetchPagedDeposits(
    endpoint: '/cash/deposit/get-list' | '/bank/deposit/get-list',
    voucherType: 'CASH' | 'BANK_TRANSFER'
): Promise<KnbsReceiptVoucher[]> {
    const PAGE_SIZE = 50 // KNBS API returns empty array if size > 50
    const results: KnbsReceiptVoucher[] = []
    let page = 1

    while (true) {
        const data = await knbsApiGet(`${endpoint}?includeDetail=true&page=${page}&size=${PAGE_SIZE}`)
        const rows: any[] = Array.isArray(data?.result) ? data.result : []
        for (const row of rows) {
            const normalized = normalizeReceipt(row, voucherType)
            if (normalized) results.push(normalized)
        }

        const total = Number(data?.total ?? 0)
        if (rows.length < PAGE_SIZE || page * PAGE_SIZE >= total) {
            break
        }
        page += 1
        if (page > 100) break // safety guard
    }

    return results
}

export async function fetchKnbsTaReceipts(): Promise<KnbsReceiptVoucher[]> {
    const [cashReceipts, bankDeposits] = await Promise.all([
        fetchPagedDeposits('/cash/deposit/get-list', 'CASH'),
        fetchPagedDeposits('/bank/deposit/get-list', 'BANK_TRANSFER'),
    ])
    return [...cashReceipts, ...bankDeposits].sort(
        (a, b) => a.postingDate.getTime() - b.postingDate.getTime()
    )
}
