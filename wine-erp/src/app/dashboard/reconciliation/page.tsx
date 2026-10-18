import { InvoiceReconciliationTab } from '@/app/dashboard/finance/InvoiceReconciliationTab'

export const metadata = {
    title: 'Đối Chiếu Hóa Đơn (Invoice Reconciliation) | Wine ERP',
}

export default function ReconciliationPage() {
    return (
        <div className="space-y-6 max-w-screen-2xl">
            <InvoiceReconciliationTab />
        </div>
    )
}
