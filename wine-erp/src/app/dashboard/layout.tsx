import { DashboardShell } from '@/components/layout/DashboardShell'

// All dashboard pages fetch from DB at runtime — never pre-render during build
export const dynamic = 'force-dynamic'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <DashboardShell>{children}</DashboardShell>
}
