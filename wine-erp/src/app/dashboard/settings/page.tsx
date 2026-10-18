import { getUsers, getRoles, getPermissions, getSettingsStats } from './actions'
import { SettingsClient } from './SettingsClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Cài Đặt & RBAC | Wine ERP' }

export default async function SettingsPage() {
    const [users, roles, permissions, stats, currentUser] = await Promise.all([
        getUsers(),
        getRoles(),
        getPermissions(),
        getSettingsStats(),
        getCurrentUser(),
    ])

    return (
        <SettingsClient
            initialUsers={users}
            initialRoles={roles}
            permissions={permissions}
            stats={stats}
            currentUser={currentUser}
        />
    )
}

