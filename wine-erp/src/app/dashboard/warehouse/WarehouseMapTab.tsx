'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
    Search, MapPin, Loader2, Save, RotateCcw, Move, Lock, Unlock,
    Maximize2, Thermometer, Package, ZoomIn, ZoomOut, Grid3x3,
    X, AlertCircle, CheckCircle2, Eye
} from 'lucide-react'
import {
    MapLocation, MapWarehouse,
    getWarehouseMapData, saveWarehouseLayout, autoLayoutWarehouse, searchProductLocations
} from './actions-map'
import { formatNumber } from '@/lib/utils'

interface WarehouseOption {
    id: string
    code: string
    name: string
}

// ── Color helpers ─────────────────────────────────
function getOccupancyColor(pct: number): string {
    if (pct >= 90) return '#C74B50'
    if (pct >= 70) return '#D4A853'
    if (pct >= 40) return '#5BA88A'
    if (pct > 0) return '#4A8FAB'
    return '#2A4355'
}

function getOccupancyBg(pct: number): string {
    if (pct >= 90) return 'rgba(199,75,80,0.15)'
    if (pct >= 70) return 'rgba(212,168,83,0.12)'
    if (pct >= 40) return 'rgba(91,168,138,0.12)'
    if (pct > 0) return 'rgba(74,143,171,0.1)'
    return 'rgba(42,67,85,0.2)'
}

const LOC_TYPE_ICON: Record<string, { emoji: string; label: string }> = {
    STORAGE: { emoji: '📦', label: 'Kệ' },
    RECEIVING: { emoji: '📥', label: 'Khu Nhận' },
    SHIPPING: { emoji: '📤', label: 'Khu Xuất' },
    QUARANTINE: { emoji: '⚠️', label: 'Cách Ly' },
    VIRTUAL: { emoji: '☁️', label: 'Ảo' },
}

export function WarehouseMapTab({
    warehouses,
    isAdmin,
}: {
    warehouses: WarehouseOption[]
    isAdmin: boolean
}) {
    const [selectedWH, setSelectedWH] = useState('')
    const [mapData, setMapData] = useState<MapWarehouse | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
    const [searchResults, setSearchResults] = useState<{ productName: string; skuCode: string; totalQty: number; locationIds: string[] }[]>([])
    const [hoveredLoc, setHoveredLoc] = useState<MapLocation | null>(null)
    const [selectedLoc, setSelectedLoc] = useState<MapLocation | null>(null)
    const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

    // Canvas pan/zoom
    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isPanning, setIsPanning] = useState(false)
    const panStart = useRef({ x: 0, y: 0 })
    const canvasRef = useRef<HTMLDivElement>(null)

    // Drag state (edit mode)
    const [dragging, setDragging] = useState<string | null>(null)
    const dragOffset = useRef({ x: 0, y: 0 })

    // Modified positions (local state before save)
    const [localPositions, setLocalPositions] = useState<Map<string, { posX: number; posY: number; width: number; height: number }>>(new Map())
    const [hasChanges, setHasChanges] = useState(false)

    // ── Load warehouse map data ───────────────────
    const loadMap = async (whId: string) => {
        setSelectedWH(whId)
        setLoading(true)
        setHighlightedIds(new Set())
        setSearchResults([])
        setSearchTerm('')
        setSelectedLoc(null)
        setLocalPositions(new Map())
        setHasChanges(false)
        try {
            const data = await getWarehouseMapData(whId)
            setMapData(data)
            if (data) {
                const posMap = new Map<string, { posX: number; posY: number; width: number; height: number }>()
                data.locations.forEach(loc => {
                    posMap.set(loc.id, { posX: loc.posX, posY: loc.posY, width: loc.width, height: loc.height })
                })
                setLocalPositions(posMap)
            }
        } finally {
            setLoading(false)
        }
    }

    // ── Get effective position ────────────────────
    const getPos = (loc: MapLocation) => {
        const local = localPositions.get(loc.id)
        return local ?? { posX: loc.posX, posY: loc.posY, width: loc.width, height: loc.height }
    }

    // ── Auto layout ──────────────────────────────
    const handleAutoLayout = async () => {
        if (!selectedWH) return
        setSaving(true)
        const result = await autoLayoutWarehouse(selectedWH)
        if (result.success) {
            await loadMap(selectedWH)
            showToast('ok', 'Đã tự động sắp xếp sơ đồ kho')
        } else {
            showToast('err', result.error || 'Lỗi')
        }
        setSaving(false)
    }

    // ── Save positions ──────────────────────────
    const handleSave = async () => {
        if (!selectedWH || !hasChanges) return
        setSaving(true)
        const layouts = Array.from(localPositions.entries()).map(([id, pos]) => ({
            id,
            posX: pos.posX,
            posY: pos.posY,
            width: pos.width,
            height: pos.height,
        }))
        const result = await saveWarehouseLayout(selectedWH, layouts)
        if (result.success) {
            setHasChanges(false)
            showToast('ok', `Đã lưu ${result.updatedCount} vị trí`)
        } else {
            showToast('err', result.error || 'Lỗi')
        }
        setSaving(false)
    }

    // ── Drag handlers (edit mode) ────────────────
    const handleMouseDown = (e: React.MouseEvent, locId: string) => {
        if (!editMode) return
        e.preventDefault()
        e.stopPropagation()
        const pos = localPositions.get(locId)
        if (!pos) return
        setDragging(locId)
        const canvasRect = canvasRef.current?.getBoundingClientRect()
        if (!canvasRect) return
        dragOffset.current = {
            x: (e.clientX - canvasRect.left) / zoom - pan.x - pos.posX,
            y: (e.clientY - canvasRect.top) / zoom - pan.y - pos.posY,
        }
    }

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (dragging && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect()
            const newX = (e.clientX - canvasRect.left) / zoom - pan.x - dragOffset.current.x
            const newY = (e.clientY - canvasRect.top) / zoom - pan.y - dragOffset.current.y
            setLocalPositions(prev => {
                const next = new Map(prev)
                const existing = next.get(dragging)
                if (existing) {
                    next.set(dragging, { ...existing, posX: Math.round(newX), posY: Math.round(newY) })
                }
                return next
            })
            setHasChanges(true)
        } else if (isPanning && canvasRef.current) {
            const dx = (e.clientX - panStart.current.x) / zoom
            const dy = (e.clientY - panStart.current.y) / zoom
            panStart.current = { x: e.clientX, y: e.clientY }
            setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
        }
    }, [dragging, isPanning, zoom, pan.x, pan.y])

    const handleMouseUp = useCallback(() => {
        setDragging(null)
        setIsPanning(false)
    }, [])

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [handleMouseMove, handleMouseUp])

    // Canvas pan via middle click or background drag
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (dragging) return
        if (e.target === canvasRef.current || (e.target as HTMLElement).dataset?.canvas) {
            setIsPanning(true)
            panStart.current = { x: e.clientX, y: e.clientY }
        }
    }

    // Zoom with scroll
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(prev => Math.min(3, Math.max(0.3, prev + delta)))
    }

    // ── Search product locations ─────────────────
    let searchTimer: any
    const handleSearch = (val: string) => {
        setSearchTerm(val)
        clearTimeout(searchTimer)
        if (val.length < 2) {
            setHighlightedIds(new Set())
            setSearchResults([])
            return
        }
        searchTimer = setTimeout(async () => {
            if (!selectedWH) return
            const results = await searchProductLocations(selectedWH, val)
            setSearchResults(results)
            const ids = new Set<string>()
            results.forEach(r => r.locationIds.forEach(id => ids.add(id)))
            setHighlightedIds(ids)
        }, 300)
    }

    const showToast = (type: 'ok' | 'err', msg: string) => {
        setToast({ type, msg })
        setTimeout(() => setToast(null), 3000)
    }

    // ── Compute zone groups for legend ───────────
    const zones = mapData ? Array.from(new Set(mapData.locations.map(l => l.zone))).sort() : []

    const ZONE_COLORS: Record<string, string> = {}
    const PALETTE = ['#87CBB9', '#D4A853', '#4A8FAB', '#C74B50', '#5BA88A', '#B87333', '#7AC4C4', '#D4607A']
    zones.forEach((z, i) => { ZONE_COLORS[z] = PALETTE[i % PALETTE.length] })

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-3 flex-wrap p-4 rounded-xl" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                {/* Warehouse select */}
                <select value={selectedWH} onChange={e => e.target.value && loadMap(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm outline-none min-w-[180px]"
                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: selectedWH ? '#E8F1F2' : '#4A6A7A' }}>
                    <option value="">Chọn Kho...</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                </select>

                {/* Search */}
                {selectedWH && (
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                        <input placeholder="Gõ SKU/tên để tìm vị trí..." value={searchTerm} onChange={e => handleSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                            style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }} />
                    </div>
                )}

                <div className="flex-1" />

                {/* Zoom controls */}
                {selectedWH && (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.2))} className="p-1.5 rounded-lg" style={{ background: '#1B2E3D', color: '#8AAEBB' }}><ZoomOut size={14} /></button>
                        <span className="text-xs w-10 text-center" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(prev => Math.min(3, prev + 0.2))} className="p-1.5 rounded-lg" style={{ background: '#1B2E3D', color: '#8AAEBB' }}><ZoomIn size={14} /></button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="p-1.5 rounded-lg" style={{ background: '#1B2E3D', color: '#8AAEBB' }} title="Reset"><Maximize2 size={14} /></button>
                    </div>
                )}

                {/* Admin controls */}
                {isAdmin && selectedWH && (
                    <div className="flex items-center gap-2 ml-2 pl-2" style={{ borderLeft: '1px solid #2A4355' }}>
                        <button onClick={() => setEditMode(prev => !prev)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                            style={{
                                background: editMode ? 'rgba(212,168,83,0.15)' : '#1B2E3D',
                                color: editMode ? '#D4A853' : '#8AAEBB',
                                border: `1px solid ${editMode ? '#D4A853' : '#2A4355'}`,
                            }}>
                            {editMode ? <Unlock size={12} /> : <Lock size={12} />}
                            {editMode ? 'Đang Sửa' : 'Chỉnh Sửa'}
                        </button>

                        {editMode && (
                            <>
                                <button onClick={handleAutoLayout} disabled={saving}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                                    style={{ background: '#1B2E3D', color: '#4A8FAB', border: '1px solid #2A4355' }}>
                                    <Grid3x3 size={12} /> Auto
                                </button>
                                <button onClick={handleSave} disabled={saving || !hasChanges}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold"
                                    style={{
                                        background: hasChanges ? '#87CBB9' : '#1B2E3D',
                                        color: hasChanges ? '#0A1926' : '#4A6A7A',
                                        border: `1px solid ${hasChanges ? '#87CBB9' : '#2A4355'}`,
                                    }}>
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Lưu
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Search results panel */}
            {searchResults.length > 0 && (
                <div className="flex gap-2 flex-wrap px-2">
                    {searchResults.map(r => (
                        <div key={r.skuCode} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                            style={{ background: 'rgba(135,203,185,0.1)', border: '1px solid rgba(135,203,185,0.3)' }}>
                            <Package size={12} style={{ color: '#87CBB9' }} />
                            <span className="font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{r.skuCode}</span>
                            <span style={{ color: '#8AAEBB' }}>{r.productName.slice(0, 30)}</span>
                            <span className="font-bold" style={{ color: '#5BA88A' }}>{r.totalQty.toLocaleString()} chai</span>
                            <span style={{ color: '#4A6A7A' }}>({r.locationIds.length} vị trí)</span>
                        </div>
                    ))}
                    <button onClick={() => { setSearchTerm(''); setHighlightedIds(new Set()); setSearchResults([]) }}
                        className="px-2 py-1 rounded-lg text-xs" style={{ color: '#4A6A7A' }}>
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Main map area */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={28} className="animate-spin" style={{ color: '#87CBB9' }} />
                </div>
            ) : !selectedWH ? (
                <div className="flex flex-col items-center py-24 gap-4 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.08)' }}>
                        <MapPin size={28} style={{ color: '#2A4355' }} />
                    </div>
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Chọn kho để xem sơ đồ 2D</p>
                </div>
            ) : mapData && mapData.locations.length === 0 ? (
                <div className="flex flex-col items-center py-24 gap-4 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                    <Grid3x3 size={28} style={{ color: '#2A4355' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Kho chưa có vị trí nào. Vui lòng tạo Location trước.</p>
                </div>
            ) : mapData ? (
                <div className="grid grid-cols-12 gap-4">
                    {/* Canvas */}
                    <div className="col-span-12 lg:col-span-9">
                        <div ref={canvasRef}
                            className="rounded-2xl overflow-hidden relative"
                            style={{
                                background: '#0A1420',
                                border: `2px solid ${editMode ? '#D4A853' : '#2A4355'}`,
                                height: 'calc(100vh - 340px)',
                                minHeight: 500,
                                cursor: editMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
                                // 2D grid background
                                backgroundImage: 'linear-gradient(rgba(42,67,85,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(42,67,85,0.15) 1px, transparent 1px)',
                                backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                                backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`,
                            }}
                            onMouseDown={handleCanvasMouseDown}
                            onWheel={handleWheel}
                            data-canvas="true"
                        >
                            {/* Zone labels */}
                            {zones.map(zone => {
                                const zoneLocs = mapData.locations.filter(l => l.zone === zone)
                                if (zoneLocs.length === 0) return null
                                const positions = zoneLocs.map(l => getPos(l))
                                const minX = Math.min(...positions.map(p => p.posX)) - 10
                                const minY = Math.min(...positions.map(p => p.posY)) - 28
                                return (
                                    <div key={`zone-${zone}`}
                                        className="absolute text-[10px] font-bold uppercase tracking-widest pointer-events-none select-none"
                                        style={{
                                            left: (minX + pan.x) * zoom,
                                            top: (minY + pan.y) * zoom,
                                            color: ZONE_COLORS[zone] || '#4A6A7A',
                                            opacity: 0.7,
                                            transform: `scale(${zoom})`,
                                            transformOrigin: 'top left',
                                        }}>
                                        Zone {zone}
                                    </div>
                                )
                            })}

                            {/* Location blocks */}
                            {mapData.locations.map(loc => {
                                const pos = getPos(loc)
                                const isHighlighted = highlightedIds.has(loc.id)
                                const isHovered = hoveredLoc?.id === loc.id
                                const isSelected = selectedLoc?.id === loc.id
                                const isDragged = dragging === loc.id
                                const typeCfg = LOC_TYPE_ICON[loc.type] || { emoji: '📦', label: loc.type }
                                const occColor = getOccupancyColor(loc.occupancyPct)
                                const occBg = getOccupancyBg(loc.occupancyPct)

                                return (
                                    <div
                                        key={loc.id}
                                        className="absolute rounded-lg transition-shadow select-none"
                                        style={{
                                            left: (pos.posX + pan.x) * zoom,
                                            top: (pos.posY + pan.y) * zoom,
                                            width: pos.width * zoom,
                                            height: pos.height * zoom,
                                            background: isHighlighted
                                                ? 'rgba(135,203,185,0.25)'
                                                : isSelected
                                                    ? 'rgba(74,143,171,0.2)'
                                                    : occBg,
                                            border: `${zoom > 0.5 ? 1.5 : 1}px solid ${isHighlighted
                                                ? '#87CBB9'
                                                : isSelected
                                                    ? '#4A8FAB'
                                                    : isDragged
                                                        ? '#D4A853'
                                                        : isHovered
                                                            ? '#8AAEBB'
                                                            : 'rgba(42,67,85,0.5)'}`,
                                            boxShadow: isHighlighted
                                                ? '0 0 12px rgba(135,203,185,0.4)'
                                                : isDragged
                                                    ? '0 4px 20px rgba(0,0,0,0.5)'
                                                    : isHovered
                                                        ? '0 2px 8px rgba(0,0,0,0.3)'
                                                        : 'none',
                                            cursor: editMode ? (isDragged ? 'grabbing' : 'grab') : 'pointer',
                                            zIndex: isDragged ? 100 : isHighlighted ? 50 : isHovered ? 40 : 1,
                                            transition: isDragged ? 'none' : 'border-color 0.15s, box-shadow 0.15s',
                                        }}
                                        onMouseDown={e => editMode ? handleMouseDown(e, loc.id) : null}
                                        onMouseEnter={() => setHoveredLoc(loc)}
                                        onMouseLeave={() => setHoveredLoc(null)}
                                        onClick={e => { if (!editMode) { e.stopPropagation(); setSelectedLoc(loc) } }}
                                    >
                                        {/* Content visible at sufficient zoom */}
                                        {zoom >= 0.5 && (
                                            <div className="p-1 h-full flex flex-col justify-between overflow-hidden"
                                                style={{ transform: `scale(${Math.min(1, zoom)})`, transformOrigin: 'top left' }}>
                                                {/* Header */}
                                                <div className="flex items-center justify-between gap-0.5">
                                                    <span className="text-[9px] font-bold truncate" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>
                                                        {loc.locationCode}
                                                    </span>
                                                    {loc.tempControlled && <Thermometer size={8} style={{ color: '#4A8FAB', flexShrink: 0 }} />}
                                                </div>
                                                {/* Occupancy bar */}
                                                <div>
                                                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(42,67,85,0.5)' }}>
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${loc.occupancyPct}%`, background: occColor }} />
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5">
                                                        <span className="text-[8px]" style={{ color: '#4A6A7A' }}>{typeCfg.emoji}</span>
                                                        <span className="text-[8px] font-bold" style={{ color: occColor, fontFamily: '"DM Mono", monospace' }}>
                                                            {loc.totalQty > 0 ? loc.totalQty : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Highlight pulse animation */}
                                        {isHighlighted && (
                                            <div className="absolute inset-0 rounded-lg animate-pulse pointer-events-none"
                                                style={{ border: '2px solid #87CBB9', opacity: 0.6 }} />
                                        )}
                                    </div>
                                )
                            })}

                            {/* Edit mode indicator */}
                            {editMode && (
                                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                    style={{ background: 'rgba(212,168,83,0.2)', color: '#D4A853', border: '1px solid rgba(212,168,83,0.4)', zIndex: 200 }}>
                                    <Move size={12} /> Kéo thả để di chuyển vị trí
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right panel — Legend + Detail */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
                        {/* Legend */}
                        <div className="p-4 rounded-xl space-y-3" style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}>
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Chú Thích</p>
                            <div className="space-y-2">
                                {[
                                    { label: 'Trống', color: '#2A4355', pct: '0%' },
                                    { label: 'Thấp', color: '#4A8FAB', pct: '1-40%' },
                                    { label: 'Trung bình', color: '#5BA88A', pct: '40-70%' },
                                    { label: 'Cao', color: '#D4A853', pct: '70-90%' },
                                    { label: 'Đầy', color: '#C74B50', pct: '>90%' },
                                ].map(l => (
                                    <div key={l.label} className="flex items-center gap-2">
                                        <div className="w-4 h-3 rounded" style={{ background: l.color }} />
                                        <span className="text-xs flex-1" style={{ color: '#8AAEBB' }}>{l.label}</span>
                                        <span className="text-[10px] font-mono" style={{ color: '#4A6A7A' }}>{l.pct}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Zone colors */}
                            <div className="pt-2" style={{ borderTop: '1px solid #2A4355' }}>
                                <p className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#4A6A7A' }}>Zone</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {zones.map(z => (
                                        <span key={z} className="text-[10px] font-bold px-2 py-0.5 rounded"
                                            style={{ color: ZONE_COLORS[z], background: `${ZONE_COLORS[z]}15` }}>
                                            {z}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            {/* Stats */}
                            <div className="pt-2" style={{ borderTop: '1px solid #2A4355' }}>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="text-center">
                                        <p className="text-lg font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{mapData.locations.length}</p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Vị trí</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold" style={{ color: '#D4A853', fontFamily: '"DM Mono", monospace' }}>
                                            {formatNumber(mapData.locations.reduce((sum, l) => sum + l.totalQty, 0))}
                                        </p>
                                        <p className="text-[10px]" style={{ color: '#4A6A7A' }}>Tổng chai</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Selected location detail */}
                        {selectedLoc && (
                            <div className="p-4 rounded-xl space-y-3" style={{ background: '#0D1E2B', border: '1px solid #4A8FAB' }}>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>
                                        <MapPin size={12} className="inline mr-1" />{selectedLoc.locationCode}
                                    </span>
                                    <button onClick={() => setSelectedLoc(null)} style={{ color: '#4A6A7A' }}><X size={14} /></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div><span style={{ color: '#4A6A7A' }}>Zone:</span> <span style={{ color: '#E8F1F2' }}>{selectedLoc.zone}</span></div>
                                    <div><span style={{ color: '#4A6A7A' }}>Rack:</span> <span style={{ color: '#E8F1F2' }}>{selectedLoc.rack || '—'}</span></div>
                                    <div><span style={{ color: '#4A6A7A' }}>Bin:</span> <span style={{ color: '#E8F1F2' }}>{selectedLoc.bin || '—'}</span></div>
                                    <div><span style={{ color: '#4A6A7A' }}>Loại:</span> <span style={{ color: '#E8F1F2' }}>{LOC_TYPE_ICON[selectedLoc.type]?.label || selectedLoc.type}</span></div>
                                    <div><span style={{ color: '#4A6A7A' }}>Chiếm dụng:</span> <span style={{ color: getOccupancyColor(selectedLoc.occupancyPct) }}>{selectedLoc.occupancyPct}%</span></div>
                                    {selectedLoc.tempControlled && (
                                        <div className="col-span-2"><Thermometer size={10} className="inline mr-1" style={{ color: '#4A8FAB' }} /><span style={{ color: '#4A8FAB' }}>Kiểm soát nhiệt độ</span></div>
                                    )}
                                </div>
                                {/* Products in location */}
                                {selectedLoc.products.length > 0 && (
                                    <div className="pt-2 space-y-1.5" style={{ borderTop: '1px solid #2A4355' }}>
                                        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Sản Phẩm Trong Kệ</p>
                                        {selectedLoc.products.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded"
                                                style={{ background: '#142433' }}>
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{p.skuCode}</span>
                                                    <p className="text-[10px] truncate" style={{ color: '#8AAEBB' }}>{p.productName}</p>
                                                </div>
                                                <span className="font-bold ml-2 flex-shrink-0" style={{ color: '#5BA88A', fontFamily: '"DM Mono", monospace' }}>
                                                    {p.qtyAvailable.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Hovered tooltip */}
                        {hoveredLoc && !selectedLoc && (
                            <div className="p-3 rounded-xl" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{hoveredLoc.locationCode}</span>
                                    <span className="text-[10px]" style={{ color: '#4A6A7A' }}>Zone {hoveredLoc.zone}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span style={{ color: getOccupancyColor(hoveredLoc.occupancyPct) }}>{hoveredLoc.occupancyPct}% chiếm dụng</span>
                                    <span style={{ color: '#8AAEBB' }}>{hoveredLoc.totalQty} chai</span>
                                    <span style={{ color: '#4A6A7A' }}>{hoveredLoc.stockCount} lô</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{
                        background: toast.type === 'ok' ? 'rgba(91,168,138,0.15)' : 'rgba(199,75,80,0.15)',
                        border: `1px solid ${toast.type === 'ok' ? '#5BA88A' : '#C74B50'}`,
                        color: toast.type === 'ok' ? '#5BA88A' : '#C74B50',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}>
                    {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    )
}
