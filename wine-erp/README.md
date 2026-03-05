# 🍷 Wine ERP — Hệ Thống Quản Lý Nhập Khẩu Rượu Vang

> **LYS Cellars** — Enterprise Resource Planning cho doanh nghiệp nhập khẩu & phân phối rượu vang tại Việt Nam.

## Tổng Quan

Wine ERP là hệ thống quản lý toàn diện bao gồm 20+ module từ nhập khẩu, kho bãi, bán hàng, tài chính đến trí tuệ nhân tạo. Được xây dựng trên nền tảng Next.js 15 + PostgreSQL + Prisma ORM.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Backend** | Next.js Server Actions, Prisma ORM |
| **Database** | PostgreSQL (Supabase) |
| **Auth** | Supabase Auth + RBAC (8 roles) + Approval Workflow Engine |
| **AI** | Google Gemini API (OCR, Forecast, Anomaly) |
| **Export** | ExcelJS (15 reports), QR Code (anti-counterfeit) |
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
│   │   └── api/                  # API routes (QR print)
│   ├── lib/
│   │   ├── db.ts                 # Prisma client
│   │   ├── auth.ts               # NextAuth config
│   │   ├── audit.ts              # Audit trail
│   │   ├── ai-service.ts         # Gemini API
│   │   └── encryption.ts         # AES-256 key vault
│   └── middleware.ts             # Auth middleware
├── docs/                         # Architecture & specs
└── public/                       # Static assets
```

## Documentation

- `docs/wine-erp-implementation-plan.md` — Master implementation plan (~95% complete)
- `docs/wine-erp-audit-05-03.md` — Feature audit vs specifications
- `docs/architecture/` — Module dependencies, data flow constraints
- `CODEBASE.md` — Agent instructions & coding rules

## Progress

**Overall: ~96% complete** (as of 05/03/2026)

| Phase | Status | Description |
|-------|--------|-------------|
| P1 Auth/RBAC | ✅ 100% | Login, roles, approval engine, audit trail, notifications |
| P2 WMS/Logistics | ✅ 100% | GR, DO, FIFO, Landed Cost, Quarantine, Adjust |
| P3 Finance | ✅ 100% | Journal, COGS, P&L, Expenses, Period Close, COD→AR |
| P4 Sales/CRM | ✅ 95% | Price List, Quotation, Allocation, Returns, Credit Notes |
| P5 Supply Chain | ✅ 98% | Transfer, Count, Consignment, E-POD, Contract, Amendment |
| P6 Reports/KPI | ✅ 98% | 15 Reports, KPI Setup, Declarations, Variance |
| P7 Portals | ✅ 95% | Agency Portal, POS, QR Code, Market Price |
| P8 AI/Advanced | ✅ 90% | OCR, Forecast, Search, Anomaly, Dashboard |

---

*Built with ❤️ for Vietnamese wine importers*
