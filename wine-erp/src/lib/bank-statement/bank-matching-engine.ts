export interface OpenInvoiceCandidate {
    id: string
    invoiceNo: string
    customerId: string
    customerName: string
    customerCode: string
    totalAmount: number
    paidAmount: number
    remainingAmount: number
    orderNo: string
    soId: string
    dueDate: Date
}

export interface RuleCandidate {
    keyword: string
    customerId: string
    customerName: string
}

export interface CustomerCandidate {
    id: string
    code: string
    name: string
    taxId?: string | null
    phone?: string | null
}

export interface MatchSuggestion {
    confidenceScore: number
    suggestedReason: string
    matchedCustomerId: string | null
    matchedCustomerName: string | null
    suggestedAllocations: {
        invoiceId: string
        invoiceNo: string
        orderNo: string
        remainingAmount: number
        allocatedAmount: number
        feeDifference: number
    }[]
}

/**
 * Remove Vietnamese accents and special characters for fuzzy matching
 */
export function normalizeVietnamese(str: string): string {
    if (!str) return ''
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Extract Order / Invoice numbers from raw narrative
 * Examples: "SO-2026-0042", "SO0042", "DH-0042", "HD-0012", "INV-0012"
 */
export function extractDocCodes(narrative: string): { orderCodes: string[]; invoiceCodes: string[] } {
    const clean = narrative.toUpperCase()
    const orderCodes: string[] = []
    const invoiceCodes: string[] = []

    // Matches SO-2026-0001, SO20260001, SO-0042, SO0042, DH-2026-0042, DH0042
    const soMatches = clean.match(/(?:SO|DH)[-_]?(?:\d{4}[-_])?\d{3,8}/g)
    if (soMatches) {
        for (const m of soMatches) {
            orderCodes.push(m.replace(/[-_]/g, ''))
        }
    }

    // Matches HD-2026-0012, HD0012, INV-2026-0012, INV-0012
    const invMatches = clean.match(/(?:HD|INV)[-_]?(?:\d{4}[-_])?\d{3,8}/g)
    if (invMatches) {
        for (const m of invMatches) {
            invoiceCodes.push(m.replace(/[-_]/g, ''))
        }
    }

    return { orderCodes, invoiceCodes }
}

/**
 * Subset Sum finder: finds a combination of 2 or 3 invoices that sum to targetAmount (tolerance <= 10.000 VND)
 */
function findSubsetSumCombination(
    invoices: OpenInvoiceCandidate[],
    targetAmount: number,
    tolerance: number = 10000
): OpenInvoiceCandidate[] | null {
    // Check 2 invoices combination
    for (let i = 0; i < invoices.length; i++) {
        for (let j = i + 1; j < invoices.length; j++) {
            const sum = invoices[i].remainingAmount + invoices[j].remainingAmount
            if (Math.abs(sum - targetAmount) <= tolerance) {
                return [invoices[i], invoices[j]]
            }
        }
    }

    // Check 3 invoices combination
    if (invoices.length >= 3) {
        for (let i = 0; i < invoices.length; i++) {
            for (let j = i + 1; j < invoices.length; j++) {
                for (let k = j + 1; k < invoices.length; k++) {
                    const sum = invoices[i].remainingAmount + invoices[j].remainingAmount + invoices[k].remainingAmount
                    if (Math.abs(sum - targetAmount) <= tolerance) {
                        return [invoices[i], invoices[j], invoices[k]]
                    }
                }
            }
        }
    }

    return null
}

/**
 * Run heuristic and fuzzy matching on a transaction against candidate data
 */
export function matchBankTransaction(
    rawNarrative: string,
    amount: number,
    openInvoices: OpenInvoiceCandidate[],
    rules: RuleCandidate[],
    customers: CustomerCandidate[]
): MatchSuggestion {
    const normalizedNarrative = normalizeVietnamese(rawNarrative)
    const { orderCodes, invoiceCodes } = extractDocCodes(rawNarrative)

    // -------------------------------------------------------------
    // PRIORITY 1: EXACT MATCH VIA ORDER / INVOICE CODE
    // -------------------------------------------------------------
    if (orderCodes.length > 0 || invoiceCodes.length > 0) {
        for (const inv of openInvoices) {
            const cleanInvNo = inv.invoiceNo.toUpperCase().replace(/[-_]/g, '')
            const cleanOrderNo = inv.orderNo.toUpperCase().replace(/[-_]/g, '')

            const isCodeMatch = orderCodes.some(c => cleanOrderNo === c || (c.length >= 8 && cleanOrderNo.includes(c))) ||
                invoiceCodes.some(c => cleanInvNo === c || (c.length >= 8 && cleanInvNo.includes(c)))

            if (isCodeMatch) {
                const diff = inv.remainingAmount - amount

                // Exact amount
                if (Math.abs(diff) === 0) {
                    return {
                        confidenceScore: 100,
                        suggestedReason: `Khớp chính xác mã đơn ${inv.orderNo} và số tiền 100%`,
                        matchedCustomerId: inv.customerId,
                        matchedCustomerName: inv.customerName,
                        suggestedAllocations: [{
                            invoiceId: inv.id,
                            invoiceNo: inv.invoiceNo,
                            orderNo: inv.orderNo,
                            remainingAmount: inv.remainingAmount,
                            allocatedAmount: amount,
                            feeDifference: 0
                        }]
                    }
                }

                // Bank fee difference (<= 10.000 VND)
                if (Math.abs(diff) <= 10000 && diff > 0) {
                    return {
                        confidenceScore: 95,
                        suggestedReason: `Khớp mã đơn ${inv.orderNo}, chênh lệch phí ngân hàng ${diff.toLocaleString('vi-VN')} đ`,
                        matchedCustomerId: inv.customerId,
                        matchedCustomerName: inv.customerName,
                        suggestedAllocations: [{
                            invoiceId: inv.id,
                            invoiceNo: inv.invoiceNo,
                            orderNo: inv.orderNo,
                            remainingAmount: inv.remainingAmount,
                            allocatedAmount: amount,
                            feeDifference: diff
                        }]
                    }
                }

                // Partial payment / deposit (< remainingAmount)
                if (amount < inv.remainingAmount) {
                    return {
                        confidenceScore: 90,
                        suggestedReason: `Khớp mã đơn ${inv.orderNo} (Thanh toán đợt / Cọc ${Math.round((amount / inv.totalAmount) * 100)}%)`,
                        matchedCustomerId: inv.customerId,
                        matchedCustomerName: inv.customerName,
                        suggestedAllocations: [{
                            invoiceId: inv.id,
                            invoiceNo: inv.invoiceNo,
                            orderNo: inv.orderNo,
                            remainingAmount: inv.remainingAmount,
                            allocatedAmount: amount,
                            feeDifference: 0
                        }]
                    }
                }

                // Overpayment (> remainingAmount)
                return {
                    confidenceScore: 85,
                    suggestedReason: `Khớp mã đơn ${inv.orderNo} nhưng số tiền chuyển thừa ${(amount - inv.remainingAmount).toLocaleString('vi-VN')} đ`,
                    matchedCustomerId: inv.customerId,
                    matchedCustomerName: inv.customerName,
                    suggestedAllocations: [{
                        invoiceId: inv.id,
                        invoiceNo: inv.invoiceNo,
                        orderNo: inv.orderNo,
                        remainingAmount: inv.remainingAmount,
                        allocatedAmount: inv.remainingAmount,
                        feeDifference: 0
                    }]
                }
            }
        }
    }

    // -------------------------------------------------------------
    // PRIORITY 2: CHECK MEMORY RULES (Learned from Accountant)
    // -------------------------------------------------------------
    let identifiedCustomer: CustomerCandidate | null = null
    let ruleMatchedReason = ''

    for (const rule of rules) {
        const normKeyword = normalizeVietnamese(rule.keyword)
        if (normKeyword && normalizedNarrative.includes(normKeyword)) {
            const cust = customers.find(c => c.id === rule.customerId)
            if (cust) {
                identifiedCustomer = cust
                ruleMatchedReason = `Nhận diện theo quy tắc nhớ từ khóa: "${rule.keyword}"`
                break
            }
        }
    }

    // -------------------------------------------------------------
    // PRIORITY 3: CUSTOMER NAME / TAX ID / PHONE SEARCH
    // -------------------------------------------------------------
    if (!identifiedCustomer) {
        for (const cust of customers) {
            // Check Tax ID
            if (cust.taxId && rawNarrative.includes(cust.taxId.trim())) {
                identifiedCustomer = cust
                ruleMatchedReason = `Khớp mã số thuế khách hàng (${cust.taxId})`
                break
            }

            // Check Phone
            if (cust.phone && cust.phone.length >= 9 && rawNarrative.includes(cust.phone.trim())) {
                identifiedCustomer = cust
                ruleMatchedReason = `Khớp số điện thoại khách hàng (${cust.phone})`
                break
            }

            // Check normalized customer name (minimum 5 chars to prevent false positives)
            const normName = normalizeVietnamese(cust.name)
            if (normName.length >= 6 && normalizedNarrative.includes(normName)) {
                identifiedCustomer = cust
                ruleMatchedReason = `Khớp tên khách hàng: "${cust.name}"`
                break
            }

            // Check customer code (e.g. KH001, KH-0042)
            const cleanCode = cust.code.toUpperCase().replace(/[-_]/g, '')
            if (cleanCode.length >= 4 && rawNarrative.toUpperCase().replace(/[-_]/g, '').includes(cleanCode)) {
                identifiedCustomer = cust
                ruleMatchedReason = `Khớp mã khách hàng (${cust.code})`
                break
            }
        }
    }

    // If customer is identified, evaluate their open invoices
    if (identifiedCustomer) {
        const custInvoices = openInvoices.filter(i => i.customerId === identifiedCustomer!.id)

        // Case A: Customer has exactly one invoice with exact amount match
        const exactAmountInv = custInvoices.find(i => Math.abs(i.remainingAmount - amount) === 0)
        if (exactAmountInv) {
            return {
                confidenceScore: 90,
                suggestedReason: `${ruleMatchedReason} + Trùng khớp số tiền đơn ${exactAmountInv.orderNo}`,
                matchedCustomerId: identifiedCustomer.id,
                matchedCustomerName: identifiedCustomer.name,
                suggestedAllocations: [{
                    invoiceId: exactAmountInv.id,
                    invoiceNo: exactAmountInv.invoiceNo,
                    orderNo: exactAmountInv.orderNo,
                    remainingAmount: exactAmountInv.remainingAmount,
                    allocatedAmount: amount,
                    feeDifference: 0
                }]
            }
        }

        // Case B: Subset Sum (Batch Payment for 2-3 orders)
        if (custInvoices.length >= 2) {
            const combination = findSubsetSumCombination(custInvoices, amount, 10000)
            if (combination) {
                const totalComb = combination.reduce((s, c) => s + c.remainingAmount, 0)
                const feeDiff = Math.max(0, totalComb - amount)
                return {
                    confidenceScore: 85,
                    suggestedReason: `${ruleMatchedReason} + Thanh toán gộp ${combination.length} đơn: ${combination.map(c => c.orderNo).join(', ')}`,
                    matchedCustomerId: identifiedCustomer.id,
                    matchedCustomerName: identifiedCustomer.name,
                    suggestedAllocations: combination.map((c, idx) => ({
                        invoiceId: c.id,
                        invoiceNo: c.invoiceNo,
                        orderNo: c.orderNo,
                        remainingAmount: c.remainingAmount,
                        allocatedAmount: idx === combination.length - 1 ? c.remainingAmount - feeDiff : c.remainingAmount,
                        feeDifference: idx === combination.length - 1 ? feeDiff : 0
                    }))
                }
            }
        }

        // Case C: Single open invoice exists, but partial payment
        if (custInvoices.length === 1 && amount < custInvoices[0].remainingAmount) {
            const singleInv = custInvoices[0]
            return {
                confidenceScore: 80,
                suggestedReason: `${ruleMatchedReason} + Đề xuất thanh toán đợt cho đơn duy nhất còn mở ${singleInv.orderNo}`,
                matchedCustomerId: identifiedCustomer.id,
                matchedCustomerName: identifiedCustomer.name,
                suggestedAllocations: [{
                    invoiceId: singleInv.id,
                    invoiceNo: singleInv.invoiceNo,
                    orderNo: singleInv.orderNo,
                    remainingAmount: singleInv.remainingAmount,
                    allocatedAmount: amount,
                    feeDifference: 0
                }]
            }
        }

        // Case D: Multiple open invoices, suggest allocation to oldest invoice (FIFO debt collection)
        if (custInvoices.length > 0) {
            const oldestInv = custInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
            const alloc = Math.min(amount, oldestInv.remainingAmount)
            return {
                confidenceScore: 75,
                suggestedReason: `${ruleMatchedReason} + Đề xuất phân bổ đơn nợ đến hạn sớm nhất ${oldestInv.orderNo}`,
                matchedCustomerId: identifiedCustomer.id,
                matchedCustomerName: identifiedCustomer.name,
                suggestedAllocations: [{
                    invoiceId: oldestInv.id,
                    invoiceNo: oldestInv.invoiceNo,
                    orderNo: oldestInv.orderNo,
                    remainingAmount: oldestInv.remainingAmount,
                    allocatedAmount: alloc,
                    feeDifference: 0
                }]
            }
        }
    }

    // -------------------------------------------------------------
    // PRIORITY 4: GLOBAL UNIQUE AMOUNT MATCH (Fallback)
    // -------------------------------------------------------------
    const matchingInvoicesByAmount = openInvoices.filter(i => Math.abs(i.remainingAmount - amount) === 0)
    if (matchingInvoicesByAmount.length === 1) {
        const uniqueInv = matchingInvoicesByAmount[0]
        return {
            confidenceScore: 70,
            suggestedReason: `Số tiền khớp duy nhất với đơn ${uniqueInv.orderNo} của KH ${uniqueInv.customerName}`,
            matchedCustomerId: uniqueInv.customerId,
            matchedCustomerName: uniqueInv.customerName,
            suggestedAllocations: [{
                invoiceId: uniqueInv.id,
                invoiceNo: uniqueInv.invoiceNo,
                orderNo: uniqueInv.orderNo,
                remainingAmount: uniqueInv.remainingAmount,
                allocatedAmount: amount,
                feeDifference: 0
            }]
        }
    }

    // -------------------------------------------------------------
    // PRIORITY 5: UNMATCHED
    // -------------------------------------------------------------
    return {
        confidenceScore: 30,
        suggestedReason: 'Chưa nhận diện được đơn hàng hoặc khách hàng từ nội dung',
        matchedCustomerId: null,
        matchedCustomerName: null,
        suggestedAllocations: []
    }
}
