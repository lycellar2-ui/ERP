# Wine ERP — Master Plan Tổng Thể
**Phiên Bản:** v3.1 (Full Suite + QR Traceability) | **Ngày:** 2026-03-05

---

## 1. Tổng Quan & Nguyên Tắc Kiến Trúc

| Tiêu chí | Nội dung |
|---|---|
| **Tên dự án** | Wine ERP — Hệ thống Quản trị Doanh nghiệp Nhập khẩu Rượu Vang |
| **Loại** | WEB App (Desktop-first, Shipper & Kho dùng Responsive Mobile) |
| **Người dùng** | Nội bộ (CEO, Kế toán, Kho, Thu mua, Sales, Shipper, IT Admin) + External (Agency Hải quan/Logistics) |
| **Phạm vi** | Full ERP Suite (13 Module cốt lõi) |
| **Xuất dữ liệu** | Excel-first (Công ty đang dùng Excel) — Mọi báo cáo đều xuất được Excel/CSV |
| **Tuân thủ PL** | Thuế NK (EVFTA/MFN/AANZFTA...), Thuế TTĐB 35%/65%, VAT 10%, Tờ khai Hải quan |

### 🏗️ Nguyên Tắc Kiến Trúc Module (Modular-First)
> **Đây là nguyên tắc xuyên suốt toàn dự án.** Mỗi phân hệ là 1 module độc lập, có thể:
> - **Bật/Tắt**: Admin có thể vô hiệu hóa module chưa cần dùng
> - **Deploy riêng lẻ**: Có thể go-live từng module mà không ảnh hưởng module khác
> - **Mở rộng**: Thêm module mới chỉ cần plug-in vào core, không phá vỡ hệ thống hiện tại
> - **Phân quyền theo module**: RBAC kiểm soát User thấy module nào

**Kiến trúc kỹ thuật đảm bảo điều này:**
- Mỗi module = Một nhóm route riêng trong Next.js (`/app/(modules)/[module-name]/`)
- Mỗi module = Một nhóm bảng DB riêng (có schema prefix rõ ràng)
- Core hệ thống (`SYS`) chỉ cung cấp: Auth, RBAC, Notification, Audit Trail
- Modules giao tiếp với nhau qua well-defined API contracts / shared data models

---

## 2. Danh Sách 13 Phân Hệ

| # | Phân hệ | Mã | Người dùng | Ưu tiên | Tài liệu |
|---|---|---|---|---|---|
| 1 | **System Admin, RBAC & Workflow** | `SYS` | IT Admin, CEO | 🔴 P0 | `admin-auth-workflow.md` |
| 2 | **Master Data & Partner** | `MDM` | Admin, Thu mua, Sales | 🔴 P0 | *(cần tạo)* |
| 3 | **Contract Management** | `CNT` | Thu mua, Kế toán, CEO | 🔴 P0 | `contract-management.md` |
| 4 | **Tax Reference & Market Price** | `TAX` | Thu mua, Kế toán, Sales | 🟠 P1 | `market-price-tax-lookup.md` |
| 5 | **Procurement & Import** | `PRC` | Thu mua, Kế toán | 🟠 P1 | `tax-and-landed-cost.md` |
| 6 | **Import Agency Portal** | `AGN` | Agency Hải quan (External) | 🟠 P1 | `import-agency-portal.md` |
| 7 | **WMS & Inventory** | `WMS` | Thủ kho | 🟠 P1 | *(cần tạo)* |
| 8 | **Sales & Allocation** | `SLS` | Sales | 🟠 P1 | *(cần tạo)* |
| 9 | **Consignment Management** | `CSG` | Sales, Kế toán | 🟡 P2 | `consignment.md` |
| 10 | **Transportation & Delivery** | `TRS` | Điều phối, Shipper | 🟡 P2 | `transport-delivery.md` |
| 11 | **Finance, Accounting & Legal** | `FIN` | Kế toán | 🟡 P2 | `finance-accounting.md` |
| 12 | **Reporting & BI** | `RPT` | Tất cả | 🟡 P2 | *(cần tạo)* |
| 13 | **CEO Executive Dashboard** | `DSH` | CEO | 🟢 P3 | `ceo-dashboard.md` |

---

## 3. Phân Tích Tóm Tắt Từng Module

### 🔴 SYS — System Admin, RBAC & Approval Workflow
- Quản lý User, Phòng ban, Vai trò, Permission Matrix
- **Workflow Designer:** Admin tự cấu hình luồng phê duyệt đa cấp (Không cần code)
- Chứng từ hỗ trợ phê duyệt: PO, SO, Chiết khấu lớn, Write-off kho, Tờ khai thuế
- Audit Trail toàn hệ thống + Notification Engine (In-app + Email)

### 🔴 MDM — Master Data & Partner Management
- **Hàng hóa:** Vintage, Appellation, Grape, ABV (→ tự động chọn thuế TTĐB), HS Code, Barcode, Nhiệt độ bảo quản, OWC/Carton format
- **Supplier:** Multi-country, Payment Term, Currency, Hiệp định FTA áp dụng, C/O Form
- **Customer:** Phân hạng kênh (HORECA/Đại lý/VIP), Credit Limit, Payment Term đa point giao hàng
- **Price List:** Nhiều bảng giá theo kênh + Ngày hiệu lực

### 🔴 CNT — Contract Management
- Quản lý 5 loại HĐ: Mua hàng, Bán hàng, Ký gửi, Logistics/Agency, Thuê kho
- Upload PDF bản gốc + Ký điện tử nội bộ
- Cảnh báo hết hạn (30 ngày, 7 ngày)
- PO/SO bắt buộc liên kết HĐ, theo dõi Giá trị thực hiện vs Hợp đồng

### 🟠 TAX — Tax Reference & Market Price
- **Bảng Thuế Đa Quốc Gia:** EVFTA (EU), AANZFTA (Úc/NZ), VCFTA (Chile), MFN (Mỹ/Argentina...)
- Tra cứu nhanh: Nhập Quốc gia + HS Code → trả về thuế suất NK + C/O Form cần thiết
- Lộ trình giảm thuế EVFTA theo năm (Effective Date)
- **Market Price Tracking:** Nhập tay / Upload Excel giá thị trường, so sánh vs Giá Vốn + Giá Bán
- Gợi ý giá bán tối thiểu để đảm bảo Margin Target

### 🟠 PRC — Procurement & Import / Landed Cost Engine
- Tạo PO từ Supplier, liên kết HĐ, tính tiền Ngoại tệ
- **Tax Engine tự động:** CIF → NK → TTĐB (35%/65% theo ABV từ MDM) → VAT
- **Landed Cost Campaign:** Gom tất cả chi phí phát sinh của 1 container/lô
- Proration xuống từng chai → Giá Nhập Kho chính xác
- Import từ Excel (Công ty đang dùng Excel): Upload bảng PO từ Excel vào hệ thống
- Giao diện So sánh PO vs Actual (Variance Report)

### 🟠 AGN — Import Agency Portal *(External Partner)*
- Tài khoản `EXTERNAL_PARTNER` riêng biệt, chỉ thấy lô hàng được assign
- Agency tự điền: Shipping info, ETА, số tờ khai, chi phí hải quan, upload PDF
- Quy trình Review & Confirm bởi Thu mua nội bộ trước khi số liệu vào PRC
- CEO thấy ETA real-time trên Dashboard ngay khi Agency cập nhật
- Thay thế hoàn toàn email/Zalo qua lại với Agency

### 🟠 WMS — Warehouse Management System
- Multi-warehouse (Nhiều kho), phân vị trí Zone/Rack
- Quản lý Lô (Batch Lot): Gắn với Shipment, Traceability từ nguồn về đến khách
- FIFO bắt buộc (Xoay Vintage đúng cách)
- Nhập Kho (GR từ PO), Xuất Kho (DO từ SO), Transfer nội bộ
- Pick List + Barcode Scan (Responsive cho Tablet kho)
- Kiểm Kê (Cycle Count) + Hàng Lỗi/Quarantine
- Import tồn kho đầu kỳ từ Excel (Migration từ Excel sang ERP)

### 🟠 SLS — Sales & Allocation
- Quotation → SO → DO → Invoice
- Check Credit Limit, Check Tồn kho real-time khi tạo SO
- **Allocation Engine:** Campaign theo Vintage/SKU, Quota per Sales Rep/Customer/Channel
- Matrix Allocation: SKU × Sales Rep, xem Allocated/Sold/Remaining
- Chiết khấu 2 cấp (dòng + tổng đơn) với Approval Workflow nếu vượt ngưỡng
- Return & Credit Note

### 🟡 CSG — Consignment Management
- Hợp đồng Ký Gửi với HORECA (Period, Điều khoản thu hồi)
- Xuất hàng ký gửi: On-hand → Consigned (Không giảm tồn kho thực)
- Báo cáo định kỳ HORECA (Upload Excel) → Tự đối chiếu (Reconciliation)
- Sinh Invoice + AR chỉ khi HORECA xác nhận đã bán
- Bản đồ Consignment: Điểm nào đang giữ hàng, bao nhiêu

### 🟡 TRS — Transportation & Delivery (E-POD)
- Route Planning (Gộp SO thành chuyến xe, tính tải CBM/kg)
- Shipper Mobile Web: Manifest, bản đồ, touch-to-call
- E-POD: Chữ ký điện tử + Chụp ảnh
- COD: Ghi nhận thu tiền → đồng bộ AR ngay lập tức
- Reverse Logistics: Biên bản bể vỡ → Credit Note + Quarantine WMS

### 🟡 FIN — Finance, Accounting & Legal
- AR/AP Aging, đối soát ngân hàng
- COGS thực từ Landed Cost Engine
- **Legal Exports (Excel/XML):** Tờ khai Thuế NK, Tờ khai TTĐB, Bảng kê VAT
- e-Invoice phát hành cho khách hàng
- Period-end Closing (Khóa tháng, chống back-date)
- Double-entry Journal Entries tự động

### 🟡 RPT — Reporting & BI
- Report Builder kéo thả cho người không biết IT
- Báo cáo cài sẵn: Tồn kho, Doanh số, Margin, AR/AP Aging, Allocation, Consignment
- Scheduled Reports: Email tự động 8h thứ 2 hàng tuần
- Export Excel/PDF (Tất cả báo cáo)

### 🟢 DSH — CEO Executive Dashboard
- KPI Cards: Doanh số MTD/YTD, Margin, Đơn chờ duyệt
- Biểu đồ xu hướng, breakdown kênh
- Widget In-transit containers (ETA từ AGN)
- Slow-moving / Dead stock alert
- Pending Approvals: CEO duyệt thẳng từ Dashboard

---

## 4. Tech Stack Đầy Đủ & Lý Do Chọn

| Layer | Technology | Lý do |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Module routing tự nhiên, Server Actions nhanh |
| **UI** | Shadcn UI + TailwindCSS | Đẹp, linh hoạt, không vendor lock-in |
| **Charts** | Recharts / ECharts | Phong phú cho CEO Dashboard & RPT |
| **Type Safety** | TypeScript end-to-end | Giảm bug nghiệp vụ tài chính |
| **Forms** | React Hook Form + Zod | Validation an toàn, type-safe |
| **Tables** | Tanstack Table v8 | Bảng lớn: Inventory, Allocation Matrix |
| **ORM** | Prisma + PostgreSQL | Migration an toàn, query type-safe |
| **Database** | **Supabase PostgreSQL** | Managed DB, built-in Dashboard, RLS |
| **Auth** | **Supabase Auth** + `@supabase/ssr` | JWT, Session, Email login, External Partner |
| **File Storage** | **Supabase Storage** | Ảnh sản phẩm (CDN), PDF HĐ/tờ khai (Private) |
| **Realtime** | **Supabase Realtime** | Live KPI Dashboard, Approval notifications |
| **Email** | Resend | Approval notification, báo cáo scheduled |
| **Excel** | ExcelJS | Parse & xuất Excel (import/export toàn hệ thống) |
| **Source Control** | **GitHub** | Version control, PR workflow |
| **Deploy** | **Vercel** (kết nối GitHub) | Auto-deploy khi merge to main, Preview URLs |

---

## 5. Task Breakdown Đầy Đủ (INPUT → OUTPUT → VERIFY)

### GIAI ĐOẠN 1: Foundation + Core Modules (P0)
*Mục tiêu: Hệ thống đã dùng được cho nghiệp vụ cơ bản nhất*

| ID | Task | Agent | INPUT | OUTPUT | VERIFY |
|---|---|---|---|---|---|
| 1.1 | Database Schema toàn hệ thống | `database-architect` | 13 module docs | `schema.prisma` với đầy đủ domain | `npx prisma validate` pass |
| 1.2 | Authentication + Session | `backend-specialist` | Schema User/Session | NextAuth v5, JWT, Middleware route guard | Đăng nhập → Redirect đúng role |
| 1.3 | RBAC Admin UI | `frontend-specialist` | User/Role/Permission schema | Màn hình quản lý tổ chức, gán quyền | NV Kho không thấy màn Giá vốn |
| 1.4 | Workflow Designer (Approval) | `backend-specialist` | ApprovalTemplate schema | API State Machine duyệt đa cấp | PO tạo → Tự sinh luồng chờ duyệt |
| 1.5 | Notification Engine | `backend-specialist` | WorkflowStep + Email config | Gửi alert khi đến lượt duyệt | Nhận email nhắc trong 5 phút |
| 1.6 | MDM — Wine Product CRUD | `frontend-specialist` | Product schema | Form đầy đủ trường đặc thù rượu vang | Lưu SKU với ABV, HS Code, Vintage |
| 1.7 | MDM — Supplier CRUD | `frontend-specialist` | Supplier schema | Form NCC đa quốc gia, FTA field | Tạo NCC với Currency, Payment Term |
| 1.8 | MDM — Customer CRUD | `frontend-specialist` | Customer schema | Form KH với Credit Limit, phân hạng | Tạo KH, gán Credit Limit 200M |
| 1.9 | TAX — Bảng Thuế Suất | `backend-specialist` | Tax Rate DB design | CRUD Admin + API Tra cứu thuế | Nhập FR + HS2204 → trả thuế EVFTA đúng |
| 1.10 | CNT — Contract CRUD | `frontend-specialist` | Contract schema | Form HĐ mua/bán, upload PDF | Tạo HĐ, liên kết Supplier, cảnh báo hạn |
| 1.11 | Excel Import Utility | `backend-specialist` | ExcelJS setup | Parser Excel → validate → insert DB | Upload file tồn kho đầu kỳ thành công |

### GIAI ĐOẠN 2: Procurement + WMS (Chuỗi cung ứng vào)

| ID | Task | Agent | INPUT | OUTPUT | VERIFY |
|---|---|---|---|---|---|
| 2.1 | PRC — Purchase Order | `frontend-specialist` | Supplier, Product, Contract | Form tạo PO đa dòng, chọn Currency | PO DRAFT → send Approval Workflow |
| 2.2 | PRC — Tax Engine API | `backend-specialist` | ABV sản phẩm, CIF, Country | API tính NK/TTĐB/VAT tự động | Test: Bordeaux 13.5° CIF 100$ → đúng số |
| 2.3 | PRC — Landed Cost | `backend-specialist` | Shipment + Chi phí phụ | API Proration xuống từng chai | Tổng phân bổ = Tổng chi phí container |
| 2.4 | AGN — Agency Portal | `frontend-specialist` | ExternalPartner + Shipment | Cổng web External: điền shipping info, upload tờ khai | Agency điền ETA → Thu mua thấy TBC alert |
| 2.5 | AGN — Review & Confirm | `backend-specialist` | AgencySubmission | API confirm → apply vào PRC | Confirm xong → Shipment ETA cập nhật |
| 2.6 | WMS — Goods Receipt | `frontend-specialist` | PO Approved | Nhập kho từ PO, sinh StockLot + Batch | Tồn kho tăng đúng, gắn đúng Batch/Lô |
| 2.7 | WMS — Kho & Vị Trí | `frontend-specialist` | StockQuant, Location | Dashboard kho: tìm hàng theo Vintage, Kho | Tìm được Lot Château Pérus 2019 trong kho |
| 2.8 | WMS — Barcode Scan | `frontend-specialist` | Camera API | Quét mã → xác nhận nhặt hàng | Quét đúng thùng đúng vị trí |
| 2.9 | WMS — Cycle Count | `frontend-specialist` | StockLot | Form kiểm kê, nhập SL thực tế, sinh Variance | Variance được duyệt bởi Quản lý Kho |

### GIAI ĐOẠN 3: Sales + Consignment + Delivery (Chuỗi cung ứng ra)

| ID | Task | Agent | INPUT | OUTPUT | VERIFY |
|---|---|---|---|---|---|
| 3.1 | SLS — Sales Order | `frontend-specialist` | Customer, Product, Stock | Form SO, check Credit Limit + Tồn kho live | SO reject nếu KH vượt Credit Limit |
| 3.2 | SLS — Allocation Engine | `backend-specialist` | AllocationCampaign schema | API quota check khi tạo SO | SO vượt quota Grand Cru → reject tự động |
| 3.3 | SLS — Allocation Matrix UI | `frontend-specialist` | AllocationCampaign data | Ma trận SKU × Sales Rep | ✅ DONE |
| 3.4 | TAX — Market Price UI | `frontend-specialist` | MarketPriceHistory | Màn so sánh Giá TT vs Giá Vốn vs Giá Bán | ✅ DONE |
| 3.5 | CSG — Consignment Module | `frontend-specialist` | ConsignmentAgreement | Form ký gửi, xuất hàng → Consigned stock | ✅ DONE (Dynamic UI) |
| 3.6 | CSG — Reconciliation | `backend-specialist` | ConsignmentReport (Excel upload) | API đối chiếu, sinh Invoice khi xác nhận | ✅ DONE |
| 3.7 | TRS — Route Planning | `frontend-specialist` | SalesOrder list | Gộp SO thành chuyến, tính tải CBM | ✅ DONE (E-POD) |
| 3.8 | TRS — Shipper Mobile | `frontend-specialist` | DeliveryRoute | Responsive mobile: manifest, map, sign | ✅ DONE (E-POD) |
| 3.9 | TRS — E-POD + COD | `backend-specialist` | DeliveryStop | Canvas ký + Camera + COD Record | ✅ DONE |
| 3.10 | SLS — Return Orders | `backend-specialist` | SO + Products | Return workflow + Auto Credit Note | ✅ DONE |
| 3.11 | WMS — Inter-Warehouse Transfer | `backend-specialist` | Warehouse × Products | 4-step workflow (DRAFT→CONFIRMED→IN_TRANSIT→RECEIVED) | ✅ DONE |
| 3.12 | WMS — Stock Count / Cycle Count | `frontend-specialist` | StockLot × Location | Session → Lines → Input qty → Complete → Adjust | ✅ DONE |
| 3.13 | SLS — CRM Transaction History | `backend-specialist` | Customer × SO × Invoice | 360° view: Orders, Invoices, Top SKUs | ✅ DONE |
| 3.14 | CNT — Contract Utilization | `backend-specialist` | Contract × PO × SO | PO/SO value vs Contract value, progress bar | ✅ DONE |
| 3.15 | STM — Stamp ↔ Shipment/Lot Linking | `backend-specialist` | WineStamp × Shipment × StockLot | Safe usage recording + linking options | ✅ DONE |

### GIAI ĐOẠN 4: Finance, Accounting & Legal

| ID | Task | Agent | INPUT | OUTPUT | VERIFY |
|---|---|---|---|---|---|
| 4.1 | FIN — AR Module | `frontend-specialist` | SO + Payment | AR Aging report, nhập thanh toán | ✅ DONE |
| 4.2 | FIN — AP Module | `frontend-specialist` | PO + Supplier | AP lịch thanh toán, cảnh báo L/C | ✅ DONE |
| 4.3 | FIN — Journal Entries | `backend-specialist` | Transaction events | Auto-generate double-entry JE | ✅ DONE |
| 4.4 | FIN — Xuất Excel Tờ Khai TTĐB | `backend-specialist` | Tax data by period | File Excel chuẩn biểu mẫu TTĐB | ⏳ |
| 4.5 | FIN — Xuất Excel Bảng Kê VAT | `backend-specialist` | Invoice data by period | Excel bảng kê mua vào/bán ra | ⏳ |
| 4.6 | FIN — e-Invoice | `backend-specialist` | SO Delivered | PDF hóa đơn gửi email + lưu trữ | ⏳ |
| 4.7 | FIN — Period Closing | `backend-specialist` | Accounting Period | Lock mechanism, chống back-date | ✅ DONE |
| 4.8 | FIN — P&L Statement | `frontend-specialist` | Journal Entries | Báo cáo Revenue-COGS-GP-Expenses-NP | ✅ DONE |
| 4.9 | FIN — Expense Management | `frontend-specialist` | Expense model | CRUD + Approval + Auto Journal | ✅ DONE |

### GIAI ĐOẠN 5: Reporting & CEO Dashboard

| ID | Task | Agent | INPUT | OUTPUT | VERIFY |
|---|---|---|---|---|---|
| 5.1 | RPT — Report Builder | `frontend-specialist` | All domain data | UI kéo thả tạo báo cáo tùy chỉnh | Tạo báo cáo Tồn kho theo Vintage, xuất Excel |
| 5.2 | RPT — 15 Báo Cáo Cài Sẵn | `frontend-specialist` | Data APIs | Inventory, Sales, Margin, AR/AP, Allocation... | ✅ DONE (R01-R15) |
| 5.3 | RPT — Scheduled Email | `backend-specialist` | Cron + Resend | Job gửi email báo cáo định kỳ | ⏳ |
| 5.4 | DSH — CEO KPI & Charts | `frontend-specialist` | Aggregated APIs | Bento-grid Dashboard, biểu đồ, KPI card | ✅ DONE (KPI bars + Revenue chart + P&L + Cash) |
| 5.5 | DSH — Pending Approvals Widget | `frontend-specialist` | ApprovalRequest | Widget duyệt trực tiếp từ Dashboard | ✅ DONE |
| 5.6 | DSH — In-Transit Map | `frontend-specialist` | AGN Shipment data | Widget container đang trên biển + ETA | ✅ DONE |
| 5.7 | KPI — Setup & Auto-Calculation | `backend-specialist` | KpiTarget schema | Configurable targets per metric/month/rep | ✅ DONE |
| 5.8 | DCL — Declarations Dynamic Page | `frontend-specialist` | Declaration data | Stats, Quick Actions, Detail drawer | ✅ DONE |

---

## 6. File Structure (Cấu Trúc Thư Mục Dự Án)

```
lyruou/
├── docs/                           # Tài liệu dự án (AI-readable)
│   ├── wine-erp-plan.md            # ← File này (Master Plan)
│   ├── llms.txt                    # AI index file
│   ├── README.md
│   ├── architecture/               # ← Sơ đồ kỹ thuật (cần tạo Phase 3)
│   │   ├── database-schema.md      # ERD tổng thể
│   │   ├── module-dependencies.md  # Sơ đồ quan hệ giữa modules
│   │   ├── api-design.md
│   │   └── data-flow.md            # Luồng dữ liệu mua → kho → bán → kế toán
│   └── modules/                    # Đặc tả nghiệp vụ (13 files)
│       ├── admin-auth-workflow.md  ✅
│       ├── master-data.md          ⬜ cần tạo
│       ├── contract-management.md  ✅
│       ├── market-price-tax-lookup.md ✅
│       ├── tax-and-landed-cost.md  ✅
│       ├── import-agency-portal.md ✅
│       ├── wms-inventory.md        ⬜ cần tạo
│       ├── sales-allocation.md     ⬜ cần tạo
│       ├── consignment.md          ✅
│       ├── transport-delivery.md   ✅
│       ├── finance-accounting.md   ✅
│       ├── reporting-bi.md         ⬜ cần tạo
│       └── ceo-dashboard.md        ✅
│
└── src/                            # ← Mã nguồn (Phase 4)
    ├── app/
    │   ├── (auth)/                 # Login, Reset password
    │   └── (modules)/             # ← Mỗi module = 1 folder
    │       ├── sys/               # SYS — Admin & RBAC
    │       ├── mdm/               # MDM — Master Data
    │       ├── cnt/               # CNT — Contracts
    │       ├── tax/               # TAX — Tax + Market Price
    │       ├── prc/               # PRC — Procurement
    │       ├── agn/               # AGN — Agency Portal
    │       ├── wms/               # WMS — Warehouse
    │       ├── sls/               # SLS — Sales
    │       ├── csg/               # CSG — Consignment
    │       ├── trs/               # TRS — Transport
    │       ├── fin/               # FIN — Finance
    │       ├── rpt/               # RPT — Reports
    │       └── dsh/               # DSH — Dashboard
    ├── components/                 # Shared UI components
    ├── lib/
    │   ├── tax-engine.ts          # Tax calculation logic
    │   ├── excel.ts               # Excel parse & export (ExcelJS)
    │   └── notifications.ts       # Alert & Email logic
    ├── server/                    # tRPC routers (1 per module)
    └── prisma/
        └── schema.prisma          # Database Schema (13 domain schemas)
```

---

## 7. Câu Hỏi Còn Mở (Resolved & Pending)

| # | Câu hỏi | Trạng thái | Ghi chú |
|---|---|---|---|
| Q1 | Phần mềm kế toán hiện tại? | ✅ **EXCEL** | Ưu tiên Excel export mọi tờ khai |
| Q2 | NCC từ nước nào? | ✅ **Đa quốc gia** | Module TAX quản lý đầy đủ EVFTA/MFN/AANZFTA... |
| Q3 | Kho dùng Rack System không? | ✅ **CÓ — Quản lý theo Vị trí (Zone/Rack/Bin)** | WMS cần Location Management đầy đủ |
| Q4 | Tích hợp VNACCS/ECUS (Hải quan điện tử)? | ⬜ Chưa trả lời | Hay chỉ cần Export Excel tờ khai? |
| Q5 | Số lượng Agency Hải quan cộng tác? | ⬜ Mới | Ảnh hưởng thiết kế onboarding Agency Portal |

---

## 8. Progress Tracker

| Giai đoạn | Trạng thái | Ghi chú |
|---|---|---|
| ✅ Phase 0: Khởi động & Thu thập | HOÀN TẤT | |
| ✅ Phase 1: Phân tích Nghiệp vụ | HOÀN TẤT | 9/13 module đã có tài liệu |
| ✅ Phase 2: Lập Kế hoạch | HOÀN TẤT | Master Plan v3.0 |
| ✅ Phase 3: Architecture & Database Design | HOÀN TẤT | ERD + Prisma Schema |
| ✅ Phase 4: Implementation (8 Phases) | **P1—P7 ✅ 100%** \| **P8 ~75%** | AI Vault+OCR+QR Print+Dashboard Export+Prompt Library ✅ |
| ⏳ Phase 5: Testing & Go-live | — | |

---
*Cập nhật lần cuối: 2026-03-05 17:55 | **P1-P7 100% ✅** | **P8 ~75%** | @project-planner*
