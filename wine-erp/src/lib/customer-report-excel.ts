import ExcelJS from 'exceljs'
import type {
    CustomerHistoryTimeRange,
    CustomerPurchaseHistoryResult,
} from '@/app/dashboard/actions'

export interface CustomerReportExportOptions {
    timeRange?: CustomerHistoryTimeRange
    customFrom?: string
    customTo?: string
}

const PALETTE = {
    navyFill: 'FF0F2942',
    tealFill: 'FF0E7490',
    subtitleFill: 'FFF1F5F9',
    sectionFill: 'FFE2E8F0',
    zebraFill: 'FFF8FAFC',
    tastingFill: 'FFFFFBEB',
    tastingText: 'FF92400E',
    totalFill: 'FFE0F2FE',
    dangerText: 'FFB91C1C',
    successText: 'FF15803D',
    warningText: 'FFB45309',
    inkText: 'FF0F172A',
    mutedText: 'FF334155',
    border: 'FFCBD5E1',
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: PALETTE.border } },
    bottom: { style: 'thin', color: { argb: PALETTE.border } },
    left: { style: 'thin', color: { argb: PALETTE.border } },
    right: { style: 'thin', color: { argb: PALETTE.border } },
}

const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: PALETTE.navyFill } },
    bottom: { style: 'double', color: { argb: PALETTE.navyFill } },
    left: { style: 'thin', color: { argb: PALETTE.border } },
    right: { style: 'thin', color: { argb: PALETTE.border } },
}

const WINE_TYPE_BILINGUAL: Record<string, string> = {
    RED: 'Red Wine / Vang Đỏ',
    WHITE: 'White Wine / Vang Trắng',
    SPARKLING: 'Sparkling / Vang Nổ',
    ROSE: 'Rosé / Vang Hồng',
    DESSERT: 'Dessert / Vang Ngọt',
    FORTIFIED: 'Fortified / Vang Cường Hóa',
    OTHER: 'Other / Khác',
}

const ORDER_STATUS_BILINGUAL: Record<string, string> = {
    CONFIRMED: 'Confirmed / Đã xác nhận',
    PARTIALLY_DELIVERED: 'Partial Deliv. / Giao 1 phần',
    DELIVERED: 'Delivered / Đã giao',
    INVOICED: 'Invoiced / Đã xuất HĐ',
    PAID: 'Paid / Đã thanh toán',
    PENDING_APPROVAL: 'Pending / Chờ duyệt',
    PENDING_ACCOUNTING: 'Accounting / Chờ kế toán',
    DRAFT: 'Draft / Nháp',
    CANCELLED: 'Cancelled / Đã hủy',
}

const BASE_PRICE_BILINGUAL: Record<string, string> = {
    BY_CHANNEL: 'Channel Pricing / Giá theo kênh',
    WHOLESALE: 'Wholesale List / Giá bán buôn',
    RETAIL: 'Retail List / Giá bán lẻ',
    HORECA: 'HORECA List / Bảng giá HORECA',
}

const HEALTH_BILINGUAL: Record<string, string> = {
    HEALTHY: 'Regular Cadence / Đặt hàng đều',
    WARNING: 'Slowing Down / Chậm chu kỳ',
    AT_RISK: 'At Risk (Overdue) / Quá hạn chu kỳ',
    NEW: 'New Account / Khách mới',
}

function formatDateVi(isoOrDate?: string | Date | null): string {
    if (!isoOrDate) return '—'
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('vi-VN')
}

function formatPeriodLabel(options?: CustomerReportExportOptions): string {
    const tr = options?.timeRange ?? 'ALL'
    if (tr === 'THIS_MONTH') return 'This Month / Tháng này'
    if (tr === 'LAST_6_MONTHS') return 'Last 6 Months / 6 tháng gần nhất'
    if (tr === 'THIS_YEAR') return `This Year (${new Date().getFullYear()}) / Năm nay`
    if (tr === 'CUSTOM') {
        const fromStr = options?.customFrom ? formatDateVi(`${options.customFrom}T00:00:00`) : '...'
        const toStr = options?.customTo ? formatDateVi(`${options.customTo}T00:00:00`) : '...'
        return `${fromStr} – ${toStr}`
    }
    return 'All Time / Toàn bộ thời gian'
}

function colLetter(colNumber: number): string {
    let n = colNumber
    let res = ''
    while (n > 0) {
        const rem = (n - 1) % 26
        res = String.fromCharCode(65 + rem) + res
        n = Math.floor((n - 1) / 26)
    }
    return res
}

function applyMasthead(
    ws: ExcelJS.Worksheet,
    colCount: number,
    title: string,
    subtitle: string
): void {
    const lastCol = colLetter(colCount)

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = title
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.navyFill } }
    titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(1).height = 28

    ws.mergeCells(`A2:${lastCol}2`)
    const subCell = ws.getCell('A2')
    subCell.value = subtitle
    subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subtitleFill } }
    subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    subCell.border = { bottom: { style: 'thin', color: { argb: PALETTE.border } } }
    ws.getRow(2).height = 20

    ws.getRow(3).height = 8
}

function addSectionHeader(ws: ExcelJS.Worksheet, rowIndex: number, colCount: number, text: string): void {
    const lastCol = colLetter(colCount)
    ws.mergeCells(`A${rowIndex}:${lastCol}${rowIndex}`)
    const cell = ws.getCell(`A${rowIndex}`)
    cell.value = text
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.navyFill } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.sectionFill } }
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    cell.border = THIN_BORDER
    ws.getRow(rowIndex).height = 22
}

function styleTableHeaderRow(row: ExcelJS.Row, colCount: number): void {
    row.height = 28
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c)
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tealFill } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = THIN_BORDER
    }
}

function setupLandscapePrint(ws: ExcelJS.Worksheet): void {
    ws.pageSetup = {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
    }
}

export async function buildCustomerDetailExcelBuffer(
    data: CustomerPurchaseHistoryResult,
    options?: CustomerReportExportOptions
): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = "LY's Cellars ERP"
    wb.created = new Date()

    const periodLabel = formatPeriodLabel(options)
    const exportDateStr = new Date().toLocaleDateString('vi-VN')
    const scopeNote =
        data.customer.entityType === 'COMPANY' && data.customer.childrenCount > 0
            ? `Group + ${data.customer.childrenCount} branches / Công ty mẹ + ${data.customer.childrenCount} chi nhánh`
            : 'Single Account / Khách hàng đơn lẻ'

    // ═══════════════════════════════════════════════════════════════
    // SHEET 1: Overview & Insights
    // ═══════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Overview & Insights', {
        views: [{ showGridLines: true }],
    })
    setupLandscapePrint(ws1)

    const s1Cols = 11
    ws1.columns = [
        { width: 22 }, // A
        { width: 22 }, // B
        { width: 28 }, // C
        { width: 16 }, // D
        { width: 16 }, // E
        { width: 13 }, // F
        { width: 13 }, // G
        { width: 11 }, // H
        { width: 15 }, // I
        { width: 18 }, // J
        { width: 14 }, // K
    ]

    applyMasthead(
        ws1,
        s1Cols,
        "LY'S CELLARS — CUSTOMER DETAIL REPORT / BÁO CÁO CHI TIẾT KHÁCH HÀNG",
        `Account: ${data.customer.code} — ${data.customer.name}  |  Period / Kỳ: ${periodLabel}  |  Scope: ${scopeNote}  |  Exported: ${exportDateStr}`
    )

    // Section 1: Customer Profile
    let r = 4
    addSectionHeader(ws1, r, s1Cols, '1. CUSTOMER PROFILE / HỒ SƠ KHÁCH HÀNG')
    r++

    const profilePairs: Array<[string, string | number, string, string | number]> = [
        [
            'Customer Code / Mã KH',
            data.customer.code,
            'Customer Name / Tên Khách Hàng',
            data.customer.name,
        ],
        [
            'Channel / Kênh Phân Phối',
            data.customer.channel,
            'Entity Type / Loại Hình',
            data.customer.entityType === 'COMPANY'
                ? `Company (${data.customer.childrenCount} branches)`
                : 'Restaurant / Account',
        ],
        [
            'Sales Rep / Sale Phụ Trách',
            data.customer.salesRepName ?? 'Unassigned / Chưa phân bổ',
            'Parent Company / Công Ty Mẹ',
            data.customer.parentName ?? '—',
        ],
        [
            'Payment Term / Điều Khoản TT',
            data.customer.paymentTerm,
            'Credit Limit / Hạn Mức Tín Dụng',
            data.customer.creditLimit,
        ],
        [
            'Pricing Policy / Chính Sách Giá',
            BASE_PRICE_BILINGUAL[data.pricing.basePriceType] ?? data.pricing.basePriceType,
            'Default Discount / CK Mặc Định',
            data.pricing.defaultDiscountPct / 100,
        ],
        [
            'Purchasing / Liên Hệ Thu Mua',
            data.customer.purchasingName
                ? `${data.customer.purchasingName}${data.customer.purchasingPhone ? ` (${data.customer.purchasingPhone})` : ''}`
                : '—',
            'Site Receiver / Người Nhận Hàng',
            data.customer.receiverName
                ? `${data.customer.receiverName}${data.customer.receiverPhone ? ` (${data.customer.receiverPhone})` : ''}`
                : '—',
        ],
    ]

    for (const [l1, v1, l2, v2] of profilePairs) {
        const row = ws1.getRow(r)
        row.height = 20
        ws1.mergeCells(`B${r}:C${r}`)
        ws1.mergeCells(`E${r}:K${r}`)

        const cL1 = row.getCell(1)
        const cV1 = row.getCell(2)
        const cL2 = row.getCell(4)
        const cV2 = row.getCell(5)

        cL1.value = l1
        cL1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.mutedText } }
        cL1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }

        cV1.value = v1
        cV1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.inkText } }

        cL2.value = l2
        cL2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.mutedText } }
        cL2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }

        cV2.value = v2
        cV2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.inkText } }
        if (l2.includes('Credit Limit')) {
            cV2.numFmt = '#,##0'
            cV2.alignment = { horizontal: 'right', vertical: 'middle' }
        } else if (l2.includes('Default Discount')) {
            cV2.numFmt = '0.0%'
            cV2.alignment = { horizontal: 'right', vertical: 'middle' }
        }

        for (let c = 1; c <= s1Cols; c++) {
            row.getCell(c).border = THIN_BORDER
            if (!row.getCell(c).alignment) {
                row.getCell(c).alignment = { vertical: 'middle' }
            }
        }
        r++
    }

    r++ // spacer row

    // Section 2: Executive KPIs & Financial Health
    addSectionHeader(ws1, r, s1Cols, '2. EXECUTIVE KPIs & BUYING HEALTH / TỔNG QUAN DOANH THU, CÔNG NỢ & NHỊP MUA')
    r++

    const commercialCount = data.orderBreakdown.commercialCount
    const commercialRev = data.orderBreakdown.commercialRevenue
    const commercialBtls = data.orderBreakdown.commercialBottles
    const aov = commercialCount > 0 ? Math.round(commercialRev / commercialCount) : 0
    const avgPricePerBottle = commercialBtls > 0 ? Math.round(commercialRev / commercialBtls) : 0
    const collectionRate = data.kpis.totalRevenue > 0 ? data.kpis.totalPaidAmount / data.kpis.totalRevenue : 0
    const creditUtil = data.customer.creditLimit > 0 ? data.kpis.totalArDebt / data.customer.creditLimit : 0

    const kpiRows: Array<{
        l1: string
        v1: string | number
        fmt1?: string
        color1?: string
        l2: string
        v2: string | number
        fmt2?: string
        color2?: string
    }> = [
        {
            l1: 'Total Net Revenue / Tổng Doanh Thu Thuần',
            v1: data.kpis.totalRevenue,
            fmt1: '#,##0',
            color1: PALETTE.navyFill,
            l2: 'Commercial Sales Revenue / DT Bán Hàng',
            v2: commercialRev,
            fmt2: '#,##0',
        },
        {
            l1: 'Total Orders / Tổng Số Đơn',
            v1: `${data.kpis.totalOrders} (${commercialCount} sales / ${data.orderBreakdown.tastingCount} tasting)`,
            l2: 'Total Bottles / Tổng Sản Lượng (Chai)',
            v2: `${data.kpis.totalBottles.toLocaleString('en-US')} (${commercialBtls.toLocaleString('en-US')} sales / ${data.orderBreakdown.tastingBottles.toLocaleString('en-US')} tasting)`,
        },
        {
            l1: 'Avg Order Value (AOV) / GT Đơn Trung Bình',
            v1: aov,
            fmt1: '#,##0',
            l2: 'Avg Net Price / Bottle / Giá TB Mỗi Chai',
            v2: avgPricePerBottle,
            fmt2: '#,##0',
        },
        {
            l1: 'Total Paid / Đã Thanh Toán (VND)',
            v1: data.kpis.totalPaidAmount,
            fmt1: '#,##0',
            color1: PALETTE.successText,
            l2: 'Collection Rate / Tỷ Lệ Thu Hồi',
            v2: collectionRate,
            fmt2: '0.0%',
        },
        {
            l1: 'Outstanding AR Debt / Công Nợ Phải Thu',
            v1: data.kpis.totalArDebt,
            fmt1: '#,##0',
            color1: data.kpis.totalArDebt > 0 ? PALETTE.warningText : PALETTE.inkText,
            l2: 'Overdue AR Debt / Nợ Quá Hạn',
            v2: data.kpis.overdueArDebt,
            fmt2: '#,##0',
            color2: data.kpis.overdueArDebt > 0 ? PALETTE.dangerText : PALETTE.inkText,
        },
        {
            l1: 'Credit Utilization / Tỷ Lệ Dùng Hạn Mức',
            v1: creditUtil,
            fmt1: '0.0%',
            l2: 'Buying Rhythm / Trạng Thái Nhịp Mua',
            v2: HEALTH_BILINGUAL[data.health.status] ?? data.health.statusLabel,
            color2:
                data.health.status === 'AT_RISK'
                    ? PALETTE.dangerText
                    : data.health.status === 'WARNING'
                    ? PALETTE.warningText
                    : PALETTE.successText,
        },
        {
            l1: 'Last Order Date / Ngày Đặt Gần Nhất',
            v1: `${formatDateVi(data.kpis.lastOrderDate)}${data.kpis.lastOrderNo ? ` (${data.kpis.lastOrderNo})` : ''}`,
            l2: 'Avg Cycle & Days Since Last / Chu Kỳ TB',
            v2:
                data.health.daysSinceLastOrder !== null
                    ? `${data.health.daysSinceLastOrder} days ago${data.health.averageOrderCycleDays ? ` (Cycle: ~${data.health.averageOrderCycleDays} days)` : ''}`
                    : 'No orders / Chưa có đơn',
        },
    ]

    for (const k of kpiRows) {
        const row = ws1.getRow(r)
        row.height = 20
        ws1.mergeCells(`B${r}:C${r}`)
        ws1.mergeCells(`E${r}:K${r}`)

        const cL1 = row.getCell(1)
        const cV1 = row.getCell(2)
        const cL2 = row.getCell(4)
        const cV2 = row.getCell(5)

        cL1.value = k.l1
        cL1.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.mutedText } }
        cL1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }

        cV1.value = k.v1
        cV1.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: k.color1 ?? PALETTE.inkText } }
        if (k.fmt1) {
            cV1.numFmt = k.fmt1
            cV1.alignment = { horizontal: 'right', vertical: 'middle' }
        } else {
            cV1.alignment = { horizontal: 'left', vertical: 'middle' }
        }

        cL2.value = k.l2
        cL2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.mutedText } }
        cL2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }

        cV2.value = k.v2
        cV2.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: k.color2 ?? PALETTE.inkText } }
        if (k.fmt2) {
            cV2.numFmt = k.fmt2
            cV2.alignment = { horizontal: 'right', vertical: 'middle' }
        } else {
            cV2.alignment = { horizontal: 'left', vertical: 'middle' }
        }

        for (let c = 1; c <= s1Cols; c++) {
            row.getCell(c).border = THIN_BORDER
        }
        r++
    }

    r++ // spacer

    // Section 3: Wine Preferences (3A Wine Type, 3B Price Segment, 3C Country)
    addSectionHeader(ws1, r, s1Cols, '3. WINE PREFERENCES / CƠ CẤU LOẠI RƯỢU HAY LẤY & PHÂN KHÚC')
    r++

    const writeBreakdownTable = (
        subTitle: string,
        col1Header: string,
        items: Array<{ label: string; bottles: number; revenue: number }>
    ) => {
        ws1.mergeCells(`A${r}:E${r}`)
        const subTitleCell = ws1.getCell(`A${r}`)
        subTitleCell.value = subTitle
        subTitleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.navyFill } }
        subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subtitleFill } }
        subTitleCell.border = THIN_BORDER
        ws1.getRow(r).height = 20
        r++

        const hRow = ws1.getRow(r)
        hRow.getCell(1).value = col1Header
        hRow.getCell(2).value = 'Bottles / Số Chai'
        hRow.getCell(3).value = '% Volume / Tỷ Trọng SL'
        hRow.getCell(4).value = 'Revenue (VND) / Doanh Thu'
        hRow.getCell(5).value = '% Revenue / Tỷ Trọng DT'
        styleTableHeaderRow(hRow, 5)
        r++

        const totBtls = items.reduce((s, i) => s + i.bottles, 0)
        const totRev = items.reduce((s, i) => s + i.revenue, 0)

        if (items.length === 0) {
            ws1.mergeCells(`A${r}:E${r}`)
            const emptyCell = ws1.getCell(`A${r}`)
            emptyCell.value = 'No data in selected period / Chưa có dữ liệu trong kỳ lọc'
            emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
            emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
            emptyCell.border = THIN_BORDER
            ws1.getRow(r).height = 20
            r++
        } else {
            items.forEach((item, idx) => {
                const row = ws1.getRow(r)
                row.height = 19
                row.getCell(1).value = item.label
                row.getCell(2).value = item.bottles
                row.getCell(3).value = totBtls > 0 ? item.bottles / totBtls : 0
                row.getCell(4).value = Math.round(item.revenue)
                row.getCell(5).value = totRev > 0 ? item.revenue / totRev : 0

                row.getCell(2).numFmt = '#,##0'
                row.getCell(3).numFmt = '0.0%'
                row.getCell(4).numFmt = '#,##0'
                row.getCell(5).numFmt = '0.0%'

                for (let c = 1; c <= 5; c++) {
                    const cell = row.getCell(c)
                    cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.inkText } }
                    cell.border = THIN_BORDER
                    if (idx % 2 === 1) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                    }
                    cell.alignment = { horizontal: c === 1 ? 'left' : 'right', vertical: 'middle' }
                }
                r++
            })
        }
        r++ // spacer between sub-tables
    }

    writeBreakdownTable(
        '3A. By Wine Type / Theo Loại Vang',
        'Wine Type / Loại Vang',
        data.preferences.wineTypes.map(w => ({
            label: WINE_TYPE_BILINGUAL[w.type] ?? w.label,
            bottles: w.bottles,
            revenue: w.revenue,
        }))
    )

    writeBreakdownTable(
        '3B. By Price Segment / Theo Phân Khúc Giá',
        'Price Bracket / Phân Khúc Giá',
        data.preferences.priceBrackets.map(p => ({
            label: p.label,
            bottles: p.bottles,
            revenue: p.revenue,
        }))
    )

    writeBreakdownTable(
        '3C. By Country of Origin / Theo Quốc Gia Xuất Xứ',
        'Country / Quốc Gia',
        data.preferences.countries.map(c => ({
            label: c.country,
            bottles: c.bottles,
            revenue: c.revenue,
        }))
    )

    // Section 4: Top 10 Most Frequently Ordered Wines
    addSectionHeader(ws1, r, s1Cols, '4. TOP 10 MOST FREQUENTLY ORDERED WINES / TOP 10 RƯỢU HAY LẤY NHẤT')
    r++

    const top10Headers = [
        '#',
        'Code / Mã SKU',
        'Product / Tên Rượu',
        'Wine Type / Loại',
        'Origin / Xuất Xứ',
        'Orders / Số Đơn',
        'Quantity / Số Chai',
        '% Vol',
        'Last Price / Giá Gần Nhất',
        'Total Spend (VND)',
        'Last Date / Mua Cuối',
    ]
    const top10HeaderRow = ws1.getRow(r)
    top10Headers.forEach((h, i) => {
        top10HeaderRow.getCell(i + 1).value = h
    })
    styleTableHeaderRow(top10HeaderRow, s1Cols)
    r++

    const top10 = data.topProducts.slice(0, 10)
    if (top10.length === 0) {
        ws1.mergeCells(`A${r}:${colLetter(s1Cols)}${r}`)
        const emptyCell = ws1.getCell(`A${r}`)
        emptyCell.value = 'No purchased products in selected period / Chưa có sản phẩm nào trong kỳ lọc'
        emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
        emptyCell.border = THIN_BORDER
        ws1.getRow(r).height = 20
        r++
    } else {
        const allTopQty = data.kpis.totalBottles || top10.reduce((s, p) => s + p.totalQty, 0)
        top10.forEach((p, idx) => {
            const row = ws1.getRow(r)
            row.height = 20
            row.getCell(1).value = idx + 1
            row.getCell(2).value = p.skuCode
            row.getCell(3).value = p.name
            row.getCell(4).value = p.wineType ? (WINE_TYPE_BILINGUAL[p.wineType] ?? p.wineType) : '—'
            row.getCell(5).value = p.originCountry ?? '—'
            row.getCell(6).value = p.orderCount
            row.getCell(7).value = p.totalQty
            row.getCell(8).value = allTopQty > 0 ? p.totalQty / allTopQty : 0
            row.getCell(9).value = p.lastUnitPrice
            row.getCell(10).value = p.totalSpend
            row.getCell(11).value = formatDateVi(p.lastPurchasedAt)

            row.getCell(6).numFmt = '#,##0'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '0.0%'
            row.getCell(9).numFmt = '#,##0'
            row.getCell(10).numFmt = '#,##0'

            for (let c = 1; c <= s1Cols; c++) {
                const cell = row.getCell(c)
                cell.font = { name: 'Calibri', size: 10, bold: c === 3 || c === 10, color: { argb: PALETTE.inkText } }
                cell.border = THIN_BORDER
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                }
                if (c === 1 || c === 2 || c === 11) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (c >= 6 && c <= 10) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' }
                }
            }
            r++
        })
    }

    // ═══════════════════════════════════════════════════════════════
    // SHEET 2: Purchase Detail (Anh J's Primary Sheet)
    // ═══════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Purchase Detail', {
        views: [{ state: 'frozen', ySplit: 4 }],
    })
    setupLandscapePrint(ws2)

    const s2Cols = 15
    ws2.columns = [
        { width: 13 }, // A Date
        { width: 14 }, // B Code
        { width: 38 }, // C Product
        { width: 13 }, // D Quantity
        { width: 16 }, // E Price
        { width: 15 }, // F Discount (%)
        { width: 16 }, // G Discount Amt
        { width: 18 }, // H Net Amount
        { width: 18 }, // I Order No
        { width: 20 }, // J Order Type
        { width: 20 }, // K Wine Type
        { width: 14 }, // L Origin
        { width: 24 }, // M Branch
        { width: 22 }, // N Status
        { width: 18 }, // O Invoice
    ]

    applyMasthead(
        ws2,
        s2Cols,
        'CUSTOMER PURCHASE DETAIL / CHI TIẾT LỊCH SỬ MUA HÀNG',
        `${data.customer.code} — ${data.customer.name}  |  Period / Kỳ: ${periodLabel}  |  Exported: ${exportDateStr}`
    )

    const s2Headers = [
        'Date / Ngày',
        'Code / Mã SKU',
        'Product / Tên Sản Phẩm',
        'Quantity / Số Lượng',
        'Price / Đơn Giá',
        'Discount (%) / Chiết Khấu',
        'Discount Amt / Tiền Giảm',
        'Net Amount / Thành Tiền',
        'Order No / Số Đơn',
        'Order Type / Loại Đơn',
        'Wine Type / Loại Vang',
        'Origin / Xuất Xứ',
        'Branch / Chi Nhánh',
        'Status / Trạng Thái',
        'Invoice / Hóa Đơn',
    ]
    const s2HeaderRow = ws2.getRow(4)
    s2Headers.forEach((h, i) => {
        s2HeaderRow.getCell(i + 1).value = h
    })
    styleTableHeaderRow(s2HeaderRow, s2Cols)

    const detailRows: Array<{
        dateVal: Date
        skuCode: string
        productName: string
        qty: number
        unitPrice: number
        discountPctDecimal: number
        discountAmount: number
        netAmount: number
        soNo: string
        orderTypeLabel: string
        isTasting: boolean
        wineTypeLabel: string
        origin: string
        branch: string
        statusLabel: string
        invoiceStr: string
    }> = []

    for (const order of data.orders) {
        const isTasting = order.orderType === 'TASTING' || order.orderType === 'SAMPLE'
        const orderTypeLabel = isTasting ? 'Tasting / Hàng mẫu' : 'Sales / Đơn bán'
        const statusLabel = ORDER_STATUS_BILINGUAL[order.status] ?? order.status
        const invoiceStr =
            order.arInvoices.length > 0
                ? order.arInvoices.map(i => i.invoiceNo).filter(Boolean).join(', ')
                : order.soNo.startsWith('HĐ-')
                ? order.soNo
                : '—'
        const branchLabel = order.branchName ?? data.customer.name
        const orderDate = new Date(order.createdAt)

        for (const line of order.lines) {
            detailRows.push({
                dateVal: Number.isNaN(orderDate.getTime()) ? new Date() : orderDate,
                skuCode: line.skuCode || '—',
                productName: line.productName || '—',
                qty: line.qtyOrdered,
                unitPrice: line.unitPrice,
                discountPctDecimal: (line.effectiveDiscountPct ?? line.lineDiscountPct ?? 0) / 100,
                discountAmount: line.discountAmount ?? 0,
                netAmount: line.lineTotal,
                soNo: order.soNo,
                orderTypeLabel,
                isTasting,
                wineTypeLabel: line.wineType ? (WINE_TYPE_BILINGUAL[line.wineType] ?? line.wineType) : '—',
                origin: line.country ?? '—',
                branch: branchLabel,
                statusLabel,
                invoiceStr,
            })
        }
    }

    const dataStartRow = 5
    if (detailRows.length === 0) {
        ws2.mergeCells(`A${dataStartRow}:${colLetter(s2Cols)}${dataStartRow}`)
        const emptyCell = ws2.getCell(`A${dataStartRow}`)
        emptyCell.value = 'No transactions found in the selected period / Không có giao dịch phát sinh trong kỳ lọc'
        emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
        emptyCell.border = THIN_BORDER
        ws2.getRow(dataStartRow).height = 24
    } else {
        detailRows.forEach((item, idx) => {
            const rowNum = dataStartRow + idx
            const row = ws2.getRow(rowNum)
            row.height = 20

            row.getCell(1).value = item.dateVal
            row.getCell(2).value = item.skuCode
            row.getCell(3).value = item.productName
            row.getCell(4).value = item.qty
            row.getCell(5).value = item.unitPrice
            row.getCell(6).value = item.discountPctDecimal
            row.getCell(7).value = item.discountAmount
            row.getCell(8).value = item.netAmount
            row.getCell(9).value = item.soNo
            row.getCell(10).value = item.orderTypeLabel
            row.getCell(11).value = item.wineTypeLabel
            row.getCell(12).value = item.origin
            row.getCell(13).value = item.branch
            row.getCell(14).value = item.statusLabel
            row.getCell(15).value = item.invoiceStr

            row.getCell(1).numFmt = 'dd/mm/yyyy'
            row.getCell(4).numFmt = '#,##0'
            row.getCell(5).numFmt = '#,##0'
            row.getCell(6).numFmt = '0.0%'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '#,##0'

            const fillColor = item.isTasting
                ? PALETTE.tastingFill
                : idx % 2 === 1
                ? PALETTE.zebraFill
                : undefined

            for (let c = 1; c <= s2Cols; c++) {
                const cell = row.getCell(c)
                cell.font = {
                    name: 'Calibri',
                    size: 10,
                    bold: c === 8,
                    color: { argb: item.isTasting ? PALETTE.tastingText : PALETTE.inkText },
                }
                if (fillColor) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
                }
                cell.border = THIN_BORDER

                if (c === 1 || c === 2 || c === 9 || c === 10 || c === 15) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (c >= 4 && c <= 8) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' }
                }
            }
        })

        const lastDataRow = dataStartRow + detailRows.length - 1
        ws2.autoFilter = {
            from: { row: 4, column: 1 },
            to: { row: lastDataRow, column: s2Cols },
        }

        // Totals Block
        const totalAllRowNum = lastDataRow + 1
        const totalAllRow = ws2.getRow(totalAllRowNum)
        totalAllRow.height = 22
        ws2.mergeCells(`A${totalAllRowNum}:C${totalAllRowNum}`)
        totalAllRow.getCell(1).value = `TOTAL (ALL ${detailRows.length} LINES) / TỔNG CỘNG`
        totalAllRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${lastDataRow})` }
        totalAllRow.getCell(5).value = { formula: `IF(D${totalAllRowNum}>0,H${totalAllRowNum}/D${totalAllRowNum},0)` }
        totalAllRow.getCell(7).value = { formula: `SUM(G${dataStartRow}:G${lastDataRow})` }
        totalAllRow.getCell(8).value = { formula: `SUM(H${dataStartRow}:H${lastDataRow})` }

        totalAllRow.getCell(4).numFmt = '#,##0'
        totalAllRow.getCell(5).numFmt = '#,##0'
        totalAllRow.getCell(7).numFmt = '#,##0'
        totalAllRow.getCell(8).numFmt = '#,##0'

        for (let c = 1; c <= s2Cols; c++) {
            const cell = totalAllRow.getCell(c)
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.inkText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.totalFill } }
            cell.border = TOTAL_BORDER
            cell.alignment = { horizontal: c >= 4 && c <= 8 ? 'right' : 'left', vertical: 'middle' }
        }

        // Commercial Sales Subtotal
        const commRowNum = totalAllRowNum + 1
        const commRow = ws2.getRow(commRowNum)
        commRow.height = 20
        ws2.mergeCells(`A${commRowNum}:C${commRowNum}`)
        commRow.getCell(1).value = 'Commercial Sales / Đơn Bán Thương Mại'
        commRow.getCell(4).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Sales / Đơn bán",D${dataStartRow}:D${lastDataRow})` }
        commRow.getCell(5).value = { formula: `IF(D${commRowNum}>0,H${commRowNum}/D${commRowNum},0)` }
        commRow.getCell(7).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Sales / Đơn bán",G${dataStartRow}:G${lastDataRow})` }
        commRow.getCell(8).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Sales / Đơn bán",H${dataStartRow}:H${lastDataRow})` }

        commRow.getCell(4).numFmt = '#,##0'
        commRow.getCell(5).numFmt = '#,##0'
        commRow.getCell(7).numFmt = '#,##0'
        commRow.getCell(8).numFmt = '#,##0'

        for (let c = 1; c <= s2Cols; c++) {
            const cell = commRow.getCell(c)
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.mutedText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
            cell.border = THIN_BORDER
            cell.alignment = { horizontal: c >= 4 && c <= 8 ? 'right' : 'left', vertical: 'middle' }
        }

        // Tasting / Sample Subtotal
        const tasteRowNum = totalAllRowNum + 2
        const tasteRow = ws2.getRow(tasteRowNum)
        tasteRow.height = 20
        ws2.mergeCells(`A${tasteRowNum}:C${tasteRowNum}`)
        tasteRow.getCell(1).value = 'Tasting & Samples / Hàng Mẫu & Tasting'
        tasteRow.getCell(4).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Tasting*",D${dataStartRow}:D${lastDataRow})` }
        tasteRow.getCell(7).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Tasting*",G${dataStartRow}:G${lastDataRow})` }
        tasteRow.getCell(8).value = { formula: `SUMIF(J${dataStartRow}:J${lastDataRow},"Tasting*",H${dataStartRow}:H${lastDataRow})` }

        tasteRow.getCell(4).numFmt = '#,##0'
        tasteRow.getCell(7).numFmt = '#,##0'
        tasteRow.getCell(8).numFmt = '#,##0'

        for (let c = 1; c <= s2Cols; c++) {
            const cell = tasteRow.getCell(c)
            cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.tastingText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.tastingFill } }
            cell.border = THIN_BORDER
            cell.alignment = { horizontal: c >= 4 && c <= 8 ? 'right' : 'left', vertical: 'middle' }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SHEET 3: Top Wines & Pricing
    // ═══════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Top Wines & Pricing', {
        views: [{ state: 'frozen', ySplit: 5 }],
    })
    setupLandscapePrint(ws3)

    const s3Cols = 13
    ws3.columns = [
        { width: 6 },  // A #
        { width: 14 }, // B Code
        { width: 38 }, // C Product
        { width: 20 }, // D Wine Type
        { width: 14 }, // E Origin
        { width: 13 }, // F Order Freq
        { width: 14 }, // G Total Qty
        { width: 11 }, // H % Vol
        { width: 16 }, // I Avg Net Price
        { width: 16 }, // J Last Price
        { width: 18 }, // K Total Spend
        { width: 11 }, // L % Rev
        { width: 14 }, // M Last Date
    ]

    applyMasthead(
        ws3,
        s3Cols,
        'PURCHASED WINES & SPECIAL PRICING / DANH MỤC RƯỢU HAY LẤY & BẢNG GIÁ RIÊNG',
        `${data.customer.code} — ${data.customer.name}  |  Period / Kỳ: ${periodLabel}  |  Exported: ${exportDateStr}`
    )

    let r3 = 4
    addSectionHeader(ws3, r3, s3Cols, 'A. PURCHASED WINES CATALOGUE / TOÀN BỘ DANH MỤC RƯỢU ĐÃ MUA')
    r3++

    const wineCatHeaders = [
        '#',
        'Code / Mã SKU',
        'Product / Tên Sản Phẩm',
        'Wine Type / Loại Vang',
        'Origin / Xuất Xứ',
        'Order Freq / Số Lần Đặt',
        'Total Qty / Tổng Chai',
        '% Vol',
        'Avg Net Price / Giá TB',
        'Last Price / Giá Gần Nhất',
        'Total Spend / Tổng Chi Tiêu',
        '% Rev',
        'Last Date / Mua Gần Nhất',
    ]
    const wHeaderRow = ws3.getRow(r3)
    wineCatHeaders.forEach((h, i) => {
        wHeaderRow.getCell(i + 1).value = h
    })
    styleTableHeaderRow(wHeaderRow, s3Cols)
    r3++

    const totalProductQty = data.topProducts.reduce((s, p) => s + p.totalQty, 0)
    const totalProductSpend = data.topProducts.reduce((s, p) => s + p.totalSpend, 0)

    if (data.topProducts.length === 0) {
        ws3.mergeCells(`A${r3}:${colLetter(s3Cols)}${r3}`)
        const emptyCell = ws3.getCell(`A${r3}`)
        emptyCell.value = 'No purchased products in selected period / Chưa có sản phẩm nào trong kỳ lọc'
        emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
        emptyCell.border = THIN_BORDER
        ws3.getRow(r3).height = 22
        r3++
    } else {
        const wStartRow = r3
        data.topProducts.forEach((p, idx) => {
            const row = ws3.getRow(r3)
            row.height = 20
            row.getCell(1).value = idx + 1
            row.getCell(2).value = p.skuCode
            row.getCell(3).value = p.name
            row.getCell(4).value = p.wineType ? (WINE_TYPE_BILINGUAL[p.wineType] ?? p.wineType) : '—'
            row.getCell(5).value = p.originCountry ?? '—'
            row.getCell(6).value = p.orderCount
            row.getCell(7).value = p.totalQty
            row.getCell(8).value = totalProductQty > 0 ? p.totalQty / totalProductQty : 0
            row.getCell(9).value = p.avgNetPrice
            row.getCell(10).value = p.lastUnitPrice
            row.getCell(11).value = p.totalSpend
            row.getCell(12).value = totalProductSpend > 0 ? p.totalSpend / totalProductSpend : 0
            row.getCell(13).value = formatDateVi(p.lastPurchasedAt)

            row.getCell(6).numFmt = '#,##0'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '0.0%'
            row.getCell(9).numFmt = '#,##0'
            row.getCell(10).numFmt = '#,##0'
            row.getCell(11).numFmt = '#,##0'
            row.getCell(12).numFmt = '0.0%'

            for (let c = 1; c <= s3Cols; c++) {
                const cell = row.getCell(c)
                cell.font = { name: 'Calibri', size: 10, bold: c === 3 || c === 11, color: { argb: PALETTE.inkText } }
                cell.border = THIN_BORDER
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                }
                if (c === 1 || c === 2 || c === 13) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (c >= 6 && c <= 12) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' }
                }
            }
            r3++
        })

        const wLastRow = r3 - 1
        const wTotalRow = ws3.getRow(r3)
        wTotalRow.height = 22
        ws3.mergeCells(`A${r3}:E${r3}`)
        wTotalRow.getCell(1).value = `TOTAL (${data.topProducts.length} SKUs) / TỔNG CỘNG`
        wTotalRow.getCell(7).value = { formula: `SUM(G${wStartRow}:G${wLastRow})` }
        wTotalRow.getCell(8).value = { formula: `SUM(H${wStartRow}:H${wLastRow})` }
        wTotalRow.getCell(9).value = { formula: `IF(G${r3}>0,K${r3}/G${r3},0)` }
        wTotalRow.getCell(11).value = { formula: `SUM(K${wStartRow}:K${wLastRow})` }
        wTotalRow.getCell(12).value = { formula: `SUM(L${wStartRow}:L${wLastRow})` }

        wTotalRow.getCell(7).numFmt = '#,##0'
        wTotalRow.getCell(8).numFmt = '0.0%'
        wTotalRow.getCell(9).numFmt = '#,##0'
        wTotalRow.getCell(11).numFmt = '#,##0'
        wTotalRow.getCell(12).numFmt = '0.0%'

        for (let c = 1; c <= s3Cols; c++) {
            const cell = wTotalRow.getCell(c)
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.inkText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.totalFill } }
            cell.border = TOTAL_BORDER
            cell.alignment = { horizontal: c >= 6 && c <= 12 ? 'right' : 'left', vertical: 'middle' }
        }
        r3++
    }

    r3++ // spacer

    // Section B: Custom Pricing Policy & SKU Special Rules
    addSectionHeader(ws3, r3, s3Cols, 'B. CUSTOM PRICING POLICY & SKU SPECIAL RULES / CHÍNH SÁCH GIÁ & BẢNG GIÁ RIÊNG')
    r3++

    ws3.mergeCells(`A${r3}:${colLetter(s3Cols)}${r3}`)
    const policyCell = ws3.getCell(`A${r3}`)
    policyCell.value = `Base Price Policy: ${BASE_PRICE_BILINGUAL[data.pricing.basePriceType] ?? data.pricing.basePriceType}   |   Default Discount / Chiết khấu mặc định: ${data.pricing.defaultDiscountPct}%`
    policyCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: PALETTE.navyFill } }
    policyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.subtitleFill } }
    policyCell.border = THIN_BORDER
    ws3.getRow(r3).height = 20
    r3++

    const ruleHeaders = [
        '#',
        'Code / Mã SKU',
        'Product / Tên Rượu',
        'Wine Type / Loại',
        'Origin / Xuất Xứ',
        'List Price / Giá Niêm Yết',
        'Special Price / Giá Riêng',
        'Discount (%) / Mức Giảm',
        'Discount Amt / Giảm (VND)',
        'Start Date / Từ Ngày',
        'End Date / Đến Ngày',
        'Status / Trạng Thái',
        'Notes / Ghi Chú',
    ]
    const ruleHeaderRow = ws3.getRow(r3)
    ruleHeaders.forEach((h, i) => {
        ruleHeaderRow.getCell(i + 1).value = h
    })
    styleTableHeaderRow(ruleHeaderRow, s3Cols)
    r3++

    if (data.pricing.specialRules.length === 0) {
        ws3.mergeCells(`A${r3}:${colLetter(s3Cols)}${r3}`)
        const emptyRuleCell = ws3.getCell(`A${r3}`)
        emptyRuleCell.value = 'No SKU-specific custom price rules / Chưa có bảng giá riêng theo từng mã SKU'
        emptyRuleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
        emptyRuleCell.alignment = { horizontal: 'center', vertical: 'middle' }
        emptyRuleCell.border = THIN_BORDER
        ws3.getRow(r3).height = 20
        r3++
    } else {
        data.pricing.specialRules.forEach((rule, idx) => {
            const row = ws3.getRow(r3)
            row.height = 20
            const listPrice = rule.wholesalePrice ?? rule.retailPrice ?? 0
            const statusText = rule.isExpired
                ? 'Expired / Hết hạn'
                : rule.isExpiringSoon
                ? 'Expiring Soon / Sắp hết'
                : 'Active / Đang áp dụng'

            row.getCell(1).value = idx + 1
            row.getCell(2).value = rule.skuCode
            row.getCell(3).value = rule.productName
            row.getCell(4).value = rule.wineType ? (WINE_TYPE_BILINGUAL[rule.wineType] ?? rule.wineType) : '—'
            row.getCell(5).value = rule.country ?? '—'
            row.getCell(6).value = listPrice
            row.getCell(7).value = rule.specialPrice
            row.getCell(8).value = rule.discountPct / 100
            row.getCell(9).value = rule.discountAmount
            row.getCell(10).value = formatDateVi(rule.startDate)
            row.getCell(11).value = rule.endDate ? formatDateVi(rule.endDate) : 'Indefinite / Vô thời hạn'
            row.getCell(12).value = statusText
            row.getCell(13).value = rule.notes ?? '—'

            row.getCell(6).numFmt = '#,##0'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '0.0%'
            row.getCell(9).numFmt = '#,##0'

            for (let c = 1; c <= s3Cols; c++) {
                const cell = row.getCell(c)
                cell.font = {
                    name: 'Calibri',
                    size: 10,
                    bold: c === 7,
                    color: {
                        argb:
                            c === 12
                                ? rule.isExpired
                                    ? PALETTE.dangerText
                                    : rule.isExpiringSoon
                                    ? PALETTE.warningText
                                    : PALETTE.successText
                                : PALETTE.inkText,
                    },
                }
                cell.border = THIN_BORDER
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                }
                if (c === 1 || c === 2 || c === 10 || c === 11 || c === 12) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }
                } else if (c >= 6 && c <= 9) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' }
                } else {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' }
                }
            }
            r3++
        })
    }

    // Section C: Approved Price Proposals (if any)
    if (data.pricing.proposals.length > 0) {
        r3++
        addSectionHeader(ws3, r3, s3Cols, 'C. APPROVED PRICE PROPOSALS / TỜ TRÌNH DUYỆT GIÁ RIÊNG')
        r3++

        const propHeaderRow = ws3.getRow(r3)
        propHeaderRow.getCell(1).value = '#'
        propHeaderRow.getCell(2).value = 'Proposal No / Số TT'
        ws3.mergeCells(`C${r3}:E${r3}`)
        propHeaderRow.getCell(3).value = 'Title / Tiêu Đề'
        propHeaderRow.getCell(6).value = 'Start Date / Từ Ngày'
        propHeaderRow.getCell(7).value = 'End Date / Đến Ngày'
        propHeaderRow.getCell(8).value = 'Status / Trạng Thái'
        ws3.mergeCells(`I${r3}:M${r3}`)
        propHeaderRow.getCell(9).value = 'Justification / Ghi Chú'
        styleTableHeaderRow(propHeaderRow, s3Cols)
        r3++

        data.pricing.proposals.forEach((prop, idx) => {
            const row = ws3.getRow(r3)
            row.height = 20
            ws3.mergeCells(`C${r3}:E${r3}`)
            ws3.mergeCells(`I${r3}:M${r3}`)

            row.getCell(1).value = idx + 1
            row.getCell(2).value = prop.proposalNo
            row.getCell(3).value = prop.title
            row.getCell(6).value = formatDateVi(prop.startDate)
            row.getCell(7).value = prop.endDate ? formatDateVi(prop.endDate) : 'Indefinite / Vô thời hạn'
            row.getCell(8).value = prop.status
            row.getCell(9).value = prop.notes ?? '—'

            for (let c = 1; c <= s3Cols; c++) {
                const cell = row.getCell(c)
                cell.font = { name: 'Calibri', size: 10, color: { argb: PALETTE.inkText } }
                cell.border = THIN_BORDER
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                }
                cell.alignment = {
                    horizontal: c === 1 || c === 2 || c === 6 || c === 7 || c === 8 ? 'center' : 'left',
                    vertical: 'middle',
                }
            }
            r3++
        })
    }

    // ═══════════════════════════════════════════════════════════════
    // SHEET 4: Monthly Trend
    // ═══════════════════════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Monthly Trend', {
        views: [{ state: 'frozen', ySplit: 4 }],
    })
    setupLandscapePrint(ws4)

    const s4Cols = 9
    ws4.columns = [
        { width: 16 }, // A Month
        { width: 14 }, // B Orders
        { width: 18 }, // C Commercial Btls
        { width: 18 }, // D Tasting Btls
        { width: 16 }, // E Total Bottles
        { width: 20 }, // F Net Revenue
        { width: 18 }, // G Avg Order Value
        { width: 18 }, // H Avg Price/Btl
        { width: 16 }, // I MoM Growth
    ]

    applyMasthead(
        ws4,
        s4Cols,
        'MONTHLY PURCHASE TREND / XU HƯỚNG MUA HÀNG THEO THÁNG',
        `${data.customer.code} — ${data.customer.name}  |  Period / Kỳ: ${periodLabel}  |  Exported: ${exportDateStr}`
    )

    const s4Headers = [
        'Month / Tháng',
        'Orders / Số Đơn',
        'Commercial Btls / Chai Bán',
        'Tasting Btls / Chai Tasting',
        'Total Bottles / Tổng Chai',
        'Net Revenue (VND) / Doanh Thu',
        'Avg Order Value / GT Đơn TB',
        'Avg Price/Btl / Giá TB/Chai',
        'MoM Growth (%) / Tăng Trưởng',
    ]
    const s4HeaderRow = ws4.getRow(4)
    s4Headers.forEach((h, i) => {
        s4HeaderRow.getCell(i + 1).value = h
    })
    styleTableHeaderRow(s4HeaderRow, s4Cols)

    const trendSorted = [...data.monthlyTrend].sort((a, b) => a.month.localeCompare(b.month))
    const mStartRow = 5

    if (trendSorted.length === 0) {
        ws4.mergeCells(`A${mStartRow}:${colLetter(s4Cols)}${mStartRow}`)
        const emptyCell = ws4.getCell(`A${mStartRow}`)
        emptyCell.value = 'No monthly trend data in selected period / Chưa có dữ liệu theo tháng trong kỳ lọc'
        emptyCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: PALETTE.mutedText } }
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' }
        emptyCell.border = THIN_BORDER
        ws4.getRow(mStartRow).height = 22
    } else {
        trendSorted.forEach((m, idx) => {
            const rowNum = mStartRow + idx
            const row = ws4.getRow(rowNum)
            row.height = 20

            const prevRev = idx > 0 ? trendSorted[idx - 1].revenue : 0
            const momGrowth = prevRev > 0 ? (m.revenue - prevRev) / prevRev : null
            const avgOrder = m.orders > 0 ? Math.round(m.revenue / m.orders) : 0
            const avgBtlPrice = m.bottles > 0 ? Math.round(m.revenue / m.bottles) : 0

            row.getCell(1).value = `${m.month} (${m.label})`
            row.getCell(2).value = m.orders
            row.getCell(3).value = m.commercialBottles ?? m.bottles
            row.getCell(4).value = m.tastingBottles ?? 0
            row.getCell(5).value = m.bottles
            row.getCell(6).value = Math.round(m.revenue)
            row.getCell(7).value = avgOrder
            row.getCell(8).value = avgBtlPrice
            row.getCell(9).value = momGrowth !== null ? momGrowth : '—'

            row.getCell(2).numFmt = '#,##0'
            row.getCell(3).numFmt = '#,##0'
            row.getCell(4).numFmt = '#,##0'
            row.getCell(5).numFmt = '#,##0'
            row.getCell(6).numFmt = '#,##0'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '#,##0'
            if (momGrowth !== null) {
                row.getCell(9).numFmt = '+0.0%;-0.0%;0.0%'
            }

            for (let c = 1; c <= s4Cols; c++) {
                const cell = row.getCell(c)
                let textColor = PALETTE.inkText
                if (c === 9 && momGrowth !== null) {
                    textColor = momGrowth >= 0 ? PALETTE.successText : PALETTE.dangerText
                }
                cell.font = { name: 'Calibri', size: 10, bold: c === 1 || c === 6, color: { argb: textColor } }
                cell.border = THIN_BORDER
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.zebraFill } }
                }
                cell.alignment = {
                    horizontal: c === 1 || (c === 9 && momGrowth === null) ? 'center' : 'right',
                    vertical: 'middle',
                }
            }
        })

        const mLastRow = mStartRow + trendSorted.length - 1
        const mTotalRowNum = mLastRow + 1
        const mTotalRow = ws4.getRow(mTotalRowNum)
        mTotalRow.height = 22

        mTotalRow.getCell(1).value = `TOTAL (${trendSorted.length} MO) / TỔNG`
        mTotalRow.getCell(2).value = { formula: `SUM(B${mStartRow}:B${mLastRow})` }
        mTotalRow.getCell(3).value = { formula: `SUM(C${mStartRow}:C${mLastRow})` }
        mTotalRow.getCell(4).value = { formula: `SUM(D${mStartRow}:D${mLastRow})` }
        mTotalRow.getCell(5).value = { formula: `SUM(E${mStartRow}:E${mLastRow})` }
        mTotalRow.getCell(6).value = { formula: `SUM(F${mStartRow}:F${mLastRow})` }
        mTotalRow.getCell(7).value = { formula: `IF(B${mTotalRowNum}>0,F${mTotalRowNum}/B${mTotalRowNum},0)` }
        mTotalRow.getCell(8).value = { formula: `IF(E${mTotalRowNum}>0,F${mTotalRowNum}/E${mTotalRowNum},0)` }
        mTotalRow.getCell(9).value = '—'

        for (let c = 2; c <= 8; c++) {
            mTotalRow.getCell(c).numFmt = '#,##0'
        }

        for (let c = 1; c <= s4Cols; c++) {
            const cell = mTotalRow.getCell(c)
            cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: PALETTE.inkText } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETTE.totalFill } }
            cell.border = TOTAL_BORDER
            cell.alignment = {
                horizontal: c === 1 || c === 9 ? 'center' : 'right',
                vertical: 'middle',
            }
        }
    }

    const buf = await wb.xlsx.writeBuffer()
    return Buffer.from(buf)
}
