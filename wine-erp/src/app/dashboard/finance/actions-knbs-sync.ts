'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth, hasRole, hasPermission } from '@/lib/session'
import { syncKnbsTaPayments, KnbsSyncSummary } from '@/lib/knbs/sync-ta-payments'

export async function syncKnbsTaPaymentsAction(): Promise<{
    success: boolean
    data?: KnbsSyncSummary
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (
            !hasRole(user, 'CEO', 'ADMIN', 'TRO_LY', 'KE_TOAN', 'Kế Toán') &&
            !hasPermission(user, 'FIN', 'CREATE') &&
            !hasPermission(user, 'FIN', 'APPROVE')
        ) {
            return { success: false, error: 'Bạn không có quyền đồng bộ thanh toán từ KNBS' }
        }

        const summary = await syncKnbsTaPayments(user.id)
        revalidatePath('/dashboard/finance')
        revalidatePath('/dashboard/sales')
        revalidatePath('/dashboard/customers')

        return {
            success: true,
            data: JSON.parse(JSON.stringify(summary)),
        }
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || 'Lỗi không xác định khi đồng bộ KNBS',
        }
    }
}
