'use client'

import React, { useState, useEffect } from 'react'
import { X, UserPlus, Save, Loader2, Link2, Shield, AlertTriangle, Building, CreditCard, HeartPulse, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { createEmployee, updateEmployee, CreateEmployeeInput } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { HR_I18N } from './i18n'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    employee?: any | null
    departments: { id: string; name: string }[]
    availableUsers: { id: string; name: string; email: string; roles: string; isLinkedOther: boolean }[]
}

const CONTRACT_TYPE_KEYS = ['PROBATION', 'DEFINITE_1Y', 'DEFINITE_3Y', 'INDEFINITE', 'PART_TIME', 'SEASONAL'] as const
const STATUS_OPTION_KEYS = ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'RESIGNED'] as const

export function EmployeeFormModal({ isOpen, onClose, onSuccess, employee, departments, availableUsers }: Props) {
    const { locale } = useAppLocale()
    const i18n = HR_I18N[locale]

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
            toast.error(i18n.errFullNameRequired)
            setActiveTab('BASIC')
            return
        }

        setIsSubmitting(true)
        try {
            if (isEdit) {
                const res = await updateEmployee(employee.id, formData)
                if (res.success) {
                    toast.success(i18n.updateEmpSuccess)
                    onSuccess()
                    onClose()
                }
            } else {
                const res = await createEmployee(formData)
                if (res.success) {
                    toast.success(i18n.createEmpSuccess)
                    onSuccess()
                    onClose()
                }
            }
        } catch (err: any) {
            console.error('Save employee error:', err)
            toast.error(err.message || i18n.saveEmpError)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs">
            <div className="relative w-full max-w-3xl overflow-hidden rounded-none sm:rounded-lg border border-slate-200 bg-white shadow-2xl flex flex-col h-full sm:h-auto max-h-full sm:max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white/50 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-[#0E7490]/20 text-[#0891B2]">
                            {isEdit ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                {isEdit ? i18n.formTitleEdit(employee.fullName) : i18n.formTitleCreate}
                            </h3>
                            <p className="text-xs text-slate-600">
                                {isEdit ? i18n.formSubEdit(employee.code) : i18n.formSubCreate}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Sub-tabs Navigation */}
                <div className="flex items-center gap-1 px-4 sm:px-6 pt-3 border-b border-slate-200 bg-white shrink-0 overflow-x-auto min-w-max">
                    <button
                        type="button"
                        onClick={() => setActiveTab('BASIC')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'BASIC'
                                ? 'border-[#0E7490] text-[#0891B2] bg-white'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        {i18n.formTab1}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('WORK')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'WORK'
                                ? 'border-[#0E7490] text-[#0891B2] bg-white'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Building className="w-4 h-4" />
                        {i18n.formTab2}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('FINANCE')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'FINANCE'
                                ? 'border-[#0E7490] text-[#0891B2] bg-white'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <CreditCard className="w-4 h-4" />
                        {i18n.formTab3}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('ACCOUNT')}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                            activeTab === 'ACCOUNT'
                                ? 'border-[#0E7490] text-[#0891B2] bg-white'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Link2 className="w-4 h-4" />
                        {i18n.formTab4}
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
                                        <label className="block font-semibold text-slate-600 mb-1">
                                            {i18n.lblEmpCodeAuto}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phEmpCode}
                                            value={formData.code || ''}
                                            onChange={e => handleChange('code', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block font-semibold text-slate-600 mb-1">
                                            {i18n.lblEmpFullName} <span className="text-rose-700">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phEmpFullName}
                                            value={formData.fullName}
                                            onChange={e => handleChange('fullName', e.target.value)}
                                            required
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblGender}</label>
                                        <select
                                            value={formData.gender || 'NAM'}
                                            onChange={e => handleChange('gender', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        >
                                            <option value="NAM">{i18n.genders.NAM}</option>
                                            <option value="NU">{i18n.genders.NU}</option>
                                            <option value="KHAC">{i18n.genders.KHAC}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblDob}</label>
                                        <input
                                            type="date"
                                            value={formData.dateOfBirth || ''}
                                            onChange={e => handleChange('dateOfBirth', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblPhone}</label>
                                        <input
                                            type="tel"
                                            placeholder="0912 345 678"
                                            value={formData.phone || ''}
                                            onChange={e => handleChange('phone', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.secNationalId}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phNationalId}
                                            value={formData.nationalId || ''}
                                            onChange={e => handleChange('nationalId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblNationalIdDate}</label>
                                        <input
                                            type="date"
                                            value={formData.nationalIdDate || ''}
                                            onChange={e => handleChange('nationalIdDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblIssuePlace}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phIssuePlace}
                                            value={formData.nationalIdPlace || ''}
                                            onChange={e => handleChange('nationalIdPlace', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblPermAddress}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phPermAddress}
                                            value={formData.address || ''}
                                            onChange={e => handleChange('address', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblCurrAddress}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phCurrAddress}
                                            value={formData.currentAddress || ''}
                                            onChange={e => handleChange('currentAddress', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secEmergency}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblEmergencyName}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phEmergencyName}
                                                value={formData.emergencyContact || ''}
                                                onChange={e => handleChange('emergencyContact', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblPhone}</label>
                                            <input
                                                type="tel"
                                                placeholder={i18n.phEmergencyPhone}
                                                value={formData.emergencyPhone || ''}
                                                onChange={e => handleChange('emergencyPhone', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblEmergencyRelation}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phEmergencyRelation}
                                                value={formData.emergencyRelation || ''}
                                                onChange={e => handleChange('emergencyRelation', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
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
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblDept}</label>
                                        <select
                                            value={formData.deptId || ''}
                                            onChange={e => handleChange('deptId', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        >
                                            <option value="">-- {i18n.unassignedDept} --</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblPosition}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phPosition}
                                            value={formData.position || ''}
                                            onChange={e => handleChange('position', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblWorkStatus}</label>
                                        <select
                                            value={formData.status || 'ACTIVE'}
                                            onChange={e => handleChange('status', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        >
                                            {STATUS_OPTION_KEYS.map(s => (
                                                <option key={s} value={s}>{i18n.statusesFull[s]}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblStartDate}</label>
                                        <input
                                            type="date"
                                            value={formData.startDate || ''}
                                            onChange={e => handleChange('startDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblOfficialDate}</label>
                                        <input
                                            type="date"
                                            value={formData.officialDate || ''}
                                            onChange={e => handleChange('officialDate', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                {/* Contract Section */}
                                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secCurrentContract}</p>
                                        <span className="text-[11px] text-amber-700 font-medium">{i18n.autoWarn30Days}</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblContractType}</label>
                                            <select
                                                value={formData.contractType || 'DEFINITE_1Y'}
                                                onChange={e => handleChange('contractType', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            >
                                                {CONTRACT_TYPE_KEYS.map(c => (
                                                    <option key={c} value={c}>{i18n.contractTypesFull[c]}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblContractNumber}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phContractNumber}
                                                value={formData.contractNumber || ''}
                                                onChange={e => handleChange('contractNumber', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblContractStart}</label>
                                            <input
                                                type="date"
                                                value={formData.contractStartDate || ''}
                                                onChange={e => handleChange('contractStartDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">
                                                {i18n.lblContractEnd} <span className="text-amber-700 font-bold">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.contractEndDate || ''}
                                                onChange={e => handleChange('contractEndDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FINANCE & HEALTH */}
                        {activeTab === 'FINANCE' && (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secBankAccount}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblBankAccountNo}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phBankAccountNo}
                                                value={formData.bankAccountNo || ''}
                                                onChange={e => handleChange('bankAccountNo', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblBankNameBranch}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phBankName}
                                                value={formData.bankName || ''}
                                                onChange={e => handleChange('bankName', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblBankAccountHolder}</label>
                                            <input
                                                type="text"
                                                placeholder={i18n.phBankAccountHolder}
                                                value={formData.bankAccountHolder || ''}
                                                onChange={e => handleChange('bankAccountHolder', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblPersonalTaxCode}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phTaxCode}
                                            value={formData.taxCode || ''}
                                            onChange={e => handleChange('taxCode', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold text-slate-600 mb-1">{i18n.lblSocialInsuranceNo}</label>
                                        <input
                                            type="text"
                                            placeholder={i18n.phSocialInsuranceNo}
                                            value={formData.socialInsuranceNo || ''}
                                            onChange={e => handleChange('socialInsuranceNo', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                        />
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                            <HeartPulse className="w-4 h-4 text-rose-500" />
                                            {i18n.secHealthCheck}
                                        </p>
                                        <span className="text-[11px] text-amber-700 font-medium">{i18n.healthPeriodicWarn}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblLatestHealthCheck}</label>
                                            <input
                                                type="date"
                                                value={formData.healthCheckDate || ''}
                                                onChange={e => handleChange('healthCheckDate', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-slate-600 mb-1">{i18n.lblHealthCheckExpiry}</label>
                                            <input
                                                type="date"
                                                value={formData.healthCheckExpiry || ''}
                                                onChange={e => handleChange('healthCheckExpiry', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-600 mb-1">{i18n.lblInternalNotes}</label>
                                    <textarea
                                        rows={2}
                                        placeholder={i18n.phEmpNotes}
                                        value={formData.notes || ''}
                                        onChange={e => handleChange('notes', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490] resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        {/* TAB 4: ACCOUNT LINKING */}
                        {activeTab === 'ACCOUNT' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/20 text-slate-600">
                                    <div className="flex items-start gap-3">
                                        <Link2 className="w-5 h-5 text-[#0891B2] mt-0.5 shrink-0" />
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 mb-1">{i18n.secErpLogin}</h4>
                                            <p className="leading-relaxed">
                                                {i18n.erpLinkInfoDesc}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-600 mb-1.5">
                                        {i18n.lblSelectErpAccount}
                                    </label>
                                    <select
                                        value={formData.userId || ''}
                                        onChange={e => handleChange('userId', e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:outline-hidden focus:border-[#0E7490]"
                                    >
                                        <option value="">{i18n.optNoErpLink}</option>
                                        {availableUsers.map(u => (
                                            <option
                                                key={u.id}
                                                value={u.id}
                                                disabled={u.isLinkedOther && u.id !== employee?.userId}
                                            >
                                                {u.name} ({u.email}) - {i18n.rolePrefix} {u.roles || i18n.noRoleText} {u.isLinkedOther && u.id !== employee?.userId ? i18n.linkedOtherSuffix : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.userId && (
                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                        <Shield className="w-4 h-4 text-[#0891B2]" />
                                        <span className="text-slate-800">
                                            {i18n.selectedAccountLabel} <strong>{availableUsers.find(u => u.id === formData.userId)?.name}</strong> ({availableUsers.find(u => u.id === formData.userId)?.email})
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span>Tab {activeTab === 'BASIC' ? '1/4' : activeTab === 'WORK' ? '2/4' : activeTab === 'FINANCE' ? '3/4' : '4/4'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 bg-white hover:bg-[#E2E8F0] transition-colors"
                            >
                                {i18n.btnCancel}
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg bg-[#0E7490] text-white hover:bg-[#68B9A5] transition-all disabled:opacity-50 cursor-pointer"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {i18n.btnSaving}
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {isEdit ? i18n.btnSaveChanges : i18n.btnCreateProfile}
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
