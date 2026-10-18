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
import { useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { HR_I18N } from './i18n'

interface Props {
    employee: any | null
    isOpen: boolean
    onClose: () => void
    onEdit: (emp: any) => void
    onRefresh: () => void
}

export function EmployeeDetailDrawer({ employee, isOpen, onClose, onEdit, onRefresh }: Props) {
    const { locale, formatDate } = useAppLocale()
    const i18n = HR_I18N[locale]

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
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
        const ok = await confirm({
            title: i18n.confirmDeleteDocTitle,
            message: i18n.confirmDeleteDocMsg(title),
            confirmLabel: i18n.confirmDeleteDocTitle,
            variant: 'danger',
        })
        if (!ok) return

        setDeletingDocId(docId)
        try {
            const res = await deleteEmployeeDocument(docId)
            if (res.success) {
                toast.success(i18n.deleteDocSuccess)
                onRefresh()
            }
        } catch (err: any) {
            toast.error(err.message || i18n.deleteDocError)
        } finally {
            setDeletingDocId(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs">
            <div className="absolute inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
                <div className="w-screen max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col">
                    {/* Drawer Header */}
                    <div className="px-6 py-5 border-b border-slate-200 bg-white/50 flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-13 h-13 rounded-full bg-[#0E7490]/20 border-2 border-[#0E7490] flex items-center justify-center text-lg font-bold text-[#0891B2] shadow-md">
                                {employee.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-900">{employee.fullName}</h2>
                                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#0E7490]/15 text-[#0891B2] border border-[#0E7490]/30 whitespace-nowrap shrink-0">
                                        {employee.code}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {employee.position || i18n.noPosition} • {employee.dept?.name || i18n.unassignedDept}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                        employee.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : employee.status === 'PROBATION'
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                            : employee.status === 'ON_LEAVE'
                                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}>
                                        {i18n.statuses[employee.status] ?? employee.status}
                                    </span>
                                    {employee.user && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/15 text-[#0891B2] border border-teal-500/30 whitespace-nowrap shrink-0">
                                            <Shield className="w-3 h-3" />
                                            {i18n.linkedErpBadge}
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
                                {i18n.btnEditShort}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Expiry Alerts Banner */}
                    {(contractStatus !== 'NORMAL' || healthStatus !== 'NORMAL') && (
                        <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 space-y-1.5">
                            {contractStatus === 'EXPIRED' && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-rose-700">
                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                    <span>{i18n.contractExpiredAlert(formatDate(employee.contractEndDate))}</span>
                                </div>
                            )}
                            {contractStatus === 'EXPIRING_SOON' && contractDaysLeft !== null && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>{i18n.contractExpiringAlert(contractDaysLeft, formatDate(employee.contractEndDate))}</span>
                                </div>
                            )}
                            {healthStatus === 'EXPIRING_SOON' && healthDaysLeft !== null && (
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                                    <HeartPulse className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>{i18n.healthExpiringAlert(healthDaysLeft)}</span>
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
                                    ? 'border-[#0E7490] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {i18n.tabOverview}
                        </button>
                        <button
                            onClick={() => setActiveTab('WORK')}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'WORK'
                                    ? 'border-[#0E7490] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {i18n.tabWork}
                        </button>
                        <button
                            onClick={() => setActiveTab('FINANCE')}
                            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'FINANCE'
                                    ? 'border-[#0E7490] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {i18n.tabFinance}
                        </button>
                        <button
                            onClick={() => setActiveTab('DOCUMENTS')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                activeTab === 'DOCUMENTS'
                                    ? 'border-[#0E7490] text-[#0891B2]'
                                    : 'border-transparent text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {i18n.tabDocuments(employee.documents?.length || 0)}
                        </button>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-900">
                        {/* TAB 1: OVERVIEW */}
                        {activeTab === 'OVERVIEW' && (
                            <div className="space-y-6">
                                {/* Contact Card */}
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secContactIdentity}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblGender}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{i18n.genders[employee.gender] || i18n.genders.KHAC}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblDob}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.dateOfBirth ? formatDate(employee.dateOfBirth) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblPhone}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.phone || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblEmail}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.email || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Identity Document */}
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secNationalId}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblNationalIdNo}</p>
                                            <p className="font-mono font-bold text-slate-900 mt-0.5">{employee.nationalId || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblIssueDate}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.nationalIdDate ? formatDate(employee.nationalIdDate) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblIssuePlace}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.nationalIdPlace || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/40 space-y-2">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblPermAddress}</p>
                                            <p className="text-slate-900 mt-0.5 flex items-start gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-[#0891B2] mt-0.5 shrink-0" />
                                                {employee.address || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblCurrAddress}</p>
                                            <p className="text-slate-900 mt-0.5 flex items-start gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-[#0891B2] mt-0.5 shrink-0" />
                                                {employee.currentAddress || '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secEmergency}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblEmergencyName}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.emergencyContact || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblPhone}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.emergencyPhone || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblEmergencyRelation}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.emergencyRelation || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: WORK & CONTRACT */}
                        {activeTab === 'WORK' && (
                            <div className="space-y-6">
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secWorkHistory}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblDept}</p>
                                            <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                                                <Building className="w-3.5 h-3.5 text-[#0891B2]" />
                                                {employee.dept?.name || i18n.unassignedDept}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblPosition}</p>
                                            <p className="font-bold text-slate-900 mt-0.5">{employee.position || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblStartDate}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.startDate ? formatDate(employee.startDate) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblOfficialDate}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.officialDate ? formatDate(employee.officialDate) : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Contract Card */}
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secCurrentContract}</p>
                                        {contractStatus === 'EXPIRING_SOON' && contractDaysLeft !== null && (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap shrink-0">
                                                {i18n.expiresInDays(contractDaysLeft)}
                                            </span>
                                        )}
                                        {contractStatus === 'EXPIRED' && (
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap shrink-0">
                                                {i18n.expiredBadge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblContractNumber}</p>
                                            <p className="font-mono font-bold text-slate-900 mt-0.5">{employee.contractNumber || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblContractType}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {i18n.contractTypesFull[employee.contractType] || employee.contractType || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblContractStart}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.contractStartDate ? formatDate(employee.contractStartDate) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblContractEnd}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.contractEndDate ? formatDate(employee.contractEndDate) : i18n.noExpiryText}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* ERP Account Linking */}
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5" />
                                        {i18n.secErpLogin}
                                    </p>
                                    {employee.user ? (
                                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-slate-900">{employee.user.name}</p>
                                                <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0">
                                                    {employee.user.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-xs">{employee.user.email}</p>
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {employee.user.roles?.map((r: any) => (
                                                    <span key={r.role?.id || r} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-[#0E7490]/15 text-[#0891B2] whitespace-nowrap shrink-0">
                                                        {r.role?.name || r}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-600 italic">
                                            {i18n.unlinkedErpNotice}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FINANCE & HEALTH */}
                        {activeTab === 'FINANCE' && (
                            <div className="space-y-6">
                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secBankAccount}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblBankAccountNo}</p>
                                            <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">{employee.bankAccountNo || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblBankAccountHolder}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.bankAccountHolder || '—'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-slate-600 text-[11px]">{i18n.lblBankNameBranch}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">{employee.bankName || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px]">{i18n.secTaxSocial}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblPersonalTaxCode}</p>
                                            <p className="font-mono font-bold text-slate-900 mt-0.5">{employee.taxCode || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblSocialInsuranceNo}</p>
                                            <p className="font-mono font-bold text-slate-900 mt-0.5">{employee.socialInsuranceNo || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-lg bg-white/50 border border-slate-200 space-y-3">
                                    <p className="font-bold text-[#0891B2] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                        <HeartPulse className="w-3.5 h-3.5 text-rose-700" />
                                        {i18n.secHealthCheck}
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblLatestHealthCheck}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.healthCheckDate ? formatDate(employee.healthCheckDate) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-600 text-[11px]">{i18n.lblHealthCheckExpiry}</p>
                                            <p className="font-semibold text-slate-900 mt-0.5">
                                                {employee.healthCheckExpiry ? formatDate(employee.healthCheckExpiry) : '—'}
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
                                        <h4 className="font-bold text-slate-900 text-sm">{i18n.secDocsVaultTitle}</h4>
                                        <p className="text-xs text-slate-600">{i18n.secDocsVaultSub}</p>
                                    </div>
                                    <button
                                        onClick={() => setIsUploadOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E7490] text-white font-bold text-xs hover:bg-[#68B9A5] transition-all cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                        {i18n.btnUploadDoc}
                                    </button>
                                </div>

                                {employee.documents?.length === 0 ? (
                                    <div className="p-8 text-center rounded-lg bg-white/30 border border-slate-200 border-dashed">
                                        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                                        <p className="font-semibold text-slate-700">{i18n.emptyDocsTitle}</p>
                                        <p className="text-xs text-slate-600 mt-1">{i18n.emptyDocsSub}</p>
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
                                                    className="p-3.5 rounded-lg bg-white/60 border border-slate-200 hover:border-[#0E7490]/60 transition-all flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-start gap-3 min-w-0">
                                                        <div className="p-2.5 rounded-lg bg-[#0E7490]/20 text-[#0891B2] shrink-0">
                                                            <FileText className="w-5 h-5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h5 className="font-bold text-slate-900 text-xs truncate max-w-[260px]">
                                                                    {doc.title}
                                                                </h5>
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0E7490]/10 text-[#0891B2] whitespace-nowrap shrink-0">
                                                                    {i18n.docTypes[doc.docType] || doc.docType}
                                                                </span>
                                                                {isDocExpired && (
                                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap shrink-0">
                                                                        {i18n.expiredBadge}
                                                                    </span>
                                                                )}
                                                                {isDocExpiring && (
                                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap shrink-0">
                                                                        {i18n.docExpiringSoonBadge}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                                                                {doc.docNumber && <span>{i18n.docNoPrefix} <strong>{doc.docNumber}</strong></span>}
                                                                {doc.issueDate && (
                                                                    <span>{i18n.lblIssueDate}: {formatDate(doc.issueDate)}</span>
                                                                )}
                                                                {doc.expiryDate && (
                                                                    <span>{i18n.expiryPrefix} {formatDate(doc.expiryDate)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <a
                                                            href={doc.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                                            title={i18n.titleOpenFile}
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteDoc(doc.id, doc.title)}
                                                            disabled={deletingDocId === doc.id}
                                                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                                            title={i18n.confirmDeleteDocTitle}
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
            {confirmDialog}
        </div>
    )
}
