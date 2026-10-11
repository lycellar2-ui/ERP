# Kế Hoạch Triển Khai: Đối Soát Sao Kê Ngân Hàng & Nhập Liệu Thanh Toán Khách Hàng (Bank Statement Reconciliation & AR Payment Entry)

> **Mã công việc:** `BANK-RECONCILIATION-01`  
> **Module liên quan:** `wine-erp/src/app/dashboard/finance`  
> **Quy tắc tuân thủ:** `GEMINI.md`, `CODEBASE.md`, Clean Code, Defense-in-Depth, P0 Docs Sync.

---

## 1. MỤC TIÊU & BỐI CẢNH
- **Bài toán**: Doanh nghiệp phân phối rượu vang tiếp nhận chuyển khoản thanh toán từ khách hàng mỗi ngày qua nhiều tài khoản ngân hàng (VCB, TCB, ACB, BIDV...). Việc đọc sao kê thủ công để tìm hóa đơn và nhập từng phiếu thu `ARPayment` tốn nhiều công sức, dễ sai sót hoặc bỏ quên nợ.
- **Giải pháp**: Xây dựng phân hệ Đọc sao kê ngân hàng (Upload Excel/CSV) kết hợp Bộ não Gợi ý thông minh (Heuristic & Fuzzy Matching Engine) để nhận diện tự động và hiển thị cho Kế toán duyệt 1-Click ghi sổ an toàn.
- **Tiêu chí lựa chọn từ người dùng**:
  1. *Data Ingestion*: Upload file Excel/CSV sao kê tải từ các ngân hàng.
  2. *Quy trình ghi sổ*: Gợi ý thông minh kèm điểm tin cậy (Confidence Score 0-100%), kế toán kiểm tra và 1-click phê duyệt ghi nhận `ARPayment`.
  3. *Edge Cases*: Xử lý toàn diện cả 4 trường hợp: Gộp nhiều đơn, Cọc/thanh toán từng phần, Sai lệch phí lẻ ngân hàng, và Nội dung chuyển khoản tự do (Rule Learning Memory).

---

## 2. KIẾN TRÚC HỆ THỐNG & CÁC THÀNH PHẦN

### 2.1. Cơ Sở Dữ Liệu (Prisma Schema)
- Bổ sung 5 Models:
  1. `BankAccount`: Danh mục tài khoản ngân hàng công ty (VCB, TCB...).
  2. `BankStatementBatch`: Đợt nạp file sao kê (File info, checksum, tổng thu/chi).
  3. `BankTransaction`: Từng dòng giao dịch (Ngày, số tiền, credit/debit, diễn giải gốc, hash chống trùng, điểm gợi ý).
  4. `BankTransactionMatch`: Phân bổ giao dịch vào các hóa đơn `ARInvoice` / `ARPayment`.
  5. `BankReconciliationRule`: Quy tắc học từ kế toán (Từ khóa -> Khách hàng).
- Bổ sung 2 Enums: `BankTxnType` (CREDIT, DEBIT), `BankTxnStatus` (UNMATCHED, SUGGESTED, POSTED, IGNORED).
- Cập nhật quan hệ tại: `LegalEntity`, `User`, `Customer`, `ARInvoice`, `ARPayment`.

### 2.2. Backend Parser & Matching Engine
- `bank-parser.ts`: Đọc và chuẩn hóa file Excel/CSV từ nhiều định dạng ngân hàng khác nhau (VCB, TCB, ACB, BIDV, MBB, Generic) sử dụng thư viện `exceljs`. Tự động nhận diện dòng tiêu đề và cấu trúc cột.
- `bank-matching-engine.ts`:
  - Trích xuất thực thể (Regex SO/HĐ/MST/SĐT).
  - Khớp bộ nhớ kế toán (`BankReconciliationRule`).
  - Khớp theo tên người chuyển (Trigram / Normalized text).
  - Thuật toán Subset Sum tìm tổ hợp đơn hàng gộp (Batch payment).
  - Chấm điểm tin cậy (Confidence Score 0 - 100).
- `actions-bank-reconciliation.ts`: Server Actions xử lý:
  - Upload & Parse batch giao dịch.
  - Phê duyệt 1-click & hạch toán an toàn (`prisma.$transaction`).
  - Hủy khớp giao dịch (Reversal / Rollback an toàn tài chính).
  - Thêm / Xóa quy tắc ghi nhớ khách hàng.

### 2.3. Frontend UX/UI (Finance Tab)
- Tích hợp thêm Tab "Sao kê & Thu nợ" (`BankReconciliationTab.tsx`) trong phân hệ `/dashboard/finance`.
- Thiết kế Pure Light Design System: Thẻ thống kê KPI, bộ lọc trạng thái (Đã khớp, Chờ duyệt, Chưa rõ), bảng dòng tiền sao kê kèm nhãn điểm tin cậy và nút 1-Click Duyệt.
- Drawer phân bổ đa hóa đơn cho tình huống thanh toán gộp hoặc điều chỉnh chênh lệch phí.

---

## 3. CÁC BƯỚC THỰC HIỆN CHI TIẾT (IMPLEMENTATION PHASES)

- [x] **Phase 1: Database & Documentation Sync**
  - Cập nhật `prisma/schema.prisma` với 5 model (`BankAccount`, `BankStatementBatch`, `BankTransaction`, `BankTransactionMatch`, `BankReconciliationRule`) và 2 enum mới.
  - Chạy `npx prisma db push` đồng bộ trực tiếp lên Supabase PostgreSQL thành công.
  - Cập nhật số liệu model (138 -> 143) và enum (89 -> 91) tại `docs/README.md`, `docs/llms.txt`, `CODEBASE.md`, `docs/architecture/database-schema.md`, `docs/architecture/tech-stack.md`.
- [x] **Phase 2: Bank Parser & Smart Matching Engine**
  - Cài đặt `bank-parser.ts` xử lý Excel/CSV đa ngân hàng (VCB, TCB, ACB, BIDV, MBB, Generic) với thư viện `exceljs`, hash SHA-256 chống trùng lặp.
  - Cài đặt `bank-matching-engine.ts` với chấm điểm và các bộ quy tắc (Exact Match, Partial/Cọc, Subset Sum gộp đơn, Lệch phí, Quy tắc nhớ).
  - Cài đặt `actions-bank-reconciliation.ts` với đầy đủ Transaction an toàn, `JSON.parse(JSON.stringify())` serialize, audit logging và rollback.
- [x] **Phase 3: Giao Diện Người Dùng Đối Soát (UI Workspace)**
  - Xây dựng component `BankReconciliationTab.tsx` theo Pure Light Design System.
  - Tích hợp vào `FinanceClient.tsx` dưới tab "Sao Kê & Thu Nợ" trong nhóm Vận hành.
  - Drawer xử lý phân bổ đơn hàng gộp, cấn trừ phí ngân hàng và tạo quy tắc nhớ khách hàng.
- [x] **Phase 4: Kiểm Thử & Hoàn Thiện**
  - Chạy unit test tự động xác thực thành công 100% cả 5 kịch bản và Edge Cases (`scratch/test_bank_matching_logic.js`).
  - Kiểm tra toàn bộ mã nguồn với `tsc --noEmit` đạt 0 lỗi (Exit Code 0).
  - Cập nhật tài liệu đặc tả phân hệ `docs/modules/finance-accounting.md`.

