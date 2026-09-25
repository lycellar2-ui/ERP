'use client'

import React, { useState, useTransition } from 'react'
import {
    Users, UserCheck, Clock, AlertTriangle, FileText, Plus,
    Search, Filter, BellRing, Building, ChevronRight, Eye, Edit,
    Trash2, Upload, HeartPulse, RefreshCw, Shield, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getEmployees, getEmployeeById, deleteEmployee,
    sendHrExpiryNotificationAlerts
} from './actions'
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer'
import { EmployeeFormModal } from './EmployeeFormModal'
import { DocumentUploadModal } from './DocumentUploadModal'

interface Props {
    initialEmployees: any[]
    initialStats: {
        totalEmployees: number
        activeEmployees: number
        probationEmployees: number
        expiringContracts: number
        expiredContracts: number
        expiringHealthChecks: number
        totalDocs: number
        urgentItems: any[]
    }
    departments: { id: string; name: string }[]
    availableUsers: { id: string; name: string; email: string; roles: string; isLinkedOther: boolean }[]
}

export function HrClient({ initialEmployees, initialStats, departments, availableUsers }: Props) {
    const [employees, setEmployees] = useState(initialEmployees)
    const [stats, setStats] = useState(initialStats)

    // Filter states
    const [search, setSearch] = useState('')
    const [deptId, setDeptId] = useState('ALL')
    const [status, setStatus] = useState('ALL')
    const [contractExpiringOnly, setContractExpiringOnly] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Modal / Drawer states
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    const [editingEmployee, setEditingEmployee] = useState<any | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const [quickUploadEmp, setQuickUploadEmp] = useState<{ id: string; name: string } | null>(null)
    const [isSendingAlerts, setIsSendingAlerts] = useState(false)

    const fetchFilteredEmployees = (
        searchVal = search,
        deptVal = deptId,
        statusVal = status,
        expiringVal = contractExpiringOnly
    ) => {
        startTransition(async () => {
            try {
                const data = await getEmployees({
                    search: searchVal,
                    deptId: deptVal,
                    status: statusVal,
                    contractExpiring: expiringVal,
                })
                setEmployees(data)
            } catch (err: any) {
                toast.error(err.message || 'Lỗi khi tải danh sách nhân viên')
            }
        })
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchFilteredEmployees()
    }

    const handleOpenDetail = async (emp: any) => {
        try {
            const fullEmp = await getEmployeeById(emp.id)
            setSelectedEmployee(fullEmp)
            setIsDrawerOpen(true)
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi mở chi tiết nhân sự')
        }
    }

    const handleOpenEdit = (emp: any) => {
        setEditingEmployee(emp)
        setIsFormOpen(true)
    }

    const handleOpenCreate = () => {
        setEditingEmployee(null)
        setIsFormOpen(true)
    }

    const handleDelete = async (emp: any) => {
        if (!confirm(`Bạn có chắc chắn muốn chuyển trạng thái nhân viên "${emp.fullName}" sang "Đã nghỉ việc"?`)) {
            return
        }

        try {
            const res = await deleteEmployee(emp.id)
            if (res.success) {
                toast.success('Đã cập nhật trạng thái nhân viên thành công')
                fetchFilteredEmployees()
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xóa nhân viên')
        }
    }

    const handleSendBellNotifications = async () => {
        setIsSendingAlerts(true)
        try {
            const res = await sendHrExpiryNotificationAlerts()
            if (res.success) {
                toast.success(res.message || 'Đã gửi thông báo cảnh báo thành công')
            } else {
                toast.error(res.error || 'Không thể gửi thông báo')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi gửi thông báo cảnh báo')
        } finally {
            setIsSendingAlerts(false)
        }
    }

    const refreshCurrentView = async () => {
        fetchFilteredEmployees()
        if (selectedEmployee) {
            const updated = await getEmployeeById(selectedEmployee.id)
            setSelectedEmployee(updated)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <Users className="w-6 h-6 text-[#0891B2]" />
                        Quản Lý Hồ Sơ & Giấy Tờ Nhân Viên
                    </h1>
                    <p className="text-xs text-slate-600 mt-1">
                        Số hóa hồ sơ nhân sự, lưu trữ hợp đồng, giấy tờ pháp lý và cảnh báo thời hạn tự động cho Wine ERP
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSendBellNotifications}
                        disabled={isSendingAlerts}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-white hover:bg-[#E2E8F0] text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-xs"
                        title="Bắn cảnh báo tới quả chuông Header của Ban Giám Đốc và Trợ Lý"
                    >
                        <BellRing className={`w-4 h-4 text-amber-400 ${isSendingAlerts ? 'animate-bounce' : ''}`} />
                        <span>Bắn Cảnh Báo Hết Hạn</span>
                    </button>
                    <button
                        onClick={handleOpenCreate}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-[#0891B2] text-white hover:bg-[#68B9A5] transition-all cursor-pointer shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Thêm Nhân Viên</span>
                    </button>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">Tổng Nhân Sự</span>
                        <Users className="w-4 h-4 text-[#0891B2]" />
                    </div>
                    <p className="text-2xl font-black text-white">{stats.totalEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Toàn bộ hồ sơ</p>
                </div>

                {/* 2. Active */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">Chính Thức</span>
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-400">{stats.activeEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Đang làm việc</p>
                </div>

                {/* 3. Probation */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">Thử Việc</span>
                        <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-2xl font-black text-blue-400">{stats.probationEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Chờ tiếp nhận</p>
                </div>

                {/* 4. Expiring Soon */}
                <div
                    onClick={() => {
                        const newVal = !contractExpiringOnly
                        setContractExpiringOnly(newVal)
                        fetchFilteredEmployees(search, deptId, status, newVal)
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer shadow-xs ${
                        contractExpiringOnly
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                            : 'bg-white border-amber-500/30 hover:border-amber-400'
                    }`}
                >
                    <div className="flex items-center justify-between text-amber-300 mb-1.5">
                        <span className="text-[11px] font-semibold">HĐ Sắp Hết Hạn</span>
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <p className="text-2xl font-black text-amber-400">{stats.expiringContracts}</p>
                    <p className="text-[10px] text-amber-300/80 mt-0.5">&le; 30 ngày (Bấm lọc)</p>
                </div>

                {/* 5. Expired */}
                <div className="p-4 rounded-xl bg-white border border-rose-500/30 shadow-xs">
                    <div className="flex items-center justify-between text-rose-300 mb-1.5">
                        <span className="text-[11px] font-semibold">HĐ Đã Hết Hạn</span>
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-rose-400">{stats.expiredContracts}</p>
                    <p className="text-[10px] text-rose-300/80 mt-0.5">Cần tái ký ngay</p>
                </div>

                {/* 6. Documents Vault */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">Giấy Tờ Số Hóa</span>
                        <FileText className="w-4 h-4 text-[#0891B2]" />
                    </div>
                    <p className="text-2xl font-black text-[#0891B2]">{stats.totalDocs}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">File PDF/ảnh đã lưu</p>
                </div>
            </div>

            {/* Urgent Alert Banner */}
            {(stats.expiringContracts > 0 || stats.expiredContracts > 0 || stats.expiringHealthChecks > 0) && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-amber-200">
                                Cảnh báo thời hạn hợp đồng & giấy tờ nhân sự
                            </h4>
                            <p className="text-[11px] text-amber-300/90 mt-0.5">
                                Có <strong>{stats.expiringContracts}</strong> nhân viên sắp hết hạn HĐLĐ (&le; 30 ngày),{' '}
                                <strong>{stats.expiredContracts}</strong> HĐ đã hết hạn và{' '}
                                <strong>{stats.expiringHealthChecks}</strong> hồ sơ cần khám sức khỏe định kỳ.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setContractExpiringOnly(true)
                            fetchFilteredEmployees(search, deptId, status, true)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs border border-amber-500/40 transition-colors shrink-0 cursor-pointer"
                    >
                        Xem Danh Sách Cần Gia Hạn &rarr;
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm theo tên, mã NV, SĐT, CCCD..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#87CBB9]"
                        />
                    </div>

                    {/* Department Dropdown */}
                    <div>
                        <select
                            value={deptId}
                            onChange={e => {
                                setDeptId(e.target.value)
                                fetchFilteredEmployees(search, e.target.value, status, contractExpiringOnly)
                            }}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#87CBB9]"
                        >
                            <option value="ALL">-- Tất cả phòng ban --</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Dropdown */}
                    <div>
                        <select
                            value={status}
                            onChange={e => {
                                setStatus(e.target.value)
                                fetchFilteredEmployees(search, deptId, e.target.value, contractExpiringOnly)
                            }}
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#87CBB9]"
                        >
                            <option value="ALL">-- Tất cả trạng thái --</option>
                            <option value="ACTIVE">Chính thức (Active)</option>
                            <option value="PROBATION">Thử việc (Probation)</option>
                            <option value="ON_LEAVE">Nghỉ chế độ (On Leave)</option>
                            <option value="RESIGNED">Đã nghỉ việc (Resigned)</option>
                        </select>
                    </div>

                    {/* Submit / Reset buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0891B2] text-white font-bold text-xs hover:bg-[#68B9A5] transition-colors cursor-pointer"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            <span>Lọc Dữ Liệu</span>
                        </button>
                        {(search || deptId !== 'ALL' || status !== 'ALL' || contractExpiringOnly) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch('')
                                    setDeptId('ALL')
                                    setStatus('ALL')
                                    setContractExpiringOnly(false)
                                    fetchFilteredEmployees('', 'ALL', 'ALL', false)
                                }}
                                className="p-2 rounded-lg bg-white text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                                title="Xóa bộ lọc"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Employee Data Table */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5 font-bold">Nhân Viên</th>
                                <th className="px-3 py-3.5 font-bold">Mã NV</th>
                                <th className="px-3 py-3.5 font-bold">Vị Trí & Phòng Ban</th>
                                <th className="px-3 py-3.5 font-bold">Hợp Đồng Lao Động</th>
                                <th className="px-3 py-3.5 font-bold text-center">Giấy Tờ</th>
                                <th className="px-3 py-3.5 font-bold">Tài Khoản ERP</th>
                                <th className="px-3 py-3.5 font-bold text-center">Trạng Thái</th>
                                <th className="px-4 py-3.5 font-bold text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/40 text-slate-900">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-600">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0891B2]" />
                                        <p className="font-semibold text-white">Không tìm thấy nhân viên phù hợp</p>
                                        <p className="text-[11px] mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bấm "Thêm Nhân Viên" để tạo mới</p>
                                    </td>
                                </tr>
                            ) : (
                                employees.map(emp => (
                                    <tr
                                        key={emp.id}
                                        className="hover:bg-white/40 transition-colors group"
                                    >
                                        {/* Employee Name + Phone */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-[#87CBB9]/20 border border-[#87CBB9]/50 flex items-center justify-center font-bold text-[#0891B2] shrink-0">
                                                    {emp.fullName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p
                                                        onClick={() => handleOpenDetail(emp)}
                                                        className="font-bold text-white hover:text-[#0891B2] transition-colors cursor-pointer truncate max-w-[180px]"
                                                    >
                                                        {emp.fullName}
                                                    </p>
                                                    <p className="text-[11px] text-slate-600 truncate">
                                                        {emp.phone || emp.email || '—'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Code */}
                                        <td className="px-3 py-3">
                                            <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-white text-[#0891B2] border border-slate-200">
                                                {emp.code}
                                            </span>
                                        </td>

                                        {/* Position & Dept */}
                                        <td className="px-3 py-3">
                                            <p className="font-semibold text-white truncate max-w-[160px]">{emp.position || '—'}</p>
                                            <p className="text-[11px] text-slate-600 truncate max-w-[160px]">
                                                {emp.dept?.name || 'Chưa phân phòng'}
                                            </p>
                                        </td>

                                        {/* Contract & Warnings */}
                                        <td className="px-3 py-3">
                                            <div>
                                                <p className="font-semibold text-white">
                                                    {emp.contractType === 'PROBATION' ? 'Thử việc' :
                                                     emp.contractType === 'DEFINITE_1Y' ? 'Xác định 1 năm' :
                                                     emp.contractType === 'DEFINITE_3Y' ? 'Xác định 3 năm' :
                                                     emp.contractType === 'INDEFINITE' ? 'Không xác định' :
                                                     emp.contractType || '—'}
                                                </p>
                                                {emp.contractEndDate ? (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[11px] text-slate-600">
                                                            Hạn: {new Date(emp.contractEndDate).toLocaleDateString('vi-VN')}
                                                        </span>
                                                        {emp.contractWarning === 'EXPIRING_SOON' && (
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                                                Còn {emp.contractDaysLeft}d
                                                            </span>
                                                        )}
                                                        {emp.contractWarning === 'EXPIRED' && (
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                                                                Hết hạn
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-600">Vô thời hạn</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Documents Count & Quick Upload */}
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenDetail(emp)}
                                                    className="flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-[#E2E8F0] text-xs font-semibold text-[#0891B2] border border-slate-200 transition-colors cursor-pointer"
                                                    title="Xem kho giấy tờ"
                                                >
                                                    <FileText className="w-3.5 h-3.5" />
                                                    <span>{emp.documentsCount}</span>
                                                </button>
                                                <button
                                                    onClick={() => setQuickUploadEmp({ id: emp.id, name: emp.fullName })}
                                                    className="p-1 rounded bg-white hover:bg-[#E2E8F0] text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                                                    title="Tải thêm giấy tờ"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>

                                        {/* Linked User ERP */}
                                        <td className="px-3 py-3">
                                            {emp.user ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Shield className="w-3.5 h-3.5 text-[#0891B2] shrink-0" />
                                                    <span className="font-semibold text-white truncate max-w-[130px]" title={emp.user.email}>
                                                        {emp.user.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 italic text-[11px]">Chưa liên kết</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                                emp.status === 'ACTIVE'
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : emp.status === 'PROBATION'
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                    : emp.status === 'ON_LEAVE'
                                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            }`}>
                                                {emp.status === 'ACTIVE' ? 'Chính thức' :
                                                 emp.status === 'PROBATION' ? 'Thử việc' :
                                                 emp.status === 'ON_LEAVE' ? 'Nghỉ phép' : 'Đã nghỉ'}
                                            </span>
                                        </td>

                                        {/* Action buttons */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenDetail(emp)}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#0891B2] hover:bg-white transition-colors cursor-pointer"
                                                    title="Xem chi tiết hồ sơ"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(emp)}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors cursor-pointer"
                                                    title="Sửa thông tin"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {emp.status !== 'RESIGNED' && (
                                                    <button
                                                        onClick={() => handleDelete(emp)}
                                                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                                        title="Đánh dấu nghỉ việc"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Employee Detail Drawer */}
            <EmployeeDetailDrawer
                employee={selectedEmployee}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onEdit={emp => {
                    setIsDrawerOpen(false)
                    handleOpenEdit(emp)
                }}
                onRefresh={refreshCurrentView}
            />

            {/* Employee Form Modal */}
            <EmployeeFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSuccess={refreshCurrentView}
                employee={editingEmployee}
                departments={departments}
                availableUsers={availableUsers}
            />

            {/* Quick Upload Modal */}
            {quickUploadEmp && (
                <DocumentUploadModal
                    employeeId={quickUploadEmp.id}
                    employeeName={quickUploadEmp.name}
                    isOpen={true}
                    onClose={() => setQuickUploadEmp(null)}
                    onSuccess={refreshCurrentView}
                />
            )}
        </div>
    )
}
