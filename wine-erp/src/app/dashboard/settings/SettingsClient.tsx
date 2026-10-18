'use client'

import React, { useState, useCallback } from 'react'
import {
    Shield, Users, Settings, Bell, Plus, X, Save, Loader2,
    User, ChevronDown, CheckCircle2, AlertCircle, Search, Eye,
    ClipboardCheck, Check, XCircle, Building2, CreditCard,
    HardDrive, Database, RefreshCw, ExternalLink, FolderOpen
} from 'lucide-react'
import { toast } from 'sonner'
import {
    UserRow, RoleRow, createUser, updateUser, updateUserRoles,
    createRole, updateRolePermissions, getRolePermissions, getUsers, getRoles,
    getApprovalTemplates, getPendingApprovals, processApproval, createApprovalTemplate,
    getLegalEntitiesList, updateLegalEntity, getSystemWarehouses, updateWarehouseConfig, updateWarehouseLegalEntity,
    adminResetPassword, getSystemInfrastructureStatus, SystemInfrastructureStatus
} from './actions'
import { getAuditLogs, getFieldChanges } from '@/lib/audit'
import { type SessionUser } from '@/lib/session'
import { PageHeader, StatGrid, StatCard, Button } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { SETTINGS_I18N } from './i18n'

// ── Shared Style Tokens ──────────────────────────
const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#0F172A',
    fontSize: '14px', outline: 'none',
}

const focusHandler = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = '#0891B2',
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = '#E2E8F0',
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    ACTIVE: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' },
    INACTIVE: { color: '#64748B', bg: 'rgba(100,116,139,0.15)' },
    SUSPENDED: { color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
}

type Tab = 'users' | 'roles' | 'approvals' | 'audit' | 'entities' | 'storage'

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const val = bytes / Math.pow(1024, i)
    return `${val.toFixed(i >= 2 ? 2 : 1)} ${units[i]}`
}

type PermissionRow = { id: string; code: string; module: string; action: string }

interface Props {
    initialUsers: UserRow[]
    initialRoles: RoleRow[]
    permissions: PermissionRow[]
    stats: { users: number; roles: number; activeUsers: number; pendingApprovals: number }
    currentUser: SessionUser | null
}

// ── Create User Drawer ───────────────────────────
function CreateUserDrawer({ open, onClose, onCreated, roles }: {
    open: boolean; onClose: () => void; onCreated: () => void; roles: RoleRow[]
}) {
    const { locale } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({ email: '', name: '', password: '', roleIds: [] as string[] })

    const toggleRole = (id: string) => {
        setForm(f => ({
            ...f,
            roleIds: f.roleIds.includes(id) ? f.roleIds.filter(r => r !== id) : [...f.roleIds, id]
        }))
    }

    async function handleSave() {
        setSaving(true)
        setError('')
        const res = await createUser({
            email: form.email,
            name: form.name,
            passwordHash: form.password,
            roleIds: form.roleIds,
        })
        if (res.success) {
            setForm({ email: '', name: '', password: '', roleIds: [] })
            onCreated()
            onClose()
        } else {
            setError(res.error || i18n.createUserError)
        }
        setSaving(false)
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-md h-full overflow-y-auto p-6 bg-white border-l border-slate-200 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{i18n.createUserTitle}</h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#64748B' }} /></button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                        style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.3)', color: '#B91C1C' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelEmail}</label>
                        <input style={inputStyle} {...focusHandler} type="email" placeholder="ten@lyscellars.com"
                            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelFullName}</label>
                        <input style={inputStyle} {...focusHandler} placeholder="Nguyễn Văn A"
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelPassword}</label>
                        <input style={inputStyle} {...focusHandler} type="password" placeholder={i18n.placeholderPasswordMin}
                            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelRoles}</label>
                        <div className="grid grid-cols-2 gap-2">
                            {roles.map(r => (
                                <button key={r.id} onClick={() => toggleRole(r.id)}
                                    className="text-left px-3 py-2 rounded text-xs font-semibold font-mono transition-all"
                                    style={{
                                        background: form.roleIds.includes(r.id) ? 'rgba(8, 145, 178, 0.08)' : '#FFFFFF',
                                        border: form.roleIds.includes(r.id) ? '1px solid #0E7490' : '1px solid #E2E8F0',
                                        color: form.roleIds.includes(r.id) ? '#0E7490' : '#475569',
                                    }}>
                                    {form.roleIds.includes(r.id) && <CheckCircle2 size={12} className="inline mr-1" />}
                                    {r.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? i18n.btnSaving : i18n.createUserTitle}
                </button>
            </div>
        </div>
    )
}

// ── Module Business Domain Groups (31 Phân Hệ) ───────────
interface ModuleGroupDef {
    key: keyof typeof SETTINGS_I18N['vi']['moduleGroups']
    modules: string[]
}

const MODULE_GROUPS: ModuleGroupDef[] = [
    {
        key: 'exec',
        modules: ['DSH', 'RPT', 'KPI'],
    },
    {
        key: 'mdm',
        modules: ['MDM', 'CRM', 'CNT'],
    },
    {
        key: 'sales',
        modules: ['SLS', 'PRO', 'MGN', 'POS', 'CSG', 'AGN', 'SFV', 'RTN'],
    },
    {
        key: 'procurement',
        modules: ['PRC', 'SHP', 'CST'],
    },
    {
        key: 'warehouse',
        modules: ['WMS', 'STM', 'TRS', 'STP', 'QRC'],
    },
    {
        key: 'finance',
        modules: ['FIN', 'PAY', 'TAX'],
    },
    {
        key: 'admin',
        modules: ['HRM', 'MKT', 'SYS', 'AUD', 'APM', 'AI'],
    },
]

// ── Reusable Grouped Permission Selector ────────────────
function RolePermissionSelector({
    permissions,
    selectedPerms,
    onChange,
}: {
    permissions: PermissionRow[]
    selectedPerms: string[]
    onChange: (perms: string[]) => void
}) {
    const { locale } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]
    const [search, setSearch] = useState('')

    const togglePerm = (permId: string) => {
        onChange(selectedPerms.includes(permId) ? selectedPerms.filter(x => x !== permId) : [...selectedPerms, permId])
    }

    const toggleModule = (mod: string) => {
        const modPerms = permissions.filter(p => p.module === mod).map(p => p.id)
        const allSelected = modPerms.length > 0 && modPerms.every(id => selectedPerms.includes(id))
        if (allSelected) {
            onChange(selectedPerms.filter(id => !modPerms.includes(id)))
        } else {
            onChange([...new Set([...selectedPerms, ...modPerms])])
        }
    }

    const toggleGroup = (modList: string[]) => {
        const groupPerms = permissions.filter(p => modList.includes(p.module)).map(p => p.id)
        const allSelected = groupPerms.length > 0 && groupPerms.every(id => selectedPerms.includes(id))
        if (allSelected) {
            onChange(selectedPerms.filter(id => !groupPerms.includes(id)))
        } else {
            onChange([...new Set([...selectedPerms, ...groupPerms])])
        }
    }

    const selectAll = () => onChange(permissions.map(p => p.id))
    const deselectAll = () => onChange([])

    const allModulesInPerms = Array.from(new Set(permissions.map(p => p.module)))

    const groupedModules = MODULE_GROUPS.map(g => ({
        name: i18n.moduleGroups[g.key],
        modules: g.modules.filter(m => allModulesInPerms.includes(m)),
    })).filter(g => g.modules.length > 0)

    const categorizedModules = new Set(groupedModules.flatMap(g => g.modules))
    const otherModules = allModulesInPerms.filter(m => !categorizedModules.has(m))
    if (otherModules.length > 0) {
        groupedModules.push({
            name: i18n.moduleGroups.other,
            modules: otherModules,
        })
    }

    const filteredGroups = groupedModules.map(g => {
        const filteredMods = g.modules.filter(mod => {
            if (!search) return true
            const q = search.toLowerCase()
            const name = i18n.modules[mod] ?? mod
            if (mod.toLowerCase().includes(q) || name.toLowerCase().includes(q)) return true
            const modPerms = permissions.filter(p => p.module === mod)
            return modPerms.some(p => p.action.toLowerCase().includes(q) || (i18n.actions[p.action] ?? '').toLowerCase().includes(q))
        })
        return { ...g, modules: filteredMods }
    }).filter(g => g.modules.length > 0)

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input
                        style={{ ...inputStyle, paddingLeft: '32px' }}
                        className="text-xs"
                        placeholder={i18n.searchPermPlaceholder}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold" style={{ color: '#475569' }}>
                        {i18n.selectedPermsCount(selectedPerms.length, permissions.length)}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={selectAll}
                            className="px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                            style={{ background: 'rgba(8, 145, 178, 0.1)', color: '#0891B2' }}
                        >
                            {i18n.btnSelectAll}
                        </button>
                        <button
                            type="button"
                            onClick={deselectAll}
                            className="px-2 py-1 rounded text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                            style={{ background: '#F1F5F9', color: '#64748B' }}
                        >
                            {i18n.btnDeselectAll}
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-8 text-xs" style={{ color: '#94A3B8' }}>
                        {i18n.noMatchingModules}
                    </div>
                ) : (
                    filteredGroups.map(group => {
                        const groupPerms = permissions.filter(p => group.modules.includes(p.module)).map(p => p.id)
                        const groupSelectedCount = groupPerms.filter(id => selectedPerms.includes(id)).length
                        const isAllGroupSelected = groupPerms.length > 0 && groupSelectedCount === groupPerms.length

                        return (
                            <div key={group.name} className="rounded-md border border-slate-200 overflow-hidden bg-white shadow-xs">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold" style={{ color: '#0F172A' }}>{group.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                                            {groupSelectedCount}/{groupPerms.length}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(group.modules)}
                                        className="text-xs font-medium hover:underline cursor-pointer"
                                        style={{ color: '#0891B2' }}
                                    >
                                        {isAllGroupSelected ? i18n.btnDeselectGroup : i18n.btnSelectGroup}
                                    </button>
                                </div>

                                <div className="p-2 space-y-2">
                                    {group.modules.map(mod => {
                                        const modPerms = permissions.filter(p => p.module === mod)
                                        const count = modPerms.filter(p => selectedPerms.includes(p.id)).length
                                        const isAllModSelected = count === modPerms.length

                                        return (
                                            <div key={mod} className="rounded-md p-2.5 border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleModule(mod)}
                                                    className="flex items-center justify-between w-full text-left cursor-pointer"
                                                >
                                                    <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#1E293B' }}>
                                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">{mod}</span>
                                                        <span>{i18n.modules[mod] ?? mod}</span>
                                                    </span>
                                                    <span className="text-xs font-semibold" style={{ color: isAllModSelected ? '#0891B2' : '#94A3B8' }}>
                                                        {count}/{modPerms.length}
                                                    </span>
                                                </button>
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {modPerms.map(p => {
                                                        const active = selectedPerms.includes(p.id)
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => togglePerm(p.id)}
                                                                className="text-xs px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1"
                                                                style={{
                                                                    background: active ? 'rgba(8, 145, 178, 0.15)' : '#FFFFFF',
                                                                    color: active ? '#0E7490' : '#64748B',
                                                                    border: active ? '1px solid rgba(8,145,178,0.4)' : '1px solid #E2E8F0',
                                                                    fontWeight: active ? '600' : '500',
                                                                }}
                                                            >
                                                                <span className="font-mono text-[10px] opacity-80">{p.code}</span>
                                                                <span>· {i18n.actions[p.action] ?? p.action}</span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

// ── Create Role Drawer ───────────────────────────
function CreateRoleDrawer({ open, onClose, onCreated, permissions }: {
    open: boolean; onClose: () => void; onCreated: () => void; permissions: PermissionRow[]
}) {
    const { locale } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState('')
    const [selectedPerms, setSelectedPerms] = useState<string[]>([])

    async function handleSave() {
        setSaving(true)
        const res = await createRole({ name, permissionIds: selectedPerms })
        if (res.success) {
            setName('')
            setSelectedPerms([])
            onCreated()
            onClose()
        }
        setSaving(false)
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-lg h-full overflow-y-auto p-6 bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{i18n.createRoleTitle}</h3>
                        <button onClick={onClose}><X size={18} style={{ color: '#64748B' }} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelRoleName}</label>
                            <input style={inputStyle} {...focusHandler} placeholder={i18n.placeholderRoleName}
                                value={name} onChange={e => setName(e.target.value)} />
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-2 block" style={{ color: '#475569' }}>{i18n.labelPermByModule}</label>
                            <RolePermissionSelector
                                permissions={permissions}
                                selectedPerms={selectedPerms}
                                onChange={setSelectedPerms}
                            />
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving || !name}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all shrink-0 cursor-pointer"
                    style={{ background: name ? '#0E7490' : '#E2E8F0', color: name ? '#FFFFFF' : '#64748B' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? i18n.btnSaving : i18n.btnCreateRoleCount(selectedPerms.length)}
                </button>
            </div>
        </div>
    )
}

// ── Edit Role Permissions Drawer ──────────────────
function EditRolePermissionsDrawer({ open, onClose, onUpdated, role, permissions }: {
    open: boolean
    onClose: () => void
    onUpdated: () => void
    role: RoleRow | null
    permissions: PermissionRow[]
}) {
    const { locale } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]
    const [saving, setSaving] = useState(false)
    const [selectedPerms, setSelectedPerms] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    // Load permissions for selected role
    React.useEffect(() => {
        if (open && role) {
            setLoading(true)
            getRolePermissions(role.id)
                .then(permIds => {
                    setSelectedPerms(permIds)
                    setLoading(false)
                })
                .catch(err => {
                    toast.error(i18n.loadPermsError + err.message)
                    setLoading(false)
                })
        }
    }, [open, role, i18n.loadPermsError])

    async function handleSave() {
        if (!role) return
        setSaving(true)
        const res = await updateRolePermissions(role.id, selectedPerms)
        if (res.success) {
            toast.success(i18n.updatePermsSuccess)
            onUpdated()
            onClose()
        } else {
            toast.error(res.error || i18n.updatePermsError)
        }
        setSaving(false)
    }

    if (!open || !role) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-lg h-full overflow-y-auto p-6 bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                                {i18n.editRoleTitle}
                            </h3>
                            <p className="text-xs" style={{ color: '#64748B' }}>
                                {i18n.editRoleSubtitle} <strong className="font-mono" style={{ color: '#0891B2' }}>{role.name}</strong>
                            </p>
                        </div>
                        <button onClick={onClose}><X size={18} style={{ color: '#64748B' }} /></button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <RolePermissionSelector
                                permissions={permissions}
                                selectedPerms={selectedPerms}
                                onChange={setSelectedPerms}
                            />
                        </div>
                    )}
                </div>

                <button onClick={handleSave} disabled={saving || loading}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all shrink-0 cursor-pointer"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? i18n.btnSaving : i18n.btnSavePermsCount(selectedPerms.length)}
                </button>
            </div>
        </div>
    )
}

// ── User Detail / Edit Drawer ─────────────────────
interface UserDetailDrawerProps {
    open: boolean
    onClose: () => void
    user: UserRow | null
    roles: RoleRow[]
    currentUser: SessionUser | null
    onUpdated: () => void
}

function UserDetailDrawer({ open, onClose, user, roles, currentUser, onUpdated }: UserDetailDrawerProps) {
    const { locale, formatDate } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [form, setForm] = useState({ name: '', status: 'ACTIVE', roleIds: [] as string[] })
    const [resetPassword, setResetPassword] = useState('')

    React.useEffect(() => {
        if (user) {
            const userRoleIds = roles
                .filter(r => user.roles.includes(r.name))
                .map(r => r.id)
            setForm({
                name: user.name || '',
                status: user.status,
                roleIds: userRoleIds
            })
            setResetPassword('')
            setError('')
        }
    }, [user, roles])

    if (!open || !user) return null

    const isAdmin = currentUser?.permissions.includes('SYS:ADMIN') || false
    const statusStyle = STATUS_STYLE[user.status] ?? STATUS_STYLE.ACTIVE
    const statusLabel = i18n.statuses[user.status] ?? user.status

    const toggleRole = (id: string) => {
        if (!isAdmin) return
        setForm(f => ({
            ...f,
            roleIds: f.roleIds.includes(id) ? f.roleIds.filter(r => r !== id) : [...f.roleIds, id]
        }))
    }

    async function handleSave() {
        if (!isAdmin || !user) return
        setSaving(true)
        setError('')
        try {
            if (resetPassword.trim().length > 0 && resetPassword.trim().length < 6) {
                setError(i18n.passwordMinError)
                setSaving(false)
                return
            }

            const resUser = await updateUser(user.id, { name: form.name, status: form.status as any })
            if (resUser.success) {
                const resRoles = await updateUserRoles(user.id, form.roleIds)
                if (resRoles.success) {
                    if (resetPassword.trim().length >= 6) {
                        const resPass = await adminResetPassword(user.id, resetPassword.trim())
                        if (!resPass.success) {
                            setError(resPass.error || i18n.resetPasswordError)
                            setSaving(false)
                            return
                        }
                    }
                    onUpdated()
                    onClose()
                } else {
                    setError(resRoles.error || i18n.updateRolesError)
                }
            } else {
                setError(resUser.error || i18n.updateInfoError)
            }
        } catch (err: any) {
            setError(err.message || i18n.systemError)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl bg-white border-l border-slate-200">
                <div>
                    <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                            {isAdmin ? i18n.editUserTitle : i18n.userDetailTitle}
                        </h3>
                        <button onClick={onClose} className="hover:opacity-80 transition-opacity"><X size={18} style={{ color: '#64748B' }} /></button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                            style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.3)', color: '#B91C1C' }}>
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelEmail}</label>
                            <div className="text-sm font-semibold p-3 rounded-md font-mono" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                {user.email}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelFullName}</label>
                            {isAdmin ? (
                                <input style={inputStyle} {...focusHandler} placeholder={i18n.placeholderFullName}
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            ) : (
                                <div className="text-sm font-semibold p-3 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                                    {user.name || '—'}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelStatus}</label>
                            {isAdmin ? (
                                <select style={inputStyle} {...focusHandler}
                                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                                    <option value="ACTIVE">{i18n.statuses.ACTIVE}</option>
                                    <option value="INACTIVE">{i18n.statusInactiveFull}</option>
                                    <option value="SUSPENDED">{i18n.statuses.SUSPENDED}</option>
                                </select>
                            ) : (
                                <div className="p-3 rounded-md flex items-center" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                        style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                        {statusLabel}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-2 block" style={{ color: '#475569' }}>{i18n.labelRoles}</label>
                            {isAdmin ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(r => {
                                        const selected = form.roleIds.includes(r.id)
                                        return (
                                            <button key={r.id} onClick={() => toggleRole(r.id)}
                                                className="text-left px-3 py-2 rounded text-xs font-semibold font-mono transition-all"
                                                style={{
                                                    background: selected ? 'rgba(8, 145, 178, 0.08)' : '#FFFFFF',
                                                    border: selected ? '1px solid #0E7490' : '1px solid #E2E8F0',
                                                    color: selected ? '#0E7490' : '#475569',
                                                }}>
                                                {selected && <CheckCircle2 size={12} className="inline mr-1" />}
                                                {r.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 p-3 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                    {user.roles.map(r => (
                                        <span key={r} className="inline-block text-xs px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap shrink-0"
                                            style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelResetPassword}</label>
                                <input style={inputStyle} {...focusHandler} type="password" placeholder={i18n.placeholderResetPassword}
                                    value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelCreatedAt}</label>
                            <div className="text-sm p-3 rounded-md" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569' }}>
                                {formatDate(user.createdAt)}
                            </div>
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <button onClick={handleSave} disabled={saving}
                        className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all hover:opacity-90"
                        style={{ background: '#0E7490', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? i18n.btnSaving : i18n.btnSaveChanges}
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Main Settings Client ─────────────────────────
export function SettingsClient({ initialUsers, initialRoles, permissions, stats, currentUser }: Props) {
    const { locale, formatDate, formatNumber } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]

    const [tab, setTab] = useState<Tab>('users')
    const [users, setUsers] = useState(initialUsers)
    const [roles, setRoles] = useState(initialRoles)
    const [showCreateUser, setShowCreateUser] = useState(false)
    const [showCreateRole, setShowCreateRole] = useState(false)
    const [search, setSearch] = useState('')
    const [auditLogs, setAuditLogs] = useState<any[]>([])
    const [auditLoaded, setAuditLoaded] = useState(false)
    const [approvalTemplates, setApprovalTemplates] = useState<any[]>([])
    const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
    const [approvalsLoaded, setApprovalsLoaded] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
    const [fieldChanges, setFieldChanges] = useState<any[]>([])
    const [loadingChanges, setLoadingChanges] = useState(false)
    const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
    const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null)
    const [showEditRole, setShowEditRole] = useState(false)

    // Legal Entities Tab States
    const [entities, setEntities] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [entitiesLoaded, setEntitiesLoaded] = useState(false)
    const [editingEntity, setEditingEntity] = useState<any | null>(null)
    const [savingEntity, setSavingEntity] = useState(false)

    // Infrastructure & Cloudflare R2 Storage States
    const [infraStatus, setInfraStatus] = useState<SystemInfrastructureStatus | null>(null)
    const [infraLoading, setInfraLoading] = useState(false)

    const loadInfrastructure = useCallback(async () => {
        setInfraLoading(true)
        try {
            const res = await getSystemInfrastructureStatus()
            setInfraStatus(res)
        } catch (err: any) {
            toast.error(i18n.loadInfraError + err.message)
        } finally {
            setInfraLoading(false)
        }
    }, [i18n.loadInfraError])

    const loadEntities = useCallback(async () => {
        try {
            const [ents, whs] = await Promise.all([
                getLegalEntitiesList(),
                getSystemWarehouses()
            ])
            setEntities(ents)
            setWarehouses(whs)
            setEntitiesLoaded(true)
        } catch (err: any) {
            toast.error(i18n.loadEntitiesError + err.message)
        }
    }, [i18n.loadEntitiesError])

    const handleSaveEntity = async (id: string, data: any) => {
        setSavingEntity(true)
        const res = await updateLegalEntity(id, data)
        if (res.success) {
            toast.success(i18n.updateEntitySuccess)
            setEditingEntity(null)
            await loadEntities()
        } else {
            toast.error(res.error || i18n.updateEntityError)
        }
        setSavingEntity(false)
    }

    const handleUpdateWarehouseConfigState = async (warehouseId: string, data: {
        legalEntityId?: string | null
        allowSales?: boolean
        allowTransfer?: boolean
        isDefault?: boolean
    }) => {
        const res = await updateWarehouseConfig(warehouseId, data)
        if (res.success) {
            toast.success(i18n.updateWarehouseSuccess)
            await loadEntities()
        } else {
            toast.error(res.error || i18n.updateWarehouseError)
        }
    }

    const reload = useCallback(async () => {
        const [u, r] = await Promise.all([getUsers(), getRoles()])
        setUsers(u)
        setRoles(r)
    }, [])

    const loadAudit = useCallback(async () => {
        const { logs } = await getAuditLogs({ limit: 100 })
        setAuditLogs(logs)
        setAuditLoaded(true)
    }, [])

    const loadApprovals = useCallback(async () => {
        const [templates, pending] = await Promise.all([
            getApprovalTemplates(),
            getPendingApprovals('system'),
        ])
        setApprovalTemplates(templates)
        setPendingApprovals(pending)
        setApprovalsLoaded(true)
    }, [])

    React.useEffect(() => {
        if (tab === 'audit' && !auditLoaded) loadAudit()
        if (tab === 'approvals' && !approvalsLoaded) loadApprovals()
        if (tab === 'entities' && !entitiesLoaded) loadEntities()
        if (tab === 'storage' && !infraStatus && !infraLoading) loadInfrastructure()
    }, [tab, auditLoaded, approvalsLoaded, entitiesLoaded, infraStatus, infraLoading, loadAudit, loadApprovals, loadEntities, loadInfrastructure])

    const handleApproval = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(requestId)
        await processApproval({ requestId, action })
        await loadApprovals()
        setProcessingId(null)
    }

    async function handleStatusChange(userId: string, newStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
        await updateUser(userId, { status: newStatus })
        reload()
    }

    const filteredUsers = users.filter(u =>
        !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    )

    const tabs: { key: Tab; label: string; icon: React.FC<any> }[] = [
        { key: 'users', label: i18n.tabUsers, icon: Users },
        { key: 'roles', label: i18n.tabRoles, icon: Shield },
        { key: 'approvals', label: i18n.tabApprovals, icon: ClipboardCheck },
        { key: 'entities', label: i18n.tabEntities, icon: Building2 },
        { key: 'storage', label: i18n.tabStorage, icon: HardDrive },
        { key: 'audit', label: i18n.tabAudit, icon: Eye },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <PageHeader
                title={i18n.pageTitle}
                description={i18n.pageDesc}
                actions={
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => {
                                setTab('storage')
                                if (!infraStatus && !infraLoading) loadInfrastructure()
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 cursor-pointer"
                        >
                            <HardDrive size={13} /> {i18n.btnCheckStorage}
                        </button>
                        <a href="/dashboard/settings/approval-matrix"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            style={{ textDecoration: 'none' }}>
                            <Shield size={13} style={{ color: '#0891B2' }} /> {i18n.btnApprovalMatrix}
                        </a>
                        <a href="/dashboard/settings/telegram"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            style={{ textDecoration: 'none' }}>
                            <Bell size={13} style={{ color: '#0891B2' }} /> {i18n.btnTelegramBot}
                        </a>
                    </div>
                }
            />

            {/* Stats */}
            <StatGrid>
                <StatCard label={i18n.statUsers} value={stats.users} icon={Users} />
                <StatCard label={i18n.statActiveUsers} value={stats.activeUsers} icon={CheckCircle2} tone="success" />
                <StatCard label={i18n.statRoles} value={stats.roles} icon={Shield} />
                <StatCard label={i18n.statPendingApprovals} value={stats.pendingApprovals} icon={Bell} tone={stats.pendingApprovals > 0 ? 'warning' : undefined} />
            </StatGrid>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg overflow-x-auto no-scrollbar whitespace-nowrap" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                {tabs.map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    return (
                        <button key={t.key}
                            onClick={() => {
                                setTab(t.key)
                                if (t.key === 'audit' && !auditLoaded) loadAudit()
                                if (t.key === 'approvals' && !approvalsLoaded) loadApprovals()
                                if (t.key === 'entities' && !entitiesLoaded) loadEntities()
                                if (t.key === 'storage' && !infraStatus && !infraLoading) loadInfrastructure()
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all flex-1 justify-center cursor-pointer whitespace-nowrap shrink-0"
                            style={{
                                background: active ? 'rgba(8, 145, 178, 0.08)' : 'transparent',
                                color: active ? '#0891B2' : '#64748B',
                                border: active ? '1px solid rgba(8, 145, 178, 0.2)' : '1px solid transparent',
                            }}>
                            <Icon size={14} /> {t.label}
                        </button>
                    )
                })}
            </div>

            {/* ── Users Tab ────────────────────────── */}
            {tab === 'users' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                            <input className="w-full pl-9 pr-3 py-2 text-sm rounded-md"
                                style={{ ...inputStyle, width: '100%' }}
                                placeholder={i18n.searchUserPlaceholder}
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button onClick={() => setShowCreateUser(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md shrink-0"
                            style={{ background: '#0E7490', color: '#FFFFFF' }}>
                            <Plus size={16} /> {i18n.btnAddUser}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-md overflow-x-auto border border-slate-200">
                        <table className="w-full text-left min-w-[700px]" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {[i18n.colFullName, i18n.colEmail, i18n.colRoles, i18n.colStatus, i18n.colCreatedAt, ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>
                                        {i18n.emptyUsers}
                                    </td></tr>
                                ) : filteredUsers.map(u => {
                                    const st = STATUS_STYLE[u.status] ?? STATUS_STYLE.ACTIVE
                                    const statusLabel = i18n.statuses[u.status] ?? u.status
                                    return (
                                        <tr key={u.id} className="hover:bg-cyan-50/40 transition-colors" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-3 py-2.5 text-sm font-semibold cursor-pointer hover:underline hover:text-[#0891B2] transition-all"
                                                style={{ color: '#0F172A' }}
                                                onClick={() => setSelectedUser(u)}>
                                                {u.name || '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#475569' }}>
                                                {u.email}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.roles.map(r => (
                                                        <span key={r} className="inline-block text-xs px-2 py-0.5 rounded font-semibold font-mono whitespace-nowrap shrink-0"
                                                            style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                                    style={{ background: st.bg, color: st.color }}>
                                                    {statusLabel}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>
                                                {formatDate(u.createdAt)}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <select
                                                    value={u.status}
                                                    disabled={!currentUser?.permissions.includes('SYS:ADMIN')}
                                                    onChange={e => handleStatusChange(u.id, e.target.value as any)}
                                                    className="text-xs px-2 py-1 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#475569', outline: 'none' }}>
                                                    <option value="ACTIVE">{i18n.statuses.ACTIVE}</option>
                                                    <option value="INACTIVE">{i18n.statuses.INACTIVE}</option>
                                                    <option value="SUSPENDED">{i18n.statuses.SUSPENDED}</option>
                                                </select>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2.5">
                        {filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-500 border border-slate-200 rounded-lg bg-white">
                                {i18n.emptyUsers}
                            </div>
                        ) : filteredUsers.map(u => {
                            const st = STATUS_STYLE[u.status] ?? STATUS_STYLE.ACTIVE
                            const statusLabel = i18n.statuses[u.status] ?? u.status
                            return (
                                <div key={u.id} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div onClick={() => setSelectedUser(u)} className="cursor-pointer min-w-0">
                                            <p className="text-sm font-bold text-slate-900 truncate">{u.name || '—'}</p>
                                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                        </div>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-bold shrink-0"
                                            style={{ background: st.bg, color: st.color }}>
                                            {statusLabel}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {u.roles.map(r => (
                                            <span key={r} className="inline-block text-[11px] px-2 py-0.5 rounded font-semibold font-mono"
                                                style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                                {r}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                                        <span>{formatDate(u.createdAt)}</span>
                                        <select
                                            value={u.status}
                                            disabled={!currentUser?.permissions.includes('SYS:ADMIN')}
                                            onChange={e => handleStatusChange(u.id, e.target.value as any)}
                                            className="text-xs px-2 py-1 rounded border border-slate-200 bg-white text-slate-700">
                                            <option value="ACTIVE">{i18n.statuses.ACTIVE}</option>
                                            <option value="INACTIVE">{i18n.statuses.INACTIVE}</option>
                                            <option value="SUSPENDED">{i18n.statuses.SUSPENDED}</option>
                                        </select>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Roles Tab ────────────────────────── */}
            {tab === 'roles' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: '#475569' }}>
                            {i18n.rolesSummary(permissions.length, Array.from(new Set(permissions.map(p => p.module))).length)}
                        </p>
                        <button onClick={() => setShowCreateRole(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md"
                            style={{ background: '#0E7490', color: '#FFFFFF' }}>
                            <Plus size={16} /> {i18n.btnCreateRole}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {roles.map(r => (
                            <div key={r.id} className="p-5 rounded-md cursor-pointer border border-transparent hover:border-[#0E7490]/45 hover:bg-slate-50 transition-all" 
                                style={card}
                                onClick={() => {
                                    setSelectedRole(r)
                                    setShowEditRole(true)
                                }}>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold font-mono" style={{ color: '#0F172A' }}>{r.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0"
                                            style={{ background: 'rgba(8,145,178,0.1)', color: '#0891B2' }}>
                                            {i18n.permsBadge(r.permissionCount)}
                                        </span>
                                        <span className="inline-block text-xs px-2 py-0.5 rounded whitespace-nowrap shrink-0"
                                            style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309' }}>
                                            {i18n.usersBadge(r.userCount)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Users size={12} style={{ color: '#64748B' }} />
                                    <span className="text-xs" style={{ color: '#64748B' }}>
                                        {r.userCount === 0 ? i18n.noUsersAssigned : i18n.usersAssignedCount(r.userCount)}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
                                    <div className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min((r.permissionCount / permissions.length) * 100, 100)}%`,
                                            background: r.permissionCount === permissions.length ? '#0E7490' : '#B45309',
                                        }} />
                                </div>
                                <p className="text-xs mt-1.5" style={{ color: '#64748B' }}>
                                    {i18n.permsProgress(r.permissionCount, permissions.length, Math.round((r.permissionCount / permissions.length) * 100))}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Approvals Tab ─────────────────────── */}
            {tab === 'approvals' && (
                <div className="space-y-6">
                    {/* Pending Approvals */}
                    <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: '#0F172A' }}>{i18n.pendingApprovalsTitle}</h3>
                        {!approvalsLoaded ? (
                            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#0891B2' }} /></div>
                        ) : pendingApprovals.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 rounded-md" style={{ border: '1px dashed #E2E8F0' }}>
                                <CheckCircle2 size={24} style={{ color: '#15803D' }} />
                                <p className="text-sm" style={{ color: '#64748B' }}>{i18n.noPendingApprovals}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingApprovals.map((req: any) => (
                                    <div key={req.id} className="flex items-center justify-between p-4 rounded-md" style={card}>
                                        <div className="flex items-center gap-3">
                                            <ClipboardCheck size={16} style={{ color: '#B45309' }} />
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{req.templateName || req.docType}</p>
                                                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{i18n.approvalStepBy(req.currentStep, req.requestedByName || req.requestedBy)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0" style={{ background: 'rgba(180,83,9,0.12)', color: '#B45309' }}>{req.docType}</span>
                                            <button onClick={() => handleApproval(req.id, 'APPROVE')} disabled={processingId === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(21,128,61,0.15)', color: '#15803D', border: '1px solid rgba(21,128,61,0.3)' }}>
                                                {processingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} {i18n.btnApprove}
                                            </button>
                                            <button onClick={() => handleApproval(req.id, 'REJECT')} disabled={processingId === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(185,28,28,0.12)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.25)' }}>
                                                <XCircle size={12} /> {i18n.btnReject}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Approval Templates */}
                    <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: '#0F172A' }}>{i18n.approvalTemplatesTitle}</h3>
                        {approvalTemplates.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 rounded-md" style={{ border: '1px dashed #E2E8F0' }}>
                                <ClipboardCheck size={24} style={{ color: '#E2E8F0' }} />
                                <p className="text-sm" style={{ color: '#64748B' }}>{i18n.noApprovalTemplates}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {approvalTemplates.map((tpl: any) => (
                                    <div key={tpl.id} className="p-4 rounded-md" style={card}>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold" style={{ color: '#0F172A' }}>{tpl.name}</h4>
                                            <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0"
                                                style={{ background: 'rgba(29,78,216,0.12)', color: '#1D4ED8' }}>{tpl.docType}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {(tpl.steps || []).map((step: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-xs font-mono" style={{ color: '#475569' }}>
                                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                        style={{ background: '#ECFEFF', color: '#0E7490' }}>{i + 1}</span>
                                                    {step.approverRole}
                                                    {step.threshold && <span style={{ color: '#64748B' }}>(≥{(step.threshold / 1e6).toFixed(0)}M)</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Audit Log Tab ────────────────────── */}
            {tab === 'audit' && (
                <div className="space-y-4">
                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-md overflow-x-auto border border-slate-200">
                        <table className="w-full text-left min-w-[750px]" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {[i18n.colTime, i18n.colUser, i18n.colAction, i18n.colEntity, i18n.colId, i18n.colDetails].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#64748B' }}>
                                        {auditLoaded ? i18n.noAuditLogs : i18n.loadingText}
                                    </td></tr>
                                ) : auditLogs.map((log: any) => (
                                    <React.Fragment key={log.id}>
                                        <tr style={{ borderBottom: '1px solid #E2E8F0', cursor: 'pointer' }}
                                            onClick={async () => {
                                                if (expandedLogId === log.id) { setExpandedLogId(null); return }
                                                setExpandedLogId(log.id)
                                                if (log.entityId && log.entityType) {
                                                    setLoadingChanges(true)
                                                    const res = await getFieldChanges(log.entityType, log.entityId)
                                                    setFieldChanges(res.changes)
                                                    setLoadingChanges(false)
                                                } else {
                                                    setFieldChanges([])
                                                }
                                            }}>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#64748B' }}>
                                                {new Date(log.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#0F172A' }}>
                                                {log.userName || log.userId || '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-bold font-mono whitespace-nowrap shrink-0" style={{
                                                    color: log.action === 'DELETE' ? '#B91C1C' : log.action === 'CREATE' ? '#15803D' : '#B45309',
                                                    background: log.action === 'DELETE' ? 'rgba(185,28,28,0.15)' : log.action === 'CREATE' ? 'rgba(21,128,61,0.15)' : 'rgba(180,83,9,0.15)',
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-semibold font-mono" style={{ color: '#0891B2' }}>
                                                {log.entityType}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-mono" style={{ color: '#64748B' }}>
                                                {log.entityId?.slice(-8) || '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs" style={{ color: expandedLogId === log.id ? '#0E7490' : '#64748B' }}>
                                                    {expandedLogId === log.id ? '▼' : '▶'}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedLogId === log.id && (
                                            <tr><td colSpan={6} style={{ background: '#F8FAFC', padding: '12px 16px' }}>
                                                {loadingChanges ? (
                                                    <div className="flex items-center gap-2 py-2">
                                                        <Loader2 size={14} className="animate-spin" style={{ color: '#0891B2' }} />
                                                        <span className="text-xs" style={{ color: '#64748B' }}>{i18n.loadingDetails}</span>
                                                    </div>
                                                ) : fieldChanges.length === 0 ? (
                                                    <p className="text-xs py-2" style={{ color: '#64748B' }}>{i18n.noFieldChanges}</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-semibold mb-2" style={{ color: '#B45309' }}>{i18n.fieldChangesTitle}</p>
                                                        {fieldChanges.slice(0, 20).map((fc: any, i: number) => (
                                                             <div key={i} className="flex items-start gap-3 py-1" style={{ borderBottom: '1px solid #E2E8F0' }}>
                                                                <span className="text-xs font-bold shrink-0" style={{ color: '#0891B2', minWidth: '100px' }}>{fc.field}</span>
                                                                <span className="text-xs" style={{ color: '#B91C1C' }}>{String(fc.oldValue ?? i18n.emptyVal).slice(0, 40)}</span>
                                                                <span className="text-xs" style={{ color: '#64748B' }}>→</span>
                                                                <span className="text-xs" style={{ color: '#15803D' }}>{String(fc.newValue ?? i18n.emptyVal).slice(0, 40)}</span>
                                                                <span className="text-xs ml-auto shrink-0" style={{ color: '#64748B' }}>
                                                                    {new Date(fc.changedAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </td></tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2.5">
                        {auditLogs.length === 0 ? (
                            <div className="text-center py-8 text-sm text-slate-500 border border-slate-200 rounded-lg bg-white">
                                {auditLoaded ? i18n.noAuditLogs : i18n.loadingText}
                            </div>
                        ) : auditLogs.map((log: any) => (
                            <div key={log.id} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-block text-[11px] px-2 py-0.5 rounded font-bold font-mono" style={{
                                        color: log.action === 'DELETE' ? '#B91C1C' : log.action === 'CREATE' ? '#15803D' : '#B45309',
                                        background: log.action === 'DELETE' ? 'rgba(185,28,28,0.15)' : log.action === 'CREATE' ? 'rgba(21,128,61,0.15)' : 'rgba(180,83,9,0.15)',
                                    }}>
                                        {log.action}
                                    </span>
                                    <span className="text-xs font-mono font-semibold text-cyan-700">{log.entityType}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span className="font-medium text-slate-900">{log.userName || log.userId || '—'}</span>
                                    <span className="font-mono text-slate-500">{log.entityId?.slice(-8) || '—'}</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                    {new Date(log.createdAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'entities' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Legal Entities Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>{i18n.entitiesListTitle}</h3>
                            <div className="space-y-4">
                                {entities.map(ent => (
                                    <div key={ent.id} className="p-5 rounded-lg flex flex-col justify-between" style={{ ...card, background: '#FFFFFF' }}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-base" style={{ color: '#0F172A' }}>{ent.name}</h4>
                                                <p className="text-xs font-mono mt-0.5" style={{ color: '#475569' }}>{i18n.codePrefix} {ent.code} · {i18n.taxIdPrefix} {ent.taxId || i18n.notEntered}</p>
                                            </div>
                                            <button onClick={() => setEditingEntity(ent)}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                                                style={{ border: '1px solid #E2E8F0', color: '#0891B2' }}>
                                                {i18n.btnEdit}
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 border-t border-slate-200 pt-3 text-xs" style={{ color: '#475569' }}>
                                            <div className="flex justify-between items-start gap-4">
                                                <span className="shrink-0">{i18n.labelAddressColon}</span>
                                                <span className="font-medium text-right" style={{ color: '#0F172A' }}>{ent.address || '—'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>{i18n.labelPhoneColon}</span>
                                                <span className="font-medium text-right font-mono" style={{ color: '#0F172A' }}>{ent.phone || '—'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>{i18n.labelEmailColon}</span>
                                                <span className="font-medium text-right" style={{ color: '#0F172A' }}>{ent.email || '—'}</span>
                                            </div>
                                            <div className="flex justify-between items-start gap-4">
                                                <span className="shrink-0">{i18n.labelBankColon}</span>
                                                <span className="font-medium text-right" style={{ color: '#0F172A' }}>{ent.bankName || '—'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>{i18n.labelAccountHolderColon}</span>
                                                <span className="font-medium text-right" style={{ color: '#0F172A' }}>{ent.bankAccountName || '—'}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span>{i18n.labelAccountNumberColon}</span>
                                                <span className="text-[#0891B2] font-mono font-bold">{ent.bankAccountNumber || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Warehouses Mapping & RBAC Configuration Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#B45309' }}>
                                <Shield size={16} /> {i18n.warehouseConfigTitle}
                            </h3>
                            <div className="p-5 rounded-lg space-y-4" style={card}>
                                <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                                    {i18n.warehouseConfigDesc}
                                </p>
                                <div className="space-y-4">
                                    {warehouses.map(w => (
                                        <div key={w.id} className="flex flex-col gap-3 p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                                                <div>
                                                    <p className="text-sm font-bold flex items-center gap-2 flex-wrap" style={{ color: '#0F172A' }}>
                                                        {w.name}
                                                        {w.isDefault && <span className="inline-block text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap shrink-0">{i18n.defaultWarehouseBadge}</span>}
                                                        {w.allowSales === false && <span className="inline-block text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded font-mono font-bold whitespace-nowrap shrink-0">{i18n.transferOnlyBadge}</span>}
                                                    </p>
                                                    <p className="text-[11px] font-mono mt-0.5" style={{ color: '#64748B' }}>{i18n.codePrefix} {w.code}{w.address ? ` · ${i18n.labelAddressColon} ${w.address}` : ''}</p>
                                                </div>
                                            </div>

                                            {/* Legal Entity Select */}
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <label className="text-xs font-semibold whitespace-nowrap" style={{ color: '#475569' }}>
                                                    {i18n.labelManagedEntity}
                                                </label>
                                                <select
                                                    value={w.legalEntityId || ''}
                                                    onChange={e => handleUpdateWarehouseConfigState(w.id, { legalEntityId: e.target.value || null })}
                                                    className="flex-1 px-3 py-1.5 text-xs outline-none rounded-md"
                                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
                                                >
                                                    <option value="">{i18n.unassignedEntity}</option>
                                                    {entities.map(ent => (
                                                        <option key={ent.id} value={ent.id}>{ent.name} ({ent.code})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Capability Checkboxes */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-slate-200/40">
                                                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded hover:bg-white transition-colors" style={{ color: '#0F172A' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={w.allowSales !== false}
                                                        onChange={e => handleUpdateWarehouseConfigState(w.id, { allowSales: e.target.checked })}
                                                        className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400"
                                                    />
                                                    <span><strong>{i18n.allowSalesLabel}</strong> (SO/DO)</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded hover:bg-white transition-colors" style={{ color: '#0F172A' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={w.allowTransfer !== false}
                                                        onChange={e => handleUpdateWarehouseConfigState(w.id, { allowTransfer: e.target.checked })}
                                                        className="w-4 h-4 rounded text-teal-500 focus:ring-teal-400"
                                                    />
                                                    <span><strong>{i18n.allowTransferLabel}</strong></span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded hover:bg-white transition-colors" style={{ color: '#0F172A' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={w.isDefault === true}
                                                        onChange={e => handleUpdateWarehouseConfigState(w.id, { isDefault: e.target.checked })}
                                                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                                                    />
                                                    <span><strong>{i18n.defaultWarehouseBadge}</strong></span>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Infrastructure & Cloudflare R2 Storage Tab ────────────────────────── */}
            {tab === 'storage' && (
                <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                {i18n.storageHeaderTitle}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {infraStatus?.checkedAt
                                    ? i18n.storageHeaderSub(infraStatus.r2.bucketName, new Date(infraStatus.checkedAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN'))
                                    : i18n.storageQueryingSub}
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={infraLoading}
                            onClick={loadInfrastructure}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50 cursor-pointer shrink-0"
                        >
                            {infraLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <RefreshCw size={14} />
                            )}
                            {i18n.btnRefreshStorage}
                        </button>
                    </div>

                    {infraLoading && !infraStatus ? (
                        <div className="bg-white rounded-lg border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                            <Loader2 size={24} className="animate-spin text-cyan-700" />
                            <p className="text-xs font-medium">
                                {i18n.scanningStorageMsg}
                            </p>
                        </div>
                    ) : infraStatus ? (
                        <>
                            {/* Top 2 Summary Cards: Cloudflare R2 Quota & PostgreSQL DB Quota */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Card 1: Cloudflare R2 Storage */}
                                <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                                                <HardDrive size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-slate-900">
                                                        {i18n.r2CardTitle}
                                                    </h4>
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            infraStatus.r2.connected
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        }`}
                                                    >
                                                        {infraStatus.r2.connected
                                                            ? `ONLINE · ${infraStatus.r2.latencyMs}ms`
                                                            : i18n.statusDisconnected}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    Bucket:{' '}
                                                    <span className="font-mono font-semibold text-slate-700">
                                                        {infraStatus.r2.bucketName}
                                                    </span>{' '}
                                                    · Account: {infraStatus.r2.accountIdMasked}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-900 font-mono">
                                                {formatBytes(infraStatus.r2.totalBytes)}
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                / {formatBytes(infraStatus.r2.freeTierLimitBytes)} {i18n.freeTierSuffix}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Quota Progress Bar */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-600 font-medium">
                                                {i18n.usedLabel}{' '}
                                                <strong className="text-slate-900">
                                                    {infraStatus.r2.usagePercent}%
                                                </strong>{' '}
                                                ({formatNumber(infraStatus.r2.totalFiles)} {i18n.filesUnit})
                                            </span>
                                            <span className="text-emerald-700 font-semibold">
                                                {i18n.freeRemainingLabel}{' '}
                                                {formatBytes(infraStatus.r2.remainingFreeBytes)}
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                            <div
                                                className="h-full bg-cyan-600 transition-all"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        Math.max(1.5, infraStatus.r2.usagePercent)
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            {i18n.r2FreeTierNote}
                                        </p>
                                    </div>
                                </div>

                                {/* Card 2: PostgreSQL Database */}
                                <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                                                <Database size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm font-bold text-slate-900">
                                                        {i18n.dbCardTitle}
                                                    </h4>
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            infraStatus.database.connected
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        }`}
                                                    >
                                                        {infraStatus.database.connected
                                                            ? `ONLINE · ${infraStatus.database.latencyMs}ms`
                                                            : i18n.statusConnError}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {i18n.dbCardDesc}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-slate-900 font-mono">
                                                {formatBytes(infraStatus.database.sizeBytes)}
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                / {formatBytes(infraStatus.database.freeTierLimitBytes)} (500 MB)
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-600 font-medium">
                                                {i18n.usedLabel}{' '}
                                                <strong className="text-slate-900">
                                                    {infraStatus.database.usagePercent}%
                                                </strong>
                                            </span>
                                            <span className="text-emerald-700 font-semibold">
                                                {i18n.remainingLabel}{' '}
                                                {formatBytes(
                                                    Math.max(
                                                        0,
                                                        infraStatus.database.freeTierLimitBytes -
                                                            infraStatus.database.sizeBytes
                                                    )
                                                )}
                                            </span>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                                            <div
                                                className="h-full bg-indigo-600 transition-all"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        Math.max(1.5, infraStatus.database.usagePercent)
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Record Counts */}
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                                        {[
                                            {
                                                label: i18n.cntProducts,
                                                val: infraStatus.database.counts.products,
                                            },
                                            {
                                                label: i18n.cntRegDocs,
                                                val: infraStatus.database.counts.regulatedDocs,
                                            },
                                            {
                                                label: i18n.cntCustomers,
                                                val: infraStatus.database.counts.customers,
                                            },
                                            {
                                                label: i18n.cntSalesOrders,
                                                val: infraStatus.database.counts.salesOrders,
                                            },
                                            {
                                                label: i18n.cntStockLots,
                                                val: infraStatus.database.counts.stockLots,
                                            },
                                            {
                                                label: i18n.cntAuditLogs,
                                                val: infraStatus.database.counts.auditLogs,
                                            },
                                        ].map(item => (
                                            <div
                                                key={item.label}
                                                className="p-2 rounded bg-slate-50 border border-slate-200/80 text-center"
                                            >
                                                <p className="text-xs font-bold font-mono text-slate-900">
                                                    {formatNumber(item.val)}
                                                </p>
                                                <p className="text-[10px] text-slate-500 truncate">
                                                    {item.label}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Breakdown by R2 Folder & Recent Uploaded Files */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* Folder Breakdown Table */}
                                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen size={15} className="text-cyan-700" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                {i18n.r2FolderBreakdownTitle}
                                            </h4>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {i18n.r2TotalSummary(infraStatus.r2.totalFiles, formatBytes(infraStatus.r2.totalBytes))}
                                        </span>
                                    </div>
                                    {/* Desktop Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-white text-[11px] uppercase text-slate-500">
                                                    <th className="px-4 py-2.5 font-semibold">
                                                        {i18n.colStorageCategory}
                                                    </th>
                                                    <th className="px-3 py-2.5 font-semibold">
                                                        {i18n.colR2Prefix}
                                                    </th>
                                                    <th className="px-3 py-2.5 font-semibold text-right">
                                                        {i18n.colFileCount}
                                                    </th>
                                                    <th className="px-3 py-2.5 font-semibold text-right">
                                                        {i18n.colSize}
                                                    </th>
                                                    <th className="px-4 py-2.5 font-semibold text-right">
                                                        {i18n.colLastModified}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs">
                                                {infraStatus.r2.folders.map(f => {
                                                    const sharePct =
                                                        infraStatus.r2.totalBytes > 0
                                                            ? Math.round(
                                                                  (f.totalBytes /
                                                                      infraStatus.r2.totalBytes) *
                                                                      100
                                                              )
                                                            : 0
                                                    return (
                                                        <tr
                                                            key={f.prefix}
                                                            className="hover:bg-slate-50/80"
                                                        >
                                                            <td className="px-4 py-2.5 font-semibold text-slate-800">
                                                                {f.label}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                                                                {f.prefix}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-700">
                                                                {formatNumber(f.fileCount)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono text-slate-900">
                                                                {formatBytes(f.totalBytes)}{' '}
                                                                <span className="text-[10px] text-slate-400">
                                                                    ({sharePct}%)
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right text-slate-500">
                                                                {f.latestModified
                                                                    ? formatDate(f.latestModified)
                                                                    : '—'}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Mobile Cards */}
                                    <div className="md:hidden divide-y divide-slate-100">
                                        {infraStatus.r2.folders.map(f => {
                                            const sharePct =
                                                infraStatus.r2.totalBytes > 0
                                                    ? Math.round((f.totalBytes / infraStatus.r2.totalBytes) * 100)
                                                    : 0
                                            return (
                                                <div key={f.prefix} className="p-3.5 space-y-1.5 text-xs">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-semibold text-slate-800">{f.label}</span>
                                                        <span className="font-mono text-slate-900 font-semibold">
                                                            {formatBytes(f.totalBytes)} ({sharePct}%)
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                        <span className="font-mono">{f.prefix}</span>
                                                        <span>{formatNumber(f.fileCount)} {i18n.filesUnit}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Recent Uploaded Files on R2 */}
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
                                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                            {i18n.r2RecentFilesTitle}
                                        </h4>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                                        {infraStatus.r2.recentFiles.length === 0 ? (
                                            <div className="p-6 text-center text-xs text-slate-400">
                                                {i18n.noR2Files}
                                            </div>
                                        ) : (
                                            infraStatus.r2.recentFiles.map(file => (
                                                <div
                                                    key={file.key}
                                                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                                                >
                                                    <div className="min-w-0">
                                                        <p
                                                            className="text-xs font-medium text-slate-800 truncate"
                                                            title={file.key}
                                                        >
                                                            {file.key.split('/').pop()}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 font-mono truncate">
                                                            {formatBytes(file.size)} ·{' '}
                                                            {new Date(
                                                                file.lastModified
                                                            ).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                                                        </p>
                                                    </div>
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
                                                        title={i18n.openFileTitle}
                                                    >
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            )}

            {/* Drawers */}
            <EditEntityDrawer
                open={!!editingEntity}
                onClose={() => setEditingEntity(null)}
                onSave={handleSaveEntity}
                entity={editingEntity}
                saving={savingEntity}
            />
            <CreateUserDrawer open={showCreateUser} onClose={() => setShowCreateUser(false)} onCreated={reload} roles={roles} />
            <CreateRoleDrawer open={showCreateRole} onClose={() => setShowCreateRole(false)} onCreated={reload} permissions={permissions} />
            <EditRolePermissionsDrawer
                open={showEditRole}
                onClose={() => {
                    setShowEditRole(false)
                    setSelectedRole(null)
                }}
                onUpdated={reload}
                role={selectedRole}
                permissions={permissions}
            />
            <UserDetailDrawer
                open={!!selectedUser}
                onClose={() => setSelectedUser(null)}
                user={selectedUser}
                roles={roles}
                currentUser={currentUser}
                onUpdated={reload}
            />
        </div>
    )
}

// ── Edit Legal Entity Drawer ──────────────────────
function EditEntityDrawer({ open, onClose, onSave, entity, saving }: {
    open: boolean; onClose: () => void; onSave: (id: string, data: any) => void; entity: any; saving: boolean
}) {
    const { locale } = useAppLocale()
    const i18n = SETTINGS_I18N[locale]

    const [form, setForm] = useState({
        name: '', taxId: '', address: '', phone: '', email: '', bankName: '', bankAccountName: '', bankAccountNumber: ''
    })

    React.useEffect(() => {
        if (entity) {
            setForm({
                name: entity.name || '',
                taxId: entity.taxId || '',
                address: entity.address || '',
                phone: entity.phone || '',
                email: entity.email || '',
                bankName: entity.bankName || '',
                bankAccountName: entity.bankAccountName || '',
                bankAccountNumber: entity.bankAccountNumber || ''
            })
        }
    }, [entity])

    if (!open || !entity) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between bg-white border-l border-slate-200 shadow-2xl">
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>{i18n.editEntityDrawerTitle}</h3>
                        <button onClick={onClose}><X size={18} style={{ color: '#64748B' }} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelEntityNameReq}</label>
                            <input style={inputStyle} {...focusHandler} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelTaxId}</label>
                            <input style={inputStyle} {...focusHandler} value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelAddress}</label>
                            <input style={inputStyle} {...focusHandler} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelPhone}</label>
                                <input style={inputStyle} {...focusHandler} placeholder="e.g. 024.3933.8888" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelEmail}</label>
                                <input style={inputStyle} {...focusHandler} placeholder="e.g. orders@lyscellars.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="pt-4 border-t border-slate-200">
                            <p className="text-xs font-bold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#B45309' }}>
                                <CreditCard size={12} /> {i18n.secPaymentAccount}
                            </p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelBankNameBranch}</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. Vietcombank - Chi nhánh HCM" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelAccountHolder}</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. CONG TY TNHH LY'S CELLARS" value={form.bankAccountName} onChange={e => setForm(f => ({ ...f, bankAccountName: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#475569' }}>{i18n.labelAccountNumber}</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. 1023456789" value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => onSave(entity.id, form)} disabled={saving}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                    style={{ background: '#0E7490', color: '#FFFFFF' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? i18n.btnSaving : i18n.btnSaveChanges}
                </button>
            </div>
        </div>
    )
}
