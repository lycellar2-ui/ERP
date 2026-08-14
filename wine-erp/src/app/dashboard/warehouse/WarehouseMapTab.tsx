'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Search, Loader2, Save, Move, Maximize2, ZoomIn, ZoomOut, Grid3x3,
    X, Eye, MousePointer2, Minus, DoorOpen, Type, Trash2, RotateCcw,
    ChevronDown, Box, Layers, Package, Calendar, ShieldCheck, Thermometer,
    Sparkles, RefreshCw, Info, Building2, MapPin, Sliders, Maximize, Check,
    Ruler, LayoutTemplate, LayoutGrid, Map as MapIcon, Filter
} from 'lucide-react'
import {
    MapLocation, MapWarehouse, MapLocationProduct,
    getWarehouseMapData, saveWarehouseLayout, autoLayoutWarehouse,
    searchProductLocations, getWarehouseLayoutConfig, saveWarehouseLayoutConfig
} from './actions-map'
import { formatNumber } from '@/lib/utils'

interface WarehouseOption { id: string; code: string; name: string }

// ═══════════════════════════════════════════════════════════
// Types for floor plan elements
// ═══════════════════════════════════════════════════════════
interface Wall { id: string; x1: number; y1: number; x2: number; y2: number; thickness: number }
interface Door { id: string; x: number; y: number; width: number; rotation: number }
interface Label { id: string; x: number; y: number; text: string; fontSize: number }
interface Boundary { width: number; height: number }
interface LayoutConfig { walls: Wall[]; doors: Door[]; labels: Label[]; boundary?: Boundary }

type Tool = 'select' | 'wall' | 'door' | 'label' | 'eraser'
type DisplayView = 'map' | 'cards'

// ═══════════════════════════════════════════════════════════
// Clean High-Contrast Light Theme Color Tokens
// ═══════════════════════════════════════════════════════════
function occColor(pct: number) {
    if (pct >= 90) return {
        fill: '#FFF1F2',
        border: '#F43F5E',
        text: '#BE123C',
        dot: '#F43F5E',
        badgeBg: '#FFE4E6',
        badgeText: '#9F1239',
        label: 'Đầy (>90%)'
    }
    if (pct >= 70) return {
        fill: '#FEF3C7',
        border: '#F59E0B',
        text: '#B45309',
        dot: '#F59E0B',
        badgeBg: '#FEF3C7',
        badgeText: '#92400E',
        label: 'Cao (70-90%)'
    }
    if (pct >= 40) return {
        fill: '#F0F9FF',
        border: '#0284C7',
        text: '#0369A1',
        dot: '#0284C7',
        badgeBg: '#E0F2FE',
        badgeText: '#075985',
        label: 'Vừa (40-70%)'
    }
    if (pct > 0) return {
        fill: '#ECFDF5',
        border: '#10B981',
        text: '#047857',
        dot: '#10B981',
        badgeBg: '#D1FAE5',
        badgeText: '#065F46',
        label: 'Thấp (1-40%)'
    }
    return {
        fill: '#F8FAFC',
        border: '#CBD5E1',
        text: '#475569',
        dot: '#94A3B8',
        badgeBg: '#F1F5F9',
        badgeText: '#334155',
        label: 'Trống (0%)'
    }
}

// Strictly avoiding violet/purple (Purple Ban)
const ZONE_COLORS: Record<string, string> = {
    A: '#0284C7', // Sky Blue
    B: '#059669', // Emerald Green
    C: '#D97706', // Amber Gold
    D: '#DC2626', // Crimson Red
    E: '#2563EB', // Royal Blue
    F: '#DB2777', // Rose Pink
    G: '#0D9488', // Teal Green
    H: '#EA580C', // Deep Orange
}

let _nextId = 0
function uid() { return `el-${Date.now()}-${_nextId++}` }

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export function WarehouseMapTab({
    warehouses,
    selectedWarehouseId,
    isAdmin
}: {
    warehouses: WarehouseOption[];
    selectedWarehouseId?: string | null;
    isAdmin: boolean
}) {
    // ── State ─────────────────────────────────────────
    const [selectedWH, setSelectedWH] = useState(selectedWarehouseId || '')
    const [mapData, setMapData] = useState<MapWarehouse | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [displayView, setDisplayView] = useState<DisplayView>('map')

    // Sync selectedWH when selectedWarehouseId changes
    useEffect(() => {
        if (selectedWarehouseId && selectedWarehouseId !== selectedWH) {
            setSelectedWH(selectedWarehouseId)
        }
    }, [selectedWarehouseId])

    // Canvas State
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 30, y: 30 })
    const [isPanning, setIsPanning] = useState(false)
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
    const touchStartDist = useRef<number | null>(null)
    const touchStartCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
    const canvasRef = useRef<HTMLDivElement>(null)

    // Tools
    const [tool, setTool] = useState<Tool>('select')
    const [editMode, setEditMode] = useState(false)
    const [selectedLocId, setSelectedLocId] = useState<string | null>(null)

    // Floor plan elements (Walls, Doors, Labels, Boundary)
    const [layoutCfg, setLayoutCfg] = useState<LayoutConfig>({
        walls: [],
        doors: [],
        labels: [],
        boundary: { width: 1500, height: 750 }
    })
    const [wallDrawing, setWallDrawing] = useState<{ x1: number; y1: number } | null>(null)
    const [doorRotation, setDoorRotation] = useState<number>(0)
    const [doorWidth, setDoorWidth] = useState<number>(44)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [spaceHeld, setSpaceHeld] = useState(false)
    const [hoveredWallId, setHoveredWallId] = useState<string | null>(null)

    // Drag & Resize location
    const [dragLoc, setDragLoc] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
    const [resizeLoc, setResizeLoc] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)
    const [locations, setLocations] = useState<MapLocation[]>([])
    const [hasChanges, setHasChanges] = useState(false)

    // Zone filter & modal
    const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('ALL')
    const [resizeZoneName, setResizeZoneName] = useState<string | null>(null)
    const [zoneW, setZoneW] = useState<number>(140)
    const [zoneH, setZoneH] = useState<number>(90)

    // Search & Popups
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightLocs, setHighlightLocs] = useState<string[]>([])
    const [searchResults, setSearchResults] = useState<{ skuCode: string; productName: string; totalQty: number; locationIds: string[] }[]>([])
    const [showLocModal, setShowLocModal] = useState(false)
    const [showLegendDrawer, setShowLegendDrawer] = useState(false)

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    // Auto-fit function for Mobile & Desktop
    const fitToScreen = useCallback(() => {
        if (!canvasRef.current || !layoutCfg.boundary) return
        const rect = canvasRef.current.getBoundingClientRect()
        const bW = layoutCfg.boundary.width || 1500
        const bH = layoutCfg.boundary.height || 750
        const scaleX = (rect.width - 40) / bW
        const scaleY = (rect.height - 40) / bH
        const fitScale = Math.min(1.2, Math.max(0.2, Math.min(scaleX, scaleY)))
        setZoom(fitScale)
        setPan({
            x: Math.max(10, Math.round((rect.width - bW * fitScale) / 2)),
            y: Math.max(10, Math.round((rect.height - bH * fitScale) / 2)),
        })
    }, [layoutCfg.boundary])

    // ── Load map data ──────────────────────────────────
    const loadMap = useCallback(async (whId: string) => {
        setLoading(true)
        setSelectedLocId(null)
        setHighlightLocs([])
        setSearchResults([])
        try {
            const [data, cfg] = await Promise.all([
                getWarehouseMapData(whId),
                getWarehouseLayoutConfig(whId),
            ])
            setMapData(data)
            setLocations(data?.locations ?? [])
            const b = cfg?.boundary || { width: 1500, height: 750 }
            setLayoutCfg(cfg && cfg.boundary ? cfg : {
                walls: cfg?.walls ?? [],
                doors: cfg?.doors ?? [],
                labels: cfg?.labels ?? [],
                boundary: b
            })
            // Default fit on load
            setTimeout(() => {
                fitToScreen()
            }, 100)
        } finally {
            setLoading(false)
        }
    }, [fitToScreen])

    useEffect(() => { if (selectedWH) loadMap(selectedWH) }, [selectedWH, loadMap])

    // ── Global keyboard listener for ESC + Space ─────
    useEffect(() => {
        if (!editMode) return
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setWallDrawing(null); setTool('select') }
            if (e.key === ' ' && !e.repeat) { e.preventDefault(); setSpaceHeld(true) }
        }
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ') { setSpaceHeld(false) }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            window.removeEventListener('keyup', onKeyUp)
            setSpaceHeld(false)
        }
    }, [editMode])

    // ── Canvas mouse & touch handlers ──────────────────
    const toCanvas = useCallback((clientX: number, clientY: number) => {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return { x: 0, y: 0 }
        return {
            x: (clientX - rect.left - pan.x) / zoom,
            y: (clientY - rect.top - pan.y) / zoom,
        }
    }, [pan, zoom])

    const snap = (v: number, grid = 10) => Math.round(v / grid) * grid

    const isDrawingTool = tool === 'wall' || tool === 'door' || tool === 'label' || tool === 'eraser'

    const onCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && (tool === 'select' && !editMode)) || (e.button === 0 && spaceHeld && editMode)) {
            setIsPanning(true)
            panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
            return
        }

        if (!editMode) return
        const pos = toCanvas(e.clientX, e.clientY)

        if (tool === 'wall') {
            if (!wallDrawing) {
                setWallDrawing({ x1: snap(pos.x), y1: snap(pos.y) })
            } else {
                const newWall: Wall = {
                    id: uid(),
                    x1: wallDrawing.x1, y1: wallDrawing.y1,
                    x2: snap(pos.x), y2: snap(pos.y),
                    thickness: 10,
                }
                setLayoutCfg(prev => ({ ...prev, walls: [...prev.walls, newWall] }))
                setWallDrawing(null)
                setHasChanges(true)
            }
        } else if (tool === 'door') {
            const newDoor: Door = { id: uid(), x: snap(pos.x), y: snap(pos.y), width: doorWidth, rotation: doorRotation }
            setLayoutCfg(prev => ({ ...prev, doors: [...prev.doors, newDoor] }))
            setHasChanges(true)
        } else if (tool === 'label') {
            const text = prompt('Nhập nội dung nhãn/chú thích trên sơ đồ:')
            if (text) {
                const newLabel: Label = { id: uid(), x: snap(pos.x), y: snap(pos.y), text, fontSize: 14 }
                setLayoutCfg(prev => ({ ...prev, labels: [...prev.labels, newLabel] }))
                setHasChanges(true)
            }
        } else if (tool === 'eraser') {
            const threshold = 20
            const px = pos.x, py = pos.y
            const wallIdx = layoutCfg.walls.findIndex(w => {
                const dx = w.x2 - w.x1, dy = w.y2 - w.y1
                const len = Math.sqrt(dx * dx + dy * dy)
                if (len === 0) return Math.hypot(px - w.x1, py - w.y1) < threshold
                const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / (len * len)))
                const cx = w.x1 + t * dx, cy = w.y1 + t * dy
                return Math.hypot(px - cx, py - cy) < threshold
            })
            if (wallIdx >= 0) {
                setLayoutCfg(prev => ({ ...prev, walls: prev.walls.filter((_, i) => i !== wallIdx) }))
                setHasChanges(true)
                return
            }
            const doorIdx = layoutCfg.doors.findIndex(d => Math.hypot(px - d.x, py - d.y) < threshold)
            if (doorIdx >= 0) {
                setLayoutCfg(prev => ({ ...prev, doors: prev.doors.filter((_, i) => i !== doorIdx) }))
                setHasChanges(true)
                return
            }
            const lblIdx = layoutCfg.labels.findIndex(l => Math.hypot(px - l.x, py - l.y) < threshold + 20)
            if (lblIdx >= 0) {
                setLayoutCfg(prev => ({ ...prev, labels: prev.labels.filter((_, i) => i !== lblIdx) }))
                setHasChanges(true)
            }
        }
    }

    const onCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: panStart.current.panX + (e.clientX - panStart.current.x),
                y: panStart.current.panY + (e.clientY - panStart.current.y),
            })
            return
        }
        const pos = toCanvas(e.clientX, e.clientY)
        setMousePos(pos)

        if (tool === 'eraser') {
            const threshold = 20
            const px = pos.x, py = pos.y
            const wall = layoutCfg.walls.find(w => {
                const dx = w.x2 - w.x1, dy = w.y2 - w.y1
                const len = Math.sqrt(dx * dx + dy * dy)
                if (len === 0) return Math.hypot(px - w.x1, py - w.y1) < threshold
                const t = Math.max(0, Math.min(1, ((px - w.x1) * dx + (py - w.y1) * dy) / (len * len)))
                const cx = w.x1 + t * dx, cy = w.y1 + t * dy
                return Math.hypot(px - cx, py - cy) < threshold
            })
            setHoveredWallId(wall?.id ?? null)
        } else {
            setHoveredWallId(null)
        }

        if (dragLoc && editMode && tool === 'select') {
            const dx = (e.clientX - dragLoc.startX) / zoom
            const dy = (e.clientY - dragLoc.startY) / zoom
            setLocations(prev => prev.map(l => l.id === dragLoc.id
                ? { ...l, posX: snap(dragLoc.origX + dx), posY: snap(dragLoc.origY + dy) }
                : l
            ))
            setHasChanges(true)
        }

        if (resizeLoc && editMode && tool === 'select') {
            const dx = (e.clientX - resizeLoc.startX) / zoom
            const dy = (e.clientY - resizeLoc.startY) / zoom
            setLocations(prev => prev.map(l => l.id === resizeLoc.id
                ? { ...l, width: Math.max(90, snap(resizeLoc.origW + dx)), height: Math.max(50, snap(resizeLoc.origH + dy)) }
                : l
            ))
            setHasChanges(true)
        }
    }

    const onCanvasMouseUp = () => {
        setIsPanning(false)
        setDragLoc(null)
        setResizeLoc(null)
    }

    // Touch Support for Mobile Drag & Pinch-to-Zoom
    const onTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const t = e.touches[0]
            setIsPanning(true)
            panStart.current = { x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y }
            touchStartDist.current = null
        } else if (e.touches.length === 2) {
            setIsPanning(false)
            const t1 = e.touches[0]
            const t2 = e.touches[1]
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
            touchStartDist.current = dist
            touchStartCenter.current = {
                x: (t1.clientX + t2.clientX) / 2,
                y: (t1.clientY + t2.clientY) / 2
            }
        }
    }

    const onTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isPanning) {
            const t = e.touches[0]
            setPan({
                x: panStart.current.panX + (t.clientX - panStart.current.x),
                y: panStart.current.panY + (t.clientY - panStart.current.y),
            })
        } else if (e.touches.length === 2 && touchStartDist.current !== null) {
            const t1 = e.touches[0]
            const t2 = e.touches[1]
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
            const factor = dist / touchStartDist.current
            setZoom(z => Math.min(3, Math.max(0.2, z * factor)))
            touchStartDist.current = dist
        }
    }

    const onTouchEnd = () => {
        setIsPanning(false)
        touchStartDist.current = null
    }

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(prev => Math.min(3, Math.max(0.2, prev + delta)))
    }

    // ── Save handlers ──────────────────────────────────
    const handleSaveAll = async () => {
        if (!selectedWH) return
        setSaving(true)
        try {
            const layoutUpdates = locations.map(l => ({ id: l.id, posX: l.posX, posY: l.posY, width: l.width, height: l.height }))
            const [res1, res2] = await Promise.all([
                saveWarehouseLayout(selectedWH, layoutUpdates),
                saveWarehouseLayoutConfig(selectedWH, layoutCfg),
            ])
            if (res1.success && res2.success) {
                showToast('Đã lưu sơ đồ kho thành công!')
                setHasChanges(false)
            } else {
                showToast(res1.error || res2.error || 'Lỗi lưu sơ đồ', 'err')
            }
        } finally {
            setSaving(false)
        }
    }

    const handleAutoLayout = async () => {
        if (!selectedWH) return
        setSaving(true)
        try {
            const res = await autoLayoutWarehouse(selectedWH)
            if (res.success) {
                showToast('Đã tự động sắp xếp sơ đồ!')
                await loadMap(selectedWH)
                setHasChanges(false)
            } else showToast(res.error || 'Lỗi', 'err')
        } finally { setSaving(false) }
    }

    // Batch Zone Resize
    const handleApplyZoneResize = (zoneName: string, w: number, h: number) => {
        setLocations(prev => prev.map(l => l.zone === zoneName ? { ...l, width: w, height: h } : l))
        setHasChanges(true)
        setResizeZoneName(null)
        showToast(`Đã đổi kích thước tất cả các vị trí thuộc ZONE ${zoneName} thành ${w}x${h}px!`)
    }

    // ── Search ─────────────────────────────────────────
    const handleSearch = async () => {
        if (!selectedWH || !searchTerm) return
        const results = await searchProductLocations(selectedWH, searchTerm)
        setSearchResults(results)
        setHighlightLocs(results.flatMap(r => r.locationIds))
    }

    const selectedLoc = locations.find(l => l.id === selectedLocId)
    const zones = [...new Set(locations.map(l => l.zone))].sort()
    const floorW = layoutCfg.boundary?.width ?? 1500
    const floorH = layoutCfg.boundary?.height ?? 750

    // Filter locations for Cards view
    const filteredLocations = locations.filter(l => {
        if (selectedZoneFilter !== 'ALL' && l.zone !== selectedZoneFilter) return false
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            const matchCode = l.locationCode.toLowerCase().includes(term)
            const matchProduct = l.products.some(p => p.skuCode.toLowerCase().includes(term) || p.productName.toLowerCase().includes(term))
            if (!matchCode && !matchProduct) return false
        }
        return true
    })

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="flex flex-col gap-0 rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-200" style={{ height: 'calc(100vh - 160px)', minHeight: 560 }}>
            {/* ── Top Bar ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-3.5 bg-slate-50 border-b border-slate-200">
                {/* Left: Warehouse Title & View Mode Toggle */}
                <div className="flex items-center justify-between sm:justify-start gap-2.5">
                    <span className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 truncate">
                        <Building2 size={18} className="text-amber-600 shrink-0" />
                        <span className="truncate">{mapData ? mapData.name : 'Sơ Đồ Kho 2D'}</span>
                    </span>

                    {/* View Switcher (2D Map vs Card Grid) */}
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-200/80 border border-slate-300 shrink-0">
                        <button
                            onClick={() => setDisplayView('map')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${displayView === 'map' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            title="Xem sơ đồ dạng bản đồ mặt bằng 2D"
                        >
                            <MapIcon size={13} />
                            <span>Bản Đồ 2D</span>
                        </button>
                        <button
                            onClick={() => setDisplayView('cards')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${displayView === 'cards' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            title="Xem dạng danh sách thẻ Pallet trực quan cho điện thoại"
                        >
                            <LayoutGrid size={13} />
                            <span>Thẻ Vị Trí ({locations.length})</span>
                        </button>
                    </div>
                </div>

                {/* Center / Right: Search & View Controls */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
                    {/* Search Input */}
                    <div className="relative flex-1 sm:w-60 min-w-[140px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            placeholder="Tìm SKU, Pallet, rượu..."
                            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs outline-none bg-white border border-slate-300 text-slate-900 focus:border-amber-500 shadow-2xs transition-all"
                        />
                    </div>

                    {/* 2D Zoom & Auto-Fit Controls (Only in Map view) */}
                    {displayView === 'map' && (
                        <div className="flex items-center gap-1 px-1.5 py-1 rounded-xl bg-white border border-slate-300 shadow-2xs shrink-0">
                            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer" title="Thu nhỏ"><ZoomOut size={14} /></button>
                            <span className="text-[11px] font-mono font-bold w-9 text-center text-slate-800">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer" title="Phóng to"><ZoomIn size={14} /></button>
                            <button
                                onClick={fitToScreen}
                                className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 cursor-pointer flex items-center gap-1"
                                title="Căn chỉnh vừa vặn toàn bộ mặt bằng kho vào màn hình"
                            >
                                <Maximize2 size={12} />
                                <span className="hidden sm:inline">Vừa Khung</span>
                            </button>
                        </div>
                    )}

                    {/* Mobile Legend Button */}
                    <button
                        onClick={() => setShowLegendDrawer(prev => !prev)}
                        className="p-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 md:hidden cursor-pointer shrink-0 shadow-2xs"
                        title="Xem chú thích và thống kê"
                    >
                        <Info size={15} className="text-amber-600" />
                    </button>

                    {/* Edit Controls */}
                    {mapData && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {!editMode ? (
                                <button onClick={() => { setEditMode(true); setDisplayView('map') }}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all bg-amber-500 text-white hover:bg-amber-600 shadow-xs cursor-pointer">
                                    <Move size={13} />
                                    <span className="hidden sm:inline">Sắp Xếp Sơ Đồ</span>
                                    <span className="sm:hidden">Sửa</span>
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleAutoLayout} disabled={saving}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs">
                                        <Grid3x3 size={13} />
                                        <span className="hidden md:inline">Tự Động</span>
                                    </button>
                                    <button onClick={handleSaveAll} disabled={saving}
                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${hasChanges ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                        <span>Lưu</span>
                                    </button>
                                    <button onClick={() => { setEditMode(false); setTool('select'); setWallDrawing(null) }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-xs">
                                        <Eye size={13} />
                                        <span>Xong</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Main Content Body ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">

                {/* ═══════════════════════════════════════════════════ */}
                {/* VIEW MODE A: RESPONSIVE CARDS GRID FOR MOBILE/TABLET */}
                {/* ═══════════════════════════════════════════════════ */}
                {displayView === 'cards' && (
                    <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100 space-y-5">
                        {/* Zone Filter Chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            <button
                                onClick={() => setSelectedZoneFilter('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${selectedZoneFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                            >
                                Tất Cả Vị Trí ({locations.length})
                            </button>
                            {zones.map(z => {
                                const zCount = locations.filter(l => l.zone === z).length
                                const zBottles = locations.filter(l => l.zone === z).reduce((s, l) => s + l.totalQty, 0)
                                return (
                                    <button
                                        key={z}
                                        onClick={() => setSelectedZoneFilter(z)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${selectedZoneFilter === z ? 'text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'}`}
                                        style={selectedZoneFilter === z ? { background: ZONE_COLORS[z] ?? '#0284C7' } : {}}
                                    >
                                        <Layers size={12} />
                                        <span>ZONE {z} ({zCount} ô • {formatNumber(zBottles)} chai)</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Cards Grid Grouped by Zone */}
                        {zones.filter(z => selectedZoneFilter === 'ALL' || selectedZoneFilter === z).map(z => {
                            const zoneLocs = filteredLocations.filter(l => l.zone === z)
                            if (zoneLocs.length === 0) return null
                            const totalZoneQty = zoneLocs.reduce((s, l) => s + l.totalQty, 0)

                            return (
                                <div key={z} className="space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ background: ZONE_COLORS[z] ?? '#0284C7' }} />
                                            <h3 className="font-extrabold text-sm text-slate-900">
                                                {z === 'A' ? 'ZONE A: Khu Vực Pallet Mới' : z === 'B' ? 'ZONE B: Khu Vực Kho Cũ & Kệ Sắt' : `ZONE ${z}`}
                                            </h3>
                                            <span className="text-xs text-slate-500 font-semibold">({zoneLocs.length} vị trí)</span>
                                        </div>
                                        <span className="text-xs font-extrabold font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                            {formatNumber(totalZoneQty)} chai
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {zoneLocs.map(loc => {
                                            const oc = occColor(loc.occupancyPct)
                                            const isSelected = selectedLocId === loc.id
                                            const isHighlighted = highlightLocs.includes(loc.id)

                                            return (
                                                <div
                                                    key={loc.id}
                                                    onClick={() => {
                                                        setSelectedLocId(loc.id)
                                                        setShowLocModal(true)
                                                    }}
                                                    className="p-3.5 rounded-2xl bg-white border transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-2.5 relative group"
                                                    style={{
                                                        borderColor: isSelected ? '#2563EB' : isHighlighted ? '#F59E0B' : oc.border,
                                                        boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.2)' : isHighlighted ? '0 0 0 3px rgba(245,158,11,0.25)' : 'none'
                                                    }}
                                                >
                                                    {/* Header: Code & Occupancy Badge */}
                                                    <div className="flex items-center justify-between gap-1">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: oc.dot }} />
                                                            <span className="font-mono font-extrabold text-xs text-slate-900 truncate">
                                                                {loc.locationCode.replace('LOC-TT-', '')}
                                                            </span>
                                                        </div>
                                                        <span
                                                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                                                            style={{ background: oc.badgeBg, color: oc.badgeText }}
                                                        >
                                                            {loc.occupancyPct}% • {oc.label}
                                                        </span>
                                                    </div>

                                                    {/* Occupancy Progress bar */}
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{ width: `${Math.min(100, loc.occupancyPct)}%`, background: oc.dot }}
                                                        />
                                                    </div>

                                                    {/* Products list preview */}
                                                    <div className="space-y-1 my-0.5">
                                                        {loc.products.length === 0 ? (
                                                            <p className="text-[11px] text-slate-400 italic">Vị trí đang trống</p>
                                                        ) : (
                                                            loc.products.slice(0, 2).map((p, idx) => (
                                                                <div key={idx} className="flex items-center justify-between gap-1 text-[11px]">
                                                                    <span className="text-slate-800 font-semibold truncate">
                                                                        {p.productName}
                                                                    </span>
                                                                    <span className="font-mono font-bold text-slate-900 shrink-0">
                                                                        {p.qtyAvailable}c
                                                                    </span>
                                                                </div>
                                                            ))
                                                        )}
                                                        {loc.products.length > 2 && (
                                                            <p className="text-[10px] text-amber-700 font-bold">
                                                                + Thêm {loc.products.length - 2} mã rượu khác...
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Footer: Total & Tap to View */}
                                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                                                        <span className="text-[11px] text-slate-500 font-semibold">
                                                            {loc.products.length} mã rượu
                                                        </span>
                                                        <span className="font-mono font-extrabold text-emerald-700">
                                                            {formatNumber(loc.totalQty)} chai
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════ */}
                {/* VIEW MODE B: 2D INTERACTIVE CANVAS MAP */}
                {/* ═══════════════════════════════════════════════════ */}
                {displayView === 'map' && (
                    <>
                        {/* Left Drawing Toolbar (Active in Edit Mode) */}
                        {editMode && (
                            <div className="flex flex-col gap-1.5 p-2 bg-slate-100 border-r border-slate-200 z-20 shrink-0 shadow-2xs" style={{ width: 68 }}>
                                {([
                                    { key: 'select' as Tool, icon: MousePointer2, label: 'Chọn' },
                                    { key: 'wall' as Tool, icon: Minus, label: 'Tường' },
                                    { key: 'door' as Tool, icon: DoorOpen, label: 'Cửa' },
                                    { key: 'label' as Tool, icon: Type, label: 'Nhãn' },
                                    { key: 'eraser' as Tool, icon: Trash2, label: 'Tẩy' },
                                ]).map(t => (
                                    <button key={t.key} onClick={() => { setTool(t.key); setWallDrawing(null) }}
                                        title={t.label}
                                        className={`flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${tool === t.key ? 'bg-amber-500 text-white shadow-sm scale-105' : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200'}`}>
                                        <t.icon size={16} />
                                        <span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 2D Canvas Area */}
                        <div
                            ref={canvasRef}
                            className="flex-1 relative overflow-hidden select-none touch-none"
                            style={{
                                background: '#E2E8F0',
                                backgroundImage: 'radial-gradient(circle, #CBD5E1 1.2px, transparent 1.2px)',
                                backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                                backgroundPosition: `${pan.x}px ${pan.y}px`,
                                cursor: isPanning || spaceHeld ? 'grabbing'
                                    : tool === 'wall' || tool === 'door' ? 'crosshair'
                                        : tool === 'label' ? 'text'
                                            : tool === 'eraser' ? 'not-allowed'
                                                : editMode ? 'default' : 'grab',
                            }}
                            onMouseDown={onCanvasMouseDown}
                            onMouseMove={onCanvasMouseMove}
                            onMouseUp={onCanvasMouseUp}
                            onMouseLeave={onCanvasMouseUp}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onWheel={onWheel}
                        >
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-xs z-50">
                                    <div className="flex flex-col items-center gap-2 bg-white p-5 rounded-2xl border border-slate-200 text-amber-700 text-xs font-bold shadow-xl">
                                        <Loader2 size={32} className="animate-spin text-amber-600" />
                                        <span>Đang tải dữ liệu sơ đồ kho...</span>
                                    </div>
                                </div>
                            )}

                            {!mapData && !loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                    <Box size={44} className="text-slate-400" />
                                    <p className="text-sm font-semibold text-slate-500">Chọn kho để xem sơ đồ 2D vị trí</p>
                                </div>
                            )}

                            {mapData && (
                                <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>

                                    {/* 🏢 Outer Warehouse Perimeter Frame */}
                                    <div style={{
                                        position: 'absolute',
                                        left: 0, top: 0,
                                        width: floorW, height: floorH,
                                        background: '#FFFFFF',
                                        backgroundImage: 'radial-gradient(circle, #E2E8F0 1.2px, transparent 1.2px)',
                                        backgroundSize: '24px 24px',
                                        border: '8px solid #1E293B',
                                        borderRadius: 14,
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                                        pointerEvents: 'none',
                                        zIndex: 0,
                                    }}>
                                        <div className="absolute -top-8 left-2 bg-amber-500 text-white px-3 py-0.5 rounded-t-lg text-[10px] font-extrabold font-mono flex items-center gap-1.5 shadow-sm border border-amber-600">
                                            <Building2 size={12} className="text-white" />
                                            {mapData.name.toUpperCase()} (MẶT BẰNG KHO)
                                        </div>
                                    </div>

                                    {/* Architectural SVG Layer: Walls & Doors */}
                                    <svg style={{ position: 'absolute', top: 0, left: 0, width: Math.max(2000, floorW + 200), height: Math.max(1200, floorH + 200), zIndex: 1, pointerEvents: 'none' }}>
                                        {layoutCfg.walls.map(w => (
                                            <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                                                stroke="#1E293B" strokeWidth={w.thickness || 8} strokeLinecap="round" />
                                        ))}

                                        {layoutCfg.doors.map(d => (
                                            <g key={d.id} transform={`translate(${d.x}, ${d.y}) rotate(${d.rotation})`}>
                                                <rect x={-d.width / 2} y={-4} width={d.width} height={8} fill="#F59E0B" stroke="#B45309" strokeWidth={1.5} rx={2} />
                                                <path d={`M ${-d.width / 2} 4 A ${d.width / 2} ${d.width / 2} 0 0 1 ${d.width / 2} 4`}
                                                    fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 2" />
                                            </g>
                                        ))}

                                        {layoutCfg.labels.map(l => (
                                            <text key={l.id} x={l.x} y={l.y} fontSize={l.fontSize || 14}
                                                fill="#334155" fontWeight="800" fontFamily="Inter, sans-serif"
                                                style={{ userSelect: 'none' }}>
                                                {l.text}
                                            </text>
                                        ))}
                                    </svg>

                                    {/* Zone Badges */}
                                    {zones.map(zone => {
                                        const zoneLocs = locations.filter(l => l.zone === zone)
                                        if (zoneLocs.length === 0) return null
                                        const minX = Math.min(...zoneLocs.map(l => l.posX))
                                        const minY = Math.min(...zoneLocs.map(l => l.posY))
                                        const zColor = ZONE_COLORS[zone] ?? '#0284C7'
                                        return (
                                            <div key={`zone-${zone}`} style={{ position: 'absolute', left: minX, top: minY - 30, zIndex: 2, pointerEvents: 'none' }}>
                                                <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold shadow-2xs"
                                                    style={{ background: zColor, color: '#FFFFFF' }}>
                                                    <Layers size={11} />
                                                    ZONE {zone}
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {/* Location Blocks (Interactive Bins / Shelves) */}
                                    {locations.map(loc => {
                                        const oc = occColor(loc.occupancyPct)
                                        const isHighlighted = highlightLocs.includes(loc.id)
                                        const isSelected = selectedLocId === loc.id

                                        return (
                                            <div
                                                key={loc.id}
                                                onMouseDown={e => {
                                                    if (editMode && tool === 'select' && !spaceHeld) {
                                                        e.stopPropagation()
                                                        setSelectedLocId(loc.id)
                                                        setDragLoc({ id: loc.id, startX: e.clientX, startY: e.clientY, origX: loc.posX, origY: loc.posY })
                                                    }
                                                }}
                                                onClick={e => {
                                                    if (!isDrawingTool) {
                                                        e.stopPropagation()
                                                        setSelectedLocId(loc.id)
                                                        if (!editMode) setShowLocModal(true)
                                                    }
                                                }}
                                                className="absolute transition-all duration-150 group overflow-hidden"
                                                style={{
                                                    left: loc.posX, top: loc.posY,
                                                    width: loc.width, height: loc.height,
                                                    background: oc.fill,
                                                    border: `2px solid ${isSelected ? '#2563EB' : isHighlighted ? '#F59E0B' : oc.border}`,
                                                    borderRadius: 10,
                                                    zIndex: isSelected ? 20 : isHighlighted ? 15 : 10,
                                                    cursor: editMode && isDrawingTool ? 'inherit' : editMode && tool === 'select' ? 'move' : 'pointer',
                                                    pointerEvents: editMode && isDrawingTool ? 'none' : 'auto',
                                                    boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.25)' : isHighlighted ? '0 0 0 3px rgba(245,158,11,0.3)' : '0 2px 4px rgba(0,0,0,0.03)',
                                                    padding: '5px 8px',
                                                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                                    userSelect: 'none',
                                                }}
                                            >
                                                {/* Top: Location Code & Occupancy badge */}
                                                <div className="flex items-center justify-between gap-1 overflow-hidden min-w-0">
                                                    <span className="font-extrabold font-mono text-slate-900 text-xs truncate">
                                                        {loc.locationCode.replace('LOC-TT-', '')}
                                                    </span>
                                                    <span
                                                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0"
                                                        style={{ background: oc.badgeBg, color: oc.badgeText }}
                                                    >
                                                        {loc.occupancyPct}%
                                                    </span>
                                                </div>

                                                {/* Occupancy Progress Bar */}
                                                <div className="w-full rounded-full overflow-hidden bg-slate-200/80 my-0.5 shrink-0" style={{ height: 4 }}>
                                                    <div style={{ width: `${Math.min(100, loc.occupancyPct)}%`, height: '100%', background: oc.dot, borderRadius: 99 }} />
                                                </div>

                                                {/* Bottom: Wine Summary & Qty */}
                                                <div className="flex items-center justify-between gap-1 text-[10px] overflow-hidden min-w-0">
                                                    <span className="text-slate-600 font-semibold truncate">
                                                        {loc.products[0]?.productName || 'Trống'}
                                                    </span>
                                                    <span className="font-extrabold font-mono shrink-0" style={{ color: oc.text }}>
                                                        {formatNumber(loc.totalQty)}c
                                                    </span>
                                                </div>

                                                {/* Drag-to-Resize Handle */}
                                                {editMode && tool === 'select' && (
                                                    <div
                                                        onMouseDown={e => {
                                                            e.stopPropagation()
                                                            setResizeLoc({ id: loc.id, startX: e.clientX, startY: e.clientY, origW: loc.width, origH: loc.height })
                                                        }}
                                                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-500 border border-white rounded-sm cursor-se-resize shadow-md flex items-center justify-center"
                                                    >
                                                        <Maximize size={10} className="text-white" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ═══════════════════════════════════════════════════ */}
                {/* RIGHT SIDEBAR: Legend & Metrics (Collapsible on Mobile) */}
                {/* ═══════════════════════════════════════════════════ */}
                <div className={`
                    ${showLegendDrawer ? 'fixed inset-y-0 right-0 z-50 shadow-2xl flex' : 'hidden md:flex'}
                    flex-col gap-3.5 p-4 overflow-y-auto shrink-0 bg-slate-50 border-l border-slate-200 text-slate-800 w-72 sm:w-80
                `}>
                    {/* Mobile Close Button */}
                    <div className="flex items-center justify-between md:hidden border-b border-slate-200 pb-2.5">
                        <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <Info size={16} className="text-amber-600" /> Thống Kê & Chú Thích
                        </span>
                        <button onClick={() => setShowLegendDrawer(false)} className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                    </div>

                    {/* Quick Warehouse Stats */}
                    {mapData && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl text-center bg-white border border-slate-200 shadow-2xs">
                                <p className="text-base font-extrabold text-amber-600 font-mono">{locations.length}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng Vị Trí</p>
                            </div>
                            <div className="p-2.5 rounded-xl text-center bg-white border border-slate-200 shadow-2xs">
                                <p className="text-base font-extrabold text-emerald-600 font-mono">{formatNumber(locations.reduce((s, l) => s + l.totalQty, 0))}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng Chai Tồn</p>
                            </div>
                        </div>
                    )}

                    {/* Occupancy Legend */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-800 flex items-center gap-1.5">
                            <Info size={14} className="text-amber-600" /> Mức Tồn Kho
                        </h4>
                        <div className="space-y-1.5">
                            {[
                                { label: 'Trống (0%)', pct: 0 },
                                { label: 'Thấp (1-40%)', pct: 20 },
                                { label: 'Vừa (40-70%)', pct: 50 },
                                { label: 'Cao (70-90%)', pct: 80 },
                                { label: 'Đầy (>90%)', pct: 95 },
                            ].map(item => {
                                const c = occColor(item.pct)
                                return (
                                    <div key={item.label} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-md shrink-0" style={{ background: c.fill, border: `1.5px solid ${c.border}` }} />
                                            <span className="font-semibold text-slate-700">{item.label}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Zones Summary */}
                    {zones.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-800">Danh Sách Zone ({zones.length})</h4>
                            <div className="space-y-1.5">
                                {zones.map(z => {
                                    const zLocs = locations.filter(l => l.zone === z)
                                    const zQty = zLocs.reduce((s, l) => s + l.totalQty, 0)
                                    return (
                                        <div key={z} className="p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs text-xs">
                                            <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-extrabold text-white"
                                                    style={{ background: ZONE_COLORS[z] ?? '#0284C7' }}>
                                                    ZONE {z}
                                                </span>
                                                <span className="text-slate-600 font-semibold">({zLocs.length} ô)</span>
                                            </div>
                                            <span className="font-mono font-bold text-emerald-700">{formatNumber(zQty)}c</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* POPUP MODAL: Detailed Location Inventory Modal */}
            {/* ═══════════════════════════════════════════════════ */}
            {showLocModal && selectedLoc && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[999] flex items-center justify-center p-3 sm:p-4">
                    <div className="rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden bg-white border border-slate-200 text-slate-900 flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                                        📍 Vị Trí: <span className="font-mono text-amber-700">{selectedLoc.locationCode}</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Zone: <strong className="text-slate-800">{selectedLoc.zone}</strong> • Sức chứa: <strong className="text-slate-800">{selectedLoc.capacityCases ?? 50} thùng</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLocModal(false)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border-b border-slate-200">
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Tổng Tồn</p>
                                <p className="text-lg font-extrabold text-emerald-600 font-mono mt-0.5">{formatNumber(selectedLoc.totalQty)} <span className="text-xs font-normal">chai</span></p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Lấp Đầy</p>
                                <p className="text-lg font-extrabold font-mono mt-0.5" style={{ color: occColor(selectedLoc.occupancyPct).text }}>
                                    {selectedLoc.occupancyPct}% <span className="text-xs font-normal">({occColor(selectedLoc.occupancyPct).label})</span>
                                </p>
                            </div>
                        </div>

                        {/* Product list */}
                        <div className="p-3 sm:p-4 flex-1 overflow-y-auto space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                                <Package size={15} className="text-amber-600" /> Danh Sách Rượu ({selectedLoc.products.length} mã)
                            </h4>

                            {selectedLoc.products.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                                    <Box size={32} className="mb-1 text-slate-300" />
                                    <p className="text-xs font-semibold text-slate-500">Vị trí này hiện đang trống</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {selectedLoc.products.map((p, i) => (
                                        <div key={p.id || i} className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-extrabold text-xs text-amber-700">{p.skuCode}</span>
                                                    {p.vintage && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                                            {p.vintage}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{p.productName}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">Lô: {p.lotNo}</p>
                                            </div>
                                            <span className="text-sm font-mono font-extrabold text-emerald-700 shrink-0">
                                                {formatNumber(p.qtyAvailable)}c
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                onClick={() => setShowLocModal(false)}
                                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-slate-900 text-white cursor-pointer shadow-xs"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl flex items-center gap-2"
                    style={{
                        background: toast.type === 'ok' ? '#10B981' : '#EF4444',
                        color: '#FFFFFF',
                    }}>
                    <Sparkles size={16} />
                    {toast.msg}
                </div>
            )}
        </div>
    )
}
