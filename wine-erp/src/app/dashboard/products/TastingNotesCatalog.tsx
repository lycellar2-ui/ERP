'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    FileText,
    Eye,
    Download,
    Upload,
    CheckCircle2,
    AlertCircle,
    Edit2,
    ExternalLink,
    X,
    Loader2,
    ImageOff,
    FolderOpen,
    Plus,
    Trash2,
    FileCheck,
    FlaskConical,
    FileDiff,
    Calendar,
    Building2,
} from 'lucide-react'
import {
    Button,
    SearchInput,
    Select,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    TableSkeleton,
    TableMessageRow,
} from '@/components/ui'
import { WineTypeBadge } from '@/components/WineTypeBadge'
import {
    TastingNoteCatalogItem,
    ProductLegalDocGroup,
    ProductLegalDocItem,
    getTastingNoteCatalog,
    uploadProductTastingNote,
    uploadProductLegalDoc,
    deleteProductLegalDoc,
} from './actions'
import { toast } from 'sonner'

const COUNTRY_NAMES: Record<string, string> = {
    FR: 'Pháp',
    IT: 'Ý',
    ES: 'Tây Ban Nha',
    PT: 'Bồ Đào Nha',
    DE: 'Đức',
    US: 'Mỹ',
    AU: 'Úc',
    NZ: 'New Zealand',
    AR: 'Argentina',
    CL: 'Chile',
    ZA: 'Nam Phi',
}

type DocFilter =
    | 'ALL'
    | 'HAS_TN'
    | 'MISSING_TN'
    | 'HAS_TCB'
    | 'MISSING_TCB'
    | 'HAS_AMENDMENT'
    | 'HAS_TESTING'

interface TastingNotesCatalogProps {
    canEdit: boolean
    onViewProduct: (id: string) => void
    onEditProduct: (id: string) => void
}

function getShortFileName(url: string | null): string {
    if (!url) return ''
    try {
        const clean = decodeURIComponent(url.split('?')[0])
        const base = clean.split('/').pop() || clean
        return base.replace(/^\d{10,}_/, '')
    } catch {
        return url.split('/').pop() || 'document.pdf'
    }
}

function formatShortDate(iso: string | null | undefined): string {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return ''
        return d.toLocaleDateString('vi-VN')
    } catch {
        return ''
    }
}

function getPreviewUrl(url: string): { type: 'image' | 'office' | 'pdf'; src: string } {
    if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url)) {
        return { type: 'image', src: url }
    }
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i.test(url)) {
        return {
            type: 'office',
            src: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
        }
    }
    return { type: 'pdf', src: url }
}

const GROUP_META: Record<
    ProductLegalDocGroup,
    {
        label: string
        shortLabel: string
        badgeClass: string
        authorityPlaceholder: string
        namePlaceholder: string
    }
> = {
    TCB: {
        label: 'Bản Tự Công Bố Sản Phẩm (TCB)',
        shortLabel: 'Tự công bố (TCB)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        authorityPlaceholder: 'Chi cục ATTP Hà Nội / Tự công bố',
        namePlaceholder: 'VD: Bản Tự Công Bố số 53/2023/TCB-TA',
    },
    AMENDMENT: {
        label: 'Thông Báo Thay Đổi / Công Văn Cập Nhật Sau TCB',
        shortLabel: 'Thông báo thay đổi',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        authorityPlaceholder: 'Chi cục ATTP Hà Nội',
        namePlaceholder: 'VD: Công văn bổ sung nhãn / cập nhật nồng độ cồn',
    },
    TESTING: {
        label: 'Phiếu Kiểm Định / Kết Quả Kiểm Nghiệm ATTP',
        shortLabel: 'Phiếu kiểm định',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        authorityPlaceholder: 'Eurofins Sắc Ký Hải Đăng / Viện Kiểm nghiệm Quốc gia (NIFC)',
        namePlaceholder: 'VD: Phiếu kết quả thử nghiệm AR-242-2026-00018102',
    },
}

export function TastingNotesCatalog({
    canEdit,
    onViewProduct,
    onEditProduct,
}: TastingNotesCatalogProps) {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [docFilter, setDocFilter] = useState<DocFilter>('ALL')
    const [countryFilter, setCountryFilter] = useState('')
    const [wineTypeFilter, setWineTypeFilter] = useState('')
    const [uploadingKey, setUploadingKey] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null)
    const [dossierProductId, setDossierProductId] = useState<string | null>(null)
    const [activeDossierSection, setActiveDossierSection] = useState<
        'ALL' | 'TN' | ProductLegalDocGroup
    >('ALL')

    // Upload form inside Dossier Drawer
    const [uploadFormGroup, setUploadFormGroup] = useState<ProductLegalDocGroup | null>(null)
    const [uploadName, setUploadName] = useState('')
    const [uploadDocNo, setUploadDocNo] = useState('')
    const [uploadIssueDate, setUploadIssueDate] = useState(() =>
        new Date().toISOString().slice(0, 10)
    )
    const [uploadAuthority, setUploadAuthority] = useState('')
    const [uploadDescription, setUploadDescription] = useState('')
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [isSubmittingLegalDoc, setIsSubmittingLegalDoc] = useState(false)
    const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

    const tnInputRef = useRef<HTMLInputElement>(null)
    const quickLegalInputRef = useRef<HTMLInputElement>(null)
    const [activeUploadTarget, setActiveUploadTarget] = useState<{
        productId: string
        type: 'TN' | ProductLegalDocGroup
    } | null>(null)

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['products-tasting-note-catalog'],
        queryFn: () => getTastingNoteCatalog(),
        staleTime: 20_000,
    })

    const activeDossierItem = useMemo(
        () => items.find(i => i.id === dossierProductId) || null,
        [items, dossierProductId]
    )

    useEffect(() => {
        if (!previewDoc && !dossierProductId) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                if (previewDoc) {
                    setPreviewDoc(null)
                } else if (uploadFormGroup) {
                    setUploadFormGroup(null)
                } else if (dossierProductId) {
                    setDossierProductId(null)
                }
            }
        }
        window.addEventListener('keydown', handleKey, true)
        return () => window.removeEventListener('keydown', handleKey, true)
    }, [previewDoc, dossierProductId, uploadFormGroup])

    const counts = useMemo(() => {
        const total = items.length
        const hasTn = items.filter(i => Boolean(i.tastingNoteUrl)).length
        const missingTn = total - hasTn
        const hasTcb = items.filter(
            i => Boolean(i.selfDeclarationUrl) || (i.tcbDocs && i.tcbDocs.length > 0)
        ).length
        const missingTcb = total - hasTcb
        const hasAmendment = items.filter(
            i => i.amendmentDocs && i.amendmentDocs.length > 0
        ).length
        const hasTesting = items.filter(i => i.testingDocs && i.testingDocs.length > 0).length
        const totalTcbFiles = items.reduce((acc, i) => acc + (i.tcbDocs?.length || 0), 0)
        const totalAmendmentFiles = items.reduce(
            (acc, i) => acc + (i.amendmentDocs?.length || 0),
            0
        )
        const totalTestingFiles = items.reduce((acc, i) => acc + (i.testingDocs?.length || 0), 0)

        return {
            total,
            hasTn,
            missingTn,
            hasTcb,
            missingTcb,
            hasAmendment,
            hasTesting,
            totalTcbFiles,
            totalAmendmentFiles,
            totalTestingFiles,
        }
    }, [items])

    const countries = useMemo(() => {
        const map = new Map<string, number>()
        for (const item of items) {
            if (item.country) {
                map.set(item.country, (map.get(item.country) || 0) + 1)
            }
        }
        return Array.from(map.entries())
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count)
    }, [items])

    const filteredItems = useMemo(() => {
        const q = search.trim().toLowerCase()
        return items.filter(item => {
            const itemHasTcb =
                Boolean(item.selfDeclarationUrl) || (item.tcbDocs && item.tcbDocs.length > 0)
            const itemHasAmendment = item.amendmentDocs && item.amendmentDocs.length > 0
            const itemHasTesting = item.testingDocs && item.testingDocs.length > 0

            if (docFilter === 'HAS_TN' && !item.tastingNoteUrl) return false
            if (docFilter === 'MISSING_TN' && item.tastingNoteUrl) return false
            if (docFilter === 'HAS_TCB' && !itemHasTcb) return false
            if (docFilter === 'MISSING_TCB' && itemHasTcb) return false
            if (docFilter === 'HAS_AMENDMENT' && !itemHasAmendment) return false
            if (docFilter === 'HAS_TESTING' && !itemHasTesting) return false
            if (countryFilter && item.country !== countryFilter) return false
            if (wineTypeFilter && item.wineType !== wineTypeFilter) return false

            if (q) {
                const legalHaystack = [
                    ...(item.tcbDocs || []),
                    ...(item.amendmentDocs || []),
                    ...(item.testingDocs || []),
                ]
                    .map(
                        d =>
                            `${d.docNo} ${d.name} ${d.description || ''} ${d.issuingAuthority || ''} ${d.fileName}`
                    )
                    .join(' ')

                const haystack = [
                    item.skuCode,
                    item.productName,
                    item.producerName,
                    item.profile?.grapes || '',
                    item.profile?.style || '',
                    item.profile?.originDetail || '',
                    getShortFileName(item.tastingNoteUrl),
                    legalHaystack,
                ]
                    .join(' ')
                    .toLowerCase()
                if (!haystack.includes(q)) return false
            }
            return true
        })
    }, [items, search, docFilter, countryFilter, wineTypeFilter])

    const handleTriggerQuickUpload = (
        productId: string,
        type: 'TN' | ProductLegalDocGroup
    ) => {
        setActiveUploadTarget({ productId, type })
        if (type === 'TN') {
            if (tnInputRef.current) {
                tnInputRef.current.value = ''
                tnInputRef.current.click()
            }
        } else {
            if (quickLegalInputRef.current) {
                quickLegalInputRef.current.value = ''
                quickLegalInputRef.current.click()
            }
        }
    }

    const handleQuickFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !activeUploadTarget) return

        const { productId, type } = activeUploadTarget
        const key = `${productId}:${type}`
        setUploadingKey(key)
        try {
            const fd = new FormData()
            fd.append('file', file)

            if (type === 'TN') {
                const res = await uploadProductTastingNote(productId, fd)
                if (res.success) {
                    toast.success('Đã cập nhật file Tasting Note lên Cloudflare R2')
                    qc.invalidateQueries({ queryKey: ['products-tasting-note-catalog'] })
                    qc.invalidateQueries({ queryKey: ['products'] })
                } else {
                    toast.error(res.error || 'Lỗi khi tải file Tasting Note lên R2')
                }
            } else {
                fd.append('group', type)
                const res = await uploadProductLegalDoc(productId, fd)
                if (res.success) {
                    toast.success(`Đã thêm ${GROUP_META[type].shortLabel} lên Cloudflare R2`)
                    qc.invalidateQueries({ queryKey: ['products-tasting-note-catalog'] })
                    qc.invalidateQueries({ queryKey: ['products'] })
                } else {
                    toast.error(res.error || 'Lỗi khi tải hồ sơ lên R2')
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi kết nối khi tải file')
        } finally {
            setUploadingKey(null)
            setActiveUploadTarget(null)
        }
    }

    const openDossierDrawer = (
        productId: string,
        initialSection: 'ALL' | 'TN' | ProductLegalDocGroup = 'ALL',
        openUploadForGroup?: ProductLegalDocGroup
    ) => {
        setDossierProductId(productId)
        setActiveDossierSection(initialSection)
        if (openUploadForGroup) {
            openUploadForm(openUploadForGroup)
        } else {
            setUploadFormGroup(null)
        }
    }

    const openUploadForm = (group: ProductLegalDocGroup) => {
        setUploadFormGroup(group)
        setUploadName('')
        setUploadDocNo('')
        setUploadIssueDate(new Date().toISOString().slice(0, 10))
        setUploadAuthority('')
        setUploadDescription('')
        setUploadFile(null)
    }

    const handleSubmitDossierLegalDoc = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!activeDossierItem || !uploadFormGroup) return
        if (!uploadFile) {
            toast.error('Vui lòng chọn file đính kèm (PDF, DOCX, Ảnh)')
            return
        }

        setIsSubmittingLegalDoc(true)
        try {
            const fd = new FormData()
            fd.append('file', uploadFile)
            fd.append('group', uploadFormGroup)
            if (uploadName.trim()) fd.append('name', uploadName.trim())
            if (uploadDocNo.trim()) fd.append('docNo', uploadDocNo.trim())
            if (uploadIssueDate) fd.append('issueDate', uploadIssueDate)
            if (uploadAuthority.trim()) fd.append('issuingAuthority', uploadAuthority.trim())
            if (uploadDescription.trim()) fd.append('description', uploadDescription.trim())

            const res = await uploadProductLegalDoc(activeDossierItem.id, fd)
            if (res.success) {
                toast.success(
                    `Đã lưu ${GROUP_META[uploadFormGroup].shortLabel} cho ${activeDossierItem.skuCode}`
                )
                setUploadFormGroup(null)
                setUploadFile(null)
                qc.invalidateQueries({ queryKey: ['products-tasting-note-catalog'] })
                qc.invalidateQueries({ queryKey: ['products'] })
            } else {
                toast.error(res.error || 'Không thể tải hồ sơ lên R2')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi lưu hồ sơ pháp lý')
        } finally {
            setIsSubmittingLegalDoc(false)
        }
    }

    const handleDeleteLegalDoc = async (doc: ProductLegalDocItem) => {
        if (doc.id.startsWith('legacy-tcb-')) {
            toast.error('Hồ sơ mặc định này cần được thay thế bằng bản mới')
            return
        }
        setDeletingDocId(doc.id)
        try {
            const res = await deleteProductLegalDoc(doc.id)
            if (res.success) {
                toast.success(`Đã xoá hồ sơ: ${doc.name}`)
                qc.invalidateQueries({ queryKey: ['products-tasting-note-catalog'] })
                qc.invalidateQueries({ queryKey: ['products'] })
            } else {
                toast.error(res.error || 'Lỗi khi xoá hồ sơ')
            }
        } catch (err: any) {
            toast.error(err.message || 'Lỗi khi xoá hồ sơ')
        } finally {
            setDeletingDocId(null)
        }
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Hidden file inputs for 1-click upload */}
            <input
                ref={tnInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="hidden"
                onChange={handleQuickFileChange}
            />
            <input
                ref={quickLegalInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                className="hidden"
                onChange={handleQuickFileChange}
            />

            {/* Quick Status Filter Pills + Search Toolbar */}
            <div className="flex flex-col gap-2.5 bg-white p-3 rounded-lg border border-lys-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setDocFilter('ALL')}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'ALL'
                                    ? 'bg-lys-teal-strong text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Tất cả SKU ({counts.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocFilter('HAS_TN')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'HAS_TN'
                                    ? 'bg-cyan-700 text-white'
                                    : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200'
                            }`}
                        >
                            <CheckCircle2 size={13} />
                            Tasting Note ({counts.hasTn}/{counts.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocFilter('HAS_TCB')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'HAS_TCB'
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                        >
                            <FileCheck size={13} />
                            Có Tự Công Bố ({counts.hasTcb})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocFilter('MISSING_TCB')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'MISSING_TCB'
                                    ? 'bg-rose-700 text-white'
                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                            }`}
                        >
                            <AlertCircle size={13} />
                            Thiếu TCB ({counts.missingTcb})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocFilter('HAS_AMENDMENT')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'HAS_AMENDMENT'
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                            }`}
                        >
                            <FileDiff size={13} />
                            Có TB Thay đổi ({counts.hasAmendment} SKU · {counts.totalAmendmentFiles}{' '}
                            bản)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDocFilter('HAS_TESTING')}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                docFilter === 'HAS_TESTING'
                                    ? 'bg-indigo-700 text-white'
                                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                            }`}
                        >
                            <FlaskConical size={13} />
                            Có Kiểm định ({counts.hasTesting} SKU · {counts.totalTestingFiles} phiếu)
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <SearchInput
                            placeholder="Tìm SKU, tên rượu, số TCB, số phiếu AR-242, nội dung thay đổi..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full sm:w-72"
                        />
                        <Select
                            aria-label="Loại rượu"
                            value={wineTypeFilter}
                            onChange={e => setWineTypeFilter(e.target.value)}
                            className="w-32"
                        >
                            <option value="">Tất cả loại</option>
                            <option value="RED">Vang đỏ</option>
                            <option value="WHITE">Vang trắng</option>
                            <option value="SPARKLING">Vang nổ</option>
                            <option value="ROSE">Vang hồng</option>
                        </Select>
                        <Select
                            aria-label="Quốc gia"
                            value={countryFilter}
                            onChange={e => setCountryFilter(e.target.value)}
                            className="w-36"
                        >
                            <option value="">Tất cả quốc gia</option>
                            {countries.map(c => (
                                <option key={c.code} value={c.code}>
                                    {COUNTRY_NAMES[c.code] ?? c.code} [{c.code}] ({c.count})
                                </option>
                            ))}
                        </Select>
                        {(search || docFilter !== 'ALL' || countryFilter || wineTypeFilter) && (
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSearch('')
                                    setDocFilter('ALL')
                                    setCountryFilter('')
                                    setWineTypeFilter('')
                                }}
                            >
                                <X size={13} /> Xóa lọc
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <Table>
                <THead>
                    <tr>
                        <Th className="w-[260px]">Mã SKU & Sản phẩm</Th>
                        <Th className="w-[230px]">Tasting Note & Hương vị</Th>
                        <Th className="w-[210px]">Bản Tự Công Bố (TCB)</Th>
                        <Th className="w-[220px]">Thông báo Thay đổi sau TCB</Th>
                        <Th className="w-[220px]">Phiếu Kiểm định ATTP</Th>
                        <Th className="w-[115px]" align="center">
                            Bộ Hồ sơ
                        </Th>
                    </tr>
                </THead>
                <TBody>
                    {isLoading ? (
                        <TableMessageRow colSpan={6}>
                            <TableSkeleton rows={8} cols={6} />
                        </TableMessageRow>
                    ) : filteredItems.length === 0 ? (
                        <TableMessageRow colSpan={6}>
                            <div className="py-8 text-center text-xs text-slate-500">
                                Không tìm thấy sản phẩm nào khớp với bộ lọc hiện tại.
                            </div>
                        </TableMessageRow>
                    ) : (
                        filteredItems.map(item => {
                            const tnFileName = getShortFileName(item.tastingNoteUrl)
                            const isUploadingTn = uploadingKey === `${item.id}:TN`
                            const isUploadingTcb = uploadingKey === `${item.id}:TCB`
                            const isUploadingAmendment = uploadingKey === `${item.id}:AMENDMENT`
                            const isUploadingTesting = uploadingKey === `${item.id}:TESTING`

                            const latestTcb = item.tcbDocs?.[0] || null
                            const latestAmendment = item.amendmentDocs?.[0] || null
                            const latestTesting = item.testingDocs?.[0] || null
                            const totalDocsCount =
                                (item.tastingNoteUrl ? 1 : 0) +
                                (item.tcbDocs?.length || 0) +
                                (item.amendmentDocs?.length || 0) +
                                (item.testingDocs?.length || 0)

                            return (
                                <Tr
                                    key={item.id}
                                    className="group cursor-pointer"
                                    onClick={() => openDossierDrawer(item.id, 'ALL')}
                                >
                                    {/* Column 1: SKU & Product Info */}
                                    <Td className="py-2.5 align-top">
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-10 h-11 rounded bg-white border border-lys-border shrink-0 flex items-center justify-center overflow-hidden p-0.5 mt-0.5">
                                                {item.primaryImageUrl ? (
                                                    <img
                                                        src={item.primaryImageUrl}
                                                        alt={item.productName}
                                                        loading="lazy"
                                                        className="h-full object-contain"
                                                    />
                                                ) : (
                                                    <ImageOff size={14} className="text-slate-300" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                        {item.skuCode}
                                                    </span>
                                                    <WineTypeBadge type={item.wineType} />
                                                    {item.abvPercent != null && (
                                                        <span className="text-[11px] font-mono text-slate-500">
                                                            {item.abvPercent}°
                                                        </span>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-xs font-semibold text-slate-900 line-clamp-2 max-w-[210px] mt-1 leading-snug"
                                                    title={item.productName}
                                                >
                                                    {item.productName}
                                                </p>
                                                <p className="text-[11px] text-slate-500 truncate max-w-[210px] mt-0.5">
                                                    [{item.country}] {item.producerName}
                                                </p>
                                            </div>
                                        </div>
                                    </Td>

                                    {/* Column 2: Tasting Note & Wine Profile */}
                                    <Td className="py-2.5 align-top" onClick={e => e.stopPropagation()}>
                                        <div className="flex flex-col gap-1.5 max-w-[225px]">
                                            {item.tastingNoteUrl ? (
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPreviewDoc({
                                                                url: item.tastingNoteUrl!,
                                                                title: `Tasting Note — ${item.skuCode} ${item.productName}`,
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 transition-colors cursor-pointer"
                                                        title={tnFileName}
                                                    >
                                                        <Eye size={12} /> Xem Tasting Note
                                                    </button>
                                                    <a
                                                        href={item.tastingNoteUrl}
                                                        download
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                                                        title="Tải xuống Tasting Note"
                                                    >
                                                        <Download size={11} />
                                                    </a>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            disabled={isUploadingTn}
                                                            onClick={() =>
                                                                handleTriggerQuickUpload(item.id, 'TN')
                                                            }
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                                                            title="Đổi file Tasting Note"
                                                        >
                                                            {isUploadingTn ? (
                                                                <Loader2 size={11} className="animate-spin" />
                                                            ) : (
                                                                <Upload size={11} />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[11px] text-amber-600 font-medium">
                                                        Chưa có TN
                                                    </span>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            disabled={isUploadingTn}
                                                            onClick={() =>
                                                                handleTriggerQuickUpload(item.id, 'TN')
                                                            }
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-600 text-white hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50"
                                                        >
                                                            {isUploadingTn ? (
                                                                <Loader2 size={11} className="animate-spin" />
                                                            ) : (
                                                                <Upload size={11} />
                                                            )}
                                                            Upload
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {item.profile?.grapes && (
                                                <p
                                                    className="text-[11px] text-slate-600 truncate"
                                                    title={item.profile.grapes}
                                                >
                                                    <span className="font-semibold text-slate-700">
                                                        Nho:
                                                    </span>{' '}
                                                    {item.profile.grapes}
                                                </p>
                                            )}
                                            {(item.profile?.aromas || item.profile?.palate) && (
                                                <p
                                                    className="text-[11px] text-slate-500 line-clamp-1"
                                                    title={
                                                        item.profile.aromas || item.profile.palate || ''
                                                    }
                                                >
                                                    {item.profile.aromas || item.profile.palate}
                                                </p>
                                            )}
                                        </div>
                                    </Td>

                                    {/* Column 3: Bản Tự Công Bố (TCB) */}
                                    <Td className="py-2.5 align-top" onClick={e => e.stopPropagation()}>
                                        {latestTcb ? (
                                            <div className="flex flex-col gap-1 max-w-[205px]">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPreviewDoc({
                                                                url: latestTcb.fileUrl,
                                                                title: `${latestTcb.name} — ${item.skuCode}`,
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} /> Xem TCB
                                                    </button>
                                                    {item.tcbDocs.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDossierDrawer(item.id, 'TCB')
                                                            }
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 hover:bg-emerald-200 cursor-pointer"
                                                            title="Xem lịch sử các phiên bản Tự công bố"
                                                        >
                                                            {item.tcbDocs.length} bản
                                                        </button>
                                                    )}
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            disabled={isUploadingTcb}
                                                            onClick={() =>
                                                                openDossierDrawer(item.id, 'TCB', 'TCB')
                                                            }
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                                            title="Thêm phiên bản Tự công bố mới"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[11px] font-medium text-slate-700 truncate"
                                                    title={latestTcb.name}
                                                >
                                                    {latestTcb.name.replace(
                                                        new RegExp(`\\s*—\\s*${item.skuCode}.*$`),
                                                        ''
                                                    )}
                                                </p>
                                                {latestTcb.description && (
                                                    <p
                                                        className="text-[10px] text-slate-500 truncate"
                                                        title={latestTcb.description}
                                                    >
                                                        {latestTcb.description}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-rose-600 font-medium">
                                                    Chưa có TCB
                                                </span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        disabled={isUploadingTcb}
                                                        onClick={() =>
                                                            openDossierDrawer(item.id, 'TCB', 'TCB')
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={11} /> Thêm TCB
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Td>

                                    {/* Column 4: Thông báo thay đổi sau TCB */}
                                    <Td className="py-2.5 align-top" onClick={e => e.stopPropagation()}>
                                        {latestAmendment ? (
                                            <div className="flex flex-col gap-1 max-w-[215px]">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPreviewDoc({
                                                                url: latestAmendment.fileUrl,
                                                                title: `${latestAmendment.name} — ${item.skuCode}`,
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} /> Xem công văn
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openDossierDrawer(item.id, 'AMENDMENT')
                                                        }
                                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 cursor-pointer"
                                                    >
                                                        {item.amendmentDocs.length} lần
                                                    </button>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            disabled={isUploadingAmendment}
                                                            onClick={() =>
                                                                openDossierDrawer(
                                                                    item.id,
                                                                    'AMENDMENT',
                                                                    'AMENDMENT'
                                                                )
                                                            }
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                                            title="Thêm Thông báo thay đổi sau TCB"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[11px] font-medium text-slate-700 line-clamp-1"
                                                    title={latestAmendment.name}
                                                >
                                                    {latestAmendment.name}
                                                </p>
                                                <p
                                                    className="text-[10px] text-slate-500 line-clamp-1"
                                                    title={latestAmendment.description || ''}
                                                >
                                                    {formatShortDate(latestAmendment.issueDate)}
                                                    {latestAmendment.description
                                                        ? ` · ${latestAmendment.description}`
                                                        : ''}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-slate-400">
                                                    Chưa phát sinh
                                                </span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        disabled={isUploadingAmendment}
                                                        onClick={() =>
                                                            openDossierDrawer(
                                                                item.id,
                                                                'AMENDMENT',
                                                                'AMENDMENT'
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={11} /> Thêm
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Td>

                                    {/* Column 5: Phiếu Kiểm định / Kiểm nghiệm */}
                                    <Td className="py-2.5 align-top" onClick={e => e.stopPropagation()}>
                                        {latestTesting ? (
                                            <div className="flex flex-col gap-1 max-w-[215px]">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPreviewDoc({
                                                                url: latestTesting.fileUrl,
                                                                title: `${latestTesting.name} — ${item.skuCode}`,
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={12} /> Xem KĐ
                                                    </button>
                                                    {item.testingDocs.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openDossierDrawer(item.id, 'TESTING')
                                                            }
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900 hover:bg-indigo-200 cursor-pointer"
                                                        >
                                                            {item.testingDocs.length} phiếu
                                                        </button>
                                                    )}
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            disabled={isUploadingTesting}
                                                            onClick={() =>
                                                                openDossierDrawer(
                                                                    item.id,
                                                                    'TESTING',
                                                                    'TESTING'
                                                                )
                                                            }
                                                            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                                            title="Thêm Phiếu kiểm định ATTP"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                                <p
                                                    className="text-[11px] font-medium text-slate-700 truncate"
                                                    title={latestTesting.name}
                                                >
                                                    {latestTesting.name}
                                                </p>
                                                <p
                                                    className="text-[10px] text-slate-500 truncate"
                                                    title={
                                                        latestTesting.issuingAuthority ||
                                                        latestTesting.description ||
                                                        ''
                                                    }
                                                >
                                                    {latestTesting.issuingAuthority ||
                                                        formatShortDate(latestTesting.issueDate)}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-slate-400">
                                                    Chưa có phiếu
                                                </span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        disabled={isUploadingTesting}
                                                        onClick={() =>
                                                            openDossierDrawer(
                                                                item.id,
                                                                'TESTING',
                                                                'TESTING'
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                                                    >
                                                        <Plus size={11} /> Thêm
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Td>

                                    {/* Column 6: Open Full Dossier Drawer + Edit Product */}
                                    <Td
                                        align="center"
                                        className="py-2.5 align-top"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => openDossierDrawer(item.id, 'ALL')}
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 text-white hover:bg-slate-900 transition-colors cursor-pointer"
                                                title="Mở toàn bộ hồ sơ công bố, thay đổi & kiểm định của SKU này"
                                            >
                                                <FolderOpen size={12} />
                                                <span>Hồ sơ ({totalDocsCount})</span>
                                            </button>
                                            {canEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    title="Chỉnh sửa thông tin sản phẩm"
                                                    onClick={() => onEditProduct(item.id)}
                                                >
                                                    <Edit2 size={13} />
                                                </Button>
                                            )}
                                        </div>
                                    </Td>
                                </Tr>
                            )
                        })
                    )}
                </TBody>
            </Table>

            <div className="text-xs text-slate-500 px-1 flex flex-wrap items-center justify-between gap-2">
                <span>
                    Đang hiển thị <strong>{filteredItems.length}</strong> / {counts.total} sản phẩm.
                </span>
                <span>
                    Tổng kho tài liệu R2: <strong>{counts.hasTn}</strong> Tasting Note ·{' '}
                    <strong>{counts.totalTcbFiles}</strong> Bản Tự Công Bố ·{' '}
                    <strong>{counts.totalAmendmentFiles}</strong> Thông báo thay đổi ·{' '}
                    <strong>{counts.totalTestingFiles}</strong> Phiếu kiểm định.
                </span>
            </div>

            {/* Product Legal & Technical Dossier Drawer via Portal */}
            {activeDossierItem &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[110] flex justify-end bg-slate-950/60 backdrop-blur-xs"
                        onClick={() => setDossierProductId(null)}
                    >
                        <div
                            className="relative w-full max-w-3xl h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Drawer Header */}
                            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className="w-12 h-14 rounded bg-white border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden p-1">
                                        {activeDossierItem.primaryImageUrl ? (
                                            <img
                                                src={activeDossierItem.primaryImageUrl}
                                                alt={activeDossierItem.productName}
                                                className="h-full object-contain"
                                            />
                                        ) : (
                                            <ImageOff size={16} className="text-slate-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-white">
                                                {activeDossierItem.skuCode}
                                            </span>
                                            <WineTypeBadge type={activeDossierItem.wineType} />
                                            {activeDossierItem.abvPercent != null && (
                                                <span className="text-xs font-mono text-slate-600">
                                                    ABV {activeDossierItem.abvPercent}%
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500">
                                                [{activeDossierItem.country}]{' '}
                                                {activeDossierItem.producerName}
                                            </span>
                                        </div>
                                        <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                                            {activeDossierItem.productName}
                                        </h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Hồ sơ Kỹ thuật & Pháp lý ATTP lưu trữ trên Cloudflare R2
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const id = activeDossierItem.id
                                            setDossierProductId(null)
                                            onViewProduct(id)
                                        }}
                                        className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Chi tiết SKU
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDossierProductId(null)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Section Filter Tabs inside Drawer */}
                            <div className="px-5 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => setActiveDossierSection('ALL')}
                                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                                            activeDossierSection === 'ALL'
                                                ? 'bg-slate-900 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Tất cả hạng mục
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveDossierSection('TN')}
                                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                                            activeDossierSection === 'TN'
                                                ? 'bg-cyan-700 text-white'
                                                : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                                        }`}
                                    >
                                        Tasting Note ({activeDossierItem.tastingNoteUrl ? 1 : 0})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveDossierSection('TCB')}
                                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                                            activeDossierSection === 'TCB'
                                                ? 'bg-emerald-700 text-white'
                                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                        }`}
                                    >
                                        Tự Công Bố ({activeDossierItem.tcbDocs.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveDossierSection('AMENDMENT')}
                                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                                            activeDossierSection === 'AMENDMENT'
                                                ? 'bg-amber-700 text-white'
                                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        }`}
                                    >
                                        TB Thay đổi ({activeDossierItem.amendmentDocs.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveDossierSection('TESTING')}
                                        className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                                            activeDossierSection === 'TESTING'
                                                ? 'bg-indigo-700 text-white'
                                                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                                        }`}
                                    >
                                        Phiếu Kiểm định ({activeDossierItem.testingDocs.length})
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Body */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
                                {/* Add Legal Document Form (if active) */}
                                {canEdit && uploadFormGroup && (
                                    <form
                                        onSubmit={handleSubmitDossierLegalDoc}
                                        className="bg-white border-2 border-cyan-600/30 rounded-lg p-4 shadow-xs space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Upload size={15} className="text-cyan-700" />
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                    Thêm mới: {GROUP_META[uploadFormGroup].label}
                                                </h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setUploadFormGroup(null)}
                                                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                                            >
                                                Đóng
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                    Tên hồ sơ / Nội dung trích yếu
                                                </label>
                                                <input
                                                    type="text"
                                                    value={uploadName}
                                                    onChange={e => setUploadName(e.target.value)}
                                                    placeholder={
                                                        GROUP_META[uploadFormGroup].namePlaceholder
                                                    }
                                                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-cyan-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                    Số hiệu văn bản / Số phiếu
                                                </label>
                                                <input
                                                    type="text"
                                                    value={uploadDocNo}
                                                    onChange={e => setUploadDocNo(e.target.value)}
                                                    placeholder="VD: 53/2023 hoặc AR-242..."
                                                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-cyan-600"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                    Ngày ban hành / Ngày ký
                                                </label>
                                                <input
                                                    type="date"
                                                    value={uploadIssueDate}
                                                    onChange={e => setUploadIssueDate(e.target.value)}
                                                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-cyan-600"
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                    Cơ quan tiếp nhận / Đơn vị kiểm nghiệm
                                                </label>
                                                <input
                                                    type="text"
                                                    value={uploadAuthority}
                                                    onChange={e =>
                                                        setUploadAuthority(e.target.value)
                                                    }
                                                    placeholder={
                                                        GROUP_META[uploadFormGroup]
                                                            .authorityPlaceholder
                                                    }
                                                    className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-cyan-600"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                                Ghi chú chi tiết (nội dung thay đổi sau công bố, niên vụ, lô kiểm nghiệm...)
                                            </label>
                                            <input
                                                type="text"
                                                value={uploadDescription}
                                                onChange={e => setUploadDescription(e.target.value)}
                                                placeholder="VD: Thay đổi mẫu nhãn chính, cập nhật niên vụ 2022 và nồng độ cồn 13.5%..."
                                                className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:border-cyan-600"
                                            />
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                                onChange={e =>
                                                    setUploadFile(e.target.files?.[0] || null)
                                                }
                                                className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setUploadFormGroup(null)}
                                                    className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                                                >
                                                    Hủy
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isSubmittingLegalDoc || !uploadFile}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isSubmittingLegalDoc ? (
                                                        <Loader2 size={13} className="animate-spin" />
                                                    ) : (
                                                        <Upload size={13} />
                                                    )}
                                                    Lưu lên Cloudflare R2
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                )}

                                {/* Section 1: Tasting Note & Wine Profile */}
                                {(activeDossierSection === 'ALL' ||
                                    activeDossierSection === 'TN') && (
                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText size={15} className="text-cyan-700" />
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                    1. Tasting Note & Hồ Sơ Kỹ Thuật Rượu
                                                </h3>
                                            </div>
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleTriggerQuickUpload(
                                                            activeDossierItem.id,
                                                            'TN'
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 cursor-pointer"
                                                >
                                                    <Upload size={12} />
                                                    {activeDossierItem.tastingNoteUrl
                                                        ? 'Thay file Tasting Note'
                                                        : 'Tải lên Tasting Note'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {activeDossierItem.tastingNoteUrl ? (
                                                <div className="flex items-center justify-between gap-3 p-3 rounded-md bg-cyan-50/50 border border-cyan-200">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-900 truncate">
                                                            {getShortFileName(
                                                                activeDossierItem.tastingNoteUrl
                                                            )}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            Tài liệu Tasting Note / Tech Sheet chính
                                                            thức từ nhà sản xuất
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setPreviewDoc({
                                                                    url: activeDossierItem.tastingNoteUrl!,
                                                                    title: `Tasting Note — ${activeDossierItem.skuCode} ${activeDossierItem.productName}`,
                                                                })
                                                            }
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-cyan-700 text-white hover:bg-cyan-800 cursor-pointer"
                                                        >
                                                            <Eye size={13} /> Xem trực tiếp
                                                        </button>
                                                        <a
                                                            href={activeDossierItem.tastingNoteUrl}
                                                            download
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                                        >
                                                            <Download size={13} /> Tải
                                                        </a>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-amber-600 py-2">
                                                    Chưa có file Tasting Note trên R2.
                                                </div>
                                            )}

                                            {activeDossierItem.profile && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-slate-50 p-3 rounded border border-slate-200/80">
                                                    {activeDossierItem.profile.grapes && (
                                                        <div>
                                                            <span className="font-semibold text-slate-700">
                                                                Giống nho:{' '}
                                                            </span>
                                                            <span className="text-slate-600">
                                                                {activeDossierItem.profile.grapes}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {activeDossierItem.profile.servingTemp && (
                                                        <div>
                                                            <span className="font-semibold text-slate-700">
                                                                Nhiệt độ phục vụ:{' '}
                                                            </span>
                                                            <span className="text-slate-600">
                                                                {
                                                                    activeDossierItem.profile
                                                                        .servingTemp
                                                                }
                                                            </span>
                                                        </div>
                                                    )}
                                                    {activeDossierItem.profile.aromas && (
                                                        <div className="sm:col-span-2">
                                                            <span className="font-semibold text-slate-700">
                                                                Hương thơm:{' '}
                                                            </span>
                                                            <span className="text-slate-600">
                                                                {activeDossierItem.profile.aromas}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {activeDossierItem.profile.palate && (
                                                        <div className="sm:col-span-2">
                                                            <span className="font-semibold text-slate-700">
                                                                Vị rượu:{' '}
                                                            </span>
                                                            <span className="text-slate-600">
                                                                {activeDossierItem.profile.palate}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Legal Document Sections: TCB, AMENDMENT, TESTING */}
                                {(['TCB', 'AMENDMENT', 'TESTING'] as ProductLegalDocGroup[]).map(
                                    (group, idx) => {
                                        if (
                                            activeDossierSection !== 'ALL' &&
                                            activeDossierSection !== group
                                        ) {
                                            return null
                                        }

                                        const docs =
                                            group === 'TCB'
                                                ? activeDossierItem.tcbDocs
                                                : group === 'AMENDMENT'
                                                ? activeDossierItem.amendmentDocs
                                                : activeDossierItem.testingDocs

                                        const sectionNumber = idx + 2
                                        const GroupIcon =
                                            group === 'TCB'
                                                ? FileCheck
                                                : group === 'AMENDMENT'
                                                ? FileDiff
                                                : FlaskConical

                                        return (
                                            <div
                                                key={group}
                                                className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                                            >
                                                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <GroupIcon
                                                            size={15}
                                                            className={
                                                                group === 'TCB'
                                                                    ? 'text-emerald-700'
                                                                    : group === 'AMENDMENT'
                                                                    ? 'text-amber-700'
                                                                    : 'text-indigo-700'
                                                            }
                                                        />
                                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                            {sectionNumber}. {GROUP_META[group].label}{' '}
                                                            ({docs.length})
                                                        </h3>
                                                    </div>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openUploadForm(group)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            <Plus size={12} /> Thêm{' '}
                                                            {GROUP_META[group].shortLabel}
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="divide-y divide-slate-100">
                                                    {docs.length === 0 ? (
                                                        <div className="p-4 text-xs text-slate-400 italic">
                                                            Chưa có hồ sơ{' '}
                                                            {GROUP_META[
                                                                group
                                                            ].shortLabel.toLowerCase()}{' '}
                                                            nào được lưu cho mã SKU này.
                                                        </div>
                                                    ) : (
                                                        docs.map((doc, dIdx) => (
                                                            <div
                                                                key={doc.id}
                                                                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                                                            >
                                                                <div className="min-w-0 space-y-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        {dIdx === 0 && (
                                                                            <span
                                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${GROUP_META[group].badgeClass}`}
                                                                            >
                                                                                Mới nhất
                                                                            </span>
                                                                        )}
                                                                        <span className="text-xs font-bold text-slate-900">
                                                                            {doc.name}
                                                                        </span>
                                                                    </div>

                                                                    {doc.description && (
                                                                        <p className="text-xs text-slate-600">
                                                                            {doc.description}
                                                                        </p>
                                                                    )}

                                                                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                                                        {doc.issueDate && (
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <Calendar size={11} />
                                                                                {formatShortDate(
                                                                                    doc.issueDate
                                                                                )}
                                                                            </span>
                                                                        )}
                                                                        {doc.issuingAuthority && (
                                                                            <span className="inline-flex items-center gap-1">
                                                                                <Building2
                                                                                    size={11}
                                                                                />
                                                                                {
                                                                                    doc.issuingAuthority
                                                                                }
                                                                            </span>
                                                                        )}
                                                                        <span
                                                                            className="text-slate-400 truncate max-w-[260px]"
                                                                            title={doc.fileName}
                                                                        >
                                                                            File: {doc.fileName}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setPreviewDoc({
                                                                                url: doc.fileUrl,
                                                                                title: `${doc.name} — ${activeDossierItem.skuCode}`,
                                                                            })
                                                                        }
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 cursor-pointer"
                                                                    >
                                                                        <Eye size={12} /> Xem
                                                                    </button>
                                                                    <a
                                                                        href={doc.fileUrl}
                                                                        download
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                                                    >
                                                                        <Download size={12} /> Tải
                                                                    </a>
                                                                    {canEdit &&
                                                                        !doc.id.startsWith(
                                                                            'legacy-tcb-'
                                                                        ) && (
                                                                            <button
                                                                                type="button"
                                                                                disabled={
                                                                                    deletingDocId ===
                                                                                    doc.id
                                                                                }
                                                                                onClick={() =>
                                                                                    handleDeleteLegalDoc(
                                                                                        doc
                                                                                    )
                                                                                }
                                                                                className="inline-flex items-center justify-center w-7 h-7 rounded text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                                                                title="Xoá hồ sơ này"
                                                                            >
                                                                                {deletingDocId ===
                                                                                doc.id ? (
                                                                                    <Loader2
                                                                                        size={12}
                                                                                        className="animate-spin"
                                                                                    />
                                                                                ) : (
                                                                                    <Trash2
                                                                                        size={13}
                                                                                    />
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

            {/* Full-screen Document Preview Modal via Portal */}
            {previewDoc &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs"
                        onClick={() => setPreviewDoc(null)}
                    >
                        <div
                            className="relative w-full max-w-5xl h-[90vh] bg-white rounded-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileText size={16} className="text-cyan-700 shrink-0" />
                                    <h3 className="text-sm font-bold text-slate-800 truncate">
                                        {previewDoc.title}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={previewDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors"
                                    >
                                        <ExternalLink size={12} /> Mở tab mới
                                    </a>
                                    <a
                                        href={previewDoc.url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                                    >
                                        <Download size={12} /> Tải về
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(null)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 relative overflow-hidden">
                                {(() => {
                                    const preview = getPreviewUrl(previewDoc.url)
                                    if (preview.type === 'image') {
                                        return (
                                            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                                                <img
                                                    src={preview.src}
                                                    alt={previewDoc.title}
                                                    className="max-w-full max-h-full object-contain rounded shadow"
                                                />
                                            </div>
                                        )
                                    }
                                    return (
                                        <iframe
                                            src={preview.src}
                                            title={previewDoc.title}
                                            className="w-full h-full border-0"
                                        />
                                    )
                                })()}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    )
}
