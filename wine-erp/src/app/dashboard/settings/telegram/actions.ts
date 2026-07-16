'use server'

import { getWebhookInfo } from '@/lib/telegram'
import { requirePermission } from '@/lib/session'

export async function getTelegramBotStatus() {
    try {
        await requirePermission('SYS', 'ADMIN')
        const info = await getWebhookInfo()
        return {
            configured: !!process.env.TELEGRAM_BOT_TOKEN,
            webhookUrl: info?.result?.url ?? null,
            webhookActive: !!info?.result?.url,
            pendingUpdates: info?.result?.pending_update_count ?? 0,
            lastError: info?.result?.last_error_message ?? null,
            ceoChatId: process.env.TELEGRAM_CEO_CHAT_ID ?? null,
            allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '',
        }
    } catch (err: any) {
        return {
            configured: !!process.env.TELEGRAM_BOT_TOKEN,
            webhookUrl: null,
            webhookActive: false,
            pendingUpdates: 0,
            lastError: err.message || 'Could not connect to Telegram API',
            ceoChatId: process.env.TELEGRAM_CEO_CHAT_ID ?? null,
            allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '',
        }
    }
}

export async function sendTestNotification() {
    await requirePermission('SYS', 'ADMIN')
    const { notifyTelegram } = await import('@/lib/telegram')

    const testMsg = `🧪 <b>Test Notification</b>
━━━━━━━━━━━━━━━━━━

✅ Kết nối Telegram Bot thành công!
🕐 Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

<i>Đây là tin nhắn test từ LY's Cellars ERP.</i>`

    return notifyTelegram(testMsg)
}
