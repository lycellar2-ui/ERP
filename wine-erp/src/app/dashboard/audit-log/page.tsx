import { getAuditLogsDashboard, getAuditStats, getAuditFilterOptions } from './actions'
import { AuditLogClient } from './AuditLogClient'

export default async function AuditLogPage() {
    const [{ rows, total }, stats, filterOptions] = await Promise.all([
        getAuditLogsDashboard({ page: 1, pageSize: 30 }),
        getAuditStats(),
        getAuditFilterOptions(),
    ])

    return (
        <AuditLogClient
            initialRows={rows}
            initialTotal={total}
            stats={stats}
            filterOptions={filterOptions}
        />
    )
}
