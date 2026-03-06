/**
 * Telegram Bot API Client — LY's Cellars ERP
 * 
 * Zero-dependency client using native fetch.
 * Designed for webhook mode (Telegram → /api/telegram).
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

// ── Telegram Types ──────────────────────────────────

export type TelegramUpdate = {
    update_id: number
    message?: TelegramMessage
    callback_query?: TelegramCallbackQuery
}

export type TelegramMessage = {
    message_id: number
    from?: TelegramUser
    chat: TelegramChat
    date: number
    text?: string
    entities?: { type: string; offset: number; length: number }[]
}

export type TelegramCallbackQuery = {
    id: string
    from: TelegramUser
    message?: TelegramMessage
    data?: string
}

export type TelegramUser = {
    id: number
    is_bot: boolean
    first_name: string
    last_name?: string
    username?: string
}

export type TelegramChat = {
    id: number
    type: string
    first_name?: string
    last_name?: string
    username?: string
}

type InlineKeyboardButton = {
    text: string
    callback_data?: string
    url?: string
}

type InlineKeyboardMarkup = {
    inline_keyboard: InlineKeyboardButton[][]
}

export type SendMessageOptions = {
    parse_mode?: 'HTML' | 'MarkdownV2'
    reply_markup?: InlineKeyboardMarkup
    disable_web_page_preview?: boolean
}

// ── API Helpers ─────────────────────────────────────

async function callAPI(method: string, body: Record<string, unknown>) {
    if (!BOT_TOKEN) {
        console.log(`[Telegram Mock] ${method}:`, JSON.stringify(body).slice(0, 200))
        return { ok: true, result: { message_id: 1 } }
    }

    const res = await fetch(`${API}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!data.ok) {
        console.error(`[Telegram API Error] ${method}:`, data.description)
    }
    return data
}

// ── Public Methods ──────────────────────────────────

export async function sendMessage(
    chatId: number | string,
    text: string,
    options: SendMessageOptions = {}
) {
    return callAPI('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode ?? 'HTML',
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
    })
}

export async function sendMessageWithKeyboard(
    chatId: number | string,
    text: string,
    buttons: InlineKeyboardButton[][],
) {
    return sendMessage(chatId, text, {
        reply_markup: { inline_keyboard: buttons },
    })
}

export async function answerCallbackQuery(
    callbackQueryId: string,
    text?: string
) {
    return callAPI('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
    })
}

export async function editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options: SendMessageOptions = {}
) {
    return callAPI('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options.parse_mode ?? 'HTML',
        reply_markup: options.reply_markup,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
    })
}

export async function setWebhook(url: string, secret: string) {
    return callAPI('setWebhook', {
        url,
        secret_token: secret,
        allowed_updates: ['message', 'callback_query'],
        max_connections: 10,
    })
}

export async function deleteWebhook() {
    return callAPI('deleteWebhook', { drop_pending_updates: true })
}

export async function getWebhookInfo() {
    const res = await fetch(`${API}/getWebhookInfo`)
    return res.json()
}

// ── Authorization ───────────────────────────────────

const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .map(Number)

export function isAuthorizedUser(userId: number): boolean {
    if (ALLOWED_CHAT_IDS.length === 0) return true // No restriction if not configured
    return ALLOWED_CHAT_IDS.includes(userId)
}

// ── Notification Helper (for push alerts) ───────────

const CEO_CHAT_ID = process.env.TELEGRAM_CEO_CHAT_ID
    ? Number(process.env.TELEGRAM_CEO_CHAT_ID)
    : null

export async function notifyTelegram(message: string, buttons?: InlineKeyboardButton[][]) {
    if (!CEO_CHAT_ID) {
        console.log('[Telegram Notify Mock]', message.slice(0, 100))
        return { success: true }
    }

    try {
        if (buttons) {
            await sendMessageWithKeyboard(CEO_CHAT_ID, message, buttons)
        } else {
            await sendMessage(CEO_CHAT_ID, message)
        }
        return { success: true }
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[Telegram Notify Error]', errMsg)
        return { success: false, error: errMsg }
    }
}

// ── Formatting Utils ────────────────────────────────

export function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫'
}

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

export function parseCommand(text: string): { command: string; args: string } {
    const match = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/)
    if (!match) return { command: '', args: '' }
    return { command: match[1].toLowerCase(), args: match[2].trim() }
}
