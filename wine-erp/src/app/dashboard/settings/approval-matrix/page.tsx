import { Suspense } from 'react'
import { getApprovalMatrix } from './actions'
import { ApprovalMatrixClient } from './ApprovalMatrixClient'

export const metadata = {
    title: 'Ma Trận Phân Quyền | Wine ERP',
}

export default async function ApprovalMatrixPage() {
    const data = await getApprovalMatrix()
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center py-32">
                <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: '#87CBB9', borderTopColor: 'transparent' }} />
            </div>
        }>
            <ApprovalMatrixClient initialData={data} />
        </Suspense>
    )
}
