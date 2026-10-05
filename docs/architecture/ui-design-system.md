# UI/UX Design System — LY's Cellars Wine ERP (Light)

> **Nguồn chuẩn duy nhất (single source of truth)** cho giao diện ERP.
> Token nằm trong [`wine-erp/src/app/globals.css`](../../wine-erp/src/app/globals.css) · Component nằm trong [`wine-erp/src/components/ui/`](../../wine-erp/src/components/ui/) · Trạng thái nằm trong [`wine-erp/src/lib/ui/status.ts`](../../wine-erp/src/lib/ui/status.ts).
> Kế hoạch triển khai: [`ui-standardization-light.md`](../../ui-standardization-light.md).

---

## 1. Nguyên tắc

| Nguyên tắc | Ý nghĩa |
|---|---|
| **Light, dày dữ liệu** | Nền sáng, mật độ Compact — tối ưu cho kế toán, kho, sales admin |
| **Một bố cục cho mọi trang** | Người dùng chuyển module không cần học lại |
| **Token, không hardcode** | Không viết hex trong `className`/`style`. Dùng class `lys-*` / `tone-*` |
| **Component dùng chung** | Không tự viết lại Button, Badge, StatCard, Drawer trong module |
| **Teal là điểm nhấn** | Chỉ ~10% diện tích: nút chính, tab active, focus, link |

---

## 2. Bố cục trang chuẩn

```
PageHeader        Tóm tắt / số liệu nhanh                [Phụ] [+ Tạo mới]
StatGrid          StatCard × 2–6 (tùy chọn, có thể thu gọn)
Toolbar           StatusTabs (bên trái)  ·  SearchInput + khoảng ngày + [Bộ lọc] (bên phải)
FilterPanel       Bộ lọc nâng cao (thu gọn được)
Table             header dính, sort, dòng 40px  (< 768px → danh sách thẻ)
Pagination
```

- **Tiêu đề trang** do Header chung hiển thị theo route → trong trang dashboard **không lặp lại tiêu đề**; `PageHeader` chỉ chứa mô tả/tóm tắt + nút. Chỉ truyền `title` cho trang đứng riêng (in, public, form dài).
- Mã chứng từ (số SO, PO…) trong bảng là link `lys-teal-strong` mở Drawer chi tiết.

- Bấm 1 dòng → **Drawer chi tiết** (phải, `lg` 720px).
- Tạo/Sửa → **Drawer form** (phải, `md` 640px). Form rất dài (hợp đồng, tờ khai) → **trang riêng**.
- **Modal** chỉ dùng cho xác nhận ngắn (`ConfirmDialog`) — không đặt form trong modal. Không dùng `window.confirm`.
- Module không có KPI/tab thì **bỏ block đó**, không tự chế block khác.

```tsx
<PageContainer>
  <PageHeader description={<InlineStats />} actions={<Button>+ Tạo đơn</Button>} />
  <StatGrid>{/* StatCard */}</StatGrid>
  <Toolbar left={<StatusTabs items={tabs} value={status} onChange={setStatus} hideEmpty />}
           right={<><SearchInput /><Button variant="secondary">Bộ lọc</Button></>} />
  {showFilters && <FilterPanel>{/* Field + Select */}</FilterPanel>}
  <Table>...</Table>
  <Pagination page={page} pageSize={size} total={total} onPageChange={...} />
</PageContainer>
```

---

## 3. Màu sắc

### 3.1 Nền, viền, chữ
| Token (class) | Hex | Dùng cho |
|---|---|---|
| `lys-bg` | `#F8FAFC` | Nền trang |
| `lys-surface` / `lys-card` | `#FFFFFF` | Card, bảng, drawer, modal |
| `lys-subtle` | `#F1F5F9` | Header bảng, hover dòng, input disabled |
| `lys-border` | `#E2E8F0` | Viền mặc định, divider |
| `lys-border-strong` | `#CBD5E1` | Viền input, nút secondary |
| `lys-primary` | `#0F172A` | Chữ chính |
| `lys-secondary` | `#475569` | Label, chữ phụ |
| `lys-muted` | `#64748B` | Caption, mô tả |
| `lys-dim` | `#94A3B8` | Placeholder, icon mờ |

### 3.2 Accent (Teal)
| Token | Hex | Dùng cho |
|---|---|---|
| `lys-teal` | `#0891B2` | Icon active, viền focus, gạch chân tab active |
| `lys-teal-strong` | `#0E7490` | **Chữ link, nền nút primary** (đạt WCAG AA trên nền trắng) |
| `lys-teal-hover` | `#155E75` | Hover nút primary |
| `lys-teal-soft` | `#ECFEFF` | Nền nhạt: dòng được chọn, badge đếm tab active |

> `#0891B2` chỉ đạt ~3.7:1 trên nền trắng → **không dùng cho chữ nhỏ**. Chữ teal luôn dùng `lys-teal-strong`.

### 3.3 Tông trạng thái
Mọi badge trạng thái dùng `<StatusBadge>` → tone lấy từ `getStatusTone()` trong `src/lib/ui/status.ts`. **Không khai báo bảng màu trạng thái trong module.**

| Tone | Chữ | Nền | Viền | Trạng thái điển hình |
|---|---|---|---|---|
| `neutral` | `#475569` | `#F1F5F9` | `#E2E8F0` | DRAFT, INACTIVE, UNDELIVERED |
| `warning` | `#B45309` | `#FFFBEB` | `#FDE68A` | PENDING_*, PREPARING, UNPAID |
| `info` | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` | IN_TRANSIT, PARTIALLY_*, SENT |
| `brand` | `#0E7490` | `#ECFEFF` | `#A5F3FC` | CONFIRMED, APPROVED, INVOICED, ACTIVE |
| `success` | `#15803D` | `#F0FDF4` | `#BBF7D0` | PAID, DELIVERED, COMPLETED |
| `danger` | `#B91C1C` | `#FEF2F2` | `#FECACA` | CANCELLED, REJECTED, OVERDUE |

Class: `text-tone-{tone}-fg`, `bg-tone-{tone}-bg`, `border-tone-{tone}-border`.
Module cần khác chuẩn → truyền `toneOverrides` vào `StatusBadge`, không tự đặt màu.

**Số liệu:** số âm/lỗ → `text-tone-danger-fg`; số dương/lãi → `text-tone-success-fg`.

---

## 4. Typography

Font UI: **Inter** (tải qua `next/font`, biến `--font-inter`). **Cormorant Garamond** chỉ dùng cho logo/thương hiệu.

| Class | Size / Line | Weight | Dùng cho |
|---|---|---|---|
| `type-page-title` | 20 / 28 | 700 | Tiêu đề trang (`PageHeader`) |
| `type-section-title` | 15 / 22 | 600 | Tiêu đề card, drawer, modal |
| `type-body` | 14 / 21 | 400 | Nội dung, mô tả |
| `type-table` | 13 / 20 | 400 | Ô bảng, input (desktop) |
| `type-caption` | 12 / 16 | 500 | Label form, timestamp, phụ đề |
| `type-number` / `type-money` | — | — | Tiền, số lượng (`tabular-nums`) |

- Không đặt `fontFamily` inline.
- Input trên mobile dùng 16px (tránh iOS tự zoom) — đã có sẵn trong `Input`.

---

## 5. Hình khối, khoảng cách, chuyển động

| Hạng mục | Chuẩn |
|---|---|
| Bo góc control (nút, input, badge) | `rounded-md` — 6px |
| Bo góc container (card, bảng, drawer, modal) | `rounded-lg` — 8px |
| **Cấm** | `rounded-xl`, `rounded-2xl`, `rounded-full` cho badge |
| Shadow | `shadow-xs` (card, nút) · `shadow-lg` (drawer, modal) |
| Chiều cao control | 36px desktop · 44px mobile |
| Dòng bảng | 40px (Compact) |
| Khoảng cách block | `gap-4` (16px) · padding card `p-4` |
| Chuyển động | 200ms ease-out, chỉ `transform`/`opacity`: `animate-fade-in`, `animate-drawer-in`, `animate-modal-in` |
| Hover | Bằng class CSS (`hover:`) — **không** dùng `onMouseEnter` để đổi màu |

---

## 6. Component Library — `src/components/ui`

Import: `import { Button, StatusBadge, Drawer } from '@/components/ui'`

| Component | API chính | Ghi chú |
|---|---|---|
| `Button` | `variant`: primary · secondary · ghost · link · danger · danger-outline · `size`: sm · md · icon · icon-sm · `loading` | Một nút primary mỗi vùng |
| `Badge` / `StatusBadge` | `tone` · `icon` / `status`, `label`, `toneOverrides` | Label truyền vào đã dịch (VI/EN) |
| `Card`, `CardHeader`, `CardBody`, `CardFooter` | `title`, `description`, `actions` | |
| `StatCard`, `StatGrid` | `label`, `value`, `sub`, `icon`, `tone`, `trend`, `onClick`, `active` | Thay mọi `StatCard`/`SOStatCard`/`KpiCard` cục bộ |
| `PageHeader`, `PageContainer` | `title?`, `description`, `actions` | `title` bỏ trống trên route dashboard |
| `StatusTabs` | `items[{value,label,count}]`, `value`, `onChange`, `hideEmpty` | |
| `Toolbar`, `SearchInput`, `FilterPanel` | `left`, `right` · props của input · grid 2/4/8 cột | |
| `Pagination` | `page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange`, `itemLabel`, `isEn`, `onPageHover` | Logic số trang: `src/lib/ui/pagination.ts`. `onPageHover` để prefetch trang kế |
| `Drawer` | `open`, `onClose`, `title`, `description`, `headerExtra`, `actions`, `footer`, `size` sm·md·lg·xl (480/640/720/960), `className` | Esc để đóng (chặn lan truyền), giữ focus, khóa cuộn. Drawer chi tiết/form dùng `className="bg-lys-bg"` để các Card trắng bên trong nổi lên. Nút phụ bên trái footer: thêm `className="mr-auto"` |
| `Modal`, `ConfirmDialog` | `danger`, `loading`, `confirmLabel` | Thay `window.confirm` |
| `Field`, `Input`, `Select`, `Textarea` | `label`, `hint`, `error`, `required` · `invalid` | `Field` dùng render-prop `{id => <Input id={id}/>}` |
| `Table`, `THead`, `TBody`, `Tr`, `Th`, `Td`, `TableMessageRow` | `Th`: `sort`, `onSort`, `align` · `Td`: `align` · `Tr`: `selected` | Cột số dùng `align="right"` |
| `EmptyState`, `Skeleton`, `TableSkeleton` | | Skeleton thay spinner khi tải danh sách |

**Component nghiệp vụ dùng chung** (ngoài kit, trong `src/components/`):

| Component | Ghi chú |
|---|---|
| `WineTypeBadge` | Bảng màu **danh mục** loại vang (đỏ/trắng/nổ/hồng/fortified/dessert) — ngoại lệ có chủ đích, tách khỏi tông trạng thái. Dùng ở Products, Product detail, Margin |

---

## 7. Icon & hình ảnh
- **Lucide React**. Kích thước: 12–14px (trong badge/nút sm), 16px (nút), 18px (header), 20–24px (điều hướng).
- Ảnh sản phẩm: tỉ lệ `3:4`, fallback silhouette màu `lys-dim`.

## 8. Accessibility
- WCAG AA: chữ thường ≥ 4.5:1 — vì vậy chữ teal dùng `lys-teal-strong`.
- Focus: viền 2px `lys-teal` (global `:focus-visible`).
- Nút chỉ có icon phải có `aria-label`.
- Vùng chạm ≥ 44×44px trên mobile (đã có sẵn trong `Button`/`Input`).

## 9. Quy tắc bắt buộc khi viết UI mới
1. Dùng component trong `@/components/ui` trước — chỉ tạo mới khi chưa có, và thêm vào kit thay vì để trong module.
2. Không hex trong `className` (`bg-[#...]`) hay `style={{ color/background/border }}`.
3. Không thêm class `dark:` (hệ thống chỉ có Light).
4. Không khai báo `STATUS_COLORS`/`STATUS_CFG` màu cục bộ — chỉ map **nhãn**, màu lấy từ `StatusBadge`.
5. Email template và `QuotationPublicView` có quy chuẩn riêng (inline CSS do email client) — ngoài phạm vi kit.
6. Không đổi màu bằng `onMouseEnter/onMouseLeave` — dùng `hover:` class. (`onMouseEnter` chỉ dùng cho prefetch.)

**Codemod hỗ trợ migrate:** `node scripts/ui-palette-codemod.mjs [--dry] <paths>` — đổi hex/rgba Dark cũ sang Light, `text-*-300/400` nhạt → `-700`, xóa `dark:`. Chạy trước khi thay component; không chạy cho trang in (`*/print/*`).

---

## 10. Nhật ký thay đổi

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| **v3.3** | 2026-10-05 | Hoàn thành 100% Đợt 1 (Bán hàng): Chuyển cấu trúc toàn diện sang UI kit chuẩn cho POS, Pipeline, Contracts, CRM, Proposals, Quotations (`PageHeader`, `StatGrid`, `StatCard`, `Toolbar`, `Table`, `Drawer`, `Badge`). TypeScript type-checking 0 lỗi. |
| **v3.2** | 2026-10-05 | Pilot được duyệt. Đợt 1: codemod màu cho 25 file (quotations, price-list, pos, returns, delivery, pipeline, crm, contracts, proposals); chuyển cấu trúc sang kit cho Returns, Price List, Delivery (kèm E-POD/Create drawer). Lưu ý: `Toolbar` nhận `left`/`right`, không nhận children; `TableMessageRow` có `p-0` → luôn bọc `EmptyState`/`TableSkeleton` bên trong. |
| **v3.1** | 2026-10-05 | Pilot xong: Sales (list + 3 drawer), Products (list, bảng, 2 drawer), Customers (list + drawer), Sidebar/Header. Thêm `Drawer.actions`, `Pagination.onPageHover`, `WineTypeBadge` dùng chung (bỏ màu tím Fortified ở Margin). Script `ui-palette-codemod.mjs` + test. |
| **v3.0** | 2026-10-05 | Viết lại tài liệu thành 1 bản Light duy nhất (bỏ spec Dark cũ & đoạn lặp). Tải Inter qua `next/font`, Toaster light. Thêm token `lys-teal-strong/hover/soft`, 6 tông trạng thái `tone-*`, token chuyển động, `type-caption`; `radius-lg` 10→8px. Tạo `src/components/ui` (11 nhóm component) + `src/lib/ui/status.ts`. |
| v3.5 | 2026-10-05 | Hoàn tất Đợt 3 (Tài chính & Kế toán — 7 module): finance, reconciliation, costing, margin, reports, kpi, market-price. Chuẩn hóa PageHeader, StatGrid, StatCard, Button, drawer Light, loại bỏ rounded-2xl/xl và màu cũ. |
| v3.4 | 2026-10-05 | Hoàn tất Đợt 2 (Kho & Mua hàng — 10 module): warehouse, transfers, stock-count, allocation, procurement, suppliers, shipments, declarations, stamps, consignment. Loại bỏ toàn bộ rounded-2xl/xl, chuẩn hóa PageHeader, StatGrid, Button, loại bỏ dark hover/tokens. |
| v3.3 | 2026-10-05 | Hoàn tất Đợt 1 (Bán hàng — 9 module): quotations, price-list, pos, returns, delivery, pipeline, crm, contracts, proposals. |
| v3.2 | 2026-10-05 | Pilot 3 module: Sales (full), Products (full), Customers (full). Duyệt trước/sau. |
| v3.1 | 2026-10-05 | Triển khai UI kit `src/components/ui/` + `src/lib/ui/status.ts`. |
| v3.0 | 2026-10-05 | Chuyển toàn bộ sang chuẩn Light duy nhất. Bỏ Dark theme. |
| v2.2 | 2026-09-24 | Codemod 123 file từ hex Dark sang Light; xóa ~240 dòng CSS override `!important`. |
| v1.x | — | Spec "Oceanic Cellar" Dark (đã ngừng dùng). |

### Tiến độ chuẩn hóa module
| Trạng thái | Module |
|---|---|
| ✅ Đã chuẩn hóa | **Sales** — danh sách, SODetailDrawer, CreateSODrawer, EditSODrawer |
| ✅ Đã chuẩn hóa | **Products** — danh sách, ProductTable, ProductDrawer, ProductDetailDrawer |
| ✅ Đã chuẩn hóa | **Customers** — danh sách, CustomerDrawer (vỏ + footer; form bên trong còn style cũ đã Light) |
| ✅ Đã chuẩn hóa | **Sidebar / Header** |
| ✅ Đã chuẩn hóa | **Returns** — danh sách + drawer tạo đơn trả |
| ✅ Đã chuẩn hóa | **Price List** — tab Bảng Giá Chung, drawer tạo, modal thêm SP |
| ✅ Đã chuẩn hóa | **Delivery** — danh sách, E-POD drawer, Create Route drawer |
| ✅ Đã chuẩn hóa | **POS** — POSClient + LoyaltyPanel (Light tokens, Modal, Button) |
| ✅ Đã chuẩn hóa | **Pipeline** — PipelineClient (PageHeader, StatGrid, Toolbar, Drawer, Modal) |
| ✅ Đã chuẩn hóa | **Contracts** — ContractsPage + ContractsClient (PageHeader, StatGrid, Table, Drawer) |
| ✅ Đã chuẩn hóa | **CRM** — CRMClient (PageHeader, StatGrid, StatCard, Tabs, Cards) |
| ✅ Đã chuẩn hóa | **Quotations** — QuotationClient (Table, StatusBadge, Thumbnail Light, Mobile cards) |
| ✅ Đã chuẩn hóa | **Proposals** — ProposalsClient (Header, StatCards, Filter bar, Action buttons) |
| ✅ Đã chuẩn hóa | **Warehouse** — WarehouseClient + 8 tabs (chuyển rounded-2xl/xl sang rounded-lg/md, chuẩn hóa light tokens) |
| ✅ Đã chuẩn hóa | **Transfers** — TransfersClient + CreateTransferDrawer + TransferDetailDrawer (PageHeader, Toolbar, Table, Drawer) |
| ✅ Đã chuẩn hóa | **Stock Count** — StockCountClient + Modals (PageHeader, StatCard, loại bỏ mint hover #76BAA8, chuẩn hóa Button) |
| ✅ Đã chuẩn hóa | **Allocation** — AllocationClient (PageHeader, StatGrid, StatCard, Button) |
| ✅ Đã chuẩn hóa | **Procurement** — ProcurementClient + ShipmentDetailDrawer (High-density Light bar, Table, Drawer) |
| ✅ Đã chuẩn hóa | **Suppliers** — SuppliersClient + SupplierDetailDrawer (PageHeader, StatGrid, Button, Table, Drawer) |
| ✅ Đã chuẩn hóa | **Shipments** — ShipmentsClient (PageHeader, Button, Table hover Light) |
| ✅ Đã chuẩn hóa | **Declarations** — declarations/page.tsx (PageHeader, StatGrid, Button, Table) |
| ✅ Đã chuẩn hóa | **Stamps** — StampsClient (bỏ background #1A2F3F, PageHeader, Button, Table) |
| ✅ Đã chuẩn hóa | **Consignment** — ConsignmentClient + Printable reports (PageHeader, StatGrid, Button) |
| ✅ Đã chuẩn hóa | **Finance** — FinanceClient + FinanceTabs + InvoiceReconciliationTab (PageHeader, light palette, tabs, export) |
| ✅ Đã chuẩn hóa | **Reconciliation** — reconciliation/loading.tsx (chuẩn hóa skeleton light, rounded-lg) |
| ✅ Đã chuẩn hóa | **Costing** — CostingClient + LandedCostTab (PageHeader, StatGrid, StatCard, Tab buttons) |
| ✅ Đã chuẩn hóa | **Margin** — MarginClient + margin/page.tsx (chuẩn hóa border radius rounded-lg/md, light workbench) |
| ✅ Đã chuẩn hóa | **Reports** — ReportsClient (PageHeader, StatGrid, StatCard, Excel export UI, scheduler table) |
| ✅ Đã chuẩn hóa | **KPI** — KpiClient (PageHeader, StatGrid, StatCard tone, Setup tabs, clean target table) |
| ✅ Đã chuẩn hóa | **Market Price** — MarketPriceClient (PageHeader, StatGrid, StatCard, Button, drawer light, comparison table) |
| ⏳ Chờ | **Đợt 4: Khác** (hr, settings, audit-log, media, qr-codes, agency, ai, dashboard) |
