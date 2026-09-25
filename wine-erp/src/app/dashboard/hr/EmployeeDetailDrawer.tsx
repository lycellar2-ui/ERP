'use client'

import React, { useState } from 'react'
import {
    X, Edit3, FileText, Calendar, Phone, Mail, MapPin, Building,
    CreditCard, Shield, AlertTriangle, ExternalLink, Download, Trash2,
    Plus, HeartPulse, CheckCircle2, AlertCircle, Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { deleteEmployeeDocument } from './actions'
import { DocumentUploadModal } from './DocumentUploadModal'

interface Props {
    employee: any | null
    isOpen: boolean
    onClose: () => void
    onEdit: (emp: any) => void
    onRefresh: () => void
}

const DOC_TYPE_LABELS: Record<string, string> = {
    CONTRACT: 'Hợp đồng lao động',
    NATIONAL_ID: 'CCCD / Hộ chiếu',
    DEGREE_CERT: 'Bằng cấp / Chứng chỉ',
    HEALTH_CERT: 'Giấy khám sức khỏe',
    CV: 'Sơ yếu lý lịch',
    OTHER: 'Giấy tờ khác',
}

export function EmployeeDetailDrawer({ employee, isOpen, onClose, onEdit, onRefresh }: Props) {
    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'WORK' | 'FINANCE' | 'DOCUMENTS'>('OVERVIEW')
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

    if (!isOpen || !employee) return null

    const now = new Date()

    // Calculate contract status
    let contractDaysLeft: number | null = null
    let contractStatus: 'NORMAL' | 'EXPIRING_SOON' | 'EXPIRED' = 'NORMAL'
    if (employee.contractEndDate) {
        const diff = new Date(employee.contractEndDate).getTime() - now.getTime()
        contractDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
        if (contractDaysLeft <= 0) contractStatus = 'EXPIRED'
        else if (contractDaysLeft <= 30) contractStatus = 'EXPIRING_SOON'
    }

    // Calculate health status
    let healthDaysLeft: number | null = null
    let healthStatus: 'NORMAL' | 'EXPIRING_SOON' | 'EXPIRED' = 'NORMAL'
    if (employee.healthCheckExpiry) {
        const diff = new Date(employee.healthCheckExpiry).getTime() - now.getTime()
        healthDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
        if (healthDaysLeft <= 0) healthStatus = 'EXPIRED'
        else if (healthDaysLeft <= 30) healthStatus = 'EXPIRING_SOON'
    }

    const handleDeleteDoc = async (docId: string, title: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa giấy tờ "${title}" không?`)) return

        setDeletingDocId(docId)
        try {
            const res = await deleteEmployeeDocument(docId)
            if (res.success) {
                toast.success('Đã xóa tài liệu')
                onRefresh()
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xóa tài liệu')
        } finally {
            setDeletingDocId(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs">
            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
                <div className="w-screen max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col">
                    {/* Drawer Header */}
                    <div className="px-6 py-5 border-b border-slate-200 bg-white/50 flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-13 h-13 rounded-full bg-[#87CBB9]/20 border-2 border-[#87CBB9] flex items-center justify-center text-lg font-bold text-[#0891B2] shadow-md">
                                {employee.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-900">{employee.fullName}</h2>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#87CBB9]/15 text-[#0891B2] border border-[#87CBB9]/30">
                                        {employee.code}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {employee.position || 'Chưa có chức vụ'} • {employee.dept?.name || 'Chưa phân phòng'}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                        employee.status === 'ACTIVE'
                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                            : employee.status === 'PROBATION'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : employee.status === 'ON_LEAVE'
                                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    }`}>
                                        {employee.status === 'ACTIVE' ? 'Chính thức' :
                                         employee.status === 'PROBATION' ? 'Thử việc' :
                                         employee.status === 'ON_LEAVE' ? 'Nghỉ chế độ' : 'Đã nghỉ việc'}
                                    </span>
                                    {employee.user && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-[#0891B2] border border-teal-500/30">
                                            <Shield className="w-3 h-3" />
                                            Đã gắn User ERP
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onEdit(employee)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-[#E2E8F0] text-xs font-semibold text-[#0891B2] border border-slate-200 transition-colors cursor-pointer"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                                Sửa
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-[#E2E8F0] transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Expiry Alerts Banner */}
                    {(contractStatus !== 'NORMAL' || healthStatus !== 'NORMAL') && (
                        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 space-y-1.5">
                            {contractStatus === 'EXPIRED' && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>Hợp đồng lao động đã hết hạn từ {new Date(employee.contractEndDate).toLocaleDateString('vi-VN')}! Vui lòng làm thủ tục gia hạn hoặc ký HĐ mới.</span>
                                </div>
                            )}
                            {contractStatus === 'EXPIRING_SOON' && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Hợp đồng lao động sắp hết hạn trong <strong>{contractDaysLeft} ngày</strong> ({new Date(employee.contractEndDate).toLocaleDateString('vi-VN')}).</span>
                                </div>
                            )}
                            {healthStatus === 'EXPIRING_SOON' && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                                    <HeartPulse className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span>Giấy khám sức khỏe sắp hết hạn sau {healthDaysLeft} ngày. Nhắc nhân viên khám định kỳ.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-200 bg-white shrink-0 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('OVERVIEW')}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'OVERVIEW'
                                    ? 'border-[#87CBB9] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-white'
                            }`}
                        >
                            Hồ Sơ Cá Nhân
                        </button>
                        <button
                            onClick={() => setActiveTab('WORK')}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'WORK'
                                    ? 'border-[#87CBB9] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-white'
                            }`}
                        >
                            Công Tác & HĐLĐ
                        </button>
                        <button
                            onClick={() => setActiveTab('FINANCE')}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'FINANCE'
                                    ? 'border-[#87CBB9] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-white'
                            }`}
                        >
                            Tài Chính & Thuế
                        </button>
                        <button
                            onClick={() => setActiveTab('DOCUMENTS')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'DOCUMENTS'
                                    ? 'border-[#87CBB9] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-white'
                            }`}
                        >
                            Kho Giấy Tờ ({employee.documents?.length || 0})
                        </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-900">
                        {/* TAB 1: OVERVIEW */}
                        {activeTab === 'OVERVIEW' && (
                            <div className="space-y-6">
                                {/* Contact Card */}
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Thông Tin Liên Lạc & Định Danh</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Giới tính</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.gender === 'NAM' ? 'Nam' : employee.gender === 'NU' ? 'Nữ' : 'Khác'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày sinh</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số điện thoại</p>
                                            <p className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.phone || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Email liên hệ</p>
                                            <p className="font-semibold text-white mt-0.5 flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.email || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Identity Document */}
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Căn Cước Công Dân / Hộ Chiếu</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số CCCD</p>
                                            <p className="font-mono font-bold text-white mt-0.5">{employee.nationalId || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày cấp</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.nationalIdDate ? new Date(employee.nationalIdDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Nơi cấp</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.nationalIdPlace || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/40 space-y-2">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Địa chỉ thường trú</p>
                                            <p className="text-white mt-0.5 flex items-start gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-[#0891B2] mt-0.5 shrink-0" />
                                                {employee.address || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Chỗ ở hiện nay</p>
                                            <p className="text-white mt-0.5 flex items-start gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-[#0891B2] mt-0.5 shrink-0" />
                                                {employee.currentAddress || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Người Liên Hệ Khẩn Cấp</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Họ tên người liên hệ</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.emergencyContact || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số điện thoại</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.emergencyPhone || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Mối quan hệ</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.emergencyRelation || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: WORK & CONTRACT */}
                        {activeTab === 'WORK' && (
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Vị Trí & Quá Trình Công Tác</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Phòng ban</p>
                                            <p className="font-bold text-white mt-0.5 flex items-center gap-1.5">
                                                <Building className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.dept?.name || 'Chưa phân phòng'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Chức danh / Vị trí</p>
                                            <p className="font-bold text-white mt-0.5">{employee.position || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày vào làm việc</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.startDate ? new Date(employee.startDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày chính thức</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.officialDate ? new Date(employee.officialDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Contract Card */}
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Hợp Đồng Lao Động Hiện Tại</p>
                                        {contractStatus === 'EXPIRING_SOON' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                Hết hạn sau {contractDaysLeft} ngày
                                            </span>
                                        )}
                                        {contractStatus === 'EXPIRED' && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                Đã hết hạn
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số hiệu hợp đồng</p>
                                            <p className="font-mono font-bold text-white mt-0.5">{employee.contractNumber || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Loại hợp đồng</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.contractType === 'PROBATION' ? 'Thử việc' :
                                                 employee.contractType === 'DEFINITE_1Y' ? 'Xác định thời hạn 1 năm' :
                                                 employee.contractType === 'DEFINITE_3Y' ? 'Xác định thời hạn 3 năm' :
                                                 employee.contractType === 'INDEFINITE' ? 'Không xác định thời hạn' :
                                                 employee.contractType || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày bắt đầu</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.contractStartDate ? new Date(employee.contractStartDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày hết hạn</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.contractEndDate ? new Date(employee.contractEndDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* ERP Account Linking */}
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5" />
                                        Tài Khoản Đăng Nhập ERP
                                    </p>
                                    {employee.user ? (
                                        <div className="p-3 rounded-lg bg-[#0D1822] border border-slate-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-white">{employee.user.name}</p>
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                                    {employee.user.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 text-xs">{employee.user.email}</p>
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {employee.user.roles?.map((r: any) => (
                                                    <span key={r.role?.id || r} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#87CBB9]/15 text-[#0891B2]">
                                                        {r.role?.name || r}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-600 italic">
                                            Nhân viên này chưa được liên kết với tài khoản đăng nhập ERP. Bấm "Sửa" và chọn tài khoản ở Tab 4 để liên kết.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FINANCE & HEALTH */}
                        {activeTab === 'FINANCE' && (
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Tài Khoản Ngân Hàng</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số tài khoản</p>
                                            <p className="font-mono font-bold text-white text-sm mt-0.5">{employee.bankAccountNo || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Chủ tài khoản</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.bankAccountHolder || '—'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-slate-600 text-[11px]">Ngân hàng & Chi nhánh</p>
                                            <p className="font-semibold text-white mt-0.5">{employee.bankName || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">Mã Số Thuế & Bảo Hiểm Xã Hội</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Mã số thuế cá nhân (MST)</p>
                                            <p className="font-mono font-bold text-white mt-0.5">{employee.taxCode || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Số sổ BHXH</p>
                                            <p className="font-mono font-bold text-white mt-0.5">{employee.socialInsuranceNo || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                                        Khám Sức Khỏe Định Kỳ
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Ngày khám gần nhất</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.healthCheckDate ? new Date(employee.healthCheckDate).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">Hạn giấy khám sức khỏe</p>
                                            <p className="font-semibold text-white mt-0.5">
                                                {employee.healthCheckExpiry ? new Date(employee.healthCheckExpiry).toLocaleDateString('vi-VN') : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: DOCUMENTS VAULT */}
                        {activeTab === 'DOCUMENTS' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Kho Giấy Tờ & Hồ Sơ Số Hóa</h4>
                                        <p className="text-xs text-slate-600">Tài liệu được bảo mật và lưu trữ an toàn trên Supabase Storage</p>
                                    </div>
                                    <button
                                        onClick={() => setIsUploadOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0891B2] text-white font-bold text-xs hover:bg-[#68B9A5] transition-all cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Tải Lên Giấy Tờ
                                    </button>
                                </div>

                                {employee.documents?.length === 0 ? (
                                    <div className="p-8 text-center rounded-xl bg-white/30 border border-slate-200 border-dashed">
                                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                                        <p className="font-semibold text-white">Chưa có giấy tờ nào được tải lên</p>
                                        <p className="text-xs text-slate-600 mt-1">Bấm "Tải Lên Giấy Tờ" để lưu trữ HĐLĐ scan, CCCD, bằng cấp hoặc KSK</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {employee.documents.map((doc: any) => {
                                            let isDocExpiring = false
                                            let isDocExpired = false
                                            if (doc.expiryDate) {
                                                const diff = new Date(doc.expiryDate).getTime() - now.getTime()
                                                const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
                                                if (days <= 0) isDocExpired = true
                                                else if (days <= 30) isDocExpiring = true
                                            }

                                            return (
                                                <div
                                                    key={doc.id}
                                                    className="p-3.5 rounded-xl bg-white/60 border border-slate-200 hover:border-[#87CBB9]/60 transition-all flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className="p-2.5 rounded-lg bg-[#87CBB9]/20 text-[#0891B2] shrink-0">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h5 className="font-bold text-white text-xs truncate max-w-[260px]">
                                                                    {doc.title}
                                                                </h5>
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#87CBB9]/10 text-[#0891B2]">
                                                                    {DOC_TYPE_LABELS[doc.docType] || doc.docType}
                                                                </span>
                                                                {isDocExpired && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">
                                                                        Đã hết hạn
                                                                    </span>
                                                                )}
                                                                {isDocExpiring && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                                                                        Sắp hết hạn
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                                                                {doc.docNumber && <span>Số: <strong>{doc.docNumber}</strong></span>}
                                                                {doc.issueDate && (
                                                                    <span>Ngày cấp: {new Date(doc.issueDate).toLocaleDateString('vi-VN')}</span>
                                                                )}
                                                                {doc.expiryDate && (
                                                                    <span>Hạn: {new Date(doc.expiryDate).toLocaleDateString('vi-VN')}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a
                                                            href={doc.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-[#E2E8F0] transition-colors"
                                                            title="Mở xem tệp"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteDoc(doc.id, doc.title)}
                                                            disabled={deletingDocId === doc.id}
                                                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                                            title="Xóa giấy tờ"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Document Upload Modal */}
            <DocumentUploadModal
                employeeId={employee.id}
                employeeName={employee.fullName}
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={onRefresh}
            />
        </div>
    )
}
