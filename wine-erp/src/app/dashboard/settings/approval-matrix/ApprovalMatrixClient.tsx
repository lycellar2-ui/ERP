'use client'

import { useState } from 'react'
import { Shield, Save, ChevronRight, AlertTriangle, CheckCircle2, Settings2, DollarSign, Percent, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_LABELS } from '../../proposals/constants'
import { type ApprovalMatrixData, type ProposalRouteConfig, type ThresholdConfig, saveAllRoutes, saveAllThresholds } from './actions'

const LEVEL_LABELS: Record<number, { label: string; role: string; color: string; bg: string }> = {
    1: { label: 'Cấp 1', role: 'TP Bộ Phận', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    2: { label: 'Cấp 2', role: 'KT Trưởng', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    3: { label: 'Cấp 3', role: 'CEO', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
}

interface Props {
    initialData: ApprovalMatrixData
}

export function ApprovalMatrixClient({ initialData }: Props) {
    const [routes, setRoutes] = useState<ProposalRouteConfig[]>(initialData.proposalRoutes)
    const [thresholds, setThresholds] = useState<ThresholdConfig[]>(initialData.thresholds)
    const [savingRoutes, setSavingRoutes] = useState(false)
    const [savingThresholds, setSavingThresholds] = useState(false)
    const [dirty, setDirty] = useState({ routes: false, thresholds: false })

    const toggleLevel = (catIdx: number, level: number) => {
        setRoutes(prev => {
            const updated = [...prev]
            const current = updated[catIdx]
            const has = current.levels.includes(level)

            // CEO (level 3) must always be included
            if (level === 3 && has) {
                toast.error('CEO phải luôn có quyền duyệt cuối cùng')
                return prev
            }

            if (has) {
                updated[catIdx] = { ...current, levels: current.levels.filter(l => l !== level).sort() }
            } else {
                updated[catIdx] = { ...current, levels: [...current.levels, level].sort() }
            }
            return updated
        })
        setDirty(d => ({ ...d, routes: true }))
    }

    const updateThreshold = (idx: number, value: number) => {
        setThresholds(prev => {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], value }
            return updated
        })
        setDirty(d => ({ ...d, thresholds: true }))
    }

    const handleSaveRoutes = async () => {
        setSavingRoutes(true)
        toast.promise(
            saveAllRoutes(routes).then(r => {
                if (!r.success) throw new Error(r.error)
                setDirty(d => ({ ...d, routes: false }))
                return r
            }),
            {
                loading: 'Đang lưu ma trận phân quyền...',
                success: 'Đã cập nhật ma trận phê duyệt tờ trình!',
                error: 'Lỗi lưu cấu hình',
                finally: () => setSavingRoutes(false),
            }
        )
    }

    const handleSaveThresholds = async () => {
        setSavingThresholds(true)
        toast.promise(
            saveAllThresholds(thresholds).then(r => {
                if (!r.success) throw new Error(r.error)
                setDirty(d => ({ ...d, thresholds: false }))
                return r
            }),
            {
                loading: 'Đang lưu ngưỡng phê duyệt...',
                success: 'Đã cập nhật ngưỡng phê duyệt!',
                error: 'Lỗi lưu cấu hình',
                finally: () => setSavingThresholds(false),
            }
        )
    }

    const getRouteDescription = (levels: number[]): string => {
        return levels.map(l => LEVEL_LABELS[l]?.role ?? `Cấp ${l}`).join(' → ')
    }

    return (
        <div className="space-y-8 max-w-screen-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.3)' }}>
                        <Shield size={24} style={{ color: '#E05252' }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold"
                            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                            Ma Trận Phân Quyền Phê Duyệt
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                            Cấu hình luồng duyệt tờ trình, ngưỡng phê duyệt đơn hàng, và phân quyền theo cấp
                        </p>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 px-4 py-3 rounded-xl"
                style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#4A6A7A' }}>Chú giải:</span>
                {Object.entries(LEVEL_LABELS).map(([lv, cfg]) => (
                    <div key={lv} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold"
                            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
                            {lv}
                        </div>
                        <div>
                            <p className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.role}</p>
                            <p className="text-[10px]" style={{ color: '#4A6A7A' }}>{cfg.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ Section 1: Proposal Routing Matrix ═══ */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <FileText size={18} style={{ color: '#87CBB9' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>Luồng Phê Duyệt Tờ Trình</h3>
                            <p className="text-[11px]" style={{ color: '#4A6A7A' }}>Click vào ô để bật/tắt cấp duyệt cho từng loại tờ trình</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveRoutes}
                        disabled={!dirty.routes || savingRoutes}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                        style={{
                            background: dirty.routes ? '#87CBB9' : 'rgba(135,203,185,0.15)',
                            color: dirty.routes ? '#0A1926' : '#4A6A7A',
                        }}
                    >
                        {savingRoutes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingRoutes ? 'Đang lưu...' : dirty.routes ? 'Lưu Thay Đổi' : 'Đã lưu'}
                    </button>
                </div>

                {/* Matrix table */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead>
                            <tr style={{ background: '#0D1E2B' }}>
                                <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '35%' }}>Loại Tờ Trình</th>
                                {[1, 2, 3].map(lv => {
                                    const cfg = LEVEL_LABELS[lv]
                                    return (
                                        <th key={lv} className="px-4 py-3 text-center" style={{ width: '12%' }}>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.role}</span>
                                                <span className="text-[10px]" style={{ color: '#4A6A7A' }}>{cfg.label}</span>
                                            </div>
                                        </th>
                                    )
                                })}
                                <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A' }}>Luồng Duyệt</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.map((route, idx) => {
                                const catLabel = CATEGORY_LABELS[route.category] ?? route.category
                                const isDirectCEO = route.levels.length === 1 && route.levels[0] === 3
                                return (
                                    <tr key={route.category}
                                        style={{
                                            borderBottom: '1px solid rgba(42,67,85,0.5)',
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(20,36,51,0.4)',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,203,185,0.04)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(20,36,51,0.4)')}
                                    >
                                        <td className="px-5 py-3">
                                            <span className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                                {catLabel}
                                            </span>
                                        </td>
                                        {[1, 2, 3].map(lv => {
                                            const active = route.levels.includes(lv)
                                            const cfg = LEVEL_LABELS[lv]
                                            const isCEO = lv === 3
                                            return (
                                                <td key={lv} className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => toggleLevel(idx, lv)}
                                                        className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto transition-all duration-200"
                                                        style={{
                                                            background: active ? cfg.bg : 'rgba(42,67,85,0.2)',
                                                            border: `2px solid ${active ? cfg.color : '#2A4355'}`,
                                                            cursor: isCEO && active ? 'not-allowed' : 'pointer',
                                                        }}
                                                        title={isCEO && active ? 'CEO phải luôn duyệt cuối' : `${active ? 'Bỏ' : 'Thêm'} ${cfg.role}`}
                                                    >
                                                        {active ? (
                                                            <CheckCircle2 size={18} style={{ color: cfg.color }} />
                                                        ) : (
                                                            <div className="w-4 h-4 rounded-sm" style={{ background: '#2A4355', opacity: 0.5 }} />
                                                        )}
                                                    </button>
                                                </td>
                                            )
                                        })}
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {isDirectCEO && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{ background: 'rgba(224,82,82,0.12)', color: '#E05252' }}>
                                                        CEO TRỰC TIẾP
                                                    </span>
                                                )}
                                                {route.levels.map((lv, i) => {
                                                    const cfg = LEVEL_LABELS[lv]
                                                    return (
                                                        <span key={lv} className="flex items-center gap-1">
                                                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                                                                style={{ background: cfg.bg, color: cfg.color }}>
                                                                {cfg.role}
                                                            </span>
                                                            {i < route.levels.length - 1 && (
                                                                <ChevronRight size={12} style={{ color: '#4A6A7A' }} />
                                                            )}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ Section 2: Threshold Configuration ═══ */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <Settings2 size={18} style={{ color: '#D4A853' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>Ngưỡng Phê Duyệt Tự Động</h3>
                            <p className="text-[11px]" style={{ color: '#4A6A7A' }}>Khi vượt ngưỡng → tự động yêu cầu CEO phê duyệt</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveThresholds}
                        disabled={!dirty.thresholds || savingThresholds}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                        style={{
                            background: dirty.thresholds ? '#D4A853' : 'rgba(212,168,83,0.15)',
                            color: dirty.thresholds ? '#0A1926' : '#4A6A7A',
                        }}
                    >
                        {savingThresholds ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingThresholds ? 'Đang lưu...' : dirty.thresholds ? 'Lưu Ngưỡng' : 'Đã lưu'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0" style={{ background: '#0D1E2B' }}>
                    {thresholds.map((t, idx) => {
                        const isPercent = t.key.includes('discount') || t.key.includes('percent')
                        const Icon = isPercent ? Percent : DollarSign
                        return (
                            <div key={t.key}
                                className="flex items-center gap-4 px-5 py-5"
                                style={{
                                    borderBottom: idx < thresholds.length - 1 ? '1px solid rgba(42,67,85,0.5)' : 'none',
                                    borderRight: idx % 2 === 0 ? '1px solid rgba(42,67,85,0.5)' : 'none',
                                }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: isPercent ? 'rgba(74,143,171,0.12)' : 'rgba(212,168,83,0.12)' }}>
                                    <Icon size={18} style={{ color: isPercent ? '#4A8FAB' : '#D4A853' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{t.label}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: '#4A6A7A' }}>{t.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="number"
                                        value={t.value}
                                        onChange={e => updateThreshold(idx, Number(e.target.value))}
                                        className="w-40 px-3 py-2.5 rounded-lg text-sm text-right outline-none font-bold"
                                        style={{
                                            background: '#1B2E3D',
                                            border: '1px solid #2A4355',
                                            color: '#87CBB9',
                                            fontFamily: '"DM Mono", monospace',
                                        }}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')}
                                        step={isPercent ? 1 : 1_000_000}
                                    />
                                    <span className="text-xs font-bold" style={{ color: '#4A6A7A' }}>
                                        {isPercent ? '%' : '₫'}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══ Section 3: Quick reference summary ═══ */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} style={{ color: '#D4A853' }} />
                    <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>Tóm Tắt Quy Tắc Hiện Hành</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* SO rules */}
                    <div className="p-4 rounded-lg" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: '#87CBB9' }}>
                            Đơn Bán Hàng (SO)
                        </p>
                        <div className="space-y-1.5 text-xs">
                            {thresholds.filter(t => t.key.startsWith('so.')).map(t => (
                                <div key={t.key} className="flex justify-between">
                                    <span style={{ color: '#8AAEBB' }}>{t.label.replace('SO: ', '')}</span>
                                    <span className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                        {t.key.includes('discount') ? `${t.value}%` : `${(t.value / 1e6).toFixed(0)}M`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* PO rules */}
                    <div className="p-4 rounded-lg" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: '#D4A853' }}>
                            Đơn Mua Hàng (PO)
                        </p>
                        <div className="space-y-1.5 text-xs">
                            {thresholds.filter(t => t.key.startsWith('po.')).map(t => (
                                <div key={t.key} className="flex justify-between">
                                    <span style={{ color: '#8AAEBB' }}>{t.label.replace('PO: ', '')}</span>
                                    <span className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                        {`${(t.value / 1e6).toFixed(0)}M`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Proposals */}
                    <div className="p-4 rounded-lg" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                        <p className="text-xs uppercase tracking-wider font-bold mb-2" style={{ color: '#E05252' }}>
                            Tờ Trình — Luồng CEO
                        </p>
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>Số loại 3 cấp</span>
                                <span className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                    {routes.filter(r => r.levels.length === 3).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>Số loại 2 cấp</span>
                                <span className="font-bold" style={{ color: '#E8F1F2', fontFamily: '"DM Mono"' }}>
                                    {routes.filter(r => r.levels.length === 2).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#8AAEBB' }}>CEO trực tiếp</span>
                                <span className="font-bold" style={{ color: '#E05252', fontFamily: '"DM Mono"' }}>
                                    {routes.filter(r => r.levels.length === 1 && r.levels[0] === 3).length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
