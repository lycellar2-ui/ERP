'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    Download, Upload, Search, Filter, Eye, EyeOff, FileSpreadsheet,
    Loader2, ChevronDown, ChevronRight, X, RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getStockVelocityReport,
    uploadHistoricalStockExcel,
    exportStockVelocityExcel,
    type StockVelocityReportResult,
    type StockVelocityItem,
} from './actions-stock-velocity'

interface Props {
    isEn?: boolean
    initialData?: StockVelocityReportResult
}

export function StockVelocityReport({ isEn = false, initialData }: Props) {
    const [loading, setLoading] = useState<boolean>(!initialData)
    const [data, setData] = useState<StockVelocityReportResult | null>(initialData ?? null)
    const [cycleMonths, setCycleMonths] = useState<number>(initialData?.summary?.cycleMonths ?? 6)
    const [showOldHistory, setShowOldHistory] = useState<boolean>(false) // Mặc định thu gọn dữ liệu cũ theo yêu cầu
    const [showTasting, setShowTasting] = useState<boolean>(false)
    const [searchQuery, setSearchQuery] = useState<string>('')
    const [producerFilter, setProducerFilter] = useState<string>('ALL')
    const [collapsedProducers, setCollapsedProducers] = useState<Record<string, boolean>>({})
    const [exporting, setExporting] = useState<boolean>(false)
    const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false)
    const [uploading, setUploading] = useState<boolean>(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)

    // Load data
    const loadReport = async (cycle: number = cycleMonths) => {
        try {
            setLoading(true)

            // 1. Prioritize HTTP API Route for resilient client fetching
            try {
                const apiRes = await fetch(`/api/reports/stock-velocity?cycleMonths=${cycle}`, {
                    cache: 'no-store',
                })
                if (apiRes.ok) {
                    const json = await apiRes.json()
                    if (json.success && json.data) {
                        setData(json.data)
                        return
                    } else if (json.error) {
                        toast.error(json.error)
                        return
                    }
                }
            } catch (apiErr) {
                console.warn('[StockVelocityReport] API route fetch failed, trying server action fallback:', apiErr)
            }

            // 2. Fallback to Server Action if API route is unreachable
            const res = await getStockVelocityReport({ cycleMonths: cycle })
            if (res.success && res.data) {
                setData(res.data)
            } else {
                console.error('[StockVelocityReport] Server error:', res.error)
                toast.error(res.error || (isEn ? 'Failed to load stock report' : 'Lỗi khi tải báo cáo tồn kho'))
            }
        } catch (err: unknown) {
            console.error('[StockVelocityReport] Network/Client error:', err)
            const msg = err instanceof Error ? err.message : String(err)
            toast.error(msg || (isEn ? 'Failed to load stock report' : 'Lỗi khi tải báo cáo tồn kho'))
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // If initialData is already present and matches the cycle, do not re-fetch on first mount
        if (initialData && data && cycleMonths === (initialData.summary?.cycleMonths ?? 6)) {
            return
        }
        loadReport(cycleMonths)
    }, [cycleMonths])

    // Producers list
    const producerGroups = useMemo(() => {
        if (!data?.items) return []
        const map = new Map<string, StockVelocityItem[]>()

        // Group items while preserving order
        for (const item of data.items) {
            const groupName = item.producerGroup || item.producerName || 'Khác'

            // Apply search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matches =
                    item.skuCode.toLowerCase().includes(q) ||
                    item.productName.toLowerCase().includes(q) ||
                    groupName.toLowerCase().includes(q)
                if (!matches) continue
            }

            // Apply producer filter
            if (producerFilter !== 'ALL' && groupName !== producerFilter) {
                continue
            }

            if (!map.has(groupName)) {
                map.set(groupName, [])
            }
            map.get(groupName)!.push(item)
        }

        return Array.from(map.entries()).map(([name, items]) => ({
            name,
            items,
            subtotalStock: items.reduce((s, i) => s + i.totalStock, 0),
            subtotalTT: items.reduce((s, i) => s + i.stockTT, 0),
            subtotalGVM: items.reduce((s, i) => s + i.stockGVM, 0),
            subtotalSR: items.reduce((s, i) => s + i.stockSR, 0),
            subtotalAvgSales: Number(items.reduce((s, i) => s + i.avgMonthlySales, 0).toFixed(1)),
        }))
    }, [data, searchQuery, producerFilter])

    // Toggle producer collapse
    const toggleProducer = (name: string) => {
        setCollapsedProducers(prev => ({ ...prev, [name]: !prev[name] }))
    }

    // Toggle all producers
    const toggleAllProducers = (expand: boolean) => {
        const next: Record<string, boolean> = {}
        producerGroups.forEach(g => {
            next[g.name] = !expand
        })
        setCollapsedProducers(next)
    }

    // Grand Totals
    const grandTotals = useMemo(() => {
        if (!data?.items) return null
        const allItems = producerGroups.flatMap(g => g.items)

        const totalStock = allItems.reduce((s, i) => s + i.totalStock, 0)
        const totalTT = allItems.reduce((s, i) => s + i.stockTT, 0)
        const totalGVM = allItems.reduce((s, i) => s + i.stockGVM, 0)
        const totalSR = allItems.reduce((s, i) => s + i.stockSR, 0)
        const totalHistorical = allItems.reduce((s, i) => s + i.historicalTotal, 0)
        const totalAvgSales = Number(allItems.reduce((s, i) => s + i.avgMonthlySales, 0).toFixed(1))
        const totalIncoming = allItems.reduce((s, i) => s + (i.incomingQty || 0), 0)

        // Month sales totals
        const monthTotals: Record<string, { sales: number; taste: number }> = {}
        const allKeys = data.summary.allMonthKeys

        for (const m of allKeys) {
            monthTotals[m] = { sales: 0, taste: 0 }
            for (const item of allItems) {
                const found = item.allMonths.find(x => x.month === m)
                if (found) {
                    monthTotals[m].sales += found.salesQty
                    monthTotals[m].taste += found.tastingQty
                }
            }
        }

        return {
            totalStock,
            totalTT,
            totalGVM,
            totalSR,
            totalHistorical,
            totalAvgSales,
            totalIncoming,
            monthTotals,
        }
    }, [data, producerGroups])

    // Export to Excel
    const handleExport = async () => {
        try {
            setExporting(true)
            toast.info(isEn ? 'Generating Excel report...' : 'Đang khởi tạo file Excel...')
            const res = await exportStockVelocityExcel({ cycleMonths })
            const byteCharacters = atob(res.base64)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = res.filename
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success(isEn ? 'Excel downloaded successfully' : 'Tải file Excel thành công')
        } catch (err: unknown) {
            console.error(err)
            toast.error(isEn ? 'Failed to export Excel' : 'Xuất Excel thất bại')
        } finally {
            setExporting(false)
        }
    }

    // Upload & Sync
    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!uploadFile) {
            toast.error(isEn ? 'Please choose an Excel file' : 'Vui lòng chọn file Excel')
            return
        }

        try {
            setUploading(true)
            const formData = new FormData()
            formData.append('file', uploadFile)
            const res = await uploadHistoricalStockExcel(formData)
            if (res.success) {
                toast.success(isEn ? `Successfully imported ${res.count} records` : `Đã nạp thành công ${res.count} bản ghi lịch sử`)
                setUploadModalOpen(false)
                setUploadFile(null)
                loadReport(cycleMonths)
            } else {
                toast.error(res.error || (isEn ? 'Import failed' : 'Lỗi khi import'))
            }
        } catch (err: unknown) {
            console.error(err)
            toast.error(isEn ? 'Failed to upload' : 'Tải lên thất bại')
        } finally {
            setUploading(false)
        }
    }

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[460px] rounded-lg border border-slate-300 bg-white p-12">
                <Loader2 className="w-8 h-8 text-[#073763] animate-spin mb-4" />
                <p className="text-sm font-semibold text-[#073763]">
                    {isEn ? 'Loading LY\'s Cellars Stock Report...' : 'Đang nạp file báo cáo tồn kho LY\'s Cellars...'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    {isEn ? 'Merging historical Excel sheets with live ERP data' : 'Đang hợp nhất dữ liệu lịch sử file Stock Report và dữ liệu ERP từ tháng 8'}
                </p>
            </div>
        )
    }

    const summary = data?.summary
    const historicalMonthKeys = summary?.historicalMonthKeys || []
    const liveMonthKeys = summary?.liveMonthKeys || []

    return (
        <div className="space-y-3 font-sans text-slate-900">
            {/* 1. EXCEL TOOLBAR / RIBBON */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-300 bg-[#F1F5F9] shadow-xs">
                {/* Left controls */}
                <div className="flex flex-wrap items-center gap-2 flex-1 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={isEn ? 'Search SKU, Wine, Brand...' : 'Tìm Mã SKU, Tên vang, Nhãn...'}
                            className="w-full pl-8 pr-7 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-[#073763]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Filter by Producer */}
                    <select
                        value={producerFilter}
                        onChange={e => setProducerFilter(e.target.value)}
                        className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:border-[#073763]"
                    >
                        <option value="ALL">{isEn ? 'All Brands / Producers' : 'Tất cả Nhà sản xuất / Nhãn'}</option>
                        {Array.from(new Set(data?.items.map(i => i.producerGroup || i.producerName))).sort().map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>

                    {/* Velocity Cycle */}
                    <div className="flex items-center gap-1 text-xs bg-white px-2 py-0.5 rounded border border-slate-300">
                        <span className="text-[11px] text-slate-500 font-medium">
                            {isEn ? 'Velocity formula:' : 'Công thức TB:'}
                        </span>
                        <select
                            value={cycleMonths}
                            onChange={e => setCycleMonths(Number(e.target.value))}
                            className="text-xs bg-transparent font-semibold text-[#073763] focus:outline-hidden cursor-pointer"
                        >
                            <option value={6}>{isEn ? '6-Month Average (Excel Standard)' : 'TB 6 tháng (Chuẩn file Excel)'}</option>
                            <option value={3}>{isEn ? '3-Month Average (Recent)' : 'TB 3 tháng gần nhất'}</option>
                            <option value={12}>{isEn ? '12-Month Average (Full Year)' : 'TB 12 tháng gần nhất'}</option>
                        </select>
                    </div>
                </div>

                {/* Right controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle Old Data (43 months) */}
                    <button
                        onClick={() => setShowOldHistory(prev => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                            showOldHistory
                                ? 'bg-[#073763] text-white border-[#073763]'
                                : 'bg-white text-[#073763] border-slate-300 hover:bg-slate-50'
                        }`}
                        title={showOldHistory ? 'Thu gọn lại 43 tháng lịch sử' : 'Mở rộng hiển thị chi tiết 43 cột tháng lịch sử (2023 - 07/2026)'}
                    >
                        {showOldHistory ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>
                            {showOldHistory
                                ? (isEn ? 'Collapse Pre-Aug 26 (43M)' : '[-] Thu gọn 43 tháng cũ (2023-07/26)')
                                : (isEn ? 'Expand Pre-Aug 26 (43M)' : '[+] Mở rộng 43 tháng cũ (2023-07/26)')}
                        </span>
                    </button>

                    {/* Toggle Tasting */}
                    <button
                        onClick={() => setShowTasting(prev => !prev)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                            showTasting
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span>{showTasting ? (isEn ? 'Hide Tasting' : 'Ẩn cột Tasting') : (isEn ? 'Show Tasting' : 'Hiện cột Tasting')}</span>
                    </button>

                    {/* Sync Excel */}
                    <button
                        onClick={() => setUploadModalOpen(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>{isEn ? 'Sync Excel' : 'Nạp lại Excel'}</span>
                    </button>

                    {/* Export Excel */}
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded bg-[#107C41] hover:bg-[#0E6B37] text-white shadow-xs transition-colors disabled:opacity-50"
                        title="Xuất file Excel đúng định dạng Stock Report"
                    >
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                        <span>{exporting ? (isEn ? 'Exporting...' : 'Đang xuất...') : (isEn ? 'Export Excel' : 'Xuất Excel')}</span>
                    </button>
                </div>
            </div>

            {/* 2. THE SPREADSHEET SHEET VIEW (LOOKS IDENTICALLY TO EXCEL FILE) */}
            <div className="rounded-lg border border-slate-300 bg-white shadow-md overflow-hidden">
                {/* Excel Document Top Header (Rows 1 to 4) */}
                <div className="p-3.5 border-b border-slate-300 bg-[#FDFDFD] flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-[#073763] uppercase">
                            LY&apos;s Cellars
                        </h1>
                        <p className="text-xs text-slate-600 font-medium">
                            52/12 Giang Van Minh, Ba Dinh, Ha Noi
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="inline-block px-3 py-1 rounded bg-[#EBF1F5] border border-slate-300 text-xs font-mono font-semibold text-[#073763]">
                            Date: {new Date().toLocaleDateString('vi-VN')}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                            STOCK REPORT / BÁO CÁO TỒN KHO &amp; NHỊP ĐỘ BÁN HÀNG
                        </p>
                    </div>
                </div>

                {/* Spreadsheet Table with Sticky Multi-Tiered Header */}
                <div className="overflow-x-auto max-h-[720px] scrollbar-thin">
                    <table className="w-full text-xs border-collapse border border-slate-300 text-left select-text">
                        {/* ── MULTI-TIER NAVY BLUE HEADER (ROW 5, 6, 7 OF EXCEL) ── */}
                        <thead className="sticky top-0 z-30 bg-[#073763] text-white select-none">
                            {/* Header Tier 1 */}
                            <tr className="border-b border-[#335C80] text-[11px] font-bold">
                                {/* Fixed Left Columns */}
                                <th rowSpan={3} className="px-2 py-1.5 text-center border-r border-[#335C80] sticky left-0 z-40 bg-[#073763] min-w-[85px] align-middle">
                                    Code/<br />Mã hàng
                                </th>
                                <th rowSpan={3} className="px-3 py-1.5 border-r border-[#335C80] sticky left-[85px] z-40 bg-[#073763] min-w-[240px] max-w-[280px] align-middle">
                                    Item Name/<br />Tên hàng
                                </th>
                                <th rowSpan={3} className="px-2.5 py-1.5 text-right border-r border-[#335C80] sticky left-[325px] z-40 bg-[#073763] min-w-[95px] align-middle shadow-sm">
                                    Total Stock on Hand/<br />Hàng tồn tại kho
                                </th>

                                {/* Warehouse on hand columns */}
                                <th rowSpan={3} className="px-2 py-1.5 text-right border-r border-[#335C80] min-w-[85px] align-middle">
                                    Stock on Hand/<br />Kho Thường Tín
                                </th>
                                <th rowSpan={3} className="px-2 py-1.5 text-right border-r border-[#335C80] min-w-[85px] align-middle">
                                    Stock on Hand/<br />Kho G.V.Minh
                                </th>
                                <th rowSpan={3} className="px-2 py-1.5 text-right border-r border-[#335C80] min-w-[85px] align-middle">
                                    Stock on Hand/<br />Kho Ký gửi
                                </th>
                                <th rowSpan={3} className="px-2 py-1.5 text-center border-r border-[#335C80] min-w-[60px] align-middle">
                                    Vintage/<br />Niên vụ
                                </th>

                                {/* Monthly Sales Group Header */}
                                <th
                                    colSpan={
                                        (!showOldHistory ? 1 : historicalMonthKeys.length * (showTasting ? 2 : 1)) +
                                        liveMonthKeys.length * (showTasting ? 2 : 1)
                                    }
                                    className="px-3 py-1.5 text-center border-r border-[#335C80] bg-[#0A477C] align-middle"
                                >
                                    Sales of Month / Hàng bán trong tháng
                                </th>

                                {/* Average Group Header */}
                                <th colSpan={2} className="px-2 py-1.5 text-center border-r border-[#335C80] bg-[#0A477C] align-middle">
                                    Trung bình - {cycleMonths} tháng gần nhất
                                </th>

                                {/* Expected Average Sales */}
                                <th rowSpan={3} className="px-2 py-1.5 text-right border-r border-[#335C80] min-w-[85px] align-middle">
                                    Expected Average Sales/<br />Dự kiến TB lượng bán
                                </th>

                                {/* Incoming Group */}
                                <th colSpan={4} className="px-2 py-1.5 text-center border-r border-[#335C80] bg-[#0A477C] align-middle">
                                    Stock incoming / Hàng sắp về
                                </th>

                                {/* Note */}
                                <th rowSpan={3} className="px-3 py-1.5 border-r border-[#335C80] min-w-[150px] align-middle">
                                    Note/<br />Ghi chú
                                </th>
                            </tr>

                            {/* Header Tier 2 (Month Names & Subheadings) */}
                            <tr className="border-b border-[#335C80] text-[10px] font-semibold">
                                {/* Monthly Sales Columns Sub-tier */}
                                {!showOldHistory ? (
                                    <th
                                        rowSpan={2}
                                        className="px-2.5 py-1 text-center border-r border-[#335C80] bg-[#104D82] min-w-[125px] align-middle"
                                    >
                                        <div className="flex flex-col items-center">
                                            <span>Quá khứ: Jan.23 - Jul.26</span>
                                            <span className="text-[9px] text-cyan-200 font-normal">
                                                (Đang thu gọn 43 tháng)
                                            </span>
                                        </div>
                                    </th>
                                ) : (
                                    historicalMonthKeys.map(m => (
                                        <th
                                            key={m}
                                            colSpan={showTasting ? 2 : 1}
                                            className="px-1.5 py-1 text-center border-r border-[#335C80] bg-[#104D82] whitespace-nowrap min-w-[60px]"
                                        >
                                            {m.replace('20', '')}
                                        </th>
                                    ))
                                )}

                                {/* Live ERP Months */}
                                {liveMonthKeys.map(m => (
                                    <th
                                        key={m}
                                        colSpan={showTasting ? 2 : 1}
                                        className="px-2 py-1 text-center border-r border-[#335C80] bg-[#0E5B99] text-cyan-200 whitespace-nowrap min-w-[70px]"
                                    >
                                        {m.replace('2026-08', 'Aug.26').replace('2026-09', 'Sep.26').replace('2026-10', 'Oct.26')} (ERP)
                                    </th>
                                ))}

                                {/* Average Sub-headers */}
                                <th rowSpan={2} className="px-2 py-1 text-right border-r border-[#335C80] min-w-[85px] align-middle">
                                    Average Sale/<br />TB bán ({cycleMonths}T)
                                </th>
                                <th rowSpan={2} className="px-2 py-1 text-center border-r border-[#335C80] min-w-[110px] align-middle">
                                    Stock of Month/<br />Số tháng dự kiến
                                </th>

                                {/* Incoming Sub-headers */}
                                <th rowSpan={2} className="px-2 py-1 text-right border-r border-[#335C80] min-w-[65px] align-middle">
                                    Quantity/<br />Số lượng
                                </th>
                                <th rowSpan={2} className="px-2 py-1 border-r border-[#335C80] min-w-[80px] align-middle">
                                    PO/<br />Đặt hàng
                                </th>
                                <th rowSpan={2} className="px-2 py-1 border-r border-[#335C80] min-w-[80px] align-middle">
                                    ETD/<br />Dự kiến đi
                                </th>
                                <th rowSpan={2} className="px-2 py-1 border-r border-[#335C80] min-w-[80px] align-middle">
                                    ETA/<br />Dự kiến về
                                </th>
                            </tr>

                            {/* Header Tier 3 (Sales vs Tasting) */}
                            {showTasting && (
                                <tr className="border-b border-[#335C80] text-[9px] font-medium text-slate-200">
                                    {/* Sub-columns for expanded historical */}
                                    {showOldHistory && historicalMonthKeys.map(m => (
                                        <React.Fragment key={m}>
                                            <th className="px-1 py-0.5 text-right border-r border-[#335C80]">Sales</th>
                                            <th className="px-1 py-0.5 text-right border-r border-[#335C80] bg-amber-900/40 text-amber-200">Taste</th>
                                        </React.Fragment>
                                    ))}

                                    {/* Sub-columns for live ERP */}
                                    {liveMonthKeys.map(m => (
                                        <React.Fragment key={m}>
                                            <th className="px-1 py-0.5 text-right border-r border-[#335C80]">Sales</th>
                                            <th className="px-1 py-0.5 text-right border-r border-[#335C80] bg-amber-900/40 text-amber-200">Taste</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            )}
                        </thead>

                        {/* ── SPREADSHEET BODY (PRODUCER BANDS & PRODUCTS) ── */}
                        <tbody className="divide-y divide-slate-200 text-[11px]">
                            {producerGroups.map(group => {
                                const isCollapsed = !!collapsedProducers[group.name]
                                return (
                                    <React.Fragment key={group.name}>
                                        {/* PRODUCER SECTION HEADER ROW (THE SIGNATURE EXCEL LIGHT BLUE ROW #CFE2F3) */}
                                        <tr
                                            onClick={() => toggleProducer(group.name)}
                                            className="cursor-pointer bg-[#CFE2F3] hover:bg-[#BBD7EF] transition-colors border-y-2 border-[#9BC2E6] font-bold text-[#073763]"
                                        >
                                            <td
                                                colSpan={
                                                    7 +
                                                    (!showOldHistory ? 1 : historicalMonthKeys.length * (showTasting ? 2 : 1)) +
                                                    liveMonthKeys.length * (showTasting ? 2 : 1) +
                                                    2 + 1 + 4 + 1
                                                }
                                                className="px-3 py-1.5 tracking-wide text-xs"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        <span>{group.name}</span>
                                                        <span className="text-[10px] font-normal text-slate-600">
                                                            ({group.items.length} {isEn ? 'SKUs' : 'mã hàng'})
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-6 text-[11px] font-semibold pr-4">
                                                        <span>Tổng tồn: {(group.subtotalStock ?? 0).toLocaleString('vi-VN')}</span>
                                                        <span>Kho TT: {(group.subtotalTT ?? 0).toLocaleString('vi-VN')}</span>
                                                        <span>Kho GVM: {(group.subtotalGVM ?? 0).toLocaleString('vi-VN')}</span>
                                                        <span>TB bán: {(group.subtotalAvgSales ?? 0).toLocaleString('vi-VN')}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* PRODUCT ROWS UNDER THIS PRODUCER */}
                                        {!isCollapsed && group.items.map((item, idx) => {
                                            // Conditional color formatting for Stock of Month
                                            let stockMonthsColor = ''
                                            if (item.totalStock <= 0) {
                                                stockMonthsColor = 'text-slate-400'
                                            } else if (item.stockMonths < 2) {
                                                stockMonthsColor = 'bg-[#FCE8E6] text-[#C5221F] font-bold' // Light red (<2)
                                            } else if (item.stockMonths <= 6) {
                                                stockMonthsColor = 'bg-[#E6F4EA] text-[#137333] font-bold' // Light green (2-6)
                                            } else if (item.stockMonths <= 12) {
                                                stockMonthsColor = 'bg-[#E8F0FE] text-[#1967D2]' // Light blue (6-12)
                                            } else {
                                                stockMonthsColor = 'bg-[#FEF7E0] text-[#B06000]' // Light yellow (>12)
                                            }

                                            return (
                                                <tr
                                                    key={item.id || item.skuCode}
                                                    className="hover:bg-[#F8FAFC] transition-colors border-b border-slate-200 h-[24px]"
                                                >
                                                    {/* Sticky SKU */}
                                                    <td className="px-2 py-1 font-mono text-center font-medium text-slate-800 border-r border-slate-300 sticky left-0 z-20 bg-white">
                                                        {item.skuCode}
                                                    </td>

                                                    {/* Sticky Product Name */}
                                                    <td
                                                        className="px-2.5 py-1 border-r border-slate-300 sticky left-[85px] z-20 bg-white truncate max-w-[280px]"
                                                        title={item.productName}
                                                    >
                                                        <span className="font-normal text-slate-900">
                                                            {item.productName}
                                                        </span>
                                                    </td>

                                                    {/* Sticky Total Stock */}
                                                    <td className="px-2.5 py-1 text-right font-bold text-slate-900 border-r border-slate-300 sticky left-[325px] z-20 bg-white shadow-xs">
                                                        {item.totalStock > 0 ? item.totalStock.toLocaleString('vi-VN') : 0}
                                                    </td>

                                                    {/* Warehouses */}
                                                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">
                                                        {item.stockTT > 0 ? item.stockTT.toLocaleString('vi-VN') : 0}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">
                                                        {item.stockGVM > 0 ? item.stockGVM.toLocaleString('vi-VN') : 0}
                                                    </td>
                                                    <td className="px-2 py-1 text-right text-slate-700 border-r border-slate-200">
                                                        {item.stockSR > 0 ? item.stockSR.toLocaleString('vi-VN') : 0}
                                                    </td>

                                                    {/* Vintage */}
                                                    <td className="px-1.5 py-1 text-center text-slate-600 border-r border-slate-200">
                                                        {item.vintage || ''}
                                                    </td>

                                                    {/* Historical Monthly Sales */}
                                                    {!showOldHistory ? (
                                                        <td className="px-2.5 py-1 text-right font-medium text-slate-800 bg-[#F8FAFC] border-r-2 border-slate-300">
                                                            {item.historicalTotal > 0 ? item.historicalTotal.toLocaleString('vi-VN') : 0}
                                                        </td>
                                                    ) : (
                                                        historicalMonthKeys.map(m => {
                                                            const mData = item.allMonths.find(x => x.month === m)
                                                            return (
                                                                <React.Fragment key={m}>
                                                                    <td className="px-1.5 py-1 text-right text-slate-700 border-r border-slate-200 font-mono text-[10px]">
                                                                        {mData && mData.salesQty > 0 ? mData.salesQty : 0}
                                                                    </td>
                                                                    {showTasting && (
                                                                        <td className="px-1 py-1 text-right text-amber-700 bg-amber-50/40 border-r border-slate-200 font-mono text-[10px]">
                                                                            {mData && mData.tastingQty > 0 ? mData.tastingQty : 0}
                                                                        </td>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        })
                                                    )}

                                                    {/* Live ERP Sales */}
                                                    {liveMonthKeys.map(m => {
                                                        const mData = item.allMonths.find(x => x.month === m)
                                                        return (
                                                            <React.Fragment key={m}>
                                                                <td className="px-2 py-1 text-right font-medium text-[#073763] bg-cyan-50/20 border-r border-slate-200 font-mono">
                                                                    {mData && mData.salesQty > 0 ? mData.salesQty : 0}
                                                                </td>
                                                                {showTasting && (
                                                                    <td className="px-1 py-1 text-right text-amber-700 bg-amber-50/40 border-r border-slate-200 font-mono text-[10px]">
                                                                        {mData && mData.tastingQty > 0 ? mData.tastingQty : 0}
                                                                    </td>
                                                                )}
                                                            </React.Fragment>
                                                        )
                                                    })}

                                                    {/* Velocity / Average Sales */}
                                                    <td className="px-2 py-1 text-right font-bold text-slate-900 border-r border-slate-200">
                                                        {item.avgMonthlySales > 0 ? item.avgMonthlySales.toLocaleString('vi-VN') : 0}
                                                    </td>

                                                    {/* Stock of Month (Excel conditional styling) */}
                                                    <td className={`px-2 py-1 text-center border-r border-slate-300 ${stockMonthsColor}`}>
                                                        {item.stockMonths === 999
                                                            ? '∞'
                                                            : item.stockMonths.toFixed(1)}
                                                    </td>

                                                    {/* Expected Average Sales */}
                                                    <td className="px-2 py-1 text-right text-slate-500 border-r border-slate-200">
                                                        -
                                                    </td>

                                                    {/* Incoming Stock */}
                                                    <td className="px-2 py-1 text-right font-medium text-emerald-700 border-r border-slate-200">
                                                        {item.incomingQty > 0 ? item.incomingQty.toLocaleString('vi-VN') : '-'}
                                                    </td>
                                                    <td className="px-2 py-1 font-mono text-[10px] text-slate-600 border-r border-slate-200 truncate max-w-[80px]" title={item.incomingPo || ''}>
                                                        {item.incomingPo || '-'}
                                                    </td>
                                                    <td className="px-2 py-1 text-[10px] text-slate-600 border-r border-slate-200">
                                                        {item.incomingEtd || '-'}
                                                    </td>
                                                    <td className="px-2 py-1 text-[10px] text-slate-600 border-r border-slate-200">
                                                        {item.incomingEta || '-'}
                                                    </td>

                                                    {/* Note */}
                                                    <td className="px-2.5 py-1 text-slate-600 italic truncate max-w-[150px]" title={item.note || ''}>
                                                        {item.note || ''}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </React.Fragment>
                                )
                            })}

                            {/* ── ROW 160: TOTAL / TỔNG ROW (LIKE EXCEL) ── */}
                            {grandTotals && (
                                <tr className="bg-[#E2E8F0] border-t-2 border-slate-400 font-bold text-slate-900 sticky bottom-0 z-20 shadow-md">
                                    <td className="px-2 py-1.5 text-center border-r border-slate-300 sticky left-0 bg-[#E2E8F0]">
                                        TOTAL
                                    </td>
                                    <td className="px-2.5 py-1.5 border-r border-slate-300 sticky left-[85px] bg-[#E2E8F0] uppercase tracking-wider">
                                        Total / Tổng cộng
                                    </td>
                                    <td className="px-2.5 py-1.5 text-right border-r border-slate-300 sticky left-[325px] bg-[#E2E8F0]">
                                        {(grandTotals.totalStock ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300">
                                        {(grandTotals.totalTT ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300">
                                        {(grandTotals.totalGVM ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300">
                                        {(grandTotals.totalSR ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-1.5 py-1.5 text-center border-r border-slate-300">-</td>

                                    {/* Historical Grand Total */}
                                    {!showOldHistory ? (
                                        <td className="px-2.5 py-1.5 text-right border-r-2 border-slate-400">
                                            {(grandTotals.totalHistorical ?? 0).toLocaleString('vi-VN')}
                                        </td>
                                    ) : (
                                        historicalMonthKeys.map(m => (
                                            <React.Fragment key={m}>
                                                <td className="px-1.5 py-1.5 text-right border-r border-slate-300 font-mono text-[10px]">
                                                    {(grandTotals.monthTotals[m]?.sales ?? 0).toLocaleString('vi-VN')}
                                                </td>
                                                {showTasting && (
                                                    <td className="px-1 py-1.5 text-right border-r border-slate-300 font-mono text-[10px]">
                                                        {(grandTotals.monthTotals[m]?.taste ?? 0).toLocaleString('vi-VN')}
                                                    </td>
                                                )}
                                            </React.Fragment>
                                        ))
                                    )}

                                    {/* Live ERP Grand Totals */}
                                    {liveMonthKeys.map(m => (
                                        <React.Fragment key={m}>
                                            <td className="px-2 py-1.5 text-right border-r border-slate-300 font-mono text-[#073763]">
                                                {(grandTotals.monthTotals[m]?.sales ?? 0).toLocaleString('vi-VN')}
                                            </td>
                                            {showTasting && (
                                                <td className="px-1 py-1.5 text-right border-r border-slate-300 font-mono">
                                                    {(grandTotals.monthTotals[m]?.taste ?? 0).toLocaleString('vi-VN')}
                                                </td>
                                            )}
                                        </React.Fragment>
                                    ))}

                                    {/* Avg sales total */}
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300">
                                        {(grandTotals.totalAvgSales ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    <td className="px-2 py-1.5 text-center border-r border-slate-300">
                                        {((grandTotals.totalStock ?? 0) / ((grandTotals.totalAvgSales ?? 0) || 1)).toFixed(1)}
                                    </td>
                                    {/* Expected Average Sales */}
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300 font-mono text-slate-400">
                                        -
                                    </td>
                                    {/* Incoming Quantity */}
                                    <td className="px-2 py-1.5 text-right border-r border-slate-300 font-mono text-emerald-800">
                                        {(grandTotals.totalIncoming ?? 0).toLocaleString('vi-VN')}
                                    </td>
                                    {/* PO, ETD, ETA, Note */}
                                    <td colSpan={4} className="px-3 py-1.5 text-right text-slate-500 text-[10px]">
                                        SUBTOTAL(9)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. SYNC / UPLOAD EXCEL MODAL */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-lg bg-white border border-slate-300 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-[#107C41]" />
                                <h3 className="font-bold text-slate-900 text-sm">
                                    {isEn ? 'Sync Historical Stock Report' : 'Đồng bộ Dữ liệu từ File Stock Report'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setUploadModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                            {isEn
                                ? 'Upload an updated "LY\'s Cellars - Stock Report.xlsx" file. The system will read the "Stock" sheet and update all historical monthly sales prior to August 2026.'
                                : 'Chọn file Excel "LY\'s Cellars - Stock Report.xlsx". Hệ thống sẽ trích xuất sheet "Stock" và cập nhật toàn bộ sản lượng bán quá khứ từ 01/2023 đến 07/2026 vào CSDL.'}
                        </p>

                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#073763] transition-colors bg-[#FAFAFA]">
                                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={e => setUploadFile(e.target.files?.[0] || null)}
                                    className="text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#073763] file:text-white hover:file:bg-[#0A477C]"
                                />
                                {uploadFile && (
                                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                                        Đã chọn: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setUploadModalOpen(false)}
                                    className="px-3 py-1.5 text-xs font-medium rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                                >
                                    {isEn ? 'Cancel' : 'Hủy bỏ'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || !uploadFile}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded bg-[#073763] hover:bg-[#0A477C] text-white shadow-xs transition-all disabled:opacity-50"
                                >
                                    {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{uploading ? (isEn ? 'Importing...' : 'Đang xử lý...') : (isEn ? 'Start Sync' : 'Bắt đầu nạp dữ liệu')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
