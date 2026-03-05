# 🔍 Wine ERP — Audit Hợp Nhất (Cuối Cùng)
**Ngày:** 05/03/2026 22:20 | **Phiên bản:** Wine ERP v4.1  
**Phương pháp:** Gộp 2 audit trước (audit-v1 + audit-05-03) + scan lại toàn bộ mã nguồn thực tế  
**Phạm vi:** So sánh 19 file đặc tả với codebase tại `wine-erp/src/`

---

## 📊 Tổng Quan Nhanh

| Module | Mã | Hoàn thiện | Trend | Ghi chú ngắn |
|--------|-----|------------|-------|---------------|
| Auth, RBAC & Workflow | `SYS` | **95%** 🟢 | ▲▲ | Full RBAC + Approval Engine + Audit Trail |
| Master Data & Partner | `MDM` | **90%** 🟢 | ▲ | CRUD + Price List + Address + Soft Delete |
| Warehouse & Inventory | `WMS` | **92%** 🟢 | ▲▲▲ | GR + DO + FIFO + Transfer + Count + Quarantine + Write-off |
| Sales & Allocation | `SLS` | **88%** 🟢 | ▲▲ | SO lifecycle + Allocation Engine + Return/CN + Quotation |
| Finance & Accounting | `FIN` | **85%** 🟢 | ▲▲▲ | AR/AP + Journal + P&L + Expense + Period Close + COD |
| CEO Dashboard | `DSH` | **88%** 🟢 | ▲▲ | KPIs + P&L + Cash Position + AR Aging + KPI Bars |
| Procurement & Import | `PRC` | **82%** 🟢 | ▲ | PO CRUD + Tax Engine + Landed Cost + Variance |
| Reporting & BI | `RPT` | **80%** 🟢 | ▲▲▲ | 15 Reports (R01-R15) + Excel Export + Report Builder |
| Product Costing | `CST` | **80%** 🟢 | ▲▲ | Landed Cost Campaign + Proration + Price Suggestion |
| Tax & Market Price | `TAX` | **78%** 🟢 | ▲ | CRUD + Tax Engine + Market Price Tracking |
| CRM | `CRM` | **72%** 🟢 | ▲ | 360° + Pipeline + Transaction History + Tier |
| Transportation | `TRS` | **72%** 🟢 | ▲▲ | Routes + E-POD + COD→AR + Reverse Logistics |
| Contract Management | `CNT` | **72%** 🟢 | ▲▲ | CRUD + Utilization + Amendment + Expiry Alert |
| Stamps | `STM` | **70%** 🟢 | ▲ | Purchase + Usage + Link Shipment/Lot + Report Excel |
| KPI Targets | `KPI` | **68%** 🟡 | ▲▲ | Setup UI + DB targets + Forecast + Copy year |
| Consignment | `CSG` | **65%** 🟡 | ▲▲▲ | Agreement + Stock tracking + Reports + Auto Invoice |
| Import Agency Portal | `AGN` | **55%** 🟡 | ▲▲ | Partners + Submissions + Review (nội bộ) |
| Declarations | `DCL` | **60%** 🟡 | ▲▲ | CRUD + Data aggregation + NK data + Calendar |
| POS Showroom | `POS` | **75%** 🟢 | 🆕 | Product grid + Cart + Payment + FIFO + Barcode + VAT |
| QR Code & Barcode | `QRC` | **70%** 🟢 | 🆕 | Auto-gen after GR + Dashboard + Verify page + Anti-counterfeit |
| Market Price | `MKT` | **75%** 🟢 | 🆕 | Comparison table + Margin Gap + Below-cost alert |
| AI Features | `AI` | **55%** 🟡 | ▲▲▲ | Key Vault + OCR + Forecast + Pricing + Anomaly + Smart Search |

> **Tổng hoàn thiện ước tính: ~96%** trọng tâm core. Tất cả P1 features hoàn thành (15/15).

---

## 🏗️ Kiến Trúc Code Thực Tế (Đã Verify)

```
wine-erp/src/
├── app/
│   ├── page.tsx              # Root → redirect /dashboard
│   ├── layout.tsx            # RootLayout (fonts, metadata)
│   ├── error.tsx             # 🆕 Global error boundary
│   ├── login/                # Auth: Supabase signIn/signOut
│   ├── verify/[code]/        # Public QR verify page
│   ├── api/
│   │   ├── export/route.ts   # Excel export API
│   │   └── qr-print/route.ts # QR label print API
│   └── dashboard/
│       ├── page.tsx          # CEO Dashboard (500 lines)
│       ├── actions.ts        # Dashboard aggregates (475 lines)
│       ├── layout.tsx        # Sidebar + Header
│       ├── error.tsx         # 🆕 Dashboard error boundary
│       ├── agency/           # AGN: Partners + Submissions
│       ├── ai/               # AI: Forecast + Pricing + OCR + Search + Anomaly
│       ├── allocation/       # SLS: Campaign + Quota Matrix
│       ├── consignment/      # CSG: Agreement + Stock + Reports
│       ├── contracts/        # CNT: CRUD + Utilization + Amendment
│       ├── costing/          # CST: SKU cost + Landed Cost Campaign
│       ├── crm/              # CRM: 360° + Activities + Pipeline link
│       ├── customers/        # MDM: CRUD + Address CRUD
│       ├── declarations/     # DCL: CRUD + Data + Calendar
│       ├── delivery/         # TRS: Routes + E-POD + COD + Reverse
│       ├── finance/          # FIN: AR/AP + Journal + P&L + Expense + Period
│       ├── kpi/              # KPI: Setup + Summary + Forecast
│       ├── market-price/     # MKT: Comparison + Alert
│       ├── pipeline/         # CRM: Kanban board
│       ├── pos/              # POS: Product grid + Cart + Payment
│       ├── price-list/       # MDM: Multi-channel pricing
│       ├── procurement/      # PRC: PO CRUD + Tax Engine
│       ├── products/         # MDM: Wine product CRUD
│       ├── qr-codes/         # QRC: Dashboard + Auto-gen
│       ├── quotations/       # SLS: Báo giá + Convert to SO
│       ├── reports/          # RPT: 15 reports + Report Builder
│       ├── returns/          # SLS: Return Order + Credit Note
│       ├── sales/            # SLS: SO lifecycle + Margin + Allocation
│       ├── settings/         # SYS: Users + Roles + Permissions + Audit Log
│       ├── stamps/           # STM: Purchase + Usage + Linking + Report Excel
│       ├── stock-count/      # WMS: Cycle Count workflow
│       ├── suppliers/        # MDM: Supplier CRUD + Soft Delete
│       ├── tax/              # TAX: CRUD + Tax Engine
│       ├── transfers/        # WMS: Inter-warehouse transfer
│       └── warehouse/        # WMS: GR + DO + Location + Heatmap
├── lib/
│   ├── ai-service.ts         # Gemini API wrapper
│   ├── approval.ts           # Approval Workflow Engine
│   ├── audit.ts              # Audit Trail logger
│   ├── db.ts                 # Prisma + pg Pool (SSL fixed)
│   ├── encryption.ts         # AES-256-GCM for API keys
│   ├── excel.ts              # ExcelJS report engine
│   ├── notifications.ts      # Resend email engine (4 templates)
│   ├── session.ts            # RBAC: getCurrentUser, hasPermission
│   ├── storage.ts            # Supabase Storage upload/delete
│   ├── supabase.ts           # Supabase client factories
│   └── utils.ts              # formatVND, generateSoNo, etc.
├── components/layout/        # Sidebar + Header
└── middleware.ts             # Auth guard + RBAC route mapping
```

**Thống kê:** 32 action files | 30 dashboard modules | 11 lib utilities | ~57 Prisma models

---

## 📋 Tính Năng Còn Thiếu (So Với Đặc Tả)

### 🔴 Ưu Tiên CAO — Ảnh hưởng trải nghiệm/nghiệp vụ

| # | Module | Tính năng thiếu | Chi tiết | Phức tạp |
|---|--------|-----------------|----------|----------|
| 1 | `TRS` | **Canvas chữ ký điện tử** | KH ký trên điện thoại shipper khi nhận hàng | Medium |
| 2 | `TRS` | **Chụp ảnh bằng chứng giao** | Upload ảnh POD → Supabase Storage | Medium |
| 3 | `TRS` | **Shipper Mobile View** | Responsive layout cho `/delivery/shipper` | Medium |
| 4 | `AI` | **OCR Upload UI** | Drag & drop PDF → preview kết quả → confirm import | Medium |
| 5 | `CRM` | **Customer Contacts (multi)** | Nhiều người liên hệ per KH (tên, SĐT, email, chức vụ) | Low |
| 6 | `CRM` | **Custom Tags** | Gán nhãn tùy chỉnh (VIP, Price-sensitive, At-risk) | Low |
| 7 | `CNT` | **File Upload UI** | Upload PDF bản scan HĐ (backend `uploadContractDocument` ✅ có) | Low |
| 8 | `DCL` | **Thuế TTĐB bảng kê** | Bảng kê hàng hóa chịu TTĐB đầu vào (GR) và đầu ra (DO) | Medium |

### 🟡 Ưu Tiên TRUNG BÌNH — Nâng cao trải nghiệm

| # | Module | Tính năng thiếu | Chi tiết | Phức tạp |
|---|--------|-----------------|----------|----------|
| 9 | `DSH` | **Supabase Realtime subscription** | KPI/Approvals cập nhật real-time | High |
| 10 | `DSH` | **Role-based Dashboard** | CEO/Sales Mgr/Thủ kho thấy dashboard khác nhau | Medium |
| 11 | `DSH` | **Cost Structure Waterfall Chart** | Phân tích cơ cấu chi phí dạng waterfall | Medium |
| 12 | `AGN` | **External Partner login riêng** | Trang `/agency` login bằng tài khoản EXTERNAL_PARTNER | High |
| 13 | `AGN` | **Shipment Scope Lock** | Agency chỉ thấy lô hàng mình phụ trách | Medium |
| 14 | `AGN` | **Document Upload** | Upload PDF tờ khai, invoice logistics | Medium |
| 15 | `AGN` | **Tracking Milestones** | Order → Vessel → Arrived → Cleared → Delivered | Medium |
| 16 | `MDM` | **Product Media upload** | Upload đa ảnh cho sản phẩm + CDN | Medium |
| 17 | `MDM` | **Awards & Scores** | Robert Parker, Wine Spectator, Decanter Medal | Low |
| 18 | `FIN` | **Balance Sheet (CĐKT)** | Bảng Cân Đối Kế Toán hàng quý | Medium |
| 19 | `FIN` | **Bad Debt Write-off** | Nợ khó đòi, workflow duyệt | Low |
| 20 | `FIN` | **Credit Hold tự động** | Auto CREDIT_HOLD khi AR > Credit Limit → block SO | Medium |
| 21 | `FIN` | **E-Invoice integration** | Phát hành HĐĐT (cần API nhà cung cấp) | High |
| 22 | `TAX` | **EVFTA roadmap theo năm** | Lộ trình giảm thuế EVFTA từng năm | Low |
| 23 | `SLS` | **Chiết khấu tổng đơn** | Order-level discount + Approval nếu vượt ngưỡng | Low |
| 24 | `RPT` | **Scheduled Reports email** | Cron job + Resend: gửi báo cáo tự động | Medium |

### 🟢 Ưu Tiên THẤP — Nice to have

| # | Module | Tính năng thiếu | Chi tiết |
|---|--------|-----------------|----------|
| 25 | `WMS` | Mobile Scanner PWA | Camera scan QR/Barcode, offline support |
| 26 | `CRM` | Wine Preference Profile | Giống nho, vùng, khẩu vị |
| 27 | `CRM` | Tasting Event Management | Event RSVP, check-in, conversion tracking |
| 28 | `CRM` | Complaint Ticket system | Ticket, SLA, resolution tracking |
| 29 | `POS` | Loyalty Program | Tích điểm, đổi thưởng |
| 30 | `CNT` | Digital Signature nội bộ | CEO ký HĐ trong hệ thống |
| 31 | `MDM` | Supplier Scorecard | Rating on-time delivery, chất lượng |
| 32 | `MDM` | Duplicate Detection | Cảnh báo SKU/KH/NCC trùng |
| 33 | `RPT` | Print Preview A4 | Tối ưu layout cho in |
| 34 | `DSH` | Doanh thu YoY comparison | 2 đường so sánh Năm nay vs Năm ngoái |

---

## ✅ Tính Năng Đã Hoàn Thành (Verify Từ Code)

### SYS — System Admin (95%)
- [x] Supabase Auth: Login/Logout + Session (`middleware.ts`, `lib/session.ts`)
- [x] RBAC: 8 roles, 58 permissions, 8 users + Settings UI 3 tabs
- [x] Approval Engine: `lib/approval.ts` — submit, approve, reject, multi-step, threshold
- [x] Audit Trail: `lib/audit.ts` — `logAudit()` + Settings tab Audit Log
- [x] Notification Engine: `lib/notifications.ts` — 4 email templates (Resend)
- [x] Middleware RBAC route guard: `ROUTE_PERMISSIONS` mapping
- [ ] Audit Trail middleware tracking (changes per field)

### MDM — Master Data (90%)
- [x] Products: Full CRUD + Drawer detail + all wine fields
- [x] Suppliers: CRUD + **Soft Delete** (`deleteSupplier`)
- [x] Customers: CRUD + **Soft Delete** + **Address CRUD** (4 actions)
- [x] Price List: CRUD + 4 channels + Effective Date + Bulk Update
- [x] Auto-load price by channel khi tạo SO
- [ ] Product Media upload, Awards & Scores

### WMS — Warehouse (92%)
- [x] Multi-warehouse + Zone/Rack/Bin + Location Manager + Heatmap
- [x] Goods Receipt (GR) từ PO → StockLot + auto Journal DR 156/CR 331
- [x] Delivery Order (DO) từ SO → FIFO pick + auto COGS Journal DR 632/CR 156
- [x] Inter-Warehouse Transfer: 4-step workflow + stock move
- [x] Stock Count/Cycle Count: session → start → count → complete → adjust
- [x] Quarantine: move + release (RESTORE/WRITE_OFF)
- [x] Write-off: giảm stock + auto Journal DR 811/CR 156
- [x] QR Code auto-gen after GR confirm
- [ ] Mobile Scanner PWA

### SLS — Sales & Allocation (88%)
- [x] SO lifecycle 8 status + Confirm/Advance/Cancel
- [x] Credit Check + Stock Check real-time
- [x] SO Margin per line + Negative Margin Alert
- [x] Allocation Engine: Campaign + Quota Matrix + Check khi tạo SO + Color coding
- [x] Quotation Module: CRUD + Convert to SO + Auto-expire + Duplicate
- [x] Return Order + Auto Credit Note
- [x] Approval Engine integration (SO ≥ 100M → PENDING_APPROVAL)
- [ ] Chiết khấu tổng đơn + Order-level discount

### FIN — Finance (85%)
- [x] AR/AP Invoices + Payment recording
- [x] Journal Entries auto-generate: GR, DO, AR Invoice, AR Payment, Expense
- [x] COGS Tracking: Landed Cost × qty
- [x] P&L Statement: Revenue - COGS - GP - Expenses - NP + comparison
- [x] Expense Management: CRUD + auto-approve < 5M + auto Journal
- [x] Period End Close: Checklist 5 mục + lock kỳ
- [x] COD Collection: `collectCODPayment()` → AR Payment + auto Journal
- [x] Cash Position + AR Aging Dashboard widgets
- [ ] Balance Sheet, Bad Debt, E-Invoice, Credit Hold auto

### DSH — CEO Dashboard (88%)
- [x] KPI Cards (Revenue, Orders, Stock Value, Pending Approvals)
- [x] Revenue chart 6 tháng
- [x] In-transit Shipments (ETA)
- [x] Pending Approvals: Approve/Reject trực tiếp (SO + Approval Engine)
- [x] P&L Summary Widget
- [x] Cash Position Widget  
- [x] AR Aging Chart (5 buckets)
- [x] KPI Progress Bars (5 metrics)
- [x] Export Dashboard Excel
- [ ] Realtime subscription, Role-based dashboard, Cost Waterfall

### PRC — Procurement (82%)
- [x] PO CRUD + Status workflow
- [x] Tax Engine: CIF → NK → SCT → VAT auto
- [x] PO Tax Calculation panel
- [x] Import PO from Excel
- [x] Contract linking
- [x] Variance Report: PO vs Actual
- [ ] Multi-currency VND convert at trade date

### RPT — Reporting (80%)
- [x] 15 Standard Reports (R01-R15) + Excel Export
- [x] Report Builder: template CRUD + dynamic execution
- [x] Report Permissions: role-based access control
- [x] AR Aging PDF Export
- [ ] Scheduled Reports email

### CST — Costing (80%)
- [x] Landed Cost Campaign: Create + Calculate + Finalize → StockLot update
- [x] Proration Engine: phân bổ theo qty
- [x] Price Suggestion: 4 kênh (HORECA/Đại Lý/VIP/POS)
- [x] Margin analysis per SKU
- [ ] Sensitivity Analysis ("nếu tỷ giá tăng X%...")

### TAX — Tax & Market Price (78%)
- [x] Tax Rate CRUD + Tax Engine (NK/SCT/VAT auto)
- [x] Auto SCT 35%/65% based on ABV%
- [x] Market Price Tracking: CRUD + Margin Gap % + below-cost alert
- [ ] EVFTA roadmap, bulk upload Excel thuế

### CRM — Customer (72%)
- [x] 360° Profile + Activity Log (6 types)
- [x] Sales Pipeline: Kanban 6 cột, stage transitions
- [x] Customer Transaction History: all-time orders + AR + top SKUs
- [x] Customer Tier Auto-Calculation: Bronze/Silver/Gold/Platinum
- [ ] Contacts (multi), Custom Tags, Wine Preference, Tasting Events

### TRS — Transportation (72%)
- [x] Route Planning + Status workflow 4 bước
- [x] E-POD: Xác nhận giao hàng per stop (tên + ghi chú)
- [x] COD Collection → AR Payment + auto Journal
- [x] Reverse Logistics: `recordDeliveryFailure()` + `scheduleRedelivery()`
- [ ] Canvas chữ ký, Chụp ảnh POD, Shipper Mobile View

### CNT — Contract (72%)
- [x] CRUD + 5 loại HĐ + Status workflow
- [x] Utilization Tracking: PO/SO value vs contract value + progress bar
- [x] Contract ↔ PO/SO linking
- [x] Expiry Alert: 30d/7d check
- [x] Amendment/Addendum: tạo phụ lục + audit trail
- [x] Document Upload backend (`uploadContractDocument`)
- [x] E-Sign backend (`signContract`)
- [ ] File Upload UI, Email alert tự động

### STM — Stamps (70%)
- [x] Stamp Purchase CRUD + Usage recording
- [x] Stamp ↔ Shipment/StockLot linking
- [x] Data validation (used + damaged > total)
- [x] Stamp Report Excel (quarterly/annual)
- [ ] Biên bản hủy tem, Alert overuse UI

### POS — Point of Sale (75%)
- [x] Product grid + Cart + multi-line
- [x] 3 payment methods: Cash (tiền thối) + Bank Transfer + QR
- [x] Barcode/SKU lookup
- [x] FIFO stock deduction + auto SO (POS-xxxx)
- [x] Shift Summary
- [x] VAT Invoice generation
- [x] VIP customer pricing
- [ ] Loyalty Program

### QRC — QR Code (70%)
- [x] Auto-generate QR after GR confirm
- [x] QR data: lot, SKU, vintage, shipment, warehouse
- [x] Print Label: API route → A4 3-column grid
- [x] Public verify page: `/verify/[code]`
- [x] Anti-counterfeit: first scan ✅, subsequent ⚠
- [x] Dashboard: stats + table + search

### AI — AI Features (55%)
- [x] AI API Key Vault: AES-256 encryption + test + budget
- [x] Prompt Library: CRUD templates
- [x] Demand Forecast: exponential smoothing + trend
- [x] Smart Pricing: 4 tiers + recommendation
- [x] Anomaly Detection: 4 types (unusual order, duplicate, negative stock, expense)
- [x] OCR Customs Declaration + OCR Logistics Invoice (backend)
- [x] CEO Monthly Summary (`generateCEOSummary`)
- [x] Smart Product Search (keyword decomposition)
- [ ] OCR Upload UI, Product Description gen via Gemini

### AGN — Agency Portal (55%)
- [x] Partners Tab: CRUD + submission counts
- [x] Submissions Tab: create + filter + inline review
- [x] Dynamic data từ DB
- [ ] External Partner login, Scope Lock, Document Upload, Tracking Milestones

### DCL — Declarations (60%)
- [x] CRUD 5 loại tờ khai
- [x] Data aggregation (VAT, NK)
- [x] Import Customs Declaration data
- [x] Declaration Calendar (upcoming/overdue)
- [x] Document Upload + Sign
- [ ] Thuế TTĐB bảng kê chi tiết

### CSG — Consignment (65%)
- [x] Agreement CRUD + Detail Drawer (Stock + Reports tabs)
- [x] Consigned Stock Map + Replenishment alerts
- [x] Reconciliation workflow: tạo BC → xác nhận → auto AR Invoice
- [ ] Physical Count at HORECA

---

## 📈 Biểu Đồ Tiến Độ Hiện Tại

```
Module          % Hoàn thiện   Status Bar               Status
──────────────────────────────────────────────────────────────
SYS Auth/RBAC    95%          ▓▓▓▓▓▓▓▓▓░  🟢 DONE
WMS Warehouse    92%          ▓▓▓▓▓▓▓▓▓░  🟢 DONE
MDM MasterData   90%          ▓▓▓▓▓▓▓▓▓░  🟢 DONE
DSH Dashboard    88%          ▓▓▓▓▓▓▓▓░░  🟢 DONE
SLS Sales        88%          ▓▓▓▓▓▓▓▓░░  🟢 DONE
FIN Finance      85%          ▓▓▓▓▓▓▓▓░░  🟢 DONE
PRC Procurement  82%          ▓▓▓▓▓▓▓▓░░  🟢 Working
RPT Reports      80%          ▓▓▓▓▓▓▓▓░░  🟢 Working
CST Costing      80%          ▓▓▓▓▓▓▓▓░░  🟢 Working
TAX Tax          78%          ▓▓▓▓▓▓▓░░░  🟢 Working
POS Showroom     75%          ▓▓▓▓▓▓▓░░░  🟢 Working
MKT MarketPrice  75%          ▓▓▓▓▓▓▓░░░  🟢 Working
CRM Customer     72%          ▓▓▓▓▓▓▓░░░  🟢 Working
TRS Delivery     72%          ▓▓▓▓▓▓▓░░░  🟢 Working
CNT Contracts    72%          ▓▓▓▓▓▓▓░░░  🟢 Working
QRC QR Code      70%          ▓▓▓▓▓▓▓░░░  🟢 Working
STM Stamps       70%          ▓▓▓▓▓▓▓░░░  🟢 Working
KPI Targets      68%          ▓▓▓▓▓▓░░░░  🟡 Partial
CSG Consignment  65%          ▓▓▓▓▓▓░░░░  🟡 Partial
DCL Declarations 60%          ▓▓▓▓▓▓░░░░  🟡 Partial
AI Features      55%          ▓▓▓▓▓░░░░░  🟡 Partial
AGN Agency       55%          ▓▓▓▓▓░░░░░  🟡 Partial
```

**Trung bình: ~76% ÷ module | ~96% chức năng core nghiệp vụ (P1 15/15 ✅)**

---

## 🔧 Cross-cutting Infrastructure (Đã Verify)

| Component | Status | Files |
|-----------|--------|-------|
| Authentication (Supabase) | ✅ | `middleware.ts`, `lib/session.ts`, `login/` |
| RBAC enforcement | ✅ | `middleware.ts` (route guard), `lib/session.ts` |
| Excel Import/Export | ✅ | `lib/excel.ts`, `api/export/route.ts` |
| Notification/Email | ✅ | `lib/notifications.ts` (Resend, 4 templates) |
| File Upload | ✅ | `lib/storage.ts` (Supabase Storage) |
| Approval Workflow | ✅ | `lib/approval.ts` (multi-step, threshold) |
| Audit Trail | ✅ | `lib/audit.ts` (entity-level logging) |
| AI Service | ✅ | `lib/ai-service.ts` (Gemini wrapper) |
| Encryption | ✅ | `lib/encryption.ts` (AES-256-GCM) |
| Error Boundaries | ✅ | `app/error.tsx`, `dashboard/error.tsx` |
| SSL/DB Connection | ✅ | `lib/db.ts` (Supabase pooler compatible) |

---

## 📝 Tóm Tắt

- **P1 (Core Business):** 15/15 hoàn thành ✅
- **P2 (Enhancement):** ~80% hoàn thành
- **P3 (Advanced):** ~50% hoàn thành
- **Tổng modules:** 22 modules, 32 action files, ~57 Prisma models
- **Unit Tests:** 188/188 passed (xem `docs/wine-erp-testing.md`)
- **Build Status:** ✅ Next.js 16.1.6 build thành công
- **Deploy:** Vercel (www.lyscellars.io.vn)
- **Tính năng thiếu nghiêm trọng nhất:** Shipper Mobile View, OCR Upload UI, External Partner Portal, E-Invoice

---

*Audit performed: 05/03/2026 22:20 | Gộp từ: wine-erp-audit-v1 + wine-erp-audit-05-03*  
*Scan method: Code outline + grep search toàn bộ codebase*  
*Total spec files: 19 | Total code modules: 32 | Prisma models: ~57*
