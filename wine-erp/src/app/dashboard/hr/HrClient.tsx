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
import { PageHeader, Button, useConfirmDialog } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { HR_I18N } from './i18n'

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

function EmployeeMobileCard({
    emp,
    onOpenDetail,
    onOpenEdit,
    onDelete,
    onQuickUpload
}: {
    emp: any
    onOpenDetail: (emp: any) => void
    onOpenEdit: (emp: any) => void
    onDelete: (emp: any) => void
    onQuickUpload: (emp: { id: string; name: string }) => void
}) {
    const { locale, formatDate } = useAppLocale()
    const i18n = HR_I18N[locale]

    const statusStyle =
        emp.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : emp.status === 'PROBATION'
            ? 'bg-amber-100 text-amber-800 border-amber-300'
            : emp.status === 'ON_LEAVE'
            ? 'bg-blue-100 text-blue-800 border-blue-300'
            : 'bg-rose-100 text-rose-800 border-rose-300'

    const statusText = i18n.statuses[emp.status] ?? emp.status

    return (
        <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#0E7490]/15 border border-[#0E7490]/30 flex items-center justify-center font-bold text-[#0891B2] shrink-0 text-sm">
                        {emp.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p
                            onClick={() => onOpenDetail(emp)}
                            className="font-bold text-slate-900 hover:text-[#0891B2] transition-colors cursor-pointer text-xs truncate"
                        >
                            {emp.fullName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-[#0891B2] border border-slate-200">
                                {emp.code}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate">
                                {emp.phone || emp.email || '—'}
                            </span>
                        </div>
                    </div>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border shrink-0 ${statusStyle}`}>
                    {statusText}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                <div>
                    <span className="text-slate-500 block text-[10px]">{i18n.colPositionDept}</span>
                    <p className="font-semibold text-slate-800 truncate">{emp.position || '—'}</p>
                    <p className="text-slate-500 text-[10px] truncate">{emp.dept?.name || i18n.unassignedDept}</p>
                </div>
                <div>
                    <span className="text-slate-500 block text-[10px]">{i18n.colContractShort}</span>
                    <p className="font-semibold text-slate-800 truncate">
                        {i18n.contractTypesShort[emp.contractType] || emp.contractType || '—'}
                    </p>
                    {emp.contractEndDate ? (
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-slate-500 text-[10px]">
                                {formatDate(emp.contractEndDate)}
                            </span>
                            {emp.contractWarning === 'EXPIRING_SOON' && (
                                <span className="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    {i18n.daysLeftBadge(emp.contractDaysLeft)}
                                </span>
                            )}
                            {emp.contractWarning === 'EXPIRED' && (
                                <span className="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    {i18n.expiredBadge}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-400 text-[10px]">{i18n.noExpiryText}</span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onOpenDetail(emp)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-[11px] font-medium text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                    >
                        <FileText className="w-3 h-3 text-[#0891B2]" />
                        <span>{i18n.docsCountBtn(emp.documentsCount)}</span>
                    </button>
                    <button
                        onClick={() => onQuickUpload({ id: emp.id, name: emp.fullName })}
                        className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                        title={i18n.titleUploadMore}
                    >
                        <Upload className="w-3 h-3" />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onOpenDetail(emp)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-[#0891B2] hover:bg-slate-100 transition-colors cursor-pointer"
                        title={i18n.titleViewDetail}
                    >
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onOpenEdit(emp)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={i18n.titleEditInfo}
                    >
                        <Edit className="w-3.5 h-3.5" />
                    </button>
                    {emp.status !== 'RESIGNED' && (
                        <button
                            onClick={() => onDelete(emp)}
                            className="p-1.5 rounded-md text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            title={i18n.titleMarkResigned}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export function HrClient({ initialEmployees, initialStats, departments, availableUsers }: Props) {
    const { locale, formatDate } = useAppLocale()
    const i18n = HR_I18N[locale]

    const { confirm, dialog: confirmDialog } = useConfirmDialog()
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
                toast.error(err.message || i18n.loadEmployeesError)
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
            toast.error(err.message || i18n.openDetailError)
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
        const ok = await confirm({
            title: i18n.confirmResignTitle,
            message: i18n.confirmResignMsg(emp.fullName),
            confirmLabel: i18n.confirmResignBtn,
            variant: 'warning',
        })
        if (!ok) return

        try {
            const res = await deleteEmployee(emp.id)
            if (res.success) {
                toast.success(i18n.resignSuccess)
                fetchFilteredEmployees()
            }
        } catch (err: any) {
            toast.error(err.message || i18n.resignError)
        }
    }

    const handleSendBellNotifications = async () => {
        setIsSendingAlerts(true)
        try {
            const res = await sendHrExpiryNotificationAlerts()
            if (res.success) {
                toast.success(res.message || i18n.sendAlertsSuccess)
            } else {
                toast.error(res.error || i18n.sendAlertsError)
            }
        } catch (err: any) {
            toast.error(err.message || i18n.sendAlertsError)
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
            <PageHeader
                title={i18n.pageTitle}
                description={i18n.pageDesc}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSendBellNotifications}
                            disabled={isSendingAlerts}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-all cursor-pointer"
                            title={i18n.btnSendAlertsTitle}
                        >
                            <BellRing className={`w-3.5 h-3.5 text-amber-600 ${isSendingAlerts ? 'animate-bounce' : ''}`} />
                            <span>{i18n.btnSendAlerts}</span>
                        </button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleOpenCreate}
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" /> {i18n.btnAddEmployee}
                        </Button>
                    </div>
                }
            />

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Total */}
                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">{i18n.kpiTotal}</span>
                        <Users className="w-4 h-4 text-[#0891B2]" />
                    </div>
                    <p className="text-2xl font-black text-slate-900">{stats.totalEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{i18n.kpiTotalSub}</p>
                </div>

                {/* 2. Active */}
                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">{i18n.kpiActive}</span>
                        <UserCheck className="w-4 h-4 text-emerald-700" />
                    </div>
                    <p className="text-2xl font-black text-emerald-700">{stats.activeEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{i18n.kpiActiveSub}</p>
                </div>

                {/* 3. Probation */}
                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">{i18n.kpiProbation}</span>
                        <Clock className="w-4 h-4 text-blue-700" />
                    </div>
                    <p className="text-2xl font-black text-blue-700">{stats.probationEmployees}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{i18n.kpiProbationSub}</p>
                </div>

                {/* 4. Expiring Soon */}
                <div
                    onClick={() => {
                        const newVal = !contractExpiringOnly
                        setContractExpiringOnly(newVal)
                        fetchFilteredEmployees(search, deptId, status, newVal)
                    }}
                    className={`p-4 rounded-lg border transition-all cursor-pointer shadow-xs ${
                        contractExpiringOnly
                            ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40'
                            : 'bg-white border-amber-500/30 hover:border-amber-400'
                    }`}
                >
                    <div className="flex items-center justify-between text-amber-800 mb-1.5">
                        <span className="text-[11px] font-bold">{i18n.kpiExpiring}</span>
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-2xl font-black text-amber-700">{stats.expiringContracts}</p>
                    <p className="text-[10px] text-amber-700/80 mt-0.5">{i18n.kpiExpiringSub}</p>
                </div>

                {/* 5. Expired */}
                <div className="p-4 rounded-lg bg-white border border-rose-500/30 shadow-xs">
                    <div className="flex items-center justify-between text-rose-800 mb-1.5">
                        <span className="text-[11px] font-bold">{i18n.kpiExpired}</span>
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-2xl font-black text-rose-700">{stats.expiredContracts}</p>
                    <p className="text-[10px] text-rose-700/80 mt-0.5">{i18n.kpiExpiredSub}</p>
                </div>

                {/* 6. Documents Vault */}
                <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-slate-600 mb-1.5">
                        <span className="text-[11px] font-semibold">{i18n.kpiDocs}</span>
                        <FileText className="w-4 h-4 text-[#0891B2]" />
                    </div>
                    <p className="text-2xl font-black text-[#0891B2]">{stats.totalDocs}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">{i18n.kpiDocsSub}</p>
                </div>
            </div>

            {/* Urgent Alert Banner */}
            {(stats.expiringContracts > 0 || stats.expiredContracts > 0 || stats.expiringHealthChecks > 0) && (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-amber-900">
                                {i18n.alertBannerTitle}
                            </h4>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                                {i18n.alertBannerText(stats.expiringContracts, stats.expiredContracts, stats.expiringHealthChecks)}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setContractExpiringOnly(true)
                            fetchFilteredEmployees(search, deptId, status, true)
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                        {i18n.btnViewExpiring}
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
                <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder={i18n.searchPlaceholder}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
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
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                        >
                            <option value="ALL">{i18n.allDepts}</option>
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
                            className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 focus:outline-hidden focus:border-[#0E7490]"
                        >
                            <option value="ALL">{i18n.allStatuses}</option>
                            <option value="ACTIVE">{i18n.statusesFilter.ACTIVE}</option>
                            <option value="PROBATION">{i18n.statusesFilter.PROBATION}</option>
                            <option value="ON_LEAVE">{i18n.statusesFilter.ON_LEAVE}</option>
                            <option value="RESIGNED">{i18n.statusesFilter.RESIGNED}</option>
                        </select>
                    </div>

                    {/* Submit / Reset buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0E7490] text-white font-bold text-xs hover:bg-[#68B9A5] transition-colors cursor-pointer"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            <span>{i18n.btnFilter}</span>
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
                                title={i18n.btnClearFilterTitle}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Mobile Card List View */}
            <div className="block md:hidden space-y-3">
                {employees.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-600">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0891B2]" />
                        <p className="font-semibold text-slate-700">{i18n.emptyTitle}</p>
                        <p className="text-[11px] mt-1 text-slate-500">{i18n.emptySub}</p>
                    </div>
                ) : (
                    employees.map(emp => (
                        <EmployeeMobileCard
                            key={emp.id}
                            emp={emp}
                            onOpenDetail={handleOpenDetail}
                            onOpenEdit={handleOpenEdit}
                            onDelete={handleDelete}
                            onQuickUpload={setQuickUploadEmp}
                        />
                    ))
                )}
            </div>

            {/* Employee Data Table - Desktop */}
            <div className="hidden md:block rounded-lg border border-slate-200 bg-white overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3.5 font-bold">{i18n.colEmployee}</th>
                                <th className="px-3 py-3.5 font-bold">{i18n.colCode}</th>
                                <th className="px-3 py-3.5 font-bold">{i18n.colPositionDept}</th>
                                <th className="px-3 py-3.5 font-bold">{i18n.colContract}</th>
                                <th className="px-3 py-3.5 font-bold text-center">{i18n.colDocs}</th>
                                <th className="px-3 py-3.5 font-bold">{i18n.colErpAccount}</th>
                                <th className="px-3 py-3.5 font-bold text-center">{i18n.colStatus}</th>
                                <th className="px-4 py-3.5 font-bold text-right">{i18n.colActions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/40 text-slate-900">
                            {employees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-600">
                                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0891B2]" />
                                        <p className="font-semibold text-slate-700">{i18n.emptyTitle}</p>
                                        <p className="text-[11px] mt-1">{i18n.emptySub}</p>
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
                                                 <div className="w-9 h-9 rounded-full bg-[#0E7490]/20 border border-[#0E7490]/50 flex items-center justify-center font-bold text-[#0891B2] shrink-0">
                                                     {emp.fullName.charAt(0).toUpperCase()}
                                                 </div>
                                                 <div className="min-w-0">
                                                     <p
                                                         onClick={() => handleOpenDetail(emp)}
                                                         className="font-bold text-slate-900 hover:text-[#0891B2] transition-colors cursor-pointer truncate max-w-[180px]"
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
                                             <span className="inline-block font-mono font-bold text-xs px-2 py-0.5 rounded bg-white text-[#0891B2] border border-slate-200 whitespace-nowrap shrink-0">
                                                 {emp.code}
                                             </span>
                                        </td>

                                        {/* Position & Dept */}
                                        <td className="px-3 py-3">
                                             <p className="font-semibold text-slate-900 truncate max-w-[160px]">{emp.position || '—'}</p>
                                             <p className="text-[11px] text-slate-600 truncate max-w-[160px]">
                                                 {emp.dept?.name || i18n.unassignedDept}
                                             </p>
                                        </td>

                                        {/* Contract & Warnings */}
                                        <td className="px-3 py-3">
                                             <div>
                                                 <p className="font-semibold text-slate-900">
                                                     {i18n.contractTypesMedium[emp.contractType] || emp.contractType || '—'}
                                                 </p>
                                                 {emp.contractEndDate ? (
                                                     <div className="flex items-center gap-1.5 mt-0.5">
                                                         <span className="text-[11px] text-slate-600">
                                                             {i18n.expiryPrefix} {formatDate(emp.contractEndDate)}
                                                         </span>
                                                         {emp.contractWarning === 'EXPIRING_SOON' && (
                                                             <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                                                 {i18n.daysLeftBadge(emp.contractDaysLeft)}
                                                             </span>
                                                         )}
                                                         {emp.contractWarning === 'EXPIRED' && (
                                                             <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 whitespace-nowrap shrink-0">
                                                                 {i18n.expiredBadge}
                                                             </span>
                                                         )}
                                                     </div>
                                                 ) : (
                                                     <span className="text-[11px] text-slate-600">{i18n.noExpiryText}</span>
                                                 )}
                                             </div>
                                        </td>

                                        {/* Documents Count & Quick Upload */}
                                        <td className="px-3 py-3 text-center">
                                             <div className="flex items-center justify-center gap-1.5">
                                                 <button
                                                     onClick={() => handleOpenDetail(emp)}
                                                     className="flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-[#E2E8F0] text-xs font-semibold text-[#0891B2] border border-slate-200 transition-colors cursor-pointer"
                                                     title={i18n.titleViewDocs}
                                                 >
                                                     <FileText className="w-3.5 h-3.5" />
                                                     <span>{emp.documentsCount}</span>
                                                 </button>
                                                 <button
                                                     onClick={() => setQuickUploadEmp({ id: emp.id, name: emp.fullName })}
                                                     className="p-1 rounded bg-white hover:bg-[#E2E8F0] text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                                                     title={i18n.titleUploadMore}
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
                                                    <span className="font-semibold text-slate-900 truncate max-w-[130px]" title={emp.user.email}>
                                                        {emp.user.name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-600 italic text-[11px]">{i18n.unlinkedAccount}</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-3 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                                emp.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    : emp.status === 'PROBATION'
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                    : emp.status === 'ON_LEAVE'
                                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                            }`}>
                                                {i18n.statuses[emp.status] ?? emp.status}
                                            </span>
                                        </td>

                                        {/* Action buttons */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => handleOpenDetail(emp)}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#0891B2] hover:bg-slate-100 transition-colors cursor-pointer"
                                                    title={i18n.titleViewDetail}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(emp)}
                                                    className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                                    title={i18n.titleEditInfo}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {emp.status !== 'RESIGNED' && (
                                                    <button
                                                        onClick={() => handleDelete(emp)}
                                                        className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title={i18n.titleMarkResigned}
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
            {confirmDialog}
        </div>
    )
}
