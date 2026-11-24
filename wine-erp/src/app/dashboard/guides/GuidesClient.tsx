'use client'

import { useState, useMemo, useRef } from 'react'
import {
    PlayCircle, Upload, Trash2, Pencil, Film, Clock,
    HardDrive, Layers, CheckCircle2, EyeOff, Plus
} from 'lucide-react'
import { toast } from 'sonner'
import {
    Badge, Button, Card, EmptyState, Field, Input, Modal,
    PageContainer, PageHeader, SearchInput, Select, Textarea, useConfirmDialog,
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { GUIDE_SCREENS } from './constants'
import {
    requestVideoUploadUrlAction,
    createVideoGuideAction,
    updateVideoGuideAction,
    deleteVideoGuideAction,
    type VideoGuideDTO,
} from './actions'

interface GuidesClientProps {
    initialGuides: VideoGuideDTO[]
    canManage: boolean
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(sec: number | null): string {
    if (!sec || sec <= 0) return '--:--'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function extractVideoDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        const objectUrl = URL.createObjectURL(file)
        video.onloadedmetadata = () => {
            const dur = Number.isFinite(video.duration) ? Math.round(video.duration) : null
            URL.revokeObjectURL(objectUrl)
            resolve(dur)
        }
        video.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(null)
        }
        video.src = objectUrl
    })
}

function uploadFileWithProgress(
    uploadUrl: string,
    file: File,
    mimeType: string,
    onProgress: (pct: number) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', uploadUrl, true)
        xhr.setRequestHeader('Content-Type', mimeType)

        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable && evt.total > 0) {
                onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)))
            }
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress(100)
                resolve()
            } else {
                reject(new Error(`Upload failed (HTTP ${xhr.status})`))
            }
        }
        xhr.onerror = () => reject(new Error('Lỗi kết nối khi đẩy video lên Cloudflare R2 (kiểm tra CORS bucket)'))
        xhr.send(file)
    })
}

export function GuidesClient({ initialGuides, canManage }: GuidesClientProps) {
    const { locale } = useAppLocale()
    const isEn = locale === 'en'

    const [guides, setGuides] = useState<VideoGuideDTO[]>(initialGuides)
    const [selectedScreen, setSelectedScreen] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeVideoId, setActiveVideoId] = useState<string | null>(initialGuides[0]?.id ?? null)

    // Upload / Edit Modal state
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingGuide, setEditingGuide] = useState<VideoGuideDTO | null>(null)
    const [formScreenKey, setFormScreenKey] = useState<string>(GUIDE_SCREENS[0].key)
    const [customScreenLabel, setCustomScreenLabel] = useState('')
    const [formTitle, setFormTitle] = useState('')
    const [formDescription, setFormDescription] = useState('')
    const [formSortOrder, setFormSortOrder] = useState<number>(0)
    const [formPublished, setFormPublished] = useState<boolean>(true)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [uploadProgress, setUploadProgress] = useState<number>(0)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // Build screen list combining preset GUIDE_SCREENS + any custom screens in DB
    const screenTabs = useMemo(() => {
        const countMap = new Map<string, number>()
        const customMap = new Map<string, string>()

        for (const g of guides) {
            countMap.set(g.screenKey, (countMap.get(g.screenKey) || 0) + 1)
            if (!GUIDE_SCREENS.some((s) => s.key === g.screenKey)) {
                customMap.set(g.screenKey, g.screenLabel)
            }
        }

        const presets = GUIDE_SCREENS.map((s) => ({
            key: s.key,
            label: isEn ? s.labelEn : s.label,
            description: isEn ? s.descriptionEn : s.description,
            count: countMap.get(s.key) || 0,
        }))

        const customs = Array.from(customMap.entries()).map(([key, label]) => ({
            key,
            label,
            description: '',
            count: countMap.get(key) || 0,
        }))

        return [...presets, ...customs]
    }, [guides, isEn])

    const filteredGuides = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return guides.filter((g) => {
            if (selectedScreen !== 'ALL' && g.screenKey !== selectedScreen) return false
            if (!q) return true
            return (
                g.title.toLowerCase().includes(q) ||
                (g.description || '').toLowerCase().includes(q) ||
                g.screenLabel.toLowerCase().includes(q)
            )
        })
    }, [guides, selectedScreen, searchQuery])

    const activeVideo = useMemo(() => {
        if (filteredGuides.length === 0) return null
        return filteredGuides.find((g) => g.id === activeVideoId) || filteredGuides[0]
    }, [filteredGuides, activeVideoId])

    const openUploadModal = () => {
        setEditingGuide(null)
        setFormScreenKey(selectedScreen !== 'ALL' ? selectedScreen : GUIDE_SCREENS[0].key)
        setCustomScreenLabel('')
        setFormTitle('')
        setFormDescription('')
        setFormSortOrder(0)
        setFormPublished(true)
        setSelectedFile(null)
        setUploadProgress(0)
        setIsModalOpen(true)
    }

    const openEditModal = (guide: VideoGuideDTO) => {
        const isPreset = GUIDE_SCREENS.some((s) => s.key === guide.screenKey)
        setEditingGuide(guide)
        setFormScreenKey(isPreset ? guide.screenKey : '__custom__')
        setCustomScreenLabel(isPreset ? '' : guide.screenLabel)
        setFormTitle(guide.title)
        setFormDescription(guide.description || '')
        setFormSortOrder(guide.sortOrder)
        setFormPublished(guide.isPublished)
        setSelectedFile(null)
        setUploadProgress(0)
        setIsModalOpen(true)
    }

    const handleSelectFile = (file: File | null) => {
        if (!file) return
        setSelectedFile(file)
        if (!formTitle.trim()) {
            const base = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ')
            setFormTitle(base)
        }
    }

    const handleSubmitModal = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formTitle.trim()) {
            toast.error(isEn ? 'Please enter a video title' : 'Vui lòng nhập tiêu đề video')
            return
        }

        const resolvedScreenKey =
            formScreenKey === '__custom__'
                ? customScreenLabel
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, '') || 'general'
                : formScreenKey

        const resolvedScreenLabel =
            formScreenKey === '__custom__'
                ? customScreenLabel.trim() || resolvedScreenKey
                : GUIDE_SCREENS.find((s) => s.key === formScreenKey)?.label || resolvedScreenKey

        setIsSubmitting(true)
        try {
            if (editingGuide) {
                const res = await updateVideoGuideAction(editingGuide.id, {
                    screenKey: resolvedScreenKey,
                    screenLabel: resolvedScreenLabel,
                    title: formTitle.trim(),
                    description: formDescription.trim() || null,
                    sortOrder: formSortOrder,
                    isPublished: formPublished,
                })
                if (!res.success) {
                    toast.error(res.error || 'Lỗi cập nhật video')
                    return
                }
                setGuides((prev) =>
                    prev.map((g) =>
                        g.id === editingGuide.id
                            ? {
                                  ...g,
                                  screenKey: resolvedScreenKey,
                                  screenLabel: resolvedScreenLabel,
                                  title: formTitle.trim(),
                                  description: formDescription.trim() || null,
                                  sortOrder: formSortOrder,
                                  isPublished: formPublished,
                              }
                            : g
                    )
                )
                toast.success(isEn ? 'Video guide updated' : 'Đã cập nhật video hướng dẫn')
                setIsModalOpen(false)
                return
            }

            // New upload flow: presigned PUT -> Cloudflare R2 -> save DB metadata
            if (!selectedFile) {
                toast.error(isEn ? 'Please select a video file' : 'Vui lòng chọn file video')
                return
            }

            const durationSec = await extractVideoDuration(selectedFile)
            const presign = await requestVideoUploadUrlAction({
                fileName: selectedFile.name,
                mimeType: selectedFile.type || 'video/mp4',
                fileSize: selectedFile.size,
                screenKey: resolvedScreenKey,
            })

            if (!presign.success || !presign.uploadUrl || !presign.storagePath) {
                toast.error(presign.error || 'Không thể khởi tạo upload R2')
                return
            }

            await uploadFileWithProgress(
                presign.uploadUrl,
                selectedFile,
                presign.mimeType || 'video/mp4',
                setUploadProgress
            )

            const created = await createVideoGuideAction({
                screenKey: resolvedScreenKey,
                screenLabel: resolvedScreenLabel,
                title: formTitle.trim(),
                description: formDescription.trim() || undefined,
                storagePath: presign.storagePath,
                fileName: selectedFile.name,
                fileSize: selectedFile.size,
                mimeType: presign.mimeType || 'video/mp4',
                durationSec,
                sortOrder: formSortOrder,
                isPublished: formPublished,
            })

            if (!created.success || !created.data) {
                toast.error(created.error || 'Lỗi lưu metadata video')
                return
            }

            setGuides((prev) => [created.data!, ...prev])
            setSelectedScreen(resolvedScreenKey)
            setActiveVideoId(created.data.id)
            toast.success(isEn ? 'Video uploaded to R2' : 'Đã tải video lên R2 thành công')
            setIsModalOpen(false)
        } catch (err: any) {
            toast.error(err?.message || 'Có lỗi xảy ra khi tải video')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = (guide: VideoGuideDTO) => {
        confirm({
            title: isEn ? 'Delete Video Guide' : 'Xóa Video Hướng Dẫn',
            message: isEn
                ? `Are you sure you want to delete "${guide.title}" from R2 and database?`
                : `Bạn có chắc chắn muốn xóa video "${guide.title}" khỏi R2 và hệ thống?`,
            confirmLabel: isEn ? 'Delete' : 'Xóa',
            cancelLabel: isEn ? 'Cancel' : 'Hủy',
            danger: true,
            onConfirm: async () => {
                const res = await deleteVideoGuideAction(guide.id)
                if (!res.success) {
                    toast.error(res.error || 'Không thể xóa video')
                    return
                }
                setGuides((prev) => prev.filter((g) => g.id !== guide.id))
                if (activeVideoId === guide.id) {
                    setActiveVideoId(null)
                }
                toast.success(isEn ? 'Deleted video guide' : 'Đã xóa video hướng dẫn')
            },
        })
    }

    return (
        <PageContainer>
            <PageHeader
                description={
                    isEn
                        ? 'Screen-by-screen walkthrough videos stored and streamed directly from Cloudflare R2.'
                        : 'Thư viện video hướng dẫn thao tác chia theo từng màn hình ERP, phát trực tiếp từ Cloudflare R2.'
                }
                actions={
                    canManage ? (
                        <Button size="sm" onClick={openUploadModal}>
                            <Upload size={14} aria-hidden />
                            <span>{isEn ? 'Upload Video to R2' : 'Tải Video Lên R2'}</span>
                        </Button>
                    ) : undefined
                }
            />

            {/* Main 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left: Screen Categories */}
                <Card className="lg:col-span-3 p-3 space-y-3">
                    <SearchInput
                        className="w-full sm:w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isEn ? 'Search video...' : 'Tìm video hướng dẫn...'}
                    />

                    <div className="space-y-1">
                        <button
                            type="button"
                            onClick={() => setSelectedScreen('ALL')}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                                selectedScreen === 'ALL'
                                    ? 'bg-lys-teal-soft text-lys-teal-strong font-semibold'
                                    : 'text-lys-secondary hover:bg-lys-subtle hover:text-lys-primary'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Layers size={14} aria-hidden />
                                <span>{isEn ? 'All Screens' : 'Tất cả màn hình'}</span>
                            </span>
                            <Badge tone={selectedScreen === 'ALL' ? 'brand' : 'neutral'}>{guides.length}</Badge>
                        </button>

                        <div className="pt-1 border-t border-lys-border space-y-0.5">
                            {screenTabs.map((screen) => {
                                const isActive = selectedScreen === screen.key
                                return (
                                    <button
                                        key={screen.key}
                                        type="button"
                                        onClick={() => setSelectedScreen(screen.key)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs text-left transition-colors cursor-pointer ${
                                            isActive
                                                ? 'bg-lys-teal-soft text-lys-teal-strong font-semibold'
                                                : 'text-lys-secondary hover:bg-lys-subtle hover:text-lys-primary'
                                        }`}
                                        title={screen.description || screen.label}
                                    >
                                        <span className="truncate pr-2">{screen.label}</span>
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium type-number shrink-0 ${
                                                screen.count > 0
                                                    ? 'bg-lys-subtle text-lys-secondary'
                                                    : 'text-lys-dim'
                                            }`}
                                        >
                                            {screen.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </Card>

                {/* Right: Video Player + Playlist */}
                <div className="lg:col-span-9 space-y-4">
                    {activeVideo ? (
                        <Card className="overflow-hidden">
                            <div className="bg-slate-950">
                                <video
                                    key={activeVideo.id}
                                    src={activeVideo.streamUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="w-full aspect-video max-h-[520px] mx-auto"
                                />
                            </div>

                            <div className="p-4 md:p-5 space-y-2.5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge tone="brand">{activeVideo.screenLabel}</Badge>
                                            {!activeVideo.isPublished && (
                                                <Badge tone="warning" icon={EyeOff}>
                                                    {isEn ? 'Hidden' : 'Đang ẩn'}
                                                </Badge>
                                            )}
                                        </div>
                                        <h2 className="type-section-title text-lys-primary">
                                            {activeVideo.title}
                                        </h2>
                                    </div>

                                    {canManage && (
                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => openEditModal(activeVideo)}
                                            >
                                                <Pencil size={13} aria-hidden />
                                                <span>{isEn ? 'Edit' : 'Sửa'}</span>
                                            </Button>
                                            <Button
                                                variant="danger-outline"
                                                size="sm"
                                                onClick={() => handleDelete(activeVideo)}
                                            >
                                                <Trash2 size={13} aria-hidden />
                                                <span>{isEn ? 'Delete' : 'Xóa'}</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {activeVideo.description && (
                                    <p className="type-body text-lys-secondary leading-relaxed whitespace-pre-line">
                                        {activeVideo.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-lys-border text-xs text-lys-muted">
                                    <span className="inline-flex items-center gap-1 type-number">
                                        <Clock size={12} aria-hidden />
                                        {formatDuration(activeVideo.durationSec)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 type-number">
                                        <HardDrive size={12} aria-hidden />
                                        {formatBytes(activeVideo.fileSize)}
                                    </span>
                                    {activeVideo.uploadedByName && (
                                        <span>
                                            {isEn ? 'Uploaded by:' : 'Người đăng:'} {activeVideo.uploadedByName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <Card>
                            <EmptyState
                                icon={Film}
                                title={
                                    isEn
                                        ? 'No tutorial videos for this screen yet'
                                        : 'Chưa có video hướng dẫn cho màn hình này'
                                }
                                description={
                                    canManage
                                        ? isEn
                                            ? 'Click "Upload Video to R2" to add the first walkthrough.'
                                            : 'Bấm "Tải Video Lên R2" để thêm video hướng dẫn đầu tiên.'
                                        : isEn
                                          ? 'Select another screen on the left to watch available guides.'
                                          : 'Chọn màn hình khác ở danh sách bên trái để xem video hiện có.'
                                }
                                action={
                                    canManage ? (
                                        <Button size="sm" onClick={openUploadModal}>
                                            <Plus size={14} aria-hidden />
                                            <span>{isEn ? 'Upload Video' : 'Tải Video Lên'}</span>
                                        </Button>
                                    ) : undefined
                                }
                            />
                        </Card>
                    )}

                    {/* Playlist */}
                    {filteredGuides.length > 0 && (
                        <Card className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-lys-muted">
                                    {isEn
                                        ? `Playlist (${filteredGuides.length} videos)`
                                        : `Danh sách phát (${filteredGuides.length} video)`}
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {filteredGuides.map((video) => {
                                    const isCurrent = activeVideo?.id === video.id
                                    return (
                                        <button
                                            key={video.id}
                                            type="button"
                                            onClick={() => setActiveVideoId(video.id)}
                                            className={`flex items-start gap-3 p-3 rounded-md border text-left transition-all cursor-pointer ${
                                                isCurrent
                                                    ? 'border-lys-teal-strong bg-lys-teal-soft/60'
                                                    : 'border-lys-border hover:bg-lys-subtle'
                                            }`}
                                        >
                                            <PlayCircle
                                                size={18}
                                                className={`mt-0.5 shrink-0 ${
                                                    isCurrent ? 'text-lys-teal-strong' : 'text-lys-muted'
                                                }`}
                                            />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="text-xs font-semibold text-lys-primary truncate">
                                                    {video.title}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-lys-muted">
                                                    <span className="truncate max-w-[140px]">
                                                        {video.screenLabel}
                                                    </span>
                                                    <span>·</span>
                                                    <span className="type-number">{formatDuration(video.durationSec)}</span>
                                                    <span>·</span>
                                                    <span className="type-number">{formatBytes(video.fileSize)}</span>
                                                    {!video.isPublished && (
                                                        <span className="text-tone-warning-fg font-medium">
                                                            ({isEn ? 'Hidden' : 'Ẩn'})
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Upload / Edit Modal */}
            <Modal
                open={isModalOpen}
                onClose={() => { if (!isSubmitting) setIsModalOpen(false) }}
                size="lg"
                title={
                    editingGuide
                        ? (isEn ? 'Edit Video Guide' : 'Chỉnh Sửa Video Hướng Dẫn')
                        : (isEn ? 'Upload Tutorial Video to R2' : 'Tải Video Hướng Dẫn Lên R2')
                }
                footer={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => setIsModalOpen(false)}
                        >
                            {isEn ? 'Cancel' : 'Hủy'}
                        </Button>
                        <Button
                            type="submit"
                            form="guide-upload-form"
                            size="sm"
                            loading={isSubmitting}
                        >
                            {!isSubmitting && <CheckCircle2 size={14} aria-hidden />}
                            <span>
                                {isSubmitting
                                    ? (isEn ? 'Processing...' : 'Đang xử lý...')
                                    : editingGuide
                                      ? (isEn ? 'Save Changes' : 'Lưu Thay Đổi')
                                      : (isEn ? 'Upload & Save' : 'Tải Lên & Lưu')}
                            </span>
                        </Button>
                    </>
                }
            >
                <form id="guide-upload-form" onSubmit={handleSubmitModal} className="space-y-4">
                    <Field label={isEn ? 'Screen / Module' : 'Màn hình / Phân hệ'}>
                        {id => (
                            <Select
                                id={id}
                                value={formScreenKey}
                                onChange={(e) => setFormScreenKey(e.target.value)}
                            >
                                {GUIDE_SCREENS.map((s) => (
                                    <option key={s.key} value={s.key}>
                                        {isEn ? s.labelEn : s.label}
                                    </option>
                                ))}
                                <option value="__custom__">
                                    {isEn ? '+ Custom screen name...' : '+ Tự nhập tên màn hình khác...'}
                                </option>
                            </Select>
                        )}
                    </Field>

                    {formScreenKey === '__custom__' && (
                        <Field label={isEn ? 'Custom Screen Name' : 'Tên màn hình mới'} required>
                            {id => (
                                <Input
                                    id={id}
                                    type="text"
                                    required
                                    value={customScreenLabel}
                                    onChange={(e) => setCustomScreenLabel(e.target.value)}
                                    placeholder={isEn ? 'e.g. Stock Count Mobile' : 'Ví dụ: Kiểm kê kho trên điện thoại'}
                                />
                            )}
                        </Field>
                    )}

                    <Field label={isEn ? 'Video Title' : 'Tiêu đề video'} required>
                        {id => (
                            <Input
                                id={id}
                                type="text"
                                required
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder={
                                    isEn
                                        ? 'e.g. How to create a Sales Quotation'
                                        : 'Ví dụ: Hướng dẫn tạo Báo giá & gửi PDF cho khách'
                                }
                            />
                        )}
                    </Field>

                    <Field label={isEn ? 'Description / Notes' : 'Mô tả ngắn / Ghi chú'}>
                        {id => (
                            <Textarea
                                id={id}
                                rows={3}
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder={
                                    isEn
                                        ? 'Key steps covered in this video...'
                                        : 'Tóm tắt các bước thao tác trong video...'
                                }
                            />
                        )}
                    </Field>

                    {!editingGuide && (
                        <Field label={isEn ? 'Video File (MP4, WebM, MOV — max 500MB)' : 'File Video (MP4, WebM, MOV — tối đa 500MB)'} required>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                                onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-dashed border-lys-border-strong bg-lys-subtle/60 hover:border-lys-teal-strong text-xs cursor-pointer transition-colors"
                            >
                                <span className="truncate text-lys-primary">
                                    {selectedFile
                                        ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
                                        : isEn
                                          ? 'Click to choose video file...'
                                          : 'Bấm để chọn file video từ máy tính...'}
                                </span>
                                <Upload size={14} className="text-lys-teal-strong shrink-0 ml-2" aria-hidden />
                            </button>
                        </Field>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                        <Field label={isEn ? 'Display Order' : 'Thứ tự hiển thị'}>
                            {id => (
                                <Input
                                    id={id}
                                    type="number"
                                    value={formSortOrder}
                                    onChange={(e) => setFormSortOrder(Number(e.target.value) || 0)}
                                />
                            )}
                        </Field>
                        <label className="flex items-center gap-2 sm:pt-5 text-xs text-lys-primary cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={formPublished}
                                onChange={(e) => setFormPublished(e.target.checked)}
                                className="rounded border-lys-border-strong text-lys-teal-strong"
                            />
                            <span>{isEn ? 'Published to all users' : 'Hiển thị cho mọi nhân viên'}</span>
                        </label>
                    </div>

                    {isSubmitting && !editingGuide && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-lys-muted">
                                <span>
                                    {uploadProgress < 100
                                        ? isEn
                                            ? 'Uploading to Cloudflare R2...'
                                            : 'Đang đẩy video lên Cloudflare R2...'
                                        : isEn
                                          ? 'Saving metadata...'
                                          : 'Đang lưu thông tin...'}
                                </span>
                                <span className="font-semibold text-lys-teal-strong type-number">
                                    {uploadProgress}%
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-lys-subtle rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-lys-teal-strong transition-all duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </form>
            </Modal>

            {confirmDialog}
        </PageContainer>
    )
}
