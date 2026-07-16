import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/session'
import { QueryProvider } from '@/lib/query-client'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    if (!user) {
        redirect('/login')
    }

    const reqHeaders = await headers()
    const requiredPermission = reqHeaders.get('x-required-permission')

    if (requiredPermission) {
        const isCEO = user.roles.includes('CEO')
        const hasPerm = user.permissions.includes(requiredPermission)
        if (!isCEO && !hasPerm) {
            redirect('/dashboard?error=unauthorized')
        }
    }

    return (
        <QueryProvider>
            <DashboardShell currentUser={user}>{children}</DashboardShell>
        </QueryProvider>
    )
}
