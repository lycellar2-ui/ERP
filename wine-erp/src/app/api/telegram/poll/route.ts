import { NextResponse } from 'next/server'
import {
    isAuthorizedUser, sendMessage, parseCommand,
    type TelegramUpdate,
} from '@/lib/telegram'
import {
    handleStart, handleMenu, handleRevenue, handleOrders,
    handleApprovals, handleStock, handleDebt, handleSearch,
    handleReport, handleCallbackQuery,
} from '@/lib/telegram-commands'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

let lastOffset = 0

async function processUpdate(update: TelegramUpdate) {
    // Handle callback queries (button clicks)
    if (update.callback_query) {
        const userId = update.callback_query.from.id
        if (!isAuthorizedUser(userId)) return
        await handleCallbackQuery(update.callback_query)
        return
    }

    // Handle text messages
    const message = update.message
    if (!message?.text || !message.from) return

    const userId = message.from.id
    const chatId = message.chat.id

    if (!isAuthorizedUser(userId)) {
        await sendMessage(chatId,
            '🔒 <b>Truy cập bị từ chối</b>\n\n' +
            'Bạn không có quyền sử dụng bot này.\n' +
            `Your Telegram ID: <code>${userId}</code>`
        )
        return
    }

    const { command, args } = parseCommand(message.text)

    switch (command) {
        case 'start': await handleStart(chatId); break
        case 'menu': await handleMenu(chatId); break
        case 'doanhthu': case 'revenue': await handleRevenue(chatId); break
        case 'donhang': case 'orders': await handleOrders(chatId); break
        case 'pheduyet': case 'approvals': await handleApprovals(chatId); break
        case 'tonkho': case 'stock': await handleStock(chatId); break
        case 'congno': case 'debt': await handleDebt(chatId); break
        case 'timkiem': case 'search': await handleSearch(chatId, args); break
        case 'baocao': case 'report': await handleReport(chatId); break
        default:
            if (message.text && !message.text.startsWith('/')) {
                await handleSearch(chatId, message.text)
            } else {
                await sendMessage(chatId,
                    '❓ Lệnh không nhận diện được.\n\nGõ /menu để xem menu chính.'
                )
            }
    }
}

/**
 * GET /api/telegram/poll
 * 
 * Long-polling endpoint for local development.
 * Fetches updates from Telegram and processes them.
 */
export async function GET() {
    if (!BOT_TOKEN) {
        return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
    }

    try {
        // First, delete any existing webhook so polling works
        await fetch(`${API}/deleteWebhook`, { method: 'POST' })

        const res = await fetch(`${API}/getUpdates?offset=${lastOffset}&timeout=0&limit=10`)
        const data = await res.json()

        if (!data.ok) {
            return NextResponse.json({ error: data.description }, { status: 500 })
        }

        const updates: TelegramUpdate[] = data.result
        let processed = 0

        for (const update of updates) {
            try {
                await processUpdate(update)
                processed++
            } catch (err) {
                console.error('[Poll] Error processing update:', err)
            }
            lastOffset = update.update_id + 1
        }

        return NextResponse.json({
            ok: true,
            processed,
            total: updates.length,
            lastOffset,
        })
    } catch (err) {
        console.error('[Poll] Error:', err)
        return NextResponse.json({ error: 'Polling failed' }, { status: 500 })
    }
}
