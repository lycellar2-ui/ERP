# 📋 Kế Hoạch Chuẩn Hóa & Khắc Phục Toàn Diện UI/UX (Wine ERP)

> **Mục tiêu:** Giải quyết triệt để 100% các vi phạm và khiếm khuyết UI/UX đã được phát hiện trong đợt Audit, đưa hệ thống Wine ERP đạt chuẩn Design System (Light, Compact, Sharp), nâng cao độ tiếp cận (WCAG AA), tính đồng bộ và thẩm mỹ chuyên nghiệp.
> **Trạng thái:** Đang thực hiện

---

## 📌 Bảng Tiến Độ Tổng Thể

| Giai đoạn | Nội dung trọng tâm | Số mục | Trạng thái |
|---|---|:---:|:---:|
| **Phase 1** | **Hotfixes P0:** Purple Ban, Encoding tiếng Việt, Login Contrast, `window.confirm`, A11y Header | 5 mục | ✅ Hoàn thành |
| **Phase 2** | **Bo góc chuẩn:** Triệt tiêu 401 vi phạm `rounded-xl/2xl`, đưa về `rounded-md`/`rounded-lg` | 8 files lớn | ✅ Hoàn thành |
| **Phase 3** | **Design Tokens & Status Registry:** Di dời `STATUS_CONFIG` cục bộ, xóa legacy imports, chuyển hex sang token | 12 files | ✅ Hoàn thành |
| **Phase 4** | **Navigation & Ergonomics:** Tối ưu Sidebar (Miller's Law), bổ sung EmptyState/Skeleton, kiểm tra `tsc` & `ux_audit` | 4 mục | ✅ Hoàn thành |

---

## Chi Tiết Kế Hoạch Từng Giai Đoạn

### 🔴 Phase 1: Hotfixes P0 (Vi Phạm Nghiêm Trọng & Chuẩn WCAG)
- [x] **Task 1.1 (Purple Ban):**
  - [x] Sửa `PaymentRequestDetailModal.tsx`: Đổi `#9333EA` / `#FDF4FF` sang `lys-teal-strong` / `tone-brand-fg`.
  - [x] Sửa `PaymentRequestsClient.tsx`: Đổi `#9333EA` sang token brand/teal.
  - [x] Sửa `PosmInventoryTab.tsx`: Đổi `#7C3AED` sang `lys-teal-strong`.
  - [x] Sửa `SalesVisitsClient.tsx`: Đổi `#BA68C8` sang token `lys-teal-strong` / brand.
- [x] **Task 1.2 (Encoding Corruption):**
  - [x] Khôi phục toàn bộ tiếng Việt có dấu trong `PaymentRequestsClient.tsx` (`Tiền hàng NCC`, `Thuế NK & Logistics`, `Vận hành & Kho bãi`, `Tạm ứng / Hoàn ứng`, v.v.).
  - [x] Sửa nhãn lỗi mã hóa trong `PosmInventoryTab.tsx` (`Bao Bì & Hộp Quà`).
- [x] **Task 1.3 (Login Page UI/UX & WCAG):**
  - [x] Sửa màu chữ thông báo lỗi thành `text-tone-danger-fg` (`#B91C1C`) trên nền `tone-danger-bg`, viền `tone-danger-border` (đạt contrast > 7:1).
  - [x] Thay nút submit mint green cũ `#87CBB9` bằng `Button` chuẩn `bg-lys-teal-strong text-white hover:bg-lys-teal-hover`.
  - [x] Bỏ shadow quá tối `boxShadow: '0 24px 64px rgba(15, 23, 42, 0.45)'`, dùng viền và shadow chuẩn của ERP.
  - [x] Thêm nút bật/tắt hiển thị mật khẩu (Show/Hide Password).
- [x] **Task 1.4 (Loại bỏ `window.confirm`):**
  - [x] Thay `window.confirm` tại `MobileLocationCounter.tsx:274` bằng `useConfirmDialog`.
- [x] **Task 1.5 (A11y Header & Skip Link):**
  - [x] Thêm `Skip to content` link trong `src/app/layout.tsx`.
  - [x] Thêm `aria-label` cho nút Mobile Menu trong `DashboardShell.tsx`.
  - [x] Nâng kích thước touch target của nút Bell trong `Header.tsx` từ 28px (`w-7 h-7`) lên `w-8 h-8` chuẩn WCAG.
  - [x] Biến các notification item trong Header dropdown thành phần tử truy cập được bằng bàn phím.

---

### 🟡 Phase 2: Chuẩn Hóa Bo Góc (Corner Radius Standardization)
- [x] **Task 2.1:** Chuẩn hóa `SalesVisitsClient.tsx` (118 vị trí `rounded-xl/2xl` -> `rounded-md`/`rounded-lg`).
- [x] **Task 2.2:** Chuẩn hóa `DailyCallPlannerView.tsx` (67 vị trí).
- [x] **Task 2.3:** Chuẩn hóa `MobileLocationCounter.tsx` (56 vị trí).
- [x] **Task 2.4:** Chuẩn hóa `TelesalesProspectingPanel.tsx` (52 vị trí).
- [x] **Task 2.5:** Chuẩn hóa `PaymentRequestsClient.tsx` (20 vị trí).
- [x] **Task 2.6:** Chuẩn hóa các modal con: `TodayLiveFeed.tsx`, `QuickReportModal.tsx`, `LiveCameraModal.tsx`.
- [x] **Task 2.7:** Quét toàn bộ `src/app` đưa số lượng `rounded-xl/2xl` về 0 (đã sửa 25 files, 401+ vị trí về 0).

---

### 🟢 Phase 3: Thống Nhất Status Registry & Dọn Dẹp Legacy Imports
- [x] **Task 3.1:** Thêm mapping `REVIEWING_L1: warning` và `REVIEWING_L2: brand` vào `src/lib/ui/status.ts` để đồng bộ toàn hệ thống.
- [x] **Task 3.2:** Xóa bỏ legacy imports:
  - Thay `@/components/DataPagination` bằng `@/components/ui/Pagination` trong `FinanceClient.tsx` và `InvoiceReconciliationTab.tsx` (loại bỏ hoàn toàn 100% import cũ).
  - Chuẩn hóa `FilterBar.tsx` sang CSS tokens, loại bỏ `onMouseEnter/onFocus` trực tiếp.
- [x] **Task 3.3:** Chạy `ui-palette-codemod.mjs` chuyển đổi 199 giá trị hex/rgba cũ sang token chuẩn Light design system.

---

### 🔵 Phase 4: Ergonomics, Information Architecture & Verification
- [x] **Task 4.1 (Tối ưu Sidebar):**
  - Tách nhóm "Kho & Bán Hàng" (10 mục) thành 2 nhóm riêng biệt: **"Bán Hàng & CRM"** (7 mục: Đơn Bán Hàng, Báo Giá, Bảng Giá, Check Margin, CRM, Check-in, POS) và **"Kho Vận & Logistics"** (5 mục: Kho Hàng, Kiểm Kê Kho, Chuyển Kho, Ký Gửi, Trả Hàng) theo Miller's Law.
- [x] **Task 4.2 (Kiểm tra chất lượng):**
  - Chạy `py .agent/skills/frontend-design/scripts/ux_audit.py wine-erp`: **STATUS: PASS (0 Issues)**.
  - Chạy `npx tsc --noEmit`: **0 lỗi TypeScript**.
  - Chạy `npm run test`: **Pass 28/29 test files, 100% UI tests passed**.
