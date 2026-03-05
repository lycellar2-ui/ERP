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

## 2. Báo Giá (Quotation)

- Tạo Quotation gửi cho KH trước khi chốt đơn
- Chọn KH → Hệ thống tự load bảng giá đúng kênh (HORECA / Đại lý / VIP)
- Thêm dòng sản phẩm → Check tồn kho real-time + Check Allocation Quota
- Có thể Export PDF gửi mail cho KH
- Quotation có Ngày hết hạn (Expiry Date) — sau ngày này giá không còn hiệu lực
- Chuyển Quotation → SO chỉ 1 click

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
SalesQuotation { quo_no, customer_id, expiry, status, total_amount }
SalesOrder { so_no, customer_id, contract_id, status, payment_term, channel, sales_rep_id }
SalesOrderLine { so_id, sku, qty, unit_price, discount, allocation_campaign_id }
AllocationCampaign { camp_no, sku, total_qty, start_date, end_date, unit }
AllocationQuota { campaign_id, type[rep/customer/channel], target_id, qty_allocated, qty_sold }
AllocationLog { quota_id, so_id, qty_used, action[USE/RELEASE], timestamp }
ReturnOrder { return_no, original_so_id, status, reason }
ReturnOrderLine { return_id, sku, qty_returned, qty_restocked, condition }
CreditNote { cn_no, return_id, customer_id, amount, status }
```
