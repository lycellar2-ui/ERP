'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
    X,
    ExternalLink,
    Clock,
    UserCheck,
    AlertTriangle,
    FileText,
    CheckSquare,
    Square,
    Printer,
    HelpCircle,
    Share2,
    CheckCircle2,
    Calendar,
    GitBranch,
    Edit3,
    Download,
    Upload,
    FileSpreadsheet,
    Eye,
    User,
    BookOpen
} from 'lucide-react'
import { type SopItem, type SopAttachedForm } from '@/data/sops'
import { SopEditModal } from './SopEditModal'
import { SopFormUploadModal } from './SopFormUploadModal'
import { MarkdownDocModal } from './MarkdownDocModal'
import { type SopFormFile } from '@/data/forms-data'

interface SopDetailModalProps {
    sop: SopItem | null
    onClose: () => void
    onUpdated?: (updated: SopItem) => void
}

export function SopDetailModal({ sop: initialSop, onClose, onUpdated }: SopDetailModalProps) {
    const [sop, setSop] = useState<SopItem | null>(initialSop)
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
    const [activeTab, setActiveTab] = useState<'flow' | 'raci' | 'checklist' | 'forms' | 'faq'>('flow')
    const [copied, setCopied] = useState(false)
    
    // Modal states
    const [isEditing, setIsEditing] = useState(false)
    const [uploadTargetFileName, setUploadTargetFileName] = useState<string | null>(null)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [previewDoc, setPreviewDoc] = useState<{
        title: string
        url: string
        fileName: string
        relativeFilePath?: string
    } | null>(null)

    // Sync if initialSop changes
    React.useEffect(() => {
        setSop(initialSop)
    }, [initialSop])

    if (!sop) return null

    const toggleCheck = (id: string) => {
        setCheckedItems(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    const totalChecklist = sop.checklist.length
    const completedChecklist = sop.checklist.filter(item => checkedItems[item.id]).length
    const progressPercent = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0

    const handlePrint = () => {
        window.print()
    }

    const handleShare = () => {
        if (typeof window !== 'undefined') {
            const url = `${window.location.origin}/dashboard/sop?code=${sop.code}`
            navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const handleSopSaved = (updated: SopItem) => {
        setSop(updated)
        if (onUpdated) onUpdated(updated)
    }

    const handleFormUploaded = (newForm: SopFormFile) => {
        const currentForms = sop.forms ? [...sop.forms] : []
        const existingIdx = currentForms.findIndex(f => f.fileName === newForm.fileName)
        
        const attachedForm: SopAttachedForm = {
            code: newForm.code,
            title: newForm.title,
            fileName: newForm.fileName,
            downloadUrl: newForm.downloadUrl
        }

        if (existingIdx >= 0) {
            currentForms[existingIdx] = attachedForm
        } else {
            currentForms.push(attachedForm)
        }

        const updated: SopItem = {
            ...sop,
            forms: currentForms
        }
        setSop(updated)
        if (onUpdated) onUpdated(updated)
    }

    const attachedForms = sop.forms || []
    const attachedMdFiles = attachedForms.filter(f => f.fileName.toLowerCase().endsWith('.md'))

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center p-3 sm:p-6 animate-in fade-in duration-150">
            {/* Modal Container */}
            <div
                className="bg-white w-full max-w-5xl rounded-lg shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[92vh] overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                                {sop.code}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-200/60 text-slate-600 font-medium">
                                Phiên bản {sop.version}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Hiệu lực: {sop.effectiveDate}
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                            {sop.title}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {sop.department} • <span className="italic">{sop.departmentEn}</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs transition"
                            title="Chỉnh sửa nội dung quy trình"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa Quy Trình</span>
                        </button>

                        <button
                            onClick={handleShare}
                            title="Sao chép liên kết quy trình"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                        >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={handlePrint}
                            title="In quy trình này"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Subheader info ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-2.5 bg-slate-100/50 border-b border-slate-200 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>SLA: <strong>{sop.estimatedDuration}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                        <span>Trình tự: <strong>{sop.flowSteps.length} bước</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                        <span>Biểu mẫu: <strong>{attachedForms.length} tài liệu</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kiểm soát: <strong>{completedChecklist}/{totalChecklist} hoàn tất</strong></span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 px-5 gap-4 sm:gap-6 bg-white overflow-x-auto no-scrollbar whitespace-nowrap text-xs font-semibold">
                    <button
                        onClick={() => setActiveTab('flow')}
                        className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
                            activeTab === 'flow'
                                ? 'border-slate-900 text-slate-900 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                        <span>Trình Tự Thực Hiện ({sop.flowSteps.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
                            activeTab === 'forms'
                                ? 'border-slate-900 text-slate-900 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Hồ Sơ & Biểu Mẫu ({attachedForms.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('raci')}
                        className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
                            activeTab === 'raci'
                                ? 'border-slate-900 text-slate-900 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Phân Quyền RACI</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
                            activeTab === 'checklist'
                                ? 'border-slate-900 text-slate-900 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Tiêu Chuẩn Kiểm Soát ({completedChecklist}/{totalChecklist})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`py-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition ${
                            activeTab === 'faq'
                                ? 'border-slate-900 text-slate-900 font-bold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Hỏi Đáp Vận Hành ({sop.faqs.length})</span>
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800 text-sm leading-relaxed">
                    {/* Summary & Scope */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                            Mục tiêu & Tóm tắt nghiệp vụ:
                        </div>
                        <p className="text-slate-600 text-xs leading-relaxed">{sop.summary}</p>
                        <div className="pt-2 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-500 border-t border-slate-200">
                            <div><strong>Mục tiêu:</strong> {sop.purpose}</div>
                            <div><strong>Phạm vi áp dụng:</strong> {sop.scope}</div>
                        </div>
                    </div>

                    {/* Attached Markdown Handbook Banner (Direct Access!) */}
                    {attachedMdFiles.length > 0 && (
                        <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-200 text-slate-700 shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">
                                        Sổ tay hướng dẫn nghiệp vụ chi tiết (.md)
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {attachedMdFiles.map(f => f.title).join(' • ')}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {attachedMdFiles.map((f, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setPreviewDoc({
                                            title: f.title,
                                            url: f.downloadUrl,
                                            fileName: f.fileName
                                        })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span>Đọc Sổ Tay (.md)</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 1: FLOW & DETAILED STEPS */}
                    {activeTab === 'flow' && (
                        <div className="space-y-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                Trình Tự Thực Hiện Từng Bước
                            </div>

                            <div className="relative border-l-2 border-slate-200 ml-3.5 pl-5 space-y-6">
                                {sop.flowSteps.map((step) => (
                                    <div key={step.stepNumber} className="relative">
                                        <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-white border-2 border-slate-900 text-slate-900 font-bold flex items-center justify-center text-[11px] shadow-xs">
                                            {step.stepNumber}
                                        </div>

                                        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-xs space-y-2.5 hover:border-slate-300 transition">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h3 className="text-sm font-bold text-slate-900">
                                                    Bước {step.stepNumber}: {step.title}
                                                </h3>
                                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200">
                                                    <User className="w-3 h-3 text-slate-500" />
                                                    {step.role}
                                                </span>
                                            </div>

                                            <p className="text-slate-700 text-xs leading-relaxed">
                                                {step.action}
                                            </p>

                                            {/* Deliverables */}
                                            {step.deliverables && step.deliverables.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                                                    <span className="font-semibold text-slate-500 text-[11px] flex items-center gap-1">
                                                        <FileText className="w-3 h-3 text-slate-400" />
                                                        Hồ sơ bàn giao:
                                                    </span>
                                                    {step.deliverables.map((doc, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200"
                                                        >
                                                            {doc}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Cautions */}
                                            {step.cautions && step.cautions.length > 0 && (
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs space-y-1">
                                                    <div className="font-semibold flex items-center gap-1 text-slate-800 text-[11px]">
                                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                        Điểm kiểm soát rủi ro:
                                                    </div>
                                                    <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                                                        {step.cautions.map((caution, idx) => (
                                                            <li key={idx}>{caution}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Deep Link to ERP Module */}
                                            {step.erpLink && (
                                                <div className="pt-1 flex justify-end">
                                                    <Link
                                                        href={step.erpLink.path}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
                                                    >
                                                        <span>{step.erpLink.label}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: FORMS & TEMPLATES */}
                    {activeTab === 'forms' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                        Hồ Sơ & Biểu Mẫu Áp Dụng
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Tải biểu mẫu chuẩn Excel/Word để thực hiện tác nghiệp hoặc đọc tài liệu Markdown.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setUploadTargetFileName('')
                                        setShowUploadModal(true)
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold text-xs transition"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Tải Mẫu Lên</span>
                                </button>
                            </div>

                            {attachedForms.length === 0 ? (
                                <div className="p-8 text-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 space-y-1">
                                    <div>Chưa có biểu mẫu gắn kèm riêng cho quy trình này.</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {attachedForms.map((form, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs flex flex-col justify-between space-y-3"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                                                    {form.fileName.toLowerCase().endsWith('.md') ? (
                                                        <FileText className="w-4 h-4" />
                                                    ) : (
                                                        <FileSpreadsheet className="w-4 h-4" />
                                                    )}
                                                </div>
                                                <div className="space-y-0.5 flex-1 overflow-hidden">
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                        {form.code}
                                                    </span>
                                                    <h4 className="font-bold text-slate-900 text-xs leading-snug truncate">
                                                        {form.title}
                                                    </h4>
                                                    <p className="text-[11px] font-mono text-slate-400 truncate">
                                                        {form.fileName}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    {form.fileName.toLowerCase().endsWith('.md') ? (
                                                        <button
                                                            onClick={() => setPreviewDoc({
                                                                title: form.title,
                                                                url: form.downloadUrl,
                                                                fileName: form.fileName
                                                            })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>Đọc Văn Bản</span>
                                                        </button>
                                                    ) : null}

                                                    <a
                                                        href={form.downloadUrl}
                                                        download={form.fileName}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                        <span>{form.fileName.toLowerCase().endsWith('.md') ? 'Tải .md' : 'Tải File'}</span>
                                                    </a>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setUploadTargetFileName(form.fileName)
                                                        setShowUploadModal(true)
                                                    }}
                                                    className="text-[11px] text-slate-400 hover:text-slate-700 transition"
                                                    title="Thay thế file này"
                                                >
                                                    Thay file
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Required Documents Checklist */}
                            {sop.requiredDocs && sop.requiredDocs.length > 0 && (
                                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                                        Hồ sơ & Chứng từ pháp lý bắt buộc:
                                    </h4>
                                    <ul className="space-y-1 text-xs text-slate-600">
                                        {sop.requiredDocs.map((doc, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-slate-400 font-bold">•</span>
                                                <span>{doc}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: RACI MATRIX */}
                    {activeTab === 'raci' && (
                        <div className="space-y-4">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                Ma Trận Phân Quyền & Thẩm Quyền (RACI Matrix)
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-black text-xs flex items-center justify-center">
                                            R
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-xs">Responsible (Người Thực Hiện)</h4>
                                            <p className="text-[11px] text-slate-500">Trực tiếp thao tác và tạo dữ liệu</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 pt-1">
                                        {sop.raci.responsible.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-slate-700 text-white font-black text-xs flex items-center justify-center">
                                            A
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-xs">Accountable (Người Phê Duyệt)</h4>
                                            <p className="text-[11px] text-slate-500">Chịu trách nhiệm cuối cùng & phê duyệt</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 pt-1">
                                        {sop.raci.accountable.map((a, i) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-slate-600 text-white font-black text-xs flex items-center justify-center">
                                            C
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-xs">Consulted (Bên Tư Vấn/Phối Hợp)</h4>
                                            <p className="text-[11px] text-slate-500">Cung cấp ý kiến chuyên môn hai chiều</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 pt-1">
                                        {sop.raci.consulted.map((c, i) => (
                                            <li key={i}>{c}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-slate-500 text-white font-black text-xs flex items-center justify-center">
                                            I
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-xs">Informed (Bên Nhận Tin)</h4>
                                            <p className="text-[11px] text-slate-500">Cập nhật tiến độ sau khi hoàn thành</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 pt-1">
                                        {sop.raci.informed.map((inf, i) => (
                                            <li key={i}>{inf}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: INTERACTIVE CHECKLIST */}
                    {activeTab === 'checklist' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                                <div>
                                    <h4 className="font-bold text-slate-900 text-xs">
                                        Bảng Tiêu Chuẩn Kiểm Soát & Nghiệm Thu
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        Kiểm tra từng tiêu chí trước khi bàn giao dữ liệu sang công đoạn tiếp theo.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-bold text-slate-900">
                                        {progressPercent}%
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {completedChecklist}/{totalChecklist} tiêu chuẩn
                                    </div>
                                </div>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="bg-slate-900 h-1.5 rounded-full transition-all duration-200"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            <div className="space-y-2">
                                {sop.checklist.map((item) => {
                                    const isDone = !!checkedItems[item.id]
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleCheck(item.id)}
                                            className={`p-3 rounded-lg border cursor-pointer flex items-start gap-2.5 transition ${
                                                isDone
                                                    ? 'bg-slate-50 border-slate-300'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <button className="mt-0.5 text-slate-600">
                                                {isDone ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-400" />}
                                            </button>
                                            <div className="flex-1 text-xs">
                                                <span className={isDone ? 'line-through text-slate-400' : 'text-slate-800'}>
                                                    {item.text}
                                                </span>
                                                {item.critical && (
                                                    <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                                        Bắt buộc
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: FAQS */}
                    {activeTab === 'faq' && (
                        <div className="space-y-3">
                            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                Các Tình Huống Xử Lý Ngoại Lệ Thường Gặp
                            </div>

                            {sop.faqs.length === 0 ? (
                                <div className="p-6 text-center text-xs text-slate-500 rounded-lg border border-slate-200">
                                    Chưa có ghi nhận tình huống ngoại lệ cho quy trình này.
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {sop.faqs.map((faq, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5"
                                        >
                                            <div className="flex items-start gap-2 text-xs font-bold text-slate-900">
                                                <span className="text-slate-400">Q:</span>
                                                <span>{faq.q}</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-xs text-slate-600 pl-4 border-l-2 border-slate-200">
                                                <span>{faq.a}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sub Modals */}
            {isEditing && (
                <SopEditModal
                    sop={sop}
                    onClose={() => setIsEditing(false)}
                    onSaved={handleSopSaved}
                />
            )}

            {showUploadModal && (
                <SopFormUploadModal
                    targetFileName={uploadTargetFileName || undefined}
                    onClose={() => {
                        setShowUploadModal(false)
                        setUploadTargetFileName(null)
                    }}
                    onUploaded={handleFormUploaded}
                />
            )}

            {previewDoc && (
                <MarkdownDocModal
                    isOpen={Boolean(previewDoc)}
                    onClose={() => setPreviewDoc(null)}
                    title={previewDoc.title}
                    docUrl={previewDoc.url}
                    fileName={previewDoc.fileName}
                    relativeFilePath={previewDoc.relativeFilePath}
                />
            )}
        </div>
    )
}
