# Kế hoạch Refactor Design Tokens & Xóa Bỏ CSS Overrides

> **Mục tiêu:** Chuẩn hóa toàn bộ hệ thống màu sắc theo Light ERP Design System ("Oceanic Cellar Light"), chuyển đổi triệt để 125 tệp mã nguồn từ các mã màu dark hardcoded sang màu chuẩn Light Mode/Tailwind, và xóa bỏ hoàn toàn 250+ dòng CSS override `!important` trong `globals.css`.

---

## 1. Phạm Vi Công Việc & Ánh Xạ Màu Sắc

| Màu Cũ (Dark Hex) | Tên Cũ | Màu Mới (Light Hex) | Token Semantic Tailwind / CSS Var |
|---|---|---|---|
| `#0A1926` | Deep Navy (Nền tối) | `#F8FAFC` / `#0F172A` (nếu text badge) | `var(--color-lys-bg)` / `bg-slate-50` / `text-slate-900` |
| `#142433` | Midnight Teal (Surface) | `#FFFFFF` | `var(--color-lys-surface)` / `bg-white` |
| `#1B2E3D` / `#0F2133` / `#0F1E2E` | Steel Blue (Card/Input) | `#FFFFFF` (Card) / `#F8FAFC` (Input bg) | `var(--color-lys-card)` / `bg-white` |
| `#1F3547` / `#1F3E4D` / `#16232F` | Midnight Card/Nav | `#FFFFFF` / `#F1F5F9` | `bg-white` / `bg-slate-100` |
| `#2A4355` / `#223645` | Ocean Border | `#E2E8F0` | `var(--color-lys-border)` / `border-slate-200` |
| `#E8F1F2` / `#C8D8E4` | Cool White (Text chính) | `#0F172A` | `var(--color-lys-primary)` / `text-slate-900` |
| `#8AAEBB` | Steel Muted (Text phụ) | `#475569` | `var(--color-lys-secondary)` / `text-slate-600` |
| `#4A6A7A` | Deep Muted (Text mờ/placeholder)| `#64748B` | `var(--color-lys-muted)` / `text-slate-500` |
| `#87CBB9` | Accent Teal (Text trên nền trắng) | `#0891B2` (Darker Teal for high contrast) | `var(--color-lys-teal)` / `text-cyan-600` |

---

## 2. Các Bước Thực Hiện

### Giai Đoạn 1: Chuẩn Hóa Design Tokens Trong `globals.css`
1. Cập nhật `@theme` trong `wine-erp/src/app/globals.css`:
   - Khai báo đầy đủ các token semantic cho Light Mode:
     - `--color-lys-bg: #F8FAFC;`
     - `--color-lys-surface: #FFFFFF;`
     - `--color-lys-card: #FFFFFF;`
     - `--color-lys-subtle: #F1F5F9;`
     - `--color-lys-border: #E2E8F0;`
     - `--color-lys-border-strong: #CBD5E1;`
     - `--color-lys-primary: #0F172A;`
     - `--color-lys-secondary: #475569;`
     - `--color-lys-muted: #64748B;`
     - `--color-lys-dim: #94A3B8;`
     - `--color-lys-navy: #1E3A8A;`
     - `--color-lys-teal: #0891B2;`
     - `--color-lys-teal-light: #06B6D4;`
     - `--color-lys-wine: #B91C1C;`
     - `--color-lys-amber: #D97706;`
   - Khai báo `:root` tương ứng.
   - Bổ sung alias tương thích cũ (`--color-lys-ivory: #0F172A;`).

### Giai Đoạn 2: Xử Lý Các Tệp Đặc Thù (Email & Public View)
1. **Email Templates (`src/lib/notifications.ts`)**:
   - Chuyển đổi inline CSS trong template HTML sang màu sáng chuẩn email client (nền trắng `#FFFFFF`, header `#F8FAFC`, viền `#E2E8F0`, chữ `#0F172A`, nút bấm `#0891B2`).
2. **Public Quotation View (`src/app/verify/quotation/[token]/QuotationPublicView.tsx`)**:
   - Chuyển đổi toàn diện sang Light Luxury Wine theme đồng bộ với ERP.

### Giai Đoạn 3: Viết & Chạy Codemod Chuyển Đổi Trên 125 Tệp Mã Nguồn
1. Viết script `tools/migrate-tokens.js`:
   - Thay thế các class Tailwind: `bg-[#0A1926]` → `bg-[#F8FAFC]` hoặc `bg-slate-50`, `bg-[#142433]` → `bg-white`, `border-[#2A4355]` → `border-slate-200`, `text-[#E8F1F2]` → `text-slate-900`, `text-[#8AAEBB]` → `text-slate-600`, `text-[#4A6A7A]` → `text-slate-500`...
   - Thay thế các inline style hex: `#142433` → `#FFFFFF`, `#1B2E3D` → `#FFFFFF`, `#2A4355` → `#E2E8F0`, `#E8F1F2` → `#0F172A`, `#8AAEBB` → `#475569`, `#4A6A7A` → `#64748B`...
   - Xử lý các sự kiện hover động: `onMouseEnter/onMouseLeave` đổi sang mã màu hover sáng (`#F1F5F9`).
2. Thực thi codemod trên toàn bộ `src/`.

### Giai Đoạn 4: Xóa Bỏ Hoàn Toàn Khối CSS Override Trong `globals.css`
1. Xóa các rule `[style*="#..."]`, `[class*="bg-[#..."]` dài ~250 dòng trong `globals.css`.
2. Giữ lại các utility helper sạch sẽ, không có bất kỳ selector đè `!important` nào.

### Giai Đoạn 5: Kiểm Tra & Đồng Bộ Tài Liệu (Verification & Docs Sync)
1. Chạy `npx tsc --noEmit` để đảm bảo không có lỗi biên dịch TypeScript.
2. Kiểm tra layout tổng thể (`DashboardShell`, `Sidebar`, `Header`, `QuotationClient`).
3. Cập nhật tài liệu:
   - `docs/architecture/ui-design-system.md`
   - `docs/architecture/tech-stack.md` (nếu cần)
   - `docs/README.md`
