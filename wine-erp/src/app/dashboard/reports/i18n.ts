import type { AppLocale } from '@/lib/i18n'
import type { ReportKey } from './constants'

export const REPORTS_I18N = {
    vi: {
        title: 'Báo Cáo & Phân Tích (RPT)',
        subtitle: 'Doanh thu, sản phẩm bán chạy, kênh, tồn kho — Tổng hợp từ mọi module',

        tabs: {
            overview: 'Tổng Quan',
            export: 'Xuất Excel (16 Báo Cáo)',
            schedule: 'Lịch Tự Động',
        },

        kpiCards: {
            rev6m: 'Doanh Thu 6 Tháng',
            stockValue: 'Giá Trị Tồn Kho',
            totalStock: 'Tổng Tồn Kho',
            bottlesUnit: 'chai',
            activeSkus: 'SKU Đang Có Hàng',
        },

        financial: {
            arTitle: 'Công Nợ Khách Hàng (AR)',
            apTitle: 'Công Nợ Nhà Cung Cấp (AP)',
            totalUnpaid: 'Tổng Chưa Thu',
            totalUnpaidAP: 'Tổng Chưa Trả',
            overdue: 'Trong đó Quá Hạn',
        },

        analytics: {
            monthlyRevTitle: 'Doanh Thu 6 Tháng Gần Nhất',
            channelTitle: 'Theo Kênh Bán',
            topSkusTitle: 'Top 10 SKU Bán Chạy Nhất',
            brandTitle: 'Doanh Thu Theo Brand',
            topCustomersTitle: 'Top 5 Khách Hàng (Theo Doanh Thu)',
            topSalesRepsTitle: 'Top Sale Rep',
            lowStockTitle: 'Cảnh Báo Tồn Kho Thấp',
            ordersCount: 'đơn hàng',
            avgPerOrder: 'TB',
            bottlesSold: 'chai',
            noData: 'Chưa có dữ liệu',
            noSalesData: 'Chưa có dữ liệu bán hàng',
            noLowStock: 'Không có sản phẩm nào sắp hết hàng',
        },

        export: {
            bannerText: '16 báo cáo chuẩn — Xuất file Excel (.xlsx) với header công ty, format VND, auto-filter. Nhấn vào nút Xuất để tải.',
            thCode: 'Mã',
            thName: 'Tên Báo Cáo',
            thModule: 'Module',
            thAction: 'Hành Động',
            exportBtn: 'Xuất Excel',
            exportingBtn: 'Đang xuất...',
            downloadedBtn: 'Đã tải',
            exportError: 'Lỗi xuất báo cáo',
        },

        schedules: {
            bannerText: 'Lịch gửi báo cáo tự động qua email. Cron job chạy mỗi 15 phút kiểm tra lịch hẹn và gửi Excel đính kèm.',
            loading: 'Đang tải lịch...',
            thTemplate: 'Template',
            thFreq: 'Tần Suất',
            thRecipients: 'Người Nhận',
            thLastRun: 'Chạy Lần Cuối',
            thNextRun: 'Chạy Tiếp',
            thStatus: 'Trạng Thái',
            noSchedules: 'Chưa có lịch báo cáo tự động',
            apiHint: 'Tạo lịch qua API:',
            freqDaily: 'Hàng ngày',
            freqWeekly: 'Hàng tuần',
            freqMonthly: 'Hàng tháng',
            active: '✓ Active',
            paused: '⏸ Paused',
        },

        channels: {
            HORECA: 'HORECA',
            WHOLESALE_DISTRIBUTOR: 'Đại Lý',
            VIP_RETAIL: 'VIP Retail',
            DIRECT_INDIVIDUAL: 'Trực Tiếp',
        },

        wineTypes: {
            RED: 'Vang Đỏ',
            WHITE: 'Vang Trắng',
            ROSE: 'Vang Hồng',
            SPARKLING: 'Vang Nổ / Sủi',
            FORTIFIED: 'Vang Cường Hóa',
            DESSERT: 'Vang Ngọt',
        },

        reports: {
            stock_inventory: 'Tồn Kho Chi Tiết',
            sales_revenue: 'Doanh Thu Bán Hàng',
            ar_aging: 'Công Nợ Phải Thu (AR Aging)',
            costing: 'Phân Tích Giá Vốn & Biên LN',
            ap_outstanding: 'Công Nợ Phải Trả (AP)',
            po_status: 'Tình Trạng Đơn Mua Hàng',
            monthly_pnl: 'Kết Quả Kinh Doanh Tháng',
            margin_per_sku: 'Biên Lợi Nhuận Theo SKU',
            channel_performance: 'Hiệu Suất Kênh Bán',
            customer_ranking: 'Xếp Hạng Khách Hàng',
            slow_moving: 'Hàng Tồn Chậm Luân Chuyển',
            stamp_usage: 'Sử Dụng Tem Rượu',
            tax_summary: 'Tổng Hợp Thuế NK/TTĐB/VAT',
            expense_summary: 'Tổng Hợp Chi Phí',
            journal_ledger: 'Sổ Nhật Ký Kế Toán',
            brand_performance: 'Doanh Thu Theo Brand',
        } as Record<ReportKey, string>,
    },

    en: {
        title: 'Executive Reports & Analytics (RPT)',
        subtitle: 'Net revenue, top-selling wines, channel mix, inventory valuation — Integrated cross-module BI',

        tabs: {
            overview: 'Executive Overview',
            export: 'Excel Export (16 Reports)',
            schedule: 'Automated Schedules',
        },

        kpiCards: {
            rev6m: '6-Month Revenue',
            stockValue: 'Inventory Valuation',
            totalStock: 'Total Stock On Hand',
            bottlesUnit: 'bottles',
            activeSkus: 'Active In-Stock SKUs',
        },

        financial: {
            arTitle: 'Accounts Receivable (AR)',
            apTitle: 'Accounts Payable (AP)',
            totalUnpaid: 'Total Outstanding AR',
            totalUnpaidAP: 'Total Outstanding AP',
            overdue: 'Of Which Overdue',
        },

        analytics: {
            monthlyRevTitle: 'Last 6 Months Revenue Trend',
            channelTitle: 'Revenue by Channel',
            topSkusTitle: 'Top 10 Best-Selling SKUs',
            brandTitle: 'Revenue by Brand',
            topCustomersTitle: 'Top 5 Key Accounts by Revenue',
            topSalesRepsTitle: 'Top Sales Representatives',
            lowStockTitle: 'Low Stock Alerts',
            ordersCount: 'orders',
            avgPerOrder: 'Avg',
            bottlesSold: 'btls',
            noData: 'No data recorded',
            noSalesData: 'No sales data available',
            noLowStock: 'No products currently low on stock',
        },

        export: {
            bannerText: '16 Standard Reports — Export formatted Excel (.xlsx) spreadsheets with company headers, currency formatting, and auto-filters. Click Export to download.',
            thCode: 'Code',
            thName: 'Report Name',
            thModule: 'Module',
            thAction: 'Actions',
            exportBtn: 'Export Excel',
            exportingBtn: 'Exporting...',
            downloadedBtn: 'Downloaded',
            exportError: 'Export failed',
        },

        schedules: {
            bannerText: 'Automated email dispatch schedule. Background cron checks every 15 minutes to generate and email Excel spreadsheets.',
            loading: 'Loading schedules...',
            thTemplate: 'Template',
            thFreq: 'Frequency',
            thRecipients: 'Recipients',
            thLastRun: 'Last Run',
            thNextRun: 'Next Run',
            thStatus: 'Status',
            noSchedules: 'No automated report schedules configured yet',
            apiHint: 'Configure schedules via API:',
            freqDaily: 'Daily',
            freqWeekly: 'Weekly',
            freqMonthly: 'Monthly',
            active: '✓ Active',
            paused: '⏸ Paused',
        },

        channels: {
            HORECA: 'HORECA',
            WHOLESALE_DISTRIBUTOR: 'Wholesale / Distributor',
            VIP_RETAIL: 'VIP Retail',
            DIRECT_INDIVIDUAL: 'Direct / Retail',
        },

        wineTypes: {
            RED: 'Red Wine',
            WHITE: 'White Wine',
            ROSE: 'Rosé Wine',
            SPARKLING: 'Sparkling Wine',
            FORTIFIED: 'Fortified Wine',
            DESSERT: 'Dessert Wine',
        },

        reports: {
            stock_inventory: 'Detailed Inventory Stock',
            sales_revenue: 'Sales Revenue Breakdown',
            ar_aging: 'Accounts Receivable Aging (AR)',
            costing: 'COGS & Gross Margin Analysis',
            ap_outstanding: 'Accounts Payable Outstanding (AP)',
            po_status: 'Purchase Order (PO) Status',
            monthly_pnl: 'Monthly P&L Statement',
            margin_per_sku: 'Profit Margin per SKU',
            channel_performance: 'Channel Performance Analytics',
            customer_ranking: 'Customer Revenue Ranking',
            slow_moving: 'Slow-Moving Inventory Stock',
            stamp_usage: 'Excise Wine Stamp Utilization',
            tax_summary: 'Import & Excise & VAT Summary',
            expense_summary: 'Operating Expenses Summary',
            journal_ledger: 'General Journal & Ledger',
            brand_performance: 'Revenue by Wine Brand',
        } as Record<ReportKey, string>,
    },
}

export function getReportsDictionary(locale: AppLocale) {
    return REPORTS_I18N[locale] || REPORTS_I18N.vi
}
