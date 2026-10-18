import type { AppLocale } from '@/lib/i18n'

export const RECONCILIATION_I18N = {
    vi: {
        title: 'Đối Soát Hóa Đơn & Thanh Toán',
        subtitle: 'Tự động khớp Đơn Bán Hàng (SO) — Hóa Đơn AR — Sao Kê Ngân Hàng — Hóa Đơn Điện Tử VNPT',
    },
    en: {
        title: 'Invoice & Payment Reconciliation',
        subtitle: 'Automated 4-way matching across Sales Orders (SO) — AR Invoices — Bank Statements — VNPT E-Invoices',
    },
} as const

export function getReconciliationLabels(locale: AppLocale) {
    return RECONCILIATION_I18N[locale]
}
