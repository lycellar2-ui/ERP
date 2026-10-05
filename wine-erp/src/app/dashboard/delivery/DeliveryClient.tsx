'use client'

import { useState, useCallback, useRef } from 'react'
import { Truck, MapPin, CheckCircle2, Clock, Plus, X, Save, AlertCircle, ChevronDown, Camera, AlertTriangle, RotateCcw, Phone } from 'lucide-react'
import {
    DeliveryRouteRow, DriverOption, VehicleOption, RouteStopRow,
    getDeliveryRoutes, updateRouteStatus, createDeliveryRoute, getDriversAndVehicles,
    getRouteStops, recordEPOD, uploadPODPhoto,
    getFailedDeliveries, FailedDeliveryRow
} from './actions'
import { SignaturePad } from '@/components/SignaturePad'
import { formatVND, formatDate, cn } from '@/lib/utils'
import {
    Badge, Button, Card, PageHeader, StatCard, StatGrid, StatusBadge, Drawer, EmptyState, Skeleton,
    Field, Input, Select, Textarea, Toolbar,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow, TableSkeleton,
} from '@/components/ui'

const STATUS_LABEL: Record<string, string> = {
    PLANNED: 'Đã Lập Kế Hoạch',
    IN_PROGRESS: 'Đang Giao',
    COMPLETED: 'Hoàn Thành',
    CANCELLED: 'Huỷ',
}
const ROUTE_TONES = { PLANNED: 'neutral', IN_PROGRESS: 'warning' } as const

const NEXT_STATUS: Record<string, string> = {
    PLANNED: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
}

const VEHICLE_LABEL: Record<string, string> = {
    MOTORCYCLE: '🛵 Xe Máy',
    VAN: '🚐 Xe Van',
    TRUCK_1T: '🚚 Tải 1T',
    TRUCK_2T: '🚚 Tải 2T',
    REFRIGERATED: '❄️ Lạnh',
}

const STOP_LABEL: Record<string, string> = {
    PENDING: 'Chờ Giao',
    DELIVERED: 'Đã Giao',
    FAILED: 'Thất Bại',
}

const FAILURE_LABEL: Record<string, string> = {
    CUSTOMER_ABSENT: 'Vắng Nhà',
    WRONG_ADDRESS: 'Sai Địa Chỉ',
    REFUSED: 'Từ Chối Nhận',
    DAMAGED: 'Hàng Hỏng',
}

// ── E-POD Drawer — Confirm delivery at each stop ──────────
function EPODDrawer({ open, routeId, onClose }: {
    open: boolean; routeId: string | null; onClose: () => void
}) {
    const [stops, setStops] = useState<RouteStopRow[]>([])
    const [loading, setLoading] = useState(false)
    const [confirmingId, setConfirmingId] = useState<string | null>(null)
    const [confirmName, setConfirmName] = useState('')
    const [confirmNotes, setConfirmNotes] = useState('')
    const [signatureUrl, setSignatureUrl] = useState('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [activeStopId, setActiveStopId] = useState<string | null>(null)
    const [successId, setSuccessId] = useState<string | null>(null)

    const loadStops = useCallback(async () => {
        if (!routeId) return
        setLoading(true)
        const data = await getRouteStops(routeId)
        setStops(data)
        setLoading(false)
    }, [routeId])

    if (!open || !routeId) return null
    if (stops.length === 0 && !loading) { loadStops() }

    const handleConfirm = async (stopId: string) => {
        if (!confirmName.trim()) return
        setConfirmingId(stopId)

        // Upload photo if selected
        let photoUrl: string | undefined
        if (photoFile) {
            setUploadingPhoto(true)
            const formData = new FormData()
            formData.set('file', photoFile)
            const uploadResult = await uploadPODPhoto(stopId, formData)
            setUploadingPhoto(false)
            if (uploadResult.success) photoUrl = uploadResult.photoUrl
        }

        const result = await recordEPOD({
            stopId,
            confirmedBy: confirmName.trim(),
            notes: confirmNotes.trim() || undefined,
            signatureUrl: signatureUrl || undefined,
            photoUrl,
        })
        if (result.success) {
            setSuccessId(stopId)
            setActiveStopId(null)
            setConfirmName('')
            setConfirmNotes('')
            setSignatureUrl('')
            setPhotoFile(null)
            setPhotoPreview(null)
            await loadStops()
            setTimeout(() => setSuccessId(null), 2000)
        }
        setConfirmingId(null)
    }

    const deliveredCount = stops.filter(s => s.status === 'DELIVERED').length

    return (
        <Drawer
            open
            onClose={onClose}
            title="E-POD — Xác Nhận Giao Hàng"
            description="Xác nhận từng điểm dừng — Tên người nhận, ghi chú"
            size="sm"
            footer={stops.length > 0 ? (
                <div className="flex items-center gap-4 w-full">
                    <span className="type-caption whitespace-nowrap">{deliveredCount}/{stops.length} điểm đã giao</span>
                    <div className="flex-1 h-1.5 rounded-full bg-lys-subtle overflow-hidden">
                        <div className="h-full rounded-full bg-tone-success-fg transition-all duration-500"
                            style={{ width: `${(deliveredCount / stops.length) * 100}%` }} />
                    </div>
                </div>
            ) : undefined}
        >
            <div className="flex flex-col gap-3">
                {loading ? (
                    <>
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </>
                ) : stops.length === 0 ? (
                    <EmptyState icon={MapPin} title="Lộ trình chưa có điểm dừng nào" />
                ) : stops.map(stop => {
                    const isActive = activeStopId === stop.id
                    const isSuccess = successId === stop.id
                    const isDelivered = stop.status === 'DELIVERED'

                    return (
                        <div key={stop.id} className={cn(
                            'p-4 rounded-md border transition-colors',
                            isSuccess ? 'bg-tone-success-bg border-tone-success-border' : 'bg-white border-lys-border',
                        )}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
                                        isDelivered ? 'bg-tone-success-bg text-tone-success-fg' : 'bg-tone-warning-bg text-tone-warning-fg',
                                    )}>
                                        {stop.sequence}
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-lys-primary">{stop.customerName}</p>
                                            {stop.customerPhone && (
                                                <span className="type-number text-xs flex items-center gap-1 text-lys-teal-strong">
                                                    <Phone size={10} aria-hidden /> {stop.customerPhone}
                                                </span>
                                            )}
                                            {stop.receiverName && stop.receiverName !== stop.customerName && (
                                                <span className="text-[11px] text-lys-secondary">({stop.receiverName})</span>
                                            )}
                                        </div>
                                        <p className="type-caption">{stop.customerAddress || 'Không có địa chỉ'}</p>
                                    </div>
                                </div>
                                <StatusBadge status={stop.status} label={STOP_LABEL[stop.status] ?? STOP_LABEL.PENDING} />
                            </div>

                            <div className="flex items-center gap-4 mb-2 text-xs">
                                <span className="text-lys-secondary">SO: {stop.soNo}</span>
                                <span className="text-lys-muted">{stop.itemCount} dòng SP</span>
                                {stop.codAmount > 0 && (
                                    <span className="type-number font-semibold text-tone-warning-fg">COD: {formatVND(stop.codAmount)}</span>
                                )}
                            </div>

                            {isDelivered && stop.podSignedAt && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2 p-2 rounded bg-tone-success-bg text-tone-success-fg text-xs">
                                        <CheckCircle2 size={12} aria-hidden />
                                        <span>
                                            Đã xác nhận lúc {new Date(stop.podSignedAt).toLocaleString('vi-VN')}
                                            {stop.notes && ` — ${stop.notes}`}
                                        </span>
                                    </div>
                                    {((stop as any).photoUrl || stop.signatureUrl) && (
                                        <div className="flex gap-2 flex-wrap">
                                            {(stop as any).photoUrl && (
                                                <div className="relative rounded overflow-hidden border border-lys-border">
                                                    <img src={(stop as any).photoUrl} alt="POD" className="w-20 h-20 object-cover" />
                                                    <div className="absolute bottom-0 inset-x-0 text-center py-0.5 text-[10px] bg-slate-900/60 text-white">
                                                        <Camera size={8} className="inline mr-0.5" aria-hidden /> Ảnh GH
                                                    </div>
                                                </div>
                                            )}
                                            {stop.signatureUrl && (
                                                <div className="rounded overflow-hidden border border-lys-border bg-lys-subtle">
                                                    <img src={stop.signatureUrl} alt="Chữ ký" className="w-24 h-20 object-contain" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isDelivered && !isActive && (
                                <Button size="sm" variant="secondary" className="mt-1"
                                    onClick={() => { setActiveStopId(stop.id); setConfirmName(''); setConfirmNotes(''); setSignatureUrl(''); setPhotoFile(null); setPhotoPreview(null) }}>
                                    <CheckCircle2 size={12} aria-hidden /> Xác Nhận Giao
                                </Button>
                            )}

                            {isActive && (
                                <div className="mt-3 p-3 rounded-md border border-lys-border bg-lys-subtle flex flex-col gap-3">
                                    <Field label="Người Nhận" required>
                                        {id => <Input id={id} type="text" value={confirmName} onChange={e => setConfirmName(e.target.value)} placeholder="Tên người nhận hàng" />}
                                    </Field>
                                    <Field label="Ghi Chú (Tùy chọn)">
                                        {id => (
                                            <Textarea id={id} value={confirmNotes} onChange={e => setConfirmNotes(e.target.value)}
                                                placeholder="VD: Giao tại quầy bar, bàn giao cho anh Minh" rows={2} className="resize-none" />
                                        )}
                                    </Field>
                                    <Field label="Chữ Ký Điện Tử" required>
                                        {() => <SignaturePad onEnd={url => setSignatureUrl(url)} />}
                                    </Field>
                                    <Field label="Ảnh Bằng Chứng Giao Hàng">
                                        {() => (
                                            <>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={e => {
                                                        const file = e.target.files?.[0]
                                                        if (file) {
                                                            setPhotoFile(file)
                                                            const reader = new FileReader()
                                                            reader.onload = () => setPhotoPreview(reader.result as string)
                                                            reader.readAsDataURL(file)
                                                        }
                                                    }}
                                                />
                                                {photoPreview ? (
                                                    <div className="relative rounded-md overflow-hidden border border-lys-border">
                                                        <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                                                            className="absolute top-1 right-1 p-1 rounded-full bg-white/90 text-lys-primary hover:bg-white"
                                                            aria-label="Xóa ảnh">
                                                            <X size={12} aria-hidden />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="flex items-center gap-2 w-full px-3 py-3 rounded-md text-sm bg-white border border-dashed border-lys-border-strong text-lys-muted hover:bg-lys-subtle">
                                                        <Camera size={16} aria-hidden /> Chụp ảnh / Chọn từ thư viện
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </Field>
                                    <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="secondary" onClick={() => setActiveStopId(null)}>Huỷ</Button>
                                        <Button size="sm" onClick={() => handleConfirm(stop.id)}
                                            loading={confirmingId === stop.id || uploadingPhoto}
                                            disabled={!confirmName.trim() || !signatureUrl || !!confirmingId || uploadingPhoto}>
                                            {confirmingId === stop.id || uploadingPhoto
                                                ? (uploadingPhoto ? 'Đang tải ảnh...' : 'Đang lưu...')
                                                : <><CheckCircle2 size={12} aria-hidden /> Xác Nhận</>}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </Drawer>
    )
}

// ── Create Route Drawer ────────────────────────────────────
function CreateRouteDrawer({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [form, setForm] = useState({ routeDate: new Date().toISOString().slice(0, 10), driverId: '', vehicleId: '' })
    const [options, setOptions] = useState<{ drivers: DriverOption[]; vehicles: VehicleOption[] } | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    // Load drivers & vehicles when drawer opens
    const handleOpen = useCallback(async () => {
        if (!options) {
            const data = await getDriversAndVehicles()
            setOptions(data)
        }
    }, [options])

    if (!open) return null

    // Trigger load once mounted
    if (!options) { handleOpen(); }

    const handleSave = async () => {
        if (!form.driverId || !form.vehicleId) return setError('Chọn tài xế và phương tiện')
        setSaving(true)
        const result = await createDeliveryRoute(form)
        setSaving(false)
        if (result.success) { onCreated(); onClose() }
        else setError(result.error ?? 'Lỗi tạo lộ trình')
    }

    return (
        <Drawer
            open
            onClose={onClose}
            title="Tạo Lộ Trình Mới"
            description="Chỉ định tài xế và phương tiện"
            size="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Hủy</Button>
                    <Button onClick={handleSave} loading={saving} disabled={saving}>
                        {!saving && <Save size={14} aria-hidden />}
                        {saving ? 'Đang tạo...' : 'Tạo Lộ Trình'}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                {error && (
                    <div role="alert" className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm border border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg">
                        <AlertCircle size={14} aria-hidden /> {error}
                    </div>
                )}

                <Field label="Ngày Giao" required>
                    {id => <Input id={id} type="date" value={form.routeDate} onChange={e => setForm(f => ({ ...f, routeDate: e.target.value }))} />}
                </Field>

                <Field label="Tài Xế" required>
                    {id => !options ? (
                        <Skeleton className="h-9" />
                    ) : (
                        <Select id={id} value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))}>
                            <option value="">— Chọn tài xế —</option>
                            {options.drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                            ))}
                        </Select>
                    )}
                </Field>

                <Field label="Phương Tiện" required>
                    {id => !options ? (
                        <Skeleton className="h-9" />
                    ) : (
                        <Select id={id} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                            <option value="">— Chọn phương tiện —</option>
                            {options.vehicles.map(v => (
                                <option key={v.id} value={v.id}>{VEHICLE_LABEL[v.type] ?? v.type} • {v.plateNo}</option>
                            ))}
                        </Select>
                    )}
                </Field>
            </div>
        </Drawer>
    )
}

interface Props {
    initialRows: DeliveryRouteRow[]
    initialTotal: number
    stats: { todayRoutes: number; pending: number; delivered: number; inProgress: number }
}

export function DeliveryClient({ initialRows, initialTotal, stats: initStats }: Props) {
    const [rows, setRows] = useState(initialRows)
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState('')
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [epodRouteId, setEpodRouteId] = useState<string | null>(null)
    const [failedDeliveries, setFailedDeliveries] = useState<FailedDeliveryRow[]>([])
    const [failedLoaded, setFailedLoaded] = useState(false)
    const [failedLoading, setFailedLoading] = useState(false)

    const reload = async (s?: string) => {
        setLoading(true)
        const { rows } = await getDeliveryRoutes({ status: (s ?? statusFilter) || undefined, pageSize: 20 })
        setRows(rows)
        setLoading(false)
    }

    const handleStatusAdvance = async (routeId: string, nextStatus: string) => {
        setUpdatingId(routeId)
        await updateRouteStatus(routeId, nextStatus as any)
        await reload()
        setUpdatingId(null)
    }

    const loadFailed = async () => {
        setFailedLoading(true)
        setFailedDeliveries(await getFailedDeliveries())
        setFailedLoading(false)
        setFailedLoaded(true)
    }

    return (
        <div className="flex flex-col gap-4 max-w-screen-2xl">
            <PageHeader
                description="Lộ trình giao hàng, E-POD, COD collection"
                actions={
                    <Button onClick={() => setDrawerOpen(true)}>
                        <Plus size={16} aria-hidden /> Tạo Lộ Trình
                    </Button>
                }
            />

            <StatGrid className="grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Truck} tone="brand" label="Lộ Trình Hôm Nay" value={initStats.todayRoutes} />
                <StatCard icon={MapPin} tone="warning" label="Đang Giao" value={initStats.inProgress} />
                <StatCard icon={Clock} tone="info" label="Điểm Dừng Chờ Giao" value={initStats.pending} />
                <StatCard icon={CheckCircle2} tone="success" label="Đã Giao Thành Công" value={initStats.delivered} />
            </StatGrid>

            <Toolbar
                left={
                    <Select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); reload(e.target.value) }}
                        className="w-auto min-w-[200px]"
                        aria-label="Lọc trạng thái"
                    >
                        <option value="">Tất cả trạng thái</option>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </Select>
                }
            />

            <Table>
                <THead>
                    <tr>
                        <Th>Ngày</Th>
                        <Th>Tài Xế</Th>
                        <Th>Phương Tiện</Th>
                        <Th align="right">Điểm Dừng</Th>
                        <Th>Tiến Độ</Th>
                        <Th align="right">COD</Th>
                        <Th>Trạng Thái</Th>
                        <Th aria-label="Thao tác" />
                    </tr>
                </THead>
                <TBody>
                    {loading ? (
                        <TableMessageRow colSpan={8}><TableSkeleton rows={5} cols={7} /></TableMessageRow>
                    ) : rows.length === 0 ? (
                        <TableMessageRow colSpan={8}>
                            <EmptyState icon={Truck} title="Chưa có lộ trình giao hàng nào" />
                        </TableMessageRow>
                    ) : rows.map(row => {
                        const pct = row.stopCount > 0 ? Math.round((row.deliveredCount / row.stopCount) * 100) : 0
                        const nextStatus = NEXT_STATUS[row.status]
                        const isUpdating = updatingId === row.id
                        return (
                            <Tr key={row.id} onClick={() => setEpodRouteId(row.id)}>
                                <Td className="text-lys-primary">{formatDate(row.routeDate)}</Td>
                                <Td className="text-lys-primary">{row.driverName}</Td>
                                <Td className="text-xs text-lys-secondary">
                                    {VEHICLE_LABEL[row.vehicleType] ?? row.vehicleType}<br />
                                    <span className="type-number">{row.vehiclePlate}</span>
                                </Td>
                                <Td align="right" className="type-number font-semibold text-lys-primary">{row.stopCount} điểm</Td>
                                <Td>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-lys-subtle min-w-[60px]">
                                            <div className={cn('h-full rounded-full', pct === 100 ? 'bg-tone-success-fg' : 'bg-tone-warning-fg')} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="type-number text-xs font-semibold text-lys-secondary">{row.deliveredCount}/{row.stopCount}</span>
                                    </div>
                                </Td>
                                <Td align="right" className="type-number font-semibold text-lys-primary">
                                    {row.totalCod > 0 ? formatVND(row.totalCod) : '—'}
                                </Td>
                                <Td>
                                    <StatusBadge status={row.status} label={STATUS_LABEL[row.status] ?? row.status} toneOverrides={ROUTE_TONES} />
                                </Td>
                                <Td align="right">
                                    {nextStatus && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={e => { e.stopPropagation(); handleStatusAdvance(row.id, nextStatus) }}
                                            loading={isUpdating}
                                            disabled={isUpdating}
                                        >
                                            {!isUpdating && <ChevronDown size={11} aria-hidden />}
                                            {STATUS_LABEL[nextStatus] ?? nextStatus}
                                        </Button>
                                    )}
                                </Td>
                            </Tr>
                        )
                    })}
                </TBody>
            </Table>

            <CreateRouteDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onCreated={() => reload()}
            />

            <EPODDrawer
                open={!!epodRouteId}
                routeId={epodRouteId}
                onClose={() => { setEpodRouteId(null); reload() }}
            />

            {/* Failed Deliveries Section */}
            <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-tone-warning-fg" aria-hidden />
                        <h3 className="type-section-title text-lys-primary">Giao Hàng Thất Bại</h3>
                        {failedLoaded && (
                            <Badge tone={failedDeliveries.length > 0 ? 'danger' : 'success'}>{failedDeliveries.length}</Badge>
                        )}
                    </div>
                    <Button size="sm" variant="secondary" onClick={loadFailed} loading={failedLoading} disabled={failedLoading}>
                        {failedLoading ? 'Đang tải...' : failedLoaded ? 'Làm Mới' : 'Tải Danh Sách'}
                    </Button>
                </div>

                {!failedLoaded ? (
                    <p className="type-caption text-center py-6">Nhấn &quot;Tải Danh Sách&quot; để xem các đơn giao thất bại</p>
                ) : failedDeliveries.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="Không có đơn giao thất bại nào" />
                ) : (
                    <div className="flex flex-col gap-2">
                        {failedDeliveries.map(fd => (
                            <div key={fd.stopId} className="flex items-center justify-between gap-3 p-3 rounded-md bg-white border border-tone-danger-border">
                                <div className="flex items-center gap-3">
                                    <AlertTriangle size={14} className="text-tone-danger-fg" aria-hidden />
                                    <div>
                                        <p className="text-sm font-semibold text-lys-primary">{fd.customerName}</p>
                                        <p className="type-caption">
                                            SO: {fd.soNo} • Tài xế: {fd.driverName} • {new Date(fd.failedAt).toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge tone="danger">{FAILURE_LABEL[fd.failureReason] ?? fd.failureReason}</Badge>
                                    {fd.codAmount > 0 && (
                                        <span className="type-number text-xs font-semibold text-tone-warning-fg">COD: {formatVND(fd.codAmount)}</span>
                                    )}
                                    <Button size="sm" variant="secondary">
                                        <RotateCcw size={11} aria-hidden /> Giao Lại
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    )
}
