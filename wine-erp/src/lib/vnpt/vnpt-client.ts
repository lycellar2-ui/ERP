import { VnptConfig, VnptCallResult, VnptSyncResult, VnptRangeInvoice } from './types'

export const VNPT_ERROR_CODES: Record<string, string> = {
    'ERR:1': 'Tài khoản Web Service hoặc tài khoản phát hành không đúng, hoặc không có quyền thao tác.',
    'ERR:2': 'Mẫu số (Pattern) hoặc Ký hiệu (Serial) bị để trống.',
    'ERR:3': 'Dữ liệu XML hóa đơn không đúng quy định hoặc sai cấu trúc chuẩn TT78/NĐ70.',
    'ERR:4': 'Không tìm thấy thông tin công ty / đơn vị phát hành trong hệ thống VNPT.',
    'ERR:5': 'Lỗi hệ thống máy chủ VNPT (hãy kiểm tra lại kết nối mạng hoặc liên hệ hỗ trợ kỹ thuật VNPT).',
    'ERR:6': 'Dải hóa đơn không còn đủ số hoặc đã hết hạn ngạch phát hành.',
    'ERR:7': 'Tài khoản đăng nhập không hợp lệ hoặc không liên kết đúng công ty.',
    'ERR:10': 'Số lượng hóa đơn vượt quá giới hạn cho phép trong một lần gửi (tối đa 5.000).',
    'ERR:11': 'Mẫu số hoặc ký hiệu không đúng định dạng đăng ký với Cơ quan thuế.',
    'ERR:13': 'Trùng khóa FKey (Đơn hàng này đã được đẩy lên hệ thống VNPT trước đó).',
    'ERR:20': 'Pattern và Serial không phù hợp hoặc chưa đăng ký dải số trên hệ thống.',
    'ERR:21': 'Lỗi trùng số hóa đơn.',
    'ERR:22': 'Công ty chưa đăng ký chứng thư số.',
    'ERR:24': 'Chứng thư truyền lên không khớp với chứng thư đăng ký trong hệ thống.',
    'ERR:26': 'Chứng thư số (chữ ký số) đã hết hạn.',
    'ERR:27': 'Chứng thư số chưa đến thời điểm có hiệu lực.',
    'ERR:28': 'Chưa cấu hình thông tin chứng thư số trên hệ thống VNPT.',
}

/**
 * Get VNPT configuration for a specific Legal Entity (Thăng An TA / Ly's Cellar LC)
 */
export function getVnptConfigForEntity(legalEntityCode?: string): VnptConfig {
    const rawCode = (legalEntityCode || 'TA').trim().toUpperCase()

    // Explicit detection for both legal entities:
    // 1. Ly's Cellar (MST 0109902863): codes 'LC', 'LYS_CELLAR', 'LYSCELLAR', 'LY', 'CELLAR'
    // 2. Thắng Ân / Thăng An (MST 0109579480): codes 'TA', 'THANG_AN', 'THANGAN', 'THANG AN', 'THẮNG ÂN'
    const isLC = rawCode === 'LC' || rawCode.includes('LY') || rawCode.includes('CELLAR')
    const prefix = isLC ? 'VNPT_LC_' : 'VNPT_TA_'
    const entityCode: 'TA' | 'LC' = isLC ? 'LC' : 'TA'
    const entityName = isLC ? "Công ty TNHH Ly's Cellar" : "Công ty Cổ phần Thắng Ân"

    // Default configuration for production entities (Ly's Cellar & Thắng Ân)
    const defaultBaseUrl = isLC
        ? 'https://0109902863-tt78cadmin.vnpt-invoice.com.vn'
        : 'https://0109579480-tt78cadmin.vnpt-invoice.com.vn'

    const DEFAULT_SERVICE_URL = `${defaultBaseUrl}/publishservice.asmx`
    const DEFAULT_PORTAL_URL = `${defaultBaseUrl}/portalservice.asmx`
    const DEFAULT_BUSINESS_URL = `${defaultBaseUrl}/businessservice.asmx`
    const DEFAULT_USERNAME = isLC ? 'roleservicely' : 'roleservice'
    const DEFAULT_PASSWORD = ''
    const DEFAULT_ACCOUNT = isLC ? '0109902863_admin' : '0109579480_admin'
    const DEFAULT_ACPASS = ''
    const DEFAULT_PATTERN = '1/001'
    const DEFAULT_SERIAL = isLC ? 'C26TLY' : 'C26TTA'

    const serviceUrl = process.env[`${prefix}SERVICE_URL`] || process.env.VNPT_SERVICE_URL || DEFAULT_SERVICE_URL
    const portalUrl = process.env[`${prefix}PORTAL_URL`] || process.env.VNPT_PORTAL_URL || DEFAULT_PORTAL_URL
    const businessUrl = process.env[`${prefix}BUSINESS_URL`] || process.env.VNPT_BUSINESS_URL || DEFAULT_BUSINESS_URL
    const username = process.env[`${prefix}USERNAME`] || process.env.VNPT_USERNAME || DEFAULT_USERNAME
    const password = process.env[`${prefix}PASSWORD`] || process.env.VNPT_PASSWORD || DEFAULT_PASSWORD
    const account = process.env[`${prefix}ACCOUNT`] || process.env.VNPT_ACCOUNT || DEFAULT_ACCOUNT
    const acpass = process.env[`${prefix}ACPASS`] || process.env.VNPT_ACPASS || DEFAULT_ACPASS
    const pattern = process.env[`${prefix}PATTERN`] || process.env.VNPT_PATTERN || DEFAULT_PATTERN
    const serial = process.env[`${prefix}SERIAL`] || process.env.VNPT_SERIAL || DEFAULT_SERIAL

    // If explicit mock flag is set
    const isMock = process.env.VNPT_MOCK === 'true'

    return {
        serviceUrl,
        portalUrl,
        businessUrl,
        username,
        password,
        account,
        acpass,
        pattern,
        serial,
        entityCode,
        entityName,
        isMock,
    }
}

/**
 * Parse VNPT response string (e.g. "OK:1/001;C26TTA-SO_123" or "ERR:3")
 */
export function parseVnptResponse(rawResponse: string, fallbackFkey?: string): VnptCallResult {
    const trimmed = rawResponse.trim()

    if (trimmed.startsWith('OK:')) {
        // Format: OK:pattern;serial-fkey OR OK:pattern;serial-fkey_invNo
        const content = trimmed.substring(3)
        const [patSer, keyPart] = content.split('-')
        const [pat, ser] = (patSer || '').split(';')

        let fkey = fallbackFkey || ''
        let invoiceNo = ''

        if (keyPart) {
            const parts = keyPart.split('_')
            fkey = parts[0]
            if (parts.length > 1) {
                invoiceNo = parts[1]
            }
        }

        return {
            success: true,
            rawResponse: trimmed,
            pattern: pat || '',
            serial: ser || '',
            fkey,
            invoiceNo,
        }
    }

    if (trimmed.startsWith('ERR:')) {
        const errCode = trimmed.split(':')[0] + ':' + (trimmed.split(':')[1]?.split(' ')[0] || '')
        const msg = VNPT_ERROR_CODES[errCode] || VNPT_ERROR_CODES[trimmed] || `Lỗi máy chủ VNPT: ${trimmed}`
        return {
            success: false,
            rawResponse: trimmed,
            errorCode: errCode,
            errorMessage: msg,
        }
    }

    return {
        success: false,
        rawResponse: trimmed,
        errorMessage: `Phản hồi không xác định từ VNPT: ${trimmed}`,
    }
}

/**
 * Calls SOAP ASMX endpoint for ImportInvByPattern (Upload Draft Invoice)
 */
export async function uploadDraftToVnpt(
    config: VnptConfig,
    xmlInvData: string,
    fkey: string,
    patternOverride?: string,
    serialOverride?: string
): Promise<VnptCallResult> {
    const pattern = patternOverride || config.pattern
    const serial = serialOverride || config.serial

    // Handle Mock Mode (Safe Sandbox without live network requirement)
    if (config.isMock) {
        // Validate XML minimally
        if (!xmlInvData.includes('<DSHDon>') || !xmlInvData.includes('</DSHDon>')) {
            return {
                success: false,
                errorCode: 'ERR:3',
                errorMessage: VNPT_ERROR_CODES['ERR:3'],
            }
        }

        // Simulate successful draft upload
        return {
            success: true,
            rawResponse: `OK:${pattern};${serial}-${fkey}`,
            pattern,
            serial,
            fkey,
            invoiceNo: '', // Draft has no invoice number yet
        }
    }

    // Build SOAP 1.1 Envelope
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ImportInvByPattern xmlns="http://tempuri.org/">
      <Account>${escapeSoap(config.account)}</Account>
      <ACpass>${escapeSoap(config.acpass)}</ACpass>
      <xmlInvData>${escapeSoap(xmlInvData)}</xmlInvData>
      <username>${escapeSoap(config.username)}</username>
      <password>${escapeSoap(config.password)}</password>
      <pattern>${escapeSoap(pattern)}</pattern>
      <serial>${escapeSoap(serial)}</serial>
      <convert>0</convert>
    </ImportInvByPattern>
  </soap:Body>
</soap:Envelope>`.trim()

    try {
        const res = await fetch(config.serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/ImportInvByPattern',
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(30000), // 30s timeout
        })

        if (!res.ok) {
            return {
                success: false,
                errorMessage: `Lỗi kết nối máy chủ VNPT (HTTP ${res.status}: ${res.statusText})`,
            }
        }

        const textResponse = await res.text()
        const match = textResponse.match(/<ImportInvByPatternResult>(.*?)<\/ImportInvByPatternResult>/)
        const resultString = match ? match[1] : textResponse

        return parseVnptResponse(resultString, fkey)
    } catch (err: any) {
        return {
            success: false,
            errorMessage: `Không thể kết nối tới Web Service VNPT: ${err.message}`,
        }
    }
}

/**
 * Delete a draft invoice from VNPT by fkey
 */
export async function deleteDraftFromVnpt(
    config: VnptConfig,
    fkey: string
): Promise<VnptCallResult> {
    if (config.isMock) {
        return {
            success: true,
            rawResponse: `OK:${fkey}`,
            fkey,
        }
    }

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <deleteInvoiceByFkey xmlns="http://tempuri.org/">
      <lstFkey>${escapeSoap(fkey)}</lstFkey>
      <username>${escapeSoap(config.username)}</username>
      <password>${escapeSoap(config.password)}</password>
      <Account>${escapeSoap(config.account)}</Account>
      <ACpass>${escapeSoap(config.acpass)}</ACpass>
    </deleteInvoiceByFkey>
  </soap:Body>
</soap:Envelope>`.trim()

    try {
        const res = await fetch(config.serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/deleteInvoiceByFkey',
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(20000),
        })

        if (!res.ok) {
            return {
                success: false,
                errorMessage: `Lỗi HTTP ${res.status} khi xóa hóa đơn nháp VNPT`,
            }
        }

        const textResponse = await res.text()
        const match = textResponse.match(/<deleteInvoiceByFkeyResult>(.*?)<\/deleteInvoiceByFkeyResult>/)
        const resultString = match ? match[1] : textResponse

        return parseVnptResponse(resultString, fkey)
    } catch (err: any) {
        return {
            success: false,
            errorMessage: `Lỗi khi gọi hủy bản nháp VNPT: ${err.message}`,
        }
    }
}

/**
 * Query signed invoice status, official invoice number, tax authority code (MCCQT),
 * and view/PDF links from VNPT by FKey.
 */
export async function syncInvoiceStatusFromVnpt(
    config: VnptConfig,
    fkey: string,
    patternOverride?: string
): Promise<VnptSyncResult> {
    const pattern = patternOverride || config.pattern

    if (config.isMock) {
        return {
            success: true,
            isDraft: false,
            invoiceNo: '00000001',
            fullInvoiceNo: `${config.serial}-00000001`,
            pattern,
            serial: config.serial,
            taxAuthorityCode: 'MOCK-CQT-12345678',
            taxStatus: '2',
            taxStatusText: 'Đã được Cơ quan thuế chấp nhận',
            viewUrl: '#mock-view',
            pdfUrl: '#mock-pdf',
        }
    }

    // Step 1: Call GetMCCQThueByFkeysNoXMLSign on PublishService
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetMCCQThueByFkeysNoXMLSign xmlns="http://tempuri.org/">
      <Account>${escapeSoap(config.account)}</Account>
      <ACpass>${escapeSoap(config.acpass)}</ACpass>
      <username>${escapeSoap(config.username)}</username>
      <password>${escapeSoap(config.password)}</password>
      <pattern>${escapeSoap(pattern)}</pattern>
      <fkeys>${escapeSoap(fkey)}</fkeys>
    </GetMCCQThueByFkeysNoXMLSign>
  </soap:Body>
</soap:Envelope>`.trim()

    try {
        const res = await fetch(config.serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/GetMCCQThueByFkeysNoXMLSign',
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(25000),
        })

        if (!res.ok) {
            return {
                success: false,
                errorMessage: `Lỗi kết nối Web Service VNPT (HTTP ${res.status})`,
            }
        }

        const textResponse = await res.text()
        const match = textResponse.match(/<GetMCCQThueByFkeysNoXMLSignResult>(.*?)<\/GetMCCQThueByFkeysNoXMLSignResult>/)
        const resultRaw = match ? match[1].trim() : textResponse.trim()

        // If VNPT returns ERR:2 (Không tìm thấy hóa đơn tương ứng - do còn ở trạng thái nháp chưa ký)
        if (resultRaw === 'ERR:2') {
            return {
                success: false,
                isDraft: true,
                errorMessage: 'Hóa đơn trên VNPT vẫn ở trạng thái nháp (chưa được ký số). Vui lòng ký số trên portal VNPT trước khi đồng bộ.',
            }
        }

        if (resultRaw.startsWith('ERR:')) {
            const msg = VNPT_ERROR_CODES[resultRaw] || `Lỗi từ VNPT: ${resultRaw}`
            return {
                success: false,
                errorCode: resultRaw,
                errorMessage: msg,
            }
        }

        // Decode Base64 string to XML
        let xmlDecoded = ''
        try {
            xmlDecoded = Buffer.from(resultRaw, 'base64').toString('utf-8')
        } catch {
            xmlDecoded = resultRaw
        }

        // Parse fields from XML: <KHMSHDon>, <KHHDon>, <SHDon>, <MCCQThue>, <TThai>, <MTLoi>
        const patMatch = xmlDecoded.match(/<KHMSHDon>(.*?)<\/KHMSHDon>/)
        const serMatch = xmlDecoded.match(/<KHHDon>(.*?)<\/KHHDon>/)
        const shdonMatch = xmlDecoded.match(/<SHDon>(.*?)<\/SHDon>/)
        const mccqtMatch = xmlDecoded.match(/<MCCQThue>(.*?)<\/MCCQThue>/)
        const tthaiMatch = xmlDecoded.match(/<TThai>(.*?)<\/TThai>/)
        const mtloiMatch = xmlDecoded.match(/<MTLoi>(.*?)<\/MTLoi>/)

        const rawInvNo = shdonMatch ? shdonMatch[1].trim() : ''
        const serial = serMatch ? serMatch[1].trim() : config.serial
        const resolvedPattern = patMatch ? patMatch[1].trim() : pattern
        const taxAuthorityCode = mccqtMatch ? mccqtMatch[1].trim() : ''
        const taxStatus = tthaiMatch ? tthaiMatch[1].trim() : ''
        const taxError = mtloiMatch ? mtloiMatch[1].trim() : ''

        if (!rawInvNo) {
            return {
                success: false,
                isDraft: true,
                errorMessage: 'Chưa tìm thấy số hóa đơn chính thức trên VNPT (hóa đơn có thể chưa được ký số).',
            }
        }

        // Format invoice number to standard 8 digits (e.g. 190 -> 00000190)
        const formattedInvNo = !isNaN(Number(rawInvNo)) ? String(rawInvNo).padStart(8, '0') : rawInvNo
        const fullInvoiceNo = `${serial}-${formattedInvNo}`

        let taxStatusText = 'Chưa xác định'
        if (taxStatus === '0') taxStatusText = 'Chưa gửi CQT'
        else if (taxStatus === '1') taxStatusText = 'Đã gửi CQT, đang chờ cấp mã'
        else if (taxStatus === '2') taxStatusText = 'Đã được CQT chấp nhận'
        else if (taxStatus === '3') taxStatusText = `Bị CQT từ chối${taxError ? ': ' + taxError : ''}`

        // Step 2: Fetch view and download links from PortalService
        let viewUrl = ''
        let pdfUrl = ''
        let xmlUrl = ''

        try {
            const linkSoap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetLinkInvViewFkey xmlns="http://tempuri.org/">
      <fkey>${escapeSoap(fkey)}</fkey>
      <userName>${escapeSoap(config.username)}</userName>
      <userPass>${escapeSoap(config.password)}</userPass>
    </GetLinkInvViewFkey>
  </soap:Body>
</soap:Envelope>`.trim()

            const linkRes = await fetch(config.portalUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://tempuri.org/GetLinkInvViewFkey',
                },
                body: linkSoap,
                signal: AbortSignal.timeout(15000),
            })

            if (linkRes.ok) {
                const linkText = await linkRes.text()
                const linkMatch = linkText.match(/<GetLinkInvViewFkeyResult>(.*?)<\/GetLinkInvViewFkeyResult>/)
                const linkRaw = linkMatch ? linkMatch[1].trim() : ''

                if (linkRaw && !linkRaw.startsWith('ERR:')) {
                    let decodedLinks = ''
                    try {
                        decodedLinks = Buffer.from(linkRaw, 'base64').toString('utf-8')
                    } catch {
                        decodedLinks = linkRaw
                    }

                    const vMatch = decodedLinks.match(/<LinkView>(.*?)<\/LinkView>/)
                    const pMatch = decodedLinks.match(/<LinkPDF>(.*?)<\/LinkPDF>/)
                    const xMatch = decodedLinks.match(/<LinkXML>(.*?)<\/LinkXML>/)

                    if (vMatch) viewUrl = vMatch[1]
                    if (pMatch) pdfUrl = pMatch[1]
                    if (xMatch) xmlUrl = xMatch[1]
                }
            }
        } catch {
            // Ignore link fetch error, main sync succeeded
        }

        return {
            success: true,
            isDraft: false,
            invoiceNo: formattedInvNo,
            fullInvoiceNo,
            pattern: resolvedPattern,
            serial,
            taxAuthorityCode,
            taxStatus,
            taxStatusText,
            viewUrl,
            pdfUrl,
            xmlUrl,
            rawXml: xmlDecoded,
        }
    } catch (err: any) {
        return {
            success: false,
            errorMessage: `Không thể kết nối Web Service VNPT khi kiểm tra trạng thái: ${err.message}`,
        }
    }
}

/**
 * Lấy danh sách hóa đơn theo dải số từ VNPT qua hàm GetMCCQThueFromNoToNo
 */
export async function fetchVnptInvoicesByRange(
    config: VnptConfig,
    fromNo: number,
    toNo: number
): Promise<{
    success: boolean
    invoices: VnptRangeInvoice[]
    errorMessage?: string
}> {
    if (config.isMock) {
        return {
            success: true,
            invoices: [
                {
                    fkey: 'SO_DEMO_01',
                    invoiceNo: '00000001',
                    fullInvoiceNo: `${config.serial}-00000001`,
                    pattern: config.pattern,
                    serial: config.serial,
                    taxAuthorityCode: 'MOCK-CQT-00001',
                    taxStatus: '2',
                    taxStatusText: 'Đã được Cơ quan thuế chấp nhận',
                },
            ],
        }
    }

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetMCCQThueFromNoToNo xmlns="http://tempuri.org/">
      <invFromNo>${fromNo}</invFromNo>
      <invToNo>${toNo}</invToNo>
      <invPattern>${escapeSoap(config.pattern)}</invPattern>
      <invSerial>${escapeSoap(config.serial)}</invSerial>
      <isXMLData>0</isXMLData>
      <Account>${escapeSoap(config.account)}</Account>
      <ACpass>${escapeSoap(config.acpass)}</ACpass>
      <userName>${escapeSoap(config.username)}</userName>
      <userPass>${escapeSoap(config.password)}</userPass>
    </GetMCCQThueFromNoToNo>
  </soap:Body>
</soap:Envelope>`.trim()

    try {
        const res = await fetch(config.serviceUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://tempuri.org/GetMCCQThueFromNoToNo',
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(30000),
        })

        if (!res.ok) {
            return {
                success: false,
                invoices: [],
                errorMessage: `Lỗi kết nối Web Service VNPT (HTTP ${res.status})`,
            }
        }

        const textResponse = await res.text()
        const match = textResponse.match(/<GetMCCQThueFromNoToNoResult>(.*?)<\/GetMCCQThueFromNoToNoResult>/)
        const resultRaw = match ? match[1].trim() : textResponse.trim()

        if (resultRaw.startsWith('ERR:')) {
            const msg = VNPT_ERROR_CODES[resultRaw] || `Lỗi từ VNPT: ${resultRaw}`
            return {
                success: false,
                invoices: [],
                errorMessage: msg,
            }
        }

        let xmlDecoded = ''
        try {
            xmlDecoded = Buffer.from(resultRaw, 'base64').toString('utf-8')
        } catch {
            xmlDecoded = resultRaw
        }

        const invoices: VnptRangeInvoice[] = []
        const hdonMatches = [...xmlDecoded.matchAll(/<HDon>([\s\S]*?)<\/HDon>/g)]

        for (const m of hdonMatches) {
            const itemXml = m[1]
            const patM = itemXml.match(/<KHMSHDon>(.*?)<\/KHMSHDon>/)
            const serM = itemXml.match(/<KHHDon>(.*?)<\/KHHDon>/)
            const shdonM = itemXml.match(/<SHDon>(.*?)<\/SHDon>/)
            const mccqtM = itemXml.match(/<MCCQThue>(.*?)<\/MCCQThue>/)
            const tthaiM = itemXml.match(/<TThai>(.*?)<\/TThai>/)
            const mtloiM = itemXml.match(/<MTLoi>(.*?)<\/MTLoi>/)
            const fkeyM = itemXml.match(/<Fkey>(.*?)<\/Fkey>/)

            const rawInvNo = shdonM ? shdonM[1].trim() : ''
            const formattedInvNo = !isNaN(Number(rawInvNo)) ? String(rawInvNo).padStart(8, '0') : rawInvNo
            const serial = serM ? serM[1].trim() : config.serial
            const pattern = patM ? patM[1].trim() : config.pattern
            const fullInvoiceNo = `${serial}-${formattedInvNo}`
            const taxStatus = tthaiM ? tthaiM[1].trim() : ''
            const taxError = mtloiM ? mtloiM[1].trim() : ''

            let taxStatusText = 'Chưa xác định'
            if (taxStatus === '0') taxStatusText = 'Chưa gửi CQT'
            else if (taxStatus === '1') taxStatusText = 'Đang chờ CQT duyệt'
            else if (taxStatus === '2') taxStatusText = 'Đã được CQT chấp nhận'
            else if (taxStatus === '3') taxStatusText = `CQT từ chối${taxError ? ': ' + taxError : ''}`

            invoices.push({
                fkey: fkeyM ? fkeyM[1].trim() : '',
                invoiceNo: formattedInvNo,
                fullInvoiceNo,
                pattern,
                serial,
                taxAuthorityCode: mccqtM ? mccqtM[1].trim() : '',
                taxStatus,
                taxStatusText,
                taxError: taxError || undefined,
            })
        }

        return {
            success: true,
            invoices,
        }
    } catch (err: any) {
        return {
            success: false,
            invoices: [],
            errorMessage: `Lỗi kết nối VNPT: ${err.message}`,
        }
    }
}

function escapeSoap(str?: string): string {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}
