# 🍷 Wine ERP — Hệ Thống Quản Lý Nhập Khẩu Rượu Vang

> **LYS Cellars** — Enterprise Resource Planning cho doanh nghiệp nhập khẩu & phân phối rượu vang tại Việt Nam.

## Tổng Quan

Wine ERP là hệ thống quản lý toàn diện bao gồm 22+ module từ nhập khẩu, kho bãi, bán hàng, tài chính đến trí tuệ nhân tạo. Được xây dựng trên nền tảng Next.js 15 + PostgreSQL + Prisma ORM.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Backend** | Next.js Server Actions, Prisma ORM |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | Supabase Auth + RBAC (8 roles) + Approval Workflow Engine |
| **AI** | Google Gemini API (OCR, Forecast, Anomaly) |
| **Storage** | Supabase Storage (documents), ImgBB (product images) |
| **Export** | ExcelJS (15 reports), QR Code (anti-counterfeit) |
| **Notifications** | Email (Resend) + Telegram Bot (CEO Push) |
| **Styling** | Vanilla CSS, Dark theme design system |

## Modules

### Core Business
- **🏠 CEO Dashboard** — KPI, P&L, Cash Position, AR Aging, Approval Queue
- **📦 Warehouse (WMS)** — Stock Lots, FIFO, GR/DO, Quarantine, Stock Count, Transfer
- **💰 Sales** — Orders, Quotations, Price Lists, Allocation Engine, Returns & Credit Notes
- **💳 Finance** — Journal Entries, COGS, P&L, Expenses, Period Close, AR/AP, COD→AR Sync
- **🛒 Procurement** — PO Management, Landed Cost, Tax Engine (CIF→NK→TTĐB→VAT), Variance Report, Excel Import

### Strategic
- **🤝 CRM** — Customer 360°, Sales Pipeline Kanban, Opportunity Tracking
- **📊 Reports** — 15 Standard Reports (R01-R15), Excel Export, AR Aging PDF
- **📋 KPI** — Target Setup, Auto-calc, Forecast, Copy/Import from Excel
- **📝 Declarations** — NK, TTĐB, VAT tax declarations with calendar tracking

### Operations
- **🚚 Delivery** — Route Planning, E-POD, COD Collection & AR Sync, Reverse Logistics
- **🏪 Consignment** — Agreement Management, Stock Map, Replenishment Alerts
- **🏷️ Stamps** — Excise stamp tracking, usage reports, Excel export
- **📑 Contracts** — Utilization tracking, Expiry alerts, Amendments (audit trail), E-Sign, Doc Upload

### Advanced
- **🛍️ POS Showroom** — Product grid, Barcode scan, FIFO stock, VAT Invoice
- **📱 QR Codes** — Anti-counterfeit verification, Auto-gen on GR, Print labels
- **🤖 AI Features** — Demand Forecast, Smart Pricing, Anomaly Detection, OCR, Smart Search
- **🏢 Agency Portal** — External partner management, Submission review workflows
- **📈 Market Price** — Price comparison, Margin analysis, Below-cost alerts
- **📸 Marketing** — Media Library, Product image management
- **🤖 Telegram Bot** — CEO Bot, 9 commands, Push notifications

### Production Hardening
- **🔒 Security** — RBAC Middleware (31 routes), Security Headers, Zod validation (23+ schemas)
- **📱 Responsive** — Mobile sidebar auto-hide + hamburger menu overlay
- **🌐 PWA** — Web App Manifest, robots.txt, custom 404 page
- **⚡ Performance** — Loading skeletons, Route cache, ISR

## Getting Started

```bash
# Install dependencies
npm install

# Setup database
cp .env.example .env.local
npx prisma migrate dev

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — Login page → Dashboard.

## Project Structure

```
wine-erp/
├── prisma/schema.prisma          # 40+ models
├── src/
│   ├── app/
│   │   ├── login/                # Authentication
│   │   ├── dashboard/            # 20+ modules
│   │   │   ├── (module)/
│   │   │   │   ├── page.tsx      # Route page
│   │   │   │   ├── actions.ts    # Server actions
│   │   │   │   └── *Client.tsx   # Client component
│   │   └── api/                  # API routes (QR, Telegram, Export)
│   ├── lib/
│   │   ├── db.ts                 # Prisma client
│   │   ├── auth.ts               # NextAuth config
│   │   ├── audit.ts              # Audit trail
│   │   ├── validations.ts        # Zod schemas (23+ schemas)
│   │   ├── env.ts                # Env validation (Zod)
│   │   ├── cache.ts              # Server-side cache layer
│   │   ├── storage.ts            # ImgBB + Supabase Storage
│   │   ├── ai-service.ts         # Gemini API
│   │   ├── telegram.ts           # Telegram Bot client
│   │   └── encryption.ts         # AES-256 key vault
│   └── middleware.ts             # Auth + RBAC middleware (31 routes)
├── docs/                         # Architecture & specs
└── public/                       # Static assets
```

## Documentation

- `docs/wine-erp-implementation-plan.md` — Master implementation plan (~95% complete)
- `docs/wine-erp-audit-05-03.md` — Feature audit vs specifications
- `docs/bug-fix-lessons.md` — 🐛 **Bug fix journal & lessons learned** (BẮT BUỘC cập nhật khi fix bug)
- `docs/architecture/` — Module dependencies, data flow constraints
- `CODEBASE.md` — Agent instructions & coding rules

## ⚠️ Development Rules

> **BẮT BUỘC:** Mỗi khi fix bug, PHẢI bổ sung vào `docs/bug-fix-lessons.md`.
> Xem file đó để tra cứu lỗi đã gặp trước khi debug.

### Quy tắc quan trọng nhất

| # | Rule | Loại |
|---|------|------|
| 1 | Không chạy đồng thời dev + seed + prisma CLI | DB Connection |
| 2 | `pg.Pool({ max: 3 })` cho Supabase Free Tier | DB Connection |
| 3 | Mọi `/dashboard/*` PHẢI có `loading.tsx` | Performance |
| 4 | READ functions → `cached()` từ `@/lib/cache` | Performance |
| 5 | `staleTimes` trong next.config.ts là bắt buộc | Performance |
| 6 | Không dùng `Set-Content` cho file code (dùng `WriteAllText` UTF-8) | Encoding |
| 7 | Không dùng `revalidate = N` trên dashboard pages (build fail) | Build |
| 8 | Test `npx next build` sau thay đổi page config | Build |

> 📖 Chi tiết đầy đủ: [`docs/bug-fix-lessons.md`](docs/bug-fix-lessons.md)

## Progress

**Overall: ~99% complete** (as of 07/03/2026)

| Phase | Status | Description |
|-------|--------|-------------|
| P1 Auth/RBAC | ✅ 100% | Login, roles, approval engine, audit trail, notifications |
| P2 WMS/Logistics | ✅ 100% | GR, DO, FIFO, Landed Cost, Quarantine, Adjust |
| P3 Finance | ✅ 100% | Journal, COGS, P&L, Expenses, Period Close, COD→AR |
| P4 Sales/CRM | ✅ 100% | Price List, Quotation, Allocation, Returns, Credit Notes |
| P5 Supply Chain | ✅ 100% | Transfer, Count, Consignment, E-POD, Contract, Amendment |
| P6 Reports/KPI | ✅ 100% | 15 Reports, KPI Setup, Declarations, Variance |
| P7 Portals | ✅ 100% | Agency Portal, POS, QR Code, Market Price |
| P8 AI/Advanced | ✅ 97% | OCR, Forecast, Search, Anomaly, Dashboard |
| **Production Readiness** | ✅ 100% | Security headers, RBAC, Zod, Responsive, PWA, 404 |

---

*Built with ❤️ for Vietnamese wine importers*
