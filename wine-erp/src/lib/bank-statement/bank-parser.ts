import ExcelJS from 'exceljs'
import crypto from 'crypto'

export interface ParsedBankTransaction {
    txnDate: Date
    txnRef: string | null
    txnType: 'CREDIT' | 'DEBIT'
    amount: number
    balanceAfter: number | null
    rawNarrative: string
    txnHash: string
}

export interface ParseResult {
    bankCodeDetected: string
    totalRowsParsed: number
    creditCount: number
    debitCount: number
    totalCreditAmount: number
    totalDebitAmount: number
    transactions: ParsedBankTransaction[]
    errors: string[]
}

/**
 * Clean & parse a numeric string or cell value into a clean float/integer.
 * Handles VND formats: "15,000,000", "15.000.000", "-50.000 VND", Excel numeric cells.
 */
export function parseBankAmount(val: unknown): number {
    if (val === null || val === undefined) return 0
    if (typeof val === 'number') return Math.abs(val)

    let str = String(val).trim()
    if (!str) return 0

    // Remove VND, đ, currency symbols, and spaces
    str = str.replace(/[₫đVND\s]/gi, '')

    // Check for negative signs
    const isNegative = str.startsWith('-') || str.startsWith('(')
    str = str.replace(/[()\-+]/g, '')

    // If string contains both dots and commas (e.g. 1.234.567,89 or 1,234,567.89)
    if (str.includes('.') && str.includes(',')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            // Vietnamese format: 1.234.567,89 -> 1234567.89
            str = str.replace(/\./g, '').replace(',', '.')
        } else {
            // US format: 1,234,567.89 -> 1234567.89
            str = str.replace(/,/g, '')
        }
    } else if (str.includes('.')) {
        // Vietnamese integer with dot thousand separator: 15.000.000
        const parts = str.split('.')
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            str = str.replace(/\./g, '')
        }
    } else if (str.includes(',')) {
        // Comma thousand separator: 15,000,000
        const parts = str.split(',')
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            str = str.replace(/,/g, '')
        } else {
            str = str.replace(',', '.')
        }
    }

    const num = parseFloat(str)
    if (isNaN(num)) return 0
    return isNegative ? -Math.abs(num) : Math.abs(num)
}

/**
 * Parse date from Excel cell or formatted string.
 */
export function parseBankDate(val: unknown): Date {
    if (!val) return new Date()
    if (val instanceof Date && !isNaN(val.getTime())) {
        return val
    }

    // Excel serial number
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000))
        if (!isNaN(date.getTime())) return date
    }

    const str = String(val).trim()

    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10)
        const month = parseInt(dmyMatch[2], 10) - 1
        const year = parseInt(dmyMatch[3], 10)
        const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0
        const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0
        const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0
        const parsed = new Date(year, month, day, hour, minute, second)
        if (!isNaN(parsed.getTime())) return parsed
    }

    // Try ISO or standard Date.parse
    const isoDate = new Date(str)
    if (!isNaN(isoDate.getTime())) return isoDate

    return new Date()
}

/**
 * Creates SHA-256 idempotency hash for transaction.
 */
export function generateTxnHash(
    bankAccountId: string,
    txnDate: Date,
    amount: number,
    balanceAfter: number | null,
    rawNarrative: string
): string {
    const dateStr = txnDate.toISOString().split('T')[0]
    const amountStr = Math.round(amount).toString()
    const balanceStr = balanceAfter !== null ? Math.round(balanceAfter).toString() : ''
    const narrativeClean = rawNarrative.trim().toLowerCase().replace(/\s+/g, ' ')

    const rawKey = `${bankAccountId}|${dateStr}|${amountStr}|${balanceStr}|${narrativeClean}`
    return crypto.createHash('sha256').update(rawKey).digest('hex')
}

interface ColumnMap {
    dateCol: number
    refCol: number
    creditCol: number
    debitCol: number
    amountCol: number
    balanceCol: number
    narrativeCol: number
}

/**
 * Auto-detect column positions from header row text
 */
function detectColumnMapping(headers: string[]): ColumnMap | null {
    let dateCol = -1
    let refCol = -1
    let creditCol = -1
    let debitCol = -1
    let amountCol = -1
    let balanceCol = -1
    let narrativeCol = -1

    for (let i = 0; i < headers.length; i++) {
        const h = (headers[i] || '').toLowerCase().trim()
        if (!h) continue

        // Date
        if (dateCol === -1 && (h.includes('ngày gd') || h.includes('ngày') || h.includes('date') || h.includes('ngay'))) {
            dateCol = i + 1
        }
        // Ref No
        if (refCol === -1 && (h.includes('số gd') || h.includes('mã gd') || h.includes('ref') || h.includes('chứng từ') || h.includes('số ct') || h.includes('số lệnh'))) {
            refCol = i + 1
        }
        // Credit (tiền vào)
        if (creditCol === -1 && (h.includes('ghi có') || h.includes('tiền vào') || h.includes('credit') || h.includes('thu') || h.includes('nhận') || h.includes('gửi vào'))) {
            creditCol = i + 1
        }
        // Debit (tiền ra)
        if (debitCol === -1 && (h.includes('ghi nợ') || h.includes('tiền ra') || h.includes('debit') || h.includes('chi') || h.includes('rút ra'))) {
            debitCol = i + 1
        }
        // Single Amount column
        if (amountCol === -1 && (h === 'số tiền' || h === 'amount' || h === 'tiền' || h === 'phát sinh')) {
            amountCol = i + 1
        }
        // Balance
        if (balanceCol === -1 && (h.includes('số dư') || h.includes('balance') || h.includes('so du'))) {
            balanceCol = i + 1
        }
        // Narrative / Description
        if (narrativeCol === -1 && (h.includes('nội dung') || h.includes('diễn giải') || h.includes('description') || h.includes('narrative') || h.includes('chi tiết') || h.includes('noi dung'))) {
            narrativeCol = i + 1
        }
    }

    // We must at least have a Date, an Amount or Credit/Debit, and a Narrative column
    if (dateCol !== -1 && (creditCol !== -1 || amountCol !== -1 || debitCol !== -1) && narrativeCol !== -1) {
        return { dateCol, refCol, creditCol, debitCol, amountCol, balanceCol, narrativeCol }
    }

    return null
}

/**
 * Main bank statement parser for Excel (.xlsx, .xls) and CSV buffers
 */
export async function parseBankStatementBuffer(
    buffer: Buffer,
    bankAccountId: string
): Promise<ParseResult> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
        throw new Error('File Excel không có sheet dữ liệu nào.')
    }

    let detectedHeaderRow = -1
    let colMap: ColumnMap | null = null
    const errors: string[] = []

    // Scan the first 25 rows to identify the header row
    for (let rowIdx = 1; rowIdx <= Math.min(25, worksheet.rowCount); rowIdx++) {
        const row = worksheet.getRow(rowIdx)
        const cellValues: string[] = []
        row.eachCell({ includeEmpty: true }, (cell) => {
            cellValues.push(cell.text || String(cell.value || ''))
        })

        const mapping = detectColumnMapping(cellValues)
        if (mapping) {
            detectedHeaderRow = rowIdx
            colMap = mapping
            break
        }
    }

    if (!colMap || detectedHeaderRow === -1) {
        throw new Error('Không thể tự động nhận diện cấu trúc cột sao kê ngân hàng. Vui lòng kiểm tra dòng tiêu đề chứa Ngày, Số tiền, và Nội dung.')
    }

    const transactions: ParsedBankTransaction[] = []
    let totalCreditAmount = 0
    let totalDebitAmount = 0
    let creditCount = 0
    let debitCount = 0

    // Parse data rows starting after detected header
    for (let rowIdx = detectedHeaderRow + 1; rowIdx <= worksheet.rowCount; rowIdx++) {
        const row = worksheet.getRow(rowIdx)
        if (!row.hasValues) continue

        const dateVal = row.getCell(colMap.dateCol).value
        const narrativeVal = row.getCell(colMap.narrativeCol).text || String(row.getCell(colMap.narrativeCol).value || '')

        if (!dateVal && !narrativeVal) continue // Empty or footer row

        const txnDate = parseBankDate(dateVal)
        const rawNarrative = narrativeVal.trim()
        if (!rawNarrative) continue

        const refVal = colMap.refCol !== -1 ? (row.getCell(colMap.refCol).text || String(row.getCell(colMap.refCol).value || '')) : null
        const txnRef = refVal ? refVal.trim() : null

        const balanceVal = colMap.balanceCol !== -1 ? row.getCell(colMap.balanceCol).value : null
        const balanceAfter = balanceVal !== null && balanceVal !== undefined && String(balanceVal).trim() !== ''
            ? parseBankAmount(balanceVal)
            : null

        let amount = 0
        let txnType: 'CREDIT' | 'DEBIT' = 'CREDIT'

        if (colMap.creditCol !== -1 && colMap.debitCol !== -1) {
            const creditVal = row.getCell(colMap.creditCol).value
            const debitVal = row.getCell(colMap.debitCol).value

            const creditNum = parseBankAmount(creditVal)
            const debitNum = parseBankAmount(debitVal)

            if (creditNum > 0) {
                amount = creditNum
                txnType = 'CREDIT'
            } else if (debitNum > 0) {
                amount = debitNum
                txnType = 'DEBIT'
            } else {
                continue // 0 amount or summary row
            }
        } else if (colMap.amountCol !== -1) {
            const amountCell = row.getCell(colMap.amountCol).value
            const parsedNum = parseBankAmount(amountCell)
            if (parsedNum === 0) continue

            if (typeof amountCell === 'number') {
                txnType = amountCell >= 0 ? 'CREDIT' : 'DEBIT'
                amount = Math.abs(amountCell)
            } else {
                const str = String(amountCell).trim()
                txnType = str.startsWith('-') ? 'DEBIT' : 'CREDIT'
                amount = Math.abs(parsedNum)
            }
        } else if (colMap.creditCol !== -1) {
            amount = parseBankAmount(row.getCell(colMap.creditCol).value)
            txnType = 'CREDIT'
        }

        if (amount <= 0) continue

        if (txnType === 'CREDIT') {
            creditCount++
            totalCreditAmount += amount
        } else {
            debitCount++
            totalDebitAmount += amount
        }

        const txnHash = generateTxnHash(bankAccountId, txnDate, amount, balanceAfter, rawNarrative)

        transactions.push({
            txnDate,
            txnRef,
            txnType,
            amount,
            balanceAfter,
            rawNarrative,
            txnHash
        })
    }

    return {
        bankCodeDetected: 'AUTO_DETECTED',
        totalRowsParsed: transactions.length,
        creditCount,
        debitCount,
        totalCreditAmount,
        totalDebitAmount,
        transactions,
        errors
    }
}
