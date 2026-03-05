export type ReportKey =
    | 'stock_inventory' | 'sales_revenue' | 'ar_aging' | 'costing' | 'ap_outstanding'
    | 'po_status' | 'monthly_pnl' | 'margin_per_sku' | 'channel_performance'
    | 'customer_ranking' | 'slow_moving' | 'stamp_usage' | 'tax_summary'
    | 'expense_summary' | 'journal_ledger'

export const REPORT_CATALOG: { key: ReportKey; code: string; name: string; module: string }[] = [
    { key: 'stock_inventory', code: 'R01', name: 'Tồn Kho Chi Tiết', module: 'WMS' },
    { key: 'sales_revenue', code: 'R02', name: 'Doanh Thu Bán Hàng', module: 'SLS' },
    { key: 'ar_aging', code: 'R03', name: 'Công Nợ Phải Thu (AR Aging)', module: 'FIN' },
    { key: 'costing', code: 'R04', name: 'Phân Tích Giá Vốn & Biên LN', module: 'CST' },
    { key: 'ap_outstanding', code: 'R05', name: 'Công Nợ Phải Trả (AP)', module: 'FIN' },
    { key: 'po_status', code: 'R06', name: 'Tình Trạng Đơn Mua Hàng', module: 'PRC' },
    { key: 'monthly_pnl', code: 'R07', name: 'Kết Quả Kinh Doanh Tháng', module: 'FIN' },
    { key: 'margin_per_sku', code: 'R08', name: 'Biên Lợi Nhuận Theo SKU', module: 'SLS' },
    { key: 'channel_performance', code: 'R09', name: 'Hiệu Suất Kênh Bán', module: 'SLS' },
    { key: 'customer_ranking', code: 'R10', name: 'Xếp Hạng Khách Hàng', module: 'CRM' },
    { key: 'slow_moving', code: 'R11', name: 'Hàng Tồn Chậm Luân Chuyển', module: 'WMS' },
    { key: 'stamp_usage', code: 'R12', name: 'Sử Dụng Tem Rượu', module: 'STM' },
    { key: 'tax_summary', code: 'R13', name: 'Tổng Hợp Thuế NK/TTĐB/VAT', module: 'TAX' },
    { key: 'expense_summary', code: 'R14', name: 'Tổng Hợp Chi Phí', module: 'FIN' },
    { key: 'journal_ledger', code: 'R15', name: 'Sổ Nhật Ký Kế Toán', module: 'FIN' },
]
