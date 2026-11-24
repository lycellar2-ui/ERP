'use client'

import { useState } from 'react'
import { Loader2, Shield, AlertCircle, Ship, FileText } from 'lucide-react'
import { authenticatePartner, getPartnerPortalData, type PartnerShipmentView, type AgencySubmissionRow } from '../dashboard/agency/actions'
import {
    Button, Card, CardBody, EmptyState, Field, Input,
    StatusBadge, Table, TBody, Td, Th, THead, Tr,
} from '@/components/ui'
import type { Tone } from '@/lib/ui/status'

const STATUS_LABELS: Record<string, string> = {
    BOOKED: 'Đã Đặt',
    ON_VESSEL: 'Trên Tàu',
    ARRIVED_PORT: 'Đến Cảng',
    CUSTOMS_HOLD: 'Chờ HQ',
    CLEARED: 'Thông Quan',
    COMPLETED: 'Hoàn Tất',
    PENDING_REVIEW: 'Chờ Duyệt',
    APPROVED: 'Đã Duyệt',
    REJECTED: 'Từ Chối',
}

const PARTNER_TONE_OVERRIDES: Record<string, Tone> = {
    BOOKED: 'info',
    ON_VESSEL: 'warning',
    ARRIVED_PORT: 'brand',
    CUSTOMS_HOLD: 'danger',
    CLEARED: 'success',
    COMPLETED: 'neutral',
    PENDING_REVIEW: 'warning',
}

const PARTNER_TYPE: Record<string, string> = {
    CUSTOMS_BROKER: 'Đại lý Hải Quan',
    FORWARDER: 'Forwarder',
    SURVEYOR: 'Giám Định',
}

export default function PartnerLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Logged in state
    const [partner, setPartner] = useState<{ id: string; name: string; type: string; code: string } | null>(null)
    const [shipments, setShipments] = useState<PartnerShipmentView[]>([])
    const [submissions, setSubmissions] = useState<AgencySubmissionRow[]>([])
    const [portalLoading, setPortalLoading] = useState(false)

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!email || !password) return
        setLoading(true)
        setError('')
        const result = await authenticatePartner(email, password)
        if (result.success && result.partner) {
            setPartner(result.partner)
            setPortalLoading(true)
            const data = await getPartnerPortalData(result.partner.id)
            setShipments(data.shipments)
            setSubmissions(data.submissions)
            setPortalLoading(false)
        } else {
            setError(result.error ?? 'Đăng nhập thất bại')
        }
        setLoading(false)
    }

    const formatDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')

    // ──── PORTAL VIEW ────
    if (partner) {
        return (
            <div className="min-h-[100dvh] bg-lys-bg">
                <header className="bg-lys-surface border-b border-lys-border">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-lys-teal-soft text-lys-teal-strong border border-tone-brand-border shrink-0">
                                <Shield size={20} aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold font-brand text-lys-primary truncate">
                                    {partner.name}
                                </h1>
                                <p className="text-xs text-lys-muted truncate">
                                    {PARTNER_TYPE[partner.type] ?? partner.type} · {partner.code}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setPartner(null); setEmail(''); setPassword('') }}
                        >
                            Đăng Xuất
                        </Button>
                    </div>
                </header>

                <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
                    {portalLoading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 size={32} className="animate-spin text-lys-teal-strong" />
                        </div>
                    ) : (
                        <>
                            {/* Shipments */}
                            <section className="space-y-3">
                                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lys-teal-strong">
                                    <Ship size={15} aria-hidden />
                                    <span>Lô Hàng Được Phân Công ({shipments.length})</span>
                                </h2>
                                {shipments.length === 0 ? (
                                    <Card>
                                        <EmptyState
                                            icon={Ship}
                                            title="Chưa có lô hàng nào được phân công"
                                            description="Các lô hàng mới khi được gán cho đơn vị sẽ hiển thị tại đây."
                                        />
                                    </Card>
                                ) : (
                                    <Table>
                                        <THead>
                                            <Tr>
                                                <Th>B/L</Th>
                                                <Th>Tàu</Th>
                                                <Th>ETA</Th>
                                                <Th>Trạng Thái</Th>
                                                <Th align="right">Submissions</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            {shipments.map(s => (
                                                <Tr key={s.id}>
                                                    <Td className="font-bold text-lys-teal-strong font-mono">{s.billOfLading}</Td>
                                                    <Td className="text-lys-primary">{s.vesselName ?? '—'}</Td>
                                                    <Td className="text-xs text-lys-secondary">{formatDate(s.eta)}</Td>
                                                    <Td>
                                                        <StatusBadge
                                                            status={s.status}
                                                            label={STATUS_LABELS[s.status] ?? s.status}
                                                            toneOverrides={PARTNER_TONE_OVERRIDES}
                                                        />
                                                    </Td>
                                                    <Td align="right" className="font-semibold text-lys-secondary">{s.submissionCount}</Td>
                                                </Tr>
                                            ))}
                                        </TBody>
                                    </Table>
                                )}
                            </section>

                            {/* Submissions History */}
                            <section className="space-y-3">
                                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tone-warning-fg">
                                    <FileText size={15} aria-hidden />
                                    <span>Lịch Sử Nộp Hồ Sơ ({submissions.length})</span>
                                </h2>
                                {submissions.length === 0 ? (
                                    <Card>
                                        <EmptyState
                                            icon={FileText}
                                            title="Chưa có hồ sơ nào"
                                            description="Lịch sử nộp hồ sơ thông quan và chứng từ sẽ được ghi nhận tại đây."
                                        />
                                    </Card>
                                ) : (
                                    <Table>
                                        <THead>
                                            <Tr>
                                                <Th>B/L</Th>
                                                <Th>Số Tờ Khai</Th>
                                                <Th>Tài Liệu</Th>
                                                <Th>Trạng Thái</Th>
                                                <Th>Nộp Lúc</Th>
                                                <Th>Duyệt Lúc</Th>
                                            </Tr>
                                        </THead>
                                        <TBody>
                                            {submissions.map(s => (
                                                <Tr key={s.id}>
                                                    <Td className="text-xs font-bold text-lys-teal-strong font-mono">{s.shipmentBol ?? '—'}</Td>
                                                    <Td className="text-lys-primary">{s.declarationNo ?? '—'}</Td>
                                                    <Td className="text-xs text-lys-secondary">{s.documentCount} file</Td>
                                                    <Td>
                                                        <StatusBadge
                                                            status={s.status}
                                                            label={STATUS_LABELS[s.status] ?? s.status}
                                                            toneOverrides={PARTNER_TONE_OVERRIDES}
                                                        />
                                                    </Td>
                                                    <Td className="text-xs text-lys-muted">{formatDate(s.submittedAt)}</Td>
                                                    <Td className="text-xs text-lys-muted">{formatDate(s.reviewedAt)}</Td>
                                                </Tr>
                                            ))}
                                        </TBody>
                                    </Table>
                                )}
                            </section>
                        </>
                    )}
                </main>
            </div>
        )
    }

    // ──── LOGIN VIEW ────
    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-lys-bg">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center mx-auto mb-4 bg-lys-teal-soft text-lys-teal-strong border border-tone-brand-border">
                        <Shield size={26} aria-hidden />
                    </div>
                    <h1 className="text-2xl font-bold font-brand text-lys-primary">
                        Partner Portal
                    </h1>
                    <p className="text-sm mt-1 text-lys-muted">
                        Đăng nhập dành cho Đại lý / Forwarder / Giám định
                    </p>
                </div>

                <Card className="border-t-2 border-t-lys-teal-strong shadow-md">
                    <CardBody className="p-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            {error && (
                                <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs bg-tone-danger-bg border border-tone-danger-border text-tone-danger-fg">
                                    <AlertCircle size={14} className="shrink-0" aria-hidden />
                                    <span>{error}</span>
                                </div>
                            )}

                            <Field label="Email" required>
                                {id => (
                                    <Input
                                        id={id}
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="partner@agency.com"
                                    />
                                )}
                            </Field>

                            <Field label="Mật Khẩu" required>
                                {id => (
                                    <Input
                                        id={id}
                                        type="password"
                                        autoComplete="current-password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                )}
                            </Field>

                            <Button
                                type="submit"
                                variant="primary"
                                loading={loading}
                                disabled={!email || !password}
                                className="w-full h-11 text-sm font-semibold"
                            >
                                {!loading && <Shield size={16} aria-hidden />}
                                {loading ? 'Đang đăng nhập...' : 'Đăng Nhập'}
                            </Button>
                        </form>
                    </CardBody>
                </Card>

                <p className="text-center text-xs text-lys-muted">
                    Wine ERP — Agency Partner Portal v1.0
                </p>
            </div>
        </div>
    )
}
