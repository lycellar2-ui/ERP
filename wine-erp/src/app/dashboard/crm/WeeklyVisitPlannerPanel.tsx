'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2, CheckCircle2, X, AlertCircle, Loader2, ArrowLeft, ArrowRight, Save, Download, Printer, User } from 'lucide-react'
import { toast } from 'sonner'
import { getWeeklyPlan, createOrUpdateWeeklyPlan, updateVisitStatus, getSalesRepCustomers, getSalesRepsList, getCurrentUserProfile } from './actions'
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
    
    // User profile & roles
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [salesReps, setSalesReps] = useState<Array<{ id: string; name: string; email: string }>>([])
    const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('')
    const [customers, setCustomers] = useState<{ id: string; code: string; name: string }[]>([])
    
    // Plan data
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

    // Current target week
    const d = new Date()
    d.setDate(d.getDate() + (weekOffset * 7))
    const { week, year } = getWeekNumber(d)

    // Load initial user session
    useEffect(() => {
        const initUser = async () => {
            const user = await getCurrentUserProfile()
            if (user) {
                setCurrentUser(user)
                setSelectedSalesRepId(user.id)
                
                const isManager = user.roles.some((role: string) => ['CEO', 'SALES_MGR', 'SALES_ADMIN'].includes(role))
                if (isManager) {
                    const reps = await getSalesRepsList()
                    setSalesReps(reps)
                }
            }
        }
        initUser()
    }, [])

    // Load plan and customers
    const load = async () => {
        if (!selectedSalesRepId) return
        setLoading(true)
        try {
            const planRes = await getWeeklyPlan(year, week, selectedSalesRepId)
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
            
            // Only fetch customer selection list if viewing own plan
            if (currentUser && selectedSalesRepId === currentUser.id) {
                const custs = await getSalesRepCustomers()
                setCustomers(custs)
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [weekOffset, week, year, selectedSalesRepId, currentUser])

    // Save plan draft (Disabled if manager is viewing other rep)
    const handleSavePlan = async () => {
        if (selectedSalesRepId !== currentUser?.id) return
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

    const handleRemoveLocalVisit = (index: number) => {
        setVisits(prev => prev.filter((_, idx) => idx !== index))
    }

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

    // Filter completed visits for reporting
    const completedVisits = visits.filter(v => v.status === 'COMPLETED')
    
    // Get target rep name
    const getTargetRepName = () => {
        if (selectedSalesRepId === currentUser?.id) return currentUser?.name
        const rep = salesReps.find(r => r.id === selectedSalesRepId)
        return rep ? rep.name : 'Nhân viên kinh doanh'
    }

    // Export completed visits to CSV
    const handleExportCSV = () => {
        if (completedVisits.length === 0) {
            toast.error('Không có chuyến viếng thăm nào đã hoàn thành để xuất báo cáo')
            return
        }
        const headers = ['Mã khách hàng', 'Tên khách hàng', 'Thời gian viếng thăm', 'Mục đích viếng thăm', 'Báo cáo kết quả']
        const rows = completedVisits.map(v => [
            v.customer?.code || '',
            v.customer?.name || '',
            new Date(v.visitDate).toLocaleString('vi-VN'),
            v.purpose,
            v.resultNotes || 'Đã hoàn thành'
        ])
        
        const csvContent = "\ufeff" + [
            headers.join(','), 
            ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `Bao_cao_tuan_vieng_tham_${getTargetRepName()}_Tuan_${week}_Nam_${year}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success('Đã tải xuống báo cáo tuần (CSV)!')
    }

    // Print & PDF Report generator
    const handlePrintReport = () => {
        if (completedVisits.length === 0) {
            toast.error('Không có dữ liệu hoàn thành để xuất bản báo cáo in')
            return
        }
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
            toast.error('Vui lòng cho phép trình duyệt mở popup để in báo cáo')
            return
        }
        
        const rowsHtml = completedVisits.map(v => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; font-family: monospace;">${v.customer?.code || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${v.customer?.name || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(v.visitDate).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${v.purpose}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: #222;">${v.resultNotes || 'Đã viếng thăm'}</td>
            </tr>
        `).join('')

        printWindow.document.write(`
            <html>
            <head>
                <title>Báo cáo tuần viếng thăm khách hàng - ${getTargetRepName()}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #333; }
                    h2 { text-align: center; margin-bottom: 5px; color: #111; text-transform: uppercase; }
                    p { text-align: center; margin-top: 0; color: #666; font-size: 14px; }
                    .info { margin-bottom: 20px; font-size: 14px; line-height: 1.6; background-color: #f9f9f9; padding: 15px; border-radius: 4px; border: 1px solid #eaeaea; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th { background-color: #f2f2f2; border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
                    td { font-size: 13px; }
                    .footer { margin-top: 50px; font-size: 12px; text-align: right; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h2>Báo cáo tuần viếng thăm khách hàng</h2>
                <p>Tuần ${week} · Năm ${year}</p>
                <div class="info">
                    <strong>Nhân viên Sales:</strong> ${getTargetRepName()}<br />
                    <strong>Ngày báo cáo:</strong> ${new Date().toLocaleDateString('vi-VN')}<br />
                    <strong>Tổng số lượt viếng thăm đã hoàn thành:</strong> ${completedVisits.length} lượt
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 15%">Mã KH</th>
                            <th style="width: 25%">Tên Khách Hàng</th>
                            <th style="width: 20%">Thời Gian</th>
                            <th style="width: 20%">Mục Đích</th>
                            <th style="width: 20%">Kết Quả Ghi Nhận</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="footer">
                    <i>Hệ thống báo cáo tự động từ Wine ERP</i>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                </script>
            </body>
            </html>
        `)
        printWindow.document.close()
    }

    const isReadOnly = selectedSalesRepId !== currentUser?.id
    const isManager = currentUser?.roles.some((role: string) => ['CEO', 'SALES_MGR', 'SALES_ADMIN'].includes(role))

    if (loading && visits.length === 0) {
        return (
            <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: '#87CBB9' }} />
                <span className="text-sm" style={{ color: '#4A6A7A' }}>Đang tải kế hoạch...</span>
            </div>
        )
    }

    const inputCls = "w-full px-3 py-2 rounded text-sm outline-none"
    const inputStyle = { background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="space-y-5">
            {/* Week switcher & Manager Selection */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                <div className="flex items-center gap-3">
                    <Calendar size={18} style={{ color: '#87CBB9' }} />
                    <div>
                        <h4 className="font-semibold text-sm" style={{ color: '#E8F1F2' }}>
                            Kế Hoạch Đi Thăm Tuần {week} · Năm {year}
                        </h4>
                        <p className="text-xs" style={{ color: '#8AAEBB' }}>
                            {isReadOnly ? `Đang xem lịch trình của: ${getTargetRepName()}` : 'Lập kế hoạch & báo cáo đi thăm khách hàng'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Manager's Sales Rep Dropdown */}
                    {isManager && salesReps.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: '#8AAEBB' }}>Xem nhân viên:</span>
                            <select
                                className="px-3 py-1.5 rounded text-xs outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                value={selectedSalesRepId}
                                onChange={e => setSelectedSalesRepId(e.target.value)}
                            >
                                <option value={currentUser?.id}>Tôi (Cá nhân)</option>
                                {salesReps.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.email})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1.5 rounded transition hover:bg-slate-800" style={{ color: '#8AAEBB' }}>
                            <ArrowLeft size={15} />
                        </button>
                        <button onClick={() => setWeekOffset(0)} className="px-2.5 py-1 text-xs rounded transition border font-semibold" style={{ borderColor: '#2A4355', color: '#87CBB9' }}>
                            Tuần Này
                        </button>
                        <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1.5 rounded transition hover:bg-slate-800" style={{ color: '#8AAEBB' }}>
                            <ArrowRight size={15} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-5">
                {/* Lộ trình đi thăm */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                    <div className="p-5 rounded-lg space-y-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#87CBB9' }}>
                                Lộ trình đi thăm dự kiến ({visits.length})
                            </span>
                            
                            {!isReadOnly && (
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
                                        Lưu kế hoạch
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Form thêm lịch viếng thăm mới */}
                        {showAddVisit && !isReadOnly && (
                            <div className="p-4 rounded border space-y-3" style={{ background: '#142433', borderColor: '#2A4355' }}>
                                <p className="text-xs font-bold text-[#D4A853]">Thêm Khách Hàng</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Khách Hàng</label>
                                        <select
                                            className={inputCls}
                                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px', padding: '6px 8px', width: '100%', fontSize: '12px' }}
                                            value={newVisit.customerId}
                                            onChange={e => setNewVisit(prev => ({ ...prev, customerId: e.target.value }))}
                                        >
                                            <option value="" style={{ backgroundColor: '#142433', color: '#E8F1F2' }}>-- Chọn khách hàng --</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id} style={{ backgroundColor: '#142433', color: '#E8F1F2' }}>
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
                                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px', padding: '6px 8px', width: '100%', fontSize: '12px' }}
                                            value={newVisit.visitDate}
                                            onChange={e => setNewVisit(prev => ({ ...prev, visitDate: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold block mb-1" style={{ color: '#4A6A7A' }}>Mục Đích</label>
                                        <select
                                            className={inputCls}
                                            style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px', padding: '6px 8px', width: '100%', fontSize: '12px' }}
                                            value={newVisit.purpose}
                                            onChange={e => setNewVisit(prev => ({ ...prev, purpose: e.target.value }))}
                                        >
                                            {PURPOSE_PRESETS.map(p => (
                                                <option key={p} value={p} style={{ backgroundColor: '#142433', color: '#E8F1F2' }}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowAddVisit(false)} className="px-3 py-1 text-xs font-semibold rounded border" style={{ borderColor: '#2A4355', color: '#4A6A7A' }}>Hủy</button>
                                    <button onClick={handleAddLocalVisit} className="px-3 py-1 text-xs font-semibold rounded" style={{ background: '#87CBB9', color: '#0A1926' }}>Thêm</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold" style={{ color: '#8AAEBB' }}>Trọng tâm tuần:</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 text-sm outline-none"
                                style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                disabled={isReadOnly}
                                placeholder="Trọng tâm kế hoạch tuần đi chăm sóc..."
                            />
                        </div>

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
                                                    </div>
                                                    <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                                        ⏱ Dự kiến: {formatDate(v.visitDate)}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                                    {isSaved && v.status === 'PLANNED' && !isReadOnly && (
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
                                                    {!isSaved && !isReadOnly && (
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

                {/* Right Side: Check-in / Báo cáo tuần & Xuất báo cáo */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                    {/* Báo cáo kết quả chuyến đi viếng thăm hiện tại */}
                    {checkInVisitId && !isReadOnly && (
                        <div className="p-5 rounded-lg space-y-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#87CBB9]">Báo cáo kết quả chuyến đi</p>
                                <button onClick={() => setCheckInVisitId(null)} className="p-1" style={{ color: '#4A6A7A' }}><X size={14} /></button>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs" style={{ color: '#8AAEBB' }}>
                                    Cập nhật ghi chú chuyến đi. Hệ thống tự động ghi nhận vào Lịch sử chăm sóc (Customer Activity).
                                </p>
                                <textarea
                                    className="w-full px-3 py-2 text-sm outline-none resize-none"
                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2', borderRadius: '4px' }}
                                    rows={4}
                                    placeholder="Nội dung kết quả làm việc với khách hàng..."
                                    value={resultNotes}
                                    onChange={e => setResultNotes(e.target.value)}
                                />
                                <button
                                    onClick={handleCompleteVisit}
                                    disabled={completing || !resultNotes.trim()}
                                    className="w-full py-2 text-center text-xs font-bold rounded text-slate-900"
                                    style={{ background: resultNotes.trim() ? '#87CBB9' : '#2A4355', color: resultNotes.trim() ? '#0A1926' : '#4A6A7A', borderRadius: '4px' }}
                                >
                                    {completing ? 'Đang hoàn thành...' : 'Xác nhận Hoàn Thành'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Báo Cáo Tuần Cho Khách Hàng Đã Đi Thăm (Summary & Export) */}
                    <div className="p-5 rounded-lg space-y-4" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#D4A853]">
                                Báo cáo tuần đã thăm
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#87CBB9]/10 text-[#87CBB9]">
                                {completedVisits.length} lượt
                            </span>
                        </div>

                        {completedVisits.length === 0 ? (
                            <div className="py-6 text-center text-xs" style={{ color: '#4A6A7A' }}>
                                Chưa có khách hàng nào được ghi nhận hoàn thành tuần này.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                    {completedVisits.map(v => (
                                        <div key={v.id} className="p-2.5 rounded border border-[#2A4355]" style={{ background: '#142433' }}>
                                            <p className="text-xs font-bold text-slate-100">{v.customer?.name}</p>
                                            <p className="text-[10px]" style={{ color: '#8AAEBB' }}>⏱ {new Date(v.visitDate).toLocaleDateString('vi-VN')}</p>
                                            <p className="text-[10px] mt-1 text-slate-300 truncate">📝 {v.resultNotes || 'Đã viếng thăm'}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: '#2A4355' }}>
                                    <button
                                        onClick={handleExportCSV}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded text-xs font-bold text-slate-100 hover:opacity-90 transition border border-[#2A4355]"
                                        style={{ background: 'rgba(138,174,187,0.06)' }}
                                    >
                                        <Download size={12} /> Xuất CSV
                                    </button>
                                    <button
                                        onClick={handlePrintReport}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded text-xs font-bold text-slate-900 hover:opacity-90 transition"
                                        style={{ background: '#D4A853' }}
                                    >
                                        <Printer size={12} /> In Báo Cáo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Vận hành hướng dẫn */}
                    <div className="p-5 rounded-lg space-y-3" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#8AAEBB' }}>Thông tin</p>
                        <ul className="text-xs space-y-2 list-disc list-inside" style={{ color: '#4A6A7A' }}>
                          {isReadOnly ? (
                              <li>Chế độ xem giám sát (Đọc kế hoạch nhân viên). Không hiển thị chức năng lập hoặc sửa lịch trình.</li>
                          ) : (
                              <li>Bạn đang lập và báo cáo lịch trình tuần cá nhân của mình.</li>
                          )}
                          <li>Lịch đi thăm hoàn thành sẽ xuất hiện tại tab <strong>"Báo cáo tuần đã thăm"</strong> để xuất báo cáo nộp.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
