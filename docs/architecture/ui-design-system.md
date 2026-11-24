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
- **Modal** chỉ dùng cho xác nhận ngắn (`ConfirmDialog`) — không đặt form trong modal. Tuyệt đối không dùng `window.confirm`.
- **Hộp thoại xác nhận (`useConfirmDialog`):** Cấm hoàn toàn `window.confirm()`. Toàn bộ 54 vị trí đã được chuẩn hóa qua hook `const { confirm, dialog } = useConfirmDialog()` từ `@/components/ui`:
  ```tsx
  // Cách 1: Async Promise (Khuyên dùng)
  const ok = await confirm({
    title: 'Xóa chỉ tiêu',
    message: 'Bạn có chắc chắn muốn xóa chỉ tiêu này?',
    confirmLabel: 'Xóa',
    variant: 'danger', // hoặc warning
  })
  if (!ok) return
  await deleteAction()

  // Cách 2: Callback lifecycle với auto-loading spinner
  confirm({
    title: 'Hủy đơn',
    message: 'Bạn có chắc muốn hủy đơn hàng này?',
    danger: true,
    confirmLabel: 'Hủy đơn',
    onConfirm: async () => { await cancelMutation.mutateAsync(id) }
  })
  ```
  *Lưu ý: Luôn render `{dialog}` trước thẻ đóng `</div>` hoặc Fragment của component/drawer.*
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
| `StatCard`, `StatGrid` | `label`, `value`, `sub`, `icon`, `tone`, `trend`, `onClick`, `active` · `StatGrid`: `cols` 2·3·4·5·6 | Thay mọi `StatCard`/`SOStatCard`/`KpiCard` cục bộ |
| `PageHeader`, `PageContainer` | `title?`, `description`, `actions` | `title` bỏ trống trên route dashboard |
| `StatusTabs` | `items[{value,label,count,icon?}]`, `value`, `onChange`, `hideEmpty` | |
| `Toolbar`, `SearchInput`, `FilterPanel` | `left`, `right` · props của input · grid 2/4/8 cột | |
| `Pagination` | `page`, `pageSize`, `total`, `onPageChange`, `onPageSizeChange`, `itemLabel`, `isEn`, `onPageHover` | Logic số trang: `src/lib/ui/pagination.ts`. `onPageHover` để prefetch trang kế |
| `Drawer` | `open`, `onClose`, `title`, `description`, `headerExtra`, `actions`, `footer`, `size` sm·md·lg·xl (480/640/720/960), `className` | Esc để đóng (chặn lan truyền), giữ focus, khóa cuộn. Drawer chi tiết/form dùng `className="bg-lys-bg"` để các Card trắng bên trong nổi lên. Nút phụ bên trái footer: thêm `className="mr-auto"` |
| `Modal`, `ConfirmDialog` | `Modal`: `size` sm·md·lg·xl · `ConfirmDialog`: `danger`, `loading`, `confirmLabel` | Thay `window.confirm` |
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
| **v4.5** | 2026-11-24 | **UI/UX Deep System-Wide Overhaul Đợt 3**: (1) Căn giữa đồng bộ toàn bộ 24 wrapper & skeleton loading còn thiếu `mx-auto` (bỏ padding kép ở `sop/loading.tsx`), xóa bỏ hiện tượng trang nhảy lệch ngang trên màn hình rộng; (2) Sửa toàn bộ lưới 5–6 cột bị bóp trên màn hình laptop 1024px–1280px sang responsive breakpoint (`xl:grid-cols-5`, `2xl:grid-cols-6`) trên 20+ file (`CeoOverviewContent` cả khối KPI & mục tiêu con, `CustomersClient`, `PipelineClient`, `PipelinePanel`, `RegDocsTab`, `LandedCostTab`, `SalesVisitsClient`, `WarehouseClient`, `InspectionTab`, `SampleInventoryTab`, `StockMovementTab`, `InvoiceReconciliationTab`, `MediaClient`, `AICRMAnalysis`, `AIPipelineAnalysis`, skeleton loading); (3) Chuẩn hóa đồng bộ 76 lớp nền overlay modal/drawer (`fixed inset-0`) về `bg-slate-900/35 backdrop-blur-[2px]`; (4) Refactor giao diện trọng tâm: `SalesClient` gộp 3 nút xuất thành menu dropdown + tách `FilterTabs` lên hàng riêng + dùng `PageContainer`/`StatGrid cols={6}`; `WarehouseClient` bỏ card tiêu đề trùng lặp Header + nâng nút Tạo kho làm primary CTA + dùng `StatGrid cols={6}`; `MarginClient` sửa nền xám-trên-xám (`bg-lys-card`) và xóa `overflow-hidden` gây cắt dropdown SKU/tooltip + đồng bộ `h-9`/`Button`; `ConsignmentClient` xóa dấu `+` kép, đặt nút chính cuối, bỏ banner lặp và bỏ 4 viền bảng kép quanh `<Table>`, dùng `<StatusBadge>`; (5) Chuẩn hóa đồng bộ `QuotationClient` (xóa JS hover hack, viền kép, thêm `<PageHeader>`/`<StatGrid cols={5}>`/`<StatusBadge>`/`<EmptyState>`), `ProposalsClient` (tách bar lọc khỏi hàng tab, `StatGrid cols={5}`), `HrClient` (`StatGrid cols={6}`, `<SearchInput>`, `<Select>`, xóa hover `#68B9A5`, sửa `thead` trắng-trên-trắng), `SuppliersClient` (`<StatusTabs>`, `<SearchInput>`, `<Select>`), `ReportsClient` (`<StatusTabs>`, bỏ inline card style), `StockCountClient` (`<PageHeader>`, `<StatGrid cols={4}>`, `<StatusTabs>`, `<SearchInput>`, hạ `<h1>` ở `ModernStockCountView`), và `StampsClient` (sắp lại nút hành động chính sang phải). |
| **v4.4** | 2026-11-24 | **UI/UX Deep Structural & Visual Polish Đợt 2**: (1) Sửa 47 token `lys-*` chưa định nghĩa (`border-lys-teal-subtle` → `border-tone-brand-border`, `text-lys-title` → `text-lys-primary`, `text-lys-text-sec` → `text-lys-secondary`) và 38 vị trí lạm dụng `lys-primary` (`#0F172A`) làm màu nhấn tại `Contracts*`, `CRMClient`, `TransfersClient` → dùng `lys-teal-strong`/`lys-teal-soft`; (2) Sửa `StatGrid` breakpoint cho laptop 1024px (`4`: `xl:grid-cols-4`, `5`: `xl:grid-cols-5`, `6`: `2xl:grid-cols-6`), căn giữa `PageContainer` (`mx-auto`), nâng `Header` lên `z-30` tránh che dropdown, sửa căn giữa icon + khoảng cách nhóm + xóa tooltip bị cắt `overflow-y` ở `Sidebar`; (3) Sửa `POSClient` khớp header 48px và padding `<main>`, bỏ padding kép trên `hr`, `stamps`, `settings/telegram`, `pos/loyalty`, đồng bộ width `dashboard`/`CustomerAnalyticsDashboard`, dọn header rời ở `ApprovalMatrixClient` và `SopCatalogClient`; (4) Gộp hàng tab + nút thao tác `DashboardHeaderNav` và thu gọn `DashboardFilterBar` thành 1 dòng segmented bar; (5) Chia 15 tab `FinanceClient` thành switcher 2 nhóm (Vận hành \| Kế toán) + `<StatusTabs>`, bọc `Toolbar.left` bằng `flex` sửa lỗi search/select xếp dọc, căn badge `Export-Only`; (6) Tách `<StatusTabs>` và thanh lọc trong `ProcurementClient`, chuẩn hóa nền bảng `bg-lys-card`, thu gọn footer 1 dòng ở Create/Edit PO Drawer, mở rộng PO Detail Drawer lên `size="lg"`; (7) Nâng tương phản section form trắng trên nền `bg-lys-bg` trong `CreatePaymentRequestDrawer`, và đồng nhất `<StatusTabs>` cho `ContractsPage`, `CRMClient`, `TransfersClient`, `ProductsClient`. |
| **v4.3** | 2026-11-24 | **UI/UX Refinement Đợt 1 — Subtle Luxury Light ERP, Shell & Core Workflows**: (1) Nâng cấp UI Kit (`StatGrid` thêm `cols?: 2\|3\|4\|5\|6`, `StatusTabs` thêm `icon`, `Modal` thêm `size`, thống nhất backdrop `bg-slate-900/35 backdrop-blur-[2px]` & nút đóng trên `Drawer`/`Modal`, `Table` thêm `shadow-xs` + `THead` translucent sticky, bỏ `maximumScale: 1` trong `layout.tsx` để hỗ trợ pinch-zoom WCAG); (2) Chuẩn hóa Shell (`Header` 48px kèm breadcrumb nhóm > trang, bổ sung route `/dashboard/guides`, `/dashboard/sales/print`, `/dashboard/warehouse/print`, `guides/loading.tsx`; `Sidebar` bỏ nhóm `Marketing` rỗng & ngôn ngữ/logout trùng lặp); (3) Chuẩn hóa các trang standalone & lỗi (`/login`, `/partner-login`, `/kiem-ke/bien-ban`, `404`/`error`/`global-error`, `/dashboard/guides` dùng `useConfirmDialog` xóa `window.confirm`); (4) Refactor toàn diện CEO Dashboard (`DashboardHeaderNav`, `DashboardFilterBar`, `DailyRevenueChart`, `CeoOverviewContent`), Payment Requests (`PaymentRequestsClient`, `CreatePaymentRequestDrawer` bỏ brand đỏ `#B91C1C`), Finance (`FinanceClient`, `BankReconciliationTab`, bỏ `@/components/FilterBar`), Procurement (`ProcurementClient` chuyển 3 drawer & modal sang UI Kit, sửa 3 nút chữ tối trên nền đậm), Settings (`SettingsClient` chuyển 5 drawer sang UI Kit); (5) Xóa `#0891B2` nền nút chữ trắng còn sót (`FinanceClient`, `GoodsReceiptTab`), xóa nút `#D97706` (`WarehouseClient`), dọn sạch toàn bộ `<PageHeader title=...>` & tiêu đề trang trùng lặp trên 15+ file để bỏ rule CSS ẩn hack trong `globals.css`. |
| **v4.2** | 2026-11-18 | **Audit Toàn Hệ Thống — Xóa 100% Native Prompt/Confirm, Hydration Locale & WCAG AA**: (1) Thay thế toàn bộ 9 vị trí `window.confirm()` / `prompt()` còn sót tại `ParentPaymentImportTab.tsx` (`useConfirmDialog`), `CustomerRulesTab.tsx` (4 lời gọi → controlled modal), `ProposalsClient.tsx` (4 lời gọi → controlled reason modal), và `WarehouseMapTab.tsx` (`prompt` nhãn → controlled modal); (2) Nâng cấp tương phản hover nút `bg-[#0E7490] hover:bg-[#155E75]`, đổi `rounded-full` sang `rounded-md` trên badge tại `ParentPaymentImportTab`, sửa viền trắng-trên-trắng `#FFFFFF` → `#E2E8F0` trong `ExcelImportDialog`, hạ 2 `<h1>` thừa trong bản in `TransferDetailDrawer` về `<h2>`, và thay 4 ký tự Unicode `✓` tại `ShowroomCountClient` bằng icon Lucide `<Check />`; (3) Chuẩn hóa `.toLocaleString('vi-VN'/'en-US')` trong `warehouse/i18n.ts` chống React Hydration `#418`. |
| **v3.9** | 2026-10-18 | **Đồng bộ hóa tuyệt đối ngôn ngữ thiết kế Light Design System trên 80+ files toàn hệ thống**: (1) Xóa bỏ hoàn toàn các di tích codemod trắng-trên-trắng (`border: 1px solid #FFFFFF`, progress bar track `background: #FFFFFF`, skeleton `#FFFFFF`, thẻ con `background: #FFFFFF` không viền bên trong card trắng, và `<thead><tr>` trắng) trên 35+ files (`AuditLogClient`, `AllocationClient`, `KpiClient`, `FinanceClient`, `LandedCostTab`, `SettingsClient`, `CRMClient`, `ProposalsClient`, `ShipmentDetailDrawer`, `AIWidgets`, `AICatalogAnalysis`, `AIPipelineAnalysis`, `AICRMAnalysis`, `ShipmentsClient`, `SuppliersClient`, `margin/page.tsx`...) → chuẩn hóa về `#F8FAFC` + viền `#E2E8F0`; (2) Đồng bộ `media/loading.tsx` và `payment-requests/loading.tsx` về `(subpage-loading).tsx` (xóa spinner đỏ/tự chế); (3) Chuẩn hóa toàn bộ nút hành động chính và tab active đang dùng `bg-slate-900` / `bg-slate-800` lệch tông tại `SopCatalogClient`, `SopDetailModal`, `MarkdownDocModal`, `PaymentRequestsClient`, `POFinancialTab`, `ProcurementCashFlowModal`, `DailyCallPlannerView`, `CustomerAnalyticsDashboard`, `InspectionTab`, `ReplenishmentTab`, `WarehouseMapTab`, `MobileLocationCounter` và nâng cấp 96 nút `bg-[#0891B2] text-white` (3.7:1) lên chuẩn WCAG AA `bg-[#0E7490] hover:bg-[#155E75] text-white` (5.36:1); (4) Xóa sạch 56 vị trí `onMouseEnter`/`onMouseLeave` đổi màu inline DOM style sang CSS `hover:`, xóa `rounded-xl` còn sót, xóa `fontFamily` inline thừa, mở rộng bộ lọc ẩn tiêu đề trang trùng lặp trong `globals.css` và bổ sung tiêu đề song ngữ VI/EN cho toàn bộ 45 routes trong `Header.tsx`. |
| **v3.8** | 2026-10-14 | **Audit & Khắc phục toàn diện UI/UX toàn hệ thống**: (1) Phục hồi 100% Skeleton Loading bị trắng-trên-trắng (`#FFFFFF` trên `#FFFFFF`) tại `(subpage-loading).tsx` (34+ routes), `DashboardShell.tsx`, `ModuleLoading.tsx`, `dashboard/loading.tsx`, `reconciliation`, `shipments`, `sop` và bổ sung `loading.tsx` cho `hr`, `margin`, `sales/visits`; (2) Bổ sung route title trong `Header.tsx` cho `/dashboard/hr`, `/dashboard/sop`, `/dashboard/pipeline`, `/dashboard/settings/telegram`; (3) Xóa sổ 100% `window.alert()` (46 vị trí → `toast` từ `sonner`) và 3 `window.confirm()` còn sót (`BankReconciliationTab`, `PaymentRequestsClient` → `useConfirmDialog`); (4) Dọn sạch 243 class `dark:*` tại phân hệ SOP & `MarkdownViewer`, chuẩn hóa 87 vị trí `rounded-xl/2xl/3xl` về `rounded-lg`, nâng cấp độ tương phản WCAG AA (`bg-[#0E7490] text-white`), xóa `text-purple-600` và thay thế ký tự Unicode `✕` bằng icon `<X />` chuẩn Lucide. |
| **v3.7** | 2026-10-06 | **Loại bỏ 100% `window.confirm()` trình duyệt toàn hệ thống**: Thay thế toàn bộ 54 lệnh confirm thô sơ bằng hook `useConfirmDialog` và component `<ConfirmDialog>` đồng bộ chuẩn Light UI (`#0891B2` cyan accent, async spinner loading, accessible keyboard & backdrop, zero purple/violet). Hỗ trợ cả 2 pattern: async promise (`const ok = await confirm(...)`) và callback lifecycle (`onConfirm`). |
| **v3.6** | 2026-10-05 | Hoàn tất Đợt 4 (Toàn bộ 8 module còn lại): hr, settings, audit-log, media, qr-codes, agency, ai, dashboard (CEO Overview). Toàn bộ 34 module trong ERP đã chuẩn hóa 100% về Light Design System đồng nhất. |
| **v3.2** | 2026-10-05 | Pilot được duyệt. Đợt 1: codemod màu cho 25 file (quotations, price-list, pos, returns, delivery, pipeline, crm, contracts, proposals); chuyển cấu trúc sang kit cho Returns, Price List, Delivery (kèm E-POD/Create drawer). Lưu ý: `Toolbar` nhận `left`/`right`, không nhận children; `TableMessageRow` có `p-0` → luôn bọc `EmptyState`/`TableSkeleton` bên trong. |
| **v3.1** | 2026-10-05 | Pilot xong: Sales (list + 3 drawer), Products (list, bảng, 2 drawer), Customers (list + drawer), Sidebar/Header. Thêm `Drawer.actions`, `Pagination.onPageHover`, `WineTypeBadge` dùng chung (bỏ màu tím Fortified ở Margin). Script `ui-palette-codemod.mjs` + test. |
| **v3.0** | 2026-10-05 | Viết lại tài liệu thành 1 bản Light duy nhất (bỏ spec Dark cũ & đoạn lặp). Tải Inter qua `next/font`, Toaster light. Thêm token `lys-teal-strong/hover/soft`, 6 tông trạng thái `tone-*`, token chuyển động, `type-caption`; `radius-lg` 10→8px. Tạo `src/components/ui` (11 nhóm component) + `src/lib/ui/status.ts`. |
| v3.6 | 2026-10-05 | Hoàn tất Đợt 4 (Toàn bộ 8 module còn lại): hr, settings, audit-log, media, qr-codes, agency, ai, dashboard (CEO Overview). Toàn bộ 34 module trong ERP đã chuẩn hóa 100% về Light Design System đồng nhất. |
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
| ✅ Đã chuẩn hóa | **HR** — HrClient + DocumentUploadModal + EmployeeDetailDrawer + EmployeeFormModal (PageHeader, StatGrid, Button, Drawer) |
| ✅ Đã chuẩn hóa | **Settings** — SettingsClient + approval-matrix + telegram (PageHeader, StatGrid, StatCard, Tabs light, Drawer) |
| ✅ Đã chuẩn hóa | **Audit Log** — AuditLogClient (PageHeader, StatGrid, StatCard, Log filter table) |
| ✅ Đã chuẩn hóa | **Media** — MediaClient (PageHeader, StatGrid, StatCard, Button, Light Grid) |
| ✅ Đã chuẩn hóa | **QR Codes** — QRCodeClient (PageHeader, StatGrid, StatCard, Button, Table) |
| ✅ Đã chuẩn hóa | **Agency** — AgencyClient (PageHeader, StatGrid, StatCard, Button, Drawer, Tabs) |
| ✅ Đã chuẩn hóa | **AI** — ai/page.tsx + AIManagementUI + AIWidgets + OCRWidget + VaultUI + ActivePromptEditor (PageHeader, Widgets light) |
| ✅ Đã chuẩn hóa | **Dashboard (CEO)** — page.tsx + CeoOverviewContent + AICeoSummary + DailyRevenueChart + DashboardFilterBar + CustomerAnalyticsDashboard (PageHeader, StatGrid, Charts, KPI) |

---

## Pure Light Design System v4.2 — Print, Accessibility & Interaction Standards (2026-11-18)

- **Printable Modals (`.print-modal` / `.print-keep` / `.no-print`):** Quy tắc `@media print` trong `globals.css` chỉ ẩn `[role="dialog"]:not(.print-modal):not(.print-keep)` và `.fixed:not(.print-modal):not([class*="print:static"])`. Toàn bộ modal in (`PosmInventoryTab`, `PrintableConsignmentCount`, `PrintableConsignmentDispatch`, `PrintablePaymentRequest`, `PrintableAuditReport`, `StampsClient`, `MarkdownDocModal`, `SopDetailModal`) gắn `.print-modal`. Bảng sử dụng `table { page-break-inside: auto }`, `thead { display: table-header-group }`, `tr { page-break-inside: avoid }`.
- **Controlled Input Modals (Zero Native Prompt):** Cấm tuyệt đối `window.prompt`, `window.alert`, `window.confirm`. Luồng nhập lý do/VAT/số hóa đơn trong `SalesClient.tsx` sử dụng controlled modal Light Design System hỗ trợ validate, Escape để đóng và backdrop click.
- **WCAG AA Contrast & Zero Purple/Indigo:** Nút/tab active chữ trắng sử dụng tối thiểu `#0E7490` (thay cho `#0891B2` hoặc `bg-slate-900`/`800`). Loại bỏ hoàn toàn class `indigo-*` / `purple-*` / mã hex tím (`#7C3AED`, `#C084FC`) trên toàn bộ UI và thông báo.
- **Heading Hierarchy, Hick's Law & Mobile Inputs:** Mỗi trang công khai/app đảm bảo tối đa 1 thẻ `<h1>` chính (`ShowroomCountClient.tsx`), điều hướng phụ dùng `<button type="button">` thay vì quá nhiều `<Link>` (`CeoOverviewContent.tsx`), và input mobile dùng `text-base sm:text-sm` (`Header.tsx`, `ShowroomCountClient.tsx`) để tránh iOS Safari auto-zoom.
