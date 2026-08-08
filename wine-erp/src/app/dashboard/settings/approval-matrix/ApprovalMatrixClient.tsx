'use client'

import { useState } from 'react'
import { Shield, Save, ChevronRight, AlertTriangle, Settings2, DollarSign, Percent, FileText, Loader2, Plus, Trash2, UserCheck, Layers, Edit3, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { CATEGORY_LABELS } from '../../proposals/constants'
import { type ApprovalMatrixData, type ProposalRouteConfig, type ThresholdConfig, type StepRoleConfig, type SystemRoleInfo, saveAllRoutes, saveAllThresholds } from './actions'

interface Props {
    initialData: ApprovalMatrixData
}

export function ApprovalMatrixClient({ initialData }: Props) {
    const safeProposalRoutes = initialData?.proposalRoutes ?? []
    const safeThresholds = initialData?.thresholds ?? []
    const availableRoles = initialData?.availableRoles ?? []

    const [routes, setRoutes] = useState<ProposalRouteConfig[]>(safeProposalRoutes)
    const [thresholds, setThresholds] = useState<ThresholdConfig[]>(safeThresholds)
    const [savingRoutes, setSavingRoutes] = useState(false)
    const [savingThresholds, setSavingThresholds] = useState(false)
    const [dirty, setDirty] = useState({ routes: false, thresholds: false })
    
    // Modal state for editing a route configuration
    const [editingCategory, setEditingCategory] = useState<string | null>(null)
    const [editDraft, setEditDraft] = useState<ProposalRouteConfig | null>(null)

    const getRoleName = (code: string) => {
        const found = availableRoles.find(r => r.code === code)
        return found ? found.name : code
    }

    const openEditModal = (route: ProposalRouteConfig) => {
        setEditingCategory(route.category)
        setEditDraft(JSON.parse(JSON.stringify(route)))
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
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.3)' }}>
                        <Shield size={24} style={{ color: '#E05252' }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold" style={{ color: '#E8F1F2' }}>
                            Ma Trận Phân Quyền & Luồng Duyệt
                        </h2>
                        <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                            Chủ động tùy chỉnh số cấp duyệt, phân quyền Role Tạo & Role Duyệt cho từng loại Tờ trình
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ Section 1: Proposal Routing Matrix ═══ */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                {/* Section header */}
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <FileText size={18} style={{ color: '#87CBB9' }} />
                        <div>
                            <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>Cấu Hình Luồng Duyệt Tờ Trình (Theo Cấp & Role)</h3>
                            <p className="text-[11px]" style={{ color: '#4A6A7A' }}>Tùy chỉnh số cấp duyệt, Role tạo, và Role duyệt ở từng bước</p>
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
                        {savingRoutes ? 'Đang lưu...' : dirty.routes ? 'Lưu Toàn Bộ Mẫu' : 'Đã lưu'}
                    </button>
                </div>

                {/* Matrix table */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 850 }}>
                        <thead>
                            <tr style={{ background: '#0D1E2B' }}>
                                <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '25%' }}>Loại Tờ Trình</th>
                                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '10%' }}>Số Cấp</th>
                                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '25%' }}>Quyền Tạo</th>
                                <th className="px-5 py-3 text-left text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '30%' }}>Quy Trình Duyệt Theo Role</th>
                                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider font-bold"
                                    style={{ color: '#4A6A7A', width: '10%' }}>Tùy Chỉnh</th>
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
                                            borderBottom: '1px solid rgba(42,67,85,0.5)',
                                            background: idx % 2 === 0 ? 'transparent' : 'rgba(20,36,51,0.4)',
                                        }}
                                        className="hover:bg-[#1B2E3D]/50 transition"
                                    >
                                        <td className="px-5 py-3.5">
                                            <span className="text-sm font-bold block" style={{ color: '#E8F1F2' }}>
                                                {catLabel}
                                            </span>
                                            <span className="text-[10px] font-mono text-[#6A8A9A]">{route.category}</span>
                                        </td>

                                        {/* Number of steps */}
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold font-mono"
                                                style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                <Layers size={12} /> {steps.length} cấp
                                            </span>
                                        </td>

                                        {/* Creator Roles */}
                                        <td className="px-4 py-3.5">
                                            {creatorRoles.length === 0 ? (
                                                <span className="text-xs text-gray-400 font-medium italic">Tất cả các Role</span>
                                            ) : (
                                                <div className="flex gap-1 flex-wrap">
                                                    {creatorRoles.map(rCode => (
                                                        <span key={rCode} className="text-[10px] font-semibold px-2 py-0.5 rounded"
                                                            style={{ background: '#1B2E3D', color: '#87CBB9', border: '1px solid #2A4355' }}>
                                                            {getRoleName(rCode)}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>

                                        {/* Approval steps visual sequence */}
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {steps.map((st, i) => (
                                                    <span key={i} className="flex items-center gap-1">
                                                        <span className="text-xs font-bold px-2 py-1 rounded flex items-center gap-1"
                                                            style={{
                                                                background: i === steps.length - 1 ? 'rgba(224,82,82,0.15)' : 'rgba(74,143,171,0.15)',
                                                                color: i === steps.length - 1 ? '#E05252' : '#4A8FAB',
                                                                border: `1px solid ${i === steps.length - 1 ? '#E05252' : '#4A8FAB'}40`
                                                            }}>
                                                            <span className="text-[9px] opacity-75 font-mono">Cấp {st.level}:</span>
                                                            {getRoleName(st.role)}
                                                        </span>
                                                        {i < steps.length - 1 && (
                                                            <ChevronRight size={14} style={{ color: '#4A6A7A' }} />
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>

                                        {/* Edit button */}
                                        <td className="px-4 py-3.5 text-center">
                                            <button
                                                onClick={() => openEditModal(route)}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1 mx-auto transition-all"
                                                style={{ background: '#1B2E3D', color: '#87CBB9', border: '1px solid #2A4355' }}
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

            {/* ═══ Edit Route Modal ═══ */}
            {editDraft && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
                    <div className="w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        style={{ background: '#142433', border: '1px solid #2A4355' }}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #2A4355' }}>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                                    Cấu Hình Luồng Phê Duyệt: {CATEGORY_LABELS[editDraft.category] ?? editDraft.category}
                                </h3>
                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Mã danh mục: {editDraft.category}</p>
                            </div>
                            <button onClick={() => { setEditingCategory(null); setEditDraft(null); }} className="p-1 rounded hover:bg-[#1B2E3D]">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* 1. Creator Roles Selection */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: '#87CBB9' }}>
                                    1. Quyền Tạo Tờ Trình (Các Role được mở form tạo)
                                </label>
                                <p className="text-xs text-gray-400 mb-3">Nếu không chọn Role nào, tất cả người dùng hệ thống đều được phép tạo loại tờ trình này.</p>
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
                                                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold text-left transition border ${isChecked ? 'bg-[#87CBB9]/15 border-[#87CBB9] text-[#87CBB9]' : 'bg-[#1B2E3D] border-[#2A4355] text-gray-300'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-[#87CBB9] border-[#87CBB9]' : 'border-gray-500'}`}>
                                                    {isChecked && <Check size={12} className="text-[#0A1926]" />}
                                                </div>
                                                <span>{r.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 2. Number of Approval Steps & Roles */}
                            <div className="pt-4 border-t border-[#2A4355]">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-bold uppercase tracking-wider block" style={{ color: '#D4A853' }}>
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
                                        className="text-xs flex items-center gap-1 font-bold text-[#87CBB9] hover:underline disabled:opacity-40"
                                    >
                                        <Plus size={14} /> Thêm cấp duyệt
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {editDraft.steps.map((step, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-[#2A4355]" style={{ background: '#1B2E3D' }}>
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0"
                                                style={{ background: 'rgba(212,168,83,0.15)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.3)' }}>
                                                {idx + 1}
                                            </div>
                                            
                                            <div className="flex-1">
                                                <label className="text-[10px] text-gray-400 block mb-1">Role chịu trách nhiệm duyệt Cấp {idx + 1}</label>
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
                                                    className="w-full p-2 text-xs font-semibold rounded outline-none"
                                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
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
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-md shrink-0 mt-3"
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
                        <div className="p-4 border-t border-[#2A4355] flex justify-end gap-3" style={{ background: '#102230' }}>
                            <button
                                type="button"
                                onClick={() => { setEditingCategory(null); setEditDraft(null); }}
                                className="px-4 py-2 text-xs font-semibold rounded text-gray-400 hover:bg-[#1B2E3D]"
                            >
                                Huỷ
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditDraft}
                                className="px-5 py-2 text-xs font-bold rounded shadow transition-all"
                                style={{ background: '#87CBB9', color: '#0A1926' }}
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
