'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { revalidateCache } from '@/lib/cache'
import { generateContractDocx, ContractMergeInput, ContractProductItem } from '@/lib/docx-generator'
import { uploadToStorage } from '@/lib/supabase-storage'
import { serialize } from '@/lib/serialize'
import { requireAuth } from '@/lib/session'
import { CONTRACT_TEMPLATES, type ContractTemplateDefinition } from './contract-templates'

/**
 * Lấy danh sách các mẫu biểu hợp đồng
 */
export async function getContractTemplatesAction(): Promise<ContractTemplateDefinition[]> {
    await requireAuth()
    return serialize(CONTRACT_TEMPLATES)
}

/**
 * Lấy chi tiết thông tin đối tác để auto-fill vào form hợp đồng
 */
export async function getCounterpartyDetailAction(type: 'customer' | 'supplier', id: string) {
    try {
        await requireAuth()
        if (type === 'customer') {
            const customer = await prisma.customer.findUnique({
                where: { id },
                include: {
                    contacts: { where: { isPrimary: true }, take: 1 },
                    addresses: { where: { isDefault: true }, take: 1 },
                },
            })

            if (!customer) return { success: false, error: 'Không tìm thấy khách hàng' }

            const primaryContact = customer.contacts[0]
            const defaultAddress = customer.addresses[0]

            return {
                success: true,
                data: {
                    name: customer.vatCompanyName || customer.name,
                    taxId: customer.taxId || '',
                    address: customer.vatAddress || defaultAddress?.address || '',
                    email: customer.vatEmail || primaryContact?.email || '',
                    phone: primaryContact?.phone || '',
                    representative: primaryContact?.name || '',
                    title: primaryContact?.title || 'Đại diện theo pháp luật',
                    paymentTerm: customer.paymentTerm || 'NET30',
                    creditLimit: Number(customer.creditLimit) || 0,
                },
            }
        } else {
            const supplier = await prisma.supplier.findUnique({
                where: { id },
                include: {
                    contacts: { where: { isPrimary: true }, take: 1 },
                },
            })

            if (!supplier) return { success: false, error: 'Không tìm thấy nhà cung cấp' }

            const primaryContact = supplier.contacts[0]

            return {
                success: true,
                data: {
                    name: supplier.name,
                    taxId: supplier.taxId || '',
                    address: supplier.pickupInfo || supplier.country || '',
                    email: primaryContact?.email || '',
                    phone: primaryContact?.phone || '',
                    representative: primaryContact?.name || '',
                    title: primaryContact?.title || 'Đại diện nhà cung cấp',
                    paymentTerm: supplier.paymentTerm || '',
                    creditLimit: 0,
                },
            }
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

/**
 * Lấy danh sách sản phẩm rượu có sẵn để đưa vào bảng chọn sản phẩm trong hợp đồng
 */
export async function getAvailableProductsForContractAction() {
    try {
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: {
                id: true,
                skuCode: true,
                productName: true,
                country: true,
                volumeMl: true,
                marginPrice: {
                    select: {
                        wholesalePrice: true,
                        retailPrice: true,
                    },
                },
            },
            take: 100,
            orderBy: { productName: 'asc' },
        })

        return {
            success: true,
            data: products.map(p => ({
                id: p.id,
                sku: p.skuCode,
                name: p.productName,
                country: p.country,
                volume: `${p.volumeMl}ml`,
                wholesalePrice: Number(p.marginPrice?.wholesalePrice || 0),
                retailPrice: Number(p.marginPrice?.retailPrice || 0),
            })),
        }
    } catch (err: any) {
        return { success: false, error: err.message, data: [] }
    }
}

export interface GenerateContractPayload extends ContractMergeInput {
    counterpartyType: 'customer' | 'supplier'
    counterpartyId: string
    contractType: 'PURCHASE' | 'SALES' | 'CONSIGNMENT' | 'LOGISTICS' | 'WAREHOUSE_RENTAL'
}

/**
 * Sinh file Word (.docx) từ biểu mẫu, lưu bản ghi vào Database và đính kèm hồ sơ
 */
export async function generateContractFromTemplateAction(payload: GenerateContractPayload) {
    try {
        await requireAuth()
        if (!payload.so_hop_dong) {
            return { success: false, error: 'Vui lòng nhập số hợp đồng' }
        }
        if (!payload.ten_ben_b) {
            return { success: false, error: 'Vui lòng chọn đối tác Bên B' }
        }

        // 1. Kiểm tra trùng số hợp đồng
        const existing = await prisma.contract.findUnique({
            where: { contractNo: payload.so_hop_dong },
        })
        if (existing) {
            return { success: false, error: `Số hợp đồng "${payload.so_hop_dong}" đã tồn tại trong hệ thống` }
        }

        // 2. Sinh Buffer file Word (.docx)
        const docxBuffer = await generateContractDocx(payload)

        // 3. Tính toán giá trị hợp đồng
        let totalVal = Number(payload.gia_tri_hop_dong) || 0
        if (payload.san_pham && payload.san_pham.length > 0) {
            const sumItems = payload.san_pham.reduce((sum, item) => {
                const qty = Number(item.so_luong) || 0
                const price = typeof item.don_gia === 'number' ? item.don_gia : Number(String(item.don_gia).replace(/\D/g, '')) || 0
                return sum + (qty * price)
            }, 0)
            // Nếu là HĐ mua bán có VAT thì cộng thêm 10%
            totalVal = Math.round(sumItems * 1.1)
        } else if (payload.han_muc_cong_no) {
            totalVal = Number(payload.han_muc_cong_no)
        }

        // 4. Lưu bản ghi Contract vào cơ sở dữ liệu
        const templateObj = CONTRACT_TEMPLATES.find(t => t.code === payload.templateCode)
        const templateName = templateObj ? templateObj.name : payload.templateCode

        const newContract = await prisma.contract.create({
            data: {
                contractNo: payload.so_hop_dong,
                type: payload.contractType,
                customerId: payload.counterpartyType === 'customer' ? payload.counterpartyId : null,
                supplierId: payload.counterpartyType === 'supplier' ? payload.counterpartyId : null,
                value: totalVal,
                currency: payload.tien_te || 'VND',
                startDate: new Date(payload.ngay_hieu_luc),
                endDate: new Date(payload.ngay_het_han),
                paymentTerm: payload.thoi_han_thanh_toan ? `${payload.thoi_han_thanh_toan} ngày` : undefined,
                discountTerms: payload.ty_le_hoa_hong ? `Hoa hồng ký gửi: ${payload.ty_le_hoa_hong}%` : undefined,
                archiveStatus: `Sinh từ mẫu: ${templateName}`,
                status: 'DRAFT',
            },
        })

        // 5. Upload file .docx vào Supabase Storage & lưu ContractDocument
        const fileName = `HopDong_${payload.so_hop_dong.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`
        const storagePath = `contracts/generated/${newContract.id}/${fileName}`

        let fileUrl = ''
        try {
            const uploadRes = await uploadToStorage(
                'contracts',
                storagePath,
                docxBuffer,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
            if (uploadRes.success && uploadRes.url) {
                fileUrl = uploadRes.url
            }
        } catch {
            // Không chặn tiến trình nếu storage chưa cấu hình đầy đủ
        }

        await prisma.contractDocument.create({
            data: {
                contractId: newContract.id,
                name: fileName,
                fileUrl: fileUrl || `/api/contracts/${newContract.id}/download`,
                storagePath: storagePath,
            },
        })

        revalidateCache('contracts')
        revalidatePath('/dashboard/contracts')

        return {
            success: true,
            contractId: newContract.id,
            contractNo: newContract.contractNo,
            fileName: fileName,
            fileBase64: docxBuffer.toString('base64'),
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi khi tạo hợp đồng từ biểu mẫu' }
    }
}
