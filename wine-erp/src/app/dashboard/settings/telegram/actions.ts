'use server'

import { getWebhookInfo } from '@/lib/telegram'

export async function getTelegramBotStatus() {
    try {
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
    } catch {
        return {
            configured: !!process.env.TELEGRAM_BOT_TOKEN,
            webhookUrl: null,
            webhookActive: false,
            pendingUpdates: 0,
            lastError: 'Could not connect to Telegram API',
            ceoChatId: process.env.TELEGRAM_CEO_CHAT_ID ?? null,
            allowedChatIds: process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '',
        }
    }
}

export async function sendTestNotification() {
    const { notifyTelegram } = await import('@/lib/telegram')

    const testMsg = `🧪 <b>Test Notification</b>
━━━━━━━━━━━━━━━━━━

✅ Kết nối Telegram Bot thành công!
🕐 Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}

<i>Đây là tin nhắn test từ LY's Cellars ERP.</i>`

    return notifyTelegram(testMsg)
}
