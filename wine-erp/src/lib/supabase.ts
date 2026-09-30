import { createServerClient } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'

// ─── Browser client (Client Components) ──────────────
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                maxAge: 60 * 60 * 24 * 365, // 365 days persistent session
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            },
        }
    )
}

// ─── Server client (Server Components / Actions) ─────
export async function createServerSupabaseClient() {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                maxAge: 60 * 60 * 24 * 365, // 365 days persistent session
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, {
                                ...options,
                                maxAge: 60 * 60 * 24 * 365, // Enforce 365 days
                                sameSite: 'lax',
                                secure: process.env.NODE_ENV === 'production',
                                path: '/',
                            })
                        )
                    } catch {
                        // Server Component — cookies set by middleware
                    }
                },
            },
        }
    )
}

// ─── Admin client — Service Role (bypasses RLS) ───────
// NEVER import this in client-side code
export function createAdminClient() {
    const { createClient } = require('@supabase/supabase-js')
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}
