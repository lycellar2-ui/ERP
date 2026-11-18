# Thực thi và Kết quả Kiểm thử Nghiệp vụ & E2E
**Dự án:** Wine ERP - LYS Cellars
**Cập nhật lần cuối:** 2026-11-18
**Framework:** Vitest + Prisma Mocking + Playwright Production E2E
**Tình trạng:** [PASS] 100% — Vitest Safe Suite (34 Files / 322 Tests) & Playwright Read-Only Production E2E (15 Specs / 53 Routes)

---

## 1. Chiến Lược Kiểm Thử (Test Strategy)
Hệ thống Wine ERP quản lý luồng dữ liệu vật lý phức tạp (Hàng hóa, Tiền tệ, Thuế, Quota, Tem). Chiến lược kiểm thử kết hợp hai tầng độc lập:

- **Tầng 1 — Unit & Regression Tests (Vitest + Prisma Mocking, AAA Pattern):** Sử dụng `vi.mock('@/lib/db')` để cô lập logic khỏi DB thật, đảm bảo invariant nghiệp vụ (FIFO `StockLot`, POS 5-in-1 transaction, VAT/TTĐB, double-entry Journal) và các guard chống hồi quy bảo mật/hydration (`test/audit-regressions.test.ts`: `REG-01`–`REG-09`). Khi bảo vệ dữ liệu Supabase live, 3 file E2E ghi DB thật (`test/business/e2e-real-db.test.ts`, `test/business/full-flow-audit.test.ts`, `test/business/stress-and-edge-cases.test.ts`) được loại trừ khỏi lần chạy safe read-only.
- **Tầng 2 — Read-Only Production E2E (Playwright trên `next build` + `next start -p 3100`):** Kiểm tra thực tế toàn bộ **32 phân hệ / 53 routes** (`46` route `/dashboard/*` + `7` route public/auth/portal) với chế độ 0-mutation, đối chiếu đếm bản ghi DB PostgreSQL trước và sau E2E (`EXACT_MATCH`), kiểm tra i18n `VI`/`EN`, tương tác tab/drawer/modal không submit, API guards (`401`/`403`/`400`), và cô lập RBAC (`thukho`).

---

## 2. Báo Cáo Kết Quả (Test Results)

### 2.1 Unit & Regression Tests (Vitest Safe Read-Only Mode)

| Metric | Kết quả | Ghi chú |
| :--- | :--- | :--- |
| **Test Suites** | **34 / 34 Files Passed** | Exclude 3 file ghi DB thật trong chế độ Read-Only (`vnpt-invoice.test.ts` + `audit-regressions.test.ts` `REG-01`–`REG-09`) |
| **Test Cases** | **322 / 322 Tests Passed (100%)** | `0 Failed`, `0 Skipped` |
| **Regression Suite (`audit-regressions.test.ts`)** | `REG-01` – `REG-09` **Passed (18 tests)** | Bổ sung `REG-08` (zero native confirm/prompt & i18n hydration) và `REG-09` (`requireAuth` & `generateNextDocCode`) |
| **Thời gian chạy** | **13.10s** | Chạy tuần tự trên 34 file safe mode |

### 2.2 Playwright Read-Only Production E2E (`tests/e2e/all-modules-readonly.spec.ts`)

| Metric | Kết quả | Ghi chú |
| :--- | :--- | :--- |
| **E2E Specs** | **15 / 15 Specs Passed (100%)** | `0 Failed`, `0 Flaky` (Single worker, Microsoft Edge headless) |
| **Độ phủ Routes** | **53 / 53 Page Routes + API Guards** | `7` root/auth/public/portal + `46` `/dashboard/*` (0 `pageerror`, 0 HTTP 5xx, 0 Hydration `#418`) |
| **Tương tác UI & i18n** | **Passed** | Toggle `EN`/`VI`, chuyển tab `/dashboard/warehouse`, `/dashboard/finance`, `/dashboard/price-list`, `/dashboard/sop`, mở/đóng drawer `/dashboard/sales` bằng `Escape` |
| **RBAC & DB Integrity** | **Passed (`EXACT_MATCH`)** | `thukho` bị chặn khỏi `/dashboard/settings` và `/dashboard/hr`; toàn bộ 8 bảng kiểm baseline khớp 100% sau E2E |
| **Thời gian chạy** | **1.0m** (Group B 46 routes trong `30.4s`) | Target `http://localhost:3100` (`next start`) |

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
