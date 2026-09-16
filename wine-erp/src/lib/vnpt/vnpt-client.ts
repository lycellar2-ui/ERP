import { VnptConfig, VnptCallResult } from './types'

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
    const code = (legalEntityCode || 'TA').toUpperCase()

    // Default configuration for Thăng An (MST 0109579480) & Ly's Cellar (MST 0109902863)
    const isLC = code === 'LC' || code.includes('LY')
    const prefix = isLC ? 'VNPT_LC_' : 'VNPT_TA_'

    // Default fallback to VNPT Demo system if environment variables are not set in Vercel/production
    const DEFAULT_SERVICE_URL = 'https://2222222222-008-tt78democadmin.vnpt-invoice.com.vn/publishservice.asmx'
    const DEFAULT_PORTAL_URL = 'https://2222222222-008-tt78democadmin.vnpt-invoice.com.vn/portalservice.asmx'
    const DEFAULT_BUSINESS_URL = 'https://2222222222-008-tt78democadmin.vnpt-invoice.com.vn/businessservice.asmx'
    const DEFAULT_USERNAME = 'aiswebserviceadmin'
    const DEFAULT_PASSWORD = 'Einv@oi@vn#pt26'
    const DEFAULT_ACCOUNT = '2222222222-008_admin_demo'
    const DEFAULT_ACPASS = 'test123aA@'
    const DEFAULT_PATTERN = '1/011'
    const DEFAULT_SERIAL = 'C26THP'

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

function escapeSoap(str?: string): string {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}
