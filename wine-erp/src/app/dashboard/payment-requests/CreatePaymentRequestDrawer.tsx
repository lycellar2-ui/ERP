'use client'

import { useState, useEffect } from 'react'
import {
    X, Plus, Trash2, UploadCloud, CheckCircle2,
    Loader2, AlertCircle, Calendar, CreditCard, Building2, User,
    Package, Receipt, Link as LinkIcon, Sparkles, Search, Check
} from 'lucide-react'
import { toast } from 'sonner'
import { formatVND, formatDate } from '@/lib/utils'
import {
    createPaymentRequest,
    ExpenseCategoryRow,
    SupplierMasterRow,
    getSupplierPendingInvoicesAndPOs,
    quickCreateSupplier
} from './actions'
import { uploadPaymentDoc, getPresignedUploadUrl } from '@/lib/storage-r2'
import { useAppLocale } from '@/lib/i18n'

interface CreatePaymentRequestDrawerProps {
    categories: ExpenseCategoryRow[]
    legalEntities: { id: string; name: string; code: string }[]
    suppliers: (SupplierMasterRow | { id: string; name: string; code: string; bankAccountInfo?: string | null; taxId?: string | null; paymentTerm?: string | null })[]
    departments: { id: string; name: string }[]
    initialSupplierId?: string
    onClose: () => void
    onSuccess: () => void
    onSupplierCreated?: (supplier: any) => void
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
    suppliers: initialSuppliers,
    departments,
    initialSupplierId,
    onClose,
    onSuccess,
    onSupplierCreated,
}: CreatePaymentRequestDrawerProps) {
    const { isEn } = useAppLocale()
    const [submitting, setSubmitting] = useState(false)
    const [uploadingFiles, setUploadingFiles] = useState(false)

    // Suppliers list state (can be expanded dynamically via Quick Add)
    const [suppliersList, setSuppliersList] = useState<any[]>(initialSuppliers)
    const [supplierSearch, setSupplierSearch] = useState('')

    // Form fields
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<'VENDOR_PAYMENT' | 'IMPORT_TAX_LOGISTICS' | 'OPERATIONS_OFFICE' | 'TASTING_MARKETING' | 'EMPLOYEE_ADVANCE' | 'OTHER'>('VENDOR_PAYMENT')
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
    const [supplierId, setSupplierId] = useState(initialSupplierId || '')
    const [notes, setNotes] = useState('')

    // Linked PO / AP Invoice
    const [poId, setPoId] = useState<string | null>(null)
    const [apInvoiceId, setApInvoiceId] = useState<string | null>(null)
    const [pendingData, setPendingData] = useState<{ pos: any[]; invoices: any[] } | null>(null)
    const [loadingPending, setLoadingPending] = useState(false)

    // Quick Add Supplier Modal
    const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false)
    const [savingSupplier, setSavingSupplier] = useState(false)
    const [quickSupplierForm, setQuickSupplierForm] = useState({
        name: '',
        code: '',
        type: 'DISTRIBUTOR',
        taxId: '',
        bankName: '',
        bankAccountNo: '',
        bankAccountName: '',
        phone: '',
        email: '',
        address: '',
        paymentTerm: 'NET30',
    })

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
            setItems(prev => prev.map(item => item.categoryId ? item : {
                ...item,
                categoryId: selected.id,
                accountCode: selected.defaultAccount || item.accountCode,
            }))
        }
    }

    // Auto-fill supplier bank info and load pending orders/invoices
    async function selectSupplier(suppId: string) {
        setSupplierId(suppId)
        setPoId(null)
        setApInvoiceId(null)

        if (!suppId) {
            setPendingData(null)
            return
        }

        const supp = suppliersList.find(s => s.id === suppId)
        if (supp) {
            // Auto-fill beneficiary name if blank or equal to another supplier
            if (!beneficiaryName || suppliersList.some(s => s.name === beneficiaryName)) {
                setBeneficiaryName(supp.name)
            }

            // Auto-parse bankAccountInfo: "NH: Vietcombank - STK: 007100... - Chủ TK: ..."
            if (supp.bankAccountInfo) {
                const raw = supp.bankAccountInfo
                const nhMatch = raw.match(/(?:NH|Ngân hàng)[:\s]+([^-\n]+)/i)
                const stkMatch = raw.match(/(?:STK|Số TK)[:\s]+([^-\n]+)/i)
                const chuMatch = raw.match(/(?:Chủ TK|Tên TK)[:\s]+([^-\n]+)/i)

                if (nhMatch && nhMatch[1]) setBeneficiaryBank(nhMatch[1].trim())
                if (stkMatch && stkMatch[1]) setBeneficiaryAccount(stkMatch[1].trim())
                if (chuMatch && chuMatch[1]) setBeneficiaryName(chuMatch[1].trim())

                if (!nhMatch && !stkMatch && !chuMatch) {
                    setBeneficiaryBank(raw)
                }
            }

            // Fetch pending POs and AP Invoices for this supplier
            setLoadingPending(true)
            try {
                const data = await getSupplierPendingInvoicesAndPOs(suppId)
                setPendingData(data)
            } catch (err) {
                setPendingData(null)
            } finally {
                setLoadingPending(false)
            }
        }
    }

    // Trigger on initial mount if initialSupplierId is provided
    useEffect(() => {
        if (initialSupplierId) {
            selectSupplier(initialSupplierId)
        }
    }, [initialSupplierId])

    // Handle Quick Add Supplier Submission
    async function handleQuickAddSupplierSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!quickSupplierForm.name.trim()) {
            toast.error(isEn ? 'Please enter supplier name' : 'Vui lòng nhập tên nhà cung cấp')
            return
        }

        setSavingSupplier(true)
        try {
            const res = await quickCreateSupplier(quickSupplierForm)
            if (res.success && res.supplier) {
                toast.success(isEn ? `Added supplier: ${res.supplier.name}` : `Đã thêm nhà cung cấp: ${res.supplier.name}`)
                const newSupp = res.supplier
                setSuppliersList(prev => [newSupp, ...prev])
                if (onSupplierCreated) onSupplierCreated(newSupp)

                // Auto-select this newly created supplier
                selectSupplier(newSupp.id)
                setShowQuickAddSupplier(false)

                // Reset form
                setQuickSupplierForm({
                    name: '',
                    code: '',
                    type: 'DISTRIBUTOR',
                    taxId: '',
                    bankName: '',
                    bankAccountNo: '',
                    bankAccountName: '',
                    phone: '',
                    email: '',
                    address: '',
                    paymentTerm: 'NET30',
                })
            } else {
                toast.error(res.error || (isEn ? 'Error creating supplier' : 'Lỗi khi tạo nhà cung cấp'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Connection error' : 'Lỗi kết nối'))
        } finally {
            setSavingSupplier(false)
        }
    }

    // Quick select a PO
    function handleSelectPO(po: any) {
        if (poId === po.id) {
            setPoId(null)
            return
        }
        setPoId(po.id)
        if (po.currency && po.currency !== currency) {
            setCurrency(po.currency)
        }
        // Auto fill first item if empty or generic
        setItems(prev => {
            const next = [...prev]
            if (next.length > 0 && (!next[0].description || next[0].unitPrice === 0)) {
                next[0] = {
                    ...next[0],
                    description: isEn ? `Payment for PO: ${po.poNo}` : `Thanh toán theo đơn hàng PO: ${po.poNo}`,
                    unitPrice: po.totalAmount || 0,
                    quantity: 1,
                }
            }
            return next
        })
        if (!title || title.startsWith('Thanh toán tiền hàng') || title.startsWith('Payment for')) {
            setTitle(isEn ? `Payment for PO ${po.poNo} - ${selectedSupplier?.name || ''}` : `Thanh toán đơn hàng ${po.poNo} - ${selectedSupplier?.name || ''}`)
        }
        toast.info(isEn ? `Linked PO ${po.poNo}` : `Đã liên kết đơn hàng ${po.poNo}`)
    }

    // Quick select an AP Invoice
    function handleSelectInvoice(inv: any) {
        if (apInvoiceId === inv.id) {
            setApInvoiceId(null)
            return
        }
        setApInvoiceId(inv.id)
        if (inv.currency && inv.currency !== currency) {
            setCurrency(inv.currency)
        }
        // Auto fill first item
        setItems(prev => {
            const next = [...prev]
            if (next.length > 0) {
                next[0] = {
                    ...next[0],
                    description: isEn
                        ? `Payment for Invoice ${inv.invoiceNo} (PO: ${inv.poNo || 'N/A'})`
                        : `Thanh toán Hóa đơn số ${inv.invoiceNo} (PO: ${inv.poNo || 'N/A'})`,
                    unitPrice: inv.amount || 0,
                    quantity: 1,
                    invoiceNo: inv.invoiceNo,
                    invoiceDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
                }
            }
            return next
        })
        if (!title || title.startsWith('Thanh toán') || title.startsWith('Payment')) {
            setTitle(isEn ? `Payment for invoice ${inv.invoiceNo} - ${selectedSupplier?.name || ''}` : `Thanh toán hóa đơn ${inv.invoiceNo} - ${selectedSupplier?.name || ''}`)
        }
        toast.info(isEn ? `Linked invoice ${inv.invoiceNo}` : `Đã liên kết hóa đơn ${inv.invoiceNo}`)
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
            toast.error(isEn ? 'At least one line item is required' : 'Cần có ít nhất một khoản mục chi')
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
                let uploadSuccess = false
                let finalUrl = ''
                let finalStoragePath = ''
                let finalFileName = file.name
                let finalFileSize = file.size
                let finalMimeType = file.type || 'application/octet-stream'

                // 1. Direct Presigned PUT to Cloudflare R2 (bypasses Vercel 4.5MB Serverless limit, up to 25MB)
                try {
                    const presignedRes = await getPresignedUploadUrl(
                        file.name,
                        file.type || 'application/octet-stream',
                        file.size,
                        'scanned-vouchers'
                    )

                    if (presignedRes.success && presignedRes.uploadUrl && presignedRes.viewUrl && presignedRes.storagePath) {
                        const putRes = await fetch(presignedRes.uploadUrl, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': file.type || 'application/octet-stream',
                            },
                            body: file,
                        })

                        if (putRes.ok) {
                            uploadSuccess = true
                            finalUrl = presignedRes.viewUrl
                            finalStoragePath = presignedRes.storagePath
                            finalFileName = presignedRes.fileName || file.name
                            finalFileSize = presignedRes.fileSize || file.size
                            finalMimeType = presignedRes.mimeType || file.type
                        }
                    }
                } catch (directErr) {
                    console.warn('[Direct Upload] Cloudflare R2 direct PUT failed, falling back to Server Action:', directErr)
                }

                // 2. Fallback to Server Action upload if direct PUT did not succeed
                if (!uploadSuccess) {
                    const formData = new FormData()
                    formData.append('file', file)
                    const res = await uploadPaymentDoc(formData, 'scanned-vouchers')

                    if (res.success && res.url && res.storagePath) {
                        uploadSuccess = true
                        finalUrl = res.url
                        finalStoragePath = res.storagePath
                        finalFileName = res.fileName || file.name
                        finalFileSize = res.fileSize || file.size
                        finalMimeType = res.mimeType || file.type
                    } else {
                        toast.error(isEn ? `Upload failed for ${file.name}: ${res.error || 'Error'}` : `Lỗi tải file ${file.name}: ${res.error || 'Upload thất bại'}`)
                        continue
                    }
                }

                if (uploadSuccess) {
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
                            fileName: finalFileName,
                            fileUrl: finalUrl,
                            storagePath: finalStoragePath,
                            fileSize: finalFileSize,
                            mimeType: finalMimeType,
                        },
                    ])
                    successCount++
                }
            }

            if (successCount > 0) {
                toast.success(isEn ? `Uploaded ${successCount} scanned document(s) successfully!` : `Đã tải lên ${successCount} chứng từ scan thành công!`)
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Error uploading file' : 'Lỗi khi upload file'))
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

    const selectedSupplier = suppliersList.find(s => s.id === supplierId)

    // Filtered suppliers for quick combobox
    const filteredSuppliers = suppliersList.filter(s => {
        if (!supplierSearch.trim()) return true
        const q = supplierSearch.toLowerCase()
        return (
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            (s.taxId && s.taxId.toLowerCase().includes(q))
        )
    })

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) {
            toast.error(isEn ? 'Please enter payment request title/description' : 'Vui lòng nhập nội dung đề nghị thanh toán')
            return
        }
        if (!beneficiaryName.trim()) {
            toast.error(isEn ? 'Please enter beneficiary name' : 'Vui lòng nhập tên người/đơn vị thụ hưởng')
            return
        }

        const invalidItem = items.find(i => !i.description.trim() || i.unitPrice <= 0)
        if (invalidItem) {
            toast.error(isEn ? 'Please enter description and valid unit price for all line items' : 'Vui lòng nhập đầy đủ diễn giải và đơn giá hợp lệ cho các khoản mục')
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
                poId: poId || null,
                apInvoiceId: apInvoiceId || null,
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
                toast.success(isEn ? 'Payment request created successfully!' : 'Lập đề nghị thanh toán thành công!')
                onSuccess()
            } else {
                toast.error(res.error || (isEn ? 'Error creating payment request' : 'Có lỗi xảy ra khi tạo đề nghị'))
            }
        } catch (err: any) {
            toast.error(err.message || (isEn ? 'Connection error' : 'Lỗi kết nối'))
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
                        <h2 className="text-base font-bold text-slate-900">
                            {isEn ? 'Create New Payment Request' : 'Lập Đề Nghị Thanh Toán Mới'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {isEn
                                ? 'Create payment voucher, select Supplier, attach scanned documents and submit for multi-level approval'
                                : 'Khởi tạo phiếu thanh toán, chọn Nhà cung cấp, đính kèm chứng từ scan và chuyển duyệt đa cấp'}
                        </p>
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
                    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                            <CreditCard className="h-4 w-4 text-[#B91C1C]" /> {isEn ? '1. General Information' : '1. Thông Tin Chung'}
                        </h3>
                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Payment Request Title / Description *' : 'Nội dung đề nghị thanh toán *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isEn ? 'e.g. Payment for Italian wine lot PO-2026-08 / October Masterclass tasting expense' : 'Vd: Thanh toán tiền hàng vang Ý lô số PO-2026-08 / Chi phí thử nếm Masterclass tháng 10'}
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 font-medium focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Expense Group *' : 'Nhóm chi phí *'}
                                    </label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value as any)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="VENDOR_PAYMENT">{isEn ? 'Vendor / Supplier Payment' : 'Tiền hàng Nhà cung cấp'}</option>
                                        <option value="IMPORT_TAX_LOGISTICS">{isEn ? 'Customs Duty & Freight' : 'Thuế Hải quan & Cước tàu'}</option>
                                        <option value="OPERATIONS_OFFICE">{isEn ? 'Operations & Warehouse' : 'Chi phí Vận hành & Kho bãi'}</option>
                                        <option value="TASTING_MARKETING">{isEn ? 'Wine Tasting & Marketing' : 'Thử nếm rượu (Tasting) & Marketing'}</option>
                                        <option value="EMPLOYEE_ADVANCE">{isEn ? 'Employee Advance / Reimbursement' : 'Tạm ứng / Hoàn ứng nhân sự'}</option>
                                        <option value="OTHER">{isEn ? 'Other Expenses' : 'Chi phí khác'}</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Default Expense Category' : 'Hạng mục chi phí mặc định'}
                                    </label>
                                    <select
                                        value={primaryCategoryId}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>
                                                [{c.code}] {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Priority Level' : 'Mức độ ưu tiên'}
                                    </label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="LOW">{isEn ? 'Low' : 'Thấp'}</option>
                                        <option value="NORMAL">{isEn ? 'Normal' : 'Bình thường'}</option>
                                        <option value="HIGH">{isEn ? 'High' : 'Cao'}</option>
                                        <option value="URGENT">{isEn ? 'Urgent' : 'Khẩn cấp'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Paying Legal Entity' : 'Pháp nhân chi trả'}
                                    </label>
                                    <select
                                        value={legalEntityId}
                                        onChange={e => setLegalEntityId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        {legalEntities.map(le => (
                                            <option key={le.id} value={le.id}>{le.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Requesting Department' : 'Bộ phận đề xuất'}
                                    </label>
                                    <select
                                        value={departmentId}
                                        onChange={e => setDepartmentId(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        {departments.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Due Date' : 'Hạn thanh toán'}
                                    </label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Tiền tệ & Tỷ giá */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/60">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Currency' : 'Đồng tiền thanh toán'}
                                    </label>
                                    <select
                                        value={currency}
                                        onChange={e => setCurrency(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="VND">{isEn ? 'VND (Vietnamese Dong)' : 'VND (Việt Nam Đồng)'}</option>
                                        <option value="USD">{isEn ? 'USD (US Dollar)' : 'USD (Đô la Mỹ)'}</option>
                                        <option value="EUR">EUR (Euro)</option>
                                        <option value="GBP">{isEn ? 'GBP (British Pound)' : 'GBP (Bảng Anh)'}</option>
                                        <option value="AUD">{isEn ? 'AUD (Australian Dollar)' : 'AUD (Đô la Úc)'}</option>
                                        <option value="SGD">{isEn ? 'SGD (Singapore Dollar)' : 'SGD (Đô la Singapore)'}</option>
                                    </select>
                                </div>

                                {currency !== 'VND' && (
                                    <div>
                                        <label className="block font-medium text-slate-700 mb-1">
                                            {isEn ? 'Exchange Rate to VND' : 'Tỷ giá quy đổi sang VNĐ'}
                                        </label>
                                        <input
                                            type="number"
                                            value={exchangeRate}
                                            onChange={e => setExchangeRate(Number(e.target.value))}
                                            className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono font-bold focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Chọn Nhà Cung Cấp & Thông tin thụ hưởng */}
                    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Building2 className="h-4 w-4 text-[#B91C1C]" /> {isEn ? '2. Select Supplier & Beneficiary' : '2. Chọn Nhà Cung Cấp & Người Thụ Hưởng'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowQuickAddSupplier(true)}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                            >
                                <Plus className="h-3 w-3" /> {isEn ? 'Add New Supplier' : 'Thêm NCC Mới'}
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            {/* Supplier Selector with Search Combobox */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                        {isEn ? 'Select Supplier (Master Data)' : 'Chọn Nhà Cung Cấp (Master Data)'}
                                    </label>
                                    {selectedSupplier && (
                                        <span className="text-[11px] text-slate-500">
                                            {isEn ? 'Tax ID' : 'MST'}: <span className="font-mono font-bold text-slate-700">{selectedSupplier.taxId || 'N/A'}</span>
                                            {selectedSupplier.paymentTerm && ` • ${isEn ? 'Term' : 'Điều khoản'}: ${selectedSupplier.paymentTerm}`}
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={isEn ? 'Quick search supplier name, code or Tax ID...' : 'Tìm nhanh tên, mã NCC hoặc MST...'}
                                            value={supplierSearch}
                                            onChange={e => setSupplierSearch(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#B91C1C] focus:outline-none"
                                        />
                                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                                    </div>

                                    <select
                                        value={supplierId}
                                        onChange={e => selectSupplier(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-1.5 text-xs font-medium focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="">{isEn ? `-- Select Supplier (${filteredSuppliers.length}) --` : `-- Chọn Nhà Cung Cấp (${filteredSuppliers.length}) --`}</option>
                                        {filteredSuppliers.map(s => (
                                            <option key={s.id} value={s.id}>
                                                [{s.code}] {s.name} {s.taxId ? `(${isEn ? 'Tax ID' : 'MST'}: ${s.taxId})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedSupplier && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                                        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                            {selectedSupplier.type || (isEn ? 'Supplier' : 'Nhà Cung Cấp')}
                                        </span>
                                        {selectedSupplier.country && (
                                            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                                {isEn ? 'Country' : 'Quốc gia'}: {selectedSupplier.country}
                                            </span>
                                        )}
                                        {selectedSupplier.bankAccountInfo && (
                                            <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-800 font-mono">
                                                {selectedSupplier.bankAccountInfo}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Pending POs and AP Invoices Banner (Smart Match) */}
                            {loadingPending && (
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin text-[#B91C1C]" />
                                    {isEn ? 'Checking pending POs and unpaid AP invoices for this supplier...' : 'Đang kiểm tra đơn hàng PO và hóa đơn chưa thanh toán của NCC này...'}
                                </div>
                            )}

                            {pendingData && (pendingData.pos.length > 0 || pendingData.invoices.length > 0) && (
                                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3.5 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                                            <Sparkles className="h-4 w-4 text-amber-600" />
                                            {isEn ? 'Match Supplier POs & Unpaid Invoices:' : 'Khớp đơn hàng PO & Hóa đơn cần thanh toán của NCC:'}
                                        </div>
                                        <span className="text-[11px] text-amber-700">
                                            {isEn ? 'Click a PO or Invoice to auto-fill amount & description' : 'Bấm vào PO hoặc Hóa đơn để tự động điền số tiền & diễn giải'}
                                        </span>
                                    </div>

                                    {/* PO list chips */}
                                    {pendingData.pos.length > 0 && (
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-1.5">
                                                <Package className="h-3.5 w-3.5 text-[#B91C1C]" />
                                                {isEn ? 'Approved Purchase Orders (PO):' : 'Đơn đặt hàng (PO) đã duyệt:'}
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {pendingData.pos.map(po => {
                                                    const isSelected = poId === po.id
                                                    return (
                                                        <button
                                                            key={po.id}
                                                            type="button"
                                                            onClick={() => handleSelectPO(po)}
                                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                                                                isSelected
                                                                    ? 'border-[#B91C1C] bg-[#B91C1C] text-white shadow-xs font-bold'
                                                                    : 'border-amber-300 bg-white text-slate-800 hover:border-[#B91C1C]'
                                                            }`}
                                                        >
                                                            {isSelected ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3 text-slate-400" />}
                                                            <span>PO: {po.poNo}</span>
                                                            <span className="font-mono">({formatVND(po.totalAmount)})</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* AP Invoices chips */}
                                    {pendingData.invoices.length > 0 && (
                                        <div>
                                            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-1.5">
                                                <Receipt className="h-3.5 w-3.5 text-blue-600" />
                                                {isEn ? 'Unpaid AP Invoices:' : 'Hóa đơn AP chưa thanh toán:'}
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {pendingData.invoices.map(inv => {
                                                    const isSelected = apInvoiceId === inv.id
                                                    return (
                                                        <button
                                                            key={inv.id}
                                                            type="button"
                                                            onClick={() => handleSelectInvoice(inv)}
                                                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition ${
                                                                isSelected
                                                                    ? 'border-blue-600 bg-blue-600 text-white shadow-xs font-bold'
                                                                    : 'border-blue-200 bg-white text-slate-800 hover:border-blue-500'
                                                            }`}
                                                        >
                                                            {isSelected ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3 text-slate-400" />}
                                                            <span>{isEn ? 'Inv' : 'HĐ'}: {inv.invoiceNo}</span>
                                                            <span className="font-mono">({formatVND(inv.amount)})</span>
                                                            {inv.dueDate && (
                                                                <span className="text-[10px] opacity-80">{isEn ? 'Due' : 'Hạn'}: {formatDate(inv.dueDate)}</span>
                                                            )}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Beneficiary Details inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Beneficiary / Payee Name *' : 'Tên đơn vị / Người nhận *'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder={isEn ? 'e.g. Ocean Freight Co., Ltd / Nguyen Van A' : 'Vd: Công ty TNHH Vận Tải Biển / Nguyễn Văn A'}
                                        value={beneficiaryName}
                                        onChange={e => setBeneficiaryName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Bank Account Number' : 'Số tài khoản ngân hàng'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 0071001234567"
                                        value={beneficiaryAccount}
                                        onChange={e => setBeneficiaryAccount(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 font-mono text-xs font-semibold focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Bank & Branch' : 'Ngân hàng & Chi nhánh'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isEn ? 'e.g. Vietcombank HCMC Branch' : 'Vd: Vietcombank CN TP.HCM'}
                                        value={beneficiaryBank}
                                        onChange={e => setBeneficiaryBank(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Bảng kê chi tiết khoản mục */}
                    <div className="rounded-md border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                {isEn ? '3. Payment Line Items' : '3. Bảng Kê Khoản Mục Chi Tiết'}
                            </h3>
                            <button
                                type="button"
                                onClick={addItem}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                                <Plus className="h-3 w-3" /> {isEn ? 'Add Line' : 'Thêm Dòng'}
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-semibold">
                                    <tr>
                                        <th className="p-2 w-[28%]">{isEn ? 'Description *' : 'Diễn giải *'}</th>
                                        <th className="p-2 w-[22%]">{isEn ? 'Expense Category' : 'Hạng mục chi'}</th>
                                        <th className="p-2 w-[8%] text-center">{isEn ? 'Qty' : 'SL'}</th>
                                        <th className="p-2 w-[16%] text-right">{isEn ? 'Unit Price' : 'Đơn giá'}</th>
                                        <th className="p-2 w-[12%] text-right">VAT</th>
                                        <th className="p-2 w-[14%] text-right">{isEn ? 'Amount' : 'Thành tiền'}</th>
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
                                                        placeholder={isEn ? 'Line item description...' : 'Nội dung khoản chi...'}
                                                        value={item.description}
                                                        onChange={e => updateItem(idx, 'description', e.target.value)}
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-[#B91C1C] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <select
                                                        value={item.categoryId}
                                                        onChange={e => updateItem(idx, 'categoryId', e.target.value)}
                                                        className="w-full rounded border border-slate-300 p-1.5 text-xs focus:border-[#B91C1C] focus:outline-none"
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
                                                        className="w-full rounded border border-slate-300 p-1.5 text-center text-xs focus:border-[#B91C1C] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.unitPrice || ''}
                                                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-right font-mono text-xs focus:border-[#B91C1C] focus:outline-none"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={item.vatAmount || ''}
                                                        onChange={e => updateItem(idx, 'vatAmount', Number(e.target.value))}
                                                        placeholder="0"
                                                        className="w-full rounded border border-slate-300 p-1.5 text-right font-mono text-xs focus:border-[#B91C1C] focus:outline-none"
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
                                {isEn ? 'Line items: ' : 'Số lượng khoản mục: '}<span className="font-semibold text-slate-800">{items.length}</span>
                                {poId && <span className="ml-2 text-[#B91C1C] font-medium">• {isEn ? 'PO Linked' : 'Đã gắn PO'}</span>}
                                {apInvoiceId && <span className="ml-2 text-blue-600 font-medium">• {isEn ? 'AP Invoice Linked' : 'Đã gắn HĐ AP'}</span>}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-slate-500">{isEn ? 'Grand Total:' : 'Tổng cộng thanh toán:'}</span>
                                <span className="text-base font-bold text-[#B91C1C]">
                                    {currency === 'VND' ? formatVND(grandTotalVND) : `${grandTotal.toLocaleString()} ${currency} (~${formatVND(grandTotalVND)})`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4. Upload Chứng từ Scan (Cloudflare R2) */}
                    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {isEn ? '4. Attach Scanned Documents (VAT Invoice, Handover Note, Contract)' : '4. Đính Kèm Chứng Từ Scan (Hóa Đơn GTGT, Biên Bản, Hợp Đồng)'}
                                </h3>
                                <p className="text-[11px] text-slate-500">
                                    {isEn ? 'Supports multiple PDF, JPG, PNG files stored securely on Cloudflare R2' : 'Hỗ trợ tải lên nhiều file PDF, JPG, PNG lưu trữ trên Cloudflare R2 bảo mật'}
                                </p>
                            </div>
                            {uploadingFiles && (
                                <div className="flex items-center gap-1.5 text-xs text-[#B91C1C] font-medium">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {isEn ? 'Uploading to R2...' : 'Đang tải lên R2...'}
                                </div>
                            )}
                        </div>

                        {/* Dropzone */}
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 hover:bg-slate-50 transition">
                            <UploadCloud className="h-8 w-8 text-slate-400 mb-1" />
                            <span className="text-xs font-semibold text-slate-700">
                                {isEn ? 'Drag & drop or click to select scanned documents' : 'Kéo thả hoặc bấm để chọn chứng từ scan'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                {isEn ? 'PDF, PNG, JPG (Max 20MB / file)' : 'PDF, PNG, JPG (Tối đa 20MB / file)'}
                            </span>
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
                                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs gap-2"
                                    >
                                        <div className="flex items-center gap-2 w-full sm:max-w-[60%]">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <span className="truncate font-medium text-slate-800" title={att.fileName}>
                                                {att.fileName}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                ({(att.fileSize / 1024).toFixed(1)} KB)
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                                            <select
                                                value={att.docType}
                                                onChange={e => updateAttachmentDocType(idx, e.target.value as any)}
                                                className="rounded border border-slate-300 p-1 text-[11px] focus:border-[#B91C1C] focus:outline-none"
                                            >
                                                <option value="VAT_INVOICE">{isEn ? 'VAT Invoice' : 'Hóa đơn GTGT'}</option>
                                                <option value="DELIVERY_NOTE">{isEn ? 'Delivery / Warehouse Note' : 'Biên bản bàn giao / Phiếu kho'}</option>
                                                <option value="CONTRACT_DOC">{isEn ? 'Contract / Quotation' : 'Hợp đồng / Báo giá'}</option>
                                                <option value="TAX_RECEIPT">{isEn ? 'Tax Payment Receipt' : 'Giấy nộp ngân sách'}</option>
                                                <option value="BANK_UNC">{isEn ? 'Payment Order (UNC)' : 'Ủy nhiệm chi (UNC)'}</option>
                                                <option value="OTHER">{isEn ? 'Other Document' : 'Chứng từ khác'}</option>
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
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                            {isEn ? 'Notes & Approval Basis' : 'Ghi chú & Căn cứ phê duyệt'}
                        </label>
                        <textarea
                            rows={2}
                            placeholder={isEn ? 'Additional notes on contract terms, progress, or urgency...' : 'Ghi chú thêm về điều khoản hợp đồng, tiến độ hoặc lý do cần thanh toán gấp...'}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-[#B91C1C] focus:outline-none"
                        />
                    </div>
                </form>

                {/* ═══ Footer ═══ */}
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <div className="text-xs">
                        <span className="text-slate-500">{isEn ? 'Total Payment: ' : 'Tổng thanh toán: '}</span>
                        <span className="font-mono text-base font-bold text-[#B91C1C]">{formatVND(grandTotalVND)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
                        >
                            {isEn ? 'Cancel' : 'Hủy Bỏ'}
                        </button>
                        <button
                            type="submit"
                            form="payment-request-form"
                            disabled={submitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#B91C1C] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#721526] transition disabled:opacity-50"
                        >
                            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {isEn ? 'Submit for Approval' : 'Gửi Phê Duyệt Đề Nghị'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Quick Add Supplier Modal Dialog ═══ */}
            {showQuickAddSupplier && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-[#B91C1C]" /> {isEn ? 'Quick Add New Supplier' : 'Thêm Nhà Cung Cấp Mới (Nhanh)'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {isEn ? 'Quickly create supplier profile and bank account for payment' : 'Khởi tạo nhanh thông tin NCC và tài khoản ngân hàng để thanh toán'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowQuickAddSupplier(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleQuickAddSupplierSubmit} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    {isEn ? 'Supplier Name *' : 'Tên Nhà Cung Cấp *'}
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isEn ? 'e.g. Wine Import Co., Ltd A' : 'Vd: Công ty TNHH Nhập Khẩu Rượu Vang A'}
                                    value={quickSupplierForm.name}
                                    onChange={e => setQuickSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium focus:border-[#B91C1C] focus:outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Supplier Code (Blank for auto)' : 'Mã NCC (Để trống sẽ tự sinh)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. NCC-0088"
                                        value={quickSupplierForm.code}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, code: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs uppercase focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Supplier Type' : 'Phân loại NCC'}
                                    </label>
                                    <select
                                        value={quickSupplierForm.type}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, type: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="DISTRIBUTOR">{isEn ? 'Distributor' : 'Nhà phân phối (Distributor)'}</option>
                                        <option value="WINERY">{isEn ? 'Winery / Producer' : 'Nhà làm rượu (Winery / Hãng rượu)'}</option>
                                        <option value="FORWARDER">{isEn ? 'Freight Forwarder' : 'Hãng tàu / Giao nhận (Forwarder)'}</option>
                                        <option value="LOGISTICS">{isEn ? 'Warehousing / Domestic Logistics' : 'Kho bãi / Vận tải nội địa'}</option>
                                        <option value="LOCAL_VENDOR">{isEn ? 'Local Service Vendor' : 'Nhà cung cấp dịch vụ trong nước'}</option>
                                        <option value="OTHER">{isEn ? 'Other' : 'Khác'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Tax ID (MST)' : 'Mã số thuế (MST)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 0312345678"
                                        value={quickSupplierForm.taxId}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, taxId: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Payment Terms' : 'Điều khoản thanh toán'}
                                    </label>
                                    <select
                                        value={quickSupplierForm.paymentTerm}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, paymentTerm: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    >
                                        <option value="COD">{isEn ? 'Cash on Delivery (COD)' : 'Thanh toán ngay khi giao (COD)'}</option>
                                        <option value="NET15">{isEn ? 'Net 15 Days (NET15)' : 'Công nợ 15 ngày (NET15)'}</option>
                                        <option value="NET30">{isEn ? 'Net 30 Days (NET30)' : 'Công nợ 30 ngày (NET30)'}</option>
                                        <option value="NET45">{isEn ? 'Net 45 Days (NET45)' : 'Công nợ 45 ngày (NET45)'}</option>
                                        <option value="NET60">{isEn ? 'Net 60 Days (NET60)' : 'Công nợ 60 ngày (NET60)'}</option>
                                        <option value="ADVANCE_50">{isEn ? '50% Advance - Balance after delivery' : 'Tạm ứng 50% - Còn lại sau giao hàng'}</option>
                                        <option value="LC">{isEn ? 'Letter of Credit (L/C)' : 'Tín dụng thư (L/C)'}</option>
                                    </select>
                                </div>
                            </div>

                            {/* Bank Details */}
                            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                                <span className="font-semibold text-slate-700 block">
                                    {isEn ? 'Beneficiary Bank Account' : 'Tài khoản ngân hàng thụ hưởng'}
                                </span>
                                
                                <div>
                                    <label className="block text-[11px] text-slate-600 mb-0.5">
                                        {isEn ? 'Bank Name & Branch' : 'Tên Ngân Hàng & Chi Nhánh'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isEn ? 'e.g. Vietcombank - Ky Dong Branch' : 'Vd: Vietcombank - CN Kỳ Đồng'}
                                        value={quickSupplierForm.bankName}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankName: e.target.value }))}
                                        className="w-full rounded border border-slate-300 p-1.5 text-xs bg-white focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Number' : 'Số Tài Khoản (STK)'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 0071001234567"
                                            value={quickSupplierForm.bankAccountNo}
                                            onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountNo: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono font-bold bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-600 mb-0.5">
                                            {isEn ? 'Account Holder Name' : 'Tên Chủ Tài Khoản'}
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. ABC CO., LTD"
                                            value={quickSupplierForm.bankAccountName}
                                            onChange={e => setQuickSupplierForm(prev => ({ ...prev, bankAccountName: e.target.value }))}
                                            className="w-full rounded border border-slate-300 p-1.5 text-xs font-medium uppercase bg-white focus:border-[#B91C1C] focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Phone Number' : 'Số điện thoại'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 028 3822 xxxx"
                                        value={quickSupplierForm.phone}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        {isEn ? 'Contact Email' : 'Email liên hệ'}
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="e.g. accounting@supplier.com"
                                        value={quickSupplierForm.email}
                                        onChange={e => setQuickSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-[#B91C1C] focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowQuickAddSupplier(false)}
                                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                >
                                    {isEn ? 'Cancel' : 'Hủy'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSupplier}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#B91C1C] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#721526] transition disabled:opacity-50"
                                >
                                    {savingSupplier && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    {isEn ? 'Save & Select Now' : 'Lưu & Chọn Ngay'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
