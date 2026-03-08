# 🗺️ CODEBASE & AGENT INSTRUCTIONS — Wine ERP

> 🔴 **MANDATORY**: Tất cả AI Assistant/Agents khi làm việc tại dự án này PHẢI đọc và tuân thủ các quy tắc trong tài liệu `CODEBASE.md`. Đây là lớp bảo vệ tuyệt đối (Defense in Depth) chống lại Regression Bug (Hỏng logic khi sửa mới).

## 1. FILE DEPENDENCIES AWARENESS
Mỗi khi bạn có ý định sửa đổi `actions.ts` hoặc cập nhật Component của một module, bạn **BẮT BUỘC** phải xem qua tài liệu sau để không làm nứt gãy dữ liệu ở module kết nối:
1. `docs/architecture/module-dependencies.md` -> Hiểu rõ Module Chủ & Các Module Phụ Thuộc (Ví dụ: SLS gọi WMS tuyệt đối không can thiệp Code xử lý DB WMS).
2. `docs/architecture/data-flow.md` -> Xem danh sách RÀNG BUỘC CỨNG (Constraints). Ví dụ: cấm xóa SO đã xuất hóa đơn; cấm xóa Product/Customer hard-delete. Đọc tài liệu đó KHẮC CỐT ghi tâm trước khi viết logic `database interaction`.

## 2. STRICT 3-STEP WORKFLOW CHO MỌI CODE FUNCTION
Khi User yêu cầu Code / Chỉnh sửa Logic / Thêm Flow:
- **BƯỚC 1: TRA CỨU CONSTRAINT MANG TÍNH THIẾT KẾ**
  - Mở đọc file `docs/architecture/data-flow.md` để check quy tắc nào ràng buộc tính năng User đang yêu cầu.
  - Bổ sung `throw new Error(...)` vào hàm Server Action nếu request cố tình vi phạm luồng.
- **BƯỚC 2: VIẾT THEO RANH GIỚI MODULAR (DDD)**
  - Tích hợp theo ranh giới, không đụng vào `App/DB` của module khác. Nếu module khác không có API/Hàm xử lý, hãy VÀO module kia viết thêm một `Server Action` và sau đó ở module gốc thì import lại nó. Thiết lập "Single Source of Truth".
- **BƯỚC 3: KIỂM TRA LỖI TYPE (TypeScript Error Net)**
  - Hệ thống sử dụng Typescript Validation Type Checking làm Ràng Buộc Cao Nhất.
  - Luôn đảm bảo Typescript Build Không Lỗi (`npm run type-check` hay kiểm tra IDE errors).

## 3. PHÂN BỔ MODULES (APP ROUTER)
- **System/Admin**: `src/app/dashboard/settings` (User/Role/Permission CRUD + **Approval Workflow Engine**), `src/app/login`
- **Master Data**: `src/app/dashboard/products` (**Media Upload Gallery**), `src/app/dashboard/customers` (**Address CRUD**, soft-delete), `src/app/dashboard/suppliers` (soft-delete)
- **Warehouse**: `src/app/dashboard/warehouse` (FIFO, Quarantine, Write-off, Stock Adjust, Enhanced Stats, **CSV Export**, **Detail Drawers**) — Split: `actions.ts` (core), `actions-gr.ts` (GR), `actions-do.ts` (DO)
- **Sales & Allocation**: `src/app/dashboard/sales` (**Order Discount**, **Credit Hold Auto**), `src/app/dashboard/quotations` (**Professional PDF Export**, **Send Drawer Email/Zalo**, **View Tracking**), `src/app/dashboard/price-list`, `src/app/dashboard/allocation`, `src/app/dashboard/returns` (Credit Note + WMS Quarantine)
- **CRM**: `src/app/dashboard/crm` (**TastingEventsPanel**, **ComplaintTicketsPanel**, **WinePreferencePanel**), `src/app/dashboard/pipeline`
- **Finance & Tem**: `src/app/dashboard/finance` (P&L, **Balance Sheet/CĐKT**, Expenses, Period Close, COD→AR), `src/app/dashboard/declarations` (e-Sign, Doc Upload, **TTĐB Bảng Kê**), `src/app/dashboard/stamps`
- **Procurement & Operations**: `src/app/dashboard/procurement` (**Tax Engine**, **Variance Report**, **Excel Import**, **Multi-currency VND**), `src/app/dashboard/contracts` (**Amendment audit trail**, **E-Sign**, Doc Upload), `src/app/dashboard/agency`
- **Tax & Market Data**: `src/app/dashboard/tax`, `src/app/dashboard/costing`, `src/app/dashboard/market-price`
- **Logistics**: `src/app/dashboard/delivery` (**COD→AR Sync**, Reverse Logistics), `src/app/dashboard/consignment`, `src/app/dashboard/transfers`, `src/app/dashboard/returns`, `src/app/dashboard/stock-count`
- **CEO Board**: `src/app/dashboard`, `src/app/dashboard/kpi`, `src/app/dashboard/reports`
- **AI & Features**: `src/app/dashboard/ai` (Demand Forecast, Smart Pricing)
- **POS & QR**: `src/app/dashboard/pos` (Barcode scan, VAT Invoice, **Loyalty Program**), `src/app/dashboard/pos/loyalty`, `src/app/dashboard/qr-codes` (Anti-counterfeit)
- **External Portal**: `src/app/partner-login` (**External Partner Login & Portal**)
- **Public Pages**: `src/app/verify/quotation/[token]` (**Public Quotation Viewer** — KH xem, accept/reject, view tracking), `src/app/api/export/quotation-pdf` (**PDF Export API** — Professional/Elegant styles)

## 4. CROSS-CUTTING ENGINES (Shared Libraries)
| Engine | Path | Mô tả |
|--------|------|-------|
| **Auth** | `src/lib/session.ts` | `getCurrentUser()`, `hasPermission()`, `hasRole()` |
| **RBAC Middleware** | `src/middleware.ts` | Route → Permission mapping, redirect unauthenticated |
| **Approval Workflow** | `settings/actions.ts` | Template CRUD → Submit → Multi-step Approve/Reject → Audit trail |
| **Notification** | `src/lib/notifications.ts` | 5 email templates via Resend (**lazy init** — không crash khi missing API key) + Telegram |
| **Excel Export** | `src/lib/excel.ts` | Generic engine + 4 pre-built templates (AR Aging, Stock, Sales, Costing) |
| **File Upload** | `src/lib/storage.ts` | Supabase Storage: uploadFile, deleteFile, listFiles |
| **Tax Engine** | `tax/actions.ts` | CIF → NK → TTĐB → VAT auto-calc by HS Code + Country |
| **SignaturePad** | `src/components/SignaturePad.tsx` | Canvas-based e-signature capture component |
| **AI Service** | `src/lib/ai-service.ts` | Gemini API integration (OCR, Forecast, Anomaly) |
| **Encryption** | `src/lib/encryption.ts` | AES-256 key vault for API keys |
| **Server Cache** | `src/lib/cache.ts` | In-memory Map cache with TTL + prefix invalidation for DB query results |
| **Realtime Hook** | `src/lib/useRealtimeDashboard.ts` | Supabase Realtime subscriptions — role-based channel management |
| **Audit Diff** | `src/lib/audit.ts` | `logAuditWithDiff()` — per-field change tracking + auto-description |

## 5. LƯU Ý QUAN TRỌNG
- **Soft Delete Pattern**: Product, Customer, Supplier sử dụng `deletedAt` + `status: INACTIVE`. Kiểm tra active PO/SO trước khi xoá.
- **COD → AR Sync**: Khi giao hàng thu tiền COD (`delivery/actions.ts:syncCODToAR`), tự động tạo `ARPayment` và cập nhật `ARInvoice.status = PAID` nếu đủ.
- **Contract Amendment**: Mỗi sửa đổi hợp đồng tạo `ContractAmendment` record với `amendNo` tự tăng, không sửa trực tiếp contract history.
- **Approval Flow**: Documents (PO, SO, Expense...) phải submit qua `submitForApproval()` → approver dùng `processApproval()` → role-based verification mỗi bước.

## 6. 🐛 BUG FIX & PERFORMANCE RULES

> 🔴 **BẮT BUỘC**: Mỗi khi fix bug, PHẢI bổ sung vào `docs/bug-fix-lessons.md`.
> Đọc file đó TRƯỚC khi debug để tra cứu lỗi đã gặp.

### DB Connection (Supabase Free Tier)
- `pg.Pool({ max: 3 })` — KHÔNG tăng lên 5+ khi dev local
- KHÔNG chạy đồng thời dev server + seed script + prisma CLI
- Check zombie processes bằng `Get-Process -Name "node"` trước khi debug connection errors

### Performance
- Mọi `/dashboard/*` **PHẢI** có `loading.tsx` (skeleton)
- Mọi READ function nên wrap trong `cached()` từ `@/lib/cache` — pattern: `return cached('prefix:key', fn, TTL_MS)`
- Mutations **PHẢI** gọi `revalidateCache('prefix')` để invalidate
- `staleTimes` trong `next.config.ts` là **BẮT BUỘC** (client-side router cache)
- KHÔNG dùng `export const revalidate = N` trên dashboard pages (trigger prerender → exhaust DB pool)

### Encoding
- KHÔNG dùng PowerShell `Set-Content` cho file code (phá UTF-8)
- Dùng `[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)` hoặc tool `replace_file_content`

### Server Actions
- Mọi exported function trong file `'use server'` PHẢI là `async` — kể cả không cần await
- Nếu function không cần server, tách ra file riêng không có `'use server'` directive
- **Prisma data trả về client PHẢI serialize bằng `JSON.parse(JSON.stringify(raw))`** — `{...raw}` không đủ
- **Server Actions nên return `{ success, data/error }`** thay vì throw — Vercel redact error messages

### SDK Initialization
- **KHÔNG khởi tạo third-party SDK ở module-level** nếu env var có thể missing (Resend, Stripe, Twilio...)
- Dùng lazy init: `let _client = null; function getClient() { if (!_client && key) _client = new SDK(key); return _client }`

## 7. 📝 BẮT BUỘC CẬP NHẬT DOCS SAU MỖI THAY ĐỔI CODE

> 🔴 **MANDATORY**: AI Agent khi thay đổi code PHẢI cập nhật docs tương ứng.
> Quy tắc này có cùng mức ưu tiên với data-flow constraints.

### Mapping: Thay đổi code → Docs phải cập nhật

| Thay đổi code | File docs PHẢI cập nhật |
|---|---|
| **Thêm module mới** (route + actions.ts) | ① Tạo `docs/modules/<tên>.md` ② Thêm vào bảng Module trong `docs/README.md` ③ Cập nhật `docs/llms.txt` |
| **Thêm Prisma model/enum** | ① `docs/architecture/database-schema.md` (ERD) ② `docs/architecture/module-dependencies.md` (nếu domain mới) |
| **Thay đổi tech stack** (dependency, service) | ① `docs/architecture/tech-stack.md` ② Bảng "Quyết Định Kỹ Thuật" trong `docs/README.md` |
| **Thêm tính năng vào module có sẵn** | ① Spec file: `docs/modules/<module>.md` (thêm mô tả implementation) |
| **Fix bug quan trọng** | ① `docs/bug-fix-lessons.md` (theo template BUG-XXX) |
| **Thay đổi Auth/Storage/DB config** | ① `docs/architecture/tech-stack.md` |
| **Kết thúc phiên làm việc** | ① `Last updated` ở cuối `docs/README.md` và `docs/llms.txt` |

### Checklist cuối phiên (PHẢI hoàn thành trước khi kết thúc)

```
□ docs/README.md → "Last updated" = ngày hôm nay?
□ Module spec file(s) đã cập nhật nếu thêm tính năng?
□ Số liệu (models, routes, modules) trong README.md vẫn chính xác?
□ docs/llms.txt phản ánh đúng hiện trạng?
□ Bug fix đã bổ sung vào bug-fix-lessons.md?
```

### Số liệu hiện tại cần đồng nhất (2026-03-08)

| Metric | Giá trị | Nơi ghi nhận |
|---|---|---|
| Prisma models | **111** | README.md, llms.txt, tech-stack.md |
| Prisma enums | **71** | README.md, llms.txt |
| Dashboard routes | **33** | README.md, wine-erp-plan.md |
| Server Action files | **38** | README.md |
| Module spec files | **24** | README.md |
| Total modules (codes) | **26** | README.md, llms.txt, wine-erp-plan.md |
| Next.js version | **16.1.6** | tech-stack.md, wine-erp-plan.md |
| Auth | **Supabase Auth** | tech-stack.md, wine-erp-plan.md |
| Image storage | **ImgBB** | tech-stack.md, file-storage-plan.md |
| Doc storage | **Supabase Storage** | tech-stack.md, file-storage-plan.md |

> ⚠️ Khi bất kỳ số liệu nào ở trên thay đổi → CẬP NHẬT TẤT CẢ CÁC FILE trong cột "Nơi ghi nhận".
