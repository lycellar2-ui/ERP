# POS — Point of Sale (Bán Lẻ Showroom)
> Module bán lẻ tại showroom/cửa hàng. Hỗ trợ cả bán hàng nhanh (walk-in) và đặt hàng trước (pre-order).

---

## 1. Bối Cảnh Nghiệp Vụ

**Showroom** là kênh bán lẻ trực tiếp (B2C) — khác với kênh B2B (HORECA/Wholesale). Đặc điểm:
- Khách mua lẻ 1–12 chai
- Thanh toán ngay (Cash / Card / Chuyển khoản QR)
- Cần xử lý nhanh, giao diện đơn giản cho nhân viên bán hàng
- Tích hợp với kho (trừ tồn ngay khi bán)
- Xuất hóa đơn VAT địa chỉ khách (tùy chọn)

---

## 2. Giao Diện POS

### 2.1 Layout Màn Hình POS
```
┌─────────────────────────────────────────────────────┐
│ [🔍 Tìm kiếm / Scan barcode]          [Nhân viên: Lan] │
├────────────────────────────┬────────────────────────┤
│  DANH MỤC SP NHANH         │   GIỎ HÀNG             │
│  ┌──────┐ ┌──────┐         │  Château Pétrus 2018   │
│  │ 🍷   │ │ 🍾   │         │  × 2 chai   = 8,400,000│
│  │Đỏ   │ │Trắng │         │                        │
│  └──────┘ └──────┘         │  Opus One 2020         │
│                            │  × 1 chai   = 5,200,000│
│  ┌──────┐ ┌──────┐         │─────────────────────── │
│  │ 🥂   │ │ 🍯   │         │  Tổng:     13,600,000  │
│  │Sâm   │ │Ngọt  │         │  Giảm giá: -680,000    │
│  └──────┘ └──────┘         │  Thanh toán: 12,920,000│
│                            │─────────────────────── │
│  [TÌMKIẾM NÂNG CAO]        │  [TIỀN MẶT][CHUYỂN K.] │
│                            │  [QR VNPAY][THẺ QUẸT] │
└────────────────────────────┴────────────────────────┘
```

### 2.2 Tìm Sản Phẩm
- Scan barcode EAN → Auto add vào giỏ
- Gõ tên / SKU → Dropdown gợi ý
- Browse theo danh mục (Đỏ / Trắng / Sâm panh / Dessert / Fortified)
- Hiện giá bán lẻ, tồn kho còn lại

---

## 3. Khách Hàng POS

### 3.1 Loại Khách
| Loại | Xử lý |
|---|---|
| **Walk-in ẩn danh** | Không cần thông tin khách, bán nhanh |
| **Khách có tài khoản** | Tìm theo SĐT/Email → Load lịch sử, điểm tích lũy |
| **Khách VIP** | Tự động áp dụng giá VIP price list |
| **Khách B2B mua tại showroom** | Link với Customer record, xuất hóa đơn VAT |

### 3.2 Loyalty Program (Tích Điểm Đơn Giản)
- 1,000 VND chi tiêu = 1 điểm
- 1,000 điểm = 50,000 VND voucher
- Hiện điểm trên màn hình POS khi chọn khách

---

## 4. Thanh Toán

| Phương thức | Xử lý |
|---|---|
| **Tiền mặt** | Nhập số tiền khách đưa → Auto tính tiền thối |
| **Chuyển khoản** | Hiển thị QR VietQR → Xác nhận thủ công hoặc auto (Webhook banking) |
| **QR VNPAY/MoMo** | Tích hợp cổng thanh toán |
| **Thẻ quẹt** | (Optional) Máy POS EDC riêng |
| **Split payment** | Thanh toán kết hợp nhiều phương thức |

---

## 5. Hóa Đơn & In Ấn

### 5.1 Phiếu tính tiền (Receipt)
- In nhiệt A58mm (máy in bill POS)
- Hiện: Danh sách hàng, đơn giá, thành tiền, tổng, phương thức TT, số hóa đơn

### 5.2 Hóa đơn VAT
- Khách yêu cầu VAT → Nhập MST/Địa chỉ → Xuất hóa đơn điện tử (kết hợp module FIN)
- E-invoice theo Thông tư 78/2021/TT-BTC

---

## 6. Quản Lý Ca Bán Hàng (Shift Management)

```
Mở ca → Nhập tiền đầu ca → Bán hàng suốt ca
→ Đóng Ca → In Báo Cáo Ca:
   - Tổng doanh thu theo phương thức TT
   - Số giao dịch
   - Danh sách sản phẩm đã bán
   - Tiền mặt thực tế đếm được
   - Chênh lệch (nếu có)
```

---

## 7. Tích Hợp Hệ Thống

| Module | Liên kết |
|---|---|
| **WMS** | Trừ tồn kho ngay khi xác nhận thanh toán, lấy từ đúng Lot (FIFO) |
| **FIN** | Ghi nhận doanh thu, tạo Journal Entry (Tiền mặt Nợ / Doanh thu Có) |
| **QRC** | Scan QR chai để add vào giỏ POS |
| **CRM** | Tìm khách hàng, cập nhật lịch sử mua hàng |
| **SLS** | POS order tạo SO (type = POS_RETAIL) trong hệ thống |

---

## 8. So Sánh POS vs Sales Order (B2B)

| | POS (B2C Retail) | Sales Order (B2B) |
|---|---|---|
| Khách hàng | Walk-in / VIP cá nhân | Doanh nghiệp HORECA/ Distributor |
| Thanh toán | Ngay lập tức | Công nợ NET15/NET30 |
| Delivery | Tại quầy hoặc ship nhanh | Scheduled delivery (TRS) |
| Discount | % theo price list VIP | Discount theo hợp đồng |
| Hóa đơn | VAT tùy chọn | Bắt buộc VAT |
| Lot tracing | FIFO tự động | FIFO tự động |

---

## 9. Database Design

```
PosSession {
  id, cashier_id, opened_at, closed_at,
  opening_cash, closing_cash, total_sales,
  status (OPEN | CLOSED)
}

PosOrder {
  id, session_id, customer_id?,
  subtotal, discount_amount, total,
  payment_method, payment_ref,
  receipt_no, status, created_at
}

PosOrderLine {
  id, order_id, product_id, lot_id,
  qty, unit_price, subtotal
}

PosPayment {
  id, order_id, method, amount,
  reference, confirmed_at
}
```

*Last updated: 2026-03-04 | Wine ERP v4.0*

---

## 10. Implementation Status (Trạng Thái Triển Khai)

> Cập nhật 07/03/2026 — **Hoàn thiện 100%**

### ✅ Đã triển khai

| Tính năng | File code | Ghi chú |
|---|---|---|
| POS Product Grid | `pos/actions.ts:getPOSProducts` | Grid sản phẩm, lọc theo category, search |
| POS Categories | `getPOSCategories` | Lọc theo loại rượu |
| Process POS Sale | `processPOSSale` | Cart → SO (POS type) → FIFO stock deduction |
| Barcode Lookup | `lookupByBarcode` | Scan SKU → load sản phẩm + giá |
| VAT Invoice | `generatePOSVATInvoice` | Xuất hóa đơn VAT cho khách yêu cầu |
| Shift Summary | `getPOSShiftSummary` | Tóm tắt ca theo ngày |
| **Loyalty Program** | `getLoyaltyInfo`, `earn`, `redeem` | Tích/đổi điểm, tier BRONZE→PLATINUM |
| **Shift Open/Close** | `openShift`, `closeShift` | ✨ **MỚI** — Mở/đóng ca, tiền đầu/cuối, cash variance |
| **End-of-Day Report** | `getPOSEndOfDayReport` | ✨ **MỚI** — Top 10 SP, hourly breakdown, day-over-day growth |

### Chi tiết Shift Management

```
openShift(cashierName, openingCash)
  → Audit log + shift started

closeShift(cashierName, closingCash, openingCash)
  → expectedCash = opening + totalRevenue
  → cashVariance = closingCash - expectedCash
  → Audit log + summary returned
```

### Chi tiết End-of-Day Report

- Total revenue, transaction count, average transaction
- Top 10 bestselling products (by revenue)
- Hourly breakdown 8:00 → 22:00
- Previous day comparison + growth %

*Last updated: 2026-03-07 | Wine ERP v5.0*
