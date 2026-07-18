import { type NextRequest, NextResponse } from 'next/server'

// Module → required permission mapping for RBAC enforcement
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
    '/dashboard/declarations': 'FIN:READ',
    '/dashboard/tax': 'TAX:READ',
    '/dashboard/costing': 'FIN:READ',
    '/dashboard/reports': 'RPT:READ',
    '/dashboard/crm': 'CRM:READ',
    '/dashboard/consignment': 'CSG:READ',
    '/dashboard/agency': 'AGN:READ',
    '/dashboard/settings': 'SYS:ADMIN',
    '/dashboard/kpi': 'RPT:READ',
    '/dashboard/ai': 'SYS:ADMIN',
    // Added for complete coverage
    '/dashboard/media': 'MDM:READ',
    '/dashboard/pos': 'SLS:READ',
    '/dashboard/pipeline': 'CRM:READ',
    '/dashboard/quotations': 'SLS:READ',
    '/dashboard/price-list': 'SLS:READ',
    '/dashboard/allocation': 'SLS:READ',
    '/dashboard/stamps': 'WMS:READ',
    '/dashboard/stock-count': 'WMS:READ',
    '/dashboard/transfers': 'WMS:READ',
    '/dashboard/returns': 'SLS:READ',
    '/dashboard/qr-codes': 'MDM:READ',
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

    const publicPaths = ['/login', '/forgot-password', '/reset-password', '/verify']
    const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))
    const isAgencyPath = request.nextUrl.pathname.startsWith('/portal')
    const isApiPath = request.nextUrl.pathname.startsWith('/api')
    const isPublicApi = request.nextUrl.pathname.startsWith('/api/telegram') || request.nextUrl.pathname.startsWith('/api/cron')

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
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            })

            try {
                // Set a strict timeout to prevent 504 Gateway Timeout if Supabase is cold-starting
                const authPromise = supabase.auth.getUser()
                const timeoutPromise = new Promise<{ data: { user: null } }>((_, reject) =>
                    setTimeout(() => reject(new Error('Auth check timeout')), 800)
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
        const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
            route => request.nextUrl.pathname.startsWith(route)
        )

        if (matchedRoute) {
            // Store required permission in request header for server layout/components
            requestHeaders.set('x-required-permission', ROUTE_PERMISSIONS[matchedRoute])
            // Also keep on response headers for compatibility
            supabaseResponse.headers.set('x-required-permission', ROUTE_PERMISSIONS[matchedRoute])
        }
    }

    // Redirect authenticated users away from login
    if (user && isPublic) {
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
