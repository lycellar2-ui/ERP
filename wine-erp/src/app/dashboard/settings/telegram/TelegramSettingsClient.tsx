'use client'

import { useState } from 'react'
import Link from 'next/link'
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

export function TelegramSettingsClient({ status }: { status: BotStatus }) {
    const [testing, setTesting] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)

    const handleTestNotification = async () => {
        setTesting(true)
        setTestResult(null)
        try {
            const result = await sendTestNotification()
            setTestResult(result.success ? '✅ Gửi thành công!' : `❌ Lỗi: ${result.error}`)
        } catch {
            setTestResult('❌ Lỗi kết nối')
        } finally {
            setTesting(false)
        }
    }

    return (
        <div style={{ padding: '24px', maxWidth: '900px' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <Link
                    href="/dashboard/settings"
                    style={{
                        color: '#8AAEBB',
                        textDecoration: 'none',
                        fontSize: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '12px',
                    }}
                >
                    ← Quay lại Cài Đặt
                </Link>
                <h1 style={{
                    color: '#E8F1F2',
                    fontSize: '28px',
                    fontWeight: 700,
                    margin: '0 0 8px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    🤖 Telegram Bot
                </h1>
                <p style={{ color: '#8AAEBB', margin: 0 }}>
                    Quản lý kết nối Telegram Bot cho CEO Dashboard & thông báo tự động
                </p>
            </div>

            {/* Status Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
            }}>
                {/* Connection Status */}
                <div style={{
                    background: '#1B2E3D',
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${status.configured ? '#5BA88A33' : '#E0525233'}`,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: status.configured ? '#5BA88A' : '#E05252',
                            boxShadow: `0 0 8px ${status.configured ? '#5BA88A' : '#E05252'}`,
                        }} />
                        <span style={{ color: '#8AAEBB', fontSize: '13px', fontWeight: 600 }}>BOT TOKEN</span>
                    </div>
                    <div style={{ color: '#E8F1F2', fontSize: '16px', fontWeight: 600 }}>
                        {status.configured ? '✅ Đã cấu hình' : '❌ Chưa cấu hình'}
                    </div>
                </div>

                {/* Webhook Status */}
                <div style={{
                    background: '#1B2E3D',
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${status.webhookActive ? '#5BA88A33' : '#D4A85333'}`,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: status.webhookActive ? '#5BA88A' : '#D4A853',
                            boxShadow: `0 0 8px ${status.webhookActive ? '#5BA88A' : '#D4A853'}`,
                        }} />
                        <span style={{ color: '#8AAEBB', fontSize: '13px', fontWeight: 600 }}>WEBHOOK</span>
                    </div>
                    <div style={{ color: '#E8F1F2', fontSize: '16px', fontWeight: 600 }}>
                        {status.webhookActive ? '🟢 Đã kích hoạt' : '🟡 Chưa kích hoạt'}
                    </div>
                    {status.webhookUrl && (
                        <div style={{
                            color: '#8AAEBB',
                            fontSize: '12px',
                            marginTop: '8px',
                            wordBreak: 'break-all',
                        }}>
                            {status.webhookUrl}
                        </div>
                    )}
                </div>

                {/* CEO Chat */}
                <div style={{
                    background: '#1B2E3D',
                    borderRadius: '12px',
                    padding: '20px',
                    border: `1px solid ${status.ceoChatId ? '#5BA88A33' : '#E0525233'}`,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: status.ceoChatId ? '#5BA88A' : '#E05252',
                            boxShadow: `0 0 8px ${status.ceoChatId ? '#5BA88A' : '#E05252'}`,
                        }} />
                        <span style={{ color: '#8AAEBB', fontSize: '13px', fontWeight: 600 }}>CEO CHAT ID</span>
                    </div>
                    <div style={{ color: '#E8F1F2', fontSize: '16px', fontWeight: 600 }}>
                        {status.ceoChatId ? `✅ ${status.ceoChatId}` : '❌ Chưa cấu hình'}
                    </div>
                </div>
            </div>

            {/* Error Alert */}
            {status.lastError && (
                <div style={{
                    background: '#3B1A1A',
                    border: '1px solid #E0525255',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '24px',
                    color: '#FCA5A5',
                    fontSize: '14px',
                }}>
                    ⚠️ <strong>Lỗi gần nhất:</strong> {status.lastError}
                </div>
            )}

            {/* Commands Section */}
            <div style={{
                background: '#1B2E3D',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <h2 style={{ color: '#E8F1F2', fontSize: '18px', margin: '0 0 16px 0' }}>
                    📋 Các lệnh Bot
                </h2>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px',
                }}>
                    {[
                        { cmd: '/start', desc: 'Giới thiệu & danh sách lệnh', icon: '🏁' },
                        { cmd: '/menu', desc: 'Menu chính (inline keyboard)', icon: '📋' },
                        { cmd: '/doanhthu', desc: 'Doanh thu tháng/hôm nay', icon: '💰' },
                        { cmd: '/donhang', desc: 'Đơn hàng gần đây', icon: '📦' },
                        { cmd: '/pheduyet', desc: 'Phê duyệt chờ xử lý', icon: '✅' },
                        { cmd: '/tonkho', desc: 'Tổng quan tồn kho', icon: '🏭' },
                        { cmd: '/congno', desc: 'Công nợ phải thu (AR)', icon: '💳' },
                        { cmd: '/timkiem', desc: 'Tìm kiếm đa module', icon: '🔍' },
                        { cmd: '/baocao', desc: 'Báo cáo tổng hợp nhanh', icon: '📊' },
                    ].map((c) => (
                        <div key={c.cmd} style={{
                            background: '#0F202D',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontSize: '20px' }}>{c.icon}</span>
                            <div>
                                <code style={{
                                    color: '#87CBB9',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                }}>{c.cmd}</code>
                                <div style={{ color: '#8AAEBB', fontSize: '12px', marginTop: '2px' }}>
                                    {c.desc}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notification Events Section */}
            <div style={{
                background: '#1B2E3D',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <h2 style={{ color: '#E8F1F2', fontSize: '18px', margin: '0 0 16px 0' }}>
                    🔔 Thông báo tự động (Push)
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                        { event: 'SO cần phê duyệt', icon: '✅', active: true },
                        { event: 'Hóa đơn quá hạn thanh toán', icon: '⚠️', active: true },
                        { event: 'Lô hàng sắp cập cảng', icon: '🚢', active: true },
                        { event: 'Tồn kho thấp dưới ngưỡng', icon: '📦', active: true },
                        { event: 'Hợp đồng sắp hết hạn', icon: '📋', active: true },
                    ].map((n) => (
                        <div key={n.event} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 16px',
                            background: '#0F202D',
                            borderRadius: '8px',
                        }}>
                            <span style={{ fontSize: '18px' }}>{n.icon}</span>
                            <span style={{ color: '#E8F1F2', fontSize: '14px', flex: 1 }}>{n.event}</span>
                            <span style={{
                                fontSize: '12px',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                background: n.active ? '#5BA88A22' : '#E0525222',
                                color: n.active ? '#5BA88A' : '#E05252',
                                fontWeight: 600,
                            }}>
                                {n.active ? 'Bật' : 'Tắt'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div style={{
                background: '#1B2E3D',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px',
            }}>
                <h2 style={{ color: '#E8F1F2', fontSize: '18px', margin: '0 0 16px 0' }}>
                    ⚡ Hành động
                </h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleTestNotification}
                        disabled={testing || !status.configured}
                        style={{
                            background: testing ? '#5BA88A66' : '#5BA88A',
                            color: '#0A1926',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 24px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: testing || !status.configured ? 'not-allowed' : 'pointer',
                            opacity: !status.configured ? 0.5 : 1,
                        }}
                    >
                        {testing ? '⏳ Đang gửi...' : '🧪 Gửi test notification'}
                    </button>
                </div>
                {testResult && (
                    <div style={{
                        marginTop: '12px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        background: testResult.startsWith('✅') ? '#5BA88A15' : '#E0525215',
                        color: testResult.startsWith('✅') ? '#5BA88A' : '#FCA5A5',
                        fontSize: '14px',
                    }}>
                        {testResult}
                    </div>
                )}
            </div>

            {/* Setup Guide */}
            <div style={{
                background: '#1B2E3D',
                borderRadius: '12px',
                padding: '24px',
            }}>
                <h2 style={{ color: '#E8F1F2', fontSize: '18px', margin: '0 0 16px 0' }}>
                    📖 Hướng dẫn cài đặt
                </h2>
                <ol style={{
                    color: '#8AAEBB',
                    fontSize: '14px',
                    lineHeight: '2',
                    paddingLeft: '20px',
                    margin: 0,
                }}>
                    <li>Tạo bot trên Telegram qua <strong>@BotFather</strong> → nhận <code style={{ color: '#87CBB9' }}>BOT_TOKEN</code></li>
                    <li>Thêm vào <code style={{ color: '#87CBB9' }}>.env</code>:
                        <pre style={{
                            background: '#0F202D',
                            padding: '12px',
                            borderRadius: '8px',
                            marginTop: '8px',
                            overflow: 'auto',
                            color: '#E8F1F2',
                            fontSize: '13px',
                        }}>
                            {`TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_SECRET=random_secret_string
TELEGRAM_CEO_CHAT_ID=your_telegram_user_id
TELEGRAM_ALLOWED_CHAT_IDS=id1,id2
TELEGRAM_SETUP_SECRET=lyscellars-setup-2026`}
                        </pre>
                    </li>
                    <li>Mở bot trên Telegram, gửi <code style={{ color: '#87CBB9' }}>/start</code> → ghi lại Telegram ID hiển thị</li>
                    <li>Deploy lên Vercel, sau đó truy cập URL:
                        <pre style={{
                            background: '#0F202D',
                            padding: '12px',
                            borderRadius: '8px',
                            marginTop: '8px',
                            overflow: 'auto',
                            color: '#E8F1F2',
                            fontSize: '13px',
                        }}>
                            {`https://your-domain.com/api/telegram/setup?action=register&secret=lyscellars-setup-2026`}
                        </pre>
                    </li>
                    <li>Quay lại Telegram → gõ <code style={{ color: '#87CBB9' }}>/menu</code> để bắt đầu sử dụng 🎉</li>
                </ol>
            </div>
        </div>
    )
}
