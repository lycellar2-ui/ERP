'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Sparkles, Plus, ArrowUpRight, ArrowDownLeft, Search, RefreshCw,
    AlertTriangle, Tag, History, X, Layers, Boxes, Edit2, ShieldAlert,
    CheckCircle2, DollarSign, Package, AlertCircle, Building2, Store,
    Wine, Gift, BookOpen, Printer, Trash2
} from 'lucide-react'
import {
    PosmProductItem, PosmTransactionItem, PosmStats, PosmLegalEntityOption,
    getPosmProducts, getPosmTransactions, getPosmStats, getPosmLegalEntities,
    createPosmProduct, updatePosmProduct, createPosmTransaction, createPosmBatchTransaction
} from './actions-posm'
import { formatVND, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { PosmCategory, PosmReason } from '@prisma/client'

// ── POSM Category Visual Configurations ──────────────────────
export const POSM_CATEGORY_CONFIG: Record<PosmCategory, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
    GLASSWARE_TOOLS: {
        label: 'Ly & Dụng Cụ Rượu',
        color: '#0284C7',
        bg: '#F0F9FF',
        border: '#BAE6FD',
        icon: Wine
    },
    DISPLAY_STAND: {
        label: 'Kệ & Trưng Bày',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        icon: Tag
    },
    PACKAGING_GIFT: {
        label: 'Bao Bì & Hộp Quà',
        color: '#0E7490',
        bg: '#ECFEFF',
        border: '#A5F3FC',
        icon: Gift
    },
    MARKETING_COLLATERAL: {
        label: 'Ấn Phẩm & Marketing',
        color: '#15803D',
        bg: '#ECFDF5',
        border: '#A7F3D0',
        icon: BookOpen
    },
    OTHER: {
        label: 'Vật Phẩm Khác',
        color: '#475569',
        bg: '#F8FAFC',
        border: '#E2E8F0',
        icon: Package
    }
}

// ── POSM Reason Labels ────────────────────────────────────────
export const POSM_REASON_LABELS: Record<PosmReason, { label: string; type: 'IN' | 'OUT' | 'ADJ' }> = {
    PURCHASE_INBOUND: { label: 'Mua mới nhập kho', type: 'IN' },
    SUPPLIER_SPONSOR: { label: 'Hãng / Nhà cung cấp tài trợ', type: 'IN' },
    EVENT_RETURN: { label: 'Hoàn trả tồn sau sự kiện', type: 'IN' },
    SALES_ALLOCATION: { label: 'Cấp phát Sales / PG đi thị trường', type: 'OUT' },
    HORECA_PLACEMENT: { label: 'Trang bị điểm bán / HORECA', type: 'OUT' },
    PROMO_GIFT: { label: 'Quà tặng CTKM kèm đơn hàng', type: 'OUT' },
    EVENT_WORKSHOP: { label: 'Sự kiện / Workshop nếm thử', type: 'OUT' },
    DAMAGE_LOSS: { label: 'Hư hỏng / Bể vỡ / Móp méo', type: 'OUT' },
    INVENTORY_ADJUST: { label: 'Kiểm kê điều chỉnh kho', type: 'ADJ' },
    OTHER: { label: 'Mục đích khác', type: 'OUT' }
}

function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function buildPosmVoucherPrintHtml(params: {
    companyName: string
    companyTaxId: string | null
    companyAddress: string | null
    headerTx: PosmTransactionItem
    lines: PosmTransactionItem[]
    totalQty: number
    totalCost: number
}): string {
    const { companyName, companyTaxId, companyAddress, headerTx, lines, totalQty, totalCost } = params
    const reasonLabel = POSM_REASON_LABELS[headerTx.reason]?.label || headerTx.reason
    const totalUnitLabel = lines.length === 1 ? lines[0].unit : `${lines.length} loại vật phẩm`

    const rowsHtml = lines.map((line, index) => {
        const categoryLabel = POSM_CATEGORY_CONFIG[line.category]?.label || line.category
        const unitCostText = line.unitCost > 0 ? formatVND(line.unitCost) : '—'
        const totalCostText = line.totalCost > 0 ? formatVND(line.totalCost) : '—'
        return `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td class="text-center font-bold">${escapeHtml(line.posmProductCode)}</td>
                <td class="font-semibold">${escapeHtml(line.posmProductName)}</td>
                <td class="text-center">${escapeHtml(categoryLabel)}</td>
                <td class="text-center">${escapeHtml(line.unit)}</td>
                <td class="text-center font-bold">${escapeHtml(line.qty)}</td>
                <td class="text-right">${escapeHtml(unitCostText)}</td>
                <td class="text-right font-bold">${escapeHtml(totalCostText)}</td>
            </tr>
        `
    }).join('')

    return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Phiếu Xuất Kho POSM - ${escapeHtml(headerTx.docNo)}</title>
<style>
  @page {
    size: A4 portrait;
    margin: 15mm 12mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Times New Roman', Times, serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .voucher {
    width: 100%;
    background: #ffffff;
    color: #0f172a;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .company-name {
    margin: 0 0 3px 0;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: #0f172a;
  }
  .company-meta {
    margin: 2px 0 0 0;
    font-size: 11px;
    color: #475569;
  }
  .form-meta {
    text-align: right;
    font-size: 11px;
    flex-shrink: 0;
  }
  .form-meta p {
    margin: 2px 0;
  }
  .doc-no {
    margin-top: 4px !important;
    font-weight: 700;
    color: #0f172a;
  }
  .doc-no span {
    color: #1e3a8a;
  }
  .title-block {
    text-align: center;
    margin: 8px 0 18px 0;
  }
  .title-block h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #0f172a;
  }
  .title-block p {
    margin: 4px 0 0 0;
    font-style: italic;
    color: #475569;
    font-size: 12px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
    margin-bottom: 18px;
    font-size: 12px;
  }
  .meta-full {
    grid-column: span 2;
  }
  .table-wrap {
    border: 1px solid #1e293b;
    margin-bottom: 16px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  thead {
    display: table-header-group;
  }
  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  th, td {
    padding: 7px 8px;
    border-right: 1px solid #1e293b;
    vertical-align: middle;
  }
  th:last-child, td:last-child {
    border-right: none;
  }
  thead tr {
    background: #f1f5f9;
    border-bottom: 1px solid #1e293b;
    font-weight: 700;
    text-align: center;
  }
  tbody tr {
    border-bottom: 1px solid #cbd5e1;
  }
  tfoot tr {
    background: #f8fafc;
    border-top: 1px solid #1e293b;
    font-weight: 700;
  }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .summary {
    margin-bottom: 18px;
    font-size: 12px;
  }
  .summary p {
    margin: 3px 0;
  }
  .summary-note {
    font-style: italic;
    color: #475569;
    font-size: 11px;
  }
  .signatures {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    padding-top: 16px;
    text-align: center;
    font-size: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signatures p {
    margin: 2px 0;
  }
  .sig-hint {
    font-style: italic;
    font-size: 10px;
    color: #64748b;
  }
  .sig-space {
    height: 60px;
  }
  .sig-name {
    font-weight: 600;
    color: #334155;
  }
</style>
</head>
<body>
  <div class="voucher">
    <div class="header">
      <div>
        <h4 class="company-name">${escapeHtml(companyName)}</h4>
        ${companyTaxId ? `<p class="company-meta">MST: ${escapeHtml(companyTaxId)}</p>` : ''}
        ${companyAddress ? `<p class="company-meta">Địa chỉ: ${escapeHtml(companyAddress)}</p>` : ''}
        <p class="company-meta">Bộ Phận: Kho Vận &amp; Tiếp Thị (WMS - Marketing POSM)</p>
      </div>
      <div class="form-meta">
        <p class="font-bold">Mẫu số: 02 - VT</p>
        <p style="font-style: italic; color: #64748b;">(Ban hành theo TT 200/2014/TT-BTC)</p>
        <p class="doc-no">Số: <span>${escapeHtml(headerTx.docNo)}</span></p>
        <p style="color: #475569;">Ngày: ${escapeHtml(formatDate(headerTx.performedAt))}</p>
      </div>
    </div>

    <div class="title-block">
      <h1>PHIẾU XUẤT KHO VẬT PHẨM POSM</h1>
      <p>(Kiêm Biên Bản Bàn Giao Vật Phẩm Tiếp Thị &amp; Quà Tặng)</p>
    </div>

    <div class="meta-grid">
      <div><strong>Người nhận / Đơn vị: </strong><span>${escapeHtml(headerTx.recipient || '....................................................................')}</span></div>
      <div><strong>Nhân viên đề xuất: </strong><span>${escapeHtml(headerTx.requestedBy || '....................................................................')}</span></div>
      <div><strong>Mục đích xuất: </strong><span>${escapeHtml(reasonLabel)}</span></div>
      <div><strong>Đơn vị xuất: </strong><span>${escapeHtml(companyName)} (Kho POSM)</span></div>
      <div class="meta-full"><strong>Ghi chú / Đơn hàng liên quan: </strong><span>${escapeHtml(headerTx.notes || 'Cấp phát sử dụng theo quy định quản lý tiếp thị.')}</span></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width: 36px;">STT</th>
            <th style="width: 96px;">Mã POSM</th>
            <th>Tên Vật Phẩm Tiếp Thị</th>
            <th style="width: 105px;">Danh Mục</th>
            <th style="width: 58px;">ĐVT</th>
            <th style="width: 72px;">Số Lượng</th>
            <th style="width: 92px;">Đơn Giá</th>
            <th style="width: 102px;">Thành Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="text-right">Tổng cộng:</td>
            <td class="text-center">${escapeHtml(totalQty)}</td>
            <td></td>
            <td class="text-right">${escapeHtml(totalCost > 0 ? formatVND(totalCost) : '—')}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="summary">
      <p><strong>Tổng số lượng: </strong><span style="font-style: italic;">${escapeHtml(totalQty)} (${escapeHtml(totalUnitLabel)})</span></p>
      <p class="summary-note">* Vật phẩm POSM bàn giao đúng quy cách, bên nhận có trách nhiệm bảo quản và sử dụng đúng mục đích.</p>
    </div>

    <div class="signatures">
      <div>
        <p class="font-bold">Người Lập Phiếu</p>
        <p class="sig-hint">(Ký, họ tên)</p>
        <div class="sig-space"></div>
        <p class="sig-name">${escapeHtml(headerTx.requestedBy || 'Người lập')}</p>
      </div>
      <div>
        <p class="font-bold">Người Nhận Hàng</p>
        <p class="sig-hint">(Ký, họ tên)</p>
        <div class="sig-space"></div>
        <p class="sig-name">${escapeHtml(headerTx.recipient || 'Người nhận')}</p>
      </div>
      <div>
        <p class="font-bold">Thủ Kho Xuất</p>
        <p class="sig-hint">(Ký, họ tên)</p>
        <div class="sig-space"></div>
        <p class="sig-name">Thủ kho</p>
      </div>
      <div>
        <p class="font-bold">Kế Toán</p>
        <p class="sig-hint">(Ký, họ tên)</p>
        <div class="sig-space"></div>
        <p class="sig-name">Kế toán</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

function printPosmVoucher(html: string): boolean {
    if (typeof document === 'undefined') return false

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    document.body.appendChild(iframe)

    let cleaned = false
    const cleanup = () => {
        if (cleaned) return
        cleaned = true
        iframe.remove()
    }

    const frameDoc = iframe.contentDocument
    const frameWindow = iframe.contentWindow
    if (!frameDoc || !frameWindow) {
        cleanup()
        return false
    }

    frameDoc.open()
    frameDoc.write(html)
    frameDoc.close()

    frameWindow.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60000)

    window.setTimeout(() => {
        try {
            frameWindow.focus()
            frameWindow.print()
        } catch {
            cleanup()
            window.print()
        }
    }, 50)

    return true
}

export function PosmInventoryTab() {
    const [subTab, setSubTab] = useState<'ITEMS' | 'TX_LOG'>('ITEMS')
    const [loading, setLoading] = useState(true)

    const [products, setProducts] = useState<PosmProductItem[]>([])
    const [transactions, setTransactions] = useState<PosmTransactionItem[]>([])
    const [stats, setStats] = useState<PosmStats | null>(null)
    const [legalEntities, setLegalEntities] = useState<PosmLegalEntityOption[]>([])

    // Filters
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
    const [lowStockFilter, setLowStockFilter] = useState(false)

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [editItem, setEditItem] = useState<PosmProductItem | null>(null)
    const [showInboundModal, setShowInboundModal] = useState(false)
    const [showOutboundModal, setShowOutboundModal] = useState(false)
    const [showPrintVoucherModal, setShowPrintVoucherModal] = useState(false)
    const [selectedVoucherLines, setSelectedVoucherLines] = useState<PosmTransactionItem[]>([])
    const [printLegalEntityId, setPrintLegalEntityId] = useState('')
    const [targetProduct, setTargetProduct] = useState<PosmProductItem | null>(null)

    // Master Data Form
    const [formName, setFormName] = useState('')
    const [formCategory, setFormCategory] = useState<PosmCategory>('GLASSWARE_TOOLS')
    const [formUnit, setFormUnit] = useState('Cái')
    const [formBrand, setFormBrand] = useState('')
    const [formLocation, setFormLocation] = useState('')
    const [formCostPrice, setFormCostPrice] = useState<number | string>('')
    const [formMinAlert, setFormMinAlert] = useState<number | string>(5)
    const [formInitialQty, setFormInitialQty] = useState<number | string>(0)
    const [formNotes, setFormNotes] = useState('')
    const [formSubmitting, setFormSubmitting] = useState(false)

    // Inbound Form
    const [inboundProductId, setInboundProductId] = useState('')
    const [inboundQty, setInboundQty] = useState<number | string>(1)
    const [inboundReason, setInboundReason] = useState<PosmReason>('PURCHASE_INBOUND')
    const [inboundUnitCost, setInboundUnitCost] = useState<number | string>('')
    const [inboundNotes, setInboundNotes] = useState('')
    const [inboundSubmitting, setInboundSubmitting] = useState(false)

    // Outbound Form (hỗ trợ nhiều dòng POSM + chọn công ty)
    const [outboundLegalEntityId, setOutboundLegalEntityId] = useState('')
    const [outboundLines, setOutboundLines] = useState<{ key: string; posmProductId: string; qty: number | string }[]>([])
    const [outboundReason, setOutboundReason] = useState<PosmReason>('SALES_ALLOCATION')
    const [outboundRecipient, setOutboundRecipient] = useState('')
    const [outboundRequestedBy, setOutboundRequestedBy] = useState('')
    const [outboundNotes, setOutboundNotes] = useState('')
    const [outboundSubmitting, setOutboundSubmitting] = useState(false)

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [prods, txs, st, entities] = await Promise.all([
                getPosmProducts({
                    search: search || undefined,
                    category: categoryFilter,
                    lowStockOnly: lowStockFilter
                }),
                getPosmTransactions(),
                getPosmStats(),
                getPosmLegalEntities()
            ])
            setProducts(prods)
            setTransactions(txs)
            setStats(st)
            setLegalEntities(entities)
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tải dữ liệu kho POSM')
        } finally {
            setLoading(false)
        }
    }, [search, categoryFilter, lowStockFilter])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Reset Master Data Form
    const resetMasterForm = () => {
        setFormName('')
        setFormCategory('GLASSWARE_TOOLS')
        setFormUnit('Cái')
        setFormBrand('')
        setFormLocation('')
        setFormCostPrice('')
        setFormMinAlert(5)
        setFormInitialQty(0)
        setFormNotes('')
        setEditItem(null)
    }

    const openCreateMaster = () => {
        resetMasterForm()
        setShowCreateModal(true)
    }

    const openEditMaster = (item: PosmProductItem) => {
        setEditItem(item)
        setFormName(item.name)
        setFormCategory(item.category)
        setFormUnit(item.unit)
        setFormBrand(item.brand || '')
        setFormLocation(item.location || '')
        setFormCostPrice(item.costPrice || '')
        setFormMinAlert(item.minStockAlert)
        setFormNotes(item.notes || '')
        setShowCreateModal(true)
    }

    const handleSaveMaster = async () => {
        if (!formName.trim()) {
            toast.error('Vui lòng nhập tên vật phẩm POSM')
            return
        }
        setFormSubmitting(true)
        try {
            if (editItem) {
                await updatePosmProduct(editItem.id, {
                    name: formName,
                    category: formCategory,
                    unit: formUnit,
                    brand: formBrand || undefined,
                    location: formLocation || undefined,
                    costPrice: formCostPrice ? Number(formCostPrice) : 0,
                    minStockAlert: formMinAlert ? Number(formMinAlert) : 0,
                    notes: formNotes || undefined
                })
                toast.success('Cập nhật Master Data POSM thành công')
            } else {
                await createPosmProduct({
                    name: formName,
                    category: formCategory,
                    unit: formUnit,
                    brand: formBrand || undefined,
                    location: formLocation || undefined,
                    costPrice: formCostPrice ? Number(formCostPrice) : 0,
                    minStockAlert: formMinAlert ? Number(formMinAlert) : 0,
                    initialQty: formInitialQty ? Number(formInitialQty) : 0,
                    notes: formNotes || undefined
                })
                toast.success('Thêm mới vật phẩm POSM vào Master Data thành công')
            }
            setShowCreateModal(false)
            resetMasterForm()
            await loadData()
        } catch (error: any) {
            toast.error(error?.message || 'Lỗi khi lưu vật phẩm POSM')
        } finally {
            setFormSubmitting(false)
        }
    }

    // Open Quick Inbound
    const openInbound = (item?: PosmProductItem) => {
        setTargetProduct(item || null)
        setInboundProductId(item ? item.id : products[0]?.id || '')
        setInboundQty(1)
        setInboundReason('PURCHASE_INBOUND')
        setInboundUnitCost(item ? item.costPrice : '')
        setInboundNotes('')
        setShowInboundModal(true)
    }

    const handleSaveInbound = async () => {
        if (!inboundProductId) {
            toast.error('Vui lòng chọn vật phẩm POSM cần nhập')
            return
        }
        const qtyNum = Number(inboundQty)
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error('Số lượng nhập phải lớn hơn 0')
            return
        }

        setInboundSubmitting(true)
        try {
            await createPosmTransaction({
                posmProductId: inboundProductId,
                type: 'INBOUND',
                reason: inboundReason,
                qty: qtyNum,
                unitCost: inboundUnitCost ? Number(inboundUnitCost) : 0,
                notes: inboundNotes || undefined
            })
            toast.success(`Đã nhập ${qtyNum} sản phẩm vào Kho POSM`)
            setShowInboundModal(false)
            await loadData()
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tạo phiếu nhập kho POSM')
        } finally {
            setInboundSubmitting(false)
        }
    }

    // Open Quick Outbound
    const openOutbound = (item?: PosmProductItem) => {
        setTargetProduct(item || null)
        const defaultProductId = item ? item.id : products[0]?.id || ''
        setOutboundLines([{ key: `line-${Date.now()}`, posmProductId: defaultProductId, qty: 1 }])
        const defaultEntity = legalEntities.find(e => e.code === 'LC') || legalEntities[0]
        setOutboundLegalEntityId(defaultEntity?.id || '')
        setOutboundReason('SALES_ALLOCATION')
        setOutboundRecipient('')
        setOutboundRequestedBy('')
        setOutboundNotes('')
        setShowOutboundModal(true)
    }

    const addOutboundLine = () => {
        const pickedIds = new Set(outboundLines.map(l => l.posmProductId))
        const nextProduct = products.find(p => !pickedIds.has(p.id)) || products[0]
        setOutboundLines(prev => [
            ...prev,
            { key: `line-${Date.now()}-${prev.length}`, posmProductId: nextProduct?.id || '', qty: 1 }
        ])
    }

    const removeOutboundLine = (key: string) => {
        setOutboundLines(prev => (prev.length > 1 ? prev.filter(l => l.key !== key) : prev))
    }

    const updateOutboundLine = (key: string, patch: Partial<{ posmProductId: string; qty: number | string }>) => {
        setOutboundLines(prev => prev.map(l => (l.key === key ? { ...l, ...patch } : l)))
    }

    const deficitLines = useMemo(() => {
        return outboundLines
            .map(line => {
                const prod = products.find(p => p.id === line.posmProductId)
                const qtyNum = Number(line.qty)
                if (!prod || isNaN(qtyNum) || qtyNum <= prod.qtyOnHand) return null
                return { name: prod.name, qty: qtyNum, onHand: prod.qtyOnHand, unit: prod.unit }
            })
            .filter(Boolean) as { name: string; qty: number; onHand: number; unit: string }[]
    }, [outboundLines, products])

    const handleSaveOutbound = async (openPrintVoucher = false) => {
        if (outboundLines.length === 0 || outboundLines.some(l => !l.posmProductId)) {
            toast.error('Vui lòng chọn vật phẩm POSM cần xuất')
            return
        }
        const parsedLines = outboundLines.map(l => ({
            posmProductId: l.posmProductId,
            qty: Number(l.qty),
        }))
        if (parsedLines.some(l => isNaN(l.qty) || l.qty <= 0)) {
            toast.error('Số lượng xuất của mỗi dòng phải lớn hơn 0')
            return
        }

        setOutboundSubmitting(true)
        try {
            const createdItems = await createPosmBatchTransaction({
                type: 'OUTBOUND',
                reason: outboundReason,
                legalEntityId: outboundLegalEntityId || null,
                recipient: outboundRecipient || undefined,
                requestedBy: outboundRequestedBy || undefined,
                notes: outboundNotes || undefined,
                allowDeficit: true,
                lines: parsedLines,
            })
            const docNo = createdItems[0]?.docNo || ''
            const totalQty = createdItems.reduce((s, item) => s + item.qty, 0)
            toast.success(`Đã xuất ${totalQty} vật phẩm (${createdItems.length} dòng) khỏi Kho POSM (${docNo})`)
            setShowOutboundModal(false)
            await loadData()

            if (openPrintVoucher && createdItems.length > 0) {
                setSelectedVoucherLines(createdItems)
                setPrintLegalEntityId(createdItems[0].legalEntityId || outboundLegalEntityId || legalEntities[0]?.id || '')
                setShowPrintVoucherModal(true)
            }
        } catch (error: any) {
            toast.error(error?.message || 'Không thể tạo phiếu xuất kho POSM')
        } finally {
            setOutboundSubmitting(false)
        }
    }

    const openPrintVoucherForTx = (tx: PosmTransactionItem) => {
        const sameDocLines = transactions.filter(item => item.docNo === tx.docNo)
        const lines = sameDocLines.length > 0 ? sameDocLines : [tx]
        setSelectedVoucherLines(lines)
        const defaultEntity = legalEntities.find(e => e.code === 'LC') || legalEntities[0]
        setPrintLegalEntityId(tx.legalEntityId || defaultEntity?.id || '')
        setShowPrintVoucherModal(true)
    }

    return (
        <div className="space-y-5">
            {/* ═══ TOP BANNER & STATS ═══ */}
            <div className="bg-white border border-slate-200 rounded-md p-5 shadow-2xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                                <Sparkles size={20} />
                            </span>
                            <h2 className="text-lg font-bold text-slate-900">
                                Kho Vật Phẩm Tiếp Thị & Quà Tặng (POSM)
                            </h2>
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
                                Độc Lập Với Tồn Rượu
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Quản lý toàn diện vật phẩm quảng cáo, ly rượu, khui, bình Decanter, bao bì hộp quà cao cấp, kệ trưng bày tại điểm bán và ấn phẩm tiếp thị.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            onClick={openCreateMaster}
                            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <Plus size={15} />
                            <span>Thêm Mã POSM</span>
                        </button>
                        <button
                            onClick={() => openInbound()}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <ArrowDownLeft size={15} />
                            <span>Nhập Kho POSM</span>
                        </button>
                        <button
                            onClick={() => openOutbound()}
                            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                            <ArrowUpRight size={15} />
                            <span>Xuất Kho POSM</span>
                        </button>
                        <button
                            onClick={loadData}
                            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                            title="Làm mới"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-4">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Danh Mục POSM</span>
                            <Boxes size={16} className="text-slate-400" />
                        </div>
                        <div className="text-xl font-bold text-slate-900">
                            {stats?.totalItems ?? 0} <span className="text-xs font-normal text-slate-500">mã</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Danh mục vật phẩm tiếp thị</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Tổng Tồn Kho POSM</span>
                            <Package size={16} className="text-amber-600" />
                        </div>
                        <div className="text-xl font-bold text-amber-700">
                            {stats?.totalOnHandQty ?? 0} <span className="text-xs font-normal text-slate-500">vật phẩm</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Sẵn sàng xuất cấp phát</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Giá Trị Tồn Dự Toán</span>
                            <DollarSign size={16} className="text-emerald-600" />
                        </div>
                        <div className="text-xl font-bold text-emerald-700">
                            {formatVND(stats?.totalInventoryValue ?? 0)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Theo giá vốn ước tính</div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                        <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="text-xs font-medium">Cảnh Báo Chạm Đáy</span>
                            <AlertTriangle size={16} className={stats?.lowStockAlertCount ? 'text-rose-600' : 'text-slate-400'} />
                        </div>
                        <div className={`text-xl font-bold ${stats?.lowStockAlertCount ? 'text-rose-600' : 'text-slate-900'}`}>
                            {stats?.lowStockAlertCount ?? 0} <span className="text-xs font-normal text-slate-500">mã</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Dưới ngưỡng tối thiểu</div>
                    </div>
                </div>
            </div>

            {/* ═══ SUB-TAB SWITCHER & FILTER BAR ═══ */}
            <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSubTab('ITEMS')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                subTab === 'ITEMS'
                                    ? 'bg-amber-500/10 text-amber-800 border border-amber-200 shadow-2xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <Boxes size={14} />
                            <span>Danh Mục & Tồn Kho POSM ({products.length})</span>
                        </button>
                        <button
                            onClick={() => setSubTab('TX_LOG')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                subTab === 'TX_LOG'
                                    ? 'bg-amber-500/10 text-amber-800 border border-amber-200 shadow-2xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            <History size={14} />
                            <span>Nhật Ký Nhập / Xuất ({transactions.length})</span>
                        </button>
                    </div>

                    {/* Low Stock Toggle */}
                    {subTab === 'ITEMS' && (
                        <button
                            onClick={() => setLowStockFilter(prev => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                                lowStockFilter
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <AlertCircle size={14} className={lowStockFilter ? 'text-rose-600' : 'text-slate-400'} />
                            <span>Lọc hàng sắp hết ({stats?.lowStockAlertCount ?? 0})</span>
                        </button>
                    )}
                </div>

                {/* Filter Inputs */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="relative flex-1 w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã POSM, tên vật phẩm, thương hiệu tài trợ, vị trí kho..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                        />
                    </div>

                    {subTab === 'ITEMS' && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <select
                                value={categoryFilter}
                                onChange={e => setCategoryFilter(e.target.value)}
                                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                                <option value="ALL">Tất cả nhóm POSM</option>
                                {Object.entries(POSM_CATEGORY_CONFIG).map(([key, cfg]) => (
                                    <option key={key} value={key}>
                                        {cfg.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ TAB CONTENT: MASTER DATA & STOCK LIST ═══ */}
            {subTab === 'ITEMS' && (
                <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
                    <div className="hidden md:block overflow-x-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-2.5">Mã & Vật Phẩm POSM</th>
                                    <th className="py-2.5 px-2.5">Nhóm Phân Loại</th>
                                    <th className="py-2.5 px-2.5">ĐVT / Hãng</th>
                                    <th className="py-2.5 px-2.5 text-right">Đơn Giá Vốn</th>
                                    <th className="py-2.5 px-2.5 text-center">Tồn Kho Hiện Tại</th>
                                    <th className="py-2.5 px-2.5 text-center">Ngưỡng Tối Thiểu</th>
                                    <th className="py-2.5 px-2.5">Vị Trí Lưu Kho</th>
                                    <th className="py-2.5 px-2.5 text-right">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            <Boxes size={36} className="mx-auto mb-2 text-slate-300 stroke-1" />
                                            <p className="font-semibold text-slate-600">Chưa có vật phẩm POSM nào</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Bấm nút &quot;Thêm Mã POSM&quot; để khởi tạo danh mục vật phẩm tiếp thị độc lập.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    products.map(item => {
                                        const cat = POSM_CATEGORY_CONFIG[item.category] || POSM_CATEGORY_CONFIG.OTHER
                                        const isLow = item.isLowStock
                                        const CatIcon = cat.icon
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                                                <td className="py-2.5 px-2.5">
                                                    <div className="font-bold text-slate-900 group-hover:text-amber-700 transition">
                                                        {item.name}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                                        {item.posmCode}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border"
                                                        style={{
                                                            background: cat.bg,
                                                            color: cat.color,
                                                            borderColor: cat.border
                                                        }}
                                                    >
                                                        <CatIcon size={12} className="shrink-0" />
                                                        <span>{cat.label}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <div className="text-slate-900 font-semibold">{item.unit}</div>
                                                    {item.brand && (
                                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                                            Brand: <span className="font-medium text-slate-700">{item.brand}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right font-medium text-slate-700">
                                                    {formatVND(item.costPrice)}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <div className="inline-flex items-center gap-1.5">
                                                        <span className={`text-sm font-extrabold ${isLow ? 'text-rose-600' : 'text-slate-900'}`}>
                                                            {item.qtyOnHand}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">{item.unit}</span>
                                                        {isLow && (
                                                            <span className="text-rose-500" title="Chạm ngưỡng tồn tối thiểu">
                                                                <AlertTriangle size={14} />
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center text-slate-500 font-mono text-xs">
                                                    {item.minStockAlert > 0 ? item.minStockAlert : '—'}
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span className="text-xs text-slate-600 font-medium">
                                                        {item.location || 'Kho Tổng'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openInbound(item)}
                                                            className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700 transition cursor-pointer"
                                                            title="Nhập thêm kho"
                                                        >
                                                            <ArrowDownLeft size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openOutbound(item)}
                                                            className="p-1.5 rounded-md hover:bg-blue-50 text-blue-700 transition cursor-pointer"
                                                            title="Xuất cấp phát"
                                                        >
                                                            <ArrowUpRight size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditMaster(item)}
                                                            className="p-1.5 rounded-md hover:bg-amber-50 text-amber-700 transition cursor-pointer"
                                                            title="Chỉnh sửa thông tin POSM"
                                                        >
                                                            <Edit2 size={14} />
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

                    {/* Mobile Cards (< 768px) */}
                    <div className="block md:hidden divide-y divide-slate-100 p-2.5 space-y-2">
                        {products.length === 0 ? (
                            <div className="py-10 text-center text-slate-400 text-xs">Chưa có vật phẩm POSM nào</div>
                        ) : (
                            products.map(item => {
                                const cat = POSM_CATEGORY_CONFIG[item.category] || POSM_CATEGORY_CONFIG.OTHER
                                const isLow = item.isLowStock
                                return (
                                    <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                {item.posmCode}
                                            </span>
                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border"
                                                style={{ background: cat.bg, color: cat.color, borderColor: cat.border }}>
                                                {cat.label}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 leading-snug">{item.name}</p>
                                        <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                                            <span>Vị trí: <strong className="text-slate-800">{item.location || 'Kho Tổng'}</strong></span>
                                            <span>Tồn: <strong className={`font-mono text-sm ${isLow ? 'text-rose-600' : 'text-emerald-700'}`}>{item.qtyOnHand} {item.unit}</strong></span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 pt-1">
                                            <button onClick={() => openInbound(item)} className="px-2.5 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                + Nhập
                                            </button>
                                            <button onClick={() => openOutbound(item)} className="px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                - Xuất
                                            </button>
                                            <button onClick={() => openEditMaster(item)} className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                                Sửa
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TAB CONTENT: TRANSACTION LOG ═══ */}
            {subTab === 'TX_LOG' && (
                <div className="bg-white border border-slate-200 rounded-md overflow-hidden shadow-2xs">
                    <div className="overflow-x-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                                    <th className="py-2.5 px-2.5">Số Phiếu</th>
                                    <th className="py-2.5 px-2.5">Thời Gian</th>
                                    <th className="py-2.5 px-2.5">Loại Phiếu</th>
                                    <th className="py-2.5 px-2.5">Vật Phẩm POSM</th>
                                    <th className="py-2.5 px-2.5 text-center">Số Lượng</th>
                                    <th className="py-2.5 px-2.5">Lý Do / Mục Đích</th>
                                    <th className="py-2.5 px-2.5">Người Nhận / Bộ Phận</th>
                                    <th className="py-2.5 px-2.5">Ghi Chú</th>
                                    <th className="py-2.5 px-2.5 text-center">Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-400">
                                            <History size={36} className="mx-auto mb-2 text-slate-300 stroke-1" />
                                            <p className="font-semibold text-slate-600">Chưa có giao dịch nhập/xuất kho POSM nào</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map(tx => {
                                        const isOut = tx.type === 'OUTBOUND'
                                        const reasonInfo = POSM_REASON_LABELS[tx.reason] || { label: tx.reason, type: 'OUT' }
                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                                                <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900">
                                                    {isOut ? (
                                                        <button
                                                            onClick={() => openPrintVoucherForTx(tx)}
                                                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-bold font-mono"
                                                            title="Bấm để xem và in phiếu xuất kho POSM"
                                                        >
                                                            {tx.docNo}
                                                        </button>
                                                    ) : (
                                                        tx.docNo
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-500 font-medium">
                                                    {formatDate(tx.performedAt)}
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                            isOut
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        }`}
                                                    >
                                                        {isOut ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                        <span>{isOut ? 'Xuất Kho' : 'Nhập Kho'}</span>
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <div className="font-bold text-slate-900">{tx.posmProductName}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono">{tx.posmProductCode}</div>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <span className={`font-bold ${isOut ? 'text-blue-700' : 'text-emerald-700'}`}>
                                                        {isOut ? `-${tx.qty}` : `+${tx.qty}`}
                                                    </span>{' '}
                                                    <span className="text-[11px] text-slate-500">{tx.unit}</span>
                                                </td>
                                                <td className="py-2.5 px-2.5">
                                                    <span className="text-xs font-semibold text-slate-700">
                                                        {reasonInfo.label}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-600">
                                                    {tx.recipient ? (
                                                        <span className="font-medium text-slate-900">{tx.recipient}</span>
                                                    ) : (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-slate-500 text-[11px]">
                                                    {tx.notes || '—'}
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    {isOut ? (
                                                        <button
                                                            onClick={() => openPrintVoucherForTx(tx)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                                                            title="In / Xem Phiếu Xuất Kho POSM"
                                                        >
                                                            <Printer size={12} />
                                                            <span>In Phiếu</span>
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
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

            {/* ═══ MODAL 1: CREATE / EDIT POSM MASTER DATA ═══ */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[2px]">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                                    <Sparkles size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    {editItem ? 'Chỉnh Sửa Vật Phẩm POSM' : 'Thêm Mới Vật Phẩm POSM'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tên vật phẩm POSM <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="VD: Ly Vang Bordeaux Riedel 650ml, Kệ Gỗ Trưng Bày 6 Chai..."
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Nhóm phân loại
                                    </label>
                                    <select
                                        value={formCategory}
                                        onChange={e => setFormCategory(e.target.value as PosmCategory)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    >
                                        {Object.entries(POSM_CATEGORY_CONFIG).map(([k, v]) => (
                                            <option key={k} value={k}>
                                                {v.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn vị tính (ĐVT)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Cái, Chiếc, Bộ, Hộp, Cuộn..."
                                        value={formUnit}
                                        onChange={e => setFormUnit(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Hãng / Thương hiệu tài trợ
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="VD: Riedel, Penfolds, Banfi..."
                                        value={formBrand}
                                        onChange={e => setFormBrand(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Vị trí lưu kho
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="VD: Kệ POSM-A1, Ngăn 3..."
                                        value={formLocation}
                                        onChange={e => setFormLocation(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Đơn giá vốn ước tính (VNĐ)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formCostPrice}
                                        onChange={e => setFormCostPrice(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Ngưỡng cảnh báo tồn tối thiểu
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="5"
                                        value={formMinAlert}
                                        onChange={e => setFormMinAlert(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>

                            {!editItem && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số lượng tồn ban đầu nhập kho
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={formInitialQty}
                                        onChange={e => setFormInitialQty(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Nếu &gt; 0, hệ thống tự động sinh 1 phiếu nhập kho ban đầu (PIR-...)
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú thêm
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Quy cách đóng gói, hướng dẫn bảo quản vật phẩm..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={handleSaveMaster}
                                disabled={formSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>{formSubmitting ? 'Đang lưu...' : editItem ? 'Cập Nhật' : 'Tạo Mã POSM'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 2: INBOUND (NHẬP KHO POSM) ═══ */}
            {showInboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[2px]">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-emerald-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                                    <ArrowDownLeft size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    Lập Phiếu Nhập Kho POSM (PIR)
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowInboundModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Chọn vật phẩm POSM <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={inboundProductId}
                                    onChange={e => {
                                        setInboundProductId(e.target.value)
                                        const found = products.find(p => p.id === e.target.value)
                                        if (found) setInboundUnitCost(found.costPrice)
                                    }}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-semibold"
                                >
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            [{p.posmCode}] {p.name} (Tồn: {p.qtyOnHand} {p.unit})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Lý do nhập kho
                                    </label>
                                    <select
                                        value={inboundReason}
                                        onChange={e => setInboundReason(e.target.value as PosmReason)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                    >
                                        <option value="PURCHASE_INBOUND">Mua mới nhập kho</option>
                                        <option value="SUPPLIER_SPONSOR">Hãng / Nhà cung cấp tài trợ</option>
                                        <option value="EVENT_RETURN">Hoàn trả sau sự kiện</option>
                                        <option value="INVENTORY_ADJUST">Điều chỉnh kiểm kê</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Số lượng nhập <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={inboundQty}
                                        onChange={e => setInboundQty(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Đơn giá nhập (VNĐ)
                                </label>
                                <input
                                    type="number"
                                    value={inboundUnitCost}
                                    onChange={e => setInboundUnitCost(e.target.value)}
                                    placeholder="Giá vốn / Chi phí mua"
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú phiếu nhập
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Số hóa đơn mua hàng, tên nhà tài trợ, sự kiện..."
                                    value={inboundNotes}
                                    onChange={e => setInboundNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowInboundModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={handleSaveInbound}
                                disabled={inboundSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>{inboundSubmitting ? 'Đang xử lý...' : 'Xác Nhận Nhập Kho'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 3: OUTBOUND (XUẤT KHO POSM — NHIỀU VẬT PHẨM) ═══ */}
            {showOutboundModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[2px] overflow-y-auto">
                    <div className="bg-white rounded-md shadow-2xl border border-slate-200 w-full max-w-2xl my-4 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-blue-50/50">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                                    <ArrowUpRight size={18} />
                                </span>
                                <h3 className="font-bold text-slate-900 text-sm">
                                    Lập Phiếu Xuất Kho POSM (PIO)
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowOutboundModal(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Công ty / Pháp nhân xuất <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={outboundLegalEntityId}
                                        onChange={e => setOutboundLegalEntityId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                                    >
                                        {legalEntities.map(le => (
                                            <option key={le.id} value={le.id}>
                                                [{le.code}] {le.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Mục đích xuất kho
                                    </label>
                                    <select
                                        value={outboundReason}
                                        onChange={e => setOutboundReason(e.target.value as PosmReason)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="SALES_ALLOCATION">Cấp phát Sales / PG thị trường</option>
                                        <option value="HORECA_PLACEMENT">Trang bị điểm bán / HORECA</option>
                                        <option value="PROMO_GIFT">Quà tặng CTKM đơn hàng</option>
                                        <option value="EVENT_WORKSHOP">Sự kiện / Workshop nếm thử</option>
                                        <option value="DAMAGE_LOSS">Hư hỏng / Bể vỡ / Móp méo</option>
                                        <option value="OTHER">Mục đích khác</option>
                                    </select>
                                </div>
                            </div>

                            {/* Multi-POSM Item Lines */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Danh sách vật phẩm POSM xuất ({outboundLines.length} dòng) <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addOutboundLine}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                                    >
                                        <Plus size={12} />
                                        <span>Thêm vật phẩm POSM</span>
                                    </button>
                                </div>

                                <div className="space-y-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50/60">
                                    {outboundLines.map((line, idx) => {
                                        const prod = products.find(p => p.id === line.posmProductId)
                                        const lineDeficit = prod && Number(line.qty) > prod.qtyOnHand
                                        return (
                                            <div key={line.key} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-md border border-slate-200">
                                                <span className="text-[11px] font-mono font-bold text-slate-400 w-5 text-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <select
                                                        value={line.posmProductId}
                                                        onChange={e => updateOutboundLine(line.key, { posmProductId: e.target.value })}
                                                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                                                    >
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                [{p.posmCode}] {p.name} (Tồn: {p.qtyOnHand} {p.unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={line.qty}
                                                        onChange={e => updateOutboundLine(line.key, { qty: e.target.value })}
                                                        className={`w-20 px-2.5 py-1.5 text-xs bg-slate-50 border rounded-md text-slate-900 focus:outline-none font-bold text-center ${
                                                            lineDeficit ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 focus:border-blue-500'
                                                        }`}
                                                        aria-label={`Số lượng dòng ${idx + 1}`}
                                                    />
                                                    <span className="text-[11px] text-slate-500 w-10 truncate">
                                                        {prod?.unit || 'Cái'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOutboundLine(line.key)}
                                                        disabled={outboundLines.length <= 1}
                                                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                        title="Xóa dòng này"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Warning if deficit */}
                            {deficitLines.length > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <div className="text-[11px] text-amber-800 leading-relaxed">
                                        <span className="font-bold">Cảnh báo thiếu tồn kho:</span>{' '}
                                        {deficitLines.map(d => `${d.name} (xuất ${d.qty}, tồn ${d.onHand} ${d.unit})`).join('; ')}. Hệ thống cho phép thủ kho xuất trước và làm phiếu nhập bù sau.
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Người nhận / Đại lý
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Tên khách, Bar, Showroom..."
                                        value={outboundRecipient}
                                        onChange={e => setOutboundRecipient(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Nhân viên đề xuất
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Sales rep / Marketing..."
                                        value={outboundRequestedBy}
                                        onChange={e => setOutboundRequestedBy(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ghi chú xuất kho
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Mã đơn hàng SO liên quan, tên sự kiện..."
                                    value={outboundNotes}
                                    onChange={e => setOutboundNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setShowOutboundModal(false)}
                                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                onClick={() => handleSaveOutbound(false)}
                                disabled={outboundSubmitting}
                                className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md transition cursor-pointer flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={14} />
                                <span>Chỉ Lưu Kho</span>
                            </button>
                            <button
                                onClick={() => handleSaveOutbound(true)}
                                disabled={outboundSubmitting}
                                className="px-4 py-2 text-xs font-bold bg-[#0E7490] hover:bg-[#155E75] text-white rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                            >
                                <Printer size={14} />
                                <span>Xác Nhận & In Phiếu Xuất</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ MODAL 4: PHIẾU XUẤT KHO POSM (PRINTABLE VOUCHER) ═══ */}
            {showPrintVoucherModal && selectedVoucherLines.length > 0 && (() => {
                const headerTx = selectedVoucherLines[0]
                const activeEntity =
                    legalEntities.find(e => e.id === printLegalEntityId) ||
                    legalEntities.find(e => e.code === 'LC') ||
                    legalEntities[0]
                const companyName = activeEntity?.name || headerTx.legalEntityName || "CÔNG TY TNHH HẦM RƯỢU LY'S"
                const companyTaxId = activeEntity?.taxId || (!activeEntity ? '0109902863' : null)
                const companyAddress = activeEntity?.address || (!activeEntity ? 'Số 12 Ngõ 52 Đường Giang Văn Minh, Phường Ba Đình, Thành phố Hà Nội, Việt Nam.' : null)
                const totalVoucherQty = selectedVoucherLines.reduce((sum, l) => sum + l.qty, 0)
                const totalVoucherCost = selectedVoucherLines.reduce((sum, l) => sum + l.totalCost, 0)

                const handlePrintVoucher = () => {
                    const html = buildPosmVoucherPrintHtml({
                        companyName,
                        companyTaxId,
                        companyAddress,
                        headerTx,
                        lines: selectedVoucherLines,
                        totalQty: totalVoucherQty,
                        totalCost: totalVoucherCost,
                    })
                    if (!printPosmVoucher(html)) {
                        toast.error('Không thể khởi tạo khung in, vui lòng thử lại')
                    }
                }

                const voucherPaper = (
                    <div
                        id="posm-print-voucher"
                        className="p-6 sm:p-10 bg-white text-slate-900 text-xs space-y-6"
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                            <div>
                                <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                                    {companyName}
                                </h4>
                                {companyTaxId && (
                                    <p className="text-[11px] text-slate-600">
                                        MST: {companyTaxId}
                                    </p>
                                )}
                                {companyAddress && (
                                    <p className="text-[11px] text-slate-600">
                                        Địa chỉ: {companyAddress}
                                    </p>
                                )}
                                <p className="text-[11px] text-slate-600">
                                    Bộ Phận: Kho Vận & Tiếp Thị (WMS - Marketing POSM)
                                </p>
                            </div>
                            <div className="text-right text-[11px] space-y-0.5 shrink-0">
                                <p className="font-bold">Mẫu số: 02 - VT</p>
                                <p className="italic text-slate-500">(Ban hành theo TT 200/2014/TT-BTC)</p>
                                <p className="font-mono font-bold text-slate-900 mt-1">
                                    Số: <span className="text-blue-900">{headerTx.docNo}</span>
                                </p>
                                <p className="text-slate-600">
                                    Ngày: {formatDate(headerTx.performedAt)}
                                </p>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center space-y-1 py-1">
                            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-900">
                                PHIẾU XUẤT KHO VẬT PHẨM POSM
                            </h2>
                            <p className="italic text-slate-600 text-xs">
                                (Kiêm Biên Bản Bàn Giao Vật Phẩm Tiếp Thị & Quà Tặng)
                            </p>
                        </div>

                        {/* Meta Information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
                            <div>
                                <span className="font-bold">Người nhận / Đơn vị: </span>
                                <span>{headerTx.recipient || '....................................................................'}</span>
                            </div>
                            <div>
                                <span className="font-bold">Nhân viên đề xuất: </span>
                                <span>{headerTx.requestedBy || '....................................................................'}</span>
                            </div>
                            <div>
                                <span className="font-bold">Mục đích xuất: </span>
                                <span>{POSM_REASON_LABELS[headerTx.reason]?.label || headerTx.reason}</span>
                            </div>
                            <div>
                                <span className="font-bold">Đơn vị xuất: </span>
                                <span>{companyName} (Kho POSM)</span>
                            </div>
                            <div className="sm:col-span-2">
                                <span className="font-bold">Ghi chú / Đơn hàng liên quan: </span>
                                <span>{headerTx.notes || 'Cấp phát sử dụng theo quy định quản lý tiếp thị.'}</span>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="border border-slate-800">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-100 text-slate-900 font-bold text-center">
                                        <th className="p-2 border-r border-slate-800 w-10">STT</th>
                                        <th className="p-2 border-r border-slate-800 w-28">Mã POSM</th>
                                        <th className="p-2 border-r border-slate-800">Tên Vật Phẩm Tiếp Thị</th>
                                        <th className="p-2 border-r border-slate-800 w-24">Danh Mục</th>
                                        <th className="p-2 border-r border-slate-800 w-16">ĐVT</th>
                                        <th className="p-2 border-r border-slate-800 w-20">Số Lượng</th>
                                        <th className="p-2 border-r border-slate-800 w-24">Đơn Giá</th>
                                        <th className="p-2 w-28">Thành Tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedVoucherLines.map((line, index) => (
                                        <tr key={line.id} className="border-b border-slate-300">
                                            <td className="p-2 border-r border-slate-800 text-center">{index + 1}</td>
                                            <td className="p-2 border-r border-slate-800 font-mono font-bold text-center">
                                                {line.posmProductCode}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 font-semibold">
                                                {line.posmProductName}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center">
                                                {POSM_CATEGORY_CONFIG[line.category]?.label || line.category}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center">
                                                {line.unit}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-center font-bold">
                                                {line.qty}
                                            </td>
                                            <td className="p-2 border-r border-slate-800 text-right font-mono">
                                                {line.unitCost > 0 ? formatVND(line.unitCost) : '—'}
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold">
                                                {line.totalCost > 0 ? formatVND(line.totalCost) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold border-t border-slate-800 bg-slate-50">
                                        <td colSpan={5} className="p-2 text-right border-r border-slate-800">
                                            Tổng cộng:
                                        </td>
                                        <td className="p-2 text-center border-r border-slate-800">
                                            {totalVoucherQty}
                                        </td>
                                        <td className="p-2 border-r border-slate-800"></td>
                                        <td className="p-2 text-right font-mono">
                                            {totalVoucherCost > 0 ? formatVND(totalVoucherCost) : '—'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Amount in words & terms */}
                        <div className="space-y-1 text-xs">
                            <p>
                                <span className="font-bold">Tổng số lượng: </span>
                                <span className="italic">
                                    {totalVoucherQty} ({selectedVoucherLines.length === 1 ? selectedVoucherLines[0].unit : `${selectedVoucherLines.length} loại vật phẩm`})
                                </span>
                            </p>
                            <p className="italic text-slate-600 text-[11px]">
                                * Vật phẩm POSM bàn giao đúng quy cách, bên nhận có trách nhiệm bảo quản và sử dụng đúng mục đích.
                            </p>
                        </div>

                        {/* Signature Blocks */}
                        <div className="grid grid-cols-4 gap-2 pt-6 text-center text-xs break-inside-avoid">
                            <div>
                                <p className="font-bold">Người Lập Phiếu</p>
                                <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                <div className="h-16"></div>
                                <p className="font-semibold text-slate-700">{headerTx.requestedBy || 'Người lập'}</p>
                            </div>
                            <div>
                                <p className="font-bold">Người Nhận Hàng</p>
                                <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                <div className="h-16"></div>
                                <p className="font-semibold text-slate-700">{headerTx.recipient || 'Người nhận'}</p>
                            </div>
                            <div>
                                <p className="font-bold">Thủ Kho Xuất</p>
                                <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                <div className="h-16"></div>
                                <p className="font-semibold text-slate-700">Thủ kho</p>
                            </div>
                            <div>
                                <p className="font-bold">Kế Toán</p>
                                <p className="italic text-[10px] text-slate-500">(Ký, họ tên)</p>
                                <div className="h-16"></div>
                                <p className="font-semibold text-slate-700">Kế toán</p>
                            </div>
                        </div>
                    </div>
                )

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/35 backdrop-blur-[2px] overflow-y-auto">
                        <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-3xl my-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                            {/* Top Toolbar */}
                            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2">
                                    <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                                        <Printer size={16} />
                                    </span>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                                            Phiếu Xuất Kho POSM & Biên Bản Bàn Giao
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-mono">
                                            Mã số: {headerTx.docNo} · {selectedVoucherLines.length} dòng vật phẩm
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {legalEntities.length > 0 && (
                                        <select
                                            value={printLegalEntityId}
                                            onChange={e => setPrintLegalEntityId(e.target.value)}
                                            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:border-blue-500"
                                            aria-label="Chọn công ty hiển thị trên phiếu"
                                        >
                                            {legalEntities.map(le => (
                                                <option key={le.id} value={le.id}>
                                                    [{le.code}] {le.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <button
                                        onClick={handlePrintVoucher}
                                        className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Printer size={14} />
                                        <span>In Phiếu Xuất (Print)</span>
                                    </button>
                                    <button
                                        onClick={() => setShowPrintVoucherModal(false)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Printable Paper Preview */}
                            {voucherPaper}
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
