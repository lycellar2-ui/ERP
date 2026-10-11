'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    Bot, CheckCircle2, XCircle, AlertTriangle, Send, Terminal, Bell,
    Play, FileText, DollarSign, Package, Factory, CreditCard, Search,
    BarChart3, Ship, BookOpen, ArrowLeft, Loader2
} from 'lucide-react'
import { sendTestNotification } from './actions'

type BotStatus = {
    configured: boolean
    webhookUrl: string | null
    webhookActive: boolean
    pendingUpdates: number
    lastError: string | null
    ceoChatId: string | null
    allowedChatIds: string
}

const BOT_COMMANDS = [
    { cmd: '/start', desc: 'Giới thiệu & danh sách lệnh', icon: Play },
    { cmd: '/menu', desc: 'Menu chính (inline keyboard)', icon: Terminal },
    { cmd: '/doanhthu', desc: 'Doanh thu tháng/hôm nay', icon: DollarSign },
    { cmd: '/donhang', desc: 'Đơn hàng gần đây', icon: Package },
    { cmd: '/pheduyet', desc: 'Phê duyệt chờ xử lý', icon: CheckCircle2 },
    { cmd: '/tonkho', desc: 'Tổng quan tồn kho', icon: Factory },
    { cmd: '/congno', desc: 'Công nợ phải thu (AR)', icon: CreditCard },
    { cmd: '/timkiem', desc: 'Tìm kiếm đa module', icon: Search },
    { cmd: '/baocao', desc: 'Báo cáo tổng hợp nhanh', icon: BarChart3 },
]

const PUSH_EVENTS = [
    { event: 'SO cần phê duyệt', icon: CheckCircle2, active: true },
    { event: 'Hóa đơn quá hạn thanh toán', icon: AlertTriangle, active: true },
    { event: 'Lô hàng sắp cập cảng', icon: Ship, active: true },
    { event: 'Tồn kho thấp dưới ngưỡng', icon: Package, active: true },
    { event: 'Hợp đồng sắp hết hạn', icon: FileText, active: true },
]

export function TelegramSettingsClient({ status }: { status: BotStatus }) {
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<{ isSuccess: boolean; message: string } | null>(null)

    const handleTestNotification = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const result = await sendTestNotification()
            setTestResult({
                isSuccess: result.success,
                message: result.success ? 'Gửi thông báo thử nghiệm thành công!' : `Lỗi: ${result.error}`
            })
        } catch {
            setTestResult({
                isSuccess: false,
                message: 'Lỗi kết nối đến máy chủ'
            })
        } finally {
            setTesting(false)
        }
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl space-y-6">
            {/* Header */}
            <div>
                <Link
                    href="/dashboard/settings"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
                >
                    <ArrowLeft size={14} />
                    <span>Quay lại Cài Đặt</span>
                </Link>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                    <Bot size={26} className="text-[#0891B2]" />
                    <span>Telegram Bot</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Quản lý kết nối Telegram Bot cho CEO Dashboard & thông báo tự động
                </p>
            </div>

            {/* Status Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Connection Status */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs ${status.configured ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.configured ? 'bg-emerald-600 shadow-[0_0_8px_rgba(21,128,61,0.5)]' : 'bg-rose-600 shadow-[0_0_8px_rgba(185,28,28,0.5)]'}`} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">BOT TOKEN</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {status.configured ? (
                            <>
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                <span>Đã cấu hình</span>
                            </>
                        ) : (
                            <>
                                <XCircle size={15} className="text-rose-600 shrink-0" />
                                <span>Chưa cấu hình</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Webhook Status */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs ${status.webhookActive ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.webhookActive ? 'bg-emerald-600 shadow-[0_0_8px_rgba(21,128,61,0.5)]' : 'bg-amber-600 shadow-[0_0_8px_rgba(180,83,9,0.5)]'}`} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">WEBHOOK</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {status.webhookActive ? (
                            <>
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                <span>Đã kích hoạt</span>
                            </>
                        ) : (
                            <>
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span>Chưa kích hoạt</span>
                            </>
                        )}
                    </div>
                    {status.webhookUrl && (
                        <div className="text-[11px] text-slate-500 font-mono mt-1.5 break-all">
                            {status.webhookUrl}
                        </div>
                    )}
                </div>

                {/* CEO Chat */}
                <div className={`p-4 rounded-xl border bg-white shadow-2xs ${status.ceoChatId ? 'border-emerald-500/20' : 'border-rose-500/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.ceoChatId ? 'bg-emerald-600 shadow-[0_0_8px_rgba(21,128,61,0.5)]' : 'bg-rose-600 shadow-[0_0_8px_rgba(185,28,28,0.5)]'}`} />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CEO CHAT ID</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                        {status.ceoChatId ? (
                            <>
                                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                <span className="font-mono">{status.ceoChatId}</span>
                            </>
                        ) : (
                            <>
                                <XCircle size={15} className="text-rose-600 shrink-0" />
                                <span>Chưa cấu hình</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Error Alert */}
            {status.lastError && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span><strong>Lỗi gần nhất:</strong> {status.lastError}</span>
                </div>
            )}

            {/* Commands Section */}
            <div className="p-4 sm:p-6 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <Terminal size={17} className="text-[#0891B2]" />
                    <span>Các lệnh Bot</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {BOT_COMMANDS.map((c) => {
                        const Icon = c.icon
                        return (
                            <div key={c.cmd} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-md bg-white border border-slate-200/80 flex items-center justify-center shrink-0 text-[#0891B2]">
                                    <Icon size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <code className="text-xs font-bold text-[#0891B2] font-mono block">{c.cmd}</code>
                                    <div className="text-[11px] text-slate-500 truncate">{c.desc}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Notification Events Section */}
            <div className="p-4 sm:p-6 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                    <Bell size={17} className="text-[#0891B2]" />
                    <span>Thông báo tự động (Push)</span>
                </h2>
                <div className="space-y-2">
                    {PUSH_EVENTS.map((n) => {
                        const Icon = n.icon
                        return (
                            <div key={n.event} className="p-2.5 sm:p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2.5">
                                <Icon size={15} className="text-slate-400 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800 flex-1">{n.event}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                    n.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                    {n.active ? 'Bật' : 'Tắt'}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 sm:p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Send size={17} className="text-[#0891B2]" />
                    <span>Hành động</span>
                </h2>
                <div>
                    <button
                        onClick={handleTestNotification}
                        disabled={testing || !status.configured}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white transition-all shadow-xs cursor-pointer ${
                            testing || !status.configured
                                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                        }`}
                    >
                        {testing ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                <span>Đang gửi...</span>
                            </>
                        ) : (
                            <>
                                <Send size={13} />
                                <span>Gửi test notification</span>
                            </>
                        )}
                    </button>
                </div>
                {testResult && (
                    <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        testResult.isSuccess
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}>
                        {testResult.isSuccess ? (
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        ) : (
                            <XCircle size={14} className="text-rose-600 shrink-0" />
                        )}
                        <span>{testResult.message}</span>
                    </div>
                )}
            </div>

            {/* Setup Guide */}
            <div className="p-4 sm:p-6 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <BookOpen size={17} className="text-[#0891B2]" />
                    <span>Hướng dẫn cài đặt</span>
                </h2>
                <ol className="text-xs sm:text-sm text-slate-600 space-y-3 list-decimal pl-5">
                    <li>Tạo bot trên Telegram qua <strong>@BotFather</strong> → nhận <code className="text-[#0891B2] font-mono">BOT_TOKEN</code></li>
                    <li>Thêm vào <code className="text-[#0891B2] font-mono">.env</code>:
                        <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono mt-1.5 overflow-x-auto">
{`TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=random_secret_string
TELEGRAM_CEO_CHAT_ID=your_telegram_user_id
TELEGRAM_ALLOWED_CHAT_IDS=id1,id2
TELEGRAM_SETUP_SECRET=lyscellars-setup-2026`}
                        </pre>
                    </li>
                    <li>Mở bot trên Telegram, gửi <code className="text-[#0891B2] font-mono">/start</code> → ghi lại Telegram ID hiển thị</li>
                    <li>Deploy lên hệ thống, sau đó gọi URL cấu hình:
                        <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono mt-1.5 overflow-x-auto">
{`https://your-domain.com/api/telegram/setup?action=register&secret=lyscellars-setup-2026`}
                        </pre>
                    </li>
                    <li>Quay lại Telegram → gõ <code className="text-[#0891B2] font-mono">/menu</code> để bắt đầu sử dụng.</li>
                </ol>
            </div>
        </div>
    )
}
