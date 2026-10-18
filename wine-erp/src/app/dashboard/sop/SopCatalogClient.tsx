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
    FileSpreadsheet,
    Download,
    Upload,
    Plus,
    FileText,
    Eye,
    ExternalLink,
    Calendar,
    Globe,
    Check,
    Tag,
    FolderKanban
} from 'lucide-react'
import { SOP_CATEGORIES, type SopCategory, type SopItem } from '@/data/sops'
import { type SopFormFile } from '@/data/forms-data'
import { getMarkdownDocsAction } from './actions'
import { PROCESS_GROUPS_META, type ProcessMarkdownDoc } from './constants'
import { SopDetailModal } from './SopDetailModal'
import { SopEditModal } from './SopEditModal'
import { SopFormUploadModal } from './SopFormUploadModal'
import { MarkdownDocModal } from './MarkdownDocModal'

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
    initialMarkdownDocs?: ProcessMarkdownDoc[]
}

export function SopCatalogClient({
    initialSops,
    initialForms,
    initialMarkdownDocs = []
}: SopCatalogClientProps) {
    const searchParams = useSearchParams()

    // Core data state
    const [sops, setSops] = useState<SopItem[]>(initialSops)
    const [forms, setForms] = useState<SopFormFile[]>(initialForms)
    const [markdownDocs, setMarkdownDocs] = useState<ProcessMarkdownDoc[]>(initialMarkdownDocs)

    // View mode: 'sops' (Core Workflows), 'docs' (Markdown Handbooks & Processes), 'forms' (Office Templates)
    const [activeView, setActiveView] = useState<'sops' | 'docs' | 'forms'>('docs')

    // Filter states for SOPs
    const [selectedCategory, setSelectedCategory] = useState<SopCategory>('all')
    const [sopSearchQuery, setSopSearchQuery] = useState('')

    // Filter states for Markdown Docs
    const [selectedDocGroup, setSelectedDocGroup] = useState<string>('all')
    const [docSearchQuery, setDocSearchQuery] = useState('')
    const [docLangFilter, setDocLangFilter] = useState<'all' | 'vi' | 'en'>('all')

    // Filter states for Forms
    const [formSearchQuery, setFormSearchQuery] = useState('')
    const [selectedFormCategory, setSelectedFormCategory] = useState<string>('all')

    // Modal states
    const [selectedSop, setSelectedSop] = useState<SopItem | null>(null)
    const [isCreatingSop, setIsCreatingSop] = useState(false)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [targetUploadFile, setTargetUploadFile] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<{
        title: string
        url: string
        fileName: string
        relativeFilePath?: string
        version?: string
        lastUpdated?: string
        groupLabel?: string
    } | null>(null)

    // Fallback load of markdown docs if not SSR-loaded
    useEffect(() => {
        if (markdownDocs.length === 0) {
            getMarkdownDocsAction().then(docs => {
                if (docs && docs.length > 0) {
                    setMarkdownDocs(docs)
                }
            })
        }
    }, [markdownDocs.length])

    // Deep link support via ?code=SOP-XXX or ?view=docs
    useEffect(() => {
        const viewParam = searchParams.get('view')
        if (viewParam === 'docs' || viewParam === 'sops' || viewParam === 'forms') {
            setActiveView(viewParam)
        }

        const codeParam = searchParams.get('code')
        if (codeParam) {
            const found = sops.find(
                item => item.code.toLowerCase() === codeParam.toLowerCase() || item.id === codeParam.toLowerCase()
            )
            if (found) {
                setSelectedSop(found)
                setActiveView('sops')
            }
        }
    }, [searchParams, sops])

    // Filtered SOPs
    const filteredSops = useMemo(() => {
        return sops.filter(item => {
            const matchCategory = selectedCategory === 'all' || item.category === selectedCategory
            const query = sopSearchQuery.trim().toLowerCase()
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
    }, [sops, selectedCategory, sopSearchQuery])

    // Filtered Markdown Docs (114+ files across 12 business functions)
    const filteredMarkdownDocs = useMemo(() => {
        return markdownDocs.filter(doc => {
            const matchGroup = selectedDocGroup === 'all' || doc.group === selectedDocGroup

            const matchLang =
                docLangFilter === 'all' ||
                (docLangFilter === 'en' && doc.isEnglish) ||
                (docLangFilter === 'vi' && !doc.isEnglish)

            const query = docSearchQuery.trim().toLowerCase()
            if (!query) return matchGroup && matchLang

            const matchQuery =
                doc.title.toLowerCase().includes(query) ||
                doc.fileName.toLowerCase().includes(query) ||
                doc.groupLabel.toLowerCase().includes(query) ||
                doc.tags.some(t => t.toLowerCase().includes(query))

            return matchGroup && matchLang && matchQuery
        })
    }, [markdownDocs, selectedDocGroup, docLangFilter, docSearchQuery])

    // Filtered Forms (43 Excel/Word documents)
    const filteredForms = useMemo(() => {
        return forms.filter(form => {
            const matchCat =
                selectedFormCategory === 'all' ||
                form.category === selectedFormCategory

            const query = formSearchQuery.trim().toLowerCase()
            if (!query) return matchCat

            const matchQuery =
                form.code.toLowerCase().includes(query) ||
                form.title.toLowerCase().includes(query) ||
                form.fileName.toLowerCase().includes(query)

            return matchCat && matchQuery
        })
    }, [forms, selectedFormCategory, formSearchQuery])

    // Metrics calculation
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
        summary: 'Tóm tắt nội dung quy trình nghiệp vụ...',
        purpose: 'Mục đích ban hành...',
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
                action: 'Mô tả chi tiết hành động cần thực hiện...'
            }
        ],
        checklist: [
            { id: 'c-new-1', text: 'Kiểm tra đầy đủ hồ sơ đầu vào', critical: true }
        ],
        requiredDocs: [],
        faqs: []
    }

    // Get unique groups from actual docs
    const availableDocGroups = useMemo(() => {
        const set = new Set(markdownDocs.map(d => d.group))
        const list = Array.from(set).map(groupKey => {
            const meta = PROCESS_GROUPS_META[groupKey] || { label: groupKey, code: 'DOC', order: 99 }
            const count = markdownDocs.filter(d => d.group === groupKey).length
            return {
                key: groupKey,
                label: meta.label,
                code: meta.code,
                order: meta.order,
                count
            }
        })
        list.sort((a, b) => a.order - b.order)
        return list
    }, [markdownDocs])

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header: Clean Luxury B2B ERP Header (No gradients, no AI buzzwords) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1">
                        Hệ Thống Quản Trị Doanh Nghiệp • Wine ERP
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                        Quy Trình Vận Hành Tiêu Chuẩn (SOP)
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                        Hệ thống hóa {markdownDocs.length > 0 ? markdownDocs.length : '114'} tài liệu quy trình nghiệp vụ nội bộ, ma trận phân quyền RACI, sổ tay vận hành và thư viện biểu mẫu chứng từ.
                    </p>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        onClick={() => {
                            setTargetUploadFile(null)
                            setShowUploadModal(true)
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
                    >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Tải Biểu Mẫu Lên</span>
                    </button>
                    <button
                        onClick={() => setIsCreatingSop(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0E7490] hover:bg-[#155E75] text-white text-xs font-semibold shadow-sm transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm Quy Trình Mới</span>
                    </button>
                </div>
            </div>

            {/* Metrics Ribbon: Replaces the 4 giant pastel cards with a compact, high-density status bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                    onClick={() => setActiveView('docs')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition ${
                        activeView === 'docs'
                            ? 'border-slate-900 bg-slate-900/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                    <div className="text-[11px] text-slate-500 flex items-center justify-between font-medium">
                        <span>Sổ Tay & Quy Trình (.md)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                            12 Phân hệ
                        </span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                        {markdownDocs.length} Tài liệu
                    </div>
                </div>

                <div
                    onClick={() => setActiveView('sops')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition ${
                        activeView === 'sops'
                            ? 'border-slate-900 bg-slate-900/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                    <div className="text-[11px] text-slate-500 font-medium">Quy Trình Trọng Yếu (SOPs)</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                        {sops.length} Luồng cốt lõi
                    </div>
                </div>

                <div
                    onClick={() => setActiveView('forms')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition ${
                        activeView === 'forms'
                            ? 'border-slate-900 bg-slate-900/5'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                    <div className="text-[11px] text-slate-500 font-medium">Biểu Mẫu & Chứng Từ</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                        {forms.length} Mẫu Excel / Word
                    </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
                    <div className="text-[11px] text-slate-500 font-medium">Tiêu Chuẩn Kiểm Soát</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                        {totalChecklists} Tiêu chí RACI
                    </div>
                </div>
            </div>

            {/* 3 Main View Tabs */}
            <div className="flex border-b border-slate-200 gap-4 sm:gap-6 overflow-x-auto no-scrollbar whitespace-nowrap text-sm font-semibold">
                <button
                    onClick={() => setActiveView('docs')}
                    className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                        activeView === 'docs'
                            ? 'border-slate-900 text-slate-900 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Sổ Tay & Tài Liệu Quy Trình (.md) ({markdownDocs.length})</span>
                </button>

                <button
                    onClick={() => setActiveView('sops')}
                    className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                        activeView === 'sops'
                            ? 'border-slate-900 text-slate-900 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    <span>Quy Trình Trọng Yếu ({sops.length} SOPs)</span>
                </button>

                <button
                    onClick={() => setActiveView('forms')}
                    className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                        activeView === 'forms'
                            ? 'border-slate-900 text-slate-900 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                    <span>Thư Viện Biểu Mẫu Chứng Từ ({forms.length} Mẫu)</span>
                </button>
            </div>

            {/* ========================================================================= */}
            {/* VIEW 1: SỔ TAY & TÀI LIỆU QUY TRÌNH (.MD) — 114+ FILES ACROSS 12 GROUPS  */}
            {/* ========================================================================= */}
            {activeView === 'docs' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar for Markdown Documents */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={docSearchQuery}
                                onChange={(e) => setDocSearchQuery(e.target.value)}
                                placeholder="Tìm tài liệu .md (nhập kho, dán tem, hợp đồng, tasting, cogs)..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                            {docSearchQuery && (
                                <button
                                    onClick={() => setDocSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600"
                                >
                                    Xóa
                                </button>
                            )}
                        </div>

                        {/* Language Switcher */}
                        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-200 bg-slate-50 self-start sm:self-auto text-xs">
                            <button
                                onClick={() => setDocLangFilter('all')}
                                className={`px-2.5 py-1 rounded-md font-medium transition ${
                                    docLangFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Tất cả ({markdownDocs.length})
                            </button>
                            <button
                                onClick={() => setDocLangFilter('vi')}
                                className={`px-2.5 py-1 rounded-md font-medium transition ${
                                    docLangFilter === 'vi'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                Tiếng Việt ({markdownDocs.filter(d => !d.isEnglish).length})
                            </button>
                            <button
                                onClick={() => setDocLangFilter('en')}
                                className={`px-2.5 py-1 rounded-md font-medium transition ${
                                    docLangFilter === 'en'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                English ({markdownDocs.filter(d => d.isEnglish).length})
                            </button>
                        </div>
                    </div>

                    {/* Group Filter Pills */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                        <button
                            onClick={() => setSelectedDocGroup('all')}
                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition border ${
                                selectedDocGroup === 'all'
                                    ? 'bg-[#0E7490] text-white border-[#0E7490]'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            Tất cả phân hệ ({markdownDocs.length})
                        </button>
                        {availableDocGroups.map(grp => (
                            <button
                                key={grp.key}
                                onClick={() => setSelectedDocGroup(grp.key)}
                                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition border ${
                                    selectedDocGroup === grp.key
                                        ? 'bg-[#0E7490] text-white border-[#0E7490]'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <span>{grp.label}</span>
                                <span className="ml-1.5 opacity-70 text-[10px]">({grp.count})</span>
                            </button>
                        ))}
                    </div>

                    {/* Markdown Docs List Grid */}
                    {filteredMarkdownDocs.length === 0 ? (
                        <div className="p-12 text-center rounded-lg border border-slate-200 bg-white space-y-2">
                            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                            <div className="text-sm font-semibold text-slate-800">
                                Không tìm thấy tài liệu phù hợp
                            </div>
                            <button
                                onClick={() => { setSelectedDocGroup('all'); setDocSearchQuery(''); setDocLangFilter('all'); }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                            >
                                Đặt lại bộ lọc
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredMarkdownDocs.map((doc) => (
                                <div
                                    key={doc.id}
                                    className="p-4 rounded-lg border border-slate-200 bg-white flex flex-col justify-between space-y-3 hover:border-slate-300 transition"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                                {doc.groupLabel}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {doc.sizeStr}
                                            </span>
                                        </div>

                                        <h3
                                            onClick={() => setPreviewDoc({
                                                title: doc.title,
                                                url: doc.url,
                                                fileName: doc.fileName,
                                                relativeFilePath: doc.relativeFilePath,
                                                version: doc.version,
                                                lastUpdated: doc.lastUpdated,
                                                groupLabel: doc.groupLabel
                                            })}
                                            className="font-bold text-slate-900 text-sm hover:underline cursor-pointer line-clamp-2 leading-snug"
                                        >
                                            {doc.title}
                                        </h3>

                                        <div className="text-[11px] font-mono text-slate-400 truncate">
                                            {doc.fileName}
                                        </div>

                                        {doc.tags && doc.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {doc.tags.slice(0, 3).map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-1.5 py-0.5 rounded text-[10px] bg-slate-50 text-slate-500 border border-slate-200/60"
                                                    >
                                                        #{tag}
                                                    </span>
                                                ))}
                                                {doc.tags.length > 3 && (
                                                    <span className="text-[10px] text-slate-400 self-center">
                                                        +{doc.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => setPreviewDoc({
                                                title: doc.title,
                                                url: doc.url,
                                                fileName: doc.fileName,
                                                relativeFilePath: doc.relativeFilePath,
                                                version: doc.version,
                                                lastUpdated: doc.lastUpdated,
                                                groupLabel: doc.groupLabel
                                            })}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E7490] hover:bg-[#155E75] text-white text-xs font-semibold shadow-xs transition"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Đọc Văn Bản</span>
                                        </button>

                                        <a
                                            href={doc.url}
                                            download={doc.fileName}
                                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
                                            title="Tải tệp .md về máy"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: QUY TRÌNH TRỌNG YẾU (SOPS GRID) — CORE OPERATIONAL FLOWS          */}
            {/* ========================================================================= */}
            {activeView === 'sops' && (
                <div className="space-y-4">
                    {/* Search & Category Filter */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={sopSearchQuery}
                                onChange={(e) => setSopSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm quy trình, vai trò, nghiệp vụ..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                            {sopSearchQuery && (
                                <button
                                    onClick={() => setSopSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600"
                                >
                                    Xóa
                                </button>
                            )}
                        </div>

                        <div className="text-xs text-slate-500">
                            Hiển thị <strong>{filteredSops.length}</strong> quy trình
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                        {SOP_CATEGORIES.map(cat => {
                            const isSelected = selectedCategory === cat.id
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition border ${
                                        isSelected
                                            ? 'bg-[#0E7490] text-white border-[#0E7490]'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {cat.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* SOP Cards Grid */}
                    {filteredSops.length === 0 ? (
                        <div className="p-12 text-center rounded-lg border border-slate-200 bg-white space-y-2">
                            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                            <div className="text-sm font-semibold text-slate-800">
                                Không tìm thấy quy trình phù hợp
                            </div>
                            <button
                                onClick={() => { setSelectedCategory('all'); setSopSearchQuery(''); }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                            >
                                Xem tất cả quy trình
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredSops.map((sop) => {
                                const primaryActionLink = sop.flowSteps.find(s => s.erpLink)?.erpLink
                                const formsCount = (sop.forms || []).length
                                const attachedMdFile = (sop.forms || []).find(f => f.fileName.toLowerCase().endsWith('.md'))

                                return (
                                    <div
                                        key={sop.id}
                                        className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                                                    {sop.code}
                                                </span>
                                                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    {sop.estimatedDuration}
                                                </span>
                                            </div>

                                            <div>
                                                <div className="text-[11px] font-medium text-slate-400 mb-1">
                                                    {sop.department}
                                                </div>
                                                <h3
                                                    onClick={() => setSelectedSop(sop)}
                                                    className="text-sm font-bold text-slate-900 hover:underline cursor-pointer leading-snug line-clamp-2"
                                                >
                                                    {sop.title}
                                                </h3>
                                            </div>

                                            <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                                                {sop.summary}
                                            </p>

                                            {/* Attached Markdown Badge if present */}
                                            {attachedMdFile && (
                                                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                                                    <span className="text-[11px] text-slate-600 font-medium truncate flex items-center gap-1.5">
                                                        <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                        <span className="truncate">Sổ tay: {attachedMdFile.title}</span>
                                                    </span>
                                                    <button
                                                        onClick={() => setPreviewDoc({
                                                            title: attachedMdFile.title,
                                                            url: attachedMdFile.downloadUrl,
                                                            fileName: attachedMdFile.fileName
                                                        })}
                                                        className="text-[11px] font-semibold text-slate-900 hover:underline shrink-0 ml-2"
                                                    >
                                                        Đọc .md
                                                    </button>
                                                </div>
                                            )}

                                            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                                <span>{sop.flowSteps.length} bước thực hiện</span>
                                                <span>{formsCount > 0 ? `${formsCount} biểu mẫu` : `${sop.checklist.length} tiêu chuẩn`}</span>
                                            </div>
                                        </div>

                                        {/* Card Footer Actions */}
                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                            <button
                                                onClick={() => setSelectedSop(sop)}
                                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
                                            >
                                                <span>Chi Tiết Quy Trình</span>
                                            </button>

                                            {primaryActionLink && (
                                                <Link
                                                    href={primaryActionLink.path}
                                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                                                    title={primaryActionLink.label}
                                                >
                                                    <span>Mở Màn Hình</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 3: THƯ VIỆN BIỂU MẪU HÀNH CHÍNH (EXCEL / WORD FORMS)                 */}
            {/* ========================================================================= */}
            {activeView === 'forms' && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={formSearchQuery}
                                onChange={(e) => setFormSearchQuery(e.target.value)}
                                placeholder="Tìm biểu mẫu (Form 8.8-A, Form 6.1-B, Landed Cost)..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                            {formSearchQuery && (
                                <button
                                    onClick={() => setFormSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-600"
                                >
                                    Xóa
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => {
                                setTargetUploadFile(null)
                                setShowUploadModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0E7490] hover:bg-[#155E75] text-white text-xs font-semibold transition shadow-xs self-start sm:self-auto"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Tải Biểu Mẫu Mới Lên</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredForms.map((form) => (
                            <div
                                key={form.id}
                                className="p-4 rounded-lg border border-slate-200 bg-white flex flex-col justify-between space-y-3 hover:border-slate-300 transition"
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                            {form.code}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            {form.fileType} • {form.fileSize}
                                        </span>
                                    </div>

                                    <h4 className="font-bold text-slate-900 text-xs line-clamp-2 leading-snug">
                                        {form.title}
                                    </h4>

                                    <p className="text-[11px] font-mono text-slate-400 truncate">
                                        {form.fileName}
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    {form.fileType === 'MD' || form.fileName.toLowerCase().endsWith('.md') ? (
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setPreviewDoc({
                                                    title: form.title,
                                                    url: form.downloadUrl,
                                                    fileName: form.fileName
                                                })}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E7490] hover:bg-[#155E75] text-white text-xs font-semibold shadow-xs transition"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>Xem Văn Bản</span>
                                            </button>
                                            <a
                                                href={form.downloadUrl}
                                                download={form.fileName}
                                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
                                                title="Tải về .md"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    ) : (
                                        <a
                                            href={form.downloadUrl}
                                            download={form.fileName}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E7490] hover:bg-[#155E75] text-white text-xs font-semibold shadow-xs transition"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            <span>Tải Mẫu Về</span>
                                        </a>
                                    )}

                                    <button
                                        onClick={() => {
                                            setTargetUploadFile(form.fileName)
                                            setShowUploadModal(true)
                                        }}
                                        className="text-[11px] text-slate-500 hover:text-slate-900 transition"
                                        title="Thay thế file mẫu này"
                                    >
                                        Thay file
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal Detail Viewer for SOPs */}
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

            {/* Markdown Document Preview Modal */}
            {previewDoc && (
                <MarkdownDocModal
                    isOpen={Boolean(previewDoc)}
                    onClose={() => setPreviewDoc(null)}
                    title={previewDoc.title}
                    docUrl={previewDoc.url}
                    fileName={previewDoc.fileName}
                    relativeFilePath={previewDoc.relativeFilePath}
                    version={previewDoc.version}
                    lastUpdated={previewDoc.lastUpdated}
                    groupLabel={previewDoc.groupLabel}
                />
            )}
        </div>
    )
}
