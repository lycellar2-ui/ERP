'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
    ChevronLeft, MapPin,
    Plus, Minus, Save, Eye, EyeOff, AlertTriangle, RefreshCw,
    ChevronRight, Grid, Layers, ListFilter, Check,
    Package, Wine, Search, X, CheckCheck, Tag, ArrowRight,
    UserCheck, Lock, FileText, Table
} from 'lucide-react'
import { AddUnlistedModal } from './AddUnlistedModal'
import { recordMobileCountLine, completeZoneCount, startStockCount } from './actions'
import { formatCasesAndBottles } from '@/lib/utils'
import { useConfirmDialog } from '@/components/ui'
import { toast } from 'sonner'

export type LineItem = {
    id: string
    productId: string
    skuCode: string
    productName: string
    unitsPerCase: number
    vintage?: number | null
    locationId?: string | null
    locationCode: string
    zone: string
    qtySystem: number
    qtyActual: number | null
    variance: number | null
    varianceReason: string | null
    photoUrl: string | null
    countedAt: string | null
    notes: string | null
    assignedToId?: string | null
    assignedToName?: string | null
}

type Props = {
    detail: {
        id: string
        sessionNo: string
        title: string
        warehouseId?: string
        warehouseName: string
        scopeType: string
        isBlindCount: boolean
        status?: string
        currentUserId?: string | null
        lines: LineItem[]
    }
    onBack: () => void
    onRefreshed?: () => void
    onOpenTableModal?: () => void
    onOpenReport?: (sessionId: string) => void
}

const REASONS = [
    { code: 'BREAKAGE', label: 'Vỡ, hỏng chai' },
    { code: 'WRONG_SKU', label: 'Nhầm mã SKU / Tem nhãn' },
    { code: 'UNRECORDED_DO', label: 'Xuất kho chưa lập DO' },
    { code: 'UNRECORDED_GR', label: 'Nhập kho chưa lập GR' },
    { code: 'LOSS', label: 'Thất thoát chưa rõ nguyên nhân' },
    { code: 'OTHER', label: 'Lý do khác' }
]

// ─── AUDIO & HAPTIC SYSTEM (SINGLETON TO PREVENT SAFARI/CHROME LEAKS) ────
let sharedAudioCtx: AudioContext | null = null

function getSharedAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return null
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx()
    }
    if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
}

function playFeedbackSound(type: 'tap' | 'chip' | 'success' | 'alert' = 'tap') {
    try {
        const ctx = getSharedAudioContext()
        if (!ctx) return
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)

        if (type === 'tap') {
            osc.type = 'sine'
            osc.frequency.setValueAtTime(800, now)
            gain.gain.setValueAtTime(0.08, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
            osc.start(now)
            osc.stop(now + 0.05)
        } else if (type === 'chip') {
            osc.type = 'sine'
            osc.frequency.setValueAtTime(950, now)
            gain.gain.setValueAtTime(0.09, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
            osc.start(now)
            osc.stop(now + 0.07)
        } else if (type === 'success') {
            osc.type = 'triangle'
            osc.frequency.setValueAtTime(523.25, now)
            osc.frequency.setValueAtTime(783.99, now + 0.08)
            gain.gain.setValueAtTime(0.12, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
            osc.start(now)
            osc.stop(now + 0.25)
        } else if (type === 'alert') {
            osc.type = 'sawtooth'
            osc.frequency.setValueAtTime(440, now)
            osc.frequency.exponentialRampToValueAtTime(280, now + 0.16)
            gain.gain.setValueAtTime(0.1, now)
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
            osc.start(now)
            osc.stop(now + 0.16)
        }
    } catch {
        // Fallback ignore
    }
}

function triggerHaptic(type: 'light' | 'medium' | 'success' = 'light') {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
        try {
            if (type === 'light') navigator.vibrate(25)
            else if (type === 'medium') navigator.vibrate(45)
            else if (type === 'success') navigator.vibrate([30, 50, 40])
        } catch {
            // Fallback ignore
        }
    }
}

export default function MobileLocationCounter({ detail, onBack, onRefreshed, onOpenTableModal, onOpenReport }: Props) {
    const { confirm, dialog } = useConfirmDialog()
    const [lines, setLines] = useState<LineItem[]>(detail.lines)
    const [viewMode, setViewMode] = useState<'FOCUS' | 'ZONES' | 'LIST'>('FOCUS')
    const [selectedZone, setSelectedZone] = useState<string>('ALL')
    const [onlyMyAssigned, setOnlyMyAssigned] = useState<boolean>(false)
    const isBlindLocked = Boolean(detail.isBlindCount)
    const [isBlind, setIsBlind] = useState<boolean>(detail.isBlindCount)
    const isLockedStatus = detail.status === 'APPROVED' || detail.status === 'CANCELLED'

    const [activeIdx, setActiveIdx] = useState<number>(0)
    const [savingLineId, setSavingLineId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [listFilter, setListFilter] = useState<'ALL' | 'UNCOUNTED' | 'COUNTED' | 'MATCHED' | 'VARIANCE'>('ALL')
    const [showSuccessToast, setShowSuccessToast] = useState(false)
    const [toastMessage, setToastMessage] = useState('Đã lưu số lượng kiểm kê')
    const [showNotePanel, setShowNotePanel] = useState(false)

    // Independent local input states for Cases & Loose Bottles to prevent mid-typing modulo jumps
    const [casesInput, setCasesInput] = useState<string>('')
    const [looseInput, setLooseInput] = useState<string>('')

    // Track unsaved modified lines for auto-saving on navigation
    const dirtyLineIdsRef = useRef<Set<string>>(new Set())
    const pendingFocusLineIdRef = useRef<string | null>(null)

    // Unlisted modal & zone completion states
    const [showAddUnlistedModal, setShowAddUnlistedModal] = useState(false)
    const [showZoneReportModal, setShowZoneReportModal] = useState(false)
    const [zoneReport, setZoneReport] = useState<any>(null)
    const [isCompletingZone, setIsCompletingZone] = useState(false)

    // Sync lines from detail props when parent refreshes
    useEffect(() => {
        setLines(detail.lines)
    }, [detail.lines])

    // Reset blind-incompatible list filters when switching to blind mode
    useEffect(() => {
        if (isBlind && (listFilter === 'MATCHED' || listFilter === 'VARIANCE')) {
            setListFilter('ALL')
        }
    }, [isBlind, listFilter])

    const myAssignedCount = useMemo(() => {
        if (!detail.currentUserId) return 0
        return lines.filter(l => l.assignedToId === detail.currentUserId).length
    }, [lines, detail.currentUserId])

    // Base lines filtered by "Only My Assigned" if toggled
    const baseScopedLines = useMemo(() => {
        if (onlyMyAssigned && detail.currentUserId) {
            return lines.filter(l => l.assignedToId === detail.currentUserId)
        }
        return lines
    }, [lines, onlyMyAssigned, detail.currentUserId])

    // Extract unique zones
    const zones = useMemo(() => {
        return Array.from(new Set(baseScopedLines.map(l => l.zone || l.locationCode || 'Khu vực chung')))
    }, [baseScopedLines])

    // Lines used in FOCUS mode (filtered by Zone & Search, NOT by listFilter so LIST->FOCUS index is always consistent)
    const focusLines = useMemo(() => {
        return baseScopedLines.filter(l => {
            const s = searchTerm.trim().toLowerCase()
            const itemZone = l.zone || l.locationCode || 'Khu vực chung'
            const matchZone = s ? true : (selectedZone === 'ALL' || itemZone === selectedZone || l.locationCode === selectedZone)
            const matchSearch = !s ||
                l.skuCode.toLowerCase().includes(s) ||
                l.productName.toLowerCase().includes(s) ||
                (l.vintage !== null && l.vintage !== undefined && String(l.vintage).includes(s)) ||
                (l.locationCode && l.locationCode.toLowerCase().includes(s))
            return matchZone && matchSearch
        })
    }, [baseScopedLines, searchTerm, selectedZone])

    // Lines used in LIST mode (focusLines + listFilter)
    const listLines = useMemo(() => {
        return focusLines.filter(l => {
            if (listFilter === 'UNCOUNTED') return l.qtyActual === null
            if (listFilter === 'COUNTED') return l.qtyActual !== null
            if (listFilter === 'MATCHED') return l.qtyActual !== null && l.variance === 0
            if (listFilter === 'VARIANCE') return l.qtyActual !== null && l.variance !== 0
            return true
        })
    }, [focusLines, listFilter])

    // Jump to newly added unlisted line once detail refreshes
    useEffect(() => {
        if (pendingFocusLineIdRef.current && focusLines.length > 0) {
            const targetIdx = focusLines.findIndex(l => l.id === pendingFocusLineIdRef.current)
            if (targetIdx !== -1) {
                setActiveIdx(targetIdx)
                setViewMode('FOCUS')
                pendingFocusLineIdRef.current = null
            }
        }
    }, [focusLines])

    const currentItem = focusLines[activeIdx] || focusLines[0] || null

    // Sync independent cases/loose inputs when switching to a different product line
    useEffect(() => {
        if (!currentItem) {
            setCasesInput('')
            setLooseInput('')
            setShowNotePanel(false)
            return
        }
        const upc = currentItem.unitsPerCase || 6
        if (currentItem.qtyActual === null) {
            setCasesInput('')
            setLooseInput('')
        } else {
            setCasesInput(String(Math.floor(currentItem.qtyActual / upc)))
            setLooseInput(String(currentItem.qtyActual % upc))
        }
        setShowNotePanel(Boolean(currentItem.notes || currentItem.varianceReason))
    }, [currentItem?.id])

    // Reset active index if out of bounds
    useEffect(() => {
        if (activeIdx >= focusLines.length && focusLines.length > 0) {
            setActiveIdx(0)
        }
    }, [focusLines.length, activeIdx])

    // Count statistics
    const overallCounted = baseScopedLines.filter(l => l.qtyActual !== null).length
    const overallPercent = baseScopedLines.length > 0 ? Math.round((overallCounted / baseScopedLines.length) * 100) : 0
    const remainingUncountedInZone = useMemo(() => {
        return focusLines.filter(l => l.qtyActual === null).length
    }, [focusLines])

    // Helper: Auto-save current line if it has unsaved modifications before navigating away
    const autoSaveDirtyLine = async (line: LineItem | null) => {
        if (!line || isLockedStatus || !dirtyLineIdsRef.current.has(line.id) || line.qtyActual === null) return
        dirtyLineIdsRef.current.delete(line.id)
        const res = await recordMobileCountLine({
            lineId: line.id,
            qtyActual: line.qtyActual,
            varianceReason: line.varianceReason || undefined,
            photoUrl: line.photoUrl || undefined,
            notes: line.notes || undefined
        })
        if (res.success) {
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, countedAt: new Date().toISOString() } : l))
            if (onRefreshed) onRefreshed()
        }
    }

    // Helper: Open a specific line by ID in FOCUS mode accurately
    const openLineInFocus = (lineId: string) => {
        void autoSaveDirtyLine(currentItem)
        let idx = focusLines.findIndex(l => l.id === lineId)
        if (idx !== -1) {
            setActiveIdx(idx)
            setViewMode('FOCUS')
            playFeedbackSound('tap')
            return
        }
        // If hidden by zone or search filter, relax filter so item is visible
        setSearchTerm('')
        setSelectedZone('ALL')
        pendingFocusLineIdRef.current = lineId
        setViewMode('FOCUS')
        playFeedbackSound('tap')
    }

    // Quick jump to next uncounted item
    const jumpToNextUncounted = () => {
        if (focusLines.length === 0) return
        void autoSaveDirtyLine(currentItem)
        const nextIdx = focusLines.findIndex((l, i) => i > activeIdx && l.qtyActual === null)
        if (nextIdx !== -1) {
            playFeedbackSound('chip')
            triggerHaptic('light')
            setActiveIdx(nextIdx)
            return
        }
        // Circular search from beginning
        const firstUncounted = focusLines.findIndex(l => l.qtyActual === null)
        if (firstUncounted !== -1) {
            playFeedbackSound('chip')
            triggerHaptic('light')
            setActiveIdx(firstUncounted)
        } else {
            playFeedbackSound('alert')
            setToastMessage('Đã hoàn thành kiểm đếm tất cả sản phẩm trong danh sách.')
            setShowSuccessToast(true)
            setTimeout(() => setShowSuccessToast(false), 2000)
        }
    }

    // Set exact actual quantity (syncInputs = true when triggered by buttons/stepper, false when typing)
    const setExactQty = (lineId: string, val: number | null, syncInputs: boolean = true) => {
        if (isLockedStatus) return
        playFeedbackSound('tap')
        triggerHaptic('light')
        dirtyLineIdsRef.current.add(lineId)

        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const upc = l.unitsPerCase || 6
                if (val === null) {
                    if (syncInputs) {
                        setCasesInput('')
                        setLooseInput('')
                    }
                    return { ...l, qtyActual: null, variance: null }
                }
                const next = Math.max(0, val)
                const variance = next - l.qtySystem
                if (syncInputs) {
                    setCasesInput(String(Math.floor(next / upc)))
                    setLooseInput(String(next % upc))
                }
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    // Quick increment chip handler
    const addDeltaQty = (lineId: string, delta: number) => {
        if (isLockedStatus) return
        playFeedbackSound('chip')
        triggerHaptic('medium')
        dirtyLineIdsRef.current.add(lineId)

        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const upc = l.unitsPerCase || 6
                const current = l.qtyActual !== null ? l.qtyActual : 0
                const next = Math.max(0, current + delta)
                const variance = next - l.qtySystem
                setCasesInput(String(Math.floor(next / upc)))
                setLooseInput(String(next % upc))
                return { ...l, qtyActual: next, variance }
            }
            return l
        }))
    }

    // Set variance reason
    const setVarianceReason = (lineId: string, reasonCode: string) => {
        if (isLockedStatus) return
        playFeedbackSound('tap')
        triggerHaptic('light')
        dirtyLineIdsRef.current.add(lineId)
        setLines(prev => prev.map(l => {
            if (l.id === lineId) {
                const nextReason = l.varianceReason === reasonCode ? null : reasonCode
                return { ...l, varianceReason: nextReason }
            }
            return l
        }))
    }

    // Set line notes
    const setLineNotes = (lineId: string, notesVal: string) => {
        if (isLockedStatus) return
        dirtyLineIdsRef.current.add(lineId)
        setLines(prev => prev.map(l => l.id === lineId ? { ...l, notes: notesVal } : l))
    }

    // Save current line and advance
    const saveCurrentLineAndNext = async (line: LineItem) => {
        if (isLockedStatus) return
        if (line.qtyActual === null && line.qtySystem > 0 && !isBlind) {
            const confirmed = await confirm({
                title: 'Xác nhận số lượng thực tế bằng 0',
                message: `Chưa nhập số lượng thực tế cho sản phẩm "${line.productName}". Tồn sổ sách: ${line.qtySystem} chai. Xác nhận ghi nhận số lượng thực tế bằng 0?`,
                confirmLabel: 'Xác nhận = 0',
                variant: 'warning',
            })
            if (!confirmed) return
        } else if (line.qtyActual === null && isBlind) {
            const confirmed = await confirm({
                title: 'Xác nhận số lượng thực tế bằng 0',
                message: `Chưa nhập số lượng cho sản phẩm "${line.productName}". Xác nhận kệ trống (0 chai)?`,
                confirmLabel: 'Xác nhận = 0',
                variant: 'warning',
            })
            if (!confirmed) return
        }

        setSavingLineId(line.id)
        const qtyActual = line.qtyActual !== null ? line.qtyActual : 0
        dirtyLineIdsRef.current.delete(line.id)
        const res = await recordMobileCountLine({
            lineId: line.id,
            qtyActual,
            varianceReason: line.varianceReason || undefined,
            photoUrl: line.photoUrl || undefined,
            notes: line.notes || undefined
        })
        setSavingLineId(null)

        if (res.success) {
            playFeedbackSound('success')
            triggerHaptic('success')
            const variance = qtyActual - line.qtySystem
            setLines(prev => prev.map(l => l.id === line.id ? { ...l, qtyActual, variance, countedAt: new Date().toISOString() } : l))
            if (onRefreshed) onRefreshed()

            setToastMessage('Đã lưu số lượng kiểm kê')
            setShowSuccessToast(true)
            setTimeout(() => setShowSuccessToast(false), 1200)

            // Auto advance: prioritize next uncounted item
            const nextUncountedIdx = focusLines.findIndex((l, i) => i > activeIdx && l.qtyActual === null)
            if (nextUncountedIdx !== -1) {
                setActiveIdx(nextUncountedIdx)
            } else if (activeIdx < focusLines.length - 1) {
                setActiveIdx(prev => prev + 1)
            }
        } else {
            playFeedbackSound('alert')
            toast.error(res.error || 'Không thể lưu dòng kiểm kê')
        }
    }

    const handleFinishZone = async (zoneName: string) => {
        await autoSaveDirtyLine(currentItem)
        setIsCompletingZone(true)
        const res = await completeZoneCount(detail.id, zoneName)
        setIsCompletingZone(false)
        if (res.success && res.summary) {
            playFeedbackSound('success')
            triggerHaptic('success')
            setZoneReport(res.summary)
            setShowZoneReportModal(true)
        } else {
            playFeedbackSound('alert')
            toast.error(res.error || 'Không thể tạo báo cáo đối soát khu vực')
        }
    }

    const getZoneStats = (zoneName: string) => {
        const zLines = baseScopedLines.filter(l => zoneName === 'ALL' || (l.zone || l.locationCode || 'Khu vực chung') === zoneName || l.locationCode === zoneName)
        const counted = zLines.filter(l => l.qtyActual !== null).length
        const hasDiff = !isBlind && zLines.some(l => l.variance !== null && l.variance !== 0)
        return {
            total: zLines.length,
            counted,
            percent: zLines.length > 0 ? Math.round((counted / zLines.length) * 100) : 0,
            hasDiff
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-32 select-none max-w-md mx-auto relative antialiased">
            {/* ─── COMPACT STICKY AUDIT HEADER (OPTIMIZED FOR MOBILE VIEWPORT) ─── */}
            <header className="bg-white border-b border-slate-200 px-3 py-2 sticky top-0 z-30 shadow-xs space-y-1.5">
                {/* Row 1: Navigation, Session Identity, Blind Toggle & Add SKU */}
                <div className="flex items-center justify-between gap-1.5">
                    <button
                        onClick={async () => {
                            await autoSaveDirtyLine(currentItem)
                            onBack()
                        }}
                        className="min-h-[38px] px-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-md flex items-center gap-1 text-xs font-bold transition cursor-pointer shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" /> Quay lại
                    </button>

                    <div className="flex-1 min-w-0 px-1 text-center">
                        <div className="flex items-center justify-center gap-1 truncate">
                            <span className="inline-block text-[10px] font-mono font-bold uppercase bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 shrink-0 whitespace-nowrap">
                                {detail.sessionNo}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate">{detail.warehouseName}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => {
                                if (isBlindLocked) {
                                    playFeedbackSound('alert')
                                    toast.info('Chế độ kiểm kê giấu tồn sổ: Tồn sổ sách và chênh lệch được bảo mật theo quy định kiểm toán.')
                                    return
                                }
                                setIsBlind(!isBlind)
                            }}
                            className={`min-h-[38px] px-2 rounded-md text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                                isBlind ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title={isBlindLocked ? 'Kiểm kê giấu tồn sổ (Blind count)' : 'Bật/Tắt hiển thị tồn sổ sách'}
                        >
                            {isBlind ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isBlind ? 'Giấu sổ' : 'Hiện sổ'}</span>
                        </button>

                        {!isLockedStatus && (
                            <button
                                onClick={() => setShowAddUnlistedModal(true)}
                                className="min-h-[38px] px-2.5 bg-[#0E7490] hover:bg-[#155E75] text-white font-bold rounded-md text-[11px] flex items-center justify-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition shrink-0"
                                title="Chèn mã phát sinh ngoài danh sách"
                            >
                                <Plus className="w-3.5 h-3.5" /> Thêm mã
                            </button>
                        )}
                    </div>
                </div>

                {/* Row 2: Slim Progress Bar + Compact Utility Pills */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span>
                                Đã đếm: <strong className="text-slate-900 font-mono">{overallCounted}/{baseScopedLines.length}</strong> ({overallPercent}%)
                            </span>
                            {remainingUncountedInZone > 0 && (
                                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                                    Còn {remainingUncountedInZone}
                                </span>
                            )}
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-[#0E7490] h-full rounded-full transition-all duration-300"
                                style={{ width: `${overallPercent}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {myAssignedCount > 0 && (
                            <button
                                onClick={() => {
                                    setOnlyMyAssigned(!onlyMyAssigned)
                                    setActiveIdx(0)
                                    playFeedbackSound('tap')
                                }}
                                className={`min-h-[30px] px-2 rounded text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                                    onlyMyAssigned
                                        ? 'bg-cyan-700 text-white border-cyan-700'
                                        : 'bg-white text-cyan-800 border-cyan-300 hover:bg-cyan-50'
                                }`}
                            >
                                <UserCheck className="w-3 h-3" />
                                <span>Của tôi ({myAssignedCount})</span>
                            </button>
                        )}
                        {onOpenTableModal && (
                            <button
                                onClick={async () => {
                                    await autoSaveDirtyLine(currentItem)
                                    onOpenTableModal()
                                }}
                                className="min-h-[30px] px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer active:scale-95 transition"
                                title="Mở bảng kiểm kê dạng lưới"
                            >
                                <Table className="w-3 h-3 text-[#0E7490]" /> Bảng lưới
                            </button>
                        )}
                        {onOpenReport && (
                            <button
                                onClick={async () => {
                                    await autoSaveDirtyLine(currentItem)
                                    onOpenReport(detail.id)
                                }}
                                className="min-h-[30px] px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer active:scale-95 transition"
                                title="Xem biên bản đối soát A4"
                            >
                                <FileText className="w-3 h-3 text-emerald-700" /> A4
                            </button>
                        )}
                    </div>
                </div>

                {/* Status Banners (DRAFT or APPROVED/LOCKED) */}
                {detail.status === 'DRAFT' && (
                    <div className="bg-amber-50 border border-amber-300 px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs font-bold text-amber-900">
                        <span className="flex items-center gap-1.5 truncate">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Phiếu đang ở trạng thái Nháp
                        </span>
                        <button
                            onClick={async () => {
                                const res = await startStockCount(detail.id)
                                if (res.success && onRefreshed) onRefreshed()
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] shrink-0 active:scale-95 cursor-pointer"
                        >
                            Bắt đầu đếm
                        </button>
                    </div>
                )}

                {isLockedStatus && (
                    <div className="bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            Phiếu đã {detail.status === 'APPROVED' ? 'Phê duyệt (Khóa chỉnh sửa)' : 'Hủy'}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-white px-2 py-0.5 rounded border border-slate-200">
                            Chỉ xem
                        </span>
                    </div>
                )}
            </header>

            {/* ─── TOAST NOTIFICATION ─── */}
            {showSuccessToast && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#0E7490] text-white font-bold text-xs px-4 py-2 rounded-full shadow-xl z-50 flex items-center gap-2 border border-cyan-300/40">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 1: ZONES OVERVIEW (VỊ TRÍ KHO HÀNG)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'ZONES' && (
                <main className="p-3.5 space-y-3.5 flex-1">
                    <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#0E7490]" />
                            Vị trí kho và dãy kệ
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Chọn vị trí kiểm đếm để lọc danh sách sản phẩm theo kệ</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                        {/* All Zones Card */}
                        <button
                            onClick={() => {
                                void autoSaveDirtyLine(currentItem)
                                setSelectedZone('ALL')
                                setActiveIdx(0)
                                setViewMode('FOCUS')
                                playFeedbackSound('tap')
                            }}
                            className={`p-3.5 bg-white rounded-lg border-2 text-left relative overflow-hidden shadow-xs active:scale-95 transition-all duration-100 select-none cursor-pointer space-y-2 ${
                                selectedZone === 'ALL' ? 'border-[#0E7490]' : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex justify-between items-center">
                                <span className="p-1.5 bg-teal-50 text-[#0E7490] rounded-md">
                                    <MapPin className="w-4 h-4" />
                                </span>
                                <span className="inline-block text-[10px] font-mono font-bold text-[#0E7490] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 whitespace-nowrap shrink-0">
                                    TẤT CẢ
                                </span>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900">Toàn bộ kho</h4>
                                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{overallCounted}/{baseScopedLines.length} mã đã đếm</p>
                            </div>
                            <div className="text-[11px] font-bold text-[#0891B2] flex items-center gap-1 pt-0.5">
                                Đếm liên tục <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                        </button>

                        {/* Specific Location Zone Cards */}
                        {zones.map(zName => {
                            const zStats = getZoneStats(zName)
                            const isDone = zStats.total > 0 && zStats.percent === 100

                            return (
                                <button
                                    key={zName}
                                    onClick={() => {
                                        void autoSaveDirtyLine(currentItem)
                                        setSelectedZone(zName)
                                        setActiveIdx(0)
                                        setViewMode('FOCUS')
                                        playFeedbackSound('tap')
                                    }}
                                    className={`p-3.5 rounded-lg border-2 text-left relative overflow-hidden shadow-xs active:scale-95 transition-all duration-100 select-none cursor-pointer space-y-2 ${
                                        selectedZone === zName
                                            ? 'border-[#0E7490] bg-teal-50/20'
                                            : isDone
                                                ? 'bg-emerald-50/70 border-emerald-400'
                                                : zStats.hasDiff
                                                    ? 'bg-amber-50/70 border-amber-300'
                                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className={`p-1.5 rounded-md ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                            <Grid className="w-4 h-4" />
                                        </span>
                                        {isDone ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0">
                                                <CheckCheck className="w-3 h-3" /> Xong
                                            </span>
                                        ) : zStats.hasDiff ? (
                                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md inline-block whitespace-nowrap shrink-0">
                                                Có lệch
                                            </span>
                                        ) : null}
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 truncate">{zName}</h4>
                                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                            {zStats.counted}/{zStats.total} mã ({zStats.percent}%)
                                        </p>
                                    </div>

                                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                        <div
                                            className={`h-full ${isDone ? 'bg-emerald-600' : 'bg-[#0E7490]'}`}
                                            style={{ width: `${zStats.percent}%` }}
                                        />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 2: FOCUS VIEW (KIỂM ĐẾM CHI TIẾT TỪNG MÃ)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'FOCUS' && (
                <main className="p-3 flex-1 flex flex-col space-y-2.5">
                    {/* Fast SKU Quick Finder Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm nhanh mã SKU, tên rượu, niên vụ, kệ..."
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value)
                                setActiveIdx(0)
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    if (focusLines.length > 0) {
                                        playFeedbackSound('chip')
                                        triggerHaptic('light')
                                        setActiveIdx(0)
                                    }
                                }
                            }}
                            className="w-full bg-white border border-slate-300 text-slate-900 font-bold rounded-lg pl-9 pr-10 py-2.5 text-base sm:text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 shadow-2xs transition"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('')
                                    setActiveIdx(0)
                                }}
                                className="absolute right-2 top-2 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-xs font-bold cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {!currentItem ? (
                        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3 shadow-xs my-4">
                            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
                            <h4 className="text-sm font-bold text-slate-900">
                                {searchTerm ? `Không tìm thấy mã khớp với "${searchTerm}"` : 'Không có sản phẩm nào trong bộ lọc này'}
                            </h4>
                            <p className="text-xs text-slate-500">Vui lòng kiểm tra lại từ khóa hoặc bộ lọc khu vực</p>
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    onClick={() => {
                                        setSearchTerm('')
                                        setSelectedZone('ALL')
                                        setOnlyMyAssigned(false)
                                        setActiveIdx(0)
                                    }}
                                    className="min-h-[44px] px-4 bg-[#0E7490] text-white font-bold text-xs rounded-md shadow-xs cursor-pointer active:scale-95 transition"
                                >
                                    Hiển thị toàn bộ ({lines.length} mã)
                                </button>
                                {!isLockedStatus && (
                                    <button
                                        onClick={() => setShowAddUnlistedModal(true)}
                                        className="min-h-[44px] px-4 bg-[#0E7490] hover:bg-[#155E75] text-white font-bold text-xs rounded-md shadow-xs cursor-pointer active:scale-95 transition flex items-center gap-1"
                                    >
                                        <Plus className="w-4 h-4" /> Chèn mã mới
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Location & Quick Jump Bar */}
                            <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs shadow-2xs gap-2">
                                <div className="flex items-center gap-1.5 font-bold text-slate-700 min-w-0">
                                    <MapPin className="w-3.5 h-3.5 text-[#0E7490] shrink-0" />
                                    <span className="truncate">
                                        Kệ: <strong className="text-[#0E7490] font-mono font-bold">{currentItem.zone || currentItem.locationCode}</strong>
                                    </span>
                                    {selectedZone !== 'ALL' && (
                                        <button
                                            onClick={() => {
                                                setSelectedZone('ALL')
                                                setActiveIdx(0)
                                            }}
                                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 cursor-pointer"
                                            title="Bỏ lọc kệ"
                                        >
                                            × Tất cả kệ
                                        </button>
                                    )}
                                    {currentItem.assignedToName && (
                                        <span className="hidden xs:inline-flex items-center gap-0.5 text-[10px] font-semibold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 truncate">
                                            <UserCheck className="w-3 h-3 shrink-0" />
                                            {currentItem.assignedToName}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="inline-block text-[11px] font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">
                                        {activeIdx + 1}/{focusLines.length}
                                    </span>

                                    {remainingUncountedInZone > 0 && currentItem.qtyActual !== null && (
                                        <button
                                            onClick={jumpToNextUncounted}
                                            className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer active:scale-95 transition border border-amber-300"
                                            title="Chuyển nhanh tới mã tiếp theo chưa đếm"
                                        >
                                            <ArrowRight className="w-3 h-3 text-amber-700" />
                                            <span>Chưa đếm</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* ─── HERO PRODUCT & VINTAGE CARD ─── */}
                            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-3">
                                {/* Vintage Hero Pill & SKU Bar */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md whitespace-nowrap">
                                            {currentItem.skuCode}
                                        </span>
                                        {currentItem.countedAt && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                <Check className="w-3 h-3" /> Đã lưu
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 text-slate-900 px-2.5 py-0.5 rounded-md shadow-2xs">
                                        <span className="text-xs font-bold font-mono tracking-wide">
                                            {currentItem.vintage ? `Niên vụ: ${currentItem.vintage}` : 'Không niên vụ (NV)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Product Name & Spec */}
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                                        {currentItem.productName}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                        Quy cách: <strong className="text-slate-800 font-bold">{currentItem.unitsPerCase || 6} chai / thùng</strong>
                                    </p>
                                </div>

                                {/* ─── COUNTING PODS: CASES & LOOSE BOTTLES ─── */}
                                {(() => {
                                    const upc = currentItem.unitsPerCase || 6
                                    const total = currentItem.qtyActual !== null ? currentItem.qtyActual : 0
                                    const displayCasesNum = casesInput !== '' ? (parseInt(casesInput, 10) || 0) : Math.floor(total / upc)
                                    const displayLooseNum = looseInput !== '' ? (parseInt(looseInput, 10) || 0) : (total % upc)

                                    return (
                                        <div className="space-y-2.5">
                                            {/* System Book Stock Bar (if not blind) */}
                                            {!isBlind && (
                                                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold gap-2">
                                                    <span className="text-slate-600 truncate">
                                                        Tồn sổ: <strong className="text-slate-900 font-mono font-bold">{formatCasesAndBottles(currentItem.qtySystem, upc)}</strong> ({currentItem.qtySystem}c)
                                                    </span>

                                                    {!isLockedStatus && currentItem.qtySystem >= 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, currentItem.qtySystem, true)}
                                                            className="min-h-[30px] px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-md border border-emerald-300 cursor-pointer active:scale-95 transition flex items-center gap-1 shrink-0"
                                                        >
                                                            <Check className="w-3.5 h-3.5 text-emerald-700" />
                                                            Khớp tồn sổ
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Dual Ergonomic Counter Pods (Cases vs Loose) */}
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {/* POD 1: SỐ THÙNG */}
                                                <div className="bg-slate-50 border border-slate-200/90 rounded-lg p-2.5 text-center space-y-1.5 shadow-2xs">
                                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                                                        <Package className="w-3.5 h-3.5 text-[#0E7490]" />
                                                        <span>Số thùng ({upc}c)</span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={isLockedStatus}
                                                            onClick={() => setExactQty(currentItem.id, Math.max(0, total - upc), true)}
                                                            className="min-h-[46px] min-w-[46px] rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Giảm 1 thùng"
                                                        >
                                                            <Minus className="w-5 h-5 text-slate-700" />
                                                        </button>

                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            min="0"
                                                            disabled={isLockedStatus}
                                                            value={casesInput}
                                                            placeholder="0"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => {
                                                                const raw = e.target.value
                                                                setCasesInput(raw)
                                                                if (raw === '' && looseInput === '') {
                                                                    setExactQty(currentItem.id, null, false)
                                                                    return
                                                                }
                                                                const newCases = Math.max(0, parseInt(raw, 10) || 0)
                                                                const curLoose = Math.max(0, parseInt(looseInput, 10) || 0)
                                                                setExactQty(currentItem.id, newCases * upc + curLoose, false)
                                                            }}
                                                            className="w-full text-center text-2xl sm:text-3xl font-bold font-mono text-[#0E7490] bg-transparent outline-none py-0.5 disabled:opacity-60"
                                                        />

                                                        <button
                                                            type="button"
                                                            disabled={isLockedStatus}
                                                            onClick={() => setExactQty(currentItem.id, total + upc, true)}
                                                            className="min-h-[46px] min-w-[46px] rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Tăng 1 thùng"
                                                        >
                                                            <Plus className="w-5 h-5 text-slate-700" />
                                                        </button>
                                                    </div>

                                                    {/* Quick Multi-Add Chips for Cases */}
                                                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-200">
                                                        {[1, 2, 5, 10].map(cDelta => (
                                                            <button
                                                                key={`case_${cDelta}`}
                                                                type="button"
                                                                disabled={isLockedStatus}
                                                                onClick={() => addDeltaQty(currentItem.id, cDelta * upc)}
                                                                className="min-h-[34px] py-1 bg-white hover:bg-teal-50 active:scale-90 disabled:opacity-40 text-[#0E7490] border border-slate-200 hover:border-teal-300 rounded-md text-xs font-bold transition cursor-pointer shadow-2xs"
                                                            >
                                                                +{cDelta}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* POD 2: CHAI LẺ */}
                                                <div className="bg-slate-50 border border-slate-200/90 rounded-lg p-2.5 text-center space-y-1.5 shadow-2xs">
                                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                                                        <Wine className="w-3.5 h-3.5 text-slate-700" />
                                                        <span>Chai lẻ rời</span>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-1">
                                                        <button
                                                            type="button"
                                                            disabled={isLockedStatus}
                                                            onClick={() => setExactQty(currentItem.id, Math.max(0, total - 1), true)}
                                                            className="min-h-[46px] min-w-[46px] rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Giảm 1 chai"
                                                        >
                                                            <Minus className="w-5 h-5 text-slate-700" />
                                                        </button>

                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            min="0"
                                                            disabled={isLockedStatus}
                                                            value={looseInput}
                                                            placeholder="0"
                                                            onFocus={e => e.target.select()}
                                                            onChange={e => {
                                                                const raw = e.target.value
                                                                setLooseInput(raw)
                                                                if (raw === '' && casesInput === '') {
                                                                    setExactQty(currentItem.id, null, false)
                                                                    return
                                                                }
                                                                const newLoose = Math.max(0, parseInt(raw, 10) || 0)
                                                                const curCases = Math.max(0, parseInt(casesInput, 10) || 0)
                                                                setExactQty(currentItem.id, curCases * upc + newLoose, false)
                                                            }}
                                                            className="w-full text-center text-2xl sm:text-3xl font-bold font-mono text-slate-800 bg-transparent outline-none py-0.5 disabled:opacity-60"
                                                        />

                                                        <button
                                                            type="button"
                                                            disabled={isLockedStatus}
                                                            onClick={() => setExactQty(currentItem.id, total + 1, true)}
                                                            className="min-h-[46px] min-w-[46px] rounded-md bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-bold text-xl flex items-center justify-center active:scale-95 cursor-pointer border border-slate-300 shadow-2xs"
                                                            aria-label="Tăng 1 chai"
                                                        >
                                                            <Plus className="w-5 h-5 text-slate-700" />
                                                        </button>
                                                    </div>

                                                    {/* Quick Multi-Add Chips for Bottles */}
                                                    <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-200">
                                                        {[1, 2, 3, 5].map(bDelta => (
                                                            <button
                                                                key={`bottle_${bDelta}`}
                                                                type="button"
                                                                disabled={isLockedStatus}
                                                                onClick={() => addDeltaQty(currentItem.id, bDelta)}
                                                                className="min-h-[34px] py-1 bg-white hover:bg-slate-100 active:scale-90 disabled:opacity-40 text-slate-800 border border-slate-200 hover:border-slate-300 rounded-md text-xs font-bold transition cursor-pointer shadow-2xs"
                                                            >
                                                                +{bDelta}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quick Action Helpers: Empty Shelf / Clear / Toggle Note */}
                                            {!isLockedStatus && (
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExactQty(currentItem.id, 0, true)}
                                                        className="flex-1 min-h-[36px] bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-slate-300"
                                                    >
                                                        Kệ trống (0 chai)
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNotePanel(prev => !prev)}
                                                        className={`min-h-[36px] px-2.5 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                                            showNotePanel || currentItem.varianceReason || currentItem.notes
                                                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                                        }`}
                                                    >
                                                        <Tag className="w-3.5 h-3.5 text-amber-700" />
                                                        <span>Ghi chú / Lý do</span>
                                                    </button>

                                                    {currentItem.qtyActual !== null && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExactQty(currentItem.id, null, true)}
                                                            className="px-2.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 rounded-md text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-rose-200"
                                                            title="Hủy kết quả đếm của mã này"
                                                        >
                                                            Xóa
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* ─── VISUAL MATH & VARIANCE COCKPIT ─── */}
                                            <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg p-3 space-y-1.5 shadow-xs">
                                                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                                                    <span>Quy đổi thực tế:</span>
                                                    <span className="font-mono text-[#0E7490] text-xs">
                                                        [{displayCasesNum} thùng × {upc}] + [{displayLooseNum} chai lẻ]
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                                                    <div className="text-left">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Tổng thực tế</span>
                                                        <span className="text-2xl font-bold font-mono text-[#0E7490]">
                                                            {total} <span className="text-xs font-semibold text-slate-500">chai</span>
                                                        </span>
                                                    </div>

                                                    {!isBlind && currentItem.qtyActual !== null && (
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-slate-500 font-bold uppercase block">Chênh lệch tồn sổ</span>
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
                                                                currentItem.variance === 0
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                    : currentItem.variance! > 0
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            }`}>
                                                                {currentItem.variance === 0
                                                                    ? 'Khớp số liệu'
                                                                    : currentItem.variance! > 0
                                                                        ? `Thừa: +${currentItem.variance} chai`
                                                                        : `Thiếu: ${currentItem.variance} chai`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ─── VARIANCE REASON & NOTES PICKER (BLIND-SAFE) ─── */}
                                            {(showNotePanel || (!isBlind && currentItem.qtyActual !== null && currentItem.variance !== 0)) && (
                                                <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-3 space-y-2.5">
                                                    <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                                                        <span className="flex items-center gap-1.5">
                                                            <Tag className="w-4 h-4 text-amber-700" />
                                                            {isBlind ? 'Phân loại phát sinh / Ghi chú:' : 'Lý do chênh lệch & Ghi chú:'}
                                                        </span>
                                                        <span className="text-[10px] text-amber-700 font-semibold">(Tùy chọn)</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {REASONS.map(r => {
                                                            const isSelected = currentItem.varianceReason === r.code
                                                            return (
                                                                <button
                                                                    key={r.code}
                                                                    type="button"
                                                                    disabled={isLockedStatus}
                                                                    onClick={() => setVarianceReason(currentItem.id, r.code)}
                                                                    className={`min-h-[38px] px-2.5 py-1.5 rounded-md text-xs font-bold text-left flex items-center transition cursor-pointer border ${
                                                                        isSelected
                                                                            ? 'bg-[#0E7490] text-white border-[#0E7490] shadow-2xs'
                                                                            : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                                                                    }`}
                                                                >
                                                                    <span className="truncate">{r.label}</span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>

                                                    <div>
                                                        <input
                                                            type="text"
                                                            disabled={isLockedStatus}
                                                            placeholder="Nhập ghi chú chi tiết (VD: Vỡ 1 chai, hàng mẫu...)"
                                                            value={currentItem.notes || ''}
                                                            onChange={e => setLineNotes(currentItem.id, e.target.value)}
                                                            className="w-full bg-white border border-amber-300 text-slate-900 rounded-md px-3 py-2 text-base sm:text-xs font-semibold outline-none focus:border-[#0E7490]"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* ─── PRIMARY THUMB ACTION: SAVE & NEXT ─── */}
                                {!isLockedStatus && (
                                    <button
                                        onClick={() => saveCurrentLineAndNext(currentItem)}
                                        disabled={savingLineId === currentItem.id}
                                        className="w-full min-h-[50px] bg-[#0E7490] hover:bg-[#0A738D] active:scale-95 text-white font-bold text-base rounded-lg flex items-center justify-center gap-2.5 shadow-md transition-all duration-100 cursor-pointer disabled:opacity-50 select-none"
                                    >
                                        {savingLineId === currentItem.id ? (
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5 text-white" />
                                                Lưu và tiếp tục
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* ─── THUMB STEPPER NAVIGATION ─── */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    disabled={activeIdx === 0}
                                    onClick={() => {
                                        void autoSaveDirtyLine(currentItem)
                                        playFeedbackSound('tap')
                                        triggerHaptic('light')
                                        setActiveIdx(prev => Math.max(0, prev - 1))
                                    }}
                                    className="min-h-[46px] bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-30 text-slate-800 rounded-md font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all duration-100 shadow-2xs select-none"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Mã trước
                                </button>

                                <button
                                    onClick={jumpToNextUncounted}
                                    className="min-h-[46px] bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-md font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all duration-100 shadow-2xs select-none"
                                    title="Chuyển tới mã tiếp theo chưa đếm"
                                >
                                    <span>Chưa đếm ({remainingUncountedInZone})</span>
                                </button>

                                <button
                                    disabled={activeIdx >= focusLines.length - 1}
                                    onClick={() => {
                                        void autoSaveDirtyLine(currentItem)
                                        playFeedbackSound('tap')
                                        triggerHaptic('light')
                                        setActiveIdx(prev => Math.min(focusLines.length - 1, prev + 1))
                                    }}
                                    className="min-h-[46px] bg-white hover:bg-slate-50 border border-slate-300 disabled:opacity-30 text-slate-800 rounded-md font-bold text-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all duration-100 shadow-2xs select-none"
                                >
                                    Mã sau <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* ─── FINISH ZONE / WAREHOUSE SUMMARY CTA ─── */}
                            <div className="pt-1">
                                <button
                                    onClick={() => handleFinishZone(selectedZone)}
                                    disabled={isCompletingZone}
                                    className="w-full min-h-[46px] bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-md flex items-center justify-center gap-2 border border-slate-300 shadow-2xs cursor-pointer active:scale-95 transition-all duration-100 select-none"
                                >
                                    {isCompletingZone ? (
                                        <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 text-emerald-600" />
                                            {selectedZone === 'ALL'
                                                ? 'Xem tổng kết đối soát toàn kho'
                                                : `Hoàn thành kiểm đếm kệ (${selectedZone})`}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODE 3: FULL LIST VIEW WITH QUICK FILTERS (DANH SÁCH)
            ═══════════════════════════════════════════════════════════════ */}
            {viewMode === 'LIST' && (
                <main className="p-3.5 space-y-3 flex-1">
                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã SKU, tên rượu, niên vụ, kệ..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg pl-9 pr-10 py-2.5 text-base sm:text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs (Blind-safe when isBlind is true) */}
                    {isBlind ? (
                        <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => { setListFilter('ALL'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'ALL' ? 'bg-[#0E7490] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Tất cả ({focusLines.length})
                            </button>

                            <button
                                onClick={() => { setListFilter('UNCOUNTED'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'UNCOUNTED' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Chưa đếm ({focusLines.filter(l => l.qtyActual === null).length})
                            </button>

                            <button
                                onClick={() => { setListFilter('COUNTED'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'COUNTED' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Đã đếm ({focusLines.filter(l => l.qtyActual !== null).length})
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => { setListFilter('ALL'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'ALL' ? 'bg-[#0E7490] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Tất cả ({focusLines.length})
                            </button>

                            <button
                                onClick={() => { setListFilter('UNCOUNTED'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'UNCOUNTED' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Chưa đếm ({focusLines.filter(l => l.qtyActual === null).length})
                            </button>

                            <button
                                onClick={() => { setListFilter('MATCHED'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'MATCHED' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Khớp ({focusLines.filter(l => l.qtyActual !== null && l.variance === 0).length})
                            </button>

                            <button
                                onClick={() => { setListFilter('VARIANCE'); playFeedbackSound('tap') }}
                                className={`min-h-[36px] rounded-md text-xs font-bold transition cursor-pointer ${
                                    listFilter === 'VARIANCE' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Lệch ({focusLines.filter(l => l.qtyActual !== null && l.variance !== 0).length})
                            </button>
                        </div>
                    )}

                    {/* List Items */}
                    <div className="space-y-2">
                        {listLines.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-slate-200 text-xs font-bold">
                                Không có sản phẩm nào khớp với bộ lọc
                            </div>
                        ) : (
                            listLines.map((line) => {
                                const isCounted = line.qtyActual !== null
                                const isMatched = isCounted && line.variance === 0

                                return (
                                    <div
                                        key={line.id}
                                        onClick={() => openLineInFocus(line.id)}
                                        className={`p-3.5 rounded-lg border transition-all duration-100 cursor-pointer active:scale-95 select-none ${
                                            !isCounted
                                                ? 'bg-white border-slate-200 hover:border-slate-300'
                                                : isBlind
                                                    ? 'bg-teal-50/40 border-teal-300'
                                                    : isMatched
                                                        ? 'bg-emerald-50/50 border-emerald-300'
                                                        : 'bg-amber-50/50 border-amber-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="inline-block font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 whitespace-nowrap shrink-0">
                                                        {line.skuCode}
                                                    </span>
                                                    <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300 whitespace-nowrap shrink-0">
                                                        NV: {line.vintage ?? 'NV'}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-2">
                                                    {line.productName}
                                                </h4>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="text-[10px] text-slate-500 font-mono block">
                                                    Kệ: {line.zone || line.locationCode}
                                                </span>
                                                <span className={`text-xs font-mono font-bold mt-1 inline-block px-2 py-0.5 rounded-md ${
                                                    !isCounted
                                                        ? 'bg-slate-100 text-slate-600'
                                                        : isBlind
                                                            ? 'bg-teal-100 text-teal-900'
                                                            : isMatched
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-amber-100 text-amber-900'
                                                }`}>
                                                    {isCounted ? `${line.qtyActual} chai` : 'Chưa đếm'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </main>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                ZONE VARIANCE REPORT MODAL (ĐỐI SOÁT TẠI CHỖ — BLIND-SAFE)
            ═══════════════════════════════════════════════════════════════ */}
            {showZoneReportModal && zoneReport && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 text-slate-900 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-modal-in">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                            <div>
                                <span className="inline-block text-[10px] font-mono uppercase font-bold text-[#0E7490] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 whitespace-nowrap shrink-0">
                                    {isBlind ? 'Tổng kết tiến độ kiểm đếm' : 'Báo cáo đối soát khu vực'}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 mt-1">{zoneReport.zoneName}</h3>
                            </div>
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold hover:bg-slate-200 active:scale-90 transition-all flex items-center justify-center cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {isBlind ? (
                            /* Blind-Safe Summary (No book stock or variance exposure) */
                            <div className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase block">Tổng số mã</span>
                                        <strong className="text-lg font-bold text-slate-900 font-mono">{zoneReport.totalItems}</strong>
                                    </div>
                                    <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-teal-800 uppercase block">Đã đếm</span>
                                        <strong className="text-lg font-bold text-teal-700 font-mono">{zoneReport.countedCount}</strong>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Chưa đếm</span>
                                        <strong className="text-lg font-bold text-amber-700 font-mono">{zoneReport.uncountedCount}</strong>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-md bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <EyeOff className="w-4 h-4 text-amber-700 shrink-0" />
                                        Chế độ Kiểm kê mù (Blind Count)
                                    </div>
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        Số liệu chênh lệch được ẩn trên thiết bị đếm hiện trường và sẽ được đối soát trên Biên bản kiểm kê của Quản lý kho / Kế toán.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* KPI Summary Grid */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Khớp số liệu</span>
                                        <strong className="text-lg font-bold text-emerald-700 font-mono">{zoneReport.matchedCount}</strong>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Thừa</span>
                                        <strong className="text-lg font-bold text-amber-700 font-mono">{zoneReport.overCount}</strong>
                                    </div>
                                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-md text-center">
                                        <span className="text-[10px] font-bold text-rose-800 uppercase block">Thiếu</span>
                                        <strong className="text-lg font-bold text-rose-700 font-mono">{zoneReport.underCount}</strong>
                                    </div>
                                </div>

                                {zoneReport.uncountedCount > 0 && (
                                    <div className="bg-amber-50 border border-amber-300 px-3 py-2 rounded-md text-xs font-bold text-amber-900 flex items-center justify-between">
                                        <span>Còn {zoneReport.uncountedCount} mã trong khu vực chưa đếm</span>
                                        <button
                                            onClick={() => {
                                                setShowZoneReportModal(false)
                                                jumpToNextUncounted()
                                            }}
                                            className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] font-bold cursor-pointer"
                                        >
                                            Đếm tiếp
                                        </button>
                                    </div>
                                )}

                                {/* Variance Line Items Table */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        Danh sách mã chênh lệch cần rà soát:
                                    </h4>

                                    {zoneReport.varianceLines.length === 0 ? (
                                        <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                                            Số liệu thực tế đã đếm khớp hoàn toàn với sổ sách.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {zoneReport.varianceLines.map((vl: any) => (
                                                <div key={vl.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="inline-block font-mono text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                                                                    {vl.skuCode}
                                                                </span>
                                                                <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                                                                    NV: {vl.vintage ?? 'NV'}
                                                                </span>
                                                            </div>
                                                            <h5 className="font-bold text-slate-900 mt-1">{vl.productName}</h5>
                                                        </div>

                                                        <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold shrink-0 ${
                                                            vl.variance > 0
                                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                                : 'bg-rose-100 text-rose-900 border border-rose-300'
                                                        }`}>
                                                            {vl.variance > 0 ? `+${vl.variance}` : vl.variance} chai
                                                        </span>
                                                    </div>

                                                    <div className="flex justify-between items-center text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-200">
                                                        <span>Tồn sổ: {vl.qtySystem} · Thực tế: {vl.qtyActual}</span>
                                                        <button
                                                            onClick={() => {
                                                                setShowZoneReportModal(false)
                                                                openLineInFocus(vl.id)
                                                            }}
                                                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[#0E7490] font-bold rounded-lg border border-slate-300 shadow-2xs cursor-pointer active:scale-95"
                                                        >
                                                            Kiểm đếm lại mã này
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="flex gap-2 pt-2">
                            {onOpenReport && (
                                <button
                                    onClick={() => {
                                        setShowZoneReportModal(false)
                                        onOpenReport(detail.id)
                                    }}
                                    className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 transition"
                                >
                                    Báo cáo đối soát A4
                                </button>
                            )}
                            <button
                                onClick={() => setShowZoneReportModal(false)}
                                className="flex-1 min-h-[44px] bg-[#0E7490] hover:bg-[#0A738D] text-white font-bold text-xs rounded-md shadow-xs cursor-pointer active:scale-95 transition"
                            >
                                Tiếp tục kiểm kê
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                MODAL CHÈN MÃ / VINTAGE NGOÀI DANH SÁCH
            ═══════════════════════════════════════════════════════════════ */}
            {showAddUnlistedModal && (
                <AddUnlistedModal
                    sessionId={detail.id}
                    sessionNo={detail.sessionNo}
                    warehouseId={detail.warehouseId}
                    defaultZone={selectedZone}
                    zones={zones}
                    onClose={() => setShowAddUnlistedModal(false)}
                    onSuccess={(newLineId) => {
                        if (newLineId) {
                            pendingFocusLineIdRef.current = newLineId
                        }
                        if (onRefreshed) onRefreshed()
                    }}
                />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                FLOATING BOTTOM NAVIGATION BAR (THUMB ZONE)
            ═══════════════════════════════════════════════════════════════ */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] z-40 shadow-lg">
                <div className="max-w-md mx-auto grid grid-cols-3 gap-1.5">
                    <button
                        onClick={() => {
                            void autoSaveDirtyLine(currentItem)
                            setViewMode('ZONES')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-md flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'ZONES'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <Grid className="w-4 h-4" />
                        Vị trí kho ({zones.length})
                    </button>

                    <button
                        onClick={() => {
                            void autoSaveDirtyLine(currentItem)
                            setViewMode('FOCUS')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-md flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'FOCUS'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <Layers className="w-4 h-4" />
                        Kiểm đếm chi tiết
                    </button>

                    <button
                        onClick={() => {
                            void autoSaveDirtyLine(currentItem)
                            setViewMode('LIST')
                            playFeedbackSound('tap')
                        }}
                        className={`min-h-[48px] py-1.5 rounded-md flex flex-col items-center justify-center gap-1 font-bold text-[11px] transition cursor-pointer active:scale-95 ${
                            viewMode === 'LIST'
                                ? 'bg-[#0E7490] text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                    >
                        <ListFilter className="w-4 h-4" />
                        Danh sách ({focusLines.length})
                    </button>
                </div>
            </nav>
            {dialog}
        </div>
    )
}

