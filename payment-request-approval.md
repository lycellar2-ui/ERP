# Kế Hoạch Thiết Kế & Triển Khai: Phân Hệ Duyệt Đề Nghị Thanh Toán, Chứng Từ Scan & Quản Lý Ngân Sách Hạng Mục
**Tài liệu lập kế hoạch & Kiến trúc hệ thống** | `payment-request-approval.md`
**Dự án:** LyCellar Wine ERP (`wine-erp`)  
**Mã công việc:** `FIN-PAYMENT-REQ-01`  
**Trạng thái:** `COMPLETED` — Đã hoàn thành triển khai và kiểm thử thành công

---

## 1. Tổng Quan & Mục Tiêu Nghiệp Vụ

Trong quy trình vận hành và phân phối rượu vang nhập khẩu của LyCellar:
* **Tính chất chi tiêu**: Rất đa dạng gồm (1) Tiền hàng nhà cung cấp trong/ngoài nước, (2) Thuế 3 tầng hải quan (NK, TTĐB, VAT), (3) Chi phí logistics và dán tem rượu, (4) Chi phí vận hành, tiếp khách nếm rượu (tasting), (5) Tạm ứng & hoàn ứng công tác của nhân sự.
* **Mục tiêu phân hệ**:
  1. **Danh mục Hạng mục Chi phí & Ngân sách (Expense Categories & Budgeting)**: Cho phép setup danh mục hạng mục chi phí động (phân cấp, gắn mã tài khoản VAS) và thiết lập hạn mức ngân sách (Budget) theo Năm / Quý / Tháng cho từng phòng ban.
  2. **Số hóa Đề nghị thanh toán**: Lập đề nghị theo từng hạng mục chi phí cụ thể, tự động kiểm tra số dư ngân sách còn lại.
  3. **Quy trình phê duyệt đa cấp theo hạn mức (Threshold-based approval)**: Trưởng phòng -> Kế toán kiểm soát hóa đơn -> CEO/CFO phê chuẩn. Cảnh báo hoặc bắt buộc CEO duyệt nếu vượt ngân sách định mức.
  4. **Lưu trữ chứng từ scan trên Cloudflare R2** (10 GB miễn phí vĩnh viễn, 0đ egress) kèm cơ chế xem trực tiếp Split-View (PDF/Ảnh) ngay trên màn hình duyệt.
  5. **Giải ngân & Hạch toán**: Kế toán giải ngân (chuyển khoản/tiền mặt), upload ủy nhiệm chi (UNC) và tự động ghi nhận thanh toán/giảm nợ công nợ.

---

## 2. Kiến Trúc Dữ Liệu (Database Schema)

### 2.1 Enums Mới
* `PaymentRequestStatus`: `DRAFT`, `SUBMITTED`, `REVIEWING_L1`, `REVIEWING_L2`, `APPROVED`, `PAID`, `REJECTED`, `CANCELLED`
* `PaymentDocType`: `VAT_INVOICE`, `DELIVERY_NOTE`, `CONTRACT_DOC`, `TAX_RECEIPT`, `BANK_UNC`, `OTHER`
* `BudgetPeriodType`: `YEARLY`, `QUARTERLY`, `MONTHLY`

### 2.2 Models Mới trong `prisma/schema.prisma`

#### A. Quản lý Hạng mục Chi phí & Ngân sách (Categories & Budgets)
```prisma
// Danh mục Hạng mục chi phí động
model ExpenseCategoryMaster {
  id              String                  @id @default(cuid())
  code            String                  @unique // Vd: MKT_TASTING, OPS_RENT, LOG_CUSTOMS
  name            String                  // Vd: Tiếp khách & Thử nếm rượu (Tasting), Cước vận chuyển
  group           String                  // OPERATING, COST_OF_SALES, MARKETING, ADMINISTRATIVE, CAPEX
  defaultAccount  String?                 // Tài khoản kế toán mặc định: 641, 642, 635, 811...
  parentId        String?
  parent          ExpenseCategoryMaster?  @relation("ExpenseCategoryTree", fields: [parentId], references: [id])
  children        ExpenseCategoryMaster[] @relation("ExpenseCategoryTree")
  description     String?
  isActive        Boolean                 @default(true)
  sortOrder       Int                     @default(0)
  
  // Quan hệ
  paymentItems    PaymentRequestItem[]
  budgets         ExpenseBudget[]
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@map("expense_category_masters")
}

// Bảng phân bổ Ngân sách theo Kỳ & Phòng ban
model ExpenseBudget {
  id                 String                @id @default(cuid())
  categoryId         String
  category           ExpenseCategoryMaster @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  departmentId       String?
  department         Department?           @relation(fields: [departmentId], references: [id])
  legalEntityId      String?
  legalEntity        LegalEntity?          @relation(fields: [legalEntityId], references: [id])
  
  year               Int                   // 2026
  periodType         BudgetPeriodType      @default(YEARLY) // YEARLY, QUARTERLY, MONTHLY
  periodIndex        Int?                  // 1..4 (Quý), 1..12 (Tháng), null (Cả năm)
  
  allocatedAmount    Decimal               @db.Decimal(15, 2) // Ngân sách được duyệt
  warningThresholdPct Decimal              @default(85) @db.Decimal(5, 2) // Cảnh báo khi chạm 85%
  notes              String?
  
  createdAt          DateTime              @default(now())
  updatedAt          DateTime              @updatedAt

  @@unique([categoryId, departmentId, year, periodType, periodIndex])
  @@index([year, periodType])
  @@map("expense_budgets")
}
```

#### B. Phân hệ Đề nghị thanh toán (Payment Requests)
```prisma
model PaymentRequest {
  id                  String               @id @default(cuid())
  requestNo           String               @unique // PR-2026-0001
  title               String               // Nội dung đề nghị thanh toán
  priority            ProposalPriority     @default(NORMAL)
  status              PaymentRequestStatus @default(DRAFT)
  currentLevel        Int                  @default(0) // 0: Nháp, 1: TP, 2: Kế toán, 3: CEO
  
  currency            String               @default("VND")
  exchangeRate        Decimal              @default(1) @db.Decimal(12, 4)
  totalAmount         Decimal              @db.Decimal(15, 2)
  totalAmountVND      Decimal              @db.Decimal(15, 2)
  paidAmount          Decimal              @default(0) @db.Decimal(15, 2)
  
  paymentMethod       PaymentMethod        @default(BANK_TRANSFER)
  dueDate             DateTime?            // Hạn thanh toán
  paidDate            DateTime?            // Ngày thực chi
  
  beneficiaryName     String               // Đơn vị / Người thụ hưởng
  beneficiaryAccount  String?              // Số tài khoản ngân hàng
  beneficiaryBank     String?              // Tên ngân hàng & chi nhánh
  
  legalEntityId       String?
  legalEntity         LegalEntity?         @relation(fields: [legalEntityId], references: [id])
  departmentId        String?
  department          Department?          @relation(fields: [departmentId], references: [id])
  createdBy           String
  creator             User                 @relation("PaymentRequestCreator", fields: [createdBy], references: [id])
  
  // Liên kết tùy chọn tới các chứng từ gốc
  supplierId          String?
  supplier            Supplier?            @relation(fields: [supplierId], references: [id])
  poId                String?
  po                  PurchaseOrder?       @relation(fields: [poId], references: [id])
  apInvoiceId         String?
  apInvoice           APInvoice?           @relation(fields: [apInvoiceId], references: [id])
  proposalId          String?
  proposal            Proposal?            @relation(fields: [proposalId], references: [id])
  
  notes               String?
  rejectReason        String?
  uncVoucherNo        String?              // Số Ủy nhiệm chi sau khi chi
  uncFileUrl          String?              // Link file scan UNC
  
  items               PaymentRequestItem[]
  attachments         PaymentRequestAttachment[]
  approvalLogs        PaymentApprovalLog[]
  
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  @@index([status])
  @@index([createdBy])
  @@index([supplierId])
  @@map("payment_requests")
}

model PaymentRequestItem {
  id             String                 @id @default(cuid())
  requestId      String
  request        PaymentRequest         @relation(fields: [requestId], references: [id], onDelete: Cascade)
  
  // Gắn với Hạng mục chi phí động
  categoryId     String?
  category       ExpenseCategoryMaster? @relation(fields: [categoryId], references: [id])
  
  description    String                 // Diễn giải khoản mục
  accountCode    String?                // Tài khoản hạch toán (331, 642, 641, 141, ...)
  quantity       Decimal                @default(1) @db.Decimal(10, 2)
  unitPrice      Decimal                @db.Decimal(15, 2)
  amount         Decimal                @db.Decimal(15, 2)
  vatAmount      Decimal                @default(0) @db.Decimal(15, 2)
  totalAmount    Decimal                @db.Decimal(15, 2)
  invoiceNo      String?                // Số hóa đơn tương ứng
  invoiceDate    DateTime?

  @@index([requestId])
  @@index([categoryId])
  @@map("payment_request_items")
}

model PaymentRequestAttachment {
  id             String         @id @default(cuid())
  requestId      String
  request        PaymentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  docType        PaymentDocType @default(VAT_INVOICE)
  fileName       String
  fileUrl        String         // Link xem file (R2 / Signed URL)
  storagePath    String         // Key trên R2 bucket
  fileSize       Int
  mimeType       String
  uploadedBy     String
  uploader       User           @relation(fields: [uploadedBy], references: [id])
  createdAt      DateTime       @default(now())

  @@index([requestId])
  @@map("payment_request_attachments")
}

model PaymentApprovalLog {
  id             String         @id @default(cuid())
  requestId      String
  request        PaymentRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  level          Int
  action         String         // SUBMIT, APPROVE, REJECT, RETURN, PAY
  actorId        String
  actor          User           @relation(fields: [actorId], references: [id])
  comment        String?
  createdAt      DateTime       @default(now())

  @@index([requestId])
  @@map("payment_approval_logs")
}
```

---

## 3. Kiến Trúc Lưu Trữ Chứng Từ (Cloudflare R2 Storage Adapter)

1. **Storage Client (`src/lib/storage-r2.ts`)**:
   - Tích hợp chuẩn S3 Client (`@aws-sdk/client-s3`).
   - Cung cấp các hàm:
     + `uploadPaymentDoc(formData, folder)`: Tự động tổ chức theo prefix `payment-requests/{year}/{category}/{requestId}/{fileName}`.
     + `getPresignedDocUrl(storagePath, expiresIn)`: Sinh URL bảo mật có thời hạn 30 phút để xem và in ấn, chống lộ link ra ngoài.
     + `deletePaymentDoc(storagePath)`: Xóa file khi hủy đề nghị nháp.
   - Hỗ trợ cơ chế **Fallback mềm**: Nếu biến môi trường R2 chưa điền, hệ thống tự động fallback về Supabase Storage sẵn có trong `storage.ts` để đảm bảo hệ thống không bao giờ bị gián đoạn.
2. **Client-side Compression**:
   - Tự động nén ảnh hóa đơn/chứng từ từ điện thoại trước khi đẩy lên server, giữ dung lượng nhẹ ~300KB nhưng chữ số VAT vẫn sắc nét.

---

## 4. Kế Hoạch Triển Khai Chi Tiết (5 Giai Đoạn)

### Giai đoạn 1: Hạ tầng Lưu trữ & Cloudflare R2 Adapter
* Cài đặt dependency `@aws-sdk/client-s3` và `@aws-sdk/s3-request-presigner`.
* Xây dựng `src/lib/storage-r2.ts` hỗ trợ upload, sinh Pre-signed URL, kiểm tra file type (PDF, PNG, JPG) và fallback an toàn.
* Thêm tài liệu hướng dẫn cấu hình biến môi trường R2 vào `.env.example`.

### Giai đoạn 2: Cập nhật Cơ sở Dữ liệu & Prisma
* Bổ sung các Model (`ExpenseCategoryMaster`, `ExpenseBudget`, `PaymentRequest`, `PaymentRequestItem`, `PaymentRequestAttachment`, `PaymentApprovalLog`) vào `prisma/schema.prisma`.
* Tạo seed dữ liệu mẫu cho các hạng mục chi phí phổ biến của Wine ERP (Chi phí thử nếm Tasting, Thuế NK & TTĐB, Thuê kho mát, Vận chuyển, Chi phí Marketing, Tiếp khách, Văn phòng phẩm...).
* Chạy `npx prisma db push` và sinh Prisma Client (`npx prisma generate`).

### Giai đoạn 3: Server Actions Quản Lý Hạng Mục, Ngân Sách & Đề Nghị Thanh Toán
* **Cấu hình Hạng mục & Ngân sách**:
  - `getExpenseCategories()`: Lấy danh mục hạng mục chi phí kèm nhóm và tài khoản hạch toán.
  - `saveExpenseCategory(data)`: Tạo mới / cập nhật hạng mục chi phí.
  - `getExpenseBudgets(filters)`: Lấy ngân sách theo năm/kỳ/phòng ban kèm tính toán số tiền thực tế đã chi và tỷ lệ sử dụng (%).
  - `saveExpenseBudget(data)`: Cài đặt hạn mức ngân sách cho từng hạng mục.
* **Nghiệp vụ Đề nghị thanh toán**:
  - `getPaymentRequests(filters)`: Lọc theo status, category, date range, search mã/tiêu đề, phân trang.
  - `getPaymentRequestDetail(id)`: Lấy chi tiết đề nghị, bảng kê items, danh sách chứng từ đính kèm (có sinh signed URL), cảnh báo trạng thái ngân sách và lịch sử duyệt.
  - `createPaymentRequest(data)`: Sinh mã tự động `PR-YYYY-XXXX`, tính tổng tiền VND theo tỷ giá, kiểm tra ngân sách cảnh báo, lưu items & attachments.
  - `processPaymentApproval({ id, action, comment })`: Luồng duyệt 3 cấp (TP -> Kế toán -> CEO).
  - `settlePaymentRequest({ id, paidAmount, paymentMethod, uncFile, voucherNo })`: Kế toán ghi nhận đã chi, upload UNC scan, chuyển trạng thái `PAID` và cập nhật công nợ `APInvoice` (nếu có liên kết).

### Giai đoạn 4: Giao Diện Người Dùng (UI/UX)
* Tạo module `src/app/dashboard/payment-requests/`:
  - `page.tsx`: Server Component fetch dữ liệu ban đầu.
  - `PaymentRequestsClient.tsx`:
    - Thanh điều hướng Tabs:
      1. **Phiếu Đề Nghị Thanh Toán**: Danh sách phiếu, bộ lọc, stats thẻ tóm tắt.
      2. **Cấu Hình Hạng Mục Chi Phí (Expense Categories)**: Bảng thiết lập danh mục, mã code, tài khoản VAS tương ứng.
      3. **Quản Lý & Theo Dõi Ngân Sách (Budget Tracking)**: Xem hạn mức ngân sách theo năm/quý/tháng, thanh tiến độ tiêu thụ ngân sách (Progress bar màu xanh/vàng/đỏ khi vượt 85% - 100%).
  - `CreatePaymentRequestDrawer.tsx`:
    - Form chọn hạng mục chi phí đã cấu hình, gợi ý tài khoản hạch toán tự động.
    - Hiển thị badge trực quan: "Ngân sách còn lại của hạng mục: xx,xxx,xxx đ".
    - Kéo thả Upload chứng từ scan đa file, chọn loại chứng từ.
  - `PaymentRequestDetailModal.tsx`:
    - Thiết kế **Split-View (Chia đôi màn hình)**:
      - **Cột bên trái**: Trình xem chứng từ scan trực tiếp (PDF đa trang hoặc ảnh có nút Zoom In/Out, Xoay ảnh, Tải về).
      - **Cột bên phải**: Thông tin đề nghị thanh toán, người thụ hưởng, ngân hàng, đối soát ngân sách, timeline phê duyệt và các nút hành động (Duyệt, Trả lại, Từ chối, Chi tiền).
* Cập nhật Sidebar navigation (`Sidebar.tsx`) và Header breadcrumbs (`Header.tsx`): Thêm mục **"Đề Nghị Thanh Toán"** (icon `CreditCard` / `ReceiptText`) trong nhóm Tài chính.

### Giai đoạn 5: Đồng Bộ Tài Liệu (Docs Sync Protocol) & Kiểm Thử
* Cập nhật `docs/architecture/database-schema.md` (tăng số lượng model, enum, bổ sung ERD PaymentRequest & ExpenseCategoryMaster & ExpenseBudget).
* Cập nhật `CODEBASE.md`, `docs/README.md`, `docs/llms.txt`.
* Tạo tài liệu mô tả phân hệ `docs/modules/payment-requests.md`.
* Chạy `npm run type-check` và kiểm thử luồng nghiệp vụ không có lỗi type.

---

## 5. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Quản lý Hạng mục & Ngân sách**: Admin/Kế toán trưởng có thể tự do thêm/sửa hạng mục chi phí, gán tài khoản kế toán và phân bổ ngân sách định mức theo năm/quý/tháng.
2. **Kiểm soát Ngân sách**: Khi lập đề nghị hoặc duyệt chi, hệ thống hiển thị rõ tỷ lệ sử dụng ngân sách của hạng mục đó, cảnh báo khi sắp chạm hoặc vượt hạn mức.
3. **Lập đề nghị & Lưu trữ Cloudflare R2**: File chứng từ scan được tải lên đúng thư mục, sinh pre-signed URL an toàn xem được ngay trên trình duyệt mà không cần tải file về.
4. **Luồng phê duyệt**: Trưởng phòng duyệt cấp 1 -> Kế toán kiểm tra chứng từ cấp 2 -> CEO phê chuẩn cấp 3. Thể hiện rõ người duyệt, thời gian và nhận xét trong Timeline.
5. **Chi tiền & UNC**: Kế toán tải được file scan Ủy nhiệm chi lên hệ thống khi chuyển tiền xong, phiếu chuyển trạng thái `PAID`.
6. **Đồng bộ tài liệu**: 100% tài liệu kiến trúc được cập nhật đồng bộ theo quy tắc P0 của dự án.
