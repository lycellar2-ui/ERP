'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Search, Loader2, Save, Move, Maximize2, ZoomIn, ZoomOut, Grid3x3,
    X, Eye, MousePointer2, Minus, DoorOpen, Type, Trash2, RotateCcw,
    ChevronDown, Box, Layers, Package
} from 'lucide-react'
import {
    MapLocation, MapWarehouse,
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
// Occupancy helpers
// ═══════════════════════════════════════════════════════════
function occColor(pct: number) {
    if (pct >= 90) return { fill: '#fee2e2', border: '#ef4444', text: '#dc2626', dot: '#ef4444' }
    if (pct >= 70) return { fill: '#fef3c7', border: '#f59e0b', text: '#d97706', dot: '#f59e0b' }
    if (pct >= 40) return { fill: '#d1fae5', border: '#10b981', text: '#059669', dot: '#10b981' }
    if (pct > 0) return { fill: '#dbeafe', border: '#3b82f6', text: '#2563eb', dot: '#3b82f6' }
    return { fill: '#f3f4f6', border: '#d1d5db', text: '#9ca3af', dot: '#d1d5db' }
}

const ZONE_COLORS: Record<string, string> = {
    A: '#3b82f6', B: '#10b981', C: '#f59e0b', D: '#ef4444',
    E: '#8b5cf6', F: '#ec4899', G: '#14b8a6', H: '#f97316',
}

let _nextId = 0
function uid() { return `el-${Date.now()}-${_nextId++}` }

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export function WarehouseMapTab({ warehouses, isAdmin }: { warehouses: WarehouseOption[]; isAdmin: boolean }) {
    // ── State ─────────────────────────────────────────
    const [selectedWH, setSelectedWH] = useState('')
    const [mapData, setMapData] = useState<MapWarehouse | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Canvas
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
    const canvasRef = useRef<HTMLDivElement>(null)

    // Tools
    const [tool, setTool] = useState<Tool>('select')
    const [editMode, setEditMode] = useState(false)
    const [selectedLocId, setSelectedLocId] = useState<string | null>(null)

    // Floor plan elements
    const [layoutCfg, setLayoutCfg] = useState<LayoutConfig>({ walls: [], doors: [], labels: [] })
    const [wallDrawing, setWallDrawing] = useState<{ x1: number; y1: number } | null>(null)
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

    // Drag location
    const [dragLoc, setDragLoc] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
    const [locations, setLocations] = useState<MapLocation[]>([])
    const [hasChanges, setHasChanges] = useState(false)

    // Search
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightLocs, setHighlightLocs] = useState<string[]>([])
    const [searchResults, setSearchResults] = useState<{ skuCode: string; productName: string; totalQty: number; locationIds: string[] }[]>([])

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

    const onCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && (tool === 'select' && !editMode))) {
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
                    thickness: 6,
                }
                setLayoutCfg(prev => ({ ...prev, walls: [...prev.walls, newWall] }))
                setWallDrawing(null)
                setHasChanges(true)
            }
        } else if (tool === 'door') {
            const newDoor: Door = { id: uid(), x: snap(pos.x), y: snap(pos.y), width: 40, rotation: 0 }
            setLayoutCfg(prev => ({ ...prev, doors: [...prev.doors, newDoor] }))
            setHasChanges(true)
        } else if (tool === 'label') {
            const text = prompt('Nhập nội dung nhãn:')
            if (text) {
                const newLabel: Label = { id: uid(), x: snap(pos.x), y: snap(pos.y), text, fontSize: 14 }
                setLayoutCfg(prev => ({ ...prev, labels: [...prev.labels, newLabel] }))
                setHasChanges(true)
            }
        } else if (tool === 'eraser') {
            // Try to remove nearest wall/door/label
            const threshold = 15
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
                showToast(res1.error || res2.error || 'Lỗi lưu', 'err')
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
                showToast('Đã tự động sắp xếp!')
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
        <div className="flex flex-col gap-0" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
            {/* ── Top bar ─────────────────────────────── */}
            <div className="flex items-center gap-3 p-3 rounded-t-xl" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {/* Warehouse selector */}
                <div className="relative">
                    <select
                        value={selectedWH}
                        onChange={e => setSelectedWH(e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm font-medium"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b', minWidth: 220 }}
                    >
                        <option value="">Chọn kho...</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94a3b8' }} />
                </div>

                {/* Search */}
                <div className="flex-1 relative max-w-sm">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
                    <input
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Tìm SKU / tên sản phẩm..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b' }}
                    />
                </div>

                {/* Zoom controls */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 rounded hover:bg-gray-100"><ZoomOut size={14} style={{ color: '#64748b' }} /></button>
                    <span className="text-xs font-mono w-10 text-center" style={{ color: '#64748b' }}>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 rounded hover:bg-gray-100"><ZoomIn size={14} style={{ color: '#64748b' }} /></button>
                    <button onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }) }} className="p-1 rounded hover:bg-gray-100"><Maximize2 size={14} style={{ color: '#64748b' }} /></button>
                </div>

                {/* Edit controls (Admin) */}
                {isAdmin && mapData && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        {!editMode ? (
                            <button onClick={() => setEditMode(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#475569' }}>
                                <Move size={13} /> Chỉnh Sửa
                            </button>
                        ) : (
                            <>
                                <button onClick={handleAutoLayout} disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                                    style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#475569' }}>
                                    <Grid3x3 size={13} /> Auto
                                </button>
                                <button onClick={handleSaveAll} disabled={saving}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                                    style={{ background: hasChanges ? '#3b82f6' : '#94a3b8', color: '#fff' }}>
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Lưu
                                </button>
                                <button onClick={() => { setEditMode(false); setTool('select'); setWallDrawing(null) }}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                                    style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }}>
                                    <Eye size={13} /> Xong
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Main area ─────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden rounded-b-xl" style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
                {/* Left toolbar (edit mode) */}
                {editMode && (
                    <div className="flex flex-col gap-1 p-2" style={{ background: '#f1f5f9', borderRight: '1px solid #e2e8f0', width: 52 }}>
                        {([
                            { key: 'select' as Tool, icon: MousePointer2, label: 'Chọn' },
                            { key: 'wall' as Tool, icon: Minus, label: 'Tường' },
                            { key: 'door' as Tool, icon: DoorOpen, label: 'Cửa' },
                            { key: 'label' as Tool, icon: Type, label: 'Nhãn' },
                            { key: 'eraser' as Tool, icon: Trash2, label: 'Xóa' },
                        ]).map(t => (
                            <button key={t.key} onClick={() => { setTool(t.key); setWallDrawing(null) }}
                                title={t.label}
                                className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-medium transition-all"
                                style={{
                                    background: tool === t.key ? '#3b82f6' : 'transparent',
                                    color: tool === t.key ? '#fff' : '#64748b',
                                }}>
                                <t.icon size={16} />
                                {t.label}
                            </button>
                        ))}

                        <div className="mt-auto pt-2 border-t" style={{ borderColor: '#e2e8f0' }}>
                            <button onClick={() => { setLayoutCfg({ walls: [], doors: [], labels: [] }); setHasChanges(true) }}
                                title="Xóa tất cả vẽ" className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-[10px] font-medium"
                                style={{ color: '#94a3b8' }}>
                                <RotateCcw size={14} />
                                Reset
                            </button>
                        </div>
                    </div>
                )}

                {/* Canvas area */}
                <div
                    ref={canvasRef}
                    className="flex-1 relative overflow-hidden"
                    style={{
                        background: '#ffffff',
                        backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
                        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                        cursor: isPanning ? 'grabbing'
                            : tool === 'wall' ? (wallDrawing ? 'crosshair' : 'crosshair')
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
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
                            <Loader2 size={28} className="animate-spin" style={{ color: '#3b82f6' }} />
                        </div>
                    )}

                    {!mapData && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <Box size={40} style={{ color: '#cbd5e1' }} />
                            <p className="text-sm" style={{ color: '#94a3b8' }}>Chọn kho để xem sơ đồ</p>
                        </div>
                    )}

                    {mapData && (
                        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
                            {/* SVG layer: walls + doors + wall-drawing preview */}
                            <svg style={{ position: 'absolute', top: 0, left: 0, width: 2000, height: 1500, zIndex: 1, pointerEvents: 'none' }}>
                                {/* Walls */}
                                {layoutCfg.walls.map(w => (
                                    <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2}
                                        stroke="#334155" strokeWidth={w.thickness} strokeLinecap="round" />
                                ))}
                                {/* Wall drawing preview */}
                                {wallDrawing && (
                                    <line x1={wallDrawing.x1} y1={wallDrawing.y1}
                                        x2={snap(mousePos.x)} y2={snap(mousePos.y)}
                                        stroke="#3b82f6" strokeWidth={6} strokeLinecap="round" strokeDasharray="8 4" opacity={0.7} />
                                )}
                                {/* Doors */}
                                {layoutCfg.doors.map(d => (
                                    <g key={d.id} transform={`translate(${d.x}, ${d.y}) rotate(${d.rotation})`}>
                                        <rect x={-d.width / 2} y={-4} width={d.width} height={8} fill="#fbbf24" stroke="#d97706" strokeWidth={1.5} rx={2} />
                                        <path d={`M ${-d.width / 2} 4 A ${d.width / 2} ${d.width / 2} 0 0 1 ${d.width / 2} 4`}
                                            fill="none" stroke="#d97706" strokeWidth={1} strokeDasharray="3 2" />
                                    </g>
                                ))}
                                {/* Labels */}
                                {layoutCfg.labels.map(l => (
                                    <text key={l.id} x={l.x} y={l.y} fontSize={l.fontSize}
                                        fill="#475569" fontWeight="600" fontFamily="Inter, sans-serif"
                                        style={{ userSelect: 'none' }}>
                                        {l.text}
                                    </text>
                                ))}
                            </svg>

                            {/* Zone labels */}
                            {zones.map(zone => {
                                const zoneLocs = locations.filter(l => l.zone === zone)
                                if (zoneLocs.length === 0) return null
                                const minX = Math.min(...zoneLocs.map(l => l.posX))
                                const minY = Math.min(...zoneLocs.map(l => l.posY))
                                const maxX = Math.max(...zoneLocs.map(l => l.posX + l.width))
                                const zColor = ZONE_COLORS[zone] ?? '#6b7280'
                                return (
                                    <div key={`zone-${zone}`} style={{ position: 'absolute', left: minX - 8, top: minY - 32, zIndex: 2 }}>
                                        {/* Zone background */}
                                        <div style={{
                                            position: 'absolute', left: 0, top: 28,
                                            width: (maxX - minX) + 16,
                                            height: Math.max(...zoneLocs.map(l => l.posY + l.height)) - minY + 16,
                                            background: `${zColor}08`, border: `1.5px dashed ${zColor}30`,
                                            borderRadius: 12, pointerEvents: 'none',
                                        }} />
                                        {/* Zone badge */}
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold"
                                            style={{ background: zColor, color: '#fff', width: 'fit-content', letterSpacing: 0.5 }}>
                                            <Layers size={11} />
                                            ZONE {zone}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Location blocks */}
                            {locations.map(loc => {
                                const oc = occColor(loc.occupancyPct)
                                const isHighlighted = highlightLocs.includes(loc.id)
                                const isSelected = selectedLocId === loc.id
                                return (
                                    <div
                                        key={loc.id}
                                        onMouseDown={e => {
                                            if (editMode && tool === 'select') {
                                                e.stopPropagation()
                                                setDragLoc({ id: loc.id, startX: e.clientX, startY: e.clientY, origX: loc.posX, origY: loc.posY })
                                            }
                                        }}
                                        onClick={e => { e.stopPropagation(); setSelectedLocId(loc.id === selectedLocId ? null : loc.id) }}
                                        className="absolute transition-shadow"
                                        style={{
                                            left: loc.posX, top: loc.posY,
                                            width: loc.width, height: loc.height,
                                            background: oc.fill,
                                            border: `2px solid ${isSelected ? '#3b82f6' : isHighlighted ? '#f59e0b' : oc.border}`,
                                            borderRadius: 8,
                                            zIndex: isSelected ? 20 : isHighlighted ? 15 : 10,
                                            cursor: editMode && tool === 'select' ? 'move' : 'pointer',
                                            boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,0.3)' :
                                                isHighlighted ? '0 0 0 3px rgba(245,158,11,0.3), 0 0 12px rgba(245,158,11,0.2)' :
                                                    '0 1px 3px rgba(0,0,0,0.06)',
                                            padding: '6px 8px',
                                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                            userSelect: 'none',
                                        }}
                                    >
                                        {/* Top: code */}
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold" style={{ color: '#1e293b', letterSpacing: 0.3 }}>
                                                {loc.locationCode}
                                            </span>
                                            {loc.tempControlled && (
                                                <span className="text-[9px]" title="Kiểm soát nhiệt độ">❄️</span>
                                            )}
                                        </div>
                                        {/* Occupancy bar */}
                                        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#e2e8f0', marginTop: 3 }}>
                                            <div style={{ width: `${loc.occupancyPct}%`, height: '100%', background: oc.dot, borderRadius: 99, transition: 'width 0.3s' }} />
                                        </div>
                                        {/* Bottom: qty */}
                                        <div className="flex items-center justify-between" style={{ marginTop: 3 }}>
                                            <span className="text-[10px] font-medium" style={{ color: oc.text }}>
                                                {loc.totalQty > 0 ? formatNumber(loc.totalQty) : '—'}
                                            </span>
                                            <span className="text-[9px] font-semibold" style={{ color: oc.text }}>
                                                {loc.occupancyPct}%
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Wall drawing helper text */}
                    {wallDrawing && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-medium z-50"
                            style={{ background: '#3b82f6', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
                            Click để đặt điểm cuối tường • ESC để hủy
                        </div>
                    )}
                </div>

                {/* Right panel — Legend + Selected details */}
                <div className="flex flex-col gap-4 p-4 overflow-y-auto" style={{ width: 240, background: '#f8fafc', borderLeft: '1px solid #e2e8f0' }}>
                    {/* Legend */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Chú thích</h4>
                        <div className="space-y-1.5">
                            {[
                                { label: 'Trống', pct: 0 },
                                { label: 'Thấp (1-40%)', pct: 10 },
                                { label: 'Trung bình (40-70%)', pct: 50 },
                                { label: 'Cao (70-90%)', pct: 80 },
                                { label: 'Đầy (>90%)', pct: 95 },
                            ].map(item => {
                                const c = occColor(item.pct)
                                return (
                                    <div key={item.label} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm" style={{ background: c.fill, border: `1.5px solid ${c.border}` }} />
                                        <span className="text-[11px]" style={{ color: '#475569' }}>{item.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Floor plan legend */}
                        {editMode && (
                            <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: '#e2e8f0' }}>
                                <div className="flex items-center gap-2">
                                    <div style={{ width: 16, height: 4, background: '#334155', borderRadius: 2 }} />
                                    <span className="text-[11px]" style={{ color: '#475569' }}>Tường</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div style={{ width: 16, height: 6, background: '#fbbf24', borderRadius: 2 }} />
                                    <span className="text-[11px]" style={{ color: '#475569' }}>Cửa</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Zones */}
                    {zones.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Zones</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {zones.map(z => (
                                    <span key={z} className="px-2 py-0.5 rounded text-[11px] font-bold"
                                        style={{ background: ZONE_COLORS[z] ?? '#6b7280', color: '#fff' }}>
                                        {z}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    {mapData && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                                <p className="text-lg font-bold" style={{ color: '#1e293b' }}>{locations.length}</p>
                                <p className="text-[10px]" style={{ color: '#94a3b8' }}>Vị trí</p>
                            </div>
                            <div className="p-2 rounded-lg text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                                <p className="text-lg font-bold" style={{ color: '#1e293b' }}>{formatNumber(locations.reduce((s, l) => s + l.totalQty, 0))}</p>
                                <p className="text-[10px]" style={{ color: '#94a3b8' }}>Tổng chai</p>
                            </div>
                        </div>
                    )}

                    {/* Search results */}
                    {searchResults.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Kết quả</h4>
                                <button onClick={() => { setSearchResults([]); setHighlightLocs([]); setSearchTerm('') }}
                                    className="p-0.5 rounded hover:bg-gray-200"><X size={12} style={{ color: '#94a3b8' }} /></button>
                            </div>
                            <div className="space-y-1.5">
                                {searchResults.map(r => (
                                    <div key={r.skuCode} className="p-2 rounded-lg" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                                        <p className="text-[11px] font-bold truncate" style={{ color: '#1e293b' }}>{r.skuCode}</p>
                                        <p className="text-[10px] truncate" style={{ color: '#64748b' }}>{r.productName}</p>
                                        <p className="text-[10px] mt-0.5" style={{ color: '#f59e0b' }}>{formatNumber(r.totalQty)} chai • {r.locationIds.length} vị trí</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selected location detail */}
                    {selectedLoc && (
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>Chi tiết vị trí</h4>
                            <div className="p-3 rounded-lg space-y-2" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                                <p className="text-sm font-bold" style={{ color: '#1e293b' }}>{selectedLoc.locationCode}</p>
                                <div className="grid grid-cols-2 gap-1 text-[11px]">
                                    <span style={{ color: '#94a3b8' }}>Zone:</span>
                                    <span className="font-semibold" style={{ color: '#1e293b' }}>{selectedLoc.zone}</span>
                                    <span style={{ color: '#94a3b8' }}>Rack:</span>
                                    <span className="font-semibold" style={{ color: '#1e293b' }}>{selectedLoc.rack ?? '—'}</span>
                                    <span style={{ color: '#94a3b8' }}>Bin:</span>
                                    <span className="font-semibold" style={{ color: '#1e293b' }}>{selectedLoc.bin ?? '—'}</span>
                                    <span style={{ color: '#94a3b8' }}>Loại:</span>
                                    <span className="font-semibold" style={{ color: '#1e293b' }}>{selectedLoc.type}</span>
                                    <span style={{ color: '#94a3b8' }}>Chiếm:</span>
                                    <span className="font-semibold" style={{ color: occColor(selectedLoc.occupancyPct).text }}>{selectedLoc.occupancyPct}%</span>
                                </div>
                                {selectedLoc.products.length > 0 && (
                                    <div className="pt-2 border-t space-y-1" style={{ borderColor: '#f1f5f9' }}>
                                        <p className="text-[10px] font-semibold uppercase" style={{ color: '#94a3b8' }}>Sản phẩm trong kệ</p>
                                        {selectedLoc.products.slice(0, 5).map((p, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <Package size={10} style={{ color: '#94a3b8' }} />
                                                <span className="text-[10px] truncate flex-1" style={{ color: '#475569' }}>{p.skuCode}</span>
                                                <span className="text-[10px] font-bold" style={{ color: '#1e293b' }}>{formatNumber(p.qtyAvailable)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Keyboard shortcuts for wall tool */}
            {editMode && (
                <div className="sr-only" tabIndex={0}
                    onKeyDown={e => {
                        if (e.key === 'Escape') { setWallDrawing(null); setTool('select') }
                    }} />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
                    style={{
                        background: toast.type === 'ok' ? '#10b981' : '#ef4444',
                        color: '#fff',
                    }}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}
