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
    FileSpreadsheet
} from 'lucide-react'
import { type SopItem, type SopAttachedForm } from '@/data/sops'
import { SopEditModal } from './SopEditModal'
import { SopFormUploadModal } from './SopFormUploadModal'
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
        // Update sop's forms list if not already present
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

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
            {/* Modal Container */}
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[92vh] overflow-hidden"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                {sop.code}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                Phiên bản {sop.version}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Hiệu lực: {sop.effectiveDate}
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                            {sop.title}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {sop.department} • <span className="italic">{sop.departmentEn}</span>
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        {/* Edit SOP Button */}
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs shadow-sm transition"
                            title="Chỉnh sửa quy trình này trực tiếp trên Web"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa Quy Trình</span>
                        </button>

                        <button
                            onClick={handleShare}
                            title="Sao chép liên kết quy trình"
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                        >
                            {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Share2 className="w-5 h-5" />}
                        </button>
                        <button
                            onClick={handlePrint}
                            title="In quy trình này"
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                        >
                            <Printer className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Subheader info badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/40 dark:border-amber-900/30 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>SLA: <strong>{sop.estimatedDuration}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <GitBranch className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Tổng số bước: <strong>{sop.flowSteps.length} bước</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Biểu mẫu đính kèm: <strong>{attachedForms.length} mẫu</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Kiểm tra: <strong>{completedChecklist}/{totalChecklist} hoàn thành</strong></span>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 bg-white dark:bg-slate-900 overflow-x-auto text-sm font-medium">
                    <button
                        onClick={() => setActiveTab('flow')}
                        className={`py-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'flow'
                            ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <GitBranch className="w-4 h-4" />
                        Sơ Đồ Luồng & Từng Bước ({sop.flowSteps.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('forms')}
                        className={`py-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'forms'
                            ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Biểu Mẫu & Tải Về ({attachedForms.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('raci')}
                        className={`py-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'raci'
                            ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <UserCheck className="w-4 h-4" />
                        Ma Trận Phân Quyền RACI
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`py-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'checklist'
                            ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <CheckSquare className="w-4 h-4" />
                        Checklist Tự Kiểm Tra ({completedChecklist}/{totalChecklist})
                    </button>
                    <button
                        onClick={() => setActiveTab('faq')}
                        className={`py-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${activeTab === 'faq'
                            ? 'border-rose-700 text-rose-700 dark:border-rose-400 dark:text-rose-400 font-semibold'
                            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        Hỏi Đáp Thường Gặp ({sop.faqs.length})
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                    {/* Summary & Scope */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                            Mục đích & Tóm tắt quy trình:
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{sop.summary}</p>
                        <div className="pt-2 text-xs grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div><strong>Mục tiêu:</strong> {sop.purpose}</div>
                            <div><strong>Phạm vi:</strong> {sop.scope}</div>
                        </div>
                    </div>

                    {/* TAB 1: FLOW & DETAILED STEPS */}
                    {activeTab === 'flow' && (
                        <div className="space-y-6">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                                Sơ Đồ Quy Trình Tuần Tự (Step-by-Step Flow)
                            </div>

                            <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 pl-6 space-y-8">
                                {sop.flowSteps.map((step) => (
                                    <div key={step.stepNumber} className="relative group">
                                        <div className="absolute -left-[35px] top-0 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-2 border-rose-600 dark:border-rose-500 text-rose-700 dark:text-rose-400 font-bold flex items-center justify-center text-xs shadow-sm">
                                            {step.stepNumber}
                                        </div>

                                        <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-rose-300 dark:hover:border-rose-900 transition">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                                    Bước {step.stepNumber}: {step.title}
                                                </h3>
                                                <span className="text-xs px-2.5 py-1 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 font-medium border border-rose-200 dark:border-rose-900">
                                                    👤 {step.role}
                                                </span>
                                            </div>

                                            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                                                {step.action}
                                            </p>

                                            {/* Deliverables */}
                                            {step.deliverables && step.deliverables.length > 0 && (
                                                <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                                    <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                                                        Chứng từ đầu ra:
                                                    </span>
                                                    {step.deliverables.map((doc, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                                                        >
                                                            {doc}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Cautions */}
                                            {step.cautions && step.cautions.length > 0 && (
                                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                                                    <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                        Lưu ý quan trọng & Rủi ro cần tránh:
                                                    </div>
                                                    <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                                                        {step.cautions.map((caution, idx) => (
                                                            <li key={idx}>{caution}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Deep Link to ERP Module */}
                                            {step.erpLink && (
                                                <div className="pt-2 flex justify-end">
                                                    <Link
                                                        href={step.erpLink.path}
                                                        target="_blank"
                                                        className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white shadow-sm transition"
                                                    >
                                                        <span>{step.erpLink.label}</span>
                                                        <ExternalLink className="w-3.5 h-3.5" />
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
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                                        Biểu Mẫu Chuẩn Cho Quy Trình Này
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Nhân viên bấm tải trực tiếp mẫu Excel / Word để điền và nộp theo đúng chuẩn công ty.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setUploadTargetFileName('')
                                        setShowUploadModal(true)
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-300 dark:border-slate-700 transition"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>Tải Lên Mẫu Mới</span>
                                </button>
                            </div>

                            {attachedForms.length === 0 ? (
                                <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs text-slate-500 space-y-2">
                                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
                                    <div>Chưa có biểu mẫu gắn kèm riêng cho quy trình này.</div>
                                    <button
                                        onClick={() => setShowUploadModal(true)}
                                        className="text-rose-700 dark:text-rose-400 font-bold underline"
                                    >
                                        Bấm vào đây để tải lên biểu mẫu mới
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {attachedForms.map((form, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 shadow-sm flex flex-col justify-between space-y-3"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                                                    <FileSpreadsheet className="w-5 h-5" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                        {form.code}
                                                    </span>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-snug">
                                                        {form.title}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-400 truncate max-w-xs">
                                                        {form.fileName}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                                                <a
                                                    href={form.downloadUrl}
                                                    download={form.fileName}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>Tải Về File Mẫu</span>
                                                </a>
                                                <button
                                                    onClick={() => {
                                                        setUploadTargetFileName(form.fileName)
                                                        setShowUploadModal(true)
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition"
                                                    title="Tải tệp mới để thay thế biểu mẫu này"
                                                >
                                                    <Upload className="w-3 h-3" />
                                                    <span>Thay thế</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Required Documents Checklist */}
                            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-rose-600" />
                                    Hồ Sơ & Chứng Từ Pháp Lý Yêu Cầu Kèm Theo:
                                </h4>
                                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                                    {sop.requiredDocs.map((doc, idx) => (
                                        <li key={idx} className="flex items-start gap-2">
                                            <span className="text-rose-600 font-bold">•</span>
                                            <span>{doc}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: RACI MATRIX */}
                    {activeTab === 'raci' && (
                        <div className="space-y-6">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                                Ma Trận Phân Quyền & Trách Nhiệm (RACI Matrix)
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-7 h-7 rounded-md bg-rose-700 text-white font-black text-sm flex items-center justify-center">
                                            R
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-rose-950 dark:text-rose-200 text-sm">Responsible (Người Thực Hiện)</h4>
                                            <p className="text-xs text-rose-700 dark:text-rose-300">Trực tiếp thao tác và tạo dữ liệu</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-800 dark:text-slate-200 space-y-1 pt-1">
                                        {sop.raci.responsible.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-7 h-7 rounded-md bg-amber-600 text-white font-black text-sm flex items-center justify-center">
                                            A
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-amber-950 dark:text-amber-200 text-sm">Accountable (Người Phê Duyệt)</h4>
                                            <p className="text-xs text-amber-700 dark:text-amber-300">Chịu trách nhiệm cuối cùng & ký duyệt</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-800 dark:text-slate-200 space-y-1 pt-1">
                                        {sop.raci.accountable.map((a, i) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-7 h-7 rounded-md bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                                            C
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-blue-950 dark:text-blue-200 text-sm">Consulted (Bên Tư Vấn/Phối Hợp)</h4>
                                            <p className="text-xs text-blue-700 dark:text-blue-300">Cung cấp ý kiến chuyên môn hai chiều</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-800 dark:text-slate-200 space-y-1 pt-1">
                                        {sop.raci.consulted.map((c, i) => (
                                            <li key={i}>{c}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="w-7 h-7 rounded-md bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                                            I
                                        </span>
                                        <div>
                                            <h4 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">Informed (Bên Nhận Tin)</h4>
                                            <p className="text-xs text-emerald-700 dark:text-emerald-300">Cập nhật tiến độ sau khi hoàn thành</p>
                                        </div>
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-slate-800 dark:text-slate-200 space-y-1 pt-1">
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
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                        Bảng Tự Kiểm Soát Chất Lượng (Self-Audit Checklist)
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Nhân viên tự kiểm tra từng đầu việc trước khi bàn giao hoặc chốt hồ sơ nghiệp vụ.
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-black text-rose-700 dark:text-rose-400">
                                        {progressPercent}%
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {completedChecklist}/{totalChecklist} đầu việc
                                    </div>
                                </div>
                            </div>

                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div
                                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            <div className="space-y-2.5">
                                {sop.checklist.map((item) => {
                                    const isDone = !!checkedItems[item.id]
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleCheck(item.id)}
                                            className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition ${isDone
                                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-slate-800 dark:text-slate-200'
                                                : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                                }`}
                                        >
                                            <button className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                                                {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                                            </button>
                                            <div className="flex-1 text-sm">
                                                <span className={isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                                                    {item.text}
                                                </span>
                                                {item.critical && (
                                                    <span className="ml-2 inline-flex items-center px-2 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                                        Bắt buộc
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {progressPercent === 100 && (
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Xuất sắc! Bạn đã hoàn thành kiểm tra 100% các tiêu chuẩn của quy trình này. Có thể tự tin thực hiện trên hệ thống thật.</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 4: FAQS */}
                    {activeTab === 'faq' && (
                        <div className="space-y-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                                Các Câu Hỏi Thường Gặp (FAQ Onboarding)
                            </div>

                            <div className="space-y-3">
                                {sop.faqs.map((faq, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2"
                                    >
                                        <div className="font-bold text-slate-900 dark:text-white flex items-start gap-2 text-sm">
                                            <HelpCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                                            <span>{faq.q}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 pl-6 leading-relaxed">
                                            {faq.a}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
                    <div>
                        Mã hiệu kiểm soát: <strong className="text-slate-700 dark:text-slate-300">{sop.code}</strong>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium transition"
                    >
                        Đóng cửa sổ
                    </button>
                </div>
            </div>

            {/* Edit SOP Modal */}
            {isEditing && (
                <SopEditModal
                    sop={sop}
                    onClose={() => setIsEditing(false)}
                    onSaved={handleSopSaved}
                />
            )}

            {/* Upload Form Modal */}
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
        </div>
    )
}
