'use client'

import { useState } from 'react'
import { QrCode, ExternalLink, ShieldCheck, ShieldAlert, Printer } from 'lucide-react'
import {
    PageHeader, StatGrid, StatCard, Button, Toolbar, SearchInput,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow,
    EmptyState, Badge,
} from '@/components/ui'
import { getQRCodes } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { QR_CODES_I18N } from './i18n'

interface QRRow {
    id: string; code: string; lotNo: string; skuCode: string; productName: string
    scanCount: number; firstScannedAt: Date | null; lastScannedAt: Date | null
    createdAt: Date; lotData: any
}

export function QRCodeClient({ initialData, stats }: {
    initialData: { rows: QRRow[]; total: number }
    stats: { total: number; scanned: number; unscanned: number }
}) {
    const { locale, formatNumber } = useAppLocale()
    const L = QR_CODES_I18N[locale]

    const [data, setData] = useState(initialData)
    const [search, setSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const handleSearch = async (q?: string) => {
        const query = q !== undefined ? q : search
        const result = await getQRCodes({ search: query })
        setData(result)
    }

    const handlePrint = async () => {
        const res = await fetch('/api/qr-print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
        })
        const html = await res.text()
        const w = window.open('', '_blank')
        if (w) {
            w.document.write(html)
            w.document.close()
        }
    }

    const toggleOne = (id: string, checked: boolean) => {
        const next = new Set(selectedIds)
        if (checked) next.add(id)
        else next.delete(id)
        setSelectedIds(next)
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description={L.header.description}
                actions={
                    selectedIds.size > 0 ? (
                        <Button variant="primary" size="sm" onClick={handlePrint}>
                            <Printer size={14} aria-hidden /> {L.header.printBtn(selectedIds.size)}
                        </Button>
                    ) : null
                }
            />

            <StatGrid className="grid-cols-1 sm:grid-cols-3">
                <StatCard label={L.stats.total} value={formatNumber(stats.total)} icon={QrCode} tone="brand" />
                <StatCard label={L.stats.scanned} value={formatNumber(stats.scanned)} icon={ShieldCheck} tone="success" />
                <StatCard label={L.stats.unscanned} value={formatNumber(stats.unscanned)} icon={ShieldAlert} tone="warning" />
            </StatGrid>

            <Toolbar
                right={
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <SearchInput
                            value={search}
                            onChange={e => {
                                const val = e.target.value
                                setSearch(val)
                                if (!val) handleSearch('')
                            }}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder={L.searchPlaceholder}
                            className="w-full sm:w-80"
                        />
                        <Button variant="secondary" size="sm" onClick={() => handleSearch()}>
                            {L.searchBtn}
                        </Button>
                    </div>
                }
            />

            {/* Desktop Table */}
            <div className="hidden md:block">
                <Table>
                    <THead>
                        <tr>
                            <Th className="w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === data.rows.length && data.rows.length > 0}
                                    onChange={e => {
                                        if (e.target.checked) setSelectedIds(new Set(data.rows.map(r => r.id)))
                                        else setSelectedIds(new Set())
                                    }}
                                    className="w-3.5 h-3.5 rounded accent-lys-teal-strong cursor-pointer"
                                />
                            </Th>
                            <Th>{L.table.qrCode}</Th>
                            <Th>{L.table.lotNo}</Th>
                            <Th>{L.table.sku}</Th>
                            <Th>{L.table.product}</Th>
                            <Th align="right">{L.table.scanCount}</Th>
                            <Th>{L.table.status}</Th>
                            <Th align="right">{L.table.link}</Th>
                        </tr>
                    </THead>
                    <TBody>
                        {data.rows.length === 0 ? (
                            <TableMessageRow colSpan={8}>
                                <EmptyState
                                    icon={QrCode}
                                    title={L.table.emptyTitle}
                                    description={L.table.emptyDescription}
                                />
                            </TableMessageRow>
                        ) : data.rows.map(qr => (
                            <Tr key={qr.id}>
                                <Td>
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(qr.id)}
                                        onChange={e => toggleOne(qr.id, e.target.checked)}
                                        className="w-3.5 h-3.5 rounded accent-lys-teal-strong cursor-pointer"
                                    />
                                </Td>
                                <Td className="type-number text-lys-teal-strong font-medium">
                                    {qr.code.split('-')[0]}...
                                </Td>
                                <Td className="type-number font-semibold text-tone-warning-fg">
                                    {qr.lotNo}
                                </Td>
                                <Td className="type-number text-lys-secondary">
                                    {qr.skuCode}
                                </Td>
                                <Td className="font-medium text-lys-primary">
                                    {qr.productName}
                                </Td>
                                <Td align="right" className="type-number font-semibold text-lys-primary">
                                    {qr.scanCount}
                                </Td>
                                <Td>
                                    {qr.scanCount === 0 ? (
                                        <Badge tone="neutral">{L.table.statusUnscanned}</Badge>
                                    ) : qr.scanCount === 1 ? (
                                        <Badge tone="success">
                                            <ShieldCheck size={11} className="mr-1" /> {L.table.statusAuthentic}
                                        </Badge>
                                    ) : (
                                        <Badge tone="warning">
                                            <ShieldAlert size={11} className="mr-1" /> {L.table.statusMultiScan(qr.scanCount)}
                                        </Badge>
                                    )}
                                </Td>
                                <Td align="right">
                                    <a
                                        href={`${baseUrl}/verify/${qr.code}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-lys-teal-strong hover:underline"
                                    >
                                        <ExternalLink size={12} /> {L.table.openLink}
                                    </a>
                                </Td>
                            </Tr>
                        ))}
                    </TBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
                {data.rows.length === 0 ? (
                    <div className="rounded-lg border border-lys-border bg-white p-6">
                        <EmptyState
                            icon={QrCode}
                            title={L.table.emptyTitle}
                            description={L.table.emptyDescription}
                        />
                    </div>
                ) : data.rows.map(qr => (
                    <div key={qr.id} className="rounded-lg border border-lys-border bg-white p-4 shadow-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2.5 min-w-0 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(qr.id)}
                                    onChange={e => toggleOne(qr.id, e.target.checked)}
                                    className="mt-1 w-4 h-4 rounded accent-lys-teal-strong"
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="type-number text-xs font-semibold text-tone-warning-fg">{qr.lotNo}</span>
                                        <span className="type-number text-xs text-lys-muted">• {qr.skuCode}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-lys-primary truncate mt-0.5">{qr.productName}</p>
                                </div>
                            </label>
                            {qr.scanCount === 0 ? (
                                <Badge tone="neutral">{L.table.statusUnscanned}</Badge>
                            ) : qr.scanCount === 1 ? (
                                <Badge tone="success">
                                    <ShieldCheck size={11} className="mr-1" /> {L.table.statusAuthentic}
                                </Badge>
                            ) : (
                                <Badge tone="warning">
                                    <ShieldAlert size={11} className="mr-1" /> {L.table.statusMultiScan(qr.scanCount)}
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-lys-border/60">
                            <span className="type-number text-lys-muted">
                                QR: <strong className="text-lys-teal-strong">{qr.code.split('-')[0]}...</strong>
                            </span>
                            <a
                                href={`${baseUrl}/verify/${qr.code}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-lys-teal-strong"
                            >
                                <ExternalLink size={12} /> {L.table.openLink}
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            <p className="type-caption text-lys-muted">
                {L.footerSummary(data.rows.length, data.total)}
            </p>
        </div>
    )
}
