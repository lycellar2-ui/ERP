'use client'

import React, { useState, useCallback } from 'react'
import {
    Shield, Users, Settings, Bell, Plus, X, Save, Loader2,
    User, ChevronDown, CheckCircle2, AlertCircle, Search, Eye,
    ClipboardCheck, Check, XCircle
} from 'lucide-react'
import {
    UserRow, RoleRow, createUser, updateUser, updateUserRoles,
    createRole, updateRolePermissions, getUsers, getRoles,
    getApprovalTemplates, getPendingApprovals, processApproval, createApprovalTemplate
} from './actions'
import { getAuditLogs, getFieldChanges } from '@/lib/audit'

// ── Shared Style Tokens ──────────────────────────
const card = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2',
    fontSize: '14px', outline: 'none',
}
const focusHandler = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = '#87CBB9',
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.style.borderColor = '#2A4355',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Hoạt Động', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    INACTIVE: { label: 'Ngưng', color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    SUSPENDED: { label: 'Khoá', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

type Tab = 'users' | 'roles' | 'approvals' | 'audit'

type PermissionRow = { id: string; code: string; module: string; action: string }

interface Props {
    initialUsers: UserRow[]
    initialRoles: RoleRow[]
    permissions: PermissionRow[]
    stats: { users: number; roles: number; activeUsers: number; pendingApprovals: number }
}

// ── Create User Drawer ───────────────────────────
function CreateUserDrawer({ open, onClose, onCreated, roles }: {
    open: boolean; onClose: () => void; onCreated: () => void; roles: RoleRow[]
}) {
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
            setError(res.error || 'Lỗi tạo user')
        }
        setSaving(false)
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ background: '#0D1B25' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>Tạo Người Dùng</h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded text-sm flex items-center gap-2"
                        style={{ background: 'rgba(139,26,46,0.15)', border: '1px solid rgba(139,26,46,0.3)', color: '#f87171' }}>
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Email</label>
                        <input style={inputStyle} {...focusHandler} type="email" placeholder="ten@lyscellars.com"
                            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Họ Tên</label>
                        <input style={inputStyle} {...focusHandler} placeholder="Nguyễn Văn A"
                            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Mật Khẩu</label>
                        <input style={inputStyle} {...focusHandler} type="password" placeholder="Tối thiểu 6 ký tự"
                            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Vai Trò</label>
                        <div className="grid grid-cols-2 gap-2">
                            {roles.map(r => (
                                <button key={r.id} onClick={() => toggleRole(r.id)}
                                    className="text-left px-3 py-2 rounded text-xs font-semibold transition-all"
                                    style={{
                                        background: form.roleIds.includes(r.id) ? 'rgba(135,203,185,0.15)' : '#142433',
                                        border: form.roleIds.includes(r.id) ? '1px solid #87CBB9' : '1px solid #2A4355',
                                        color: form.roleIds.includes(r.id) ? '#87CBB9' : '#8AAEBB',
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
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu...' : 'Tạo Người Dùng'}
                </button>
            </div>
        </div>
    )
}

// ── Create Role Drawer ───────────────────────────
function CreateRoleDrawer({ open, onClose, onCreated, permissions }: {
    open: boolean; onClose: () => void; onCreated: () => void; permissions: PermissionRow[]
}) {
    const [saving, setSaving] = useState(false)
    const [name, setName] = useState('')
    const [selectedPerms, setSelectedPerms] = useState<string[]>([])

    const modules = Array.from(new Set(permissions.map(p => p.module))).sort()

    const toggleModule = (mod: string) => {
        const modPerms = permissions.filter(p => p.module === mod).map(p => p.id)
        const allSelected = modPerms.every(id => selectedPerms.includes(id))
        if (allSelected) {
            setSelectedPerms(s => s.filter(id => !modPerms.includes(id)))
        } else {
            setSelectedPerms(s => [...new Set([...s, ...modPerms])])
        }
    }

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
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: '#0D1B25' }}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>Tạo Vai Trò</h3>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Tên Vai Trò</label>
                        <input style={inputStyle} {...focusHandler} placeholder="VD: IT Admin"
                            value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-xs font-semibold mb-2 block" style={{ color: '#8AAEBB' }}>Quyền Hạn</label>
                        <div className="space-y-2">
                            {modules.map(mod => {
                                const modPerms = permissions.filter(p => p.module === mod)
                                const count = modPerms.filter(p => selectedPerms.includes(p.id)).length
                                return (
                                    <div key={mod} className="rounded-md p-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                        <button onClick={() => toggleModule(mod)}
                                            className="flex items-center justify-between w-full text-left">
                                            <span className="text-xs font-bold" style={{ color: count === modPerms.length ? '#87CBB9' : '#E8F1F2' }}>
                                                {mod}
                                            </span>
                                            <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                                {count}/{modPerms.length}
                                            </span>
                                        </button>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {modPerms.map(p => (
                                                <button key={p.id}
                                                    onClick={() => setSelectedPerms(s =>
                                                        s.includes(p.id) ? s.filter(x => x !== p.id) : [...s, p.id]
                                                    )}
                                                    className="text-xs px-2 py-0.5 rounded transition-all"
                                                    style={{
                                                        background: selectedPerms.includes(p.id) ? 'rgba(135,203,185,0.2)' : 'rgba(42,67,85,0.5)',
                                                        color: selectedPerms.includes(p.id) ? '#87CBB9' : '#4A6A7A',
                                                        border: selectedPerms.includes(p.id) ? '1px solid rgba(135,203,185,0.4)' : '1px solid transparent',
                                                    }}>
                                                    {p.action}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving || !name}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md"
                    style={{ background: name ? '#87CBB9' : '#2A4355', color: name ? '#0A1926' : '#4A6A7A' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu...' : `Tạo Vai Trò (${selectedPerms.length} quyền)`}
                </button>
            </div>
        </div>
    )
}

// ── Main Settings Client ─────────────────────────
export function SettingsClient({ initialUsers, initialRoles, permissions, stats }: Props) {
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

    const handleApproval = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
        setProcessingId(requestId)
        await processApproval({ requestId, action, approverId: 'system' })
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

    const statCards = [
        { label: 'Người Dùng', value: stats.users, icon: Users, accent: '#87CBB9' },
        { label: 'Đang Hoạt Động', value: stats.activeUsers, icon: CheckCircle2, accent: '#5BA88A' },
        { label: 'Vai Trò', value: stats.roles, icon: Shield, accent: '#D4A853' },
        { label: 'Chờ Duyệt', value: stats.pendingApprovals, icon: Bell, accent: '#4A8FAB' },
    ]

    const tabs: { key: Tab; label: string; icon: React.FC<any> }[] = [
        { key: 'users', label: 'Người Dùng', icon: Users },
        { key: 'roles', label: 'Vai Trò & Phân Quyền', icon: Shield },
        { key: 'approvals', label: 'Quy Trình Duyệt', icon: ClipboardCheck },
        { key: 'audit', label: 'Nhật Ký Hệ Thống', icon: Eye },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold"
                        style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Cài Đặt & Phân Quyền (SYS/RBAC)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Quản lý tài khoản, vai trò, quyền hạn — Dữ liệu thực từ DB
                    </p>
                </div>
                <a href="/dashboard/settings/telegram"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all"
                    style={{
                        background: 'rgba(74,143,171,0.15)',
                        color: '#4A8FAB',
                        border: '1px solid rgba(74,143,171,0.3)',
                        textDecoration: 'none',
                    }}>
                    🤖 Telegram Bot
                </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                {statCards.map(c => {
                    const Icon = c.icon
                    return (
                        <div key={c.label} className="p-4 rounded-md" style={card}>
                            <div className="flex items-center gap-2 mb-2">
                                <Icon size={16} style={{ color: c.accent }} />
                                <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{c.label}</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ fontFamily: '"DM Mono"', color: c.accent }}>{c.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-md" style={{ background: '#142433' }}>
                {tabs.map(t => {
                    const Icon = t.icon
                    const active = tab === t.key
                    return (
                        <button key={t.key}
                            onClick={() => { setTab(t.key); if (t.key === 'audit' && !auditLoaded) loadAudit(); if (t.key === 'approvals' && !approvalsLoaded) loadApprovals() }}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded transition-all"
                            style={{
                                background: active ? '#1B2E3D' : 'transparent',
                                color: active ? '#87CBB9' : '#4A6A7A',
                                border: active ? '1px solid #2A4355' : '1px solid transparent',
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
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                            <input className="w-full pl-9 pr-3 py-2 text-sm rounded-md"
                                style={{ ...inputStyle, width: '100%' }}
                                placeholder="Tìm theo tên hoặc email..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button onClick={() => setShowCreateUser(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={16} /> Thêm Người Dùng
                        </button>
                    </div>

                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Họ Tên', 'Email', 'Vai Trò', 'Trạng Thái', 'Ngày Tạo', ''].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                        Chưa có người dùng. Chạy seed-rbac.ts trước.
                                    </td></tr>
                                ) : filteredUsers.map(u => {
                                    const st = STATUS_CFG[u.status] ?? STATUS_CFG.ACTIVE
                                    return (
                                        <tr key={u.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(135,203,185,0.04)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: '#E8F1F2' }}>
                                                {u.name || '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono"' }}>
                                                {u.email}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.roles.map(r => (
                                                        <span key={r} className="text-xs px-2 py-0.5 rounded font-semibold"
                                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                    style={{ background: st.bg, color: st.color }}>
                                                    {st.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
                                                {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <select
                                                    value={u.status}
                                                    onChange={e => handleStatusChange(u.id, e.target.value as any)}
                                                    className="text-xs px-2 py-1 rounded cursor-pointer"
                                                    style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB', outline: 'none' }}>
                                                    <option value="ACTIVE">Hoạt Động</option>
                                                    <option value="INACTIVE">Ngưng</option>
                                                    <option value="SUSPENDED">Khoá</option>
                                                </select>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Roles Tab ────────────────────────── */}
            {tab === 'roles' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: '#8AAEBB' }}>
                            {permissions.length} quyền hạn trên {Array.from(new Set(permissions.map(p => p.module))).length} module
                        </p>
                        <button onClick={() => setShowCreateRole(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            <Plus size={16} /> Tạo Vai Trò
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {roles.map(r => (
                            <div key={r.id} className="p-5 rounded-md" style={card}>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-bold" style={{ color: '#E8F1F2' }}>{r.name}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                            {r.permissionCount} quyền
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded"
                                            style={{ background: 'rgba(212,168,83,0.1)', color: '#D4A853' }}>
                                            {r.userCount} user
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Users size={12} style={{ color: '#4A6A7A' }} />
                                    <span className="text-xs" style={{ color: '#4A6A7A' }}>
                                        {r.userCount === 0 ? 'Chưa có người dùng' : `${r.userCount} người dùng`}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#142433' }}>
                                    <div className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.min((r.permissionCount / permissions.length) * 100, 100)}%`,
                                            background: r.permissionCount === permissions.length ? '#87CBB9' : '#D4A853',
                                        }} />
                                </div>
                                <p className="text-xs mt-1.5" style={{ color: '#4A6A7A' }}>
                                    {r.permissionCount}/{permissions.length} quyền ({Math.round((r.permissionCount / permissions.length) * 100)}%)
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
                        <h3 className="text-sm font-bold mb-3" style={{ color: '#E8F1F2' }}>Yêu Cầu Đang Chờ Duyệt</h3>
                        {!approvalsLoaded ? (
                            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin" style={{ color: '#87CBB9' }} /></div>
                        ) : pendingApprovals.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 rounded-md" style={{ border: '1px dashed #2A4355' }}>
                                <CheckCircle2 size={24} style={{ color: '#5BA88A' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>Không có yêu cầu nào chờ duyệt</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingApprovals.map((req: any) => (
                                    <div key={req.id} className="flex items-center justify-between p-4 rounded-md" style={card}>
                                        <div className="flex items-center gap-3">
                                            <ClipboardCheck size={16} style={{ color: '#D4A853' }} />
                                            <div>
                                                <p className="text-sm font-semibold" style={{ color: '#E8F1F2' }}>{req.templateName || req.docType}</p>
                                                <p className="text-xs mt-0.5" style={{ color: '#4A6A7A' }}>Bước {req.currentStep} • Bởi {req.requestedByName || req.requestedBy}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(212,168,83,0.12)', color: '#D4A853' }}>{req.docType}</span>
                                            <button onClick={() => handleApproval(req.id, 'APPROVE')} disabled={processingId === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                {processingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Duyệt
                                            </button>
                                            <button onClick={() => handleApproval(req.id, 'REJECT')} disabled={processingId === req.id}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded transition-all"
                                                style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)' }}>
                                                <XCircle size={12} /> Từ Chối
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Approval Templates */}
                    <div>
                        <h3 className="text-sm font-bold mb-3" style={{ color: '#E8F1F2' }}>Mẫu Quy Trình Duyệt</h3>
                        {approvalTemplates.length === 0 ? (
                            <div className="flex flex-col items-center py-8 gap-2 rounded-md" style={{ border: '1px dashed #2A4355' }}>
                                <ClipboardCheck size={24} style={{ color: '#2A4355' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có mẫu quy trình. Chạy seed để tạo templates.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {approvalTemplates.map((tpl: any) => (
                                    <div key={tpl.id} className="p-4 rounded-md" style={card}>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>{tpl.name}</h4>
                                            <span className="text-xs px-2 py-0.5 rounded font-bold"
                                                style={{ background: 'rgba(74,143,171,0.12)', color: '#4A8FAB' }}>{tpl.docType}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {(tpl.steps || []).map((step: any, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-xs" style={{ color: '#8AAEBB' }}>
                                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                                        style={{ background: '#142433', color: '#87CBB9' }}>{i + 1}</span>
                                                    {step.approverRole}
                                                    {step.threshold && <span style={{ color: '#4A6A7A' }}>(≥{(step.threshold / 1e6).toFixed(0)}M)</span>}
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
                    <div className="rounded-md overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                    {['Thời Gian', 'Người Dùng', 'Hành Động', 'Đối Tượng', 'ID', 'Chi Tiết'].map(h => (
                                        <th key={h} className="px-3 py-3 text-xs uppercase tracking-wider font-semibold"
                                            style={{ color: '#4A6A7A' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#4A6A7A' }}>
                                        {auditLoaded ? 'Chưa có nhật ký nào' : 'Đang tải...'}
                                    </td></tr>
                                ) : auditLogs.map((log: any) => (
                                    <React.Fragment key={log.id}>
                                        <tr style={{ borderBottom: '1px solid rgba(42,67,85,0.5)', cursor: 'pointer' }}
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
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                                {new Date(log.createdAt).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#E8F1F2' }}>
                                                {log.userName || log.userId || '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                                    color: log.action === 'DELETE' ? '#8B1A2E' : log.action === 'CREATE' ? '#5BA88A' : '#D4A853',
                                                    background: log.action === 'DELETE' ? 'rgba(139,26,46,0.15)' : log.action === 'CREATE' ? 'rgba(91,168,138,0.15)' : 'rgba(212,168,83,0.15)',
                                                }}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: '#87CBB9' }}>
                                                {log.entityType}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A', fontFamily: '"DM Mono"' }}>
                                                {log.entityId?.slice(-8) || '—'}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className="text-xs" style={{ color: expandedLogId === log.id ? '#87CBB9' : '#4A6A7A' }}>
                                                    {expandedLogId === log.id ? '▼' : '▶'}
                                                </span>
                                            </td>
                                        </tr>
                                        {expandedLogId === log.id && (
                                            <tr><td colSpan={6} style={{ background: '#142433', padding: '12px 16px' }}>
                                                {loadingChanges ? (
                                                    <div className="flex items-center gap-2 py-2">
                                                        <Loader2 size={14} className="animate-spin" style={{ color: '#87CBB9' }} />
                                                        <span className="text-xs" style={{ color: '#4A6A7A' }}>Đang tải chi tiết...</span>
                                                    </div>
                                                ) : fieldChanges.length === 0 ? (
                                                    <p className="text-xs py-2" style={{ color: '#4A6A7A' }}>Không có chi tiết thay đổi theo trường cho bản ghi này.</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-semibold mb-2" style={{ color: '#D4A853' }}>📋 Lịch Sử Thay Đổi Theo Trường</p>
                                                        {fieldChanges.slice(0, 20).map((fc: any, i: number) => (
                                                            <div key={i} className="flex items-start gap-3 py-1" style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }}>
                                                                <span className="text-xs font-bold shrink-0" style={{ color: '#87CBB9', minWidth: '100px' }}>{fc.field}</span>
                                                                <span className="text-xs" style={{ color: '#E85D5D' }}>{String(fc.oldValue ?? '(trống)').slice(0, 40)}</span>
                                                                <span className="text-xs" style={{ color: '#4A6A7A' }}>→</span>
                                                                <span className="text-xs" style={{ color: '#5BA88A' }}>{String(fc.newValue ?? '(trống)').slice(0, 40)}</span>
                                                                <span className="text-xs ml-auto shrink-0" style={{ color: '#4A6A7A' }}>
                                                                    {new Date(fc.changedAt).toLocaleString('vi-VN')}
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
                </div>
            )}

            {/* Drawers */}
            <CreateUserDrawer open={showCreateUser} onClose={() => setShowCreateUser(false)} onCreated={reload} roles={roles} />
            <CreateRoleDrawer open={showCreateRole} onClose={() => setShowCreateRole(false)} onCreated={reload} permissions={permissions} />
        </div>
    )
}
