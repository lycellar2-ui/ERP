'use server'

import crypto from 'crypto'
import ExcelJS from 'exceljs'
import * as XLSX from 'xlsx'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, hasRole, hasPermission } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { revalidateCache } from '@/lib/cache'
import { generateNextDocCode } from '@/lib/doc-code'
import { getOrCreatePeriod, generatePaymentInJournal } from './actions'

export interface ParentAllocationPreview {
    invoiceId: string
    invoiceNo: string
    soNo: string | null
    branchId: string
    branchCode: string
    branchName: string
    dueDate: string
    totalAmount: number
    alreadyPaid: number
    outstanding: number
    allocatedAmount: number
}

export interface ParentPaymentPreviewRow {
    rowIndex: number
    customerKey: string
    customerNameInput: string
    paymentDate: string
    amount: number
    method: 'BANK_TRANSFER' | 'CASH' | 'COD' | 'LC' | 'TT_ADVANCE'
    reference: string
    notes: string
    importHash: string
    matchedCustomer: {
        id: string
        code: string
        name: string
        taxId: string | null
        childrenCount: number
        isChildResolvedToParent: boolean
        resolvedFromName?: string
        totalOpenAR: number
    } | null
    allocations: ParentAllocationPreview[]
    allocatedTotal: number
    unallocatedAmount: number
    isDuplicate: boolean
    error: string | null
}

export interface CommitParentPaymentRow {
    customerId: string
    paymentDate: string
    amount: number
    method: 'BANK_TRANSFER' | 'CASH' | 'COD' | 'LC' | 'TT_ADVANCE'
    reference: string
    notes: string
    importHash: string
    allocations: { invoiceId: string; amount: number }[]
}

export interface ParentPaymentBatchRow {
    id: string
    batchNo: string
    customerId: string
    customerCode: string
    customerName: string
    customerTaxId: string | null
    totalAmount: number
    allocatedAmount: number
    unallocatedAmount: number
    method: string
    paymentDate: string
    reference: string | null
    notes: string | null
    status: string
    createdByName: string | null
    createdAt: string
    payments: {
        id: string
        amount: number
        invoiceId: string
        invoiceNo: string
        branchCode: string
        branchName: string
    }[]
}

function normalizeText(val: unknown): string {
    return String(val ?? '').trim()
}

function normalizeKey(val: string): string {
    return val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
}

function parseExcelDate(val: unknown): Date | null {
    if (val instanceof Date && !Number.isNaN(val.getTime())) return val
    if (typeof val === 'number' && val > 20000 && val < 80000) {
        // Excel serial date
        const utcDays = Math.floor(val - 25569)
        return new Date(utcDays * 86400 * 1000)
    }
    const str = normalizeText(val)
    if (!str) return null
    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
    if (dmy) {
        const day = parseInt(dmy[1], 10)
        const month = parseInt(dmy[2], 10) - 1
        let year = parseInt(dmy[3], 10)
        if (year < 100) year += 2000
        const d = new Date(year, month, day)
        if (!Number.isNaN(d.getTime())) return d
    }
    const parsed = new Date(str)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseAmount(val: unknown): number {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0
    const raw = normalizeText(val).replace(/[^\d.-]/g, '')
    const num = Number(raw)
    return Number.isFinite(num) ? num : 0
}

function parseMethod(val: unknown): 'BANK_TRANSFER' | 'CASH' | 'COD' | 'LC' | 'TT_ADVANCE' {
    const s = normalizeKey(normalizeText(val))
    if (s.includes('tienmat') || s === 'cash' || s === 'tm') return 'CASH'
    if (s === 'cod') return 'COD'
    if (s === 'lc') return 'LC'
    if (s.includes('ttadvance') || s === 'tt') return 'TT_ADVANCE'
    return 'BANK_TRANSFER'
}

function buildImportHash(customerId: string, dateIso: string, amount: number, reference: string): string {
    return crypto
        .createHash('sha256')
        .update(`${customerId}|${dateIso.slice(0, 10)}|${Math.round(amount)}|${reference.trim().toLowerCase()}`)
        .digest('hex')
}

function checkFinancePermission(user: any): boolean {
    return (
        hasRole(user, 'CEO', 'ADMIN', 'TRO_LY', 'KE_TOAN', 'Kế Toán') ||
        hasPermission(user, 'FIN', 'CREATE') ||
        hasPermission(user, 'FIN', 'APPROVE')
    )
}

/**
 * Tải file Excel mẫu Bảng Kê Thu Tiền theo Công Ty Mẹ
 */
export async function downloadParentPaymentTemplate(): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
        await requireAuth()
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet('BangKeThuTien')

        ws.columns = [
            { header: 'Mã KH / MST', key: 'customerKey', width: 22 },
            { header: 'Tên Công Ty Mẹ', key: 'customerName', width: 34 },
            { header: 'Ngày Thu', key: 'paymentDate', width: 16 },
            { header: 'Số Tiền Thu', key: 'amount', width: 20 },
            { header: 'Phương Thức', key: 'method', width: 18 },
            { header: 'Số Chứng Từ', key: 'reference', width: 22 },
            { header: 'Ghi Chú', key: 'notes', width: 32 },
        ]

        const headerRow = ws.getRow(1)
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } }
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
        headerRow.height = 24

        // Sample rows from actual parent customers if available
        const sampleCustomers = await prisma.customer.findMany({
            where: { deletedAt: null, status: 'ACTIVE', children: { some: {} } },
            select: { code: true, name: true, taxId: true },
            take: 2,
        })

        const today = new Date()
        const dd = String(today.getDate()).padStart(2, '0')
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const yyyy = today.getFullYear()

        if (sampleCustomers.length > 0) {
            sampleCustomers.forEach((c, idx) => {
                ws.addRow({
                    customerKey: c.taxId || c.code,
                    customerName: c.name,
                    paymentDate: `${dd}/${mm}/${yyyy}`,
                    amount: idx === 0 ? 50000000 : 25000000,
                    method: 'BANK_TRANSFER',
                    reference: `PT-${yyyy}${mm}-00${idx + 1}`,
                    notes: 'Thu tiền công nợ tổng hợp các chi nhánh',
                })
            })
        } else {
            ws.addRow({
                customerKey: '0301234567',
                customerName: 'Công Ty Mẹ Mẫu (Ví dụ)',
                paymentDate: `${dd}/${mm}/${yyyy}`,
                amount: 50000000,
                method: 'BANK_TRANSFER',
                reference: `PT-${yyyy}${mm}-001`,
                notes: 'Có thể nhập Mã KH (CUS-...) hoặc MST hoặc Tên chính xác',
            })
        }

        ws.getColumn('amount').numFmt = '#,##0'

        const guide = wb.addWorksheet('HuongDan')
        guide.columns = [
            { header: 'Cột', key: 'col', width: 22 },
            { header: 'Bắt buộc', key: 'req', width: 12 },
            { header: 'Mô tả', key: 'desc', width: 65 },
        ]
        guide.addRows([
            { col: 'Mã KH / MST', req: 'Có', desc: 'Nhập Mã khách hàng (vd CUS-001) hoặc Mã số thuế của Công ty mẹ.' },
            { col: 'Tên Công Ty Mẹ', req: 'Không', desc: 'Dùng tham chiếu hoặc fallback khớp tên nếu không có Mã KH/MST.' },
            { col: 'Ngày Thu', req: 'Có', desc: 'Định dạng DD/MM/YYYY hoặc ô Date của Excel.' },
            { col: 'Số Tiền Thu', req: 'Có', desc: 'Số tiền VND lớn hơn 0.' },
            { col: 'Phương Thức', req: 'Không', desc: 'BANK_TRANSFER (mặc định), CASH / Tiền mặt, COD, LC, TT_ADVANCE.' },
            { col: 'Số Chứng Từ', req: 'Không', desc: 'Số phiếu thu / UNC bên kế toán để đối chiếu và chống import trùng.' },
            { col: 'Ghi Chú', req: 'Không', desc: 'Diễn giải thêm cho đợt thu tiền.' },
        ])

        const buf = await wb.xlsx.writeBuffer()
        return { success: true, data: Buffer.from(buf).toString('base64') }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi tạo file mẫu' }
    }
}

/**
 * Đọc & mô phỏng phân bổ Bảng Kê Thu Tiền theo Công Ty Mẹ (FIFO qua cụm Mẹ + Con)
 */
export async function previewParentPaymentImport(base64File: string): Promise<{
    success: boolean
    data?: ParentPaymentPreviewRow[]
    error?: string
}> {
    try {
        await requireAuth()
        const buffer = Buffer.from(base64File, 'base64')
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
        const firstSheet = workbook.SheetNames[0]
        if (!firstSheet) return { success: false, error: 'File Excel không có sheet dữ liệu' }

        const rawMatrix = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[firstSheet], { header: 1, defval: '' })
        if (rawMatrix.length < 2) {
            return { success: false, error: 'File không có dữ liệu (cần ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu)' }
        }

        // Auto-detect header row in first 10 rows
        let headerRowIdx = -1
        let colMap = { key: -1, name: -1, date: -1, amount: -1, method: -1, ref: -1, notes: -1 }

        for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
            const row = rawMatrix[r]
            if (!Array.isArray(row)) continue
            const candidate = { key: -1, name: -1, date: -1, amount: -1, method: -1, ref: -1, notes: -1 }
            row.forEach((cell, cIdx) => {
                const k = normalizeKey(normalizeText(cell))
                if (!k) return
                if (candidate.key === -1 && (k.includes('makh') || k === 'mst' || k.includes('masothue') || k.includes('customerkey') || k.includes('customercode') || k === 'taxid')) {
                    candidate.key = cIdx
                } else if (candidate.name === -1 && (k.includes('tencongty') || k.includes('khachhang') || k.includes('customername') || k === 'tenkh')) {
                    candidate.name = cIdx
                } else if (candidate.date === -1 && (k.includes('ngaythu') || k.includes('ngaytt') || k.includes('paymentdate') || k === 'ngay')) {
                    candidate.date = cIdx
                } else if (candidate.amount === -1 && (k.includes('sotien') || k.includes('tienthu') || k === 'amount' || k.includes('giatri'))) {
                    candidate.amount = cIdx
                } else if (candidate.method === -1 && (k.includes('phuongthuc') || k.includes('hinhthuc') || k === 'method')) {
                    candidate.method = cIdx
                } else if (candidate.ref === -1 && (k.includes('chungtu') || k.includes('thamchieu') || k.includes('sophieu') || k === 'reference' || k === 'ref')) {
                    candidate.ref = cIdx
                } else if (candidate.notes === -1 && (k.includes('ghichu') || k.includes('diengiai') || k === 'notes' || k === 'note')) {
                    candidate.notes = cIdx
                }
            })

            if (candidate.amount !== -1 && (candidate.key !== -1 || candidate.name !== -1)) {
                headerRowIdx = r
                colMap = candidate
                break
            }
        }

        if (headerRowIdx === -1) {
            return {
                success: false,
                error: 'Không nhận diện được cột tiêu đề. Vui lòng dùng file mẫu có các cột: Mã KH / MST, Ngày Thu, Số Tiền Thu.',
            }
        }

        // Load all active customers with parent/children relations
        const allCustomers = await prisma.customer.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                taxId: true,
                parentId: true,
                children: { select: { id: true } },
            },
        })

        const byId = new Map(allCustomers.map(c => [c.id, c]))
        const byCode = new Map<string, (typeof allCustomers)[0]>()
        const byTaxId = new Map<string, (typeof allCustomers)[0]>()
        const byName = new Map<string, (typeof allCustomers)[0]>()

        for (const c of allCustomers) {
            if (c.code) byCode.set(c.code.trim().toLowerCase(), c)
            if (c.taxId) byTaxId.set(c.taxId.trim().toLowerCase(), c)
            if (c.name) byName.set(normalizeKey(c.name), c)
            if (c.shortName) byName.set(normalizeKey(c.shortName), c)
        }

        // Load all open AR invoices
        const openInvoices = await prisma.aRInvoice.findMany({
            where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
            include: {
                customer: { select: { id: true, code: true, name: true } },
                so: { select: { soNo: true } },
                payments: { select: { amount: true } },
            },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        })

        // Track remaining open balance per invoice across rows in the same file
        const remainingByInvId = new Map<string, number>()
        for (const inv of openInvoices) {
            const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
            const total = Number(inv.totalAmount ?? inv.amount)
            remainingByInvId.set(inv.id, Math.max(0, total - paid))
        }

        const existingBatches = await prisma.aRPaymentBatch.findMany({
            where: { status: { not: 'REVERSED' }, importHash: { not: null } },
            select: { importHash: true },
        })
        const existingHashes = new Set(existingBatches.map(b => b.importHash).filter(Boolean) as string[])
        const seenInFile = new Set<string>()

        const previewRows: ParentPaymentPreviewRow[] = []

        for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
            const row = rawMatrix[r]
            if (!Array.isArray(row)) continue

            const customerKey = colMap.key !== -1 ? normalizeText(row[colMap.key]) : ''
            const customerNameInput = colMap.name !== -1 ? normalizeText(row[colMap.name]) : ''
            const amount = parseAmount(row[colMap.amount])
            const parsedDate = colMap.date !== -1 ? parseExcelDate(row[colMap.date]) : new Date()
            const method = colMap.method !== -1 ? parseMethod(row[colMap.method]) : 'BANK_TRANSFER'
            const reference = colMap.ref !== -1 ? normalizeText(row[colMap.ref]) : ''
            const notes = colMap.notes !== -1 ? normalizeText(row[colMap.notes]) : ''

            // Skip completely blank rows
            if (!customerKey && !customerNameInput && amount === 0) continue

            const keyLower = customerKey.toLowerCase()
            let matched =
                (keyLower && (byCode.get(keyLower) || byTaxId.get(keyLower))) ||
                (customerNameInput && byName.get(normalizeKey(customerNameInput))) ||
                (customerKey && byName.get(normalizeKey(customerKey))) ||
                null

            let isChildResolvedToParent = false
            let resolvedFromName: string | undefined

            if (matched && matched.parentId) {
                const parent = byId.get(matched.parentId)
                if (parent) {
                    isChildResolvedToParent = true
                    resolvedFromName = matched.name
                    matched = parent
                }
            }

            if (!matched) {
                previewRows.push({
                    rowIndex: r + 1,
                    customerKey,
                    customerNameInput,
                    paymentDate: (parsedDate ?? new Date()).toISOString(),
                    amount,
                    method,
                    reference,
                    notes,
                    importHash: '',
                    matchedCustomer: null,
                    allocations: [],
                    allocatedTotal: 0,
                    unallocatedAmount: amount,
                    isDuplicate: false,
                    error: `Không tìm thấy khách hàng khớp "${customerKey || customerNameInput}"`,
                })
                continue
            }

            if (!parsedDate) {
                previewRows.push({
                    rowIndex: r + 1,
                    customerKey,
                    customerNameInput,
                    paymentDate: new Date().toISOString(),
                    amount,
                    method,
                    reference,
                    notes,
                    importHash: '',
                    matchedCustomer: null,
                    allocations: [],
                    allocatedTotal: 0,
                    unallocatedAmount: amount,
                    isDuplicate: false,
                    error: 'Ngày thu không hợp lệ',
                })
                continue
            }

            if (amount <= 0) {
                previewRows.push({
                    rowIndex: r + 1,
                    customerKey,
                    customerNameInput,
                    paymentDate: parsedDate.toISOString(),
                    amount,
                    method,
                    reference,
                    notes,
                    importHash: '',
                    matchedCustomer: null,
                    allocations: [],
                    allocatedTotal: 0,
                    unallocatedAmount: 0,
                    isDuplicate: false,
                    error: 'Số tiền thu phải lớn hơn 0',
                })
                continue
            }

            const importHash = buildImportHash(matched.id, parsedDate.toISOString(), amount, reference)
            const isDuplicate = existingHashes.has(importHash) || seenInFile.has(importHash)
            seenInFile.add(importHash)

            const clusterIds = new Set([matched.id, ...matched.children.map(ch => ch.id)])
            const clusterOpenInvoices = openInvoices.filter(
                inv => clusterIds.has(inv.customerId) && (remainingByInvId.get(inv.id) ?? 0) > 0
            )

            const totalOpenAR = clusterOpenInvoices.reduce(
                (sum, inv) => sum + (remainingByInvId.get(inv.id) ?? 0),
                0
            )

            const allocations: ParentAllocationPreview[] = []
            let remainingToAllocate = amount

            if (!isDuplicate) {
                for (const inv of clusterOpenInvoices) {
                    if (remainingToAllocate <= 0) break
                    const invOpen = remainingByInvId.get(inv.id) ?? 0
                    if (invOpen <= 0) continue

                    const alloc = Math.min(remainingToAllocate, invOpen)
                    remainingByInvId.set(inv.id, invOpen - alloc)
                    remainingToAllocate -= alloc

                    const total = Number(inv.totalAmount ?? inv.amount)
                    allocations.push({
                        invoiceId: inv.id,
                        invoiceNo: inv.invoiceNo,
                        soNo: inv.so?.soNo ?? null,
                        branchId: inv.customer.id,
                        branchCode: inv.customer.code,
                        branchName: inv.customer.name,
                        dueDate: inv.dueDate.toISOString(),
                        totalAmount: total,
                        alreadyPaid: total - invOpen,
                        outstanding: invOpen,
                        allocatedAmount: alloc,
                    })
                }
            }

            const allocatedTotal = allocations.reduce((s, a) => s + a.allocatedAmount, 0)

            previewRows.push({
                rowIndex: r + 1,
                customerKey,
                customerNameInput,
                paymentDate: parsedDate.toISOString(),
                amount,
                method,
                reference,
                notes,
                importHash,
                matchedCustomer: {
                    id: matched.id,
                    code: matched.code,
                    name: matched.name,
                    taxId: matched.taxId,
                    childrenCount: matched.children.length,
                    isChildResolvedToParent,
                    resolvedFromName,
                    totalOpenAR,
                },
                allocations,
                allocatedTotal,
                unallocatedAmount: Math.max(0, amount - allocatedTotal),
                isDuplicate,
                error: isDuplicate ? 'Dòng này đã được import trước đó (trùng Mã KH + Ngày + Số tiền + Số CT)' : null,
            })
        }

        return { success: true, data: JSON.parse(JSON.stringify(previewRows)) }
    } catch (err: any) {
        console.error('[previewParentPaymentImport] Error:', err)
        return { success: false, error: err.message || 'Lỗi đọc file Excel bảng kê thu tiền' }
    }
}

/**
 * Xác nhận ghi sổ Bảng Kê Thu Tiền theo Công Ty Mẹ (tạo ARPaymentBatch + ARPayment + JournalEntry)
 */
export async function commitParentPaymentImport(rows: CommitParentPaymentRow[]): Promise<{
    success: boolean
    data?: { batchesCreated: number; paymentsCreated: number; totalAmount: number }
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!checkFinancePermission(user)) {
            return { success: false, error: 'Bạn không có quyền ghi nhận thanh toán tài chính' }
        }

        if (!rows || rows.length === 0) {
            return { success: false, error: 'Không có dòng hợp lệ để ghi sổ' }
        }

        let batchesCreated = 0
        let paymentsCreated = 0
        let totalAmount = 0

        for (const row of rows) {
            const payDate = new Date(row.paymentDate)
            // Check period not closed
            await getOrCreatePeriod(payDate.getFullYear(), payDate.getMonth() + 1)

            const batchNo = await generateNextDocCode(prisma.aRPaymentBatch, 'batchNo', 'PTG-', 6)

            const result = await prisma.$transaction(async tx => {
                // Re-check duplicate inside transaction
                if (row.importHash) {
                    const dup = await tx.aRPaymentBatch.findUnique({ where: { importHash: row.importHash } })
                    if (dup && dup.status !== 'REVERSED') {
                        throw new Error(`Chứng từ tham chiếu "${row.reference || batchNo}" đã được import trước đó.`)
                    }
                }

                let allocatedSum = 0
                const validAllocations: { invoiceId: string; amount: number; invoiceNo: string; soId: string | null; newStatus: 'PAID' | 'PARTIALLY_PAID'; newPaid: number }[] = []

                for (const alloc of row.allocations) {
                    if (alloc.amount <= 0) continue
                    const inv = await tx.aRInvoice.findUnique({
                        where: { id: alloc.invoiceId },
                        include: { payments: { select: { amount: true } } },
                    })
                    if (!inv) continue

                    const alreadyPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
                    const invTotal = Number(inv.totalAmount ?? inv.amount)
                    const outstanding = Math.max(0, invTotal - alreadyPaid)
                    const actualAlloc = Math.min(alloc.amount, outstanding)
                    if (actualAlloc <= 0) continue

                    const newPaid = alreadyPaid + actualAlloc
                    const newStatus = newPaid >= invTotal ? 'PAID' : 'PARTIALLY_PAID'

                    allocatedSum += actualAlloc
                    validAllocations.push({
                        invoiceId: inv.id,
                        amount: actualAlloc,
                        invoiceNo: inv.invoiceNo,
                        soId: inv.soId,
                        newStatus,
                        newPaid,
                    })
                }

                const unallocated = Math.max(0, row.amount - allocatedSum)
                const batchStatus = unallocated > 0 ? 'PARTIALLY_ALLOCATED' : 'POSTED'

                const batch = await tx.aRPaymentBatch.create({
                    data: {
                        batchNo,
                        customerId: row.customerId,
                        totalAmount: row.amount,
                        allocatedAmount: allocatedSum,
                        unallocatedAmount: unallocated,
                        method: row.method,
                        paymentDate: payDate,
                        reference: row.reference || null,
                        notes: row.notes || null,
                        importHash: row.importHash || null,
                        status: batchStatus,
                        createdById: user.id,
                    },
                })

                const createdPayments: { id: string; amount: number; invoiceNo: string }[] = []

                for (const item of validAllocations) {
                    const payment = await tx.aRPayment.create({
                        data: {
                            invoiceId: item.invoiceId,
                            batchId: batch.id,
                            amount: item.amount,
                            method: row.method,
                            reference: row.reference || batchNo,
                            notes: row.notes || `Phân bổ từ phiếu thu Cty Mẹ ${batchNo}`,
                            paymentDate: payDate,
                            paidAt: payDate,
                        },
                    })

                    await tx.aRInvoice.update({
                        where: { id: item.invoiceId },
                        data: {
                            paidAmount: item.newPaid,
                            status: item.newStatus,
                        },
                    })

                    if (item.newStatus === 'PAID' && item.soId) {
                        await tx.salesOrder.update({
                            where: { id: item.soId },
                            data: { status: 'PAID' },
                        })
                    }

                    createdPayments.push({ id: payment.id, amount: item.amount, invoiceNo: item.invoiceNo })
                }

                return { batch, createdPayments }
            })

            // Generate GL Journal Entries (DR 112 / CR 131) for each allocated ARPayment
            for (const p of result.createdPayments) {
                await generatePaymentInJournal(p.id, p.amount, p.invoiceNo, user.id)
            }

            await logAudit({
                userId: user.id,
                action: 'CREATE',
                entityType: 'ARPaymentBatch',
                entityId: result.batch.id,
                newValue: {
                    batchNo: result.batch.batchNo,
                    customerId: row.customerId,
                    totalAmount: row.amount,
                    paymentsCount: result.createdPayments.length,
                },
            })

            batchesCreated++
            paymentsCreated += result.createdPayments.length
            totalAmount += row.amount
        }

        revalidateCache('finance')
        revalidateCache('sales')
        revalidateCache('customers')
        revalidatePath('/dashboard/finance')
        revalidatePath('/dashboard/sales')

        return {
            success: true,
            data: { batchesCreated, paymentsCreated, totalAmount },
        }
    } catch (err: any) {
        console.error('[commitParentPaymentImport] Error:', err)
        return { success: false, error: err.message || 'Lỗi ghi sổ bảng kê thu tiền' }
    }
}

/**
 * Lấy danh sách các lô Phiếu Thu Công Ty Mẹ đã import
 */
export async function getParentPaymentBatches(): Promise<{
    success: boolean
    data?: ParentPaymentBatchRow[]
    error?: string
}> {
    try {
        await requireAuth()
        const batches = await prisma.aRPaymentBatch.findMany({
            include: {
                customer: { select: { id: true, code: true, name: true, taxId: true } },
                createdBy: { select: { name: true } },
                payments: {
                    include: {
                        invoice: {
                            select: {
                                id: true,
                                invoiceNo: true,
                                customer: { select: { code: true, name: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        })

        const formatted: ParentPaymentBatchRow[] = batches.map(b => ({
            id: b.id,
            batchNo: b.batchNo,
            customerId: b.customerId,
            customerCode: b.customer.code,
            customerName: b.customer.name,
            customerTaxId: b.customer.taxId,
            totalAmount: Number(b.totalAmount),
            allocatedAmount: Number(b.allocatedAmount),
            unallocatedAmount: Number(b.unallocatedAmount),
            method: b.method,
            paymentDate: b.paymentDate.toISOString(),
            reference: b.reference,
            notes: b.notes,
            status: b.status,
            createdByName: b.createdBy?.name ?? null,
            createdAt: b.createdAt.toISOString(),
            payments: b.payments.map(p => ({
                id: p.id,
                amount: Number(p.amount),
                invoiceId: p.invoice.id,
                invoiceNo: p.invoice.invoiceNo,
                branchCode: p.invoice.customer.code,
                branchName: p.invoice.customer.name,
            })),
        }))

        return { success: true, data: JSON.parse(JSON.stringify(formatted)) }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi tải lịch sử phiếu thu công ty mẹ' }
    }
}

/**
 * Phân bổ tiếp phần tiền dư (unallocatedAmount) của Phiếu Thu Công Ty Mẹ vào các hóa đơn mới phát sinh
 */
export async function allocateUnallocatedBatch(batchId: string): Promise<{
    success: boolean
    data?: { allocatedNow: number; paymentsCreated: number }
    error?: string
}> {
    try {
        const user = await requireAuth()
        if (!checkFinancePermission(user)) {
            return { success: false, error: 'Bạn không có quyền phân bổ thanh toán' }
        }

        const batch = await prisma.aRPaymentBatch.findUnique({
            where: { id: batchId },
            include: { customer: { include: { children: { select: { id: true } } } } },
        })
        if (!batch) return { success: false, error: 'Không tìm thấy phiếu thu' }
        if (batch.status === 'REVERSED') return { success: false, error: 'Phiếu thu đã bị hoàn tác' }

        const unallocated = Number(batch.unallocatedAmount)
        if (unallocated <= 0) return { success: false, error: 'Phiếu thu không còn số dư chưa phân bổ' }

        const now = new Date()
        await getOrCreatePeriod(now.getFullYear(), now.getMonth() + 1)

        const clusterIds = [batch.customerId, ...batch.customer.children.map(c => c.id)]
        const openInvoices = await prisma.aRInvoice.findMany({
            where: {
                customerId: { in: clusterIds },
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
            },
            include: { payments: { select: { amount: true } } },
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        })

        if (openInvoices.length === 0) {
            return { success: false, error: 'Hiện không có hóa đơn nào đang mở của Công ty mẹ / chi nhánh con' }
        }

        const result = await prisma.$transaction(async tx => {
            let remaining = unallocated
            let allocatedNow = 0
            const createdPayments: { id: string; amount: number; invoiceNo: string }[] = []

            for (const inv of openInvoices) {
                if (remaining <= 0) break
                const alreadyPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
                const invTotal = Number(inv.totalAmount ?? inv.amount)
                const outstanding = Math.max(0, invTotal - alreadyPaid)
                if (outstanding <= 0) continue

                const alloc = Math.min(remaining, outstanding)
                const newPaid = alreadyPaid + alloc
                const newStatus = newPaid >= invTotal ? 'PAID' : 'PARTIALLY_PAID'

                const p = await tx.aRPayment.create({
                    data: {
                        invoiceId: inv.id,
                        batchId: batch.id,
                        amount: alloc,
                        method: batch.method,
                        reference: batch.reference || batch.batchNo,
                        notes: `Phân bổ tiền dư từ phiếu thu ${batch.batchNo}`,
                        paymentDate: now,
                        paidAt: now,
                    },
                })

                await tx.aRInvoice.update({
                    where: { id: inv.id },
                    data: { paidAmount: newPaid, status: newStatus },
                })

                if (newStatus === 'PAID' && inv.soId) {
                    await tx.salesOrder.update({ where: { id: inv.soId }, data: { status: 'PAID' } })
                }

                remaining -= alloc
                allocatedNow += alloc
                createdPayments.push({ id: p.id, amount: alloc, invoiceNo: inv.invoiceNo })
            }

            if (allocatedNow === 0) {
                throw new Error('Không phân bổ được vào hóa đơn nào')
            }

            const newAllocatedTotal = Number(batch.allocatedAmount) + allocatedNow
            const newUnallocated = Math.max(0, Number(batch.totalAmount) - newAllocatedTotal)

            await tx.aRPaymentBatch.update({
                where: { id: batch.id },
                data: {
                    allocatedAmount: newAllocatedTotal,
                    unallocatedAmount: newUnallocated,
                    status: newUnallocated > 0 ? 'PARTIALLY_ALLOCATED' : 'POSTED',
                },
            })

            return { allocatedNow, createdPayments }
        })

        for (const p of result.createdPayments) {
            await generatePaymentInJournal(p.id, p.amount, p.invoiceNo, user.id)
        }

        revalidateCache('finance')
        revalidateCache('sales')
        revalidatePath('/dashboard/finance')

        return {
            success: true,
            data: { allocatedNow: result.allocatedNow, paymentsCreated: result.createdPayments.length },
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi phân bổ tiền dư' }
    }
}

/**
 * Hoàn tác (Rollback) toàn bộ một Phiếu Thu Công Ty Mẹ và khôi phục công nợ các hóa đơn con
 */
export async function reverseParentPaymentBatch(batchId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requireAuth()
        if (!checkFinancePermission(user)) {
            return { success: false, error: 'Bạn không có quyền hoàn tác thanh toán' }
        }

        const batch = await prisma.aRPaymentBatch.findUnique({
            where: { id: batchId },
            include: { payments: true },
        })
        if (!batch) return { success: false, error: 'Không tìm thấy phiếu thu' }
        if (batch.status === 'REVERSED') return { success: false, error: 'Phiếu thu đã được hoàn tác trước đó' }

        await prisma.$transaction(async tx => {
            const touchedInvoiceIds = Array.from(new Set(batch.payments.map(p => p.invoiceId)))

            await tx.aRPayment.deleteMany({ where: { batchId: batch.id } })

            for (const invId of touchedInvoiceIds) {
                const inv = await tx.aRInvoice.findUnique({
                    where: { id: invId },
                    include: { payments: { select: { amount: true } } },
                })
                if (!inv) continue

                const remainingPaid = inv.payments.reduce((s, p) => s + Number(p.amount), 0)
                const invTotal = Number(inv.totalAmount ?? inv.amount)
                const isOverdue = inv.dueDate < new Date()
                const restoredStatus =
                    remainingPaid >= invTotal
                        ? 'PAID'
                        : remainingPaid > 0
                        ? 'PARTIALLY_PAID'
                        : isOverdue
                        ? 'OVERDUE'
                        : 'UNPAID'

                await tx.aRInvoice.update({
                    where: { id: invId },
                    data: { paidAmount: remainingPaid, status: restoredStatus },
                })

                if (restoredStatus !== 'PAID' && inv.soId) {
                    await tx.salesOrder.update({
                        where: { id: inv.soId },
                        data: { status: 'INVOICED' },
                    })
                }
            }

            await tx.aRPaymentBatch.update({
                where: { id: batch.id },
                data: {
                    status: 'REVERSED',
                    importHash: null, // Allow re-importing after rollback
                },
            })
        })

        await logAudit({
            userId: user.id,
            action: 'STATUS_CHANGE',
            entityType: 'ARPaymentBatch',
            entityId: batch.id,
            oldValue: { batchNo: batch.batchNo, totalAmount: Number(batch.totalAmount) },
        })

        revalidateCache('finance')
        revalidateCache('sales')
        revalidatePath('/dashboard/finance')

        return { success: true }
    } catch (err: any) {
        console.error('[reverseParentPaymentBatch] Error:', err)
        return { success: false, error: err.message || 'Lỗi hoàn tác phiếu thu' }
    }
}
