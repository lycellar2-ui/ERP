import { NextRequest, NextResponse } from 'next/server'
import { setWebhook, deleteWebhook, getWebhookInfo } from '@/lib/telegram'

const SETUP_SECRET = (process.env.TELEGRAM_SETUP_SECRET ?? 'lyscellars-setup-2026').trim()

/**
 * GET /api/telegram/setup?action=register|unregister|info&secret=xxx
 * 
 * One-time webhook setup endpoint.
 * Protected by a simple secret query param.
 * 
 * Usage:
 * Register: /api/telegram/setup?action=register&secret=lyscellars-setup-2026
 * Unregister: /api/telegram/setup?action=unregister&secret=lyscellars-setup-2026
 * Info: /api/telegram/setup?action=info&secret=lyscellars-setup-2026
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action') ?? 'info'
    const secret = searchParams.get('secret')

    // Simple protection
    if (secret !== SETUP_SECRET) {
        return NextResponse.json({
            error: 'Invalid secret',
            hint: `Expected length: ${SETUP_SECRET.length}, received: ${secret?.length ?? 0}`,
            envSet: !!process.env.TELEGRAM_SETUP_SECRET,
        }, { status: 403 })
    }

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('host') ?? ''
    const webhookUrl = `${appUrl.startsWith('http') ? appUrl : `https://${appUrl}`}/api/telegram`

    switch (action) {
        case 'register': {
            if (!process.env.TELEGRAM_BOT_TOKEN) {
                return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
            }
            const result = await setWebhook(webhookUrl, webhookSecret)
            return NextResponse.json({
                action: 'register',
                webhookUrl,
                result,
            })
        }

        case 'unregister': {
            const result = await deleteWebhook()
            return NextResponse.json({
                action: 'unregister',
                result,
            })
        }

        case 'info': {
            const result = await getWebhookInfo()
            return NextResponse.json({
                action: 'info',
                expectedUrl: webhookUrl,
                result,
            })
        }

        default:
            return NextResponse.json({
                error: 'Unknown action. Use: register, unregister, or info.',
                usage: {
                    register: '/api/telegram/setup?action=register&secret=YOUR_SECRET',
                    unregister: '/api/telegram/setup?action=unregister&secret=YOUR_SECRET',
                    info: '/api/telegram/setup?action=info&secret=YOUR_SECRET',
                },
            })
    }
}
