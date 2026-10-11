'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    Search,
    BookOpen,
    Layers,
    Briefcase,
    Warehouse,
    ShoppingCart,
    CreditCard,
    Users,
    Clock,
    GitBranch,
    CheckCircle2,
    ExternalLink,
    ArrowRight,
    Sparkles,
    FileCheck,
    FileSpreadsheet,
    Download,
    Upload,
    Plus,
    FileText,
    Calendar,
    FolderKanban
} from 'lucide-react'
import { SOP_CATEGORIES, type SopCategory, type SopItem } from '@/data/sops'
import { type SopFormFile } from '@/data/forms-data'
import { SopDetailModal } from './SopDetailModal'
import { SopEditModal } from './SopEditModal'
import { SopFormUploadModal } from './SopFormUploadModal'

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
    Layers,
    Briefcase,
    Warehouse,
    ShoppingCart,
    CreditCard,
    Users
}

interface SopCatalogClientProps {
    initialSops: SopItem[]
    initialForms: SopFormFile[]
}

export function SopCatalogClient({ initialSops, initialForms }: SopCatalogClientProps) {
    const searchParams = useSearchParams()
    
    // Core data state
    const [sops, setSops] = useState<SopItem[]>(initialSops)
    const [forms, setForms] = useState<SopFormFile[]>(initialForms)

    // View mode: 'sops' or 'forms'
    const [activeView, setActiveView] = useState<'sops' | 'forms'>('sops')

    // Filter states
    const [selectedCategory, setSelectedCategory] = useState<SopCategory>('all')
    const [searchQuery, setSearchQuery] = useState('')
    
    // Modal states
    const [selectedSop, setSelectedSop] = useState<SopItem | null>(null)
    const [isCreatingSop, setIsCreatingSop] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [targetUploadFile, setTargetUploadFile] = useState<string | null>(null)

    // Deep link support via ?code=SOP-XXX
    useEffect(() => {
        const codeParam = searchParams.get('code')
        if (codeParam) {
            const found = sops.find(
                item => item.code.toLowerCase() === codeParam.toLowerCase() || item.id === codeParam.toLowerCase()
            )
            if (found) {
                setSelectedSop(found)
            }
        }
    }, [searchParams, sops])

    // Filter SOPs
    const filteredSops = useMemo(() => {
        return sops.filter(item => {
            const matchCategory = selectedCategory === 'all' || item.category === selectedCategory

            const query = searchQuery.trim().toLowerCase()
            if (!query) return matchCategory

            const matchQuery =
                item.title.toLowerCase().includes(query) ||
                item.code.toLowerCase().includes(query) ||
                item.department.toLowerCase().includes(query) ||
                item.summary.toLowerCase().includes(query) ||
                item.flowSteps.some(step =>
                    step.title.toLowerCase().includes(query) ||
                    step.role.toLowerCase().includes(query) ||
                    step.action.toLowerCase().includes(query)
                )

            return matchCategory && matchQuery
        })
    }, [sops, selectedCategory, searchQuery])

    // Filter Forms
    const filteredForms = useMemo(() => {
        return forms.filter(form => {
            const matchCat =
                selectedCategory === 'all' ||
                form.category === selectedCategory ||
                (selectedCategory === 'sales' && form.category === 'sales') ||
                (selectedCategory === 'finance' && form.category === 'finance') ||
                (selectedCategory === 'warehouse' && form.category === 'warehouse') ||
                (selectedCategory === 'procurement' && form.category === 'procurement')

            const query = searchQuery.trim().toLowerCase()
            if (!query) return matchCat

            const matchQuery =
                form.code.toLowerCase().includes(query) ||
                form.title.toLowerCase().includes(query) ||
                form.fileName.toLowerCase().includes(query)

            return matchCat && matchQuery
        })
    }, [forms, selectedCategory, searchQuery])

    // Stats
    const totalSteps = useMemo(() => {
        return sops.reduce((sum, item) => sum + item.flowSteps.length, 0)
    }, [sops])

    const totalChecklists = useMemo(() => {
        return sops.reduce((sum, item) => sum + item.checklist.length, 0)
    }, [sops])

    const handleSopUpdated = (updated: SopItem) => {
        setSops(prev => {
            const idx = prev.findIndex(s => s.id === updated.id)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = updated
                return copy
            }
            return [updated, ...prev]
        })
        if (selectedSop?.id === updated.id) {
            setSelectedSop(updated)
        }
    }

    const handleFormUploaded = (newForm: SopFormFile) => {
        setForms(prev => {
            const idx = prev.findIndex(f => f.fileName === newForm.fileName)
            if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = newForm
                return copy
            }
            return [newForm, ...prev]
        })
    }

    // New draft template for creating
    const newDraftSop: SopItem = {
        id: `sop-custom-${Date.now()}`,
        code: `SOP-NEW`,
        title: 'Quy Trình Mới',
        titleEn: 'New Procedure',
        category: 'sales',
        department: 'Phòng Ban',
        departmentEn: 'Department',
        summary: 'Tóm tắt nội dung quy trình mới...',
        purpose: 'Mục đích quy trình...',
        scope: 'Phạm vi áp dụng...',
        estimatedDuration: '30 phút',
        effectiveDate: new Date().toISOString().split('T')[0],
        version: 'v1.0',
        raci: {
            responsible: ['Người thực hiện'],
            accountable: ['Người phê duyệt'],
            consulted: ['Bên tư vấn'],
            informed: ['Bên nhận thông tin']
        },
        flowSteps: [
            {
                stepNumber: 1,
                title: 'Bước Khởi Đầu',
                role: 'Chuyên viên phụ trách',
                action: 'Mô tả hành động cần thực hiện...'
            }
        ],
        checklist: [
            { id: 'c-new-1', text: 'Kiểm tra đầy đủ hồ sơ đầu vào', critical: true }
        ],
        requiredDocs: [],
        faqs: []
    }

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-900/40 p-6 md:p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="max-w-2xl space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Wine ERP — Trung Tâm Quy Trình Chuẩn (SOP Knowledge Hub)</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                            Quy Trình Vận Hành & Thư Viện Biểu Mẫu
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                            Cẩm nang vận hành chính thức của công ty: Sơ đồ luồng, phân định trách nhiệm RACI, lưu ý rủi ro,
                            và 43 file mẫu Excel / Word chuẩn tải về 1-click. Hỗ trợ Admin cập nhật quy trình và thay thế form mẫu trực tiếp trên Web.
                        </p>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => {
                                setTargetUploadFile(null)
                                setShowUploadModal(true)
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 backdrop-blur-sm transition shadow-sm"
                        >
                            <Upload className="w-4 h-4 text-rose-300" />
                            <span>Upload Form Mới</span>
                        </button>
                        <button
                            onClick={() => setIsCreatingSop(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition shadow-lg shadow-rose-950/50"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Thêm Quy Trình Mới</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setActiveView('sops')}
                    className={`p-4 rounded-xl border cursor-pointer transition shadow-sm flex items-center gap-4 ${activeView === 'sops'
                        ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                >
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quy Trình Chuẩn</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{sops.length} SOPs</div>
                    </div>
                </div>

                <div
                    onClick={() => setActiveView('forms')}
                    className={`p-4 rounded-xl border cursor-pointer transition shadow-sm flex items-center gap-4 ${activeView === 'forms'
                        ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                >
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Biểu Mẫu Chuẩn</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{forms.length} Mẫu</div>
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                        <GitBranch className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bước Thao Tác</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{totalSteps} Bước</div>
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                        <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tiêu Chí Kiểm Soát</div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">{totalChecklists} Checklists</div>
                    </div>
                </div>
            </div>

            {/* View Mode Switcher (SOPs vs Forms) */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8">
                <button
                    onClick={() => setActiveView('sops')}
                    className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeView === 'sops'
                        ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Danh Mục Quy Trình ({sops.length} SOPs)</span>
                </button>

                <button
                    onClick={() => setActiveView('forms')}
                    className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition ${activeView === 'forms'
                        ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400'
                        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Thư Viện Biểu Mẫu & Tải Về ({forms.length} Mẫu Chuẩn)</span>
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={activeView === 'sops'
                                ? "Tìm quy trình, từ khóa, vai trò (Sales, Kho, Kế toán, Tem rượu)..."
                                : "Tìm kiếm biểu mẫu (Form 8.8-A, Form 6.1-B, Báo giá, Hợp đồng)..."
                            }
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                Xóa
                            </button>
                        )}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 self-center">
                        Hiển thị <strong>{activeView === 'sops' ? filteredSops.length : filteredForms.length}</strong> mục
                    </div>
                </div>

                {/* Category Pills */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {SOP_CATEGORIES.map(cat => {
                        const Icon = CATEGORY_ICONS[cat.iconName] || Layers
                        const isSelected = selectedCategory === cat.id
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition shadow-sm ${isSelected
                                    ? 'bg-rose-700 text-white shadow-rose-900/20'
                                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{cat.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* VIEW 1: SOPs GRID */}
            {activeView === 'sops' && (
                filteredSops.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                        <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Không tìm thấy quy trình phù hợp
                        </h3>
                        <button
                            onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
                            className="px-4 py-2 rounded-lg bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 transition"
                        >
                            Xem tất cả quy trình
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSops.map((sop) => {
                            const primaryActionLink = sop.flowSteps.find(s => s.erpLink)?.erpLink
                            const formsCount = (sop.forms || []).length

                            return (
                                <div
                                    key={sop.id}
                                    className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md hover:border-rose-300 dark:hover:border-rose-900/60 transition-all flex flex-col justify-between"
                                >
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                                {sop.code}
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-amber-600" />
                                                {sop.estimatedDuration}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                                                {sop.department}
                                            </div>
                                            <h3
                                                onClick={() => setSelectedSop(sop)}
                                                className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-700 dark:group-hover:text-rose-400 cursor-pointer transition line-clamp-2"
                                            >
                                                {sop.title}
                                            </h3>
                                        </div>

                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                                            {sop.summary}
                                        </p>

                                        {/* Stepper mini-preview & forms count */}
                                        <div className="pt-2 space-y-2">
                                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 flex items-center justify-between">
                                                <span>{sop.flowSteps.length} bước chuẩn</span>
                                                {formsCount > 0 ? (
                                                    <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                                                        <FileSpreadsheet className="w-3 h-3" />
                                                        {formsCount} biểu mẫu
                                                    </span>
                                                ) : (
                                                    <span className="text-rose-600 font-semibold">{sop.checklist.length} tiêu chuẩn</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                                {sop.flowSteps.map((s) => (
                                                    <div
                                                        key={s.stepNumber}
                                                        title={`Bước ${s.stepNumber}: ${s.title} (${s.role})`}
                                                        className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-rose-500/80 transition"
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => setSelectedSop(sop)}
                                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 hover:text-rose-800 transition"
                                        >
                                            <span>Xem Sơ Đồ & Biểu Mẫu</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        </button>

                                        {primaryActionLink && (
                                            <Link
                                                href={primaryActionLink.path}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                                title={primaryActionLink.label}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/* VIEW 2: FORMS LIBRARY */}
            {activeView === 'forms' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                        <div className="space-y-0.5">
                            <h3 className="font-bold text-slate-900 dark:text-white">
                                Thư Viện Biểu Mẫu Chính Thức ({filteredForms.length} tài liệu)
                            </h3>
                            <p className="text-slate-500">
                                Toàn bộ các file mẫu Excel, Word chuẩn đang được lưu trữ tại hệ thống. Nhấp nút tải về để sử dụng hoặc thay thế khi có bản cập nhật mới.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setTargetUploadFile(null)
                                setShowUploadModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold transition shadow-sm whitespace-nowrap"
                        >
                            <Upload className="w-4 h-4" />
                            <span>Tải Lên Biểu Mẫu Mới</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                            {form.code}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                            {form.fileType} • {form.fileSize}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">
                                        {form.title}
                                    </h4>

                                    <p className="text-[11px] text-slate-400 truncate">
                                        {form.fileName}
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                    <a
                                        href={form.downloadUrl}
                                        download={form.fileName}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Tải Về</span>
                                    </a>

                                    <button
                                        onClick={() => {
                                            setTargetUploadFile(form.fileName)
                                            setShowUploadModal(true)
                                        }}
                                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                        title="Tải lên tệp mới để ghi đè biểu mẫu này"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Thay file</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Detail Viewer */}
            <SopDetailModal
                sop={selectedSop}
                onClose={() => setSelectedSop(null)}
                onUpdated={handleSopUpdated}
            />

            {/* Create New SOP Modal */}
            {isCreatingSop && (
                <SopEditModal
                    sop={newDraftSop}
                    onClose={() => setIsCreatingSop(false)}
                    onSaved={handleSopUpdated}
                />
            )}

            {/* Form Upload Modal */}
            {showUploadModal && (
                <SopFormUploadModal
                    targetFileName={targetUploadFile || undefined}
                    onClose={() => {
                        setShowUploadModal(false)
                        setTargetUploadFile(null)
                    }}
                    onUploaded={handleFormUploaded}
                />
            )}
        </div>
    )
}
