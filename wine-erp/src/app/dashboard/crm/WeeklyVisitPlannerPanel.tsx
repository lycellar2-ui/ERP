'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2, CheckCircle2, X, AlertCircle, Loader2, ArrowLeft, ArrowRight, MessageSquare, Save } from 'lucide-react'
import { toast } from 'sonner'
import { getWeeklyPlan, createOrUpdateWeeklyPlan, updateVisitStatus, getSalesRepCustomers } from './actions'
import { formatDate } from '@/lib/utils'

function getWeekNumber(d: Date): { week: number; year: number } {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
    return { week: weekNo, year: date.getUTCFullYear() }
}

const PURPOSE_PRESETS = [
    'Chăm sóc khách hàng định kỳ',
    'Thử rượu (Wine tasting) & Giới thiệu mẫu mới',
    'Giải quyết khiếu nại / Phản hồi',
    'Ký kết / Đàm phán hợp đồng mới',
    'Thu hồi công nợ',
    'Mục đích khác'
]

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    PLANNED: { label: 'Đã lên lịch', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    COMPLETED: { label: 'Đã hoàn thành', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    CANCELLED: { label: 'Đã hủy', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

export function WeeklyVisitPlannerPanel() {
    const [weekOffset, setWeekOffset] = useState(0)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [customers, setCustomers] = useState<{ id: string; code: string; name: string }[]>([])
    
    // Plan data from DB or local editing
    const [planId, setPlanId] = useState<string | null>(null)
    const [note, setNote] = useState('')
    const [visits, setVisits] = useState<Array<{
        id?: string
        customerId: string
        customer?: { id: string; name: string; code: string }
        visitDate: string
        purpose: string
        status: string
        resultNotes?: string | null
    }>>([])

    // UI state
    const [showAddVisit, setShowAddVisit] = useState(false)
    const [newVisit, setNewVisit] = useState({ customerId: '', visitDate: '', purpose: 'Chăm sóc khách hàng định kỳ' })
    const [checkInVisitId, setCheckInVisitId] = useState<string | null>(null)
    const [resultNotes, setResultNotes] = useState('')
    const [completing, setCompleting] = useState(false)

    // Get active target week details
    const d = new Date()
    d.setDate(d.getDate() + (weekOffset * 7))
    const { week, year } = getWeekNumber(d)

    // Load plan and customers
    const load = async () => {
        setLoading(true)
        try {
            const planRes = await getWeeklyPlan(year, week)
            if (planRes.success) {
                if (planRes.plan) {
                    setPlanId(planRes.plan.id)
                    setNote(planRes.plan.note || '')
                    setVisits(planRes.plan.visits)
                } else {
                    setPlanId(null)
                    setNote('')
                    setVisits([])
                }
            }
            
            const custs = await getSalesRepCustomers()
            setCustomers(custs)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [weekOffset, week, year])

    // Save plan draft
    const handleSavePlan = async () => {
        setSaving(true)
        try {
            const apiVisits = visits.map(v => ({
                customerId: v.customerId,
                visitDate: v.visitDate,
                purpose: v.purpose
            }))
            const res = await createOrUpdateWeeklyPlan({
                weekNumber: week,
                year,
                note,
                visits: apiVisits
            })
            if (res.success) {
                toast.success('Đã lưu kế hoạch viếng thăm!')
                await load()
            } else {
                toast.error(res.error || 'Không thể lưu kế hoạch')
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setSaving(false)
        }
    }

    // Add local visit to draft list
    const handleAddLocalVisit = () => {
        if (!newVisit.customerId || !newVisit.visitDate) {
            toast.error('Vui lòng điền đầy đủ ngày giờ và chọn khách hàng')
            return
        }
        const cust = customers.find(c => c.id === newVisit.customerId)
        setVisits(prev => [
            ...prev,
            {
                customerId: newVisit.customerId,
                customer: cust ? { id: cust.id, name: cust.name, code: cust.code } : undefined,
                visitDate: new Date(newVisit.visitDate).toISOString(),
                purpose: newVisit.purpose,
                status: 'PLANNED'
            }
        ])
        setShowAddVisit(false)
        setNewVisit({ customerId: '', visitDate: '', purpose: 'Chăm sóc khách hàng định kỳ' })
    }

    // Remove local visit from draft list
    const handleRemoveLocalVisit = (index: number) => {
        setVisits(prev => prev.filter((_, idx) => idx !== index))
    }

    // Check-in (complete visit)
    const handleCompleteVisit = async () => {
        if (!checkInVisitId) return
        setCompleting(true)
        try {
            const res = await updateVisitStatus({
                visitId: checkInVisitId,
                status: 'COMPLETED',
                resultNotes
            })
            if (res.success) {
                toast.success('Đã hoàn thành chuyến đi thăm khách hàng!')
                setCheckInVisitId(null)
                setResultNotes('')
                await load()
            } else {
                toast.error(res.error || 'Có lỗi xảy ra')
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setCompleting(false)
        }
    }

    // Cancel visit
    const handleCancelVisit = async (visitId: string) => {
        if (!confirm('Bạn có chắc chắn muốn hủy lịch đi thăm này không?')) return
        try {
            const res = await updateVisitStatus({
                visitId,
                status: 'CANCELLED'
            })
            if (res.success) {
                toast.success('Đã hủy lịch đi thăm!')
                await load()
            } else {
                toast.error(res.error || 'Có lỗi xảy ra')
            }
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} />
                <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải kế hoạch đi thăm...</span>
            </div>
        )
    }

    const inputCls = "w-full px-3 py-2 rounded text-sm outline-none"
    const inputStyle = { background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-5">
            {/* Header & Week Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3">
                    <Calendar size={18} style={{ color: '#87CBB9' }} />
                    <div>
                        <h4 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>
                            Kế Hoạch Đi Thăm Tuần {week} · Năm {year}
                        </h4>
                        <p className="text-xs" style={{ color: '#8AAEBB' }}>
                            Dành cho Nhân viên kinh doanh quản lý lộ trình
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1.5 rounded transition-all hover:bg-slate-800" style={{ color: '#8AAEBB' }}>
                        <ArrowLeft size={16} />
                    </button>
                    <button onClick={() => setWeekOffset(0)} className="px-2.5 py-1 text-xs rounded transition-all border font-semibold" style={{ borderColor: '#2A4355', color: '#87CBB9' }}>
                        Tuần Này
                    </button>
                    <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1.5 rounded transition-all hover:bg-slate-800" style={{ color: '#8AAEBB' }}>
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
                {/* Left Side: Visits List & Planner Form */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    <div className="p-5 rounded-lg space-y-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#87CBB9' }}>
                                    Danh Sách Lộ Trình Đi Thăm ({visits.length})
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowAddVisit(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                                    style={{ background: 'rgba(135,203,185,0.12)', color: '#87CBB9', border: '1px solid rgba(135,203,185,0.25)' }}
                                >
                                    <Plus size={12} /> Thêm Lịch Mới
                                </button>
                                <button
                                    onClick={handleSavePlan}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
                                    style={{ background: '#87CBB9', color: '#0A1926' }}
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Lưu Kế Hoạch
                                </button>
                            </div>
                        </div>

                        {/* Add Visit Form Inline */}
                        {showAddVisit && (
                            <div className="p-4 rounded border space-y-3" style={{ background: '#142433', borderColor: '#2A4355' }}>
                                <p className="text-xs font-bold" style={{ color: '#D4A853' }}>Thêm Khách Hàng vào Lộ Trình</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Chọn Khách Hàng</label>
                                        <select
                                            className={inputCls}
                                            style={inputStyle}
                                            value={newVisit.customerId}
                                            onChange={e => setNewVisit(prev => ({ ...prev, customerId: e.target.value }))}
                                        >
                                            <option value="">-- Chọn khách hàng --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.name} ({c.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Thời Gian</label>
                                        <input
                                            type="datetime-local"
                                            className={inputCls}
                                            style={inputStyle}
                                            value={newVisit.visitDate}
                                            onChange={e => setNewVisit(prev => ({ ...prev, visitDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Mục Đích</label>
                                        <select
                                            className={inputCls}
                                            style={inputStyle}
                                            value={newVisit.purpose}
                                            onChange={e => setNewVisit(prev => ({ ...prev, purpose: e.target.value }))}
                                        >
                                            {PURPOSE_PRESETS.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setShowAddVisit(false)}
                                        className="px-3 py-1 text-xs font-semibold rounded border"
                                        style={{ borderColor: '#2A4355', color: '#4A6A7A' }}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleAddLocalVisit}
                                        className="px-3 py-1 text-xs font-semibold rounded"
                                        style={{ background: '#87CBB9', color: '#0A1926' }}
                                    >
                                        Thêm
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Plan Note */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold" style={{ color: '#8AAEBB' }}>Trọng tâm kế hoạch tuần:</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-sm outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Ghi chú tiêu điểm của tuần (e.g. Đi thị trường miền Trung, chào hàng mẫu Bordeaux 2024...)"
                            />
                        </div>

                        {/* Table / List of Visits */}
                        {visits.length === 0 ? (
                            <div className="py-12 text-center text-xs" style={{ color: '#4A6A7A' }}>
                                Chưa có lộ trình đi thăm được lên kế hoạch cho tuần này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {visits.map((v, index) => {
                                    const cfg = STATUS_CFG[v.status] || { label: v.status, color: '#8AAEBB', bg: 'rgba(138,174,187,0.1)' }
                                    const isSaved = !!v.id
                                    return (
                                        <div
                                            key={index}
                                            className="p-4 rounded border transition-all space-y-2.5"
                                            style={{
                                                background: '#142433',
                                                borderColor: isSaved ? '#2A4355' : 'rgba(212,168,83,0.3)',
                                            }}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-bold text-slate-100">
                                                            {v.customer?.name || 'Khách hàng'}
                                                        </span>
                                                        <span className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>
                                                            {v.customer?.code}
                                                        </span>
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
                                                            {cfg.label}
                                                        </span>
                                                        {!isSaved && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
                                                                Chưa lưu
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                                        ⏱ Dự kiến: {formatDate(v.visitDate)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                    {isSaved && v.status === 'PLANNED' && (
                                                        <>
                                                            <button
                                                                onClick={() => { setCheckInVisitId(v.id!); setResultNotes('') }}
                                                                className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold text-slate-100"
                                                                style={{ background: '#5BA88A' }}
                                                            >
                                                                <CheckCircle2 size={10} /> Check-in/Báo cáo
                                                            </button>
                                                            <button
                                                                onClick={() => handleCancelVisit(v.id!)}
                                                                className="px-2.5 py-1 rounded text-[10px] font-bold text-rose-400 border border-rose-500/25 transition hover:bg-rose-500/10"
                                                            >
                                                                Hủy lịch
                                                            </button>
                                                        </>
                                                    )}
                                                    {!isSaved && (
                                                        <button
                                                            onClick={() => handleRemoveLocalVisit(index)}
                                                            className="p-1 rounded text-rose-400 hover:bg-rose-500/10"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-xs p-2 rounded" style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#8AAEBB' }}>
                                                🎯 <strong>Mục đích:</strong> {v.purpose}
                                            </div>

                                            {v.resultNotes && (
                                                <div className="text-xs p-2.5 rounded border border-[#5BA88A]/20" style={{ background: 'rgba(91,168,138,0.03)', color: '#87CBB9' }}>
                                                    📝 <strong>Ghi chú kết quả:</strong> {v.resultNotes}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Check-in reporting modal mock/inline panel */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    {checkInVisitId ? (
                        <div className="p-5 rounded-lg space-y-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#87CBB9]">Báo cáo kết quả chuyến đi</p>
                                <button onClick={() => setCheckInVisitId(null)} className="p-1" style={{ color: '#4A6A7A' }}><X size={14} /></button>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                    Sau khi hoàn thành đi viếng thăm khách hàng, vui lòng cập nhật báo cáo bên dưới. Hệ thống sẽ tự động lưu lại vào lịch sử hoạt động (Customer Activity) để theo dõi.
                                </p>
                                <textarea
                                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                    rows={4}
                                    placeholder="Ví dụ: Khách đồng ý đặt thử 2 thùng Sauvignon Blanc tuần tới. Cần gửi thêm báo giá chiết khấu."
                                    value={resultNotes}
                                    onChange={e => setResultNotes(e.target.value)}
                                />
                                <button
                                    onClick={handleCompleteVisit}
                                    disabled={completing || !resultNotes.trim()}
                                    className="w-full py-2 text-center text-xs font-bold text-slate-900"
                                    style={{ background: resultNotes.trim() ? '#87CBB9' : '#2A4355', color: resultNotes.trim() ? '#0A1926' : '#4A6A7A', borderRadius: '4px' }}
                                >
                                    {completing ? 'Đang hoàn thành...' : 'Xác nhận Hoàn Thành'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5 rounded-lg space-y-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#D4A853' }}>Hướng dẫn Vận hành</p>
                            <ul className="text-xs space-y-2 list-disc list-inside" style={{ color: '#8AAEBB' }}>
                                <li>Nhấp <strong>"Thêm lịch mới"</strong> để lập danh mục khách hàng đi thăm.</li>
                                <li>Bấm <strong>"Lưu kế hoạch"</strong> để đồng bộ dữ liệu vào hệ thống.</li>
                                <li>Khi đi thăm về, bấm <strong>"Check-in/Báo cáo"</strong> để ghi nhận kết quả thực tế.</li>
                                <li>Hệ thống tự động đồng bộ kết quả này thành một dòng <strong>Nhật ký tương tác (Activity)</strong> trong CRM 360°.</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
