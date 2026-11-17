# Parent Company Payment Import (Bảng Kê Thu Tiền Công Ty Mẹ)

## Goal
Cho phép nhập (import) file Excel/CSV **Bảng kê thu tiền** theo **Công ty mẹ** (`Customer` có `children` qua `CustomerHierarchy`) để tự động/bán tự động phân bổ gạch nợ xuống các `ARInvoice` đang mở của công ty mẹ và các chi nhánh con, đồng thời lưu vết theo lô (`ARPaymentBatch`) để hỗ trợ hoàn tác (rollback) và theo dõi tiền trả dư/trả trước (`unallocatedAmount`).

## Architecture & Changes
1. **Prisma Schema (`wine-erp/prisma/schema.prisma`)**
   - Thêm enum `ARPaymentBatchStatus` (`POSTED`, `PARTIALLY_ALLOCATED`, `REVERSED`).
   - Thêm model `ARPaymentBatch` (liên kết `Customer`, `User`, `ARPayment[]`).
   - Thêm `batchId` + relation `batch` vào `ARPayment`.
2. **Server Actions (`wine-erp/src/app/dashboard/finance/actions-parent-payment.ts`)**
   - `downloadParentPaymentTemplate()` — Xuất file Excel mẫu chuẩn.
   - `previewParentPaymentImport(base64File)` — Parse Excel/CSV, khớp Công ty mẹ (Code/MST/Tên), chống trùng `importHash`, mô phỏng phân bổ FIFO qua `[parentId, ...childrenIds]`.
   - `commitParentPaymentImport(rows)` — Transaction tạo `ARPaymentBatch`, tách `ARPayment` vào từng `ARInvoice`, cập nhật `paidAmount` & `status`, cập nhật `SalesOrder.status = 'PAID'`, sinh bút toán `DR 111/112 / CR 131`.
   - `getParentPaymentBatches()` — Danh sách phiếu thu công ty mẹ đã import.
   - `allocateUnallocatedBatch(batchId)` — Phân bổ tiếp phần tiền dư khi phát sinh hóa đơn mới.
   - `reverseParentPaymentBatch(batchId)` — Hoàn tác an toàn toàn bộ lô thu tiền.
3. **Frontend UI (`wine-erp/src/app/dashboard/finance/ParentPaymentImportTab.tsx` & `FinanceClient.tsx`)**
   - Tab mới `parent-payment` trong nhóm Vận hành của Finance.
   - Hỗ trợ tải template, upload bảng kê, xem preview phân bổ từng chi nhánh con, xác nhận ghi sổ, phân bổ tiền dư và hoàn tác.
4. **Verification & Docs Sync**
   - `npx prisma validate`, `npx prisma db push`, `npx prisma generate`, `npx tsc --noEmit`.
   - Cập nhật `docs/modules/finance-accounting.md`, `docs/README.md`, `CODEBASE.md`, `docs/llms.txt`.
