'use client'

import React, { useState, useEffect } from 'react'
import { X, UserPlus, Save, Loader2, Link2, Shield, AlertTriangle, Building, CreditCard, HeartPulse, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { createEmployee, updateEmployee, CreateEmployeeInput } from './actions'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    employee?: any | null
    departments: { id: string; name: string }[]
    availableUsers: { id: string; name: string; email: string; roles: string; isLinkedOther: boolean }[]
}

const CONTRACT_TYPES = [
    { value: 'PROBATION', label: 'Hợp đồng thử việc (1-2 tháng)' },
    { value: 'DEFINITE_1Y', label: 'Hợp đồng xác định thời hạn 1 năm' },
    { value: 'DEFINITE_3Y', label: 'Hợp đồng xác định thời hạn 3 năm' },
    { value: 'INDEFINITE', label: 'Hợp đồng không xác định thời hạn' },
    { value: 'PART_TIME', label: 'Hợp đồng bán thời gian' },
    { value: 'SEASONAL', label: 'Hợp đồng thời vụ' },
]

const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Đang làm việc chính thức' },
    { value: 'PROBATION', label: 'Đang trong thời gian thử việc' },
    { value: 'ON_LEAVE', label: 'Tạm hoãn / Nghỉ chế độ / Thai sản' },
    { value: 'RESIGNED', label: 'Đã nghỉ việc / Chấm dứt HĐ' },
]

export function EmployeeFormModal({ isOpen, onClose, onSuccess, employee, departments, availableUsers }: Props) {
    const isEdit = Boolean(employee)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState<'BASIC' | 'WORK' | 'FINANCE' | 'ACCOUNT'>('BASIC')

    const [formData, setFormData] = useState<CreateEmployeeInput>({
        code: '',
        fullName: '',
        gender: 'NAM',
        dateOfBirth: '',
        phone: '',
        email: '',
        nationalId: '',
        nationalIdDate: '',
        nationalIdPlace: '',
        address: '',
        currentAddress: '',
        emergencyContact: '',
        emergencyPhone: '',
        emergencyRelation: '',
        deptId: '',
        position: '',
        status: 'ACTIVE',
        startDate: '',
        officialDate: '',
        contractType: 'DEFINITE_1Y',
        contractNumber: '',
        contractStartDate: '',
        contractEndDate: '',
        bankAccountNo: '',
        bankName: '',
        bankAccountHolder: '',
        taxCode: '',
        socialInsuranceNo: '',
        healthCheckDate: '',
        healthCheckExpiry: '',
        userId: '',
        notes: '',
    })

    useEffect(() => {
        if (employee) {
            setFormData({
                code: employee.code || '',
                fullName: employee.fullName || '',
                gender: employee.gender || 'NAM',
                dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '',
                phone: employee.phone || '',
                email: employee.email || '',
                nationalId: employee.nationalId || '',
                nationalIdDate: employee.nationalIdDate ? new Date(employee.nationalIdDate).toISOString().split('T')[0] : '',
                nationalIdPlace: employee.nationalIdPlace || '',
                address: employee.address || '',
                currentAddress: employee.currentAddress || '',
                emergencyContact: employee.emergencyContact || '',
                emergencyPhone: employee.emergencyPhone || '',
                emergencyRelation: employee.emergencyRelation || '',
                deptId: employee.deptId || '',
                position: employee.position || '',
                status: employee.status || 'ACTIVE',
                startDate: employee.startDate ? new Date(employee.startDate).toISOString().split('T')[0] : '',
                officialDate: employee.officialDate ? new Date(employee.officialDate).toISOString().split('T')[0] : '',
                contractType: employee.contractType || 'DEFINITE_1Y',
                contractNumber: employee.contractNumber || '',
                contractStartDate: employee.contractStartDate ? new Date(employee.contractStartDate).toISOString().split('T')[0] : '',
                contractEndDate: employee.contractEndDate ? new Date(employee.contractEndDate).toISOString().split('T')[0] : '',
                bankAccountNo: employee.bankAccountNo || '',
                bankName: employee.bankName || '',
                bankAccountHolder: employee.bankAccountHolder || '',
                taxCode: employee.taxCode || '',
                socialInsuranceNo: employee.socialInsuranceNo || '',
                healthCheckDate: employee.healthCheckDate ? new Date(employee.healthCheckDate).toISOString().split('T')[0] : '',
                healthCheckExpiry: employee.healthCheckExpiry ? new Date(employee.healthCheckExpiry).toISOString().split('T')[0] : '',
                userId: employee.userId || '',
                notes: employee.notes || '',
            })
        } else {
            // Reset to defaults
            setFormData({
                code: '',
                fullName: '',
                gender: 'NAM',
                dateOfBirth: '',
                phone: '',
                email: '',
                nationalId: '',
                nationalIdDate: '',
                nationalIdPlace: '',
                address: '',
                currentAddress: '',
                emergencyContact: '',
                emergencyPhone: '',
                emergencyRelation: '',
                deptId: departments[0]?.id || '',
                position: '',
                status: 'ACTIVE',
                startDate: new Date().toISOString().split('T')[0],
                officialDate: '',
                contractType: 'DEFINITE_1Y',
                contractNumber: '',
                contractStartDate: new Date().toISOString().split('T')[0],
                contractEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                bankAccountNo: '',
                bankName: '',
                bankAccountHolder: '',
                taxCode: '',
                socialInsuranceNo: '',
                healthCheckDate: '',
                healthCheckExpiry: '',
                userId: '',
                notes: '',
            })
        }
        setActiveTab('BASIC')
    }, [employee, isOpen, departments])

    if (!isOpen) return null

    const handleChange = (field: keyof CreateEmployeeInput, val: any) => {
        setFormData(prev => ({ ...prev, [field]: val }))
        if (field === 'fullName' && !formData.bankAccountHolder) {
            setFormData(prev => ({ ...prev, bankAccountHolder: val.toUpperCase() }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.fullName.trim()) {
            toast.error('Vui lòng nhập họ và tên nhân viên')
            setActiveTab('BASIC')
            return
        }

        setIsSubmitting(true)
        try {
            if (isEdit) {
                const res = await updateEmployee(employee.id, formData)
                if (res.success) {
                    toast.success('Cập nhật hồ sơ nhân viên thành công')
                    onSuccess()
                    onClose()
                }
            } else {
                const res = await createEmployee(formData)
                if (res.success) {
                    toast.success('Tạo mới hồ sơ nhân viên thành công')
                    onSuccess()
                    onClose()
                }
            }
        } catch (err: any) {
            console.error('Save employee error:', err)
            toast.error(err.message || 'Lỗi khi lưu hồ sơ nhân viên')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-[#2A4355] bg-[#142433] shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A4355] bg-[#1B2E3D]/50 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#87CBB9]/20 text-[#87CBB9]">
                            {isEdit ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[#E8F1F2]">
                                {isEdit ? `Chỉnh Sửa Hồ Sơ: ${employee.fullName}` : 'Thêm Mới Hồ Sơ Nhân Viên'}
                            </h3>
                            <p className="text-xs text-[#8AAEBB]">
                                {isEdit ? `Mã NV: ${employee.code}` : 'Hệ thống tự động đồng bộ và theo dõi hạn giấy tờ'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-[#8AAEBB] hover:text-white hover:bg-[#2A4355] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-tabs Navigation */}
                <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#2A4355] bg-[#142433] shrink-0 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('BASIC')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'BASIC'
                                ? 'border-[#87CBB9] text-[#87CBB9] bg-[#1B2E3D]'
                                : 'border-transparent text-[#8AAEBB] hover:text-white'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        1. Định Danh & Cá Nhân
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('WORK')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'WORK'
                                ? 'border-[#87CBB9] text-[#87CBB9] bg-[#1B2E3D]'
                                : 'border-transparent text-[#8AAEBB] hover:text-white'
                        }`}
                    >
                        <Building className="w-4 h-4" />
                        2. Công Tác & Hợp Đồng
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('FINANCE')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'FINANCE'
                                ? 'border-[#87CBB9] text-[#87CBB9] bg-[#1B2E3D]'
                                : 'border-transparent text-[#8AAEBB] hover:text-white'
                        }`}
                    >
                        <CreditCard className="w-4 h-4" />
                        3. Tài Chính, Thuế & Sức Khỏe
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('ACCOUNT')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'ACCOUNT'
                                ? 'border-[#87CBB9] text-[#87CBB9] bg-[#1B2E3D]'
                                : 'border-transparent text-[#8AAEBB] hover:text-white'
                        }`}
                    >
                        <Link2 className="w-4 h-4" />
                        4. Liên Kết Tài Khoản ERP
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                        {/* TAB 1: BASIC INFO */}
                        {activeTab === 'BASIC' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">
                                            Mã nhân viên (Để trống để tự tạo)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="VD: NV-001"
                                            value={formData.code || ''}
                                            onChange={e => handleChange('code', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">
                                            Họ và tên nhân viên <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="VD: Nguyễn Văn An"
                                            value={formData.fullName}
                                            onChange={e => handleChange('fullName', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Giới tính</label>
                                        <select
                                            value={formData.gender || 'NAM'}
                                            onChange={e => handleChange('gender', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        >
                                            <option value="NAM">Nam</option>
                                            <option value="NU">Nữ</option>
                                            <option value="KHAC">Khác</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Ngày sinh</label>
                                        <input
                                            type="date"
                                            value={formData.dateOfBirth || ''}
                                            onChange={e => handleChange('dateOfBirth', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Số điện thoại</label>
                                        <input
                                            type="tel"
                                            placeholder="0912 345 678"
                                            value={formData.phone || ''}
                                            onChange={e => handleChange('phone', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Số CCCD / Hộ chiếu</label>
                                        <input
                                            type="text"
                                            placeholder="12 chữ số CCCD..."
                                            value={formData.nationalId || ''}
                                            onChange={e => handleChange('nationalId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Ngày cấp CCCD</label>
                                        <input
                                            type="date"
                                            value={formData.nationalIdDate || ''}
                                            onChange={e => handleChange('nationalIdDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Nơi cấp</label>
                                        <input
                                            type="text"
                                            placeholder="Cục CS QLHC về TTXH..."
                                            value={formData.nationalIdPlace || ''}
                                            onChange={e => handleChange('nationalIdPlace', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Địa chỉ thường trú</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ theo hộ khẩu / CCCD..."
                                            value={formData.address || ''}
                                            onChange={e => handleChange('address', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Nơi ở hiện nay</label>
                                        <input
                                            type="text"
                                            placeholder="Địa chỉ tạm trú thực tế..."
                                            value={formData.currentAddress || ''}
                                            onChange={e => handleChange('currentAddress', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="p-3 rounded-lg bg-[#0D1822] border border-[#2A4355]/60 space-y-2.5">
                                    <p className="font-bold text-[#87CBB9] uppercase tracking-wider text-[11px]">Người Liên Hệ Khẩn Cấp</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Tên người liên hệ</label>
                                            <input
                                                type="text"
                                                placeholder="Bố/Mẹ/Vợ/Chồng..."
                                                value={formData.emergencyContact || ''}
                                                onChange={e => handleChange('emergencyContact', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Số điện thoại liên hệ</label>
                                            <input
                                                type="tel"
                                                placeholder="SĐT người thân..."
                                                value={formData.emergencyPhone || ''}
                                                onChange={e => handleChange('emergencyPhone', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Mối quan hệ</label>
                                            <input
                                                type="text"
                                                placeholder="Quan hệ gia đình..."
                                                value={formData.emergencyRelation || ''}
                                                onChange={e => handleChange('emergencyRelation', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: WORK & CONTRACT */}
                        {activeTab === 'WORK' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Phòng ban</label>
                                        <select
                                            value={formData.deptId || ''}
                                            onChange={e => handleChange('deptId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        >
                                            <option value="">-- Chưa phân phòng ban --</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Chức danh / Vị trí</label>
                                        <input
                                            type="text"
                                            placeholder="VD: Nhân viên Sales, Kế toán kho..."
                                            value={formData.position || ''}
                                            onChange={e => handleChange('position', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Trạng thái công tác</label>
                                        <select
                                            value={formData.status || 'ACTIVE'}
                                            onChange={e => handleChange('status', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        >
                                            {STATUS_OPTIONS.map(s => (
                                                <option key={s.value} value={s.value}>{s.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Ngày vào làm việc</label>
                                        <input
                                            type="date"
                                            value={formData.startDate || ''}
                                            onChange={e => handleChange('startDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Ngày tiếp nhận chính thức</label>
                                        <input
                                            type="date"
                                            value={formData.officialDate || ''}
                                            onChange={e => handleChange('officialDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                {/* Contract Section */}
                                <div className="p-3.5 rounded-lg bg-[#0D1822] border border-[#2A4355]/60 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#87CBB9] uppercase tracking-wider text-[11px]">Thông Tin Hợp Đồng Lao Động</p>
                                        <span className="text-[11px] text-amber-300">Tự động cảnh báo trước 30 ngày hết hạn</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Loại hợp đồng</label>
                                            <select
                                                value={formData.contractType || 'DEFINITE_1Y'}
                                                onChange={e => handleChange('contractType', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            >
                                                {CONTRACT_TYPES.map(c => (
                                                    <option key={c.value} value={c.value}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Số hợp đồng</label>
                                            <input
                                                type="text"
                                                placeholder="VD: HĐLĐ-2026/01/LYS..."
                                                value={formData.contractNumber || ''}
                                                onChange={e => handleChange('contractNumber', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Ngày bắt đầu hợp đồng</label>
                                            <input
                                                type="date"
                                                value={formData.contractStartDate || ''}
                                                onChange={e => handleChange('contractStartDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">
                                                Ngày kết thúc hợp đồng <span className="text-amber-400 font-bold">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.contractEndDate || ''}
                                                onChange={e => handleChange('contractEndDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FINANCE & HEALTH */}
                        {activeTab === 'FINANCE' && (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-lg bg-[#0D1822] border border-[#2A4355]/60 space-y-3">
                                    <p className="font-bold text-[#87CBB9] uppercase tracking-wider text-[11px]">Tài Khoản Ngân Hàng & Chi Trả Lương</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Số tài khoản</label>
                                            <input
                                                type="text"
                                                placeholder="Số TK ngân hàng..."
                                                value={formData.bankAccountNo || ''}
                                                onChange={e => handleChange('bankAccountNo', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Tên ngân hàng & Chi nhánh</label>
                                            <input
                                                type="text"
                                                placeholder="VD: Vietcombank - CN Tân Bình"
                                                value={formData.bankName || ''}
                                                onChange={e => handleChange('bankName', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Tên chủ tài khoản</label>
                                            <input
                                                type="text"
                                                placeholder="Tên in hoa không dấu..."
                                                value={formData.bankAccountHolder || ''}
                                                onChange={e => handleChange('bankAccountHolder', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Mã số thuế cá nhân (MST)</label>
                                        <input
                                            type="text"
                                            placeholder="MST 10 số..."
                                            value={formData.taxCode || ''}
                                            onChange={e => handleChange('taxCode', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-[#8AAEBB] mb-1">Số sổ Bảo Hiểm Xã Hội (BHXH)</label>
                                        <input
                                            type="text"
                                            placeholder="Mã số BHXH..."
                                            value={formData.socialInsuranceNo || ''}
                                            onChange={e => handleChange('socialInsuranceNo', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                        />
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-lg bg-[#0D1822] border border-[#2A4355]/60 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#87CBB9] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                            <HeartPulse className="w-4 h-4 text-rose-400" />
                                            Khám Sức Khỏe Định Kỳ
                                        </p>
                                        <span className="text-[11px] text-amber-300">Cảnh báo tái khám định kỳ</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Ngày khám sức khỏe gần nhất</label>
                                            <input
                                                type="date"
                                                value={formData.healthCheckDate || ''}
                                                onChange={e => handleChange('healthCheckDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[#8AAEBB] mb-1">Ngày hết hạn giấy khám sức khỏe</label>
                                            <input
                                                type="date"
                                                value={formData.healthCheckExpiry || ''}
                                                onChange={e => handleChange('healthCheckExpiry', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-[#8AAEBB] mb-1">Ghi chú nội bộ</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Ghi chú về nhân viên..."
                                        value={formData.notes || ''}
                                        onChange={e => handleChange('notes', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white focus:outline-hidden focus:border-[#87CBB9] resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 4: ACCOUNT LINKING */}
                        {activeTab === 'ACCOUNT' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[#8AAEBB]">
                                    <div className="flex items-start gap-3">
                                        <Link2 className="w-5 h-5 text-[#87CBB9] mt-0.5 shrink-0" />
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-1">Liên Kết Tài Khoản Đăng Nhập ERP</h4>
                                            <p className="leading-relaxed">
                                                Khi liên kết hồ sơ nhân viên với tài khoản ERP, nhân viên có thể đăng nhập để xem hồ sơ của chính mình, và các module nghiệp vụ (Bán hàng, Kho, Check-in) sẽ liên kết chính xác với thông tin cá nhân.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-[#8AAEBB] mb-1.5">
                                        Chọn tài khoản ERP trong hệ thống
                                    </label>
                                    <select
                                        value={formData.userId || ''}
                                        onChange={e => handleChange('userId', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#1B2E3D] border border-[#2A4355] text-white text-xs focus:outline-hidden focus:border-[#87CBB9]"
                                    >
                                        <option value="">-- Không liên kết (Nhân viên chưa có hoặc không cần tài khoản ERP) --</option>
                                        {availableUsers.map(u => (
                                            <option
                                                key={u.id}
                                                value={u.id}
                                                disabled={u.isLinkedOther && u.id !== employee?.userId}
                                            >
                                                {u.name} ({u.email}) - Vai trò: {u.roles || 'Không vai trò'} {u.isLinkedOther && u.id !== employee?.userId ? '(Đã gắn NV khác)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.userId && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0D1822] border border-[#2A4355]">
                                        <Shield className="w-4 h-4 text-[#87CBB9]" />
                                        <span className="text-[#E8F1F2]">
                                            Tài khoản đã chọn: <strong>{availableUsers.find(u => u.id === formData.userId)?.name}</strong> ({availableUsers.find(u => u.id === formData.userId)?.email})
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-[#2A4355] bg-[#142433] shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-[#8AAEBB]">
                            <span>Tab {activeTab === 'BASIC' ? '1/4' : activeTab === 'WORK' ? '2/4' : activeTab === 'FINANCE' ? '3/4' : '4/4'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-semibold rounded-lg text-[#8AAEBB] hover:text-white bg-[#1B2E3D] hover:bg-[#2A4355] transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg bg-[#87CBB9] text-[#0A1926] hover:bg-[#68B9A5] transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {isEdit ? 'Lưu Thay Đổi' : 'Tạo Hồ Sơ'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
