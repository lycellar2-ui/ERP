'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

export async function signIn(formData: FormData): Promise<{ error?: string }> {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'Email và mật khẩu bắt buộc' }
    }

    const supabase = await createServerSupabaseClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
        return { error: 'Email hoặc mật khẩu không đúng' }
    }

    redirect('/dashboard')
}

export async function signOut() {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    redirect('/login')
}
