'use client'

import { useState } from 'react'
import {
    X, Plus, Trash2, UploadCloud, Paperclip, CheckCircle2,
    Loader2, AlertCircle, Calendar, CreditCard, Building2, User
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND } from '@/lib/utils'
import { createPaymentRequest, ExpenseCategoryRow } from './actions'
import { uploadPaymentDoc } from '@/lib/storage-r2'

interface CreatePaymentRequestDrawerProps {
    categories: ExpenseCategoryRow[]
    legalEntities: { id: string; name: string; code: string }[]
    suppliers: { id: string; name: string; code: string }[]
    departments: { id: string; name: string }[]
    onClose: () => void
    onSuccess: () => void
}

interface ItemRow {
    categoryId: string
    description: string
    accountCode: string
    quantity: number
    unitPrice: number
    vatAmount: number
    invoiceNo: string
    invoiceDate: string
}

interface UploadedDoc {
    docType: 'VAT_INVOICE' | 'DELIVERY_NOTE' | 'CONTRACT_DOC' | 'TAX_RECEIPT' | 'BANK_UNC' | 'OTHER'
    fileName: string
    fileUrl: string
    storagePath: string
    fileSize: number
    mimeType: string
}

export function CreatePaymentRequestDrawer({
    categories,
    legalEntities,
    suppliers,
    departments,
    onClose,
    onSuccess,
}: CreatePaymentRequestDrawerProps) {
    const [submitting, setSubmitting] = useState(false)
    const [uploadingFiles, setUploadingFiles] = useState(false)

    // Form fields
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<'VENDOR_PAYMENT' | 'IMPORT_TAX_LOGISTICS' | 'OPERATIONS_OFFICE' | 'TASTING_MARKETING' | 'EMPLOYEE_ADVANCE' | 'OTHER'>('OPERATIONS_OFFICE')
    const [primaryCategoryId, setPrimaryCategoryId] = useState(categories[0]?.id || '')
    const [priority, setPriority] = useState('NORMAL')
    const [currency, setCurrency] = useState('VND')
    const [exchangeRate, setExchangeRate] = useState(1)
    const [dueDate, setDueDate] = useState('')
    const [beneficiaryName, setBeneficiaryName] = useState('')
    const [beneficiaryAccount, setBeneficiaryAccount] = useState('')
    const [beneficiaryBank, setBeneficiaryBank] = useState('')
    const [legalEntityId, setLegalEntityId] = useState(legalEntities[0]?.id || '')
    const [departmentId, setDepartmentId] = useState(departments[0]?.id || '')
    const [supplierId, setSupplierId] = useState('')
    const [notes, setNotes] = useState('')

    // Line items
    const [items, setItems] = useState<ItemRow[]>([
        {
            categoryId: categories[0]?.id || '',
            description: '',
            accountCode: categories[0]?.defaultAccount || '642',
            quantity: 1,
            unitPrice: 0,
            vatAmount: 0,
            invoiceNo: '',
            invoiceDate: '',
        },
    ])

    // Attachments
    const [attachments, setAttachments] = useState<UploadedDoc[]>([])

    // Update account code when primary category changes
    function handleCategoryChange(catId: string) {
        setPrimaryCategoryId(catId)
        const selected = categories.find(c => c.id === catId)
        if (selected) {
            // Apply to empty line items
            setItems(prev => prev.map(item => item.categoryId ? item : {
                ...item,
                categoryId: selected.id,
                accountCode: selected.defaultAccount || item.accountCode,
            }))
        }
    }

    // Auto-fill supplier bank info if selected
    function handleSupplierChange(suppId: string) {
        setSupplierId(suppId)
        const supp = suppliers.find(s => s.id === suppId)
        if (supp) {
            setBeneficiaryName(supp.name)
        }
    }

    function addItem() {
        const defaultCat = categories.find(c => c.id === primaryCategoryId) || categories[0]
        setItems(prev => [
            ...prev,
            {
                categoryId: defaultCat?.id || '',
                description: '',
                accountCode: defaultCat?.defaultAccount || '642',
                quantity: 1,
                unitPrice: 0,
                vatAmount: 0,
                invoiceNo: '',
                invoiceDate: '',
            },
        ])
    }

    function removeItem(index: number) {
        if (items.length <= 1) {
            toast.error('Cần có ít nhất một khoản mục chi')
            return
        }
        setItems(prev => prev.filter((_, i) => i !== index))
    }

    function updateItem(index: number, field: keyof ItemRow, value: any) {
        setItems(prev => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }

            // If category changed, update account code
            if (field === 'categoryId') {
                const cat = categories.find(c => c.id === value)
                if (cat?.defaultAccount) {
                    next[index].accountCode = cat.defaultAccount
                }
            }
            return next
        })
    }

    // File upload handler
    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setUploadingFiles(true)
        let successCount = 0

        try {
            for (const file of files) {
                const formData = new FormData()
                formData.append('file', file)
                const res = await uploadPaymentDoc(formData, 'scanned-vouchers')

                if (res.success && res.url && res.storagePath) {
                    // Auto infer doc type
                    let docType: UploadedDoc['docType'] = 'OTHER'
                    const lowerName = file.name.toLowerCase()
                    if (lowerName.includes('vat') || lowerName.includes('hoa_don') || lowerName.includes('invoice')) {
                        docType = 'VAT_INVOICE'
                    } else if (lowerName.includes('bien_ban') || lowerName.includes('giao_hang') || lowerName.includes('delivery')) {
                        docType = 'DELIVERY_NOTE'
                    } else if (lowerName.includes('hop_dong') || lowerName.includes('contract')) {
                        docType = 'CONTRACT_DOC'
                    }

                    setAttachments(prev => [
                        ...prev,
                        {
                            docType,
                            fileName: res.fileName || file.name,
                            fileUrl: res.url!,
                            storagePath: res.storagePath!,
                            fileSize: res.fileSize || file.size,
                            mimeType: res.mimeType || file.type,
                        },
                    ])
                    successCount++
                } else {
                    toast.error(`Lỗi tải file ${file.name}: ${res.error}`)
                }
            }

            if (successCount > 0) {
                toast.success(`Đã tải lên ${successCount} chứng từ scan thành công!`)
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi upload file')
        } finally {
            setUploadingFiles(false)
            e.target.value = ''
        }
    }

    function removeAttachment(index: number) {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }

    function updateAttachmentDocType(index: number, docType: UploadedDoc['docType']) {
        setAttachments(prev => {
            const next = [...prev]
            next[index] = { ...next[index], docType }
            return next
        })
    }

    // Calculations
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const totalVat = items.reduce((sum, item) => sum + Number(item.vatAmount || 0), 0)
    const grandTotal = subtotal + totalVat
    const grandTotalVND = Math.round(grandTotal * (currency === 'VND' ? 1 : exchangeRate))

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) {
            toast.error('Vui lòng nhập nội dung đề nghị thanh toán')
            return
        }
        if (!beneficiaryName.trim()) {
            toast.error('Vui lòng nhập tên người/đơn vị thụ hưởng')
            return
        }

        const invalidItem = items.find(i => !i.description.trim() || i.unitPrice <= 0)
        if (invalidItem) {
            toast.error('Vui lòng nhập đầy đủ diễn giải và đơn giá hợp lệ cho các khoản mục')
            return
        }

        setSubmitting(true)
        try {
            const res = await createPaymentRequest({
                title: title.trim(),
                category,
                priority,
                currency,
                exchangeRate: currency === 'VND' ? 1 : exchangeRate,
                dueDate: dueDate || null,
                beneficiaryName: beneficiaryName.trim(),
                beneficiaryAccount: beneficiaryAccount.trim() || null,
                beneficiaryBank: beneficiaryBank.trim() || null,
                legalEntityId: legalEntityId || null,
                departmentId: departmentId || null,
                supplierId: supplierId || null,
                notes: notes.trim() || null,
                items: items.map(item => ({
                    categoryId: item.categoryId || primaryCategoryId || null,
                    description: item.description,
                    accountCode: item.accountCode,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    vatAmount: item.vatAmount,
                    invoiceNo: item.invoiceNo || null,
                    invoiceDate: item.invoiceDate || null,
                })),
                attachments,
            })

            if (res.success) {
                toast.success('Lập đề nghị thanh toán thành công!')
                onSuccess()
            } else {
                toast.error(res.error || 'Có lỗi xảy ra khi tạo đề nghị')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Lập Đề Nghị Thanh Toán Mới</h2>
                        <p className="text-xs text-slate-500">Khởi tạo phiếu thanh toán, đính kèm chứng từ scan và chuyển duyệt đa cấp</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ═══ Scrollable Body ═══ */}
                <form id="payment-request-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 1. Thông tin chung */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <CreditCard className="h-4 w-4 text-[#8B1A2E]" /> 1. Thông Tin Chung
                        </h3>
                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Nội dung đề nghị thanh toán *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Vd: Thanh toán tiền hàng vang Ý lô số PO-2026-08 / Chi phí thử nếm Masterclass tháng 10"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:border-[#8B1A2E] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Nhóm chi phí *</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value as any)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        <option value="VENDOR_PAYMENT">Tiền hàng Nhà cung cấp</option>
                                        <option value="IMPORT_TAX_LOGISTICS">Thuế Hải quan & Cước tàu</option>
                                        <option value="OPERATIONS_OFFICE">Chi phí Vận hành & Kho bãi</option>
                                        <option value="TASTING_MARKETING">Thử nếm rượu (Tasting) & Marketing</option>
                                        <option value="EMPLOYEE_ADVANCE">Tạm ứng / Hoàn ứng nhân sự</option>
                                        <option value="OTHER">Chi phí khác</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Hạng mục chi phí mặc định</label>
                                    <select
                                        value={primaryCategoryId}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>
                                                [{c.code}] {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Mức độ ưu tiên</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        <option value="LOW">Thấp</option>
                                        <option value="NORMAL">Bình thường</option>
                                        <option value="HIGH">Cao</option>
                                        <option value="URGENT">Khẩn cấp</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Pháp nhân chi trả</label>
                                    <select
                                        value={legalEntityId}
                                        onChange={e => setLegalEntityId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        {legalEntities.map(le => (
                                            <option key={le.id} value={le.id}>{le.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Bộ phận đề xuất</label>
                                    <select
                                        value={departmentId}
                                        onChange={e => setDepartmentId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Hạn thanh toán</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Thông tin thụ hưởng */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <Building2 className="h-4 w-4 text-[#8B1A2E]" /> 2. Người Thụ Hưởng & Ngân Hàng
                        </h3>
                        <div className="space-y-3 text-xs">
                            {category === 'VENDOR_PAYMENT' && (
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Nhà cung cấp (nếu có)</label>
                                    <select
                                        value={supplierId}
                                        onChange={e => handleSupplierChange(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    >
                                        <option value="">-- Chọn Nhà Cung Cấp --</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Tên đơn vị / Người nhận *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Vd: Công ty TNHH Vận Tải Biển / Nguyễn Văn A"
                                        value={beneficiaryName}
                                        onChange={e => setBeneficiaryName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Số tài khoản ngân hàng</label>
                                    <input
                                        type="text"
                                        placeholder="Vd: 0071001234567"
                                        value={beneficiaryAccount}
                                        onChange={e => setBeneficiaryAccount(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs font-semibold focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">Ngân hàng & Chi nhánh</label>
                                    <input
                                        type="text"
                                        placeholder="Vd: Vietcombank CN TP.HCM"
                                        value={beneficiaryBank}
                                        onChange={e => setBeneficiaryBank(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Bảng kê chi tiết khoản mục */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                3. Bảng Kê Khoản Mục Chi Tiết
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                                <Plus className="h-3 w-3" /> Thêm Dòng
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-semibold">
                                    <tr>
                                        <th className="p-2 w-[28%]">Diễn giải *</th>
                                        <th className="p-2 w-[22%]">Hạng mục chi</th>
                                        <th className="p-2 w-[8%] text-center">SL</th>
                                        <th className="p-2 w-[16%] text-right">Đơn giá</th>
                                        <th className="p-2 w-[12%] text-right">VAT</th>
                                        <th className="p-2 w-[14%] text-right">Thành tiền</th>
                                        <th className="p-2 w-[5%] text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => {
                                        const lineTotal = (item.quantity * item.unitPrice) + Number(item.vatAmount || 0)
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="Nội dung khoản chi..."
                                                        value={item.description}
                                                        onChange={e => updateItem(idx, 'description', e.target.value)}
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        value={item.categoryId}
                                                        onChange={e => updateItem(idx, 'categoryId', e.target.value)}
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-[#8B1A2E] focus:outline-none"
                                                    >
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.quantity}
                                                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                                                        className="w-full rounded border border-slate-300 p-1.5 text-center text-xs focus:border-[#8B1A2E] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.unitPrice || ''}
                                                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-right font-mono text-xs focus:border-[#8B1A2E] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.vatAmount || ''}
                                                        onChange={e => updateItem(idx, 'vatAmount', Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-right font-mono text-xs focus:border-[#8B1A2E] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2 text-right font-mono font-semibold text-slate-900">
                                                    {formatVND(lineTotal)}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="rounded p-1 text-slate-400 hover:text-red-600 transition"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Tổng cộng banner */}
                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs">
                            <div className="text-slate-500">
                                Số lượng khoản mục: <span className="font-semibold text-slate-800">{items.length}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-slate-500">Tổng cộng thanh toán:</span>
                                <span className="text-base font-bold text-[#8B1A2E]">{formatVND(grandTotalVND)}</span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Upload Chứng từ Scan (Cloudflare R2) */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    4. Đính Kèm Chứng Từ Scan (Hóa Đơn GTGT, Biên Bản, Hợp Đồng)
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    Hỗ trợ tải lên nhiều file PDF, JPG, PNG lưu trữ trên Cloudflare R2 bảo mật
                                </p>
                            </div>
                            {uploadingFiles && (
                                <div className="flex items-center gap-1.5 text-xs text-[#8B1A2E] font-medium">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải lên R2...
                                </div>
                            )}
                        </div>

                        {/* Dropzone */}
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 hover:bg-slate-50 transition">
                            <UploadCloud className="h-8 w-8 text-slate-400 mb-1" />
                            <span className="text-xs font-semibold text-slate-700">Kéo thả hoặc bấm để chọn chứng từ scan</span>
                            <span className="text-[11px] text-slate-400">PDF, PNG, JPG (Tối đa 20MB / file)</span>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,image/*"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </label>

                        {/* List uploaded attachments */}
                        {attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {attachments.map((att, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                                    >
                                        <div className="flex items-center gap-2 max-w-[65%]">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <span className="truncate font-medium text-slate-800" title={att.fileName}>
                                                {att.fileName}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                ({(att.fileSize / 1024).toFixed(1)} KB)
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={att.docType}
                                                onChange={e => updateAttachmentDocType(idx, e.target.value as any)}
                                                className="rounded border border-slate-300 p-1 text-[11px] focus:border-[#8B1A2E] focus:outline-none"
                                            >
                                                <option value="VAT_INVOICE">Hóa đơn GTGT</option>
                                                <option value="DELIVERY_NOTE">Biên bản bàn giao / Phiếu kho</option>
                                                <option value="CONTRACT_DOC">Hợp đồng / Báo giá</option>
                                                <option value="TAX_RECEIPT">Giấy nộp ngân sách</option>
                                                <option value="BANK_UNC">Ủy nhiệm chi (UNC)</option>
                                                <option value="OTHER">Chứng từ khác</option>
                                            </select>

                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(idx)}
                                                className="rounded p-1 text-slate-400 hover:text-red-600"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 5. Ghi chú */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú & Căn cứ phê duyệt</label>
                        <textarea
                            rows={2}
                            placeholder="Ghi chú thêm về điều khoản hợp đồng, tiến độ hoặc lý do cần thanh toán gấp..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-[#8B1A2E] focus:outline-none"
                        />
                    </div>
                </form>

                {/* ═══ Footer ═══ */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <div className="text-xs">
                        <span className="text-slate-500">Tổng thanh toán: </span>
                        <span className="font-mono text-base font-bold text-[#8B1A2E]">{formatVND(grandTotalVND)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="submit"
                            form="payment-request-form"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#8B1A2E] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#721526] transition disabled:opacity-50"
                        >
                            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Gửi Phê Duyệt Đề Nghị
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
