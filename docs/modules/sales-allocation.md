# SLS — Sales & Allocation (Bán Hàng & Phân Bổ Hạn Mức)

Phân hệ Sales quản lý toàn bộ chu trình bán hàng từ Báo giá → Đặt hàng → Xuất kho → Giao hàng → Thu tiền. Nổi bật nhất là **Allocation Engine** — cơ chế kiểm soát phân bổ quota cho rượu vang khan hiếm, tính năng mà không phần mềm ERP thông thường nào có sẵn.

---

## 1. Chu Trình Bán Hàng (Sales Order Lifecycle)

```
QUOTATION (Báo giá)
     ↓  [KH đồng ý]
SALES ORDER — DRAFT
     ↓  [Tạo xong, gửi duyệt]
SALES ORDER — PENDING APPROVAL  ←──── Approval Workflow (nếu vượt ngưỡng)
     ↓  [Duyệt xong]
SALES ORDER — CONFIRMED
     ↓  [Kho nhặt hàng]
DELIVERY ORDER (DO)
     ↓  [Shipper giao, E-POD]
DELIVERED
     ↓  [Xuất hóa đơn điện tử]
INVOICED
     ↓  [KH thanh toán]
PAID / CLOSED
```

---

## 2. Báo Giá (Quotation) — Professional System

### Tạo & Quản lý
- Tạo Quotation gửi cho KH trước khi chốt đơn
- Chọn KH → Hệ thống tự load bảng giá đúng kênh (HORECA / Đại lý / VIP)
- Thêm dòng sản phẩm → Check tồn kho real-time + Check Allocation Quota
- Quotation có Ngày hết hạn (Expiry Date) — sau ngày này giá không còn hiệu lực
- Chuyển Quotation → SO chỉ 1 click
- Duplicate quotation — clone + 30 ngày hạn mới
- Auto-expire: DRAFT/SENT quá validUntil → EXPIRED

### Gửi Báo Giá (Multi-channel Delivery)
- **📧 Email**: Gửi HTML email chuyên nghiệp qua Resend + Telegram notification
- **🔗 Copy Link Zalo/WhatsApp**: Copy public URL → paste vào tin nhắn
- **🖨️ In/Tải PDF**: Mở tab dạng web → browser Print/Save PDF

### PDF Export (3 Styles)
- **Professional** (nền trắng) — tối ưu cho in giấy
- **Elegant** (dark theme) — gửi digital, KH cao cấp
- Nội dung: Logo + header công ty, MST, ảnh sản phẩm, thông tin wine (vintage, appellation, awards, tasting notes), VAT tách riêng 10%, chiết khấu, điều khoản

### Public Quotation Viewer
- **URL**: `/verify/quotation/[publicToken]` — KH xem trực tuyến không cần login
- **View Tracking**: viewCount, firstViewedAt, lastViewedAt → Sale thấy badge 👁️ trên list
- **Accept/Reject online**: KH bấm chấp nhận/từ chối + nhập lý do

### Schema Additions
- `publicToken` (UUID) — unique public URL
- `customerEmail`, `customerPhone` — contact info for delivery
- `companyName`, `contactPerson` — display on PDF
- `sentAt`, `sentMethod` — tracking khi gửi (EMAIL/LINK/PRINT)
- `viewCount`, `firstViewedAt`, `lastViewedAt` — view tracking
- `rejectedReason` — lý do KH từ chối
- `deliveryTerms`, `vatIncluded`, `pdfStyle` — PDF customization

---

## 3. Sales Order (Đơn Hàng Bán)

### A. Tạo Sales Order
| Trường | Mô tả |
|---|---|
| `so_number` | Số đơn tự sinh |
| `customer_id` | Khách hàng (Bắt buộc — liên kết CRM) |
| `linked_contract` | Hợp đồng khung (nếu có — từ CNT module) |
| `order_date` | Ngày đặt hàng |
| `requested_delivery_date` | Ngày KH yêu cầu giao |
| `shipping_address` | Địa chỉ giao (chọn từ danh sách multi-address của KH) |
| `payment_term` | Kế thừa từ KH, có thể override |
| `currency` | VND (mặc định) |
| `sales_rep` | Nhân viên Sales tạo đơn |
| `channel` | HORECA / WHOLESALE / VIP_RETAIL |
| `notes` | Ghi chú đặc biệt (Giao vào buổi sáng, cần xe lạnh...) |

### B. Dòng Sản Phẩm (SO Lines)
| Trường | Mô tả |
|---|---|
| `sku` | Sản phẩm |
| `qty_ordered` | Số lượng (Tính theo thùng/OWC hoặc chai) |
| `unit_price` | Đơn giá (Từ bảng giá phù hợp) |
| `line_discount_%` | Chiết khấu dòng (%) |
| `allocation_check` | ✅ Đủ quota / ⚠️ Vượt quota / ❌ Hết quota |
| `available_stock` | Tồn kho khả dụng real-time |

### C. Kiểm Soát Tự Động Khi Tạo SO
1. **Credit Check:** `Công nợ hiện tại + Giá trị SO này > Credit Limit` → Cảnh báo / Block
2. **Stock Check:** Tồn kho Available < Số đặt → Cảnh báo lấy thiếu
3. **Allocation Check:** SKU có Allocation Campaign → Kiểm tra Quota (xem mục 5)
4. **Approval Trigger:** SO > Ngưỡng giá trị hoặc Chiết khấu > X% → Tự động send Approval Workflow

### D. Chiết Khấu 2 Cấp
- **Chiết khấu dòng (Line Discount):** Áp dụng cho từng SKU riêng lẻ
- **Chiết khấu tổng đơn (Order Discount):** Giảm thêm % trên tổng giá trị SO
- **Tổng Chiết Khấu vượt ngưỡng cài sẵn** → Bắt buộc qua Approval Workflow

---

## 4. Return & Credit Note (Hàng Trả Về)

Khi KH trả hàng hoặc phát sinh điều chỉnh:
1. Tạo **Return Order** liên kết SO gốc
2. WMS nhận hàng trả về → Nhập vào Quarantine Zone kiểm tra
3. Nếu hàng còn tốt → Nhập lại kho thường (Stock restored)
4. Kế toán tạo **Credit Note** → Trừ nợ AR của KH

---

## 5. Allocation Engine — Cốt Lõi Ngành Rượu Cao Cấp

### A. Tại Sao Cần Allocation?
Grand Cru, Premier Cru, En Primeur... là các loại rượu được sản xuất với số lượng rất giới hạn. Nhà nhập khẩu được NCC phân bổ số lượng nhất định. Doanh nghiệp phải kiểm soát chặt ai được mua bao nhiêu để:
- Tránh 1 đại lý ôm hết hàng
- Ưu tiên cho KH VIP, KH trung thành
- Giữ hàng cho các kênh chiến lược (HORECA flagship)

### B. Tạo Allocation Campaign
Admin / Sales Manager tạo Campaign:
| Trường | Mô tả |
|---|---|
| `campaign_name` | Tên chiến dịch (Rothschild Lafite 2019 Launch) |
| `sku` | SKU cụ thể |
| `total_qty` | Tổng số lượng được phân bổ trong Campaign |
| `start_date / end_date` | Thời gian hiệu lực của Campaign |
| `allocation_unit` | Thùng (Case) hay Chai (Bottle) |

### C. Gán Quota (Allocation Quota)
Từ Campaign, phân bổ quota chi tiết:
- **Per Sales Rep:** Sales Rep A được bán tối đa 10 thùng
- **Per Customer:** KH Park Hyatt được mua tối đa 5 thùng
- **Per Channel:** Kênh HORECA tổng 50 thùng, kênh Đại lý tổng 30 thùng

### D. Matrix View (Giao Diện Ma Trận)
Bảng tổng quan dạng Spreadsheet:

| SKU | Sales Rep A | Sales Rep B | Sales Rep C | TOTAL |
|---|---|---|---|---|
| Lafite 2019 | Allocated: 10 / Sold: 6 / **Remaining: 4** | 8 / 8 / **0** | 15 / 3 / **12** | 33/17/16 |

Màu sắc: Xanh (Còn nhiều) → Vàng (Sắp hết) → Đỏ (Hết quota)

### E. Kiểm Soát Khi Tạo SO
- Khi SO chọn SKU thuộc Allocation Campaign → Tự động trừ vào Quota của Sales Rep đó
- Vượt Quota → **Cảnh báo + Block** hoặc **Cho qua nhưng bắt buộc CEO Approve**
- Sau khi SO Cancelled → Quota được hoàn lại

### F. Lịch Sử Allocation
- Xem toàn bộ các Campaign trước (Phân tích: KH nào hay mua Vintage nổi tiếng)
- Export Excel để báo cáo NCC về tình hình phân phối

---

## 6. Price Management (Quản Lý Giá Bán)

- **Tự động chọn bảng giá** dựa trên kênh của khách hàng
- **Override giá thủ công** có Approval nếu giảm quá ngưỡng
- **Giá theo thời gian:** Bảng giá có effective date — Từ ngày X áp dụng bảng giá mới
- **Price History:** Lịch sử giá bán của từng SKU qua các thời kỳ

---

## 7. Database Design

```
SalesQuotation { quo_no, customer_id, expiry, status, total_amount, public_token, view_count, sent_at, sent_method, customer_email, vat_included, pdf_style, delivery_terms }
SalesQuotationLine { quotation_id, product_id, qty, unit_price, discount }
SalesOrder { so_no, customer_id, contract_id, status, payment_term, channel, sales_rep_id }
SalesOrderLine { so_id, sku, qty, unit_price, discount, allocation_campaign_id }
AllocationCampaign { camp_no, sku, total_qty, start_date, end_date, unit }
AllocationQuota { campaign_id, type[rep/customer/channel], target_id, qty_allocated, qty_sold }
AllocationLog { quota_id, so_id, qty_used, action[USE/RELEASE], timestamp }
ReturnOrder { return_no, original_so_id, status, reason }
ReturnOrderLine { return_id, sku, qty_returned, qty_restocked, condition }
CreditNote { cn_no, return_id, customer_id, amount, status }
```

---

## 8. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 08/03/2026 21:40 — **Hoàn thiện 99%**

### ✅ Đã triển khai

| Tính năng | File code | Ghi chú |
|---|---|---|
| Sales Order CRUD | `sales/actions.ts`, `SalesClient.tsx` | Tạo, xem, xác nhận, hủy SO |
| CreateSODrawer | `CreateSODrawer.tsx` | Full drawer: chọn KH, kênh, sản phẩm, check tồn kho |
| **EditSODrawer** | `EditSODrawer.tsx` | Sửa DRAFT SO: KH, kênh, sản phẩm, discount |
| **Sales Rep Auth** | `page.tsx` → `SalesClient` | Sales rep từ auth context (không còn hardcode) |
| **Discount Approval** | `actions.ts:confirmSalesOrder` | CK > 15% → PENDING_APPROVAL + audit log |
| **FIFO Pick Suggestion** | `actions.ts:suggestPickListForSO` | Gợi ý pick list FIFO cho SO confirmed |
| Credit Limit Check | `createSalesOrder` | Check công nợ + SO mới vs credit limit |
| Allocation Engine | `actions.ts` | Campaign + quota per rep/customer/channel |
| Price List auto-load | `getProductPricesForChannel` | Load giá theo kênh KH |
| **Quotation CRUD** | `quotations/actions.ts` | ✅ Tạo, sửa DRAFT, xóa, status transitions |
| **Quotation UI** | `QuotationClient.tsx` | ✅ List + 5 stat cards + search/filter + detail drawer |
| **Send Drawer** | `QuotationClient.tsx` | ✅ 3 kênh: Email, Copy Link Zalo, In PDF |
| **PDF Export** | `api/export/quotation-pdf/route.ts` | ✅ 2 styles (Professional/Elegant), ảnh SP, wine info, VAT |
| **Public Viewer** | `verify/quotation/[token]/` | ✅ KH xem online, accept/reject, view tracking |
| **View Tracking** | `actions.ts`, `QuotationClient.tsx` | ✅ Badge 👁️, viewCount, firstViewedAt |
| **Email Notification** | `lib/notifications.ts` | ✅ Branded HTML email via Resend + Telegram |
| Convert to SO | `actions.ts:convertToSO` | ✅ 1-click tạo SO từ QT, copy lines |
| Duplicate Quotation | `actions.ts:duplicateQuotation` | ✅ Clone + 30 ngày hạn mới |
| Auto-expire | `actions.ts:autoExpireQuotations` | ✅ DRAFT/SENT quá hạn → EXPIRED |
| Export Excel QT | `actions.ts:exportQuotationExcel` | ✅ File báo giá Excel |
| **CEO Approve SO** | `approveSalesOrder` | ✅ Nút "✓ Duyệt" cho PENDING_APPROVAL |
| **CEO Reject SO** | `rejectSalesOrder` | ✅ Nút "✗ Từ Chối" cho PENDING_APPROVAL |

#### 🆕 Session 8 — Refactor & Enhancement (08/03/2026)

**Segregation of Duties (SoD) — Event-Driven Status:**

| Tính năng | File code | Ghi chú |
|---|---|---|
| **Xoá nút advance status thủ công** | `SalesClient.tsx` | Sale admin KHÔNG tự nhấn "→ Đã Giao", "→ Thu Tiền" |
| **Event-driven SO status: DO → SO** | `warehouse/actions-do.ts` | `confirmDeliveryOrder` → auto set `PARTIALLY_DELIVERED` / `DELIVERED` |
| **Event-driven SO status: Payment → SO** | `finance/actions.ts` | `recordARPayment` → auto set `PAID` khi invoice fully paid |
| **Audit logging cho status changes** | `sales/actions.ts` | Mọi thay đổi status đều ghi AuditLog |

**Enhanced SO UI:**

| Tính năng | File code | Ghi chú |
|---|---|---|
| **Quick Filter Tabs** | `SalesClient.tsx` | Tabs ngang: Tất cả / Nháp / Chờ Duyệt / Đã XN / Đã Giao... với badge count |
| **Sortable Columns** | `SalesClient.tsx` + `actions.ts` | Click header Số SO / Doanh Số / Ngày Tạo để sort ↑↓ |
| **Date Range Filter** | `SalesClient.tsx` + `actions.ts` | DatePicker "Từ ngày → Đến ngày" |
| **SO Detail Drawer 4 Tabs** | `SalesClient.tsx` | Tổng Quan / Sản Phẩm / Giao Hàng & Tài Chính / Lịch Sử |
| **Status Progress Stepper** | `SalesClient.tsx` | Thanh tiến trình Draft → Confirm → Deliver → Invoice → Paid |
| **Audit Timeline** | `actions.ts:getSOTimeline` | Tab Lịch Sử — query AuditLog, hiển thị timeline |
| **Clone / Duplicate SO** | `actions.ts:cloneSalesOrder` | Nút Clone trong drawer → DRAFT mới với cùng lines |
| **Export CSV** | `actions.ts:exportSalesOrdersCSV` | Nút "Excel" → download CSV với filter hiện tại |
| **Status Counts API** | `actions.ts:getSOStatusCounts` | `groupBy status` cho quick filter tabs |

**Role-Based Margin Visibility:**

| Tính năng | File code | Ghi chú |
|---|---|---|
| **Phân quyền xem Margin** | `SalesClient.tsx`, `page.tsx` | Chỉ `CEO`, `KE_TOAN`, `SALES_MGR` xem Giá Vốn, Lãi Gộp, Biên % |
| **Sale Admin/Rep: ẩn margin** | `SalesClient.tsx` | Hiển thị "🔒 Chỉ Ban Giám Đốc" thay cho cột COGS/Margin |
| **Negative Margin Warning** | `SalesClient.tsx` | Chỉ CEO/Finance thấy cảnh báo biên âm |

### ❌ Chưa triển khai

| Tính năng | Ưu tiên |
|---|---|
| Return Order + Credit Note | 🟡 P2 |
| Dynamic SO threshold từ ApprovalConfig DB | 🟢 P3 |
| Shipment → PO status hook (IN_TRANSIT) | 🟡 P2 |
| RBAC middleware cho server actions | 🟡 P2 |

*Last updated: 2026-03-08 21:40 | Wine ERP v6.1*

