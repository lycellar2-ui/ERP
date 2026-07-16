import { DashboardShell } from '@/components/layout/DashboardShell'
import { getCurrentUser } from '@/lib/session'
import { QueryProvider } from '@/lib/query-client'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()
    return (
        <QueryProvider>
            <DashboardShell currentUser={user}>{children}</DashboardShell>
        </QueryProvider>
    )
}
