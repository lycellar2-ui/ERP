'use client'

import { useState, useCallback, useEffect } from 'react'
import {
    Plus, Building2, Globe, Clock, X, Save, Loader2, AlertCircle, Award, Copy, Upload,
    Download, Search, Edit2, Trash2, Eye,
} from 'lucide-react'
import {
    SupplierRow, SupplierInput, SupplierStats, SupplierFilters,
    createSupplier, updateSupplier, getSuppliers, getSupplierById,
    deleteSupplier, exportSuppliersData, bulkImportSuppliers,
    getAllSupplierScorecards, detectDuplicates,
    type SupplierScorecard, type DuplicateCandidate,
} from './actions'
import { ExcelImportDialog } from '@/components/ExcelImportDialog'
import { SupplierDetailDrawer } from './SupplierDetailDrawer'
import { PageHeader, StatGrid, StatCard, Button, useConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'

const SUPPLIER_TYPE: Record<string, { label: string; color: string; bg: string }> = {
    WINERY: { label: 'Winery', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    NEGOCIANT: { label: 'Négociant', color: '#0D9488', bg: 'rgba(13, 148, 136, 0.12)' },
    DISTRIBUTOR: { label: 'Distributor', color: '#15803D', bg: 'rgba(21, 128, 61, 0.12)' },
    LOGISTICS: { label: 'Kho bãi & Vận tải', color: '#B45309', bg: 'rgba(180, 83, 9, 0.12)' },
    FORWARDER: { label: 'Forwarder', color: '#1D4ED8', bg: 'rgba(29, 78, 216, 0.12)' },
    CUSTOMS_BROKER: { label: 'Thủ tục HQ', color: '#475569', bg: 'rgba(71, 85, 105, 0.12)' },
    PACKAGING: { label: 'Bao bì & In ấn', color: '#C2410C', bg: 'rgba(194, 65, 12, 0.12)' },
    POSM: { label: 'POSM & Vật phẩm', color: '#047857', bg: 'rgba(4, 120, 87, 0.12)' },
    MARKETING_EVENT: { label: 'Sự kiện & MKT', color: '#E11D48', bg: 'rgba(225, 29, 72, 0.12)' },
    OFFICE_SERVICE: { label: 'Văn phòng & IT', color: '#0284C7', bg: 'rgba(2, 132, 199, 0.12)' },
    OTHER_SERVICE: { label: 'Dịch vụ khác', color: '#4B5563', bg: 'rgba(75, 85, 99, 0.12)' },
}

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    VN: '🇻🇳', 'Việt Nam': '🇻🇳', Vietnam: '🇻🇳', SG: '🇸🇬', JP: '🇯🇵', CN: '🇨🇳', GB: '🇬🇧', UK: '🇬🇧',
}

function TypeBadge({ type }: { type: string }) {
    const cfg = SUPPLIER_TYPE[type] ?? { label: type, color: '#475569', bg: 'rgba(168,152,128,0.12)' }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0" style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
}

function StatusDot({ status }: { status: string }) {
    const color = status === 'ACTIVE' ? '#15803D' : status === 'BLACKLISTED' ? '#B91C1C' : '#64748B'
    const label = status === 'ACTIVE' ? 'Hoạt động' : status === 'BLACKLISTED' ? 'Blacklist' : 'Tạm dừng'
    return <span className="flex items-center gap-1.5 text-xs" style={{ color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />{label}</span>
}

// ── Supplier Drawer (Create + Edit) ────────────────────
function SupplierDrawer({ open, editingId, onClose, onSaved }: {
    open: boolean; editingId: string | null; onClose: () => void; onSaved: () => void
}) {
    const [form, setForm] = useState<Partial<SupplierInput>>({
        defaultCurrency: 'VND', leadTimeDays: 7, status: 'ACTIVE', type: 'LOGISTICS', country: 'VN',
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const isEdit = !!editingId

    useEffect(() => {
        if (!open) return
        if (editingId) {
            setLoading(true)
            getSupplierById(editingId).then(data => {
                if (data) setForm({
                    code: data.code, name: data.name, type: data.type as any,
                    country: data.country, taxId: data.taxId, tradeAgreement: data.tradeAgreement,
                    coFormType: data.coFormType, paymentTerm: data.paymentTerm,
                    defaultCurrency: data.defaultCurrency, incoterms: data.incoterms,
                    leadTimeDays: data.leadTimeDays, status: data.status as any,
                    website: data.website, notes: data.notes,
                    pickupInfo: (data as any).pickupInfo, bankAccountInfo: (data as any).bankAccountInfo,
                    contactName: data.contactName, contactTitle: data.contactTitle,
                    contactEmail: data.contactEmail, contactPhone: data.contactPhone,
                    address: data.address, city: data.city, region: data.region,
                })
            }).finally(() => setLoading(false))
        } else {
            setForm({ defaultCurrency: 'VND', leadTimeDays: 7, status: 'ACTIVE', type: 'LOGISTICS', country: 'VN' })
        }
        setErrors({})
    }, [open, editingId])

    const set = (k: keyof SupplierInput, v: any) => setForm(f => ({ ...f, [k]: v }))
    const inputCls = "w-full px-3 py-2 rounded-md text-sm outline-none transition-colors focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
    const inputStyle = { background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }

    const handleCountryChange = (val: string) => {
        set('country', val)
        if (!isEdit) {
            if (val === 'VN') {
                setForm(prev => ({
                    ...prev,
                    country: 'VN',
                    defaultCurrency: 'VND',
                    leadTimeDays: prev.leadTimeDays === 45 ? 3 : (prev.leadTimeDays ?? 3),
                    tradeAgreement: null,
                    coFormType: null,
                }))
            } else if (val) {
                setForm(prev => ({
                    ...prev,
                    country: val,
                    defaultCurrency: ['FR', 'IT', 'ES', 'DE', 'PT'].includes(val) ? 'EUR' : 'USD',
                    leadTimeDays: prev.leadTimeDays === 3 || prev.leadTimeDays === 7 ? 45 : (prev.leadTimeDays ?? 45),
                }))
            }
        }
    }

    const handleSave = async () => {
        const e: Record<string, string> = {}
        if (!form.code) e.code = 'Bắt buộc'
        if (!form.name) e.name = 'Bắt buộc'
        if (!form.country) e.country = 'Bắt buộc'
        setErrors(e)
        if (Object.keys(e).length) return

        setSaving(true)
        try {
            if (isEdit) {
                const res = await updateSupplier(editingId!, form as SupplierInput)
                if (res.success) {
                    toast.success('Đã cập nhật NCC')
                    onSaved()
                } else {
                    toast.error(res.error ?? 'Lỗi cập nhật NCC')
                    setErrors({ _global: res.error ?? 'Lỗi cập nhật NCC' })
                }
            } else {
                const res = await createSupplier(form as SupplierInput)
                if (res.success) {
                    toast.success('Đã tạo NCC mới')
                    onSaved()
                } else {
                    toast.error(res.error ?? 'Lỗi tạo NCC')
                    setErrors({ _global: res.error ?? 'Lỗi tạo NCC' })
                }
            }
        } catch (err: any) {
            setErrors({ _global: err.message })
            toast.error(err.message ?? 'Đã xảy ra lỗi')
        } finally { setSaving(false) }
    }

    return (
        <>
            <div
                className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <div
                className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                style={{ width: 'min(580px, 95vw)' }}
            >
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan-600/10 border border-cyan-600/20 text-cyan-700 font-bold">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg">
                                {isEdit ? 'Chỉnh Sửa NCC' : 'Thêm Nhà Cung Cấp'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {isEdit ? 'Cập nhật thông tin đối tác cung ứng' : 'Đối tác trong nước (Việt Nam) & Quốc tế (Nhập khẩu)'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin" style={{ color: '#0891B2' }} /></div>
                    ) : (<>
                        {errors._global && (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                                style={{ background: 'rgba(185,28,28,0.15)', border: '1px solid rgba(185,28,28,0.4)', color: '#B91C1C' }}>
                                <AlertCircle size={14} /> {errors._global}
                            </div>
                        )}

                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#0891B2' }}>── Thông Tin Cơ Bản</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Mã NCC <span style={{ color: '#B91C1C' }}>*</span></label>
                                <input className={inputCls} style={inputStyle} value={form.code ?? ''} disabled={isEdit}
                                    onChange={e => set('code', e.target.value.toUpperCase())} placeholder={form.country === 'VN' ? 'NCC-LOG-01' : 'SUP-LVMH'} />
                                {errors.code && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.code}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Phân loại NCC</label>
                                <select className={inputCls} style={inputStyle} value={form.type ?? 'LOGISTICS'} onChange={e => set('type', e.target.value)}>
                                    <optgroup label="── Trong nước & Dịch vụ 🇻🇳 ──">
                                        <option value="LOGISTICS">Kho bãi & Vận tải nội địa (Logistics)</option>
                                        <option value="PACKAGING">Bao bì & In ấn (Hộp quà, tem nhãn)</option>
                                        <option value="POSM">POSM & Vật phẩm (Kệ tủ, ly nếm, decor)</option>
                                        <option value="MARKETING_EVENT">Sự kiện & Marketing (Tasting, Media)</option>
                                        <option value="OFFICE_SERVICE">Văn phòng & Thiết bị & IT</option>
                                        <option value="OTHER_SERVICE">Dịch vụ phụ trợ khác</option>
                                    </optgroup>
                                    <optgroup label="── Quốc tế & Nhập khẩu 🌍 ──">
                                        <option value="WINERY">Nhà làm rượu (Winery)</option>
                                        <option value="NEGOCIANT">Nhà thương mại rượu (Négociant)</option>
                                        <option value="DISTRIBUTOR">Nhà phân phối (Distributor)</option>
                                        <option value="FORWARDER">Hãng giao nhận vận tải (Forwarder)</option>
                                        <option value="CUSTOMS_BROKER">Đại lý thủ tục hải quan</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tên NCC <span style={{ color: '#B91C1C' }}>*</span></label>
                            <input className={inputCls} style={inputStyle} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder={form.country === 'VN' ? 'Công ty TNHH Vận Tải & Tiếp Vận Sài Gòn' : 'LVMH Wines & Spirits'} />
                            {errors.name && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.name}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Quốc gia <span style={{ color: '#B91C1C' }}>*</span></label>
                                <select className={inputCls} style={inputStyle} value={form.country ?? 'VN'} onChange={e => handleCountryChange(e.target.value)}>
                                    <option value="">Chọn quốc gia...</option>
                                    <optgroup label="── Trong nước 🇻🇳 ──">
                                        <option value="VN">🇻🇳 Việt Nam</option>
                                    </optgroup>
                                    <optgroup label="── Quốc tế (Nhập khẩu) 🌍 ──">
                                        <option value="FR">🇫🇷 Pháp (France)</option>
                                        <option value="IT">🇮🇹 Ý (Italy)</option>
                                        <option value="ES">🇪🇸 Tây Ban Nha (Spain)</option>
                                        <option value="CL">🇨🇱 Chile</option>
                                        <option value="AU">🇦🇺 Úc (Australia)</option>
                                        <option value="NZ">🇳🇿 New Zealand</option>
                                        <option value="US">🇺🇸 Hoa Kỳ (USA)</option>
                                        <option value="DE">🇩🇪 Đức (Germany)</option>
                                        <option value="PT">🇵🇹 Bồ Đào Nha (Portugal)</option>
                                        <option value="AR">🇦🇷 Argentina</option>
                                        <option value="ZA">🇿🇦 Nam Phi (South Africa)</option>
                                        <option value="SG">🇸🇬 Singapore</option>
                                        <option value="JP">🇯🇵 Nhật Bản (Japan)</option>
                                        <option value="CN">🇨🇳 Trung Quốc (China)</option>
                                        <option value="GB">🇬🇧 Vương quốc Anh (UK)</option>
                                    </optgroup>
                                </select>
                                {errors.country && <p className="text-xs mt-1" style={{ color: '#B91C1C' }}>{errors.country}</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Mã số thuế (MST)</label>
                                <input className={inputCls} style={inputStyle} value={form.taxId ?? ''} onChange={e => set('taxId', e.target.value || null)} placeholder={form.country === 'VN' ? '0312345678' : 'FR12345678901'} />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Liên Hệ Chính</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Người liên hệ</label>
                                <input className={inputCls} style={inputStyle} value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value || null)} placeholder={form.country === 'VN' ? 'Nguyễn Văn A' : 'Jean-Pierre Dupont'} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Chức vụ</label>
                                <input className={inputCls} style={inputStyle} value={form.contactTitle ?? ''} onChange={e => set('contactTitle', e.target.value || null)} placeholder={form.country === 'VN' ? 'Trưởng phòng kinh doanh' : 'Export Manager'} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Email</label>
                                <input className={inputCls} style={inputStyle} value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value || null)} placeholder="lienhe@doitac.vn" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Điện thoại</label>
                                <input className={inputCls} style={inputStyle} value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value || null)} placeholder="0903 123 456" />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Điều Khoản Thương Mại & Thanh Toán</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Hiệp định thương mại</label>
                                <select className={inputCls} style={inputStyle} value={form.tradeAgreement ?? ''} onChange={e => set('tradeAgreement', e.target.value || null)}>
                                    <option value="">{form.country === 'VN' ? 'Nội địa (Không áp dụng)' : 'Không / MFN'}</option>
                                    <option value="EVFTA">EVFTA (EU - VN)</option>
                                    <option value="AANZFTA">AANZFTA (Úc, NZ - VN)</option>
                                    <option value="CPTPP">CPTPP</option>
                                    <option value="UKVFTA">UKVFTA (Anh - VN)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>C/O Form</label>
                                <input className={inputCls} style={inputStyle} value={form.coFormType ?? ''} onChange={e => set('coFormType', e.target.value || null)} placeholder={form.country === 'VN' ? 'Không' : 'EUR.1 / Form AANZ'} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Thanh toán</label>
                                <select className={inputCls} style={inputStyle} value={form.paymentTerm ?? 'NET30'} onChange={e => set('paymentTerm', e.target.value)}>
                                    <option value="COD">Thanh toán khi nhận (COD)</option>
                                    <option value="NET15">Công nợ 15 ngày (NET15)</option>
                                    <option value="NET30">Công nợ 30 ngày (NET30)</option>
                                    <option value="NET45">Công nợ 45 ngày (NET45)</option>
                                    <option value="NET60">Công nợ 60 ngày (NET60)</option>
                                    <option value="NET90">Công nợ 90 ngày (NET90)</option>
                                    <option value="TT_ADVANCE">Tạm ứng trước (T/T Advance)</option>
                                    <option value="LC">Tín dụng thư (L/C)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tiền tệ mặc định</label>
                                <select 
                                    className={inputCls} 
                                    style={inputStyle} 
                                    value={form.defaultCurrency ?? 'VND'} 
                                    onChange={e => set('defaultCurrency', e.target.value)}
                                >
                                    <option value="VND">₫ VND (Việt Nam Đồng)</option>
                                    <option value="USD">$ USD (Đô la Mỹ)</option>
                                    <option value="EUR">€ EUR (Euro)</option>
                                    <option value="GBP">£ GBP (Bảng Anh)</option>
                                    <option value="AUD">A$ AUD (Đô la Úc)</option>
                                    <option value="NZD">NZ$ NZD (Đô la New Zealand)</option>
                                    <option value="SGD">S$ SGD (Đô la Singapore)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Lead time (ngày)</label>
                                <input type="number" className={inputCls} style={inputStyle} value={form.leadTimeDays ?? (form.country === 'VN' ? 3 : 45)} onChange={e => set('leadTimeDays', Number(e.target.value))} min={1} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Incoterms / Điểm giao</label>
                                <input className={inputCls} style={inputStyle} value={form.incoterms ?? ''} onChange={e => set('incoterms', e.target.value || null)} placeholder={form.country === 'VN' ? 'Giao tại kho TP.HCM' : 'CIF Ho Chi Minh'} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Website</label>
                                <input className={inputCls} style={inputStyle} value={form.website ?? ''} onChange={e => set('website', e.target.value || null)} placeholder="https://..." />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Điểm Nhận Hàng & Tài Khoản Ngân Hàng</p>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tài khoản ngân hàng thụ hưởng</label>
                                <input className={inputCls} style={inputStyle} value={form.bankAccountInfo ?? ''} onChange={e => set('bankAccountInfo', e.target.value || null)} placeholder="VD: 0071001234567 - Vietcombank CN Kỳ Đồng (Chủ TK: CTY TNHH ABC)" />
                                <p className="text-[11px] text-slate-400 mt-1">Cú pháp gợi ý: Số tài khoản - Tên ngân hàng - Chi nhánh (Chủ tài khoản)</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Thông tin lấy hàng (Pickup / Kho hàng)</label>
                                <input className={inputCls} style={inputStyle} value={form.pickupInfo ?? ''} onChange={e => set('pickupInfo', e.target.value || null)} placeholder="Kho Long Hậu, Cần Giuộc, Long An hoặc Kho Tân Bình..." />
                            </div>
                        </div>

                        <p className="text-xs uppercase tracking-widest font-bold pt-2" style={{ color: '#0891B2' }}>── Địa Chỉ & Trạng Thái</p>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Địa chỉ</label>
                            <input className={inputCls} style={inputStyle} value={form.address ?? ''} onChange={e => set('address', e.target.value || null)} placeholder="33 Rue du Commerce, Bordeaux" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Thành phố</label>
                                <input className={inputCls} style={inputStyle} value={form.city ?? ''} onChange={e => set('city', e.target.value || null)} placeholder="Bordeaux" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Vùng</label>
                                <input className={inputCls} style={inputStyle} value={form.region ?? ''} onChange={e => set('region', e.target.value || null)} placeholder="Nouvelle-Aquitaine" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Trạng thái</label>
                                <select className={inputCls} style={inputStyle} value={form.status ?? 'ACTIVE'} onChange={e => set('status', e.target.value as any)}>
                                    <option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm dừng</option><option value="BLACKLISTED">Blacklist</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Ghi chú nội bộ</label>
                            <textarea className={inputCls + ' resize-none'} style={{ ...inputStyle, minHeight: 60 }} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || null)} placeholder="Ghi chú..." />
                        </div>
                    </>)}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm" style={{ color: '#475569', border: '1px solid #E2E8F0' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving || loading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
                        style={{ background: '#0891B2', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo NCC'}
                    </button>
                </div>
            </div>
        </>
    )
}

// ── Main ───────────────────────────────────────────────────
export function SuppliersClient({ initialRows, initialTotal, stats }: { initialRows: SupplierRow[]; initialTotal: number; stats: SupplierStats }) {
    const [rows, setRows] = useState(initialRows)
    const [total, setTotal] = useState(initialTotal)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [regionScope, setRegionScope] = useState<'ALL' | 'DOMESTIC' | 'INTERNATIONAL'>('ALL')
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [importOpen, setImportOpen] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [detailId, setDetailId] = useState<string | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'scorecard' | 'duplicates'>('list')
    const [scorecards, setScorecards] = useState<SupplierScorecard[] | null>(null)
    const [scoreLoading, setScoreLoading] = useState(false)
    const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)
    const [dupLoading, setDupLoading] = useState(false)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    const reload = useCallback(async (s?: string, t?: string, st?: string, p?: number, r?: 'ALL' | 'DOMESTIC' | 'INTERNATIONAL') => {
        setLoading(true)
        try {
            const currentRegion = r !== undefined ? r : regionScope
            const result = await getSuppliers({
                search: (s ?? search) || undefined, 
                type: (t ?? typeFilter) || undefined,
                status: (st ?? statusFilter) || undefined, 
                regionScope: currentRegion === 'ALL' ? undefined : currentRegion,
                page: p ?? page, 
                pageSize: 25,
            })
            setRows(result.rows); setTotal(result.total)
        } finally { setLoading(false) }
    }, [search, typeFilter, statusFilter, page, regionScope])

    const handleDelete = (id: string, name: string) => {
        confirm({
            title: `Xóa Nhà Cung Cấp "${name}"`,
            message: (
                <div className="space-y-1">
                    <p>Bạn có chắc chắn muốn xóa NCC <strong>"{name}"</strong>?</p>
                    <p className="text-xs text-slate-500">NCC sẽ bị đánh dấu Tạm dừng. Nếu NCC đang có PO chưa hoàn tất sẽ không xóa được.</p>
                </div>
            ),
            confirmLabel: 'Xác Nhận Xóa',
            cancelLabel: 'Bỏ qua',
            danger: true,
            onConfirm: async () => {
                try {
                    const result = await deleteSupplier(id)
                    if (result.success) { toast.success(`Đã xóa "${name}"`); reload() }
                    else toast.error(result.error ?? 'Không thể xóa')
                } catch { toast.error('Lỗi khi xóa NCC') }
            }
        })
    }

    const handleExport = async () => {
        setExporting(true)
        try {
            const data = await exportSuppliersData()
            if (data.length === 0) { toast.error('Chưa có NCC để xuất'); return }
            const headers = Object.keys(data[0])
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(h => {
                    const val = String((row as any)[h] ?? '')
                    return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
                }).join(',')),
            ]
            const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `nha_cung_cap_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success(`Đã xuất ${data.length} NCC`)
        } catch { toast.error('Lỗi xuất dữ liệu') }
        finally { setExporting(false) }
    }

    const loadScorecards = async () => {
        setActiveTab('scorecard')
        if (scorecards) return
        setScoreLoading(true)
        setScorecards(await getAllSupplierScorecards())
        setScoreLoading(false)
    }

    const loadDuplicates = async () => {
        setActiveTab('duplicates')
        if (duplicates) return
        setDupLoading(true)
        setDuplicates(await detectDuplicates())
        setDupLoading(false)
    }

    const GRADE_COLOR: Record<string, { color: string; bg: string }> = {
        A: { color: '#15803D', bg: 'rgba(21,128,61,0.15)' }, B: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
        C: { color: '#B45309', bg: 'rgba(180,83,9,0.15)' }, D: { color: '#C07434', bg: 'rgba(192,116,52,0.15)' },
        F: { color: '#B91C1C', bg: 'rgba(185,28,28,0.15)' },
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <PageHeader
                title="Nhà Cung Cấp"
                description={`Đối tác cung ứng Trong nước (Việt Nam) & Quốc tế (Nhập khẩu) — ${stats.total} đối tác`}
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
                            <Download size={14} /> {exporting ? 'Đang xuất...' : 'Export CSV'}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                            <Upload size={14} /> Import Excel
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => { setEditingId(null); setDrawerOpen(true) }}>
                            <Plus size={14} /> Thêm NCC
                        </Button>
                    </div>
                }
            />

            {/* Stats */}
            <StatGrid>
                <StatCard 
                    label="Tổng Đối Tác" 
                    value={stats.total} 
                    icon={Building2} 
                    sub={`${stats.active} đang hoạt động`} 
                />
                <StatCard 
                    label="Trong Nước (Việt Nam)" 
                    value={stats.domesticCount ?? 0} 
                    icon={Building2} 
                    tone="success" 
                    sub="Vận tải, bao bì, POSM, DV" 
                />
                <StatCard 
                    label="Quốc Tế (Nhập Khẩu)" 
                    value={stats.internationalCount ?? 0} 
                    icon={Globe} 
                    tone="brand" 
                    sub={`${stats.countries} quốc gia`} 
                />
                <StatCard 
                    label="Lead Time TB" 
                    value={`${stats.avgLeadTime} ngày`} 
                    icon={Clock} 
                />
            </StatGrid>

            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#FFFFFF' }}>
                {([
                    { key: 'list', label: 'Danh Sách NCC', icon: Building2 },
                    { key: 'scorecard', label: 'Scorecard', icon: Award },
                    { key: 'duplicates', label: 'Phát Hiện Trùng', icon: Copy },
                ] as const).map(tab => (
                    <button key={tab.key}
                        onClick={() => tab.key === 'scorecard' ? loadScorecards() : tab.key === 'duplicates' ? loadDuplicates() : setActiveTab('list')}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer"
                        style={{
                            background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                            color: activeTab === tab.key ? '#0E7490' : '#64748B',
                            border: activeTab === tab.key ? '1px solid #E2E8F0' : '1px solid transparent',
                        }}>
                        <tab.icon size={13} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: NCC List */}
            {activeTab === 'list' && (<>
                {/* Segmented Region Switcher & Filters */}
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200">
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('ALL')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'ALL')
                                }}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'ALL'
                                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Tất cả ({stats.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('DOMESTIC')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'DOMESTIC')
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'DOMESTIC'
                                        ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>🇻🇳</span> Trong nước ({stats.domesticCount ?? 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRegionScope('INTERNATIONAL')
                                    setPage(1)
                                    reload(undefined, undefined, undefined, 1, 'INTERNATIONAL')
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                    regionScope === 'INTERNATIONAL'
                                        ? 'bg-white text-cyan-700 shadow-2xs border border-cyan-200'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span>🌍</span> Quốc tế ({stats.internationalCount ?? 0})
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Tìm NCC (tên, mã, MST, TK ngân hàng, email)..."
                                value={search} onChange={e => { setSearch(e.target.value); setPage(1); reload(e.target.value, undefined, undefined, 1) }}
                                className="w-full pl-9 pr-4 py-2 rounded-md text-sm outline-none transition-colors border border-slate-200 bg-white text-slate-900 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600" />
                        </div>
                        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); reload(undefined, e.target.value, undefined, 1) }}
                            className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer border border-slate-200 bg-white text-slate-900 focus:border-cyan-600">
                            <option value="">Tất cả phân loại ({Object.keys(SUPPLIER_TYPE).length})</option>
                            <optgroup label="── Trong nước & Dịch vụ 🇻🇳 ──">
                                <option value="LOGISTICS">Kho bãi & Vận tải</option>
                                <option value="PACKAGING">Bao bì & In ấn</option>
                                <option value="POSM">POSM & Vật phẩm</option>
                                <option value="MARKETING_EVENT">Sự kiện & MKT</option>
                                <option value="OFFICE_SERVICE">Văn phòng & IT</option>
                                <option value="OTHER_SERVICE">Dịch vụ khác</option>
                            </optgroup>
                            <optgroup label="── Quốc tế & Nhập khẩu 🌍 ──">
                                <option value="WINERY">Winery</option>
                                <option value="NEGOCIANT">Négociant</option>
                                <option value="DISTRIBUTOR">Distributor</option>
                                <option value="FORWARDER">Forwarder</option>
                                <option value="CUSTOMS_BROKER">Thủ tục HQ</option>
                            </optgroup>
                        </select>
                        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); reload(undefined, undefined, e.target.value, 1) }}
                            className="px-3 py-2 rounded-md text-sm outline-none cursor-pointer border border-slate-200 bg-white text-slate-900 focus:border-cyan-600">
                            <option value="">Tất cả trạng thái</option>
                            <option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Tạm dừng</option><option value="BLACKLISTED">Blacklist</option>
                        </select>
                        {(search || typeFilter || statusFilter || regionScope !== 'ALL') && (
                            <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setRegionScope('ALL'); setPage(1); reload('', '', '', 1, 'ALL') }}
                                className="px-3 py-2 rounded-md text-sm text-red-600 border border-red-200 hover:bg-red-50 transition-colors cursor-pointer">Xóa filter</button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                    {['Nhà Cung Cấp', 'Phân Loại', 'Quốc Gia', 'Hiệp Định / C/O', 'Thanh Toán', 'Lead Time', 'Đơn Hàng', 'Trạng Thái', ''].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                        {Array.from({ length: 9 }).map((_, j) => <td key={j} className="px-4 py-4"><div className="h-4 rounded animate-pulse" style={{ background: '#FFFFFF', width: j === 0 ? '80%' : '55%' }} /></td>)}
                                    </tr>
                                )) : rows.length === 0 ? (
                                    <tr><td colSpan={9}>
                                        <div className="flex flex-col items-center py-16 gap-3">
                                            <span className="text-3xl">🏭</span>
                                            <p style={{ color: '#64748B' }} className="text-sm">Chưa có nhà cung cấp nào phù hợp bộ lọc</p>
                                        </div>
                                    </td></tr>
                                ) : rows.map(row => {
                                    const isDomestic = row.country === 'VN' || row.country === 'Việt Nam' || row.country === 'Vietnam'
                                    return (
                                        <tr key={row.id} className="group transition-colors duration-100 cursor-pointer"
                                            style={{ borderBottom: '1px solid #E2E8F0' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                            onClick={() => { setDetailId(row.id); setDetailOpen(true) }}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{row.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-mono font-bold" style={{ color: '#0E7490' }}>{row.code}</span>
                                                    {row.taxId && <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-mono text-slate-600 whitespace-nowrap shrink-0">MST: {row.taxId}</span>}
                                                </div>
                                                {row.bankAccountInfo && (
                                                    <p className="text-[11px] mt-1 text-slate-500 truncate max-w-xs font-mono" title={row.bankAccountInfo}>
                                                        💳 {row.bankAccountInfo}
                                                    </p>
                                                )}
                                                {row.contactName && <p className="text-[10px] mt-0.5" style={{ color: '#1D4ED8' }}>👤 {row.contactName}</p>}
                                            </td>
                                            <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
                                            <td className="px-4 py-3 text-sm" style={{ color: '#475569' }}>
                                                <span className="inline-flex items-center gap-1.5 font-medium">
                                                    <span>{COUNTRY_FLAGS[row.country] ?? '🌍'}</span>
                                                    <span>{isDomestic ? 'Việt Nam' : row.country}</span>
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isDomestic ? (
                                                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap shrink-0">
                                                        Nội địa
                                                    </span>
                                                ) : (
                                                    <>
                                                        <p className="text-xs font-semibold" style={{ color: row.tradeAgreement ? '#15803D' : '#64748B' }}>{row.tradeAgreement ?? 'MFN'}</p>
                                                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{row.coFormType ?? '—'}</p>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs font-mono font-semibold" style={{ color: '#334155' }}>{row.paymentTerm ?? 'NET30'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-0.5">{row.defaultCurrency}</p>
                                            </td>
                                            <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs" style={{ color: '#475569' }}><Clock size={12} /> {row.leadTimeDays} ngày</span></td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-sm font-bold font-mono" style={{ color: row.poCount > 0 ? '#0E7490' : '#E2E8F0' }}>{row.poCount}</span>
                                            </td>
                                            <td className="px-4 py-3"><StatusDot status={row.status} /></td>
                                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => { setDetailId(row.id); setDetailOpen(true) }}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#1D4ED8' }} title="Chi tiết 360°">
                                                        <Eye size={14} />
                                                    </button>
                                                    <button onClick={() => { setEditingId(row.id); setDrawerOpen(true) }}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#475569' }} title="Chỉnh sửa">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(row.id, row.name)}
                                                        className="p-1.5 rounded-lg transition-all" style={{ color: '#64748B' }} title="Xóa">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {total > 0 && (
                        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                            <p className="text-xs" style={{ color: '#64748B' }}>
                                Hiển thị <span style={{ color: '#475569' }}>{(page - 1) * 25 + 1}–{Math.min(page * 25, total)}</span> trong <span style={{ color: '#475569' }}>{total}</span>
                            </p>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.ceil(total / 25) }).map((_, i) => (
                                    <button key={i} onClick={() => { setPage(i + 1); reload(undefined, undefined, undefined, i + 1) }}
                                        className="min-w-[32px] h-8 px-2 rounded-lg text-xs font-medium"
                                        style={{ background: page === i + 1 ? '#0E7490' : 'transparent', color: page === i + 1 ? '#F8FAFC' : '#475569' }}>
                                        {i + 1}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </>)}

            {/* Tab: Scorecard */}
            {activeTab === 'scorecard' && (
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    {scoreLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2"><Loader2 size={16} className="animate-spin" style={{ color: '#0891B2' }} /><span className="text-sm" style={{ color: '#64748B' }}>Đang tính Scorecard...</span></div>
                    ) : scorecards && scorecards.length > 0 ? (
                        <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                    {['NCC', 'Giao Đúng Hạn', 'Chất Lượng', 'Lead Time TB', 'Tổng PO', 'Xếp Hạng'].map(h => (
                                        <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {scorecards.map(sc => {
                                    const gc = GRADE_COLOR[sc.grade] ?? GRADE_COLOR.C
                                    return (
                                        <tr key={sc.supplierId} style={{ borderBottom: '1px solid #E2E8F0' }}>
                                            <td className="px-4 py-3"><p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{sc.supplierName}</p></td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 rounded-full" style={{ background: '#E2E8F0' }}>
                                                        <div className="h-full rounded-full" style={{ background: sc.onTimeRate >= 90 ? '#15803D' : sc.onTimeRate >= 70 ? '#B45309' : '#B91C1C', width: `${Math.min(sc.onTimeRate, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold" style={{ color: sc.onTimeRate >= 90 ? '#15803D' : sc.onTimeRate >= 70 ? '#B45309' : '#B91C1C' }}>{sc.onTimeRate.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><span className="text-xs font-bold" style={{ color: sc.qualityScore >= 90 ? '#15803D' : '#B45309' }}>{sc.qualityScore.toFixed(0)}/100</span></td>
                                            <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{sc.avgLeadTimeDays.toFixed(0)} ngày</td>
                                            <td className="px-4 py-3 text-xs text-center" style={{ color: '#0891B2' }}>{sc.totalPOs}</td>
                                            <td className="px-4 py-3"><span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold" style={{ background: gc.bg, color: gc.color }}>{sc.grade}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : <div className="text-center py-16 text-sm" style={{ color: '#64748B' }}>Chưa có dữ liệu scorecard</div>}
                </div>
            )}

            {/* Tab: Duplicate Detection */}
            {activeTab === 'duplicates' && (
                <div className="space-y-3">
                    {dupLoading ? (
                        <div className="flex items-center justify-center py-16 gap-2"><Loader2 size={16} className="animate-spin" style={{ color: '#B45309' }} /><span className="text-sm" style={{ color: '#64748B' }}>Đang quét trùng...</span></div>
                    ) : duplicates && duplicates.length > 0 ? (
                        duplicates.map((dup, i) => (
                            <div key={i} className="p-4 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid rgba(180,83,9,0.3)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="inline-block text-xs font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap shrink-0" style={{ color: '#B45309', background: 'rgba(180,83,9,0.12)' }}>
                                        {dup.type === 'PRODUCT' ? '📦 Sản phẩm' : dup.type === 'CUSTOMER' ? '👤 Khách hàng' : '🏭 NCC'}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: '#B45309' }}>{dup.similarity}% giống</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2 rounded" style={{ background: '#FFFFFF' }}>
                                        <p className="text-xs" style={{ color: '#64748B' }}>Mục 1</p>
                                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{dup.itemA.name}</p>
                                    </div>
                                    <div className="p-2 rounded" style={{ background: '#FFFFFF' }}>
                                        <p className="text-xs" style={{ color: '#64748B' }}>Mục 2</p>
                                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{dup.itemB.name}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <span className="text-3xl">✅</span>
                            <p className="text-sm mt-3" style={{ color: '#15803D' }}>Không phát hiện dữ liệu trùng lặp</p>
                        </div>
                    )}
                </div>
            )}

            <SupplierDrawer open={drawerOpen} editingId={editingId}
                onClose={() => setDrawerOpen(false)} onSaved={() => { setDrawerOpen(false); reload() }} />

            <SupplierDetailDrawer open={detailOpen} supplierId={detailId}
                onClose={() => setDetailOpen(false)} />

            <ExcelImportDialog open={importOpen} onClose={() => setImportOpen(false)}
                title="Import Nhà Cung Cấp" templateFileName="template_nha_cung_cap.xlsx"
                templateColumns={[
                    { header: 'Mã NCC', sample: 'SUP-MOUTON', required: true },
                    { header: 'Tên NCC', sample: 'Château Mouton Rothschild', required: true },
                    { header: 'Loại', sample: 'WINERY', required: true },
                    { header: 'Quốc Gia', sample: 'FR', required: true },
                    { header: 'MST', sample: 'FR123456789' },
                    { header: 'Hiệp Định', sample: 'EVFTA' },
                    { header: 'Thanh Toán', sample: 'NET30' },
                    { header: 'Tiền Tệ', sample: 'EUR' },
                    { header: 'Incoterms', sample: 'CIF' },
                    { header: 'Lead Time', sample: '45' },
                    { header: 'Website', sample: 'https://mouton.com' },
                    { header: 'Người Liên Hệ', sample: 'Jean-Pierre' },
                    { header: 'Email', sample: 'jp@mouton.com' },
                    { header: 'SĐT', sample: '+33 1 2345 6789' },
                ]}
                onImport={bulkImportSuppliers} onComplete={() => reload()} />
            {confirmDialog}
        </div>
    )
}
