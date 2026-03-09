/**
 * Finance Integration Layer
 *
 * Abstracts the connection between Wine ERP (operational) and external
 * accounting software (MISA, Fast, Bravo, SAP B1, etc.).
 *
 * Current mode: EXPORT-ONLY
 * - ERP tracks AR/AP, Cash Position, Credit Hold operationally
 * - Journal entries are generated internally for preview
 * - User exports journal batches → imports into accounting software
 *
 * Future modes: API_SYNC (auto-push via adapter)
 */

// ═══════════════════════════════════════════════════
// ADAPTER INTERFACE — All accounting integrations implement this
// ═══════════════════════════════════════════════════

export type IntegrationMode = 'INTERNAL' | 'EXPORT_ONLY' | 'API_SYNC'

export interface JournalExportEntry {
    entryNo: string
    postedAt: string       // ISO date
    docType: string
    description: string
    lines: {
        account: string    // e.g., "511 - Doanh thu"
        accountCode: string // e.g., "511"
        debit: number
        credit: number
        description: string
    }[]
    sourceRef: string      // SO/PO/GR number
    totalDebit: number
    totalCredit: number
}

export interface ExportResult {
    format: 'EXCEL' | 'JSON' | 'CSV'
    fileName: string
    data: string           // base64 for Excel, raw string for JSON/CSV
    entryCount: number
    totalDebit: number
    totalCredit: number
    period: string
}

export interface FinanceAdapter {
    mode: IntegrationMode
    name: string

    /** Export journal entries for a date range */
    exportJournals(from: Date, to: Date, format: 'EXCEL' | 'JSON' | 'CSV'): Promise<ExportResult>

    /** Check connection status (for API_SYNC mode) */
    checkConnection?(): Promise<{ connected: boolean; message: string }>

    /** Push a single journal entry (for API_SYNC mode) */
    pushJournal?(entry: JournalExportEntry): Promise<{ success: boolean; externalId?: string; error?: string }>
}

// ═══════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════

export interface FinanceIntegrationConfig {
    mode: IntegrationMode
    adapterName: string
    // For API_SYNC mode (future)
    apiUrl?: string
    apiKey?: string
    autoSync?: boolean
}

const DEFAULT_CONFIG: FinanceIntegrationConfig = {
    mode: 'EXPORT_ONLY',
    adapterName: 'export-only',
}

let _config: FinanceIntegrationConfig = DEFAULT_CONFIG

export function getFinanceConfig(): FinanceIntegrationConfig {
    return _config
}

export function setFinanceConfig(config: Partial<FinanceIntegrationConfig>): void {
    _config = { ..._config, ...config }
}

// ═══════════════════════════════════════════════════
// ACCOUNT CODE MAPPING — VAS standard
// ═══════════════════════════════════════════════════

/** Extract pure account code from full label, e.g., "511 - Doanh thu" → "511" */
export function extractAccountCode(fullAccount: string): string {
    const match = fullAccount.match(/^(\d+)/)
    return match?.[1] ?? fullAccount
}

/** Standard VAS account names for clean export */
export const VAS_ACCOUNTS: Record<string, string> = {
    '111': 'Tiền mặt',
    '112': 'Tiền gửi ngân hàng',
    '131': 'Phải thu khách hàng',
    '133': 'Thuế GTGT được khấu trừ',
    '138': 'Phải thu khác',
    '141': 'Tạm ứng',
    '156': 'Hàng tồn kho',
    '211': 'TSCĐ hữu hình',
    '242': 'Chi phí trả trước',
    '331': 'Phải trả người bán',
    '333': 'Thuế và các khoản phải nộp NN',
    '3331': 'Thuế GTGT phải nộp',
    '334': 'Phải trả người lao động',
    '338': 'Phải trả, phải nộp khác',
    '341': 'Vay và nợ thuê tài chính',
    '411': 'Vốn đầu tư của CSH',
    '421': 'Lợi nhuận sau thuế chưa PP',
    '511': 'Doanh thu bán hàng',
    '515': 'Doanh thu hoạt động tài chính',
    '521': 'Các khoản giảm trừ DT',
    '531': 'Hàng bán bị trả lại',
    '632': 'Giá vốn hàng bán',
    '635': 'Chi phí tài chính',
    '641': 'Chi phí bán hàng',
    '642': 'Chi phí quản lý DN',
    '711': 'Thu nhập khác',
    '811': 'Chi phí khác',
    '821': 'Chi phí thuế TNDN',
}
