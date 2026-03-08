# Wine ERP — Hệ Thống Tài Liệu Dự Án
> Hệ thống ERP chuyên biệt cho doanh nghiệp Nhập khẩu & Phân phối Rượu Vang.
> **Nguyên tắc kiến trúc:** Modular-first — Mọi phân hệ độc lập, có thể bật/tắt/mở rộng riêng lẻ.

---

## 📌 Đọc Trước (Start Here)

| File | Vai trò |
|---|---|
| [CODEBASE.md](../CODEBASE.md) | 🔴 **MANDATORY TẤT CẢ AGENTS** — Quy tắc Codebase, ranh giới Modular và Workflow 3 bước. Phải đọc trước khi sửa code JS/TS. |
| [wine-erp-plan.md](./wine-erp-plan.md) | **Master Plan v3.0** — Tổng thể 13 module, Task Breakdown đầy đủ, Tech Stack |
| [llms.txt](./llms.txt) | Index AI-friendly — AI đọc file này đầu tiên để hiểu context dự án |
| [data-flow.md](./architecture/data-flow.md) | Ràng buộc Database Constraints (Tuyệt đối không vi phạm khi viết Server Actions) |
| [module-dependencies.md](./architecture/module-dependencies.md) | Sơ đồ Database Dependencies và Domain Ownership |
| `architecture/` | Sơ đồ kỹ thuật: ERD, API, Data Flow |

---

## 🗂️ Danh Sách 13 Module & Tài Liệu Tương Ứng

| # | Mã | Phân hệ | Tài liệu | Trạng Thái |
|---|---|---|---|---|
| 1 | `SYS` | System Admin, RBAC & Approval Workflow | [admin-auth-workflow.md](./modules/admin-auth-workflow.md) | ✅ Hoàn thành |
| 2 | `MDM` | Master Data & Partner Management | [master-data.md](./modules/master-data.md) | ✅ Hoàn thành |
| 3 | `CRM` | Customer Relationship Management (B2B + B2C) | [crm.md](./modules/crm.md) | ✅ Hoàn thành |
| 4 | `CNT` | Contract Management | [contract-management.md](./modules/contract-management.md) | ✅ Hoàn thành |
| 5 | `TAX` | Tax Reference & Market Price | [market-price-tax-lookup.md](./modules/market-price-tax-lookup.md) | ✅ Hoàn thành |
| 6 | `PRC` | Procurement & Import / Landed Cost | [tax-and-landed-cost.md](./modules/tax-and-landed-cost.md) | ✅ Cập nhật |
| 6b | `SHP` | **Shipment Tracking** (Lô Hàng, Milestones, Landed Cost) | [shipment-tracking.md](./modules/shipment-tracking.md) | ✅ **MỚI** |
| 7 | `CST` | **Product Costing** (Giá vốn/chai, Đề xuất giá) | [product-costing.md](./modules/product-costing.md) | ✅ **MỚI** |
| 8 | `AGN` | Import Agency Portal (External) | [import-agency-portal.md](./modules/import-agency-portal.md) | ✅ Cập nhật |
| 9 | `WMS` | WMS & Inventory (Zone/Rack/Bin + Điều chuyển kho) | [wms-inventory.md](./modules/wms-inventory.md) | ✅ Cập nhật |
| 10 | `QRC` | **QR & Barcode** (Tạo/In QR, Truy xuất nguồn gốc) | [qr-barcode.md](./modules/qr-barcode.md) | ✅ **MỚI** |
| 11 | `SLS` | Sales & Allocation | [sales-allocation.md](./modules/sales-allocation.md) | ✅ Hoàn thành |
| 11b | `QTN` | **Quotation (Báo Giá)** | */dashboard/quotations* | ✅ **MỚI** |
| 11c | `PPL` | **Sales Pipeline (Kanban)** | */dashboard/pipeline* | ✅ **MỚI** |
| 11d | `PRC-L` | **Price List Management** | */dashboard/price-list* | ✅ **MỚI** |
| 12 | `POS` | **POS Bán Lẻ Showroom** | [pos-retail.md](./modules/pos-retail.md) | ✅ **MỚI** |
| 13 | `CSG` | Consignment Management (Hàng ký gửi HORECA) | [consignment.md](./modules/consignment.md) | ✅ Hoàn thành |
| 14 | `TRS` | Transportation & Delivery (E-POD) | [transport-delivery.md](./modules/transport-delivery.md) | ✅ Hoàn thành |
| 15 | `FIN` | Finance, Accounting & Legal Declarations | [finance-accounting.md](./modules/finance-accounting.md) | ✅ Cập nhật |
| 16 | `STP` | **Quản Lý Tem Rượu** (Phôi tem Bộ TC, dán/hủy tem) | [finance-accounting.md#6](./modules/finance-accounting.md) | ✅ **MỚI** |
| 17 | `RPT` | Reporting & Business Intelligence | [reporting-bi.md](./modules/reporting-bi.md) | ✅ Hoàn thành |
| 18 | `DSH` | CEO Executive Dashboard + **KPI Targets** | [ceo-dashboard.md](./modules/ceo-dashboard.md) | ✅ Cập nhật |
| 19 | `KPI` | **KPI Target Management** (Setup & Tracking chỉ tiêu) | [kpi-targets.md](./modules/kpi-targets.md) | ✅ **MỚI** |
| 20 | `AI` | AI Features & API Key Management | [ai-features.md](./modules/ai-features.md) | ✅ Hoàn thành |
| 21 | `TLG` | **Telegram Bot Integration** (CEO Bot, Push Notifications) | [telegram-bot.md](./modules/telegram-bot.md) | ✅ **MỚI** |
| 22 | `MKT` | **Marketing** (Media Library, Product Image Management) | [marketing.md](./modules/marketing.md) | ✅ **MỚI** |
| 23 | `PRO` | **Tờ Trình — Đề Xuất** (Proposals, Multi-level Approval) | [proposals-approval.md](./modules/proposals-approval.md) | ✅ **MỚI** |
| 24 | `APM` | **Ma Trận Phân Quyền** (Approval Matrix, Threshold Config) | [approval-matrix.md](./modules/approval-matrix.md) | ✅ **MỚI** |

**Tài liệu hoàn thành: 🎉 25/25** (thêm 10 module mới: QRC, POS, CST, KPI, STP, TLG, MKT, SHP, PRO, APM) + 3 module code mới: QTN, PPL, PRC-L

---

## 🏁 Trạng Thái Dự Án

| Phase | Tên | Trạng thái |
|---|---|---|
| Phase 0 | Khởi động & Thu thập yêu cầu | ✅ Hoàn thành |
| Phase 1 | Phân tích Nghiệp vụ (Business Analysis) | ✅ Hoàn thành |
| Phase 2 | Lập Kế hoạch & Task Breakdown | ✅ Hoàn thành |
| Phase 3 | Architecture & Database Schema | ✅ Hoàn thành |
| Phase 4 | Implementation (8 Phases code) | ✅ **P1—P8 ~99%** — +Responsive, Security Headers, Zod Validation, PWA, 404 Page |
| Phase 5 | Testing & Production Hardening | ✅ **Hoàn thành** — Build validation, E2E smoke tests, RBAC 31 routes, Zod 23+ schemas, Mobile responsive |

---

## 🏗️ Tài Liệu Kiến Trúc (Architecture)

| File | Nội dung |
|---|---|
| [database-schema.md](./architecture/database-schema.md) | **ERD đầy đủ** — Module dependency map + Mermaid ER Diagram toàn hệ thống |
| [schema.prisma](./architecture/schema.prisma) | **Prisma Schema** — ~55 bảng, đầy đủ relations + Enums |
| [tech-stack.md](./architecture/tech-stack.md) | **Tech Stack v2.0** — Supabase + Vercel + GitHub, env vars, setup guide |
| [ui-design-system.md](./architecture/ui-design-system.md) | **UI/UX Design System** — Cave Noir aesthetic, color tokens, typography, mobile-first |

---

## 🔑 Quyết Định Kỹ Thuật Đã Chốt

| Chủ đề | Quyết định |
|---|---|
| **Phần mềm KT hiện tại** | Excel → Ưu tiên Excel export cho mọi tờ khai, báo cáo tài chính |
| **WMS Location** | Quản lý theo Vị trí (Zone → Rack → Bin) — nhiều kho, có điều chuyển kho |
| **Khách hàng** | B2B (HORECA, Wholesale, Distributor) + B2C (Walk-in Showroom qua POS) |
| **QR Code** | Tạo + In QR sau GR; 3 cấp (SKU/Lot/Bottle); trang truy xuất nguồn gốc public |
| **POS Bán Lẻ** | Showroom riêng — POS module, Ca bán hàng, Tích điểm, Thanh toán đa phương thức |
| **NCC đa quốc gia** | Module TAX xử lý đầy đủ: EVFTA, MFN, AANZFTA, VCFTA, VKFTA... |
| **KPI Targets** | Setup chỉ tiêu đa tiêu chí (Revenue/Volume/Margin/NewCust), theo kỳ/kênh/rep |
| **Product Costing** | Tính giá vốn/chai đầy đủ 3 lớp thuế + phân bổ logistics; Đề xuất giá bán |
| **Agency Hải quan** | Cổng External Partner — Tài khoản riêng, scope-lock theo lô hàng |
| **Database** | ✅ **Supabase PostgreSQL** — Managed, built-in Dashboard |
| **Auth** | ✅ **Supabase Auth** — JWT, `@supabase/ssr` cho Next.js App Router |
| **File Storage** | ✅ **Supabase Storage** — CDN cho ảnh, Signed URL cho PDF nhạy cảm |
| **Source Control** | ✅ **GitHub** — PR workflow, code review |
| **Deployment** | ✅ **Vercel** — Auto-deploy khi merge to `main`, Preview URLs per PR |
| **AI OCR** | ✅ `ocrCustomsDeclaration()` + `ocrLogisticsInvoice()` — Gemini parse tờ khai + hóa đơn logistics |
| **AI LLM** | ✅ **Google Gemini 2.0 Flash / 1.5 Pro** — OCR, báo cáo CEO, dự báo nhu cầu, mô tả SP, anomaly |
| **AI Model Phụ** | Optional: Anthropic Claude, OpenAI GPT-4o (có thể bật/tắt qua Prompt Library UI) |
| **API Key Security** | ✅ Mã hóa AES-256-GCM + scrypt key derivation, lưu DB encrypted, IT Admin only |
| **QR Traceability** | ✅ Auto-sinh QR khi GR confirm, trang verify public, anti-counterfeit, in nhãn A4 |
| **Kiến trúc** | Modular-first: Mỗi module độc lập, có thể bật/tắt/deploy riêng |
| **Hải quan điện tử** | Chưa chốt (VNACCS/ECUS hay chỉ Export Excel?) |
| **Realtime** | ✅ Supabase Realtime — Role-based channels cho approvals, AR, stock, SO |
| **Telegram Bot** | ✅ Webhook-based CEO Bot — 9 commands VN, 5 push notifications, inline approval |
| **File Storage** | ✅ **ImgBB** (product images) + **Supabase Storage** (contract documents) |
| **Security Headers** | ✅ X-Frame-Options DENY, XSS Protection, Referrer-Policy, Permissions-Policy |
| **Input Validation** | ✅ **Zod** 23+ schemas cho 7 modules: Sales, Finance, Delivery, CRM, Contracts, POS, Warehouse |
| **Responsive** | ✅ Mobile sidebar auto-hide + hamburger menu overlay (<768px) |
| **PWA** | ✅ Web App Manifest, robots.txt (blocks /dashboard/), custom 404 page |
| **Approval Engine** | ✅ Multi-level proposal approval (3 cấp), SO/PO threshold auto-routing, configurable matrix |

---

## 📐 Đặc Thù Ngành (Wine-Specific Concepts)

> AI đọc phần này để hiểu domain trước khi xử lý bất kỳ yêu cầu nào liên quan đến hệ thống.

| Khái niệm | Giải thích |
|---|---|
| **Vintage** | Năm thu hoạch nho — quan trọng trong định giá, phân bổ quota |
| **Appellation / AOC** | Vùng trồng nho được chứng nhận (Bordeaux, Burgundy, Barossa...) |
| **ABV%** | Alcohol By Volume — Độ cồn. **Dưới 20°: Thuế TTĐB 35%. Từ 20° trở lên: 65%.** |
| **OWC / Carton** | Original Wooden Case (Thùng gỗ 6/12 chai) / Carton (Hộp giấy 6/12 chai) |
| **HS Code** | Mã hàng hóa hải quan (Rượu vang thường là 2204.xx) |
| **CIF** | Cost + Insurance + Freight — Giá tính thuế nhập khẩu gốc |
| **Landed Cost** | CIF + Thuế NK + Thuế TTĐB + Chi phí Logistics nội địa = Giá vốn thực nhập kho |
| **Allocation** | Phân bổ quota cho Sales Rep/Khách hàng VIP với các chai Grand Cru khan hiếm |
| **Consignment** | Hàng ký gửi tại HORECA — Sở hữu của công ty đến khi HORECA bán được |
| **EVFTA** | Hiệp định EU-VN: Giảm thuế NK rượu châu Âu theo lộ trình. C/O Form: EUR.1 |
| **HORECA** | Hotels, Restaurants, Catering — Kênh phân phối B2B đặc thù |

---

## 📁 Cấu Trúc Thư Mục Tài Liệu

```
docs/
├── README.md                    ← File này (Mục lục)
├── wine-erp-plan.md             ← Master Plan v3.0
├── llms.txt                     ← AI index
├── architecture/                ← Phase 3 sẽ tạo
│   ├── database-schema.md
│   ├── module-dependencies.md
│   ├── api-design.md
│   └── data-flow.md
└── modules/                     ← Đặc tả nghiệp vụ (15 modules)
    ├── admin-auth-workflow.md   ✅  SYS
    ├── master-data.md           ✅  MDM
    ├── crm.md                   ✅  CRM  ← MỚI
    ├── contract-management.md  ✅  CNT
    ├── market-price-tax-lookup.md ✅ TAX
    ├── tax-and-landed-cost.md  ✅  PRC
    ├── shipment-tracking.md    ✅  SHP  (Lô Hàng, Milestones, Costs)  ← MỚI
    ├── import-agency-portal.md ✅  AGN
    ├── consignment.md          ✅  CSG
    ├── transport-delivery.md   ✅  TRS
    ├── finance-accounting.md   ✅  FIN
    ├── ceo-dashboard.md        ✅  DSH
    ├── wms-inventory.md        ✅  WMS  (Zone/Rack/Bin, FIFO, GR/DO)
    ├── sales-allocation.md     ✅  SLS  (SO, Quotation, Allocation Engine)
    ├── reporting-bi.md         ✅  RPT  (15 reports, Report Builder, Scheduler)
    ├── marketing.md           ✅  MKT  (Media Library, Image Management)  ← MỚI
    ├── proposals-approval.md  ✅  PRO  (Tờ Trình, Multi-level Approval)  ← MỚI
    ├── approval-matrix.md     ✅  APM  (Ma Trận Phân Quyền, Config)  ← MỚI
    └── telegram-bot.md         ✅  TLG  (CEO Bot, Push Notifications)  ← MỚI
```

---

## 🔗 Liên Kết & Quy Tắc Cập Nhật

1. **Mọi thay đổi Scope** → Cập nhật `wine-erp-plan.md` trước, sau đó README.md
2. **Module mới** → Tạo file `docs/modules/<ten-module>.md`, thêm vào bảng danh sách ở trên
3. **Quyết định kỹ thuật** → Ghi vào bảng "Quyết Định Kỹ Thuật Đã Chốt" ở trên
4. **AI context** → Cập nhật `llms.txt` khi có thêm khái niệm domain mới

---
*Last updated: 2026-03-08 13:30 | Wine ERP v5.2 — **All 25 modules 100% ✅** | Session: +Tờ Trình (PRO) module, +Ma Trận Phân Quyền (APM), +CEO Approve/Reject for PO/SO, +Proposal Seed Data*
