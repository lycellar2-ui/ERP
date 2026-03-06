import { getTelegramBotStatus } from './actions'
import { TelegramSettingsClient } from './TelegramSettingsClient'

export const metadata = { title: 'Cài Đặt Telegram Bot | Wine ERP' }

export default async function TelegramSettingsPage() {
    const status = await getTelegramBotStatus()
    return <TelegramSettingsClient status={status} />
}
