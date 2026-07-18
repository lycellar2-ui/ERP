'use client'

import React, { useState, useCallback } from 'react'
import {
    Shield, Users, Settings, Bell, Plus, X, Save, Loader2,
    User, ChevronDown, CheckCircle2, AlertCircle, Search, Eye,
    ClipboardCheck, Check, XCircle, Building2, CreditCard
} from 'lucide-react'
import { toast } from 'sonner'
import {
    UserRow, RoleRow, createUser, updateUser, updateUserRoles,
    createRole, updateRolePermissions, getRolePermissions, getUsers, getRoles,
    getApprovalTemplates, getPendingApprovals, processApproval, createApprovalTemplate,
    getLegalEntitiesList, updateLegalEntity, getSystemWarehouses, updateWarehouseLegalEntity,
    adminResetPassword
} from './actions'
import { getAuditLogs, getFieldChanges } from '@/lib/audit'
import { type SessionUser } from '@/lib/session'

// ── Shared Style Tokens ──────────────────────────
const card = { background: '#1B2E3D', border: '1px solid #2A4355', borderRadius: '8px' }
const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid #2A4355', background: '#142433', color: '#E8F1F2',
    fontSize: '14px', outline: 'none',
}

const MODULE_NAMES: Record<string, string> = {
    DSH: 'Bảng điều khiển (Dashboard)',
    MDM: 'Danh mục / Dữ liệu gốc (Master Data)',
    SLS: 'Quản lý bán hàng (Sales)',
    PRC: 'Quản lý mua hàng (Purchase)',
    WMS: 'Quản lý kho hàng (Warehouse)',
    FIN: 'Tài chính & Thanh toán (Finance)',
    TAX: 'Hóa đơn & Thuế (Tax)',
    CRM: 'Khách hàng & Liên hệ (CRM)',
    CST: 'Chi phí & Giá thành (Cost)',
    CNT: 'Hợp đồng (Contract)',
    TRS: 'Vận chuyển & Giao nhận (Delivery)',
    CSG: 'Hàng ký gửi (Consignment)',
    AGN: 'Quản lý Đại lý (Agency)',
    RPT: 'Báo cáo thống kê (Reports)',
    KPI: 'Chỉ tiêu doanh số (KPI)',
    STM: 'Điều chuyển kho (Stock Transfer)',
    SYS: 'Quản trị hệ thống (System)',
}

const ACTION_LABELS: Record<string, string> = {
    READ: 'Xem (Read)',
    CREATE: 'Thêm mới (Create)',
    UPDATE: 'Sửa (Update)',
    DELETE: 'Xóa (Delete)',
    APPROVE: 'Duyệt (Approve)',
    EXPORT: 'Xuất Excel (Export)',
    WRITE: 'Ghi / Giao hàng (Write)',
    ADMIN: 'Toàn quyền (Admin)',
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

type Tab = 'users' | 'roles' | 'approvals' | 'audit' | 'entities'

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
                                                {MODULE_NAMES[mod] ?? mod}
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
                                                    {ACTION_LABELS[p.action] ?? p.action}
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

// ── Edit Role Permissions Drawer ──────────────────
function EditRolePermissionsDrawer({ open, onClose, onUpdated, role, permissions }: {
    open: boolean
    onClose: () => void
    onUpdated: () => void
    role: RoleRow | null
    permissions: PermissionRow[]
}) {
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
                    toast.error('Lỗi khi tải danh sách quyền: ' + err.message)
                    setLoading(false)
                })
        }
    }, [open, role])

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
        if (!role) return
        setSaving(true)
        const res = await updateRolePermissions(role.id, selectedPerms)
        if (res.success) {
            toast.success('Cập nhật quyền thành công!')
            onUpdated()
            onClose()
        } else {
            toast.error(res.error || 'Lỗi cập nhật quyền')
        }
        setSaving(false)
    }

    if (!open || !role) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-lg h-full overflow-y-auto p-6" style={{ background: '#0D1B25' }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                            Phân Quyền Vai Trò
                        </h3>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>
                            Cấu hình quyền hạn cho: <strong style={{ color: '#87CBB9' }}>{role.name}</strong>
                        </p>
                    </div>
                    <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-2 block" style={{ color: '#8AAEBB' }}>Quyền Hạn Hệ Thống</label>
                            <div className="space-y-2">
                                {modules.map(mod => {
                                    const modPerms = permissions.filter(p => p.module === mod)
                                    const count = modPerms.filter(p => selectedPerms.includes(p.id)).length
                                    return (
                                        <div key={mod} className="rounded-md p-3" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <button onClick={() => toggleModule(mod)}
                                                className="flex items-center justify-between w-full text-left">
                                                <span className="text-xs font-bold" style={{ color: count === modPerms.length ? '#87CBB9' : '#E8F1F2' }}>
                                                    {MODULE_NAMES[mod] ?? mod}
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
                                                        {ACTION_LABELS[p.action] ?? p.action}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <button onClick={handleSave} disabled={saving}
                            className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                            style={{ background: '#87CBB9', color: '#0A1926' }}>
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Đang lưu...' : `Lưu Quyền Hạn (${selectedPerms.length} quyền)`}
                        </button>
                    </div>
                )}
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
    const statusCfg = STATUS_CFG[user.status] ?? STATUS_CFG.ACTIVE

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
                setError('Mật khẩu mới phải tối thiểu 6 ký tự')
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
                            setError(resPass.error || 'Lỗi đặt lại mật khẩu')
                            setSaving(false)
                            return
                        }
                    }
                    onUpdated()
                    onClose()
                } else {
                    setError(resRoles.error || 'Lỗi cập nhật vai trò')
                }
            } else {
                setError(resUser.error || 'Lỗi cập nhật thông tin')
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi hệ thống')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl transition-all duration-300" style={{ background: '#0D1B25', borderLeft: '1px solid #2A4355' }}>
                <div>
                    <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid #142433' }}>
                        <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>
                            {isAdmin ? 'Chỉnh Sửa Người Dùng' : 'Thông Tin Chi Tiết'}
                        </h3>
                        <button onClick={onClose} className="hover:opacity-80 transition-opacity"><X size={18} style={{ color: '#4A6A7A' }} /></button>
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
                            <div className="text-sm font-semibold p-3 rounded-md font-mono" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                {user.email}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Họ Tên</label>
                            {isAdmin ? (
                                <input style={inputStyle} {...focusHandler} placeholder="Họ và tên"
                                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            ) : (
                                <div className="text-sm font-semibold p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355', color: '#E8F1F2' }}>
                                    {user.name || '—'}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Trạng Thái</label>
                            {isAdmin ? (
                                <select style={inputStyle} {...focusHandler}
                                    value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                                    <option value="ACTIVE">Hoạt Động</option>
                                    <option value="INACTIVE">Ngưng Hoạt Động</option>
                                    <option value="SUSPENDED">Khoá</option>
                                </select>
                            ) : (
                                <div className="p-3 rounded-md flex items-center" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    <span className="text-xs px-2 py-0.5 rounded font-bold"
                                        style={{ background: statusCfg.bg, color: statusCfg.color }}>
                                        {statusCfg.label}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-semibold mb-2 block" style={{ color: '#8AAEBB' }}>Vai Trò</label>
                            {isAdmin ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {roles.map(r => {
                                        const selected = form.roleIds.includes(r.id)
                                        return (
                                            <button key={r.id} onClick={() => toggleRole(r.id)}
                                                className="text-left px-3 py-2 rounded text-xs font-semibold transition-all"
                                                style={{
                                                    background: selected ? 'rgba(135,203,185,0.15)' : '#142433',
                                                    border: selected ? '1px solid #87CBB9' : '1px solid #2A4355',
                                                    color: selected ? '#87CBB9' : '#8AAEBB',
                                                }}>
                                                {selected && <CheckCircle2 size={12} className="inline mr-1" />}
                                                {r.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-1.5 p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    {user.roles.map(r => (
                                        <span key={r} className="text-xs px-2 py-0.5 rounded font-semibold"
                                            style={{ background: 'rgba(135,203,185,0.1)', color: '#87CBB9' }}>
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {isAdmin && (
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Đặt Lại Mật Khẩu</label>
                                <input style={inputStyle} {...focusHandler} type="password" placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                    value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Ngày Tạo</label>
                            <div className="text-sm p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB' }}>
                                {new Date(user.createdAt).toLocaleString('vi-VN')}
                            </div>
                        </div>
                    </div>
                </div>

                {isAdmin && (
                    <button onClick={handleSave} disabled={saving}
                        className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all hover:opacity-90"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                    </button>
                )}
            </div>
        </div>
    )
}

// ── Main Settings Client ─────────────────────────
export function SettingsClient({ initialUsers, initialRoles, permissions, stats, currentUser }: Props) {
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
            toast.error('Lỗi khi tải thông tin Pháp nhân và Kho: ' + err.message)
        }
    }, [])

    const handleSaveEntity = async (id: string, data: any) => {
        setSavingEntity(true)
        const res = await updateLegalEntity(id, data)
        if (res.success) {
            toast.success('Đã cập nhật pháp nhân thành công!')
            setEditingEntity(null)
            await loadEntities()
        } else {
            toast.error(res.error || 'Lỗi cập nhật pháp nhân')
        }
        setSavingEntity(false)
    }

    const handleUpdateWarehouseLE = async (warehouseId: string, legalEntityId: string | null) => {
        const res = await updateWarehouseLegalEntity(warehouseId, legalEntityId)
        if (res.success) {
            toast.success('Đã gán pháp nhân cho kho thành công!')
            await loadEntities()
        } else {
            toast.error(res.error || 'Lỗi gán pháp nhân')
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
        { key: 'entities', label: 'Pháp Nhân & Kho', icon: Building2 },
        { key: 'audit', label: 'Nhật Ký Hệ Thống', icon: Eye },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold" style={{ color: '#E8F1F2' }}>
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
                            <p className="text-2xl font-bold font-mono" style={{ color: c.accent }}>{c.value}</p>
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
                            onClick={() => { setTab(t.key); if (t.key === 'audit' && !auditLoaded) loadAudit(); if (t.key === 'approvals' && !approvalsLoaded) loadApprovals(); if (t.key === 'entities' && !entitiesLoaded) loadEntities() }}
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
                                            <td className="px-3 py-2.5 text-sm font-semibold cursor-pointer hover:underline hover:text-[#87CBB9] transition-all"
                                                style={{ color: '#E8F1F2' }}
                                                onClick={() => setSelectedUser(u)}>
                                                {u.name || '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#8AAEBB' }}>
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
                                                    disabled={!currentUser?.permissions.includes('SYS:ADMIN')}
                                                    onChange={e => handleStatusChange(u.id, e.target.value as any)}
                                                    className="text-xs px-2 py-1 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <div key={r.id} className="p-5 rounded-md cursor-pointer border border-transparent hover:border-[#87CBB9]/45 hover:bg-[#1C3245] transition-all" 
                                style={card}
                                onClick={() => {
                                    setSelectedRole(r)
                                    setShowEditRole(true)
                                }}>
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
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
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
                                            <td className="px-3 py-2.5 text-xs" style={{ color: '#4A6A7A' }}>
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

            {tab === 'entities' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Legal Entities Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#D4A853' }}>Danh Sách Pháp Nhân</h3>
                            <div className="space-y-4">
                                {entities.map(ent => (
                                    <div key={ent.id} className="p-5 rounded-lg flex flex-col justify-between" style={{ ...card, background: '#1B2E3D' }}>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="font-bold text-base" style={{ color: '#E8F1F2' }}>{ent.name}</h4>
                                                <p className="text-xs font-mono mt-0.5" style={{ color: '#8AAEBB' }}>Mã: {ent.code} · MST: {ent.taxId || '(chưa nhập)'}</p>
                                            </div>
                                            <button onClick={() => setEditingEntity(ent)}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
                                                style={{ border: '1px solid #2A4355', color: '#87CBB9' }}>
                                                Chỉnh sửa
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 border-t border-[#2A4355] pt-3 text-xs" style={{ color: '#8AAEBB' }}>
                                            <div className="flex justify-between">
                                                <span>Địa chỉ:</span>
                                                <span className="text-white font-medium text-right max-w-[200px] truncate">{ent.address || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Ngân hàng:</span>
                                                <span className="text-white font-medium text-right max-w-[200px] truncate">{ent.bankName || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Chủ tài khoản:</span>
                                                <span className="text-white font-medium text-right max-w-[200px] truncate">{ent.bankAccountName || '—'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Số tài khoản:</span>
                                                <span className="text-[#87CBB9] font-mono font-bold">{ent.bankAccountNumber || '—'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Warehouses Mapping Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#D4A853' }}>Ánh Xạ Kho Xuất Hàng</h3>
                            <div className="p-5 rounded-lg space-y-4" style={card}>
                                <p className="text-xs leading-relaxed" style={{ color: '#8AAEBB' }}>
                                    Ánh xạ từng kho xuất hàng vật lý về một pháp nhân cụ thể. Khi Sale Admin phê duyệt đơn hàng, danh sách kho sẽ tự động lọc theo đúng pháp nhân của đơn để chọn.
                                </p>
                                <div className="space-y-4">
                                    {warehouses.map(w => (
                                        <div key={w.id} className="flex flex-col gap-2 p-3 rounded-md" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-xs font-bold" style={{ color: '#E8F1F2' }}>{w.name}</p>
                                                    <p className="text-[10px] font-mono mt-0.5" style={{ color: '#4A6A7A' }}>Mã: {w.code}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <label className="text-[10px] uppercase font-semibold whitespace-nowrap" style={{ color: '#8AAEBB' }}>
                                                    Pháp nhân quản lý
                                                </label>
                                                <select
                                                    value={w.legalEntityId || ''}
                                                    onChange={e => handleUpdateWarehouseLE(w.id, e.target.value || null)}
                                                    className="flex-1 px-3 py-1.5 text-xs outline-none rounded-md"
                                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                                >
                                                    <option value="">— Chưa gán / Không thuộc pháp nhân nào —</option>
                                                    {entities.map(ent => (
                                                        <option key={ent.id} value={ent.id}>{ent.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
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
    const [form, setForm] = useState({
        name: '', taxId: '', address: '', bankName: '', bankAccountName: '', bankAccountNumber: ''
    })

    React.useEffect(() => {
        if (entity) {
            setForm({
                name: entity.name || '',
                taxId: entity.taxId || '',
                address: entity.address || '',
                bankName: entity.bankName || '',
                bankAccountName: entity.bankAccountName || '',
                bankAccountNumber: entity.bankAccountNumber || ''
            })
        }
    }, [entity])

    if (!open || !entity) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(10,25,38,0.7)' }}>
            <div className="w-full max-w-md h-full overflow-y-auto p-6 flex flex-col justify-between" style={{ background: '#0D1B25', borderLeft: '1px solid #2A4355' }}>
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold" style={{ color: '#E8F1F2' }}>Cấu Hình Pháp Nhân</h3>
                        <button onClick={onClose}><X size={18} style={{ color: '#4A6A7A' }} /></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Tên Pháp Nhân *</label>
                            <input style={inputStyle} {...focusHandler} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Mã Số Thuế</label>
                            <input style={inputStyle} {...focusHandler} value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Địa Chỉ</label>
                            <input style={inputStyle} {...focusHandler} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                        </div>
                        <div className="pt-4 border-t border-[#2A4355]">
                            <p className="text-xs font-bold uppercase mb-3 flex items-center gap-1.5" style={{ color: '#D4A853' }}>
                                <CreditCard size={12} /> Tài khoản thanh toán
                            </p>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Tên Ngân Hàng (kèm chi nhánh)</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. Vietcombank - Chi nhánh HCM" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Chủ Tài Khoản</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. CONG TY TNHH LY'S CELLARS" value={form.bankAccountName} onChange={e => setForm(f => ({ ...f, bankAccountName: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: '#8AAEBB' }}>Số Tài Khoản</label>
                                    <input style={inputStyle} {...focusHandler} placeholder="e.g. 1023456789" value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => onSave(entity.id, form)} disabled={saving}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-md transition-all"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>
        </div>
    )
}
