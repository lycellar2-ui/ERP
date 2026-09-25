'use client'

import React, { useState, useEffect } from 'react'
import { FileText, X, Check, Sparkles, MapPin, Clock, Camera, Send, Lock } from 'lucide-react'
import { type VisitLocale } from './i18n'

interface QuickReportModalProps {
    isOpen: boolean
    visit: {
        id: string
        visitNo?: string
        customerId?: string
        customerName?: string
        customerCode?: string
        customerChannel?: string
        checkInTime?: string | Date
        checkInPhoto?: string | null
        checkInAddress?: string | null
        notes?: string | null
    } | null
    onClose: () => void
    onSave: (visitId: string, notes: string) => Promise<boolean>
    locale?: VisitLocale
    readOnly?: boolean
}

const QUICK_TAG_SUGGESTIONS = [
    { label: '🍷 Khách quan tâm vang Ý', text: 'Khách hàng quan tâm các dòng vang Ý mới (Anselmi, Chianti, Monteforte).' },
    { label: '🍷 Đã gửi mẫu thử tasting', text: 'Đã bàn giao chai mẫu tasting cho quản lý/sommelier dùng thử và phản hồi.' },
    { label: '📦 Quầy hết tồn, cần lên đơn', text: 'Tồn kho tại điểm bán sắp hết, khách có nhu cầu đặt thêm hàng trong tuần.' },
    { label: '💵 Thu công nợ / đối soát', text: 'Đã đối soát chứng từ hóa đơn và thu hồi công nợ theo đúng hạn.' },
    { label: '📝 Đàm phán hợp đồng / menu', text: 'Đang thương thảo danh mục rượu đưa vào wine list và mức chiết khấu kênh.' },
    { label: '⚠️ Khách phản ánh giá', text: 'Khách phản ánh về mức giá cạnh tranh trên thị trường, cần hỗ trợ thêm CTKM.' },
    { label: '🤝 Chăm sóc định kỳ tốt', text: 'Thăm hỏi định kỳ, duy trì quan hệ thân thiết với chủ nhà hàng / bar.' },
]

export function QuickReportModal({
    isOpen,
    visit,
    onClose,
    onSave,
    locale = 'vi',
    readOnly = false,
}: QuickReportModalProps) {
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        if (visit) {
            setNotes(visit.notes || '')
            setValidationError(null)
        } else {
            setNotes('')
            setValidationError(null)
        }
    }, [visit])

    if (!isOpen || !visit) return null

    const handleAddSuggestion = (text: string) => {
        if (readOnly) return
        if (!notes.trim()) {
            setNotes(text)
        } else if (!notes.includes(text)) {
            setNotes(prev => `${prev}\n• ${text}`)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (readOnly) return

        if (!notes.trim() && visit.notes && visit.notes.trim()) {
            setValidationError(locale === 'en' ? 'Cannot erase existing field report to blank.' : 'Không thể xóa trắng báo cáo thực địa đã ghi.')
            return
        }

        setSaving(true)
        const success = await onSave(visit.id, notes)
        setSaving(false)
        if (success) {
            onClose()
        }
    }

    const timeStr = visit.checkInTime
        ? new Date(visit.checkInTime).toLocaleTimeString(locale === 'en' ? 'en-US' : 'vi-VN', { hour: '2-digit', minute: '2-digit' })
        : null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 shrink-0 mt-0.5">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-500/15 px-2 py-0.5 rounded-md font-mono">
                                    {locale === 'en' ? 'Quick Field Report' : 'Báo Cáo Nhanh Thực Địa'}
                                </span>
                                {visit.visitNo && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                        {visit.visitNo}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 line-clamp-1">
                                {visit.customerName || (locale === 'en' ? 'Client' : 'Khách hàng')}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                {visit.customerCode && <span>[{visit.customerCode}]</span>}
                                {visit.customerChannel && <span>• {visit.customerChannel}</span>}
                                {timeStr && (
                                    <span className="flex items-center gap-1 text-teal-700 font-semibold">
                                        <Clock size={11} /> {timeStr}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Compact Store Preview Snippet */}
                    {(visit.checkInPhoto || visit.checkInAddress) && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                            {visit.checkInPhoto ? (
                                <img
                                    src={visit.checkInPhoto}
                                    alt="Check-in Photo"
                                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-lg bg-slate-200/60 flex items-center justify-center text-slate-400 shrink-0">
                                    <Camera size={18} />
                                </div>
                            )}
                            <div className="min-w-0 flex-1 text-xs">
                                <div className="font-semibold text-slate-700 line-clamp-1">
                                    {visit.customerName}
                                </div>
                                {visit.checkInAddress && (
                                    <div className="flex items-start gap-1 text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                        <MapPin size={11} className="text-teal-600 shrink-0 mt-0.5" />
                                        <span>{visit.checkInAddress}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Locked Banner if readOnly */}
                    {readOnly && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs flex items-center gap-2.5 font-medium">
                            <Lock size={16} className="text-amber-600 shrink-0" />
                            <div>
                                <span className="font-bold">{locale === 'en' ? 'Report Locked:' : 'Báo cáo đã khóa:'}</span>{' '}
                                {locale === 'en'
                                    ? 'Visits of past weeks or submitted plans cannot be edited or deleted by sales reps.'
                                    : 'Báo cáo của tuần trước hoặc kế hoạch đã chốt duyệt không thể chỉnh sửa bởi nhân viên sales.'}
                            </div>
                        </div>
                    )}

                    {/* Validation Error Alert */}
                    {validationError && (
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-xs flex items-center gap-2">
                            <span>⚠️ {validationError}</span>
                        </div>
                    )}

                    {/* Quick Selection Tags */}
                    {!readOnly && (
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                <Sparkles size={12} className="text-amber-500" />
                                {locale === 'en' ? '1-Tap Quick Tags (Select to insert):' : 'Chọn nhanh mẫu nội dung (Chạm để thêm):'}
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {QUICK_TAG_SUGGESTIONS.map((tag, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleAddSuggestion(tag.text)}
                                        className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-slate-700 transition active:scale-95 cursor-pointer text-left"
                                    >
                                        {tag.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Textarea */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-800">
                                {locale === 'en' ? 'Report Notes / Discussion Results:' : 'Nội dung báo cáo / Kết quả làm việc:'}
                            </label>
                            <span className="text-[10px] text-slate-400 font-mono">
                                {notes.length} ký tự
                            </span>
                        </div>
                        <textarea
                            rows={4}
                            value={notes}
                            onChange={e => {
                                if (!readOnly) {
                                    setNotes(e.target.value)
                                    if (validationError) setValidationError(null)
                                }
                            }}
                            readOnly={readOnly}
                            placeholder={
                                readOnly
                                    ? (locale === 'en' ? 'No report recorded.' : 'Chưa có ghi chú báo cáo.')
                                    : (locale === 'en'
                                        ? 'e.g., Met manager, tasted Italian wines. Client likes Anselmi San Vincenzo. Requested quotation for 2 cases. Store shelf currently out of Chianti...'
                                        : 'Ví dụ: Đã gặp quản lý, giới thiệu vang Ý mới. Khách thích chai Anselmi và Terre di Monteforte. Yêu cầu gửi báo giá 2 thùng. Tồn quầy sắp hết Chianti...')
                            }
                            className={`w-full p-3 text-xs sm:text-sm rounded-xl border text-slate-900 transition resize-y leading-relaxed ${
                                readOnly
                                    ? 'bg-slate-100 border-slate-200 cursor-not-allowed select-text'
                                    : 'bg-slate-50 border-slate-200 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:bg-white'
                            }`}
                            autoFocus={!readOnly}
                        />
                        {!readOnly && (
                            <p className="text-[11px] text-slate-500">
                                {locale === 'en'
                                    ? '💡 This note will immediately update for the Management Team in the Live Operations Board.'
                                    : '💡 Nội dung này sẽ hiển thị tức thì trên Bảng Tin Điều Hành của Quản lý.'}
                            </p>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            {locale === 'en' ? 'Close' : 'Đóng'}
                        </button>

                        {!readOnly && (
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? (
                                    <span>{locale === 'en' ? 'Saving...' : 'Đang lưu...'}</span>
                                ) : (
                                    <>
                                        <Send size={13} />
                                        <span>{locale === 'en' ? 'Save Quick Report' : 'Lưu Báo Cáo Nhanh'}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
}
