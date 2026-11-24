'use client'

import React, { useState, useTransition } from 'react'
import {
    Users, UserCheck, Clock, AlertTriangle, FileText, Plus,
    Filter, BellRing, Building, ChevronRight, Eye, Edit,
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
import { PageHeader, StatGrid, StatCard, Button, SearchInput, Select, useConfirmDialog } from '@/components/ui'
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
                description={i18n.pageDesc}
                actions={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleSendBellNotifications}
                            disabled={isSendingAlerts}
                            title={i18n.btnSendAlertsTitle}
                        >
                            <BellRing className={`w-3.5 h-3.5 text-tone-warning-fg ${isSendingAlerts ? 'animate-bounce' : ''}`} />
                            <span>{i18n.btnSendAlerts}</span>
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleOpenCreate}
                        >
                            <Plus className="w-3.5 h-3.5" /> {i18n.btnAddEmployee}
                        </Button>
                    </div>
                }
            />

            {/* KPI Stat Cards */}
            <StatGrid cols={6}>
                <StatCard label={i18n.kpiTotal} value={stats.totalEmployees} sub={i18n.kpiTotalSub} icon={Users} tone="brand" />
                <StatCard label={i18n.kpiActive} value={stats.activeEmployees} sub={i18n.kpiActiveSub} icon={UserCheck} tone="success" />
                <StatCard label={i18n.kpiProbation} value={stats.probationEmployees} sub={i18n.kpiProbationSub} icon={Clock} tone="info" />
                <StatCard
                    label={i18n.kpiExpiring}
                    value={stats.expiringContracts}
                    sub={i18n.kpiExpiringSub}
                    icon={AlertTriangle}
                    tone="warning"
                    active={contractExpiringOnly}
                    onClick={() => {
                        const newVal = !contractExpiringOnly
                        setContractExpiringOnly(newVal)
                        fetchFilteredEmployees(search, deptId, status, newVal)
                    }}
                />
                <StatCard label={i18n.kpiExpired} value={stats.expiredContracts} sub={i18n.kpiExpiredSub} icon={AlertCircle} tone="danger" />
                <StatCard label={i18n.kpiDocs} value={stats.totalDocs} sub={i18n.kpiDocsSub} icon={FileText} tone="brand" />
            </StatGrid>

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
            <div className="p-3.5 rounded-lg bg-lys-card border border-lys-border shadow-xs">
                <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
                    <SearchInput
                        placeholder={i18n.searchPlaceholder}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full sm:w-full"
                    />

                    <Select
                        value={deptId}
                        onChange={e => {
                            setDeptId(e.target.value)
                            fetchFilteredEmployees(search, e.target.value, status, contractExpiringOnly)
                        }}
                        className="w-full"
                    >
                        <option value="ALL">{i18n.allDepts}</option>
                        {departments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </Select>

                    <Select
                        value={status}
                        onChange={e => {
                            setStatus(e.target.value)
                            fetchFilteredEmployees(search, deptId, e.target.value, contractExpiringOnly)
                        }}
                        className="w-full"
                    >
                        <option value="ALL">{i18n.allStatuses}</option>
                        <option value="ACTIVE">{i18n.statusesFilter.ACTIVE}</option>
                        <option value="PROBATION">{i18n.statusesFilter.PROBATION}</option>
                        <option value="ON_LEAVE">{i18n.statusesFilter.ON_LEAVE}</option>
                        <option value="RESIGNED">{i18n.statusesFilter.RESIGNED}</option>
                    </Select>

                    <div className="flex items-center gap-2">
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={isPending}
                            className="h-9 flex-1"
                        >
                            <Filter className="w-3.5 h-3.5" />
                            <span>{i18n.btnFilter}</span>
                        </Button>
                        {(search || deptId !== 'ALL' || status !== 'ALL' || contractExpiringOnly) && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setSearch('')
                                    setDeptId('ALL')
                                    setStatus('ALL')
                                    setContractExpiringOnly(false)
                                    fetchFilteredEmployees('', 'ALL', 'ALL', false)
                                }}
                                className="h-9 px-2.5"
                                title={i18n.btnClearFilterTitle}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
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
            <div className="hidden md:block rounded-lg border border-lys-border bg-lys-card overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-lys-subtle text-lys-muted uppercase text-[11px] tracking-wider border-b border-lys-border">
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
