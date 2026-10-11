'use server'

import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'
import { type SopItem } from '@/data/sops'
import { OFFICIAL_FORMS, type SopFormFile } from '@/data/forms-data'

const STORE_PATH = path.join(process.cwd(), 'src', 'data', 'sops-store.json')
const FORMS_DIR = path.join(process.cwd(), 'public', 'forms')

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
 * Hỗ trợ Admin chỉnh sửa nội dung, thêm bước, sửa SLA ngay trên web
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
                title: existing?.title || file.replace(/\.(xlsx|docx|pdf)$/i, '').replace(/_/g, ' '),
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
 * Tải lên hoặc thay thế một file biểu mẫu (.xlsx, .docx, .pdf)
 * File sẽ được ghi đè trực tiếp vào public/forms/ để nhân viên có thể tải về ngay lập tức
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
            title: targetFileName.replace(/\.(xlsx|docx|pdf)$/i, '').replace(/_/g, ' '),
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
