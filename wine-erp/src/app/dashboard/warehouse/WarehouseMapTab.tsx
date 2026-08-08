'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
    Search, Loader2, Save, Move, Maximize2, ZoomIn, ZoomOut, Grid3x3,
    X, Eye, MousePointer2, Minus, DoorOpen, Type, Trash2, RotateCcw,
    ChevronDown, Box, Layers, Package, Calendar, ShieldCheck, Thermometer,
    Sparkles, RefreshCw, Info, Building2, MapPin
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
interface LayoutConfig { walls: Wall[]; doors: Door[]; labels: Label[] }

type Tool = 'select' | 'wall' | 'door' | 'label' | 'eraser'

// ═══════════════════════════════════════════════════════════
// Modern Aesthetic Color Tokens for Occupancy
// ═══════════════════════════════════════════════════════════
function occColor(pct: number) {
    if (pct >= 90) return {
        fill: '#FFF1F2',
        border: '#F43F5E',
        text: '#E11D48',
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
        fill: '#E0F2FE',
        border: '#0284C7',
        text: '#0369A1',
        dot: '#0284C7',
        badgeBg: '#E0F2FE',
        badgeText: '#075985',
        label: 'Trung bình (40-70%)'
    }
    if (pct > 0) return {
        fill: '#E6F4F1',
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
        text: '#64748B',
        dot: '#94A3B8',
        badgeBg: '#F1F5F9',
        badgeText: '#475569',
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

    // Sync selectedWH when selectedWarehouseId changes
    useEffect(() => {
        if (selectedWarehouseId && selectedWarehouseId !== selectedWH) {
            setSelectedWH(selectedWarehouseId)
        }
    }, [selectedWarehouseId])

    // Canvas State
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 40, y: 40 })
    const [isPanning, setIsPanning] = useState(false)
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
    const canvasRef = useRef<HTMLDivElement>(null)

    // Tools
    const [tool, setTool] = useState<Tool>('select')
    const [editMode, setEditMode] = useState(false)
    const [selectedLocId, setSelectedLocId] = useState<string | null>(null)

    // Floor plan elements (Walls, Doors, Labels)
    const [layoutCfg, setLayoutCfg] = useState<LayoutConfig>({ walls: [], doors: [], labels: [] })
    const [wallDrawing, setWallDrawing] = useState<{ x1: number; y1: number } | null>(null)
    const [doorRotation, setDoorRotation] = useState<number>(0)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
    const [spaceHeld, setSpaceHeld] = useState(false)

    // Drag & Resize location
    const [dragLoc, setDragLoc] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
    const [resizeLoc, setResizeLoc] = useState<{ id: string; handle: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null)
    const [locations, setLocations] = useState<MapLocation[]>([])
    const [hasChanges, setHasChanges] = useState(false)

    // Search & Popups
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightLocs, setHighlightLocs] = useState<string[]>([])
    const [searchResults, setSearchResults] = useState<{ skuCode: string; productName: string; totalQty: number; locationIds: string[] }[]>([])
    const [showLocModal, setShowLocModal] = useState(false)

    // Toast
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
    const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

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
            setLayoutCfg(cfg ?? { walls: [], doors: [], labels: [] })
            setPan({ x: 40, y: 40 })
            setZoom(1)
        } finally {
            setLoading(false)
        }
    }, [])

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

    // ── Canvas mouse handlers ──────────────────────────
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
        // Pan: middle-click, or left-click in view mode, or space+left-click in edit mode
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
                    thickness: 8,
                }
                setLayoutCfg(prev => ({ ...prev, walls: [...prev.walls, newWall] }))
                setWallDrawing(null)
                setHasChanges(true)
            }
        } else if (tool === 'door') {
            const newDoor: Door = { id: uid(), x: snap(pos.x), y: snap(pos.y), width: 44, rotation: doorRotation }
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
            // Try to remove nearest wall/door/label
            const threshold = 18
            const px = pos.x, py = pos.y
            // Walls
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
            // Doors
            const doorIdx = layoutCfg.doors.findIndex(d => Math.hypot(px - d.x, py - d.y) < threshold)
            if (doorIdx >= 0) {
                setLayoutCfg(prev => ({ ...prev, doors: prev.doors.filter((_, i) => i !== doorIdx) }))
                setHasChanges(true)
                return
            }
            // Labels
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

        // Drag location
        if (dragLoc && editMode && tool === 'select') {
            const dx = (e.clientX - dragLoc.startX) / zoom
            const dy = (e.clientY - dragLoc.startY) / zoom
            setLocations(prev => prev.map(l => l.id === dragLoc.id
                ? { ...l, posX: snap(dragLoc.origX + dx), posY: snap(dragLoc.origY + dy) }
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

    const onWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(prev => Math.min(3, Math.max(0.3, prev + delta)))
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

    // ── Search ─────────────────────────────────────────
    const handleSearch = async () => {
        if (!selectedWH || !searchTerm) return
        const results = await searchProductLocations(selectedWH, searchTerm)
        setSearchResults(results)
        setHighlightLocs(results.flatMap(r => r.locationIds))
    }

    const selectedLoc = locations.find(l => l.id === selectedLocId)
    const zones = [...new Set(locations.map(l => l.zone))].sort()

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="flex flex-col gap-0 rounded-2xl overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 170px)', minHeight: 640, border: '1px solid #E2E8F0', background: '#FFFFFF' }}>
            {/* ── Top Bar ─────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 p-3.5" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>

                {/* Warehouse Title */}
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                        <Building2 size={16} className="text-amber-600" />
                        {mapData ? mapData.name : 'Sơ Đồ Kho 2D'}
                    </span>
                </div>

                {/* Search SKU / Product */}
                <div className="flex-1 relative max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Tìm SKU, tên rượu trên sơ đồ..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs outline-none bg-white border border-slate-200 text-slate-800 focus:border-amber-500 transition-all"
                    />
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200">
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 rounded hover:bg-slate-100 text-slate-600" title="Thu nhỏ"><ZoomOut size={14} /></button>
                    <span className="text-xs font-mono font-bold w-11 text-center text-slate-700">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 rounded hover:bg-slate-100 text-slate-600" title="Phóng to"><ZoomIn size={14} /></button>
                    <button onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }) }} className="p-1 rounded hover:bg-slate-100 text-slate-600" title="Về mặc định"><Maximize2 size={14} /></button>
                </div>

                {/* Edit & Save Controls */}
                {mapData && (
                    <div className="flex items-center gap-2 ml-auto">
                        {!editMode ? (
                            <button onClick={() => setEditMode(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer">
                                <Move size={14} /> Chỉnh Sửa Sơ Đồ
                            </button>
                        ) : (
                            <>
                                <button onClick={handleAutoLayout} disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">
                                    <Grid3x3 size={13} /> Sắp Xếp Tự Động
                                </button>
                                <button onClick={handleSaveAll} disabled={saving}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${hasChanges ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Lưu Sơ Đồ
                                </button>
                                <button onClick={() => { setEditMode(false); setTool('select'); setWallDrawing(null) }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-900 cursor-pointer">
                                    <Eye size={13} /> Hoàn Tất
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Main Canvas & Control Area ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Drawing Toolbar (Active in Edit Mode) */}
                {editMode && (
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-900 border-r border-slate-800 z-20 shrink-0" style={{ width: 68 }}>
                        {([
                            { key: 'select' as Tool, icon: MousePointer2, label: 'Chọn/Kéo' },
                            { key: 'wall' as Tool, icon: Minus, label: 'Vẽ Tường' },
                            { key: 'door' as Tool, icon: DoorOpen, label: 'Vẽ Cửa' },
                            { key: 'label' as Tool, icon: Type, label: 'Nhãn' },
                            { key: 'eraser' as Tool, icon: Trash2, label: 'Tẩy' },
                        ]).map(t => (
                            <button key={t.key} onClick={() => { setTool(t.key); setWallDrawing(null) }}
                                title={t.label}
                                className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${tool === t.key ? 'bg-amber-500 text-slate-950 shadow-md scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                                <t.icon size={18} />
                                <span>{t.label}</span>
                            </button>
                        ))}

                        {/* Door Rotation helper */}
                        {tool === 'door' && (
                            <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col items-center gap-1">
                                <button
                                    onClick={() => setDoorRotation(r => (r + 90) % 360)}
                                    className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold hover:bg-amber-500/30 w-full text-center"
                                    title="Xoay cửa 90 độ"
                                >
                                    Xoay {doorRotation}°
                                </button>
                            </div>
                        )}

                        <div className="mt-auto pt-2 border-t border-slate-800">
                            <button onClick={() => { setLayoutCfg({ walls: [], doors: [], labels: [] }); setHasChanges(true) }}
                                title="Reset vẽ tường cửa" className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-medium text-rose-400 hover:bg-rose-950/30 w-full">
                                <RotateCcw size={14} />
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* 2D Canvas Area */}
                <div
                    ref={canvasRef}
                    className="flex-1 relative overflow-hidden select-none"
                    style={{
                        background: '#0F172A', // Slate 900 Blueprint Dark Theme
                        backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                        cursor: isPanning || spaceHeld ? 'grabbing'
                            : tool === 'wall' ? 'crosshair'
                                : tool === 'door' ? 'crosshair'
                                    : tool === 'label' ? 'text'
                                        : tool === 'eraser' ? 'not-allowed'
                                            : editMode ? 'default' : 'grab',
                    }}
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp}
                    onWheel={onWheel}
                >
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs z-50">
                            <div className="flex flex-col items-center gap-2 bg-slate-900 p-4 rounded-xl border border-slate-800 text-amber-400 text-xs font-bold">
                                <Loader2 size={28} className="animate-spin" />
                                <span>Đang tải dữ liệu sơ đồ kho...</span>
                            </div>
                        </div>
                    )}

                    {!mapData && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Box size={44} className="text-slate-700" />
                            <p className="text-sm font-semibold text-slate-400">Chọn kho để xem sơ đồ 2D vị trí</p>
                        </div>
                    )}

                    {mapData && (
                        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
                            {/* SVG Architectural Layer: Walls, Doors & Drawing Previews */}
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: 3000, height: 2000, zIndex: 1, pointerEvents: 'none' }}>
                                {/* Walls */}
                                {layoutCfg.walls.map(w => (
                                    <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                                        stroke="#475569" strokeWidth={w.thickness || 8} strokeLinecap="round" />
                                ))}

                                {/* Wall drawing active preview */}
                                {wallDrawing && (
                                    <line x1={wallDrawing.x1} y1={wallDrawing.y1}
                                        x2={snap(mousePos.x)} y2={snap(mousePos.y)}
                                        stroke="#F59E0B" strokeWidth={8} strokeLinecap="round" strokeDasharray="8 4" opacity={0.8} />
                                )}

                                {/* Doors with Architectural Swing Arc */}
                                {layoutCfg.doors.map(d => (
                                    <g key={d.id} transform={`translate(${d.x}, ${d.y}) rotate(${d.rotation})`}>
                                        <rect x={-d.width / 2} y={-4} width={d.width} height={8} fill="#F59E0B" stroke="#B45309" strokeWidth={1.5} rx={2} />
                                        <path d={`M ${-d.width / 2} 4 A ${d.width / 2} ${d.width / 2} 0 0 1 ${d.width / 2} 4`}
                                            fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 2" />
                                    </g>
                                ))}

                                {/* Labels */}
                                {layoutCfg.labels.map(l => (
                                    <text key={l.id} x={l.x} y={l.y} fontSize={l.fontSize || 14}
                                        fill="#94A3B8" fontWeight="700" fontFamily="Inter, sans-serif"
                                        style={{ userSelect: 'none' }}>
                                        {l.text}
                                    </text>
                                ))}
                            </svg>

                            {/* Zone Boundary Cards */}
                            {zones.map(zone => {
                                const zoneLocs = locations.filter(l => l.zone === zone)
                                if (zoneLocs.length === 0) return null
                                const minX = Math.min(...zoneLocs.map(l => l.posX))
                                const minY = Math.min(...zoneLocs.map(l => l.posY))
                                const maxX = Math.max(...zoneLocs.map(l => l.posX + l.width))
                                const zColor = ZONE_COLORS[zone] ?? '#64748B'
                                return (
                                    <div key={`zone-${zone}`} style={{ position: 'absolute', left: minX - 10, top: minY - 36, zIndex: 2, pointerEvents: isDrawingTool ? 'none' : 'auto' }}>
                                        {/* Zone Tinted Container */}
                                        <div style={{
                                            position: 'absolute', left: 0, top: 32,
                                            width: (maxX - minX) + 20,
                                            height: Math.max(...zoneLocs.map(l => l.posY + l.height)) - minY + 20,
                                            background: `${zColor}12`, border: `2px dashed ${zColor}40`,
                                            borderRadius: 14, pointerEvents: 'none',
                                        }} />
                                        {/* Zone Badge */}
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-extrabold shadow-sm"
                                            style={{ background: zColor, color: '#FFFFFF', width: 'fit-content', letterSpacing: 0.5 }}>
                                            <Layers size={12} />
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
                                                setDragLoc({ id: loc.id, startX: e.clientX, startY: e.clientY, origX: loc.posX, origY: loc.posY })
                                            }
                                        }}
                                        onClick={e => {
                                            if (!isDrawingTool) {
                                                e.stopPropagation()
                                                setSelectedLocId(loc.id)
                                                setShowLocModal(true) // Open Inventory Details Popup Modal!
                                            }
                                        }}
                                        className="absolute transition-all duration-150 group"
                                        style={{
                                            left: loc.posX, top: loc.posY,
                                            width: loc.width, height: loc.height,
                                            background: oc.fill,
                                            border: `2px solid ${isSelected ? '#2563EB' : isHighlighted ? '#F59E0B' : oc.border}`,
                                            borderRadius: 10,
                                            zIndex: isSelected ? 20 : isHighlighted ? 15 : 10,
                                            cursor: editMode && isDrawingTool ? 'inherit' : editMode && tool === 'select' ? 'move' : 'pointer',
                                            pointerEvents: editMode && isDrawingTool ? 'none' : 'auto',
                                            boxShadow: isSelected ? '0 0 0 4px rgba(37,99,235,0.3), 0 4px 12px rgba(0,0,0,0.15)' :
                                                isHighlighted ? '0 0 0 4px rgba(245,158,11,0.3), 0 0 16px rgba(245,158,11,0.3)' :
                                                    '0 2px 4px rgba(0,0,0,0.05)',
                                            padding: '6px 8px',
                                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                            userSelect: 'none',
                                        }}
                                    >
                                        {/* Top: Location Code & Temp badge */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold font-mono" style={{ color: '#0F172A', letterSpacing: 0.3 }}>
                                                {loc.locationCode}
                                            </span>
                                            {loc.tempControlled && (
                                                <span className="text-[10px]" title="Kho lạnh bảo quản rượu">❄️</span>
                                            )}
                                        </div>

                                        {/* Occupancy Progress Bar */}
                                        <div className="w-full rounded-full overflow-hidden bg-slate-200/80 my-1" style={{ height: 5 }}>
                                            <div style={{ width: `${loc.occupancyPct}%`, height: '100%', background: oc.dot, borderRadius: 99, transition: 'width 0.3s' }} />
                                        </div>

                                        {/* Bottom: Qty & Occupancy % */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold font-mono" style={{ color: oc.text }}>
                                                {loc.totalQty > 0 ? `${formatNumber(loc.totalQty)} chai` : 'Trống'}
                                            </span>
                                            <span className="text-[10px] font-extrabold" style={{ color: oc.text }}>
                                                {loc.occupancyPct}%
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Tool Hint Banners */}
                    {wallDrawing && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-bold z-50 bg-amber-500 text-slate-950 shadow-lg border border-amber-400">
                            🧱 Click chọn điểm kết thúc tường • ESC để hủy
                        </div>
                    )}
                    {editMode && tool === 'door' && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-bold z-50 bg-amber-500 text-slate-950 shadow-lg border border-amber-400">
                            🚪 Click để đặt cửa trên sơ đồ • Nhấn nút Xoay ở cột trái để đổi góc
                        </div>
                    )}
                    {editMode && tool === 'wall' && !wallDrawing && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-xs font-bold z-50 bg-slate-800 text-white shadow-lg border border-slate-700">
                            🧱 Click để chọn điểm bắt đầu vẽ tường • Giữ Space để kéo bản đồ
                        </div>
                    )}
                </div>

                {/* Right Side Control & Legend Panel */}
                <div className="flex flex-col gap-4 p-4 overflow-y-auto shrink-0 bg-slate-900 border-l border-slate-800 text-slate-200" style={{ width: 260 }}>
                    {/* Occupancy Legend */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 text-amber-400 flex items-center gap-1.5">
                            <Info size={13} /> Chú Thích Mức Tồn
                        </h4>
                        <div className="space-y-2">
                            {[
                                { label: 'Trống (0%)', pct: 0 },
                                { label: 'Thấp (1-40%)', pct: 20 },
                                { label: 'Trung bình (40-70%)', pct: 50 },
                                { label: 'Cao (70-90%)', pct: 80 },
                                { label: 'Đầy (>90%)', pct: 95 },
                            ].map(item => {
                                const c = occColor(item.pct)
                                return (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 rounded-md shrink-0" style={{ background: c.fill, border: `2px solid ${c.border}` }} />
                                        <span className="text-xs font-medium text-slate-300">{item.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Floor Plan Elements Legend */}
                    {editMode && (
                        <div className="pt-3 border-t border-slate-800 space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">Vật Thể Bản Đồ</h4>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-2 rounded bg-slate-500" />
                                <span className="text-xs text-slate-300">Tường ngăn</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-5 h-2 rounded bg-amber-500" />
                                <span className="text-xs text-slate-300">Cửa ra vào</span>
                            </div>
                        </div>
                    )}

                    {/* Zones Summary */}
                    {zones.length > 0 && (
                        <div className="pt-3 border-t border-slate-800">
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-400">Danh Sách Zone</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {zones.map(z => (
                                    <span key={z} className="px-2.5 py-1 rounded-md text-xs font-extrabold"
                                        style={{ background: ZONE_COLORS[z] ?? '#475569', color: '#FFFFFF' }}>
                                        ZONE {z}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Warehouse Stats */}
                    {mapData && (
                        <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl text-center bg-slate-800/80 border border-slate-700/60">
                                <p className="text-base font-extrabold text-amber-400 font-mono">{locations.length}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Tổng Vị Trí</p>
                            </div>
                            <div className="p-2.5 rounded-xl text-center bg-slate-800/80 border border-slate-700/60">
                                <p className="text-base font-extrabold text-emerald-400 font-mono">{formatNumber(locations.reduce((s, l) => s + l.totalQty, 0))}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase">Tổng Chai Tồn</p>
                            </div>
                        </div>
                    )}

                    {/* Search Results Summary */}
                    {searchResults.length > 0 && (
                        <div className="pt-3 border-t border-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold uppercase text-amber-400">Kết Quả Tìm Kiếm</h4>
                                <button onClick={() => { setSearchResults([]); setHighlightLocs([]); setSearchTerm('') }}
                                    className="p-1 rounded hover:bg-slate-800 text-slate-400"><X size={12} /></button>
                            </div>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {searchResults.map(r => (
                                    <div key={r.skuCode} className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                                        <p className="font-bold text-amber-300 font-mono">{r.skuCode}</p>
                                        <p className="text-[11px] text-slate-300 truncate">{r.productName}</p>
                                        <p className="text-[10px] font-bold text-emerald-400 mt-1">{formatNumber(r.totalQty)} chai • {r.locationIds.length} vị trí</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* POPUP MODAL: Detailed Location Inventory Details */}
            {/* ═══════════════════════════════════════════════════ */}
            {showLocModal && selectedLoc && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden bg-slate-900 border border-slate-800 text-slate-100 flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 bg-slate-950 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold flex items-center gap-2 text-white">
                                        📍 Vị Trí: <span className="font-mono text-amber-400">{selectedLoc.locationCode}</span>
                                        {selectedLoc.tempControlled && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
                                                ❄️ Bảo quản lạnh
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Zone: <strong className="text-slate-200">{selectedLoc.zone}</strong> • Rack: <strong className="text-slate-200">{selectedLoc.rack ?? '—'}</strong> • Bin: <strong className="text-slate-200">{selectedLoc.bin ?? '—'}</strong> • Loại: <strong className="text-slate-200">{selectedLoc.type}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLocModal(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Occupancy & Metric Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-950/40 border-b border-slate-800">
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Tổng Hàng Trong Kệ</p>
                                <p className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">{formatNumber(selectedLoc.totalQty)} <span className="text-xs font-normal">chai</span></p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Sức Chứa Tối Đa</p>
                                <p className="text-xl font-extrabold text-sky-400 font-mono mt-0.5">{selectedLoc.capacityCases ? selectedLoc.capacityCases * 12 : 500} <span className="text-xs font-normal">chai</span></p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
                                <p className="text-[11px] font-semibold text-slate-400 uppercase">Tỷ Lệ Lấp Đầy</p>
                                <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-xl font-extrabold font-mono" style={{ color: occColor(selectedLoc.occupancyPct).text }}>
                                        {selectedLoc.occupancyPct}%
                                    </span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: occColor(selectedLoc.occupancyPct).badgeBg, color: occColor(selectedLoc.occupancyPct).badgeText }}>
                                        {occColor(selectedLoc.occupancyPct).label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Product / Stock Lots Table */}
                        <div className="p-4 flex-1 overflow-y-auto">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                                <Package size={14} /> Danh Sách Lô Hàng & Rượu Đang Tồn Kho ({selectedLoc.products.length} mã)
                            </h4>

                            {selectedLoc.products.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                    <Box size={36} className="mb-2" />
                                    <p className="text-sm font-semibold">Vị trí/kệ này hiện đang trống</p>
                                </div>
                            ) : (
                                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                                                <th className="p-3 font-bold uppercase text-[10px]">Mã Lô (Lot No)</th>
                                                <th className="p-3 font-bold uppercase text-[10px]">Sản Phẩm & Rượu Vang</th>
                                                <th className="p-3 font-bold uppercase text-[10px] text-center">Vintage</th>
                                                <th className="p-3 font-bold uppercase text-[10px] text-center">Trạng Thái</th>
                                                <th className="p-3 font-bold uppercase text-[10px] text-right">Tồn Kho (Chai)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {selectedLoc.products.map((p, i) => (
                                                <tr key={p.id || i} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                                                        {p.lotNo || '—'}
                                                    </td>
                                                    <td className="p-3">
                                                        <p className="font-bold text-slate-100 text-xs">{p.productName}</p>
                                                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                                                            <span>SKU: {p.skuCode}</span>
                                                            {p.country && <span>• Quốc gia: {p.country}</span>}
                                                        </p>
                                                    </td>
                                                    <td className="p-3 text-center font-bold">
                                                        {p.vintage ? (
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                                                🍷 {p.vintage}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500 font-mono">N/V</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'AVAILABLE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : p.status === 'RESERVED' ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}`}>
                                                            {p.status === 'AVAILABLE' ? '✅ Sẵn sàng' : p.status === 'RESERVED' ? '🔒 Đã đặt' : '⚠️ Cách ly'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-extrabold text-sm text-emerald-400">
                                                        {formatNumber(p.qtyAvailable)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setShowLocModal(false)}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer"
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
