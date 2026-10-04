import type { AppLocale } from '../i18n'

export const COMMON_I18N = {
    vi: {
        actions: {
            save: 'Lưu',
            saveChanges: 'Lưu thay đổi',
            cancel: 'Hủy',
            delete: 'Xóa',
            edit: 'Chỉnh sửa',
            create: 'Tạo mới',
            addNew: '+ Thêm mới',
            add: 'Thêm',
            update: 'Cập nhật',
            search: 'Tìm kiếm...',
            filter: 'Bộ lọc',
            clearFilter: 'Xóa bộ lọc',
            reset: 'Đặt lại',
            refresh: 'Làm mới',
            close: 'Đóng',
            back: 'Quay lại',
            confirm: 'Xác nhận',
            submit: 'Gửi duyệt',
            approve: 'Phê duyệt',
            reject: 'Từ chối',
            print: 'In',
            exportExcel: 'Xuất Excel',
            exportPdf: 'Xuất PDF',
            importExcel: 'Nhập Excel',
            download: 'Tải xuống',
            upload: 'Tải lên',
            viewDetail: 'Xem chi tiết',
            clone: 'Nhân bản',
            retry: 'Thử lại',
            selectAll: 'Chọn tất cả',
            deselectAll: 'Bỏ chọn tất cả',
        },
        table: {
            noData: 'Không có dữ liệu',
            loading: 'Đang tải dữ liệu...',
            total: 'Tổng cộng',
            rows: 'dòng',
            page: 'Trang',
            of: 'trên',
            rowsPerPage: 'Số dòng / trang',
            actions: 'Thao tác',
            stt: 'STT',
            createdAt: 'Ngày tạo',
            updatedAt: 'Cập nhật lúc',
            createdBy: 'Người tạo',
            status: 'Trạng thái',
            notes: 'Ghi chú',
            all: 'Tất cả',
        },
        status: {
            all: 'Tất cả',
            draft: 'Bản nháp',
            pending: 'Chờ duyệt',
            confirmed: 'Đã xác nhận',
            approved: 'Đã duyệt',
            rejected: 'Từ chối',
            processing: 'Đang xử lý',
            shipping: 'Đang giao',
            delivered: 'Đã giao',
            completed: 'Hoàn tất',
            cancelled: 'Đã hủy',
            active: 'Hoạt động',
            inactive: 'Tạm dừng',
            paid: 'Đã thanh toán',
            unpaid: 'Chưa thanh toán',
            partial: 'Thanh toán 1 phần',
            overdue: 'Quá hạn',
            available: 'Sẵn sàng',
            quarantine: 'Cách ly',
            outOfStock: 'Hết hàng',
        },
        time: {
            today: 'Hôm nay',
            yesterday: 'Hôm qua',
            thisWeek: 'Tuần này',
            thisMonth: 'Tháng này',
            lastMonth: 'Tháng trước',
            thisQuarter: 'Quý này',
            thisYear: 'Năm nay',
            custom: 'Tùy chọn',
            from: 'Từ ngày',
            to: 'Đến ngày',
            allTime: 'Toàn thời gian',
        },
        units: {
            bottle: 'chai',
            case: 'thùng',
            pallet: 'pallet',
            box: 'hộp',
            item: 'mặt hàng',
        },
        dialog: {
            confirmTitle: 'Xác nhận thao tác',
            confirmDeleteTitle: 'Xác nhận xóa',
            confirmDeleteDesc: 'Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa?',
            unsavedChangesTitle: 'Dữ liệu chưa được lưu',
            unsavedChangesDesc: 'Bạn có các thay đổi chưa lưu. Bạn có chắc chắn muốn rời khỏi?',
            success: 'Thành công',
            error: 'Có lỗi xảy ra',
            warning: 'Cảnh báo',
            info: 'Thông tin',
        },
    },
    en: {
        actions: {
            save: 'Save',
            saveChanges: 'Save Changes',
            cancel: 'Cancel',
            delete: 'Delete',
            edit: 'Edit',
            create: 'Create',
            addNew: '+ Add New',
            add: 'Add',
            update: 'Update',
            search: 'Search...',
            filter: 'Filter',
            clearFilter: 'Clear Filter',
            reset: 'Reset',
            refresh: 'Refresh',
            close: 'Close',
            back: 'Back',
            confirm: 'Confirm',
            submit: 'Submit',
            approve: 'Approve',
            reject: 'Reject',
            print: 'Print',
            exportExcel: 'Export Excel',
            exportPdf: 'Export PDF',
            importExcel: 'Import Excel',
            download: 'Download',
            upload: 'Upload',
            viewDetail: 'View Detail',
            clone: 'Duplicate',
            retry: 'Retry',
            selectAll: 'Select All',
            deselectAll: 'Deselect All',
        },
        table: {
            noData: 'No data available',
            loading: 'Loading data...',
            total: 'Total',
            rows: 'rows',
            page: 'Page',
            of: 'of',
            rowsPerPage: 'Rows per page',
            actions: 'Actions',
            stt: '#',
            createdAt: 'Created At',
            updatedAt: 'Updated At',
            createdBy: 'Created By',
            status: 'Status',
            notes: 'Notes',
            all: 'All',
        },
        status: {
            all: 'All',
            draft: 'Draft',
            pending: 'Pending',
            confirmed: 'Confirmed',
            approved: 'Approved',
            rejected: 'Rejected',
            processing: 'Processing',
            shipping: 'Shipping',
            delivered: 'Delivered',
            completed: 'Completed',
            cancelled: 'Cancelled',
            active: 'Active',
            inactive: 'Inactive',
            paid: 'Paid',
            unpaid: 'Unpaid',
            partial: 'Partially Paid',
            overdue: 'Overdue',
            available: 'Available',
            quarantine: 'Quarantined',
            outOfStock: 'Out of Stock',
        },
        time: {
            today: 'Today',
            yesterday: 'Yesterday',
            thisWeek: 'This Week',
            thisMonth: 'This Month',
            lastMonth: 'Last Month',
            thisQuarter: 'This Quarter',
            thisYear: 'This Year',
            custom: 'Custom Range',
            from: 'From',
            to: 'To',
            allTime: 'All Time',
        },
        units: {
            bottle: 'bottle(s)',
            case: 'case(s)',
            pallet: 'pallet(s)',
            box: 'box(es)',
            item: 'item(s)',
        },
        dialog: {
            confirmTitle: 'Confirm Action',
            confirmDeleteTitle: 'Confirm Delete',
            confirmDeleteDesc: 'This action cannot be undone. Are you sure you want to delete?',
            unsavedChangesTitle: 'Unsaved Changes',
            unsavedChangesDesc: 'You have unsaved changes. Are you sure you want to discard them?',
            success: 'Success',
            error: 'An error occurred',
            warning: 'Warning',
            info: 'Information',
        },
    },
}

/**
 * Format currency strictly according to locale preference:
 * - 'vi': 1.000.000 ₫
 * - 'en': 1,000,000 VND
 */
export function formatCurrencyByLocale(amount: number | string | null | undefined, locale: AppLocale = 'vi'): string {
    const val = Number(amount) || 0
    if (locale === 'en') {
        return `${val.toLocaleString('en-US')} VND`
    }
    return `${val.toLocaleString('vi-VN')} ₫`
}

/**
 * Format date strictly according to locale preference:
 * - 'vi': DD/MM/YYYY (or DD/MM/YYYY HH:mm)
 * - 'en': MM/DD/YYYY (or MM/DD/YYYY hh:mm A)
 */
export function formatDateByLocale(
    date: Date | string | number | null | undefined,
    locale: AppLocale = 'vi',
    includeTime: boolean = false
): string {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()

    if (!includeTime) {
        return locale === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
    }

    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')

    if (locale === 'en') {
        const period = d.getHours() >= 12 ? 'PM' : 'AM'
        const hour12 = String(d.getHours() % 12 || 12).padStart(2, '0')
        return `${month}/${day}/${year} ${hour12}:${minutes} ${period}`
    }

    return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Format numbers strictly according to locale:
 * - 'vi': 1.234,5
 * - 'en': 1,234.5
 */
export function formatNumberByLocale(val: number | string | null | undefined, locale: AppLocale = 'vi'): string {
    const num = Number(val) || 0
    return num.toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')
}
