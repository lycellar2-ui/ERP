'use client'

import React, { useState, useEffect } from 'react'
import {
    FileText,
    ArrowRight,
    ArrowLeft,
    Check,
    Download,
    Plus,
    Trash2,
    Building2,
    Calendar,
    DollarSign,
    ShieldCheck,
    Loader2,
    Sparkles,
    AlertCircle,
    Package,
} from 'lucide-react'
import {
    Drawer,
    Button,
    Badge,
    Field,
    Input,
    Select,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
} from '@/components/ui'
import {
    CONTRACT_TEMPLATES,
    ContractTemplateDefinition,
    getCounterpartyDetailAction,
    getAvailableProductsForContractAction,
    generateContractFromTemplateAction,
    GenerateContractPayload,
} from './template-actions'
import { getCounterparties } from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
    open: boolean
    onClose: () => void
    onSuccess: () => void
    initialTemplateCode?: string
}

type Counterparties = Awaited<ReturnType<typeof getCounterparties>>

interface ProductRow {
    stt: number
    ten_ruou: string
    nien_vu: string
    xuat_xu: string
    dvt: string
    so_luong: number
    don_gia: number
    thanh_tien: number
}

export function CreateFromTemplateDrawer({ open, onClose, onSuccess, initialTemplateCode }: Props) {
    const today = new Date().toISOString().slice(0, 10)
    const nextYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

    // Wizard Step: 1 = Chọn Mẫu, 2 = Điền Dữ Liệu, 3 = Xem Lại & Xuất
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateDefinition>(
        CONTRACT_TEMPLATES.find(t => t.code === initialTemplateCode) || CONTRACT_TEMPLATES[0]
    )

    // Counterparty & Master Data
    const [counterparties, setCounterparties] = useState<Counterparties | null>(null)
    const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; sku: string; name: string; country: string; wholesalePrice: number }>>([])
    const [loadingCounterparty, setLoadingCounterparty] = useState(false)

    // Form State
    const [counterpartyType, setCounterpartyType] = useState<'customer' | 'supplier'>('customer')
    const [selectedCounterpartyId, setSelectedCounterpartyId] = useState('')

    const [form, setForm] = useState({
        so_hop_dong: `HĐ-${Date.now().toString().slice(-6)}/2026-LYS`,
        ngay_ky: today,
        ngay_hieu_luc: today,
        ngay_het_han: nextYear,
        so_hd_goc: '',

        // Bên B
        ten_ben_b: '',
        mst_ben_b: '',
        dia_chi_ben_b: '',
        sdt_ben_b: '',
        email_ben_b: '',
        dai_dien_ben_b: '',
        chuc_vu_ben_b: 'Đại diện theo pháp luật',
        so_tk_ben_b: '',
        ngan_hang_ben_b: '',

        // Terms
        tien_te: 'VNĐ',
        han_muc_cong_no: 300000000,
        thoi_han_thanh_toan: 30,
        dia_diem_giao_hang: 'Tại kho hoặc địa chỉ chỉ định của Bên Mua',
        ngay_giao_hang: '',

        // Phụ lục Ký gửi
        ty_le_hoa_hong: 15,
        ngay_doi_soat: 25,

        // Hợp đồng một lần
        ty_le_dat_coc: 30,
    })

    const [products, setProducts] = useState<ProductRow[]>([
        {
            stt: 1,
            ten_ruou: 'Vang Đỏ Château Margaux Premier Grand Cru Classé',
            nien_vu: '2018',
            xuat_xu: 'Pháp',
            dvt: 'Chai',
            so_luong: 6,
            don_gia: 28500000,
            thanh_tien: 171000000,
        },
    ])

    const [generating, setGenerating] = useState(false)

    // Load initial counterparties & products
    useEffect(() => {
        if (open) {
            getCounterparties().then(setCounterparties)
            getAvailableProductsForContractAction().then(res => {
                if (res.success && res.data) setAvailableProducts(res.data)
            })
            if (initialTemplateCode) {
                const found = CONTRACT_TEMPLATES.find(t => t.code === initialTemplateCode)
                if (found) {
                    setSelectedTemplate(found)
                    setStep(2)
                }
            }
        }
    }, [open, initialTemplateCode])

    // Auto-prefix contract number according to template
    const handleSelectTemplate = (tpl: ContractTemplateDefinition) => {
        setSelectedTemplate(tpl)
        const prefix = tpl.code === 'HD_NGUYEN_TAC' ? 'HĐNT' : tpl.code === 'HD_KY_GUI' ? 'PLKG' : 'HĐMB'
        setForm(prev => ({
            ...prev,
            so_hop_dong: `${prefix}-${Date.now().toString().slice(-4)}/2026-LYS`,
        }))
        setStep(2)
    }

    // Auto-fill Bên B when counterpart selected
    const handleCounterpartyChange = async (type: 'customer' | 'supplier', id: string) => {
        setSelectedCounterpartyId(id)
        if (!id) return

        setLoadingCounterparty(true)
        const res = await getCounterpartyDetailAction(type, id)
        setLoadingCounterparty(false)

        if (res.success && res.data) {
            const d = res.data
            setForm(prev => ({
                ...prev,
                ten_ben_b: d.name,
                mst_ben_b: d.taxId,
                dia_chi_ben_b: d.address,
                sdt_ben_b: d.phone,
                email_ben_b: d.email,
                dai_dien_ben_b: d.representative,
                chuc_vu_ben_b: d.title || 'Đại diện theo pháp luật',
                han_muc_cong_no: d.creditLimit > 0 ? d.creditLimit : prev.han_muc_cong_no,
            }))
        }
    }

    // Calculations
    const itemsTotal = products.reduce((acc, item) => acc + (item.so_luong * item.don_gia), 0)
    const vatAmount = Math.round(itemsTotal * 0.1)
    const grandTotal = selectedTemplate.code === 'HD_NGUYEN_TAC'
        ? Number(form.han_muc_cong_no)
        : selectedTemplate.code === 'HD_MOT_LAN'
            ? itemsTotal + vatAmount
            : itemsTotal

    const depositAmount = Math.round((grandTotal * (Number(form.ty_le_dat_coc) || 30)) / 100)

    // Product rows handlers
    const addProductRow = () => {
        setProducts(prev => [
            ...prev,
            {
                stt: prev.length + 1,
                ten_ruou: '',
                nien_vu: '-',
                xuat_xu: 'Pháp',
                dvt: 'Chai',
                so_luong: 1,
                don_gia: 0,
                thanh_tien: 0,
            },
        ])
    }

    const removeProductRow = (index: number) => {
        setProducts(prev => prev.filter((_, idx) => idx !== index).map((p, i) => ({ ...p, stt: i + 1 })))
    }

    const updateProductRow = (index: number, field: keyof ProductRow, val: any) => {
        setProducts(prev => {
            const next = [...prev]
            const cur = { ...next[index], [field]: val }
            if (field === 'so_luong' || field === 'don_gia') {
                cur.thanh_tien = Number(cur.so_luong) * Number(cur.don_gia)
            }
            next[index] = cur
            return next
        })
    }

    const selectPresetProduct = (index: number, productId: string) => {
        const prod = availableProducts.find(p => p.id === productId)
        if (!prod) return
        setProducts(prev => {
            const next = [...prev]
            const price = prod.wholesalePrice || 1000000
            next[index] = {
                ...next[index],
                ten_ruou: prod.name,
                xuat_xu: prod.country || 'Nhập khẩu',
                don_gia: price,
                thanh_tien: next[index].so_luong * price,
            }
            return next
        })
    }

    // Submit & Download
    const handleGenerate = async () => {
        if (!form.so_hop_dong.trim()) {
            toast.error('Vui lòng nhập số hợp đồng')
            return
        }
        if (!form.ten_ben_b.trim()) {
            toast.error('Vui lòng nhập hoặc chọn đối tác Bên B')
            return
        }

        setGenerating(true)
        const payload: GenerateContractPayload = {
            templateCode: selectedTemplate.code,
            so_hop_dong: form.so_hop_dong,
            ngay_ky: form.ngay_ky,
            ngay_hieu_luc: form.ngay_hieu_luc,
            ngay_het_han: form.ngay_het_han,
            so_hd_goc: form.so_hd_goc,

            ten_ben_b: form.ten_ben_b,
            mst_ben_b: form.mst_ben_b,
            dia_chi_ben_b: form.dia_chi_ben_b,
            sdt_ben_b: form.sdt_ben_b,
            email_ben_b: form.email_ben_b,
            dai_dien_ben_b: form.dai_dien_ben_b,
            chuc_vu_ben_b: form.chuc_vu_ben_b,
            so_tk_ben_b: form.so_tk_ben_b,
            ngan_hang_ben_b: form.ngan_hang_ben_b,

            tien_te: form.tien_te,
            gia_tri_hop_dong: grandTotal,
            han_muc_cong_no: form.han_muc_cong_no,
            thoi_han_thanh_toan: form.thoi_han_thanh_toan,
            dia_diem_giao_hang: form.dia_diem_giao_hang,
            ngay_giao_hang: form.ngay_giao_hang,

            ty_le_hoa_hong: form.ty_le_hoa_hong,
            ngay_doi_soat: form.ngay_doi_soat,

            ty_le_dat_coc: form.ty_le_dat_coc,
            tien_dat_coc: depositAmount,

            san_pham: selectedTemplate.code !== 'HD_NGUYEN_TAC' ? products : undefined,

            counterpartyType: counterpartyType,
            counterpartyId: selectedCounterpartyId || 'adhoc',
            contractType: selectedTemplate.category,
        }

        const res = await generateContractFromTemplateAction(payload)
        setGenerating(false)

        if (!res.success || !res.fileBase64) {
            toast.error(res.error || 'Có lỗi khi sinh file hợp đồng')
            return
        }

        // Trigger browser download of generated .docx
        try {
            const byteCharacters = atob(res.fileBase64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            })
            const downloadUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = downloadUrl
            link.download = res.fileName || `Hop_Dong_${form.so_hop_dong}.docx`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(downloadUrl)

            toast.success(`Hợp đồng ${res.contractNo} đã được tạo và tải về thành công!`)
            onSuccess()
            onClose()
        } catch {
            toast.error('Lỗi khi tải file Word về máy')
        }
    }

    return (
        <Drawer
            open={open}
            onClose={onClose}
            size="xl"
            title="Tạo Hợp Đồng Từ Biểu Mẫu Word (.docx)"
            description="Lựa chọn biểu mẫu chuẩn ngành rượu, điền thông tin và xuất file Word hoàn chỉnh"
            footer={
                <div className="flex items-center justify-between w-full">
                    {step > 1 ? (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setStep((s) => (s - 1) as any)}
                        >
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            Quay Lại
                        </Button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2">
                        {step === 1 && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setStep(2)}
                            >
                                Tiếp Tục Điền Form
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        )}

                        {step === 2 && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    if (!form.ten_ben_b) {
                                        toast.error('Vui lòng nhập hoặc chọn đối tác Bên B')
                                        return
                                    }
                                    setStep(3)
                                }}
                            >
                                Xem Lại & Xác Nhận
                                <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                        )}

                        {step === 3 && (
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={generating}
                                onClick={handleGenerate}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Đang Merge & Sinh Word...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-1.5" />
                                        Sinh & Tải File Word (.docx)
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            {/* Step Indicator */}
            <div className="px-6 py-3 bg-slate-50 border-b border-lys-border flex items-center justify-between text-xs">
                <div className={`flex items-center gap-2 font-medium ${step === 1 ? 'text-lys-primary font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-lys-primary text-white' : 'bg-slate-200'}`}>1</span>
                    1. Chọn Biểu Mẫu
                </div>
                <div className="w-8 h-[1px] bg-slate-300" />
                <div className={`flex items-center gap-2 font-medium ${step === 2 ? 'text-lys-primary font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-lys-primary text-white' : 'bg-slate-200'}`}>2</span>
                    2. Điền Dữ Liệu Form
                </div>
                <div className="w-8 h-[1px] bg-slate-300" />
                <div className={`flex items-center gap-2 font-medium ${step === 3 ? 'text-lys-primary font-semibold' : 'text-slate-500'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-lys-primary text-white' : 'bg-slate-200'}`}>3</span>
                    3. Xem Lại & Xuất DOCX
                </div>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-210px)]">
                {/* ─────────────────────────────────────────────────────────────
                    BƯỚC 1: CHỌN MẪU BIỂU
                ───────────────────────────────────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="text-sm text-slate-600 mb-2">
                            Chọn một trong các mẫu hợp đồng chuẩn dưới đây để hệ thống nạp khung dữ liệu và mẫu Word tương ứng:
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {CONTRACT_TEMPLATES.map((tpl) => {
                                const isSelected = selectedTemplate.code === tpl.code
                                return (
                                    <div
                                        key={tpl.code}
                                        onClick={() => handleSelectTemplate(tpl)}
                                        className={`cursor-pointer rounded-xl border p-5 transition-all relative flex flex-col justify-between ${
                                            isSelected
                                                ? 'border-lys-primary bg-amber-50/40 ring-2 ring-lys-primary/20 shadow-md'
                                                : 'border-lys-border bg-white hover:border-slate-400 hover:shadow-sm'
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-lys-primary text-white flex items-center justify-center">
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        )}

                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge tone={tpl.code === 'HD_NGUYEN_TAC' ? 'brand' : tpl.code === 'HD_KY_GUI' ? 'warning' : 'success'}>
                                                    {tpl.badgeText}
                                                </Badge>
                                            </div>
                                            <h3 className="font-semibold text-slate-800 text-sm mb-2">{tpl.name}</h3>
                                            <p className="text-xs text-slate-500 leading-relaxed">{tpl.description}</p>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                            <span>Mẫu: {tpl.code}.docx</span>
                                            <span className="text-lys-primary font-medium flex items-center gap-1">
                                                Chọn mẫu <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    BƯỚC 2: ĐIỀN FORM DỮ LIỆU
                ───────────────────────────────────────────────────────────── */}
                {step === 2 && (
                    <div className="space-y-6">
                        {/* Selected Template Badge Banner */}
                        <div className="flex items-center justify-between p-3.5 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-lys-primary" />
                                <div>
                                    <div className="text-xs font-semibold text-lys-primary">Biểu mẫu đang áp dụng:</div>
                                    <div className="text-sm font-bold text-slate-800">{selectedTemplate.name}</div>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                                Đổi Mẫu Khác
                            </Button>
                        </div>

                        {/* SECTION A: ĐỐI TÁC (BÊN B) */}
                        <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                            <div className="flex items-center justify-between border-b border-lys-border pb-2.5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                    <Building2 className="w-4 h-4 text-lys-primary" />
                                    Thông Tin Đối Tác (Bên B)
                                </div>

                                {/* Chọn nhanh từ danh mục */}
                                <div className="flex items-center gap-2">
                                    <div className="flex border border-lys-border rounded-md overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => { setCounterpartyType('customer'); setSelectedCounterpartyId(''); }}
                                            className={`px-2.5 py-1 ${counterpartyType === 'customer' ? 'bg-lys-primary text-white font-medium' : 'bg-white text-slate-600'}`}
                                        >
                                            Khách Hàng
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setCounterpartyType('supplier'); setSelectedCounterpartyId(''); }}
                                            className={`px-2.5 py-1 ${counterpartyType === 'supplier' ? 'bg-lys-primary text-white font-medium' : 'bg-white text-slate-600'}`}
                                        >
                                            Nhà Cung Cấp
                                        </button>
                                    </div>

                                    {counterparties && (
                                        <select
                                            className="px-2.5 py-1 text-xs border border-lys-border rounded-md bg-white focus:outline-none focus:border-lys-primary"
                                            value={selectedCounterpartyId}
                                            onChange={(e) => handleCounterpartyChange(counterpartyType, e.target.value)}
                                        >
                                            <option value="">-- Chọn để tự điền dữ liệu --</option>
                                            {counterpartyType === 'customer'
                                                ? counterparties.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                                                : counterparties.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                            }
                                        </select>
                                    )}

                                    {loadingCounterparty && <Loader2 className="w-4 h-4 animate-spin text-lys-primary" />}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Field label="Tên đơn vị / Khách hàng / NCC (Bên B) *" description="Tên trên hóa đơn & hợp đồng">
                                    <Input
                                        value={form.ten_ben_b}
                                        onChange={e => setForm({ ...form, ten_ben_b: e.target.value })}
                                        placeholder="Ví dụ: CÔNG TY TNHH NHÀ HÀNG LA TABLE"
                                    />
                                </Field>

                                <Field label="Mã Số Thuế (MST)">
                                    <Input
                                        value={form.mst_ben_b}
                                        onChange={e => setForm({ ...form, mst_ben_b: e.target.value })}
                                        placeholder="Ví dụ: 0312345678"
                                    />
                                </Field>

                                <div className="md:col-span-2">
                                    <Field label="Địa Chỉ Trụ Sở / Đăng Ký">
                                        <Input
                                            value={form.dia_chi_ben_b}
                                            onChange={e => setForm({ ...form, dia_chi_ben_b: e.target.value })}
                                            placeholder="Địa chỉ trụ sở chính hoặc cơ sở nhận hàng"
                                        />
                                    </Field>
                                </div>

                                <Field label="Người Đại Diện Ký">
                                    <Input
                                        value={form.dai_dien_ben_b}
                                        onChange={e => setForm({ ...form, dai_dien_ben_b: e.target.value })}
                                        placeholder="Ông / Bà..."
                                    />
                                </Field>

                                <Field label="Chức Vụ Đại Diện">
                                    <Input
                                        value={form.chuc_vu_ben_b}
                                        onChange={e => setForm({ ...form, chuc_vu_ben_b: e.target.value })}
                                        placeholder="Giám Đốc, Tổng Giám Đốc..."
                                    />
                                </Field>

                                <Field label="Số Điện Thoại">
                                    <Input
                                        value={form.sdt_ben_b}
                                        onChange={e => setForm({ ...form, sdt_ben_b: e.target.value })}
                                        placeholder="Số điện thoại liên hệ"
                                    />
                                </Field>

                                <Field label="Email Liên Hệ">
                                    <Input
                                        value={form.email_ben_b}
                                        onChange={e => setForm({ ...form, email_ben_b: e.target.value })}
                                        placeholder="email@doitac.vn"
                                    />
                                </Field>
                            </div>
                        </div>

                        {/* SECTION B: THÔNG TIN HỢP ĐỒNG & THỜI HẠN */}
                        <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-lys-border pb-2.5">
                                <Calendar className="w-4 h-4 text-lys-primary" />
                                Số Hợp Đồng & Thời Hạn Hiệu Lực
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <Field label="Số Hợp Đồng *">
                                        <Input
                                            value={form.so_hop_dong}
                                            onChange={e => setForm({ ...form, so_hop_dong: e.target.value })}
                                        />
                                    </Field>
                                </div>

                                <Field label="Ngày Ký">
                                    <Input
                                        type="date"
                                        value={form.ngay_ky}
                                        onChange={e => setForm({ ...form, ngay_ky: e.target.value })}
                                    />
                                </Field>

                                <Field label="Thời Hạn Thanh Toán (Ngày)">
                                    <Input
                                        type="number"
                                        value={form.thoi_han_thanh_toan}
                                        onChange={e => setForm({ ...form, thoi_han_thanh_toan: Number(e.target.value) })}
                                        placeholder="30"
                                    />
                                </Field>

                                <Field label="Ngày Hiệu Lực">
                                    <Input
                                        type="date"
                                        value={form.ngay_hieu_luc}
                                        onChange={e => setForm({ ...form, ngay_hieu_luc: e.target.value })}
                                    />
                                </Field>

                                <Field label="Ngày Hết Hạn">
                                    <Input
                                        type="date"
                                        value={form.ngay_het_han}
                                        onChange={e => setForm({ ...form, ngay_het_han: e.target.value })}
                                    />
                                </Field>

                                <div className="md:col-span-2">
                                    <Field label="Địa Điểm Giao Hàng">
                                        <Input
                                            value={form.dia_diem_giao_hang}
                                            onChange={e => setForm({ ...form, dia_diem_giao_hang: e.target.value })}
                                        />
                                    </Field>
                                </div>
                            </div>
                        </div>

                        {/* SECTION C: ĐIỀU KHOẢN ĐẶC THÙ THEO LOẠI MẪU */}
                        {selectedTemplate.code === 'HD_NGUYEN_TAC' && (
                            <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-lys-border pb-2.5">
                                    <DollarSign className="w-4 h-4 text-lys-primary" />
                                    Điều Khoản Hạn Mức Tín Dụng & Công Nợ
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Field label="Hạn Mức Công Nợ Tối Đa (VNĐ)">
                                        <Input
                                            type="number"
                                            value={form.han_muc_cong_no}
                                            onChange={e => setForm({ ...form, han_muc_cong_no: Number(e.target.value) })}
                                        />
                                    </Field>
                                    <div className="flex flex-col justify-center text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="font-semibold text-slate-700">Giá trị bằng số:</span>
                                        <span className="text-sm font-bold text-lys-primary">{formatVND(form.han_muc_cong_no)}</span>
                                        <span className="mt-1 italic">Hệ thống sẽ tự động đọc số tiền thành chữ trong file Word.</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedTemplate.code === 'HD_KY_GUI' && (
                            <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-lys-border pb-2.5">
                                    <ShieldCheck className="w-4 h-4 text-lys-primary" />
                                    Điều Khoản Ký Gửi & Hoa Hồng
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Số HĐ Nguyên Tắc Gốc">
                                        <Input
                                            value={form.so_hd_goc}
                                            onChange={e => setForm({ ...form, so_hd_goc: e.target.value })}
                                            placeholder="Ví dụ: HĐNT-2026/01-LYS"
                                        />
                                    </Field>
                                    <Field label="Tỷ Lệ Hoa Hồng / Chiết Khấu (%)">
                                        <Input
                                            type="number"
                                            value={form.ty_le_hoa_hong}
                                            onChange={e => setForm({ ...form, ty_le_hoa_hong: Number(e.target.value) })}
                                        />
                                    </Field>
                                    <Field label="Ngày Đối Soát Hàng Tháng">
                                        <Input
                                            type="number"
                                            value={form.ngay_doi_soat}
                                            onChange={e => setForm({ ...form, ngay_doi_soat: Number(e.target.value) })}
                                            placeholder="25"
                                        />
                                    </Field>
                                </div>
                            </div>
                        )}

                        {selectedTemplate.code === 'HD_MOT_LAN' && (
                            <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-lys-border pb-2.5">
                                    <DollarSign className="w-4 h-4 text-lys-primary" />
                                    Điều Khoản Đặt Cọc & Giao Hàng
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field label="Tỷ Lệ Đặt Cọc (%)">
                                        <Input
                                            type="number"
                                            value={form.ty_le_dat_coc}
                                            onChange={e => setForm({ ...form, ty_le_dat_coc: Number(e.target.value) })}
                                        />
                                    </Field>
                                    <Field label="Ngày Giao Hàng Dự Kiến">
                                        <Input
                                            type="date"
                                            value={form.ngay_giao_hang}
                                            onChange={e => setForm({ ...form, ngay_giao_hang: e.target.value })}
                                        />
                                    </Field>
                                    <div className="flex flex-col justify-center text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                        <span>Tiền cọc ước tính:</span>
                                        <span className="text-sm font-bold text-amber-600">{formatVND(depositAmount)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECTION D: BẢNG SẢN PHẨM RƯỢU CHI TIẾT (Với Ký gửi & Một lần) */}
                        {selectedTemplate.code !== 'HD_NGUYEN_TAC' && (
                            <div className="p-4 rounded-xl border border-lys-border bg-white space-y-4">
                                <div className="flex items-center justify-between border-b border-lys-border pb-2.5">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                        <Package className="w-4 h-4 text-lys-primary" />
                                        Danh Mục Sản Phẩm Rượu Kèm Theo ({products.length} dòng)
                                    </div>
                                    <Button variant="secondary" size="sm" onClick={addProductRow}>
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        Thêm Dòng
                                    </Button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border border-lys-border">
                                        <thead className="bg-slate-50 border-b border-lys-border text-slate-600">
                                            <tr>
                                                <th className="p-2 w-10 text-center">STT</th>
                                                <th className="p-2 min-w-[220px]">Tên Rượu / Chọn Từ Kho</th>
                                                <th className="p-2 w-20">Niên Vụ</th>
                                                <th className="p-2 w-20">ĐVT</th>
                                                <th className="p-2 w-20 text-right">SL</th>
                                                <th className="p-2 w-32 text-right">Đơn Giá (VNĐ)</th>
                                                <th className="p-2 w-36 text-right">Thành Tiền</th>
                                                <th className="p-2 w-10 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-lys-border">
                                            {products.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="p-2 text-center text-slate-400">{row.stt}</td>
                                                    <td className="p-2 space-y-1">
                                                        <Input
                                                            value={row.ten_ruou}
                                                            onChange={e => updateProductRow(idx, 'ten_ruou', e.target.value)}
                                                            placeholder="Nhập tên rượu..."
                                                            className="text-xs h-7"
                                                        />
                                                        {availableProducts.length > 0 && (
                                                            <select
                                                                className="w-full text-[11px] p-1 border border-slate-200 rounded text-slate-500 bg-slate-50"
                                                                onChange={e => selectPresetProduct(idx, e.target.value)}
                                                                defaultValue=""
                                                            >
                                                                <option value="" disabled>-- Chọn nhanh từ danh mục kho --</option>
                                                                {availableProducts.map(p => (
                                                                    <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="p-2">
                                                        <Input
                                                            value={row.nien_vu}
                                                            onChange={e => updateProductRow(idx, 'nien_vu', e.target.value)}
                                                            className="text-xs h-7 text-center"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input
                                                            value={row.dvt}
                                                            onChange={e => updateProductRow(idx, 'dvt', e.target.value)}
                                                            className="text-xs h-7 text-center"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input
                                                            type="number"
                                                            value={row.so_luong}
                                                            onChange={e => updateProductRow(idx, 'so_luong', Number(e.target.value))}
                                                            className="text-xs h-7 text-right"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input
                                                            type="number"
                                                            value={row.don_gia}
                                                            onChange={e => updateProductRow(idx, 'don_gia', Number(e.target.value))}
                                                            className="text-xs h-7 text-right"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-right font-semibold text-slate-700">
                                                        {formatVND(row.thanh_tien)}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        {products.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeProductRow(idx)}
                                                                className="text-rose-500 hover:text-rose-700"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Financial Summary */}
                                <div className="flex justify-end pt-2">
                                    <div className="w-72 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-lys-border">
                                        <div className="flex justify-between">
                                            <span>Tiền hàng trước thuế:</span>
                                            <span className="font-semibold text-slate-800">{formatVND(itemsTotal)}</span>
                                        </div>
                                        {selectedTemplate.code === 'HD_MOT_LAN' && (
                                            <div className="flex justify-between">
                                                <span>Thuế VAT (10%):</span>
                                                <span className="font-semibold text-slate-800">{formatVND(vatAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-lys-primary">
                                            <span>TỔNG GIÁ TRỊ:</span>
                                            <span>{formatVND(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─────────────────────────────────────────────────────────────
                    BƯỚC 3: XEM LẠI & XUẤT FILE DOCX
                ───────────────────────────────────────────────────────────── */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-emerald-900 text-sm">Hợp đồng đã sẵn sàng để sinh văn bản</h3>
                                <p className="text-xs text-emerald-700 mt-1">
                                    Dữ liệu form đã được kiểm tra hợp lệ. Khi bấm nút xuất bên dưới, hệ thống sẽ điền dữ liệu vào mẫu Word chuẩn, tạo bản ghi quản lý trên ERP và tải trực tiếp file .docx về máy của bạn.
                                </p>
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="p-5 rounded-xl border border-lys-border bg-white space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tóm Tắt Hợp Đồng</h4>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-slate-500">Mẫu biểu:</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">{selectedTemplate.name}</div>
                                </div>
                                <div>
                                    <span className="text-slate-500">Số hợp đồng:</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">{form.so_hop_dong}</div>
                                </div>
                                <div>
                                    <span className="text-slate-500">Bên A (Bán/Cung cấp):</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">CÔNG TY CỔ PHẦN LY&apos;S CELLARS</div>
                                </div>
                                <div>
                                    <span className="text-slate-500">Bên B (Đối tác):</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">{form.ten_ben_b}</div>
                                </div>
                                <div>
                                    <span className="text-slate-500">Thời hạn hợp đồng:</span>
                                    <div className="font-semibold text-slate-800 mt-0.5">{formatDate(form.ngay_hieu_luc)} → {formatDate(form.ngay_het_han)}</div>
                                </div>
                                <div>
                                    <span className="text-slate-500">Tổng giá trị hợp đồng:</span>
                                    <div className="text-base font-bold text-lys-primary mt-0.5">{formatVND(grandTotal)}</div>
                                </div>
                            </div>

                            {selectedTemplate.code !== 'HD_NGUYEN_TAC' && (
                                <div className="mt-4 pt-4 border-t border-lys-border text-xs text-slate-500">
                                    Danh mục hàng hóa đính kèm: <span className="font-semibold text-slate-800">{products.length} mã sản phẩm rượu</span>.
                                </div>
                            )}
                        </div>

                        {/* Format Note */}
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 border border-slate-200">
                            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>
                                File xuất ra là định dạng <strong>Microsoft Word (.docx)</strong> chuẩn trang in A4, font Times New Roman, cho phép tùy chỉnh câu chữ tự do trước khi ký tên & đóng dấu.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Drawer>
    )
}
