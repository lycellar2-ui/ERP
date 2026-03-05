# 🧪 Thực thi và Kết quả Unit Test Nghiệp Vụ (Business Logic)
**Dự án:** Wine ERP - LYS Cellars  
**Cập nhật lần cuối:** 2026-03-05  
**Framework:** Vitest + Prisma Mocking (AAA Pattern)  
**Tình trạng:** ✅ **Hoàn thành (100% Xanh)** — Sẵn sàng cho Môi trường Production

---

## 🎯 1. Chiến Lược Kiểm Thử (Test Strategy)
Hệ thống Wine ERP quản lý luồng dữ liệu vật lý phức tạp (Hàng hóa, Tiền tệ, Thuế, Quota, Tem). Chiến lược kiểm thử tập trung vào **Core Business Logic** thay vì các file CRUD đơn thuần.

- **Mocking Database:** Sử dụng `vi.mock('@/lib/db')` để cô lập logic với DB thật, cho phép test chạy dưới 3 giây. Hỗ trợ đầy đủ Prisma `$transaction`.
- **Nguyên lý AAA (Arrange - Act - Assert):** Setup dữ liệu ảo chính xác → Gọi Server Actions nội bộ → Kiểm tra kết quả trả về và các câu lệnh Prisma được thực thi tương ứng.
- **Data Integrity:** Đảm bảo không xảy ra thất thoát quy trình (ví dụ: Xuất kho phải trừ đúng Lot, Bán POS Cash phải thu đủ tiền, Tạo hóa đơn phải sinh Journal Debit/Credit cân bằng).

---

## 📊 2. Báo Cáo Kết Quả (Test Results)

| Số Test Suite | Số Test Case | Failed | Tỷ Lệ Pass | Thời gian chạy |
| :--- | :--- | :--- | :--- | :--- |
| **22 Files** | **188 Tests** | **0** | **100%** ✅ | **~2.6 giây** ⚡ |

*(Chi tiết logs báo cáo nằm ở file `test_report.md` trong artifact history).*

---

## 🏗️ 3. Độ Phủ Theo Từng Module (Coverage Breakdown)

### 3.1 Kho Hàng & Giao Nhận (WMS & Delivery)
- **`warehouse.test.ts` (16 Tests):**
  - **Cốt lõi:** Nhập hàng (GR) từ PO, tự động tạo/cập nhật `StockLot`.
  - Xuất hàng (DO) từ SO, thuật toán `FIFO` tự trừ lùi Tồn Kho Khả Dụng (`qtyAvailable`).
  - Chuyển kho (Transfer): Xác thực chuyển qua Data source/destination hợp lệ.
  - Xóa Vị trí (Location): Nghiêm cấm xóa nếu còn hàng/lô hàng tồn.
- **`delivery.test.ts` (5 Tests):** Cập nhật tọa độ E-POD, ghi nhận trạng thái giao hàng `DELIVERED`, bắt lỗi thiếu dữ liệu tọa độ.
- **`qr-codes.test.ts` (2 Tests):** Khởi tạo mã QR sinh học độc lập cho từng Line/Lot nhập khẩu, chặn scan lặp lại báo cáo gian lận.
- **`stock-count.test.ts` (1 Test):** Chốt phiên kiểm đếm kho.

### 3.2 Bán Lẻ, Phân Phối & Đại Lý (Sales & Retail)
- **`sales.test.ts` (22 Tests):**
  - Validation Margin tối thiểu. 
  - Approval Engine (Đơn > 100M VND tự động route Pending).
  - Allocation Engine: Block tạo đơn nếu Quota phân bổ của Sale/Khách vượt mức chỉ tiêu khả dụng.
  - SO State Machine: Block nhảy trạng thái không hợp lệ.
- **`pos.test.ts` (5 Tests):**
  - Validation: Chặn tạo hóa đơn POS nếu chọn trả Tiền Mặt nhưng đưa thiếu tiền.
  - Transaction 5-in-1: Tạo SO → Cập nhật Lot Stock (Xuất kho) → Ghi nhận Thanh toán AR → Sinh Phiếu Giao hàng DO → Ghi xuất VAT. Tất cả gói gọn trong một Prisma Transaction.
  - Tra cứu Barcode / SKU gộp Real-time.
- **`agency.test.ts` (3 Tests):**
  - Agency portal: Ghi nhận yêu cầu xin nhập/ký gửi hàng. Review luồng duyệt và tự động tạo DO điều phối.
- **`allocation.test.ts` (3 Tests):** Khởi tạo chiến dịch Allocation (Cấp phát Quota giới hạn cho vang hiếm), test logic trừ lùi Quota.
- **`returns.test.ts` (5 Tests):** Đổi/Trả hàng bảo hành. Tự động đưa hàng vào khu vực Cách Ly (Quarantine).

### 3.3 Tài Chính, Thuế & Tuân Thủ (Finance, Tax & Legal)
- **`finance.test.ts` (14 Tests):**
  - AR/AP Invoice & Payments: Ghi nhận công nợ và tự động chuyển `PARTIALLY_PAID` / `PAID` dựa trên số tiền.
  - Cấm thanh toán lố so với số nợ (Over-payment guard).
  - Double Entry Journal: Ghi nhận cân bằng Debit - Credit.
- **`tax.test.ts` (3 Tests):**
  - Engine Tính thuế Nhập Khẩu: Lookup HS Code/Country → Xác định Tỷ lệ % → Tính CIF VND.
  - Thuế TTĐB động (Tự áp chuẩn 35% cho vang < 20 ABV, và 65% cho vang mạnh >= 20 ABV). Tính toán lũy tiến CIF -> NK -> TTĐB -> VAT.
- **`costing.test.ts` (9 Tests):** Chiến dịch Proration Costing (Landed Cost). Chia đều chi phí bảo hiểm/vận chuyển Container vào Từng Chai (Cost/unit) theo Trọng lượng / Số lượng.
- **`stamps.test.ts` (2 Tests):** Cấn trừ kho Tem Nhập Khẩu của Cục Thuế. Logic chặt chẽ chặn xuất/tiêu thụ Tem vượt quá Khả Dụng thực tế, cập nhật trạng thái Lô Tem thành `EXHAUSTED`.
- **`pl-summary.test.ts` (7 Tests):** Data Aggregation Báo cáo P&L (Doanh thu nội bộ tổng).

### 3.4 Quy Trình Lõi & AI (Core Platform)
- **`kpi.test.ts` (2 Tests):** Sao chép KPI target áp dụng growth multiplier cho chu kỳ năm mới. Định mức KPI động (Threshold tracking).
- **`encryption.test.ts` (10 Tests):** Bảo mật dữ liệu mã hóa (PII) trên Database. Hash compare validation cho Password.
- **`session.test.ts` (17 Tests):** Authentication / RBAC Matrix. Chặn các user khác cấp bậc truy cập các module tài chính tuyệt mật.
- **`audit.test.ts` (10 Tests):** Tracking log vĩnh viễn không xóa cho các giao dịch nhạy cảm.
- **`approval.test.ts` (13 Tests):** Engine phê duyệt đa cấp tùy chọn.
- **`utils.test.ts` (12 Tests):** ID formatters.

---

## 🚫 4. Out-of-Scope (Không thực thi Unit Test)
Các module/chức năng sau là các thao tác CRUD truyền thống cơ sở dữ liệu (Create, Read, Update, Delete) — không được cover bằng Business Unit Test để tránh Boilerplate Code vô nghĩa:
- CRUD Quản lý Master Data (Tạo/Sửa Khách Hàng, Nhà Cung Cấp, Mã Rượu).
- CRUD Hợp Đồng (Contract tracking) và Ký Gửi (Consignment records).
- Setup Khai báo Hải quan thông thường (Declarations Form).
- Lệnh Xuất file Excel Báo Cáo (Sử dụng Report Engine Build-in).

*(Chất lượng Data cho các phần trên đã được đảm bảo thông qua chuẩn Type-checking chặt chẽ của TypeScript và Zod Validation Integrations).*
