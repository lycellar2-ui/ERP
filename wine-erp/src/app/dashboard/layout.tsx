import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/session'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    return <DashboardShell currentUser={user}>{children}</DashboardShell>
}

