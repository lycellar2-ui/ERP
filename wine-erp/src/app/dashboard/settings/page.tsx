export const dynamic = 'force-dynamic'

import { getUsers, getRoles, getPermissions, getSettingsStats } from './actions'
import { SettingsClient } from './SettingsClient'

export const metadata = { title: 'Cài Đặt & RBAC | Wine ERP' }

export default async function SettingsPage() {
    const [users, roles, permissions, stats] = await Promise.all([
        getUsers(),
        getRoles(),
        getPermissions(),
        getSettingsStats(),
    ])

    return (
        <SettingsClient
            initialUsers={users}
            initialRoles={roles}
            permissions={permissions}
            stats={stats}
        />
    )
}
