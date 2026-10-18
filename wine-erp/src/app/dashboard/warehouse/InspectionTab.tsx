'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Thermometer, CheckCircle2, AlertTriangle, AlertCircle, Camera,
    Download, RefreshCw, Plus, Search, Filter, ShieldAlert,
    Calendar, User, Clock, Check, X, Eye, FileText, ChevronRight,
    TrendingUp, ExternalLink, ShieldCheck, MapPin, WifiOff, UploadCloud, Layers,
    UserCheck, UserPlus, Send, BellRing
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getWarehouseInspectionsAction,
    createWarehouseInspectionAction,
    approveWarehouseInspectionAction,
    exportWarehouseInspectionsExcelAction,
    syncOfflineWarehouseInspectionsAction,
    getWarehouseInspectionDetailAction,
    getWarehouseStaffUsersAction,
    assignWarehouseInspectionAction,
    sendInspectionOverdueAlertAction,
    CreateInspectionInput,
    InspectionCheckItemInput,
    InspectionPhotoInput,
    AssignInspectionInput,
} from './actions-inspection'
import { LiveCameraInspectionModal } from './LiveCameraInspectionModal'
import { WarehouseRow } from './actions'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts'

interface Props {
    warehouses: { id: string; code: string; name: string; address?: string | null }[]
    selectedWarehouseId?: string
    isAdmin?: boolean
}

type SubTab = 'daily' | 'periodic' | 'assigned' | 'incidents' | 'chart'

const OFFLINE_STORAGE_KEY = 'WAREHOUSE_INSPECTION_OFFLINE_DRAFTS_V1'

// Standard Periodic Audit Template (from So_Kiem_Tra_Dinh_Ky_Kho_Thanh_Tri.xlsx)
const DEFAULT_PERIODIC_ITEMS: InspectionCheckItemInput[] = [
    // I. Môi trường & Thiết bị bảo quản
    { category: 'ENVIRONMENT', itemCode: '1.1', itemName: 'Nhiệt độ kho', standard: 'Đúng ngưỡng quy định 20 - 22°C (ghi số)', isPassed: true, actualValue: '21.0' },
    { category: 'ENVIRONMENT', itemCode: '1.2', itemName: 'Độ ẩm kho', standard: 'Đúng ngưỡng quy định 45 - 65% (ghi số)', isPassed: true, actualValue: '55.0' },
    { category: 'ENVIRONMENT', itemCode: '1.3', itemName: 'Máy lạnh / Điều hòa', standard: 'Chạy êm, phả mát đều, không rò rỉ nước', isPassed: true, actualValue: 'Bình thường' },
    { category: 'ENVIRONMENT', itemCode: '1.4', itemName: 'Máy hút ẩm / Thông gió', standard: 'Nối ống thoát, không bị tắc, quạt gió tốt', isPassed: true, actualValue: 'Bình thường' },

    // II. An ninh & Cơ sở vật chất
    { category: 'SECURITY', itemCode: '2.1', itemName: 'Cửa chính & Ổ khóa kho', standard: 'Khóa chắc chắn, không dấu hiệu cạy phá', isPassed: true, actualValue: 'Nguyên vẹn' },
    { category: 'SECURITY', itemCode: '2.2', itemName: 'Hệ thống Camera an ninh', standard: 'Mắt cam sáng đèn, hoạt động ghi hình tốt', isPassed: true, actualValue: 'Hoạt động' },
    { category: 'SECURITY', itemCode: '2.3', itemName: 'Mái, trần & Tường kho', standard: 'Khô ráo, không dột mưa, không ẩm mốc', isPassed: true, actualValue: 'Khô ráo' },
    { category: 'SECURITY', itemCode: '2.4', itemName: 'Xung quanh bên ngoài kho', standard: 'Không có dấu hiệu cạy phá bất thường', isPassed: true, actualValue: 'Nguyên vẹn' },
    { category: 'SECURITY', itemCode: '2.5', itemName: 'Hệ thống điện & Chiếu sáng', standard: 'Đèn sáng đủ, dây gọn, aptomat an toàn', isPassed: true, actualValue: 'An toàn' },
    { category: 'SECURITY', itemCode: '2.6', itemName: 'Bình PCCC (Cứu hỏa)', standard: 'Còn hạn, kim áp suất chỉ vạch xanh', isPassed: true, actualValue: 'Đạt chuẩn' },

    // III. Tình trạng hàng hóa & Vệ sinh
    { category: 'GOODS_HYGIENE', itemCode: '3.1', itemName: 'Thùng hàng & Chai rượu', standard: 'Khô ráo, không bẹp móp, không mùi cồn vỡ', isPassed: true, actualValue: 'Nguyên vẹn' },
    { category: 'GOODS_HYGIENE', itemCode: '3.2', itemName: 'Pallet & Kệ xếp hàng', standard: 'Kê cao >= 10cm, cách tường, không nghiêng', isPassed: true, actualValue: 'Chắc chắn' },
    { category: 'GOODS_HYGIENE', itemCode: '3.3', itemName: 'Côn trùng & Chuột bọ', standard: 'Không có phân chuột, mối mọt cắn thùng/tem', isPassed: true, actualValue: 'Sạch sẽ' },
    { category: 'GOODS_HYGIENE', itemCode: '3.4', itemName: 'Vệ sinh sàn kho', standard: 'Sạch sẽ, thông thoáng, không đọng nước', isPassed: true, actualValue: 'Sạch sẽ' },
]

export function InspectionTab({ warehouses, selectedWarehouseId, isAdmin }: Props) {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('daily')
    const [warehouseId, setWarehouseId] = useState<string>(selectedWarehouseId || warehouses[0]?.id || '')
    const [inspections, setInspections] = useState<any[]>([])
    const [kpis, setKpis] = useState({
        totalInspections: 0,
        passedCount: 0,
        pendingApprovalCount: 0,
        assignedCount: 0,
        overdueCount: 0,
        incidentCount: 0,
        complianceRate: 100,
    })
    const [loading, setLoading] = useState(false)
    const [dateRange, setDateRange] = useState({
        start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    })

    // Staff & Assignment State
    const [assignedToMeOnly, setAssignedToMeOnly] = useState(false)
    const [staffFilter, setStaffFilter] = useState('ALL')
    const [staffList, setStaffList] = useState<{ id: string; name: string; email: string }[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [isUserManager, setIsUserManager] = useState<boolean>(isAdmin ?? false)

    // Assignment Modal State
    const [openAssignModal, setOpenAssignModal] = useState(false)
    const [assigning, setAssigning] = useState(false)
    const [assignForm, setAssignForm] = useState<{
        inspectionId: string
        warehouseId: string
        type: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT'
        inspectionDate: string
        shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
        assignedToId: string
        dueDate: string
        notes: string
    }>({
        inspectionId: '',
        warehouseId: selectedWarehouseId || warehouses[0]?.id || '',
        type: 'DAILY_TEMP_HUMIDITY',
        inspectionDate: new Date().toISOString().slice(0, 10),
        shift: 'MORNING',
        assignedToId: '',
        dueDate: '',
        notes: '',
    })

    // Active executing inspection for assigned task
    const [executingInspection, setExecutingInspection] = useState<any | null>(null)

    // Offline draft count
    const [offlineDrafts, setOfflineDrafts] = useState<CreateInspectionInput[]>([])
    const [syncingOffline, setSyncingOffline] = useState(false)

    // Modals
    const [openDailyModal, setOpenDailyModal] = useState(false)
    const [openPeriodicModal, setOpenPeriodicModal] = useState(false)
    const [openDetailModal, setOpenDetailModal] = useState(false)
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Camera modal state
    const [cameraOpen, setCameraOpen] = useState(false)
    const [cameraCategory, setCameraCategory] = useState<'THERMOMETER' | 'AC_COOLING' | 'CORNER' | 'INCIDENT' | 'GENERAL'>('THERMOMETER')
    const [cameraCategoryLabel, setCameraCategoryLabel] = useState('Nhiệt ẩm kế')
    const [cameraTargetContext, setCameraTargetContext] = useState<'daily' | 'periodic'>('daily')

    // Forms state
    const [dailyForm, setDailyForm] = useState<{
        shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'
        temp1: string
        temp2: string
        temp3: string
        humidity: string
        incidentNotes: string
        actionPlan: string
        photos: InspectionPhotoInput[]
    }>({
        shift: new Date().getHours() < 12 ? 'MORNING' : 'AFTERNOON',
        temp1: '21.0',
        temp2: '21.5',
        temp3: '22.0',
        humidity: '55.0',
        incidentNotes: '',
        actionPlan: '',
        photos: [],
    })

    const [periodicForm, setPeriodicForm] = useState<{
        items: InspectionCheckItemInput[]
        incidentNotes: string
        actionPlan: string
        targetDate: string
        photos: InspectionPhotoInput[]
    }>({
        items: JSON.parse(JSON.stringify(DEFAULT_PERIODIC_ITEMS)),
        incidentNotes: '',
        actionPlan: '',
        targetDate: '',
        photos: [],
    })

    const [saving, setSaving] = useState(false)

    // Approval modal state
    const [openApproveModal, setOpenApproveModal] = useState(false)
    const [approveInspection, setApproveInspection] = useState<any | null>(null)
    const [approveFeedback, setApproveFeedback] = useState('')
    const [approveActionPlan, setApproveActionPlan] = useState('')
    const [approving, setApproving] = useState(false)

    // Photo viewer
    const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null)

    const selectedWarehouse = useMemo(() => {
        return warehouses.find(w => w.id === warehouseId) || warehouses[0]
    }, [warehouses, warehouseId])

    // Load offline drafts from localStorage
    const loadOfflineDrafts = useCallback(() => {
        try {
            const raw = localStorage.getItem(OFFLINE_STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) {
                    setOfflineDrafts(parsed)
                }
            } else {
                setOfflineDrafts([])
            }
        } catch (e) {
            console.warn('Could not read offline drafts from localStorage', e)
        }
    }, [])

    const saveOfflineDraft = (draft: CreateInspectionInput) => {
        try {
            const current = [...offlineDrafts, draft]
            localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(current))
            setOfflineDrafts(current)
            toast.warning('Đã lưu tạm ngoại tuyến vào thiết bị do mất mạng. Hệ thống sẽ tự đồng bộ khi có mạng trở lại.')
        } catch (e) {
            console.error('Save offline draft error', e)
            toast.error('Bộ nhớ thiết bị đầy, không thể lưu ngoại tuyến')
        }
    }

    const clearOfflineDrafts = () => {
        try {
            localStorage.removeItem(OFFLINE_STORAGE_KEY)
            setOfflineDrafts([])
        } catch (e) {
            console.warn('Error clearing offline drafts', e)
        }
    }

    // Trigger batch sync
    const handleSyncOffline = async () => {
        if (offlineDrafts.length === 0) return
        setSyncingOffline(true)
        try {
            const res = await syncOfflineWarehouseInspectionsAction(offlineDrafts)
            if (res.success) {
                toast.success(`Đã đồng bộ thành công ${res.syncedCount}/${offlineDrafts.length} bản ghi kiểm tra kho!`)
                clearOfflineDrafts()
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi đồng bộ dữ liệu ngoại tuyến')
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối khi đồng bộ: ' + err.message)
        } finally {
            setSyncingOffline(false)
        }
    }

    // Auto-sync listener on window online
    useEffect(() => {
        loadOfflineDrafts()
        const handleOnline = () => {
            toast.info('Đã kết nối lại Internet. Đang kiểm tra bản ghi ngoại tuyến...')
            const raw = localStorage.getItem(OFFLINE_STORAGE_KEY)
            if (raw) {
                try {
                    const parsed = JSON.parse(raw)
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        syncOfflineWarehouseInspectionsAction(parsed).then(res => {
                            if (res.success && res.syncedCount && res.syncedCount > 0) {
                                toast.success(`Tự động đồng bộ thành công ${res.syncedCount} bản ghi ngoại tuyến!`)
                                clearOfflineDrafts()
                                loadData()
                            }
                        })
                    }
                } catch {}
            }
        }
        window.addEventListener('online', handleOnline)
        return () => window.removeEventListener('online', handleOnline)
    }, [loadOfflineDrafts])

    // Load staff list on mount
    useEffect(() => {
        getWarehouseStaffUsersAction().then(res => {
            if (res.success && res.data) {
                setStaffList(res.data)
            }
        }).catch(() => {})
    }, [])

    // Load data from server
    const loadData = useCallback(async () => {
        if (!warehouseId) return
        setLoading(true)
        try {
            const res = await getWarehouseInspectionsAction({
                warehouseId,
                startDate: dateRange.start,
                endDate: dateRange.end,
                pageSize: 50,
                assignedToMe: assignedToMeOnly || undefined,
                inspectorId: staffFilter !== 'ALL' ? staffFilter : undefined,
            })
            if (res.success && res.data) {
                setInspections(res.data)
                if (res.kpis) setKpis(res.kpis)
                if (res.currentUserId) setCurrentUserId(res.currentUserId)
                if (res.isManager !== undefined) setIsUserManager(res.isManager)
            } else {
                toast.error(res.error || 'Không thể tải dữ liệu kiểm tra kho')
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối máy chủ: ' + err.message)
        } finally {
            setLoading(false)
        }
    }, [warehouseId, dateRange, assignedToMeOnly, staffFilter])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Open camera modal with specific category
    const handleOpenCamera = (category: 'THERMOMETER' | 'AC_COOLING' | 'CORNER' | 'INCIDENT' | 'GENERAL', label: string, context: 'daily' | 'periodic') => {
        setCameraCategory(category)
        setCameraCategoryLabel(label)
        setCameraTargetContext(context)
        setCameraOpen(true)
    }

    // Handle captured photo
    const handlePhotoCaptured = (photoBase64: string, thumbnailBase64?: string, watermarkText?: string) => {
        const newPhoto: InspectionPhotoInput = {
            photoBase64,
            thumbnailBase64,
            category: cameraCategory,
            caption: cameraCategoryLabel,
            watermarkText,
            takenAt: new Date().toISOString(),
        }

        if (cameraTargetContext === 'daily') {
            setDailyForm(prev => ({
                ...prev,
                photos: [...prev.photos, newPhoto],
            }))
        } else {
            setPeriodicForm(prev => ({
                ...prev,
                photos: [...prev.photos, newPhoto],
            }))
        }
        toast.success(`Đã chụp và đóng dấu watermark ảnh "${cameraCategoryLabel}"`)
    }

    // Submit Daily Inspection
    const handleSubmitDaily = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!warehouseId) {
            toast.error('Vui lòng chọn kho')
            return
        }

        const t1 = parseFloat(dailyForm.temp1)
        const t2 = parseFloat(dailyForm.temp2)
        const t3 = parseFloat(dailyForm.temp3)
        const hum = parseFloat(dailyForm.humidity)

        if (isNaN(t1) || isNaN(hum)) {
            toast.error('Vui lòng nhập nhiệt độ và độ ẩm hợp lệ')
            return
        }

        const payload: CreateInspectionInput = {
            existingInspectionId: executingInspection?.id,
            warehouseId,
            type: 'DAILY_TEMP_HUMIDITY',
            inspectionDate: executingInspection?.inspectionDate ? new Date(executingInspection.inspectionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            shift: dailyForm.shift,
            temp1: t1,
            temp2: !isNaN(t2) ? t2 : undefined,
            temp3: !isNaN(t3) ? t3 : undefined,
            humidity: hum,
            incidentNotes: dailyForm.incidentNotes,
            actionPlan: dailyForm.actionPlan,
            photos: dailyForm.photos,
        }

        // Edge Case 1: If offline, store in draft queue
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            saveOfflineDraft(payload)
            setOpenDailyModal(false)
            setExecutingInspection(null)
            return
        }

        setSaving(true)
        try {
            const res = await createWarehouseInspectionAction(payload)
            if (res.success) {
                toast.success(`Đã lưu phiếu kiểm tra nhiệt ẩm (${res.data?.inspectionNo})`)
                setOpenDailyModal(false)
                setExecutingInspection(null)
                setDailyForm({
                    shift: 'MORNING',
                    temp1: '21.0',
                    temp2: '21.5',
                    temp3: '22.0',
                    humidity: '55.0',
                    incidentNotes: '',
                    actionPlan: '',
                    photos: [],
                })
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi lưu kết quả kiểm tra')
            }
        } catch (err: any) {
            // Network fallback to offline draft
            saveOfflineDraft(payload)
            setOpenDailyModal(false)
            setExecutingInspection(null)
        } finally {
            setSaving(false)
        }
    }

    // Submit Periodic Inspection
    const handleSubmitPeriodic = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!warehouseId) {
            toast.error('Vui lòng chọn kho')
            return
        }

        const tempItem = periodicForm.items.find(i => i.itemCode === '1.1')
        const humItem = periodicForm.items.find(i => i.itemCode === '1.2')
        const t1 = tempItem?.actualValue ? parseFloat(tempItem.actualValue) : undefined
        const hum = humItem?.actualValue ? parseFloat(humItem.actualValue) : undefined

        const payload: CreateInspectionInput = {
            existingInspectionId: executingInspection?.id,
            warehouseId,
            type: 'PERIODIC_AUDIT',
            inspectionDate: executingInspection?.inspectionDate ? new Date(executingInspection.inspectionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            temp1: t1,
            humidity: hum,
            incidentNotes: periodicForm.incidentNotes,
            actionPlan: periodicForm.actionPlan,
            targetDate: periodicForm.targetDate || undefined,
            items: periodicForm.items,
            photos: periodicForm.photos,
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            saveOfflineDraft(payload)
            setOpenPeriodicModal(false)
            setExecutingInspection(null)
            return
        }

        setSaving(true)
        try {
            const res = await createWarehouseInspectionAction(payload)
            if (res.success) {
                toast.success(`Đã lưu phiếu kiểm tra định kỳ (${res.data?.inspectionNo})`)
                setOpenPeriodicModal(false)
                setExecutingInspection(null)
                setPeriodicForm({
                    items: JSON.parse(JSON.stringify(DEFAULT_PERIODIC_ITEMS)),
                    incidentNotes: '',
                    actionPlan: '',
                    targetDate: '',
                    photos: [],
                })
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi lưu phiếu kiểm tra định kỳ')
            }
        } catch (err: any) {
            saveOfflineDraft(payload)
            setOpenPeriodicModal(false)
            setExecutingInspection(null)
        } finally {
            setSaving(false)
        }
    }

    // View Detail
    const handleViewDetail = async (id: string) => {
        setLoadingDetail(true)
        setOpenDetailModal(true)
        try {
            const res = await getWarehouseInspectionDetailAction(id)
            if (res.success && res.data) {
                setSelectedDetail(res.data)
            } else {
                toast.error(res.error || 'Không thể xem chi tiết')
                setOpenDetailModal(false)
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối: ' + err.message)
            setOpenDetailModal(false)
        } finally {
            setLoadingDetail(false)
        }
    }

    // Approve incident resolution
    const handleConfirmApprove = async () => {
        if (!approveInspection) return
        setApproving(true)
        try {
            const res = await approveWarehouseInspectionAction({
                inspectionId: approveInspection.id,
                actionPlan: approveActionPlan,
                feedback: approveFeedback,
                status: 'RESOLVED',
            })
            if (res.success) {
                toast.success('Đã duyệt và xác nhận xử lý sự cố thành công!')
                setOpenApproveModal(false)
                setApproveInspection(null)
                loadData()
            } else {
                toast.error(res.error || 'Không thể phê duyệt')
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối: ' + err.message)
        } finally {
            setApproving(false)
        }
    }

    // Export Excel
    const handleExportExcel = async (type?: 'DAILY_TEMP_HUMIDITY' | 'PERIODIC_AUDIT') => {
        if (!warehouseId) return
        const now = new Date()
        const loadingToast = toast.loading('Đang xuất sổ Excel...')
        try {
            const res = await exportWarehouseInspectionsExcelAction({
                warehouseId,
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                type,
            })
            if (res.success && res.base64) {
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
                a.download = res.fileName || 'Bao_Cao_Kiem_Tra_Kho.xlsx'
                a.click()
                window.URL.revokeObjectURL(url)
                toast.success('Xuất file Excel thành công!', { id: loadingToast })
            } else {
                toast.error(res.error || 'Lỗi khi tạo file Excel', { id: loadingToast })
            }
        } catch (err: any) {
            toast.error('Lỗi khi tải file: ' + err.message, { id: loadingToast })
        }
    }

    // Filter inspections for subtabs
    const dailyInspections = useMemo(() => {
        return inspections.filter(i => i.type === 'DAILY_TEMP_HUMIDITY')
    }, [inspections])

    const periodicInspections = useMemo(() => {
        return inspections.filter(i => i.type === 'PERIODIC_AUDIT')
    }, [inspections])

    const assignedInspections = useMemo(() => {
        return inspections.filter(i => i.status === 'ASSIGNED' || i.status === 'OVERDUE')
    }, [inspections])

    const incidentInspections = useMemo(() => {
        return inspections.filter(i => i.overallResult !== 'PASSED' || i.status === 'PENDING_APPROVAL')
    }, [inspections])

    // Assignment Handlers
    const handleConfirmAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!assignForm.assignedToId) {
            toast.error('Vui lòng chọn nhân viên được phân công')
            return
        }
        setAssigning(true)
        try {
            const res = await assignWarehouseInspectionAction({
                inspectionId: assignForm.inspectionId || undefined,
                warehouseId: assignForm.warehouseId || warehouseId,
                type: assignForm.type,
                inspectionDate: assignForm.inspectionDate,
                shift: assignForm.shift,
                assignedToId: assignForm.assignedToId,
                dueDate: assignForm.dueDate || undefined,
                notes: assignForm.notes || undefined,
            })
            if (res.success) {
                toast.success(assignForm.inspectionId ? 'Đã phân công lại nhân viên thành công!' : 'Đã phân công kiểm tra kho và gửi tin Telegram thành công!')
                setOpenAssignModal(false)
                setAssignForm({
                    inspectionId: '',
                    warehouseId: warehouseId || '',
                    type: 'DAILY_TEMP_HUMIDITY',
                    inspectionDate: new Date().toISOString().slice(0, 10),
                    shift: 'MORNING',
                    assignedToId: '',
                    dueDate: '',
                    notes: '',
                })
                loadData()
            } else {
                toast.error(res.error || 'Lỗi khi phân công nhân viên')
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối: ' + err.message)
        } finally {
            setAssigning(false)
        }
    }

    const handleOpenReassign = (item: any) => {
        setAssignForm({
            inspectionId: item.id,
            warehouseId: item.warehouseId,
            type: item.type,
            inspectionDate: item.inspectionDate ? new Date(item.inspectionDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            shift: item.shift,
            assignedToId: item.inspectorId || '',
            dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 16) : '',
            notes: '',
        })
        setOpenAssignModal(true)
    }

    const handleStartAssignedInspection = (item: any) => {
        const canExecute = currentUserId === item.inspectorId || isUserManager || isAdmin
        if (!canExecute) {
            toast.error(`Chỉ nhân viên được phân công (${item.inspector?.name || 'Người được giao'}) hoặc Quản lý mới có quyền thực hiện phiếu này.`)
            return
        }
        setExecutingInspection(item)
        if (item.type === 'DAILY_TEMP_HUMIDITY') {
            setDailyForm(prev => ({
                ...prev,
                shift: item.shift || 'MORNING',
                incidentNotes: item.incidentNotes || '',
            }))
            setOpenDailyModal(true)
        } else {
            setPeriodicForm(prev => ({
                ...prev,
                incidentNotes: item.incidentNotes || '',
            }))
            setOpenPeriodicModal(true)
        }
    }

    const handleSendOverdueAlert = async (inspectionId: string) => {
        const loadingToast = toast.loading('Đang gửi cảnh báo nhắc nhở Telegram...')
        try {
            const res = await sendInspectionOverdueAlertAction(inspectionId)
            if (res.success) {
                toast.success('Đã gửi thông báo nhắc nhở Telegram thành công!', { id: loadingToast })
            } else {
                toast.error(res.error || 'Lỗi khi gửi thông báo', { id: loadingToast })
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối: ' + err.message, { id: loadingToast })
        }
    }

    // Chart dataset
    const chartData = useMemo(() => {
        return dailyInspections
            .slice()
            .reverse()
            .map(item => {
                const dateStr = new Date(item.inspectionDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                const shiftLabel = item.shift === 'MORNING' ? 'S' : item.shift === 'AFTERNOON' ? 'C' : 'T'
                return {
                    name: `${dateStr} (${shiftLabel})`,
                    temp: item.temp1 ? Number(item.temp1) : null,
                    humidity: item.humidity ? Number(item.humidity) : null,
                }
            })
    }, [dailyInspections])

    return (
        <div className="space-y-4">
            {/* Offline Sync Banner if any drafts exist */}
            {offlineDrafts.length > 0 && (
                <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="text-xs font-semibold">Đang lưu tạm ngoại tuyến:</span>{' '}
                            <span className="text-xs">{offlineDrafts.length} bản ghi kiểm tra kho chưa được đẩy lên máy chủ do mất kết nối.</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSyncOffline}
                        disabled={syncingOffline}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition shadow-xs"
                    >
                        <UploadCloud className="w-4 h-4" />
                        <span>{syncingOffline ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                    </button>
                </div>
            )}

            {/* Top Bar: Warehouse Selector & Primary Actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                            <Thermometer className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Kiểm Tra Kho & Sổ Nhiệt Ẩm</h2>
                            <p className="text-xs text-slate-500">Quy chuẩn Form 5.3-A & Phiếu định kỳ Thanh Trì</p>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                    {/* Warehouse dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Kho:</span>
                        <select
                            value={warehouseId}
                            onChange={(e) => setWarehouseId(e.target.value)}
                            className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-600"
                        >
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.name} ({w.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {(isUserManager || isAdmin) && (
                        <button
                            type="button"
                            onClick={() => {
                                setAssignForm({
                                    inspectionId: '',
                                    warehouseId,
                                    type: 'DAILY_TEMP_HUMIDITY',
                                    inspectionDate: new Date().toISOString().slice(0, 10),
                                    shift: new Date().getHours() < 12 ? 'MORNING' : 'AFTERNOON',
                                    assignedToId: '',
                                    dueDate: '',
                                    notes: '',
                                })
                                setOpenAssignModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-xs font-semibold transition shadow-xs active:scale-98"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Phân công kiểm tra</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setExecutingInspection(null)
                            setOpenDailyModal(true)
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium transition shadow-xs active:scale-98"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Đo nhiệt ẩm 12h</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setExecutingInspection(null)
                            setOpenPeriodicModal(true)
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0E7490] hover:bg-[#155E75] text-white rounded-lg text-xs font-medium transition shadow-xs active:scale-98"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Phiếu định kỳ T2 & T5</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleExportExcel()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition shadow-2xs"
                    >
                        <Download className="w-4 h-4 text-slate-500" />
                        <span className="hidden sm:inline">Xuất Sổ Excel</span>
                    </button>
                </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Tỷ lệ đạt chuẩn</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{kpis.complianceRate}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{kpis.passedCount}/{kpis.totalInspections} lượt</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Tổng lượt tháng</span>
                        <Calendar className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="text-xl font-bold text-slate-900">{kpis.totalInspections}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Kho {selectedWarehouse?.code}</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Đã phân công</span>
                        <UserCheck className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="text-xl font-bold text-sky-700">{kpis.assignedCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Chờ nhân viên đo</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Quá hạn ca</span>
                        <Clock className={`w-4 h-4 ${kpis.overdueCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
                    </div>
                    <div className={`text-xl font-bold ${kpis.overdueCount > 0 ? 'text-rose-600' : 'text-slate-700'}`}>{kpis.overdueCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Cần nhắc nhở</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Cảnh báo / Sự cố</span>
                        <AlertTriangle className={`w-4 h-4 ${kpis.incidentCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-xl font-bold text-amber-600">{kpis.incidentCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Vượt ngưỡng an toàn</div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-[11px] font-medium">Chờ duyệt sự cố</span>
                        <ShieldAlert className={`w-4 h-4 ${kpis.pendingApprovalCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="text-xl font-bold text-rose-600">{kpis.pendingApprovalCount}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Quản lý cần duyệt</div>
                </div>
            </div>

            {/* Sub-Tabs Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 pt-2 rounded-t-xl">
                <div className="flex items-center gap-1 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveSubTab('daily')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                            activeSubTab === 'daily'
                                ? 'text-cyan-700 border-cyan-600 bg-cyan-50/40'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        Sổ Nhiệt Ẩm 12h ({dailyInspections.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('periodic')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                            activeSubTab === 'periodic'
                                ? 'text-cyan-700 border-cyan-600 bg-cyan-50/40'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        Phiếu Định Kỳ T2 & T5 ({periodicInspections.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('assigned')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                            activeSubTab === 'assigned'
                                ? 'text-sky-700 border-sky-600 bg-sky-50/40 font-bold'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Phân Công ({assignedInspections.length})</span>
                        {kpis.overdueCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold animate-pulse">
                                {kpis.overdueCount} trễ
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('incidents')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                            activeSubTab === 'incidents'
                                ? 'text-rose-700 border-rose-600 bg-rose-50/40'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <span>Sự Cố & Duyệt</span>
                        {incidentInspections.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold">
                                {incidentInspections.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSubTab('chart')}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                            activeSubTab === 'chart'
                                ? 'text-cyan-700 border-cyan-600 bg-cyan-50/40'
                                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-50'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Biểu Đồ Xu Hướng</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar: Assigned to Me & Staff Filter & Date Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-50 border-x border-b border-slate-200 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle Assigned to Me */}
                    <button
                        type="button"
                        onClick={() => setAssignedToMeOnly(!assignedToMeOnly)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition ${
                            assignedToMeOnly
                                ? 'bg-cyan-700 text-white border-cyan-700 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                    >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Được giao cho tôi</span>
                    </button>

                    {/* Staff filter dropdown */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Nhân viên:</span>
                        <select
                            value={staffFilter}
                            onChange={e => setStaffFilter(e.target.value)}
                            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium outline-none focus:border-cyan-600"
                        >
                            <option value="ALL">Tất cả nhân viên</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>{s.name || s.email}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Date range filter */}
                <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-medium">Từ:</span>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                    />
                    <span className="font-medium">Đến:</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800 outline-none"
                    />
                </div>
            </div>

            {/* Sub-tab 1: Daily Temp & Humidity Log */}
            {activeSubTab === 'daily' && (
                <div className="bg-white border border-slate-200 rounded-b-xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3">Mã phiếu</th>
                                    <th className="py-2.5 px-3">Ngày & Ca đo</th>
                                    <th className="py-2.5 px-3 text-center">VT #1 (Gần cửa)</th>
                                    <th className="py-2.5 px-3 text-center">VT #2 (Giữa kho)</th>
                                    <th className="py-2.5 px-3 text-center">VT #3 (Góc xa)</th>
                                    <th className="py-2.5 px-3 text-center">Độ ẩm</th>
                                    <th className="py-2.5 px-3 text-center">Đánh giá</th>
                                    <th className="py-2.5 px-3">Ảnh chứng từ</th>
                                    <th className="py-2.5 px-3">Thủ kho</th>
                                    <th className="py-2.5 px-3 text-right">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {dailyInspections.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-8 text-center text-slate-400">
                                            Chưa có lượt đo nhiệt độ & độ ẩm nào trong tháng này.
                                        </td>
                                    </tr>
                                ) : (
                                    dailyInspections.map(item => {
                                        const isPassed = item.overallResult === 'PASSED'
                                        const isWarning = item.overallResult === 'WARNING'
                                        const isDanger = item.overallResult === 'FAILED'
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                                <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                                                    {item.inspectionNo}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-medium text-slate-800">
                                                        {new Date(item.inspectionDate).toLocaleDateString('vi-VN')}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {item.shift === 'MORNING' ? 'Sáng (08:00)' : item.shift === 'AFTERNOON' ? 'Chiều (16:00)' : 'Tối'}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-semibold">
                                                    {item.temp1 ? `${Number(item.temp1)}°C` : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-semibold">
                                                    {item.temp2 ? `${Number(item.temp2)}°C` : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-semibold">
                                                    {item.temp3 ? `${Number(item.temp3)}°C` : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-mono font-semibold text-cyan-800">
                                                    {item.humidity ? `${Number(item.humidity)}%` : '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {item.status === 'ASSIGNED' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                            Đã giao việc
                                                        </span>
                                                    ) : item.status === 'OVERDUE' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                                            Quá hạn ca
                                                        </span>
                                                    ) : isPassed ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            Đạt chuẩn
                                                        </span>
                                                    ) : isWarning ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                            Cảnh báo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                                            Không đạt
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-1">
                                                        {item.photos?.map((p: any) => (
                                                            <button
                                                                type="button"
                                                                key={p.id}
                                                                onClick={() => setViewPhotoUrl(p.thumbnailUrl || p.photoUrl)}
                                                                className="w-8 h-8 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition"
                                                            >
                                                                <img
                                                                    src={p.thumbnailUrl || p.photoUrl}
                                                                    alt={p.category}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </button>
                                                        ))}
                                                        {(!item.photos || item.photos.length === 0) && (
                                                            <span className="text-[11px] text-slate-400">Không có ảnh</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-700">
                                                    <div className="font-semibold text-slate-800">{item.inspector?.name || 'Thủ kho'}</div>
                                                    {item.assignedBy?.name && (
                                                        <div className="text-[10px] text-slate-400">Giao bởi: {item.assignedBy.name}</div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {(item.status === 'ASSIGNED' || item.status === 'OVERDUE') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartAssignedInspection(item)}
                                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap"
                                                            >
                                                                Đo ngay
                                                            </button>
                                                        )}
                                                        {(isUserManager || isAdmin) && (item.status === 'ASSIGNED' || item.status === 'OVERDUE') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenReassign(item)}
                                                                className="px-2 py-1 text-xs text-sky-700 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition whitespace-nowrap"
                                                                title="Đổi nhân viên đo"
                                                            >
                                                                Đổi người
                                                            </button>
                                                        )}
                                                        {item.status === 'OVERDUE' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendOverdueAlert(item.id)}
                                                                className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                                                title="Bắn cảnh báo Telegram"
                                                            >
                                                                <BellRing className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewDetail(item.id)}
                                                            className="px-2.5 py-1 text-xs text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 rounded-lg transition"
                                                        >
                                                            Xem
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sub-tab 2: Periodic Audit Log */}
            {activeSubTab === 'periodic' && (
                <div className="bg-white border border-slate-200 rounded-b-xl shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3">Mã phiếu</th>
                                    <th className="py-2.5 px-3">Ngày kiểm tra</th>
                                    <th className="py-2.5 px-3 text-center">Tiêu chuẩn kiểm tra</th>
                                    <th className="py-2.5 px-3 text-center">Kết quả chung</th>
                                    <th className="py-2.5 px-3">Sự cố & Phương án</th>
                                    <th className="py-2.5 px-3">Ảnh hiện trường</th>
                                    <th className="py-2.5 px-3">Người kiểm tra</th>
                                    <th className="py-2.5 px-3">Quản lý duyệt</th>
                                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {periodicInspections.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-400">
                                            Chưa có phiếu kiểm tra định kỳ T2 & T5 nào trong tháng này.
                                        </td>
                                    </tr>
                                ) : (
                                    periodicInspections.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                            <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                                                {item.inspectionNo}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="font-medium text-slate-800">
                                                    {new Date(item.inspectionDate).toLocaleDateString('vi-VN')}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                                    {item._count?.items ?? 14} hạng mục
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                {item.status === 'ASSIGNED' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                                        Đã giao việc
                                                    </span>
                                                ) : item.status === 'OVERDUE' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                                        Quá hạn ca
                                                    </span>
                                                ) : item.overallResult === 'PASSED' ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        Đạt chuẩn
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                                        Có sự cố
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 max-w-xs truncate text-[11px]">
                                                {item.incidentNotes || item.actionPlan ? (
                                                    <span className="text-slate-800">{item.actionPlan || item.incidentNotes}</span>
                                                ) : (
                                                    <span className="text-slate-400">Không có sự cố</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1">
                                                    {item.photos?.map((p: any) => (
                                                        <button
                                                            type="button"
                                                            key={p.id}
                                                            onClick={() => setViewPhotoUrl(p.thumbnailUrl || p.photoUrl)}
                                                            className="w-8 h-8 rounded border border-slate-200 overflow-hidden hover:opacity-80 transition"
                                                        >
                                                            <img
                                                                src={p.thumbnailUrl || p.photoUrl}
                                                                alt={p.category}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-700">
                                                <div className="font-semibold text-slate-800">{item.inspector?.name || 'Thủ kho'}</div>
                                                {item.assignedBy?.name && (
                                                    <div className="text-[10px] text-slate-400">Giao bởi: {item.assignedBy.name}</div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {item.managerApproved?.name ? (
                                                    <span className="text-[11px] font-medium text-emerald-700">
                                                        {item.managerApproved.name}
                                                    </span>
                                                ) : item.status === 'PENDING_APPROVAL' ? (
                                                    <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                                        Chờ duyệt
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {(item.status === 'ASSIGNED' || item.status === 'OVERDUE') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartAssignedInspection(item)}
                                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap"
                                                        >
                                                            Kiểm tra ngay
                                                        </button>
                                                    )}
                                                    {(isUserManager || isAdmin) && (item.status === 'ASSIGNED' || item.status === 'OVERDUE') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenReassign(item)}
                                                            className="px-2 py-1 text-xs text-sky-700 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition whitespace-nowrap"
                                                            title="Đổi nhân viên thực hiện"
                                                        >
                                                            Đổi người
                                                        </button>
                                                    )}
                                                    {item.status === 'OVERDUE' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendOverdueAlert(item.id)}
                                                            className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                                            title="Bắn cảnh báo Telegram"
                                                        >
                                                            <BellRing className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewDetail(item.id)}
                                                        className="px-2.5 py-1 text-xs text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50 rounded-lg transition"
                                                    >
                                                        Xem chi tiết
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sub-tab 3: Assigned Inspections (Giao Việc & Phân Công) */}
            {activeSubTab === 'assigned' && (
                <div className="bg-white border border-slate-200 rounded-b-xl shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-sky-50/40">
                        <div className="flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-sky-700" />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Danh Sách Phiếu Kiểm Tra Được Phân Công</h3>
                                <p className="text-[11px] text-slate-500">Theo dõi các ca kiểm tra được giao cho nhân viên và giám sát thời hạn</p>
                            </div>
                        </div>
                        {(isUserManager || isAdmin) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setAssignForm({
                                        inspectionId: '',
                                        warehouseId,
                                        type: 'DAILY_TEMP_HUMIDITY',
                                        inspectionDate: new Date().toISOString().slice(0, 10),
                                        shift: new Date().getHours() < 12 ? 'MORNING' : 'AFTERNOON',
                                        assignedToId: '',
                                        dueDate: '',
                                        notes: '',
                                    })
                                    setOpenAssignModal(true)
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>+ Phân công ca mới</span>
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
                                <tr>
                                    <th className="py-2.5 px-3">Mã phiếu</th>
                                    <th className="py-2.5 px-3">Loại kiểm tra</th>
                                    <th className="py-2.5 px-3">Kho & Ca</th>
                                    <th className="py-2.5 px-3">Người được giao</th>
                                    <th className="py-2.5 px-3">Người giao việc</th>
                                    <th className="py-2.5 px-3">Hạn hoàn thành</th>
                                    <th className="py-2.5 px-3 text-center">Trạng thái</th>
                                    <th className="py-2.5 px-3">Ghi chú</th>
                                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {assignedInspections.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400">
                                            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                                            <p className="text-xs font-medium text-slate-600">Không có phiếu phân công nào đang chờ thực hiện</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Tất cả các ca kiểm tra đã hoàn thành hoặc chưa có phân công mới.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    assignedInspections.map(item => {
                                        const isOverdue = item.status === 'OVERDUE'
                                        const canExecute = currentUserId === item.inspectorId || isUserManager || isAdmin

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 transition">
                                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                                    {item.inspectionNo}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    {item.type === 'DAILY_TEMP_HUMIDITY' ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                                                            <Thermometer className="w-3 h-3" /> Sổ nhiệt ẩm 12h
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                            <ShieldCheck className="w-3 h-3" /> Phiếu định kỳ T2/T5
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-semibold text-slate-800">{item.warehouse?.name}</div>
                                                    <div className="text-[11px] text-slate-500">
                                                        {item.shift === 'MORNING' ? 'Ca Sáng (08:00)' : item.shift === 'AFTERNOON' ? 'Ca Chiều (16:00)' : 'Ca Tối'} • {new Date(item.inspectionDate).toLocaleDateString('vi-VN')}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span className="font-bold text-slate-900">{item.inspector?.name || 'Chưa gán'}</span>
                                                    {item.inspectorId === currentUserId && (
                                                        <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-cyan-100 text-cyan-800 font-bold">Tôi</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600">
                                                    {item.assignedBy?.name || 'Quản lý kho'}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <div className={`font-mono text-xs ${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700 font-medium'}`}>
                                                        {item.dueDate ? new Date(item.dueDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Trong ca'}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {isOverdue ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                                            <Clock className="w-3 h-3" /> Quá hạn
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                                            <UserCheck className="w-3 h-3" /> Đã giao việc
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={item.incidentNotes || ''}>
                                                    {item.incidentNotes || '-'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canExecute ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartAssignedInspection(item)}
                                                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap"
                                                            >
                                                                Thực hiện ngay
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic px-1" title="Chỉ nhân viên được giao hoặc Quản lý mới có quyền thực hiện">
                                                                Khóa quyền
                                                            </span>
                                                        )}

                                                        {(isUserManager || isAdmin) && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenReassign(item)}
                                                                className="px-2 py-1 text-xs text-sky-700 hover:text-sky-800 hover:bg-sky-50 rounded-lg transition whitespace-nowrap"
                                                                title="Đổi nhân viên thực hiện"
                                                            >
                                                                Đổi người
                                                            </button>
                                                        )}

                                                        {isOverdue && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSendOverdueAlert(item.id)}
                                                                className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                                                title="Bắn cảnh báo nhắc nhở Telegram"
                                                            >
                                                                <BellRing className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleViewDetail(item.id)}
                                                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                                        >
                                                            Xem
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sub-tab 3: Incidents & Manager Approvals */}
            {activeSubTab === 'incidents' && (
                <div className="bg-white border border-slate-200 rounded-b-xl shadow-2xs overflow-hidden p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-rose-600" />
                            <h3 className="text-sm font-bold text-slate-900">Danh Sách Sự Cố Kho Chờ Quản Lý Phê Duyệt</h3>
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                            {incidentInspections.length} phiếu cần theo dõi
                        </span>
                    </div>

                    {incidentInspections.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-700">Kho đang vận hành an toàn</p>
                            <p className="text-xs text-slate-400 mt-0.5">Không phát hiện sự cố nhiệt ẩm hay cơ sở vật chất nào cần phê duyệt.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {incidentInspections.map(item => (
                                <div key={item.id} className="p-4 bg-slate-50 border border-rose-200/80 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-slate-900">{item.inspectionNo}</span>
                                            <span className="text-xs px-2 py-0.5 rounded font-semibold bg-rose-100 text-rose-800">
                                                {item.overallResult === 'FAILED' ? 'KHÔNG ĐẠT / SỰ CỐ' : 'CẢNH BÁO SÁT NGƯỠNG'}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {new Date(item.inspectionDate).toLocaleDateString('vi-VN')} • Kho {item.warehouse?.name}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 font-medium whitespace-pre-line">
                                            {item.incidentNotes || 'Phát hiện chỉ số bất thường'}
                                        </p>
                                        {item.actionPlan && (
                                            <p className="text-xs text-slate-500">
                                                <span className="font-semibold text-slate-700">Đề xuất thủ kho:</span> {item.actionPlan}
                                            </p>
                                        )}
                                        {item.managerFeedback && (
                                            <p className="text-xs text-cyan-800 bg-cyan-50 px-2 py-1 rounded">
                                                <span className="font-semibold">Quản lý chỉ đạo:</span> {item.managerFeedback}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleViewDetail(item.id)}
                                            className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                                        >
                                            Xem ảnh & phiếu
                                        </button>
                                        {isAdmin && item.status === 'PENDING_APPROVAL' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setApproveInspection(item)
                                                    setApproveActionPlan(item.actionPlan || '')
                                                    setApproveFeedback('')
                                                    setOpenApproveModal(true)
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-600 rounded-lg transition shadow-xs"
                                            >
                                                Phê duyệt xử lý
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Sub-tab 4: Trend Chart */}
            {activeSubTab === 'chart' && (
                <div className="bg-white border border-slate-200 rounded-b-xl shadow-2xs p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Biểu Đồ Xu Hướng Nhiệt Độ & Độ Ẩm</h3>
                            <p className="text-xs text-slate-500">Dữ liệu từ các ca đo 12h hàng ngày (Kho {selectedWarehouse?.name})</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-cyan-600 inline-block" />
                                <span>Nhiệt độ (°C)</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                                <span>Độ ẩm (%)</span>
                            </span>
                        </div>
                    </div>

                    {chartData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
                            Chưa có đủ dữ liệu để vẽ biểu đồ
                        </div>
                    ) : (
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                                    <YAxis yAxisId="left" domain={[10, 30]} tick={{ fontSize: 11 }} stroke="#0891B2" label={{ value: '°C', position: 'insideTopLeft', offset: -10 }} />
                                    <YAxis yAxisId="right" orientation="right" domain={[30, 90]} tick={{ fontSize: 11 }} stroke="#D97706" label={{ value: '%', position: 'insideTopRight', offset: -10 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#F8FAFC', borderRadius: '8px', fontSize: '12px' }} />
                                    <ReferenceLine yAxisId="left" y={22} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Ngưỡng nguy hiểm 22°C', fill: '#EF4444', fontSize: 10 }} />
                                    <ReferenceLine yAxisId="left" y={14} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Ngưỡng an toàn 14°C', fill: '#10B981', fontSize: 10 }} />
                                    <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#0891B2" strokeWidth={2.5} dot={{ r: 3 }} name="Nhiệt độ (°C)" />
                                    <Line yAxisId="right" type="monotone" dataKey="humidity" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} name="Độ ẩm (%)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: Quick Daily Inspection Form */}
            {openDailyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Ghi Số Đo Nhiệt Ẩm 12h (Form 5.3-A)</h3>
                                <p className="text-xs text-slate-500">Kho: {selectedWarehouse?.name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenDailyModal(false)
                                    setExecutingInspection(null)
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {executingInspection && (
                            <div className="px-5 py-2.5 bg-cyan-50 border-b border-cyan-200 flex items-center justify-between text-xs text-cyan-900">
                                <div>
                                    <span className="font-bold">Đang thực hiện phân công:</span> {executingInspection.inspectionNo}
                                    <span className="ml-2 text-cyan-700">({executingInspection.shift === 'MORNING' ? 'Ca Sáng' : executingInspection.shift === 'AFTERNOON' ? 'Ca Chiều' : 'Ca Tối'})</span>
                                </div>
                                {executingInspection.dueDate && (
                                    <span className="text-[11px] font-medium text-cyan-800">
                                        Hạn chót: {new Date(executingInspection.dueDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmitDaily} className="p-5 overflow-y-auto space-y-4 text-xs">
                            {/* Shift Selector */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">Ca đo</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setDailyForm(prev => ({ ...prev, shift: 'MORNING' }))}
                                        className={`py-2 px-3 rounded-lg border font-medium transition ${
                                            dailyForm.shift === 'MORNING'
                                                ? 'bg-cyan-50 border-cyan-600 text-cyan-800 font-bold'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Ca Sáng (08:00)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDailyForm(prev => ({ ...prev, shift: 'AFTERNOON' }))}
                                        className={`py-2 px-3 rounded-lg border font-medium transition ${
                                            dailyForm.shift === 'AFTERNOON'
                                                ? 'bg-cyan-50 border-cyan-600 text-cyan-800 font-bold'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Ca Chiều (16:00)
                                    </button>
                                </div>
                            </div>

                            {/* Temperature 3 Positions */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Nhiệt độ tại 3 vị trí kho (°C)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div>
                                        <span className="text-[11px] text-slate-500">VT #1 (Cửa)</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            required
                                            value={dailyForm.temp1}
                                            onChange={e => setDailyForm(prev => ({ ...prev, temp1: e.target.value }))}
                                            className="w-full mt-0.5 p-2 bg-slate-50 border border-slate-300 rounded-lg text-base sm:text-xs font-mono font-bold text-slate-800 outline-none focus:border-cyan-600"
                                            placeholder="°C"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-500">VT #2 (Giữa)</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={dailyForm.temp2}
                                            onChange={e => setDailyForm(prev => ({ ...prev, temp2: e.target.value }))}
                                            className="w-full mt-0.5 p-2 bg-slate-50 border border-slate-300 rounded-lg text-base sm:text-xs font-mono font-bold text-slate-800 outline-none focus:border-cyan-600"
                                            placeholder="°C"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-slate-500">VT #3 (Góc xa)</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={dailyForm.temp3}
                                            onChange={e => setDailyForm(prev => ({ ...prev, temp3: e.target.value }))}
                                            className="w-full mt-0.5 p-2 bg-slate-50 border border-slate-300 rounded-lg text-base sm:text-xs font-mono font-bold text-slate-800 outline-none focus:border-cyan-600"
                                            placeholder="°C"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Humidity */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Độ ẩm tương đối (% RH)
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    required
                                    value={dailyForm.humidity}
                                    onChange={e => setDailyForm(prev => ({ ...prev, humidity: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-base sm:text-xs font-mono font-bold text-cyan-900 outline-none focus:border-cyan-600"
                                    placeholder="45 - 65%"
                                />
                            </div>

                            {/* Camera Watermark Photos */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="font-semibold text-slate-700">Ảnh chụp bằng chứng TimeMark</label>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenCamera('THERMOMETER', 'Nhiệt ẩm kế', 'daily')}
                                        className="inline-flex items-center gap-1 text-[11px] text-cyan-700 hover:text-cyan-800 font-semibold"
                                    >
                                        <Camera className="w-3.5 h-3.5" />
                                        <span>+ Chụp ảnh nhiệt ẩm kế</span>
                                    </button>
                                </div>

                                {dailyForm.photos.length === 0 ? (
                                    <div
                                        onClick={() => handleOpenCamera('THERMOMETER', 'Nhiệt ẩm kế', 'daily')}
                                        className="p-4 border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-lg text-center cursor-pointer bg-slate-50/50 transition"
                                    >
                                        <Camera className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                                        <p className="text-xs font-medium text-slate-600">Bấm để chụp ảnh đồng hồ nhiệt ẩm kế</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Tự động gắn Watermark thời gian, tọa độ GPS và tên kho</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {dailyForm.photos.map((p, idx) => (
                                            <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 group">
                                                <img src={p.thumbnailBase64 || p.photoBase64} alt={p.caption} className="w-full h-20 object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDailyForm(prev => ({
                                                            ...prev,
                                                            photos: prev.photos.filter((_, i) => i !== idx),
                                                        }))}
                                                        className="p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1 rounded truncate max-w-[90%]">
                                                    {p.caption}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Incident Notes */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Ghi chú / Phát hiện bất thường (nếu có)
                                </label>
                                <textarea
                                    rows={2}
                                    value={dailyForm.incidentNotes}
                                    onChange={e => setDailyForm(prev => ({ ...prev, incidentNotes: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-cyan-600"
                                    placeholder="Ví dụ: Máy lạnh phả gió yếu, cửa kho mở xuất hàng lúc 15h..."
                                />
                            </div>

                            {/* Action Plan */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Đề xuất phương án xử lý
                                </label>
                                <input
                                    type="text"
                                    value={dailyForm.actionPlan}
                                    onChange={e => setDailyForm(prev => ({ ...prev, actionPlan: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-cyan-600"
                                    placeholder="Ví dụ: Đã tăng công suất máy lạnh, đóng kín rèm cửa cách nhiệt..."
                                />
                            </div>

                            {/* Submit */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpenDailyModal(false)
                                        setExecutingInspection(null)
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded-lg font-medium transition shadow-xs"
                                >
                                    {saving ? 'Đang lưu...' : 'Lưu lượt đo nhiệt ẩm'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Periodic Audit Checklist Form (T2 & T5) */}
            {openPeriodicModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Phiếu Kiểm Tra Định Kỳ (Thứ 2 & Thứ 5)</h3>
                                <p className="text-xs text-slate-500">Kho: {selectedWarehouse?.name} • 4 nhóm tiêu chuẩn</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpenPeriodicModal(false)
                                    setExecutingInspection(null)
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {executingInspection && (
                            <div className="px-5 py-2.5 bg-cyan-50 border-b border-cyan-200 flex items-center justify-between text-xs text-cyan-900">
                                <div>
                                    <span className="font-bold">Đang thực hiện phân công:</span> {executingInspection.inspectionNo}
                                </div>
                                {executingInspection.dueDate && (
                                    <span className="text-[11px] font-medium text-cyan-800">
                                        Hạn chót: {new Date(executingInspection.dueDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                    </span>
                                )}
                            </div>
                        )}

                        <form onSubmit={handleSubmitPeriodic} className="p-5 overflow-y-auto space-y-4 text-xs">
                            {/* Checklist Items list */}
                            <div className="space-y-3">
                                {['ENVIRONMENT', 'SECURITY', 'GOODS_HYGIENE'].map((cat) => {
                                    const catLabel = cat === 'ENVIRONMENT'
                                        ? 'I. Môi trường & Thiết bị bảo quản'
                                        : cat === 'SECURITY'
                                        ? 'II. An ninh & Cơ sở vật chất'
                                        : 'III. Tình trạng hàng hóa & Vệ sinh'
                                    const catItems = periodicForm.items.filter(i => i.category === cat)

                                    return (
                                        <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100/80 px-3 py-2 font-bold text-slate-800 text-[11px]">
                                                {catLabel}
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {catItems.map((item, idx) => {
                                                    const globalIdx = periodicForm.items.findIndex(it => it.itemCode === item.itemCode)
                                                    return (
                                                        <div key={item.itemCode} className="p-2.5 flex items-center justify-between gap-3">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-mono font-semibold text-slate-500">{item.itemCode}</span>
                                                                    <span className="font-semibold text-slate-800">{item.itemName}</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 mt-0.5">{item.standard}</p>
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <input
                                                                    type="text"
                                                                    value={item.actualValue || ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value
                                                                        setPeriodicForm(prev => {
                                                                            const updated = [...prev.items]
                                                                            updated[globalIdx].actualValue = val
                                                                            return { ...prev, items: updated }
                                                                        })
                                                                    }}
                                                                    className="w-24 p-1.5 text-xs bg-slate-50 border border-slate-200 rounded outline-none"
                                                                    placeholder="Thực tế..."
                                                                />

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setPeriodicForm(prev => {
                                                                            const updated = [...prev.items]
                                                                            updated[globalIdx].isPassed = !updated[globalIdx].isPassed
                                                                            return { ...prev, items: updated }
                                                                        })
                                                                    }}
                                                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                                                                        item.isPassed
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                                                            : 'bg-rose-50 text-rose-700 border border-rose-300'
                                                                    }`}
                                                                >
                                                                    {item.isPassed ? 'Đạt' : 'Không đạt'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Section IV: Camera Photos */}
                            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-[11px]">IV. Quy trình hình ảnh TimeMark</h4>
                                        <p className="text-[10px] text-slate-500">Chụp đủ: Nhiệt ẩm kế, máy lạnh, 4 góc kho</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCamera('AC_COOLING', 'Máy lạnh', 'periodic')}
                                            className="px-2 py-1 bg-white border border-slate-200 hover:border-cyan-500 rounded text-[11px] font-medium"
                                        >
                                            + Máy lạnh
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCamera('CORNER', 'Góc kho', 'periodic')}
                                            className="px-2 py-1 bg-white border border-slate-200 hover:border-cyan-500 rounded text-[11px] font-medium"
                                        >
                                            + Góc kho
                                        </button>
                                    </div>
                                </div>

                                {periodicForm.photos.length === 0 ? (
                                    <div
                                        onClick={() => handleOpenCamera('CORNER', 'Góc kho & Thiết bị', 'periodic')}
                                        className="p-3 border border-dashed border-slate-300 rounded-lg text-center cursor-pointer bg-white"
                                    >
                                        <Camera className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                        <span className="text-xs text-slate-600 font-medium">Bấm để chụp ảnh hiện trường có Watermark</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {periodicForm.photos.map((p, idx) => (
                                            <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 group">
                                                <img src={p.thumbnailBase64 || p.photoBase64} alt={p.caption} className="w-full h-16 object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPeriodicForm(prev => ({
                                                            ...prev,
                                                            photos: prev.photos.filter((_, i) => i !== idx),
                                                        }))}
                                                        className="p-1 bg-rose-600 text-white rounded-full"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded truncate max-w-[95%]">
                                                    {p.caption}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Incident Notes & Proposed Solution */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Tổng kết sự cố / Rủi ro phát hiện
                                </label>
                                <textarea
                                    rows={2}
                                    value={periodicForm.incidentNotes}
                                    onChange={e => setPeriodicForm(prev => ({ ...prev, incidentNotes: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                                    placeholder="Ghi rõ chi tiết sự cố nếu có hạng mục Không đạt..."
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Đề xuất phương án khắc phục / Bảo trì
                                </label>
                                <input
                                    type="text"
                                    value={periodicForm.actionPlan}
                                    onChange={e => setPeriodicForm(prev => ({ ...prev, actionPlan: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                                    placeholder="Ví dụ: Gọi thợ bảo trì dàn lạnh, chêm lại chân pallet..."
                                />
                            </div>

                            {/* Submit */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpenPeriodicModal(false)
                                        setExecutingInspection(null)
                                    }}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-[#0E7490] hover:bg-[#155E75] disabled:opacity-50 text-white rounded-lg font-medium transition shadow-xs"
                                >
                                    {saving ? 'Đang lưu...' : 'Lưu phiếu kiểm tra định kỳ'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Detail Modal */}
            {openDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-lg w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Chi Tiết Phiếu Kiểm Tra Kho</h3>
                                <p className="text-xs text-slate-500">{selectedDetail?.inspectionNo}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenDetailModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-xs">
                            {loadingDetail ? (
                                <div className="py-12 text-center text-slate-400">Đang tải chi tiết...</div>
                            ) : selectedDetail ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <span className="text-slate-500">Kho:</span>{' '}
                                            <span className="font-semibold text-slate-800">{selectedDetail.warehouse?.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Ngày:</span>{' '}
                                            <span className="font-semibold text-slate-800">{new Date(selectedDetail.inspectionDate).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Người KT:</span>{' '}
                                            <span className="font-semibold text-slate-800">{selectedDetail.inspector?.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Kết quả:</span>{' '}
                                            <span className={`font-semibold ${selectedDetail.overallResult === 'PASSED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {selectedDetail.overallResult === 'PASSED' ? 'Đạt chuẩn' : 'Có cảnh báo'}
                                            </span>
                                        </div>
                                        {selectedDetail.assignedBy && (
                                            <div>
                                                <span className="text-slate-500">Phân công bởi:</span>{' '}
                                                <span className="font-semibold text-slate-800">{selectedDetail.assignedBy.name}</span>
                                            </div>
                                        )}
                                        {selectedDetail.dueDate && (
                                            <div>
                                                <span className="text-slate-500">Thời hạn ca:</span>{' '}
                                                <span className="font-semibold text-slate-800">
                                                    {new Date(selectedDetail.dueDate).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Temperatures */}
                                    {selectedDetail.type === 'DAILY_TEMP_HUMIDITY' && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center p-3 border border-slate-200 rounded-lg">
                                            <div>
                                                <div className="text-[10px] text-slate-500">VT #1 (Cửa)</div>
                                                <div className="font-mono font-bold text-slate-900 mt-0.5">{selectedDetail.temp1 ? `${selectedDetail.temp1}°C` : '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500">VT #2 (Giữa)</div>
                                                <div className="font-mono font-bold text-slate-900 mt-0.5">{selectedDetail.temp2 ? `${selectedDetail.temp2}°C` : '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500">VT #3 (Góc xa)</div>
                                                <div className="font-mono font-bold text-slate-900 mt-0.5">{selectedDetail.temp3 ? `${selectedDetail.temp3}°C` : '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-500">Độ ẩm</div>
                                                <div className="font-mono font-bold text-cyan-800 mt-0.5">{selectedDetail.humidity ? `${selectedDetail.humidity}%` : '-'}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Items List */}
                                    {selectedDetail.items && selectedDetail.items.length > 0 && (
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700">Chi tiết các hạng mục kiểm tra</div>
                                            <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                                {selectedDetail.items.map((it: any) => (
                                                    <div key={it.id} className="p-2 flex items-center justify-between text-[11px]">
                                                        <div>
                                                            <span className="font-mono text-slate-400 mr-1">{it.itemCode}</span>
                                                            <span className="font-medium text-slate-800">{it.itemName}</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded font-semibold ${it.isPassed ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                                            {it.isPassed ? 'Đạt' : 'Không đạt'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Photos Grid */}
                                    {selectedDetail.photos && selectedDetail.photos.length > 0 && (
                                        <div>
                                            <div className="font-bold text-slate-700 mb-1.5">Ảnh chụp hiện trường ({selectedDetail.photos.length} ảnh)</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {selectedDetail.photos.map((p: any) => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => setViewPhotoUrl(p.photoUrl)}
                                                        className="cursor-pointer border border-slate-200 rounded-lg overflow-hidden group hover:opacity-90"
                                                    >
                                                        <img src={p.thumbnailUrl || p.photoUrl} alt={p.category} className="w-full h-24 object-cover" />
                                                        <div className="p-1 bg-slate-50 text-[10px] text-slate-600 truncate font-medium">
                                                            {p.caption || p.category}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Incident Notes */}
                                    {selectedDetail.incidentNotes && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <span className="font-semibold text-amber-900 block mb-0.5">Sự cố ghi nhận:</span>
                                            <p className="text-amber-800 whitespace-pre-line">{selectedDetail.incidentNotes}</p>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 4: Manager Approval Modal */}
            {openApproveModal && approveInspection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-rose-50">
                            <div>
                                <h3 className="text-sm font-bold text-rose-900">Phê Duyệt Phương Án Khắc Phục Sự Cố</h3>
                                <p className="text-xs text-rose-700">{approveInspection.inspectionNo} • {approveInspection.warehouse?.name}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenApproveModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                <span className="font-semibold text-slate-700">Mô tả sự cố:</span>
                                <p className="text-slate-800 whitespace-pre-line">{approveInspection.incidentNotes || 'Không có mô tả'}</p>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Phương án xử lý đã thống nhất
                                </label>
                                <textarea
                                    rows={2}
                                    value={approveActionPlan}
                                    onChange={e => setApproveActionPlan(e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                                    placeholder="Nhập phương án khắc phục sự cố..."
                                />
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Ý kiến chỉ đạo của Quản lý / BGĐ
                                </label>
                                <textarea
                                    rows={2}
                                    value={approveFeedback}
                                    onChange={e => setApproveFeedback(e.target.value)}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                                    placeholder="Xác nhận phương án, thời hạn hoàn thành, phân công người chịu trách nhiệm..."
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpenApproveModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmApprove}
                                    disabled={approving}
                                    className="px-5 py-2.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg font-medium transition shadow-xs"
                                >
                                    {approving ? 'Đang duyệt...' : 'Xác nhận & Duyệt xử lý'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 6: Assign / Reassign Warehouse Inspection */}
            {openAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
                    <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-sky-50">
                            <div className="flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-sky-700" />
                                <div>
                                    <h3 className="text-sm font-bold text-sky-950">
                                        {assignForm.inspectionId ? 'Phân Công Lại Nhân Viên Kiểm Tra' : 'Tạo & Phân Công Ca Kiểm Tra Kho'}
                                    </h3>
                                    <p className="text-xs text-sky-700">
                                        {assignForm.inspectionId ? 'Chuyển quyền thực hiện cho nhân sự khác' : 'Giao ca đo nhiệt ẩm hoặc kiểm tra định kỳ'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpenAssignModal(false)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmAssign} className="p-5 space-y-4 text-xs">
                            {/* Warehouse & Type */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Kho kiểm tra</label>
                                    <select
                                        value={assignForm.warehouseId}
                                        onChange={e => setAssignForm(prev => ({ ...prev, warehouseId: e.target.value }))}
                                        disabled={!!assignForm.inspectionId}
                                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600 disabled:opacity-60"
                                    >
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>
                                                {w.name} ({w.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Loại kiểm tra</label>
                                    <select
                                        value={assignForm.type}
                                        onChange={e => setAssignForm(prev => ({ ...prev, type: e.target.value as any }))}
                                        disabled={!!assignForm.inspectionId}
                                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600 disabled:opacity-60"
                                    >
                                        <option value="DAILY_TEMP_HUMIDITY">Sổ nhiệt ẩm 12h (Hàng ngày)</option>
                                        <option value="PERIODIC_AUDIT">Kiểm tra định kỳ (Thứ 2 & 5)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Inspection Date & Shift */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">Ngày kiểm tra</label>
                                    <input
                                        type="date"
                                        value={assignForm.inspectionDate}
                                        onChange={e => setAssignForm(prev => ({ ...prev, inspectionDate: e.target.value }))}
                                        disabled={!!assignForm.inspectionId}
                                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600 disabled:opacity-60"
                                    />
                                </div>

                                {assignForm.type === 'DAILY_TEMP_HUMIDITY' ? (
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Ca đo</label>
                                        <select
                                            value={assignForm.shift}
                                            onChange={e => setAssignForm(prev => ({ ...prev, shift: e.target.value as any }))}
                                            disabled={!!assignForm.inspectionId}
                                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600 disabled:opacity-60"
                                        >
                                            <option value="MORNING">Ca Sáng (08:00)</option>
                                            <option value="AFTERNOON">Ca Chiều (16:00)</option>
                                            <option value="EVENING">Ca Tối</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block font-semibold text-slate-700 mb-1">Thời hạn hoàn thành</label>
                                        <input
                                            type="datetime-local"
                                            value={assignForm.dueDate}
                                            onChange={e => setAssignForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                            className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Due Date if Daily */}
                            {assignForm.type === 'DAILY_TEMP_HUMIDITY' && (
                                <div>
                                    <label className="block font-semibold text-slate-700 mb-1">
                                        Thời hạn ca (Tùy chọn)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={assignForm.dueDate}
                                        onChange={e => setAssignForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                        placeholder="Để trống sẽ tự động lấy 12:00 (Sáng) hoặc 18:00 (Chiều)"
                                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-sky-600"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Ca sáng mặc định chốt trước 12:00, Ca chiều chốt trước 18:00. Sau giờ này phiếu sẽ chuyển sang Quá hạn.
                                    </p>
                                </div>
                            )}

                            {/* Staff Assignee */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Nhân viên được giao việc <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    required
                                    value={assignForm.assignedToId}
                                    onChange={e => setAssignForm(prev => ({ ...prev, assignedToId: e.target.value }))}
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:border-sky-600"
                                >
                                    <option value="">-- Chọn nhân viên chịu trách nhiệm --</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Notes / Instructions */}
                            <div>
                                <label className="block font-semibold text-slate-700 mb-1">
                                    Ghi chú / Chỉ đạo của quản lý (nếu có)
                                </label>
                                <textarea
                                    rows={2}
                                    value={assignForm.notes}
                                    onChange={e => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Lưu ý kiểm tra kỹ góc kho B, kiểm tra đường ống máy lạnh..."
                                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-600"
                                />
                            </div>

                            {/* Telegram Notification Notice */}
                            <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-lg flex items-center gap-2 text-sky-800 text-[11px]">
                                <Send className="w-4 h-4 shrink-0 text-sky-600" />
                                <span>Hệ thống sẽ tự động gửi tin nhắn Telegram Bot thông báo lịch phân công cho nhân viên.</span>
                            </div>

                            {/* Submit & Cancel */}
                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpenAssignModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={assigning || !assignForm.assignedToId}
                                    className="px-5 py-2.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg font-bold transition shadow-xs flex items-center gap-1.5"
                                >
                                    {assigning ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Đang xử lý...</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserCheck className="w-4 h-4" />
                                            <span>{assignForm.inspectionId ? 'Cập nhật phân công' : 'Giao việc & Gửi Telegram'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: Full Photo Lightbox View */}
            {viewPhotoUrl && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
                    onClick={() => setViewPhotoUrl(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
                        <img
                            src={viewPhotoUrl}
                            alt="Ảnh kiểm tra kho phóng to"
                            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                        />
                        <button
                            type="button"
                            onClick={() => setViewPhotoUrl(null)}
                            className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* LIVE CAMERA MODAL WITH TIMEMARK WATERMARK */}
            {cameraOpen && (
                <LiveCameraInspectionModal
                    title={`Chụp ảnh: ${cameraCategoryLabel}`}
                    warehouseName={selectedWarehouse?.name || 'Kho'}
                    category={cameraCategory}
                    categoryLabel={cameraCategoryLabel}
                    onCapture={handlePhotoCaptured}
                    onClose={() => setCameraOpen(false)}
                />
            )}
        </div>
    )
}
