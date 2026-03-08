import { generateCEONarrative } from '@/lib/ai-service'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
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
