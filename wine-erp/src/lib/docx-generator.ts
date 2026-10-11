import * as fs from 'fs'
import * as path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { numberToVietnameseWords } from './vietnamese-words'

export interface ContractProductItem {
    stt: number
    ten_ruou: string
    nien_vu: string
    xuat_xu?: string
    dvt: string
    so_luong: number
    don_gia: number | string
    thanh_tien: number | string
}

export interface ContractMergeInput {
    templateCode: 'HD_NGUYEN_TAC' | 'HD_KY_GUI' | 'HD_MOT_LAN' | string
    customTemplateBuffer?: Buffer | Uint8Array

    // Contract Meta
    so_hop_dong: string
    ngay_ky: string // YYYY-MM-DD
    ngay_hieu_luc: string // YYYY-MM-DD
    ngay_het_han: string // YYYY-MM-DD
    so_hd_goc?: string

    // Bên A (Cung cấp / Bán) - mặc định là LY'S CELLARS
    ten_ben_a?: string
    mst_ben_a?: string
    dia_chi_ben_a?: string
    sdt_ben_a?: string
    email_ben_a?: string
    dai_dien_ben_a?: string
    chuc_vu_ben_a?: string
    so_tk_ben_a?: string
    ngan_hang_ben_a?: string

    // Bên B (Đối tác / Khách hàng / NCC)
    ten_ben_b: string
    mst_ben_b?: string
    dia_chi_ben_b?: string
    sdt_ben_b?: string
    email_ben_b?: string
    dai_dien_ben_b?: string
    chuc_vu_ben_b?: string
    so_tk_ben_b?: string
    ngan_hang_ben_b?: string

    // Giá trị & Điều khoản
    tien_te?: string // VNĐ hoặc USD
    gia_tri_hop_dong?: number
    han_muc_cong_no?: number
    thoi_han_thanh_toan?: number | string // số ngày
    dia_diem_giao_hang?: string
    ngay_giao_hang?: string

    // Dành cho Phụ lục Ký gửi
    ty_le_hoa_hong?: number | string
    ngay_doi_soat?: number | string

    // Dành cho Hợp đồng Một lần
    ty_le_dat_coc?: number | string
    tien_dat_coc?: number
    san_pham?: ContractProductItem[]
}

const DEFAULT_COMPANY_A = {
    ten_ben_a: "CÔNG TY CỔ PHẦN LY'S CELLARS",
    mst_ben_a: '0109123456',
    dia_chi_ben_a: 'Tầng 5, Tòa nhà Vincom Center, 191 Bà Triệu, P. Lê Đại Hành, Q. Hai Bà Trưng, Hà Nội',
    sdt_ben_a: '024 3974 8888',
    email_ben_a: 'contact@lyscellars.vn',
    dai_dien_ben_a: 'Nguyễn Hoàng Nam',
    chuc_vu_ben_a: 'Tổng Giám Đốc',
    so_tk_ben_a: '19036888666888',
    ngan_hang_ben_a: 'Techcombank - Chi nhánh Thăng Long, Hà Nội',
}

function formatVnDate(dateStr: string): string {
    if (!dateStr) return 'ngày ... tháng ... năm ...'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `ngày ${String(d.getDate()).padStart(2, '0')} tháng ${String(d.getMonth() + 1).padStart(2, '0')} năm ${d.getFullYear()}`
}

function formatShortDate(dateStr: string): string {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatMoney(amount?: number | string): string {
    if (amount === undefined || amount === null || amount === '') return '0'
    const num = Number(amount)
    if (isNaN(num)) return String(amount)
    return new Intl.NumberFormat('vi-VN').format(Math.round(num))
}

/**
 * Merge form data into a .docx template and return the generated file Buffer.
 */
export async function generateContractDocx(input: ContractMergeInput): Promise<Buffer> {
    const currency = input.tien_te || 'VNĐ'
    let templateBuffer: Buffer

    if (input.customTemplateBuffer) {
        templateBuffer = Buffer.isBuffer(input.customTemplateBuffer)
            ? input.customTemplateBuffer
            : Buffer.from(input.customTemplateBuffer)
    } else {
        // Load default template from public/templates/contracts
        const filename = `${input.templateCode}.docx`
        const localPath = path.join(process.cwd(), 'public', 'templates', 'contracts', filename)
        if (!fs.existsSync(localPath)) {
            throw new Error(`Biểu mẫu hợp đồng mặc định "${filename}" không tồn tại tại: ${localPath}`)
        }
        templateBuffer = fs.readFileSync(localPath)
    }

    // Prepare line items if any
    let totalItemsValue = 0
    const san_pham_formatted = (input.san_pham || []).map((item, idx) => {
        const qty = Number(item.so_luong) || 0
        const price = typeof item.don_gia === 'number' ? item.don_gia : Number(String(item.don_gia).replace(/\D/g, '')) || 0
        const rowTotal = typeof item.thanh_tien === 'number' ? item.thanh_tien : qty * price
        totalItemsValue += rowTotal

        return {
            stt: item.stt || idx + 1,
            ten_ruou: item.ten_ruou || '',
            nien_vu: item.nien_vu || '-',
            xuat_xu: item.xuat_xu || '-',
            dvt: item.dvt || 'Chai',
            so_luong: formatMoney(qty),
            don_gia: formatMoney(price),
            thanh_tien: formatMoney(rowTotal),
        }
    })

    const finalContractValue = Number(input.gia_tri_hop_dong) || totalItemsValue
    const vatValue = Math.round(finalContractValue * 0.1) // 10% VAT
    const totalWithVat = finalContractValue + vatValue

    const depositPercent = Number(input.ty_le_dat_coc) || 30
    const depositAmount = input.tien_dat_coc ?? Math.round((totalWithVat * depositPercent) / 100)
    const remainingAmount = Math.max(0, totalWithVat - depositAmount)

    const creditLimit = Number(input.han_muc_cong_no) || 0

    // Render dictionary
    const renderData = {
        // Meta
        so_hop_dong: input.so_hop_dong || 'CNT-Chưa_đặt_số',
        so_hd_goc: input.so_hd_goc || '.....................',
        ngay_ky_text: formatVnDate(input.ngay_ky),
        ngay_hieu_luc: formatShortDate(input.ngay_hieu_luc),
        ngay_het_han: formatShortDate(input.ngay_het_han),
        ngay_giao_hang: input.ngay_giao_hang ? formatShortDate(input.ngay_giao_hang) : 'Theo thỏa thuận hai bên',
        dia_diem_giao_hang: input.dia_diem_giao_hang || 'Tại kho của Bên Mua',

        // Bên A
        ten_ben_a: input.ten_ben_a || DEFAULT_COMPANY_A.ten_ben_a,
        mst_ben_a: input.mst_ben_a || DEFAULT_COMPANY_A.mst_ben_a,
        dia_chi_ben_a: input.dia_chi_ben_a || DEFAULT_COMPANY_A.dia_chi_ben_a,
        sdt_ben_a: input.sdt_ben_a || DEFAULT_COMPANY_A.sdt_ben_a,
        email_ben_a: input.email_ben_a || DEFAULT_COMPANY_A.email_ben_a,
        dai_dien_ben_a: input.dai_dien_ben_a || DEFAULT_COMPANY_A.dai_dien_ben_a,
        chuc_vu_ben_a: input.chuc_vu_ben_a || DEFAULT_COMPANY_A.chuc_vu_ben_a,
        so_tk_ben_a: input.so_tk_ben_a || DEFAULT_COMPANY_A.so_tk_ben_a,
        ngan_hang_ben_a: input.ngan_hang_ben_a || DEFAULT_COMPANY_A.ngan_hang_ben_a,

        // Bên B
        ten_ben_b: input.ten_ben_b,
        mst_ben_b: input.mst_ben_b || '.....................',
        dia_chi_ben_b: input.dia_chi_ben_b || '.....................',
        sdt_ben_b: input.sdt_ben_b || '.....................',
        email_ben_b: input.email_ben_b || '.....................',
        dai_dien_ben_b: input.dai_dien_ben_b || '.....................',
        chuc_vu_ben_b: input.chuc_vu_ben_b || 'Đại diện theo pháp luật',
        so_tk_ben_b: input.so_tk_ben_b || '.....................',
        ngan_hang_ben_b: input.ngan_hang_ben_b || '.....................',

        // Financial & Terms
        tien_te: currency,
        tien_truoc_thue: formatMoney(finalContractValue),
        tien_vat: formatMoney(vatValue),
        tong_tien: formatMoney(totalWithVat),
        tong_tien_bang_chu: numberToVietnameseWords(totalWithVat, currency),

        han_muc_cong_no: formatMoney(creditLimit),
        han_muc_cong_no_bang_chu: numberToVietnameseWords(creditLimit, currency),
        thoi_han_thanh_toan: String(input.thoi_han_thanh_toan || 30),

        ty_le_hoa_hong: String(input.ty_le_hoa_hong || 15),
        ngay_doi_soat: String(input.ngay_doi_soat || 25),

        ty_le_dat_coc: String(depositPercent),
        tien_dat_coc: formatMoney(depositAmount),
        tien_con_lai: formatMoney(remainingAmount),

        // Products Loop
        san_pham: san_pham_formatted,
    }

    try {
        const zip = new PizZip(templateBuffer)
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        })

        doc.render(renderData)

        const generated = doc.getZip().generate({
            type: 'nodebuffer',
            compression: 'DEFLATE',
        })

        return generated
    } catch (err: any) {
        throw new Error(`Lỗi sinh file hợp đồng Word: ${err.message}`)
    }
}
