import { NextRequest, NextResponse } from 'next/server'
import {
    isAuthorizedUser, sendMessage, parseCommand,
    type TelegramUpdate,
} from '@/lib/telegram'
import {
    handleStart, handleMenu, handleRevenue, handleOrders,
    handleApprovals, handleStock, handleDebt, handleSearch,
    handleReport, handleCallbackQuery,
} from '@/lib/telegram-commands'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''

/**
 * POST /api/telegram
 * 
 * Telegram Webhook endpoint.
 * Receives updates from Telegram Bot API and routes to handlers.
 */
export async function POST(req: NextRequest) {
    // ── Verify webhook secret (always required) ──────────
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token')
    if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    let update: TelegramUpdate

    try {
        update = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    try {
        // ── Handle callback queries (button clicks)──
        if (update.callback_query) {
            const userId = update.callback_query.from.id
            if (!isAuthorizedUser(userId)) {
                return NextResponse.json({ ok: true })
            }
            await handleCallbackQuery(update.callback_query)
            return NextResponse.json({ ok: true })
        }

        // ── Handle text messages ────────────────────
        const message = update.message
        if (!message?.text || !message.from) {
            return NextResponse.json({ ok: true })
        }

        const userId = message.from.id
        const chatId = message.chat.id

        // Authorization check
        if (!isAuthorizedUser(userId)) {
            await sendMessage(chatId,
                '🔒 <b>Truy cập bị từ chối</b>\n\n' +
                'Bạn không có quyền sử dụng bot này. Vui lòng liên hệ admin.\n' +
                `Your Telegram ID: <code>${userId}</code>`
            )
            return NextResponse.json({ ok: true })
        }

        // Parse command
        const { command, args } = parseCommand(message.text)

        switch (command) {
            case 'start':
                await handleStart(chatId)
                break
            case 'menu':
                await handleMenu(chatId)
                break
            case 'doanhthu':
            case 'revenue':
                await handleRevenue(chatId)
                break
            case 'donhang':
            case 'orders':
                await handleOrders(chatId)
                break
            case 'pheduyet':
            case 'approvals':
                await handleApprovals(chatId)
                break
            case 'tonkho':
            case 'stock':
                await handleStock(chatId)
                break
            case 'congno':
            case 'debt':
                await handleDebt(chatId)
                break
            case 'timkiem':
            case 'search':
                await handleSearch(chatId, args)
                break
            case 'baocao':
            case 'report':
                await handleReport(chatId)
                break
            default:
                // Try to detect natural language queries
                if (message.text && !message.text.startsWith('/')) {
                    // Treat non-command messages as search
                    await handleSearch(chatId, message.text)
                } else {
                    await sendMessage(chatId,
                        '❓ Lệnh không nhận diện được.\n\n' +
                        'Gõ /menu để xem menu chính, hoặc /start để xem hướng dẫn.'
                    )
                }
        }
    } catch (err) {
        console.error('[Telegram Webhook Error]', err)
        // Always return 200 to Telegram to prevent retries
        const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id
        if (chatId) {
            await sendMessage(chatId, '⚠️ Hệ thống đang gặp lỗi tạm thời. Vui lòng thử lại sau.')
        }
    }

    return NextResponse.json({ ok: true })
}

/**
 * GET /api/telegram
 * Health check endpoint
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        bot: 'LY\'s Cellars ERP Bot',
        version: '1.0',
        commands: [
            '/start', '/menu', '/doanhthu', '/donhang',
            '/pheduyet', '/tonkho', '/congno', '/timkiem', '/baocao',
        ],
    })
}
