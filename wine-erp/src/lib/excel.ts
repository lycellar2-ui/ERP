'use server'

import ExcelJS from 'exceljs'

export type ExcelColumn = {
    header: string
    key: string
    width?: number
    numFmt?: string
}

export type ExcelExportConfig = {
    sheetName: string
    title?: string
    columns: ExcelColumn[]
    rows: Record<string, any>[]
    headerColor?: string
}

// Generate Excel buffer from data
export async function generateExcelBuffer(config: ExcelExportConfig): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = "LY's Cellars ERP"
    wb.created = new Date()

    const ws = wb.addWorksheet(config.sheetName)

    // Title row
    let startRow = 1
    if (config.title) {
        ws.mergeCells(`A1:${String.fromCharCode(64 + config.columns.length)}1`)
        const titleCell = ws.getCell('A1')
        titleCell.value = config.title
        titleCell.font = { bold: true, size: 14 }
        titleCell.alignment = { horizontal: 'center' }
        startRow = 3
    }

    // Set columns
    ws.columns = config.columns.map(col => ({
        header: col.header,
        key: col.key,
        width: col.width ?? 18,
    }))

    // Style header row
    const headerRow = ws.getRow(startRow)
    if (config.title) {
        // Re-add headers if title shifted them
        config.columns.forEach((col, i) => {
            const cell = ws.getCell(startRow, i + 1)
            cell.value = col.header
        })
    }

    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: config.headerColor ?? 'FF1A4363' },
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = {
            bottom: { style: 'thin', color: { argb: 'FF2A4355' } },
        }
    })

    // Data rows
    for (const row of config.rows) {
        const dataRow = ws.addRow(row)
        dataRow.eachCell((cell, colNumber) => {
            const col = config.columns[colNumber - 1]
            if (col?.numFmt) {
                cell.numFmt = col.numFmt
            }
        })
    }

    // Auto-filter
    if (config.rows.length > 0) {
        ws.autoFilter = {
            from: { row: config.title ? startRow : 1, column: 1 },
            to: { row: startRow + config.rows.length, column: config.columns.length },
        }
    }

    const buffer = await wb.xlsx.writeBuffer()
    return Buffer.from(buffer)
}

// Pre-built exports for common reports
export async function exportARAgingReport(rows: any[]): Promise<Buffer> {
    return generateExcelBuffer({
        sheetName: 'AR Aging',
        title: 'Báo cáo công nợ phải thu',
        columns: [
            { header: 'Số hóa đơn', key: 'invoiceNo', width: 15 },
            { header: 'Khách hàng', key: 'customerName', width: 25 },
            { header: 'Số tiền', key: 'amount', width: 15, numFmt: '#,##0' },
            { header: 'Đã trả', key: 'paidAmount', width: 15, numFmt: '#,##0' },
            { header: 'Còn lại', key: 'outstanding', width: 15, numFmt: '#,##0' },
            { header: 'Hạn thanh toán', key: 'dueDate', width: 15 },
            { header: 'Ngày quá hạn', key: 'daysOverdue', width: 12 },
            { header: 'Trạng thái', key: 'status', width: 12 },
        ],
        rows,
    })
}

export async function exportStockInventoryReport(rows: any[]): Promise<Buffer> {
    return generateExcelBuffer({
        sheetName: 'Tồn kho',
        title: 'Báo cáo tồn kho',
        columns: [
            { header: 'Mã SKU', key: 'skuCode', width: 15 },
            { header: 'Tên sản phẩm', key: 'productName', width: 30 },
            { header: 'Kho', key: 'warehouseName', width: 20 },
            { header: 'Vị trí', key: 'locationCode', width: 15 },
            { header: 'Mã Lot', key: 'lotNo', width: 15 },
            { header: 'SL Nhập', key: 'qtyReceived', width: 10, numFmt: '#,##0' },
            { header: 'SL Tồn', key: 'qtyAvailable', width: 10, numFmt: '#,##0' },
            { header: 'Đơn giá', key: 'unitLandedCost', width: 12, numFmt: '#,##0' },
            { header: 'Trạng thái', key: 'status', width: 12 },
        ],
        rows,
    })
}

export async function exportSalesReport(rows: any[]): Promise<Buffer> {
    return generateExcelBuffer({
        sheetName: 'Doanh thu',
        title: 'Báo cáo doanh thu',
        columns: [
            { header: 'Số SO', key: 'soNo', width: 15 },
            { header: 'Khách hàng', key: 'customerName', width: 25 },
            { header: 'Kênh', key: 'channel', width: 15 },
            { header: 'Tổng tiền', key: 'totalAmount', width: 15, numFmt: '#,##0' },
            { header: 'Chiết khấu', key: 'orderDiscount', width: 12, numFmt: '#,##0' },
            { header: 'Trạng thái', key: 'status', width: 12 },
            { header: 'Ngày tạo', key: 'createdAt', width: 15 },
            { header: 'NV Bán hàng', key: 'salesRepName', width: 20 },
        ],
        rows,
    })
}

export async function exportCostingReport(rows: any[]): Promise<Buffer> {
    return generateExcelBuffer({
        sheetName: 'Giá vốn',
        title: 'Phân tích giá vốn & biên lợi nhuận',
        columns: [
            { header: 'Mã SKU', key: 'skuCode', width: 15 },
            { header: 'Tên sản phẩm', key: 'productName', width: 30 },
            { header: 'Quốc gia', key: 'country', width: 15 },
            { header: 'ABV %', key: 'abvPercent', width: 10, numFmt: '0.0' },
            { header: 'Giá vốn/chai', key: 'unitLandedCost', width: 12, numFmt: '#,##0' },
            { header: 'Giá bán', key: 'listPrice', width: 12, numFmt: '#,##0' },
            { header: 'Biên LN %', key: 'marginPct', width: 10, numFmt: '0.0' },
            { header: 'SL Tồn', key: 'stockQty', width: 10, numFmt: '#,##0' },
        ],
        rows,
    })
}
