# Wine ERP — Hệ Thống Tài Liệu Dự Án

> Hệ thống ERP chuyên biệt cho doanh nghiệp Nhập khẩu & Phân phối Rượu Vang.
> **Nguyên tắc kiến trúc:** Modular-first — Mọi phân hệ độc lập, có thể bật/tắt/mở rộng riêng lẻ.

---

## 🚨 QUY TẮC BẮT BUỘC CẬP NHẬT DOCS (AI AGENTS MUST READ)

> **MỌI AI AGENT khi thay đổi code PHẢI cập nhật docs tương ứng. Không có ngoại lệ.**

### Khi nào PHẢI cập nhật docs?

| Hành động | File docs PHẢI cập nhật |
|---|---|
| **Thêm module mới** | ① Tạo `docs/modules/<tên>.md` ② Thêm vào bảng Module (mục 2) ③ Cập nhật `llms.txt` ④ Cập nhật `wine-erp-plan.md` nếu thay đổi scope |
| **Thêm route mới** | ① Cập nhật bảng Module (mục 2) nếu route thuộc module mới ② Cập nhật spec file của module liên quan |
| **Thêm/sửa Prisma model** | ① Cập nhật `architecture/database-schema.md` ② Cập nhật `architecture/module-dependencies.md` nếu thay đổi domain ownership |
| **Thay đổi tech stack** | ① Cập nhật `architecture/tech-stack.md` ② Cập nhật bảng "Quyết Định Kỹ Thuật" (mục 5) |
| **Fix bug quan trọng** | ① Bổ sung `bug-fix-lessons.md` theo template |
| **Thay đổi Auth/Storage** | ① Cập nhật `architecture/tech-stack.md` ② Cập nhật bảng "Quyết Định Kỹ Thuật" |
| **Thêm tính năng vào module** | ① Cập nhật spec file trong `docs/modules/<module>.md` |
| **Kết thúc phiên làm việc** | ① Cập nhật `Last updated` ở cuối file này ② Cập nhật `llms.txt` nếu có thay đổi lớn |

### Checklist cuối phiên (MANDATORY)

```
□ README.md Last updated = ngày hôm nay?
□ Module spec file(s) đã cập nhật implementation status?
□ Số liệu (models, routes, modules) vẫn chính xác?
□ llms.txt phản ánh đúng trạng thái hiện tại?
```

---

## 📌 Đọc Trước (Start Here)

| File | Vai trò |
|---|---|
| [CODEBASE.md](../CODEBASE.md) | 🔴 **MANDATORY TẤT CẢ AGENTS** — Quy tắc Codebase, ranh giới Modular và Workflow 3 bước. |
| [wine-erp-plan.md](./wine-erp-plan.md) | **Master Plan** — Tổng thể modules, Task Breakdown, Tech Stack |
| [llms.txt](./llms.txt) | Index AI-friendly — AI đọc file này đầu tiên để hiểu context dự án |
| [data-flow.md](./architecture/data-flow.md) | Ràng buộc Database Constraints (Tuyệt đối không vi phạm khi viết Server Actions) |
| [module-dependencies.md](./architecture/module-dependencies.md) | Domain Ownership — Module nào sở hữu bảng nào |
| [bug-fix-lessons.md](./bug-fix-lessons.md) | 25 Rules rút ra từ 13 bugs — **PHẢI ĐỌC** trước khi code |

---

## 🗂️ Danh Sách Module & Tài Liệu

### Thống kê thực tế (từ codebase scan)

| Metric | Giá trị |
|---|---|
| **Prisma models** | 111 |
| **Prisma enums** | 71 |
| **Dashboard routes** | 33 folders |
| **Server Action files** | 38 files |
| **Module spec files** | 24 files |
| **Sidebar nav items** | 34 items (7 groups) |

### Bảng Module đầy đủ

| # | Mã | Phân hệ | Tài liệu | Route(s) |
|---|---|---|---|---|
| 1 | `SYS` | System Admin, RBAC & Approval Workflow | [admin-auth-workflow.md](./modules/admin-auth-workflow.md) | `/settings`, `/settings/approval-matrix` |
| 2 | `MDM` | Master Data (Product, Supplier, Customer) | [master-data.md](./modules/master-data.md) | `/products`, `/suppliers`, `/customers` |
| 3 | `CRM` | Customer Relationship Management | [crm.md](./modules/crm.md) | `/crm`, `/pipeline` |
| 4 | `CNT` | Contract Management & Regulated Documents | [contract-management.md](./modules/contract-management.md) | `/contracts` |
| 5 | `TAX` | Tax Reference & Market Price Lookup | [market-price-tax-lookup.md](./modules/market-price-tax-lookup.md) | `/tax`, `/market-price` |
| 6 | `PRC` | Procurement & Import | [tax-and-landed-cost.md](./modules/tax-and-landed-cost.md) | `/procurement` |
| 7 | `SHP` | Shipment Tracking (Milestones, Costs) | [shipment-tracking.md](./modules/shipment-tracking.md) | `/shipments` |
| 8 | `CST` | Product Costing (Giá vốn/chai) | [product-costing.md](./modules/product-costing.md) | `/costing` |
| 9 | `AGN` | Agency Portal (External Partners) | [import-agency-portal.md](./modules/import-agency-portal.md) | `/agency` |
| 10 | `WMS` | Warehouse (Zone/Rack/Bin, GR/DO, FIFO) | [wms-inventory.md](./modules/wms-inventory.md) | `/warehouse`, `/transfers`, `/stock-count` |
| 11 | `QRC` | QR & Barcode (Truy xuất nguồn gốc) | [qr-barcode.md](./modules/qr-barcode.md) | `/qr-codes` |
| 12 | `SLS` | Sales & Allocation Engine | [sales-allocation.md](./modules/sales-allocation.md) | `/sales`, `/quotations`, `/price-list`, `/allocation` |
| 13 | `POS` | POS Bán Lẻ Showroom | [pos-retail.md](./modules/pos-retail.md) | `/pos` |
| 14 | `CSG` | Consignment (Hàng ký gửi HORECA) | [consignment.md](./modules/consignment.md) | `/consignment` |
| 15 | `TRS` | Transportation & Delivery (E-POD) | [transport-delivery.md](./modules/transport-delivery.md) | `/delivery` |
| 16 | `FIN` | Finance & Accounting | [finance-accounting.md](./modules/finance-accounting.md) | `/finance`, `/declarations` |
| 17 | `STP` | Quản Lý Tem Rượu | [finance-accounting.md#6](./modules/finance-accounting.md) | `/stamps` |
| 18 | `RPT` | Reporting & Business Intelligence | [reporting-bi.md](./modules/reporting-bi.md) | `/reports` |
| 19 | `DSH` | CEO Executive Dashboard | [ceo-dashboard.md](./modules/ceo-dashboard.md) | `/dashboard` (root) |
| 20 | `KPI` | KPI Target Management | [kpi-targets.md](./modules/kpi-targets.md) | `/kpi` |
| 21 | `AI` | AI Features & Prompt Library | [ai-features.md](./modules/ai-features.md) | `/ai` |
| 22 | `TLG` | Telegram Bot (CEO Bot) | [telegram-bot.md](./modules/telegram-bot.md) | `/settings/telegram` |
| 23 | `MKT` | Marketing (Media Library) | [marketing.md](./modules/marketing.md) | `/media` |
| 24 | `PRO` | Tờ Trình — Đề Xuất | [proposals-approval.md](./modules/proposals-approval.md) | `/proposals` |
| 25 | `APM` | Ma Trận Phân Quyền | [approval-matrix.md](./modules/approval-matrix.md) | `/settings/approval-matrix` |
| 26 | `RTN` | Returns & Credit Notes | *(trong sales-allocation.md)* | `/returns` |

**Tổng: 26 modules** (24 có spec file riêng, 2 nằm trong spec file khác)

---

## 🏁 Trạng Thái Dự Án

| Phase | Tên | Trạng thái |
|---|---|---|
| Phase 0 | Khởi động & Thu thập yêu cầu | ✅ Hoàn thành |
| Phase 1 | Phân tích Nghiệp vụ (Business Analysis) | ✅ Hoàn thành |
| Phase 2 | Lập Kế hoạch & Task Breakdown | ✅ Hoàn thành |
| Phase 3 | Architecture & Database Schema | ✅ Hoàn thành |
| Phase 4 | Implementation (8 sub-phases) | ✅ Hoàn thành |
| Phase 5 | Testing, Security Audit & Production Hardening | ✅ Hoàn thành |

---

## 🔧 Tech Stack Thực Tế (Verified from `package.json`)

| Layer | Công nghệ | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | **16.1.6** |
| **Language** | TypeScript | 5.x |
| **UI Library** | React | **19.2.3** |
| **CSS** | TailwindCSS | **v4** |
| **Components** | Shadcn UI (Radix) | latest |
| **ORM** | Prisma | **7.4.2** |
| **Database** | Supabase PostgreSQL | Managed |
| **Auth** | Supabase Auth (`@supabase/ssr`) | 0.9.0 |
| **Image Storage** | **ImgBB** (free API) | - |
| **Document Storage** | **Supabase Storage** (private) | - |
| **Email** | Resend | - |
| **Telegram** | Telegram Bot API (webhook) | - |
| **AI** | Google Gemini 2.0 Flash / 1.5 Pro | - |
| **Deploy** | Vercel + GitHub CI/CD | - |

---

## 🔑 Quyết Định Kỹ Thuật Đã Chốt

| Chủ đề | Quyết định |
|---|---|
| **Database** | Supabase PostgreSQL — 111 models, 71 enums |
| **Auth** | Supabase Auth — JWT, `@supabase/ssr` cho App Router |
| **File Storage** | **ImgBB** (ảnh sản phẩm, public) + **Supabase Storage** (hợp đồng/chứng từ, private) |
| **Deployment** | Vercel — Auto-deploy khi merge `main`, Preview URLs per PR |
| **Source Control** | GitHub — PR workflow |
| **AI LLM** | Google Gemini 2.0 Flash / 1.5 Pro — OCR, báo cáo CEO, dự báo |
| **API Pattern** | Server Actions (KHÔNG dùng tRPC) |
| **Connection Pool** | pgBouncer Transaction mode (port 6543), `max: 5` |
| **Caching** | 4-layer: Router Cache + ISR (stagger 30/45/60/90s) + SWR + Server-side LRU |
| **Validation** | Zod 23+ schemas cho 7+ modules |
| **Auth Guards** | `requireAuth()` + `requirePermission()` cho mọi mutation |
| **Serialization** | `serialize()` utility cho Prisma Decimal/BigInt |
| **Mobile** | PWA + Responsive sidebar, Camera scanner for WMS |
| **Realtime** | Supabase Realtime — role-based channels |
| **Kiến trúc** | Modular-first: Mỗi module độc lập |

---

## 📐 Đặc Thù Ngành (Wine-Specific Concepts)

| Khái niệm | Giải thích |
|---|---|
| **Vintage** | Năm thu hoạch nho — quan trọng trong định giá, phân bổ quota |
| **Appellation / AOC** | Vùng trồng nho được chứng nhận (Bordeaux, Burgundy, Barossa...) |
| **ABV%** | Alcohol By Volume — Dưới 20°: Thuế TTĐB 35%. Từ 20° trở lên: 65%. |
| **OWC / Carton** | Original Wooden Case (Thùng gỗ 6/12 chai) / Carton (Hộp giấy) |
| **HS Code** | Mã hàng hóa hải quan (Rượu vang thường là 2204.xx) |
| **CIF** | Cost + Insurance + Freight — Giá tính thuế nhập khẩu gốc |
| **Landed Cost** | CIF + Thuế NK + Thuế TTĐB + Logistics = Giá vốn thực |
| **Allocation** | Phân bổ quota cho Sales Rep/KH VIP với các chai khan hiếm |
| **Consignment** | Hàng ký gửi tại HORECA — Sở hữu của Cty đến khi bán được |
| **EVFTA** | Hiệp định EU-VN: Giảm thuế NK rượu châu Âu. C/O Form: EUR.1 |
| **HORECA** | Hotels, Restaurants, Catering — Kênh B2B đặc thù |

---

## 📁 Cấu Trúc Thư Mục Tài Liệu

```
docs/
├── README.md                      ← File này (Mục lục + Quy tắc cập nhật)
├── wine-erp-plan.md               ← Master Plan
├── wine-erp-implementation-plan.md ← Chi tiết triển khai theo phase
├── wine-erp-testing.md            ← Kết quả unit test
├── wine-erp-performance-test-plan.md ← Kế hoạch test performance
├── file-storage-plan.md           ← ImgBB + Supabase Storage
├── bug-fix-lessons.md             ← 25 Rules từ 13 bugs
├── llms.txt                       ← AI context index
│
├── architecture/
│   ├── database-schema.md         ← ERD + Mermaid diagram
│   ├── database-domain-schemas.md ← Chi tiết schema per domain
│   ├── module-dependencies.md     ← Domain Ownership
│   ├── data-flow.md               ← Business constraints
│   ├── tech-stack.md              ← Tech Stack (Supabase + Vercel)
│   ├── ui-design-system.md        ← "Oceanic Cellar" design tokens
│   └── data-scalability-plan.md   ← Performance optimization roadmap
│
└── modules/                       ← 24 spec files
    ├── admin-auth-workflow.md     SYS
    ├── master-data.md             MDM
    ├── crm.md                     CRM
    ├── contract-management.md     CNT
    ├── market-price-tax-lookup.md TAX
    ├── tax-and-landed-cost.md     PRC
    ├── shipment-tracking.md       SHP
    ├── product-costing.md         CST
    ├── import-agency-portal.md    AGN
    ├── wms-inventory.md           WMS
    ├── qr-barcode.md              QRC
    ├── sales-allocation.md        SLS (+ QTN, PPL, PRC-L, RTN)
    ├── pos-retail.md              POS
    ├── consignment.md             CSG
    ├── transport-delivery.md      TRS
    ├── finance-accounting.md      FIN + STP
    ├── reporting-bi.md            RPT
    ├── ceo-dashboard.md           DSH
    ├── kpi-targets.md             KPI
    ├── ai-features.md             AI
    ├── telegram-bot.md            TLG
    ├── marketing.md               MKT
    ├── proposals-approval.md      PRO
    └── approval-matrix.md         APM
```

---

## 🔗 Quy Tắc Cập Nhật

1. **Mọi thay đổi Scope** → Cập nhật `wine-erp-plan.md`, rồi README.md
2. **Module mới** → Tạo file `docs/modules/<tên>.md`, thêm vào bảng Module
3. **Quyết định kỹ thuật** → Ghi vào bảng "Quyết Định Kỹ Thuật"
4. **AI context** → Cập nhật `llms.txt` khi có thay đổi lớn
5. **Bug fix** → Bổ sung `bug-fix-lessons.md` theo template
6. **Schema change** → Cập nhật `architecture/database-schema.md`

---
*Last updated: 2026-03-08 23:20 | Wine ERP v6.2 — 26 modules, 111 models, 33 routes, 25 dev rules*
