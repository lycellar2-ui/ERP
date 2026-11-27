import { formatVND } from '@/lib/utils'

export const POSM_PRINT_CATEGORY_LABELS: Record<string, string> = {
    GLASSWARE_TOOLS: 'Ly & Dụng Cụ Rượu',
    DISPLAY_STAND: 'Kệ & Trưng Bày',
    PACKAGING_GIFT: 'Bao Bì & Hộp Quà',
    MARKETING_COLLATERAL: 'Ấn Phẩm & Marketing',
    OTHER: 'Vật Phẩm Khác',
}

export const POSM_PRINT_REASON_LABELS: Record<string, string> = {
    PURCHASE_INBOUND: 'Mua mới nhập kho',
    SUPPLIER_SPONSOR: 'Hãng / Nhà cung cấp tài trợ',
    EVENT_RETURN: 'Hoàn trả tồn sau sự kiện',
    SALES_ALLOCATION: 'Cấp phát Sales / PG đi thị trường',
    HORECA_PLACEMENT: 'Trang bị điểm bán / HORECA',
    PROMO_GIFT: 'Quà tặng CTKM kèm đơn hàng',
    EVENT_WORKSHOP: 'Sự kiện / Workshop nếm thử',
    DAMAGE_LOSS: 'Hư hỏng / Bể vỡ / Móp méo',
    INVENTORY_ADJUST: 'Kiểm kê điều chỉnh kho',
    OTHER: 'Mục đích khác',
}

export interface PosmPrintVoucherLine {
    posmProductCode: string
    posmProductName: string
    category: string
    unit: string
    qty: number
    unitCost: number
    totalCost: number
}

export interface PosmPrintVoucherData {
    companyName: string
    companyTaxId: string | null
    companyAddress: string | null
    docNo: string
    performedAt: Date | string
    reason: string
    recipient: string | null
    requestedBy: string | null
    notes: string | null
    lines: PosmPrintVoucherLine[]
}

export interface PosmPrintHtmlOptions {
    showToolbar?: boolean
    autoPrint?: boolean
}

export function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function formatVoucherDateVN(date: Date | string): string {
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(date))
}

export function buildPosmVoucherPrintHtml(
    data: PosmPrintVoucherData,
    options: PosmPrintHtmlOptions = {}
): string {
    const { showToolbar = false, autoPrint = false } = options
    const { companyName, companyTaxId, companyAddress, docNo, performedAt, reason, recipient, requestedBy, notes, lines } = data

    const totalQty = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
    const totalCost = lines.reduce((sum, line) => sum + Number(line.totalCost || 0), 0)
    const reasonLabel = POSM_PRINT_REASON_LABELS[reason] || reason
    const totalUnitLabel = lines.length === 1 ? lines[0].unit : `${lines.length} loại vật phẩm`
    const dateText = formatVoucherDateVN(performedAt)

    const rowsHtml = lines.map((line, index) => {
        const categoryLabel = POSM_PRINT_CATEGORY_LABELS[line.category] || line.category
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

    const toolbarHtml = showToolbar ? `
    <div class="toolbar no-print">
      <div class="toolbar-info">
        <strong>Phiếu Xuất Kho POSM: ${escapeHtml(docNo)}</strong>
        <span>${escapeHtml(companyName)}</span>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn-close" onclick="window.close()">Đóng</button>
        <button type="button" class="btn-print" onclick="window.print()">In Phiếu Xuất (Print)</button>
      </div>
    </div>` : ''

    const autoPrintScript = autoPrint ? `
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    });
  </script>` : ''

    return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Phiếu Xuất Kho POSM - ${escapeHtml(docNo)}</title>
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
    background: ${showToolbar ? '#f1f5f9' : '#ffffff'};
    color: #0f172a;
    font-family: 'Times New Roman', Times, serif;
    font-size: 12px;
    line-height: 1.45;
  }
  .toolbar {
    max-width: 210mm;
    margin: 16px auto 12px auto;
    padding: 10px 16px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .toolbar-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .toolbar-info strong {
    font-size: 13px;
    color: #0f172a;
  }
  .toolbar-info span {
    font-size: 11px;
    color: #475569;
  }
  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn-close {
    padding: 7px 14px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-print {
    padding: 7px 16px;
    border-radius: 6px;
    border: none;
    background: #0e7490;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .sheet {
    ${showToolbar
        ? 'max-width: 210mm; min-height: 297mm; margin: 0 auto 24px auto; padding: 15mm 12mm; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);'
        : 'width: 100%; background: #ffffff;'}
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
  @media print {
    html, body {
      background: #ffffff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .no-print {
      display: none !important;
    }
    .sheet {
      max-width: none !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      box-shadow: none !important;
    }
  }
</style>
</head>
<body>
  ${toolbarHtml}
  <div class="sheet">
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
          <p class="doc-no">Số: <span>${escapeHtml(docNo)}</span></p>
          <p style="color: #475569;">Ngày: ${escapeHtml(dateText)}</p>
        </div>
      </div>

      <div class="title-block">
        <h1>PHIẾU XUẤT KHO VẬT PHẨM POSM</h1>
        <p>(Kiêm Biên Bản Bàn Giao Vật Phẩm Tiếp Thị &amp; Quà Tặng)</p>
      </div>

      <div class="meta-grid">
        <div><strong>Người nhận / Đơn vị: </strong><span>${escapeHtml(recipient || '....................................................................')}</span></div>
        <div><strong>Nhân viên đề xuất: </strong><span>${escapeHtml(requestedBy || '....................................................................')}</span></div>
        <div><strong>Mục đích xuất: </strong><span>${escapeHtml(reasonLabel)}</span></div>
        <div><strong>Đơn vị xuất: </strong><span>${escapeHtml(companyName)} (Kho POSM)</span></div>
        <div class="meta-full"><strong>Ghi chú / Đơn hàng liên quan: </strong><span>${escapeHtml(notes || 'Cấp phát sử dụng theo quy định quản lý tiếp thị.')}</span></div>
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
          <p class="sig-name">${escapeHtml(requestedBy || 'Người lập')}</p>
        </div>
        <div>
          <p class="font-bold">Người Nhận Hàng</p>
          <p class="sig-hint">(Ký, họ tên)</p>
          <div class="sig-space"></div>
          <p class="sig-name">${escapeHtml(recipient || 'Người nhận')}</p>
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
  </div>${autoPrintScript}
</body>
</html>`
}
