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
}

export async function middleware(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Skip auth checks if Supabase not yet configured or dev mode
    if (
        process.env.NODE_ENV === 'development' ||
        !supabaseUrl ||
        supabaseUrl.includes('YOUR_PROJECT_REF') ||
        !supabaseKey
    ) {
        return NextResponse.next()
    }

    const { createServerClient } = await import('@supabase/ssr')
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                supabaseResponse = NextResponse.next({ request })
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                )
            },
        },
    })

    const { data: { user } } = await supabase.auth.getUser()

    const publicPaths = ['/login', '/forgot-password', '/reset-password']
    const isPublic = publicPaths.some(p => request.nextUrl.pathname.startsWith(p))
    const isAgencyPath = request.nextUrl.pathname.startsWith('/portal')
    const isApiPath = request.nextUrl.pathname.startsWith('/api')

    // Redirect unauthenticated users to login (skip API + public + agency paths)
    if (!user && !isPublic && !isAgencyPath && !isApiPath) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(url)
    }

    // RBAC enforcement — check permissions for dashboard routes
    if (user && request.nextUrl.pathname.startsWith('/dashboard/') && !isApiPath) {
        const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
            route => request.nextUrl.pathname.startsWith(route)
        )

        if (matchedRoute) {
            // Store required permission in header for server components
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
