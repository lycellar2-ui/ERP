# Kế hoạch Chuẩn hóa UI/UX — Light Design System

> **Mục tiêu:** Mọi màn hình trong `wine-erp` dùng chung **1 bố cục trang, 1 bộ component, 1 bộ token**. Không còn mỗi trang một kiểu.
> **Phạm vi:** UI-only — không đổi logic nghiệp vụ, server actions hay schema.

---

## 0. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Theme | **Light** (bỏ hoàn toàn dark) |
| Trang mẫu gốc | **Sales** (`/dashboard/sales`) |
| Tạo/Sửa | **Drawer phải** cho form thường · **Trang riêng** cho form dài (hợp đồng, tờ khai) |
| Mật độ | **Compact** — dòng bảng 40px, chữ bảng 13px |
| Accent | **Teal `#0891B2`** |
| Triển khai | Foundation + Components → **Pilot 3 module** (Sales, Products, Customers) → duyệt → nhân rộng |

---

## 1. Cấu trúc trang chuẩn (Page Anatomy — rút từ Sales)

```
┌──────────────────────────────────────────────────────────────┐
│ PageHeader:  Tiêu đề · mô tả ngắn          [Phụ] [+ Tạo mới] │
├──────────────────────────────────────────────────────────────┤
│ StatCard × 4 (tùy chọn)                                      │
├──────────────────────────────────────────────────────────────┤
│ StatusTabs (Tất cả · Nháp · Chờ duyệt · ...)  [badge số]     │
│ FilterBar: [🔍 Tìm kiếm] [Lọc ▾] [Khoảng ngày ▾]  [Xóa lọc]  │
├──────────────────────────────────────────────────────────────┤
│ DataTable (sticky header, sort, row 40px, hover, chọn dòng)  │
│   < 768px → MobileCardList                                   │
├──────────────────────────────────────────────────────────────┤
│ Pagination                                                   │
└──────────────────────────────────────────────────────────────┘
Click dòng → DetailDrawer (phải, 720px) · Tạo/Sửa → FormDrawer (phải, 640px)
```

**Quy tắc:** Module nào không có tabs/KPI thì bỏ block đó, **không tự chế** block khác.

---

## 2. Design Tokens (chốt cuối — `globals.css`)

### 2.1 Màu
| Token | Hex | Dùng cho |
|---|---|---|
| `lys-bg` | `#F8FAFC` | Nền trang |
| `lys-surface` / `lys-card` | `#FFFFFF` | Card, bảng, drawer |
| `lys-subtle` | `#F1F5F9` | Header bảng, hover, input disabled |
| `lys-border` | `#E2E8F0` | Viền mặc định |
| `lys-border-strong` | `#CBD5E1` | Viền input, divider đậm |
| `lys-primary` | `#0F172A` | Text chính |
| `lys-secondary` | `#475569` | Text phụ, label |
| `lys-muted` | `#64748B` | Caption, placeholder |
| `lys-teal` | `#0891B2` | Accent: icon active, border focus, tab active |
| `lys-teal-strong` | `#0E7490` | **Text link & nền nút primary** (đạt contrast AA) |
| `lys-teal-soft` | `#ECFEFF` | Nền nhạt accent |

### 2.2 Tông trạng thái (thay 101 bảng màu cục bộ)
| Tone | Text | Nền | Viền | Ví dụ |
|---|---|---|---|---|
| `neutral` | `#475569` | `#F1F5F9` | `#E2E8F0` | DRAFT, INACTIVE |
| `info` | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` | IN_TRANSIT, SENT |
| `brand` | `#0E7490` | `#ECFEFF` | `#A5F3FC` | CONFIRMED |
| `success` | `#15803D` | `#F0FDF4` | `#BBF7D0` | PAID, DELIVERED |
| `warning` | `#B45309` | `#FFFBEB` | `#FDE68A` | PENDING_* |
| `danger` | `#B91C1C` | `#FEF2F2` | `#FECACA` | OVERDUE, REJECTED, CANCELLED |

→ Gom 5 màu đỏ (`#E05252`, `#EF4444`, `#E85D5D`, `#DC2626`, `#B91C1C`) về `danger`; 3 teal về `lys-teal*`.

### 2.3 Typography (Inter qua `next/font`)
| Class | Size/Line | Weight | Dùng cho |
|---|---|---|---|
| `type-page-title` | 20/28 | 600 | Tiêu đề trang |
| `type-section-title` | 15/22 | 600 | Tiêu đề card/drawer |
| `type-body` | 14/21 | 400 | Nội dung, form |
| `type-table` | 13/20 | 400 | Bảng |
| `type-caption` | 12/16 | 500 | Label, timestamp |
| `type-number` | — | tabular-nums | Tiền, số lượng |

Cormorant Garamond **chỉ** dùng cho logo/brand.

### 2.4 Hình khối
- Bo góc: **6px** (`rounded-md`) cho nút/input/badge · **8px** (`rounded-lg`) cho card/drawer/modal. **Cấm** `rounded-xl/2xl`.
- Shadow: `shadow-xs` (card) · `shadow-lg` (drawer/modal). Không dùng shadow khác.
- Spacing: padding trang 24px (desktop) / 16px (mobile), khoảng cách block 16px.
- Control height: 36px desktop / 44px mobile.

---

## 3. Bộ Component chuẩn — `src/components/ui/`

| Component | Ghi chú |
|---|---|
| `Button` | variants: primary · secondary · ghost · danger; sizes: sm · md; trạng thái loading (dùng `cva`) |
| `IconButton` | Có `aria-label` bắt buộc |
| `Badge` / `StatusBadge` | Đọc từ registry `src/lib/ui/status.ts` (status → tone + nhãn VI/EN) |
| `Card` | Header / Body / Footer |
| `StatCard` | Thay 5 bản `StatCard`/`SOStatCard`/`KpiCard` hiện tại |
| `PageHeader` | Tiêu đề, mô tả, slot actions — thay hack CSS ẩn tiêu đề trùng |
| `StatusTabs` | Tabs + badge đếm (rút từ `FilterTabs` của Sales) |
| `FilterBar` | Refactor từ `components/FilterBar.tsx` (sửa lỗi encoding tiếng Việt) |
| `DataTable` | Dùng `@tanstack/react-table` (đã cài): sort, sticky header, empty state, skeleton, mobile card |
| `Pagination` | Chuyển từ `DataPagination.tsx` |
| `Drawer` | Phải, size md (640px) / lg (720px), focus trap, đóng bằng Esc |
| `Modal` / `ConfirmDialog` | Chỉ dùng cho xác nhận ngắn |
| `Field`, `Input`, `Select`, `Textarea`, `DateInput` | Label + hint + error thống nhất |
| `EmptyState`, `Skeleton` | Trạng thái rỗng / đang tải |

---

## 4. Các giai đoạn

### P0 — Foundation (sửa nhanh) ✅
- [x] Load **Inter** qua `next/font` trong `app/layout.tsx`
- [x] `<Toaster theme="light">`
- [x] Chốt token §2 trong `globals.css` (+ tone tokens, motion tokens, `type-caption`, `radius-lg` 8px); sửa `::selection`, thanh cuộn
- [ ] Xóa hack `main > div > div:first-child h1 { display:none }` → **dời sang P2** (xóa ngay sẽ lộ tiêu đề trùng ở mọi trang; xóa khi các trang đã dùng `PageHeader`)
- [ ] CSS in ấn theo token mới → dời sang P4 (hiện vẫn ép `* { color: #1a1a1a }` nên không lỗi)
- [x] Viết lại `docs/architecture/ui-design-system.md` thành **1 bản Light duy nhất**

### P1 — Component Library ✅
- [x] Tạo `src/components/ui/`: Button, Badge/StatusBadge, Card, StatCard/StatGrid, PageHeader/PageContainer, StatusTabs, Drawer, Modal/ConfirmDialog, Field/Input/Select/Textarea, Table primitives, EmptyState/Skeleton
- [x] `src/lib/ui/status.ts` + unit test `test/ui-status.test.ts`
- [x] FilterBar & Pagination chuẩn (làm cùng pilot Sales; thêm `onPageHover` cho Products)

### P2 — Pilot 3 module
- [x] **Sales — màn danh sách** (`SalesClient.tsx` 3.670 → 3.400 dòng): PageHeader, StatCard, StatusTabs, Toolbar/SearchInput/FilterPanel, Table, Pagination, Badge theo registry; xóa 107 class `dark:`; thêm `Pagination` + `FilterBar` vào kit
- [x] **Sales — Drawer chi tiết** (`SODetailDrawer`), `CreateSODrawer`, `EditSODrawer` — vỏ `<Drawer>` + footer `Button` (form field bên trong giữ nguyên, đã Light qua codemod)
- [x] **Products** — `ProductsClient`, `ProductTable` (viết lại trên `Table`/`Pagination`), `ProductDrawer`, `ProductDetailDrawer`; `WineTypeBadge` dùng chung
- [x] **Customers** — PageHeader/Toolbar/Table/Pagination/StatusBadge; `CustomerDrawer` → `<Drawer>`
- [x] **Sidebar / Header** — token + hover CSS, bỏ `onMouseEnter` đổi màu
- [x] Chụp ảnh trước/sau cho từng trang (Playwright script, list + drawer cho Sales/Products/Customers)

### 🛑 P3 — Duyệt
- [x] Bạn duyệt 3 trang pilot → chỉnh → khóa chuẩn (duyệt qua ảnh so sánh trước/sau, 05/10/2026)

### P4 — Nhân rộng (33 module còn lại, theo đợt)
| Đợt | Module |
|---|---|
| 1 — Bán hàng | quotations, price-list, pos, returns, delivery, pipeline, crm, contracts, proposals — ✅ Hoàn tất 100% (cấu trúc UI kit đồng bộ Light theme, tsc 0 lỗi) |
| 2 — Kho & Mua | warehouse, transfers, stock-count, allocation, procurement, suppliers, shipments, declarations, stamps, consignment |
| 3 — Tài chính | finance, reconciliation, costing, margin, reports, kpi, market-price |
| 4 — Khác | hr, settings, audit-log, media, qr-codes, agency, ai, dashboard (CEO) |

### P5 — Rào chắn chống tái phát
- [ ] ESLint `no-restricted-syntax`: cấm hex trong `className` và `style={{ color/background/border }}`
- [ ] Cấm `rounded-xl/2xl`, `dark:`, `onMouseEnter` dùng để đổi màu
- [ ] Thêm checklist "UI chuẩn" vào `docs/` cho mọi module mới

---

## 5. Kiểm tra
- `npx tsc --noEmit` = 0 lỗi · `npm run lint` · `npm test`
- `python .agent/skills/frontend-design/scripts/ux_audit.py` + `accessibility_checker.py`
- Đếm lại số liệu (mục tiêu sau P4): hex inline **≈ 0**, `dark:` **= 0**, bảng status cục bộ **= 0**, token `lys-*` **> 0** ở mọi module

## 6. Rủi ro
| Rủi ro | Giảm thiểu |
|---|---|
| File khổng lồ (Sales 3.6k dòng) dễ vỡ logic khi tách | Chỉ di chuyển JSX/style, giữ nguyên handler; test thủ công luồng tạo/duyệt SO |
| Trang in (print) phụ thuộc hex cũ | Cập nhật CSS print theo token trong P0 |
| Email template & `QuotationPublicView` | **Ngoài phạm vi** (đã Light, có quy chuẩn riêng) |
