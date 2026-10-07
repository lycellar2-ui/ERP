# Kế Hoạch Thiết Kế & Triển Khai: Phân Hệ Quản Lý Tài Chính & Dòng Tiền Đơn Mua Hàng (PO Financial & Cash Flow Forecast)

> **Mã công việc:** `PRC-FIN-CASHFLOW-01`  
> **Phân hệ:** Quản lý Mua hàng & Nhập khẩu rượu (`/dashboard/procurement`)  
> **Người đề xuất:** Giám đốc Điều hành / Trưởng phòng Kế toán - Mua hàng  
> **Trạng thái:** `PLANNING` — Chờ duyệt kiến trúc và giải pháp biên (Edge Cases)

---

## 1. Mục Tiêu & Bài Toán Nghiệp Vụ

Trong ngành phân phối và nhập khẩu rượu vang cao cấp (Wine Importer & Distributor):
* **Chi phí thực tế của một đơn mua hàng (Landed Cost)** không chỉ có tiền hàng trả cho nhà cung cấp (Château/Nhà làm rượu tại Pháp, Ý, Úc, Chile...), mà phần **chi phí thuế (3 tầng) và logistics nội địa thường chiếm tới 40% - 60% tổng vốn bỏ ra**.
* **Đặc thù dòng tiền rượu nhập khẩu**:
  1. **Tiền hàng ngoại tệ**: Thường đặt cọc 20% - 30% khi chốt PO, thanh toán nốt 70% - 80% khi có Vận đơn (Bill of Lading) hoặc trước khi xuất xưởng.
  2. **Tiền thuế 3 tầng (VND)**:
     - **Thuế Nhập Khẩu (Import Duty)**: 20% - 50% (hoặc giảm ưu đãi theo Hiệp định EVFTA nếu có C/O Form EUR.1).
     - **Thuế Tiêu Thụ Đặc Biệt (SCT)**: 65% tính trên `(CIF + Thuế NK)`.
     - **Thuế Giá Trị Gia Tăng (VAT)**: 10% tính trên `(CIF + Thuế NK + Thuế TTĐB)`.
     *=> Doanh nghiệp bắt buộc phải có sẵn nguồn tiền mặt lớn nộp vào Kho bạc Nhà nước trước khi được thông quan giải phóng hàng.*
  3. **Chi phí Logistics & Local Charges**: Cước biển (Ocean freight), Bảo hiểm hàng hải (Insurance), Phí xếp dỡ tại cảng (THC, CIC, D/O), Chi phí kéo xe container lạnh về kho ngoại quan/kho công ty, Phí kiểm tra chuyên ngành ATTP, Chi phí dán tem rượu nhập khẩu.

---

## 2. Kiến Trúc Dữ Liệu (Database Schema)

Tạo model mới `POFinancialSchedule` để quản lý độc lập các đợt giải ngân dòng tiền gắn với `PurchaseOrder`:

```prisma
// Lịch giải ngân & dự trù dòng tiền cho PO
model POFinancialSchedule {
  id                  String         @id @default(cuid())
  poId                String
  po                  PurchaseOrder  @relation(fields: [poId], references: [id], onDelete: Cascade)
  
  // Phân loại mốc nghiệp vụ
  milestone           String         // DEPOSIT, FINAL_PAYMENT, CUSTOMS_TAX, FREIGHT_SHIPPING, LOCAL_PORT_FEE, INSPECTION_STAMP, OTHER
  label               String         // Tên khoản mục hiển thị: "Đặt cọc nhà cung cấp (30%)", "Nộp thuế hải quan 3 tầng"...
  category            String         // GOODS (Tiền hàng), TAX (Thuế), LOGISTICS (Vận tải), LOCAL_FEE (Chi phí cảng/kho), OTHER
  
  // Tiền tệ & Giá trị
  currency            String         @default("VND") // USD, EUR, AUD, VND
  estimatedAmount     Decimal        @db.Decimal(15, 2) // Số tiền dự kiến (nguyên tệ)
  exchangeRate        Decimal        @default(1) @db.Decimal(12, 4) // Tỷ giá quy đổi ra VND
  estimatedAmountVND  Decimal        @db.Decimal(15, 2) // Dự trù thành tiền VND
  actualAmountVND     Decimal?       @db.Decimal(15, 2) // Chi phí thực tế đã chi (nếu đã phát sinh)
  
  // Kế hoạch ngày chi & Trạng thái
  estimatedDate       DateTime?      // Ngày dự kiến cần tiền
  actualDate          DateTime?      // Ngày kế toán thực chi
  status              String         @default("PLANNED") // PLANNED (Dự trù), APPROVED (Đã duyệt chi), PAID (Đã giải ngân), CANCELLED
  
  paymentMethod       String?        // TT_TRANSFER, LC, CASH, TAX_TREASURY_TRANSFER
  paidByVoucherNo     String?        // Số ủy nhiệm chi / Chứng từ thanh toán
  notes               String?        // Ghi chú đợt chi
  
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  @@index([poId])
  @@map("po_financial_schedules")
}
```

---

## 3. Công Thức Tự Động Tính Toán Dự Trù (Auto-Estimation Engine)

Khi tạo PO hoặc click **"Tự động tính Dự trù Dòng tiền"**, hệ thống thực hiện:
1. **Tiền hàng (Goods Cost)**:
   - Tổng FOB/EXW = `PO.totalAmount` (USD/EUR).
   - Tự động tách:
     - Mốc 1: Đặt cọc 30% (Estimated Date = Ngày tạo PO + 3 ngày).
     - Mốc 2: Tiền hàng còn lại 70% (Estimated Date = Ngày ETD dự kiến - 5 ngày).
2. **Chi phí Vận chuyển & Bảo hiểm (Freight & Insurance)**:
   - Ước tính dựa theo loại container (ví dụ 1 Container 20ft lạnh RF ≈ 1,500 - 2,500 USD cước biển + 150 USD bảo hiểm).
3. **Dự trù Thuế Nhập Khẩu 3 tầng (Customs Duties)**:
   - `CIF_VND` = `(FOB + Freight + Insurance) * ExchangeRate`
   - `Thuế NK` = `CIF_VND * 0.20` (hoặc thuế suất ưu đãi EU EVFTA theo biểu thuế hiện hành)
   - `Thuế TTĐB` = `(CIF_VND + Thuế NK) * 0.65`
   - `Thuế VAT` = `(CIF_VND + Thuế NK + Thuế TTĐB) * 0.10`
   - `Tổng thuế cần nộp trước thông quan` = `Thuế NK + Thuế TTĐB + Thuế VAT`
   - Ngày dự kiến nộp thuế = `ETA (Tàu cập cảng) + 1 ngày`.
4. **Chi phí Nội địa & Thủ tục (Local charges & Handling)**:
   - THC, D/O, vệ sinh cont, cước kéo xe container lạnh cảng về kho: Ước tính 15,000,000 - 25,000,000 VND / cont.
   - Chi phí tem rượu + kiểm tra ATTP: Ước tính dựa trên tổng số chai (`totalQty * đơn giá tem`).

---

## 4. Thiết Kế Giao Diện (UI/UX Specification)

Vị trí: **Tab "Tài chính & Dòng tiền"** trong Drawer Chi tiết PO (`ShipmentDetailDrawer.tsx` / `PODetailDrawer`).

### A. Bộ 4 Thẻ Chỉ Số Tài Chính (Financial Metric Cards)
1. **Tổng Dự Toán Đơn Hàng (Total Estimated Landed Cost)**: Tổng VND & Quy đổi ngoại tệ.
2. **Tiền Hàng (FOB/EXW)**: Giá trị & Tỷ trọng % so với tổng chi phí.
3. **Tổng Thuế Nhập Khẩu (3 tầng)**: Thuế NK + Thuế TTĐB (65%) + VAT (10%).
4. **Tiến Độ Giải Ngân (Cash Flow Progress)**: Đã thanh toán / Dự kiến còn phải chi.

### B. Biểu Đồ Thanh Tỷ Trọng Chi Phí (Cost Composition Bar)
* Visual bar chia màu: `Tiền hàng (Xanh dương)` | `Thuế Nhà nước (Cam/Hổ phách)` | `Cước Logistics (Xanh ngọc)` | `Chi phí nội địa (Xám/Tím)`.

### C. Bảng Lịch Dòng Tiền Theo Mốc Vận Hành (Milestone Cash Flow Table)
* Hiển thị theo 4 - 5 hàng mốc chuẩn:
  1. 🏷️ **Đặt cọc nhà cung cấp (Deposit)**
  2. 🚢 **Thanh toán tiền hàng còn lại (Final Goods Payment)**
  3. 🏛️ **Nộp thuế Hải quan & Kho bạc (Customs Tax)**
  4. 📦 **Cước Forwarder & Phí THC/DO (Logistics & Port charges)**
  5. 🚚 **Kéo hàng về kho & Dán tem rượu (Trucking & Stamps)**
* Cột: Mốc | Hạng mục | Dự kiến chi (Nguyên tệ & VND) | Thực chi (VND) | Ngày dự kiến | Ngày thực tế | Trạng thái (Pill: Đã chi / Chưa chi / Quá hạn) | Thao tác.
* Nút **"+ Thêm khoản chi tùy chỉnh"** để người dùng tự do bổ sung phụ phí phát sinh (lưu cont demurrage/detention, phí giám định, phí bảo hiểm...).

---

## 5. Kế Hoạch Triển Khai (Task Breakdown)

- [ ] **Bước 1 (Schema & DB)**: Bổ sung model `POFinancialSchedule` vào `prisma/schema.prisma` và migrate database.
- [ ] **Bước 2 (Server Actions)**: Viết các hàm nghiệp vụ `getPOFinancialPlan`, `generateDefaultPOFinancialPlan`, `upsertPOFinancialItem`, `deletePOFinancialItem` trong `src/app/dashboard/procurement/actions.ts`.
- [ ] **Bước 3 (UI Component)**: Tạo component `POFinancialTab.tsx` với đầy đủ KPI Cards, Timeline mốc giải ngân, bộ tính thuế 3 tầng và form thêm/sửa khoản chi.
- [ ] **Bước 4 (Tích hợp Drawer)**: Gắn Tab "Tài chính & Dòng tiền" vào Drawer xem PO của `ProcurementClient.tsx`.
- [ ] **Bước 5 (Test & Audit)**: Chạy test kiểm thử logic tính toán thuế và xác nhận không lỗi TypeScript/Lint.
- [ ] **Bước 6 (Cập nhật Docs)**: Đồng bộ tài liệu module mua hàng theo đúng `DOCS SYNC PROTOCOL`.
