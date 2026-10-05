'use client'

import { useState } from 'react'
import { Shield, Save, ChevronRight, AlertTriangle, Settings2, DollarSign, Percent, FileText, Loader2, Plus, Trash2, UserCheck, Layers, Edit3, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_LABELS } from '../../proposals/constants'
import { 
    type ApprovalMatrixData, 
    type ProposalRouteConfig, 
    type PORouteConfig,
    type ThresholdConfig, 
    type StepRoleConfig, 
    type SystemRoleInfo, 
    DEFAULT_PO_ROUTING,
} from './constants'
import { 
    saveAllRoutes, 
    saveAllThresholds,
    savePORoute,
} from './actions'
import { ShoppingBag } from 'lucide-react'

interface Props {
    initialData: ApprovalMatrixData
}

export function ApprovalMatrixClient({ initialData }: Props) {
    const safeProposalRoutes = initialData?.proposalRoutes ?? []
    const safeThresholds = initialData?.thresholds ?? []
    const availableRoles = initialData?.availableRoles ?? []

    const [routes, setRoutes] = useState<ProposalRouteConfig[]>(safeProposalRoutes)
    const [poRoute, setPoRoute] = useState<PORouteConfig>(initialData?.poRoute ?? DEFAULT_PO_ROUTING)
    const [thresholds, setThresholds] = useState<ThresholdConfig[]>(safeThresholds)
    const [savingRoutes, setSavingRoutes] = useState(false)
    const [savingPoRoute, setSavingPoRoute] = useState(false)
    const [savingThresholds, setSavingThresholds] = useState(false)
    const [dirty, setDirty] = useState({ routes: false, po: false, thresholds: false })
    
    // Modal state for editing a proposal route configuration
    const [editingCategory, setEditingCategory] = useState<string | null>(null)
    const [editDraft, setEditDraft] = useState<ProposalRouteConfig | null>(null)

    // Modal state for editing PO route
    const [editingPoModal, setEditingPoModal] = useState(false)
    const [poDraft, setPoDraft] = useState<PORouteConfig | null>(null)

    const getRoleName = (code: string) => {
        const found = availableRoles.find(r => r.code === code)
        return found ? found.name : code
    }

    const openEditModal = (route: ProposalRouteConfig) => {
        setEditingCategory(route.category)
        setEditDraft(JSON.parse(JSON.stringify(route)))
    }

    const openPoEditModal = () => {
        setPoDraft(JSON.parse(JSON.stringify(poRoute)))
        setEditingPoModal(true)
    }

    const handleSavePoDraft = () => {
        if (!poDraft) return
        if (poDraft.steps.length === 0) {
            toast.error('Phải có ít nhất 1 cấp phê duyệt')
            return
        }

        setPoRoute(poDraft)
        setDirty(d => ({ ...d, po: true }))
        setEditingPoModal(false)
        setPoDraft(null)
        toast.success('Đã cập nhật dự thảo ma trận duyệt PO')
    }

    const handleSavePoRoute = async () => {
        setSavingPoRoute(true)
        toast.promise(
            savePORoute(poRoute).then(r => {
                if (!r.success) throw new Error(r.error)
                setDirty(d => ({ ...d, po: false }))
                return r
            }),
            {
                loading: 'Đang lưu quy trình duyệt PO...',
                success: 'Đã cập nhật quy trình duyệt Đơn mua hàng (PO)!',
                error: 'Lỗi lưu cấu hình PO',
                finally: () => setSavingPoRoute(false),
            }
        )
    }

    const handleSaveEditDraft = () => {
        if (!editDraft) return
        if (editDraft.steps.length === 0) {
            toast.error('Phải có ít nhất 1 cấp phê duyệt')
            return
        }

        setRoutes(prev => prev.map(r => r.category === editDraft.category ? editDraft : r))
        setDirty(d => ({ ...d, routes: true }))
        setEditingCategory(null)
        setEditDraft(null)
        toast.success(`Đã cập nhật cấu hình cho ${CATEGORY_LABELS[editDraft.category] ?? editDraft.category}`)
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

    const updateThreshold = (idx: number, value: number) => {
        setThresholds(prev => {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], value }
            return updated
        })
        setDirty(d => ({ ...d, thresholds: true }))
    }

    return (
        <div className="space-y-8 max-w-screen-xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(8, 145, 178, 0.08)', border: '1px solid rgba(8, 145, 178, 0.25)' }}>
                        <Shield size={24} style={{ color: '#0891B2' }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold" style={{ color: '#0F172A' }}>
                            Ma Trận Phân Quyền & Luồng Duyệt
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                            Chủ động tùy chỉnh số cấp duyệt, phân quyền Role Tạo & Role Duyệt cho từng loại Tờ trình
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ Section 1: Proposal Routing Matrix ═══ */}
            <div className="rounded-lg overflow-hidden shadow-2xs" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-3">
                        <FileText size={18} style={{ color: '#0891B2' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Cấu Hình Luồng Duyệt Tờ Trình (Theo Cấp & Role)</h3>
                            <p className="text-[11px]" style={{ color: '#64748B' }}>Tùy chỉnh số cấp duyệt, Role tạo, và Role duyệt ở từng bước</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveRoutes}
                        disabled={!dirty.routes || savingRoutes}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-xs hover:opacity-90"
                        style={{
                            background: dirty.routes ? '#0891B2' : 'rgba(8, 145, 178, 0.08)',
                            color: dirty.routes ? '#FFFFFF' : '#64748B',
                        }}
                    >
                        {savingRoutes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingRoutes ? 'Đang lưu...' : dirty.routes ? 'Lưu Toàn Bộ Mẫu' : 'Đã lưu'}
                    </button>
                </div>

                {/* Matrix table */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                <th className="px-5 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '25%' }}>Loại Tờ Trình</th>
                                <th className="px-4 py-3.5 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '10%' }}>Số Cấp</th>
                                <th className="px-4 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '25%' }}>Quyền Tạo</th>
                                <th className="px-5 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '30%' }}>Quy Trình Duyệt Theo Role</th>
                                <th className="px-4 py-3.5 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '10%' }}>Tùy Chỉnh</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(routes ?? []).map((route, idx) => {
                                const catLabel = CATEGORY_LABELS[route.category] ?? route.category
                                const steps = route.steps ?? []
                                const creatorRoles = route.creatorRoles ?? []

                                return (
                                    <tr key={route.category}
                                        style={{
                                            borderBottom: '1px solid #E2E8F0',
                                            background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                                        }}
                                        className="hover:bg-slate-100/70 transition"
                                    >
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm font-bold block" style={{ color: '#0F172A' }}>
                                                {catLabel}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">{route.category}</span>
                                        </td>

                                        {/* Number of steps */}
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono"
                                                style={{ background: 'rgba(180,83,9,0.12)', color: '#B45309', border: '1px solid rgba(180,83,9,0.35)' }}>
                                                <Layers size={12} /> {steps.length} cấp
                                            </span>
                                        </td>

                                        {/* Creator Roles */}
                                        <td className="px-4 py-3.5">
                                            {creatorRoles.length === 0 ? (
                                                <span className="text-xs text-slate-400 font-medium italic">Tất cả các Role</span>
                                            ) : (
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {creatorRoles.map(rCode => (
                                                        <span key={rCode} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                            {getRoleName(rCode)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* Approval steps visual sequence */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {steps.map((st, i) => {
                                                    const isLast = i === steps.length - 1
                                                    const badge = isLast
                                                        ? { bg: 'rgba(225,29,72,0.08)', color: '#BE123C', border: 'rgba(225,29,72,0.25)' }
                                                        : i === 0
                                                        ? { bg: 'rgba(8,145,178,0.08)', color: '#0891B2', border: 'rgba(8,145,178,0.25)' }
                                                        : { bg: 'rgba(180,83,9,0.12)', color: '#B45309', border: 'rgba(180,83,9,0.3)' }
                                                    return (
                                                        <span key={i} className="flex items-center gap-1">
                                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-2xs"
                                                                style={{
                                                                    background: badge.bg,
                                                                    color: badge.color,
                                                                    border: `1px solid ${badge.border}`,
                                                                }}>
                                                                <span className="text-[9px] font-bold opacity-75 font-mono uppercase">Cấp {st.level}:</span>
                                                                {getRoleName(st.role)}
                                                            </span>
                                                            {i < steps.length - 1 && (
                                                                <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                                                            )}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </td>

                                        {/* Edit button */}
                                        <td className="px-4 py-3.5 text-center">
                                            <button
                                                onClick={() => openEditModal(route)}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer hover:bg-slate-100 hover:text-cyan-700 shadow-2xs"
                                                style={{ background: '#FFFFFF', color: '#0891B2', border: '1px solid #CBD5E1' }}
                                                title="Sửa số cấp và phân quyền Role"
                                            >
                                                <Edit3 size={13} /> Sửa
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ Section 2: PO Approval Matrix ═══ */}
            <div className="rounded-lg overflow-hidden shadow-2xs" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-3">
                        <ShoppingBag size={18} style={{ color: '#B45309' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Cấu Hình Luồng Duyệt Đơn Mua Hàng (PO - Procurement)</h3>
                            <p className="text-[11px]" style={{ color: '#64748B' }}>Tùy chỉnh số cấp duyệt, Role tạo, và Role duyệt ở từng bước đơn mua hàng</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSavePoRoute}
                        disabled={!dirty.po || savingPoRoute}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-xs hover:opacity-90"
                        style={{
                            background: dirty.po ? '#B45309' : 'rgba(180,83,9,0.15)',
                            color: dirty.po ? '#FFFFFF' : '#64748B',
                        }}
                    >
                        {savingPoRoute ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingPoRoute ? 'Đang lưu...' : dirty.po ? 'Lưu Cấu Hình PO' : 'Đã lưu'}
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                <th className="px-5 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '25%' }}>Nghiệp Vụ</th>
                                <th className="px-4 py-3.5 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '10%' }}>Số Cấp</th>
                                <th className="px-4 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '25%' }}>Quyền Tạo PO</th>
                                <th className="px-5 py-3.5 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '30%' }}>Quy Trình Duyệt Theo Role</th>
                                <th className="px-4 py-3.5 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#64748B', width: '10%' }}>Tùy Chỉnh</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }} className="hover:bg-slate-50 transition">
                                <td className="px-5 py-3.5">
                                    <span className="text-sm font-bold block" style={{ color: '#0F172A' }}>
                                        📦 Đơn Mua Hàng Quốc Tế & Nội Địa
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">procurement.purchase_order</span>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono"
                                        style={{ background: 'rgba(180,83,9,0.12)', color: '#B45309', border: '1px solid rgba(180,83,9,0.35)' }}>
                                        <Layers size={12} /> {poRoute.steps.length} cấp
                                    </span>
                                </td>

                                <td className="px-4 py-3.5">
                                    {poRoute.creatorRoles.length === 0 ? (
                                        <span className="text-xs text-slate-400 font-medium italic">Tất cả các Role</span>
                                    ) : (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {poRoute.creatorRoles.map(rCode => (
                                                <span key={rCode} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                    {getRoleName(rCode)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </td>

                                <td className="px-5 py-3.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {poRoute.steps.map((st, i) => {
                                            const isLast = i === poRoute.steps.length - 1
                                            const badge = isLast
                                                ? { bg: 'rgba(225,29,72,0.08)', color: '#BE123C', border: 'rgba(225,29,72,0.25)' }
                                                : i === 0
                                                ? { bg: 'rgba(8,145,178,0.08)', color: '#0891B2', border: 'rgba(8,145,178,0.25)' }
                                                : { bg: 'rgba(180,83,9,0.12)', color: '#B45309', border: 'rgba(180,83,9,0.3)' }
                                            return (
                                                <span key={i} className="flex items-center gap-1">
                                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-2xs"
                                                        style={{
                                                            background: badge.bg,
                                                            color: badge.color,
                                                            border: `1px solid ${badge.border}`,
                                                        }}>
                                                        <span className="text-[9px] font-bold opacity-75 font-mono uppercase">Cấp {st.level}:</span>
                                                        {st.label || getRoleName(st.role)}
                                                    </span>
                                                    {i < poRoute.steps.length - 1 && (
                                                        <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                                                    )}
                                                </span>
                                            )
                                        })}
                                    </div>
                                </td>

                                <td className="px-4 py-3.5 text-center">
                                    <button
                                        onClick={openPoEditModal}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer hover:bg-slate-100 hover:text-amber-700 shadow-2xs"
                                        style={{ background: '#FFFFFF', color: '#B45309', border: '1px solid #CBD5E1' }}
                                        title="Sửa số cấp và phân quyền Role duyệt PO"
                                    >
                                        <Edit3 size={13} /> Sửa
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══ Section 3: Threshold Configuration ═══ */}
            <div className="rounded-lg overflow-hidden shadow-2xs" style={{ border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-3">
                        <Settings2 size={18} style={{ color: '#B45309' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Ngưỡng Phê Duyệt Tự Động</h3>
                            <p className="text-[11px]" style={{ color: '#64748B' }}>Khi vượt ngưỡng → tự động yêu cầu CEO phê duyệt</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSaveThresholds}
                        disabled={!dirty.thresholds || savingThresholds}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-xs hover:opacity-90"
                        style={{
                            background: dirty.thresholds ? '#B45309' : 'rgba(180,83,9,0.15)',
                            color: dirty.thresholds ? '#FFFFFF' : '#64748B',
                        }}
                    >
                        {savingThresholds ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {savingThresholds ? 'Đang lưu...' : dirty.thresholds ? 'Lưu Ngưỡng' : 'Đã lưu'}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white">
                    {thresholds.map((t, idx) => {
                        const isPercent = t.key.includes('discount') || t.key.includes('percent')
                        const Icon = isPercent ? Percent : DollarSign
                        return (
                            <div key={t.key}
                                className="flex items-center gap-4 px-5 py-4 bg-white hover:bg-slate-50/80 transition"
                                style={{
                                    borderBottom: '1px solid #E2E8F0',
                                    borderRight: idx % 2 === 0 ? '1px solid #E2E8F0' : 'none',
                                }}>
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: isPercent ? 'rgba(8, 145, 178, 0.08)' : 'rgba(180,83,9, 0.12)', border: `1px solid ${isPercent ? 'rgba(8, 145, 178, 0.25)' : 'rgba(180,83,9, 0.3)'}` }}>
                                    <Icon size={18} style={{ color: isPercent ? '#0891B2' : '#B45309' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{t.label}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{t.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="number"
                                        value={t.value}
                                        onChange={e => updateThreshold(idx, Number(e.target.value))}
                                        className="w-40 px-3 py-2 rounded-lg text-sm text-right outline-none font-bold"
                                        style={{
                                            background: '#FFFFFF',
                                            border: '1px solid #CBD5E1',
                                            color: '#0F172A',
                                        }}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#0891B2')}
                                        onBlur={e => (e.currentTarget.style.borderColor = '#CBD5E1')}
                                        step={isPercent ? 1 : 1_000_000}
                                    />
                                    <span className="text-xs font-bold" style={{ color: '#64748B' }}>
                                        {isPercent ? '%' : '₫'}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ═══ Edit Route Modal ═══ */}
            {editDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] bg-white border border-slate-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 bg-slate-50/80 border-b border-slate-200">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Cấu Hình Luồng Phê Duyệt: {CATEGORY_LABELS[editDraft.category] ?? editDraft.category}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Mã danh mục: {editDraft.category}</p>
                            </div>
                            <button onClick={() => { setEditingCategory(null); setEditDraft(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* 1. Creator Roles Selection */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-cyan-800">
                                    1. Quyền Tạo Tờ Trình (Các Role được mở form tạo)
                                </label>
                                <p className="text-xs text-slate-500 mb-3">Nếu không chọn Role nào, tất cả người dùng hệ thống đều được phép tạo loại tờ trình này.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {availableRoles.map(r => {
                                        const isChecked = editDraft.creatorRoles.includes(r.code)
                                        return (
                                            <button
                                                key={r.code}
                                                type="button"
                                                onClick={() => {
                                                    setEditDraft(prev => {
                                                        if (!prev) return prev
                                                        const nextRoles = isChecked
                                                            ? prev.creatorRoles.filter(c => c !== r.code)
                                                            : [...prev.creatorRoles, r.code]
                                                        return { ...prev, creatorRoles: nextRoles }
                                                    })
                                                }}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-left transition border ${isChecked ? 'bg-cyan-50/80 border-cyan-500 text-cyan-900 shadow-2xs' : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {isChecked && <Check size={12} />}
                                                </div>
                                                <span>{r.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 2. Number of Approval Steps & Roles */}
                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold uppercase tracking-wider block text-amber-800">
                                        2. Số Cấp & Role Phê Duyệt Theo Thứ Tự
                                    </label>
                                    <button
                                        type="button"
                                        disabled={editDraft.steps.length >= 4}
                                        onClick={() => {
                                            setEditDraft(prev => {
                                                if (!prev || prev.steps.length >= 4) return prev
                                                const nextLevel = prev.steps.length + 1
                                                const defaultRole = nextLevel === 1 ? 'SALES_MGR' : nextLevel === 2 ? 'KE_TOAN' : 'CEO'
                                                return {
                                                    ...prev,
                                                    steps: [...prev.steps, { level: nextLevel, role: defaultRole }]
                                                }
                                            })
                                        }}
                                        className="text-xs flex items-center gap-1 font-bold text-cyan-700 hover:text-cyan-800 hover:underline disabled:opacity-40"
                                    >
                                        <Plus size={14} /> Thêm cấp duyệt
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {editDraft.steps.map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-amber-100/80 text-amber-800 border border-amber-300/60">
                                                {idx + 1}
                                            </div>
                                            
                                            <div className="flex-1">
                                                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Role chịu trách nhiệm duyệt Cấp {idx + 1}</label>
                                                <select
                                                    value={step.role}
                                                    onChange={e => {
                                                        const newRole = e.target.value
                                                        setEditDraft(prev => {
                                                            if (!prev) return prev
                                                            const copy = [...prev.steps]
                                                            copy[idx] = { ...copy[idx], role: newRole }
                                                            return { ...prev, steps: copy }
                                                        })
                                                    }}
                                                    className="w-full p-2.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-2xs"
                                                >
                                                    {availableRoles.map(r => (
                                                        <option key={r.code} value={r.code}>{r.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {editDraft.steps.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditDraft(prev => {
                                                            if (!prev) return prev
                                                            const filtered = prev.steps.filter((_, i) => i !== idx)
                                                            // Re-index levels
                                                            const reindexed = filtered.map((st, i) => ({ ...st, level: i + 1 }))
                                                            return { ...prev, steps: reindexed }
                                                        })
                                                    }}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 mt-3 transition hover:text-rose-700"
                                                    title="Xóa cấp này"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => { setEditingCategory(null); setEditDraft(null); }}
                                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200/80 border border-slate-300 bg-white transition"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditDraft}
                                className="px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition hover:opacity-90 bg-cyan-700 text-white"
                            >
                                Áp Dụng Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Edit PO Route Modal ═══ */}
            {editingPoModal && poDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="w-full max-w-2xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh] bg-white border border-slate-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 bg-slate-50/80 border-b border-slate-200">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Cấu Hình Luồng Phê Duyệt: Đơn Mua Hàng (PO)
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Mã cấu hình: procurement.purchase_order</p>
                            </div>
                            <button onClick={() => { setEditingPoModal(false); setPoDraft(null); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* 1. Creator Roles Selection */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-1 text-cyan-800">
                                    1. Quyền Tạo Đơn Mua Hàng (Role được mở form tạo PO)
                                </label>
                                <p className="text-xs text-slate-500 mb-3">Nếu không chọn Role nào, tất cả người dùng hệ thống đều được phép tạo PO.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {availableRoles.map(r => {
                                        const isChecked = poDraft.creatorRoles.includes(r.code)
                                        return (
                                            <button
                                                key={r.code}
                                                type="button"
                                                onClick={() => {
                                                    setPoDraft(prev => {
                                                        if (!prev) return prev
                                                        const nextRoles = isChecked
                                                            ? prev.creatorRoles.filter(c => c !== r.code)
                                                            : [...prev.creatorRoles, r.code]
                                                        return { ...prev, creatorRoles: nextRoles }
                                                    })
                                                }}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-left transition border ${isChecked ? 'bg-cyan-50/80 border-cyan-500 text-cyan-900 shadow-2xs' : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 text-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {isChecked && <Check size={12} />}
                                                </div>
                                                <span>{r.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 2. Number of Approval Steps & Roles */}
                            <div className="pt-4 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold uppercase tracking-wider block text-amber-800">
                                        2. Số Cấp & Role Phê Duyệt PO Theo Thứ Tự
                                    </label>
                                    <button
                                        type="button"
                                        disabled={poDraft.steps.length >= 5}
                                        onClick={() => {
                                            setPoDraft(prev => {
                                                if (!prev || prev.steps.length >= 5) return prev
                                                const nextLevel = prev.steps.length + 1
                                                const defaultRole = nextLevel === 1 ? 'THU_MUA' : nextLevel === 2 ? 'KE_TOAN' : 'CEO'
                                                const defaultLabel = nextLevel === 1 ? 'Trưởng Phòng Mua Hàng' : nextLevel === 2 ? 'Kế Toán Trưởng' : 'Tổng Giám Đốc'
                                                return {
                                                    ...prev,
                                                    steps: [...prev.steps, { level: nextLevel, role: defaultRole, label: defaultLabel }]
                                                }
                                            })
                                        }}
                                        className="text-xs flex items-center gap-1 font-bold text-cyan-700 hover:text-cyan-800 hover:underline disabled:opacity-40"
                                    >
                                        <Plus size={14} /> Thêm cấp duyệt
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {poDraft.steps.map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/60">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-amber-100/80 text-amber-800 border border-amber-300/60">
                                                {idx + 1}
                                            </div>
                                            
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Role duyệt Cấp {idx + 1}</label>
                                                    <select
                                                        value={step.role}
                                                        onChange={e => {
                                                            const newRole = e.target.value
                                                            setPoDraft(prev => {
                                                                if (!prev) return prev
                                                                const copy = [...prev.steps]
                                                                copy[idx] = { ...copy[idx], role: newRole }
                                                                return { ...prev, steps: copy }
                                                            })
                                                        }}
                                                        className="w-full p-2.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-2xs"
                                                    >
                                                        {availableRoles.map(r => (
                                                            <option key={r.code} value={r.code}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tên bước (Hiển thị UI)</label>
                                                    <input
                                                        type="text"
                                                        value={step.label || ''}
                                                        placeholder={`Cấp ${idx + 1}`}
                                                        onChange={e => {
                                                            const newLabel = e.target.value
                                                            setPoDraft(prev => {
                                                                if (!prev) return prev
                                                                const copy = [...prev.steps]
                                                                copy[idx] = { ...copy[idx], label: newLabel }
                                                                return { ...prev, steps: copy }
                                                            })
                                                        }}
                                                        className="w-full p-2.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 shadow-2xs"
                                                    />
                                                </div>
                                            </div>

                                            {poDraft.steps.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPoDraft(prev => {
                                                            if (!prev) return prev
                                                            const filtered = prev.steps.filter((_, i) => i !== idx)
                                                            const reindexed = filtered.map((st, i) => ({ ...st, level: i + 1 }))
                                                            return { ...prev, steps: reindexed }
                                                        })
                                                    }}
                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 mt-3 transition hover:text-rose-700"
                                                    title="Xóa cấp này"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => { setEditingPoModal(false); setPoDraft(null); }}
                                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200/80 border border-slate-300 bg-white transition"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={handleSavePoDraft}
                                className="px-5 py-2 text-xs font-bold rounded-lg shadow-sm transition hover:opacity-90 bg-amber-700 text-white"
                            >
                                Áp Dụng Thay Đổi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
