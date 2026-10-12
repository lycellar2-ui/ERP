'use server'

import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { type SopItem } from '@/data/sops'
import { OFFICIAL_FORMS, type SopFormFile } from '@/data/forms-data'

const STORE_PATH = path.join(process.cwd(), 'src', 'data', 'sops-store.json')
const FORMS_DIR = path.join(process.cwd(), 'public', 'forms')
const DOCS_PROCESSES_DIR = path.join(process.cwd(), 'public', 'docs', 'processes')

export interface ProcessMarkdownDoc {
    id: string
    title: string
    fileName: string
    relativeFilePath: string
    url: string
    group: string
    groupLabel: string
    groupCode: string
    version: string
    lastUpdated: string
    tags: string[]
    sizeStr: string
    isEnglish: boolean
}

export const PROCESS_GROUPS_META: Record<string, { label: string; code: string; order: number }> = {
    '01_chien_luoc': { label: 'Chiến Lược & Danh Mục', code: 'STR', order: 1 },
    '02_nha_cung_cap': { label: 'Nhà Cung Cấp & Hợp Đồng', code: 'SUP', order: 2 },
    '03_mua_hang': { label: 'Mua Hàng & Đặt Hàng Quốc Tế', code: 'PUR', order: 3 },
    '04_nhap_khau_logistics': { label: 'Nhập Khẩu & Hải Quan Logistics', code: 'IMP', order: 4 },
    '05_kho_van': { label: 'Kho Vận, Dán Tem & Bảo Quản', code: 'WMS', order: 5 },
    '06_ban_hang': { label: 'Bán Hàng & Kênh Phân Phối', code: 'SLS', order: 6 },
    '07_phap_ly': { label: 'Pháp Lý, Giấy Phép & Công Bố', code: 'LEG', order: 7 },
    '08_tai_chinh': { label: 'Tài Chính, Kế Toán & Giá Vốn', code: 'FIN', order: 8 },
    '09_marketing': { label: 'Marketing & Phát Triển Thương Hiệu', code: 'MKT', order: 9 },
    '10_nhan_su': { label: 'Nhân Sự & Đào Tạo', code: 'HR', order: 10 },
    '11_cntt': { label: 'Hệ Thống ERP & CNTT', code: 'IT', order: 11 },
    '12_van_hanh': { label: 'Tiêu Chuẩn Vận Hành & SLA', code: 'OPS', order: 12 },
    'general': { label: 'Văn Bản Quy Trình Khác', code: 'GEN', order: 13 }
}

/**
 * Lấy danh sách toàn bộ quy trình SOP từ store
 */
export async function getSopsAction(): Promise<SopItem[]> {
    try {
        if (fs.existsSync(STORE_PATH)) {
            const data = fs.readFileSync(STORE_PATH, 'utf8')
            return JSON.parse(data) as SopItem[]
        }
    } catch (err) {
        console.error('Error reading sops-store.json:', err)
    }
    // Fallback to static items
    const { SOP_ITEMS } = await import('@/data/sops')
    return SOP_ITEMS
}

/**
 * Lưu hoặc cập nhật một quy trình SOP
 */
export async function saveSopAction(sopData: SopItem): Promise<{ success: boolean; data?: SopItem; error?: string }> {
    try {
        let currentSops: SopItem[] = []
        if (fs.existsSync(STORE_PATH)) {
            const data = fs.readFileSync(STORE_PATH, 'utf8')
            currentSops = JSON.parse(data)
        } else {
            const { SOP_ITEMS } = await import('@/data/sops')
            currentSops = [...SOP_ITEMS]
        }

        const existingIndex = currentSops.findIndex(s => s.id === sopData.id || s.code === sopData.code)
        
        const now = new Date()
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
        
        const updatedSop: SopItem = {
            ...sopData,
            effectiveDate: dateStr,
        }

        if (existingIndex >= 0) {
            currentSops[existingIndex] = updatedSop
        } else {
            currentSops.push(updatedSop)
        }

        fs.writeFileSync(STORE_PATH, JSON.stringify(currentSops, null, 2), 'utf8')
        revalidatePath('/dashboard/sop')
        
        return { success: true, data: updatedSop }
    } catch (err: any) {
        console.error('Error saving SOP:', err)
        return { success: false, error: err?.message || 'Không thể lưu quy trình' }
    }
}

/**
 * Xóa một quy trình SOP
 */
export async function deleteSopAction(sopId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!fs.existsSync(STORE_PATH)) {
            return { success: false, error: 'Kho lưu trữ chưa khởi tạo' }
        }

        const data = fs.readFileSync(STORE_PATH, 'utf8')
        let currentSops: SopItem[] = JSON.parse(data)
        
        currentSops = currentSops.filter(s => s.id !== sopId)
        fs.writeFileSync(STORE_PATH, JSON.stringify(currentSops, null, 2), 'utf8')
        revalidatePath('/dashboard/sop')

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err?.message || 'Không thể xóa quy trình' }
    }
}

/**
 * Lấy danh sách toàn bộ 114+ tài liệu quy trình Markdown (.md)
 */
export async function getMarkdownDocsAction(): Promise<ProcessMarkdownDoc[]> {
    try {
        if (!fs.existsSync(DOCS_PROCESSES_DIR)) {
            return []
        }

        const results: ProcessMarkdownDoc[] = []

        function parseDoc(filePath: string): ProcessMarkdownDoc {
            const content = fs.readFileSync(filePath, 'utf8')
            const rel = path.relative(DOCS_PROCESSES_DIR, filePath).replace(/\\/g, '/')
            const parts = rel.split('/')
            const groupKey = parts.length > 1 ? parts[0] : 'general'
            const groupMeta = PROCESS_GROUPS_META[groupKey] || { label: groupKey, code: 'DOC', order: 99 }

            let title = path.basename(filePath, '.md').replace(/_/g, ' ')
            let version = '1.0'
            let lastUpdated = ''
            let tags: string[] = []

            const fmMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/)
            if (fmMatch) {
                const rawFm = fmMatch[1]
                for (const line of rawFm.split(/\r?\n/)) {
                    const idx = line.indexOf(':')
                    if (idx > -1) {
                        const k = line.substring(0, idx).trim()
                        const v = line.substring(idx + 1).trim().replace(/^["']|["']$/g, '')
                        if (k === 'title') title = v
                        if (k === 'version') version = v
                        if (k === 'last_updated') lastUpdated = v
                        if (k === 'tags') {
                            tags = v.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean)
                        }
                    }
                }
            } else {
                // If no frontmatter, extract first # H1 heading if present
                const h1Match = content.match(/^#\s+([^\r\n]+)/m)
                if (h1Match) {
                    title = h1Match[1].trim()
                }
            }

            const stat = fs.statSync(filePath)
            const sizeKB = Math.round(stat.size / 1024)
            const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB || 1} KB`

            return {
                id: rel.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                title,
                fileName: path.basename(filePath),
                relativeFilePath: rel,
                url: `/docs/processes/${rel}`,
                group: groupKey,
                groupLabel: groupMeta.label,
                groupCode: groupMeta.code,
                version,
                lastUpdated: lastUpdated || stat.mtime.toISOString().split('T')[0],
                tags,
                sizeStr,
                isEnglish: filePath.endsWith('_en.md')
            }
        }

        function walkDir(dir: string) {
            const entries = fs.readdirSync(dir)
            for (const entry of entries) {
                const fullPath = path.join(dir, entry)
                const stat = fs.statSync(fullPath)
                if (stat.isDirectory()) {
                    walkDir(fullPath)
                } else if (entry.endsWith('.md')) {
                    results.push(parseDoc(fullPath))
                }
            }
        }

        walkDir(DOCS_PROCESSES_DIR)

        // Sort by group order then filename
        results.sort((a, b) => {
            const orderA = PROCESS_GROUPS_META[a.group]?.order ?? 99
            const orderB = PROCESS_GROUPS_META[b.group]?.order ?? 99
            if (orderA !== orderB) return orderA - orderB
            return a.fileName.localeCompare(b.fileName)
        })

        return results
    } catch (err) {
        console.error('Error getting markdown docs:', err)
        return []
    }
}

/**
 * Đọc nội dung chi tiết của một file markdown quy trình
 */
export async function getMarkdownContentAction(relativeFilePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        // Sanitize path to prevent directory traversal
        const safeRel = relativeFilePath.replace(/\.\./g, '').replace(/^[\\\/]+/, '')
        const fullPath = path.join(DOCS_PROCESSES_DIR, safeRel)

        if (!fs.existsSync(fullPath)) {
            // Also check public/forms for legacy paths
            const altPath = path.join(FORMS_DIR, path.basename(safeRel))
            if (fs.existsSync(altPath)) {
                const text = fs.readFileSync(altPath, 'utf8')
                return { success: true, content: text }
            }
            return { success: false, error: 'Tài liệu không tồn tại' }
        }

        const text = fs.readFileSync(fullPath, 'utf8')
        return { success: true, content: text }
    } catch (err: any) {
        console.error('Error reading markdown content:', err)
        return { success: false, error: err?.message || 'Lỗi khi đọc tài liệu' }
    }
}

/**
 * Lấy danh sách toàn bộ biểu mẫu chuẩn (Forms Library)
 */
export async function getOfficialFormsAction(): Promise<SopFormFile[]> {
    try {
        if (!fs.existsSync(FORMS_DIR)) {
            return OFFICIAL_FORMS
        }

        const files = fs.readdirSync(FORMS_DIR).filter(file => {
            try {
                return fs.statSync(path.join(FORMS_DIR, file)).isFile()
            } catch {
                return false
            }
        })
        const updatedList: SopFormFile[] = files.map(file => {
            const fullPath = path.join(FORMS_DIR, file)
            const stat = fs.statSync(fullPath)
            const ext = path.extname(file).replace('.', '').toUpperCase()
            const sizeKB = Math.round(stat.size / 1024)
            const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`

            // Match with existing meta if available
            const existing = OFFICIAL_FORMS.find(f => f.fileName === file)
            let formCode = existing?.code || ''
            if (!formCode) {
                const codeMatch = file.match(/^(?:Form[_\s]+)?([0-9]\.[0-9]+[A-Za-z\-]*(?:-[A-Za-z0-9]+)?)/i)
                formCode = codeMatch ? 'Form ' + codeMatch[1].replace(/_/g, '-') : 'Biểu mẫu'
            }

            return {
                id: file.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                code: formCode,
                fileName: file,
                downloadUrl: `/forms/${encodeURIComponent(file)}`,
                title: existing?.title || file.replace(/\.(xlsx|docx|pdf|md)$/i, '').replace(/_/g, ' '),
                fileType: ext,
                fileSize: sizeStr,
                category: existing?.category || 'sales',
                updatedAt: stat.mtime.toISOString().split('T')[0]
            }
        })

        return updatedList
    } catch (err) {
        console.error('Error listing forms:', err)
        return OFFICIAL_FORMS
    }
}

/**
 * Tải lên hoặc thay thế một file biểu mẫu (.xlsx, .docx, .pdf, .md)
 */
export async function uploadFormAction(formData: FormData): Promise<{ success: boolean; data?: SopFormFile; error?: string }> {
    try {
        const file = formData.get('file') as File | null
        const targetFileName = (formData.get('targetFileName') as string) || (file ? file.name : '')

        if (!file || !targetFileName) {
            return { success: false, error: 'Không tìm thấy tệp tải lên' }
        }

        if (!fs.existsSync(FORMS_DIR)) {
            fs.mkdirSync(FORMS_DIR, { recursive: true })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const destinationPath = path.join(FORMS_DIR, targetFileName)

        fs.writeFileSync(destinationPath, buffer)
        revalidatePath('/dashboard/sop')

        const stat = fs.statSync(destinationPath)
        const sizeKB = Math.round(stat.size / 1024)
        const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`

        const newForm: SopFormFile = {
            id: targetFileName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            code: 'Biểu mẫu mới',
            fileName: targetFileName,
            downloadUrl: `/forms/${encodeURIComponent(targetFileName)}`,
            title: targetFileName.replace(/\.(xlsx|docx|pdf|md)$/i, '').replace(/_/g, ' '),
            fileType: path.extname(targetFileName).replace('.', '').toUpperCase(),
            fileSize: sizeStr,
            category: 'sales',
            updatedAt: new Date().toISOString().split('T')[0]
        }

        return { success: true, data: newForm }
    } catch (err: any) {
        console.error('Error uploading form:', err)
        return { success: false, error: err?.message || 'Lỗi khi tải lên biểu mẫu' }
    }
}
