import { generateCEONarrative } from '@/lib/ai-service'
import { NextResponse } from 'next/server'
import { getCurrentUser, hasRole } from '@/lib/session'

export async function POST() {
    try {
        const user = await getCurrentUser()
        if (!user || !hasRole(user, 'CEO', 'ADMIN')) {
            return NextResponse.json({ error: 'Forbidden: CEO or Admin access required' }, { status: 403 })
        }
        const result = await generateCEONarrative()
        return NextResponse.json(result)
    } catch (err) {
        console.error('[CEO Summary API]', err)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 },
        )
    }
}
