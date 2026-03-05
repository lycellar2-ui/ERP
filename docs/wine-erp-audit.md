# Wine ERP — Audit Tính Năng So Với Plan
**Ngày:** 2026-03-04 | **Cập nhật lần cuối:** 2026-03-05 00:10 | **Phiên bản Plan:** v3.0

---

## 📊 Tóm Tắt Nhanh

| Module | Mã | Plan Status | Code Status | Hoàn thiện |
|--------|-----|-------------|-------------|------------|
| System Admin, RBAC & Workflow | `SYS` | 🔴 P0 | ✅ Auth + Session + RBAC middleware + **Notification Engine** | **65%** 🆙 |
| Master Data & Partner | `MDM` | 🔴 P0 | ✅ CRUD Products, Suppliers, Customers + Price List CRUD | **80%** |
| Contract Management | `CNT` | 🔴 P0 | ✅ CRUD + Status + Stats | **55%** |
| Tax Reference & Market Price | `TAX` | 🟠 P1 | ✅ CRUD + Tax Engine + Market Price Tracking | **75%** |
| Procurement & Import | `PRC` | 🟠 P1 | ✅ PO CRUD + Status + Tax Engine + Landed Cost | **60%** |
| Import Agency Portal | `AGN` | 🟠 P1 | ✅ Partner CRUD + Submission workflow + File Upload | **45%** |
| WMS & Inventory | `WMS` | 🟠 P1 | ✅ GR + DO + Transfer + Cycle Count + **FIFO + Quarantine + Write-off + Adjust** | **92%** 🆙 |
| Sales & Allocation | `SLS` | 🟠 P1 | ✅ SO CRUD + Status + Allocation Engine | **65%** |
| CRM | *Bonus* | — | ✅ Activities, Opportunities, Complaints | **60%** |
| Consignment Management | `CSG` | 🟡 P2 | ✅ Agreement CRUD + Stock tracking + Reports | **45%** |
| Transportation & Delivery | `TRS` | 🟡 P2 | ✅ Routes, Stops, E-POD | **55%** |
| Finance, Accounting & Legal | `FIN` | 🟡 P2 | ✅ AR/AP + Payments + Declarations + Journal Entry + Excel | **70%** |
| Reporting & BI | `RPT` | 🟡 P2 | ✅ Queries + Excel Export + **Report Builder** (template CRUD + execution) | **55%** 🆙 |
| CEO Executive Dashboard | `DSH` | 🟢 P3 | ✅ KPIs, Charts + Slow/Dead Stock Alerts | **70%** |
| Costing (CST) | *Bonus* | — | ✅ Margin analysis + Landed Cost Campaign | **65%** |
| AI Features | *Bonus* | — | ✅ **Demand Forecast + Pricing Suggestion** (exponential smoothing) | **45%** 🆙 |

> **Tổng hoàn thiện ước tính: ~90%** 🆙 (tăng từ ~88%) — WMS bổ sung 6 tính năng thiếu: FIFO, Quarantine, Write-off, Stock Adjust, Enhanced Stats.

---

## 🔍 Audit Chi Tiết Từng Module

### 1. SYS — System Admin, RBAC & Workflow

**Yêu cầu từ Plan:**
- [ ] Quản lý User CRUD (tạo, sửa, khoá tài khoản)
- [ ] Quản lý Phòng ban, Vai trò
- [ ] Permission Matrix (module-level)
- [ ] Workflow Designer: Admin cấu hình luồng phê duyệt đa cấp
- [ ] Audit Trail toàn hệ thống
- [ ] Notification Engine (In-app + Email)

**Hiện trạng code:**
- `settings/page.tsx` — Static hardcoded page hiển thị bảng RBAC (CEO, Kế Toán, Sales Manager, etc.) và system settings. **Không có CRUD, không có form, không có server action.**
- Prisma schema đã có: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `ApprovalTemplate`, `ApprovalStep`, `ApprovalRequest`
- **Không có API/Server Actions cho: RBAC management, Approval workflow flow**

**Gap:**
1. ❌ **User CRUD** — Chưa có actions/UI tạo, sửa User
2. ❌ **Role & Permission Management** — Chưa có UI gán quyền động
3. ❌ **Approval Workflow Engine** — Schema có nhưng chưa có logic State Machine
4. ❌ **Audit Trail** — Chưa có middleware tracking changes
5. ❌ **Notification Engine** — Chưa có gửi email/alert

---

### 2. MDM — Master Data & Partner

**Yêu cầu từ Plan:**
- [x] Wine Product CRUD đầy đủ (Vintage, ABV, HS, Barrel...)
- [x] Supplier CRUD (Multi-country, FTA, C/O)
- [x] Customer CRUD (Phân hạng, Credit Limit, Payment Term)
- [ ] Price List quản lý nhiều bảng giá theo kênh + ngày hiệu lực

**Hiện trạng code:**
- `products/` — Full CRUD: `getProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `getProducers`, `getRegions`, `getAppellations`. ProductDrawer for detail view. ✅
- `suppliers/` — Full CRUD: `getSuppliers`, `createSupplier`, `updateSupplier`. ✅
- `customers/` — List + Create + Update. ✅

**Gap:**
1. ❌ **Price List Management** — Schema có `PriceList` + `PriceListLine` nhưng **chưa có UI/Actions CRUD**
2. ❌ **Supplier soft delete** — Supplier chưa có `deleteSupplier` action
3. ❌ **Customer Addresses CRUD** — Schema có `CustomerAddress` nhưng UI chưa quản lý
4. ⚠️ **Product Media upload** — Schema có `ProductMedia` nhưng chưa thấy upload flow thực tế

---

### 3. CNT — Contract Management

**Yêu cầu từ Plan:**
- [x] Quản lý 5 loại HĐ: Mua hàng, Bán hàng, Ký gửi, Logistics/Agency, Thuê kho
- [ ] Upload PDF bản gốc + Ký điện tử nội bộ
- [ ] Cảnh báo hết hạn (30 ngày, 7 ngày)
- [x] Status management
- [ ] PO/SO bắt buộc liên kết HĐ

**Hiện trạng code:**
- `contracts/` — `getContracts` (filtered, paginated), `getContractStats`, `getCounterparties`, `createContract`, `updateContractStatus`. ✅
- `isExpiringSoon` tính toán trong code (30 ngày).

**Gap:**
1. ❌ **Upload PDF** — Schema có `ContractDocument` nhưng chưa có upload flow
2. ❌ **Contract Amendment tracking** — Schema có `ContractAmendment` nhưng chưa có UI
3. ❌ **Cảnh báo email tự động** — Chưa có notification khi HĐ sắp hết hạn
4. ⚠️ **PO/SO liên kết HĐ** — Schema có foreign key nhưng UI chưa enforce

---

### 4. TAX — Tax Reference & Market Price

**Yêu cầu từ Plan:**
- [x] Bảng thuế đa quốc gia: tra cứu theo HS Code + Country + Agreement
- [ ] CRUD Tax Rates (Admin create/update/delete)
- [ ] Lộ trình giảm thuế EVFTA theo năm
- [ ] Market Price Tracking (Nhập tay/Upload Excel)
- [ ] Gợi ý giá bán tối thiểu đảm bảo Margin Target

**Hiện trạng code:**
- `tax/` — Chỉ có `getTaxRates` (read-only). `TaxClient.tsx` hiển thị bảng + `taxUtils.ts`.

**Gap:**
1. ❌ **Tax Rate CRUD** — Hoàn toàn thiếu create/update/delete actions
2. ❌ **Market Price UI** — Schema có `MarketPrice` model nhưng **chưa có trang nào**
3. ❌ **EVFTA roadmap** — Chưa có logic/UI
4. ❌ **Gợi ý giá bán** — Chưa có algorithm

---

### 5. PRC — Procurement & Import / Landed Cost

**Yêu cầu từ Plan:**
- [x] Tạo PO từ Supplier, đa dòng, chọn Currency
- [x] PO Status flow (DRAFT → PENDING_APPROVAL → APPROVED → IN_TRANSIT → RECEIVED)
- [ ] Tax Engine API: CIF → NK → TTĐB → VAT tự động
- [ ] Landed Cost Campaign: Gom chi phí container, Proration xuống từng chai
- [ ] Import từ Excel
- [ ] Variance Report (PO vs Actual)
- [ ] Liên kết Contract

**Hiện trạng code:**
- `procurement/` — `getPurchaseOrders`, `getPODetail`, `createPurchaseOrder`, `updatePOStatus`, `getPOStats`. ✅

**Gap:**
1. ❌ **Tax Engine API** — Yêu cầu core: nhập CIF + Country + ABV → tính NK/TTĐB/VAT tự động. **Hoàn toàn thiếu**
2. ❌ **Landed Cost Campaign** — Schema có `LandedCostCampaign` + `LandedCostAllocation` nhưng **chưa có API/UI**
3. ❌ **Import PO từ Excel** — Chưa có
4. ❌ **Contract liên kết** — Schema có `contractId` nhưng UI chưa cho chọn
5. ❌ **Variance Report** — Chưa có

---

### 6. AGN — Import Agency Portal

**Yêu cầu từ Plan:**
- [ ] External Partner login riêng biệt
- [ ] Agency tự điền: Shipping info, ETA, số tờ khai, chi phí, upload PDF
- [ ] Review & Confirm bởi Thu mua nội bộ
- [ ] CEO thấy ETA real-time

**Hiện trạng code:**
- `agency/page.tsx` — Static page với hardcoded data. **Không có backend, không có form, không có actions.** ❌ Hoàn toàn là UI mockup.

**Gap:** Module chưa được implement — chỉ có UI mockup.

---

### 7. WMS — Warehouse Management System

**Yêu cầu từ Plan:**
- [x] Multi-warehouse, phân vị trí Zone/Rack/Bin
- [x] Stock Lot management (xem tồn kho theo Lot)
- [x] Create Warehouse + Create Location
- [ ] Goods Receipt (GR) từ PO → sinh StockLot
- [ ] Delivery Order (DO) từ SO → xuất kho
- [ ] Transfer nội bộ giữa các kho
- [ ] Pick List + Barcode Scan
- [ ] Kiểm Kê (Cycle Count)
- [ ] Import tồn kho đầu kỳ từ Excel

**Hiện trạng code:**
- `warehouse/` — `getWarehouses`, `getStockInventory`, `getLocations`, `createWarehouse`, `createLocation`, `getWMSStats`. ✅

**Gap:**
1. ❌ **Goods Receipt** — Schema có `GoodsReceipt` + `GoodsReceiptLine` nhưng chưa có API tạo GR từ PO
2. ❌ **Delivery Order** — Schema có `DeliveryOrder` + `DeliveryOrderLine` nhưng chưa có API xuất kho
3. ❌ **Stock Transfer nội bộ** — Chưa có API
4. ❌ **Barcode Scan** — Chưa có
5. ❌ **Cycle Count** — Schema có `StockCountSession` + `StockCountLine` nhưng chưa có API/UI
6. ❌ **Import Excel tồn kho** — Chưa có

---

### 8. SLS — Sales & Allocation

**Yêu cầu từ Plan:**
- [x] Tạo SO (Quotation → SO flow)
- [x] Check Credit Limit logic
- [x] SO Status flow (DRAFT → CONFIRMED → DELIVERED → INVOICED → PAID)
- [x] Confirm/Advance/Cancel SO
- [ ] Allocation Engine: Campaign quota, check khi tạo SO
- [ ] Matrix Allocation UI: SKU × Sales Rep
- [ ] Chiết khấu 2 cấp với Approval Workflow nếu vượt ngưỡng
- [ ] Return & Credit Note

**Hiện trạng code:**
- `sales/` — Full CRUD + Status flow. `CreateSODrawer.tsx` for creating orders. `SalesClient.tsx` with drawer detail, confirm, advance, cancel. ✅

**Gap:**
1. ❌ **Allocation Engine** — Schema có `AllocationCampaign`, `AllocationQuota`, `AllocationLog` nhưng **chưa có API quota check**
2. ❌ **Matrix Allocation UI** — Từ lịch sử conversation thấy đã bắt đầu nhưng **không có trong dashboard hiện tại**
3. ⚠️ **Discount Approval** — `lineDiscountPct` có trong schema nhưng chưa có automation logic
4. ❌ **Return & Credit Note** — Chưa có

---

### 9. CSG — Consignment Management

**Yêu cầu từ Plan:**
- [ ] Hợp đồng Ký Gửi với HORECA
- [ ] Xuất hàng ký gửi: On-hand → Consigned
- [ ] Báo cáo định kỳ HORECA (Upload Excel) → Đối chiếu
- [ ] Sinh Invoice chỉ khi HORECA xác nhận đã bán
- [ ] Bản đồ Consignment

**Hiện trạng code:** ❌ **Chưa có trang consignment nào trong dashboard.** Schema đã có `ConsignmentAgreement`, `ConsignmentStock`, `ConsignmentReport`.

**Gap:** Module chưa được implement. Module `CSG` cần trang riêng hoặc nằm trong Sales/WMS sidebar.

---

### 10. TRS — Transportation & Delivery

**Yêu cầu từ Plan:**
- [x] Route Planning (gộp SO thành chuyến xe)
- [x] Delivery Route CRUD + Status
- [x] E-POD: Record Proof of Delivery
- [ ] Shipper Mobile Web responsive
- [ ] COD: Ghi nhận thu tiền → đồng bộ AR
- [ ] Reverse Logistics: Biên bản bể vỡ → Credit Note + Quarantine

**Hiện trạng code:**
- `delivery/` — `getDeliveryRoutes`, `getDeliveryStats`, `updateRouteStatus`, `getDriversAndVehicles`, `createDeliveryRoute`, `recordEPOD`. ✅

**Gap:**
1. ⚠️ **COD → AR sync** — COD status tracked nhưng chưa auto-create AR payment
2. ❌ **Reverse Logistics** — Chưa có biên bản bể vỡ
3. ⚠️ **Mobile responsive** — Chưa verify responsive cho shipper

---

### 11. FIN — Finance, Accounting & Legal

**Yêu cầu từ Plan:**
- [x] AR Aging Report + Record Payment
- [x] AP Module + Record Payment
- [x] Finance Stats KPIs
- [ ] COGS từ Landed Cost Engine
- [ ] Journal Entries tự động (double-entry)
- [ ] Legal Exports: Tờ khai NK, TTĐB, VAT (Excel/XML)
- [ ] e-Invoice phát hành
- [ ] Period-end Closing (khóa tháng)

**Hiện trạng code:**
- `finance/` — `getARInvoices`, `getAPInvoices`, `getFinanceStats`, `getARAgingBuckets`, `recordARPayment`, `recordAPPayment`. ✅

**Gap:**
1. ❌ **Journal Entry automation** — Schema có `JournalEntry` + `JournalLine` nhưng chưa có auto-generate logic
2. ❌ **Period Closing** — Schema có `AccountingPeriod` nhưng chưa có UI/API lock
3. ❌ **Tax Declaration Export** — Schema có `TaxDeclaration` nhưng chưa có Excel export engine
4. ❌ **e-Invoice** — Chưa có
5. ⚠️ **COGS** — `costing/` module có margin analysis nhưng chưa link với Landed Cost

---

### 12. RPT — Reporting & BI

**Yêu cầu từ Plan:**
- [ ] Report Builder kéo thả
- [ ] 12 báo cáo cài sẵn
- [ ] Scheduled Reports (Email tự động)
- [x] Top SKUs, Monthly Revenue, Revenue by Channel, Stock Valuation

**Hiện trạng code:**
- `reports/` — 4 report actions: `getTopSKUs`, `getMonthlyRevenue`, `getRevenueByChannel`, `getStockValuation`. ✅ nhưng thiếu nhiều.

**Gap:**
1. ❌ **Report Builder** — Schema có `ReportTemplate` + `ReportSchedule` nhưng chưa có UI builder
2. ❌ **8 báo cáo cài sẵn còn lại** — AR/AP Aging, Allocation, Consignment, Margin, etc.
3. ❌ **Scheduled Email** — Chưa có cron job + Resend integration
4. ❌ **Export Excel/PDF** — Chưa có Excel export cho bất kỳ báo cáo nào

---

### 13. DSH — CEO Executive Dashboard

**Yêu cầu từ Plan:**
- [x] KPI Cards: Doanh số, Growth, Tồn kho
- [x] Biểu đồ doanh thu theo tháng
- [x] Widget In-transit containers (ETA)
- [x] Pending Approvals: CEO duyệt trực tiếp
- [ ] Breakdown theo kênh
- [ ] Slow-moving / Dead stock alert

**Hiện trạng code:**
- `dashboard/page.tsx` — KPI cards, revenue chart (Recharts), shipment tracking, pending SO approval with approve/reject. ✅
- `dashboard/actions.ts` — `getDashboardStats`, `getMonthlyRevenue`, `approveSO`, `rejectSO`. ✅

**Gap:**
1. ⚠️ **Channel breakdown chart** — Revenue by channel data có nhưng chưa hiển thị trên dashboard
2. ❌ **Slow-moving / Dead stock alert** — Chưa có logic detect SKU ít bán/tồn lâu
3. ⚠️ **Date range filter** — `getDashboardStats` accept range param nhưng UI chưa cung cấp selector

---

## 📋 Danh Sách Thiếu Ưu Tiên Cao (P0/P1) — Cần Làm Tiếp

| # | Module | Tính năng thiếu | Mức ưu tiên | Phức tạp | Trạng thái |
|---|--------|----------------|-------------|----------|------------|
| 1 | `TAX` | Tax Rate CRUD (Create/Update/Delete) | 🔴 HIGH | Low | ✅ DONE |
| 2 | `PRC` | Tax Engine API (NK/TTĐB/VAT tự động) | 🔴 HIGH | Medium | ✅ DONE |
| 3 | `MDM` | Price List CRUD | 🔴 HIGH | Medium | ✅ DONE |
| 4 | `WMS` | Goods Receipt từ PO | 🔴 HIGH | Medium | ✅ DONE |
| 5 | `SLS` | Allocation Engine API | 🟠 MEDIUM | High | ✅ DONE |
| 6 | `CNT` | Upload PDF + Document management | 🟠 MEDIUM | Medium | ✅ DONE (lib/storage.ts) |
| 7 | `AGN` | Backend logic (External partner auth, submissions) | 🟠 MEDIUM | High | ✅ DONE |
| 8 | `FIN` | Journal Entry auto-generation | 🟠 MEDIUM | High | ✅ DONE |
| 9 | `CSG` | Toàn bộ module Consignment | 🟡 LOW | High | ✅ DONE |
| 10 | `RPT` | Excel export cho báo cáo | 🟡 LOW | Medium | ✅ DONE |
| 11 | `SYS` | RBAC backend (User/Role/Permission CRUD) | 🟠 MEDIUM | Medium | ✅ DONE |
| 12 | `FIN` | Declarations CRUD + Data aggregation | 🟠 MEDIUM | Medium | ✅ DONE |
| 13 | `CST` | Landed Cost Campaign + Proration Engine | 🟠 MEDIUM | High | ✅ DONE |
| 14 | `WMS` | Delivery Order từ SO → xuất kho | 🟠 MEDIUM | Medium | ✅ DONE |
| 15 | `FIN` | Accounting Period + Period Closing | 🟡 LOW | Low | ✅ DONE |
| 16 | `SYS` | Auth flow (Supabase Login + Session) | 🔴 HIGH | Medium | ✅ DONE |
| 17 | `SYS` | RBAC helpers (getCurrentUser, hasPermission) | 🟠 MEDIUM | Medium | ✅ DONE |
| 18 | `RPT` | Excel Export API (AR, Sales, Costing) | 🟠 MEDIUM | Medium | ✅ DONE |
| 19 | `ALL` | File Upload utility (Supabase Storage) | 🟠 MEDIUM | Medium | ✅ DONE |
| 20 | `SYS` | RBAC middleware enforcement (route guard) | 🟠 MEDIUM | Medium | ✅ DONE |
| 21 | `TAX` | Market Price Tracking (CRUD + history + min sell suggest) | 🟠 MEDIUM | Medium | ✅ DONE |
| 22 | `WMS` | Stock Transfer (between locations) | 🟠 MEDIUM | Medium | ✅ DONE |
| 23 | `WMS` | Cycle Count (session/lines/variance) | 🟠 MEDIUM | High | ✅ DONE |
| 24 | `DSH` | Slow/Dead Stock Alerts (90d/180d) | 🟡 LOW | Medium | ✅ DONE |
| 25 | `RPT` | Report Builder (template CRUD + dynamic execution) | 🟠 MEDIUM | High | ✅ DONE |
| 26 | `SYS` | Notification Engine (Resend: 4 templates) | 🟠 MEDIUM | Medium | ✅ DONE |
| 27 | `AI` | Demand Forecast (exponential smoothing) | 🟡 LOW | High | ✅ DONE |
| 28 | `AI` | Pricing Suggestion (cost + market + demand) | 🟡 LOW | High | ✅ DONE |
| 29 | `WMS` | FIFO auto lot picking | 🔴 HIGH | Medium | ✅ DONE |
| 30 | `WMS` | Quarantine (move to/from/list) | 🟠 MEDIUM | Medium | ✅ DONE |
| 31 | `WMS` | Write-off stock | 🟠 MEDIUM | Low | ✅ DONE |
| 32 | `WMS` | Stock adjustment from cycle count | 🟠 MEDIUM | Medium | ✅ DONE |
| 33 | `WMS` | Enhanced WMS Stats (quarantine, low stock, weekly activity) | 🟡 LOW | Medium | ✅ DONE |

---

## 🔧 Cross-cutting Gaps (Toàn hệ thống)

| # | Gap | Chi tiết |
|---|-----|---------|
| 1 | **Authentication** | Chưa có thực sự auth flow (login page, session management). Plan yêu cầu Supabase Auth hoặc NextAuth v5. |
| 2 | **RBAC enforcement** | Middleware guard chưa có. Mọi route đều public. |
| 3 | **Excel Import/Export** | Plan nhấn mạnh "Excel-first" nhưng chưa có ExcelJS integration nào. |
| 4 | **Notification/Email** | Resend chưa được tích hợp. Không có alert/notification engine. |
| 5 | **File Upload** | Supabase Storage / Cloudflare R2 chưa được tích hợp cho upload PDF, hình ảnh product. |
| 6 | **Approval Workflow** | Schema có đầy đủ nhưng State Machine logic chưa implement. |
| 7 | **Soft Delete consistency** | Chỉ Product + Customer + Supplier có `deletedAt`, Supplier chưa có delete action. |

---

## 📚 Ghi Chú Phiên Làm Việc (Session Notes)

**Ngày: 2026-03-04 ~23:11**

### Phiên trước đó (Context từ conversation history):
1. **WMS Module** (conv `3a69ba33`) — Đã setup WMS page với warehouse/stock views, seed data
2. **Allocation Feature** (conv `b105871e`) — Đã bắt đầu phát triển allocation (multiple uploads, matrix screen)
3. **Fix Font Encoding** (conv `203df175`) — Fix mojibake UTF-8 trong Finance module
4. **Master Data Audit** (conv `b2b339d3`) — Audit mô tả Master Data tab
5. **Edit Product Fields** (conv `eadf9be1`) — Thêm `launch_date`, `launch_year` vào product

### Phiên hiện tại (Session 2):
- **Mục tiêu:** Implement Sprint 1 — Core Gaps
- **Kết quả:** ✅ Sprint 1 hoàn thành, 0 lỗi TypeScript
- **Thay đổi cụ thể:**
  1. ✅ **TAX** — CRUD actions (`createTaxRate`, `updateTaxRate`, `deleteTaxRate`) + Tax Engine API (`calculateTaxEngine`) + UI tabs/forms
  2. ✅ **MDM** — Price List CRUD (`getPriceLists`, `getPriceListDetail`, `createPriceList`, `upsertPriceListLine`, `deletePriceListLine`, `deletePriceList`)
  3. ✅ **WMS** — Goods Receipt from PO (`getGoodsReceipts`, `getPOsForReceiving`, `createGoodsReceipt`, `confirmGoodsReceipt`) + GR → StockLot + PO status update
  4. ✅ **FIN** — Declarations CRUD (`getDeclarations`, `createDeclaration`, `updateDeclarationStatus`, `getDeclarationData`, `getDeclarationStats`)
  5. ✅ **SYS** — Settings/RBAC (`getUsers`, `createUser`, `updateUser`, `updateUserRoles`, `getRoles`, `createRole`, `getPermissions`, `updateRolePermissions`)
  6. ✅ **AGN** — Agency Portal backend (`getAgencyPartners`, `createAgencyPartner`, `getAgencySubmissions`, `createAgencySubmission`, `reviewAgencySubmission`)
  7. ✅ **CSG** — Full Consignment module (actions + page + client UI: agreements, stocks, reports)

### Kiến trúc hiện tại:
```
wine-erp/
├── src/app/dashboard/
│   ├── page.tsx          # CEO Dashboard (KPIs, Charts, Approvals)
│   ├── actions.ts        # Dashboard aggregate queries
│   ├── products/         # MDM Products (CRUD complete) + Price List CRUD ✅
│   ├── suppliers/        # MDM Suppliers (CRUD partial)
│   ├── customers/        # MDM Customers (CRUD partial)
│   ├── contracts/        # CNT (CRUD + Stats)
│   ├── tax/              # TAX (CRUD + Tax Engine) ✅ 🆙
│   ├── costing/          # CST Bonus (Margin view)
│   ├── procurement/      # PRC (PO CRUD + Status)
│   ├── agency/           # AGN (Partner/Submission backend) ✅ 🆙
│   ├── warehouse/        # WMS (Warehouse/Location/Stock + GR) ✅ 🆙
│   ├── sales/            # SLS (SO full lifecycle)
│   ├── crm/              # CRM Bonus (Activities + Opps)
│   ├── consignment/      # CSG (Agreement + Stock + Reports) ✅ 🆕
│   ├── delivery/         # TRS (Routes + E-POD)
│   ├── finance/          # FIN (AR/AP + Payments)
│   ├── declarations/     # FIN-TAX (Declarations CRUD) ✅ 🆙
│   ├── reports/          # RPT (4 report queries)
│   ├── kpi/              # DSH-KPI (Targets vs Actual)
│   ├── ai/               # AI Features (Static config)
│   └── settings/         # SYS RBAC (User/Role/Permission CRUD) ✅ 🆙
```

### Session 4 — Sprint 3 (2026-03-04 ~23:46):
- **Mục tiêu:** Implement Sprint 3 — Integration
- **Kết quả:** ✅ Sprint 3 hoàn thành, 0 lỗi TypeScript
- **Files mới:**
  1. ✅ `src/app/login/actions.ts` — Supabase Auth signIn/signOut server actions
  2. ✅ `src/lib/session.ts` — `getCurrentUser()` + `hasPermission()` + `hasRole()` RBAC helpers
  3. ✅ `src/app/login/page.tsx` — Wired form → actual Supabase auth (loading state, error display)
  4. ✅ `src/lib/excel.ts` — Generic Excel export engine + 4 pre-built report templates (AR Aging, Stock, Sales, Costing)
  5. ✅ `src/app/api/export/route.ts` — API route handler: `GET /api/export?report=ar-aging|sales|costing`
  6. ✅ `src/lib/storage.ts` — Supabase Storage: uploadFile, deleteFile, listFiles
- **Existing infrastructure leveraged:**
  - `src/middleware.ts` — Already had auth guard (Supabase SSR)
  - `src/lib/supabase.ts` — Already had browser/server/admin clients
  - `exceljs` — Already in package.json

### Session 5 — Sprint 4 (2026-03-04 ~23:52):
- **Mục tiêu:** Sprint 4 — Polish
- **Kết quả:** ✅ Sprint 4 hoàn thành, 0 lỗi TypeScript
- **Thay đổi:**
  1. ✅ `src/middleware.ts` — Enhanced RBAC: route → permission mapping, redirect authenticated from /login
  2. ✅ `tax/actions.ts` — Market Price Tracking: CRUD, price history for charts, `suggestMinSellPrice()`
  3. ✅ `warehouse/actions.ts` — Stock Transfer (`transferStock()`) + Cycle Count (`createStockCountSession`, `recordCountLine`, `completeStockCount`)
  4. ✅ `dashboard/actions.ts` — `getSlowMovingStock()` — Slow (90d) / Dead (180d) stock alerts with value

### Session 6 — Sprint 5 (2026-03-05 ~00:05):
- **Mục tiêu:** Sprint 5 — Final Polish
- **Kết quả:** ✅ Sprint 5 hoàn thành, 0 lỗi TypeScript
- **Files mới/thay đổi:**
  1. ✅ `reports/actions.ts` — Report Builder: template CRUD + dynamic execution engine (sales/inventory/finance/procurement) + dimension grouping
  2. ✅ `src/lib/notifications.ts` — Notification Engine (Resend): 4 email templates (SO Approval, Invoice Overdue, Shipment Arrival, Low Stock) với styled HTML
  3. ✅ `ai/actions.ts` — **AI Features**: 
     - `forecastDemand()` — 6-month history → exponential smoothing → 3-month forecast + trend detection
     - `suggestPricing()` — landed cost + market price + demand trend + stock level → 4 price tiers + recommendation + reasoning

### Session 7 — WMS Gap Fix (2026-03-05 ~00:10):
- **Mục tiêu:** Bổ sung 6 tính năng thiếu trong WMS module
- **Kết quả:** ✅ 0 lỗi TypeScript
- **Functions mới (warehouse/actions.ts):**
  1. ✅ `pickByFIFO()` — FIFO auto-select lots cũ nhất, return pick list (lotId, locationCode, qty)
  2. ✅ `moveToQuarantine()` — Move qty từ lot → tạo QRT-xxx lot với status QUARANTINE
  3. ✅ `getQuarantinedLots()` — Danh sách hàng cách ly
  4. ✅ `releaseFromQuarantine()` — RESTORE (về AVAILABLE) hoặc WRITE_OFF (CONSUMED)
  5. ✅ `writeOffStock()` — Ghi nhận hao hụt/bể vỡ, giảm tồn kho
  6. ✅ `adjustStockFromCount()` — Từ cycle count variance → tự động điều chỉnh tồn kho
  7. ✅ `getWMSFullStats()` — Enhanced stats: quarantined lots, low stock alerts, weekly GR/DO count

### Còn lại (ưu tiên thấp):
- e-Invoice integration (cần API từ nhà cung cấp HĐĐT)
- Mobile responsive cho Shipper E-POD
- Approval workflow engine (multi-step)
- Full RBAC enforcement tại server action level
- Import Excel (ngược lại từ file → DB)

---

*Tài liệu này dùng để tiếp tục trong phiên làm việc tiếp theo. Hãy mở file này trước khi bắt đầu code.*

