# Tech Stack & Infrastructure — Wine ERP
**Phiên bản:** 3.0 | **Cập nhật:** 2026-03-08

---

## 1. Tổng Quan Stack

```
┌─────────────────────────────────────────────────────┐
│                     VERCEL                          │
│  ┌─────────────────────────────────────────────┐    │
│  │        Next.js 15 (App Router)              │    │
│  │  TypeScript · Shadcn UI · TailwindCSS       │    │
│  └─────────────┬───────────────────────────────┘    │
└────────────────┼────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│                   SUPABASE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  PostgreSQL  │  │ Supabase Auth│  │  Storage  │ │
│  │  + Prisma    │  │  (JWT/OAuth) │  │  (Files)  │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
└─────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│                    GITHUB                            │
│           Source Control · CI/CD via Vercel          │
└─────────────────────────────────────────────────────┘
```

---

## 2. Chi Tiết Từng Layer

### 🖥️ Frontend & Framework
| Công nghệ | Version | Mục đích |
|---|---|---|
| **Next.js** | **16.1.6** (App Router) | Framework chính — SSR, Server Actions, Turbopack |
| **TypeScript** | 5.x | Type safety end-to-end |
| **React** | **19.2.3** | Server Components, Suspense streaming |
| **TailwindCSS** | **v4** | Styling CSS-first configuration |
| **Shadcn UI** | latest | Component library (xây trên Radix UI) |
| **Recharts** | latest | Biểu đồ cho CEO Dashboard & RPT |
| **React Hook Form + Zod** | latest | Form validation với schema (23+ Zod schemas) |
| **Tanstack Table** | v8 | Bảng dữ liệu lớn (Inventory, Allocation Matrix) |
| **ExcelJS** | latest | Parse & xuất Excel (import/export toàn hệ thống) |
| **Prisma** | **7.4.2** | ORM — 111 models, 71 enums |

### 🗄️ Database — Supabase PostgreSQL
| Công nghệ | Ghi chú |
|---|---|
| **Supabase PostgreSQL** | Managed PostgreSQL — Không cần tự vận hành DB server |
| **Prisma ORM** | Schema migration, type-safe queries |
| **Connection Pooling** | Dùng Supabase Transaction Pooler (port 6543) cho Vercel serverless |
| **Row Level Security (RLS)** | Supabase RLS bổ sung tầng bảo mật DB-level song song với RBAC app-level |

> ⚠️ **Quan trọng khi kết nối Prisma + Supabase + Vercel:**
> ```env
> # Dùng Transaction Pooler cho Serverless (Vercel)
> DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
> # Dùng Direct Connection cho Prisma Migrations
> DIRECT_URL="postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
> ```
> ```prisma
> // schema.prisma
> datasource db {
>   provider  = "postgresql"
>   url       = env("DATABASE_URL")
>   directUrl = env("DIRECT_URL")
> }
> ```

### 🔐 Authentication — Supabase Auth
| Tính năng | Cách triển khai |
|---|---|
| **Email/Password Login** | Supabase Auth built-in — Nhân viên nội bộ đăng nhập bằng email |
| **External Partner Login** | Account riêng cho Agency Hải quan (Vẫn qua Supabase Auth, role khác) |
| **Session Management** | Supabase JWT token — Tự động refresh |
| **Next.js Integration** | Dùng `@supabase/ssr` package (chuẩn App Router 2024+) |
| **Middleware Auth Guard** | `middleware.ts` kiểm tra session trước khi cho vào route |
| **RBAC** | JWT custom claims gắn `role` và `permissions` → Kiểm tra ở Server Component |

> 📦 **Packages cần cài:**
> ```bash
> npm install @supabase/supabase-js @supabase/ssr
> ```

> 🔑 **Env vars cần có:**
> ```env
> NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
> NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
> SUPABASE_SERVICE_ROLE_KEY=[service_role_key]  # Chỉ dùng server-side
> ```

**Luồng Auth với App Router:**
```
Request → middleware.ts (check Supabase session)
  ├── No session → redirect /login
  └── Has session → check role/permissions in JWT
        ├── Authorized → render page (Server Component)
        └── No permission → redirect /unauthorized
```

### 📦 File Storage

**Ảnh sản phẩm:** Dùng **ImgBB** (free API, public CDN):
```typescript
// src/lib/imgbb.ts — Server Action upload ảnh lên ImgBB
export async function uploadToImgBB(base64Image: string, name?: string): Promise<ImgBBResponse>
export async function uploadFileToImgBB(file: File): Promise<ImgBBResponse>
```

**Hợp đồng & Chứng từ:** Dùng **Supabase Storage** (private, Signed URL):
| Bucket | Nội dung | Access |
|---|---|---|
| `contracts` | PDF hợp đồng scan | Private (Signed URL) |
| `invoices` | Hóa đơn logistics | Private (Signed URL) |
| `documents` | Tài liệu chung | Private (Signed URL) |

> **Env var cần có:**
> ```env
> IMGBB_API_KEY=[imgbb_api_key]
> ```

### 🔄 Real-time — Supabase Realtime
Lợi thế khi đã dùng Supabase: Có sẵn Realtime websocket:
- **CEO Dashboard:** KPI widgets tự cập nhật khi có SO mới, GR mới
- **Agency Portal:** Thu mua thấy ngay khi Agency submit thông tin lô hàng
- **Approval Notifications:** Alert real-time khi đến lượt duyệt, không cần polling

### 📧 Email & Notifications
| Công nghệ | Mục đích |
|---|---|
| **Resend** | Gửi email: Approval notification, Báo cáo scheduled, Contract expiry alert |
| **Supabase Edge Functions** | Chạy background jobs: Scheduled reports, Contract expiry check |

### 🚀 Deployment — Vercel + GitHub
| Layer | Công nghệ | Mục đích |
|---|---|---|
| **Source Control** | GitHub | Lưu code, PR workflow, code review |
| **CI/CD** | Vercel x GitHub Integration | Auto-deploy khi push/merge to `main` |
| **Preview Deployments** | Vercel | Mỗi PR tạo 1 preview URL để test trước khi merge |
| **Environment Secrets** | Vercel Environment Variables | Lưu Supabase keys, không commit lên Git |
| **Edge Runtime** | Vercel Edge Middleware | Auth check nhanh không cần cold start |

**Git Branching Strategy:**
```
main          ← Production (auto-deploy to Vercel)
  └── develop ← Staging (auto-deploy to Vercel Preview)
        └── feature/[module-name]  ← Feature development
        └── fix/[issue]            ← Bug fixes
```

---

## 3. So Sánh Trước / Sau Thay Đổi

| Layer | Phiên bản cũ (Plan v2) | Phiên bản mới (Plan v3) |
|---|---|---|
| **Auth** | NextAuth.js v5 | ✅ **Supabase Auth** |
| **Database** | Neon PostgreSQL | ✅ **Supabase PostgreSQL** |
| **File Storage** | Cloudflare R2 | ✅ **Supabase Storage** |
| **Realtime** | N/A | ✅ **Supabase Realtime** (bonus) |
| **Source Control** | N/A | ✅ **GitHub** |
| **Deploy** | Vercel | ✅ **Vercel** (giữ nguyên) |
| **ORM** | Prisma | ✅ **Prisma** (giữ nguyên) |
| **Frontend** | Next.js + Shadcn | ✅ **Next.js + Shadcn** (giữ nguyên) |

**Lợi ích khi chuyển sang Supabase:**
- ✅ **1 Platform cho tất cả:** DB + Auth + Storage + Realtime — Giảm tích hợp
- ✅ **Dashboard Supabase:** Xem dữ liệu trực tiếp, chạy SQL query không cần tool khác
- ✅ **RLS (Row Level Security):** Lớp bảo mật thêm ở tầng DB
- ✅ **Free Tier** đủ để phát triển và test: 500MB DB, 1GB Storage, 50,000 MAU
- ✅ **Supabase Studio:** UI để quản lý DB trong quá trình phát triển

---

## 4. Environment Variables Hoàn Chỉnh

```env
# ─── Supabase ───────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]

# ─── Database (Prisma) ──────────────────────────────
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres

# ─── Email ──────────────────────────────────────────
RESEND_API_KEY=[resend_key]
EMAIL_FROM=noreply@[company-domain].com

# ─── App ────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://[app].vercel.app
NODE_ENV=production
```

---

## 5. Quy Trình Setup Dự Án (Bootstrap)

```bash
# 1. Khởi tạo Next.js project
npx create-next-app@latest lyruou-erp --typescript --tailwind --app --src-dir

# 2. Cài dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install prisma @prisma/client
npm install @shadcn/ui
npm install react-hook-form zod @hookform/resolvers
npm install @tanstack/react-table
npm install recharts
npm install exceljs
npm install resend

# 3. Init Prisma
npx prisma init

# 4. Copy schema.prisma từ docs/architecture/schema.prisma
# 5. Chạy migration đầu tiên
npx prisma migrate dev --name init

# 6. Kết nối GitHub
git init && git remote add origin [github-repo-url]

# 7. Import project vào Vercel qua GitHub
# → vercel.com → New Project → Import từ GitHub
```

---

## 6. Supabase Project Setup Checklist

- [x] Tạo Supabase project tại [supabase.com](https://supabase.com)
- [x] Copy `Project URL` và `anon key` vào `.env.local`
- [x] Copy `service_role key` vào `.env.local` (⚠️ Không commit lên Git)
- [x] Tạo các Storage buckets (contracts, invoices, documents)
- [x] Cấu hình Storage policies
- [x] Bật Supabase Realtime cho bảng cần live update
- [x] Lưu environment variables vào Vercel Dashboard
- [x] Cài ImgBB API key vào Vercel + `.env.local`

---
*Last updated: 2026-03-08 | Tech Stack v3.0 — Next.js 16.1.6 + Supabase + ImgBB + Vercel + GitHub*

---

## 7. PWA & Mobile Camera Scanner

### Lý Do Chọn PWA Thay Vì Native App

| Tiêu chí | PWA (Web) | Native App |
|---|---|---|
| Cài đặt | Không cần App Store | Phải submit lên App Store |
| Camera access | ✅ `getUserMedia()` API | ✅ Native |
| Cập nhật | Auto khi deploy | User phải update |
| Chi phí | ✅ 0 (chung codebase) | Thêm 1–2 dev iOS/Android |
| Barcode scan | ✅ html5-qrcode / zxing | ✅ |
| Offline | ✅ Service Worker | ✅ |

**Kết luận: PWA đủ cho WMS mobile** — Thủ kho dùng Chrome (Android) hoặc Safari (iPhone).

### Cài Thêm Packages Cho Mobile Scanner

```bash
npm install html5-qrcode
# hoặc thay thế nhẹ hơn:
npm install @zxing/browser @zxing/library
```

### PWA Configuration (next.config)

```javascript
// next.config.ts
import withPWA from 'next-pwa'

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

// npm install next-pwa
```

### manifest.json (Cho "Add to Home Screen")

```json
{
  "name": "Wine ERP — Kho",
  "short_name": "WineKho",
  "description": "Quản lý kho rượu vang",
  "start_url": "/warehouse/scan",
  "display": "standalone",
  "background_color": "#0F0A08",
  "theme_color": "#C4963A",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192" }]
}
```

### Camera API Usage

```tsx
// components/scanner/QrScanner.tsx
import { Html5Qrcode } from 'html5-qrcode'

// Bắt đầu scan → onSuccess callback khi đọc được mã
const scanner = new Html5Qrcode('reader')
scanner.start(
  { facingMode: 'environment' }, // Camera sau
  { fps: 10, qrbox: { width: 200, height: 200 } },
  (decodedText) => handleScan(decodedText),
  undefined
)
```
