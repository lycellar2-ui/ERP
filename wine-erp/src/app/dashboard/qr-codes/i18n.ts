export const QR_CODES_I18N = {
    vi: {
        header: {
            description: 'Quản lý mã QR truy xuất nguồn gốc — Tự động sinh khi xác nhận phiếu nhập kho (GR)',
            printBtn: (count: number) => `In ${count} Nhãn`,
        },
        stats: {
            total: 'Tổng Mã QR',
            scanned: 'Đã Quét Xác Thực',
            unscanned: 'Chưa Quét',
        },
        searchPlaceholder: 'Tìm theo Lot No, SKU hoặc mã QR...',
        searchBtn: 'Tìm kiếm',
        table: {
            qrCode: 'Mã QR',
            lotNo: 'Số Lô (Lot No)',
            sku: 'SKU',
            product: 'Sản Phẩm',
            scanCount: 'Lượt Quét',
            status: 'Trạng Thái Xác Thực',
            link: 'Trang Truy Xuất',
            openLink: 'Mở trang',
            emptyTitle: 'Chưa có mã QR truy xuất nào',
            emptyDescription: 'Mã QR sẽ tự động được sinh khi Thủ kho xác nhận Phiếu Nhập Kho (Goods Receipt)',
            statusUnscanned: 'Chưa quét',
            statusAuthentic: 'Chính hãng',
            statusMultiScan: (count: number) => `Quét ${count} lần`,
        },
        footerSummary: (shown: number, total: number) =>
            `Hiển thị ${shown}/${total} mã QR — Tự động khởi tạo từ quy trình Nhập kho (GR)`,
    },
    en: {
        header: {
            description: 'Manage origin traceability QR codes — Auto-generated upon Goods Receipt (GR) confirmation',
            printBtn: (count: number) => `Print ${count} Labels`,
        },
        stats: {
            total: 'Total QR Codes',
            scanned: 'Verified / Scanned',
            unscanned: 'Unscanned',
        },
        searchPlaceholder: 'Search by Lot No, SKU, or QR code...',
        searchBtn: 'Search',
        table: {
            qrCode: 'QR Code',
            lotNo: 'Lot No',
            sku: 'SKU',
            product: 'Product',
            scanCount: 'Scan Count',
            status: 'Verification Status',
            link: 'Public Traceability',
            openLink: 'Open',
            emptyTitle: 'No traceability QR codes found',
            emptyDescription: 'QR codes are automatically generated when a Goods Receipt (GR) is confirmed',
            statusUnscanned: 'Unscanned',
            statusAuthentic: 'Authentic',
            statusMultiScan: (count: number) => `Scanned ${count}x`,
        },
        footerSummary: (shown: number, total: number) =>
            `Showing ${shown}/${total} QR codes — Auto-generated upon Goods Receipt confirmation`,
    },
} as const
