import { type NextRequest, NextResponse } from 'next/server'

// Module → required permission mapping for RBAC enforcement (All 31 Modules)
const ROUTE_PERMISSIONS: Record<string, string> = {
    '/dashboard/products': 'MDM:READ',
    '/dashboard/suppliers': 'MDM:READ',
    '/dashboard/customers': 'MDM:READ',
    '/dashboard/contracts': 'CNT:READ',
    '/dashboard/procurement': 'PRC:READ',
    '/dashboard/warehouse': 'WMS:READ',
    '/dashboard/sales': 'SLS:READ',
    '/dashboard/delivery': 'TRS:READ',
    '/dashboard/finance': 'FIN:READ',
    '/dashboard/reconciliation': 'FIN:READ',
    '/dashboard/declarations': 'TAX:READ',
    '/dashboard/costing': 'CST:READ',
    '/dashboard/reports': 'RPT:READ',
    '/dashboard/crm': 'CRM:READ',
    '/dashboard/consignment': 'CSG:READ',
    '/dashboard/agency': 'AGN:READ',
    '/dashboard/settings': 'SYS:ADMIN',
    '/dashboard/kpi': 'KPI:READ',
    '/dashboard/ai': 'AI:READ',
    '/dashboard/audit-log': 'AUD:READ',
    '/dashboard/hr': 'HRM:READ',
    '/dashboard/margin': 'MGN:READ',
    '/dashboard/payment-requests': 'PAY:READ',
    '/dashboard/proposals': 'PRO:READ',
    '/dashboard/shipments': 'SHP:READ',
    '/dashboard/media': 'MKT:READ',
    '/dashboard/pos': 'POS:READ',
    '/dashboard/pipeline': 'CRM:READ',
    '/dashboard/quotations': 'SLS:READ',
    '/dashboard/price-list': 'SLS:READ',
    '/dashboard/allocation': 'SLS:READ',
    '/dashboard/stamps': 'STP:READ',
    '/dashboard/stock-count': 'WMS:READ',
    '/dashboard/transfers': 'STM:READ',
    '/dashboard/returns': 'RTN:READ',
    '/dashboard/qr-codes': 'QRC:READ',
    '/dashboard/market-price': 'TAX:READ',
}

export async function middleware(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const isProduction = process.env.NODE_ENV === 'production'
    const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT_REF') && supabaseKey

    if (!isSupabaseConfigured) {
        if (isProduction) {
            return new NextResponse('Configuration Error: Supabase credentials are missing.', { status: 500 })
        }
        return NextResponse.next()
    }

    const authOnlyPaths = ['/login', '/forgot-password', '/reset-password']
    const publicPaths = [...authOnlyPaths, '/verify']
    if (!isProduction && (
        request.nextUrl.pathname.startsWith('/dashboard/sales/visits') ||
        request.nextUrl.pathname.startsWith('/dashboard/price-list') ||
        request.nextUrl.pathname.startsWith('/dashboard/customers')
    )) {
        return NextResponse.next()
    }
    const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))
    const isAgencyPath = request.nextUrl.pathname.startsWith('/portal')
    const isApiPath = request.nextUrl.pathname.startsWith('/api')
    const isPublicApi = request.nextUrl.pathname.startsWith('/api/telegram') || 
                        request.nextUrl.pathname.startsWith('/api/cron') ||
                        request.nextUrl.pathname.startsWith('/api/export/quotation-pdf')

    // Determine if we need to verify auth session in the middleware
    // Check auth for protected routes (non-public, non-agency, non-public-api)
    const needsAuthCheck = (!isApiPath || !isPublicApi) && !isAgencyPath

    let user = null
    let authTimedOut = false
    const requestHeaders = new Headers(request.headers)
    let supabaseResponse = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    if (needsAuthCheck) {
        // Quick check: If there are no Supabase auth cookies, the user is definitely not logged in.
        const hasSessionCookie = request.cookies.getAll().some(cookie => cookie.name.startsWith('sb-'))

        if (hasSessionCookie) {
            const { createServerClient } = await import('@supabase/ssr')
            const supabase = createServerClient(supabaseUrl, supabaseKey, {
                cookieOptions: {
                    maxAge: 60 * 60 * 24 * 365, // 365 days persistent session
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                },
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({
                            request: {
                                headers: requestHeaders,
                            },
                        })
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, {
                                ...options,
                                maxAge: 60 * 60 * 24 * 365, // Enforce 365 days persistence
                                sameSite: 'lax',
                                secure: process.env.NODE_ENV === 'production',
                                path: '/',
                            })
                        )
                    },
                },
            })

            try {
                // Generous timeout (4000ms) to ensure mobile 4G latency never aborts token refresh
                const authPromise = supabase.auth.getUser()
                const timeoutPromise = new Promise<{ data: { user: null } }>((_, reject) =>
                    setTimeout(() => reject(new Error('Auth check timeout')), 4000)
                )

                const { data: { user: authUser } } = await Promise.race([authPromise, timeoutPromise])
                user = authUser
            } catch (error) {
                console.error('Middleware auth check error/timeout:', error)
                if (error instanceof Error && error.message === 'Auth check timeout') {
                    authTimedOut = true
                }
            }
        }
    }

    // Redirect unauthenticated users to login (skip API + public + agency paths)
    if (!user && !authTimedOut && !isPublic && !isAgencyPath && !isApiPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    // Return 401 Unauthorized for non-public API endpoints
    if (!user && !authTimedOut && isApiPath && !isPublicApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RBAC enforcement — check permissions for dashboard routes
    if (user && request.nextUrl.pathname.startsWith('/dashboard/') && !isApiPath) {
        const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
            .sort((a, b) => b.length - a.length)
            .find(route => request.nextUrl.pathname.startsWith(route))

        if (matchedRoute) {
            // Store required permission in request header for server layout/components
            requestHeaders.set('x-required-permission', ROUTE_PERMISSIONS[matchedRoute])
            // Also keep on response headers for compatibility
            supabaseResponse.headers.set('x-required-permission', ROUTE_PERMISSIONS[matchedRoute])
        }
    }

    // Redirect authenticated users away from auth-only pages (/login, /forgot-password, /reset-password)
    const isAuthOnlyPath = authOnlyPaths.some(p => request.nextUrl.pathname.startsWith(p))
    if (user && isAuthOnlyPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
